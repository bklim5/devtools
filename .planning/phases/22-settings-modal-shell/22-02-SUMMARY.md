---
phase: 22-settings-modal-shell
plan: 02
subsystem: ui
tags: [settings-modal, entry-points, sidebar, command-palette, lucide-react, focus-return, wcag-aa, hashrouter]

# Dependency graph
requires:
  - phase: 22-settings-modal-shell
    plan: 01
    provides: settingsStore (openSettings/closeSettings), shell-mounted SettingsModal, settingsPanes registry, #/settings/license deep-link
  - phase: 21-license-lifecycle-ship-gate
    provides: D-88 footer License-attention affordance + ⌘K License command (re-pointed here), shared upsellStore/UpsellModal
provides:
  - Sidebar bottom-anchored unconditional "Settings" gear row → openSettings('license') (SET-03/D-S9/D-S10)
  - ⌘K "Settings" command (sibling to "License") → openSettings('license', preOpenFocus) (SET-03/D-S8)
  - D-S11 re-point — footer "License needs attention" + ⌘K "License" (manageable state) open the Settings modal on the License pane instead of navigate('/settings/license')
affects: [22-03 native app-menu/tray entry points, 23-25 settings panes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Webview Settings entry points (sidebar row + ⌘K command) drive the single settingsStore.openSettings — the one Settings surface (D-S6), no duplicate route render"
    - "Transient ⌘K opener passes the persistent pre-palette focus as the explicit openSettings return target (finding-3 pattern, shared with the License/upsell command)"
    - "Bottom-anchored footer rows: the flex-1 <nav> pins the Unlock-Pro/attention row + the unconditional Settings row to the aside bottom (Settings last)"

key-files:
  created: []
  modified:
    - src/components/Sidebar.tsx
    - src/components/Sidebar.test.tsx
    - src/components/CommandPalette.tsx
    - src/components/CommandPalette.test.tsx
    - test/e2e/settings.e2e.ts
    - test/e2e/license-settings.e2e.ts

key-decisions:
  - "Settings row is UNCONDITIONAL (rendered for everyone incl. unlicensed, no lock badge) and sits as the LAST aside child below the Unlock-Pro/attention affordance (D-S9/D-S10)"
  - "Sidebar dropped useNavigate entirely — the D-S11 re-point removed its only consumer (openLicenseSurface); CommandPalette KEEPS navigate (still used for tool selection), only dropping it from the licenseCommand useMemo deps"
  - "Both the License (manageable arm) and Settings ⌘K commands pass preOpenFocus to openSettings as the explicit return target (the palette row unmounts on close — T-22-07)"

requirements-completed: [SET-03]

# Metrics
duration: 7min
completed: 2026-06-15
---

# Phase 22 Plan 02: Settings Entry Points & D-88 Re-point Summary

**Wired the two webview Settings entry points — a bottom-anchored unconditional sidebar "Settings" gear row and a ⌘K "Settings" command — and consolidated every license-management entry (footer "License needs attention" + ⌘K "License") onto the single Settings modal via openSettings('license'), retiring the superseded navigate('/settings/license') route.**

## Performance

- **Duration:** ~7 min
- **Tasks:** 3
- **Files modified:** 6 (0 created, 6 modified)

## Accomplishments
- **Sidebar (Task 1):** added the lucide `Settings` gear; new UNCONDITIONAL bottom-anchored "Settings" row (opens for everyone, no lock badge → `openSettings("license")`, D-S9/D-S10) sitting as the last aside child below the Unlock-Pro/attention affordance. Re-pointed `openLicenseSurface`'s manageable-license branch from `navigate("/settings/license")` to `openSettings("license")` (D-S11); the free-tier "Unlock Pro" branch is unchanged (still opens the shared upsell). Dropped the now-unused `useNavigate`/`navigate` from Sidebar entirely.
- **CommandPalette (Task 2):** added a `settingsCommand` sibling to `licenseCommand` (`id: "settings"`, `name: "Settings"`, gear icon) → `openSettings("license", preOpenFocus)` (D-S8), included before the DEV commands so the dev toggle stays last. Re-pointed the License command's manageable arm to `openSettings("license", preOpenFocus)` (D-S11); the free arm still opens the shared upsell. Kept the `navigate` import (still used for tool selection), dropping it only from the licenseCommand `useMemo` deps.
- **e2e (Task 3):** `settings.e2e.ts` gained open-from-sidebar (focus returns to the Settings row on Esc) and open-from-⌘K (focus returns off `<body>` to the pre-palette element) paths; `license-settings.e2e.ts` gained the D-S11 footer-routing coverage — the "License needs attention" affordance now OPENS the modal on the License pane (asserting the dialog mounts, not a hash change). Real-WKWebView gate green: **20/20 spec files**; new screenshots `settings-modal-from-sidebar.png`, `settings-modal-from-palette.png`, `license-settings-footer-opens-modal.png`.

## Task Commits

1. **Task 1: Sidebar Settings row + D-S11 footer re-point** - `7a5b9fa8` (feat)
2. **Task 2: ⌘K Settings command + D-88 License re-point** - `fc0d6fa5` (feat)
3. **Task 3: e2e sidebar/⌘K open + footer-opens-modal** - `c970aaad` (test)

## Files Modified
- `src/components/Sidebar.tsx` - Settings gear import, unconditional bottom-anchored Settings row, D-S11 `openLicenseSurface` re-point, useNavigate removed
- `src/components/Sidebar.test.tsx` - mock `@/shell/settingsStore`; new describe for the unconditional Settings row (FULL_SET + free tier) + Unlock-Pro-still-upsells; license-attention tests assert `openSettings("license")` (was navigate)
- `src/components/CommandPalette.tsx` - Settings gear import, `settingsCommand`, License command D-S11 re-point, navigate dropped from licenseCommand deps
- `src/components/CommandPalette.test.tsx` - mock `@/shell/settingsStore`; new describe for the Settings command (findable/runnable/return-target); License command asserts `openSettings` (manageable) / upsell (free)
- `test/e2e/settings.e2e.ts` - open-from-sidebar + open-from-⌘K paths with focus-return assertions
- `test/e2e/license-settings.e2e.ts` - footer "License needs attention" opens the modal (D-S11)

## Decisions Made
- **Unconditional Settings row, last child:** the row renders for everyone (including unlicensed, no lock badge) and is the LAST aside child below the Unlock-Pro/attention row (D-S9/D-S10) — verified by a FULL_SET+notActivated unit test where the attention row is absent yet the Settings row is present.
- **Sidebar drops useNavigate; CommandPalette keeps navigate:** the D-S11 re-point removed Sidebar's only `navigate` consumer, so the import was deleted; CommandPalette still navigates for tool selection, so the import stays and only the licenseCommand `useMemo` dep was dropped.
- **Explicit return target for transient ⌘K openers:** both ⌘K commands pass `preOpenFocus` to `openSettings` (the palette row unmounts on close — T-22-07), proven on the real WKWebView (focus returns off `<body>`).

## Deviations from Plan

None - plan executed exactly as written. The plan flagged that `navigate` might still be used in Sidebar; it was NOT (the re-point removed its sole consumer), so the import was dropped cleanly — this matches the plan's "remove navigate if no longer used" instruction.

## Threat Surface
The plan's threat register (T-22-05 accept / T-22-06 + T-22-07 mitigate) is honored: the unconditional Settings row carries no lock badge or privileged action (T-22-05); the D-88 re-point consolidates onto the single Settings surface and is covered by unit + migrated e2e (T-22-06); the ⌘K command passes the persistent pre-palette focus and the e2e asserts focus-return off `<body>` (T-22-07). No new security-relevant surface introduced.

## Issues Encountered
None. The e2e ⌘K path defensively ArrowUp-wraps to the Settings command row if the first row is a tool match (D-32 ordering), guarding Enter from selecting the wrong row.

## Next Phase Readiness
- Both webview Settings entry points + the D-S11 consolidation are live; every license-management entry now opens the one Settings surface.
- **Carried to Plan 03:** native app-menu (⌘,) + tray "Settings…" via the `platform/` seam (`menu://open-settings` → `onOpenSettings` → `openSettings()`), with the manual menu/tray + Edit-menu-regression walkthrough (WebDriver cannot drive native chrome).
- Decoder + its 19 tests AND LicenseSettings.tsx byte-for-byte untouched; zero new runtime/dev deps. SET-03 Validated.

## Self-Check: PASSED

All 6 modified files verified on disk; all 3 task commits (7a5b9fa8, fc0d6fa5, c970aaad) verified in git history; the 3 new e2e screenshots produced this run (15:55).

---
*Phase: 22-settings-modal-shell*
*Completed: 2026-06-15*
