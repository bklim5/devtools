// Registry-driven compact sidebar (SHL-01, SHL-04) — now user-reorderable
// (Phase 16, REORD-01..07; D-01..D-12).
//
// The rendered ORDER is a presentation overlay over ENABLED_TOOLS (D-10): the
// registry array stays the single control plane (the ⌘K palette + router are
// untouched), and the saved `toolOrder` pref is reconciled against it on every
// render via reconcileToolOrder (D-11 — new tools append, unknown ids drop).
// The sidebar still holds no tool list of its own.
//
// Each row keeps its plain NavLink (a normal click navigates — D-01/REORD-02);
// reordering is layered on as a SEPARATE focusable grip handle that carries the
// drag + keyboard handlers. Because only the handle is `draggable` and only the
// handle binds the move keys, a click on the row body can never start a drag.
//
// Drag: native HTML5 drag events (zero new deps — D-02). A neutral insertion
// line (NOT the accent colour — D-03/accent = selected-only) marks the drop slot.
// Keyboard: Alt+↑ / Alt+↓ move the focused tool one slot (D-04); plain ↑/↓ stay
// unbound (no roving nav — D-05); the moved item keeps focus. Every move is
// announced through an aria-live="polite" region (D-06). A right-click "Reset
// order" affordance restores the default registry order (D-12). Each change
// persists immediately via setToolOrder (REORD-05) and survives restart.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { GripVertical, RotateCcw } from "lucide-react";
import { NavLink } from "react-router-dom";
import { ENABLED_TOOLS, getToolById } from "@/lib/tools/registry";
import { usePreferences } from "@/shell/usePreferences";
import { moveToolInOrder, reconcileToolOrder } from "@/shell/toolOrder";

interface ResetMenu {
  x: number;
  y: number;
}

export function Sidebar() {
  const { preferences, setToolOrder } = usePreferences();

  // Live registry order (single control plane) + the reconciled render overlay.
  // Pre-load, preferences.toolOrder is [] → reconcile([], …) IS the registry
  // order, so there is no order flash and no spinner needed (D-11).
  const registryIds = ENABLED_TOOLS.map((t) => t.id);
  const orderedIds = reconcileToolOrder(preferences.toolOrder, registryIds);

  // The id currently being dragged, and the gap index the drop indicator sits at
  // (0..length — a value of N means "between row N-1 and N"). null when idle.
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  // The aria-live announcement text (D-06). Re-set on every successful move.
  const [announcement, setAnnouncement] = useState("");
  // The right-click "Reset order" context menu (D-12), positioned at the cursor.
  const [resetMenu, setResetMenu] = useState<ResetMenu | null>(null);

  // Handle elements keyed by tool id, so a keyboard move can re-focus the moved
  // tool's handle after React re-renders the reordered list (REORD-04).
  const handleRefs = useRef(new Map<string, HTMLButtonElement | null>());
  // When set, a layout effect focuses this tool's handle once the move lands.
  const focusAfterMoveRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    const id = focusAfterMoveRef.current;
    if (!id) return;
    focusAfterMoveRef.current = null;
    handleRefs.current.get(id)?.focus();
  });

  // Announce a completed move with the registry NAME (never the raw stored id /
  // untrusted toolOrder string — closes the injection surface T-16-06).
  const announceMove = useCallback((id: string, next: string[]) => {
    const tool = getToolById(id);
    if (!tool) return;
    const n = next.indexOf(id) + 1; // 1-based new position
    setAnnouncement(`Moved ${tool.name} to position ${n} of ${next.length}`);
  }, []);

  // Commit a reorder: persist (write-on-change) + announce. `focusId` re-focuses
  // the moved handle after the re-render (keyboard path keeps focus — D-06).
  const commitMove = useCallback(
    (id: string, toIndex: number, opts?: { focus?: boolean }) => {
      const next = moveToolInOrder(orderedIds, id, toIndex);
      setToolOrder(next);
      announceMove(id, next);
      if (opts?.focus) focusAfterMoveRef.current = id;
    },
    [orderedIds, setToolOrder, announceMove],
  );

  // --- Native HTML5 drag (handle-initiated only — D-01/D-02) -----------------
  const onDragStart = useCallback(
    (e: React.DragEvent, id: string) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", id);
      setDraggingId(id);
    },
    [],
  );

  // While dragging over a row, set the insertion line above or below it based on
  // the pointer's vertical position within the row (top half → before, bottom
  // half → after).
  const onRowDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      if (!draggingId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const rect = e.currentTarget.getBoundingClientRect();
      const after = e.clientY - rect.top > rect.height / 2;
      setDropIndex(after ? index + 1 : index);
    },
    [draggingId],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const id = draggingId ?? e.dataTransfer.getData("text/plain");
      if (id && dropIndex !== null) {
        // dropIndex is a GAP index; if the gap is past the dragged item's own
        // current slot, account for its removal so it lands where the line shows.
        const from = orderedIds.indexOf(id);
        const target = from !== -1 && from < dropIndex ? dropIndex - 1 : dropIndex;
        if (from !== -1 && target !== from) commitMove(id, target);
      }
      setDraggingId(null);
      setDropIndex(null);
    },
    [draggingId, dropIndex, orderedIds, commitMove],
  );

  const onDragEnd = useCallback(() => {
    setDraggingId(null);
    setDropIndex(null);
  }, []);

  // --- Keyboard reorder: Alt+↑ / Alt+↓ ONLY (D-04/D-05) ----------------------
  const onHandleKeyDown = useCallback(
    (e: React.KeyboardEvent, id: string) => {
      // Only Alt+arrow is consumed. Plain ↑/↓ fall through unhandled (no roving
      // nav — D-05); anything without Alt is ignored.
      if (!e.altKey) return;
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      const current = orderedIds.indexOf(id);
      if (current === -1) return;
      const target = e.key === "ArrowUp" ? current - 1 : current + 1;
      if (target < 0 || target >= orderedIds.length) {
        e.preventDefault();
        return; // already at an end — nothing to do, but still consume the chord
      }
      e.preventDefault();
      commitMove(id, target, { focus: true });
    },
    [orderedIds, commitMove],
  );

  // --- Reset order (D-12 / REORD-07) -----------------------------------------
  const openResetMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setResetMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const closeResetMenu = useCallback(() => setResetMenu(null), []);

  const resetOrder = useCallback(() => {
    setToolOrder([]); // clears to default registry order
    setAnnouncement("Sidebar order reset to default");
    setResetMenu(null);
  }, [setToolOrder]);

  // Dismiss the reset menu on click-away or Escape (no focus trap).
  useEffect(() => {
    if (!resetMenu) return;
    const onDocClick = () => closeResetMenu();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeResetMenu();
    };
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [resetMenu, closeResetMenu]);

  return (
    <aside className="flex w-[268px] flex-none flex-col gap-3 border-r border-bd bg-sidebar p-[14px]">
      <nav className="flex flex-col gap-0.5" onContextMenu={openResetMenu}>
        {orderedIds.map((id, index) => {
          const tool = getToolById(id);
          if (!tool) return null; // defensive — reconcile already guarantees this
          const Icon = tool.icon;
          const isDragging = draggingId === id;
          return (
            <div
              key={tool.id}
              className="relative"
              onDragOver={(e) => onRowDragOver(e, index)}
              onDrop={onDrop}
            >
              {/* Neutral insertion line above this row when it is the drop slot.
                  Uses bd-2 (a neutral token), explicitly NOT bg-accent (D-03). */}
              {dropIndex === index ? (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-px left-1 right-1 h-[2px] rounded-full bg-bd-2"
                />
              ) : null}
              <div
                className={[
                  "group relative flex items-center rounded-[9px]",
                  isDragging ? "opacity-50" : "",
                ].join(" ")}
              >
                <NavLink
                  to={`/tools/${tool.id}`}
                  className={({ isActive }) =>
                    [
                      // navitem: compact padding, radius 9px, icon↔name gap 12px.
                      // Right padding leaves room for the absolutely-positioned grip.
                      "flex min-w-0 flex-1 items-center gap-3 rounded-[9px] py-2 pl-[11px] pr-7",
                      "outline-none transition-colors",
                      "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-0",
                      isActive
                        ? "bg-accent-soft text-tx"
                        : "text-tx-2 hover:bg-[rgba(255,255,255,0.035)]",
                    ].join(" ")
                  }
                >
                  {({ isActive }) => (
                    <>
                      {/* left accent bar — scaleY 0→1 on active (mockup .navbar-accent) */}
                      <span
                        aria-hidden="true"
                        className={[
                          "pointer-events-none absolute left-[3px] top-1/2 h-[56%] w-[3px]",
                          "-translate-y-1/2 rounded-[2px] bg-accent transition-transform",
                          isActive ? "scale-y-100" : "scale-y-0",
                        ].join(" ")}
                      />
                      <Icon
                        className={[
                          "h-[18px] w-[18px] flex-none transition-colors",
                          isActive ? "text-accent" : "text-tx-2",
                        ].join(" ")}
                      />
                      <span className="min-w-0 truncate text-[13.5px] font-semibold">
                        {tool.name}
                      </span>
                    </>
                  )}
                </NavLink>
                {/* Grip handle — the ONLY draggable + reorder-key control. Hidden
                    until row hover OR its own keyboard focus, so keyboard users
                    can still reach it (D-01). A plain NavLink click never starts
                    a drag because the NavLink is not draggable (REORD-02). */}
                <button
                  type="button"
                  ref={(el) => {
                    handleRefs.current.set(tool.id, el);
                  }}
                  draggable
                  onDragStart={(e) => onDragStart(e, tool.id)}
                  onDragEnd={onDragEnd}
                  onKeyDown={(e) => onHandleKeyDown(e, tool.id)}
                  aria-label={`Reorder ${tool.name}`}
                  title={`Reorder ${tool.name} (drag, or Alt+↑/↓)`}
                  className={[
                    "absolute right-1 top-1/2 -translate-y-1/2 flex h-6 w-5 cursor-grab items-center justify-center rounded-[6px]",
                    "text-tx-3 opacity-0 transition-opacity",
                    "group-hover:opacity-100 focus-visible:opacity-100",
                    "outline-none focus-visible:ring-2 focus-visible:ring-accent active:cursor-grabbing",
                  ].join(" ")}
                >
                  <GripVertical className="h-[15px] w-[15px]" />
                </button>
              </div>
              {/* Trailing insertion line when the drop slot is past the last row. */}
              {index === orderedIds.length - 1 && dropIndex === orderedIds.length ? (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -bottom-px left-1 right-1 h-[2px] rounded-full bg-bd-2"
                />
              ) : null}
            </div>
          );
        })}
      </nav>

      {/* Reorder announcements for screen readers (D-06). Visually hidden. */}
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      {/* Right-click "Reset order" menu (D-12). Dismiss on click-away / Escape. */}
      {resetMenu ? (
        <div
          role="menu"
          aria-label="Sidebar order"
          className="fixed z-50 min-w-[160px] rounded-[8px] border border-bd bg-panel py-1 shadow-lg"
          style={{ left: resetMenu.x, top: resetMenu.y }}
          // Keep clicks inside from bubbling to the document click-away handler.
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            onClick={resetOrder}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] text-tx-2 outline-none transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-tx focus-visible:bg-[rgba(255,255,255,0.05)] focus-visible:text-tx"
          >
            <RotateCcw className="h-[14px] w-[14px] flex-none" />
            Reset order
          </button>
        </div>
      ) : null}
    </aside>
  );
}
