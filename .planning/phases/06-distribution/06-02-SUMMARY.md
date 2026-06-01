---
phase: 06-distribution
plan: 02
subsystem: platform-seam + prefs
tags: [updater, platform-seam, preferences, tdd, distribution]
dependency_graph:
  requires:
    - "src/lib/platform/ seam (clipboard/store/window/nativeShortcut getter pattern, Phase 5)"
    - "src/shell/prefsStore.ts mergePreferences untrusted-coercion precedent (Phase 3 coerceTreeStyle)"
  provides:
    - "platform.updater accessor (check / downloadAndInstall) behind the seam (DST-02, D-12)"
    - "UpdateInfo type ({ version, notes, date }) — shell never touches @tauri-apps types"
    - "noopUpdater shared test stub in testStore.ts"
    - "autoUpdateCheck: boolean | null preference (D-09) + coerceAutoUpdateCheck untrusted-merge"
  affects:
    - "src/lib/platform/index.ts"
    - "src/lib/platform/tauri.ts"
    - "src/lib/platform/browser.ts"
    - "src/shell/testStore.ts"
    - "src/shell/preferences.ts"
    - "src/shell/prefsStore.ts"
tech_stack:
  added:
    - "@tauri-apps/plugin-updater 2.10.1 (JS, exact-pinned)"
    - "@tauri-apps/plugin-process 2.3.1 (JS, exact-pinned)"
  patterns:
    - "Capability seam widening: real impl in tauri.ts only, no-op in browser.ts, getter in index.ts, shared noop* stub in testStore.ts (verified Phase-5 05-02 pattern)"
    - "Untrusted persisted-pref coercion: boolean true/false honored, everything else → null (mirrors coerceTreeStyle)"
key_files:
  created:
    - ".planning/phases/06-distribution/06-02-SUMMARY.md"
  modified:
    - "package.json"
    - "pnpm-lock.yaml"
    - "src/lib/platform/index.ts"
    - "src/lib/platform/tauri.ts"
    - "src/lib/platform/browser.ts"
    - "src/lib/platform/platform.test.ts"
    - "src/shell/testStore.ts"
    - "src/shell/preferences.ts"
    - "src/shell/prefsStore.ts"
    - "src/shell/prefsStore.test.ts"
    - "src/router.test.tsx"
    - "src/tools/jwt/JwtTool.test.tsx"
    - "src/tools/hash/HashTool.test.tsx"
    - "src/tools/uuid-ulid/UuidUlidTool.test.tsx"
    - "src/tools/base64/Base64Tool.test.tsx"
    - "src/tools/protobuf-decoder/ProtobufDecoder.test.tsx"
    - "src/tools/unix-time/UnixTimeTool.test.tsx"
decisions:
  - "downloadAndInstall forwards only the plugin's Progress(chunkLength) DownloadEvent to onProgress; progress is best-effort/non-load-bearing for DST-02 (verify+install is the contract)."
  - "noopUpdater added to testStore + spread through makeMemoryPlatform; the 7 inline Platform literals (router.test + 6 tool tests) updated in-place, mirroring the 05-02 noopWindow/noopNativeShortcut DRY fix."
metrics:
  duration: "~5 min"
  tasks: 3
  files_changed: 17
  completed: "2026-06-01"
requirements_progressed: [DST-02]
requirements_completed: []
---

# Phase 6 Plan 02: Updater Platform Seam + First-Run Opt-In Summary

Laid the entire unit-testable foundation of the auto-updater behind the existing `src/lib/platform/` seam (D-12) plus the persisted first-run opt-in field (D-09) — `platform.updater` (real impl only in `tauri.ts`, no-op in `browser.ts`, getter in `index.ts`) and `autoUpdateCheck: boolean | null` with untrusted coercion — so Plans 03 (config) and 04 (orchestration) can both consume the seam and the pref. No UI, no config, no network: pure TS, all TDD, decoder 19 untouched.

## What Was Built

### Task 1 — Install updater + process JS plugins, pinned
`pnpm add @tauri-apps/plugin-updater@2.10.1 @tauri-apps/plugin-process@2.3.1` — both exact-pinned (no caret), matching the repo's per-plugin pinning style (clipboard-manager 2.3.2, store 2.4.3, global-shortcut 2.3.2). These are the JS counterparts; the Rust crates land in Plan 03. `pnpm-lock.yaml` updated; both resolve.

- **Commit:** `85b6394b`

### Task 2 — Widen Platform with the updater surface (interface + real + no-op + shared stub)
Mirrored the verified Phase-5 seam-widening pattern exactly:
- **`index.ts`** — added `export interface UpdateInfo { version; notes: string|null; date: string|null }`, the `updater` member on `Platform` (`check(): Promise<UpdateInfo|null>` + `downloadAndInstall(onProgress?)`), and `get updater() { return active.updater; }` on the `platform` const accessor (so interface ↔ impl can never drift).
- **`tauri.ts`** (the ONLY `@tauri-apps/*` importer) — imported `check` from `@tauri-apps/plugin-updater` + `relaunch` from `@tauri-apps/plugin-process`; `check()` maps the plugin `Update` → `UpdateInfo` (`body ?? null`, `date ?? null`); `downloadAndInstall()` re-checks, runs `u.downloadAndInstall(...)` forwarding the plugin's `Progress` `DownloadEvent` (`event.data.chunkLength`) to `onProgress`, then `relaunch()`s. The minisign signature verify is the plugin's mandatory internal step — this IS DST-02's verify-before-apply. File-header capability list updated.
- **`browser.ts`** — harmless no-op (`check`→`null`, `downloadAndInstall`→resolve); never imports `@tauri-apps/*`, so jsdom/`vite preview` make no network call.
- **`testStore.ts`** — added exported `noopUpdater` and wired it into `makeMemoryPlatform`.
- **`platform.test.ts`** — +3 tests (browser no-op `check`→null, no-op `downloadAndInstall` resolves, accessor delegates to an injected stub); the two inline `Platform` stubs widened.

Per the documented 05-02 lesson, the widening broke `tsc` on every inline `Platform` literal, not just `platform.test.ts` — fixed DRY by importing `noopUpdater` into the 7 affected files (`router.test.tsx` + the 6 tool tests) and adding `updater: noopUpdater,`. `summon.test.ts` was auto-covered (it spreads `...makeMemoryPlatform()`).

Seam grep-audit clean: `tauri.ts` is the sole real `@tauri-apps/*` importer (all other matches are comments). Mitigates **T-06-04** (mandatory minisign verify wired in `tauri.ts`) and **T-06-05** (offline no-op in the browser fallback).

- **Commit:** `2f14f543`

### Task 3 — Persist the first-run opt-in (autoUpdateCheck) with untrusted coercion (D-09)
- **`preferences.ts`** — added `autoUpdateCheck: boolean | null` to `Preferences`; `DEFAULT_PREFERENCES.autoUpdateCheck = null` (null = "never asked", distinguishing first-run from "declined").
- **`prefsStore.ts`** — added `coerceAutoUpdateCheck(value)` next to `coerceTreeStyle` (honors only `true`/`false`; junk string, number, undefined → `null`) and wired `autoUpdateCheck: coerceAutoUpdateCheck(blob.autoUpdateCheck)` into `mergePreferences`.
- **`prefsStore.test.ts`** — +6 cases: true/false preserved, `"yes"`/`1`/absent → null, and a sibling-field (`protobufTreeStyle`) no-regression in the same merged blob.

Mitigates **T-06-03** (untrusted hand-edited `prefs.json` value coerces to null re-prompt).

- **Commit:** `c719bafb`

## Verification

- **Full suite green:** `pnpm test` → **285/285 vitest** (decoder 19 untouched; +3 updater seam, +6 autoUpdateCheck = +9 net vs the 276 baseline). `platform.test.ts` 11/11, `prefsStore.test.ts` 12/12.
- `pnpm exec tsc --noEmit` clean (interface widening propagated to every inline stub via `noopUpdater`).
- `pnpm lint` → 0 errors.
- Seam grep audit clean: `grep -rn 'from "@tauri-apps' src` outside `tauri.ts` returns only a prose comment in `index.ts` — no real import leaks the seam.
- lefthook pre-commit gate (tsc + vitest) green on all three task commits.

## Deviations from Plan

The three task actions ran exactly as written. One scope clarification (anticipated by the plan):

**1. [Rule 3 - Blocking] Widened all 7 inline Platform literals, not just `platform.test.ts`**
- **Found during:** Task 2 (tsc gate).
- **Issue:** The interface widening makes `tsc` require `updater` on EVERY inline `Platform` literal (`router.test.tsx` + the 6 tool tests), exactly the 05-02 lesson the plan's `<interfaces>` callout flagged. Without it the binding lefthook typecheck blocks the commit.
- **Fix:** Exported `noopUpdater` from `testStore.ts` (single source of truth) and added `updater: noopUpdater,` to each inline literal — DRY, no production behavior changed. `summon.test.ts` needed no edit (it spreads `...makeMemoryPlatform()`).
- **Files modified:** the 7 test files listed in key-files.
- **Commit:** `2f14f543` (folded into the Task 2 GREEN commit — the lefthook gate forbids a red tree and `--no-verify`, so the interface + impl + all stub-widenings are one type-coherent change, per the documented 05-02 precedent).

## Known Stubs

None that block DST-02. The `browser.ts` updater is an *intentional* no-op (offline-by-design fallback, D-12) — it is the contract, not a placeholder. The real network path exists only in `tauri.ts` behind the opt-in. The minisign verify + bundle swap are plugin internals (not unit-testable in jsdom); they are exercised by the manual round-trip at the Phase-6 gate (Plan 05). The UI (banner, opt-in prompt, orchestration) is explicitly the scope of Plans 03/04 — not this plan.

## Threat Flags

None — no new security surface beyond the threat_model the plan already registered (T-06-03 opt-in coercion, T-06-04 mandatory minisign verify, T-06-05 offline no-op), all mitigated here.

## Self-Check: PASSED

All modified files exist on disk; all three task commits are in git history (`85b6394b`, `2f14f543`, `c719bafb`). Platform seam grep-audit clean, full suite 285/285, tsc + eslint clean.
