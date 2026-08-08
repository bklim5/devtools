# Phase 23 — UI Review

**Audited:** 2026-06-18
**Baseline:** Abstract 6-pillar standards + 23-CONTEXT.md locked decisions (no 23-UI-SPEC.md exists)
**Screenshots:** Not captured — Playwright browser binary not installed (`npx playwright install` required); dev server was live on :1420. Real-WKWebView interaction is already proven by `test/e2e/appearance.e2e.ts` (23/23 spec files) + the human-approved `tauri build` walkthrough (Plan 03). This is a code-only visual/a11y audit.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Specific, on-brand copy; no generic labels; lock CTA states the gated action ("Unlock Pro to save") |
| 2. Visuals | 4/4 | Clear section hierarchy, icon-bearing controls carry text + aria; selection never color-alone (Check glyph + radio-check + border) |
| 3. Color | 4/4 | Accent reserved for selection only; both-theme AA mechanized as executable contrast math (14 assertions, ≥4.5:1) |
| 4. Typography | 3/4 | Coherent ramp + single weight family, but uses arbitrary `text-[Npx]` instead of the token scale |
| 5. Spacing | 4/4 | Consistent gap/padding scale; pane wrapper matches LicenseSettings; no stray arbitrary spacing |
| 6. Experience Design | 4/4 | Gate-on-Save with visible (non-opacity) lock; contained preview never mutates root; flash-free launch; durable persist |

**Overall: 23/24**

---

## Top 3 Priority Fixes

1. **Arbitrary pixel font sizes (`text-[15px]`/`[13px]`/`[12px]`/`[11px]`) instead of the token scale** — `AppearanceSettings.tsx`, `ThemeCardGroup.tsx`, `AppearancePreviewStrip.tsx` — Drifts the pane off any shared typographic token; future scale changes won't propagate and a second author may pick `text-sm`/`text-xs` for the "same" size, fragmenting the system. *Fix:* map these to the project's named text utilities (or define `--text-*` tokens once) and replace the arbitrary values — confirm the rendered px is unchanged so dark/light screenshots stay byte-identical. (Minor / system-hygiene, not a user-facing defect.)

2. **Selected accent swatch: focus ring and selection ring are both 2px and color-swap rather than stack** — `AccentSwatchGrid.tsx:61-63` — When a *selected* swatch is focused, `focus-visible:ring-2 ring-accent` overrides the `ring-2 ring-tx` selection ring, so the high-contrast neutral selection ring momentarily becomes an accent ring on a saturated same-family swatch (e.g. blue selected = blue-ish ring on blue). `ring-offset-2 ring-offset-pane` keeps it visible and the Check glyph still conveys selection (not color-alone), so this is AA-safe — but the focus state is slightly weaker on the matching-hue swatch. *Fix (optional polish):* give focus a distinct outline that composes with the selection ring (e.g. `focus-visible:outline-2 focus-visible:outline-offset-2 outline-tx`) so focus and selection are both always visible regardless of swatch hue.

3. **Save has no "unchanged" affordance** — `AppearanceSettings.tsx:39-48` — Save is always active; pressing it with no pending change re-persists the identical value (Pro) or re-opens the upsell (free). Harmless but a tiny dead interaction. *Fix (optional):* when `pendingTheme === gated.theme && pendingAccent === gated.accent` for a Pro user, render Save in a clearly-styled inert state — and per the no-opacity-disabled rule, use a token-driven muted surface (`bg-input-bg text-tx-3`), never `opacity-50`.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)
- Pane subtitle "Personalize how TinkerDev looks on this device." and accent helper "Used for the active tool, selections, and focus." match the 23-CONTEXT copy direction verbatim (`AppearanceSettings.tsx:56-58, 69-71`).
- Section heads are concrete: "Theme" + "Choose light or dark.", "Accent color", "Preview" (`:62-76`).
- The gated CTA names the actual action and tier — "Unlock Pro to save" with a `Lock` glyph (`:95-96`), not a generic "Save"/"Submit"/"OK". Pro label is plain "Save".
- Grep for generic labels (`Submit`/`Click Here`/`OK`/`Cancel`) in the pane components: none.
- Every accent swatch carries an accessible name (`aria-label={pair.label}` → Blue/Violet/Green/Amber/Rose/Teal/Slate) — `AccentSwatchGrid.tsx:54`.

### Pillar 2: Visuals (4/4)
- Clear focal hierarchy: `h3` pane title → `h4` section heads → controls → Save row, with `flex flex-col gap-6` separating sections (`AppearanceSettings.tsx:51-99`). Heading level is `h3` (one under the dialog `h2`) preserving the Phase-22.1 heading-order fix.
- Theme cards carry a stylized mini app-window thumbnail (sidebar column + accent "selected nav item" bar + neutral rows) so the choice is recognizable, not text-only (`ThemeCardGroup.tsx:36-69`).
- **Selection is never conveyed by color alone** (WCAG 1.4.1): theme card = filled-accent radio-check circle + white Check + `border-accent-line` + `aria-checked` (`:124-134`); accent swatch = ring + centered white Check + `aria-checked` (`AccentSwatchGrid.tsx:65-71`). This is the strongest a11y point of the phase.
- The lone icon (`Lock`) is paired with the text label and marked `aria-hidden` (`AppearanceSettings.tsx:95`); the preview's inert Activate button + SegmentedControl are `aria-hidden`/`tabIndex=-1` so they don't pollute the tab order or AT tree (`AppearancePreviewStrip.tsx:73-74, 95`).

### Pillar 3: Color (4/4)
- Accent class usage in the four pane components is selection/focus-scoped (12 hits across selected card, selected swatch, focus rings, Save, and the preview's accent samples) — accent is **reserved for selection**, the binding visual rule. The preview's `#1` field number is rendered neutral (`surface.tx`), accent only on the selected `uint` chip (`AppearancePreviewStrip.tsx:84-90`), matching FieldNode.
- **WCAG-AA in both themes is mechanized, not eyeballed:** `appearanceContrast.test.ts` asserts all 7 accents ≥4.5:1 as selected-label-on-`accent-soft` in BOTH dark (15% over `#181b21`) and light (12% over `#fff`), plus the `tx/tx-2/tx-3` ramp on white and the warn/ok status tokens (Plan 01). The light `accent-soft` drops 15%→12% specifically for near-white headroom (`index.css:108-110`).
- The free locked Save uses `bg-accent-soft text-accent border-accent-line` — accent-on-accent-soft, the exact pairing the contrast test pins ≥4.5:1, so the locked label is AA in both themes (`AppearanceSettings.tsx:92`).
- "Hardcoded" hexes flagged by grep are all **legitimate**: `#ffffff` on the white Check glyph (needs fixed white for contrast on the saturated swatch), and the per-theme preview/thumbnail surface lookups (`PREVIEW_SURFACE`, `ThemeThumbnail`) — these are intentionally explicit because `[data-theme="light"]` is rooted at `:root` and cannot cascade into a contained preview. Documented in both files. Not a violation.
- Accent-soft/-line are re-declared (not just color-mix-tracked) under the light selector to guarantee the derivation holds after the base var flips (`index.css:108-110`).

### Pillar 4: Typography (3/4)
- Size distribution is small and intentional: `text-[15px]` (pane title) → `text-[13px]` (section heads, labels, Save) → `text-[12px]` (helpers, preview samples) → `text-[11px]` (mono `uint` chip). Effectively a 4-step ramp — within the "≤4 sizes" bar.
- Weights: only `font-semibold` (title) + `font-medium` (everything else) — 2 weights, within the bar.
- **Deduction:** all sizes are arbitrary `text-[Npx]` rather than the design system's named scale/tokens. This is consistent *within* the pane but isn't anchored to a shared token, so it can drift from the rest of the app and won't track a future scale change. See Priority Fix 1.

### Pillar 5: Spacing (4/4)
- Pane root `flex flex-col gap-6 overflow-auto p-8` matches the LicenseSettings convention exactly — the SettingsModal hosts it with no double-pad (Pitfall-5 avoided).
- Sections use `gap-2`; the theme card row `gap-3`; swatch grid `gap-2`; preview `gap-3 p-4`; Save `px-4 py-2`. All on the standard 2/3/4/6/8 step scale; no off-scale arbitrary spacing values found.
- Layout is responsive/agnostic: theme cards `flex flex-wrap gap-3 sm:flex-nowrap` + `min-w-0 flex-1`; swatch grid `flex flex-wrap`; preview `flex flex-wrap`. No fixed-width `w-[NNNpx]` on containers (the only fixed dims are the 72px thumbnail height and 7×7 swatch — intentional component primitives, layout-agnostic at the container level).

### Pillar 6: Experience Design (4/4)
- **Gate-on-Save with a visible, non-opacity lock** (the explicit emphasis of this audit): free Save is a full-color `accent-soft` surface + Lock glyph + "Unlock Pro to save", `type="button"`, `ref`'d, `focus-visible:ring-2 ring-accent`, keyboard-reachable — NOT `opacity-50`/`disabled` (`AppearanceSettings.tsx:80-97`). Free Save routes to `openProUpsell(saveRef.current)` and persists nothing; Pro Save calls `setTheme`+`setAccent` (`:39-48`). Try-before-buy honored (D-23-2).
- **Keyboard reachability + radio-group semantics:** both groups are `role="radiogroup"` with `aria-label`, `role="radio"` children, `aria-checked`, roving `tabIndex` (selected = the single Tab stop), and clamped arrow-key selection (Left/Up prev, Right/Down next, no wrap) mirroring the Sidebar convention (`ThemeCardGroup.tsx:72-145`, `AccentSwatchGrid.tsx:23-74`). `AccentSwatchGrid` also keeps the group keyboard-reachable when the persisted value isn't in the scale (first swatch becomes the Tab stop, `:47`).
- **Visible focus rings** on every interactive element: theme cards, swatches, and Save all carry `focus-visible:ring-2 focus-visible:ring-accent`; swatches add `ring-offset-2 ring-offset-pane` so the focus ring separates from the swatch fill in both themes.
- **Contained-preview invariant:** preview reflects pending theme+accent via a scoped inline `--color-accent`/`-soft`/`-line` on its own subtree + a local per-theme surface lookup, and **never** writes the DOM root (grep `document.documentElement` count = 0 in pane + strip). No revert path needed because global appearance only changes on a persisted, gated Save (`AppearancePreviewStrip.tsx:1-60`).
- **Live-apply + launch correctness** (Plan 03, e2e-proven): `useAppearance` applies the GATED effective theme/accent gated on `prefsLoaded && entsResolved` (no Pro-launch dark flash); `index.html` pre-paint script stamps `data-theme` before first paint (no wrong-theme flash); prefs writes are durable (`autoSave:false` + explicit `save()`); the cross-writer prefs clobber was fixed by unifying recents+prefs onto one singleton writer. `appearance.e2e.ts` verifies on the real WKWebView: contained preview leaves `documentElement` untouched, Pro Save applies `data-theme="light"` live and round-trips the swatch's `aria-checked`, and the reset Save returns to dark (absence of `data-theme`).
- Minor: Save has no inert "unchanged" state (see Priority Fix 3) — purely cosmetic, not a defect.

---

## Registry Safety
Not applicable — no `components.json` (NO_SHADCN); no third-party registries. Audit skipped per spec.

---

## Files Audited
- `src/components/AppearanceSettings.tsx`
- `src/components/ThemeCardGroup.tsx`
- `src/components/AccentSwatchGrid.tsx`
- `src/components/AppearancePreviewStrip.tsx`
- `src/shell/appearance.ts` (ACCENT_SCALE, LIGHT_TOKENS, accentForTheme)
- `src/shell/theme.ts` (resolveEffectiveTheme, applyAppearance)
- `src/index.css` (@theme dark tokens + `[data-theme="light"]` block, accent-soft/-line, focus handling)
- `test/e2e/appearance.e2e.ts` (real-WKWebView interaction evidence)
- Plan/summary docs 23-01 … 23-04 + 23-CONTEXT.md
