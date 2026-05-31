---
status: issues
phase: 05-native-polish
source: [05-04 boundary gate, checkpoint:human-verify]
started: 2026-05-31T15:00:00Z
updated: 2026-05-31T15:30:00Z
---

## Current Test

[human verification complete — tray / single-instance / geometry PASS; summon chord FAILED; see Gaps]

## Tests

### 1. Global summon (NAT-01)
expected: |
  From another app (Finder/Safari), pressing the summon chord brings DevTools to the
  front WITH keyboard focus. Works when minimized and when behind other apps.
result: issue
notes: |
  Cmd+Shift+D does nothing on the packaged build. Root cause: the default chord
  collides with a macOS/Finder system shortcut ("Go to Desktop" / "Don't Save"), so
  plugin-global-shortcut `register()` throws — and registerSummon() swallows the error
  with a console.warn (invisible in a packaged app). User wants a USER-CONFIGURABLE
  shortcut, not just a different hardcoded default.

### 2. Tray (NAT-02)
expected: |
  Menu-bar tray icon present; menu has "Show DevTools" + "Quit"; Show restores +
  focuses a minimized window; Quit exits.
result: passed

### 3. Single-instance (NAT-02)
expected: |
  Relaunching the .app while running focuses the existing window — no second window.
result: passed

### 4. Window geometry (SHL-05 / D-11)
expected: |
  Move + resize, Quit fully, relaunch → restores last position/size + last tool, no
  blank-window flash.
result: passed

## Summary

total: 4
passed: 3
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

### G-05-1: Summon chord fails on the default (collision + silent failure)
source_test: 1 (Global summon)
severity: high
requirement: NAT-01
detail: |
  The default summon chord `CommandOrControl+Shift+D` (src/shell/summon.ts:21) does
  not fire on macOS — it collides with a system/Finder shortcut, plugin-global-shortcut
  `register()` throws, and registerSummon() (summon.ts:61-76) catches+warns silently so
  the failure is invisible in the packaged app.

  DECISION (user, 2026-05-31): ship NO auto-registered global chord. Rationale:
  macOS gives no reliable "is this chord taken?" API; any hardcoded default is a guess
  that may either fail silently OR shadow one of the user's own shortcuts system-wide
  while the app runs. Since the tray "Show DevTools" + single-instance already provide
  reliable, conflict-free summon, a contended global key grab is not worth the risk.

  IN-PHASE change (Phase 5 gap closure):
  1. Stop auto-registering the summon chord at startup — remove the registerSummon()
     call from main.tsx (and/or make registerSummon a no-op / delete summon.ts's
     registration path). KEEP the platform seam (platform.nativeShortcut + summon
     action) intact — the future Settings phase reuses it for an explicit opt-in.
  2. Summon is delivered THIS milestone via the tray menu + single-instance only.

  IMPLICATION: NAT-01 (global summon shortcut, user-configurable) is NOT delivered as a
  hotkey this milestone — its hotkey form DEFERS to the future Settings phase. Mark
  NAT-01 accordingly (deferred/partial) at Phase 5 completion; do NOT claim it complete.
status: failed

## Deferred (future Settings phase)

- **Configurable summon shortcut** — chord recorder UI + persistence (platform.store)
  + unregister-old/register-new + visible failure. Reuses the platform.nativeShortcut
  + summon seam left in place by G-05-1 (no chord is registered until the user opts in).
  This is where NAT-01's hotkey form is actually delivered.
- **Theme selection**, **licenses/acknowledgements**, and other preferences.
- Capture via `/gsd-add-backlog` or insert as a phase after Phase 6 (Distribution).
