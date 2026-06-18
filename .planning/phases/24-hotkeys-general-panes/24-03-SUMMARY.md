---
phase: 24-hotkeys-general-panes
plan: 03
subsystem: ui
tags: [hotkeys, settings-pane, ui, wcag-aa, capture-field]
requires:
  - "src/shell/hotkeyAccelerator.ts — keyEventToAccelerator/isReservedChord (Plan 01)"
  - "src/shell/summon.ts — rebindSummon/SUMMON_CHORD (Plan 02)"
  - "src/shell/usePreferences.ts — summonChord/paletteChord + setSummonChord/setPaletteChord singleton (Plan 01 + Phase 23)"
  - "src/components/settingsPanes.tsx — append-only SETTINGS_PANES registry (Phase 22 / D-23-10)"
provides:
  - "src/components/HotkeyCaptureField.tsx — reusable record/cancel/reject/reset capture field (binding-agnostic)"
  - "src/components/HotkeysSettings.tsx — Settings ▸ Hotkeys pane: two binding rows + aria-live feedback"
  - "settingsPanes.tsx Hotkeys entry (append-only; SettingsModal byte-unchanged)"
  - "test/e2e/hotkeys.e2e.ts — pane render + palette-on-configured-chord + rebind-reflected on the real WKWebView"
affects:
  - "Plan 04 (General pane) appends the next SETTINGS_PANES entry + lands the final webview source before the fresh build"
  - "Phase-boundary human walkthrough verifies native summon re-register + rebind-survives-restart (Task 4, deferred to the 24-04 ship build)"
tech-stack:
  added: []
  patterns:
    - "One reusable capture field drives BOTH binding rows (binding-agnostic via label/otherLabel/otherChord props — no per-binding branching)"
    - "Parent-classified OS reject vs field-classified invalid/reserved/same-as-other (field never commits a dirty chord; parent surfaces the rebindSummon catch)"
    - "Reset routed through the SAME self-collision guard as capture (applySummon/applyPalette reject a target equal to the OTHER binding's current chord)"
    - "Every reject (collision + OS-taken) feeds the polite aria-live region — no stale success text after a failed rebind (WCAG-AA)"
key-files:
  created:
    - "src/components/HotkeyCaptureField.tsx (+ HotkeyCaptureField.test.tsx)"
    - "src/components/HotkeysSettings.tsx (+ HotkeysSettings.test.tsx)"
    - "test/e2e/hotkeys.e2e.ts"
  modified:
    - "src/components/settingsPanes.tsx (Hotkeys entry appended; SettingsModal untouched)"
decisions:
  - "HotkeyCaptureField is binding-agnostic — the simplify pass removed a leaky `label === \"Global summon\"` ternary in favor of an explicit `otherLabel` prop, so the field never special-cases which binding it drives"
  - "Reset is NOT a raw default-write — applySummon/applyPalette run the same self-collision guard, so a user can't free one default and Reset the other onto it (T-24-07; would otherwise collide native summon + webview palette and kill the palette hotkey)"
  - "Palette chord default single-sourced from DEFAULT_PREFERENCES.paletteChord (no second \"CommandOrControl+K\" literal to drift)"
  - "Native summon re-register, taken-chord OS reject, and rebind-survives-restart are NOT WebDriver-drivable — Task 4 human walkthrough deferred to the single phase-boundary sign-off on the fresh build AFTER Plan 24-04 (no-stale-build rule); SET-08 stays PARTIAL until then"
requirements-completed: []
duration: ~40min
completed: 2026-06-18
---

# Phase 24 Plan 03: Hotkeys Settings Pane Summary

**Settings ▸ Hotkeys pane (SET-08): one reusable `HotkeyCaptureField` (record → validate → reject-inline/persist → reset) drives two binding rows — Global summon via `rebindSummon`, Command palette via `setPaletteChord` — appended to `SETTINGS_PANES` with `SettingsModal` byte-unchanged, plus a real-WKWebView e2e.**

## Performance

- **Duration:** ~40 min
- **Tasks:** 3 of 4 (Task 4 = native human walkthrough, deferred to the phase boundary)
- **Files created:** 5 (HotkeyCaptureField + test, HotkeysSettings + test, hotkeys.e2e.ts)
- **Files modified:** 1 (settingsPanes.tsx, append-only)

## Accomplishments

- **Reusable `HotkeyCaptureField`** — button-semantics control (click + Enter/Space record; no mouse-only path), captures via physical `e.code` only, `e.preventDefault()` during recording, Escape cancels with no commit, classifies invalid/reserved/same-as-other inline and only `onCommit`s a clean chord. Binding-agnostic (no per-binding branching).
- **`HotkeysSettings` pane** — two rows (Global summon, Command palette), current chord in mono, per-hotkey Reset, a single polite `aria-live` region carrying every rebind/reset/reject result. Summon commits route through `rebindSummon` (native re-register; on OS reject persist nothing, keep prior chord — D-24-2); palette commits are pure-webview `setPaletteChord` (D-24-6).
- **Append-only registry wiring** — Hotkeys entry inserted after Appearance / before License; `SettingsModal.tsx` byte-unchanged (registry is the single control plane).
- **Real-WKWebView e2e** — `test/e2e/hotkeys.e2e.ts` covers pane reachability, palette-opens-on-configured-chord, rebind-reflected (new chord opens the palette, ⌘K no longer does), and Escape-cancel.

## Task Commits

1. **Task 1: Reusable HotkeyCaptureField** — `66e9c864` (feat, TDD)
2. **Task 2: HotkeysSettings pane + SETTINGS_PANES append** — `a6676b72` (feat)
3. **Task 3: hotkeys.e2e on the real WKWebView** — `85e2179c` (test)
4. **Simplify cleanups** — `4d0a82c3` (refactor)
5. **Code-review fixes** — `1809b591` (fix)
6. **e2e ⌘K regression fix** — `7c9612b2` (fix, phase-scoped)

_Task 4 (native human walkthrough) is a `checkpoint:human-verify` — DEFERRED to the phase-boundary sign-off on the post-24-04 fresh build (see Deviations)._

## Files Created/Modified

- `src/components/HotkeyCaptureField.tsx` — reusable record/cancel/reject/reset capture field; physical-`e.code` capture; `otherLabel`/`otherChord` props keep it binding-agnostic.
- `src/components/HotkeyCaptureField.test.tsx` — recording start, Escape-cancel (no onCommit), valid Cmd+Shift+J commits, reserved Cmd+Space does NOT commit, Option+P composed-glyph (key:"π", code:"KeyP") commits the e.code chord.
- `src/components/HotkeysSettings.tsx` — the Hotkeys pane: two binding rows + `applySummon`/`applyPalette` handlers + the polite aria-live region.
- `src/components/HotkeysSettings.test.tsx` — added in the code-review fix (4 tests covering the self-collision Reset guard + reject announcements).
- `src/components/settingsPanes.tsx` — Hotkeys entry appended (import `Keyboard` + `HotkeysSettings`); `SettingsModal.tsx` untouched.
- `test/e2e/hotkeys.e2e.ts` — pane render, palette-on-configured-chord, rebind-reflected, Escape-cancel on the real WKWebView.

## Decisions Made

- **Binding-agnostic field (simplify):** removed a leaky `label === "Global summon"` ternary in favor of an explicit `otherLabel` prop; the field never special-cases which binding it drives.
- **Single-sourced palette default:** `PALETTE_CHORD` reads `DEFAULT_PREFERENCES.paletteChord` (no second `"CommandOrControl+K"` literal to drift).
- **Folded handlers:** `onCommitSummon`/`onResetSummon` → one `applySummon(accel)`; palette → `applyPalette(accel)`.
- **Reset runs the collision guard (code-review, T-24-07):** Reset is NOT a raw default-write — it goes through `applySummon`/`applyPalette`, which reject a target equal to the OTHER binding's current chord. Without this, a user could rebind one binding away, rebind the other onto the freed default, then Reset the first onto that same chord → native summon + webview palette collide and the palette hotkey goes dead.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reset bypassed the self-collision guard**
- **Found during:** Task 2 (code-review pass)
- **Issue:** The capture field guards against committing a chord equal to the other binding, but the Reset buttons wrote the shipped default directly — a user could rebind binding A away, rebind binding B onto A's freed default, then Reset A onto that same chord, putting native summon and the webview palette on one chord (palette hotkey goes dead).
- **Fix:** `applySummon`/`applyPalette` now reject a target equal to the OTHER binding's current chord, and Reset routes through them.
- **Files modified:** `src/components/HotkeysSettings.tsx` (+ `HotkeysSettings.test.tsx`, 4 tests)
- **Verification:** new tests green; full vitest 1127/1127
- **Committed in:** `1809b591`

**2. [Rule 2 - Missing Critical / WCAG-AA] Rejects were not announced**
- **Found during:** Task 2 (code-review pass)
- **Issue:** The polite aria-live region kept stale success text after a rejected rebind — a screen-reader user heard nothing on a collision or OS-taken reject.
- **Fix:** every reject (collision + OS-taken) now feeds the live region.
- **Files modified:** `src/components/HotkeysSettings.tsx`
- **Verification:** covered by the new HotkeysSettings tests; real-WKWebView e2e green
- **Committed in:** `1809b591`

**3. [Rule 1 - Bug] e2e ⌘K dispatches lacked a physical `code` (cross-spec regression)**
- **Found during:** the no-regression e2e run
- **Issue:** Plan 24-02's `matchesChord` swap made ⌘K detection read the physical `e.code`, but the shared e2e helpers/specs dispatched ⌘K with no `code`; 7 specs cascade-failed (`ensureProTier` "could not establish Pro tier via the ⌘K dev toggle").
- **Fix:** added `code:"KeyK"` to the 4 dispatch sites — `helpers.ts` runDevToggle (⌘⇧K), `cmdk-pro` pressMetaK, `entitlements` runLicenseCommand, `settings` openPalette.
- **Files modified:** `test/e2e/helpers.ts`, `test/e2e/cmdk-pro.e2e.ts`, `test/e2e/entitlements.e2e.ts`, `test/e2e/settings.e2e.ts`
- **Verification:** the 7 regressed specs re-run clean; full real-WKWebView gate 24/24 spec files
- **Committed in:** `7c9612b2` (phase-scoped, not plan-scoped — it touched shared helpers used by other specs)

### Simplify-pass cleanups (`4d0a82c3`, quality-only, no behavior change)

- Added `otherLabel` prop, removing the leaky `label === "Global summon"` ternary (binding-agnostic field).
- Single-sourced `PALETTE_CHORD` from `DEFAULT_PREFERENCES.paletteChord`.
- Folded `onCommitSummon`/`onResetSummon` → `applySummon(accel)` and palette → `applyPalette(accel)`.
- De-duplicated a `captureFieldText()` double-eval in the e2e.

---

**Total deviations:** 3 auto-fixed (2 bug, 1 missing-critical/WCAG-AA) + simplify cleanups.
**Impact on plan:** All fixes necessary for correctness/security (the Reset collision could kill the palette hotkey) and WCAG-AA (reject announcements). No scope creep.

## Issues Encountered

- The 24-02 `matchesChord` physical-`e.code` swap surfaced a latent gap in the shared e2e dispatch helpers (no `code` on ⌘K events). Caught by the mandatory no-regression e2e run, fixed in `7c9612b2`. See project memory `macos-option-key-composes-letters`.

## Verification

- **vitest:** 1127/1127 (+4 from the code-review fix tests; was 1113 at Plan 02 close + 10 from this plan's component/capture tests).
- **tsc + eslint:** clean (only the 2 pre-existing out-of-scope `SidebarResetMenu` react-refresh warnings).
- **Real-WKWebView e2e:** 24/24 spec files — `hotkeys.e2e.ts` PASSED; the 7 regressed specs re-run clean.
- **Decoder immovable bar held:** `src/lib/protobuf/decoder.ts` + its 19 tests byte-for-byte untouched.
- **SettingsModal.tsx byte-unchanged** (append-only registry).
- **Zero new deps.**
- Harness gate (`/simplify` → `/codex:review` + fixes → unit → real-WKWebView e2e + no-regression) run by the orchestrator before passback.

## SET-08 status: PARTIAL

The webview-testable half of SET-08 is DONE and verified on the real WKWebView (pane render, palette-on-configured-chord, rebind-reflected, Escape-cancel). The remaining acceptance — native summon re-register from another app, the taken/reserved-chord OS reject, rebind-survives-quit-relaunch, Reset restores ⌘⇧D, palette rebind, keyboard-only reach — is **Task 4, a human walkthrough on the built `.app`** and is **NOT WebDriver-drivable** (RESEARCH Pitfall 6). Per the harness no-stale-build rule and because Plan 24-04 still lands webview source, the user APPROVED deferring Task 4 to the single phase-boundary human sign-off on the final fresh build (after 24-04). SET-08 stays PARTIAL until that walkthrough.

## Next Phase Readiness

- Plan 24-04 (General pane) appends the next SETTINGS_PANES entry and lands the last webview source before the fresh build.
- The deferred Task 4 native walkthrough folds into the 24-04 phase-boundary sign-off (one fresh build, one human pass covering both panes' native behavior).

## Self-Check: PASSED

All 5 created files present on disk; all 6 task commits found in git history.

---
*Phase: 24-hotkeys-general-panes*
*Completed: 2026-06-18*
