#!/usr/bin/env bash
# Phase 27 (MAS-BUILD-06, D-09): assert the App Store bundle is compliant at the
# Phase 27 gate.
#   (a) forbidden plugins ABSENT — updater + autostart compiled out of the
#       appstore dependency graph (the EXACT flags the real build uses:
#       --no-default-features --features appstore, Plan 27-01);
#   (b) required entitlements PRESENT — app-sandbox + network.client on the
#       SIGNED .app (Criterion 2);
#   (c) the 13.0 floor PROVEN AT THE ARTIFACT — LSMinimumSystemVersion == 13.0 on
#       the built Info.plist (Finding 3; not just the overlay grep, which a bad
#       merge could pass while shipping the wrong floor).
# GREEN at the Phase 27 boundary. When a bundle IS present, any failure is FATAL
# (non-zero exit) — Finding 2. The no-bundle local case SKIPs the bundle-level
# checks LOUDLY (never a false PASS). The Keygen forbidden-string checks (the CE
# host, the in-app price, the buy link, the key-paste field — MAS-BUILD-04) are
# DEFERRED to Phase 28, which EXTENDS this same script once that surface is
# compiled out (D-10) — no red/expected-fail check is introduced between phases.
# (Those literals are intentionally NOT named here so a Phase-27 tripwire grep
# for them returns 0 — the deferral is described, not pre-seeded.)
#
# Usage:  bash scripts/verify-appstore-bundle.sh [path-to-signed.app] [--require-bundle]
#   default app path: src-tauri/target/universal-apple-darwin/release/bundle/macos/TinkerDev.app
#   --require-bundle: FAIL (don't SKIP) if no signed .app is present — used by the
#                     canonical build command's tail, which always has a fresh bundle.
# Pattern: scripts/check-dev-strip.sh (artifact guards + grep exit-code discipline).
set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1

assert_plugins_absent() {
  # The appstore dependency graph MUST match the REAL build flags exactly, or this
  # would verify a different tree than the one shipped (false-GREEN). These are the
  # Plan 27-01 flags.
  local tree
  tree="$(cd src-tauri && cargo tree --no-default-features --features appstore 2>/dev/null)"
  if [[ -z "$tree" ]]; then
    echo "FAIL: 'cargo tree --no-default-features --features appstore' produced no output — the tree was not actually computed" >&2
    return 1
  fi
  local found
  found="$(printf '%s\n' "$tree" | grep -E 'tauri-plugin-(updater|autostart)' || true)"
  if [[ -n "$found" ]]; then
    echo "FAIL: forbidden plugin(s) present in the appstore dependency graph:" >&2
    printf '%s\n' "$found" | sed 's/^/    /' >&2
    return 1
  fi
  echo "OK: updater + autostart ABSENT from the appstore dependency graph"
}

assert_entitlements_present() {
  local app="${1:?usage: assert_entitlements_present <path-to-signed.app>}"
  if [[ ! -d "$app" ]]; then
    echo "FAIL: signed .app not found at '$app' — run 'pnpm tauri:build:appstore' first" >&2
    return 1
  fi
  local ents
  ents="$(codesign -d --entitlements - --xml "$app" 2>/dev/null)"
  if [[ -z "$ents" ]]; then
    echo "FAIL: could not read entitlements from '$app' (is it signed?)" >&2
    return 1
  fi
  local missing=0
  for key in com.apple.security.app-sandbox com.apple.security.network.client; do
    if ! printf '%s' "$ents" | grep -qF "$key"; then
      echo "FAIL: required entitlement '$key' ABSENT from the signed bundle" >&2
      missing=1
    fi
  done
  [[ "$missing" -eq 0 ]] || return 1
  echo "OK: app-sandbox + network.client PRESENT on the signed bundle"
}

assert_min_system_version() {
  local app="${1:?usage: assert_min_system_version <path-to-signed.app>}"
  local plist="$app/Contents/Info.plist"
  if [[ ! -f "$plist" ]]; then
    echo "FAIL: Info.plist not found at '$plist'" >&2
    return 1
  fi
  local ver
  ver="$(/usr/libexec/PlistBuddy -c 'Print :LSMinimumSystemVersion' "$plist" 2>/dev/null)"
  if [[ "$ver" != "13.0" ]]; then
    echo "FAIL: appstore artifact LSMinimumSystemVersion is '$ver', expected '13.0' (the 13.0 floor did not reach the built Info.plist — bad merge / leaked MACOSX_DEPLOYMENT_TARGET?)" >&2
    return 1
  fi
  echo "OK: appstore artifact LSMinimumSystemVersion == 13.0 (Finding 3 — proven on the bundle, not just the overlay)"
}

APP="src-tauri/target/universal-apple-darwin/release/bundle/macos/TinkerDev.app"
REQUIRE_BUNDLE=0
for arg in "$@"; do
  case "$arg" in
    --require-bundle) REQUIRE_BUNDLE=1 ;;
    *) APP="$arg" ;;
  esac
done

rc=0
# (a) plugin-absence — runs WITHOUT a built bundle (pure cargo tree), so it is
#     always checkable, even on a fresh checkout / CI without a dev cert.
assert_plugins_absent || rc=1

# (b) bundle-level checks (entitlements + 13.0 floor) — need the SIGNED bundle.
#     When the .app IS present, EVERY failure here is FATAL (Finding 2 — no
#     warning-only pass). When it is ABSENT and --require-bundle was NOT passed,
#     SKIP loudly (the local no-cert case; the dev cert / dev.provisionprofile
#     are machine-specific + gitignored — this mirrors the Phase-26 sandbox
#     walkthrough gate). --require-bundle (used by the 27-04 canonical command's
#     tail, which always has a fresh bundle) turns the absence itself into a FAIL.
if [[ -d "$APP" ]]; then
  assert_entitlements_present "$APP" || rc=1
  assert_min_system_version "$APP" || rc=1
elif [[ "$REQUIRE_BUNDLE" -eq 1 ]]; then
  echo "FAIL: --require-bundle set but no signed .app at '$APP' — the canonical build did not produce a bundle" >&2
  rc=1
else
  echo "SKIP: signed .app not present at '$APP' — entitlements + 13.0-floor checks are the local human gate after 'pnpm tauri:build:appstore' (dev cert + dev.provisionprofile required, machine-specific)"
fi

if [[ "$rc" -ne 0 ]]; then
  echo "verify-appstore-bundle: FAIL" >&2
  exit 1
fi
echo "verify-appstore-bundle: OK"
