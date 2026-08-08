# Phase 25 — UI Review (Settings surface, WCAG-AA)

**Audited:** 2026-06-21
**Baseline:** design/DevTools Mockup.html token system + src/index.css; AA mechanism mechanized in src/shell/appearanceContrast.test.ts (25 tests, run GREEN this audit)
**Scope:** five Settings panes (General, Hotkeys, Appearance, License, Updates) + registry + shell + shared switch, both themes
**Method:** code-only static audit (no `tauri dev` running). Contrast claims verified by executing the mechanized test, not eyeballed. No screenshots captured.

---

## Verdict: PASS — ships at AA

**Overall: 23/24**

No blocking (non-AA) findings. The new Updates pane (SET-10) and the existing four panes all clear the WCAG-AA bar mechanized in `appearanceContrast.test.ts`. Three non-blocking deferrals are listed at the bottom — none gate v1.7 close.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Typography | 4/4 | Tokenized ramp (15/13/12px, font-mono for chords/keys); no hardcoded sizes drift |
| 2. Color / Contrast | 4/4 | All accent cases AA in both themes (25/25 tests pass); no hardcoded dark-only hex in pane bodies |
| 3. Spacing / Layout | 4/4 | Consistent `gap-6 p-8` clone, layout-agnostic, no fixed widths in pane bodies |
| 4. Hierarchy | 3/4 | Dialog h2 → pane h3 correct everywhere; one heading-level inconsistency (License uses h3 20px vs others 15px, non-blocking) |
| 5. A11y / Keyboard | 4/4 | role=switch correct; visible focus rings everywhere; aria-live on every async result; focus trap + return |
| 6. Consistency | 4/4 | Registry single control plane; shared SettingToggle/HotkeyCaptureField/InlineActivation reuse |

---

## Top findings (none blocking)

1. **License pane header is h3 at 20px while the other four panes use h3 at 15px** — `LicenseSettings.tsx:298` vs `UpdatesSettings.tsx:84`. Heading *order* is correct (still one level under the dialog h2), so this is NOT an a11y/AA defect — it is a visual-hierarchy inconsistency. Deferred.
2. **Updates "Check" disabled state relies on `cursor-not-allowed` styling but no `aria-disabled` mirror** — the native `disabled` attr (`UpdatesSettings.tsx:107`) already removes it from the tab order and exposes disabled state to AT, so AA is met; noted only for completeness.
3. **Accent swatch group has no group-level roving description of the selected color name as a live update** — selection is conveyed via `aria-checked` + per-swatch `aria-label` + Check glyph (AA met). A polite announce of the newly chosen accent would be a polish, not a fix.

---

## Detailed Findings

### Pillar 1: Typography (4/4)

- Consistent token ramp across all five panes: pane title `text-[15px] font-semibold text-tx`, subtitle `text-[13px] text-tx-2`, helper `text-[12px] text-tx-3` (`GeneralSettings.tsx:90-91`, `UpdatesSettings.tsx:84-87`, `HotkeysSettings.tsx:80-83`, `AppearanceSettings.tsx:55-58`).
- Mono used correctly for machine values only: chord display `font-mono ... tracking-[0.15em]` (`HotkeyCaptureField.tsx:188`), masked key/email `VALUE_CLASS = font-mono text-[12px]` (`LicenseSettings.tsx:81`), version is plain sans (`UpdatesSettings.tsx:92`).
- No hardcoded font families; `--font-sans`/`--font-mono` resolve from `index.css:79-80`.
- License pane uses 16px/20px heading sizes (`HEADING_CLASS`, `LicenseSettings.tsx:68,298`) — a deliberate carry-over from the 21-UI-SPEC reuse mandate; flagged under Hierarchy as an inconsistency, not a typography defect.

### Pillar 2: Color / Contrast (4/4)

- **AA mechanism confirmed by execution**, not eyeballing: `npx vitest run src/shell/appearanceContrast.test.ts` → 25/25 pass. It asserts relative-luminance ≥4.5:1 for every accent in `ACCENT_SCALE` on the accent-soft fill in BOTH themes (dark 15%, light 12%), plus the light tx ramp and warn/ok status tokens on white (`appearanceContrast.test.ts:70-101`).
- The contract is honored by both halves: dark defaults in `index.css @theme` (lines 20-81) and the light overrides under `:root[data-theme="light"]` (lines 91-119) re-declare every `-soft`/`-line` variant explicitly (not relying on color-mix var tracking) — the documented Phase-23 Pitfall-5 fix.
- Pane bodies use tokens only. The only literal hex are intentional and scoped: the theme thumbnails (`ThemeCardGroup.tsx:38-50`, aria-hidden preview chrome), the preview strip surfaces (`AppearancePreviewStrip.tsx:31-34`, contained preview that must NOT read the root cascade by design), and the Check glyph `#ffffff` on filled-accent indicators (`ThemeCardGroup.tsx:132`, `AccentSwatchGrid.tsx:68`). None of these are root-cascade body color, so none break light theme.
- Recording field correctly keeps label `text-tx` on `bg-accent-soft` rather than `text-accent` (`HotkeyCaptureField.tsx:179-181`) — the comment cites the measured ~3.9:1 accent-on-accent-soft failure and avoids it. Good.
- Status banners use the warn/ok triads (`LicenseSettings.tsx:314,368`); the comments cite measured ratios (warn ~10:1, ok ~7:1 on their soft surfaces) consistent with the mechanized light-token assertions.
- Updates "Checking…" disabled button uses neutral `border-bd bg-input-bg text-tx-3` (`UpdatesSettings.tsx:113-114`) — NOT opacity-only, per requirement.

### Pillar 3: Spacing / Layout (4/4)

- Uniform pane wrapper `flex flex-col gap-6 overflow-auto p-8` across General/Hotkeys/Appearance/Updates (`UpdatesSettings.tsx:80`, `GeneralSettings.tsx:86`, etc.). License owns its own `gap-6 p-8` (and `gap-12` in the free branch, `LicenseSettings.tsx:274`) — the registry comment documents this and the modal renders it directly without double padding (`settingsPanes.tsx:11`, `SettingsModal.tsx:222`).
- Layout-agnostic: no fixed pixel widths in pane bodies; controls use `flex-1`/`flex-wrap` (`HotkeyCaptureField.tsx:175`, `AccentSwatchGrid.tsx:41`, `ThemeCardGroup.tsx:93`). Clamp widths appear only on form cards (`max-w-[420px]`, `LicenseSettings.tsx:443`) — deliberate readability clamp.
- Toggle target sizing meets WCAG 2.5.8: track `h-6 w-11` (24px tall) (`SettingToggle.tsx:55`); capture button `min-h-11` (`HotkeyCaptureField.tsx:175`). The reset icon button is `h-6 w-6` (`HotkeyCaptureField.tsx:198`) — at the 24px floor, acceptable.
- Per the constraint context, the cloned wrapper/header is an accepted convention and is NOT flagged.

### Pillar 4: Hierarchy (3/4)

- **Heading order is correct everywhere** (the AA-relevant property): dialog title is the only h2 (`SettingsModal.tsx:163-166`); every pane root heading is h3 (`UpdatesSettings.tsx:84`, `GeneralSettings.tsx:90`, `HotkeysSettings.tsx:80`, `AppearanceSettings.tsx:55`, `LicenseSettings.tsx:298`, and the free-branch sr-only `h3` `LicenseSettings.tsx:275`); sub-sections step down to h4 (`AppearanceSettings.tsx:62`, `HotkeyCaptureField.tsx:161`, `LicenseSettings.tsx:327,475`). No level is skipped or inverted — the documented Phase-22.1 fix holds.
- **Non-blocking inconsistency:** License pane h3 renders at 20px/semibold (`LicenseSettings.tsx:298`) while the other four panes' h3 render at 15px (`UpdatesSettings.tsx:84`). Same DOM level, different visual weight — a cosmetic mismatch a user moving between panes will notice. Not an AA defect; deferred.
- Accent discipline is correct: accent reserved for active nav item + focus rings + primary fills; status glyphs use ok/warn/bad tokens, never accent (`LicenseSettings.tsx` banners). `#N` field number stays neutral in the preview (`AppearancePreviewStrip.tsx:85`).

### Pillar 5: A11y / Keyboard (4/4)

- **role=switch correct** (`SettingToggle.tsx:46-49`): `role="switch"` + `aria-checked={checked}` + `aria-label` + `aria-describedby` linking the helper. State is conveyed by accent fill + knob translate position (`translate-x-6` vs `translate-x-1`, `SettingToggle.tsx:68`), NOT opacity. Native `<button>` handles click AND Enter/Space.
- **aria-live on every async result:**
  - Updates Check result → `role="status" aria-live="polite"` carrying checking / up-to-date / "vX available" / failed as plain text (`UpdatesSettings.tsx:125`), fed by `useUpdater` state (`useUpdater.ts:113,115`).
  - Hotkeys rebind/reject → single polite region (`HotkeysSettings.tsx:111`); reject paths all set the announcement (`HotkeysSettings.tsx:46,57,71`).
  - License activation/refresh/deactivate → polite regions on the status label transition (`LicenseSettings.tsx:323,376`), the in-flight/error line (`LicenseSettings.tsx:338,392`), the deactivate guidance line (`LicenseSettings.tsx:482`), and InlineActivation's own status (`UpsellPanel.tsx:384`).
  - General launch-at-login → polite `role="status"` (`GeneralSettings.tsx:140`).
- **Visible focus rings, no opacity/hover-only state:** `focus-visible:ring-2 focus-visible:ring-accent` on every interactive control — nav buttons (`SettingsModal.tsx:196`), close × (`SettingsModal.tsx:173`), select (`GeneralSettings.tsx:126`), toggle (`SettingToggle.tsx:56`), capture + reset (`HotkeyCaptureField.tsx:176,198`), theme cards (`ThemeCardGroup.tsx:111`), swatches (`AccentSwatchGrid.tsx:61`), Save (`AppearanceSettings.tsx:87`), Check (`UpdatesSettings.tsx:110`). Destructive Deactivate correctly uses `focus-visible:ring-bad` to signal intent (`LicenseSettings.tsx:78`). The free Save locked affordance is a VISIBLE accent-soft surface + Lock glyph + "Unlock Pro to save", not opacity (`AppearanceSettings.tsx:90-96`).
- **Keyboard reachability:** capture field is a real `<button>` (Enter/Space + click, no mouse-only path) with stateful accessible names "Rebind {label}" / "Recording {label} shortcut" (`HotkeyCaptureField.tsx:168`); reset has "Reset {label} to default" (`HotkeyCaptureField.tsx:196`). Radiogroups use roving tabindex + arrow selection, clamped no-wrap (`ThemeCardGroup.tsx:106`, `AccentSwatchGrid.tsx:55`).
- **Dialog mechanics:** focus trap wraps both ends + pulls focus back (`SettingsModal.tsx:107-129`), Esc/backdrop/× close (`SettingsModal.tsx:82,148,172`), focus returns to the captured invoker on close (`SettingsModal.tsx:136`), and Settings correctly yields all keydown to a stacked upsell dialog so one Esc doesn't close both (`SettingsModal.tsx:74-80`). Pane-list arrow/Home/End changes the active pane (`SettingsModal.tsx:91-102`).
- **No hover-only copy:** the Updates "Last checked" absolute timestamp rides `title=` as supplemental, but the primary relative string is always visible text (`UpdatesSettings.tsx:97-99`) — the hover only adds precision, it is not the sole carrier. Compliant.

### Pillar 6: Consistency (4/4)

- Registry is the single control plane — `SETTINGS_PANES` drives both nav and content 1:1 (`settingsPanes.tsx:38`, `SettingsModal.tsx:187,223`); the Updates pane was appended append-only with zero shell change (`settingsPanes.tsx:56-64`), as designed.
- Shared primitives reused, not reinvented: `SettingToggle` (General + Updates), `HotkeyCaptureField` (both Hotkeys rows), `InlineActivation`/`UpsellPanel` (License free + form-only variants, `LicenseSettings.tsx:277,453`). License button class constants are copied verbatim from UpsellPanel per the reuse mandate.
- Updates pane respects the stated constraints: UNGATED (no entitlement hook, unlike Appearance) — confirmed, it imports neither `useEntitlements` nor `gatePreferences` (`UpdatesSettings.tsx:27-32`); install is NOT duplicated (status-only "Version X available", no Install button — `UpdatesSettings.tsx:44`, owned by UpdateBanner). Both are correct per scope; NOT flagged.
- Tri-state auto-check toggle renders OFF for null, ON only for explicit true (`UpdatesSettings.tsx:135`) — matches D-25-8.

---

## Blocking (non-AA) findings

**None.** Every control is keyboard-reachable with a visible focus ring, every async result has a polite live region, role=switch is correct, heading order is valid, and all accent/status contrast is mechanically AA in both themes (25/25 tests green).

## Non-blocking deferrals

1. **License pane h3 visual size (20px) diverges from the other four panes (15px)** — `LicenseSettings.tsx:298`. Cosmetic hierarchy inconsistency; heading order is valid. Consider normalizing the pane-title size in a future cleanup.
2. **Updates Check button has no `aria-disabled` companion to the native `disabled`** — `UpdatesSettings.tsx:107`. Native disabled already satisfies AT/AA; purely a belt-and-suspenders note.
3. **Accent selection has no polite announce of the chosen color name** — `AccentSwatchGrid.tsx`. `aria-checked` + per-swatch `aria-label` already meet AA; a live announce would be polish only.

---

## Files Audited

- src/components/GeneralSettings.tsx
- src/components/HotkeysSettings.tsx
- src/components/HotkeyCaptureField.tsx
- src/components/AppearanceSettings.tsx
- src/components/ThemeCardGroup.tsx
- src/components/AccentSwatchGrid.tsx
- src/components/AppearancePreviewStrip.tsx
- src/components/LicenseSettings.tsx
- src/components/UpsellPanel.tsx (InlineActivation surface, a11y attrs)
- src/components/UpdatesSettings.tsx
- src/components/settingsPanes.tsx
- src/components/SettingsModal.tsx
- src/components/SettingToggle.tsx
- src/index.css (token system, both themes)
- src/shell/appearance.ts (ACCENT_SCALE / LIGHT_TOKENS)
- src/shell/appearanceContrast.test.ts (executed — 25/25 pass)
- src/shell/useUpdater.ts (live-region state source)
