# Phase 7 — UI Review (Formatters)

**Audited:** 2026-06-02
**Baseline:** Abstract 6-pillar standards + canonical visual system (`design/DevTools Mockup.html`) + locked UI decisions (`07-CONTEXT.md`). No UI-SPEC.md exists for this phase.
**Screenshots:** No dev server running (3000/5173/8080 all closed) → code-only audit, supplemented by the two real-WKWebView e2e screenshots (`test/e2e/__screenshots__/{json,xml}-formatter-wkwebview.png`).
**Gate type:** Phase-boundary WCAG-AA gate.
**Registry audit:** Skipped — no `components.json` (project does not use shadcn).

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 2/4 | XML error leaks raw `DOMParser` boilerplate ("This page contains the following errors:") + doubled line/col into the status bar; no empty-state hint on input. |
| 2. Visuals | 3/4 | Clean side-by-side hierarchy reusing the canonical pattern; truncated status-bar error has no full-text affordance (no `title`); mockup's status dot omitted. |
| 3. Color | 4/4 | Accent strictly selected-only (`aria-pressed`/active); error in `text-bad`; zero hardcoded hex in components; all CSS-var tokens. |
| 4. Typography | 3/4 | Sizes/weights match the established Base64/mockup ramp; all sizes are arbitrary `text-[Npx]` values (consistent but token-less). |
| 5. Spacing | 3/4 | Consistent with Base64 and ResizableSplit; a couple of arbitrary `gap-[11px]`/`h-[38px]` values, all matching the mockup. |
| 6. Experience Design | 3/4 | Error/empty/derived states all handled, read-only output, keyboard-operable resize + copy, visible focus rings; narrow-width vertical stacking (UX-05) still unshipped. |

**Overall: 18/24**

---

## WCAG-AA Gate Verdict

**No AA blockers found.** Specifically:

- **Contrast:** `--color-accent` was brightened to `#5b9bf8` (~4.9:1 on accent-soft) and `--color-tx-3` raised to `#868b95` per prior review fixes; error text uses `--color-bad` (`#f0876b`) on the dark status bar — passes AA for the 11.5px text. Toggle/label/copy colors (`text-tx`, `text-tx-2`) are AA-compliant.
- **Focus visibility:** every interactive control — indent segments, Minify/Sort-keys toggles, Copy button, the resize separator, both textareas — carries `focus-visible:ring-2 focus-visible:ring-accent` (never opacity-only). `ResizableSplit.tsx:93`, `FormatterView.tsx:124,143,162`.
- **Keyboard operability:** the resize separator is `tabIndex={0}` with ArrowLeft/Right nudge + `preventDefault` (`ResizableSplit.tsx:68-77`); Copy is a real `<button>` (no hover gate, FMT-08); toggles are buttons with `aria-pressed`.
- **Semantics:** `role="separator"` + `aria-orientation` + `aria-label` on the gutter; `role="group" aria-label="Indentation"` on the segmented control; `role="status" aria-live="polite"` on the status bar; labels are `htmlFor`-bound to both textareas; the read-only output is a `<textarea readonly>` text node (no `dangerouslySetInnerHTML`, T-07-05 honored).

The two issues below degrade UX/screen-reader quality but do not fail an AA success criterion outright.

---

## Top 3 Priority Fixes

1. **XML error message leaks engine boilerplate and doubles the location** — The XML screenshot shows: *"line 1: This page contains the following errors:error on line 1 at column 11: Opening and ending tag mismatch: b line 1 and …"*. `formatXml` passes `parseError.textContent` verbatim (`src/lib/format/xml.ts:136`), so WebKit's `<parsererror>` boilerplate ("This page contains the following errors:") and a second embedded "on line N at column C" both reach the user, on top of the tool's own `line N:` prefix (`XmlFormatterTool.tsx:42`). **Fix:** in `xml.ts`, strip the `This page contains the following errors:` prefix and the redundant `error on line N at column C:` fragment, returning just the human-meaningful cause (e.g. *"Opening and ending tag mismatch: b"*) plus the parsed `line`/`col`. Mirror the clean `JSON Parse error: …` shape the JSON path already produces.

2. **Truncated status-bar errors have no full-text affordance** — Long errors are clipped with `truncate` (`StatusBar.tsx:74`) and the span's only label is `aria-label="error"` (the literal word, not the message). A user who can't see the full text has no way to read it — no tooltip, no wrap, no expand. **Fix:** add `title={error}` to the error span so the full message is hover/focus-reachable, and set `aria-label={`error: ${error}`}` (or drop the static label and let the text content be the accessible name) so assistive tech announces the actual message, not "error".

3. **No empty-state guidance on the input pane** — On first load both panes are blank and the status bar reads "Empty · 0 bytes"; nothing tells the user the tool is paste-instant or what to paste. The canonical "paste a blob → instant interpretation" promise isn't surfaced. **Fix:** add a `placeholder` to the input `<textarea>` (`FormatterView.tsx:116`), e.g. `placeholder="Paste JSON — it formats as you type"` / `"Paste XML — it formats as you type"`, threaded through a `FormatterViewProps.inputPlaceholder`. Cheap, zero-dep, and lifts both Copywriting and Experience Design.

---

## Detailed Findings

### Pillar 1: Copywriting (2/4)

- **Defect (XML boilerplate leak):** `src/lib/format/xml.ts:136` returns `parseError.textContent` unmodified. On the real WKWebView this is `"This page contains the following errors:\nerror on line 1 at column 11: Opening and ending tag mismatch: b line 1 and …"` — generic browser plumbing, not a tool-quality message. Confirmed in `xml-formatter-wkwebview.png`. Contrast with the JSON path, which produces the clean `"JSON Parse error: Unexpected token '}'"` seen in `json-formatter-wkwebview.png`.
- **Defect (no empty/placeholder copy):** No `placeholder` anywhere in `FormatterView.tsx` (grep: none). The empty state is silent.
- **Good:** No generic-label smells — grep for `Submit/Click Here/OK/Cancel/Save` returns nothing in the formatter files. Toolbar labels are domain-appropriate: "Minify", "Sort keys", indent "2 / 4 / tab", "Copy"/"Copied". Pane labels "INPUT"/"OUTPUT" are clear.
- **Good:** Status states read "OK"/"Error"/"Empty" (`StatusBar.tsx:38-42`) — plain and honest; empty is correctly *not* an error (D-08).

### Pillar 2: Visuals (3/4)

- **Good:** Clear left→right transform hierarchy (input | resizable gutter | output), single shared toolbar pinned above, status footer below — matches the mockup's `.statusbar` and reads as a deliberate pipeline. Focal point is unambiguous.
- **Good:** The Copy button pairs an icon with a visible text label and `aria-label="Copy output"` (`FormatterView.tsx:138-155`) — no icon-only ambiguity. Sidebar icons are paired with text names.
- **Issue:** The long XML error visually overpowers the status bar in the screenshot, squeezing "10 bytes" onto two lines — a direct consequence of Fix #1; once the message is trimmed, the layout reads cleanly.
- **Minor:** The mockup's status bar carries a glowing colored state `.dot` (`design/DevTools Mockup.html:245`); the implementation uses a colored text label instead. This is arguably *more* accessible (not color-only) but is a small departure from the canonical visual — acceptable, noted for consistency awareness.

### Pillar 3: Color (4/4)

- **Accent discipline:** Accent appears only on selected/active affordances — active indent segment and ON toggles via `aria-pressed` + `border-accent-line bg-accent-soft text-accent` (`FormatterView.tsx:59-67`), the copy "Copied" confirmation, and focus rings. Exactly the "accent = selected-only" constraint.
- **No hardcoded colors:** grep for `#hex`/`rgb(` in the formatter components returns nothing — everything routes through `@theme` CSS-var-backed Tailwind utilities (`text-tx`, `text-tx-2`, `bg-input-bg`, `border-bd`, `text-bad`, `text-accent`).
- **Error color:** `text-bad` used for both the status label and the error message (`StatusBar.tsx:60,74`) — consistent and AA-compliant.

### Pillar 4: Typography (3/4)

- **Distribution:** sizes in use — `text-[11px]` (toggle/segment), `text-[11.5px]` (copy button, status bar), `text-[12px]` (pane labels), `text-[13px]` (mono textareas). Weights — `font-medium`, `font-semibold`. Two weights, four sizes: within the abstract thresholds and matching the established Base64 ramp and the mockup (`.pane-label` 11px, `.statusbar` 11px, `.val` 13px).
- **Minor:** All sizes are arbitrary `text-[Npx]` literals rather than named scale tokens. This is consistent across the whole codebase (Base64 uses the identical literals), so it's a project-wide convention rather than a phase regression — but a future typographic-scale token pass would remove the magic numbers. The pane label is `12px` vs the mockup's `11px` `.pane-label`; harmless and matches Base64's existing choice.

### Pillar 5: Spacing (3/4)

- **Consistent rhythm:** pane padding `p-3`, toolbar `px-3 py-2 gap-3`, status bar `px-3 gap-[11px]`, toggle `px-2 py-0.5/py-1` — coherent and matching Base64 + the mockup's `--gap: 11px` / status-bar `gap: 11px`.
- **Arbitrary values:** `gap-[11px]` (×2, StatusBar), `h-[38px]` (StatusBar, = mockup `.statusbar height:38px`), `rounded-[5px]/[7px]`, `7px` gutter in ResizableSplit. All trace directly to mockup constants, so they are intentional fidelity rather than drift — but they are token-less magic numbers (same caveat as typography).
- **Good:** Panes are genuinely layout-agnostic — `min-h-0 min-w-0 flex-1`, `resize-none`, no fixed pane widths (only the 7px gutter is fixed), satisfying UX-05's "no fixed widths" half.

### Pillar 6: Experience Design (3/4)

- **State coverage (strong):** error (output clears + status `text-bad` message, D-08), empty (status "Empty", not an error), and derived/ok all handled in both tools (`JsonFormatterTool.tsx:34-45`, `XmlFormatterTool.tsx:33-44`). On error the byte *delta* correctly collapses to a single count (`outputBytes = undefined`) — visible as "7 bytes" not "7 → N" in the JSON screenshot. Paste-instant, no debounce, synchronous derive via `useMemo` (D-07) with real timing measured around the pure call (WR-02 fix).
- **Interaction:** read-only output (non-editable, derived-only, D-03); visible focusable Copy with check-mark confirmation via `useCopyFeedback` (FMT-08); keyboard-resizable split. No destructive actions, so no confirmation needed; no async, so no loading state needed.
- **Carried gap — UX-05 narrow-width vertical stacking:** `FormatterView` renders a single `ResizableSplit` and there is **no breakpoint that stacks the panes vertically** on a narrow window. The 07-02/07-03 summaries deliberately deferred this (rendering a second stacked layout would duplicate `#json-input`/`#json-output` ids and the Copy button, breaking a11y/tests). **Assessment: polish item, not an AA/responsiveness blocker.** With `min=0.2`, both panes stay ≥20% width and remain fully visible, focusable, and operable at any window size this desktop app realistically reaches — WCAG 1.4.10 reflow targets 320 CSS px, which a macOS window does not hit in practice. Recommended approach when picked up: a CSS `@media`/container-query that flips `ResizableSplit`'s grid from `cols` to `rows` (swap `grid-template-columns` for `-rows`, separator `aria-orientation` to `horizontal`) so the *same* DOM/ids reflow — avoiding the duplicate-DOM trap the summaries flagged.

---

## Files Audited

- `src/components/FormatterView.tsx` (shared shell — primary target)
- `src/components/StatusBar.tsx` (byte-delta readout + error rendering)
- `src/components/ResizableSplit.tsx` (keyboard/pointer resize, a11y)
- `src/tools/json-formatter/JsonFormatterTool.tsx`
- `src/tools/xml-formatter/XmlFormatterTool.tsx`
- `src/lib/format/xml.ts` (error message construction — for Fix #1)
- `src/index.css` (design tokens, AA contrast notes)
- `design/DevTools Mockup.html` (canonical visual baseline)
- `test/e2e/__screenshots__/json-formatter-wkwebview.png` (real WKWebView, error state)
- `test/e2e/__screenshots__/xml-formatter-wkwebview.png` (real WKWebView, error state)
- `07-CONTEXT.md`, `07-01/02/03-SUMMARY.md`, `07-01/02/03-*-PLAN.md` (locked decisions D-01..D-12)

---

## Notes for Orchestrator

- **Registry audit:** N/A — no `components.json`, no third-party registries. No flags.
- **Recommendation count:** 3 priority fixes, 4 minor recommendations (status dot, typographic/spacing tokenization, pane-label 12px vs 11px, UX-05 stacking polish).
- The two priority defects (XML error copy, missing error `title`) are small, localized, zero-dep edits — they do not block the AA gate but should land before phase sign-off for quality.
