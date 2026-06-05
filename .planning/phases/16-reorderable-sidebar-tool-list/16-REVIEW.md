---
phase: 16-reorderable-sidebar-tool-list
reviewed: 2026-06-05T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/components/Sidebar.tsx
  - src/shell/preferences.ts
  - src/shell/prefsStore.ts
  - src/shell/prefsStore.test.ts
  - src/shell/toolOrder.ts
  - src/shell/toolOrder.test.ts
  - src/shell/usePreferences.ts
  - src/shell/usePreferences.test.ts
  - test/e2e/sidebar.e2e.ts
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 16: Code Review Report

**Reviewed:** 2026-06-05T00:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 16 implements a user-reorderable sidebar over a clean pure backbone
(`toolOrder.ts`), persisted through the existing prefs seam, and consumed by a
reorderable `Sidebar.tsx` (HTML5 drag + Alt+arrow keyboard + aria-live + reset
menu). The architecture is sound and the project constraints are honored well:

- **Registry stays the single control plane** — `reconcileToolOrder` computes a
  render-time overlay and never mutates `ENABLED_TOOLS` (D-10). Confirmed.
- **Untrusted persisted input is reconciled before render** — two defensive
  layers (`coerceToolOrder` in `prefsStore.ts` + `reconcileToolOrder` in the
  sidebar) drop non-strings, de-dupe, and gate on registry membership. The
  output is provably a permutation of the registry (T-16-01/02/03). Solid.
- **Accent = selected-only** — the drop indicator uses `bg-tx-2` (neutral), and
  comments explicitly call out *not* using `bg-accent` (D-03). Confirmed.
- **Zero new runtime deps** — native HTML5 drag, no dnd library (D-02). Confirmed.
- **No injection surface** — announcements use the registry `tool.name`, never
  the raw stored id (T-16-06). Confirmed.
- **Keyboard reachable** — grip handle is a focusable `<button>` with
  `focus-visible:opacity-100`, reset is reachable via `Shift+F10`/`ContextMenu`
  (WCAG 2.1.1). Confirmed.

No critical issues. Two warnings concern edge-case behavior in the drag path and
a focus-restoration footgun; the info items are minor robustness/quality notes.

## Warnings

### WR-01: Drag-drop can re-render and reorder while the drop indicator is shown, but the dragged item's removal math assumes the gap index is relative to the *current* order

**File:** `src/components/Sidebar.tsx:162-177`
**Issue:** `onDrop` computes `from = orderedIds.indexOf(id)` and adjusts the gap
index with `from < dropIndex ? dropIndex - 1 : dropIndex`. This is correct *as
long as* no `commitMove` has run mid-drag. It cannot today (moves only commit on
drop), so the logic is sound in practice. The latent risk is that `dropIndex` is
a gap index captured against `orderedIds`, while `orderedIds` itself is
recomputed every render from `reconcileToolOrder(preferences.toolOrder, …)`. If
`preferences.toolOrder` ever changed during an in-flight drag (e.g. a future
external sync, or a second commit path), `dropIndex` and `orderedIds` would
desync and the item could land one slot off. Today this is safe but fragile.
**Fix:** Make the invariant explicit — assert/early-return when the dragged id
is no longer at the index the drop was computed against, or snapshot the order
at `onDragStart` and reconcile the drop against that snapshot:
```ts
const from = orderedIds.indexOf(id);
if (from === -1) { setDraggingId(null); setDropIndex(null); return; }
const target = from < dropIndex ? dropIndex - 1 : dropIndex;
if (target !== from) commitMove(id, target);
```
(This also folds the existing `from !== -1` guard into one early return.)

### WR-02: `menuReturnFocusRef` can restore focus to a detached/hidden element

**File:** `src/components/Sidebar.tsx:224-261`
**Issue:** `openResetMenu` snapshots `document.activeElement` and later
`closeResetMenu({ restoreFocus: true })` calls `.focus()` on it. The grip handle
that typically opens the menu via `Shift+F10` is `opacity-0` until hover/focus
and is re-keyed across reorders. If the focused element is removed from the DOM
between open and close (e.g. a tool drops out of the registry on a hot reload,
or the row re-renders), `.focus()` is a no-op and focus silently falls to
`<body>`, stranding keyboard users. `resetOrder` itself reorders nothing
structurally, so this is low-probability, but the contract is unguarded.
**Fix:** Guard the restore against connectedness and fall back to a stable
anchor (the nav) so focus is never lost:
```ts
const el = menuReturnFocusRef.current;
if (opts?.restoreFocus) {
  if (el && el.isConnected) el.focus();
  else navRef.current?.focus(); // a tabindable fallback
}
```

## Info

### IN-01: A successful move is persisted even when the tool name cannot be resolved for the announcement

**File:** `src/components/Sidebar.tsx:97-105, 109-117`
**Issue:** `commitMove` calls `setToolOrder(next)` then `announceMove(id, next)`.
`announceMove` early-returns when `getToolById(id)` is undefined, so the order is
persisted but no announcement fires — a silent move for SR users. Because
`orderedIds` is always reconciled to the registry, `id` is effectively always
known, so this is defensive-only. Still, the persist-then-announce ordering means
a future un-reconciled caller would lose the announcement, not the persist.
**Fix:** Resolve the tool before committing and skip both when unknown, or accept
the current ordering as intentional and add a comment that `id` is guaranteed
registry-resident by the `orderedIds` source.

### IN-02: `announce` empty-string bounce uses a 30ms magic timer

**File:** `src/components/Sidebar.tsx:79-93`
**Issue:** The polite-region re-fire path uses a hardcoded `30` ms timeout to
clear-then-re-set identical text. It works, but the value is a magic number with
no named rationale and is timing-fragile (a fast double-bump could coalesce).
**Fix:** Hoist to a named constant (e.g. `const ARIA_REANNOUNCE_MS = 30;`) with a
one-line note on why a tick-delay is needed (force the live region to observe a
text transition). Functionally fine as-is.

### IN-03: `onDragStart` `useCallback` has an empty dependency array but reads only event/arg values — fine, but inconsistent with sibling handlers

**File:** `src/components/Sidebar.tsx:120-127`
**Issue:** `onDragStart` is memoized with `[]`; it only touches `e` and `id` plus
`setDraggingId` (stable), so the empty array is correct. The neighboring drag
handlers list their captured values. Not a bug — just an easy spot to second-guess
during maintenance.
**Fix:** None required. Optionally add `// no captured state — stable` to match
the documentation density of the surrounding handlers.

### IN-04: Empty-registry / single-tool sidebar has no reorder affordance, untested

**File:** `src/components/Sidebar.tsx:303-403`; `test/e2e/sidebar.e2e.ts:57-60`
**Issue:** With one enabled tool the grip still renders but Alt+arrow always hits
the boundary branch (announces "Already at position 1 of 1"), and the drag
end-zone is a no-op. This is correct behavior, but there is no unit/e2e coverage
for the degenerate (0/1 tool) case; the e2e asserts `length >= 2`. Given the
"six tools only" constraint the list is never that small in production, so this
is purely a coverage gap, not a defect.
**Fix:** Optionally add a `reconcileToolOrder` / `moveToolInOrder` unit case for a
single-element registry to lock the boundary phrasing. No runtime change needed.

---

_Reviewed: 2026-06-05T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
