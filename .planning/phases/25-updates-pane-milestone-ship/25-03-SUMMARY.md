---
phase: 25-updates-pane-milestone-ship
plan: 03
subsystem: shell/updater
tags: [updates, state-lift, integration, SET-10]
requirements: [SET-10]
dependency_graph:
  requires:
    - "Plan 01 — app.getVersion() platform seam"
    - "Plan 02 — lastUpdateCheck pref field + setLastUpdateCheck single-writer setter"
    - "the single-writer prefs seam (usePreferences updatePreferences singleton, Phase 23-03)"
  provides:
    - "src/shell/useUpdater.ts — shared updater state machine singleton + useUpdater hook (updateInfo/status/checking/installing/progress + runCheck/install/dismiss/clearStatus)"
    - "runUpdateCheck(manual) — in-flight de-duped check that stamps lastUpdateCheck (load-safe) on EVERY resolution"
    - "whenPreferencesLoaded() awaitable in usePreferences.ts (non-React load-gate primitive)"
    - "setUpdateInfoForTest DEV/e2e inject seam + resetUpdaterForTest test reset"
  affects:
    - "Plan 04 (Updates pane consumes useUpdater for status/checking/updateInfo + runCheck; relies on the in-flight de-dupe — T-25-13)"
    - "Plan 05 (milestone gate — real-WKWebView lastUpdateCheck persistence + updater walkthrough)"
tech-stack:
  added: []
  patterns:
    - "module-singleton + listeners Set + per-field setters + forceRender hook (mirrors usePreferences / settingsStore)"
    - "explicit module-scoped inFlight: Promise<void> | null de-dupe guard (reuse-or-start)"
    - "non-React writer awaits whenPreferencesLoaded() before merging through the single-writer updatePreferences (load-safe stamp)"
key-files:
  created:
    - src/shell/useUpdater.ts
    - src/shell/useUpdater.test.ts
    - src/App.test.tsx
  modified:
    - src/shell/usePreferences.ts
    - src/App.tsx
decisions:
  - "Tasks 1 + 2 landed in ONE commit (impl + its tests together) — lefthook rejects a failing-test RED-only commit (memory tdd-red-commits-blocked-by-lefthook)"
  - "manual flag is captured by the FIRST caller of an overlapping check (D-25-3 in-flight decision) — both callers stamp, both share the one network call"
  - "App.tsx status auto-clear timer kept in App but now drives the hook's clearStatus action (the hook owns the status field, App owns the timer) — one driver, no duplication"
metrics:
  duration: ~6 min
  tasks: 3
  files: 5
  tests_added: 10
  completed: 2026-06-21
---

# Phase 25 Plan 03: Shared useUpdater State Machine Summary

Lifted App.tsx's component-local updater state (`updateInfo` / `status` / `checking` / `installing` / `progress` + the check + install actions) into a shared module singleton + `useUpdater` hook (D-25-3 — ONE source of truth), so the Updates pane (Plan 04), the tray, and the silent launch check are all SECOND entry points to the SAME check with no divergent state machine. The singleton (a) **de-dupes concurrent checks behind one explicit `inFlight` promise** so overlapping triggers hit `platform.updater.check` EXACTLY once (D-25-3 / T-25-18; Plan 04's T-25-13 relies on this), and (b) **stamps `lastUpdateCheck` (Plan 02's setter) on EVERY completed check** — manual, tray, silent launch — but only **AFTER `whenPreferencesLoaded()` resolves**, so the stamp can never persist `DEFAULT_PREFERENCES + timestamp` over the user's real blob during the async-init race (T-25-17, memory `tauri-store-async-init-race` + `prefs-blob-single-writer`). App.tsx now has NO direct `checkForUpdate`/`installUpdate` path; the existing UpdateBanner/opt-in/tray behavior is byte-identical.

## What Shipped

- **`src/shell/usePreferences.ts`** — ADDED `whenPreferencesLoaded(): Promise<void>` (idempotent `ensurePreferencesLoaded()` kick → resolve immediately if `getPreferencesLoaded()`, else subscribe + resolve+unsubscribe on the first notify where loaded). Additive only — `ensurePreferencesLoaded`/`updatePreferences`/`dirty` semantics untouched.
- **`src/shell/useUpdater.ts`** (new) — module-singleton updater state + `listeners` Set + `notify` + per-field setters + a module-scoped `inFlight: Promise<void> | null`. `runUpdateCheck(manual)` (reuse-or-start de-dupe; `await whenPreferencesLoaded()` BEFORE `updatePreferences({ lastUpdateCheck: Date.now() })`; sets state by result kind; clears `inFlight` in `finally`), `installPendingUpdate()` (lifts handleInstall — installing + error-as-status, no crash), `dismissUpdate()`, `clearUpdateStatus()`, `setUpdateInfoForTest` (DEV inject seam), `resetUpdaterForTest()` + test getters, and the `useUpdater()` hook. Imports NO native runtime package — routes through `update.ts` → the platform seam.
- **`src/shell/useUpdater.test.ts`** (new, 7 cases) — exactly-once de-dupe (overlapping silent+manual → `check` called once) + fresh-check-on-subsequent-call; stamp-on-current/silent-quiet/error/update; the load-safe no-clobber regression (a stamp fired before a DELAYED non-default load preserves theme/pins/entitlements AND lands the stamp).
- **`src/App.tsx`** — replaced the local `useState` + `runCheck`/`handleInstall` with `const { updateInfo, status, installing, progress, runCheck, install, dismiss, clearStatus } = useUpdater();`. REMOVED the `checkForUpdate`/`installUpdate` imports (kept `needsOptInPrompt`/`shouldAutoCheck`). Re-pointed: silent launch → `runCheck(false)`, tray → `runCheck(true)`, banner `onInstall/onDismiss` → `install`/`dismiss`, status auto-clear → `clearStatus`, DEV `__injectUpdate` → `setUpdateInfoForTest`. KEPT unchanged: opt-in prompt, `setAutoUpdateCheck`, Settings/Upsell wiring, `useAppearance`/`useTrackActiveTool`.
- **`src/App.test.tsx`** (new, 3 cases) — silent-launch (opted in → `check` once + `lastUpdateCheck` stamped) + opted-out (no check, no stamp) + tray (`menu://check-updates` handler → `check` once + stamp). Drives the REAL hook; stubs only the platform seam.

## Verification

- `pnpm exec tsc --noEmit` — clean (exit 0).
- `pnpm exec eslint src/App.tsx src/App.test.tsx src/shell/useUpdater.ts src/shell/usePreferences.ts src/shell/useUpdater.test.ts` — clean (the 2 lefthook warnings are the pre-existing SidebarResetMenu react-refresh advisories, out of scope; useUpdater.ts's react-refresh advisory mirrors usePreferences.ts's mixed hook+fn export shape — same accepted pattern).
- `pnpm exec vitest run src/shell/useUpdater.test.ts` — 7/7.
- `pnpm exec vitest run src/App.test.tsx` — 3/3.
- Full suite `pnpm exec vitest run` — **1188/1188** (was 1178 after Plan 02, +10), no regressions.
- `grep -c "@tauri-apps" src/shell/useUpdater.ts` == 0 (seam discipline).
- `grep -c "checkForUpdate\|installUpdate" src/App.tsx` == 0 (no divergent direct path — Finding 3 / D-25-3).
- `grep -c "useState<UpdateInfo" src/App.tsx` == 0; `useUpdater` present; `runCheck(false)` + `runCheck(true)` present; UpdateBanner/UpdateOptIn/setAutoUpdateCheck retained.
- `git diff` decoder.ts + its 19 tests (working tree AND vs 9ee48366) — byte-for-byte untouched.
- Zero new runtime/dev deps.

## Threat Mitigations Applied

- **T-25-08 (Repudiation / stale state — divergent check machines)** — ONE shared singleton + an explicit `inFlight` promise; the pane and tray cannot diverge OR double-fire; `lastUpdateCheck` is stamped centrally on every resolution.
- **T-25-17 (Tampering / data loss — async-load prefs clobber)** — the stamp `await whenPreferencesLoaded()` before merging, so it can never persist `DEFAULT_PREFERENCES + timestamp` over the user's real blob during the load window. Pinned by the no-clobber regression test (delayed non-default load → theme/pins/entitlements preserved + stamp landed).
- **T-25-18 (DoS / race — duplicate network)** — the `inFlight` guard reuses a running check so overlapping triggers fire `platform.updater.check` exactly once. Pinned by the exactly-once call-count test.
- **T-25-07 (Tampering / forged update)** — install still flows through `installUpdate` → `downloadAndInstall` (minisign verify-before-apply unchanged); this plan only relocates the caller into the singleton.

## Deviations from Plan

### Adjustments

**1. [Process — lefthook] Tasks 1 + 2 landed in ONE commit instead of two**
- **Found during:** Task 2
- **Issue:** The plan lists Task 1 (impl) and Task 2 (tests) as separate tasks. The project's lefthook gate rejects any commit whose tests/tsc fail, so a standalone test-only or impl-only commit isn't viable here (memory `tdd-red-commits-blocked-by-lefthook`).
- **Fix:** Landed the useUpdater singleton + `whenPreferencesLoaded` + the de-dupe/no-clobber/status tests together in one GREEN commit (`947d0707`). Task 2's behaviors are all covered.
- **Commit:** 947d0707

**2. [Quality] Reworded a doc comment to keep the seam grep clean**
- **Found during:** Task 1
- **Issue:** The `verification` block asserts `grep -c "@tauri-apps" src/shell/useUpdater.ts == 0`, but a doc comment originally contained the literal "@tauri-apps".
- **Fix:** Reworded "imports NO @tauri-apps package" → "imports NO native runtime package" (same precedent as Phase 23/24 comment-wording tweaks). The file has zero actual native imports either way.
- **Commit:** 947d0707

No other deviations — the in-flight guard, the load-gated stamp, the App.tsx lift, and the integration tests landed as specified in the `<interfaces>` block.

## Known Stubs

None. The shared hook is fully wired: App.tsx drives all updater UX from it; silent-launch and tray paths are integration-tested through the real hook. The Updates pane UI (Plan 04) and the real-WKWebView `lastUpdateCheck` persistence walkthrough (Plan 05) are out of scope by design.

## Harness note

`/simplify` → `/code-review xhigh` → `/codex:adversarial-review` were NOT auto-invoked by the executor (per the project gate discipline they run at the phase checkpoint). Recommend `/codex:review --scope working-tree` at the Phase-25 checkpoint. SET-10 stays PARTIAL — this is the integration spine (state-ownership refactor + load-safe stamp + in-flight de-dupe); the Updates pane UI + Check-for-updates button + real-WKWebView e2e land in Plans 04/05.

## Commits

- `947d0707` — feat(25-03): shared useUpdater singleton + whenPreferencesLoaded load-gate (Tasks 1+2)
- `32fbc542` — refactor(25-03): App.tsx consumes useUpdater (no direct check/install path) (Task 3)

## Self-Check: PASSED
