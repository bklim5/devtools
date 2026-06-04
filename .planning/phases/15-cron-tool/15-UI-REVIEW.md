---
phase: 15
slug: cron-tool
type: ui-review
audited: 2026-06-04
baseline: 15-UI-SPEC.md (approved design contract)
screenshots: not captured (playwright browsers not installed; code-only audit)
wcag_aa: PASS
overall: 23/24
status: PASS
---

# Phase 15 — UI Review

**Audited:** 2026-06-04
**Baseline:** `15-UI-SPEC.md` (approved UI Design Contract) + canonical visual system (`src/index.css` `@theme`, `design/DevTools Mockup.html`)
**Screenshots:** Not captured — the dev server is up on `:1420`, but the local Playwright CLI has no browser binaries installed, so no Chromium preview was produced. This is a **code-only audit**. (The real-WKWebView gate is covered separately by the project's own `test/e2e/cron.e2e.ts`, which Plan 04 reports green 13/13 with a saved `cron-wkwebview.png` artifact.)
**WCAG-AA:** PASS — every text token used in the tool clears AA-normal (≥4.5:1) against its darkest surface; see Pillar 3.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Every Copywriting-Contract string matches verbatim; empty/never/@reboot are neutral, error is the only `role=alert`. |
| 2. Visuals | 4/4 | Clear focal hierarchy (16px headline → labels → rows); all icon-free buttons carry `aria-label`; all 5 result kinds rendered. |
| 3. Color | 4/4 | Accent confined to focus ring + copy-confirmed; `text-bad` only on the error alert; ordinals/zone neutral; all tokens AA-clear. |
| 4. Typography | 4/4 | Exactly 4 sizes (16/13/12/11px) and 2 weights (600/400); mono on values, sans on prose — matches the contract precisely. |
| 5. Spacing | 4/4 | All spacing on the 4-based scale (`gap-2/3/4`, `p-3/4`, `px-3 py-2` rows); zero off-grid arbitrary px. |
| 6. Experience Design | 3/4 | All states handled, copy never hover-gated, `aria-invalid` correct; minor: error/never use static `role=alert`/text rather than an `aria-live` region for paste-instant announcement. |

**Overall: 23/24**

---

## Top 3 Priority Fixes

1. **Error and "no upcoming runs" messages are not in a live region** — *User impact:* because the tool is paste-instant (the message appears/changes as the user types, with no submit event), a screen-reader user may not hear the error or the "never fires" line announced when it swaps in. `role="alert"` announces on insertion but not reliably on text-swap between error messages within the same node. *Concrete fix:* wrap the error `<p role="alert">` and the never-state `<p>` region in a stable always-mounted container with `aria-live="polite"` (the Unix Time field-error precedent the spec's Accessibility Notes already cite), so message changes between keystrokes are announced. Low effort, no visual change.

2. **No visual separation between the description headline and the run list** — *User impact:* the spec reserves the `xl` (24px) token "for a major vertical break between the description headline and the run list, if visual separation is wanted." Currently both sections sit in the same `gap-4` rhythm as the input, so the primary readout (headline) does not visually lead the secondary readout (runs). *Concrete fix:* optional polish — add the reserved `xl` break (e.g. a `mt-2`/`pt-2` divider or `gap-6` between the DESCRIPTION section and the NEXT RUNS section) to give the 16px headline its earned prominence. Discretionary per the spec, not a violation.

3. **Run-row datetime can wrap mid-token via `break-all`** — *User impact:* the mono datetime uses `break-all`, which on a narrow pane can break a date string at an arbitrary character (e.g. `09:0` / `0`), hurting scannability of the load-bearing value. *Concrete fix:* prefer `break-words` (or `whitespace-nowrap` with `truncate` + the copy button carrying the full value) so the datetime breaks at separators rather than mid-number. Cosmetic; only manifests at very narrow widths.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)
Audited every string in `CronTool.tsx` against the UI-SPEC Copywriting Contract table — all match verbatim:
- Field label `Cron expression` (rendered uppercase via CSS), placeholder `0 9 * * 1-5   ·   @daily   ·   0 0 L * *` — exact (`CronTool.tsx:71-82`).
- Empty hint "Paste a cron expression to see its description and next 5 run times." — neutral, no `role=alert` (`:90-92`). Matches contract.
- `@reboot` caption "No scheduled runs — `@reboot` fires only on startup…" — neutral `text-tx-2`, `@reboot` in mono `<code>`, no list/heading (`:123-128`). Matches CRON-09 row.
- Never line "No upcoming runs in the next 5 years — this expression may never fire (e.g. February 30)." — neutral `text-tx-3`, under a `Next runs` heading, description still shown above (`:132-140`). Matches CRON-08 row.
- Error path renders the core's named message verbatim (`{result.message}`) — the contract delegates the exact token text to the core, which `cron.ts` supplies (`:97-101`). The W/#/LW reject flows through this same path, as the spec mandates.
- Zone caption "Local time · {zone}" (`:148`); run heading "Next runs ({n})" (`:147`). Matches.
- No generic CTA labels (`Submit`/`OK`/`Cancel`/`Save`) anywhere — grep clean. No primary action button, correct for the paste-instant wedge.

### Pillar 2: Visuals (4/4)
- **Focal point:** the 16px/600 description headline is the single largest type element and reads as the primary output — the spec's intended hero readout (`:116-118`).
- **Hierarchy:** headline (16/600) → uppercase section labels (12/600 `text-tx-2`) → mono values (13/400 `text-tx`) → captions/ordinals (11–12/400 `text-tx-3`). Differentiation is by size + weight + neutral-ramp brightness, exactly as the spec's "emphasis from size + weight, not color" rule requires.
- **Icon-free buttons labeled:** the `CopyButton` is text ("Copy"/"Copied") and additionally carries an explicit `aria-label` (`Copy description`, `Copy run N`) (`:31, :113, :170`). No icon-only affordance is unlabeled.
- **State completeness:** all 5 `CronResult` kinds (`empty`/`error`/`scheduled`/`never`/`reboot`) have a dedicated render branch (`:89, :97, :105, :123, :132, :145`) — nothing falls through to a blank screen.

### Pillar 3: Color (4/4)
Accent usage is tightly scoped — grep shows accent classes only on (a) the input focus ring/line (`:84`) and (b) the `CopyButton` focus ring + copy-confirmed state (`:33, :35`). No accent on ordinals, zone, headline, or any informational state — matches the spec's explicit "NOT accent" list and the hero "`#N` neutral, accent = selected only" rule.
- `text-bad` appears exactly once: the error `role=alert` (`:98`). The `@reboot` and never states use the neutral `text-tx-2`/`text-tx-3` ramp, never `text-bad` — matches the spec's Destructive note.
- **WCAG-AA contrast** (computed against the darkest surface, `input-bg #0d0f13`): `text-tx` 15.79:1, `text-tx-2` 7.05:1, `text-tx-3` 5.61:1, `text-bad` 7.66:1, `text-accent` 6.84:1 — **all clear AA-normal (≥4.5:1)**. The 11–12px meta tier on `text-tx-3` (the riskiest pairing) still passes, confirming the design system's deliberate brightening holds for this tool. WCAG-AA floor met.

### Pillar 4: Typography (4/4)
- **Sizes:** exactly 4 — `16px` (headline ×1), `13px` (mono values ×2), `12px` (labels + captions ×7), `11px` (ordinal + copy button ×2). Matches the spec's declared "3 core sizes + 11px meta tier inherited," no new size introduced.
- **Weights:** exactly 2 — `font-semibold` (600, labels + headline) and default-regular (400). Matches "exactly 2 weights."
- **Font split correct:** `font-mono` on the input, every run datetime, the ordinal, and the `@reboot` code literal; sans (inherited) on the prose headline and all captions — matches "values are mono, prose is sans."
- `leading-[1.3]` on the headline matches the spec's ~1.3 line height for the larger headline.

### Pillar 5: Spacing (4/4)
- All spacing classes sit on the project's 4-based scale: `gap-0.5/1/2/3/4`, `p-3/4`, `px-1.5`, `py-0.5`, `px-3 py-2`. The run rows use `px-3 py-2` — exactly the Unix Time `OutputRow` precedent the spec prescribes for two-line stacked rows.
- Outer frame `flex min-w-0 flex-1 flex-col` → inner `gap-4 overflow-auto p-4` — the standard tool frame, verbatim from the spec/RegexTool.
- **Zero off-grid arbitrary spacing** — the only arbitrary-value classes are `text-[Npx]`, `rounded-[6px]`, and `leading-[1.3]` (type/radius, not spacing). Layout-agnostic: `min-w-0` present throughout, no fixed widths — satisfies the CLAUDE.md layout-agnostic constraint.

### Pillar 6: Experience Design (3/4)
Strong baseline:
- **All states covered** (empty/error/never/reboot/scheduled), each visually distinct and correctly classified (error = alert chrome; reboot/never = calm neutral).
- **Copy is never hover-gated** — `CopyButton` is always-visible and focusable (`:27-41`), satisfying the CLAUDE.md no-hover-only-copy rule. Copy writes through the `platform.clipboard` seam, never `@tauri-apps/*` directly (grep confirms no direct Tauri import).
- **`aria-invalid`** is set on the input only on the error kind (`:83`) — correct.
- **No destructive actions / no confirmation needed** — correct per the spec (pure disposable transform).
- **DoS safety:** the synchronous `useMemo` over `analyzeCron` is bounded by the Plan-02 candidate-day cap, so paste-instant compute cannot hang (T-15-10 mitigated).

Deduction (−1): the paste-instant model means error and never messages appear/swap **without a user-initiated event**. `role="alert"` announces on DOM insertion but text-swaps between successive error messages in the same mounted node are not reliably re-announced. The spec's own Accessibility Notes anticipate this ("`role="alert"` or `aria-live="polite"` per the Unix Time field-error precedent") — adopting a stable `aria-live="polite"` region (Fix #1) would close the gap and earn 4/4.

---

## Registry Safety
Not applicable. `components.json` is absent (no shadcn), and the UI-SPEC Registry Safety table declares zero third-party registries and zero new runtime/dev dependencies. The sole new import is the `Clock` glyph from the already-installed `lucide-react@1.17.0`. No registry audit run; no flags.

---

## Files Audited
- `src/tools/cron/CronTool.tsx` (the implemented view — primary audit target)
- `src/tools/cron/index.ts` (registry entry — `id: "cron"`, `icon: Clock`, `category: "converters"`)
- `src/lib/tools/registry.ts` (one import + one `TOOLS` append — `#/tools/cron` auto-derived)
- `src/lib/cron/cron.ts` interface (the `CronResult` contract the view renders) — via summaries
- `src/lib/timeFormat.ts` (`relativeTime` consumed by the run-row captions)
- `src/index.css` `@theme` (color/font tokens — contrast + token-conformance baseline)
- `.planning/phases/15-cron-tool/15-UI-SPEC.md` (audit baseline)
- `.planning/phases/15-cron-tool/15-CONTEXT.md`, `15-04-PLAN.md`, `15-0{1,2,3,4}-SUMMARY.md` (intent + build record)
- `src/tools/regex/RegexTool.tsx` (sibling precedent for frame/CopyButton conformance)
