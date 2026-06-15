---
phase: 22-settings-modal-shell
verified: 2026-06-15T17:00:00Z
status: passed
score: 15/15 must-haves verified
overrides_applied: 0
human_verification_note: "SET-01/02 native macOS chrome verified via the APPROVED manual walkthrough (2026-06-15, 22-HUMAN-UAT/22-FOLLOWUP) — WebDriver cannot drive the native menu bar/tray, so the documented human-verify gate is the verification of record; no re-verification needed."
follow_ups_non_blocking: # parked in 22-FOLLOWUP.md — do NOT treat as gaps
  - "App menu shows binary name 'devtools-app' instead of 'TinkerDev' on About/Hide/Quit + title (cosmetic; native rebuild + re-verify)"
  - "Design preference to render the upsell/activation INLINE in the License pane instead of a stacked UpsellModal (revises SET-06; candidate for a 22.1 follow-up)"
---

# Phase 22: Settings Modal Shell Verification Report

**Phase Goal:** Anyone — including unlicensed users — can open a real Settings surface from every conventional entry point, and it renders as an accessible in-window modal with a paned layout whose first pane is the existing License surface unchanged.

**Verified:** 2026-06-15T17:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

The phase goal decomposes into four outcomes, all verified in the actual codebase: (1) all four entry points open Settings, (2) it renders as an accessible in-window modal, (3) it uses a keyboard-navigable paned layout, (4) the first pane is the existing License surface unchanged. Open-for-everyone (D-S10) is satisfied — the sidebar Settings row and deep-link/native openers are unconditional with no entitlement gate.

### Observable Truths

| #  | Truth | Status | Evidence |
| -- | ----- | ------ | -------- |
| 1  | `openSettings('license')` opens one shell-level modal on the License pane; `closeSettings()` closes it | VERIFIED | `settingsStore.ts:72/99` exports open/close; idempotent open guard; `App.tsx:218` mounts `<SettingsModal/>` once, driven by `useSettingsOpen()` |
| 2  | Modal is `role=dialog aria-modal=true aria-labelledby` (Settings title), traps Tab, returns focus to synchronously-captured invoker | VERIFIED | `SettingsModal.tsx:155-156` aria-modal/labelledby; `:62` `getSettingsInvoker() ?? document.activeElement` read once; `:104` Tab-wrap trap; cleanup return-focus cloned from UpsellModal |
| 3  | Esc, backdrop mousedown, and × control all close | VERIFIED | `SettingsModal.tsx` keydown Esc→close, scrim `onMouseDown` target===currentTarget close, × button `aria-label="Close settings"` (`:171`) |
| 4  | Left nav renders pane registry; active pane `aria-current="page"` + announced via `aria-live=polite`; Arrow/Home/End move pane clamped (no wrap) | VERIFIED | `SettingsModal.tsx:194` aria-current; `:228` aria-live sr-only "{label} settings"; `:94-100` ArrowDown/Up/Home/End with `Math.min(last,…)`/`Math.max(0,…)` clamp |
| 5  | License pane renders `<LicenseSettings/>` UNCHANGED (no double-pad) | VERIFIED | `settingsPanes.tsx:30` `render: () => <LicenseSettings/>` rendered directly into `bg-pane flex-1 overflow-auto`; `LicenseSettings.tsx` last touched in Phase 21 (931b7bca), clean working tree |
| 6  | Deep-link `#/settings/license` opens modal on License pane, no duplicate in-window License surface | VERIFIED | `router.tsx:52` route → `<SettingsDeepLink/>`; `SettingsDeepLink.tsx:23` `openSettings("license", document.body)` then `<Navigate to="/" replace/>`; no `element: <LicenseSettings/>` remains |
| 7  | Sidebar has a bottom-anchored unconditional gear "Settings" row (no lock badge) → `openSettings('license')` | VERIFIED | `Sidebar.tsx:669` last footer child, unconditional (outside the licenseAttention ternary), `<Settings/>` gear, `openSettings("license", e.currentTarget)` |
| 8  | ⌘K palette has a production "Settings" command → opens modal, passing pre-palette focus | VERIFIED | `CommandPalette.tsx:236-239` `id:"settings" name:"Settings"` run `openSettings("license", preOpenFocus)` |
| 9  | D-88 footer "License needs attention" + ⌘K "License" command now open Settings (manageable) instead of `navigate('/settings/license')` | VERIFIED | `Sidebar.tsx:125` `if (hasManageableLicense) openSettings("license", invokerEl)`; `CommandPalette.tsx:224` re-point; no `navigate("/settings/license")` in either file |
| 10 | Free-tier "Unlock Pro" + LicenseSettings Reactivate/Activate STILL open the upsell (unchanged) | VERIFIED | `Sidebar.tsx:126` `else openOrderingUpsell(invokerEl)`; `CommandPalette.tsx:223` `openUpsell(preOpenFocus)` for notActivated; LicenseSettings untouched |
| 11 | macOS app menu has "Settings…" under TinkerDev (app) submenu bound to ⌘, emitting `menu://open-settings` | VERIFIED (code) + APPROVED (walkthrough) | `lib.rs:143` MenuItem id `open_settings` accel `CmdOrCtrl+,`; `:196-197` on_menu_event emits `menu://open-settings`; walkthrough APPROVED 2026-06-15 |
| 12 | Tray menu has a "Settings…" item emitting `menu://open-settings` | VERIFIED (code) + APPROVED (walkthrough) | `lib.rs:211` tray item, `:232-233` arm emits `menu://open-settings`; tray order `show/settings/check_updates/quit` (`:217`); walkthrough APPROVED |
| 13 | `app.set_menu()` builds a COMPLETE menu (App/Edit/Window) — Copy/Paste/Undo/Select-All/Quit NOT lost | VERIFIED (code) + APPROVED (walkthrough) | `lib.rs:146` App submenu `.quit()`, `:163-170` Edit `.undo()/.redo()/.cut/.copy/.paste/.select_all`, `:178` Window `.minimize/.close_window`, `:190` `set_menu`; Edit-menu regression check APPROVED in walkthrough (Pitfall 1 backstop) |
| 14 | Platform seam exposes `events.onOpenSettings(cb)`; tauri.ts is the SOLE `menu://open-settings` listener; browser.ts deterministic no-op | VERIFIED | `index.ts:119` interface; `tauri.ts:120-121` `listen("menu://open-settings",…)` (only `@tauri-apps/*` importer in repo); `browser.ts:98-99` `async onOpenSettings(){ return ()=>{}; }` |
| 15 | App.tsx subscribes `platform.events.onOpenSettings` → `openSettings('license', document.body)` with persistent return target | VERIFIED | `App.tsx:130-131` subscription; awaits `initPlatform()` first (HIGH-22-01 race fix) so it binds the real Tauri seam; App.tsx imports no `@tauri-apps/*` |

**Score:** 15/15 truths verified (Truths 11-13 are native macOS chrome — code-verified AND covered by the APPROVED manual walkthrough, the verification of record per 22-HUMAN-UAT).

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/shell/settingsStore.ts` | open/close/activePane/invoker + subscribe | VERIFIED | 105 lines; all 7 exports present; jsdom guard (`typeof HTMLElement`) preserved |
| `src/shell/useSettings.ts` | useSyncExternalStore hooks | VERIFIED | `useSettingsOpen` + `useActivePane` via `useSyncExternalStore` |
| `src/components/settingsPanes.tsx` | extensible pane registry | VERIFIED | `SETTINGS_PANES` array, License pane renders `<LicenseSettings/>` |
| `src/components/SettingsModal.tsx` | paned modal, cloned a11y, pane nav, aria-live | VERIFIED | 234 lines; all a11y attrs + clamped pane nav + stacked-upsell Esc guard |
| `src/shell/SettingsDeepLink.tsx` | openSettings then redirect (D-S6) | VERIFIED | calls `openSettings("license", document.body)` + `<Navigate replace/>` |
| `src/components/Sidebar.tsx` | bottom Settings row + D-S11 re-point | VERIFIED | unconditional row + re-pointed openLicenseSurface; useNavigate dropped |
| `src/components/CommandPalette.tsx` | Settings command + License re-point | VERIFIED | settingsCommand + re-pointed licenseCommand; navigate kept for tools |
| `src/lib/platform/index.ts` | events.onOpenSettings interface | VERIFIED | declared on Platform.events; no `@tauri-apps` import |
| `src/lib/platform/tauri.ts` | sole menu://open-settings listener | VERIFIED | `listen("menu://open-settings",…)`; only `@tauri-apps/*` importer |
| `src/lib/platform/browser.ts` | deterministic no-op | VERIFIED | returns `()=>{}` |
| `src-tauri/src/lib.rs` | set_menu rebuild + tray Settings + 2 emit arms | VERIFIED | App/Edit/Window submenus, ⌘, item, tray item, both emit `menu://open-settings`; single_instance still first plugin (`:19`) |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| App.tsx | SettingsModal.tsx | shell mount driven by useSettings, BEFORE UpsellModal | WIRED — SettingsModal `:218` precedes UpsellModal `:222` (Pitfall 6 z-tie) |
| router.tsx | SettingsDeepLink.tsx | settings/license route element | WIRED |
| settingsPanes.tsx | LicenseSettings.tsx | `render: () => <LicenseSettings/>` | WIRED |
| Sidebar.tsx | settingsStore.ts | `openSettings('license')` from row + attention affordance | WIRED |
| CommandPalette.tsx | settingsStore.ts | `openSettings('license', preOpenFocus)` from Settings + License commands | WIRED |
| lib.rs | tauri.ts | `emit('menu://open-settings')` → `listen('menu://open-settings')` | WIRED (string-matched both ends) |
| tauri.ts | App.tsx | `events.onOpenSettings` → `openSettings('license', document.body)` | WIRED |

### Behavioral Spot-Checks

| Behavior | Method | Result | Status |
| -------- | ------ | ------ | ------ |
| Unit suite (incl. 19 decoder tests) | vitest (confirmed this session) | 967/967 green, 78 files | PASS |
| Type safety | tsc --noEmit (confirmed this session) | clean | PASS |
| decoder.ts immovable | git log/status | last touched Phase 01 (90583b79), clean tree | PASS |
| LicenseSettings.tsx unchanged (SET-06) | git log/status | last touched Phase 21, clean tree | PASS |
| Native menu/tray + Edit-menu regression | manual walkthrough (WebDriver cannot drive native chrome) | APPROVED 2026-06-15 | PASS (human, of record) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| SET-01 | 22-03 | App menu (⌘,) opens Settings via seam | SATISFIED | lib.rs ⌘, item → menu://open-settings → seam → App.tsx; walkthrough APPROVED |
| SET-02 | 22-03 | Tray item opens Settings via same seam | SATISFIED | lib.rs tray item → same event; walkthrough APPROVED |
| SET-03 | 22-02 | Sidebar row + ⌘K palette open Settings | SATISFIED | Sidebar row + CommandPalette settingsCommand |
| SET-04 | 22-01 | In-window modal, Esc-dismissible, WCAG-AA, reachable by everyone | SATISFIED | SettingsModal aria-modal/labelledby/trap/return; unconditional entry points |
| SET-05 | 22-01 | Paned layout, keyboard-navigable, active pane announced | SATISFIED | left nav + aria-current + aria-live + Arrow/Home/End clamp |
| SET-06 | 22-01 | License pane reuses LicenseSettings unchanged | SATISFIED | settingsPanes renders it directly; file byte-untouched in phase 22 |

All 6 phase requirement IDs (SET-01..06) accounted for. REQUIREMENTS.md traceability lists SET-03/04/05/06 Validated and SET-01/02 Planned (22-03) — SET-01/02 are now satisfied (code + APPROVED walkthrough); the traceability row status should advance to Validated/Complete. No orphaned requirements for this phase.

### Anti-Patterns Found

None blocking. No stubs, placeholder returns, or dead wiring in the phase artifacts. Two NON-BLOCKING follow-ups are parked in 22-FOLLOWUP.md (see frontmatter `follow_ups_non_blocking`): (1) cosmetic app-menu label shows binary name "devtools-app" not "TinkerDev"; (2) design preference for inline upsell in the License pane (revises SET-06 forward). Neither is a gap against this phase's goal.

### Human Verification Required

None outstanding. The only items requiring human testing — SET-01/02 native macOS app-menu and tray behavior plus the `set_menu()` Edit-menu regression (WebDriver cannot drive native chrome) — were verified via the manual walkthrough recorded in 22-HUMAN-UAT.md / 22-FOLLOWUP.md and APPROVED 2026-06-15. Per the phase's autonomous=false human-verify gate, that approval is the verification of record; no re-verification is requested.

### Gaps Summary

No gaps. All 15 must-haves are verified in the actual codebase: the platform seam exists with tauri.ts as the sole `menu://open-settings` listener; lib.rs rebuilds a complete App/Edit/Window menu with the ⌘, Settings item and tray Settings item both emitting the event; App.tsx subscribes (post-initPlatform) and opens the modal with `document.body` as the persistent return target; the sidebar Settings row and ⌘K command are wired; SettingsModal has full WCAG-AA a11y (focus trap/return, aria-modal/labelledby, Esc/backdrop/× dismiss, aria-current pane nav, aria-live announce); and the License pane reuses LicenseSettings unchanged (file byte-untouched, decoder untouched). The native-chrome truths are additionally backed by the APPROVED manual walkthrough.

---

_Verified: 2026-06-15T17:00:00Z_
_Verifier: Claude (gsd-verifier)_
