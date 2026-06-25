#!/usr/bin/env bash
# ui-capture.sh — screenshot a running app's NATIVE window (titlebar + chrome
# included) to a PNG, for build+verify harness step 5.
#
# WHY: under titleBarStyle:Overlay the macOS titlebar theme/legibility, the
# traffic-light inset, and window decorations live OUTSIDE the webview DOM, so
# WebDriver / WKWebView-DOM / Chromium screenshots cannot observe them. This
# captures the real on-screen window so the agent can Read it and verify native
# chrome in BOTH build channels (direct + appstore).
#
# REQUIRES (granted): Accessibility + Screen Recording permission for the
# controlling terminal (System Settings ▸ Privacy & Security). Without
# Accessibility, osascript window-geometry returns -1719 and this exits 2.
#
# Usage: scripts/ui-capture.sh <pgrep-pattern> <out.png>
#   e.g. scripts/ui-capture.sh "TinkerDev.app/Contents/MacOS/devtools-app" /tmp/appstore-window.png
set -euo pipefail

PATTERN="${1:?usage: ui-capture.sh <pgrep-pattern> <out.png>}"
OUT="${2:?usage: ui-capture.sh <pgrep-pattern> <out.png>}"

PID="$(pgrep -f "$PATTERN" | head -1 || true)"
[ -n "$PID" ] || { echo "ui-capture: no running process matching: $PATTERN" >&2; exit 1; }

# Bring the window to the front so the capture isn't occluded by other windows.
osascript >/dev/null 2>&1 <<OSA || { echo "ui-capture: Accessibility denied — grant it to the terminal (System Settings ▸ Privacy & Security ▸ Accessibility)" >&2; exit 2; }
tell application "System Events" to tell (first process whose unix id is $PID)
  set frontmost to true
end tell
OSA

# Small settle so the activated window is fully composited before capture.
/bin/sleep 0.4

# Front-window geometry via Accessibility → "x, y, w, h".
BOUNDS="$(osascript -e "tell application \"System Events\" to tell (first process whose unix id is $PID) to get {position, size} of front window")"
# NOTE: trailing \n is required — without it `read` hits EOF, returns non-zero,
# and `set -e` would abort before the capture.
read -r X Y W H < <(printf '%s\n' "$BOUNDS" | tr -d ' ' | tr ',' ' ')
[ -n "${H:-}" ] || { echo "ui-capture: could not parse window bounds: '$BOUNDS'" >&2; exit 3; }

screencapture -x -o -R"${X},${Y},${W},${H}" "$OUT"
echo "$OUT"
