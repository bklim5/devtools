---
phase: 25-updates-pane-milestone-ship
plan: 04
subsystem: components/settings
tags: [updates, settings-pane, ui, wcag, SET-10]
requirements: [SET-10]
dependency_graph:
  requires:
    - "Plan 01 — platform.app.getVersion() seam"
    - "Plan 02 — lastUpdateCheck pref field"
    - "Plan 03 — useUpdater shared state machine (updateInfo/status/checking/runCheck)"
  provides:
    - "src/components/UpdatesSettings.tsx — the ungated Updates pane (version, last-checked, Check button + inline result, auto-check toggle)"
    - "SETTINGS_PANES `updates` entry (append-only; SettingsModal byte-unchanged)"
  affects:
    - "Plan 05 (milestone gate — real-WKWebView lastUpdateCheck persistence + updater walkthrough on the fresh build)"
tech-stack:
  added: []
  patterns:
    - "settings pane = GeneralSettings wrapper/header clone; consumes existing hooks/seams (zero new state)"
    - "version read once on mount via the seam with an `alive` latch (no setState-after-unmount, no flicker)"
    - "inline result mapped from useUpdater (checking/updateInfo/status) in a polite role=status region — WCAG-AA, no opacity-only signal"
key-files:
  created:
    - src/components/UpdatesSettings.tsx
    - src/components/UpdatesSettings.test.tsx
  modified:
    - src/components/settingsPanes.tsx
    - test/e2e/settings.e2e.ts
decisions:
  - "Updates pane is UNGATED — no entitlement/prefs-gate import (D-25-1; updates are core infra, not a Pro feature)"
  - "result-line precedence: checking → 'Checking for updates…'; else updateInfo → 'Version X available'; else the shared manual-check status verbatim ('You're up to date' / 'Update check failed')"
  - "NO install affordance in the pane — UpdateBanner owns install (D-25-5)"
  - "icon = RefreshCw; placement after Appearance / before License (General stays index 0 — the landing pane)"
  - "Tasks 1+2 landed in ONE commit (impl + test + registry together) — the test imports the SETTINGS_PANES `updates` entry, so a split would fail the lefthook gate (memory tdd-red-commits-blocked-by-lefthook)"
metrics:
  duration: ~10 min
  tasks: 3
  files: 4
  tests_added: 8
  completed: 2026-06-21
---

# Phase 25 Plan 04: Updates Settings Pane Summary

Built the user-facing deliverable for SET-10 — the **ungated** Settings ▸ Updates pane — wiring the three wave-1/2 foundations (Plan 01 version seam, Plan 02 `lastUpdateCheck` pref, Plan 03 `useUpdater` shared check) into one pane and appending it append-only to `SETTINGS_PANES` (zero `SettingsModal` change). The pane shows the running app version, the last-checked time ("Never" pre-first-check, relative thereafter with the absolute on hover), a Check-for-updates button that runs the shared de-duped check and surfaces checking/up-to-date/available/error inline in a polite live region (WCAG-AA, never opacity-only), and an auto-check toggle bound to the existing `autoUpdateCheck` pref. Install is NOT duplicated — the existing `UpdateBanner` owns it (D-25-5); the pane shows the "vX available" status only.

## What Shipped

- **`src/components/UpdatesSettings.tsx`** (new) — the pane. Wrapper/header clone `GeneralSettings` (h3 one level under the dialog h2). Version read once on mount via `platform.app.getVersion()` (Plan 01 seam, never the native plugin directly) into `useState<string|null>` with an `alive` latch (renders `v—` until resolve — no flicker, no setState-after-unmount). Last-checked = `preferences.lastUpdateCheck === null ? "Never" : (relativeTime(ms) || formatTimestamp(ms).local)` wrapped in a `<span title={absolute}>` (D-25-7). A "Check for updates" `<button>` → `useUpdater().runCheck(true)`, disabled while `checking` (neutral surface + not-allowed cursor, NOT opacity-only). A `role="status" aria-live="polite"` region maps `checking`/`updateInfo`/`status` → the inline result copy (D-25-4). A `SettingToggle` for "Automatically check for updates on launch" bound to `autoUpdateCheck === true` / `setAutoUpdateCheck` (tri-state null → OFF, D-25-8). NO install affordance; NO entitlement gate.
- **`src/components/settingsPanes.tsx`** — imported `RefreshCw` + `UpdatesSettings`; appended `{ id:"updates", label:"Updates", icon:RefreshCw, render:() => <UpdatesSettings/> }` after Appearance / before License. `SettingsModal.tsx` byte-unchanged (the modal derives 1:1 from the array).
- **`src/components/UpdatesSettings.test.tsx`** (new, 8 cases) — drives the REAL `useUpdater` + `usePreferences` singletons (stubbing ONLY the platform seam via `setPlatformForTest`/`makeMemoryPlatform`): version render, "Never" vs relative last-checked, Check → up-to-date inline result, NO install button, toggle reflect (null/true) + single-writer flip (`getSharedPreferences().autoUpdateCheck`), and the append-only registry shape (one `updates` entry, General still index 0).
- **`test/e2e/settings.e2e.ts`** — added a `Settings ▸ Updates pane` describe: keyboard-reachable pane nav (aria-current), a semver version line, "Last checked: Never" on the fresh state, Check button → inline "up to date" result, and the auto-check toggle focusable + keyboard-operable (with a finally-block reset so no prefs pollution leaks to later specs).

## Verification

- `pnpm exec vitest run src/components/UpdatesSettings.test.tsx` — 8/8.
- `pnpm exec tsc --noEmit` — clean (exit 0).
- `pnpm exec eslint src/components/UpdatesSettings.tsx src/components/settingsPanes.tsx test/e2e/settings.e2e.ts` — clean (the 2 lefthook warnings are the pre-existing SidebarResetMenu react-refresh advisories, out of scope).
- Full suite `pnpm exec vitest run` — **1196/1196** (was 1188 after Plan 03, +8), no regressions.
- Acceptance greps on `UpdatesSettings.tsx`: contains `app.getVersion` (2) + `runCheck` (3) + `setAutoUpdateCheck` (3) + `relativeTime` (4); 0 `gatePreferences`, 0 `useEntitlements`, 0 `@tauri-apps`, 0 `installUpdate`, 0 `onInstall`.
- `git diff --stat src/components/SettingsModal.tsx` — empty (append-only, zero shell change).
- `git diff src/lib/protobuf/decoder.ts` (vs aa2de52e) — empty; decoder + its 19 tests byte-for-byte untouched.
- Zero new runtime/dev deps.

## Threat Mitigations Applied

- **T-25-13 (DoS / rapid Check clicks)** — the Check button is `disabled` while `checking` is true; the `useUpdater` singleton's in-flight guard (Plan 03) de-dupes any concurrent triggers, so no unbounded concurrent checks.
- **T-25-11 (Tampering / forged update via the pane)** — the pane only calls `runCheck`; it renders NO install affordance, so install stays in the banner's verify-before-apply path (D-25-5). The pane cannot install an unverified update.
- **T-25-10 / T-25-12 (accept-by-design)** — ungated pane exposes only public metadata (version) + a check trigger; no entitlement-bearing capability, no secret rendered.

## Deviations from Plan

### Adjustments

**1. [Process — lefthook] Tasks 1 + 2 landed in ONE commit**
- **Found during:** Task 2
- **Issue:** The plan lists Task 1 (pane + its test) and Task 2 (registry append + assertion) separately, but the unit test imports the `SETTINGS_PANES` `updates` entry, so a Task-1-only commit would fail the lefthook gate (memory `tdd-red-commits-blocked-by-lefthook`). The pane + its test + the registry append are mutually dependent.
- **Fix:** Landed all three (pane, test, registry) in one GREEN commit (`42a40860`). All Task-1 and Task-2 behaviors are covered.
- **Commit:** 42a40860

**2. [Quality] Reworded three doc-comment literals to keep the acceptance greps clean**
- **Found during:** Task 1
- **Issue:** The acceptance criteria assert `grep gatePreferences / useEntitlements / @tauri-apps == 0` on `UpdatesSettings.tsx`, but the header doc comment described the pane as having "no gatePreferences/useEntitlements" and reading version "never @tauri-apps/* directly" — the literal tokens appeared in prose, not code.
- **Fix:** Reworded to "no prefs gating, no entitlements hook" and "never the native plugin directly" (same precedent as Plans 01/03 comment-wording tweaks). No behavior change — the file never imported any of them.
- **Commit:** 42a40860

No other deviations — the pane, the registry append, and the e2e landed as specified in the `<interfaces>` block.

## Known Stubs

None. The pane is fully wired to the real seams: version via `platform.app.getVersion()`, last-checked via `preferences.lastUpdateCheck`, check via `useUpdater().runCheck(true)`, toggle via `setAutoUpdateCheck`. The `lastUpdateCheck` PERSISTENCE-across-restart + the toggle-survives-restart checks are the Plan 05 human walkthrough (WebDriver cannot restart the packaged app between assertions — memory `tauri-store-async-init-race`), as the plan specifies.

## Harness note

`/simplify` → `/code-review xhigh` → `/codex:adversarial-review` were NOT auto-invoked by the executor (per the project gate discipline they run at the phase checkpoint). The real-WKWebView `settings.e2e.ts` Updates block is orchestrator-run via `scripts/e2e-spike.sh` at the gate (memory `verify-gate-builds-real-app`); this plan's commands assert the spec compiles/lints. Recommend `/codex:review --scope working-tree` + the e2e-spike run + the fresh `tauri build` walkthrough (Plan 05) at the Phase-25 checkpoint. **SET-10 is now functionally DELIVERED** (ungated pane: version + last-checked + shared check with inline result + auto-check toggle; install deferred to the banner; append-only) — pending the real-WKWebView gate + the milestone-close sign-off (Plan 05).

## Commits

- `42a40860` — feat(25-04): ungated Updates settings pane + registry append (Tasks 1+2)
- `25550611` — test(25-04): Settings ▸ Updates pane real-WKWebView e2e (Task 3)

## Self-Check: PASSED
