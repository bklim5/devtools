---
phase: 25-updates-pane-milestone-ship
plan: 01
subsystem: platform-seam
tags: [updates, platform-seam, version, SET-10]
requirements: [SET-10]
dependency_graph:
  requires: []
  provides:
    - "platform.app.getVersion(): Promise<string> seam capability (real Tauri arm + browser/test fallback)"
  affects:
    - "Plan 04 (Updates pane) reads the running app version via platform.app.getVersion()"
tech_stack:
  added: []
  patterns:
    - "Capability arm mirrors updater/opener/autostart: interface + getter delegate + 4 arms (tauri/browser/stub-factory/inline test literals)"
    - "Real native import (@tauri-apps/api/app) confined to tauri.ts only; browser arm uses a build-time env fallback"
key_files:
  created: []
  modified:
    - src/lib/platform/index.ts
    - src/lib/platform/tauri.ts
    - src/lib/platform/browser.ts
    - src/shell/testStore.ts
    - src/lib/platform/platform.test.ts
decisions:
  - "stub.ts has no full-Platform factory; the canonical test factory is makeMemoryPlatform in src/shell/testStore.ts — added a shared noopApp there (mirrors noopAutostart) instead of stub.ts as the plan literally said"
  - "browser fallback constant is `import.meta.env.VITE_APP_VERSION ?? \"0.0.0-dev\"` (D-25-2 'constant or build-time inject' → constant chosen); test stub sentinel is 0.0.0-test"
metrics:
  duration: ~6 min
  tasks: 2
  files: 5
  tests_added: 2
  completed: 2026-06-21
---

# Phase 25 Plan 01: app.getVersion() Platform Seam Summary

Added an `app.getVersion(): Promise<string>` capability to the `src/lib/platform/` seam (D-25-2) so the Updates pane (Plan 04) can read the running app version while keeping seam discipline — the pane never imports `@tauri-apps/*`. The real arm in `tauri.ts` reads Tauri's `@tauri-apps/api/app` `getVersion()` (single source of truth = `tauri.conf.json` `version`); the browser/test arms return a safe fallback so unit tests and `vite preview` never touch native.

## What Shipped

- **`src/lib/platform/index.ts`** — `app: { getVersion(): Promise<string> }` on the `Platform` interface (after `autostart`, with the SET-10/D-25-2 doc comment) + `get app() { return active.app; }` on the `platform` delegate (mirrors `get autostart()`), so the accessor reflects the active impl rather than a snapshot.
- **`src/lib/platform/tauri.ts`** — `import { getVersion } from "@tauri-apps/api/app";` + `app: { getVersion: () => getVersion() }` arm. This is the ONLY file that imports the native app API.
- **`src/lib/platform/browser.ts`** — `app: { async getVersion() { return import.meta.env.VITE_APP_VERSION ?? "0.0.0-dev"; } }` fallback arm; zero `@tauri-apps/*` imports.
- **`src/shell/testStore.ts`** — shared `noopApp` arm (returns `"0.0.0-test"`) wired into `makeMemoryPlatform`, mirroring the `noopAutostart` precedent. This is the canonical test factory ~50 call sites consume.
- **`src/lib/platform/platform.test.ts`** — widened the 4 inline `Platform` literals with the `app` arm; added a `describe("platform seam — app.getVersion (SET-10)")` block with 2 tests (browser fallback non-empty string + injected `9.9.9-fixture` sentinel proving the active-impl delegate).

## Verification

- `pnpm exec tsc --noEmit` — clean.
- `pnpm exec vitest run src/lib/platform/platform.test.ts` — 19/19 (was 17, +2 new).
- Full suite `pnpm exec vitest run` — **1168/1168** (was 1166, +2), no regressions.
- `grep -cE "^import .*@tauri-apps" src/lib/platform/browser.ts` == 0 (the `9` raw `@tauri-apps` matches are doc-comment "must NOT import" warnings, not imports).
- `grep -cE "^import .*@tauri-apps/api/app" src/lib/platform/tauri.ts` == 1.
- `git diff` on `src/lib/protobuf/decoder.ts` (+ its 19 tests) — empty; byte-for-byte untouched.
- lefthook gate (tsc + vitest + eslint) passed on both commits (the 2 lint warnings are the known pre-existing SidebarResetMenu directives — 0 errors, out of scope).

## Deviations from Plan

### Adjustments

**1. [Rule 3 - Blocking] Test factory lives in `src/shell/testStore.ts`, not `stub.ts`**
- **Found during:** Task 1
- **Issue:** The plan's `<interfaces>` said "stub.ts — the makeMemoryPlatform test factory must also gain an `app` arm". `src/lib/platform/stub.ts` has NO full-Platform factory (only `createStoreStub` / `createLicenseStub`). The actual `makeMemoryPlatform` factory — consumed by ~50 test files — lives in `src/shell/testStore.ts`.
- **Fix:** Added a shared `noopApp` const in `testStore.ts` (mirroring the existing `noopAutostart` from Phase 24-01) and wired it into `makeMemoryPlatform`. This keeps every `makeMemoryPlatform(...)`-based test type-complete with one source of truth.
- **Files modified:** `src/shell/testStore.ts`
- **Commit:** 9cda4837

No other deviations — the interface, the real/browser arms, the delegate, and the 2 tests landed exactly as specified.

## Notes for Plan 04

- The Updates pane reads the version via `platform.app.getVersion()` (never `@tauri-apps/*` directly).
- In the packaged app this returns the real `tauri.conf.json` version; in jsdom/`vite preview` it returns `0.0.0-dev` (browser) / `0.0.0-test` (test factory). UI/e2e assertions on the exact string should account for the fallback in the non-Tauri gate.

## Self-Check: PASSED
- src/lib/platform/index.ts — FOUND (contains `getVersion` + `get app`)
- src/lib/platform/tauri.ts — FOUND (contains `@tauri-apps/api/app` + `getVersion`)
- src/lib/platform/browser.ts — FOUND (contains `getVersion`, 0 @tauri-apps imports)
- src/shell/testStore.ts — FOUND (noopApp + makeMemoryPlatform arm)
- src/lib/platform/platform.test.ts — FOUND (contains `app.getVersion`)
- Commit 9cda4837 — FOUND
- Commit 7d577bba — FOUND
