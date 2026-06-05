---
phase: 17-pinned-sidebar-section
reviewed: 2026-06-05T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/shell/preferences.ts
  - src/shell/prefsStore.ts
  - src/shell/prefsStore.test.ts
  - src/shell/usePreferences.ts
  - src/shell/usePreferences.test.ts
  - src/shell/toolOrder.ts
  - src/shell/toolOrder.test.ts
  - src/components/Sidebar.tsx
  - test/e2e/sidebar.e2e.ts
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 17: Code Review Report

**Reviewed:** 2026-06-05T00:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Reviewed the pinned/unpinned two-group sidebar implementation: the `pinnedToolIds`
preference with untrusted-merge coercion (`preferences.ts`, `prefsStore.ts`), the
pure `partitionTools` registry-partition helper (`toolOrder.ts`), the
`usePreferences` hook wiring (`usePreferences.ts`), the React `Sidebar.tsx` UI, and
the unit/e2e coverage.

Overall the implementation is strong and defensive. The untrusted-input handling
(`coercePinnedToolIds`, `partitionTools`) is correct and thoroughly tested — every
junk-input path yields a bounded registry partition with no crash, no phantom, no
duplicate. The "announce with the registry NAME, never the raw stored id" decision
correctly closes the injection surface (T-16-06/T-17-05). No security vulnerabilities
or correctness-breaking bugs were found. Project constraints are respected: zero new
deps (native HTML5 drag + lucide icons already in tree), `decoder.ts` untouched, the
aria-live region and keyboard paths are present.

The findings below are all WCAG-AA edge cases and maintainability items — no Critical
issues. The three Warnings concern keyboard focus-restoration corners and an
announcement gap that affect screen-reader/keyboard parity (the phase's mandatory bar).

## Warnings

### WR-01: Right-click-opened menu strands focus on `<body>` after Escape

**File:** `src/components/Sidebar.tsx:295-300, 336-345`
**Issue:** `openResetMenu` captures `menuReturnFocusRef.current = document.activeElement`.
When the menu is opened by mouse right-click (`openResetMenuFromMouse` →
`onContextMenu`), `document.activeElement` is typically `<body>` (a right-click does
not focus the row). On Escape, `closeResetMenu({ restoreFocus: true })` checks
`el && el.isConnected` — `<body>` is connected, so focus is restored TO `<body>`,
silently stranding keyboard focus instead of falling through to the `<nav>`/grip
fallback. The `.isConnected` guard only catches *detached* nodes, not the
"never-on-a-useful-element" mouse-open case.
**Fix:** Treat `<body>` (and non-focusable anchors) as "no sensible return target" so
the existing fallback runs:
```ts
const el = menuReturnFocusRef.current;
const usable =
  el && el.isConnected && el !== document.body && el.tabIndex >= 0;
if (usable) {
  el.focus();
} else {
  const fallback =
    navRef.current ??
    [...handleRefs.current.values()].find((h) => h?.isConnected) ??
    null;
  fallback?.focus();
}
```

### WR-02: Click-away dismissal can fire on the same gesture that opens the menu

**File:** `src/components/Sidebar.tsx:370-382`
**Issue:** The dismiss effect registers a `document` `click` listener whenever
`resetMenu` is set. `openResetMenuFromKeyboard` is bound to `onKeyDown` (Shift+F10 /
ContextMenu key) — safe. But the listener is a bare `click` with no
open-timestamp/`pointerdown`-vs-`click` guard. If a future caller ever opens the menu
from a `click`/`pointerup` handler (or a synthetic click bubbles after the state
flush), the document `click` listener installed in the same tick can fire and
immediately close the menu. Today the only open paths are right-click and keyboard, so
this is latent rather than active — but the pattern is fragile.
**Fix:** Defer attaching the click-away listener one tick, or gate it on a captured
open timestamp:
```ts
useEffect(() => {
  if (!resetMenu) return;
  const openedAt = Date.now();
  const onDocClick = () => {
    if (Date.now() - openedAt < 0) return; // belt-and-suspenders
    closeResetMenu();
  };
  // attach on the next frame so the opening gesture's click can't self-close
  const id = window.setTimeout(() => document.addEventListener("click", onDocClick), 0);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") closeResetMenu({ restoreFocus: true });
  };
  document.addEventListener("keydown", onKey);
  return () => {
    window.clearTimeout(id);
    document.removeEventListener("click", onDocClick);
    document.removeEventListener("keydown", onKey);
  };
}, [resetMenu, closeResetMenu]);
```

### WR-03: Alt+P toggle does not re-announce when the same tool is rapidly re-toggled to an identical message — but the boundary path does

**File:** `src/components/Sidebar.tsx:159-169, 112-126`
**Issue:** `announce` correctly bounces through empty when the *same* string repeats.
However `togglePin` builds the message as `Pinned ${name}` / `Unpinned ${name}` and
will alternate text on each toggle, so the polite region fires fine for pin/unpin.
The real gap is that `togglePin` always sets `focusAfterMoveRef.current = id`
*unconditionally* (line 164) before checking nothing further — if `togglePinned`
short-circuits to a no-op inside the hook (it cannot today, but the contract is "set
focus only when a move actually happens"), focus would be forced even when the row did
not move groups, which can yank focus away from where a screen reader was reading. This
is a defensive concern: the focus side-effect should be tied to the toggle actually
landing, mirroring `commitMove`'s `opts?.focus` gating.
**Fix:** Acceptable as-is given `togglePinned` always mutates; if you want to harden,
only set `focusAfterMoveRef` after confirming the membership actually changed (compare
`pinnedSet.has(id)` before/after, or pass an explicit `focus` intent the way
`commitMove` does). At minimum add a one-line comment that the unconditional focus set
is safe because `togglePinned` always produces a new array.

## Info

### IN-01: `coercePinnedToolIds` and `coerceToolOrder` are byte-for-byte duplicates

**File:** `src/shell/prefsStore.ts:71-82, 90-101`
**Issue:** The two coercers are identical except the function name (the comment at
line 84 even says "Mirrors coerceToolOrder byte-for-byte"). This is acknowledged
duplication, but two copies can still drift independently if one is later changed
(e.g. adding a cap to one).
**Fix:** Extract the shared body into one helper and alias both, keeping the named
exports for call-site clarity:
```ts
function dedupeStringIds(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string" || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}
export const coerceToolOrder = dedupeStringIds;
export const coercePinnedToolIds = dedupeStringIds;
```

### IN-02: `normalizeRecents` duplicates the same dedupe loop with only a cap added

**File:** `src/shell/prefsStore.ts:51-63`
**Issue:** A third copy of the keep-string/de-dupe loop, differing only by the
`RECENT_TOOLS_CAP` break. Same drift risk as IN-01.
**Fix:** Build on the extracted `dedupeStringIds` helper and slice, or pass an optional
`cap`:
```ts
export function normalizeRecents(value: unknown): string[] {
  return dedupeStringIds(value).slice(0, RECENT_TOOLS_CAP);
}
```

### IN-03: `renderRow` `isPinned` is computed two ways that must agree

**File:** `src/components/Sidebar.tsx:393**
**Issue:** `const isPinned = group === "pinned" || pinnedSet.has(id);` — the `group ===
"pinned"` short-circuit and `pinnedSet.has(id)` are redundant by construction (a row in
the pinned group is always in `pinnedSet`, since `pinnedSet` is derived from the same
`pinned` array at line 62). The belt-and-suspenders is harmless but signals uncertainty
about the invariant. Either trust `pinnedSet.has(id)` alone, or add a comment that the
`group` check is a cheap fast-path for the common case.
**Fix:** `const isPinned = pinnedSet.has(id);` (sufficient given `pinnedSet` is the
reconciled pinned group), or keep and comment the intent.

### IN-04: `announceMove`/boundary messages omit the group name, so SR users can't tell which list moved

**File:** `src/components/Sidebar.tsx:131-139, 268-281`
**Issue:** With two groups now visible, `Moved {name} to position N of M` and
`Already at position P of T` are scoped to a group but never say *which* group. A
screen-reader user reordering within the pinned group hears the same phrasing as the
unpinned group; "position 1 of 2" is ambiguous when both groups exist. This is a
polish gap, not a defect — the move itself is correct and announced.
**Fix:** Include the group in the announcement when a pinned group exists, e.g.
`Moved ${tool.name} to position ${n} of ${next.length} in ${group === "pinned" ?
"pinned tools" : "tools"}`. Gate on `pinned.length > 0` so the single-group case stays
terse.

---

_Reviewed: 2026-06-05T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
