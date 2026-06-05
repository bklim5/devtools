// Registry-driven compact sidebar (SHL-01, SHL-04) — now user-reorderable AND
// pinnable (Phase 16 REORD-01..07 + Phase 17 PIN-01..09; D-01..D-16).
//
// The rendered ORDER is a presentation overlay over ENABLED_TOOLS (D-10): the
// registry array stays the single control plane (the ⌘K palette + router are
// untouched). On every render `partitionTools` splits the registry into a
// `pinned` group (the `pinnedToolIds` overlay) above an `unpinned` remainder
// (the `toolOrder` overlay, reconciled), each always a registry partition —
// drop unknown, de-dupe, never crash (D-11/PIN-08). The sidebar holds no tool
// list of its own.
//
// Each row keeps its plain NavLink (a normal click navigates — D-01/REORD-02);
// reordering is a SEPARATE focusable grip handle that carries the drag + keyboard
// handlers, and pinning is a SEPARATE pin button LEFT of the grip. Because only
// the handle is `draggable` and only the handle binds the move keys, a click on
// the row body can never start a drag; the pin button preventDefault/stopPropagation
// so it toggles membership without navigating (D-14/PIN-04).
//
// Drag: native HTML5 drag events (zero new deps — D-02). A neutral insertion
// line (NOT the accent colour — D-03/accent = selected-only) marks the drop slot.
// Drag + Alt+↑/↓ reorder run INDEPENDENTLY within each group (`draggingGroup`,
// per-group clamp) — a tool never crosses the pinned↔unpinned boundary by
// dragging; membership changes via pin/unpin only (PIN-06).
// Keyboard: Alt+↑ / Alt+↓ move the focused tool one slot within its group (D-04);
// Alt+P pins/unpins the focused tool (D-13/PIN-05); plain ↑/↓ stay unbound (no
// roving nav — D-05); the moved/toggled item keeps focus. Every move/toggle is
// announced through an aria-live="polite" region using the registry name (D-06).
// A right-click menu carries "Reset order" (D-12) and "Unpin all" (D-16/PIN-09).
// Each change persists immediately via setToolOrder / setPinnedToolIds and
// survives restart.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { GripVertical, Pin, PinOff, RotateCcw } from "lucide-react";
import { NavLink } from "react-router-dom";
import { ENABLED_TOOLS, getToolById } from "@/lib/tools/registry";
import { usePreferences } from "@/shell/usePreferences";
import { moveToolInOrder, partitionTools } from "@/shell/toolOrder";

interface ResetMenu {
  x: number;
  y: number;
}

/** Which group a drag/keyboard reorder is scoped to (PIN-06 — no cross-boundary). */
type ToolGroup = "pinned" | "unpinned";

export function Sidebar() {
  const { preferences, setToolOrder, setPinnedToolIds, togglePinned } = usePreferences();

  // Live registry order (single control plane) + the reconciled two-group render
  // overlay. Pre-load, preferences.{pinnedToolIds,toolOrder} are [] → partitionTools
  // is the registry order with an empty pinned group, so there is no order flash
  // and no spinner needed (D-11/PIN-08).
  const registryIds = ENABLED_TOOLS.map((t) => t.id);
  const { pinned, unpinned } = partitionTools(
    preferences.pinnedToolIds,
    preferences.toolOrder,
    registryIds,
  );
  // Membership lookup for per-row pin state. Derived from the RECONCILED pinned
  // group (Pitfall 5), not the raw pref, so a stale id never marks a row pinned.
  // Memoised so the togglePin/renderRow callbacks keep a stable identity.
  const pinnedSet = useMemo(() => new Set(pinned), [pinned]);
  // The active group's ordered array (drag/keyboard scope to it).
  const groupOrder = useCallback(
    (group: ToolGroup): string[] => (group === "pinned" ? pinned : unpinned),
    [pinned, unpinned],
  );

  // The id currently being dragged, the group it belongs to, and the gap index
  // the drop indicator sits at (0..group.length — N means "between row N-1 and N"
  // WITHIN that group). null when idle.
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingGroup, setDraggingGroup] = useState<ToolGroup | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  // The aria-live announcement text (D-06). Re-set on every successful move/toggle.
  const [announcement, setAnnouncement] = useState("");
  // The right-click context menu (D-12/D-16), positioned at the cursor.
  const [resetMenu, setResetMenu] = useState<ResetMenu | null>(null);

  // The <nav> element — a stable focus anchor for menu dismissal when the saved
  // return-focus element is no longer connected (WR-02 fallback).
  const navRef = useRef<HTMLElement | null>(null);
  // Handle elements keyed by tool id, so a keyboard move/toggle can re-focus the
  // moved tool's handle after React re-renders the reordered list. ONE shared map
  // across BOTH groups, so a pin/unpin that moves a tool between groups still
  // re-finds its handle (Pitfall 3).
  const handleRefs = useRef(new Map<string, HTMLButtonElement | null>());
  // When set, a layout effect focuses this tool's handle once the move lands.
  const focusAfterMoveRef = useRef<string | null>(null);
  // Pending aria-live re-announce timer (cleared on unmount).
  const reannounceRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const id = focusAfterMoveRef.current;
    if (!id) return;
    focusAfterMoveRef.current = null;
    handleRefs.current.get(id)?.focus();
  });

  useEffect(
    () => () => {
      if (reannounceRef.current !== null) clearTimeout(reannounceRef.current);
    },
    [],
  );

  // Set the aria-live message. A polite region only speaks on CHANGE, so a new,
  // distinct message is set synchronously (the common path — every move differs).
  // When the SAME message would repeat (e.g. two boundary bumps in a row), clear
  // then re-set on the next tick so the text transitions and the region re-fires
  // instead of going silent.
  const announce = useCallback((msg: string) => {
    if (reannounceRef.current !== null) {
      clearTimeout(reannounceRef.current);
      reannounceRef.current = null;
    }
    setAnnouncement((prev) => {
      if (prev !== msg) return msg;
      // Identical to current text — bounce through empty to force a transition.
      reannounceRef.current = window.setTimeout(() => {
        setAnnouncement(msg);
        reannounceRef.current = null;
      }, 30);
      return "";
    });
  }, []);

  // Announce a completed move with the registry NAME (never the raw stored id /
  // untrusted overlay string — closes the injection surface T-16-06/T-17-05). `n`
  // / `total` are positions WITHIN the row's group.
  const announceMove = useCallback(
    (id: string, next: string[]) => {
      const tool = getToolById(id);
      if (!tool) return;
      const n = next.indexOf(id) + 1; // 1-based new position in the group
      announce(`Moved ${tool.name} to position ${n} of ${next.length}`);
    },
    [announce],
  );

  // Commit a reorder WITHIN a group: persist (write-on-change) to that group's
  // setter + announce. `focusId` re-focuses the moved handle after the re-render
  // (keyboard path keeps focus — D-06). The pinned group's order IS pinnedToolIds;
  // the unpinned group's order IS toolOrder (PIN-06 — never crosses the boundary).
  const commitMove = useCallback(
    (group: ToolGroup, id: string, toIndex: number, opts?: { focus?: boolean }) => {
      const next = moveToolInOrder(groupOrder(group), id, toIndex);
      if (group === "pinned") setPinnedToolIds(next);
      else setToolOrder(next);
      announceMove(id, next);
      if (opts?.focus) focusAfterMoveRef.current = id;
    },
    [groupOrder, setPinnedToolIds, setToolOrder, announceMove],
  );

  // Toggle a tool's pinned membership (shared by the pin button + Alt+P). Keeps
  // focus on the toggled tool's handle across the cross-group re-render (Pitfall 3),
  // and announces with the registry NAME (Pitfall 4).
  const togglePin = useCallback(
    (id: string) => {
      const tool = getToolById(id);
      if (!tool) return;
      const willPin = !pinnedSet.has(id);
      // INVARIANT: a registry id is always exactly one of pinned/unpinned, so
      // togglePinned(id) ALWAYS flips membership and produces a new array — the
      // row always moves groups. The focus restoration is therefore safe to set
      // unconditionally here: there is no no-op path that would yank focus away
      // from where a screen reader was reading. If togglePinned ever gains a
      // short-circuit (e.g. an unknown id no-ops), gate this set on the membership
      // actually changing, the way commitMove gates on opts?.focus.
      focusAfterMoveRef.current = id;
      togglePinned(id);
      announce(willPin ? `Pinned ${tool.name}` : `Unpinned ${tool.name}`);
    },
    [pinnedSet, togglePinned, announce],
  );

  // --- Native HTML5 drag (handle-initiated only — D-01/D-02) -----------------
  const onDragStart = useCallback((e: React.DragEvent, id: string, group: ToolGroup) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
    setDraggingId(id);
    setDraggingGroup(group);
  }, []);

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

  // --- Keyboard reorder: Alt+↑ / Alt+↓ + Alt+P toggle (D-04/D-05/D-13) --------
  const onHandleKeyDown = useCallback(
    (e: React.KeyboardEvent, id: string, group: ToolGroup) => {
      // Only Alt+chords are consumed. Plain ↑/↓/P fall through unhandled (no
      // roving nav — D-05); anything without Alt is ignored.
      if (!e.altKey) return;

      // Alt+P pins/unpins the focused tool (D-13/PIN-05). Alt-family only — no
      // plain 'P', matching the sidebar's no-single-key model.
      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        togglePin(id);
        return;
      }

      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      // Clamp WITHIN the row's OWN group, never the whole list (Pitfall 2/PIN-06).
      const order = groupOrder(group);
      const current = order.indexOf(id);
      if (current === -1) return;
      const target = e.key === "ArrowUp" ? current - 1 : current + 1;
      e.preventDefault();
      if (target < 0 || target >= order.length) {
        // Already at a GROUP end — consume the chord, but make the boundary
        // PERCEIVABLE (don't swallow it silently). Announce the unchanged position
        // against the GROUP length so SR / keyboard users get feedback instead of
        // a dead key (and a pinned tool never slides into the unpinned list).
        const tool = getToolById(id);
        if (tool) {
          const pos = current + 1; // 1-based
          const total = order.length;
          const msg =
            target < 0
              ? `Already at position ${pos} of ${total}`
              : `Already at last position ${pos} of ${total}`;
          announce(msg);
        }
        return;
      }
      commitMove(group, id, target, { focus: true });
    },
    [groupOrder, commitMove, announce, togglePin],
  );

  // --- Reset order (D-12) + Unpin all (D-16) menu ----------------------------
  // The first menu item, focused when the menu opens so it is operable by keyboard
  // (WCAG 2.1.1), and the element to return focus to on dismiss.
  const resetItemRef = useRef<HTMLButtonElement | null>(null);
  const menuReturnFocusRef = useRef<HTMLElement | null>(null);

  const openResetMenu = useCallback((x: number, y: number) => {
    // Remember where focus was so Escape / dismiss can restore it sensibly.
    menuReturnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setResetMenu({ x, y });
  }, []);

  const openResetMenuFromMouse = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      openResetMenu(e.clientX, e.clientY);
    },
    [openResetMenu],
  );

  // Keyboard entry point (WCAG 2.1.1): Shift+F10 / the ContextMenu key opens the
  // menu — the standard context-menu chord — anchored near the focused row so it
  // appears where the user is looking, not at the cursor.
  const openResetMenuFromKeyboard = useCallback(
    (e: React.KeyboardEvent) => {
      const isContextChord =
        e.key === "ContextMenu" || (e.shiftKey && e.key === "F10");
      if (!isContextChord) return;
      e.preventDefault();
      const anchor =
        e.target instanceof HTMLElement ? e.target.getBoundingClientRect() : null;
      const x = anchor ? Math.round(anchor.left + anchor.width / 2) : 0;
      const y = anchor ? Math.round(anchor.bottom) : 0;
      openResetMenu(x, y);
    },
    [openResetMenu],
  );

  const closeResetMenu = useCallback((opts?: { restoreFocus?: boolean }) => {
    setResetMenu(null);
    if (opts?.restoreFocus) {
      // The saved element (typically a grip handle) may have been detached or
      // re-keyed between open and close — calling .focus() on a disconnected node
      // is a no-op that silently strands focus on <body>. A right-click open also
      // captures document.activeElement as <body> (a right-click does not focus the
      // row), which IS connected — restoring to it would strand keyboard focus on
      // <body> just the same. Only restore to a still-connected, genuinely focusable
      // element (not <body>, tabIndex >= 0); otherwise fall back to a stable anchor
      // (the <nav>, then any live grip) so keyboard users are never left adrift.
      const el = menuReturnFocusRef.current;
      const usable = el && el.isConnected && el !== document.body && el.tabIndex >= 0;
      if (usable) {
        el.focus();
      } else {
        const fallback =
          navRef.current ??
          [...handleRefs.current.values()].find((h) => h?.isConnected) ??
          null;
        fallback?.focus();
      }
    }
    menuReturnFocusRef.current = null;
  }, []);

  const resetOrder = useCallback(() => {
    setToolOrder([]); // clears to default registry order
    announce("Sidebar order reset to default");
    closeResetMenu({ restoreFocus: true });
  }, [setToolOrder, announce, closeResetMenu]);

  const unpinAll = useCallback(() => {
    setPinnedToolIds([]); // clears the whole pinned set (PIN-09)
    announce("All tools unpinned");
    closeResetMenu({ restoreFocus: true });
  }, [setPinnedToolIds, announce, closeResetMenu]);

  // Move focus to the first menu item when the menu opens, so an open menu is
  // fully keyboard-operable (not a focus trap — Escape / click-away still dismiss).
  useLayoutEffect(() => {
    if (resetMenu) resetItemRef.current?.focus();
  }, [resetMenu]);

  // Dismiss the menu on click-away or Escape (no focus trap). Escape returns focus
  // to the element the menu was opened from.
  useEffect(() => {
    if (!resetMenu) return;
    const onDocClick = () => closeResetMenu();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeResetMenu({ restoreFocus: true });
    };
    // Defer attaching the click-away listener by one tick. Today the only open
    // paths are right-click and keyboard, but if a future caller ever opens the
    // menu from a click/pointerup handler, the SAME gesture's click could bubble
    // to document in this tick and immediately self-close the menu. The timeout-0
    // lets the opening gesture finish before the listener is live.
    const clickListenerId = window.setTimeout(() => {
      document.addEventListener("click", onDocClick);
    }, 0);
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(clickListenerId);
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [resetMenu, closeResetMenu]);

  // Render a single tool row, shared by BOTH groups. The `group` arg routes drag +
  // keyboard reorder to the right array/setter (PIN-06) and `index` is the row's
  // position WITHIN its group (so the insertion line scopes per group).
  const renderRow = useCallback(
    (id: string, index: number, group: ToolGroup) => {
      const tool = getToolById(id);
      if (!tool) return null; // defensive — partitionTools already guarantees this
      const Icon = tool.icon;
      const isDragging = draggingId === id && draggingGroup === group;
      // pinnedSet is derived from the reconciled `pinned` group, so a row in the
      // pinned group is always in pinnedSet — the membership check alone suffices
      // for both groups (no redundant `group === "pinned"` short-circuit needed).
      const isPinned = pinnedSet.has(id);
      const groupLen = group === "pinned" ? pinned.length : unpinned.length;
      return (
        <div
          key={tool.id}
          className="relative"
          onDragOver={(e) => onRowDragOver(e, index, group)}
          onDrop={onDrop}
        >
          {/* Neutral insertion line above this row when it is the active group's
              drop slot. Uses tx-2 (a neutral grey, ~6.9:1 on the sidebar so the
              drop cue is perceivable — WCAG 1.4.11), explicitly NOT bg-accent
              (accent = selected-only, D-03). */}
          {draggingGroup === group && dropIndex === index ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -top-px left-1 right-1 h-[2px] rounded-full bg-tx-2"
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
                  // navitem: compact padding, radius 9px, icon↔name gap 12px. Right
                  // padding leaves room for the two absolutely-positioned controls
                  // (pin + grip) so the name does not truncate under them (Pitfall 6).
                  "flex min-w-0 flex-1 items-center gap-3 rounded-[9px] py-2 pl-[11px] pr-12",
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
            {/* Pin toggle — LEFT of the grip (grip stays outermost at right-1, pin
                at right-7; D-14). Pinned rows show a PERSISTENT filled pin (the
                unpin target — no hover-only); unpinned rows show an OUTLINE pin on
                hover OR focus-visible only, mirroring the grip's reveal. Neutral
                tokens only (accent = selected-only, D-03). preventDefault +
                stopPropagation so the NavLink does NOT navigate (PIN-04). */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                togglePin(tool.id);
              }}
              aria-label={isPinned ? `Unpin ${tool.name}` : `Pin ${tool.name}`}
              aria-pressed={isPinned}
              title={isPinned ? `Unpin ${tool.name} (Alt+P)` : `Pin ${tool.name} (Alt+P)`}
              className={[
                "absolute right-7 top-1/2 -translate-y-1/2 flex h-6 w-5 items-center justify-center rounded-[6px]",
                "outline-none focus-visible:ring-2 focus-visible:ring-accent",
                isPinned
                  ? "text-tx-2" // persistent, always-visible, neutral
                  : "text-tx-3 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100",
              ].join(" ")}
            >
              <Pin
                className={["h-[14px] w-[14px]", isPinned ? "fill-current" : ""].join(" ")}
              />
            </button>
            {/* Grip handle — the ONLY draggable + reorder-key control. Hidden until
                row hover OR its own keyboard focus, so keyboard users can still
                reach it (D-01). A plain NavLink click never starts a drag because
                the NavLink is not draggable (REORD-02). It also carries Alt+P
                (D-13) since it is the row's keyboard control. */}
            <button
              type="button"
              ref={(el) => {
                handleRefs.current.set(tool.id, el);
              }}
              draggable
              onDragStart={(e) => onDragStart(e, tool.id, group)}
              onDragEnd={onDragEnd}
              onKeyDown={(e) => onHandleKeyDown(e, tool.id, group)}
              aria-label={`Reorder ${tool.name}`}
              title={`Reorder ${tool.name} (drag, or Alt+↑/↓; Alt+P to pin; Shift+F10 to reset)`}
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
          {/* Trailing insertion line when the active group's drop slot is past its
              last row. */}
          {draggingGroup === group &&
          index === groupLen - 1 &&
          dropIndex === groupLen ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-px left-1 right-1 h-[2px] rounded-full bg-tx-2"
            />
          ) : null}
        </div>
      );
    },
    [
      draggingId,
      draggingGroup,
      dropIndex,
      pinned.length,
      unpinned.length,
      pinnedSet,
      onRowDragOver,
      onDrop,
      onDragStart,
      onDragEnd,
      onHandleKeyDown,
      togglePin,
    ],
  );

  return (
    <aside className="flex w-[268px] flex-none flex-col gap-3 border-r border-bd bg-sidebar p-[14px]">
      <nav
        ref={navRef}
        // tabIndex -1 keeps the nav OUT of the normal tab order but makes it a
        // valid programmatic .focus() target — the stable fallback anchor when a
        // detached return-focus element would otherwise strand focus (WR-02).
        tabIndex={-1}
        // flex-1 lets the nav fill the aside's height so the empty area below the
        // last row is part of the droppable surface (end-zone), not a dead gap.
        className="flex flex-1 flex-col gap-0.5 outline-none"
        onContextMenu={openResetMenuFromMouse}
        onKeyDown={openResetMenuFromKeyboard}
        onDragOver={onNavDragOver}
        onDrop={onDrop}
      >
        {/* Pinned group — SR-named "Pinned tools", shown ONLY when the reconciled
            pinned partition is non-empty (Pitfall 5/PIN-03), with a bare neutral
            divider (NO visible "PINNED" label — D-15) before the unpinned list. */}
        {pinned.length > 0 ? (
          <div role="group" aria-label="Pinned tools" className="flex flex-col gap-0.5">
            {pinned.map((id, index) => renderRow(id, index, "pinned"))}
          </div>
        ) : null}
        {pinned.length > 0 ? (
          <hr aria-hidden="true" className="my-1 border-t border-bd" />
        ) : null}
        <div role="group" aria-label="Tools" className="flex flex-col gap-0.5">
          {unpinned.map((id, index) => renderRow(id, index, "unpinned"))}
        </div>
      </nav>

      {/* Reorder / pin announcements for screen readers (D-06). Visually hidden. */}
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      {/* Right-click menu (D-12 Reset order + D-16 Unpin all). Dismiss on
          click-away / Escape. */}
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
            ref={resetItemRef}
            onClick={resetOrder}
            // Use plain `focus:` (not only `focus-visible:`) so the item reads as
            // active when the menu is opened by KEYBOARD and we move focus here
            // programmatically (a programmatic .focus() does not set :focus-visible).
            // Neutral hover/focus tint — accent stays selected-only.
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] text-tx-2 outline-none transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-tx focus:bg-[rgba(255,255,255,0.05)] focus:text-tx"
          >
            <RotateCcw className="h-[14px] w-[14px] flex-none" />
            Reset order
          </button>
          {/* "Unpin all" — second item, shown only when the reconciled pinned group
              is non-empty (Pitfall 5/D-16/PIN-09); clears the whole set. */}
          {pinned.length > 0 ? (
            <button
              type="button"
              role="menuitem"
              onClick={unpinAll}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] text-tx-2 outline-none transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-tx focus:bg-[rgba(255,255,255,0.05)] focus:text-tx"
            >
              <PinOff className="h-[14px] w-[14px] flex-none" />
              Unpin all
            </button>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
