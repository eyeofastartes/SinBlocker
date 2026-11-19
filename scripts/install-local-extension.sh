#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
BROWSER=""
CRX="$REPO_DIR/extension.crx"
KEY="$REPO_DIR/extension.pem"
MANIFEST="$REPO_DIR/extension/manifest.json"
FLATPAK_APP_ID="io.github.ungoogled_software.ungoogled_chromium"
FLATPAK_POLICY_LINK=""
FLATPAK_PROFILE=""

usage() {
    cat <<EOF
Usage: $0 (-brave | -chrome | -ungoogled) [options]

Browser:
  -brave                         Install for Brave
  -chrome                        Install for Google Chrome
  -ungoogled                     Install for ungoogled-chromium

Options:
  -ext, --extension PATH         CRX package (default: $CRX)
  -key, --key PATH               PEM signing key (default: $KEY)
  -manifest, --manifest PATH     Built manifest (default: $MANIFEST)
  -h, --help                     Show this help
EOF
}

while [ "$#" -gt 0 ]; do
    case "$1" in
        -brave|--brave)
            BROWSER="brave"
            ;;
        -chrome|--chrome)
            BROWSER="chrome"
            ;;
        -ungoogled|--ungoogled|--ungoogled-chromium)
            BROWSER="ungoogled"
            ;;
        -ext|--extension)
            [ "$#" -ge 2 ] || { echo "Missing value for $1" >&2; usage >&2; exit 1; }
            CRX="$2"
            shift
            ;;
        -key|--key)
            [ "$#" -ge 2 ] || { echo "Missing value for $1" >&2; usage >&2; exit 1; }
            KEY="$2"
            shift
            ;;
        -manifest|--manifest)
            [ "$#" -ge 2 ] || { echo "Missing value for $1" >&2; usage >&2; exit 1; }
            MANIFEST="$2"
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1" >&2
            usage >&2
            exit 1
            ;;
    esac
    shift
done

if [ -z "$BROWSER" ]; then
    echo "Choose a browser with -brave, -chrome, or -ungoogled" >&2
    usage >&2
    exit 1
fi

case "$BROWSER" in
    brave)
        BROWSER_NAME="Brave"
        POLICY="/etc/brave/policies/managed/managed_policies.json"
        POLICY_URL="brave://policy"
        EXTENSIONS_URL="brave://extensions"
        ;;
    chrome)
        BROWSER_NAME="Google Chrome"
        POLICY="/etc/opt/chrome/policies/managed/managed_policies.json"
        POLICY_URL="chrome://policy"
        EXTENSIONS_URL="chrome://extensions"
        ;;
    ungoogled)
        BROWSER_NAME="ungoogled-chromium"
        POLICY="/etc/chromium/policies/managed/managed_policies.json"
        POLICY_URL="chrome://policy"
        EXTENSIONS_URL="chrome://extensions"
        if command -v flatpak >/dev/null 2>&1 \
            && flatpak info "$FLATPAK_APP_ID" >/dev/null 2>&1; then
            FLATPAK_REF="$(flatpak info --show-ref "$FLATPAK_APP_ID")"
            FLATPAK_ARCH="$(printf '%s\n' "$FLATPAK_REF" | cut -d/ -f3)"
            FLATPAK_POLICY_VERSION="$(
                flatpak info --show-metadata "$FLATPAK_APP_ID" |
                awk '
                    /^\[Extension io.github.ungoogled_software.ungoogled_chromium.Policy\]$/ { found = 1; next }
                    found && /^version=/ { sub(/^version=/, ""); print; exit }
                    found && /^\[/ { exit }
                '
            )"
            if [ -z "$FLATPAK_ARCH" ] || [ -z "$FLATPAK_POLICY_VERSION" ]; then
                echo "Could not determine ungoogled-chromium Flatpak policy extension details" >&2
                exit 1
            fi
            POLICY_ROOT="/etc/chromium-browser"
            POLICY="$POLICY_ROOT/policies/managed/managed_policies.json"
            if flatpak info --system "$FLATPAK_APP_ID" >/dev/null 2>&1; then
                FLATPAK_EXTENSION_ROOT="/var/lib/flatpak/extension"
            else
                FLATPAK_EXTENSION_ROOT="${XDG_DATA_HOME:-$HOME/.local/share}/flatpak/extension"
            fi
            FLATPAK_POLICY_LINK="$FLATPAK_EXTENSION_ROOT/$FLATPAK_APP_ID.Policy.sinblocker/$FLATPAK_ARCH/$FLATPAK_POLICY_VERSION"
            FLATPAK_PROFILE="$HOME/.var/app/$FLATPAK_APP_ID/config/chromium/Default"
            if [ "$EUID" -eq 0 ]; then
                echo "Run this script as the browser user, not with sudo; profile files must belong to that user" >&2
                exit 1
            fi
        fi
        ;;
esac

POLICY_BACKUP_DIR="/var/backups/$BROWSER-policies"
SERVE_DIR="/var/lib/$BROWSER-local-extension"
SERVICE_FILE="/etc/systemd/system/$BROWSER-local-extension.service"
SERVICE_NAME="$BROWSER-local-extension.service"
UPDATE_URL="http://127.0.0.1:8765/updates.xml"
CRX_URL="http://127.0.0.1:8765/extension.crx"
if [ -n "$FLATPAK_PROFILE" ]; then
    LOCAL_CRX_ONLY=true
else
    LOCAL_CRX_ONLY=false
fi
if [ "$BROWSER" = "brave" ]; then
    DISABLE_INCOGNITO=true
else
    DISABLE_INCOGNITO=false
fi

REQUIRED_COMMANDS=(jq openssl awk cut tr grep python3 sudo)
if [ "$LOCAL_CRX_ONLY" != true ]; then
    REQUIRED_COMMANDS+=(curl systemctl)
fi
for command in "${REQUIRED_COMMANDS[@]}"; do
    if ! command -v "$command" >/dev/null 2>&1; then
        echo "Missing required command: $command" >&2
        exit 1
    fi
done

for file in "$CRX" "$KEY" "$MANIFEST"; do
    if [ ! -f "$file" ]; then
        echo "Missing required file: $file" >&2
        usage >&2
        exit 1
    fi
done

if [ ! -e "$POLICY" ]; then
    sudo install -d -o root -g root -m 0755 "$(dirname -- "$POLICY")"
    printf '{}\n' | sudo tee "$POLICY" >/dev/null
    sudo chown root:root "$POLICY"
    sudo chmod 0644 "$POLICY"
elif [ ! -f "$POLICY" ]; then
    echo "Policy path is not a regular file: $POLICY" >&2
    exit 1
fi

if [ -n "$FLATPAK_POLICY_LINK" ]; then
    if [ -e "$FLATPAK_POLICY_LINK" ] && [ ! -L "$FLATPAK_POLICY_LINK" ]; then
        echo "Flatpak policy extension path exists and is not a symlink: $FLATPAK_POLICY_LINK" >&2
        exit 1
    fi
    sudo install -d -o root -g root -m 0755 "$(dirname -- "$FLATPAK_POLICY_LINK")"
    sudo ln -sfn "$POLICY_ROOT" "$FLATPAK_POLICY_LINK"
fi

sudo jq -e '
    type == "object"
    and ((.ExtensionInstallForcelist // []) | type == "array")
    and all((.ExtensionInstallForcelist // [])[]; type == "string")
    and ((.ExtensionSettings // {}) | type == "object")
    and ((.MandatoryExtensionsForIncognitoNavigation // []) | type == "array")
    and all((.MandatoryExtensionsForIncognitoNavigation // [])[]; type == "string")
' "$POLICY" >/dev/null

EXTENSION_ID="$(
    openssl pkey -in "$KEY" -pubout -outform DER 2>/dev/null |
    openssl sha256 |
    awk '{print $NF}' |
    cut -c1-32 |
    tr '0-9a-f' 'a-p'
)"
EXTENSION_VERSION="$(jq -e -r '.version | select(type == "string" and length > 0)' "$MANIFEST")"

if ! printf '%s\n' "$EXTENSION_ID" | grep -Eq '^[a-p]{32}$'; then
    echo "Invalid extension ID: $EXTENSION_ID" >&2
    exit 1
fi

if ! printf '%s\n' "$EXTENSION_VERSION" | grep -Eq '^[0-9]+(\.[0-9]+){0,3}$'; then
    echo "Invalid extension version: $EXTENSION_VERSION" >&2
    exit 1
fi

python3 - "$CRX" "$EXTENSION_VERSION" <<'PY'
import json
import sys
import zipfile

crx_path, expected_version = sys.argv[1:]
try:
    with zipfile.ZipFile(crx_path) as archive:
        manifest = json.loads(archive.read("manifest.json"))
except (KeyError, OSError, ValueError, zipfile.BadZipFile) as error:
    raise SystemExit(f"Invalid CRX package: {error}")
if manifest.get("version") != expected_version:
    raise SystemExit(
        f"CRX version {manifest.get('version')!r} does not match manifest version {expected_version!r}"
    )
PY

chmod 600 "$KEY"

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT
UPDATES_XML="$WORK_DIR/updates.xml"
NEW_POLICY="$WORK_DIR/managed_policies.json"
UNIT_FILE="$WORK_DIR/$SERVICE_NAME"

cat >"$UPDATES_XML" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<gupdate xmlns="http://www.google.com/update2/response" protocol="2.0">
  <app appid="$EXTENSION_ID">
    <updatecheck
      codebase="$CRX_URL"
      version="$EXTENSION_VERSION" />
  </app>
</gupdate>
EOF

python3 -c 'import sys, xml.etree.ElementTree as ET; ET.parse(sys.argv[1])' "$UPDATES_XML"

ENTRY="$EXTENSION_ID;$UPDATE_URL"
sudo jq \
    --arg id "$EXTENSION_ID" \
    --arg entry "$ENTRY" \
    --arg update_url "$UPDATE_URL" \
    --argjson disable_incognito "$DISABLE_INCOGNITO" '
    if type != "object" then
        error("Policy root must be an object")
    elif ((.ExtensionInstallForcelist // []) | type) != "array" then
        error("ExtensionInstallForcelist is not an array")
    elif any((.ExtensionInstallForcelist // [])[]; type != "string") then
        error("ExtensionInstallForcelist contains a non-string value")
    elif ((.ExtensionSettings // {}) | type) != "object" then
        error("ExtensionSettings is not an object")
    elif ((.ExtensionSettings[$id] // {}) | type) != "object" then
        error("ExtensionSettings entry for this extension is not an object")
    elif ((.MandatoryExtensionsForIncognitoNavigation // []) | type) != "array" then
        error("MandatoryExtensionsForIncognitoNavigation is not an array")
    elif any((.MandatoryExtensionsForIncognitoNavigation // [])[]; type != "string") then
        error("MandatoryExtensionsForIncognitoNavigation contains a non-string value")
    elif $disable_incognito and (.IncognitoModeAvailability? // 1) != 1 then
        error("IncognitoModeAvailability is already set to a different value")
    elif any((.ExtensionInstallForcelist // [])[]; startswith($id + ";") and . != $entry) then
        error("Extension ID already has a different update URL")
    elif (.ExtensionSettings[$id].update_url? // $update_url) != $update_url then
        error("ExtensionSettings entry already has a different update URL")
    else
        .ExtensionInstallForcelist =
            ((.ExtensionInstallForcelist // [])
             | map(select(. != "EXTENSION_ID;http://127.0.0.1:8765/updates.xml"))
             | if index($entry) then . else . + [$entry] end)
        | .ExtensionSettings =
            ((.ExtensionSettings // {})
             | .[$id] = ((.[$id] // {}) + {
                 "installation_mode": "force_installed",
                 "update_url": $update_url,
                 "override_update_url": true
             }))
        | .MandatoryExtensionsForIncognitoNavigation =
            ((.MandatoryExtensionsForIncognitoNavigation // [])
             | map(select(. != "EXTENSION_ID"))
             | if index($id) then . else . + [$id] end)
        | if $disable_incognito then
              .IncognitoModeAvailability = 1
          else
              del(.IncognitoModeAvailability)
          end
    end
' "$POLICY" >"$NEW_POLICY"

jq -e . "$NEW_POLICY" >/dev/null

if [ -e "$SERVE_DIR/extension.pem" ]; then
    echo "Refusing to continue: $SERVE_DIR/extension.pem must not be served" >&2
    exit 1
fi

PYTHON_PATH="$(command -v python3)"
cat >"$UNIT_FILE" <<EOF
[Unit]
Description=$BROWSER_NAME local extension update server
After=local-fs.target

[Service]
Type=simple
DynamicUser=yes
ExecStart=$PYTHON_PATH -m http.server 8765 --bind 127.0.0.1 --directory $SERVE_DIR
Restart=on-failure
RestartSec=3
NoNewPrivileges=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectHome=yes
ProtectSystem=strict
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
RestrictAddressFamilies=AF_INET AF_UNIX
RestrictNamespaces=yes
RestrictRealtime=yes
RestrictSUIDSGID=yes
LockPersonality=yes
CapabilityBoundingSet=
AmbientCapabilities=
UMask=0077

[Install]
WantedBy=multi-user.target
EOF

BACKUP="$POLICY_BACKUP_DIR/managed_policies.json.$(date +%Y%m%d%H%M%S)"
sudo install -d -o root -g root -m 0700 "$POLICY_BACKUP_DIR"
sudo cp -a "$POLICY" "$BACKUP"
if [ "$LOCAL_CRX_ONLY" != true ]; then
    sudo install -d -o root -g root -m 0755 "$SERVE_DIR"
    sudo install -o root -g root -m 0644 "$CRX" "$SERVE_DIR/extension.crx"
    sudo install -o root -g root -m 0644 "$UPDATES_XML" "$SERVE_DIR/updates.xml"
fi
if [ "$LOCAL_CRX_ONLY" != true ]; then
    sudo install -o root -g root -m 0644 "$UNIT_FILE" "$SERVICE_FILE"
    sudo systemctl daemon-reload
    sudo systemctl enable --now "$SERVICE_NAME"
    sudo systemctl is-active --quiet "$SERVICE_NAME"

    SERVER_READY=false
    for _ in 1 2 3 4 5; do
        if curl --fail --silent --show-error "$UPDATE_URL" >/dev/null \
            && curl --fail --silent --show-error "$CRX_URL" >/dev/null; then
            SERVER_READY=true
            break
        fi
        sleep 1
    done
    if [ "$SERVER_READY" != true ]; then
        echo "Local extension server did not become ready" >&2
        exit 1
    fi
fi

sudo install -o root -g root -m 0644 "$NEW_POLICY" "$POLICY"
sudo jq -e . "$POLICY" >/dev/null
if [ -n "$FLATPAK_PROFILE" ]; then
    flatpak kill "$FLATPAK_APP_ID" >/dev/null 2>&1 || true
    PUBLIC_KEY="$(openssl pkey -in "$KEY" -pubout -outform DER 2>/dev/null | openssl base64 -A)"
    python3 - "$CRX" "$FLATPAK_PROFILE" "$EXTENSION_ID" "$EXTENSION_VERSION" "$PUBLIC_KEY" <<'PY'
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import stat
import sys
import tempfile
import time
import zipfile

crx_path, profile_path, extension_id, version, public_key = sys.argv[1:]
profile = Path(profile_path)
profile.mkdir(parents=True, exist_ok=True)
prefs_path = profile / "Preferences"
secure_path = profile / "Secure Preferences"
if secure_path.exists():
    secure = json.loads(secure_path.read_text())
    if extension_id in secure.get("extensions", {}).get("settings", {}):
        prefs_path = secure_path
prefs = json.loads(prefs_path.read_text()) if prefs_path.exists() else {}
settings = prefs.setdefault("extensions", {}).setdefault("settings", {})
backup = profile / "sinblocker-backups" / str(time.time_ns())
backup.mkdir(parents=True, mode=0o700)
if prefs_path.exists():
    shutil.copy2(prefs_path, backup / prefs_path.name)
    (backup / prefs_path.name).chmod(0o600)
extensions = profile / "Extensions" / extension_id
extensions.mkdir(parents=True, exist_ok=True)
destination = extensions / f"{version}_0"
with tempfile.TemporaryDirectory(prefix=".sinblocker-", dir=extensions) as staging:
    unpacked = Path(staging) / "package"
    unpacked.mkdir()
    with zipfile.ZipFile(crx_path) as archive:
        for member in archive.infolist():
            path = PurePosixPath(member.filename)
            if path.is_absolute() or ".." in path.parts or "\\" in member.filename:
                raise SystemExit(f"Unsafe CRX member: {member.filename}")
            if stat.S_ISLNK(member.external_attr >> 16):
                raise SystemExit(f"CRX symlinks are not supported: {member.filename}")
        archive.extractall(unpacked)
    manifest_path = unpacked / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    manifest["key"] = public_key
    manifest_path.write_text(json.dumps(manifest))
    if destination.exists():
        shutil.move(str(destination), str(backup / destination.name))
    os.replace(unpacked, destination)
entry = settings.setdefault(extension_id, {})
entry.update({
    "location": 7,
    "path": f"{extension_id}/{version}_0",
    "manifest": manifest,
    "state": 1,
    "disable_reasons": [],
    "creation_flags": 0,
    "from_webstore": False,
})
with tempfile.NamedTemporaryFile(mode="w", dir=profile, delete=False) as output:
    temporary = Path(output.name)
    try:
        json.dump(prefs, output)
        output.flush()
        os.fsync(output.fileno())
        os.replace(temporary, prefs_path)
    finally:
        temporary.unlink(missing_ok=True)
print(f"Bootstrapped managed extension in {destination}")
print(f"Profile backup: {backup}")
PY
fi
if [ "$LOCAL_CRX_ONLY" != true ]; then
    sudo python3 -c 'import sys, xml.etree.ElementTree as ET; ET.parse(sys.argv[1])' "$SERVE_DIR/updates.xml"
fi

echo "Installed extension $EXTENSION_ID version $EXTENSION_VERSION for $BROWSER_NAME"
echo "Policy backup: $BACKUP"
if [ -n "$FLATPAK_POLICY_LINK" ]; then
    flatpak kill "$FLATPAK_APP_ID" >/dev/null 2>&1 || true
    echo "Flatpak policy extension: $FLATPAK_POLICY_LINK"
fi
echo "Restart $BROWSER_NAME, reload $POLICY_URL, then check $EXTENSIONS_URL"
