---
status: partial
phase: 22-settings-modal-shell
plan: 03
source: [22-03-PLAN.md, 22-01-SUMMARY.md, 22-02-SUMMARY.md, 22-RESEARCH.md]
started: 2026-06-15
updated: 2026-06-15
---

## Current Test

[awaiting human walkthrough — native app-menu / tray / Edit-menu regression]

## Context

Phase 22 Plan 03 code deliverables are complete and ALL automated gates are green:
- `pnpm exec tsc --noEmit` + `eslint` clean (2 pre-existing SidebarResetMenu warnings, out of scope)
- vitest **966/966**
- `cargo build` 0 warnings; `cargo test license::` **82/82**
- real-WKWebView e2e **20/20 spec files** (no webview regression from the seam change)
- `pnpm tauri build` produced the `.app` + `.dmg` (the final non-zero exit is ONLY the
  absent updater-signing key — expected per CLAUDE.md, confirmed via the artifacts below)
- decoder + its 19 tests AND LicenseSettings.tsx byte-for-byte untouched; zero new deps;
  only `tauri.ts` imports `@tauri-apps/*`.

These items need the human because **WebDriver cannot drive the native macOS menu bar or
tray** — SET-01/02 and the `set_menu()` Edit-menu regression are manual-walkthrough only.

Built app to test:
`src-tauri/target/release/bundle/macos/TinkerDev.app`
(DMG: `src-tauri/target/release/bundle/dmg/TinkerDev_0.3.1_aarch64.dmg`)

NOTE: the dev-vs-release storage split (D-52) means this RELEASE app reads the prod
Keychain/`machine.lic` — it will show the FREE state unless a prod-CE license is present.
That is fine for this walkthrough (Settings opens for everyone, incl. unlicensed — D-S10);
the License pane just shows the no-license/Unlock-Pro state.

## Tests

### 1. App menu opens Settings (SET-01)
expected: In the menu bar, `TinkerDev ▸ Settings…` opens the Settings modal on the License
pane. The item shows the `⌘,` accelerator. Pressing `⌘,` (no menu click) also opens the modal.
result: [pending]

### 2. Tray opens Settings (SET-02)
expected: Click the tray icon → the tray menu now reads `Show TinkerDev / Settings… /
Check for Updates… / Quit`. Clicking `Settings…` opens the same Settings modal on the
License pane.
result: [pending]

### 3. Edit-menu regression — set_menu did NOT strip the defaults (Pitfall 1, CRITICAL)
expected: Because `set_menu()` REPLACES the whole macOS menu, verify the rebuilt menu still
has everything a paste-first app needs:
- An **Edit** menu with **Undo / Redo / Cut / Copy / Paste / Select All**, and ⌘C / ⌘V / ⌘X /
  ⌘A / ⌘Z all WORK inside a tool's text field (e.g. paste a blob into the Protobuf decoder).
- The **App (TinkerDev)** menu has **About TinkerDev**, **Hide**, **Hide Others**, **Show All**,
  and **Quit (⌘Q works)**.
- A **Window** menu with **Minimize** and **Close**.
result: [pending]

### 4. Native-opener focus-return
expected: Open Settings from the app menu (or ⌘,), then press **Esc** → the modal closes
cleanly and keyboard focus lands on a connected element (not a detached `<body>` trap).
Backdrop click and the × control also dismiss.
result: [pending]

### 5. Upsell stacking from the License pane (Pitfall 6)
expected: From the License pane (unlicensed), click "Activate a license" / "Unlock Pro" →
the Unlock Pro upsell modal appears ON TOP of the Settings modal (not behind the scrim).
Pressing **Esc** closes the upsell FIRST (the Settings modal stays open underneath).
result: [pending]

### 6. No regressions to native summon
expected: Tray left-click still summons/focuses the main window. A second app launch
(single-instance) still summons the existing window rather than opening a new one.
result: [pending]

## Resume Signal

Type **"approved"** when all six pass, or describe any issue — ESPECIALLY a missing Edit-menu
item (the `set_menu` regression backstop).
