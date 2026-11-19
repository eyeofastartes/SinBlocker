# AGENTS.md

## Repository at a glance

This is a Chrome Manifest V3 extension with editable shared scripts, manifest, page-hiding CSS, icons, and rules in `extension/`. `src/` holds UI HTML/JS, `input.css`, and readable background/content/store runtime scripts. Package scripts copy readable HTML/JavaScript, compile Tailwind v4 CSS, and minify HTML, generating UI/CSS plus `extension/background.js`, `extension/content.js`, and `extension/store.js`. No full-directory assembly, custom build checks, bundler, runtime dependencies, linter, or CI runs. `scripts/watch.mjs` copies readable UI changes and runs Tailwind watch. `scripts/package.py` signs deterministic CRX3 packages; managed-install scripts live in `scripts/`.

Edit UI and background/content/store source in `src/`, and other runtime source directly in `extension/`, never generated scripts or UI/CSS. Keep UI styling separate from `extension/styles.css`. Use Node.js >=22 and `npm ci`. Run `npm run build` after UI or `src/` runtime changes; never commit generated scripts or UI/CSS, `_metadata/`, `*.pem`, or `*.crx`. Runtime must remain classic-script JavaScript.

## Running and verification

Run `npm run build` to clear generated files, copy readable HTML/JavaScript, compile minified Tailwind CSS, and minify options/popup HTML. `npm run watch` copies readable UI HTML/JS and watches UI/CSS changes. Stop watch before building or clearing. `npm run clear` deletes the six generated UI files, generated background/content/store scripts, and output CSS, preserving runtime source and assets. `src-*` commands are helpers or optional packaging tools. Load `extension/`, not the repository root or `src/`. Run `node --test tests/*.test.mjs` for URL-rule and challenge-lock regression tests. No linter or custom build validation exists; use the manual checks below and `node --check` on changed scripts. Packaging requires Python 3 and OpenSSL: reuse an existing key, or run `npm run src-keygen` once, then `npm run src-package`. Never replace a signing key during updates.

After changing code, manually reload the unpacked extension before testing. A service worker or content script from the previous load can otherwise make results misleading. Existing storage persists across reloads, so clear the extension's local storage when testing first-install behavior or defaults.

Use the affected surface for focused verification:

- **Popup:** test the global toggle, adding/removing the active HTTP(S) hostname, unsupported tabs, status text, badge state, and opening options. Verify adding allows the site, removing re-blocks it, status reflects the allowlist, and that both the global toggle and the site action are disabled while the master lock is on.
- **Options:** test URL and bare-domain input, invalid input, duplicate detection, exact-host versus subdomain matching, individual removal, remove-all (an empty allowlist blocks every site), and the master lock (set, gate, unlock, and reset).
- **Page blocking:** test a listed and unlisted site with global blocking both on and off; include images, videos, `<picture>`, nested `<source>`, background images, and dynamically changed storage.
- **Single-media reveal:** while blocking is active on an unlisted site, right-click hidden image and video elements and verify only the selected media becomes visible.
- **Keyboard command:** verify `Alt+I` toggles global blocking, refreshes open tabs, and updates the action badge.
- **Installation/onboarding:** test with `onboardingComplete` absent; the onboarding page should open once, and either completion action should persist the flag.
- **SafeSearch:** verify strict/moderate engine ruleset selection, redirects without loops, disabling, and storage-change updates.
- **Packaging:** sign twice with a temporary RSA key and compare CRX bytes; verify the signature, ZIP manifest, and extension ID. Installer defaults are repository `extension.crx`, `extension.pem`, and `extension/manifest.json`, independent of working directory. Never run administrator installation as part of build verification.

## Runtime pieces and data flow

### Extension entry points

- `extension/manifest.json` declares wiring: `background.js` is the MV3 service worker; `domain.js`, `safesearch.js`, `site_categories.js`, `default_sites.js`, `store.js`, then `content.js` run at `document_start` on all URLs. Extension pages are `popup.html`, `options.html`, and `onboarding.html`. Runtime filenames below live directly in `extension/`; UI files and background/content/store scripts are generated there from `src/`.
- `background.js` is the coordinator. It handles installation, tab lifecycle, storage changes, runtime messages, the keyboard command, context menus, content-script messages, badge updates, and the persistent pre-hide registration.
- `content.js` is the page-side state machine. It reads storage itself and also accepts background messages. Blocking is represented by the extension-namespaced `ivb-hide-images` class on `document.documentElement`.
- `styles.css` performs the actual page-media hiding and is injected into pages directly (plain CSS, not Tailwind). Extension-page styling lives in `src/input.css`, compiled to `main.css` and linked by `popup.html`, `options.html`, and `onboarding.html`.
- `popup.js` owns quick global/site actions for the active tab. `options.js` owns the complete allowlist and the master lock (password set, gate, and unlock). `onboarding.js` only records onboarding completion and opens options.
- `domain.js` is shared, classic-script code rather than a module. It is loaded with `importScripts` in the service worker and before dependent scripts in popup, options, and content contexts.
- `store.js` is the single settings store. It loads after `domain.js` in every context (service worker `importScripts`, content-script manifest order, and extension-page script tags) and owns all `chrome.storage.local` reads and writes.

### Persistent state

All state lives in a single JSON blob under the `IAVB_options` key in
`chrome.storage.local`, managed exclusively through `store.js`
(`getStoredSettings` and `updateStoredSettings`). The blob holds:

- `blockingState`: global boolean master switch. Missing values default to `true`.
- `websites`: allowlist array of `{ website: string, matchSubdomains: boolean }`. Missing values use the pre-included `DEFAULT_WEBSITES`; an explicit empty array allows no sites.
- `onboardingComplete`: boolean checked only during installation before opening onboarding.
- `masterLock`: `"unlocked"` (default), `"locked"` (Password Lock), or `"challenge"` (Challenge Lock). Password Lock uses `masterLockHash` (salt-prefixed SHA-256 hex) and `masterLockSalt`.
- `challengeDifficulty`: `"number-parrot"`, `"simple-addition"` (default), or `"10-doors"`. Easy copies a displayed number; normal adds small numbers. Hard starts with 10 closed doors and 2-5 people assigned steps from 1-5; each toggles every assigned n-th door. Questions avoid all-open/all-closed results. Native checkboxes styled as buttons select the open set in one row; Submit checks the exact set.
- `challengeQuestions`: integer from 1 to 100, default 10. Difficulty and count save on change.

`store.js` also writes two integrity-checked backups of the blob under
secret-derived keys (`IAVB_backup_*`) plus an `IAVB_options_hash` digest. On
every read it verifies the primary blob against its digest; if the primary is
missing or tampered it restores from a valid backup, and it rebuilds any
missing or mismatched backups. Legacy top-level keys (`blockingState`,
`websites`, `onboardingComplete`, `masterLock`,
`masterLockHash`, `masterLockSalt`) are migrated into the blob on first read.

Blocking occurs only when `blockingState` is truthy and the current normalized hostname does not match any entry in the `websites` allowlist. An empty allowlist blocks every site. Use `isBlocked(hostname, websites)` from `domain.js` for the single allowlist decision. Obsolete mode fields in existing settings are discarded during normalization, preserving the site list and rebuilding integrity records. The background mirrors the verified decision into a persistent `document_start` registration that runs `prehide.js` only on blocked HTTP(S) pages, preventing media from painting before storage is read. Storage changes rebuild this registration for future navigations and broadcast the resulting state to existing tabs, while each content script also listens to storage and recalculates locally. Popup and options additionally send `toggleImageHiding` or `websitesUpdated`; preserve both paths unless deliberately simplifying and testing all update cases.

`masterLock` does not change blocking behavior; it only gates settings. Both protected modes disable the popup global toggle and per-site action. Password Lock shows a password gate; Challenge Lock requires all configured questions and a randomly positioned, rotated Confirm button for each answer. Challenge completion unlocks only the current options page, never the stored lock or popup controls. Challenge Lock adds friction rather than authentication. The stored password is a salted SHA-256 hash, never the plaintext; unlocking removes the hash and salt. On the options page, every option mutation goes through `requireUnlocked()` in `options.js`, which refuses changes until the password has been entered; the gate is enforced in code rather than relying on CSS hiding.

### Hostname matching contract

Always use `normalizeDomain`, `isSiteMatch`, `isSiteInList`, and `isBlocked` from `domain.js`; do not duplicate URL parsing or allowlist logic in another surface.

`normalizeDomain` trims, lowercases, accepts a URL or bare hostname by supplying `https://`, extracts `URL.hostname`, and removes one leading `www.`. Entries therefore store normalized hostnames, not URL paths. Matching is exact by default. With `matchSubdomains`, a hostname also matches when it ends in `.` plus the stored domain; the dot boundary is significant.

`isBlocked(hostname, websites)` is the single allowlist decision point: it returns `!isSiteInList(hostname, websites)`. Listed hosts are allowed; all others are blocked while global blocking is on. There is no selectable filtering mode.

Popup removal compares normalized domains and therefore removes the matching stored entry regardless of its `matchSubdomains` value. Duplicate detection in options also treats the hostname as the identity and does not permit separate exact-host and subdomain-enabled entries for the same hostname.

## Media-hiding and reveal invariants

The hiding behavior has intentional non-obvious constraints:

- Images and videos use `opacity: 0`, not `display: none`, so they retain layout and remain targets for Chrome's native image/video context menu.
- `<picture>` itself stays in layout; its nested image is hidden. Do not broadly hide `<picture>`.
- Images whose class suggests `Emoji`, `avatar`, or `Icon`, images whose source contains `emoji`, and inline backgrounds whose class suggests `Icon` are intentionally excluded.
- Embedded content, objects, iframes, and matching inline background styles are hidden with `display: none` and cannot use the same right-click reveal path.
- A revealed image/video receives `ivb-shown`. `content.js` tracks revealed elements with a `WeakSet`, although visibility is controlled by the class.
- Context-menu reveal first tries to match Chrome's `srcUrl` against `currentSrc`, `src`, `<picture><source srcset>`, and `<video><source>`. URL matching tolerates relative URLs and query-string differences when origin and pathname match. If matching fails, the capture-phase `contextmenu` fallback reveals the last blocked media found at the click coordinates.
- Content-script message failures are intentionally swallowed because some tabs cannot host extensions or have not received the content script yet.

When changing selectors or reveal logic, test both right-click targeting and page layout. Making hidden media non-interactive breaks the feature even if blocking looks correct.

CAPTCHA exemptions live entirely in `styles.css`: a bounded `@scope` excludes recognized roots and contents, while `:has()` protects inline-background ancestors from `display: none` without exempting their backgrounds or sibling media. Scoped hiding rules use `:scope`, not an ancestor selector outside the scope. Keep the provider iframe selectors identical in the scope boundary and ancestor protection. Require exact provider hostnames and widget paths; never use generic CAPTCHA substrings. Turnstile currently renders its iframe in a closed shadow root, so explicit rendering is recognized through a direct hidden response input with the `cf-chl-widget-*_response` ID. Renamed or disabled response fields need the standard `.cf-turnstile[data-sitekey]` marker for background-ancestor protection. ALTCHA may use light or shadow DOM. Do not force widget display, opacity, visibility, or pointer events. Verify dynamic insertion/removal, provider-hidden states, nested background wrappers, sibling media, checkbox/challenge flows, and existing reveal behavior. CSS scope requires Chrome 118 or newer; arbitrary outer cross-origin frames remain unsupported.

## JavaScript conventions

- Use plain browser JavaScript with no imports/exports, bundler syntax, or framework assumptions.
- Use `const` by default and `let` for mutable state; functions and local variables use `camelCase`, constants use `UPPER_SNAKE_CASE`.
- Use async functions and Promise-based Chrome APIs where the surrounding code does. Some APIs remain callback-based (`tabs.query` in broadcasts and context-menu creation); follow the local pattern rather than converting unrelated code.
- Guard unsupported tabs before messaging: only `http://` and `https://` URLs participate in blocking.
- Validate storage data before consuming it across extension boundaries. `background.js` explicitly rejects a non-array `websites` value.
- Runtime message names are string contracts shared across contexts: `hide`, `show`, `showMedia`, `toggleImageHiding`, `websitesUpdated`, `getBlockingState`, and `getWebsites`. Update every sender and receiver together.
- `background.js` message handling returns `true` because responses may be sent asynchronously. Preserve that behavior for asynchronous `sendResponse` branches.
- The code uses two-space indentation, semicolons, double-quoted JavaScript strings, trailing commas in multiline literals/calls, and multiline wrapping for long expressions.

## UI and CSS conventions

- Extension-page styling is Tailwind. Apply complete utility names in page markup or JS strings; `src/input.css` holds base and structural CSS and must not reintroduce `@apply`. Rebuild `extension/main.css`, but never commit it. Preserve `toast` IDs, the `grid` view token, `is-*` states, and `ivb-*` runtime contracts without rewriting.
- Keep state-controlled display rules and their default display in the same component layer. Tailwind display utilities such as `flex` override component-layer `display: none` even on more specific collapsed-state selectors. For category grids, use `.site-category-grid` for default display, not a `flex` utility; verify collapse/expand, chevron rotation, `aria-expanded`, and search auto-expansion after changes.
- Page-blocking selectors belong in `styles.css` only; never add page-hiding rules to the Tailwind source.
- Reuse existing state modifiers such as `is-visible`, `is-active`, `is-idle`, and `is-off`. JavaScript toggles these classes rather than setting inline display styles.
- DOM text is assigned with `textContent`; keep user-provided hostnames out of `innerHTML`.
- Popup state is rendered from the five mutable values at the top of `popup.js` (`currentHostname`, `isSupportedTab`, `websites`, `blockingState`, and `isLocked`). Mutations update storage, update the local cached value, and call `renderPopup`.
- Options list rows carry the normalized hostname in `data-domain`, but storage mutation uses the full site object and normalized-domain comparison.

## Change checklist

- If adding a shared script dependency, wire it in every required execution context and preserve load order. Service-worker scripts require `importScripts`; extension pages and content scripts use manifest/HTML ordering.
- If changing storage keys or the website object shape, update `store.js` (the settings blob, its validation, and the integrity/backup layout) and every consumer together. Legacy keys are migrated into the blob on first read; keep `readLegacySettings` in sync if fields are added or renamed.
- If adding permissions, commands, entry points, CSS, or content scripts, update `extension/manifest.json`. Runtime output belongs directly in `extension/`; readable background/content/store source belongs in `src/`. New generated files need wiring in the build, clear command, and ignore rules. Preserve relative `icons/*` and `rules/*` paths. Keep `package.json` and manifest versions equal; update the lockfile when changing package version. Do not add a Web Store `update_url` to local builds; managed policy owns updates.
- If changing global state behavior, verify both badge update routes: explicit updates after commands/storage events and implicit reads on startup/tab activation.
- If changing the blocked/not-blocked decision, keep allowlist-only behavior in `isBlocked(hostname, websites)` in `domain.js` and verify popup, background, content, storage-change listeners, and persistent pre-hide exclusions agree. Empty allowlists must block every HTTP(S) site while global blocking is on.
- If changing master-lock behavior, keep the password stored as a salted SHA-256 hash, update the options password gate and the popup's disabled controls together, and avoid duplicating the hashing logic.
- If changing install behavior, remember `onInstalled` distinguishes only the `install` reason before opening onboarding.
- Keep extension-page code compatible with Manifest V3 Content Security Policy: scripts are external files, and extension pages contain no inline `<script>` or `<style>` blocks.
