#!/usr/bin/env bash
# Phase-26 spike: build a DISTRIBUTION-SIGNED, App-Sandboxed `.app` that can present
# the live StoreKit sheet against a Sandbox tester (the Plan-26-06 human gate, STEP 0).
#
# Why a script (not just `tauri build --config`): Tauri 2.x has NO `provisioningProfile`
# config key (MacConfig = signingIdentity/entitlements/hardenedRuntime/… only). A
# Distribution-signed sandboxed app whose entitlements include
# `com.apple.application-identifier` is provisioning-profile-restricted, so it WILL NOT
# launch / StoreKit will not bind without an embedded Mac App Store profile. This script:
#   1. builds the universal appstore bundle, signed with the Apple Distribution identity
#      (per-invocation --config; base tauri.conf.json stays Developer-ID/10.15 — Pitfall 11)
#   2. embeds your Mac App Store provisioning profile at Contents/embedded.provisionprofile
#   3. re-signs the bundle so the seal covers the embedded profile + the appstore entitlements
#   4. verifies: Apple Distribution (not ad-hoc), app-sandbox + network.client +
#      application-identifier present, profile embedded, universal arm64+x86_64
#
# The overlay grants ONLY entitlements + signing — NEVER `iap:default`/`plugin:iap|*`
# (MODE A reaches the plugin Rust-side; a webview iap capability would bypass the
# iap_* wrapper boundary — see PHASE-26-BRIDGE-VIABILITY.md T-26-18b).
#
# Usage:  bash scripts/build-appstore-spike.sh
# Env:    PROFILE   (default src-tauri/embedded.provisionprofile) — your downloaded
#                    Mac App Store provisioning profile for com.tinkerdev.app
#         SIGN_ID   (default "Apple Distribution: Boon Khai Lim (FK4HQK83WX)")

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PROFILE="${PROFILE:-src-tauri/embedded.provisionprofile}"
SIGN_ID="${SIGN_ID:-Apple Distribution: Boon Khai Lim (FK4HQK83WX)}"
ENTITLEMENTS="src-tauri/entitlements.appstore.plist"
TARGET="universal-apple-darwin"
APP_OUT="src-tauri/target/${TARGET}/release/bundle/macos/TinkerDev.app"

# --- Preflight -----------------------------------------------------------------
if [[ ! -f "$PROFILE" ]]; then
  echo "ERROR: provisioning profile not found at '$PROFILE'."
  echo "Create a Mac App Store provisioning profile for com.tinkerdev.app in the Apple"
  echo "Developer portal (Profiles → + → Mac App Store → App ID com.tinkerdev.app →"
  echo "your Apple Distribution cert), download it, and save it there (or set PROFILE=…)."
  exit 1
fi
if ! security find-identity -p codesigning -v | grep -qF "$SIGN_ID"; then
  echo "ERROR: signing identity not in keychain: '$SIGN_ID'"
  echo "Available:"; security find-identity -p codesigning -v | grep -iE "Apple Distribution|Apple Development" || true
  exit 1
fi

# --- 1. Build the signed universal appstore bundle -----------------------------
# (The final tauri-build exit can be non-zero ONLY for the absent updater key — we
#  judge success by the bundle, not the exit code; harness rule.)
echo "[appstore] building universal appstore bundle, signed '$SIGN_ID'…"
MACOSX_DEPLOYMENT_TARGET=13.0 pnpm tauri build --features appstore \
  --target "$TARGET" --bundles app \
  --config '{"bundle":{"macOS":{
      "entitlements":"entitlements.appstore.plist",
      "minimumSystemVersion":"13.0",
      "hardenedRuntime":false,
      "signingIdentity":"'"$SIGN_ID"'"}}}' || true

if [[ ! -d "$APP_OUT" ]]; then
  echo "ERROR: bundle not produced at $APP_OUT — check the build log above."
  exit 1
fi

# --- 2. Embed the provisioning profile -----------------------------------------
echo "[appstore] embedding provisioning profile → Contents/embedded.provisionprofile"
cp "$PROFILE" "$APP_OUT/Contents/embedded.provisionprofile"

# --- 3. Re-sign so the seal covers the embedded profile + appstore entitlements -
# Top-level --force re-seal (nested binaries were already signed by the build with
# the same identity). NO --options runtime: MAS uses App Sandbox, not hardened runtime.
echo "[appstore] re-signing bundle with the embedded profile + appstore entitlements…"
codesign --force --timestamp --sign "$SIGN_ID" \
  --entitlements "$ENTITLEMENTS" "$APP_OUT" || {
    echo "ERROR: re-sign failed."; exit 1; }

# --- 4. Verify -----------------------------------------------------------------
echo ""
echo "================ VERIFY ================"
APP_BIN="$APP_OUT/Contents/MacOS/devtools-app"
echo "[archs]"; lipo -archs "$APP_BIN" 2>/dev/null || echo "  (could not read archs)"
echo "[signature]"; codesign -dvvv "$APP_OUT" 2>&1 | grep -iE "Authority=Apple Distribution|flags=" | head -3
echo "[entitlements]"
codesign -d --entitlements - --xml "$APP_OUT" 2>/dev/null \
  | grep -oE "application-identifier|app-sandbox|network.client|team-identifier" | sort -u \
  | sed 's/^/  /'
echo "[profile]"
if [[ -f "$APP_OUT/Contents/embedded.provisionprofile" ]]; then
  echo "  embedded.provisionprofile present ✓"
else
  echo "  NO embedded profile — the sheet will not present ✗"
fi
echo "======================================="
echo ""
echo "App: $APP_OUT"
echo "Next: launch it, sign into the SANDBOX tester (not your real Apple ID), and run the"
echo "Plan-26-06 round-trip (docs/appstore/PHASE-26-SANDBOX-WALKTHROUGH.md)."
