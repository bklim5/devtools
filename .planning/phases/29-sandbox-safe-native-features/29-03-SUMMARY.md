---
phase: 29-sandbox-safe-native-features
plan: 03
subsystem: appstore-build-verify
tags: [appstore, sandbox, verify-script, human-gate, entitlement-audit, updater-surface, chunk-module-guard]
status: complete
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
  duration: "~25min (Task 1) + phase-boundary harness/build/human gate"
  completed: "2026-06-24"
  tasks_total: 2
  tasks_done: 2
---

# Phase 29 Plan 03: Sandbox-Safe Native Features — Signed-Bundle Gate Summary

**One-liner:** Extended the shared chunk-module fold-in guard to ALSO inventory the updater UI subtree (UpdaterOverlay → useUpdater → shell/update → UpdateBanner, + the direct-only UpdatesSettings pane) and emit `updaterInChunks` into the same sentinel, and extended `verify-appstore-bundle.sh` with three additive FATAL gates (keyring/autostart cargo-tree absence, no `keychain-access-groups` entitlement, `updaterInChunks:false` sentinel). **Task 1 (auto) DONE; Task 2 (BLOCKING human signed-build walkthrough) APPROVED — all four D-09 checks passed on the dev-signed sandboxed `.app`. Plan COMPLETE.**

## Status

- **Task 1 — DONE** (`b2ab996f`). The shared guard + verify script extensions landed; both self-tests exit 0.
- **Task 2 — APPROVED / COMPLETE.** The orchestrator ran the binding harness on the full phase working tree (landing three additional fix commits — see below), built the signed sandboxed bundle LAST, ran `verify-appstore-bundle.sh --require-bundle` (all OK), then the human verified all four D-09 checks on the dev-signed sandboxed `.app`. **HUMAN GATE APPROVED 2026-06-24.** The plan is COMPLETE.

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

## Task 2 — Signed-Build Gate: APPROVED (phase-boundary, human-owned)

### Phase-boundary harness fixes (orchestrator, AFTER Task 1, on the full phase working tree)

The binding harness (`/simplify` → `/code-review xhigh` → `/codex:adversarial-review --wait --scope working-tree`) over the landed 29-01+29-02+29-03 source landed three additional fix commits before the bundle build:
- `1ee477d8` — fix(29): gate the direct `invoke_handler` arms on `feature=direct` to match the license module (code-review finding — the direct-only command arms must compile out under appstore alongside the gated license module).
- `4efe3ef4` — fix(29): `compile_error!` guard for a direct+appstore feature overlap (Codex adversarial-review [high] finding — fail the build loudly if both features are ever enabled together rather than silently mis-linking).
- `d1c01a98` — refactor(29): drop the redundant `!IS_APPSTORE` guard at the `UpdaterOverlay` mount (`/simplify` — the lazy import is already `IS_APPSTORE ? null : lazy(...)`, so the extra runtime guard was dead).

### Build + automated verify (signed bundle, built LAST)

- `pnpm tauri:build:appstore` produced the signed universal appstore bundle at `src-tauri/target/universal-apple-darwin/release/bundle/macos/TinkerDev.app` — signed "Apple Development: Boon Khai Lim (9HGDC8C599)", embedded `.provisionprofile`, deep signature valid, universal x86_64 + arm64. Bundle binary mtime `1782295623` > last source commit `4efe3ef4` (`1782295535`) — NOT stale (harness freshness rule satisfied).
- `verify-appstore-bundle.sh --require-bundle` on the fresh bundle: exit 0, ALL OK — including the new Phase-29 lines `keyring (Keychain crate) ABSENT`, `NO keychain-access-groups entitlement`, `updater UI subtree … ABSENT from every store chunk`. Independent `codesign` entitlement audit: `app-sandbox` + `network.client` + `application-identifier` + `team-identifier` ONLY (`keychain-access-groups` count 0). `cargo tree --no-default-features --features appstore` clean of autostart + keyring.

### Four D-09 human checks — ALL PASSED on the dev-signed sandboxed `.app`

1. **Summon over a real OS chord (MAS-NATIVE-01)** — the global summon hotkey revealed + focused the window over a real OS chord under sandbox (the `RegisterEventHotKey` path + the window-mutation capability hold under the appstore capability set).
2. **Tray reveal + menu, NO updates item, NO updater UI (MAS-NATIVE-02)** — the tray menu was EXACTLY Show / Settings… / Quit (no "Check for Updates…" item); no first-run updater opt-in prompt; no `UpdateBanner`; no updater `MissingEntitlement`/plugin-not-found Console error on exercising the tray.
3. **Entitlement + MissingEntitlement audit (MAS-NATIVE-03)** — `codesign -d --entitlements` clean (app-sandbox + network.client, NO `keychain-access-groups`); exercising a Pro feature produced no runtime `MissingEntitlement` / Keychain error in Console.
4. **Launch-at-login absent (MAS-NATIVE-04)** — Settings ▸ General has no Launch-at-login toggle; `cargo tree --no-default-features --features appstore | grep -E 'autostart|keyring'` empty.

### Console crash reports — investigated, DISMISSED as unrelated

The human noted two crash reports in Console. Investigated and dismissed: they are a STALE cargo unit-test binary (`devtools_app_lib-<hash>` in `target/debug`, parented by cargo, dated 2026-06-22) hitting the known swift-rs `@rpath/libswift_Concurrency.dylib` issue already fixed in `build.rs:15`. The signed RELEASE bundle carries `LC_RPATH /usr/lib/swift` and loads the Swift runtime fine (it launched + passed all four checks). NOT the `.app` under test, NOT a Phase-29 regression.

## Self-Check: PASSED

- `scripts/licenseUiFoldInGuard.mjs` — FOUND (modified)
- `scripts/verify-appstore-bundle.sh` — FOUND (modified)
- `.planning/phases/29-sandbox-safe-native-features/29-03-SUMMARY.md` — FOUND (created)
- Signed bundle `src-tauri/target/universal-apple-darwin/release/bundle/macos/TinkerDev.app` — FOUND (mtime 1782295623 > last source commit 4efe3ef4)
- Commit `b2ab996f` (Task 1 feat) — present in git log
- Commit `ebbb9af0` (Task 1 docs) — present in git log
- Commits `1ee477d8`, `4efe3ef4`, `d1c01a98` (phase-boundary harness fixes) — present in git log
