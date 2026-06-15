// The sidebar's right-click / Shift+F10 menu — "Reset order" (D-12) + "Unpin
// all" (D-16/PIN-09) — extracted verbatim from Sidebar.tsx. The hook owns
// open/close/focus-restore/dismiss; the ACTIONS (resetOrder/unpinAll) stay in
// Sidebar.tsx (they own the prefs setters + announce + the upsell branch) and
// arrive as props on the menu component.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { PinOff, RotateCcw } from "lucide-react";

export interface ResetMenu {
  x: number;
  y: number;
}

export interface SidebarResetMenuRefs {
  /** The <nav> element — a stable focus anchor for menu dismissal when the saved
      return-focus element is no longer connected (WR-02 fallback). */
  navRef: React.RefObject<HTMLElement | null>;
  /** Row (NavLink <a>) elements keyed by tool id — the last-resort focus fallback. */
  rowRefs: React.RefObject<Map<string, HTMLAnchorElement | null>>;
}

// eslint-disable-next-line react-refresh/only-export-components -- the hook and
// the menu component are ONE seam (open/close/dismiss + JSX) extracted together
// from Sidebar.tsx; a Fast-Refresh full-reload on edits here is acceptable.
export function useSidebarResetMenu({ navRef, rowRefs }: SidebarResetMenuRefs) {
  // The right-click context menu (D-12/D-16), positioned at the cursor.
  const [resetMenu, setResetMenu] = useState<ResetMenu | null>(null);
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

  // Resolve the element focus should return to when the menu closes: the saved
  // open-from element if it is still a genuinely-focusable connected control,
  // otherwise a stable anchor (the <nav>, then any live row). Shared by the
  // close-restore path AND the upsell hand-off (so a locked menu action that
  // opens the upsell modal returns focus to the SAME place a normal close would
  // — never the doomed menu item, codex finding 3).
  const resolveMenuReturnFocus = useCallback((): HTMLElement | null => {
    const el = menuReturnFocusRef.current;
    const usable =
      el && el.isConnected && el !== document.body && el.tabIndex >= 0;
    if (usable) return el;
    return (
      navRef.current ??
      [...rowRefs.current.values()].find((r) => r?.isConnected) ??
      null
    );
  }, [navRef, rowRefs]);

  const closeResetMenu = useCallback(
    (opts?: { restoreFocus?: boolean }) => {
      setResetMenu(null);
      if (opts?.restoreFocus) {
        // The saved element (typically a grip handle) may have been detached or
        // re-keyed between open and close — calling .focus() on a disconnected node
        // is a no-op that silently strands focus on <body>. A right-click open also
        // captures document.activeElement as <body> (a right-click does not focus the
        // row), which IS connected — restoring to it would strand keyboard focus on
        // <body> just the same. resolveMenuReturnFocus() restores only to a
        // still-connected, genuinely focusable element (not <body>, tabIndex >= 0);
        // otherwise a stable anchor (the <nav>, then any live grip) so keyboard
        // users are never left adrift.
        resolveMenuReturnFocus()?.focus();
      }
      menuReturnFocusRef.current = null;
    },
    [resolveMenuReturnFocus],
  );

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

  return {
    resetMenu,
    resetItemRef,
    openResetMenuFromMouse,
    openResetMenuFromKeyboard,
    closeResetMenu,
    resolveMenuReturnFocus,
  };
}

export interface SidebarResetMenuProps {
  menu: ResetMenu;
  resetItemRef: React.RefObject<HTMLButtonElement | null>;
  onResetOrder: () => void;
  onUnpinAll: () => void;
  /** "Unpin all" renders only when the reconciled pinned group is non-empty
      (Pitfall 5/D-16/PIN-09). */
  showUnpinAll: boolean;
}

export function SidebarResetMenu({
  menu,
  resetItemRef,
  onResetOrder,
  onUnpinAll,
  showUnpinAll,
}: SidebarResetMenuProps) {
  return (
    <div
      role="menu"
      aria-label="Sidebar order"
      className="fixed z-50 min-w-[160px] rounded-[8px] border border-bd bg-panel py-1 shadow-lg"
      style={{ left: menu.x, top: menu.y }}
      // Keep clicks inside from bubbling to the document click-away handler.
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        role="menuitem"
        ref={resetItemRef}
        onClick={onResetOrder}
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
      {showUnpinAll ? (
        <button
          type="button"
          role="menuitem"
          onClick={onUnpinAll}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] text-tx-2 outline-none transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-tx focus:bg-[rgba(255,255,255,0.05)] focus:text-tx"
        >
          <PinOff className="h-[14px] w-[14px] flex-none" />
          Unpin all
        </button>
      ) : null}
    </div>
  );
}
