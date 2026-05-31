# Phase 3 — UI Review

**Audited:** 2026-05-31
**Baseline:** Abstract 6-pillar standards + project locked design system (`design/DevTools Mockup.html` tokens, REQUIREMENTS UX-01..05, 03-CONTEXT D-01..D-18). No UI-SPEC.md for this phase.
**Screenshots:** Not captured — no dev server detected on :3000/:5173/:1420/:8080 (`tauri dev` not running). Code-only audit: Tailwind token audit, string audit, state-coverage audit, and computed WCAG contrast on the `@theme` token pairs in `src/index.css`.
**Scope:** The two shipped tools — `src/tools/base64/*` and `src/tools/protobuf-decoder/*` — plus the cross-cutting UX constraints. Shell chrome (`src/components/Sidebar.tsx`, `CommandPalette.tsx`, `App.tsx`) shipped in Phase 2 and is noted only where it affects a Phase-3 contrast pattern.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Specific labels throughout ("Copy all as JSON", named encoding errors, neutral empty states); no generic "Submit/OK". |
| 2. Visuals | 4/4 | Clear hierarchy (#N · wire badge · chips · value); every icon-only button has an `aria-label`; auto-expanded sub-messages give instant explorability. |
| 3. Color | 3/4 | Accent = selection discipline is held perfectly (neutral `#N` verified). One arbitrary `rgba()` in shell hover, but tools are token-pure. |
| 4. Typography | 3/4 | Two weights only; but ~11 distinct arbitrary px font sizes across tools+shell — above the "≤4 sizes" heuristic and not snapped to a named scale. |
| 5. Spacing | 3/4 | Tool components use the standard scale; the Phase-2 shell leans on arbitrary `px-[11px]`/`gap-[11px]` brackets. No fixed pane widths (UX-05 held). |
| 6. Experience Design | 2/4 | States are well covered (loading-instant, error `role="alert"`, empty, copy feedback, no hover-only copy) — but `--tx-3` body text fails WCAG-AA contrast, and the phase gate is an explicit AA audit. |

**Overall: 19/24**

---

## Top 3 Priority Fixes

1. **`--tx-3` (#686d77) body text fails WCAG-AA (4.5:1) on every dark surface (3.3–3.8:1).** — The phase boundary requires a passing `gsd-ui-review` WCAG-AA audit (D-17 / UX-04), so this is a gate blocker, not cosmetic. It hits user-facing small text: the protobuf empty state ("Paste hex or base64 protobuf bytes to decode." — the FIRST thing a user sees, `ProtobufDecoder.tsx:223`, 12.5px), the per-field byte-length label (`FieldNode.tsx:75`, 11px), and the "Examples" label (`ProtobufDecoder.tsx:95`, 11px). — **Fix:** raise `--color-tx-3` until it clears 4.5:1 on `--card`/`--input-bg` (≈ `#7e838d` gives ~4.6:1; `#868b95` is safer at ~5.0:1), or promote these specific labels to `text-tx-2` (already AA at 6.3–7.2:1). `--tx-3` may remain only on genuinely large/decorative text (≥18.66px bold or ≥24px), which none of the flagged usages are.

2. **`--accent` (#3b82f6) on `--card` is 4.69:1 — passes AA for text but the selected-chip text rides the floor.** — Selected interpretation chips and the active encoding/tree-style segment render `text-accent` at 11px on `bg-accent-soft` over `--card`; the effective contrast against the soft-tint background is lower than the 4.69:1 measured against solid card. The selected state is the single most important signal in the hero (accent = selection), so it must read unambiguously. — **Fix:** verify the rendered chip text against `accent-soft` over `card` in the real WKWebView; if it dips below 4.5:1, darken the chip text toward `--color-accent-line` or add the subtle border (already present via `border-accent-line`) as the non-color selection cue so selection never depends on the accent text contrast alone.

3. **Typography scale is unmanaged: ~11 distinct arbitrary px sizes (`text-[10.5px]` … `text-[19px]`) instead of a small named scale.** — Spread across both tools and the shell, this makes consistent vertical rhythm fragile and every new tool a fresh guess. Not a user-visible defect today, but it is the kind of drift the design system exists to prevent. — **Fix:** define 4–5 `--text-*` steps in the `@theme` block (e.g. 11 / 12.5 / 13.5 / 16 / 19) and replace the bracket literals with the generated `text-*` utilities, so Phase 4's four tools inherit one ramp.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)
- Grep for generic labels (`Submit`/`OK`/`Cancel`/`Save`) returned **none** in non-test source.
- CTAs are specific and action-named: `Copy all as JSON`, per-pane `Copy {label}` aria-labels, `Copy field {n} value`, `Resize panes`, `Expand/Collapse sub-message`.
- Empty states are neutral and instructive, not error-toned: protobuf `"Paste hex or base64 protobuf bytes to decode."` (`ProtobufDecoder.tsx:223`); palette `"No tools match"` (a quiet row, never an error — `CommandPalette.tsx:177`). Empty input maps to a neutral `"Empty"` status, not an error (`StatusBar.tsx` `STATE_LABEL`).
- Encoding errors are named, not silent (D-13) — surfaced through the field's `aria-describedby` + the status bar `error` slot. (Only deduction risk would be over-terse error strings, which live in `useBytesConvert`/`decoder.ts` and are out of this UI layer.)

### Pillar 2: Visuals (4/4)
- Clear per-field hierarchy in `FieldNode.tsx`: `#N` (semibold) → wire badge (muted pill) → byte length (right-aligned) → chips row → value/sub-tree. Selected chip is the lone accent, giving an unambiguous focal point.
- Every icon-only control is labelled: copy buttons (`aria-label="Copy …"`), expand toggle (`aria-label` + `aria-expanded`), resize separator (`aria-label="Resize panes"`, `role="separator"`). No unlabelled icon buttons found.
- Explorability-at-a-glance (the hero's whole point) is delivered: sub-messages auto-expand by default (D-05, `expanded = !collapsed.has(path)`), and four example chips let a first-time user see the model immediately.
- Sub-message nesting uses a `border-l-2 border-accent-line` rail (`FieldNode.tsx:151`) — note this is one of the few non-selection uses of an accent-derived token; it reads as structural indentation rather than a selection signal, so it does not break the accent discipline, but it is worth a glance in the real webview.

### Pillar 3: Color (3/4)
- Accent usage count: **13** token references across non-test tsx — tight and intentional.
- **"Accent = selection only" verified.** `#N` renders `text-tx` (neutral), never accent (`FieldNode.tsx:68`, `data-fnum`), explicitly overriding the mockup's accent-blue field numbers (D-08). Accent classes (`text-accent` / `bg-accent-soft` / `border-accent-line`) appear only on: selected chip (`chip-on`), active encoding segment, active example chip, active tree-style segment, active sidebar/palette item, and copy-confirmed state. This is exactly the locked rule.
- The encoding override toggle correctly doubles as the detection readout (the superseded-chip refinement in 03-CONTEXT): active segment = `result.encoding`, accented; clicking it clears the override back to auto-detect (`ProtobufDecoder.tsx:131-149`). One control, no redundant chip — matches the final decision.
- No hardcoded hex/`rgb()` colors in non-test tsx. **One arbitrary value:** `hover:bg-[rgba(255,255,255,0.035)]` in `Sidebar.tsx:35` (Phase-2 shell, out of this phase's scope) — a hover tint with no token. Minor; recommend a `--color-hover` token for consistency.
- Deduction is for the unmanaged hover literal + the contrast interaction of the accent text on `accent-soft` (see Priority Fix 2); the discipline itself is exemplary.

### Pillar 4: Typography (3/4)
- Font weights: only **`font-medium` and `font-semibold`** in use — within the ≤2-weight heuristic. Good.
- Font sizes: **~11 distinct arbitrary px literals** — `text-[10.5px]`, `[11px]`, `[11.5px]`, `[12px]`, `[12.5px]`, `[13px]`, `[13.5px]`, `[14px]`, `[16px]`, `[19px]`. This exceeds the "≤4 sizes" heuristic and none are snapped to a named `@theme` scale (see Priority Fix 3). Mono vs sans split is handled cleanly via `--font-sans`/`--font-mono` tokens.
- No functional defect; the deduction is for scale sprawl that will compound across Phase 4's four tools.

### Pillar 5: Spacing (3/4)
- **Tool components are token-disciplined and layout-agnostic (UX-05 held).** `Base64Tool`, `FieldNode`, `FieldTree`, `ProtobufDecoder` use the standard scale (`gap-2/3/4`, `p-3/4`, `mt-2`, `py-0.5`, etc.). No fixed pane widths — `ResizableSplit` uses relative `fr` units with the only px being the 7px gutter (`ResizableSplit.tsx:83`), and panes use `min-w-0 flex-1`.
- **Arbitrary px spacing concentrated in the Phase-2 shell:** `p-[14px]`, `px-[11px]`, `gap-[11px]`, `px-[18px]`, `py-[9px]`, `pb-[5px]`, `pt-[10px]` in `Sidebar.tsx`/`CommandPalette.tsx`. These predate this phase and faithfully port the mockup's odd-pixel values, but they bypass the spacing scale. Out of strict Phase-3 scope; flag for a future shell pass (define spacing tokens, or round to scale steps).
- The `w-[268px]` sidebar and `w-[min(560px,92vw)]` palette are intentional shell-chrome fixed widths (allowed — UX-05 governs *tool* components, and these live in the shell). No tool introduced a fixed width.

### Pillar 6: Experience Design (2/4)
- **State coverage is strong:**
  - *Instant transform* (UX-01): no decode/convert button anywhere; `ProtobufDecoder` decodes in a `useMemo` on input change, `Base64Tool` derives on every `onChange`. Timing surfaced in the status bar (`timingMs`), satisfying the <2s/UX-03 budget visibly.
  - *Error states*: protobuf decode errors render `role="alert"` inline (`ProtobufDecoder.tsx:217`) AND in the status bar; the decode is wrapped so a group/truncation byte never crashes (error-as-string boundary, T-03-03). Base64 per-field errors render `aria-invalid` + `aria-describedby` + a `text-bad` node. Status bar is `role="status" aria-live="polite"`.
  - *Empty states*: neutral, present for both tools and the palette.
  - *Copy feedback*: `useCopyFeedback` gives a momentary "Copied"/check on every copy affordance — necessary since the OS gives none.
  - **No hover-only copy** (D-10): grep for `is-hover` / `data-copy="hover"` / `opacity-0 group-hover` returned **none** — the binding "no hover-only copy, ever" rule is held. Every copy button is a visible, focusable `<button>` reachable in ≤1 keystroke.
  - **Disabled state not signalled by opacity alone** (D-17): grep for `disabled:opacity` / `opacity-40/50` returned **none** — the mockup's `chip:disabled{opacity:.4}` was correctly NOT carried over.
  - *Focus visibility* (UX-04): consistent `focus-visible:ring-2 focus-visible:ring-accent` on every interactive element, including the resize separator (`tabIndex={0}`, keyboard-nudgeable).
- **Why only 2/4 — the binding AA gate is not met.** The phase boundary is explicitly gated on a *passing* WCAG-AA audit (D-17 / harness phase-boundary rule), and the computed token contrasts show `--color-tx-3 (#686d77)` at **3.32–3.79:1** across `bg-app`/`pane`/`card`/`input-bg` — below the 4.5:1 normal-text floor — used for real small body text (empty-state instruction at 12.5px, byte-length at 11px, "Examples" label at 11px). Because the phase's own Definition of Done is an AA pass, an AA-failing default text color is a real, in-scope problem rather than perfectionism. Everything else in this pillar is 4/4-quality; fix the contrast and this pillar rises to 4.

#### WCAG-AA contrast table (computed from `src/index.css` `@theme`)

| Token | on bg-app | on pane | on card | on input-bg | Verdict |
|-------|-----------|---------|---------|-------------|---------|
| `--tx` #e7e9ee | 16.21 | 14.90 | 14.20 | 15.79 | Pass (AAA) |
| `--tx-2` #989da7 | 7.23 | 6.65 | 6.34 | 7.05 | Pass (AA) |
| `--tx-3` #686d77 | 3.79 | 3.48 | **3.32** | 3.69 | **FAIL for normal text (<4.5)** |
| `--accent` #3b82f6 | 5.35 | 4.92 | 4.69 | 5.22 | Pass AA normal (verify on accent-soft) |
| `--bad` #f0876b | 7.86 | 7.22 | 6.88 | 7.66 | Pass (AA) |
| `--ok` #34d399 | 10.24 | 9.41 | 8.97 | 9.98 | Pass (AA) |

`--tx-3` passes only the 3:1 large-text / non-text-UI threshold — acceptable for decorative or ≥18.66px-bold text, but not for the 11–12.5px body labels it is currently applied to.

---

## Files Audited

**Phase-3 tools (in scope):**
- `src/tools/base64/Base64Tool.tsx`
- `src/tools/base64/StatusBar.tsx`
- `src/tools/protobuf-decoder/ProtobufDecoder.tsx`
- `src/tools/protobuf-decoder/FieldNode.tsx`
- `src/tools/protobuf-decoder/FieldTree.tsx`
- `src/tools/protobuf-decoder/ResizableSplit.tsx`
- `src/shell/useCopyFeedback.ts`

**Design system + shell chrome (referenced for tokens / cross-cutting patterns):**
- `src/index.css` (`@theme` tokens — contrast source of truth)
- `src/App.tsx`
- `src/components/Sidebar.tsx`
- `src/components/CommandPalette.tsx`

**Context (read, not scored):** 03-CONTEXT.md, 03-01..04 SUMMARY.md.

**Not run:** Registry safety audit (no `components.json`/shadcn). Visual screenshot diff (no dev server — recommend re-running this audit against `tauri dev` to confirm the accent-on-accent-soft contrast in the real WKWebView, per Priority Fix 2).
