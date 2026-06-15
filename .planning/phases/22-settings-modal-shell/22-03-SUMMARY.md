---
phase: 22-settings-modal-shell
plan: 03
subsystem: platform
tags: [settings-modal, native-menu, tray, set-menu, platform-seam, tauri, wcag-aa, focus-return]

# Dependency graph
requires:
  - phase: 22-settings-modal-shell
    plan: 01
    provides: settingsStore (openSettings/closeSettings), shell-mounted SettingsModal, settingsPanes registry, #/settings/license deep-link
provides:
  - macOS app menu "TinkerDev ▸ Settings…" bound to ⌘, → emits menu://open-settings (SET-01)
  - tray "Settings…" item → emits the same menu://open-settings (SET-02)
  - app.set_menu() rebuild of the COMPLETE menu (App/Edit/Window) so Copy/Paste/Undo/Select-All/Quit survive (Pitfall 1)
  - platform seam events.onOpenSettings (tauri.ts is the sole menu://open-settings listener; browser/stub no-op)
  - App.tsx subscription → openSettings('license', document.body) with a persistent native-opener return target
affects: [23-25 settings panes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Native menu/tray → webview via the menu://open-settings event seam (mirrors the shipped menu://check-updates channel); ONLY tauri.ts imports @tauri-apps/api/event (D-12)"
    - "set_menu() REPLACES the macOS auto-default, so the App/Edit/Window submenus are reconstructed via SubmenuBuilder (2.11.2 self-chainable predefined items) to avoid stripping Copy/Paste/Undo/Select-All/Quit"
    - "Native opener has no DOM element, so App.tsx passes an explicit persistent return target (document.body) to openSettings for the modal's focus-return path"
    - "Menu/tray subscription is registered AFTER initPlatform resolves (await) so the seam is the real tauri platform, not the pre-init stub"

key-files:
  created: []
  modified:
    - src-tauri/src/lib.rs
    - src/lib/platform/index.ts
    - src/lib/platform/tauri.ts
    - src/lib/platform/browser.ts
    - src/lib/platform/platform.test.ts
    - src/App.tsx
    - src/components/Sidebar.tsx
    - src/components/Sidebar.test.tsx
    - src/shell/testStore.ts

key-decisions:
  - "Full menu rebuild (App/Edit/Window) is mandatory because the app set NO app menu before — a partial set_menu would strip Copy/Paste/Undo/Select-All/Quit from a paste-first app (T-22-11; manual Edit-menu regression check is the backstop)"
  - "Same 'open_settings' id across the app-menu item and the tray arm — both emit the identical no-payload menu://open-settings; the listener does not distinguish source (T-22-08)"
  - "Subscribe AFTER awaiting initPlatform (fix 5bc87ce0) so onOpenSettings binds to the tauri seam, not the default stub"
  - "Settings/license rows pass the clicked element as the focus-return invoker (fix 877d62cb) so Esc returns focus to a connected element, not <body>"
  - "Restored the standard macOS Window submenu items (fix 977fd00c) after the initial rebuild dropped them"

requirements-completed: [SET-01, SET-02]

# Metrics
duration: 22-03 spanned native build + manual walkthrough (multi-step, autonomous=false)
completed: 2026-06-15
---

# Phase 22 Plan 03: Native Menu/Tray Settings Entry Points Summary

**Added the two native Settings entry points — the macOS app menu `TinkerDev ▸ Settings…` (⌘,) and a tray `Settings…` item — both emitting a new `menu://open-settings` event that flows through the `platform/` seam (`tauri.ts` listen → `events.onOpenSettings` → `App.tsx` `openSettings('license', document.body)`), with a full `set_menu()` rebuild of the App/Edit/Window submenus so the paste-first app keeps Copy/Paste/Undo/Select-All/Quit.**

## Performance

- **Tasks:** 4 (3 auto + 1 human-verify checkpoint, autonomous=false)
- **Files modified:** 9 (0 created, 9 modified)

## Accomplishments
- **Platform seam (Task 1):** added `events.onOpenSettings(handler)` across the seam — the `Platform` interface (`index.ts`), the sole `listen("menu://open-settings", …)` (`tauri.ts`, the only `@tauri-apps/*` importer), and the deterministic no-ops (`browser.ts` + the test stub in `testStore.ts`) so every spread `Platform` literal stays type-valid. tsc/eslint/vitest green.
- **Rust menu/tray (Task 2):** rebuilt the macOS app menu via `app.set_menu()` using `SubmenuBuilder` — App (About/Settings…/Services/Hide/Quit), Edit (Undo/Redo/Cut/Copy/Paste/Select-All), Window (Minimize/Close). Added the `Settings…` app-menu item bound to `CmdOrCtrl+,` and a `Settings…` tray item, both with the `open_settings` id emitting `menu://open-settings`. single-instance stays first plugin; tray summon (unminimize→show→set_focus) unchanged. `cargo build` green; `cargo test license::` still green.
- **App.tsx subscription (Task 3):** subscribed `platform.events.onOpenSettings` → `openSettings("license", document.body)`, passing the persistent return target because the native opener is not a DOM element. tsc + full vitest green; decoder untouched.
- **Manual walkthrough (Task 4):** authored `22-HUMAN-UAT.md`; the human walkthrough was **APPROVED 2026-06-15** — app-menu ⌘, + tray Settings… open the modal; the Edit menu (Copy/Paste/Undo/Select-All/Quit) survived the set_menu rebuild; native-opener focus-return, upsell stacking, and native single-instance summon all good.

## Task Commits

1. **Task 1: Platform seam events.onOpenSettings** - `40e8810e` (feat)
2. **Task 2: rebuild macOS app menu + tray Settings…** - `90380985` (feat)
3. **Task 3: App.tsx subscribe onOpenSettings** - `c888a454` (feat)
4. **Task 4: author native menu/tray + Edit-menu-regression UAT** - `47f87948` (docs)

Post-walkthrough fixes (none blocked approval):
- `5bc87ce0` (fix) — await initPlatform before subscribing native menu/tray events
- `877d62cb` (fix) — pass the clicked element as the focus-return invoker on Settings/license rows
- `977fd00c` (fix) — restore the standard macOS Window submenu items
- `c8b1f737` (docs) — record walkthrough approval + 2 non-blocking follow-ups

## Files Modified
- `src-tauri/src/lib.rs` - set_menu App/Edit/Window rebuild + ⌘, Settings item + tray Settings… item + 2 emit arms
- `src/lib/platform/index.ts` - events.onOpenSettings added to the Platform interface
- `src/lib/platform/tauri.ts` - onOpenSettings listen("menu://open-settings") — sole @tauri-apps importer
- `src/lib/platform/browser.ts` - deterministic onOpenSettings no-op
- `src/lib/platform/platform.test.ts` - seam coverage for the new capability
- `src/App.tsx` - onOpenSettings subscription (post-initPlatform) → openSettings('license', document.body)
- `src/components/Sidebar.tsx` / `Sidebar.test.tsx` - clicked-element focus-return invoker on Settings/license rows
- `src/shell/testStore.ts` - test-stub no-op for events.onOpenSettings

## Decisions Made
- **Full menu rebuild is mandatory:** the app set NO app menu before, so `set_menu()` replaces the auto-default — a partial menu would strip Copy/Paste/Undo/Select-All/Quit. The complete App/Edit/Window rebuild + the manual Edit-menu regression check (Task 4 step 3) is the backstop (T-22-11; WebDriver cannot assert native menus).
- **Shared `open_settings` id, no payload:** the app-menu item and the tray arm use the same id and emit the identical no-payload `menu://open-settings`; the listener ignores any data (T-22-08).
- **Subscribe after initPlatform; explicit return target:** the subscription awaits initPlatform so it binds the real tauri seam; `document.body` is passed as the persistent focus-return target for the native opener.

## Deviations from Plan
- Plan listed `stub.ts`; the actual shared test no-op lives in `src/shell/testStore.ts` + `platform.test.ts` — same Rule-3 intent (every spread Platform literal stays type-valid), different file.
- Three post-walkthrough fixes were needed beyond the 3 auto tasks (initPlatform await, focus-return invoker, Window submenu restore). None blocked the human approval.

## Threat Surface
The plan's register is honored: no-payload event (T-22-08), no new Tauri capability (T-22-09 accept), seam isolation — only tauri.ts imports @tauri-apps (T-22-10), full menu rebuild + manual Edit-menu check guards the set_menu regression (T-22-11), and the listener is registered at mount long before any user-initiated emit (T-22-12).

## Issues Encountered
- Initial rebuild dropped the standard Window submenu items (restored in 977fd00c) and the listener was bound to the pre-init stub (fixed by awaiting initPlatform in 5bc87ce0). Both surfaced during the manual walkthrough and were fixed without re-opening the approval.

## Follow-ups (non-blocking, parked — see 22-FOLLOWUP.md)
1. **BUG (small):** the app menu shows "devtools-app" (binary name) instead of "TinkerDev" on About/Hide/Quit + the bold title — needs explicit predefined-item text / product name. Native change → rebuild + manual re-verify.
2. **DESIGN (revises SET-06):** prefer the upsell/activation rendered INLINE in the License pane instead of a stacked UpsellModal — extract the upsell surface into a shared content component. Candidate for a 22.1 gap-closure plan.

## Next Phase Readiness
- All four Settings entry points (sidebar row, ⌘K command, app menu ⌘,, tray) now open the single Settings surface; SET-01 + SET-02 complete.
- Decoder + its 19 tests untouched; no new runtime deps.

## Self-Check: PASSED

All 9 modified files verified on disk; all 4 task commits (40e8810e, 90380985, c888a454, 47f87948) + 3 fixes verified in git history; acceptance greps (onOpenSettings across seam, set_menu/SubmenuBuilder/Edit-items/CmdOrCtrl+, in lib.rs, openSettings('license', document.body) in App.tsx) all pass; decoder clean. Human walkthrough APPROVED 2026-06-15.

---
*Phase: 22-settings-modal-shell*
*Completed: 2026-06-15*
