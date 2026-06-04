# Phase 12 — UI Review

**Audited:** 2026-06-03
**Baseline:** Abstract 6-pillar standards + canonical visual system (`design/DevTools Mockup.html`, `src/index.css` @theme tokens). No UI-SPEC.md for this phase.
**Screenshots:** Not captured (no dev server on :3000/:5173/:8080/:1420 — code-only audit). Per project MEMORY, the binding UI gate is `scripts/e2e-spike.sh` on the real WKWebView, exercised in Plan 12-02 Task 2; Chromium screenshots are preview-only.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Placeholder, empty-state, and named-token error copy all updated to mention decimal; error names the offending value (`999`). |
| 2. Visuals | 4/4 | Decimal segment + chip reuse the exact existing visual language; no new components, no icon-only buttons without labels. |
| 3. Color | 4/4 | Zero hardcoded colors; accent confined to active/selected states; error uses `text-bad` only. |
| 4. Typography | 4/4 | Mono scale (11/11.5/12.5/13px) + 2 weights, identical to the rest of the tool and the mockup. |
| 5. Spacing | 4/4 | Standard Tailwind scale; arbitrary values are only design-system radii (5/7px) and one min-height. |
| 6. Experience Design | 4/4 | Error-as-value (role=alert, no crash), auto-detect + clearable override, keyboard-focusable, stale-state reset on new decode. |

**Overall: 24/24**

---

## WCAG-AA Verdict: **PASS**

The three new/changed surfaces were audited against WCAG 2.1 AA. Contrast ratios computed from the live `@theme` tokens in `src/index.css`.

| Surface | Keyboard focusable | aria-pressed / role | Contrast | Verdict |
|---------|--------------------|--------------------|----------|---------|
| **Decimal toggle segment** (`ProtobufDecoder.tsx:134-152`) | Yes — native `<button>`, `focus-visible:ring-2 ring-accent` | `aria-pressed={active}` where `active = result.encoding === enc` (1.4.4 SC met: state is programmatic, not color-only) | accent `#5b9bf8` text on active accent-soft tint `#192435` = **5.57:1** (≥4.5 AA) | **PASS** |
| **Decimal example chip** (`ProtobufDecoder.tsx:101-120`) | Yes — native `<button>`, focus ring present | `aria-pressed={active}` (`raw === ex.value`); `data-example` is test-only | active accent on accent-soft = **5.57:1**; idle `tx-2 #989da7` on input-bg = **7.05:1** | **PASS** |
| **Decimal error alert** (`ProtobufDecoder.tsx:220-223`) | N/A (static text, announced) | `role="alert"` → assertive live region; StatusBar mirror is `role="status"`/`aria-live="polite"` with full text as `aria-label` | `text-bad #f0876b` on pane `#14161b` = **7.22:1** (on input-bg = 7.66:1) | **PASS** |

Notes:
- `aria-pressed` correctness is verified by `ProtobufDecoder.test.tsx:127-141` (decimal segment lights to `true` + `text-accent` on a comma array) and `:143-160` (out-of-range surfaces the named decimal error via `role="alert"`, never base64). These are unit-level; the real-WKWebView aria gate runs in `test/e2e/protobuf-decoder.e2e.ts` (Plan 12-02 Task 2).
- The accent brightening to `#5b9bf8` and `tx-3 → #868b95` were prior 03-UI-REVIEW AA fixes (`src/index.css:27-48`); this phase inherits an already-AA palette, so the new decimal segment clears AA by construction.
- No color-only state signalling: active state pairs the accent color with `aria-pressed` + a soft-fill background + border, satisfying SC 1.4.1.

---

## Top 3 Priority Fixes

This phase is a clean reuse of an established, already-audited pattern — there are no blocking or AA-affecting issues. The items below are minor, optional polish.

1. **Decimal example chip label reads `decimal bytes` while its sibling chips name the payload shape (`{1:150}`, `nested message`)** — minor inconsistency in the EXAMPLES taxonomy; a reader can't tell the decimal chip also decodes to `{1:150}` — relabel to something payload-descriptive, e.g. `{1:150} as decimal`, so the chip set stays "what you get" rather than mixing "what you get" with "what format it is" (`ProtobufDecoder.tsx:36`). Cosmetic only.
2. **The error live region is `role="alert"` (assertive) inline AND `aria-live="polite"` in the StatusBar** — both announce the same error text on every keystroke during an invalid paste, which can double-announce / be chatty for screen-reader users typing a long decimal list — consider debouncing or letting only one region announce (`ProtobufDecoder.tsx:221` + `StatusBar.tsx:60-95`). Pre-existing behavior, not introduced by this phase; flag for the shell, not a phase-12 regression.
3. **Decimal override of space-only input (`10 3 80`) is reachable only by manually clicking the `decimal` segment (D-03, intentional)** — there is no visible hint that space-only arrays need the manual override, so a user pasting `10 3 80` sees a hex/base64 mis-detect with no nudge toward the decimal toggle — optionally extend the empty-state/placeholder hint to mention "comma-separated auto-detects; use the decimal toggle for space-only". Product decision (D-03 deliberately keeps the surface small); informational only.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)
- Placeholder updated to `"Paste hex, base64, or decimal bytes…"` (`ProtobufDecoder.tsx:164`) and the empty-state hint matched: `"Paste hex, base64, or decimal bytes to decode."` (`:225`). Consistent voice, no generic "Submit/OK" labels.
- Error copy names the offending token (D-07): the inline `role="alert"` renders the `decimalToBytes` message (e.g. `Decimal byte 999 is out of range (0–255)`), asserted at `ProtobufDecoder.test.tsx:154-159` (`contains 999`, `out of range`, `decimal byte`, NOT `base64`). This is best-practice error copy — specific, actionable, names the value.
- Toggle segment labels (`hex` / `base64` / `decimal`) are lowercase mono, matching the existing two segments — no casing drift.
- Minor: example chip label `decimal bytes` describes format, not payload (see Fix #1).

### Pillar 2: Visuals (4/4)
- The decimal segment plugs into `OVERRIDES.map` (`:134`) with no render-logic change — same focal hierarchy, the active segment remains the single accented readout (no duplicate detected-mode chip, verified by `test:94` `[data-encoding-chip]` is null).
- The decimal chip reuses the `.ex` chip treatment (`:110-115`) verbatim — same border, radius, soft-fill-on-active. No new visual language introduced (matches `design/DevTools Mockup.html` `.ex` / `.ex.on`).
- No icon-only controls added; all new affordances are text-labeled buttons. Existing copy buttons keep `aria-label` + `aria-hidden` on their icons (`:211-214`).

### Pillar 3: Color (4/4)
- Zero hardcoded colors in the component (`grep` for `#hex`/`rgb(` → none). All color via theme tokens.
- Accent usage stays confined to active/selected states: `text-accent` (4×), `bg-accent`/`accent-soft` (3×), `border-accent`/`accent-line` (5×) — all gated behind an `active`/`copiedAll` boolean. Accent is never decorative, satisfying the project's "accent = selected only" constraint.
- Error is the only `text-bad` use (`:221`), never opacity-only (UX-04 honored).
- Idle text uses the `tx`/`tx-2`/`tx-3` ramp; the accent-soft/accent-line fills derive from `--color-accent` via `color-mix` (`index.css:52-53`), so the whole system is one source of truth.

### Pillar 4: Typography (4/4)
- Font sizes in use: `11px` (×4, chips/labels/toggle), `11.5px`, `12.5px` (error/empty-state), `13px` (textarea body). Four mono steps that mirror the mockup's `.ex` (11px) / body (13px) scale — not arbitrary sprawl, a deliberate ramp shared across the tool.
- Two weights only: `font-medium`, `font-semibold`. Within the "≤2 weights" guideline.
- All new text is `font-mono` (JetBrains Mono), correct for byte/encoding content.

### Pillar 5: Spacing (4/4)
- Standard Tailwind scale throughout: `gap-1/1.5/2/3`, `p-0.5/3/4`, `px-2/4`, `py-0.5/1/2.5`. Consistent rhythm.
- Arbitrary values are limited to design-system radii (`rounded-[5px]` ×2 inner segments, `rounded-[7px]` ×3 groups) and one `min-h-[120px]` on the textarea — these map to the mockup's chip/control radii, not ad-hoc magic numbers.
- The decimal segment and chip add NO new spacing values — they inherit the existing flex-wrap `gap-2` rows, so the layout stays uniform as the toggle grows from 2 to 3 segments. Layout-agnostic (no fixed widths), honoring the project constraint.

### Pillar 6: Experience Design (4/4)
- **Error-as-value, no crash:** the decimal parse throw is caught upstream in `decodeInput`'s try/catch (Plan 12-01) and surfaces as `result.error` → `role="alert"` (`:220-223`) + StatusBar `error` state. Unit test `:143-160` asserts `.not.toThrow()` on `1, 2, 999` (T-12-05 mitigated).
- **States covered:** empty (neutral hint, `parseState === "empty"`), error (alert + bad state), ok (field tree). No loading state needed (pure synchronous `useMemo`, paste-instant <2s — PRO-01).
- **Override is clearable:** clicking the active segment clears back to auto-detect (`:140` `setOverride(active ? undefined : enc)`), tested at `:103-115`. Auto-detect → manual → auto round-trip works for the new decimal segment too.
- **Stale-state safety:** selection/collapsed maps reset on a new decode key including the override (`:61-67`), preventing a stale non-message selection from hiding a decimal-decoded subtree.
- No destructive actions in this surface, so no confirmation needed.

---

## Registry audit
shadcn not initialized (no `components.json`) — registry safety audit skipped, no Registry Safety section.

---

## Files Audited
- `src/tools/protobuf-decoder/ProtobufDecoder.tsx` (the changed component — full read)
- `src/tools/protobuf-decoder/ProtobufDecoder.test.tsx` (aria-pressed / role=alert / accent-on-active assertions)
- `src/components/StatusBar.tsx` (parse-state / error live region)
- `src/index.css` (@theme color tokens — contrast source of truth)
- `design/DevTools Mockup.html` (canonical `.ex` / `.navitem.on` / accent-soft visual system)
- `.planning/phases/12-protobuf-decimal-input/` — 12-CONTEXT.md, 12-01-SUMMARY.md, 12-01 + 12-02 PLAN.md (intent baseline)
