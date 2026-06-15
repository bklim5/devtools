# Seed — Native Preferences / Settings window

**Status:** seed (not scheduled) · **Captured:** 2026-06-15 (during Phase 21 walkthrough)
**Trigger:** the deferred **Settings surface** milestone (see ROADMAP backlog).
**Origin:** Phase 21 (License Lifecycle & Ship Gate) human-verify walkthrough. The `#/settings/license`
status route is an *in-window* route — functional, but it keeps the sidebar visible while the main
pane shows settings, which reads as confusing, and (by D-88) a pure-free user has no clean entry to it.

## The idea

Move License **and all future settings** into a **native macOS Preferences window**, the conventional
pattern, reachable by everyone (including unlicensed users, who see a "No license" + Unlock-Pro state).

### Entry points
- **App menu:** `TinkerDev ▸ Settings…` bound to **⌘,** (the menu currently has no Settings item — see `03-app-menu-tinkerdev.png`).
- **Tray menu:** a `Settings…` item (tray currently only has Show / Check for Updates / Quit — see `02-tray-menu.png`).
- **Sidebar:** a `Settings` row **above** "Unlock Pro" (mirrors Claude's settings entry — see `04-claude-settings-sidebar-entry.png`).

### Window shape
- A **separate window** (not an in-main-window route), tabbed/segmented panes like DevUtils' Preferences
  (`01-devutils-preferences-window.png`) or Claude's settings modal (`05-claude-settings-window.png`).
- Pane scaffold: **General · Appearance/Themes · Hotkeys · Updates · License** (extend as features land).
- The **License pane reuses today's `src/components/LicenseSettings.tsx` unchanged** — the flip/lifecycle/
  state machine (5 states, masked key, email, Refresh, confirm-first Deactivate, drop notice) is the hard
  part and is already built + tested in Phase 21. This seed is the *housing*, not a rebuild.
- Unlicensed → the License pane shows the No-license state + Unlock Pro / Buy / Enter-key (the upsell can
  live here too), so settings are reachable without a license.

## Why deferred (not built in Phase 21)
A native Preferences window is cross-cutting: Tauri multi-window management (Rust + JS), app-menu wiring,
tray entry, its own UI-SPEC + WCAG-AA audit. That's a multi-plan effort and an explicitly deferred
milestone; Phase 21's scope is the licensing lifecycle + ship gate. LIC-09 is satisfied by the in-window
route. The ⌘K free-tier "License" silent-no-op found in the same walkthrough was fixed in-scope (it now
opens the Unlock Pro upsell, parity with the footer).

## References
- `01-devutils-preferences-window.png` — DevUtils Preferences window (tabbed; License tab with Buy / FAQs / Enter Key + "Show license status in sidebar" toggle).
- `02-tray-menu.png` — current TinkerDev tray menu (no Settings item yet).
- `03-app-menu-tinkerdev.png` — current `TinkerDev` app menu (no Settings item yet; ⌘, free).
- `04-claude-settings-sidebar-entry.png` — Claude desktop: settings entry at the bottom-left of the sidebar.
- `05-claude-settings-window.png` — Claude desktop: settings open as a separate paned surface.
