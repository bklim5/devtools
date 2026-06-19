---
phase: 24-hotkeys-general-panes
plan: 04
subsystem: ui
tags: [general-pane, toggles, sidebar, autostart, default-tool, wcag-aa, settings-order]
requires:
  - "src/components/settingsPanes.tsx — append-only SETTINGS_PANES registry (Plan 03 / D-23-10)"
  - "src/lib/platform/ — autostart enable/disable/isEnabled seam (FND-04)"
  - "src/lib/tools/registry.ts — ENABLED_TOOLS drives the default-tool options"
  - "src/shell/usePreferences.ts — single-writer prefs seam (Phase 23)"
provides:
  - "src/components/GeneralSettings.tsx — Settings ▸ General pane (launch-at-login, start-in-tray, default tool)"
  - "src/components/SettingToggle.tsx — reusable accessible role=switch toggle"
  - "settingsPanes.tsx General entry; panes reordered General > Hotkeys > Appearance > License"
provides-native:
  - "Global summon (configurable chord) + start-in-tray launch reveal — now functional (window capabilities granted)"
affects:
  - "Closes Phase 24 (SET-08 + SET-09 Validated)"
tech-stack:
  added: []
  patterns:
    - "Reusable SettingToggle (role=switch + aria-checked + aria-describedby; state by accent fill, never opacity) drives every General boolean control"
    - "Launch-at-login reconciles to the OS truth on mount (platform.autostart.isEnabled) AND persists intent on flip; OS-reject persists nothing + announces"
    - "One shared formatAccelerator() renders every chord-display surface as macOS glyphs; the header pill synthesizes the CONFIGURED chord (acceleratorToKeyboardInit) so a rebind keeps display + click in sync"
    - "Generic Settings openers (sidebar gear, app-menu/tray, ⌘K Settings) land on General; License-specific openers (Unlock Pro, deep-link, ⌘K License) open License"
key-files:
  created:
    - "src/components/GeneralSettings.tsx (+ GeneralSettings.test.tsx)"
    - "src/components/SettingToggle.tsx (+ SettingToggle.test.tsx)"
  modified:
    - "src/components/settingsPanes.tsx (General entry + pane reorder)"
    - "src/components/Sidebar.tsx (Settings gear -> General; Unlock-Pro affordance ungated)"
    - "src/shell/hotkeyAccelerator.ts (formatAccelerator, acceleratorToKeyboardInit, symbol keys)"
    - "src-tauri/capabilities/default.json (window show/set-focus/unminimize)"
    - "src/shell/settingsStore.ts (default landing pane -> general)"
decisions:
  - "Show-license-status toggle DROPPED (user decision at the walkthrough): its only effect was hiding the sidebar Unlock-Pro button, which read as pointless; the affordance now always shows per its license condition. SET-09 ships THREE controls, not four — the showLicenseInSidebar preference was removed end-to-end."
  - "Native summon + launch-reveal were silently broken until the walkthrough: the JS window.show()/setFocus()/unminimize() calls were rejected by the capability gate (core:window:default omits those mutating commands). The tray 'Show' worked only because it is native Rust. Fixed by granting core:window:allow-show/set-focus/unminimize."
  - "Chord display is configurable everywhere: a single formatAccelerator() renders ⌘K/⇧⌘D glyphs; the header pill's CLICK now synthesizes the configured chord (not a hard-coded ⌘K) so a rebind stays consistent."
  - "Symbol-row keys (; ' [ ] \\ ` - =) Tauri's accelerator parser accepts are now bindable; KNOWN_MAIN_KEYS derives from CODE_TO_KEY (one source)."
  - "Settings panes reordered to General > Hotkeys > Appearance > License; the default landing pane for generic Settings entry points is General."
requirements-completed: [SET-09, SET-08]
duration: ~2h (plan execution + phase-boundary walkthrough fixes)
completed: 2026-06-19
---

# Phase 24 Plan 04: General Settings Pane + Phase-Boundary Walkthrough Summary

**Settings ▸ General pane (SET-09): reusable accessible `SettingToggle` drives the app-behavior controls (launch-at-login via the autostart seam, start-in-tray, default-tool select), appended to `SETTINGS_PANES`. The phase-boundary human walkthrough then surfaced and fixed the native summon/launch-reveal capability gap, configurable chord display, symbol-key binding, capture feedback, and a Settings-pane reorder — completing SET-08 (native) and SET-09.**

## Performance

- **Duration:** ~2h (plan execution + the phase-boundary walkthrough fix cycle)
- **Files created:** 2 (GeneralSettings + test, SettingToggle + test)
- **Files modified (plan):** settingsPanes.tsx, Sidebar.tsx, hotkeys.e2e.ts
- **Files modified (walkthrough):** capabilities/default.json, hotkeyAccelerator.ts, App.tsx, HotkeyCaptureField.tsx, HotkeysSettings.tsx, settingsStore.ts, CommandPalette.tsx, preferences/prefsStore/usePreferences, settings.e2e.ts (+ tests)

## Accomplishments

### Plan 24-04 (General pane)
- **Reusable `SettingToggle`** — native `<button role="switch">` + `aria-checked`, `aria-describedby` linking the helper line, keyboard-operable (Space/Enter), state shown by accent fill + knob position (never opacity, WCAG 1.4.1).
- **`GeneralSettings` pane** — Launch at login (reconciles to `platform.autostart.isEnabled()` on mount, persists intent on flip, calm announce + no-persist on OS reject), Start in the menu bar, Open to / default tool (`<select>`: "Last used" then each `ENABLED_TOOLS` name; stale-id guard falls back to Last used). A polite aria-live region carries the launch-at-login result.
- **Append-only registry** — General entry added; `SettingsModal.tsx` byte-unchanged.

### Phase-boundary walkthrough fixes (committed `ae0d4d05`, `eb16c74f`)
- **Native summon + launch reveal now work** — granted `core:window:allow-show/set-focus/unminimize`. The JS reveal/summon path was being silently rejected by the capability gate; the tray "Show" masked it (native Rust).
- **Configurable chord display** — `formatAccelerator()` renders glyphs on the header pill + Hotkeys fields; the pill click synthesizes the configured chord (`acceleratorToKeyboardInit`).
- **Symbol-row keys bind** (`; ' [ ] \ ` ` - =`); previously dropped with a misleading hint.
- **Capture feedback** distinguishes "add a modifier" from "that key can't be used"; reserved-chord copy is OS-neutral.
- **Padding** between chord glyphs.
- **showLicenseInSidebar removed** (user decision) — the Unlock-Pro/attention row always shows per its license condition.
- **Settings panes reordered** General > Hotkeys > Appearance > License; generic Settings openers land on General.

## Task Commits

**Plan 24-04 execution:**
1. **SettingToggle (role=switch)** — `24b29a0a` (feat, TDD)
2. **General pane + sidebar gate** — `3809458b` (feat)
3. **General-pane e2e** — `de5723c1` (test)
4. **Simplify (collapse pane-open helpers)** — `2bbc63fd` (refactor)
5. **Code-review hardening (autostart try/catch, default-tool guard, aria-describedby)** — `818a88b8` (fix)
6. **e2e flake (poll switchChecked)** — `3b95b3b1` (test)

**Phase-boundary walkthrough:**
7. **Window capabilities (summon + reveal)** — `ae0d4d05` (fix)
8. **Walkthrough findings (chord display, symbol keys, feedback, license-toggle removal, settings reorder)** — `eb16c74f` (fix)

## Deviations from Plan

### Scope change — Show-license-status toggle dropped (user decision)
- **Found during:** the phase-boundary human walkthrough.
- **Plan said:** four General controls, the fourth being "Show license status in sidebar" gating the sidebar affordance (D-24-11).
- **User decision:** remove it — its only effect was hiding the Unlock-Pro button, which the user judged pointless. SET-09 ships **three** controls; the `showLicenseInSidebar` preference was removed end-to-end (field, default, coercer, setter, the toggle, the Sidebar gate). The Unlock-Pro / "License needs attention" row now always shows per its license condition.

### Bug — native window control rejected by the capability gate
- **Found during:** the walkthrough (summon did nothing; window launched hidden even with start-in-tray off).
- **Root cause:** `core:window:default` omits `allow-show`/`allow-set-focus`/`allow-unminimize`, so the JS `getCurrentWindow()` calls in `summon.ts` + `startupReveal.ts` were silently rejected. The tray "Show" worked because it is native Rust, masking the gap (which is why automated/dev runs never caught it — the dev window is already visible).
- **Fix:** granted the three perms (`ae0d4d05`).

### Bug — header pill click used a hard-coded ⌘K (codex review)
- **Found during:** the codex review of the chord-display change.
- **Issue:** making the pill DISPLAY the configured chord surfaced that its `onClick` still dispatched a hard-coded ⌘K, so after a palette rebind the pill would show the new chord but fail to open the palette.
- **Fix:** `openPalette(chord)` synthesizes the configured chord via `acceleratorToKeyboardInit` (round-trip-tested against `matchesChord`).

### Bug — symbol keys silently unbindable
- **Found during:** the walkthrough (`⌘⇧;` / `⌘⇧'` would not save, with a misleading "add a modifier" hint).
- **Fix:** mapped the symbol-row physical codes Tauri accepts; added the key-specific feedback message.

## Issues Encountered

- The native summon/reveal capability gap is invisible to the unit + WebDriver gates (the dev/e2e window is already shown, and WebDriver cannot synthesize a native global shortcut). It was only findable on the built `.app` — exactly the phase-boundary human walkthrough this plan deferred to. See project memory `verify-gate-builds-real-app`.

## Verification

- **vitest:** 1147/1147.
- **tsc + eslint:** clean (only the 2 pre-existing out-of-scope `SidebarResetMenu` react-refresh warnings).
- **Real-WKWebView e2e:** 24/24 spec files (6 gate runs across the fix cycle).
- **Native walkthrough (human, on the fresh `.app`):** global summon (default + rebind), launch reveal with start-in-tray off, start-in-tray hides + tray/summon reveal, default-tool open, symbol-key binding, configurable chord display, settings order/landing — **all approved by the user 2026-06-19.**
- **/simplify** (4 angles, clean) + **/codex:review** (1 P2 found + fixed) run on the working tree before passback.
- **Decoder immovable bar held:** `decoder.ts` + its 19 tests byte-for-byte untouched.
- **Zero new deps.** **SettingsModal.tsx unchanged** (append-only registry).

## SET-08 status: VALIDATED
The deferred Plan 24-03 Task 4 native walkthrough ran at this phase boundary on the fresh build: native summon re-register from another app, the configurable chord, rebind-survives-relaunch, Reset, and keyboard-only reach — all confirmed by the user. (The capability fix was required to make any of it work.)

## SET-09 status: VALIDATED
The General pane ships three controls (launch-at-login, start-in-tray, default tool), each persisted via the single-writer seam and confirmed taking effect on the real app.

## Self-Check: PASSED
GeneralSettings + SettingToggle (+ tests) present on disk; all 8 commits found in git history; working tree clean.

---
*Phase: 24-hotkeys-general-panes*
*Completed: 2026-06-19*
