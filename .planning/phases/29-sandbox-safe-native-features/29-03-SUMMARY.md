---
phase: 29-sandbox-safe-native-features
plan: 03
subsystem: appstore-build-verify
tags: [appstore, sandbox, verify-script, human-gate, entitlement-audit, updater-surface, chunk-module-guard]
status: paused-at-human-checkpoint
requires: ["29-01", "29-02"]
provides:
  - "extended shared chunk-module guard (updater UI subtree forbidden in store chunks)"
  - "verify-appstore-bundle.sh FATALs: keyring/autostart cargo-tree + no-keychain-access-groups entitlement + updaterInChunks:false sentinel"
affects:
  - "scripts/licenseUiFoldInGuard.mjs (also imported by vite.config.ts production appstore build)"
  - "scripts/verify-appstore-bundle.sh"
tech-stack:
  added: []
  patterns:
    - "the licenseUi chunk.modules fold-in idiom generalised to a second forbidden module group (updater UI) emitted into the SAME sentinel"
    - "structural-not-string proof: chunk-MODULE inventory + runtime no-invoke, never a package/string-presence test (keygen-compileout-d04-proof, D-05)"
key-files:
  created:
    - .planning/phases/29-sandbox-safe-native-features/29-03-SUMMARY.md
  modified:
    - scripts/licenseUiFoldInGuard.mjs
    - scripts/verify-appstore-bundle.sh
decisions:
  - "updater UI modules inventoried via chunk.modules (NOT @tauri-apps/plugin-updater package — it rides along inert via the shared tauri.ts seam per D-05, like plugin-autostart)"
  - "folded the updaterInChunks:false assertion INTO assert_no_license_ui_module (same sentinel, same presence guard) rather than a sibling function — lowest churn, reuses the exact root-sentinel + duplicate-rejection discipline"
  - "kept the licenseUiFoldInGuard() export name so vite.config.ts + the realbuild self-test stay byte-unchanged"
metrics:
  duration: "~25min"
  completed: "2026-06-24"
  tasks_total: 2
  tasks_done: 1
---

# Phase 29 Plan 03: Sandbox-Safe Native Features — Signed-Bundle Gate Summary

**One-liner:** Extended the shared chunk-module fold-in guard to ALSO inventory the updater UI subtree (UpdaterOverlay → useUpdater → shell/update → UpdateBanner, + the direct-only UpdatesSettings pane) and emit `updaterInChunks` into the same sentinel, and extended `verify-appstore-bundle.sh` with three additive FATAL gates (keyring/autostart cargo-tree absence, no `keychain-access-groups` entitlement, `updaterInChunks:false` sentinel). **Task 1 (auto) is DONE and committed; Task 2 is the BLOCKING human signed-build walkthrough — NOT yet run.**

## Status

- **Task 1 — DONE** (`b2ab996f`). The shared guard + verify script extensions landed; both self-tests exit 0.
- **Task 2 — PENDING the human gate.** This plan is PAUSED at the `checkpoint:human-verify gate="blocking"`. The binding harness (`/simplify` → `/code-review xhigh` → `/codex:adversarial-review`), the `pnpm tauri:build:appstore` bundle build, the `--require-bundle` run against the fresh signed bundle, and the four D-09 human checks are all orchestrator/human-owned at the phase boundary. **The plan is NOT complete.**

## What Was Built (Task 1)

### A. `scripts/licenseUiFoldInGuard.mjs` — updater UI module inventory
- Added `export const UPDATER_MODULES` — five end-anchored regexes for the updater UI module IDs:
  `src/shell/update.[tj]sx?$`, `src/shell/useUpdater.[tj]sx?$`, `src/components/UpdateBanner.[tj]sx?$`, `src/components/UpdaterOverlay.[tj]sx?$`, `src/components/UpdatesSettings.[tj]sx?$`.
- The `[tj]sx?$` end-anchor means `UpdatesSettings.tsx` (direct-only pane) matches but `StoreUpdatesSettings.tsx` (the store pane that legitimately ships) does NOT — proven by a dedicated realbuild fixture.
- In the SAME `generateBundle` loop, collects `updaterHits` alongside `hits`; emits `{ licenseUiInChunks, hits, updaterInChunks, updaterHits }` into `licenseui-inventory.json`; throws on EITHER fold-in.
- **Deliberately excludes** `@tauri-apps/plugin-updater` — a doc-comment cites the rationale: tauri.ts imports it at top level (line 21) and index.ts loads tauri.ts via one shared dynamic import, so the inert plugin JS rides along via the shared seam regardless (D-05, exactly like plugin-autostart). Asserting its package absence is unsatisfiable and would FALSE-RED every real store build. The load-bearing proof is (1) UI modules absent from chunks + (2) the 29-02 runtime `platform.updater.check === 0` boot-path assertion.
- The `licenseUiFoldInGuard()` export name is unchanged, so vite.config.ts (`...(isAppstoreBuild ? [licenseUiFoldInGuard()] : [])`) and the realbuild self-test both stay byte-unchanged.

### B. `scripts/verify-appstore-bundle.sh` — three additive FATAL checks
1. **keyring absence** (`assert_plugins_absent`): a second grep over the same `cargo tree --no-default-features --features appstore` for `^[^a-zA-Z]*keyring v` (NOT a `tauri-plugin-`, so the updater|autostart|process alternation misses it). FATAL if present.
2. **no keychain-access-groups** (`assert_entitlements_present`): after the positive app-sandbox + network.client loop, a negative `grep -qF 'keychain-access-groups'` over the entitlements XML. FATAL if present.
3. **no updater UI modules in store chunks** (folded into `assert_no_license_ui_module`): reads the SAME root sentinel; FATALs on `updaterInChunks:true` OR a missing `updaterInChunks:false` field — mirroring the existing licenseUi true/malformed discipline. Folded in rather than added as a sibling because it shares the exact sentinel-at-root + duplicate-rejection guard already in that function and the main run block already wires it after the presence check.
4. Top doc-comment extended with the Phase-29 (g)/(h)/(i) checks, noting plugin-updater is deliberately NOT package-asserted (D-05 shared seam).
5. **Both self-tests extended:**
   - `selftest_forbidden_gate`: clean sentinels now carry `updaterInChunks:false`/`updaterHits:[]` (so the now-required field doesn't false-RED the licenseUi cases); added a planted `updaterInChunks:true` case (MUST trip), an `updaterInChunks:true` with clean licenseUi (proves the updater branch is independent), and a missing-`updaterInChunks` case (MUST trip — a stale guard that dropped the inventory).
   - `selftest_foldin_realbuild`: added an UpdaterOverlay static-import fold-in fixture (build MUST FAIL) + a clean fixture that statically folds `StoreUpdatesSettings.tsx` into the entry chunk AND dead-dynamic-imports UpdaterOverlay (build MUST PASS with `updaterInChunks:false` — proving StoreUpdatesSettings is NOT false-matched). Imports the SAME shared guard.

## Verification (Task 1)

- `bash scripts/verify-appstore-bundle.sh --selftest` → rc 0 (all licenseUi + new updater planted-true/clean-false/missing-field cases + freshness block).
- `bash scripts/verify-appstore-bundle.sh --selftest-realbuild` → rc 0 (licenseUi fold-in fails + clean passes; updater UI fold-in fails + clean passes; StoreUpdatesSettings NOT false-matched).
- Acceptance greps: `keyring`=11, `keychain-access-groups`=7, `updaterInChunks`=20 (sh); `UpdaterOverlay|useUpdater`=3, `updaterInChunks`=3 (mjs); structural `UPDATER_MODULES` has no `plugin-updater` (node check rc 0).
- `cargo tree --no-default-features --features appstore | grep -E 'keyring v|autostart'` → EMPTY (the assertions' premise holds — 29-01 landed).
- Full lefthook GREEN on the commit: **vitest 1274/1274**, tsc clean, 4 pre-existing SidebarResetMenu/settingsPanes eslint warnings (out of scope).
- `git diff --stat src/lib/protobuf/` empty (decoder + 19 tests untouched — this plan touched only `scripts/`).

**Note on the no-bundle local run:** a stale 28-05 `.app` + `dist/licenseui-inventory.json` (emitted by the OLD pre-extension guard, no `updaterInChunks` field) are present locally, so the bundle-level checks ran and the new `updaterInChunks:false` assertion correctly FAILed against the stale sentinel. This is the gate working as designed — it demands a rebuild with the extended guard. That rebuild is the orchestrator's `pnpm tauri:build:appstore` at the phase boundary (Task 2), not a Task-1 defect. The `OK: keyring … ABSENT` and `OK: NO keychain-access-groups` lines both print.

## Deviations from Plan

None — Task 1 executed exactly as written (no Rule 1-4 deviations). The single design choice left to planner discretion (D-09: fold the updater assertion into `assert_no_license_ui_module` vs a sibling function) was resolved as the in-place fold for lowest churn.

## Pending — Task 2 (BLOCKING human-verify checkpoint)

The orchestrator runs the binding harness + builds the signed sandboxed bundle LAST, then the human verifies the four D-09 checks on the dev-signed sandboxed `.app`:
1. **Summon over a real OS chord** (MAS-NATIVE-01) — global hotkey reveals + focuses the window under sandbox.
2. **Tray reveal + menu, NO updates item, NO updater UI** (MAS-NATIVE-02) — tray menu is EXACTLY Show / Settings… / Quit (no "Check for Updates…"); no first-run updater opt-in prompt / UpdateBanner; no updater `MissingEntitlement`/plugin-not-found in Console.
3. **Entitlement + MissingEntitlement audit** (MAS-NATIVE-03) — `codesign -d --entitlements` shows app-sandbox + network.client, NO `keychain-access-groups`; a Pro action produces no runtime MissingEntitlement / Keychain error in Console.
4. **Launch-at-login absent** (MAS-NATIVE-04) — Settings ▸ General has no Launch-at-login toggle; `cargo tree --no-default-features --features appstore | grep -E 'autostart|keyring'` empty.

Resume signal: human types "approved" once all four pass (or describes the failing check).

## Self-Check: PASSED

- `scripts/licenseUiFoldInGuard.mjs` — FOUND (modified)
- `scripts/verify-appstore-bundle.sh` — FOUND (modified)
- `.planning/phases/29-sandbox-safe-native-features/29-03-SUMMARY.md` — FOUND (created)
- Commit `b2ab996f` — present in git log
