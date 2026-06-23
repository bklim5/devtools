---
phase: 27-build-variant-seam
reviewed: 2026-06-23T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - package.json
  - scripts/build-and-publish.mjs
  - scripts/build-appstore-bundle.sh
  - scripts/build-appstore-spike.sh
  - scripts/verify-appstore-bundle.sh
  - src-tauri/Cargo.toml
  - src-tauri/capabilities/default.json
  - src-tauri/src/lib.rs
  - src-tauri/tauri.appstore.conf.json
  - src-tauri/tauri.direct.conf.json
  - src/lib/platform/channel.test.ts
  - src/lib/platform/channel.ts
  - src/vite-env.d.ts
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 27: Code Review Report

**Reviewed:** 2026-06-23
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Reviewed the direct-vs-appstore build-variant seam: Cargo feature wiring
(`default=["direct"]`, optional `updater`/`autostart`/`process` deps, `appstore`
gating iap), the two Tauri config overlays, the `direct-native` capability that
re-grants permissions stripped from the globbed `default.json`, the canonical
appstore build/verify scripts, and the `IS_APPSTORE`/`VITE_CHANNEL` channel
constant.

The seam is largely sound and the threat-model reasoning in the comments is
strong. The compile-out story (`--no-default-features --features appstore` drops
`direct`, which drops all three direct-only plugins) is correctly wired, the
freshness-marker guard against false-GREEN stale bundles is a genuine
improvement over a bare existence check, and the channel constant tree-shakes
correctly.

The findings below are gaps in the verification net rather than broken
primary-path logic. The most important: the appstore compliance gate proves
`updater` + `autostart` absent but NOT `process` — even though `process` is a
`direct`-feature plugin that must also be absent from the sandbox build. Two
secondary issues concern the freshness guard's hardcoded binary path and the
appstore overlay's reliance on env-only signing identity.

No Critical (security / data-loss / crash) issues found. No hardcoded secrets;
all subprocess calls in `build-and-publish.mjs` use `execFileSync` argv arrays;
the capability grants are narrowly scoped.

## Warnings

### WR-01: Appstore compliance gate does not assert `tauri-plugin-process` absent

**File:** `scripts/verify-appstore-bundle.sh:41`
**Issue:** `direct = ["dep:tauri-plugin-updater", "dep:tauri-plugin-autostart", "dep:tauri-plugin-process"]` (Cargo.toml:120). All three are direct-only and must be compiled OUT of the appstore build. But `assert_plugins_absent` only greps for `tauri-plugin-(updater|autostart)`:
```bash
found="$(printf '%s\n' "$tree" | grep -E 'tauri-plugin-(updater|autostart)' || true)"
```
If a future edit accidentally moved `tauri-plugin-process` onto the `appstore` feature (or made it non-optional), the gate would pass GREEN while the sandbox build links the relaunch backend — exactly the class of half-variant regression this script exists to catch. The script's own header claims it asserts "updater + autostart compiled out" but the binding contract is "every `direct`-only plugin out."
**Fix:** Add `process` to the forbidden set so the assertion matches the full `direct` feature list:
```bash
found="$(printf '%s\n' "$tree" | grep -E 'tauri-plugin-(updater|autostart|process)' || true)"
```
(Update the OK message and header comment to match.)

### WR-02: Freshness-guard binary path is hardcoded `devtools-app`, defeating the rename-proofing applied elsewhere

**File:** `scripts/build-appstore-bundle.sh:131` (also `:154` and spike `:113`)
**Issue:** The freshness guard hardcodes the inner Mach-O name:
```bash
if [[ ! "$APP_OUT/Contents/MacOS/devtools-app" -nt "$BUILD_MARKER" ]]; then
```
`build-and-publish.mjs` deliberately DERIVES this name (`readMainBinaryName()`, comment at :81-87 documents the "TinkerDev-rename bug" where a hardcoded inner path kept verifying a stale bundle). The appstore script reintroduces exactly that hardcoded coupling. Today the Cargo crate name is `devtools-app` so it works, but a future crate rename (or adding `mainBinaryName` to tauri.conf) silently breaks the guard: `[[ ! <nonexistent-path> -nt marker ]]` is true (a missing file is never newer), so the script would `exit 1` claiming a STALE bundle even on a fresh successful build — a confusing false-FAIL. The `$APP_OUT` itself already derives `TinkerDev.app` from a hardcoded literal too (`:49`), so the bundle name and binary name are both pinned by hand.
**Fix:** Derive the binary name once (mirror `build-and-publish.mjs`), e.g.:
```bash
APP_BIN_NAME="$(awk -F'"' '/^name *= *"/{print $2; exit}' src-tauri/Cargo.toml)"
APP_BIN="$APP_OUT/Contents/MacOS/$APP_BIN_NAME"
```
then reuse `$APP_BIN` in the freshness guard and the `[archs]` verify block. At minimum, add a guard that the binary path exists before the `-nt` test so a rename surfaces as an explicit "binary not found at <path>" error rather than a misleading "STALE" message.

### WR-03: Appstore overlay omits `signingIdentity`; the canonical signing path depends entirely on an env var the script must remember to export

**File:** `src-tauri/tauri.appstore.conf.json:6-10`
**Issue:** The overlay sets `entitlements`, `hardenedRuntime:false`, `minimumSystemVersion`, but NOT `signingIdentity`. Deep-merged over the base, `bundle.macOS.signingIdentity` stays `"-"` (ad-hoc). The build only signs with the dev identity because `build-appstore-bundle.sh:86` exports `APPLE_SIGNING_IDENTITY`. The superseded spike script (`build-appstore-spike.sh:90`) put `signingIdentity` directly in its inline `--config`; the promoted committed overlay dropped it. This is defensible (the dev identity is machine-specific and gitignored — comment at script :83-85 explains it), but it means: (a) anyone running `pnpm tauri build --config src-tauri/tauri.appstore.conf.json` directly (without the wrapper script) gets a silently ad-hoc-signed bundle that will fail to launch with the appstore entitlements; (b) the seam's "signing" half lives in bash, not in the committed config, so it is invisible to anyone reading the overlay.
**Fix:** No code change strictly required if the only supported entry point is `pnpm tauri:build:appstore`. Recommend a one-line header comment in `tauri.appstore.conf.json` stating that `signingIdentity` is intentionally injected via `APPLE_SIGNING_IDENTITY` by `build-appstore-bundle.sh` and that the overlay must NOT be used standalone — so the env dependency is documented at the config, not only in the script.

## Info

### IN-01: `|| true` after `pnpm tauri build` masks every build failure mode, not just the documented "absent updater key"

**File:** `scripts/build-appstore-bundle.sh:118` (also spike `:90`)
**Issue:** `... -- --no-default-features || true` swallows ALL non-zero exits. The comment justifies it as "the final tauri-build exit can be non-zero ONLY for the absent updater key — now moot since updater is compiled out." Since the updater is compiled out, the original justification no longer applies, yet the `|| true` remains and now masks genuine compile/link failures. The freshness guard (`:131`) does catch the case where no fresh binary was produced, so this does not produce a false-GREEN — but it does discard the build's real exit code, making genuine failures harder to diagnose (the only signal is "STALE bundle"). Mitigated by the freshness guard; flagged because the masking is now broader than its stated rationale.
**Fix:** Consider capturing the exit code (`pnpm tauri build ... || build_rc=$?`) and surfacing it in the guard's error message, or drop `|| true` entirely now that the updater-key non-zero exit is moot for the appstore variant.

### IN-02: `/tmp/_cs_verify.txt` is a fixed, world-readable path (predictable temp file)

**File:** `scripts/build-appstore-bundle.sh:168` (also spike `:127`)
**Issue:** The deep-verify step writes to a fixed `/tmp/_cs_verify.txt`. On a shared/multi-user macOS host this is a predictable path another user could pre-create or symlink. Low severity (it is codesign verify output, not a secret; macOS `/tmp` is per-boot and typically single-user dev machines), but inconsistent with the `mktemp` discipline already used for `$BUILD_MARKER` at :94.
**Fix:** Use `mktemp` for this file too and add it to the EXIT trap cleanup alongside `$BUILD_MARKER`.

### IN-03: `[deep verify]` block reports `exit $?` after the `if` already consumed the status

**File:** `scripts/build-appstore-bundle.sh:171` (also spike `:130`)
**Issue:** In the `else` branch, `echo "  signature NOT consistent (exit $?)"` — but `$?` at that point is the exit status of the preceding `if` condition's redirection/test chain as re-evaluated, not reliably the `codesign --verify` exit code (the `if` consumed it, and the intervening `>/tmp/...` redirection plus branch entry can reset `$?`). The reported number is likely to be `0` or otherwise misleading. Cosmetic (the diagnostic `sed` of the captured file below it is the real signal), but the printed exit code is untrustworthy.
**Fix:** Capture the status explicitly: `if codesign ...; then ...; else rc_cs=$?; echo "... (exit $rc_cs)"; fi` — or drop the `(exit $?)` text since the captured file is shown anyway.

### IN-04: Two near-identical appstore build scripts now coexist (spike + canonical), risking drift

**File:** `scripts/build-appstore-spike.sh:1-2` and `scripts/build-appstore-bundle.sh`
**Issue:** `build-appstore-spike.sh` is marked SUPERSEDED but retained "for Phase-26 doc references." It duplicates ~90% of the canonical script (preflight, env scrub, embed, re-sign, verify) but lacks the freshness guard (WR-02), the FATAL compliance self-verify, and uses an inline `--config` instead of the committed overlay. Keeping a known-weaker copy of a security-sensitive build path invites someone running the stale one. The diff to this file in this phase is a single line (the SUPERSEDED banner), so it is intentionally frozen — flagged only so the drift risk is on record.
**Fix:** If Phase-26 docs only need the prose, consider moving the spike's explanatory content into the doc and deleting the executable script, or add a hard `exit 1` guard at the top of the spike directing callers to `pnpm tauri:build:appstore`.

---

_Reviewed: 2026-06-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
