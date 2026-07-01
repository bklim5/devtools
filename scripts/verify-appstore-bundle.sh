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
# compiled out by the static IS_APPSTORE switch.
#
# OPTION A — where the D-03/D-04 CONTENT proof lives (Plan 28-05 Rule-4 decision,
# 2026-06-23). The planner's <interfaces> premise that the appstore `.app` bundles
# `dist/` under `$APP/Contents/Resources/` was FALSE for this Tauri 2 build: Tauri
# brotli-EMBEDS the frontend into the Rust binary (Contents/MacOS/<bin>), so
# Contents/Resources/ holds ONLY icon.icns — NO frontend JS, NO sentinel. Grepping
# Resources for the copy markers passes VACUOUSLY (no frontend there) and the
# sentinel read FAILS (no sentinel there); the real asset bytes are brotli-compressed
# inside the binary, invisible to `strings`/`grep`. So the D-03 copy grep + the D-04
# sentinel read are asserted on the appstore-build `dist/` — the AUTHORITATIVE
# pre-compression bytes Tauri embeds VERBATIM into the binary in the SAME
# `tauri build` invocation (beforeBuildCommand `pnpm build` emits dist/ → Tauri
# compresses it in). A FATAL freshness/linkage check (assert_dist_freshness) binds the
# inspected `dist/` to the signed binary so a STALE clean dist/ cannot mask a
# dirty/stale signed .app. The binary-level checks (universal archs, app-sandbox +
# network.client, plugins absent, 13.0 floor, embedded provisionprofile, valid deep
# signature) stay on the signed .app.
#   (d) NO Keygen COPY markers — all four D-03 markers (the CE host, the buy link,
#       the $9 price, the Keygen-SPECIFIC key-field copy) are grep-FATAL on the
#       appstore-build dist/ (assert_no_keygen_strings); the bare verb 'Activate' is
#       NOT a marker (AppearancePreviewStrip ships an inert 'Activate' preview button).
#   (e) NO licenseUi module fold-in — assert_no_license_ui_module reads the
#       licenseui-inventory.json sentinel emitted INTO dist/ by the appstore-only
#       generateBundle guard (scripts/licenseUiFoldInGuard.mjs, gated on
#       VITE_CHANNEL=appstore in vite.config.ts) and asserts licenseUiInChunks:false
#       (D-04, the false-GREEN the copy-string grep can't catch — licenseUi carries
#       none of those literals).
#   (f) FRESHNESS/LINKAGE — assert_dist_freshness proves (1) the signed binary is
#       NEWER than the last source commit (no stale .app handed off — harness rule);
#       (2) dist/ exists, is non-empty, and carries the sentinel (a missing/empty/
#       sentinel-less dist FAILS, never SKIPs); (3) dist/ is itself fresh (its
#       newest asset is NEWER than the last source commit) AND consistent with the
#       binary (dist/ not newer than the signed binary — it is built FIRST, then
#       embedded). A stale clean dist/ next to a fresh binary therefore FAILS.
# Phase 29 (MAS-NATIVE-02/03/04, D-09) EXTENDS this script with three additive FATAL checks:
#   (g) keyring (macOS Keychain crate) ABSENT from the appstore cargo tree
#       (assert_plugins_absent) — 29-01 made it optional under `direct`; a surviving
#       link re-introduces the Keychain FFI (MAS-NATIVE-03).
#   (h) NO `keychain-access-groups` entitlement on the signed bundle
#       (assert_entitlements_present) — the store build uses no Keychain (T-29-08).
#   (i) NO updater UI subtree in the store chunks (assert_no_license_ui_module reads the
#       SAME licenseui-inventory.json sentinel and asserts updaterInChunks:false). The
#       29-02 IS_APPSTORE lazy import tree-shakes the WHOLE updater overlay (UpdaterOverlay
#       → useUpdater → shell/update → UpdateBanner) out; the shared chunk-module guard
#       records its absence. NOTE: this is deliberately NOT a `@tauri-apps/plugin-updater`
#       PACKAGE-absence test — plugin-updater rides along INERT via the shared tauri.ts seam
#       (D-05, exactly like plugin-autostart); its safety is the 29-02 runtime
#       updater.check===0 no-invoke proof, NOT bundle exclusion (a string/package grep is a
#       false signal per keygen-compileout-d04-proof).
# Phase 32 (PRT-02) EXTENDS this script with ONE additive FATAL check (both channels):
#   (j) NO heavy engine INITIALLY-REACHABLE — assert_no_heavy_engine_in_entry reads the
#       prettier-chunk-inventory.json sentinel emitted by the UNGATED prettierChunkGuard
#       (scripts/prettierChunkGuard.mjs in vite.config.ts) and FATALs on
#       heavyEngineInitiallyReachable:true. The prettier + esbuild-wasm engines MAY ship
#       but ONLY from a dynamic-import() chunk (never on the initial page-load path — the
#       cold-start/offline lazy-load requirement). Same EXACT-root sentinel read +
#       duplicate rejection + missing/malformed FAIL discipline as the licenseUi guard,
#       bound by the same assert_dist_freshness.
#
# --selftest proves each marker is load-bearing + free of false-RED; --selftest-realbuild
# proves the D-04 + Phase-29 updater guard on a REAL fold-in build (importing the EXACT
# shared guard).
#
# GREEN at the Phase 27 boundary. When a bundle IS present, any failure is FATAL
# (non-zero exit) — Finding 2. The no-bundle local case SKIPs the bundle-level
# checks LOUDLY (never a false PASS).
#
# Usage:  bash scripts/verify-appstore-bundle.sh [path-to-signed.app] [--require-bundle]
#   default app path: ${CARGO_TARGET_DIR:-src-tauri/target/appstore}/universal-apple-darwin/release/bundle/macos/TinkerDev.app
#                     (unset = the appstore channel's canonical tree — where `pnpm
#                      tauri:build:appstore` / scripts/build.sh appstore now land; CARGO_TARGET_DIR
#                      set follows that. For the appstore-pkg channel, pass its path explicitly —
#                      in-flow callers always do, so this default only matters for a bare run.)
#   default dist dir: dist/  (override with --dist <dir>; the appstore frontend output,
#                     frontendDist "../dist", produced by the build's beforeBuildCommand
#                     in the SAME invocation that signs the .app)
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
  # Phase 29 (MAS-NATIVE-03): the macOS Keychain crate must be ABSENT from the store
  # tree (29-01 made `keyring` optional under the `direct` umbrella feature). It is
  # `keyring v…`, NOT a tauri-plugin-, so the updater|autostart|process alternation
  # above does not catch it. A surviving keyring link would re-introduce the Keychain
  # FFI → an unjustified keychain-access-groups entitlement / a runtime Keychain error.
  local keyring_found
  keyring_found="$(printf '%s\n' "$tree" | grep -E '^[^a-zA-Z]*keyring v' || true)"
  if [[ -n "$keyring_found" ]]; then
    echo "FAIL: keyring (macOS Keychain crate) present in the appstore dependency graph — 29-01 must drop it (MAS-NATIVE-03):" >&2
    printf '%s\n' "$keyring_found" | sed 's/^/    /' >&2
    return 1
  fi
  echo "OK: keyring (Keychain crate) ABSENT from the appstore dependency graph (autostart already covered above)"
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
  # Phase 29 (MAS-NATIVE-03 / D-09 check 3): the store build uses NO Keychain (29-01
  # compiled `keyring` out), so it must carry NO `keychain-access-groups` entitlement.
  # A shipped keychain-access-groups grant is an unjustified elevation (T-29-08).
  if printf '%s' "$ents" | grep -qF 'keychain-access-groups'; then
    echo "FAIL: unjustified 'keychain-access-groups' entitlement PRESENT on the signed store bundle (MAS-NATIVE-03 — the store build uses no Keychain)" >&2
    return 1
  fi
  echo "OK: NO keychain-access-groups entitlement on the signed bundle (MAS-NATIVE-03)"
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
  # OPTION A: grep the appstore-build dist/ (the pre-compression bytes Tauri embeds
  # VERBATIM into the binary), NOT $APP/Contents/Resources/ (which holds only icon.icns
  # for this Tauri 2 brotli-embed build — grepping it would pass VACUOUSLY). The
  # freshness/linkage of this dist/ to the signed binary is enforced separately by
  # assert_dist_freshness (a stale clean dist/ cannot mask a dirty binary).
  local dist="${1:?usage: assert_no_keygen_strings <appstore-build-dist-dir>}"
  if [[ ! -d "$dist" ]]; then
    echo "FAIL: appstore-build dist/ not found at '$dist' — the frontend assets to grep are absent (run the appstore build, which emits dist/ via beforeBuildCommand)" >&2
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
    if grep -rIlE "$pat" "$dist" >/dev/null 2>&1; then
      echo "FAIL: forbidden Keygen COPY marker '$pat' present in the appstore-build dist/ (Keygen surface did not tree-shake out)" >&2
      grep -rIlE "$pat" "$dist" | sed 's/^/    /' >&2
      hit=1
    fi
  done
  [[ "$hit" -eq 0 ]] || return 1
  echo "OK: no Keygen COPY markers (host / buy URL / \$9 price / activation+key-field copy) in the appstore-build dist/"
}

assert_no_license_ui_module() {
  # OPTION A: read the sentinel from the appstore-build dist/ (where the appstore-only
  # generateBundle guard emits it — frontendDist "../dist"), NOT $APP/Contents/Resources/
  # (Tauri 2 brotli-embeds dist/ into the binary; the sentinel is NOT under Resources for
  # this build, so a Resources read would FAIL even on a correct bundle). The dist/'s
  # freshness/linkage to the signed binary is enforced by assert_dist_freshness.
  local dist="${1:?usage: assert_no_license_ui_module <appstore-build-dist-dir>}"
  [[ -d "$dist" ]] || { echo "FAIL: appstore-build dist/ not found at '$dist'" >&2; return 1; }
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
  # (<dist>/licenseui-inventory.json). A recursive `find ... -quit` would accept the FIRST
  # match ANYWHERE under dist/ — so a stale/unrelated CLEAN sentinel copied into some other
  # subtree could satisfy this check even when the appstore plugin never ran (no root
  # sentinel) — a FALSE-GREEN that defeats the load-bearing missing-sentinel guard (Codex
  # round-4 Finding 1). We therefore (1) read the EXACT root path, and (2) additionally fail
  # if ANY duplicate licenseui-inventory.json exists elsewhere under dist/ (more than one
  # copy signals a stale/tampered sentinel).
  local sentinel="$dist/licenseui-inventory.json"
  local dup
  dup="$(find "$dist" -name 'licenseui-inventory.json' 2>/dev/null | wc -l | tr -d '[:space:]')"
  if [[ ! -f "$sentinel" ]]; then
    echo "FAIL: D-04 sentinel not found at the EXACT root path '$sentinel' — the appstore generateBundle chunk-module guard (VITE_CHANNEL=appstore) did NOT run; without it the D-04 fold-in check cannot be proven. Fix the channel-gated plugin before release." >&2
    return 1
  fi
  if [[ "${dup:-0}" -gt 1 ]]; then
    echo "FAIL: D-04 found $dup copies of licenseui-inventory.json under '$dist' — exactly one (the root sentinel emitted by the appstore plugin) is expected; a duplicate signals a stale/tampered sentinel and is rejected (Codex round-4 Finding 1)." >&2
    find "$dist" -name 'licenseui-inventory.json' 2>/dev/null | sed 's/^/    /' >&2
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
  # Phase 29 (MAS-NATIVE-02/03): the updater UI subtree (UpdaterOverlay → useUpdater →
  # shell/update → UpdateBanner, + the DIRECT-only UpdatesSettings pane) is gated out via
  # the 29-02 IS_APPSTORE lazy import; the SAME generateBundle guard's chunk.modules
  # inventory records its absence (updaterInChunks) into THIS sentinel. A string grep for
  # menu://check-updates — OR a plugin-updater PACKAGE-absence test — is INSUFFICIENT
  # (keygen-compileout-d04-proof; plugin-updater rides along inert via the shared tauri.ts
  # seam per D-05, exactly like plugin-autostart). We assert the chunk-MODULE sentinel for
  # the UI modules; the 29-02 runtime updater.check===0 boot-path assertion is the other
  # half of the proof. Reuse the EXACT true/false + malformed-field discipline above.
  if grep -E '"updaterInChunks"[[:space:]]*:[[:space:]]*true' "$sentinel" >/dev/null 2>&1; then
    echo "FAIL: Phase-29 violation — sentinel reports an updater UI module was folded into a store chunk:" >&2
    sed 's/^/    /' "$sentinel" >&2
    return 1
  fi
  if ! grep -E '"updaterInChunks"[[:space:]]*:[[:space:]]*false' "$sentinel" >/dev/null 2>&1; then
    echo "FAIL: sentinel present but missing updaterInChunks:false (the guard did not record the updater inventory) at '$sentinel':" >&2
    sed 's/^/    /' "$sentinel" >&2
    return 1
  fi
  echo "OK: updater UI subtree (update.ts/useUpdater/UpdateBanner/UpdaterOverlay/UpdatesSettings) ABSENT from every store chunk (chunk-module inventory sentinel; plugin-updater rides along inert via the shared seam per D-05 — proven safe by the 29-02 runtime updater.check===0 assertion)"
}

assert_no_heavy_engine_in_entry() {
  # PRT-02 (Phase 32): the heavy prettify/minify engines (prettier + esbuild-wasm)
  # MAY ship, but ONLY from a chunk loaded lazily via dynamic import() — never
  # initially-reachable from an entry chunk (entry chunk OR an entry-static-imported
  # shared/vendor chunk). scripts/prettierChunkGuard.mjs (wired UNGATED in
  # vite.config.ts) computes the initial-reachability set over the REAL chunk.modules
  # and emits prettier-chunk-inventory.json recording heavyEngineInitiallyReachable.
  # This mirrors assert_no_license_ui_module EXACTLY: read the sentinel at the EXACT
  # root path, reject duplicates, FAIL on a missing/malformed sentinel, FATAL on
  # heavyEngineInitiallyReachable:true. Bound by the SAME assert_dist_freshness as the
  # licenseUi assertion (the dist/ the sentinel lives in must be fresh vs the binary).
  local dist="${1:?usage: assert_no_heavy_engine_in_entry <appstore-build-dist-dir>}"
  [[ -d "$dist" ]] || { echo "FAIL: appstore-build dist/ not found at '$dist'" >&2; return 1; }
  local sentinel="$dist/prettier-chunk-inventory.json"
  local dup
  dup="$(find "$dist" -name 'prettier-chunk-inventory.json' 2>/dev/null | wc -l | tr -d '[:space:]')"
  if [[ ! -f "$sentinel" ]]; then
    echo "FAIL: PRT-02 sentinel not found at the EXACT root path '$sentinel' — the prettierChunkGuard generateBundle plugin (vite.config.ts, ungated) did NOT run; without it the heavy-engine initial-reachability check cannot be proven. Fix the plugin wiring before release." >&2
    return 1
  fi
  if [[ "${dup:-0}" -gt 1 ]]; then
    echo "FAIL: PRT-02 found $dup copies of prettier-chunk-inventory.json under '$dist' — exactly one (the root sentinel emitted by the guard) is expected; a duplicate signals a stale/tampered sentinel and is rejected (mirrors the D-04 licenseUi guard)." >&2
    find "$dist" -name 'prettier-chunk-inventory.json' 2>/dev/null | sed 's/^/    /' >&2
    return 1
  fi
  # The guard throws (fails the build) on an initially-reachable engine, so a shipped
  # sentinel is normally false; assert it explicitly as defence-in-depth (and to catch
  # a future guard that records-without-throwing). Match the JSON boolean exactly.
  if grep -E '"heavyEngineInitiallyReachable"[[:space:]]*:[[:space:]]*true' "$sentinel" >/dev/null 2>&1; then
    echo "FAIL: PRT-02 violation — prettier-chunk-inventory.json reports a prettier/esbuild-wasm module is initially-reachable from an entry chunk (cold-start regression / not lazy):" >&2
    sed 's/^/    /' "$sentinel" >&2
    return 1
  fi
  if ! grep -E '"heavyEngineInitiallyReachable"[[:space:]]*:[[:space:]]*false' "$sentinel" >/dev/null 2>&1; then
    echo "FAIL: PRT-02 sentinel present but malformed (no heavyEngineInitiallyReachable:false) at '$sentinel':" >&2
    sed 's/^/    /' "$sentinel" >&2
    return 1
  fi
  echo "OK: prettier + esbuild-wasm ABSENT from every initially-reachable chunk (PRT-02, from the prettierChunkGuard initial-reachability sentinel — heavy engines load only via dynamic import())"
}

# mtime helper — epoch seconds for a file (BSD stat on macOS, GNU stat fallback for CI).
_mtime() { stat -f %m "$1" 2>/dev/null || stat -c %Y "$1" 2>/dev/null; }

assert_dist_freshness() {
  # OPTION A FRESHNESS/LINKAGE (FATAL) — the load-bearing guard that makes the dist/-layer
  # D-03 grep + D-04 sentinel TRUSTWORTHY. Because the content checks read the appstore-build
  # dist/ (not the binary), a STALE clean dist/ left next to a dirty/stale signed .app could
  # otherwise mask a non-compliant binary (false-GREEN). This binds the two together:
  #   (1) the signed binary is NEWER than the last source commit — no stale .app handed off
  #       (harness rule, memory verify-gate-builds-real-app / T-28-21);
  #   (2) dist/ exists, is non-empty, and carries the EXACT-root sentinel (a missing/empty/
  #       sentinel-less dist/ FAILS — never SKIPs, never vacuous);
  #   (3) dist/ is itself FRESH (its newest asset is NEWER than the last source commit) AND
  #       consistent with the binary (dist/ is NOT newer than the signed binary — Tauri's
  #       beforeBuildCommand emits dist/ FIRST, then embeds+compiles the binary, so a correct
  #       same-invocation build has binary_mtime >= dist_mtime). A dist/ NEWER than the binary
  #       means dist/ was rebuilt AFTER the .app was signed — the signed binary embeds OLDER
  #       bytes than the ones we are grepping (the grep would no longer describe the shipped
  #       artifact) → FAIL.
  local app="${1:?usage: assert_dist_freshness <path-to-signed.app> <appstore-build-dist-dir>}"
  local dist="${2:?usage: assert_dist_freshness <path-to-signed.app> <appstore-build-dist-dir>}"

  # Resolve the inner binary by CFBundleExecutable (the crate name, not productName).
  local bin
  bin="$app/Contents/MacOS/$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$app/Contents/Info.plist" 2>/dev/null)"
  if [[ ! -f "$bin" ]]; then
    echo "FAIL: could not resolve the signed binary via CFBundleExecutable at '$app/Contents/Info.plist'" >&2
    return 1
  fi

  # Last source commit time (the harness anchor). Use the committer date of HEAD; the build
  # MUST run after the last source change has landed (rebuild-LAST rule).
  local last_commit_epoch
  last_commit_epoch="$(git log -1 --format=%ct 2>/dev/null)"
  if [[ -z "$last_commit_epoch" ]]; then
    echo "FAIL: could not read the last source commit time (git log -1 --format=%ct) — cannot prove freshness" >&2
    return 1
  fi

  local bin_epoch; bin_epoch="$(_mtime "$bin")"
  if [[ -z "$bin_epoch" ]]; then
    echo "FAIL: could not stat the signed binary mtime at '$bin'" >&2
    return 1
  fi

  # (1) binary newer than the last source commit.
  if [[ "$bin_epoch" -le "$last_commit_epoch" ]]; then
    echo "FAIL: the signed binary ('$bin', mtime $bin_epoch) is NOT newer than the last source commit (mtime $last_commit_epoch) — a STALE .app was handed off; rebuild LAST after every source change lands (harness rule)." >&2
    return 1
  fi

  # (2) dist/ present, non-empty, sentinel-bearing.
  if [[ ! -d "$dist" ]]; then
    echo "FAIL: appstore-build dist/ not found at '$dist' — the inspected frontend bytes are absent (a missing dist/ is a hard FAIL, never a SKIP)." >&2
    return 1
  fi
  if [[ -z "$(find "$dist" -type f -print -quit 2>/dev/null)" ]]; then
    echo "FAIL: appstore-build dist/ at '$dist' is EMPTY — no frontend bytes to inspect (hard FAIL)." >&2
    return 1
  fi
  if [[ ! -f "$dist/licenseui-inventory.json" ]]; then
    echo "FAIL: appstore-build dist/ at '$dist' has NO licenseui-inventory.json sentinel at its root — the appstore generateBundle guard did not run for this dist/ (so this dist/ is not an appstore-channel build); cannot anchor the D-04 proof. Hard FAIL." >&2
    return 1
  fi

  # newest asset mtime in dist/ (the freshest write the build produced).
  local newest_dist_epoch=0 f e
  while IFS= read -r f; do
    e="$(_mtime "$f")"
    [[ -n "$e" && "$e" -gt "$newest_dist_epoch" ]] && newest_dist_epoch="$e"
  done < <(find "$dist" -type f 2>/dev/null)
  if [[ "$newest_dist_epoch" -eq 0 ]]; then
    echo "FAIL: could not determine the newest asset mtime under '$dist'" >&2
    return 1
  fi

  # (3a) dist/ fresh relative to source.
  if [[ "$newest_dist_epoch" -le "$last_commit_epoch" ]]; then
    echo "FAIL: the inspected dist/ ('$dist', newest asset mtime $newest_dist_epoch) is OLDER than the last source commit (mtime $last_commit_epoch) — a STALE clean dist/ that does NOT reflect the current source is masking the signed binary. Re-run the appstore build (pnpm tauri:build:appstore) so dist/ + the .app come from the SAME fresh invocation." >&2
    return 1
  fi

  # (3b) dist/ consistent with the binary (built FIRST, then embedded → not newer than binary).
  if [[ "$newest_dist_epoch" -gt "$bin_epoch" ]]; then
    echo "FAIL: the inspected dist/ ('$dist', newest asset mtime $newest_dist_epoch) is NEWER than the signed binary ('$bin', mtime $bin_epoch) — dist/ was rebuilt AFTER the .app was signed, so the binary embeds OLDER bytes than the ones being grepped. The D-03/D-04 dist/ checks would no longer describe the shipped artifact. Rebuild so dist/ + the .app are from the SAME invocation." >&2
    return 1
  fi

  echo "OK: freshness/linkage — signed binary newer than last source commit (binary $bin_epoch > commit $last_commit_epoch); dist/ fresh (newest $newest_dist_epoch > commit) and consistent with the binary (dist/ $newest_dist_epoch <= binary $bin_epoch); sentinel present at dist/ root"
}

assert_binary_integrity() {
  # OPTION A keeps the binary-level checks on the SIGNED .app: universal archs (lipo),
  # an embedded provisioning profile, and a VALID deep signature. (Entitlements + the 13.0
  # floor + plugin-absence are asserted by their own functions.) These cannot be proven from
  # dist/ — they live on the signed Mach-O bundle.
  local app="${1:?usage: assert_binary_integrity <path-to-signed.app>}"
  local bin
  bin="$app/Contents/MacOS/$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$app/Contents/Info.plist" 2>/dev/null)"
  if [[ ! -f "$bin" ]]; then
    echo "FAIL: could not resolve the signed binary via CFBundleExecutable at '$app/Contents/Info.plist'" >&2
    return 1
  fi
  local rc=0

  # (1) universal — x86_64 + arm64 both present (a single-arch build is rejected by ASC).
  local archs
  archs="$(lipo -archs "$bin" 2>/dev/null)"
  if ! grep -qw x86_64 <<<"$archs" || ! grep -qw arm64 <<<"$archs"; then
    echo "FAIL: the signed binary is NOT universal (lipo -archs = '${archs:-<none>}'; expected both x86_64 and arm64)" >&2
    rc=1
  else
    echo "OK: signed binary is universal (lipo -archs: $archs)"
  fi

  # (2) embedded provisioning profile — without it the sandboxed app cannot launch / the
  #     StoreKit sheet will not present (the profile authorises the restricted entitlements).
  if [[ ! -f "$app/Contents/embedded.provisionprofile" ]]; then
    echo "FAIL: no embedded provisioning profile at '$app/Contents/embedded.provisionprofile' — the sandboxed app cannot launch / present the StoreKit sheet" >&2
    rc=1
  else
    echo "OK: embedded.provisionprofile present"
  fi

  # (3) valid deep signature — an inconsistent nested signature would launch-fail under the
  #     sandbox/Gatekeeper. codesign --verify --deep --strict.
  if codesign --verify --deep --strict --verbose=2 "$app" >/dev/null 2>&1; then
    echo "OK: deep signature valid + consistent (codesign --verify --deep --strict)"
  else
    echo "FAIL: deep codesign verification FAILED — the bundle signature is not internally consistent" >&2
    codesign --verify --deep --strict --verbose=2 "$app" 2>&1 | sed 's/^/    /' | head -8 >&2
    rc=1
  fi

  return "$rc"
}

selftest_forbidden_gate() {
  # OPTION A: the content checks now read the appstore-build dist/ (not Contents/Resources),
  # so the fixtures are a dist/-shaped dir. assert_dist_freshness (the linkage guard) is
  # exercised separately in selftest_dist_freshness below (it needs a synthetic .app + clock
  # ordering). This block proves the copy-gate + D-04 sentinel are load-bearing AND free of
  # false-RED on the dist/ layer.
  local dist; dist="$(mktemp -d)"
  local rc=0

  # (1) Each COPY marker independently trips assert_no_keygen_strings. Use the SAME
  # literals the real patterns target (the planted '$9' price line carries the
  # distinctive adjacent copy; the key-field marker is the real masked-key placeholder).
  for marker in 'license.tinkerdev.io' 'tinkerdev.io/buy' 'price $9 once · lifetime license' 'I have a license key' 'XXXX-XXXX-XXXX-XXXX'; do
    printf 'clean\n' > "$dist/app.js"
    printf '%s\n' "$marker" > "$dist/planted.js"
    if assert_no_keygen_strings "$dist" >/dev/null 2>&1; then
      echo "SELFTEST FAIL: planted COPY marker '$marker' did NOT trip assert_no_keygen_strings" >&2; rc=1
    else
      echo "SELFTEST OK: '$marker' trips the copy gate"
    fi
  done

  # (2) BENIGN-PASS (Finding A): a bare 'Activate' string (mimicking AppearancePreviewStrip's
  # inert preview button) must NOT trip the copy gate — proves no false-RED on legit store UI.
  printf 'clean\n' > "$dist/app.js"
  printf '<button aria-hidden="true">Activate</button>\n' > "$dist/planted.js"
  if assert_no_keygen_strings "$dist" >/dev/null 2>&1; then
    echo "SELFTEST OK: benign 'Activate' button does NOT trip the copy gate (no false-RED)"
  else
    echo "SELFTEST FAIL: benign 'Activate' string FALSE-RED the copy gate (Finding A regression)" >&2; rc=1
  fi
  rm -f "$dist/planted.js"; printf 'clean\n' > "$dist/app.js"

  # (3a) BENIGN-PASS (Finding B): a clean sentinel {licenseUiInChunks:false} (a store build
  # where licenseUi is only behind the dead !IS_APPSTORE dynamic import) must PASS — proves the
  # D-04 check keys on the chunk-module fold-in inventory, not on any IPC literal (no false-RED).
  # The sentinel now ALSO carries the Phase-29 updater fields (updaterInChunks:false), which the
  # extended assert requires — a clean store build emits both groups absent.
  printf '{ "licenseUiInChunks": false, "hits": [], "updaterInChunks": false, "updaterHits": [] }\n' > "$dist/licenseui-inventory.json"
  if assert_no_license_ui_module "$dist" >/dev/null 2>&1; then
    echo "SELFTEST OK: clean sentinel (licenseUiInChunks:false + updaterInChunks:false) PASSES the check (no false-RED)"
  else
    echo "SELFTEST FAIL: clean sentinel FALSE-RED the check (Finding B regression)" >&2; rc=1
  fi

  # (3b) LOAD-BEARING (round-3 Finding): a fold-in sentinel {licenseUiInChunks:true}
  # (licenseUi folded into a chunk) MUST trip D-04 — the false-GREEN the Vite manifest missed.
  printf '{ "licenseUiInChunks": true, "hits": ["assets/main-abc.js: /abs/src/lib/license/licenseUi.ts"], "updaterInChunks": false, "updaterHits": [] }\n' > "$dist/licenseui-inventory.json"
  if assert_no_license_ui_module "$dist" >/dev/null 2>&1; then
    echo "SELFTEST FAIL: a fold-in sentinel (licenseUiInChunks:true) did NOT trip the D-04 check (check is vacuous — the false-GREEN survives)" >&2; rc=1
  else
    echo "SELFTEST OK: a fold-in sentinel (licenseUiInChunks:true) trips the D-04 check (load-bearing)"
  fi

  # (3b-updater) LOAD-BEARING (Phase 29): a sentinel with updaterInChunks:true (an updater UI
  # module folded into a chunk) MUST trip the check — even when licenseUi is clean. This is the
  # false-GREEN a menu://check-updates string grep / plugin-updater package-absence test misses.
  printf '{ "licenseUiInChunks": false, "hits": [], "updaterInChunks": true, "updaterHits": ["assets/main-abc.js: /abs/src/components/UpdaterOverlay.tsx"] }\n' > "$dist/licenseui-inventory.json"
  if assert_no_license_ui_module "$dist" >/dev/null 2>&1; then
    echo "SELFTEST FAIL: a fold-in sentinel (updaterInChunks:true) did NOT trip the check (the updater branch is vacuous)" >&2; rc=1
  else
    echo "SELFTEST OK: a fold-in sentinel (updaterInChunks:true) trips the check (load-bearing — updater UI)"
  fi

  # (3b-updater-missing) LOAD-BEARING (Phase 29): a sentinel MISSING the updaterInChunks field
  # (an OLD guard that did not record the updater inventory) MUST FAIL — the proof is absent.
  printf '{ "licenseUiInChunks": false, "hits": [] }\n' > "$dist/licenseui-inventory.json"
  if assert_no_license_ui_module "$dist" >/dev/null 2>&1; then
    echo "SELFTEST FAIL: a sentinel missing updaterInChunks did NOT trip the check (a stale guard could silently drop the updater inventory)" >&2; rc=1
  else
    echo "SELFTEST OK: a sentinel missing the updaterInChunks field trips the check (the extended guard must run)"
  fi

  # (3c) LOAD-BEARING: a MISSING sentinel MUST FAIL (the appstore generateBundle plugin
  # did not run → the D-04 proof is absent → block the release).
  rm -f "$dist/licenseui-inventory.json"
  if assert_no_license_ui_module "$dist" >/dev/null 2>&1; then
    echo "SELFTEST FAIL: a MISSING sentinel did NOT trip the D-04 check (the plugin could silently not-run)" >&2; rc=1
  else
    echo "SELFTEST OK: a missing sentinel trips the D-04 check (the appstore plugin must run)"
  fi

  rm -rf "$dist"

  # (4) FRESHNESS/LINKAGE non-vacuousness — assert_dist_freshness is the load-bearing guard
  # that makes the dist/-layer checks trustworthy. Prove it: a fresh/consistent dist+binary
  # PASSES; a stale dist/ (older than last source commit) FAILS; a dist/ newer than the binary
  # FAILS; a stale binary (older than last source commit) FAILS; missing/empty/sentinel-less
  # dist/ FAILS. We synthesise a fake .app skeleton + dist/ and drive mtimes with `touch -t`.
  selftest_dist_freshness || rc=1

  return "$rc"
}

# Build a throwaway .app skeleton (Info.plist + a MacOS/<bin>) under $1 so
# assert_dist_freshness / assert_binary_integrity have a CFBundleExecutable to resolve.
_make_fake_app() {
  local app="$1"; local binname="${2:-devtools-app}"
  mkdir -p "$app/Contents/MacOS"
  cat > "$app/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleExecutable</key><string>$binname</string>
</dict></plist>
PLIST
  printf '#!/bin/sh\n' > "$app/Contents/MacOS/$binname"
}

selftest_dist_freshness() {
  local rc=0
  local last_commit_epoch; last_commit_epoch="$(git log -1 --format=%ct 2>/dev/null)"
  if [[ -z "$last_commit_epoch" ]]; then
    echo "SELFTEST FAIL (freshness): could not read the last source commit time — cannot exercise the linkage guard" >&2
    return 1
  fi
  # Pick timestamps relative to the last commit: BEFORE it (stale) and AFTER it (fresh).
  # touch -t needs [[CC]YY]MMDDhhmm[.SS]; derive them from the commit epoch ± 1h.
  local before_ts after_ts newer_ts
  before_ts="$(date -r "$((last_commit_epoch - 3600))" +%Y%m%d%H%M.%S 2>/dev/null || date -d "@$((last_commit_epoch - 3600))" +%Y%m%d%H%M.%S)"
  after_ts="$(date -r "$((last_commit_epoch + 3600))" +%Y%m%d%H%M.%S 2>/dev/null || date -d "@$((last_commit_epoch + 3600))" +%Y%m%d%H%M.%S)"
  newer_ts="$(date -r "$((last_commit_epoch + 7200))" +%Y%m%d%H%M.%S 2>/dev/null || date -d "@$((last_commit_epoch + 7200))" +%Y%m%d%H%M.%S)"

  local base; base="$(mktemp -d)"

  # --- (a) FRESH + CONSISTENT → PASS: binary after commit; dist after commit but <= binary.
  local app="$base/fresh.app"; local dist="$base/fresh-dist"
  _make_fake_app "$app"; mkdir -p "$dist"
  printf 'clean\n' > "$dist/app.js"
  printf '{ "licenseUiInChunks": false, "hits": [] }\n' > "$dist/licenseui-inventory.json"
  touch -t "$after_ts" "$dist"/* 2>/dev/null
  touch -t "$newer_ts" "$app/Contents/MacOS/devtools-app" 2>/dev/null   # binary newest
  if assert_dist_freshness "$app" "$dist" >/dev/null 2>&1; then
    echo "SELFTEST OK (freshness): fresh + consistent dist/binary PASSES the linkage guard"
  else
    echo "SELFTEST FAIL (freshness): a fresh + consistent dist/binary FALSE-RED the linkage guard" >&2; rc=1
  fi

  # --- (b) STALE dist/ (older than last commit) → FAIL even though binary is fresh.
  local sd="$base/stale-dist.app"; local sdist="$base/stale-dist"
  _make_fake_app "$sd"; mkdir -p "$sdist"
  printf 'clean\n' > "$sdist/app.js"
  printf '{ "licenseUiInChunks": false, "hits": [] }\n' > "$sdist/licenseui-inventory.json"
  touch -t "$before_ts" "$sdist"/* 2>/dev/null                          # dist stale
  touch -t "$newer_ts" "$sd/Contents/MacOS/devtools-app" 2>/dev/null    # binary fresh
  if assert_dist_freshness "$sd" "$sdist" >/dev/null 2>&1; then
    echo "SELFTEST FAIL (freshness): a STALE dist/ (older than last commit) did NOT trip the linkage guard — a stale clean dist/ could mask a dirty binary" >&2; rc=1
  else
    echo "SELFTEST OK (freshness): a stale dist/ (older than last source commit) trips the linkage guard"
  fi

  # --- (c) dist/ NEWER than the binary → FAIL (dist rebuilt after the .app was signed).
  local nd="$base/newer-dist.app"; local ndist="$base/newer-dist"
  _make_fake_app "$nd"; mkdir -p "$ndist"
  printf 'clean\n' > "$ndist/app.js"
  printf '{ "licenseUiInChunks": false, "hits": [] }\n' > "$ndist/licenseui-inventory.json"
  touch -t "$after_ts" "$nd/Contents/MacOS/devtools-app" 2>/dev/null    # binary older
  touch -t "$newer_ts" "$ndist"/* 2>/dev/null                          # dist newer
  if assert_dist_freshness "$nd" "$ndist" >/dev/null 2>&1; then
    echo "SELFTEST FAIL (freshness): a dist/ NEWER than the binary did NOT trip the linkage guard — the binary embeds older bytes than the ones grepped" >&2; rc=1
  else
    echo "SELFTEST OK (freshness): a dist/ newer than the signed binary trips the linkage guard"
  fi

  # --- (d) STALE binary (older than last source commit) → FAIL (stale .app handed off).
  local sb="$base/stale-bin.app"; local sbdist="$base/stale-bin-dist"
  _make_fake_app "$sb"; mkdir -p "$sbdist"
  printf 'clean\n' > "$sbdist/app.js"
  printf '{ "licenseUiInChunks": false, "hits": [] }\n' > "$sbdist/licenseui-inventory.json"
  touch -t "$after_ts" "$sbdist"/* 2>/dev/null
  touch -t "$before_ts" "$sb/Contents/MacOS/devtools-app" 2>/dev/null   # binary stale
  if assert_dist_freshness "$sb" "$sbdist" >/dev/null 2>&1; then
    echo "SELFTEST FAIL (freshness): a STALE binary (older than last commit) did NOT trip the linkage guard — a stale .app could be handed off" >&2; rc=1
  else
    echo "SELFTEST OK (freshness): a stale binary (older than last source commit) trips the linkage guard"
  fi

  # --- (e) MISSING / EMPTY / sentinel-less dist/ → FAIL (never SKIP, never vacuous).
  local md="$base/missing-dist.app"
  _make_fake_app "$md"; touch -t "$newer_ts" "$md/Contents/MacOS/devtools-app" 2>/dev/null
  if assert_dist_freshness "$md" "$base/does-not-exist" >/dev/null 2>&1; then
    echo "SELFTEST FAIL (freshness): a MISSING dist/ did NOT trip the linkage guard" >&2; rc=1
  else
    echo "SELFTEST OK (freshness): a missing dist/ trips the linkage guard"
  fi
  local edist="$base/empty-dist"; mkdir -p "$edist"
  if assert_dist_freshness "$md" "$edist" >/dev/null 2>&1; then
    echo "SELFTEST FAIL (freshness): an EMPTY dist/ did NOT trip the linkage guard" >&2; rc=1
  else
    echo "SELFTEST OK (freshness): an empty dist/ trips the linkage guard"
  fi
  local nsdist="$base/no-sentinel-dist"; mkdir -p "$nsdist"
  printf 'clean\n' > "$nsdist/app.js"; touch -t "$after_ts" "$nsdist"/* 2>/dev/null
  if assert_dist_freshness "$md" "$nsdist" >/dev/null 2>&1; then
    echo "SELFTEST FAIL (freshness): a sentinel-LESS dist/ did NOT trip the linkage guard" >&2; rc=1
  else
    echo "SELFTEST OK (freshness): a sentinel-less dist/ trips the linkage guard"
  fi

  rm -rf "$base"; return "$rc"
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

  # === Phase 29: exercise the NEW updater-UI branch of the SAME shared guard ===
  # Stand-in updater UI modules at regex-matching paths. We deliberately include a
  # StoreUpdatesSettings.tsx stand-in to prove it is NOT false-matched by the
  # /UpdatesSettings\.[tj]sx?$/ regex (the store Updates pane legitimately ships).
  mkdir -p "$tmp/src/components"
  printf 'export const updaterOverlayStandin = 7;\n' > "$tmp/src/components/UpdaterOverlay.tsx"
  printf 'export const storeUpdatesStandin = 9;\n' > "$tmp/src/components/StoreUpdatesSettings.tsx"

  # --- UPDATER FOLD-IN fixture: static import of an updater UI module → MUST FAIL ---
  local ufold="$tmp/ufold"; mkdir -p "$ufold"
  printf 'import { updaterOverlayStandin } from "../src/components/UpdaterOverlay.tsx";\nconsole.log(updaterOverlayStandin);\n' > "$ufold/entry.js"
  if node --input-type=module -e "
    import { build } from 'vite';
    import { licenseUiFoldInGuard } from '$guard';
    await build({ root: '$tmp', logLevel: 'silent', plugins: [licenseUiFoldInGuard()], build: { outDir: '$ufold/out', emptyOutDir: true, lib: { entry: '$ufold/entry.js', formats: ['es'], fileName: 'ufold' } } });
  " >/dev/null 2>&1; then
    echo "SELFTEST FAIL (realbuild): a STATIC UpdaterOverlay import folded into the entry chunk did NOT fail the appstore build (the production guard is not catching the updater fold-in case)" >&2; rc=1
  else
    echo "SELFTEST OK (realbuild): a real updater-UI fold-in fixture FAILS the appstore build (production guard caught chunk.modules fold-in)"
  fi

  # --- UPDATER CLEAN fixture: a StoreUpdatesSettings import (legitimately ships) + a dead
  # dynamic import of an updater UI module → MUST PASS, sentinel updaterInChunks:false.
  # Folding StoreUpdatesSettings into the entry chunk proves the regex does NOT false-match it.
  local uclean="$tmp/uclean"; mkdir -p "$uclean"
  printf 'import { storeUpdatesStandin } from "../src/components/StoreUpdatesSettings.tsx";\nconsole.log(storeUpdatesStandin);\nif (false) { import("../src/components/UpdaterOverlay.tsx").then(() => {}); }\n' > "$uclean/entry.js"
  if node --input-type=module -e "
    import { build } from 'vite';
    import { licenseUiFoldInGuard } from '$guard';
    await build({ root: '$tmp', logLevel: 'silent', plugins: [licenseUiFoldInGuard()], build: { outDir: '$uclean/out', emptyOutDir: true, lib: { entry: '$uclean/entry.js', formats: ['es'], fileName: 'uclean' } } });
  " >/dev/null 2>&1; then
    if grep -E '"updaterInChunks"[[:space:]]*:[[:space:]]*false' "$uclean/out/licenseui-inventory.json" >/dev/null 2>&1; then
      echo "SELFTEST OK (realbuild): a clean updater fixture (StoreUpdatesSettings folded in + dead UpdaterOverlay import) PASSES + sentinel updaterInChunks:false (StoreUpdatesSettings NOT false-matched)"
    else
      echo "SELFTEST FAIL (realbuild): clean updater fixture built but the sentinel did not report updaterInChunks:false (StoreUpdatesSettings may have been false-matched, or the guard did not record the updater inventory)" >&2
      [[ -f "$uclean/out/licenseui-inventory.json" ]] && sed 's/^/    /' "$uclean/out/licenseui-inventory.json" >&2
      rc=1
    fi
  else
    echo "SELFTEST FAIL (realbuild): a clean updater fixture (StoreUpdatesSettings + dead UpdaterOverlay import) FAILED the build (false-RED — StoreUpdatesSettings.tsx was wrongly matched by an UPDATER_MODULES regex)" >&2; rc=1
  fi

  rm -rf "$tmp"; return "$rc"
}

# Default honors CARGO_TARGET_DIR (set absolute by build.sh per-channel; unset = the legacy
# literal, byte-for-byte unchanged). In-flow callers pass an explicit "$APP_OUT" (case *) below)
# which always wins; this default only matters for a bare standalone run.
APP="${CARGO_TARGET_DIR:-src-tauri/target/appstore}/universal-apple-darwin/release/bundle/macos/TinkerDev.app"
# OPTION A: the appstore frontend output (frontendDist "../dist"), produced by the build's
# beforeBuildCommand in the SAME invocation that signs the .app — the authoritative
# pre-compression bytes Tauri embeds. This is where the D-03 copy grep + D-04 sentinel read.
DIST="dist"
REQUIRE_BUNDLE=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    # The gate's own correctness is provable WITHOUT a signed bundle: --selftest runs
    # the pure-shell planted-string + benign-PASS + freshness/linkage fixtures;
    # --selftest-realbuild runs the MANDATORY automated real-Vite fold-in build
    # (exercising the EXACT production guard). Each exits with its own rc so CI /
    # the Task-2 verify can gate on them.
    --selftest) selftest_forbidden_gate; exit $? ;;
    --selftest-realbuild) selftest_foldin_realbuild; exit $? ;;
    --require-bundle) REQUIRE_BUNDLE=1 ;;
    --dist) shift; DIST="${1:?--dist needs a directory argument}" ;;
    --dist=*) DIST="${1#--dist=}" ;;
    *) APP="$1" ;;
  esac
  shift
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
  # Binary-level checks — on the SIGNED .app (entitlements, 13.0 floor, universal archs,
  # embedded profile, valid deep signature). All FATAL (Finding 2).
  assert_entitlements_present "$APP" || rc=1
  assert_min_system_version "$APP" || rc=1
  assert_binary_integrity "$APP" || rc=1
  # FRESHNESS/LINKAGE (OPTION A) — bind the inspected dist/ to the signed binary BEFORE the
  # content checks read dist/, so a stale clean dist/ cannot mask a dirty/stale .app. FATAL.
  assert_dist_freshness "$APP" "$DIST" || rc=1
  # MAS-BUILD-04 + D-04 — read the appstore-build dist/ (the pre-compression bytes Tauri
  # embeds verbatim into the binary), NOT $APP/Contents/Resources/ (which holds only icon.icns
  # for this Tauri 2 brotli-embed build). Both FATAL when a bundle is present (Finding 2):
  #   the four-COPY-marker Keygen grep, and the chunk-module-inventory sentinel check.
  assert_no_keygen_strings "$DIST" || rc=1
  assert_no_license_ui_module "$DIST" || rc=1
  # PRT-02 (Phase 32) — the heavy prettify/minify engines must not be initially-reachable
  # from an entry chunk (dynamic import() only). Reads the prettier-chunk-inventory.json
  # sentinel emitted by the UNGATED prettierChunkGuard, bound by the SAME assert_dist_freshness
  # above. FATAL when a bundle is present (Finding 2).
  assert_no_heavy_engine_in_entry "$DIST" || rc=1
elif [[ "$REQUIRE_BUNDLE" -eq 1 ]]; then
  echo "FAIL: --require-bundle set but no signed .app at '$APP' — the canonical build did not produce a bundle" >&2
  rc=1
else
  echo "SKIP: signed .app not present at '$APP' — entitlements + 13.0-floor + dist/-layer D-03/D-04 checks are the local human gate after 'pnpm tauri:build:appstore' (dev cert + dev.provisionprofile required, machine-specific)"
fi

if [[ "$rc" -ne 0 ]]; then
  echo "verify-appstore-bundle: FAIL" >&2
  exit 1
fi
echo "verify-appstore-bundle: OK"
