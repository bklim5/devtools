#!/usr/bin/env bash
# Phase-26 spike: build a DEVELOPMENT-SIGNED, App-Sandboxed `.app` that LAUNCHES LOCALLY
# and can present the live StoreKit sheet against a Sandbox tester (Plan-26-06, STEP 0).
#
# DEV signing, NOT distribution (learned the hard way, 2026-06-22): a Mac App Store
# *distribution* profile can ONLY authorize an app installed FROM the App Store. Running
# a distribution-signed sandboxed build locally fails at launch with AMFI -413 "No matching
# profile found" / "restricted entitlements … validation failed" (the app-sandbox +
# application-identifier are provisioning-profile-restricted). For LOCAL sandbox testing you
# need an **Apple Development** cert + a **Mac Development** provisioning profile that includes
# THIS Mac. (The Apple Distribution cert + Mac App Store profile are for the Phase-30 .pkg
# submission, not local launch.)
#
# Why a script (not just `tauri build --config`): Tauri 2.x has NO `provisioningProfile`
# config key (MacConfig = signingIdentity/entitlements/hardenedRuntime/… only), and the
# appstore entitlements are profile-restricted, so the app won't launch without an embedded
# profile. This script:
#   1. builds the universal appstore bundle, signed with the dev identity (per-invocation
#      --config; base tauri.conf.json stays Developer-ID/10.15 — Pitfall 11)
#   2. embeds your Mac Development provisioning profile at Contents/embedded.provisionprofile
#   3. deep-re-signs so the seal covers the embedded profile + the appstore entitlements
#   4. verifies signature/entitlements/profile/arch + whole-bundle consistency
#
# The overlay grants ONLY entitlements + signing — NEVER `iap:default`/`plugin:iap|*`
# (MODE A reaches the plugin Rust-side; a webview iap capability would bypass the
# iap_* wrapper boundary — see PHASE-26-BRIDGE-VIABILITY.md T-26-18b).
#
# Usage:  bash scripts/build-appstore-spike.sh
# Env:    PROFILE   (default src-tauri/dev.provisionprofile) — your downloaded
#                    *Mac Development* provisioning profile for com.tinkerdev.app
#         SIGN_ID   (default: auto-detected "Apple Development: …" identity from keychain)

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PROFILE="${PROFILE:-src-tauri/dev.provisionprofile}"
# Default to the Apple Development identity in the keychain (override with SIGN_ID=…).
SIGN_ID="${SIGN_ID:-$(security find-identity -p codesigning -v 2>/dev/null \
  | grep -oE '"Apple Development: [^"]+"' | head -1 | tr -d '"')}"
ENTITLEMENTS="src-tauri/entitlements.appstore.plist"
TARGET="universal-apple-darwin"
APP_OUT="src-tauri/target/${TARGET}/release/bundle/macos/TinkerDev.app"

# --- Preflight -----------------------------------------------------------------
if [[ -z "$SIGN_ID" ]]; then
  echo "ERROR: no 'Apple Development' signing identity in the keychain."
  echo "Create one (Xcode ▸ Settings ▸ Accounts ▸ Manage Certificates ▸ + ▸ Apple"
  echo "Development), then re-run. (Set SIGN_ID=… to use a specific identity.)"
  echo "Present identities:"; security find-identity -p codesigning -v | sed 's/^/  /'
  exit 1
fi
if [[ ! -f "$PROFILE" ]]; then
  echo "ERROR: provisioning profile not found at '$PROFILE'."
  echo "Create a *Mac Development* provisioning profile for com.tinkerdev.app (portal →"
  echo "Profiles → + → macOS App Development → App ID com.tinkerdev.app → your Apple"
  echo "Development cert → THIS Mac), download it, and save it there (or set PROFILE=…)."
  echo "Register this Mac first: system_profiler SPHardwareDataType | grep 'Provisioning UDID'"
  exit 1
fi
if ! security find-identity -p codesigning -v | grep -qF "$SIGN_ID"; then
  echo "ERROR: signing identity not in keychain: '$SIGN_ID'"
  echo "Available:"; security find-identity -p codesigning -v | grep -iE "Apple Distribution|Apple Development" || true
  exit 1
fi

# --- 1. Build the signed universal appstore bundle -----------------------------
# CRITICAL: scrub the direct-channel (Developer-ID + notarization) environment so it
# can't hijack this MAS build. If APPLE_ID/APPLE_PASSWORD/APPLE_API_KEY are set, Tauri
# NOTARIZES — but a MAS build has NO hardened runtime, so notarization fails AND the
# innards get Developer-ID-signed (an identity mismatch the top-level re-sign can't fix).
# We unset those and pin APPLE_SIGNING_IDENTITY so the WHOLE bundle signs Apple
# Distribution in one pass, with no notarization.
unset APPLE_ID APPLE_PASSWORD APPLE_TEAM_ID \
      APPLE_API_KEY APPLE_API_ISSUER APPLE_API_KEY_PATH \
      APPLE_CERTIFICATE APPLE_CERTIFICATE_PASSWORD APPLE_KEYCHAIN 2>/dev/null || true
export APPLE_SIGNING_IDENTITY="$SIGN_ID"

echo "[appstore] building universal appstore bundle, signed '$SIGN_ID' (no notarization)…"
# (The final tauri-build exit can be non-zero ONLY for the absent updater key — we
#  judge success by the bundle + its signature below, not the exit code; harness rule.)
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
# --deep: re-sign EVERY nested binary with the same Apple Distribution identity, so
# the whole bundle is internally consistent even if the build env briefly signed an
# innard with a different cert. NO --options runtime: MAS uses App Sandbox, not HR.
echo "[appstore] re-signing bundle (deep) with the embedded profile + appstore entitlements…"
codesign --force --deep --timestamp --sign "$SIGN_ID" \
  --entitlements "$ENTITLEMENTS" "$APP_OUT" || {
    echo "ERROR: re-sign failed."; exit 1; }

# --- 4. Verify -----------------------------------------------------------------
echo ""
echo "================ VERIFY ================"
APP_BIN="$APP_OUT/Contents/MacOS/devtools-app"
echo "[archs]"; lipo -archs "$APP_BIN" 2>/dev/null || echo "  (could not read archs)"
echo "[signature]"; codesign -dvvv "$APP_OUT" 2>&1 | grep -iE "Authority=Apple (Development|Distribution)|flags=" | head -3
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
echo "[deep verify]"
if codesign --verify --deep --strict --verbose=2 "$APP_OUT" >/tmp/_cs_verify.txt 2>&1; then
  echo "  whole bundle signature valid + consistent ✓"
else
  echo "  signature NOT consistent (exit $?) — details:"
  sed 's/^/    /' /tmp/_cs_verify.txt | head -8
fi
echo "======================================="
echo ""
echo "App: $APP_OUT"
echo "Next: launch it, sign into the SANDBOX tester (not your real Apple ID), and run the"
echo "Plan-26-06 round-trip (docs/appstore/PHASE-26-SANDBOX-WALKTHROUGH.md)."
