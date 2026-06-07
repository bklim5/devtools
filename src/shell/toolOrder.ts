// toolOrder — the PURE ordering/reconciliation backbone for the user-reorderable
// sidebar (REORD-05/06/07, D-09/D-10/D-11). No React, no DOM, no platform import:
// the sidebar (Plan 02) consumes these as plain functions, and they are unit-
// tested in isolation. The registry stays the single control plane (D-10) — these
// helpers compute a render-time overlay over ENABLED_TOOLS, never mutating it.
//
// SECURITY (threat T-16-01/02/03): `savedOrder` originates from a user-writable,
// hand-editable prefs.json — it is UNTRUSTED. reconcileToolOrder therefore drops
// non-strings, de-dupes, drops ids not in the live registry, and bounds its
// output to the registry set. A tampered/oversized/duplicate-stuffed blob can
// neither crash the app nor render a phantom or duplicated tool.

/** D-10/D-11 render-overlay reconciliation. `registryIds` is the canonical
 *  ENABLED_TOOLS order (single control plane). `savedOrder` is UNTRUSTED
 *  (hand-edited prefs.json) — drop non-strings, de-dupe, drop ids not in the
 *  registry, then append any registry id missing from `savedOrder` in registry
 *  order. Result is always a permutation of `registryIds` (no missing, no
 *  duplicate, no crash). */
export function reconcileToolOrder(
  savedOrder: string[],
  registryIds: string[],
): string[] {
  const known = new Set(registryIds);
  const emitted = new Set<string>();
  const out: string[] = [];
  // Honor the saved order first, gated by registry membership + de-dupe.
  const saved = Array.isArray(savedOrder) ? savedOrder : [];
  for (const id of saved) {
    if (typeof id !== "string") continue; // untrusted: drop non-strings
    if (!known.has(id)) continue; // D-11: drop ids no longer in the registry
    if (emitted.has(id)) continue; // de-dupe
    emitted.add(id);
    out.push(id);
  }
  // Append any registry id not yet emitted, in canonical registry order (D-11:
  // new tools shipped in a later version appear at the bottom, non-disruptive).
  for (const id of registryIds) {
    if (emitted.has(id)) continue;
    emitted.add(id);
    out.push(id);
  }
  return out;
}

/** The two ordered, disjoint id groups derived from the registry by
 *  partitionTools: `pinned` (the pinned group's order) and `unpinned` (the
 *  remainder, reconciled). Their union is exactly the registry set. */
export interface ToolPartition {
  pinned: string[];
  unpinned: string[];
}

/** Render-overlay partition (PIN-07/08, extends D-10/D-11). All inputs may be
 *  UNTRUSTED (hand-edited prefs.json — threats T-17-01/02/03). Guarantees: every
 *  registry id appears in EXACTLY ONE of the two arrays; no unknown id, no
 *  duplicate, no crash. `pinned` order = `pinnedToolIds` order (registry-gated,
 *  de-duped — append-on-pin); `unpinned` = reconcileToolOrder(toolOrder) over the
 *  registry-minus-pinned set. Pinned membership is gated against the registry Set,
 *  so the output is bounded by the registry regardless of an oversized/duplicate-
 *  stuffed blob. */
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
    if (typeof id !== "string") continue; // untrusted: drop non-strings
    if (!known.has(id)) continue; // drop ids not in the live registry
    if (seen.has(id)) continue; // de-dupe (collapse duplicates)
    seen.add(id);
    pinned.push(id);
  }
  // Unpinned = the registry remainder, ORDERED by the existing v1.4 helper —
  // reuse reconcileToolOrder rather than re-deriving the permutation guarantee.
  const remainderRegistry = registryIds.filter((id) => !seen.has(id));
  const unpinned = reconcileToolOrder(toolOrder, remainderRegistry);
  return { pinned, unpinned };
}

/** Resolve the roving-tabindex focus target for a plain ↑/↓/Home/End keystroke.
 *  `visibleIds` is the flat visible order (pinned then unpinned, as one sequence);
 *  `currentId` is the focused row. Returns the id to move focus to, CLAMPED at the
 *  ends (no wrap), or `null` when there is nowhere to move (current unknown, or a
 *  ↑ at the first / ↓ at the last row). Pure — the caller does the `.focus()`. */
export function resolveRovingTarget(
  visibleIds: string[],
  currentId: string,
  direction: "up" | "down" | "home" | "end",
): string | null {
  if (visibleIds.length === 0) return null;
  if (direction === "home") return visibleIds[0];
  if (direction === "end") return visibleIds[visibleIds.length - 1];
  const current = visibleIds.indexOf(currentId);
  if (current === -1) return null;
  const target = direction === "up" ? current - 1 : current + 1;
  if (target < 0 || target >= visibleIds.length) return null; // clamp, no wrap
  return visibleIds[target];
}

/** Relocate `id` to `toIndex` (clamped to [0, length-1]) within `order`,
 *  returning a NEW array. Unknown id → input returned unchanged (as a fresh
 *  copy). Used by both drag-drop and the Alt+arrow keyboard move (the caller
 *  computes `toIndex = currentIndex ± 1`). */
export function moveToolInOrder(
  order: string[],
  id: string,
  toIndex: number,
): string[] {
  const next = [...order];
  const from = next.indexOf(id);
  if (from === -1) return next; // unknown id → unchanged (fresh array)
  next.splice(from, 1);
  // Clamp against the post-removal array so the item can land at the last slot.
  const clamped = Math.min(Math.max(toIndex, 0), next.length);
  next.splice(clamped, 0, id);
  return next;
}
