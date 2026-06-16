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
// Each row's NavLink is a Tab stop (tabIndex 0 on EVERY row) and carries the whole
// keyboard model. Tab steps row → pin button → next row (grip excluded); arrows are
// the FAST tool-to-tool path on top of Tab (D-17). A normal click/Enter/Space
// navigates (D-01/REORD-02). The pin button is ALSO a Tab stop (tabIndex 0 — a
// keyboard fallback for pinning via Enter/Space) revealed on row hover, row
// focus-within, OR its own focus; it preventDefault/stopPropagation so it toggles
// membership without navigating (D-14/PIN-04). The grip handle stays POINTER-ONLY
// (tabIndex -1, aria-hidden) — keyboard reorder is Alt+↑/↓ on the row — and remains
// the only `draggable` element.
//
// Drag: native HTML5 drag events (zero new deps — D-02). A neutral insertion
// line (NOT the accent colour — D-03/accent = selected-only) marks the drop slot.
// Drag + Alt+↑/↓ reorder run INDEPENDENTLY within each group (`draggingGroup`,
// per-group clamp) — a tool never crosses the pinned↔unpinned boundary by
// dragging; membership changes via pin/unpin only (PIN-06). The drag state +
// handlers live in useSidebarDragDrop.ts; the reset / "Unpin all" menu's
// open/close/dismiss logic + JSX live in SidebarResetMenu.tsx.
// Keyboard (all bound on the ROW): plain ↑/↓ move FOCUS to the previous/next
// visible row, traversing pinned then unpinned as one continuous sequence across
// the divider (focus only, clamp at the ends); Home/End focus the
// first/last visible row. Alt+↑/↓ move the focused tool one slot within its OWN
// group (D-04, never crossing the boundary — PIN-06), keeping focus on the moved
// row. Alt+P pins/unpins the focused tool (D-13/PIN-05). Shift+F10 / ContextMenu
// open the reset / "Unpin all" menu. Every move/toggle is announced through an
// aria-live="polite" region using the registry name (D-06). A right-click menu
// carries "Reset order" (D-12) and "Unpin all" (D-16/PIN-09). Each change persists
// immediately via setToolOrder / setPinnedToolIds and survives restart.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { GripVertical, Lock, Pin, Settings } from "lucide-react";
import { NavLink } from "react-router-dom";
import { ENT_ORDERING, ENT_THEMING, isToolLocked } from "@/lib/entitlements/entitlements";
import { ENABLED_TOOLS, getToolById } from "@/lib/tools/registry";
import { useEntitlements } from "@/shell/useEntitlements";
import { useLicenseUi } from "@/shell/useLicenseUi";
import { usePreferences } from "@/shell/usePreferences";
import { moveToolInOrder, partitionTools, resolveRovingTarget } from "@/shell/toolOrder";
import { openSettings } from "@/shell/settingsStore";
import { openUpsell } from "@/shell/upsellStore";
import { SidebarResetMenu, useSidebarResetMenu } from "./SidebarResetMenu";
import { useSidebarDragDrop, type ToolGroup } from "./useSidebarDragDrop";

export function Sidebar() {
  const { preferences, setToolOrder, setPinnedToolIds, togglePinned } = usePreferences();

  // Live registry order (single control plane) + the reconciled two-group render
  // overlay. Pre-load, preferences.{pinnedToolIds,toolOrder} are [] → partitionTools
  // is the registry order with an empty pinned group, so there is no order flash
  // and no spinner needed (D-11/PIN-08).
  const registryIds = ENABLED_TOOLS.map((t) => t.id);
  // ENT-02/D-26: ordering/pinning gate through the ONE resolved entitlement set.
  // While pro.ordering is missing the partition renders the registry DEFAULT
  // (pinned group hidden, custom order reverted) — but the STORED prefs are never
  // touched, so unlocking restores the arrangement instantly. With `pinned`
  // forced empty, the pinned group, divider, and "Unpin all" item hide for free.
  const ents = useEntitlements();
  const orderingUnlocked = ents.has(ENT_ORDERING);
  // D-43/D-84: a corrupt/tampered/foreign machine.lic (problem) OR a lapsed
  // grace (refreshNeeded) surfaces as the quiet footer attention hint (no launch
  // interruption). OfflineGrace stays SILENT here (D-77 — no footer nag). Details
  // live in the status route (D-88) / the panel's D-44 problem state.
  const licenseState = useLicenseUi().state;
  const licenseAttention =
    licenseState === "problem" || licenseState === "refreshNeeded";
  const { pinned, unpinned } = partitionTools(
    orderingUnlocked ? preferences.pinnedToolIds : [],
    orderingUnlocked ? preferences.toolOrder : [],
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
  // The flat visible order — pinned then unpinned as ONE continuous sequence. Plain
  // ↑/↓ focus nav traverses this across the divider.
  const visibleIds = useMemo(() => [...pinned, ...unpinned], [pinned, unpinned]);

  // Phase 22.2 (user-approved 2026-06-16, reverses the 22.1-04 redirect for the
  // CONTEXTUAL triggers): the locked customization affordances (pin click,
  // Alt+↑/↓, Alt+P, reset, drag) open the focused "Unlock Pro" MODAL — a quick
  // interruption that dismisses back to where the user was — instead of yanking
  // them into the full Settings ▸ License modal. The modal renders the SAME shared
  // ActivationSurface (one activation surface, two presentations). The invoker is
  // threaded for the focus-return contract: most callers (pin click, Alt chords,
  // drag) are invoked from a persistent focused control (default activeElement
  // capture); the reset MENU path passes an explicit return target because its menu
  // item unmounts on open (finding 3).
  const openOrderingUpsell = useCallback(
    (invokerEl?: HTMLElement | null) => openUpsell(invokerEl),
    [],
  );
  // The EXPLICIT footer "Unlock Pro" / "License needs attention" affordance keeps
  // going to Settings ▸ License (the user is deliberately heading toward licensing,
  // and a free user MUST retain a path to buy). MED-22-02: pass the clicked element
  // as the explicit return target — a WKWebView mouse click leaves
  // document.activeElement unreliable, so the store's default capture would strand
  // focus on modal close.
  const openLicenseSurface = useCallback(
    (invokerEl?: HTMLElement | null) => openSettings("license", invokerEl),
    [],
  );

  // The aria-live announcement text (D-06). Re-set on every successful move/toggle.
  const [announcement, setAnnouncement] = useState("");
  // The <nav> element — a stable focus anchor for menu dismissal when the saved
  // return-focus element is no longer connected (WR-02 fallback).
  const navRef = useRef<HTMLElement | null>(null);
  // Row (NavLink <a>) elements keyed by tool id, so a keyboard move/toggle or a
  // roving ↑/↓ can re-focus the right row after React re-renders the reordered
  // list. ONE shared map across BOTH groups, so a pin/unpin that moves a tool
  // between groups still re-finds its row (Pitfall 3). NavLink forwards its ref to
  // the underlying <a> (REORD-02 — the row is the Tab stop).
  const rowRefs = useRef(new Map<string, HTMLAnchorElement | null>());
  // When set, a layout effect focuses this tool's row once the move lands, and
  // syncs the roving Tab stop to it.
  const focusAfterMoveRef = useRef<string | null>(null);
  // Pending aria-live re-announce timer (cleared on unmount).
  const reannounceRef = useRef<number | null>(null);

  // Focus a row by tool id (the post-reorder / arrow-nav move target). Centralises
  // the rowRefs lookup. Every row is now a Tab stop (tabIndex 0), so there is no
  // roving Tab-stop to sync — arrows just move focus directly.
  const focusRow = useCallback((id: string) => {
    rowRefs.current.get(id)?.focus();
  }, []);

  // Resolve a tool's row element by id — the STABLE focus-return target threaded
  // into the locked drag path (the grip is pointer-only chrome that hides off-hover,
  // so it can't be the return target). Stable identity (rowRefs is a ref) so it
  // never churns the drag hook's onDragStart callback.
  const getRowEl = useCallback(
    (id: string) => rowRefs.current.get(id) ?? null,
    [],
  );

  useLayoutEffect(() => {
    const id = focusAfterMoveRef.current;
    if (!id) return;
    focusAfterMoveRef.current = null;
    focusRow(id);
  }, [focusRow]);

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
  // Name the group in the announcement ONLY when a pinned group exists — with two
  // visible groups "position 1 of 2" is ambiguous, so SR users need to hear which
  // list moved. When nothing is pinned there is a single list, so the terse phrasing
  // stays. `pinned.length` is read at call time via the dep array.
  const groupSuffix = useCallback(
    (group: ToolGroup) =>
      pinned.length > 0 ? ` in ${group === "pinned" ? "pinned tools" : "tools"}` : "",
    [pinned.length],
  );

  const announceMove = useCallback(
    (group: ToolGroup, id: string, next: string[]) => {
      const tool = getToolById(id);
      if (!tool) return;
      const n = next.indexOf(id) + 1; // 1-based new position in the group
      announce(`Moved ${tool.name} to position ${n} of ${next.length}${groupSuffix(group)}`);
    },
    [announce, groupSuffix],
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
      announceMove(group, id, next);
      if (opts?.focus) focusAfterMoveRef.current = id;
    },
    [groupOrder, setPinnedToolIds, setToolOrder, announceMove],
  );

  // Toggle a tool's pinned membership (shared by the pin button + Alt+P). Keeps
  // focus on the toggled tool's handle across the cross-group re-render (Pitfall 3),
  // and announces with the registry NAME (Pitfall 4).
  const togglePin = useCallback(
    (id: string, invokerEl?: HTMLElement | null) => {
      // D-28: locked → the affordance stays visible but invoking it opens the
      // upsell instead of writing prefs. Returning BEFORE any setter makes prefs
      // preservation structural (T-18-12). Thread the explicit invoker (the pin
      // button / focused row) so Settings restores focus there on close — a
      // WKWebView click leaves document.activeElement unreliable (MED-22-02).
      if (!orderingUnlocked) {
        openOrderingUpsell(invokerEl);
        return;
      }
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
    [orderingUnlocked, openOrderingUpsell, pinnedSet, togglePinned, announce],
  );

  // --- Native HTML5 drag (handle-initiated only — D-01/D-02) -----------------
  // The drag state machine + five handlers live in useSidebarDragDrop.ts: the
  // locked path (T-18-12), per-group scoping (PIN-06), and the gap-index drop
  // math moved there verbatim. Persistence + announce stay here via commitMove.
  const {
    draggingId,
    draggingGroup,
    dropIndex,
    onDragStart,
    onRowDragOver,
    onNavDragOver,
    onDrop,
    onDragEnd,
  } = useSidebarDragDrop({
    orderingUnlocked,
    openOrderingUpsell,
    // Stable focus-return target for a locked drag (MED-22-02) — see getRowEl above.
    getRowEl,
    groupOrder,
    commitMove,
  });

  // --- Row keyboard model: plain ↑/↓/Home/End focus nav, Alt+↑/↓ reorder,
  //     Alt+P toggle (D-04/D-13/PIN-05/PIN-06). Bound on the NavLink row (every row
  //     is a Tab stop now) so every chord works from where focus actually is.
  //     Shift+F10 / ContextMenu fall through to the <nav> handler (which opens the
  //     reset / "Unpin all" menu); Enter/Space stay default (NavLink navigation).
  const onRowKeyDown = useCallback(
    (e: React.KeyboardEvent, id: string, group: ToolGroup) => {
      // Plain (no-Alt) ↑/↓/Home/End move FOCUS across the WHOLE visible list,
      // crossing the pinned↔unpinned divider as one continuous sequence (focus
      // only; clamp at the ends, no wrap — the fast arrow path over Tab).
      if (!e.altKey) {
        const dir =
          e.key === "ArrowUp"
            ? "up"
            : e.key === "ArrowDown"
              ? "down"
              : e.key === "Home"
                ? "home"
                : e.key === "End"
                  ? "end"
                  : null;
        if (!dir) return; // Enter/Space/Tab/etc. fall through to default behaviour
        e.preventDefault();
        const next = resolveRovingTarget(visibleIds, id, dir);
        if (next && next !== id) focusRow(next);
        return;
      }

      // D-28: locked → every Alt customization chord (pin + reorder) opens the
      // upsell instead of mutating prefs. Match the PHYSICAL key for Alt+P exactly
      // like the unlocked path below (macOS Option+P composes to "π" — Pitfall 9).
      // Plain ↑/↓/Home/End focus nav above stays available locked: it is
      // navigation, not customization.
      if (!orderingUnlocked) {
        if (
          e.code === "KeyP" ||
          e.key === "p" ||
          e.key === "P" ||
          e.key === "ArrowUp" ||
          e.key === "ArrowDown"
        ) {
          e.preventDefault();
          // Focus is on this row (e.currentTarget) — hand it to Settings as the
          // explicit return target so focus lands back here on close.
          openOrderingUpsell(e.currentTarget as HTMLElement);
        }
        return;
      }

      // Alt+P pins/unpins the focused tool (D-13/PIN-05). Alt-family only — no
      // plain 'P', matching the sidebar's no-single-key model. Match the PHYSICAL
      // key (`e.code === "KeyP"`): on macOS, Option+P COMPOSES to the character "π",
      // so the keydown arrives with `e.key === "π"` (NOT "p") — an `e.key`-only
      // check is dead under Option on the real WKWebView. `e.code` is layout/compose-
      // independent and is what makes real macOS Option+P work; the `e.key` arms stay
      // as a cross-platform / synthetic-event fallback.
      if (e.code === "KeyP" || e.key === "p" || e.key === "P") {
        e.preventDefault();
        togglePin(id, e.currentTarget as HTMLElement);
        return;
      }

      // Alt+↑/↓ reorder WITHIN the row's OWN group, never the whole list
      // (Pitfall 2/PIN-06). Focus stays on the moved row.
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
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
          const suffix = groupSuffix(group);
          const msg =
            target < 0
              ? `Already at position ${pos} of ${total}${suffix}`
              : `Already at last position ${pos} of ${total}${suffix}`;
          announce(msg);
        }
        return;
      }
      commitMove(group, id, target, { focus: true });
    },
    [
      visibleIds,
      focusRow,
      orderingUnlocked,
      openOrderingUpsell,
      groupOrder,
      commitMove,
      announce,
      togglePin,
      groupSuffix,
    ],
  );

  // --- Reset order (D-12) + Unpin all (D-16) menu ----------------------------
  // Open/close/focus-restore/dismiss logic + the menu JSX live in
  // SidebarResetMenu.tsx (it gets navRef/rowRefs for the WR-02 focus-fallback
  // chain). The ACTIONS below stay here — they own the prefs setters, announce,
  // and the upsell branch — and are passed to the menu as props.
  const {
    resetMenu,
    resetItemRef,
    openResetMenuFromMouse,
    openResetMenuFromKeyboard,
    closeResetMenu,
    resolveMenuReturnFocus,
  } = useSidebarResetMenu({ navRef, rowRefs });

  const resetOrder = useCallback(() => {
    // D-28: the menu item stays reachable (visible affordance), but locked it
    // opens Settings ▸ License (the inline upsell) instead of clearing the order.
    if (!orderingUnlocked) {
      // Finding 3: the reset MENU item is about to unmount, so it can't be the
      // Settings modal's focus-return target. Resolve the menu's intended
      // return-focus element (the invoking row / nav, the SAME place a normal
      // close restores to) BEFORE closing, and hand it to openOrderingUpsell
      // explicitly so focus lands there on modal dismiss — not on the detached
      // menu item.
      const returnTarget = resolveMenuReturnFocus();
      openOrderingUpsell(returnTarget);
      closeResetMenu({ restoreFocus: true });
      return;
    }
    setToolOrder([]); // clears to default registry order
    announce("Sidebar order reset to default");
    closeResetMenu({ restoreFocus: true });
  }, [
    orderingUnlocked,
    openOrderingUpsell,
    resolveMenuReturnFocus,
    setToolOrder,
    announce,
    closeResetMenu,
  ]);

  const unpinAll = useCallback(() => {
    setPinnedToolIds([]); // clears the whole pinned set (PIN-09)
    announce("All tools unpinned");
    closeResetMenu({ restoreFocus: true });
  }, [setPinnedToolIds, announce, closeResetMenu]);

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
      // D-23: tool-level lock through the ONE central predicate. Dormant in
      // production (no shipped tool carries requiredEntitlements — D-18);
      // proven by fixture in Sidebar.locked.test.tsx.
      const locked = isToolLocked(tool, ents);
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
              // Every row is a Tab stop (tabIndex 0) and carries the whole keyboard
              // model (plain ↑/↓ + Home/End focus nav, Alt+↑/↓ reorder, Alt+P pin,
              // Shift+F10 menu). NavLink forwards this ref to the underlying <a>.
              ref={(el) => {
                rowRefs.current.set(tool.id, el);
              }}
              tabIndex={0}
              onKeyDown={(e) => onRowKeyDown(e, tool.id, group)}
              aria-keyshortcuts="Alt+P"
              className={({ isActive }) =>
                [
                  // navitem: compact padding, radius 9px, icon↔name gap 12px. Right
                  // padding leaves room for the two absolutely-positioned controls
                  // (pin + grip) so the name does not truncate under them (Pitfall 6).
                  "flex min-w-0 flex-1 items-center gap-3 rounded-[9px] py-2 pl-[11px] pr-14",
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
                  {locked ? (
                    <>
                      {/* D-23/D-24: neutral status-badge-family glyph INLINE after
                          the name — NOT in the right control zone (pin right-8 /
                          grip right-1 own it, RESEARCH Pitfall 7). Accent
                          forbidden (D-24); no opacity/dimming (ENT-04). */}
                      <Lock aria-hidden="true" className="h-3 w-3 flex-none text-tx-2" />
                      {/* D-25: SR-only suffix → accessible name "X — locked".
                          No aria-live for static lock state. */}
                      <span className="sr-only"> — locked</span>
                    </>
                  ) : null}
                </>
              )}
            </NavLink>
            {/* Pin toggle — LEFT of the grip (grip stays outermost at right-1, pin
                at right-8; D-14). A KEYBOARD FALLBACK for pinning: tabIndex 0 puts it
                in the Tab order (Tab steps row → pin → next row), and as a native
                <button> Enter/Space toggle it; a click still toggles too (Alt+P on
                the row remains the fast path). Both controls are 24×24 (h-6 w-6) for
                WCAG 2.5.8 target size, with a 0.25rem gap; pr-14 reserves room for
                both. Pinned rows show a PERSISTENT filled pin (the unpin target — no
                hover-only); unpinned rows show an OUTLINE pin on row hover, row
                focus-within, OR the pin button's OWN focus (focus-visible) so it is
                visible while itself Tab-focused. Neutral tokens only (accent =
                selected-only, D-03). preventDefault + stopPropagation so the NavLink
                does NOT navigate (PIN-04). */}
            <button
              type="button"
              tabIndex={0}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                togglePin(tool.id, e.currentTarget);
              }}
              aria-label={isPinned ? `Unpin ${tool.name}` : `Pin ${tool.name}`}
              aria-pressed={isPinned}
              title={isPinned ? `Unpin ${tool.name} (Alt+P)` : `Pin ${tool.name} (Alt+P)`}
              className={[
                "absolute right-8 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-[6px]",
                "outline-none focus-visible:ring-2 focus-visible:ring-accent",
                isPinned
                  ? "text-tx-2" // persistent, always-visible, neutral
                  : "text-tx-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100",
              ].join(" ")}
            >
              <Pin
                className={["h-[14px] w-[14px]", isPinned ? "fill-current" : ""].join(" ")}
              />
            </button>
            {/* Grip handle — now a POINTER-ONLY drag affordance. tabIndex -1 +
                aria-hidden: the ROW carries the SR-exposed control, the keyboard
                reorder (Alt+↑/↓) and the reorder announce()s, so the grip is pure
                pointer chrome (no Tab stop, no key handler). Revealed on row hover
                OR row focus-within. A plain NavLink click never starts a drag
                because the NavLink is not draggable (REORD-02). The aria-label is
                retained as the stable e2e/test selector for this row's tool. */}
            <button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              draggable
              onDragStart={(e) => onDragStart(e, tool.id, group)}
              onDragEnd={onDragEnd}
              aria-label={`Reorder ${tool.name}`}
              title={`Reorder ${tool.name} (drag)`}
              className={[
                "absolute right-1 top-1/2 -translate-y-1/2 flex h-6 w-6 cursor-grab items-center justify-center rounded-[6px]",
                "text-tx-3 opacity-0 transition-opacity",
                "group-hover:opacity-100 group-focus-within:opacity-100",
                "outline-none active:cursor-grabbing",
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
      ents,
      onRowDragOver,
      onDrop,
      onDragStart,
      onDragEnd,
      onRowKeyDown,
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

      {/* D-29 (revised 22.1-04): standing free-tier "Unlock Pro" entry — quiet,
          neutral, keyboard-reachable (native button: click/Enter/Space). Bottom-
          anchored by the flex-1 nav above. Opens Settings ▸ License, where the
          License pane renders the inline upsell (the standalone modal is gone).
          D-43 (Phase 19): when the stored license file fails verification the
          SAME row becomes the calm "License needs attention" hint — neutral
          tokens, no red alarm styling (a hint, not an interruption); the License
          pane renders the D-44 problem state. */}
      {licenseAttention || !ents.has(ENT_ORDERING) || !ents.has(ENT_THEMING) ? (
        <button
          type="button"
          onClick={(e) => openLicenseSurface(e.currentTarget)}
          className="flex min-h-6 items-center gap-2 rounded-[6px] px-[11px] py-1 text-left text-[13px] text-tx-2 outline-none transition-colors hover:text-tx focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Lock aria-hidden="true" className="h-3 w-3 flex-none" />
          {licenseAttention ? "License needs attention" : "Unlock Pro"}
        </button>
      ) : null}

      {/* D-S9/D-S10: bottom-anchored Settings row — anchored at the very bottom of
          the footer, BELOW the Unlock-Pro / "License needs attention" affordance.
          UNCONDITIONAL: opens for everyone, including unlicensed (SET-04), with NO
          lock badge. Opens the single Settings modal on the License pane
          (openSettings — the one Settings surface, D-S6). Native button:
          click/Enter/Space. */}
      <button
        type="button"
        onClick={(e) => openSettings("license", e.currentTarget)}
        className="flex min-h-6 items-center gap-2 rounded-[6px] px-[11px] py-1 text-left text-[13px] text-tx-2 outline-none transition-colors hover:text-tx focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Settings aria-hidden="true" className="h-3 w-3 flex-none" />
        Settings
      </button>

      {/* Reorder / pin announcements for screen readers (D-06). Visually hidden. */}
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      {/* Right-click menu (D-12 Reset order + D-16 Unpin all). Dismiss on
          click-away / Escape. */}
      {resetMenu ? (
        <SidebarResetMenu
          menu={resetMenu}
          resetItemRef={resetItemRef}
          onResetOrder={resetOrder}
          onUnpinAll={unpinAll}
          showUnpinAll={pinned.length > 0}
        />
      ) : null}
    </aside>
  );
}
