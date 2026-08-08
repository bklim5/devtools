---
phase: 22-settings-modal-shell
plan: 01
subsystem: ui
tags: [settings-modal, react, useSyncExternalStore, hashrouter, wcag-aa, focus-trap, lucide-react]

# Dependency graph
requires:
  - phase: 21-license-lifecycle-ship-gate
    provides: LicenseSettings component (rendered unchanged as the License pane), upsellStore/UpsellModal a11y blueprint, #/settings/license route
provides:
  - settingsStore (openSettings/closeSettings/getActivePane/setActivePane/getSettingsInvoker + subscribe) cloned from upsellStore with activePane
  - useSettings hooks (useSettingsOpen, useActivePane)
  - settingsPanes extensible registry [{id,label,icon,render}] (License pane only this phase)
  - SettingsModal — paned shell modal with verbatim UpsellModal a11y + arrow pane nav + aria-live announce + stacked-upsell Esc guard
  - SettingsDeepLink — #/settings/license opens the modal on the License pane then redirects (D-S6)
  - App.tsx shell-level SettingsModal mount (before UpsellModal)
affects: [23-appearance-pane, 24-hotkeys-general-panes, 25-updates-pane, settings entry points (Plan 02), native menu/tray (Plan 03)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Second shell-level useSyncExternalStore modal store (settingsStore) cloning the upsellStore invoker-capture pattern"
    - "Extensible pane registry array drives both left nav and right content (Phases 23-25 append entries, no shell change)"
    - "aria-current button-list pane semantics (NOT tablist) — locked for later phases to inherit"
    - "Stacked aria-modal coordination: the lower modal yields keyboard handling while the upper (aria-labelledby=upsell-heading) is open"

key-files:
  created:
    - src/shell/settingsStore.ts
    - src/shell/useSettings.ts
    - src/shell/settingsStore.test.ts
    - src/components/settingsPanes.tsx
    - src/components/SettingsModal.tsx
    - src/components/SettingsModal.test.tsx
    - src/shell/SettingsDeepLink.tsx
    - test/e2e/settings.e2e.ts
  modified:
    - src/App.tsx
    - src/router.tsx
    - test/e2e/license-settings.e2e.ts
    - test/e2e/ship-gate.e2e.ts
    - test/e2e/helpers.ts

key-decisions:
  - "Pane semantics locked to aria-current button-list (not tablist/tab/tabpanel) per the UI-SPEC reviewer note, so Phases 23-25 inherit one model"
  - "Nav rail width locked at w-[200px]; dialog caps w-[min(880px,92vw)] h-[min(640px,86vh)]"
  - "Stacked-modal Esc: SettingsModal yields ALL keyboard handling while the UpsellModal is open so a single Esc closes only the upsell (the Reactivate invoker survives for focus-return)"
  - "Deep-link passes document.body as the persistent return target (the element unmounts immediately, like the native-opener case)"

patterns-established:
  - "settingsStore: module-singleton open-state + activePane + sync invoker capture, jsdom-guarded for node importability"
  - "SettingsModal: clone UpsellModal trap/return/Esc/backdrop verbatim, extend with clamped arrow/Home/End pane nav + sr-only aria-live announce"
  - "e2e probes scoped INSIDE [role=dialog][aria-modal], dropping the 'Settings' title h2 (Pitfall 4)"

requirements-completed: [SET-04, SET-05, SET-06]

# Metrics
duration: 20min
completed: 2026-06-15
---

# Phase 22 Plan 01: Settings Modal Shell Summary

**Shell-level Settings modal (Claude-style paned dialog) driven by a cloned `settingsStore`, hosting the unchanged License pane, with the `#/settings/license` deep-link migrated to open it — all WCAG-AA a11y verbatim from UpsellModal plus arrow pane nav.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-06-15T15:25:00Z
- **Completed:** 2026-06-15T15:45:00Z
- **Tasks:** 3
- **Files modified:** 13 (8 created, 5 modified)

## Accomplishments
- `settingsStore` + `useSettings`: a second shell-level open-state store cloning upsellStore's synchronous invoker-capture, extended with `activePane`; jsdom-guarded, 10 store tests green.
- `SettingsModal`: large centered paned dialog (left nav button-list / right content) with the UpsellModal focus-trap/return/Esc/backdrop mechanics cloned verbatim, plus clamped Arrow/Home/End pane nav and an `aria-live="polite"` active-pane announcement (SET-05). The License pane renders `<LicenseSettings/>` UNCHANGED with no double-pad (SET-06). 10 component tests green.
- `settingsPanes`: the extensible `[{id,label,icon,render}]` registry (License only this phase; Phases 23-25 append).
- Shell mount in `App.tsx` (before UpsellModal — Pitfall 6 stacking) + `#/settings/license` migrated to `SettingsDeepLink` which opens the modal on the License pane then redirects (D-S6, no duplicate in-window surface).
- New `settings.e2e.ts` + migrated `license-settings.e2e.ts`; full real-WKWebView gate green (20/20 spec files).

## Task Commits

1. **Task 1: settingsStore + useSettings** - `9ffd4c9f` (feat)
2. **Task 2: settingsPanes registry + SettingsModal** - `b90c619d` (feat)
3. **Task 3: App mount + deep-link migration + e2e** - `28c0eeaa` (feat)

_TDD tasks (1, 2) landed tests GREEN with their impl (lefthook rejects RED-only commits — the [[tdd-red-commits-blocked-by-lefthook]] rule)._

## Files Created/Modified
- `src/shell/settingsStore.ts` - open/close/activePane/invoker singleton + subscribe (cloned from upsellStore)
- `src/shell/useSettings.ts` - useSettingsOpen + useActivePane hooks
- `src/shell/settingsStore.test.ts` - 10 store tests (idempotency, pane default/reset, invoker capture)
- `src/components/settingsPanes.tsx` - extensible pane registry (License pane)
- `src/components/SettingsModal.tsx` - the paned modal (a11y clone + pane nav + aria-live + stacked-upsell Esc guard)
- `src/components/SettingsModal.test.tsx` - 10 dialog/pane tests
- `src/shell/SettingsDeepLink.tsx` - opens the modal on License pane then redirects (D-S6)
- `src/App.tsx` - mount SettingsModal before UpsellModal
- `src/router.tsx` - #/settings/license → SettingsDeepLink (LicenseSettings import removed)
- `test/e2e/settings.e2e.ts` - new: deep-link opens aria-modal dialog, Esc dismiss
- `test/e2e/license-settings.e2e.ts` - migrated to the modal (dialog-scoped probes, h2 re-scoped)
- `test/e2e/ship-gate.e2e.ts` - cases 4/5 probes migrated to the modal (Rule 3 fallout)
- `test/e2e/helpers.ts` - upsellModalOpen scoped to aria-labelledby=upsell-heading (Rule 3 fallout)

## Decisions Made
- **Pane semantics:** `aria-current="page"` button list (NOT tablist) — the UI-SPEC permitted either but mandated picking one; locked so Phases 23-25 inherit it.
- **Nav rail / size caps:** `w-[200px]` rail, dialog `w-[min(880px,92vw)] h-[min(640px,86vh)]`.
- **Stacked-modal Esc coordination (new, see Deviations):** the lower Settings modal yields all keyboard handling while the upper UpsellModal is open.
- **Deep-link return target:** `document.body` (the element unmounts immediately, transient-opener pattern).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Single Esc closed BOTH stacked modals, destroying the focus-return invoker**
- **Found during:** Task 3 (real-WKWebView e2e)
- **Issue:** When the License pane's Reactivate/Activate opens the UpsellModal stacked above the Settings modal (Pitfall 6), both attach document-level keydown listeners — a single Esc closed BOTH at once, so the Settings modal (and the Reactivate button inside it) unmounted before the upsell could return focus to it (E1 broke; focus landed on `<body>`).
- **Fix:** SettingsModal's keydown handler now yields ALL handling (Esc + focus trap + pane nav) while an UpsellModal is open (detected by `aria-labelledby="upsell-heading"`). The upsell owns Esc + its own trap; on dismiss it restores focus to the still-mounted Reactivate button.
- **Files modified:** src/components/SettingsModal.tsx
- **Verification:** license-settings.e2e E1 focus-return test passes on the real WKWebView; SettingsModal unit tests still 10/10.
- **Committed in:** 28c0eeaa (Task 3)

**2. [Rule 3 - Blocking] ship-gate.e2e cases 4/5 broke on the migrated route (Pitfall 4 applied to it too)**
- **Found during:** Task 3 (real-WKWebView e2e)
- **Issue:** ship-gate.e2e also navigated to `#/settings/license` and read the first `<h2>` for the status heading — after the D-S6 migration that returns "Settings" (the dialog title) / null, failing cases 4 (corrupt cert) and 5 (foreign cert).
- **Fix:** Migrated ship-gate's `navigateToLicenseRoute`/`statusHeading`/`routeHasButton`/`remountLicenseRoute` to open the modal via the deep-link, scope reads inside `[role=dialog][aria-modal]` (dropping the "Settings" title), and close-before-remount so the pane re-queries the cert; close the modal before the sidebar-focused locked-customization checks and in cleanup.
- **Files modified:** test/e2e/ship-gate.e2e.ts
- **Verification:** ship-gate.e2e 3/3 green on the real WKWebView.
- **Committed in:** 28c0eeaa (Task 3)

**3. [Rule 3 - Blocking] upsellModalOpen helper false-positived on the second shell modal**
- **Found during:** Task 3 (real-WKWebView e2e)
- **Issue:** The shared `upsellModalOpen()` probe read the FIRST `[role=dialog][aria-modal]` (now the Settings modal) and matched its License-pane problem copy ("Your license file couldn't be verified"), giving wrong open/closed answers once a second shell modal existed.
- **Fix:** Scoped `upsellModalOpen()` to the dialog with `aria-labelledby="upsell-heading"` (UpsellPanel's MODAL_HEADING_ID), which uniquely identifies the UpsellModal whether standalone or stacked above Settings; the Settings dialog uses a generated useId() title.
- **Files modified:** test/e2e/helpers.ts
- **Verification:** entitlements/license-buy/license-settings/ship-gate all green; full gate 20/20.
- **Committed in:** 28c0eeaa (Task 3)

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** All three are direct fallout of the planned D-S6 migration introducing a SECOND shell-level aria-modal dialog — a correctness requirement for the stacked-modal interaction (deviation #1 is a genuine UX/a11y bug fix) and for the shared test probes the migration invalidated. No scope creep; no new product surface. The threat model's mitigations (T-22-01 fixed-literal deep-link, T-22-03 verbatim trap clone) are honored.

## Issues Encountered
- A cold-start e2e flake (base64.e2e timed out at 15s on the very first worker, passed at 254ms on re-run) — the documented warmup flake, not a code issue.
- WDIO runs specs in parallel against one shared app instance, so a spec leaving a modal open polluted later specs (sidebar reorder). Resolved by closing the Settings modal in ship-gate cleanup.

## User Setup Required
None - no external service configuration required. Native app-menu (⌘,) + tray entries are Plan 03 (manual-walkthrough, 22-HUMAN-UAT).

## Next Phase Readiness
- The Settings modal shell, pane registry, and a11y model are locked and ready for Plan 02 (entry points: sidebar row + ⌘K command + footer/⌘K "License" re-point) and Plan 03 (native app-menu + tray via the platform seam).
- Phases 23-25 append `{id,label,icon,render}` entries to SETTINGS_PANES with no shell change.
- Decoder + its 19 tests and LicenseSettings.tsx byte-for-byte untouched; zero new runtime/dev deps.

## Self-Check: PASSED

All 8 created files verified on disk; all 3 task commits (9ffd4c9f, b90c619d, 28c0eeaa) verified in git history.

---
*Phase: 22-settings-modal-shell*
*Completed: 2026-06-15*
