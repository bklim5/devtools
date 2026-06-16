// Native HTML5 drag/drop for the sidebar's two tool groups, extracted verbatim
// from Sidebar.tsx (handle-initiated only — D-01/D-02; zero new deps). Drag and
// Alt+↑/↓ reorder run INDEPENDENTLY within each group (`draggingGroup`,
// per-group clamp) — a tool never crosses the pinned↔unpinned boundary by
// dragging; membership changes via pin/unpin only (PIN-06). Sidebar.tsx stays
// the composition root: it owns persistence (`commitMove`), the entitlements
// gate, and the announce() flow — this hook only owns the drag state machine.
import { useCallback, useState } from "react";

/** Which group a drag/keyboard reorder is scoped to (PIN-06 — no cross-boundary). */
export type ToolGroup = "pinned" | "unpinned";

export interface SidebarDragDropInputs {
  /** ENT-02/D-26: ordering gates through the ONE resolved entitlement set. */
  orderingUnlocked: boolean;
  /** D-28: the shared upsell surface opened by locked customization affordances.
   *  Takes the explicit focus-return target (the dragged tool's row) — the grip
   *  is pointer-only chrome that hides on blur, so it can't be the return target. */
  openOrderingUpsell: (invokerEl?: HTMLElement | null) => void;
  /** Resolve a tool's row element by id — the STABLE focus-return target for a
   *  locked drag attempt (the grip itself is aria-hidden/opacity-0 off-hover). */
  getRowEl: (id: string) => HTMLElement | null;
  /** The active group's ordered array (drag/keyboard scope to it). */
  groupOrder: (group: ToolGroup) => string[];
  /** Commit a reorder WITHIN a group (Sidebar owns the setters + announce). */
  commitMove: (group: ToolGroup, id: string, toIndex: number) => void;
}

export function useSidebarDragDrop({
  orderingUnlocked,
  openOrderingUpsell,
  getRowEl,
  groupOrder,
  commitMove,
}: SidebarDragDropInputs) {
  // The id currently being dragged, the group it belongs to, and the gap index
  // the drop indicator sits at (0..group.length — N means "between row N-1 and N"
  // WITHIN that group). null when idle.
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingGroup, setDraggingGroup] = useState<ToolGroup | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const onDragStart = useCallback(
    (e: React.DragEvent, id: string, group: ToolGroup) => {
      // D-28: reorder-by-drag is a customization affordance — locked, it opens
      // the upsell and the drag never starts (no prefs write path exists).
      if (!orderingUnlocked) {
        e.preventDefault();
        // The grip (e.currentTarget) hides on blur, so pass the dragged tool's
        // ROW as the stable focus-return target for when Settings closes.
        openOrderingUpsell(getRowEl(id));
        return;
      }
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", id);
      setDraggingId(id);
      setDraggingGroup(group);
    },
    [orderingUnlocked, openOrderingUpsell, getRowEl],
  );

  // While dragging over a row, set the insertion line above or below it based on
  // the pointer's vertical position within the row. A drag over a row in the OTHER
  // group is ignored — the indicator stays in the active group (PIN-06).
  const onRowDragOver = useCallback(
    (e: React.DragEvent, index: number, group: ToolGroup) => {
      if (!draggingId || group !== draggingGroup) return;
      e.preventDefault();
      // Stop the event reaching the nav-level handler so a drag genuinely over a
      // row never gets overridden by the end-of-list zone.
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      const rect = e.currentTarget.getBoundingClientRect();
      const after = e.clientY - rect.top > rect.height / 2;
      setDropIndex(after ? index + 1 : index);
    },
    [draggingId, draggingGroup],
  );

  // Dragging into the empty area below the last row parks the drop slot at the end
  // of the ACTIVE group (dropIndex = that group's length), so the trailing
  // insertion line shows and the drop commits to the bottom of that group only.
  const onNavDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!draggingId || !draggingGroup) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDropIndex(groupOrder(draggingGroup).length);
    },
    [draggingId, draggingGroup, groupOrder],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const id = draggingId ?? e.dataTransfer.getData("text/plain");
      const group = draggingGroup;
      if (id && group && dropIndex !== null) {
        const order = groupOrder(group);
        // dropIndex is a GAP index captured against the CURRENT group order. If the
        // dragged id is no longer in that order (e.g. an external sync mutated the
        // overlay mid-drag), bail cleanly rather than land one slot off.
        const from = order.indexOf(id);
        if (from === -1) {
          setDraggingId(null);
          setDraggingGroup(null);
          setDropIndex(null);
          return;
        }
        // The gap is past the dragged item's own slot → account for its removal so
        // it lands where the line shows.
        const target = from < dropIndex ? dropIndex - 1 : dropIndex;
        if (target !== from) commitMove(group, id, target);
      }
      setDraggingId(null);
      setDraggingGroup(null);
      setDropIndex(null);
    },
    [draggingId, draggingGroup, dropIndex, groupOrder, commitMove],
  );

  const onDragEnd = useCallback(() => {
    setDraggingId(null);
    setDraggingGroup(null);
    setDropIndex(null);
  }, []);

  return {
    draggingId,
    draggingGroup,
    dropIndex,
    onDragStart,
    onRowDragOver,
    onNavDragOver,
    onDrop,
    onDragEnd,
  };
}
