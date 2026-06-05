# Phase 16 — UI Review

**Audited:** 2026-06-05
**Baseline:** Abstract 6-pillar standards + project canonical visual system (`design/DevTools Mockup.html`) + locked decisions D-01..D-12 (`16-CONTEXT.md`). No UI-SPEC.md for this phase.
**Screenshots:** Not captured. Dev server responded on :1420 (Vite) but CLI Playwright against the Tauri SPA renders blank in headless Chromium (no Tauri bridge); per project harness, visual truth is the real WKWebView via `scripts/e2e-spike.sh` + the phase-boundary `tauri build` walkthrough, which is the human sign-off gate (Plan 02 Task 3). This audit is code + token + contrast analysis.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Action-specific labels throughout; aria-live phrasing matches D-06 contract exactly; uses registry `name`, never raw stored id |
| 2. Visuals | 4/4 | Handle is progressive-disclosure (hover + focus), not hidden-from-keyboard; active accent-bar + icon hierarchy preserved from mockup |
| 3. Color | 4/4 | Drop indicator + grip use neutral `tx-2`/`tx-3`; accent strictly selected-only (D-03); no hardcoded hex |
| 4. Typography | 4/4 | Two sizes (13.5px row, 12.5px menu), one weight (semibold) — matches mockup navitem scale |
| 5. Spacing | 3/4 | Consistent with mockup, but several arbitrary `[npx]` values and a magic `pr-7` reserving grip room — readable but undocumented coupling |
| 6. Experience Design | 3/4 | Strong state coverage (drag/keyboard/reset/dismiss); one a11y gap: Alt+arrow at a list end is silently swallowed with no announcement or audible cue |

**Overall: 22/24**

---

## Top 3 Priority Fixes

1. **End-of-list Alt+arrow is silently consumed (Sidebar.tsx:143-146)** — A screen-reader / keyboard user pressing Alt+↑ on the first tool (or Alt+↓ on the last) gets `e.preventDefault()` and an early `return` with no aria-live feedback, so nothing is spoken and the key appears dead. WCAG-AA perceivability gap for the boundary case. **Fix:** in the `target < 0 || target >= length` branch, set an announcement such as `Already at position 1 of {total}` (or `…last position`) before returning, so the boundary is perceivable rather than mute.

2. **Reset context menu has no keyboard entry point (Sidebar.tsx:154, 296)** — Reset order opens only via `onContextMenu` (right-click) on the `<nav>`. A keyboard-only user has no path to D-12 reset: there is no menu key handler, no visible trigger, and the menu items are never focused when opened. The phase is explicitly WCAG-AA-gated and lists reset as a required affordance. **Fix:** either move focus to the first `menuitem` when the menu opens (and support `ContextMenu`/`Shift+F10` key or a visible affordance), or add a small always-visible reset control reachable by Tab. At minimum, focus the menuitem on open so an already-open menu is operable by keyboard.

3. **Drop indicator only renders adjacent to a hovered row, leaving a dead drop zone (Sidebar.tsx:99-126, 277-282)** — `dropIndex` is set only by `onRowDragOver`; the trailing line draws solely when `index === length-1 && dropIndex === length`. Dragging into the empty area below the last row (the `aside` padding / `nav` gap) does not fire a row `onDragOver`, so the indicator can disappear and a drop there resolves against a stale/null `dropIndex` (no-op). **Fix:** add an `onDragOver`/`onDrop` on the `<nav>` (or a tail spacer) that sets `dropIndex = length` when the pointer is past the last row, so end-of-list drops always show a cue and commit.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)
- No generic labels (`grep` for Submit/OK/Cancel/Save found only a comment hit). All user-facing strings are action-specific:
  - `Reorder ${tool.name}` aria-label + `Reorder ${tool.name} (drag, or Alt+↑/↓)` tooltip (Sidebar.tsx:264-265) — names the action and discloses both input methods.
  - `Moved ${tool.name} to position ${n} of ${next.length}` (Sidebar.tsx:71) — matches the D-06 contract verbatim ("Moved {tool} to position N of M") and the e2e regex `/Moved .+ to position \d+ of \d+/`.
  - `Sidebar order reset to default` (Sidebar.tsx:163) and `Reset order` menu item (Sidebar.tsx:293/310).
- Injection-safe: announcement uses the registry `tool.name`, never the untrusted stored `toolOrder` string (Sidebar.tsx:67-72) — closes T-16-06.

### Pillar 2: Visuals (4/4)
- Clear focal hierarchy preserved from the mockup: active row gets `bg-accent-soft` + a `scale-y` accent bar + `text-accent` icon (Sidebar.tsx:223-242); inactive rows stay `text-tx-2`. No regression to the Phase 2 navitem contract.
- Icon-only grip is correctly paired with both `aria-label` and `title` (Sidebar.tsx:264-265) — not an unlabeled icon button.
- The grip is `opacity-0` revealed on `group-hover` **and** `focus-visible:opacity-100` (Sidebar.tsx:269) — this is progressive disclosure of an affordance, NOT an opacity-only disabled state, and crucially it is reachable by keyboard focus (the WCAG concern the objective flagged). The dragging row uses `opacity-50` (Sidebar.tsx:210) purely as a transient drag-ghost cue, not a disabled signal.
- `aria-hidden="true"` correctly applied to the decorative accent bar and both insertion lines (Sidebar.tsx:203/232/279).

### Pillar 3: Color (4/4)
- **WCAG 1.4.11 (non-text contrast) — passes with margin.** Computed against the sidebar bg `#101216`:
  - Drop indicator `bg-tx-2` (#989da7): **6.89:1** (needs 3:1). The in-code comment's "~6.9:1" claim is accurate.
  - Grip icon `text-tx-3` (#868b95): **5.48:1** (needs 3:1; even clears 4.5:1 text).
  - Focus ring `ring-accent` (#5b9bf8): **6.69:1**, applied consistently to both NavLink (Sidebar.tsx:221) and grip (Sidebar.tsx:270).
- **Accent = selected-only (D-03) honored.** `bg-accent`/`text-accent` appear only on the active-row accent bar + active icon (Sidebar.tsx:223/235/242). The drop indicator explicitly uses `bg-tx-2`, NOT `bg-accent` (Sidebar.tsx:204/280) — the locked decision is respected and the false-positive grep hit at line 200 is the "NOT bg-accent" comment.
- No hardcoded hex in the component; colors come through `@theme` tokens in `src/index.css` (tokens raised above the mockup originals — tx-3 #686d77→#868b95, accent for soft-tint AA — per prior 02/03 UI reviews). The two `rgba(255,255,255,0.035/.05)` hover tints (Sidebar.tsx:224/307) are subtle neutral hovers consistent with the mockup's `.navitem:hover`.

### Pillar 4: Typography (4/4)
- Two sizes in the component: `text-[13.5px]` row label (Sidebar.tsx:245) matching the mockup navitem, `text-[12.5px]` reset menu item (Sidebar.tsx:307). One weight: `font-semibold` on the row label. Well under the >4-sizes / >2-weights flag thresholds.
- Row label uses `min-w-0 truncate` so long tool names degrade gracefully in the fixed 268px aside.

### Pillar 5: Spacing (3/4)
- Layout matches the mockup: aside `w-[268px] p-[14px]` and `nav gap-0.5` reproduce `.sidebar`/navitem spacing; row `py-2 pl-[11px]` and icon gap `gap-3` (12px) match the mockup's "icon↔name gap 12px" note.
- Minor: several arbitrary bracket values (`pl-[11px]`, `rounded-[9px]`, `h-[56%]`, `left-[3px]`, `text-[13.5px]`, grip `h-6 w-5`, menu `min-w-[160px]`). These are faithful ports of the mockup's pixel system rather than scale tokens, so they are intentional — but they are not on a documented spacing scale.
- Watch item: the NavLink reserves grip room with `pr-7` (Sidebar.tsx:219) to clear the absolutely-positioned `right-1 w-5` handle. This is an undocumented magic coupling — if the grip width changes, `pr-7` must change in lockstep or the label will collide with the grip. Not a defect today; flag for a comment or shared constant. (Drops this pillar from 4 to 3.)

### Pillar 6: Experience Design (3/4)
- **State coverage is strong.** Drag lifecycle fully handled: `onDragStart`/`onRowDragOver`/`onDrop`/`onDragEnd` with drag-ghost `opacity-50` and a live insertion line (Sidebar.tsx:87-131). Keyboard reorder via Alt+↑/↓ with focus retention through a `handleRefs` map + `useLayoutEffect` re-focus (Sidebar.tsx:54-63, 148) — the moved item keeps focus (D-06/REORD-04). Plain arrows correctly fall through (Sidebar.tsx:138-139, D-05).
- Drag math is correct: the gap-index adjustment for an item dragged downward past its own slot (`from < dropIndex ? dropIndex-1 : dropIndex`, Sidebar.tsx:119) lands the item where the line shows.
- Reset menu is dismissible and does not trap focus: click-away + Escape listeners with cleanup (Sidebar.tsx:168-180), `stopPropagation` on the menu so inside-clicks don't self-dismiss (Sidebar.tsx:301).
- D-11 reconciliation defends the render: `getToolById(id)` with a defensive `if (!tool) return null` (Sidebar.tsx:186-187) even though `reconcileToolOrder` already guarantees a registry permutation (T-16-05 mitigated upstream by Plan 01's tested pure helpers, 40/40 green).
- **Gaps (each costs the perfect score):**
  - End-of-list Alt+arrow is silently swallowed with no aria-live feedback (Sidebar.tsx:143-146) — see Priority Fix 1.
  - Reset (D-12) has no keyboard path and the menu doesn't focus its item on open (Sidebar.tsx:154, 296) — see Priority Fix 2. The right-click-only entry technically satisfies "reachable" for pointer users but is a WCAG-AA keyboard-operability gap on a WCAG-gated phase.
  - End-of-list **drop** zone below the last row is dead because only rows carry `onDragOver` (Sidebar.tsx:99-126) — see Priority Fix 3.
- Registry safety / state independence: the component never mutates `ENABLED_TOOLS` (renders an overlay via `orderedIds`), so the ⌘K palette + router stay order-agnostic (D-10 / T-16-07). 11 tools in the registry, matching D-07's "all 11 freely movable."

---

## Files Audited
- `src/components/Sidebar.tsx` (the implemented reorderable sidebar — primary subject)
- `src/shell/toolOrder.ts` semantics (via Plan 01 SUMMARY/PLAN — `reconcileToolOrder`/`moveToolInOrder`, 13 cases green; consumed unchanged)
- `src/shell/preferences.ts` / `prefsStore.ts` / `usePreferences.ts` (persistence seam — via Plan 01 evidence)
- `src/lib/tools/registry.ts` (canonical order; 11 enabled tools; `getToolById`)
- `src/index.css` (Tailwind v4 `@theme` color tokens — contrast source of truth)
- `design/DevTools Mockup.html` (canonical CSS vars: `--accent`, `--tx-2`, `--tx-3`, `--bd`, `.navitem`)
- `.planning/phases/16-.../16-CONTEXT.md` (D-01..D-12), `16-01-PLAN.md`, `16-01-SUMMARY.md`, `16-02-PLAN.md`

**Registry audit:** Skipped — no `components.json` (project does not use shadcn). No third-party registries.

**Note for human sign-off:** the three findings are best confirmed/closed on the real WKWebView during the Plan 02 Task 3 walkthrough (VoiceOver for Fix 1, Tab-only operability for Fix 2, drag-below-last-row for Fix 3). Color/contrast findings are math-verified and do not require the live app.
