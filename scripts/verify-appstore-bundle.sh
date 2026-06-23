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
