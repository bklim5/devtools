#!/usr/bin/env bash
# Phase 27 (MAS-BUILD-06, D-09): assert the App Store bundle is compliant at the
# Phase 27 gate.
#   (a) forbidden plugins ABSENT — updater + autostart (+ process, the third
#       direct-only plugin) compiled out of the appstore dependency graph (the
#       EXACT flags the real build uses: --no-default-features --features appstore,
#       Plan 27-01);
#   (b) required entitlements PRESENT — app-sandbox + network.client on the
#       SIGNED .app (Criterion 2);
#   (c) the 13.0 floor PROVEN AT THE ARTIFACT — LSMinimumSystemVersion == 13.0 on
#       the built Info.plist (Finding 3; not just the overlay grep, which a bad
#       merge could pass while shipping the wrong floor).
# Phase 28 (MAS-BUILD-04, D-03/D-04) EXTENDS this script once the Keygen surface is
# compiled out by the static IS_APPSTORE switch:
#   (d) NO Keygen COPY markers — all four D-03 markers (the CE host, the buy link,
#       the $9 price, the Keygen-SPECIFIC key-field copy) are grep-FATAL on the
#       SIGNED bundle (assert_no_keygen_strings); the bare verb 'Activate' is NOT a
#       marker (AppearancePreviewStrip ships an inert 'Activate' preview button).
#   (e) NO licenseUi module fold-in — assert_no_license_ui_module reads the
#       licenseui-inventory.json sentinel emitted by the appstore-only generateBundle
#       guard (scripts/licenseUiFoldInGuard.mjs, gated on VITE_CHANNEL=appstore in
#       vite.config.ts) and asserts licenseUiInChunks:false (D-04, the false-GREEN
#       the copy-string grep can't catch — licenseUi carries none of those literals).
# --selftest proves each marker is load-bearing + free of false-RED; --selftest-realbuild
# proves the D-04 guard on a REAL fold-in build (importing the EXACT shared guard).
#
# GREEN at the Phase 27 boundary. When a bundle IS present, any failure is FATAL
# (non-zero exit) — Finding 2. The no-bundle local case SKIPs the bundle-level
# checks LOUDLY (never a false PASS).
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
  # updater + autostart are the MAS-BUILD-03 forbidden plugins named in the ROADMAP
  # criterion; `process` is the third direct-only plugin (also behind the `direct`
  # umbrella feature, Plan 27-01) and MUST likewise be absent from the sandbox graph.
  # Asserting all three is strictly stronger — it catches a future edit that re-links
  # `process` onto the appstore tree, which the updater|autostart-only grep would miss.
  local found
  found="$(printf '%s\n' "$tree" | grep -E 'tauri-plugin-(updater|autostart|process)' || true)"
  if [[ -n "$found" ]]; then
    echo "FAIL: forbidden plugin(s) present in the appstore dependency graph:" >&2
    printf '%s\n' "$found" | sed 's/^/    /' >&2
    return 1
  fi
  echo "OK: updater + autostart + process ABSENT from the appstore dependency graph"
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

assert_no_keygen_strings() {
  local app="${1:?usage: assert_no_keygen_strings <path-to-signed.app>}"
  local resources="$app/Contents/Resources"
  if [[ ! -d "$resources" ]]; then
    echo "FAIL: bundle Resources dir not found at '$resources'" >&2
    return 1
  fi
  # ALL FOUR D-03 forbidden COPY markers (MAS-BUILD-04) — any hit means the Keygen
  # surface survived tree-shaking into the store bundle (a stray non-static import).
  #   1 = host (the Keygen CE host)
  #   2 = buy URL (the BUY_LICENSE_URL external buy link, UpsellPanel.tsx)
  #   3 = price — the literal "$9" token AND the distinctive adjacent price copy
  #       ("once · lifetime license"). The adjacent copy is the ROBUST signal (a
  #       bare "$9" could in theory collide with a minified `$9` identifier); both
  #       are grepped so a true price-block leak is caught even if one is recoded.
  #   4 = Keygen-SPECIFIC key-field copy — the "I have a license key" CTA that
  #       reveals the key field AND the masked-key input placeholder
  #       (XXXX-XXXX-XXXX-XXXX). Both are rendered ONLY by InlineActivation.
  # NOTE: the bare verb 'Activate' is deliberately NOT a marker — AppearancePreviewStrip
  # renders an inert aria-hidden 'Activate' preview button that legitimately ships in the
  # store build; grepping the verb would FALSE-RED a clean bundle (Codex round-2 Finding A).
  local patterns=(
    'license\.tinkerdev\.io'
    'tinkerdev\.io/buy'
    '\$9'
    'once · lifetime license'
    'I have a license key'
    'XXXX-XXXX-XXXX-XXXX'
  )
  local hit=0
  for pat in "${patterns[@]}"; do
    if grep -rIlE "$pat" "$resources" >/dev/null 2>&1; then
      echo "FAIL: forbidden Keygen COPY marker '$pat' present in the store bundle (Keygen surface did not tree-shake out)" >&2
      grep -rIlE "$pat" "$resources" | sed 's/^/    /' >&2
      hit=1
    fi
  done
  [[ "$hit" -eq 0 ]] || return 1
  echo "OK: no Keygen COPY markers (host / buy URL / \$9 price / activation+key-field copy) in the store bundle"
}

assert_no_license_ui_module() {
  local app="${1:?usage: assert_no_license_ui_module <path-to-signed.app>}"
  local resources="$app/Contents/Resources"
  [[ -d "$resources" ]] || { echo "FAIL: Resources dir not found at '$resources'" >&2; return 1; }
  # D-04 (deterministic, chunk-module inventory): the appstore generateBundle plugin
  # (vite.config.ts, gated on VITE_CHANNEL=appstore via the SHARED
  # scripts/licenseUiFoldInGuard.mjs) inspects each chunk's REAL folded-in module IDs
  # (chunk.modules) and emits this sentinel recording whether src/lib/license/licenseUi
  # was folded into ANY chunk. A correct store build (main.tsx reaches refreshLicenseUi
  # ONLY via a dead !IS_APPSTORE dynamic import — Plan 02) yields licenseUiInChunks:false.
  # We do NOT use the Vite manifest (a chunk/asset map that MISSES modules folded into the
  # entry chunk — the false-GREEN this replaces), nor the shared license_status* IPC
  # literals (they ship regardless — the iap arm import()s the shared tauriPlatform
  # object), nor raw 'licenseUi' identifiers (minification renames).
  #
  # The sentinel MUST be read at the EXACT root path the appstore plugin emits it to
  # ($APP/Contents/Resources/licenseui-inventory.json). A recursive `find ... -quit`
  # would accept the FIRST match ANYWHERE under Resources — so a stale/unrelated CLEAN
  # sentinel copied into some other resource subtree could satisfy this check even when
  # the appstore plugin never ran (no root sentinel) — a FALSE-GREEN that defeats the
  # load-bearing missing-sentinel guard (Codex round-4 Finding 1). We therefore (1) read
  # the EXACT root path, and (2) additionally fail if ANY duplicate licenseui-inventory.json
  # exists elsewhere under Resources (more than one copy signals a stale/tampered sentinel).
  local sentinel="$resources/licenseui-inventory.json"
  local dup
  dup="$(find "$resources" -name 'licenseui-inventory.json' 2>/dev/null | wc -l | tr -d '[:space:]')"
  if [[ ! -f "$sentinel" ]]; then
    echo "FAIL: D-04 sentinel not found at the EXACT root path '$sentinel' — the appstore generateBundle chunk-module guard (VITE_CHANNEL=appstore) did NOT run; without it the D-04 fold-in check cannot be proven. Fix the channel-gated plugin before release." >&2
    return 1
  fi
  if [[ "${dup:-0}" -gt 1 ]]; then
    echo "FAIL: D-04 found $dup copies of licenseui-inventory.json under '$resources' — exactly one (the root sentinel emitted by the appstore plugin) is expected; a duplicate signals a stale/tampered sentinel and is rejected (Codex round-4 Finding 1)." >&2
    find "$resources" -name 'licenseui-inventory.json' 2>/dev/null | sed 's/^/    /' >&2
    return 1
  fi
  # The plugin throws (fails the build) on a fold-in, so a shipped sentinel is normally
  # false; assert it explicitly as defence-in-depth (and to catch a future plugin that
  # records-without-throwing). Match the JSON boolean exactly.
  if grep -E '"licenseUiInChunks"[[:space:]]*:[[:space:]]*true' "$sentinel" >/dev/null 2>&1; then
    echo "FAIL: D-04 violation — licenseui-inventory.json reports licenseUi was folded into a store chunk:" >&2
    sed 's/^/    /' "$sentinel" >&2
    return 1
  fi
  if ! grep -E '"licenseUiInChunks"[[:space:]]*:[[:space:]]*false' "$sentinel" >/dev/null 2>&1; then
    echo "FAIL: D-04 sentinel present but malformed (no licenseUiInChunks:false) at '$sentinel':" >&2
    sed 's/^/    /' "$sentinel" >&2
    return 1
  fi
  echo "OK: src/lib/license/licenseUi ABSENT from every store chunk (D-04, from the generateBundle chunk-module inventory sentinel)"
}

selftest_forbidden_gate() {
  local tmp; tmp="$(mktemp -d)"; mkdir -p "$tmp/Contents/Resources"
  local res="$tmp/Contents/Resources"
  local rc=0

  # (1) Each COPY marker independently trips assert_no_keygen_strings. Use the SAME
  # literals the real patterns target (the planted '$9' price line carries the
  # distinctive adjacent copy; the key-field marker is the real masked-key placeholder).
  for marker in 'license.tinkerdev.io' 'tinkerdev.io/buy' 'price $9 once · lifetime license' 'I have a license key' 'XXXX-XXXX-XXXX-XXXX'; do
    printf 'clean\n' > "$res/app.js"
    printf '%s\n' "$marker" > "$res/planted.js"
    if assert_no_keygen_strings "$tmp" >/dev/null 2>&1; then
      echo "SELFTEST FAIL: planted COPY marker '$marker' did NOT trip assert_no_keygen_strings" >&2; rc=1
    else
      echo "SELFTEST OK: '$marker' trips the copy gate"
    fi
  done

  # (2) BENIGN-PASS (Finding A): a bare 'Activate' string (mimicking AppearancePreviewStrip's
  # inert preview button) must NOT trip the copy gate — proves no false-RED on legit store UI.
  printf 'clean\n' > "$res/app.js"
  printf '<button aria-hidden="true">Activate</button>\n' > "$res/planted.js"
  if assert_no_keygen_strings "$tmp" >/dev/null 2>&1; then
    echo "SELFTEST OK: benign 'Activate' button does NOT trip the copy gate (no false-RED)"
  else
    echo "SELFTEST FAIL: benign 'Activate' string FALSE-RED the copy gate (Finding A regression)" >&2; rc=1
  fi
  rm -f "$res/planted.js"; printf 'clean\n' > "$res/app.js"

  # (3a) BENIGN-PASS (Finding B): a clean sentinel {licenseUiInChunks:false} (a store build
  # where licenseUi is only behind the dead !IS_APPSTORE dynamic import) must PASS — proves the
  # D-04 check keys on the chunk-module fold-in inventory, not on any IPC literal (no false-RED).
  printf '{ "licenseUiInChunks": false, "hits": [] }\n' > "$res/licenseui-inventory.json"
  if assert_no_license_ui_module "$tmp" >/dev/null 2>&1; then
    echo "SELFTEST OK: clean sentinel (licenseUiInChunks:false) PASSES the D-04 check (no false-RED)"
  else
    echo "SELFTEST FAIL: clean sentinel FALSE-RED the D-04 check (Finding B regression)" >&2; rc=1
  fi

  # (3b) LOAD-BEARING (round-3 Finding): a fold-in sentinel {licenseUiInChunks:true}
  # (licenseUi folded into a chunk) MUST trip D-04 — the false-GREEN the Vite manifest missed.
  printf '{ "licenseUiInChunks": true, "hits": ["assets/main-abc.js: /abs/src/lib/license/licenseUi.ts"] }\n' > "$res/licenseui-inventory.json"
  if assert_no_license_ui_module "$tmp" >/dev/null 2>&1; then
    echo "SELFTEST FAIL: a fold-in sentinel (licenseUiInChunks:true) did NOT trip the D-04 check (check is vacuous — the false-GREEN survives)" >&2; rc=1
  else
    echo "SELFTEST OK: a fold-in sentinel (licenseUiInChunks:true) trips the D-04 check (load-bearing)"
  fi

  # (3c) LOAD-BEARING: a MISSING sentinel MUST FAIL (the appstore generateBundle plugin
  # did not run → the D-04 proof is absent → block the release).
  rm -f "$res/licenseui-inventory.json"
  if assert_no_license_ui_module "$tmp" >/dev/null 2>&1; then
    echo "SELFTEST FAIL: a MISSING sentinel did NOT trip the D-04 check (the plugin could silently not-run)" >&2; rc=1
  else
    echo "SELFTEST OK: a missing sentinel trips the D-04 check (the appstore plugin must run)"
  fi

  rm -rf "$tmp"; return "$rc"
}

selftest_foldin_realbuild() {
  # MANDATORY automated REAL-bundling fold-in self-test (no hand-written sentinel; no
  # human-run fallback — this always runs a real Vite build in CI / the Task-2 verify).
  # It imports the SAME shared scripts/licenseUiFoldInGuard.mjs guard vite.config.ts
  # uses (NEVER an inline/copied guard or re-declared regex), so it exercises the EXACT
  # production guard: same regex, same emitFile, same throw. It builds a tiny fixture
  # TWICE via Vite's programmatic API and asserts the guard's REAL chunk.modules behaviour:
  #   - FOLD-IN fixture (licenseUi statically imported into the entry chunk) → build MUST FAIL.
  #   - CLEAN fixture (licenseUi reachable only behind a dead `if (false) import(...)`) →
  #     build MUST SUCCEED + emit licenseui-inventory.json with licenseUiInChunks:false.
  local repo; repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  local guard="$repo/scripts/licenseUiFoldInGuard.mjs"
  local tmp; tmp="$(mktemp -d)"
  local rc=0

  # Shared stand-in module placed at the regex-matching path so Rollup's resolved
  # module id ends in src/lib/license/licenseUi.ts (the production regex target).
  mkdir -p "$tmp/src/lib/license"
  printf 'export const licenseUiStandin = 42;\n' > "$tmp/src/lib/license/licenseUi.ts"

  # --- FOLD-IN fixture: static import → folded into the entry chunk → MUST FAIL ---
  local foldin="$tmp/foldin"; mkdir -p "$foldin"
  printf 'import { licenseUiStandin } from "../src/lib/license/licenseUi.ts";\nconsole.log(licenseUiStandin);\n' > "$foldin/entry.js"
  if node --input-type=module -e "
    import { build } from 'vite';
    import { licenseUiFoldInGuard } from '$guard';
    await build({ root: '$tmp', logLevel: 'silent', plugins: [licenseUiFoldInGuard()], build: { outDir: '$foldin/out', emptyOutDir: true, lib: { entry: '$foldin/entry.js', formats: ['es'], fileName: 'foldin' } } });
  " >/dev/null 2>&1; then
    echo "SELFTEST FAIL (realbuild): a STATIC licenseUi import folded into the entry chunk did NOT fail the appstore build (the production guard is not catching the fold-in case)" >&2; rc=1
  else
    echo "SELFTEST OK (realbuild): a real fold-in fixture FAILS the appstore build (production guard caught chunk.modules fold-in)"
  fi

  # --- CLEAN fixture: dead dynamic import → NOT folded → MUST PASS, sentinel false ---
  local clean="$tmp/clean"; mkdir -p "$clean"
  printf 'if (false) { import("../src/lib/license/licenseUi.ts").then(() => {}); }\nconsole.log("clean");\n' > "$clean/entry.js"
  if node --input-type=module -e "
    import { build } from 'vite';
    import { licenseUiFoldInGuard } from '$guard';
    await build({ root: '$tmp', logLevel: 'silent', plugins: [licenseUiFoldInGuard()], build: { outDir: '$clean/out', emptyOutDir: true, lib: { entry: '$clean/entry.js', formats: ['es'], fileName: 'clean' } } });
  " >/dev/null 2>&1; then
    if grep -E '"licenseUiInChunks"[[:space:]]*:[[:space:]]*false' "$clean/out/licenseui-inventory.json" >/dev/null 2>&1; then
      echo "SELFTEST OK (realbuild): a clean fixture (dead dynamic import) PASSES + sentinel licenseUiInChunks:false"
    else
      echo "SELFTEST FAIL (realbuild): clean fixture built but the sentinel did not report licenseUiInChunks:false" >&2
      [[ -f "$clean/out/licenseui-inventory.json" ]] && sed 's/^/    /' "$clean/out/licenseui-inventory.json" >&2
      rc=1
    fi
  else
    echo "SELFTEST FAIL (realbuild): a clean fixture (licenseUi only behind a dead dynamic import) FAILED the build (false-RED)" >&2; rc=1
  fi

  rm -rf "$tmp"; return "$rc"
}

APP="src-tauri/target/universal-apple-darwin/release/bundle/macos/TinkerDev.app"
REQUIRE_BUNDLE=0
for arg in "$@"; do
  case "$arg" in
    # The gate's own correctness is provable WITHOUT a signed bundle: --selftest runs
    # the pure-shell planted-string + benign-PASS fixtures; --selftest-realbuild runs
    # the MANDATORY automated real-Vite fold-in build (exercising the EXACT production
    # guard). Each exits with its own rc so CI / the Task-2 verify can gate on them.
    --selftest) selftest_forbidden_gate; exit $? ;;
    --selftest-realbuild) selftest_foldin_realbuild; exit $? ;;
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
  # MAS-BUILD-04 + D-04 — both FATAL when a bundle is present (Finding 2 pattern):
  #   the four-COPY-marker Keygen grep, and the chunk-module-inventory sentinel check.
  assert_no_keygen_strings "$APP" || rc=1
  assert_no_license_ui_module "$APP" || rc=1
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
