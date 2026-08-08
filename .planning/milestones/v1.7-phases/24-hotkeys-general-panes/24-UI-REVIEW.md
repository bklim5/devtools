# Phase 24 — UI Review

**Audited:** 2026-06-19
**Baseline:** 24-UI-SPEC.md (approved design contract)
**Screenshots:** not captured (Tauri WKWebView runs on :1420 but Playwright CLI is not Chromium-drivable against it, and no browser binary is installed) — code-only audit. Live visual + native verification is the human walkthrough at the phase boundary (24-04 Task 4).

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | All UI-SPEC copy verbatim; two added strings are calm and on-tone |
| 2. Visuals | 4/4 | Pane wrapper/header cloned from AppearanceSettings; icon buttons aria-labeled |
| 3. Color | 3/4 | 100% theme-token, accent on declared elements only; recording-state text-on-accent-soft is the one borderline-AA spot |
| 4. Typography | 4/4 | Exactly the 12/13/15px sizes + 500/600 weights the spec declares |
| 5. Spacing | 4/4 | gap-6/gap-4/gap-2/gap-1/p-8 rhythm matches the spec scale; zero arbitrary spacing |
| 6. Experience Design | 4/4 | Calm inline rejects, aria-live, prefsLoaded gate, autostart failure path all handled |

**Overall: 23/24**

---

## Top 3 Priority Fixes

1. **Recording-state prompt contrast** — `HotkeyCaptureField.tsx:164,169` renders `text-accent` ("Press a shortcut…", 13px regular) on `bg-accent-soft` (15% accent tint). `src/index.css:28-29` explicitly documents this exact pairing as ~3.9:1 (sub-AA for normal text) — the accent was brightened specifically to rescue *selected-label* text to ~4.9:1, but that headroom is thin for a non-bold 13px run on the soft fill. **Fix:** render the recording prompt in `text-tx` (or `font-medium`) rather than `text-accent` — the accent border + ring already signal the recording state; the prompt text does not need to be accent-colored. Mechanize it in `appearanceContrast.test.ts` for both themes.

2. **Live "recording" prompt is not announced to AT** — the visible text swaps to "Press a shortcut…" (`HotkeyCaptureField.tsx:169`) but lives only inside the button label, which AT re-reads only on (re)focus; there is no `aria-live` for the recording transition (the pane's live region carries only commit/reject results, `HotkeysSettings.tsx:111`). A screen-reader user who activates the field hears the name change ("Recording {label} shortcut" — good) but not the "Esc to cancel" affordance. **Fix:** move the `Esc to cancel` hint into the button's `aria-describedby`, or announce "Recording — press a shortcut, Esc to cancel" via a polite region on entering recording. Low effort, closes the only AT gap on the capture flow.

3. **Native `<select>` option list is OS-chromed** — `GeneralSettings.tsx:121-137` styles the `<select>` trigger with theme tokens, but the open `<option>` popup is rendered by the OS and ignores `bg-input-bg`/`text-tx`; in dark theme on some WebKit builds the dropdown list can render with default light chrome (a momentary contrast/theme mismatch). The spec permits the native select for 11 tools, so this is acceptable, but **verify in the dark-theme human walkthrough** that the open option list is legible; if not, the documented fallback is a token-styled listbox.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)
Every Copywriting-Contract string is present verbatim:
- Pane headers/sub-text: `Hotkeys` / `Rebind the app's keyboard shortcuts.` (`HotkeysSettings.tsx:80-83`); `General` / `App behavior and startup.` (`GeneralSettings.tsx:93-94`).
- Reject strings verbatim: `That shortcut is already in use — try another.` (`HotkeysSettings.tsx:28`), `Add Cmd, Ctrl, or Alt to set a shortcut.` / `That shortcut is reserved by macOS — try another.` (`HotkeyCaptureField.tsx:65-66`), same-as-other built from `otherLabel` (`:67-69`).
- Toggle labels + helpers all match (`GeneralSettings.tsx:99-143`).
- Recording prompt `Press a shortcut…` + `Esc to cancel` (`HotkeyCaptureField.tsx:169,186`).

Two strings added beyond the contract, both calm and on-tone (no `[discretion]` violation): `Couldn't change the login item — try again.` (`GeneralSettings.tsx:31`, a sensible OS-denied-plist failure path the spec didn't enumerate) and the `Open to` helper `The tool TinkerDev opens to on launch.` (`GeneralSettings.tsx:117-119`). Neither uses alarm language; `text-bad` appears nowhere (forbidden-token check clean).

### Pillar 2: Visuals (4/4)
- Pane wrappers clone `AppearanceSettings` exactly: `flex flex-col gap-6 overflow-auto p-8` + `header gap-1` + `h3` 15px/600 (`HotkeysSettings.tsx:76-84`, `GeneralSettings.tsx:89-95`) — heading order h2→h3→h4 preserved.
- Icon-only controls are labeled: the Reset `RotateCcw` button has `aria-label="Reset {label} to default"` and the glyph is `aria-hidden` (`HotkeyCaptureField.tsx:177-181`); the toggle knob span is `aria-hidden` (`SettingToggle.tsx:64`).
- Clear focal hierarchy via the 15/13/12 size ramp + medium section headings. No icon-only ambiguity.

### Pillar 3: Color (3/4)
- Zero hardcoded colors in all four files (hex/rgb grep clean) — fully theme-token, so both light/dark resolve (Pitfall 5 satisfied).
- Accent confined to the spec's reserved list: `focus-visible:ring-accent` on every control; the toggle on-state `bg-accent-soft border-accent-line` + accent knob (`SettingToggle.tsx:57-68`); the capture recording state `bg-accent-soft border-accent-line ring-accent` (`HotkeyCaptureField.tsx:164`). Off/idle states are neutral (`bg-input-bg border-bd`). No accent leakage onto decorative elements.
- `text-bad` correctly absent; reject messages are neutral `text-tx-2` (`HotkeyCaptureField.tsx:189`), matching D-24-2 calm-not-alarm.
- **One deduction:** the recording prompt is `text-accent` on `bg-accent-soft` (Fix #1) — per `index.css:28-29` this surface/text pairing sits near the AA floor for 13px regular text. Not a hardcoded-color or accent-overuse failure, but the single contrast risk in the phase.

### Pillar 4: Typography (4/4)
Distinct sizes in use: `text-[12px]` (×5), `text-[13px]` (×8), `text-[15px]` (×2) — exactly the three the spec declares, no fourth size. Weights: `font-medium` (500, ×3), `font-semibold` (600, ×2) + default 400 — the declared 400/500/600 ramp, no extra weight. Chord display uses `font-mono` (`HotkeyCaptureField.tsx:171`) per the spec's JetBrains-Mono requirement. No arbitrary or off-scale type.

### Pillar 5: Spacing (4/4)
All spacing on the declared 4px scale: `p-8` (32px outer pad), `gap-6` (pane rhythm), `gap-4` (General section rows), `gap-2`/`gap-1`/`gap-0.5` (intra-row). No arbitrary `[..px]` spacing values. Tap targets meet WCAG 2.5.8: capture field `min-h-11` (44px, `HotkeyCaptureField.tsx:161`), Reset `h-6 w-6` (`:179`), toggle track `h-6 w-11` (`SettingToggle.tsx:55`), select `py-2 px-4` (`GeneralSettings.tsx:129`).

### Pillar 6: Experience Design (4/4)
- **Error path:** OS-register reject caught and surfaced as calm inline + announced, prior binding preserved, nothing persisted (`HotkeysSettings.tsx:54-59`, D-24-2). Launch-at-login plist-write failure caught, announced, nothing persisted (`GeneralSettings.tsx:67-75`).
- **State coverage:** self-collision guard runs on BOTH capture and Reset (`HotkeysSettings.tsx:43-48,63-66`, T-24-07); invalid/reserved/same-as-other classified in-field without committing (`HotkeyCaptureField.tsx:115-129`).
- **Async-init discipline:** autostart OS reconcile gated on `prefsLoaded` (`GeneralSettings.tsx:48-58`, T-24-06), and a stale `defaultToolId` falls back to `Last used` so the controlled select never renders blank (`:82-86`).
- **A11y:** `role="switch"` + `aria-checked` + `aria-describedby` (`SettingToggle.tsx:47-50`); button-semantics capture field with click + Enter/Space (no mouse-only path); `aria-live="polite"` regions on both panes; state by fill+position not opacity (`SettingToggle.tsx:55-68`, `opacity-` grep clean). Only gap is the un-announced recording transition (Fix #2) — minor, hence still 4/4.
- No destructive action (Reset restores a known-good value); no empty state needed (panes always render full control sets).

---

## Registry Audit
`components.json` absent — shadcn not initialized (binding zero-new-dep wedge). No third-party registries. Registry safety audit skipped per the gate. The lone new dep (`tauri-plugin-autostart@2.5.1`) ships no UI components and is out of component-registry scope.

---

## Files Audited
- `src/components/HotkeyCaptureField.tsx`
- `src/components/HotkeysSettings.tsx`
- `src/components/GeneralSettings.tsx`
- `src/components/SettingToggle.tsx`
- `src/components/settingsPanes.tsx`
- `src/components/Sidebar.tsx` (D-24-11 license-affordance gate, ~L664)
- `src/components/AppearanceSettings.tsx` (sibling-pane consistency baseline)
- `src/index.css` (token / contrast baseline, both themes)
