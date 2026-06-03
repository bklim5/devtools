# Phase 13 — UI Review (URL tool)

**Audited:** 2026-06-03
**Baseline:** Abstract 6-pillar standards + canonical visual system (`design/DevTools Mockup.html` / `src/index.css` `@theme`) + WCAG-AA (phase-boundary gate)
**Screenshots:** WKWebView e2e screenshot reviewed (`test/e2e/__screenshots__/url-wkwebview.png`, 218 KB, real WebKit). Chromium CLI preview not captured — `chrome-headless-shell` binary not installed; the binding gate is the real WKWebView, which already ran 11/11 green.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Specific labels, actionable error ("Enter an absolute URL…"), mode-aware caption (D-06), neutral empty hint — no generic strings. |
| 2. Visuals | 4/4 | Clear focal hierarchy (mode switch → input → outputs); every copy button has an icon + visible "Copy"/"Copied" text label, no icon-only ambiguity. |
| 3. Color | 4/4 | Accent strictly = selected/focus/copied only (11 occurrences, all functional); zero hardcoded hex/rgb — every color is a token. |
| 4. Typography | 4/4 | 4 sizes (11/11.5/12/13px), 2 weights (medium/semibold), mono for values vs sans for labels — within the 6-pillar budget and matches the mockup ramp. |
| 5. Spacing | 4/4 | Consistent gap/padding rhythm (gap-1.5/2/3/4, p-3/4); the only arbitrary `[Npx]` values are font-size/min-height, not spacing — no ad-hoc margins. |
| 6. Experience Design | 4/4 | Empty / error / per-pane-error / copy-feedback states all handled and tested; full keyboard operability + aria semantics; error-as-value, no throw path. |

**Overall: 24/24**

---

## WCAG-AA Verdict (Phase Boundary)

**PASS.**

Evidence:
- **Contrast (computed, all ≥ 4.5:1):** active-segment accent text on the accent-soft tint **5.08:1**; inactive segment text **6.59:1**; error text `text-bad` on input-bg **7.66:1**; dimmest `tx-3` em-dash/captions **5.61:1**; `tx-2` labels **7.05:1**; primary value `tx` **15.79:1**. The `tx-3` and `accent` tokens were already hardened in earlier phases (03-UI-REVIEW notes in `src/index.css`) and the URL tool inherits them cleanly.
- **Keyboard operability:** mode switch and `component|full` scope toggle are real `<button type="button">`s inside `role="group"` with `aria-pressed` (`SegmentedControl.tsx:38-53`) — each is in the natural tab order and Space/Enter-activatable. No mouse-only affordance; copy buttons are always-visible/focusable (no hover gate, satisfies the project's "no hover-only copy" constraint).
- **Focus rings:** `focus-visible:ring-2 focus-visible:ring-accent` on every interactive element — segments, copy buttons, both textareas (4 distinct rings across the two files); input also flips `border-accent-line` on focus.
- **Semantics:** labeled `role="group"` toggles; `htmlFor`/`id` label-input pairing on both textareas; `aria-invalid` on the input in the error state; errors surfaced via `role="alert"` (4 usages, one per error surface); decorative `→` glyph and copy icons are `aria-hidden`.

No AA blockers found.

---

## Top Priority Fixes

No blocking or priority fixes. Three optional polish notes (none affect the AA verdict or the score):

1. **Segment group lacks roving-arrow-key navigation** — minor — the `SegmentedControl` exposes each segment as an independent Tab stop with `aria-pressed`, which is fully AA-operable, but a tabs-style `←/→` roving pattern would feel more native for a 2-option switch. Defer; current pattern is correct and consistent across the app.
2. **Error message uses a literal example URL in copy** — cosmetic — `"Enter an absolute URL (with a scheme), e.g. https://example.com/path"` is excellent guidance; consider rendering the example as a clickable example chip later (matches the mockup's `.ex` example-pill idiom) so users can one-click a sample.
3. **`aria-live` on the encode/decode output panes** — minor — outputs update live via `useMemo` but the read-only panes aren't announced. `role="alert"` already covers the error case; a `aria-live="polite"` on the value panes would announce successful encode/decode results to screen-reader users. Low priority for a paste-glance tool.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)
- No generic labels — grep for `Submit|Click Here|OK|Cancel|Save` across `UrlTool.tsx` + `SegmentedControl.tsx` returns nothing.
- Mode and scope labels are domain-precise: `Parse`, `Encode/Decode`, `component`, `full`.
- Empty state is a real hint, not a blank: `"Paste an absolute URL to split it into its parts and decode its query."` (`UrlTool.tsx:112-113`), honoring D-15.
- Error copy is actionable and teaches the absolute/relative distinction: D-13 message surfaced verbatim.
- The component-vs-full footgun (the teaching moment named in CONTEXT `<specifics>`) is addressed by the mode-aware caption (`UrlTool.tsx:185-189`) — `"Escapes / ? : @ & = # too…"` vs `"Keeps URL structure (/ ? : @ & =) intact…"`.
- Copy buttons read `Copy` → `Copied` with state, and per-row aria-labels are specific (`Copy ${label}`, `Copy query value ${key}`).

### Pillar 2: Visuals (4/4)
- Clear top-down focal order confirmed in the WKWebView screenshot: mode switch → labeled input → live Encoded/Decoded panes. Parse mode mirrors this with input → 8 readout rows → query table.
- No icon-only buttons: every copy control pairs the lucide icon with a visible `Copy`/`Copied` text span (`UrlTool.tsx:52-57`), so there is no tooltip-dependency.
- Hierarchy via size+weight+color: uppercase `text-tx-2 font-semibold` section/row labels vs `font-mono text-tx` values vs muted `text-tx-3` em-dash placeholders — three legible tiers.
- Bordered `rounded-md` rows on `bg-input-bg/40` give each readout/query row a scannable card without heavy chrome; matches the mockup's field treatment.

### Pillar 3: Color (4/4)
- Accent usage is 11 occurrences, every one functional and rule-compliant ("accent = selected only"): active-segment (`bg-accent-soft`/`border-accent-line`/`text-accent`), focus rings (`ring-accent`), focused input border, and the copied-state copy button. No decorative accent.
- Zero hardcoded colors — grep for `#[0-9a-fA-F]{3,8}|rgb(` in both files returns nothing; everything routes through the `@theme` tokens (`text-tx`, `text-tx-2`, `text-tx-3`, `text-bad`, `border-bd`, `bg-input-bg`).
- Error state uses the single shared `--color-bad` token, consistent with Base64/Protobuf error voice.

### Pillar 4: Typography (4/4)
- Sizes in use: `text-[11px]` (segment + row labels), `text-[11.5px]` (copy button), `text-[12px]` (section labels/captions/keys), `text-[13px]` (values/inputs) — 4 steps, within the ≤4 budget and consistent with the mockup's 11–13.5px ramp.
- Weights: `font-medium` (segments) and `font-semibold` (labels/headings) — 2 weights, at budget.
- Correct font-family split: `font-mono` for byte/URL values, sans (inherited) for chrome/labels — matches the JetBrains Mono + IBM Plex Sans system.

### Pillar 5: Spacing (4/4)
- Spacing classes form a tight, consistent rhythm: `gap-1.5/2/3/4`, `p-3/p-4`, `px-2/px-3`, `py-0.5/py-1/py-1.5`, `p-0.5` — all on the standard scale, no odd one-offs.
- The arbitrary `[Npx]` bracket values flagged by grep are **font-size and min-height** (`text-[13px]`, `min-h-[72px]`, `[44px]`) and corner radii (`rounded-[5px]/[7px]` lifted verbatim from the mockup), **not** ad-hoc margins/padding — so the spacing scale itself is clean.
- `min-w-0` applied consistently for responsive truncation; layout-agnostic (no fixed widths), honoring the project constraint.

### Pillar 6: Experience Design (4/4)
- **State coverage:** empty (neutral hint), parse error (single `role="alert"`, no rows), per-pane decode error with the other pane intact (D-14), and copy feedback (`useCopyFeedback`) are all present **and** covered by tests — `UrlTool.test.tsx` has 9 cases including the `/foo?x=1` single-alert case, the empty neutral case, the decoded `hello world` query row, and the `%zz` per-pane error (`UrlTool.test.tsx:118-178`); `SegmentedControl.test.tsx` adds 4.
- **No-throw guarantee:** all parse/encode/decode flows through 13-01's error-as-value helpers; the DoS surface (relative URL, `%zz`, lone surrogate) is mitigated and exercised on the real WKWebView.
- **Keyboard + a11y:** 6 focus-ring usages, `role="group"`/`role="alert"`, `aria-pressed`, `aria-invalid`, `aria-label`, `htmlFor` pairing — full operability (see WCAG verdict).
- No destructive actions, so no confirmation needed; no async, so no loading/skeleton state needed — both correctly omitted.

---

## Registry Audit

No `components.json` present (`shadcn` not initialized) and no third-party registries declared. Registry safety audit skipped per the gate — not applicable to this Tauri/Tailwind-v4 project.

---

## Files Audited
- `src/tools/url/UrlTool.tsx` (view: mode switch, Parse readout + query table, Encode/Decode panes, CopyButton/Value/OutputPane locals)
- `src/components/SegmentedControl.tsx` (shared accent-on-active aria-pressed toggle, D-16)
- `src/tools/url/index.ts` (registry entry, id `url`)
- `src/index.css` (`@theme` design tokens — contrast source of truth)
- `design/DevTools Mockup.html` (canonical visual system, `:root` vars)
- `src/tools/url/UrlTool.test.tsx` + `src/components/SegmentedControl.test.tsx` (state-coverage evidence)
- `test/e2e/__screenshots__/url-wkwebview.png` (real WebKit visual evidence — Encode/Decode mode, `a%20b/c` under `full` scope)
