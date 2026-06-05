---
phase: 17-pinned-sidebar-section
type: ui-review
audited: 2026-06-05
baseline: "abstract 6-pillar standards + 17-CONTEXT.md locked decisions (D-13..D-16) + design/DevTools Mockup.html tokens"
screenshots: not_captured_no_dev_server
wcag_target: AA
wcag_result: PASS_WITH_NOTES
overall_score: 23/24
pillar_scores:
  copywriting: 4
  visuals: 4
  color: 4
  typography: 4
  spacing: 4
  experience_design: 3
needs_human_review:
  - "Pin-icon reveal on pointer HOVER for unpinned rows (group-hover:opacity-100) — WebDriver cannot synth native hover"
  - "Native pointer DRAG reorder within each group never crossing the divider — WebDriver cannot synth native drag"
  - "Live viewport contrast/zoom spot-check on the real WKWebView at the tauri build gate"
wcag_failures: []
wcag_advisories:
  - "WCAG 2.5.8 Target Size (Minimum, AA): pin + grip buttons are 24px tall x 20px wide (h-6 w-5); width < 24px CSS px. Borderline — passes only via the spacing exception (~24px center-to-center). Verify on real webview."
registry_audit: "skipped — no components.json (not a shadcn project)"
---

# Phase 17 — UI Review: Pinned Sidebar Section

**Audited:** 2026-06-05
**Baseline:** Abstract 6-pillar standards + 17-CONTEXT.md locked decisions (D-13..D-16) + `design/DevTools Mockup.html` token contract. No UI-SPEC.md for this phase.
**Screenshots:** Not captured — no dev server on :3000/:5173/:8080/:1420 (code-only audit). The phase's own e2e wrote `test/e2e/__screenshots__/sidebar-pinned-wkwebview.png` on the real WKWebView (2026-06-05); live capture is deferred to the `tauri build` human gate.
**WCAG-AA gate:** PASS with advisories (no failures). This is the phase-boundary WCAG-AA sign-off audit.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Every label is specific and registry-named; aria-live announces the tool `name`, never a raw id. No generic strings. |
| 2. Visuals | 4/4 | Clear pinned/unpinned hierarchy via position + divider + persistent filled vs outline pin; every icon-only control has an aria-label. |
| 3. Color | 4/4 | Strictly neutral affordances (tx-2/tx-3); accent stays selected-only (D-03). All contrast meets WCAG-AA. No raw hex. |
| 4. Typography | 4/4 | Single weight (semibold) + a tight, mockup-aligned size set (13.5px row, 12.5px menu). No drift. |
| 5. Spacing | 4/4 | NavLink padding widened pr-12 to clear two stacked controls; spacing scale consistent; arbitrary px values trace to the canonical mockup. |
| 6. Experience Design | 3/4 | Keyboard path, focus survival, aria-live, empty/zero-pinned state all excellent; only gap is sub-24px control width (2.5.8 borderline) + two pointer affordances unverifiable without a human. |

**Overall: 23/24**

---

## WCAG-AA Assessment (sign-off gate)

| Criterion | Element | Measured | Verdict |
|-----------|---------|----------|---------|
| 1.4.3 Contrast (text) | active tool name `text-tx` on `--sidebar` | 15.43:1 | PASS (≥4.5) |
| 1.4.3 Contrast (text) | idle row `text-tx-2` on `--sidebar` | 6.89:1 | PASS |
| 1.4.3 Contrast (text) | menu item `text-tx-2` on `--panel` | 6.34:1 | PASS |
| 1.4.11 Non-text Contrast | filled pin / grip `text-tx-2` on `--sidebar` | 6.89:1 | PASS (≥3) |
| 1.4.11 Non-text Contrast | unpinned outline pin / grip `text-tx-3` on `--sidebar` | 3.61:1 | PASS (≥3) |
| 1.4.11 Non-text Contrast | drop insertion line `bg-tx-2` | 6.89:1 | PASS (≥3) |
| 1.4.11 Non-text Contrast | focus ring `ring-accent` on `--sidebar` | 5.10:1 | PASS (≥3) |
| 2.1.1 Keyboard | Alt+P pin/unpin, Alt+↑/↓ reorder, Shift+F10 menu, "Unpin all" | all keyboard-reachable | PASS |
| 2.4.3 Focus Order | `focusAfterMoveRef` re-focuses the moved/toggled handle across re-render; menu restore-focus with body/detached fallback | preserved | PASS |
| 2.4.7 Focus Visible | `focus-visible:ring-2 ring-accent` on every interactive control | present | PASS |
| 4.1.2 Name/Role/Value | pin `aria-label` + `aria-pressed`; `role="group"` SR-named "Pinned tools"/"Tools"; `role="menu"`/`menuitem` | complete | PASS |
| 4.1.3 Status Messages | `aria-live="polite"` sr-only region; re-announce bounce for repeat messages | present | PASS |
| **2.5.8 Target Size (Min, AA)** | pin + grip buttons `h-6 w-5` = 24x20px | width 20px < 24px | **ADVISORY** — passes via spacing exception only (≈24px center-to-center) |

**No WCAG-AA failures.** One advisory (2.5.8) — see Top Fix #1.

Note on the divider: the `<hr>` uses `border-bd` (rgba white 0.07 → ~1.19:1), which does *not* meet 1.4.11. This is **not a failure** — the `<hr>` is `aria-hidden="true"` and purely decorative; group identity is conveyed programmatically by the `aria-label="Pinned tools"` `role="group"` (D-15). WCAG 1.4.11 does not apply to purely aesthetic separators that carry no information state. It is a low-emphasis visual line by design (compact density, D-15).

---

## Top 3 Priority Fixes

1. **Pin/grip control width is 20px (< 24px CSS px), a WCAG 2.2 §2.5.8 borderline** — pointer users (esp. touch/trackpad-imprecise) get a smaller-than-ideal hit area; today it passes *only* because the ≈24px center-to-center spacing trips the exception. *Fix:* widen each control to `w-6` (24px) — there is room inside the `pr-12` padding, and the pin sits at `right-7`/grip at `right-1` so a 24px width still clears the row text. This converts a spacing-exception pass into an outright 2.5.8 pass and removes the fragility. (Confirm no name truncation on the real webview.)

2. **Two affordances remain human-verify-only and ride the build gate** — native pointer HOVER reveal of the unpinned outline pin, and native pointer DRAG-within-group never crossing the divider. *Fix (process):* execute both during the `tauri build` walkthrough (already listed in 17-VERIFICATION human items); confirm the `group-hover:opacity-100` reveal fires and a dragged pinned row stays above the divider. Keyboard equivalents are e2e-proven, so this is verification-only, not a code change.

3. **Repeat-message aria-live "bounce" relies on a 30ms timeout** — for fast double Alt+↑ at a boundary, the empty→re-set transition (Sidebar.tsx:117-125) could be perceived as a fl: a screen reader on a slow synth may clip the re-announce. *Fix (optional hardening):* consider appending a non-visible nonce or using `aria-relevant`/`role="status"` semantics so identical consecutive boundary messages reliably re-fire; verify with VoiceOver at the build gate. Low priority — current approach is a known working pattern from v1.4.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)
No generic strings (`grep` for Submit/OK/Cancel/Save/"No data" → none). All user-facing copy is specific and registry-bound:
- Pin button `aria-label`: `Pin {name}` / `Unpin {name}` (Sidebar.tsx:503); `title` adds the `(Alt+P)` chord hint (:505) — good shortcut discoverability.
- aria-live announcements use `getToolById(id).name` (`Pinned ${tool.name}` / `Unpinned ${tool.name}`, :183; move + boundary phrasing :146,:296-297) — never the raw stored id, which doubles as the T-17-05 injection mitigation.
- "Unpin all" menu label is exact and intentional (:645, D-16). Boundary feedback ("Already at last position N of M in pinned tools", :297) is unusually thoughtful — it makes a swallowed key *perceivable* rather than dead.
- Group disambiguation (`groupSuffix`, :135-139) only appends "in pinned tools"/"in tools" when a pinned group exists, avoiding the ambiguous "position 1 of 2" for SR users — a genuine copy refinement (IN-04).

### Pillar 2: Visuals (4/4)
Clear focal hierarchy: pinned group sits above a neutral divider (D-15), each row carries a persistent **filled** pin (state + unpin target) while unpinned rows reveal an **outline** pin on hover/focus only (D-14) — distinct glyph fills give an at-a-glance pinned/unpinned read without a text label. Every icon-only control is labelled (pin, grip, both menu items). The active-row accent bar + accent icon (`:474`,`:481`) preserves the selected-state focal point from the mockup. No icon-only button is unlabelled. The persistent-filled-pin choice correctly honors the project's "no hover-only primary affordance" ethos.

### Pillar 3: Color (4/4)
- Accent appears only on: focus ring (:460,:508,:538), the active-row accent bar/`bg-accent-soft`/`text-accent` (:462,:474,:481). All are *selected-or-focus* state — D-03 "accent = selected-only" holds. Pin/grip/divider/insertion line use neutral `text-tx-2`/`text-tx-3`/`border-bd`/`bg-tx-2` exclusively. The code comment at :437 explicitly rejects `bg-accent` for the drop cue — discipline visible in source.
- No raw hex literals. The only inline color values are `rgba(255,255,255,0.0xx)` hover tints (:463,:630,:642), which match the mockup's `--bd`/hover convention rather than introducing a new palette.
- All contrast meets WCAG-AA (table above). Tokens trace 1:1 to `design/DevTools Mockup.html` (`--tx-2:#989da7`, `--tx-3:#686d77`, `--accent:#3b82f6`).

### Pillar 4: Typography (4/4)
Exactly **one** font weight in the changed surface (`font-semibold`, :484) and a tight size set: `text-[13.5px]` for the row name (matches mockup `.navname` 13.5px) and `text-[12.5px]` for menu items. Both well under the >4-size / >2-weight drift thresholds. Arbitrary px values are intentional and mockup-aligned, not ad-hoc.

### Pillar 5: Spacing (4/4)
- NavLink right padding widened `pr-7 → pr-12` (:458) to clear the two stacked controls (pin `right-7`, grip `right-1`) without truncating the name (Pitfall 6) — correct response to the new control.
- Consistent gap scale (`gap-0.5` group rows, `gap-3` icon↔name, `gap-2` menu items, `my-1` divider). Arbitrary values (`h-[18px]`, `right-7`, `rounded-[9px]`) all trace to the mockup's pixel grid; the row radius 9px, icon 18px, and accent bar geometry match `.navitem`/`.navicon` exactly.
- Pin/grip both `h-6 w-5` — consistent with each other; see Pillar 6 / Fix #1 for the width concern.

### Pillar 6: Experience Design (3/4)
Strong: every interaction has a keyboard path (Alt+P, Alt+↑/↓, Shift+F10/ContextMenu, "Unpin all"), focus survives cross-group re-renders via a single shared `handleRefs`/`focusAfterMoveRef` map (:87-98, Pitfall 3), the menu has proper open-focus + Escape/click-away dismiss with a body/detached return-focus fallback (:346-370, WR-01/WR-02), and the zero-pinned "empty state" is handled by *removing* the group + divider entirely (:592-599, PIN-03) rather than showing an empty shell. The drop path defends against mid-drag overlay mutation (`from === -1` bail, :237-243). There are no loading/error states to audit — this is synchronous local prefs, correctly stateless.

Deductions:
- **2.5.8 target width** (Fix #1): controls are 20px wide; AA pass depends on the spacing exception. The single point off.
- Two pointer-only affordances (hover reveal, native drag-no-cross-boundary) are inherently un-automatable and ride the human build gate — already documented in 17-VERIFICATION, so this is a verification dependency, not a code gap.

---

## Files Audited
- `src/components/Sidebar.tsx` (652 lines — primary UI target: two-group render, pin button, Alt+P, divider, "Unpin all", reset menu)
- `design/DevTools Mockup.html` (canonical token contract — `--tx`, `--tx-2`, `--tx-3`, `--accent`, `--bd`, `--sidebar`, `--panel`)
- `.planning/phases/17-pinned-sidebar-section/17-CONTEXT.md` (locked decisions D-13..D-16 — the design contract)
- `.planning/phases/17-pinned-sidebar-section/17-01-SUMMARY.md`, `17-02-SUMMARY.md`, `17-01-PLAN.md`, `17-02-PLAN.md`, `17-VERIFICATION.md`
- `./CLAUDE.md` (project visual/a11y constraints)

**Registry audit:** Skipped — no `components.json` (not a shadcn project, no third-party registries).
**Screenshots:** Not captured — no dev server detected; live WKWebView capture deferred to the `tauri build` human gate.
