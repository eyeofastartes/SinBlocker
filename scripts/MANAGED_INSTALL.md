# Managed Chromium extension installation on Linux

## Purpose

`install-local-extension.sh` installs the privately packaged SinBlocker CRX as an administrator-managed extension for one supported Chromium browser on Linux. Managed installation prevents a normal browser user from disabling or removing SinBlocker.

Supported targets:

- Brave
- Google Chrome
- Native ungoogled-chromium
- Flatpak ungoogled-chromium

The script configures the installation route required by each browser. Native targets use managed policy and a local update source. Flatpak ungoogled-chromium bootstraps the local CRX into the invoking user's Default profile and exposes root-owned policy through its `Policy` extension point. Use the script rather than creating policy, service, or Flatpak extension files manually.

## Requirements

The installer requires `jq`, `openssl`, `python3`, `sudo`, and standard shell tools. Native targets also require `curl` and `systemctl`; Flatpak ungoogled-chromium does not. It expects these repository inputs unless alternate paths are supplied:

- Repository-root `extension.crx`: packaged and signed extension
- Repository-root `extension.pem`: existing private packaging key
- `extension/manifest.json`: extension manifest, source of the package version

Defaults are resolved relative to the repository, not the caller's working
directory or `scripts/`. Build prerequisites are Node.js >=22 and npm; packaging
also requires Python 3 and OpenSSL. From the repository root:

```sh
npm ci
npm run src-keygen
npm run src-package
bash scripts/install-local-extension.sh --brave
```

Skip `src-keygen` if a signing key already exists. It refuses to overwrite a key.
For Chrome use `--chrome`; for native or Flatpak ungoogled-chromium use
`--ungoogled`. Alternate input paths remain supported through `--extension`,
`--key`, and `--manifest`. See [build documentation](../docs/BUILD.md) for custom
packaging paths and deterministic CRX3 output.

Keep the private key secret and reuse it for every update. Changing the key changes the extension ID and creates a separate extension installation.

The selected browser must already be installed. For ungoogled-chromium, the script automatically detects whether the Flatpak package is installed and chooses the appropriate setup.

## Run the installer

Run `install-local-extension.sh` from a terminal and select exactly one browser with its Brave, Chrome, or ungoogled-chromium option. The repository CRX, key, and manifest are used by default. The script also accepts options for alternate input paths.

Use the script's help option for the current command syntax and complete option list. The script requests elevated privileges only when changing system-owned files or services; run both scripts as the browser user, not through `sudo`. Flatpak installation refuses root execution because profile files must remain user-owned. Save work and close the browser first: installation and removal stop the Flatpak browser before changing profile files.

## What the installer manages

The installer:

1. Derives the stable extension ID from the PEM public key.
2. Reads the extension version from the built manifest.
3. Confirms the packaged CRX contains the same version.
4. For native targets, installs root-owned copies of the CRX and generated update manifest and enables a local update service.
5. For Flatpak ungoogled-chromium, bootstraps the local CRX files and policy-install registration into the invoking user's Default profile without a system CRX staging directory.
6. Merges the complete managed extension policy into the selected browser's policy file.
7. Creates the required policy integration for Flatpak ungoogled-chromium when applicable.
8. Backs up existing browser policy before changing it.

Unrelated fields in an existing valid policy are preserved. The installer rejects conflicting extension update settings rather than silently replacing them.

Native browser targets use loopback TCP port `8765`, so only one generated target service can run at a time. Stop and disable the service for a previously selected native browser before installing for another native browser. Flatpak ungoogled-chromium does not use the update service.

For native targets, the loopback update endpoint is available only on the local machine. Root ownership prevents normal users from replacing the served package or update manifest. The private PEM key is not copied into the served directory.

## Managed files and services

Each browser target has isolated resources:

| Target | Policy file | Serving directory | Service | Backup directory |
| --- | --- | --- | --- | --- |
| Brave | `/etc/brave/policies/managed/managed_policies.json` | `/var/lib/brave-local-extension` | `brave-local-extension.service` | `/var/backups/brave-policies` |
| Google Chrome | `/etc/opt/chrome/policies/managed/managed_policies.json` | `/var/lib/chrome-local-extension` | `chrome-local-extension.service` | `/var/backups/chrome-policies` |
| Native ungoogled-chromium | `/etc/chromium/policies/managed/managed_policies.json` | `/var/lib/ungoogled-local-extension` | `ungoogled-local-extension.service` | `/var/backups/ungoogled-policies` |
| Flatpak ungoogled-chromium | `/etc/chromium-browser/policies/managed/managed_policies.json`, exposed through a Flatpak policy extension | None; extension files live in the user's Default profile | None | `/var/backups/ungoogled-policies` |

Missing policy directories and files are created as root-owned resources. Existing policy must be a JSON object with correctly typed extension-policy fields. Before changing it, the installer creates a timestamped backup outside the managed-policy directory.

Native targets use loopback TCP port `8765`, so only one generated target service can run at a time. Flatpak ungoogled-chromium bootstraps its local CRX into the profile and does not use this port.

## Browser policy behavior

SinBlocker is configured in both the force-install list and extension settings, and is pinned to its local update source. Extension settings take precedence over the force-install list, so its installation mode remains force-installed. Update URL overriding keeps later updates on the configured local URL. Flatpak ungoogled-chromium uses a local profile bootstrap with a policy-install location while retaining the same complete managed policy lockdown. The loopback URL remains a policy identifier, not a working updater for this target.

The installer validates existing policy types, avoids duplicate entries, and refuses to replace a conflicting update URL. Brave installation also refuses a conflicting Incognito setting.

Chrome and ungoogled-chromium remove any Incognito availability policy generated by an earlier run, keep Incognito available, and require SinBlocker for Incognito navigation. Brave disables Incognito because its current Chromium base may not recognize the mandatory-extension policy, which would otherwise permit bypassing SinBlocker.

Do not duplicate generated settings in separate policy files. Chromium reads every JSON file in its managed-policy directory, and conflicting values can prevent installation. Do not store backups there for the same reason.

## Flatpak ungoogled-chromium

For ungoogled-chromium, Flatpak cannot read host Chromium policy paths directly, so writing only to `/etc/chromium/policies/managed` appears to succeed but has no effect inside the sandbox. The installer instead uses `/etc/chromium-browser/policies/managed` and creates an unmanaged Flatpak policy extension under `/var/lib/flatpak/extension` for a system installation or the user's Flatpak data directory for a user installation. It links the extension root, not an individual JSON file, because Flatpak cannot resolve a file-level symlink while bind-mounting the extension. The installer reads the architecture and policy version from installed Flatpak metadata instead of assuming either value.

ungoogled-chromium's `disable-webstore-urls.patch` removes the call that starts pending extension update checks. Policy can therefore report correctly while no CRX download is attempted. The external-extension loader does scan `/app/chromium/extensions/extensions`, but its local CRX has a lower-priority, non-policy installation location. A pending force-install request can win over that local source; Chromium also rejects new non-policy installations of force-installed IDs. Moving the CRX between the extension root and its `extensions` subdirectory cannot fix this conflict.

The installer creates neither a system CRX staging directory nor an `.Extension.sinblocker` Flatpak mount. It stops the browser, extracts the packaged CRX into `~/.var/app/io.github.ungoogled_software.ungoogled_chromium/config/chromium/Default/Extensions/<extension_id>/<version>_0/`, and registers that relative path and manifest in the profile's `Preferences` with Chromium's policy-download location (`7`). It adds the signing public key to the extracted manifest to preserve the extension ID. If the existing entry lives in `Secure Preferences`, it updates that file instead. These writes run as the invoking user without `sudo`; system policy remains root-owned.

This is an offline bootstrap workaround, not Chromium's supported CRX installation API. Copying files alone does not register an extension. The installer backs up preferences and any replaced version directory under `Default/sinblocker-backups/<timestamp>/`, preserves unrelated preferences and extension settings, and replaces the preferences file atomically. Chromium must remain closed while these files change. Custom user-data directories and profiles other than Default are not installed automatically. Browser-version changes or preference-integrity enforcement may invalidate this workaround; verify it manually on the installed browser.

`ExtensionInstallForcelist`, force-installed `ExtensionSettings`, URL override, and mandatory Incognito navigation policy remain configured. Lockdown is provided by that policy and the policy-install location, not root ownership of profile files. It prevents browser UI removal/disable, not deliberate profile editing by its owner or administrator changes. Updates require repackaging with the original key and rerunning the installer; no loopback server is started.

When debugging, verify the profile version directory and registration as well as the Flatpak policy link. Policies must be visible under `/app/chromium/extensions/policies/managed` inside the sandbox. Older installations may retain redundant staging under `/var/lib/ungoogled-flatpak-extension`; the profile installation does not use it.

Relevant upstream background:

- [ungoogled-chromium issue #2523](https://github.com/ungoogled-software/ungoogled-chromium/issues/2523)
- [`disable-webstore-urls.patch`](https://raw.githubusercontent.com/ungoogled-software/ungoogled-chromium/master/patches/core/ungoogled-chromium/disable-webstore-urls.patch)
- [Flathub ungoogled-chromium documentation](https://github.com/flathub/io.github.ungoogled_software.ungoogled_chromium)

### Remove redundant staging from older installations

Save browser work and close Chromium, then run these commands as the browser user. They remove only the obsolete staging directory and `.Extension.sinblocker` integration. Keep `.Policy.sinblocker` and the managed policy file: they enforce lockdown.

```sh
flatpak kill io.github.ungoogled_software.ungoogled_chromium 2>/dev/null || true
sudo rm -rf -- /var/lib/ungoogled-flatpak-extension
sudo rm -rf -- /var/lib/flatpak/extension/io.github.ungoogled_software.ungoogled_chromium.Extension.sinblocker
sudo rm -rf -- "${XDG_DATA_HOME:-$HOME/.local/share}/flatpak/extension/io.github.ungoogled_software.ungoogled_chromium.Extension.sinblocker"
```

Reopen Chromium and verify SinBlocker remains enabled and locked down. Manual testing confirmed SinBlocker still works and cannot be removed or disabled after deleting the redundant staging directory and `.Extension.sinblocker` integration. Future installer runs do not recreate this staging. The removal script still cleans these legacy paths, in addition to the current profile installation.

## Updating SinBlocker

Increase the version in both `package.json` and `extension/manifest.json`, then update
`package-lock.json` with `npm install --package-lock-only`. Run `npm run src-package`
with the original PEM key and rerun `bash scripts/install-local-extension.sh`
with the same browser selection and inputs. Never generate a new key for an
update. The source manifest has no Chrome Web Store `update_url`; the installer's
managed policy pins updates to the local source.

The extension ID is the first 128 bits of the SHA-256 digest of the DER-encoded PEM public key, translated to Chromium's `a` through `p` alphabet. Any feature that changes identity handling must preserve this algorithm. A different key creates a different extension ID rather than updating the existing installation.

The installer sets the source PEM to owner-only permissions. It validates that the CRX is readable, that the manifest has a valid Chromium version, and that the packaged CRX version exactly matches the built manifest before replacing managed files. It is safe to rerun for the same target and preserves unrelated policy fields, except for the deliberate Chrome and ungoogled-chromium Incognito-policy cleanup.

## Verify installation

After the installer completes:

1. Fully exit and reopen the selected browser. Closing one window may leave browser processes running.
2. Open the browser's policy page and reload policies.
3. Confirm the extension installation, extension settings, and mandatory Incognito extension policies report as valid. For Brave, also confirm Incognito is disabled; the mandatory-extension policy may appear unknown until Brave supports it.
4. Open the browser's extensions page and confirm SinBlocker is installed and locked down.

For native-target service status, update-manifest availability, policy validation, or other diagnostics, use the browser-specific service and paths listed above. Confirm that the loopback update manifest responds and inspect the selected service journal when it does not.

For Flatpak ungoogled-chromium, manually test this workaround:

1. Save browser work, close Chromium, and run `./scripts/install-local-extension.sh -ungoogled` as the browser user.
2. Reopen Chromium, reload `chrome://policy`, and confirm all three extension policies are valid and contain the printed extension ID.
3. Confirm `Default/Extensions/<extension_id>/<version>_0/manifest.json` exists under the Flatpak profile path above, and SinBlocker appears enabled on `chrome://extensions` with removal and disabling unavailable.
4. Test actual image/video blocking, restart again, and confirm the extension and lockdown persist. Verify Incognito navigation is gated until SinBlocker is allowed there.
5. Rerun installation with the same key and a newer packaged version; confirm that version loads while unrelated extensions and their settings survive.
6. Run `./scripts/remove-local-extension.sh -ungoogled -id EXTENSION_ID`, reopen Chromium, and confirm SinBlocker, its profile version directory, and its policy entries are gone. Other extensions must remain.

If any step fails, report the browser version, installer output, relevant `chrome://policy` statuses, and SinBlocker's errors on `chrome://extensions`. Do not share full profile preferences or the private signing key.

## Common issues

- For native targets, port `8765` must be free, and only one generated browser service can use it.
- Keep the generated native-target service enabled for new installations, retries, and updates.
- Do not manually install the served CRX for native targets; managed policy performs installation.
- Existing policy files must contain valid JSON objects. The installer creates missing policy directories and files.
- Fully stop browser processes after policy changes.
- Flatpak policy paths must be exposed through a complete policy extension tree; direct host paths and individual file symlinks do not work. CRX files are extracted directly into the user profile.
- For Flatpak debugging, policy integration must match the installed package's architecture and policy-extension version. The profile must contain the extracted version directory and its policy-install preference entry. SinBlocker must appear in `ExtensionInstallForcelist`, `ExtensionSettings`, and `MandatoryExtensionsForIncognitoNavigation` after one installer run.
- Policy backups must remain outside managed-policy directories because Chromium attempts to parse every file there.
- Existing force-install or extension-settings entries for the same ID with another update URL are intentional hard conflicts.
- A service failure after managed files are copied can leave those files changed while policy remains unchanged. Restore the timestamped backup if recovery is needed.

If installation fails, review the installer's error and confirm that the CRX was packaged with the supplied PEM, the manifest and CRX versions match, port `8765` is available, and the selected browser installation is supported.

## Removal

Run `bash scripts/remove-local-extension.sh` from the repository root with exactly one of `--brave`, `--chrome`, or `--ungoogled` and the extension ID printed by packaging via `--id EXTENSION_ID`. The matching managed policy entries, local update service, served files, and target-specific integration are removed. ungoogled-chromium removal cleans both native and Flatpak resources. It stops the Flatpak browser, backs up and removes only the selected ID's preference entry from Default and existing `Profile *` profiles, and deletes that ID's installed extension files as the invoking user. Profile backups and extension-local storage are retained. Existing policy is backed up before modification.
