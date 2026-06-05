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
