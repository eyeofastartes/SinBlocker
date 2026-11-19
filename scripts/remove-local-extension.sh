#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BROWSER=""
EXTENSION_ID=""
UPDATE_URL="http://127.0.0.1:8765/updates.xml"
FLATPAK_APP_ID="io.github.ungoogled_software.ungoogled_chromium"

usage() {
    cat <<EOF
Usage: $0 (-brave | -chrome | -ungoogled) -id EXTENSION_ID [options]

Browser:
  -brave                         Uninstall from Brave
  -chrome                        Uninstall from Google Chrome
  -ungoogled                     Uninstall from ungoogled-chromium

Options:
  -id, --id EXTENSION_ID         Extension ID to remove (required)
  -h, --help                     Show this help
EOF
}

while [ "$#" -gt 0 ]; do
    case "$1" in
        -brave|--brave)
            [ -z "$BROWSER" ] || { echo "Choose exactly one browser" >&2; usage >&2; exit 1; }
            BROWSER="brave"
            ;;
        -chrome|--chrome)
            [ -z "$BROWSER" ] || { echo "Choose exactly one browser" >&2; usage >&2; exit 1; }
            BROWSER="chrome"
            ;;
        -ungoogled|--ungoogled|--ungoogled-chromium)
            [ -z "$BROWSER" ] || { echo "Choose exactly one browser" >&2; usage >&2; exit 1; }
            BROWSER="ungoogled"
            ;;
        -id|--id)
            [ "$#" -ge 2 ] || { echo "Missing value for $1" >&2; usage >&2; exit 1; }
            EXTENSION_ID="$2"
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

if [ -z "$EXTENSION_ID" ]; then
    echo "Provide an extension ID with -id" >&2
    usage >&2
    exit 1
fi

for command in jq grep sudo; do
    if ! command -v "$command" >/dev/null 2>&1; then
        echo "Missing required command: $command" >&2
        exit 1
    fi
done

if ! printf '%s\n' "$EXTENSION_ID" | grep -Eq '^[a-p]{32}$'; then
    echo "Invalid extension ID: $EXTENSION_ID" >&2
    exit 1
fi

case "$BROWSER" in
    brave)
        BROWSER_NAME="Brave"
        POLICY_URL="brave://policy"
        POLICIES=("/etc/brave/policies/managed/managed_policies.json")
        POLICY_LABELS=("brave")
        REMOVE_INCOGNITO=true
        ;;
    chrome)
        BROWSER_NAME="Google Chrome"
        POLICY_URL="chrome://policy"
        POLICIES=("/etc/opt/chrome/policies/managed/managed_policies.json")
        POLICY_LABELS=("chrome")
        REMOVE_INCOGNITO=false
        ;;
    ungoogled)
        BROWSER_NAME="ungoogled-chromium"
        POLICY_URL="chrome://policy"
        POLICIES=(
            "/etc/chromium/policies/managed/managed_policies.json"
            "/etc/chromium-browser/policies/managed/managed_policies.json"
        )
        POLICY_LABELS=("ungoogled-native" "ungoogled-flatpak")
        REMOVE_INCOGNITO=false
        if [ "$EUID" -eq 0 ]; then
            echo "Run this script as the browser user, not with sudo; profile files must belong to that user" >&2
            exit 1
        fi
        if ! command -v python3 >/dev/null 2>&1; then
            echo "Missing required command: python3" >&2
            exit 1
        fi
        ;;
esac

POLICY_BACKUP_DIR="/var/backups/$BROWSER-policies"
SERVE_DIR="/var/lib/$BROWSER-local-extension"
SERVICE_FILE="/etc/systemd/system/$BROWSER-local-extension.service"
SERVICE_NAME="$BROWSER-local-extension.service"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT
BACKUPS=()

remove_policy_settings() {
    local policy="$1"
    local label="$2"
    local new_policy="$WORK_DIR/$label-managed_policies.json"
    local backup

    if [ ! -e "$policy" ]; then
        return
    fi
    if [ ! -f "$policy" ]; then
        echo "Policy path is not a regular file: $policy" >&2
        exit 1
    fi

    sudo jq \
        --arg id "$EXTENSION_ID" \
        --arg update_url "$UPDATE_URL" \
        --argjson remove_incognito "$REMOVE_INCOGNITO" '
        if type != "object" then
            error("Policy root must be an object")
        elif ((.ExtensionInstallForcelist // []) | type) != "array" then
            error("ExtensionInstallForcelist is not an array")
        elif any((.ExtensionInstallForcelist // [])[]; type != "string") then
            error("ExtensionInstallForcelist contains a non-string value")
        elif ((.ExtensionSettings // {}) | type) != "object" then
            error("ExtensionSettings is not an object")
        elif .ExtensionSettings[$id]? != null and (.ExtensionSettings[$id] | type) != "object" then
            error("ExtensionSettings entry for this extension is not an object")
        elif ((.MandatoryExtensionsForIncognitoNavigation // []) | type) != "array" then
            error("MandatoryExtensionsForIncognitoNavigation is not an array")
        elif any((.MandatoryExtensionsForIncognitoNavigation // [])[]; type != "string") then
            error("MandatoryExtensionsForIncognitoNavigation contains a non-string value")
        else
            .ExtensionInstallForcelist =
                ((.ExtensionInstallForcelist // [])
                 | map(select(startswith($id + ";") | not)))
            | if .ExtensionInstallForcelist == [] then
                del(.ExtensionInstallForcelist)
              else . end
            | if (.ExtensionSettings[$id]? | type) == "object"
                 and (.ExtensionSettings[$id].update_url? // $update_url) == $update_url then
                .ExtensionSettings[$id] |= del(
                    .installation_mode,
                    .update_url,
                    .override_update_url
                )
              else . end
            | if .ExtensionSettings[$id]? == {} then
                del(.ExtensionSettings[$id])
              else . end
            | if .ExtensionSettings == {} then
                del(.ExtensionSettings)
              else . end
            | .MandatoryExtensionsForIncognitoNavigation =
                ((.MandatoryExtensionsForIncognitoNavigation // [])
                 | map(select(. != $id)))
            | if .MandatoryExtensionsForIncognitoNavigation == [] then
                del(.MandatoryExtensionsForIncognitoNavigation)
              else . end
            | if $remove_incognito and .IncognitoModeAvailability? == 1 then
                del(.IncognitoModeAvailability)
              else . end
        end
    ' "$policy" >"$new_policy"

    jq -e . "$new_policy" >/dev/null
    backup="$POLICY_BACKUP_DIR/$label-managed_policies.json.$(date +%Y%m%d%H%M%S).before-removal"
    sudo install -d -o root -g root -m 0700 "$POLICY_BACKUP_DIR"
    sudo cp -a "$policy" "$backup"
    sudo install -o root -g root -m 0644 "$new_policy" "$policy"
    sudo jq -e . "$policy" >/dev/null
    BACKUPS+=("$backup")
}

for index in "${!POLICIES[@]}"; do
    remove_policy_settings "${POLICIES[$index]}" "${POLICY_LABELS[$index]}"
done

if command -v systemctl >/dev/null 2>&1; then
    sudo systemctl disable --now "$SERVICE_NAME" 2>/dev/null || true
fi
sudo rm -f "$SERVICE_FILE"
sudo rm -rf "$SERVE_DIR"
if command -v systemctl >/dev/null 2>&1; then
    sudo systemctl daemon-reload
fi

if [ "$BROWSER" = "ungoogled" ]; then
    sudo rm -rf "/var/lib/ungoogled-flatpak-extension"
    sudo rm -rf "/var/lib/flatpak/extension/$FLATPAK_APP_ID.Policy.sinblocker"
    sudo rm -rf "/var/lib/flatpak/extension/$FLATPAK_APP_ID.Extension.sinblocker"
    sudo rm -rf "${XDG_DATA_HOME:-$HOME/.local/share}/flatpak/extension/$FLATPAK_APP_ID.Policy.sinblocker"
    sudo rm -rf "${XDG_DATA_HOME:-$HOME/.local/share}/flatpak/extension/$FLATPAK_APP_ID.Extension.sinblocker"
    if command -v flatpak >/dev/null 2>&1; then
        flatpak kill "$FLATPAK_APP_ID" >/dev/null 2>&1 || true
    fi
    python3 - "$HOME/.var/app/$FLATPAK_APP_ID/config/chromium" "$EXTENSION_ID" <<'PY'
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import time

user_data = Path(sys.argv[1])
extension_id = sys.argv[2]
for profile in [user_data / "Default", *sorted(user_data.glob("Profile *"))]:
    for name in ("Preferences", "Secure Preferences"):
        prefs_path = profile / name
        if not prefs_path.exists():
            continue
        prefs = json.loads(prefs_path.read_text())
        settings = prefs.get("extensions", {}).get("settings", {})
        if extension_id not in settings:
            continue
        backup = profile / "sinblocker-backups" / str(time.time_ns())
        backup.mkdir(parents=True, mode=0o700)
        shutil.copy2(prefs_path, backup / name)
        (backup / name).chmod(0o600)
        del settings[extension_id]
        with tempfile.NamedTemporaryFile(mode="w", dir=profile, delete=False) as output:
            temporary = Path(output.name)
            try:
                json.dump(prefs, output)
                output.flush()
                os.fsync(output.fileno())
                os.replace(temporary, prefs_path)
            finally:
                temporary.unlink(missing_ok=True)
        print(f"Profile backup: {backup}")
    extension_path = profile / "Extensions" / extension_id
    if extension_path.exists():
        shutil.rmtree(extension_path)
PY
fi

echo "Removed extension $EXTENSION_ID from $BROWSER_NAME managed installation"
for backup in "${BACKUPS[@]}"; do
    echo "Policy backup: $backup"
done
echo "Fully exit $BROWSER_NAME, reopen it, and reload $POLICY_URL"
