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
# Per-channel target dir. A SET CARGO_TARGET_DIR must be ABSOLUTE — Tauri runs cargo with
# CWD=src-tauri/ so a relative value resolves to a DIFFERENT tree for cargo vs this script
# (CWD=ROOT_DIR), splitting the build output from where APP_OUT/the verifier look. Fail closed.
if [[ -n "${CARGO_TARGET_DIR:-}" && "$CARGO_TARGET_DIR" != /* ]]; then
  echo "ERROR: CARGO_TARGET_DIR must be an ABSOLUTE path, got '$CARGO_TARGET_DIR'." >&2
  exit 1
fi
# Default to THIS channel's canonical tree and EXPORT it so cargo writes where APP_OUT looks.
# Result: EVERY entry point — this script standalone, `pnpm tauri:build:appstore`, or
# scripts/build.sh appstore — shares ONE src-tauri/target/appstore tree, never the bare
# universal-apple-darwin path (where the dev- vs distribution-signed builds used to clobber).
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-$ROOT_DIR/src-tauri/target/appstore}"
BUNDLE_ROOT="$CARGO_TARGET_DIR"
APP_OUT="${BUNDLE_ROOT}/${TARGET}/release/bundle/macos/TinkerDev.app"

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

# Pre-build freshness marker: a stale `.app` from an EARLIER run can sit at $APP_OUT. If
# the build below errors out (e.g. a CLI flag-parse error) and we `|| true` past it, the
# bundle-existence guard alone would happily re-sign that stale bundle — a false GREEN.
# We stamp a marker NOW and assert the produced binary is NEWER than it (the build must
# have actually re-emitted the binary), so a skipped/failed build can never masquerade
# as a fresh one.
BUILD_MARKER="$(mktemp -t appstore-build-marker)"
trap 'rm -f "$BUILD_MARKER"' EXIT

echo "[appstore] building universal appstore bundle, signed '$SIGN_ID' (no notarization)…"
# --no-default-features --features appstore drops the `direct` umbrella feature → the
# updater + autostart + process plugins are COMPILED OUT (Plan 27-01), and Tauri's
# capability codegen runs with those plugins' permissions absent. A bundle being produced
# here is the end-to-end proof of Finding 1 (no `Permission updater:default not found`).
# --config src-tauri/tauri.appstore.conf.json is the COMMITTED overlay (Plan 27-02):
# entitlements + 13.0 + hardenedRuntime:false + no-dmg + updater:null.
#
# FLAG-PASSING (critical): the Tauri CLI owns `-f/--features`, `--target`, `--bundles`,
# `--config`, but it has NO `--no-default-features` flag — that one is a CARGO flag and
# MUST be passed through the `--` runner-args separator (the CLI forwards everything after
# `--` to cargo). Without the `--`, the CLI errors `unexpected argument '--no-default-features'`
# and the build never runs (which would silently re-sign a stale bundle). So:
#   tauri build -f appstore --target … --bundles app --config … -- --no-default-features
# (The final tauri-build exit can be non-zero ONLY for the absent updater key — now moot
#  since updater is compiled out — so we `|| true` it and judge success by the bundle +
#  its signature below; harness rule. A missing/stale bundle is caught by the guard below.)
MACOSX_DEPLOYMENT_TARGET=13.0 pnpm tauri build \
  --features appstore \
  --target "$TARGET" --bundles app \
  --config src-tauri/tauri.appstore.conf.json \
  -- --no-default-features || true

if [[ ! -d "$APP_OUT" ]]; then
  echo "ERROR: bundle not produced at $APP_OUT — check the build log above."
  echo "       (A capability-codegen error like 'Permission updater:default not found'"
  echo "        means Plan 27-01's default.json strip did not land — Finding 1.)"
  exit 1
fi

# The inner binary name follows the Cargo crate name, NOT productName — and a rename
# silently breaks any hardcoded path (the TinkerDev-rename bug documented in
# build-and-publish.mjs). DERIVE it from the bundle's own CFBundleExecutable so this
# guard tracks the real binary instead of a stale literal.
APP_BIN="$APP_OUT/Contents/MacOS/$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$APP_OUT/Contents/Info.plist" 2>/dev/null)"
if [[ ! -f "$APP_BIN" ]]; then
  echo "ERROR: could not resolve the bundle executable via CFBundleExecutable at $APP_OUT/Contents/Info.plist" >&2
  exit 1
fi

# Freshness guard: the produced binary MUST be newer than the pre-build marker. If it is
# not, the build did not actually run (CLI parse error / no-op) and $APP_OUT is a STALE
# leftover — fail rather than embed-a-profile + re-sign + "verify" a bundle the real
# appstore build never produced (the false-GREEN that would defeat Finding 1).
if [[ ! "$APP_BIN" -nt "$BUILD_MARKER" ]]; then
  echo "ERROR: the bundle at $APP_OUT is STALE (older than this run) — the real appstore" >&2
  echo "       build did not produce a fresh binary. Check the build log above for a CLI" >&2
  echo "       flag-parse error or a capability-codegen failure (Finding 1)." >&2
  exit 1
fi

# --- 2. Embed the provisioning profile -----------------------------------------
# Remove any stale profile from an earlier run first, then copy. A FATAL cp: if the
# copy silently failed (and a stale profile lingered) the deep re-sign would seal a
# wrong/missing profile and the app would fail to launch under the sandbox — exactly
# the failure this embed exists to prevent.
echo "[appstore] embedding provisioning profile → Contents/embedded.provisionprofile"
rm -f "$APP_OUT/Contents/embedded.provisionprofile"
if ! cp "$PROFILE" "$APP_OUT/Contents/embedded.provisionprofile"; then
  echo "ERROR: failed to copy provisioning profile '$PROFILE' into the bundle." >&2
  exit 1
fi

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
echo "[archs]"; lipo -archs "$APP_BIN" 2>/dev/null || echo "  (could not read archs)"
echo "[signature]"; codesign -dvvv "$APP_OUT" 2>&1 | grep -iE "Authority=Apple (Development|Distribution)|flags=" | head -3
echo "[entitlements]"
codesign -d --entitlements - --xml "$APP_OUT" 2>/dev/null \
  | grep -oE "application-identifier|app-sandbox|network.client|team-identifier" | sort -u \
  | sed 's/^/  /'
echo "[profile]"
if [[ ! -f "$APP_OUT/Contents/embedded.provisionprofile" ]]; then
  echo "  NO embedded profile — the sheet will not present ✗" >&2
  echo "ERROR: embedded.provisionprofile missing after embed+re-sign — aborting." >&2
  exit 1
fi
echo "  embedded.provisionprofile present ✓"
echo "[deep verify]"
# FATAL: an inconsistent nested signature (e.g. an innard signed with a different cert)
# would launch-fail under Gatekeeper / the sandbox. verify-appstore-bundle.sh checks
# entitlements + min-OS + plugin-absence but NOT signature integrity, so this is the
# only gate for it — it must stop the command, not just print.
CS_VERIFY_LOG="$(mktemp -t appstore-cs-verify)"
trap 'rm -f "$BUILD_MARKER" "$CS_VERIFY_LOG"' EXIT
if codesign --verify --deep --strict --verbose=2 "$APP_OUT" >"$CS_VERIFY_LOG" 2>&1; then
  echo "  whole bundle signature valid + consistent ✓"
else
  echo "  signature NOT consistent — details:" >&2
  sed 's/^/    /' "$CS_VERIFY_LOG" | head -8 >&2
  echo "ERROR: deep codesign verification FAILED — the bundle is not internally consistent." >&2
  exit 1
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
