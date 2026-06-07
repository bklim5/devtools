# Phase 17: Pinned Sidebar Section - Research

**Researched:** 2026-06-05
**Domain:** React/TS sidebar UI overlay + pure prefs-backed state backbone (Tauri 2 desktop, macOS)
**Confidence:** HIGH (the entire reuse surface is local, verified code — no external/training-data dependence)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (carried-forward + D-13..D-16 — DO NOT re-litigate)
- **Render-time overlay, full partition:** pinning is an overlay over `ENABLED_TOOLS`, never a registry mutation. The reconciled tool list is partitioned into a pinned group + an unpinned remainder; **every registry tool renders in exactly one group**. Unknown/removed pinned IDs drop, duplicates collapse — the list can never crash, drop, or duplicate a tool (PIN-08). (extends v1.4 D-10/D-11)
- **Persistence:** additive `pinnedToolIds: string[]` on `Preferences`, written through the existing `usePreferences`/`platform.store` seam beside `toolOrder`, write-on-change. A dedicated `coercePinnedToolIds` (string-only, de-dupe, non-array → `[]`, **NO length cap**) mirrors `coerceToolOrder` (PIN-07).
- **Pin affordance mirrors the v1.4 grip handle:** hover + `focus-visible` reveal, neutral tokens — accent stays selected-only; a plain `NavLink` click still navigates (PIN-04).
- **Membership changes via pin/unpin only:** v1.4 drag + Alt+↑/↓ reorder runs **independently within each group**; a tool never crosses the pinned↔unpinned boundary by dragging (PIN-06).
- **No tool pinned by default** — empty pinned set ⇒ no divider, no group; the hero is NOT auto-pinned. Pinning **appends to the bottom** of the pinned group.
- **Pinned group order** is carried by the `pinnedToolIds` array order itself (append-on-pin); the unpinned remainder keeps the v1.4 per-group order via `reconcileToolOrder`/`moveToolInOrder`. No second persisted order array unless the planner finds it necessary.
- **D-13 (pin shortcut):** **Alt+P** while a sidebar row/handle is focused (Alt-family, mnemonic, conflict-free with ⌘K / Shift+F10 / ContextMenu / Escape). Plain single-key 'P' REJECTED. Every pin/unpin announced via the existing `aria-live="polite"` region using the registry `tool.name` — "Pinned {tool}" / "Unpinned {tool}" (PIN-05).
- **D-14 (pin icon):** pin icon sits **LEFT of the grip handle** (grip stays outermost). Pinned rows = persistent always-visible **FILLED pin** (the unpin click target, not hover-only). Unpinned rows = **OUTLINE pin on hover + focus-visible only**, mirroring the grip. Neutral tokens. NavLink right padding widens to clear **two** stacked controls.
- **D-15 (section presentation):** pinned group marked by a **BARE neutral divider line — NO visible "PINNED" text**. SR identity via `aria-label` on a `role="group"` / nav region ("Pinned tools"). Divider + group appear **only when ≥1 pinned** (PIN-03).
- **D-16 ("Unpin all"):** joins the existing right-click "Reset order" context menu as a **second item**, reusing the Shift+F10 / ContextMenu entry. Shown only when ≥1 pinned; calls `setPinnedToolIds([])` (PIN-09).

### Claude's Discretion
- Exact pin glyph (lucide `Pin` / `PinOff`), filled-vs-outline rendering, divider styling, exact `aria-label` wording / grouping element + role.
- Precise focus management after a pin/unpin re-render (mirror the v1.4 `focusAfterMove`/handle-refocus approach).
- The partition implementation detail (how `pinnedToolIds` order + the unpinned `reconcileToolOrder` result compose into the two render groups), as long as output is always a full registry partition and reuses the v1.4 helpers.
- Exact `NavLink` right-padding adjustment to clear the two controls.

### Deferred Ideas (OUT OF SCOPE — ignore completely)
- A dedicated settings/preferences surface.
- Auto-pin / lock-the-hero (default is no tool pinned).
- Cross-device pin sync.
- Dragging tools across the pinned↔unpinned boundary.
- Any dnd/animation library.
- Pinning affecting the ⌘K palette or routing (palette + router stay pin-agnostic).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Plan | Research Support |
|----|-------------|------|------------------|
| PIN-01 | Pin a tool → it moves to the "Pinned" section at the top | 17-02 | `togglePinned` + partition fn (this doc §Backbone) + Sidebar two-group render (§UI) |
| PIN-02 | Unpin a pinned tool → returns to main list | 17-02 | Same `togglePinned`; filled-pin click target (§UI, D-14) |
| PIN-03 | "Pinned" section shown only when ≥1 pinned, with a clear divider | 17-02 | Conditional render `pinnedGroup.length > 0` (§UI, D-15) |
| PIN-04 | Pin via a row pin icon, visible on hover + keyboard-focus | 17-02 | Mirror grip handle `opacity-0 group-hover:opacity-100 focus-visible:opacity-100` (§UI, D-14) |
| PIN-05 | Pin/unpin focused tool via keyboard shortcut + `aria-live` announce | 17-02 | Alt+P on handle `onKeyDown`; reuse `announce()` (§UI, D-13) |
| PIN-06 | Reorder independently within each group; no cross-boundary drag | 17-02 | `moveToolInOrder` per-group; partition keeps groups disjoint (§UI/§Backbone, D-?) |
| PIN-07 | Pinned set persists across restart via `pinnedToolIds` | 17-01 | `pinnedToolIds` field + `coercePinnedToolIds` + `setPinnedToolIds` (§Backbone) |
| PIN-08 | Unknown/removed IDs degrade gracefully; dupes collapse; no crash/dup | 17-01 | `coercePinnedToolIds` + partition gated on registry membership (§Backbone) |
| PIN-09 | "Unpin all" via keyboard-reachable control alongside "Reset order" | 17-02 | Second `role="menuitem"` in the existing reset menu (§UI, D-16) |
</phase_requirements>

## Summary

This is a structural near-clone of v1.4 Phase 16, and the entire reuse surface is verified, currently-shipping code. The phase needs **no new dependencies, no new patterns, and no external research** — every primitive (untrusted prefs coercion, pure reconciliation helpers, write-on-change setters, the grip-handle reveal, the `aria-live` `announce()` helper, the keyboard-reachable context menu with focus-restore, the `focusAfterMoveRef` re-focus dance) already exists in `src/shell/toolOrder.ts`, `src/shell/prefsStore.ts`, `src/shell/usePreferences.ts`, and `src/components/Sidebar.tsx`. The work is (a) adding one more prefs field with a coercer mirroring `coerceToolOrder`, (b) adding one pure partition function with the v1.4 "immovable bar" test matrix, and (c) extending the single `Sidebar.tsx` render into two groups with a pin icon, an Alt+P handler, a divider+labelled group, an "Unpin all" menu item, and pin/unpin focus management.

The single genuinely new design decision is **how the partition composes**: the pinned group is ordered by `pinnedToolIds` array order (append-on-pin, gated on registry membership + de-dupe), and the unpinned remainder is `reconcileToolOrder(toolOrder, <registry minus pinned>)`. **No second persisted order array is needed** — `pinnedToolIds` IS the pinned group's order (mutated by `moveToolInOrder` on Alt+↑/↓ within the pinned group), and `toolOrder` already carries the unpinned order. The partition output must always be a full registry permutation (every tool once), proven by a unit-test matrix identical in spirit to the existing `toolOrder.test.ts`.

The validation reality matches v1.4 exactly: native-OS drag cannot be synthesized by WebDriver (`dragDropEnabled:false` from v1.4), so the e2e exercises the **keyboard path** (Alt+P pin/unpin, Alt+↑/↓ reorder within each group, "Unpin all" via context menu) and pointer drag-within-group rides the human walkthrough.

**Primary recommendation:** Plan 17-01 = `pinnedToolIds` field + `coercePinnedToolIds` (mirror `coerceToolOrder`) + `setPinnedToolIds`/`togglePinned` setters + a pure `partitionTools(pinnedToolIds, toolOrder, registryIds)` helper in `toolOrder.ts` (or a sibling) with a full immovable-bar test matrix. Plan 17-02 = extend `Sidebar.tsx` to render the two groups, the left-of-grip pin icon, the Alt+P handler, the SR-labelled divider/group, the "Unpin all" menu item, and pin/unpin focus management mirroring `focusAfterMoveRef`. Use lucide `Pin`/`PinOff` (already installed). Zero new deps.

## Standard Stack

No new libraries. Everything is already present and verified.

### Core (already in the codebase — verified by reading the files)
| Module | Location | Purpose | Reuse for Phase 17 |
|--------|----------|---------|--------------------|
| `reconcileToolOrder` | `src/shell/toolOrder.ts:19-43` | Pure: untrusted saved order → registry permutation | Order the **unpinned remainder** within its sub-registry |
| `moveToolInOrder` | `src/shell/toolOrder.ts:49-62` | Pure: relocate one id to a clamped index, fresh array | Alt+↑/↓ reorder **within each group** (pinned reorders `pinnedToolIds`; unpinned reorders `toolOrder`) |
| `coerceToolOrder` | `src/shell/prefsStore.ts:71-82` | Untrusted: string-only, de-dupe, non-array→[], **no cap** | **Exact template** for `coercePinnedToolIds` |
| `Preferences` / `DEFAULT_PREFERENCES` | `src/shell/preferences.ts:22-53` | Typed prefs blob + defaults | Add `pinnedToolIds: string[]` / `pinnedToolIds: []` |
| `usePreferences` + `update()` | `src/shell/usePreferences.ts:39-106` | Write-on-change setters over the store seam | Add `setPinnedToolIds` + `togglePinned` |
| `ENABLED_TOOLS` / `getToolById` | `src/lib/tools/registry.ts:36-40` | Canonical registry (single control plane) | Partition source; `tool.name` for announcements; `tool.icon` per row |
| `Sidebar.tsx` machinery | `src/components/Sidebar.tsx` | Grip reveal, `announce()`, reset menu, `focusAfterMoveRef` | Extend, do not rewrite the patterns |
| `lucide-react` `Pin` / `PinOff` | installed `lucide-react@1.17.0` | Pin glyphs | The pin icon (filled vs outline) |

### lucide icon verification
```bash
# VERIFIED 2026-06-05: both glyphs ship in the installed module
ls node_modules/lucide-react/dist/esm/icons/ | grep -iE "^pin"
#   pin.mjs       → import { Pin } from "lucide-react"
#   pin-off.mjs   → import { PinOff } from "lucide-react"
```
`GripVertical` and `RotateCcw` are already imported in `Sidebar.tsx:23`. Add `Pin` (and optionally `PinOff` for the unpin affordance) from the same package — **no dependency change** `[VERIFIED: node_modules + Sidebar.tsx:23]`.

> Note: the installed `lucide-react` reports version `1.17.0` (a project-vendored/forked build, not the public npm `lucide-react` ~0.4xx line). This does not matter — the import names `Pin`/`PinOff` resolve in the installed module, confirmed above. `[VERIFIED: node_modules/lucide-react/package.json]`

**Installation:** none. `git diff package.json` MUST show no dependency change (binding constraint: zero new runtime AND dev deps).

## Architecture Patterns

### Exact current signatures (read from source — use these verbatim, do NOT re-derive)

```typescript
// src/shell/toolOrder.ts:19  [VERIFIED]
export function reconcileToolOrder(savedOrder: string[], registryIds: string[]): string[];
// src/shell/toolOrder.ts:49  [VERIFIED]
export function moveToolInOrder(order: string[], id: string, toIndex: number): string[];

// src/shell/prefsStore.ts:71  [VERIFIED] — the template for coercePinnedToolIds
export function coerceToolOrder(value: unknown): string[];

// src/shell/preferences.ts:22  [VERIFIED]
export interface Preferences {
  theme: ThemeName;
  accent: string;
  lastUsedId: string | null;
  recentToolIds: string[];
  toolOrder: string[];          // ← exact precedent for pinnedToolIds
  protobufTreeStyle: ProtobufTreeStyle;
  autoUpdateCheck: boolean | null;
}

// src/shell/usePreferences.ts:20  [VERIFIED] — interface to extend
export interface UsePreferences {
  preferences: Preferences;
  prefsLoaded: boolean;
  setTheme: (theme: ThemeName) => void;
  setAccent: (accent: string) => void;
  setLastUsedId: (id: string | null) => void;
  setToolOrder: (order: string[]) => void;   // ← exact precedent for setPinnedToolIds
  setTreeStyle: (style: ProtobufTreeStyle) => void;
  setAutoUpdateCheck: (v: boolean | null) => void;
}
// the private updater the setters wrap:  update(patch: Partial<Preferences>)  [usePreferences.ts:69]

// src/lib/tools/registry.ts  [VERIFIED]
export const ENABLED_TOOLS: ToolDefinition[];           // canonical order, each { id, name, icon, ... }
export function getToolById(id: string): ToolDefinition | undefined;
```

### How Sidebar.tsx currently builds its rendered list (verified)
1. `const { preferences, setToolOrder } = usePreferences();` — `Sidebar.tsx:35`
2. `const registryIds = ENABLED_TOOLS.map((t) => t.id);` — `Sidebar.tsx:40`
3. `const orderedIds = reconcileToolOrder(preferences.toolOrder, registryIds);` — `Sidebar.tsx:41`
4. `{orderedIds.map((id, index) => { const tool = getToolById(id); ... })}` inside a single `<nav>` — `Sidebar.tsx:338`
5. Each row = a wrapper `<div className="relative">` with drag handlers, holding a `NavLink` (`pl-[11px] pr-7`, `Sidebar.tsx:372`) + an absolutely-positioned grip `<button>` at `right-1` (`Sidebar.tsx:419-420`).
6. Drag uses `draggingId`/`dropIndex` state + `commitMove(id, toIndex)` → `moveToolInOrder(orderedIds, …)` → `setToolOrder(next)` — `Sidebar.tsx:112-120`.
7. Alt+↑/↓ in `onHandleKeyDown` (`Sidebar.tsx:198-229`) computes `target = current ± 1` against `orderedIds`, with boundary announcements; on success `commitMove(id, target, { focus: true })`.
8. `focusAfterMoveRef` + a `useLayoutEffect` (`Sidebar.tsx:59-68`) re-focus the moved tool's handle by id after re-render via `handleRefs` map.
9. `announce(msg)` (`Sidebar.tsx:82-96`) sets the `aria-live="polite"` `sr-only` region (`Sidebar.tsx:442-444`), with a same-message re-fire bounce.
10. Reset menu: `openResetMenuFromMouse` (onContextMenu) + `openResetMenuFromKeyboard` (Shift+F10 / ContextMenu) on the `<nav>` (`Sidebar.tsx:333-334`); `resetMenu` state renders a `role="menu"` with a single `Reset order` `role="menuitem"` (`Sidebar.tsx:447-471`); focus moves into the item on open (`Sidebar.tsx:301-303`), Escape/click-away dismiss with `closeResetMenu({ restoreFocus })` (`Sidebar.tsx:270-291`).

### Recommended project structure (no new files except a test; helper may live in toolOrder.ts)
```
src/shell/toolOrder.ts          # ADD partitionTools(...) (pure) beside reconcile/move
src/shell/toolOrder.test.ts     # ADD partition immovable-bar matrix
src/shell/preferences.ts        # ADD pinnedToolIds field + default []
src/shell/prefsStore.ts         # ADD coercePinnedToolIds + mergePreferences line
src/shell/prefsStore.test.ts    # ADD coercion cases
src/shell/usePreferences.ts     # ADD setPinnedToolIds + togglePinned
src/shell/usePreferences.test.ts# ADD round-trip + toggle cases
src/components/Sidebar.tsx       # EXTEND: two groups, pin icon, Alt+P, divider, Unpin all, focus
test/e2e/sidebar.e2e.ts          # EXTEND (or add) keyboard pin/unpin/reorder/unpin-all checks
```

### Pattern 1: The partition (the one genuinely new design — Plan 17-01 backbone)
**What:** A pure function that takes the saved `pinnedToolIds`, the saved `toolOrder`, and the live `registryIds`, and returns two ordered, disjoint id arrays whose union is exactly the registry set.

**Recommended signature + implementation sketch:**
```typescript
// src/shell/toolOrder.ts (new export, same pure/untrusted-safe style)
export interface ToolPartition {
  pinned: string[];     // ordered by pinnedToolIds, registry-gated, de-duped
  unpinned: string[];   // reconcileToolOrder(toolOrder) over the registry-minus-pinned set
}

/** Render-overlay partition (PIN-07/08, extends D-10/D-11). All three inputs may be
 *  UNTRUSTED (hand-edited prefs.json). Guarantees: every registry id appears in
 *  exactly ONE of the two arrays; no unknown id, no duplicate, no crash. */
export function partitionTools(
  pinnedToolIds: string[],
  toolOrder: string[],
  registryIds: string[],
): ToolPartition {
  const known = new Set(registryIds);
  const seen = new Set<string>();
  const pinned: string[] = [];
  const savedPinned = Array.isArray(pinnedToolIds) ? pinnedToolIds : [];
  for (const id of savedPinned) {
    if (typeof id !== "string") continue;   // untrusted: drop non-strings
    if (!known.has(id)) continue;           // drop ids no longer in the registry
    if (seen.has(id)) continue;             // de-dupe (collapse duplicates)
    seen.add(id);
    pinned.push(id);
  }
  // Unpinned = the registry remainder, ORDERED by the existing v1.4 helper.
  const remainderRegistry = registryIds.filter((id) => !seen.has(id));
  const unpinned = reconcileToolOrder(toolOrder, remainderRegistry);
  return { pinned, unpinned };
}
```
**Why this composes correctly:** `pinned` is a registry-gated, de-duped subset (≤ registry length). `remainderRegistry` is exactly the registry ids NOT pinned. `reconcileToolOrder(toolOrder, remainderRegistry)` is already proven to return a permutation of its `registryIds` argument (`toolOrder.test.ts:54-62`), so `unpinned` is a permutation of the remainder. Union(pinned, unpinned) = registry; intersection = ∅. The "immovable bar" holds by construction. `[VERIFIED: reconcileToolOrder semantics in toolOrder.ts + toolOrder.test.ts]`

**When to use:** in `Sidebar.tsx`, replacing the single `orderedIds` line with
`const { pinned, unpinned } = partitionTools(preferences.pinnedToolIds, preferences.toolOrder, registryIds);`

### Pattern 2: No second persisted order array (CONTEXT preference honored)
**What:** The pinned group's order IS `pinnedToolIds` (append-on-pin gives bottom-append for free); the unpinned group's order is the existing `toolOrder`. Reordering within a group mutates the corresponding array:
- Pinned-group Alt+↑/↓ or drag → `setPinnedToolIds(moveToolInOrder(pinned, id, target))`.
- Unpinned-group Alt+↑/↓ or drag → `setToolOrder(moveToolInOrder(unpinned, id, target))` (same as today).
**Why:** zero schema churn; `toolOrder` already coexists with pinned-out ids harmlessly because `reconcileToolOrder` over the *remainder* registry simply drops/ignores ids not in the remainder and append-orders the rest. A pinned tool's stale entry in `toolOrder` is inert until it's unpinned, at which point it re-enters the remainder and `reconcileToolOrder` honors any surviving relative order. `[ASSUMED — see A1: behavior when re-unpinning is "remainder reconcile decides position"; confirm this is the desired UX]`

### Pattern 3: togglePinned (membership mutation, append-on-pin)
```typescript
// usePreferences.ts — mirrors setToolOrder; reads current via prefsRef-backed state
const setPinnedToolIds = useCallback(
  (ids: string[]) => update({ pinnedToolIds: ids }),
  [update],
);
const togglePinned = useCallback(
  (id: string) =>
    setPinnedToolIds(
      preferences.pinnedToolIds.includes(id)
        ? preferences.pinnedToolIds.filter((x) => x !== id)  // unpin
        : [...preferences.pinnedToolIds, id],                // pin → append to bottom
    ),
  [preferences.pinnedToolIds, setPinnedToolIds],
);
```
> **Pitfall:** `update()` merges against `prefsRef.current` (`usePreferences.ts:71`), so reading `preferences.pinnedToolIds` in the `togglePinned` closure is correct as long as the deps array includes it (re-creates the callback on change). The existing `setToolOrder` takes a fully-computed array; the Sidebar computes `moveToolInOrder(...)` itself and passes the result — `togglePinned` follows the same "compute-then-set" shape but encapsulates the include/exclude logic. `[VERIFIED: usePreferences.ts:69-94]`

### Anti-Patterns to Avoid
- **Mutating `ENABLED_TOOLS` or routing on pin** — pinning is render-only; ⌘K palette + router stay pin-agnostic (D-10 carried). The partition is a render overlay, never written back to the registry.
- **A `role="group"` without an accessible name** — D-15 mandates the SR identity ("Pinned tools") via `aria-label`; a bare divider alone is invisible to screen readers.
- **Making the pin icon hover-only on PINNED rows** — D-14: pinned rows show a *persistent filled* pin (the project's "no hover-only primary action" ethos). Only the UNPINNED-row pin is hover/focus-revealed.
- **Using `bg-accent` for the divider or pin** — accent = selected-only (D-03 carried). Use neutral tokens (`bg-bd` / `text-tx-2`/`text-tx-3`), matching the grip and the existing `bg-tx-2` insertion line (`Sidebar.tsx:357`).
- **Binding plain 'P'** — D-13: Alt+P only (no single-key sidebar shortcut). Guard `if (!e.altKey) return;` exactly like `onHandleKeyDown` (`Sidebar.tsx:201`).
- **A second persisted order array** — CONTEXT says avoid unless necessary; the partition design above does not need one.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Untrusted prefs coercion | A new validation routine | `coercePinnedToolIds` = copy of `coerceToolOrder` (`prefsStore.ts:71-82`) | Already handles non-array→[], non-string drop, de-dupe; tested pattern |
| Registry-gated ordering | Custom filter/sort | `reconcileToolOrder` (`toolOrder.ts:19`) for the unpinned remainder | Proven permutation guarantee + new-tool append |
| One-slot relocate | Index splice math inline | `moveToolInOrder` (`toolOrder.ts:49`) | Clamping + fresh-array + unknown-id no-op already covered |
| `aria-live` re-fire on repeat | A new live region | `announce()` (`Sidebar.tsx:82-96`) | Handles the same-message bounce so repeated pins still speak |
| Keyboard-reachable menu + focus restore | A new menu/focus-trap | The existing reset-menu plumbing (`Sidebar.tsx:237-319`) | Shift+F10/ContextMenu entry, focus-into-item, Escape/click-away, WR-02 fallback all solved |
| Re-focus after a list re-render | A new ref/effect | `focusAfterMoveRef` + `handleRefs` + the layout effect (`Sidebar.tsx:57-68`) | Already re-focuses the moved tool's handle by id |
| Drag without a library | Any dnd/animation lib | Native HTML5 drag events (already in `Sidebar.tsx`) | Zero-new-deps constraint; `dragDropEnabled:false` already set |

**Key insight:** Phase 17 is ~90% wiring of existing, tested primitives. The only new *logic* is the `partitionTools` pure function (≈15 lines) and the two-group render. Everything else is duplication-with-rename of v1.4.

## Common Pitfalls

### Pitfall 1: Two groups, two `dropIndex`/drag scopes
**What goes wrong:** The current drag state (`draggingId`, `dropIndex`) and `commitMove` are written against a single `orderedIds`. With two groups, a drag in the pinned group must reorder `pinnedToolIds`, a drag in the unpinned group must reorder `toolOrder`, and the insertion line / `dropIndex` must be scoped so a drag over one group's rows never lands in the other (no cross-boundary, PIN-06).
**Why it happens:** `onRowDragOver`/`onDrop` compute a gap index against `orderedIds.length` (`Sidebar.tsx:135-190`).
**How to avoid:** Track which group is being dragged (e.g. `draggingGroup: 'pinned' | 'unpinned'`), compute `dropIndex` against that group's array, and route `commitMove` to `setPinnedToolIds` vs `setToolOrder` accordingly. The `onNavDragOver` end-zone (`Sidebar.tsx:155-163`) needs per-group scoping too (native drag is manual-walkthrough-verified, so get the keyboard path airtight in code and lean on the human walkthrough for pointer drag).

### Pitfall 2: Alt+↑/↓ must clamp within the group, not the whole list
**What goes wrong:** `onHandleKeyDown` computes `target` against `orderedIds` (`Sidebar.tsx:204-208`). A pinned tool at the bottom of the pinned group pressing Alt+↓ must hit a *group* boundary, not slide into the unpinned list.
**How to avoid:** When handling a row's Alt+↑/↓, look the id up in its OWN group array (`pinned` or `unpinned`), compute `target` and the boundary announcement against that array's length, and call the matching setter. Reuse the existing boundary-announce phrasing (`Sidebar.tsx:215-223`).

### Pitfall 3: Focus loss when a tool changes groups on pin/unpin
**What goes wrong:** Pinning a focused unpinned tool removes it from the unpinned group and inserts it into the pinned group; React re-renders both groups, and the focused handle's element can be replaced, stranding focus on `<body>`.
**How to avoid:** Reuse `focusAfterMoveRef` — set it to the toggled tool's id before the state change so the existing layout effect (`Sidebar.tsx:63-68`) re-focuses that tool's handle after the re-render. `handleRefs` is keyed by `tool.id` across BOTH groups (keep one shared map). `[VERIFIED: focusAfterMoveRef pattern, Sidebar.tsx:57-68]`

### Pitfall 4: Announcing the raw id instead of the registry name (injection surface)
**What goes wrong:** Announcing "Pinned {id}" leaks untrusted stored strings into the live region (T-16-06 analog).
**How to avoid:** Resolve `getToolById(id)?.name` and announce "Pinned {tool.name}" / "Unpinned {tool.name}" — exactly as `announceMove` does (`Sidebar.tsx:100-108`). React escapes text content, but use the registry name regardless.

### Pitfall 5: "Unpin all" / divider visibility tied to the wrong condition
**What goes wrong:** Showing the divider/group when `preferences.pinnedToolIds.length > 0` instead of when the *reconciled* `pinned` partition is non-empty — a prefs blob with only stale/unknown pinned ids would render an empty group + stray divider.
**How to avoid:** Gate on `partition.pinned.length > 0` (the post-reconcile array), not the raw pref. Same gate drives the "Unpin all" menu item's presence (D-16).

### Pitfall 6: NavLink padding collision with two right-edge controls
**What goes wrong:** The NavLink currently reserves `pr-7` for one grip at `right-1` (`Sidebar.tsx:372,420`). Adding a pin LEFT of the grip needs more right padding or the tool name truncates under the controls.
**How to avoid:** Widen the NavLink right padding (e.g. `pr-12` — Claude's discretion per CONTEXT) and position the pin to the LEFT of the grip (e.g. grip at `right-1`, pin at `right-7`), grip stays outermost (D-14).

### Pitfall 7: Tauri store async-init race (from MEMORY)
**What goes wrong:** A read before `initPlatform()` resolves hits localStorage not prefs.json — packaged-only, invisible to unit tests (project MEMORY note).
**How to avoid:** Nothing new — `pinnedToolIds` rides the exact same `loadPreferences`/`savePreferences` path that already `await initPlatform()` (`prefsStore.ts:110-125`). Verify persistence on the real WKWebView in the e2e, not just jsdom. `[CITED: project MEMORY — tauri-store-async-init-race]`

## Code Examples

### coercePinnedToolIds (Plan 17-01) — copy of coerceToolOrder, renamed
```typescript
// src/shell/prefsStore.ts — sibling of coerceToolOrder (lines 71-82), NO length cap
/** Keep only string ids, de-dupe — NO length cap (the pinned set is unbounded
 *  but the partition gates it against the registry). Untrusted (hand-edited
 *  prefs.json): non-array → []; non-strings dropped; duplicates collapsed.
 *  partitionTools (Sidebar) is the final registry-membership bound. */
export function coercePinnedToolIds(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}
// in mergePreferences (after toolOrder, prefsStore.ts:96):
//   pinnedToolIds: coercePinnedToolIds(blob.pinnedToolIds),
```
> `coerceToolOrder` and `coercePinnedToolIds` are byte-identical except the name. The planner may either duplicate (clearest provenance) or factor a shared `coerceStringIdList(value)` and call it for both — either is fine; the existing code chose a dedicated function over reusing `normalizeRecents` to avoid the cap coupling (`prefsStore.ts:66-70` comment). `[VERIFIED: prefsStore.ts:50-82]`

### Pin icon row control (Plan 17-02) — left of grip, mirrors the grip's reveal
```tsx
// Inside the row, BEFORE the grip <button>. Pinned = persistent filled; unpinned = hover/focus outline.
<button
  type="button"
  onClick={(e) => { e.preventDefault(); e.stopPropagation(); /* prevent NavLink nav */
    focusAfterMoveRef.current = tool.id; togglePinned(tool.id);
    announce(isPinned ? `Unpinned ${tool.name}` : `Pinned ${tool.name}`); }}
  aria-label={isPinned ? `Unpin ${tool.name}` : `Pin ${tool.name}`}
  aria-pressed={isPinned}
  className={[
    "absolute right-7 top-1/2 -translate-y-1/2 flex h-6 w-5 items-center justify-center rounded-[6px]",
    "outline-none focus-visible:ring-2 focus-visible:ring-accent",
    isPinned
      ? "text-tx-2"                                            // persistent, neutral
      : "text-tx-3 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100",
  ].join(" ")}
>
  <Pin className={["h-[14px] w-[14px]", isPinned ? "fill-current" : ""].join(" ")} />
</button>
```
> Filled vs outline: lucide `Pin` rendered with `fill-current` reads as filled; the unpinned state leaves it stroke-only (outline). `PinOff` is an alternative glyph for the unpin affordance (Claude's discretion, D-14). The `right-7`/`right-1` split keeps the grip outermost. `[CITED: D-14; pattern mirrors Sidebar.tsx:408-427]`

### Alt+P in the handle's onKeyDown (Plan 17-02)
```tsx
// Extend onHandleKeyDown (Sidebar.tsx:198) — Alt-family, mirrors the Alt+arrow guard
if (e.altKey && (e.key === "p" || e.key === "P")) {
  e.preventDefault();
  const tool = getToolById(id);
  if (!tool) return;
  const willPin = !pinnedSet.has(id);
  focusAfterMoveRef.current = id;          // keep focus on the moved row's handle
  togglePinned(id);
  announce(willPin ? `Pinned ${tool.name}` : `Unpinned ${tool.name}`);
  return;
}
```

### "Unpin all" menu item (Plan 17-02) — second item in the existing reset menu
```tsx
// Inside the existing resetMenu role="menu" (Sidebar.tsx:447-471), AFTER the Reset order button.
// Render only when the reconciled pinned group is non-empty.
{partition.pinned.length > 0 ? (
  <button
    type="button"
    role="menuitem"
    onClick={() => { setPinnedToolIds([]); announce("All tools unpinned"); closeResetMenu({ restoreFocus: true }); }}
    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] text-tx-2 outline-none transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-tx focus:bg-[rgba(255,255,255,0.05)] focus:text-tx"
  >
    <PinOff className="h-[14px] w-[14px] flex-none" />
    Unpin all
  </button>
) : null}
```
> The menu already opens on Shift+F10 / ContextMenu (`Sidebar.tsx:255-268`) and is keyboard-operable (PIN-09 satisfied by reuse). The first item keeps autofocus (`resetItemRef`, `Sidebar.tsx:301-303`); Tab/arrow moves to the second item per native button focus.

### Two-group render skeleton (Plan 17-02)
```tsx
const { pinned, unpinned } = partitionTools(
  preferences.pinnedToolIds, preferences.toolOrder, registryIds,
);
// ...inside <nav>:
{pinned.length > 0 ? (
  <div role="group" aria-label="Pinned tools" className="flex flex-col gap-0.5">
    {pinned.map((id, index) => renderRow(id, index, "pinned"))}
  </div>
) : null}
{pinned.length > 0 ? (
  <hr aria-hidden="true" className="my-1 border-t border-bd" />   // bare neutral divider, D-15
) : null}
<div role="group" aria-label="Tools" className="flex flex-col gap-0.5">
  {unpinned.map((id, index) => renderRow(id, index, "unpinned"))}
</div>
```
> Factor the existing row JSX (`Sidebar.tsx:343-436`) into a `renderRow(id, index, group)` closure so both groups share it; the `group` arg routes drag/keyboard to the right setter and array. `handleRefs`/`focusAfterMoveRef` stay shared across groups.

## State of the Art

No external state-of-the-art shift applies — this is an internal feature built entirely on v1.4 primitives. The relevant "state" is the v1.4 codebase itself, which is current and shipping.

**Deprecated/outdated:** none. The v1.4 out-of-scope line "no grouping/sections (list stays flat)" is *intentionally* superseded by this milestone's single "Pinned" group — a scoped exception, not a general folders feature (`REQUIREMENTS.md:44`). `[CITED: REQUIREMENTS.md]`

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | When a tool is unpinned, its position in the unpinned list is decided by `reconcileToolOrder` over the remainder (it re-enters wherever `toolOrder` places it, or appends at the bottom if absent) — this is acceptable UX. | Pattern 2 | LOW — purely a re-entry-position nicety; if the user expects "returns to original slot," the planner can store/restore, but CONTEXT explicitly prefers no second array and append-on-pin semantics. Flag for the planner/discuss to confirm. |
| A2 | `togglePinned` belongs in `usePreferences` (not the Sidebar) for symmetry with `setToolOrder`, and reads `preferences.pinnedToolIds` from hook state. | Pattern 3 | LOW — could equally live as inline Sidebar logic calling `setPinnedToolIds`; CONTEXT names `togglePinned` as a `usePreferences` addition, so this matches. |
| A3 | Native pointer drag within each group is acceptable as manual-walkthrough-only coverage (no automated e2e), matching v1.4. | Validation Architecture | NONE — explicitly stated in CONTEXT/ROADMAP verification notes and the v1.4 post-ship fix. |

## Open Questions

1. **Re-unpin position (see A1).**
   - What we know: pinning appends to the pinned group's bottom (locked). `toolOrder` is untouched by pinning, so an unpinned tool's old relative order may still live in `toolOrder`.
   - What's unclear: whether users expect an unpinned tool to drop back into its prior unpinned slot vs. append at the remainder's bottom.
   - Recommendation: accept the `reconcileToolOrder`-decided position (append-at-bottom for ids absent from `toolOrder`). No extra state. Confirm in planning; trivial to revisit since it's pure-function behavior fully covered by tests.

2. **One shared drag-state vs. per-group.**
   - What we know: the current single `dropIndex`/`draggingId` must become group-aware.
   - What's unclear: cleanest representation (a `draggingGroup` discriminator vs. two parallel state pairs).
   - Recommendation: a single `draggingGroup: 'pinned'|'unpinned'|null` alongside the existing `draggingId`/`dropIndex`, with `commitMove` taking the group to pick the setter. Planner's discretion; native drag is human-verified so favor the simplest correct shape.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `lucide-react` `Pin`/`PinOff` | pin icon glyphs | ✓ | 1.17.0 (installed) | — (would fall back to inline SVG, but not needed) |
| Existing prefs/store seam | persistence | ✓ | in-repo | — |
| `tauri dev --features webdriver` + `scripts/e2e-spike.sh` | real-WKWebView e2e gate | ✓ | in-repo (v1.4) | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

> nyquist_validation = true (config.json) → section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (jsdom for component/hook tests) + WebdriverIO e2e on the real WKWebView |
| Config file | `vitest.config.*` (existing); `wdio.conf.ts` auto-discovers `./test/e2e/*.e2e.ts` |
| Quick run command | `pnpm vitest run src/shell/toolOrder.test.ts src/shell/prefsStore.test.ts src/shell/usePreferences.test.ts` |
| Full suite command | `pnpm vitest run && pnpm exec tsc --noEmit && pnpm exec eslint .` |
| Real-WKWebView gate | `scripts/e2e-spike.sh` (starts `tauri dev --features webdriver`, runs `pnpm e2e`) |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Command | File |
|-----|----------|-----------|---------|------|
| PIN-07 | `pinnedToolIds` persists round-trip | unit (hook) | `pnpm vitest run src/shell/usePreferences.test.ts` | `usePreferences.test.ts` (ADD) |
| PIN-07 | `coercePinnedToolIds` drops junk, de-dupes, non-array→[] | unit | `pnpm vitest run src/shell/prefsStore.test.ts` | `prefsStore.test.ts` (ADD) |
| PIN-08 | partition: unknown dropped, dupes collapsed, full permutation | unit | `pnpm vitest run src/shell/toolOrder.test.ts` | `toolOrder.test.ts` (ADD `partitionTools` matrix) |
| PIN-01/02 | pin moves to top group / unpin returns (keyboard Alt+P) | e2e (keyboard) | `scripts/e2e-spike.sh` | `test/e2e/sidebar.e2e.ts` (EXTEND) |
| PIN-03 | divider/group appears iff ≥1 pinned | e2e + unit (Sidebar render) | both | e2e + optional `Sidebar.test.tsx` |
| PIN-04 | pin icon visible on hover + focus-visible | manual-walkthrough (hover) + e2e (focus) | walkthrough + e2e | walkthrough + e2e |
| PIN-05 | Alt+P announces "Pinned/Unpinned {name}" via aria-live | e2e (keyboard) | `scripts/e2e-spike.sh` | `test/e2e/sidebar.e2e.ts` |
| PIN-06 | Alt+↑/↓ reorders WITHIN each group, no cross-boundary | e2e (keyboard) + manual (pointer drag) | both | e2e + walkthrough |
| PIN-09 | "Unpin all" via Shift+F10 menu clears the set | e2e (keyboard) | `scripts/e2e-spike.sh` | `test/e2e/sidebar.e2e.ts` |

### Sampling Rate
- **Per task commit:** quick unit run above + `tsc --noEmit` + `eslint` on touched files (lefthook enforces green; no RED-only commits — project MEMORY).
- **Per wave merge / Plan boundary:** full `pnpm vitest run` (the 19 decoder tests MUST stay green, byte-for-byte untouched) + `tsc` + `eslint`.
- **Phase gate:** `scripts/e2e-spike.sh` green on the real WKWebView, then `pnpm tauri build` + `gsd-ui-review` WCAG-AA audit + human walkthrough sign-off.

### partitionTools immovable-bar unit matrix (PIN-08 — the spec)
Mirror `toolOrder.test.ts:9-63`. Each case asserts: union(pinned, unpinned) === registry set, disjoint, no dupes, lengths sum to registry length.
1. Empty pinned, empty order → `pinned: []`, `unpinned: registry` (default).
2. One pinned → that id in `pinned`, rest in `unpinned`.
3. Pinned order honored (e.g. `["c","a"]` → `pinned: ["c","a"]`).
4. Unknown pinned id dropped (`["ghost","a"]`, registry `[a,b]` → `pinned: ["a"]`).
5. Duplicate pinned id collapsed (`["a","a"]` → `pinned: ["a"]`).
6. Non-string junk in pinned dropped (`[1, "a", null]` → `pinned: ["a"]`).
7. Non-array pinned (`"nope"`/`null`) → `pinned: []`, `unpinned: registry`.
8. A pinned id also present in `toolOrder` does NOT appear in `unpinned` (no duplication across groups — the union-once bar).
9. New registry tool (absent from both prefs) appears once in `unpinned` (append, via reconcile).
10. **Property test:** for arbitrary junk pinned + junk order, `[...pinned, ...unpinned].sort()` deep-equals `[...registry].sort()` and `new Set([...pinned,...unpinned]).size === registry.length`.

### Wave 0 Gaps
- [ ] `src/shell/toolOrder.test.ts` — ADD `partitionTools` describe block (matrix above) — covers PIN-08.
- [ ] `src/shell/prefsStore.test.ts` — ADD `coercePinnedToolIds` cases — covers PIN-07 (untrusted layer).
- [ ] `src/shell/usePreferences.test.ts` — ADD `setPinnedToolIds`/`togglePinned` round-trip + append-on-pin + unpin cases — covers PIN-07.
- [ ] `test/e2e/sidebar.e2e.ts` — EXTEND with Alt+P pin/unpin (assert group membership + aria-live), Alt+↑/↓ within a group (assert no cross-boundary), "Unpin all" via Shift+F10 (assert set cleared), persistence across reload — covers PIN-01/02/05/06/09 keyboard paths.
- Framework install: none (all present).

## Security Domain

> security_enforcement absent in config → treated as enabled. Carries the v1.4 threat model forward verbatim (rename the IDs T-16-xx → T-17-xx).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | local desktop app, no auth |
| V3 Session Management | no | n/a |
| V4 Access Control | no | n/a |
| V5 Input Validation | **yes** | `coercePinnedToolIds` + `partitionTools` registry-gating (untrusted prefs.json) |
| V6 Cryptography | no | no crypto in scope |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tampered `pinnedToolIds` (non-array / non-string / objects) | Tampering | `coercePinnedToolIds`: non-array → [], non-strings dropped, de-duped (mirror T-16-01) |
| Oversized/duplicate-stuffed `pinnedToolIds` (DoS) | DoS | `partitionTools` gates membership against the registry Set → output bounded by ≤11 tools regardless of blob size (mirror T-16-02) |
| `pinnedToolIds` referencing unknown/removed IDs | Tampering | `partitionTools` drops ids not in `registryIds` → no phantom tool, no broken route (mirror T-16-03; PIN-08) |
| Stored id flowing into `aria-live` / DOM text | Injection (XSS) | Announce the registry `tool.name`, never the raw stored id; React escapes text (mirror T-16-06) |
| Pin mutating registry/router/palette | Elevation/scope creep | Pin writes only the `pinnedToolIds` overlay; `ENABLED_TOOLS`/router/⌘K untouched (mirror T-16-07; D-10) |

## Sources

### Primary (HIGH confidence — local verified code)
- `src/shell/toolOrder.ts` (reconcile/move signatures + semantics), `src/shell/toolOrder.test.ts` (the test matrix to mirror)
- `src/shell/prefsStore.ts` (`coerceToolOrder` template, `mergePreferences`, async-init), `src/shell/usePreferences.ts` (setter pattern, `update()`), `src/shell/usePreferences.test.ts` (round-trip test style)
- `src/shell/preferences.ts` (`Preferences` shape + defaults)
- `src/components/Sidebar.tsx` (grip reveal, `announce`, `focusAfterMoveRef`, reset-menu plumbing, drag/keyboard handlers — with cited line numbers throughout)
- `src/lib/tools/registry.ts` (`ENABLED_TOOLS`/`getToolById`)
- `.planning/milestones/v1.4-phases/16-reorderable-sidebar-tool-list/16-01-PLAN.md` + `16-02-PLAN.md` (the exact plan structure to mirror, incl. threat model + verification shape)
- `test/e2e/sidebar.e2e.ts` (the keyboard-via-dispatched-KeyboardEvent e2e pattern — WebKit WebDriver does NOT deliver Alt on synth key actions; dispatch a bubbling `KeyboardEvent` with `altKey:true`)
- `.planning/config.json` (nyquist_validation:true, code_review:standard, no skip)
- `node_modules/lucide-react/` (Pin/PinOff exist; installed 1.17.0)
- Project MEMORY: tauri-store-async-init-race, verify-gate-builds-real-app, tdd-red-commits-blocked-by-lefthook, tauri-native-dragDrop-blocks-html5-dnd, auto-build-at-phase-boundary

### Secondary / Tertiary
- None needed; no external sources consulted (and none required).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every primitive read directly from source; no new deps; lucide glyphs confirmed in node_modules.
- Architecture (partition design): HIGH — composes from `reconcileToolOrder`'s already-proven permutation guarantee; only A1 (re-unpin position) is a UX preference, not a correctness risk.
- Pitfalls: HIGH — derived from the actual single-group code that must become two-group, with cited line numbers.
- Validation: HIGH — mirrors the existing v1.4 e2e + the documented WebKit-WebDriver Alt-key limitation.

**Research date:** 2026-06-05
**Valid until:** stable — the reuse surface is in-repo and changes only with this phase (re-verify only if `Sidebar.tsx` / `toolOrder.ts` / `prefsStore.ts` are refactored before planning).
