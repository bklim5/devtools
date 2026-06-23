#!/usr/bin/env bash
# Canonical App Store build command — invoked by `pnpm tauri:build:appstore`.
# Promoted from build-appstore-spike.sh (Phase 27 D-01).
#
# Builds a DEVELOPMENT-SIGNED, App-Sandboxed `.app` that LAUNCHES LOCALLY and can
# present the live StoreKit sheet against a Sandbox tester.
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
#   1. builds the universal appstore bundle, signed with the dev identity (the COMMITTED
#      overlay src-tauri/tauri.appstore.conf.json + --no-default-features --features appstore;
#      base tauri.conf.json stays Developer-ID/10.15 — Pitfall 11)
#   2. embeds your Mac Development provisioning profile at Contents/embedded.provisionprofile
#   3. deep-re-signs so the seal covers the embedded profile + the appstore entitlements
#   4. FATAL-verifies the signed bundle via scripts/verify-appstore-bundle.sh --require-bundle
#      (plugins absent + entitlements present + 13.0 floor) — any finding STOPS the command
#
# The overlay grants ONLY entitlements + signing — NEVER `iap:default`/`plugin:iap|*`
# (MODE A reaches the plugin Rust-side; a webview iap capability would bypass the
# iap_* wrapper boundary — see PHASE-26-BRIDGE-VIABILITY.md T-26-18b).
#
# Usage:  bash scripts/build-appstore-bundle.sh   (or `pnpm tauri:build:appstore`)
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
# The dev signingIdentity is machine-specific, so it is NOT in the committed overlay
# (Plan 27-02 deliberately left it out). Inject it here via the env-export path so Tauri
# signs the WHOLE bundle with the dev identity.
export APPLE_SIGNING_IDENTITY="$SIGN_ID"

echo "[appstore] building universal appstore bundle, signed '$SIGN_ID' (no notarization)…"
# --no-default-features --features appstore drops the `direct` umbrella feature → the
# updater + autostart + process plugins are COMPILED OUT (Plan 27-01), and Tauri's
# capability codegen runs with those plugins' permissions absent. A bundle being produced
# here is the end-to-end proof of Finding 1 (no `Permission updater:default not found`).
# --config src-tauri/tauri.appstore.conf.json is the COMMITTED overlay (Plan 27-02):
# entitlements + 13.0 + hardenedRuntime:false + no-dmg + updater:null.
# (The final tauri-build exit can be non-zero ONLY for the absent updater key — now moot
#  since updater is compiled out — so we `|| true` it and judge success by the bundle +
#  its signature below; harness rule. A missing bundle is still caught by the guard below.)
MACOSX_DEPLOYMENT_TARGET=13.0 pnpm tauri build \
  --no-default-features --features appstore \
  --target "$TARGET" --bundles app \
  --config src-tauri/tauri.appstore.conf.json || true

if [[ ! -d "$APP_OUT" ]]; then
  echo "ERROR: bundle not produced at $APP_OUT — check the build log above."
  echo "       (A capability-codegen error like 'Permission updater:default not found'"
  echo "        means Plan 27-01's default.json strip did not land — Finding 1.)"
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

# --- 5. FATAL compliance self-verify on the freshly-signed bundle (Finding 2) --
# The committed bundle-compliance gate, run against the bundle we just signed. When a
# bundle IS present (it always is here — the bundle-existence guard already ran), any
# finding (forbidden plugin present / missing entitlement / wrong 13.0 floor) is FATAL:
# the canonical command CANNOT exit 0 after a compliance failure, so a non-compliant
# bundle can never be handed off. --require-bundle also turns a vanished $APP_OUT into a FAIL.
echo ""
echo "[verify] running scripts/verify-appstore-bundle.sh --require-bundle on the signed bundle…"
if ! bash scripts/verify-appstore-bundle.sh "$APP_OUT" --require-bundle; then
  echo "ERROR: verify-appstore-bundle FAILED on the signed bundle — the build is NOT compliant" >&2
  echo "       (forbidden plugin present / missing entitlement / wrong 13.0 floor — see above)." >&2
  exit 1
fi
echo "[verify] bundle compliant ✓"
