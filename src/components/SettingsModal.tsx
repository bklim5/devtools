// SettingsModal (D-S1..D-S6) — the shell-level Settings surface: a large centered
// dialog over a dimmed backdrop (D-S4) with a paned layout (left nav list / right
// content, D-S3). Mounted ONCE in App.tsx, driven by the settingsStore, opened by
// every entry point (app menu ⌘, · tray · sidebar row · ⌘K · the deep-link).
//
// The a11y mechanics are a VERBATIM clone of UpsellModal (D-S2 reuse mandate):
//   - the mount-once effect reads the invoker ONCE (store path, with the
//     document.activeElement fallback for the direct-render case)
//   - the onCloseRef synced in a separate effect so the mount-once effect never
//     re-runs (re-running would re-steal + re-return focus)
//   - the Tab-wrap focus trap over the same focusable selector (wrap both ends,
//     pull focus back if it escapes) — aria-modal promises the background is inert
//   - Esc + backdrop mousedown + the × control all close (D-S5)
//   - on close, focus returns to the captured invoker (D-S2)
//
// Extended for the paned layout:
//   - the left nav renders SETTINGS_PANES as a button list; the active item
//     carries aria-current="page" (the button-list model is LOCKED — NOT a
//     tablist — per the UI-SPEC reviewer note, so Phases 23-25 inherit it)
//   - the active pane label is announced via a visually-hidden aria-live="polite"
//     region ("{label} settings", SET-05)
//   - ArrowDown/ArrowUp/Home/End move the ACTIVE PANE (setActivePane), clamped to
//     [0, PANES.length-1] (no wrap, mirroring the sidebar resolveRovingTarget
//     clamp intent). With one pane these are no-ops but the handler ships.
//   - the right pane renders the active pane's render() DIRECTLY (no extra p-8 —
//     LicenseSettings owns its own scroll + padding, Pitfall 5)

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import {
  closeSettings,
  getSettingsInvoker,
  setActivePane,
} from "@/shell/settingsStore";
import { useActivePane } from "@/shell/useSettings";
import { SETTINGS_PANES } from "./settingsPanes";

export function SettingsModal() {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const active = useActivePane();
  const activeIndex = Math.max(
    0,
    SETTINGS_PANES.findIndex((p) => p.id === active),
  );
  const activePane = SETTINGS_PANES[activeIndex];

  // Keep the latest active index visible to the mount-once keydown handler
  // without re-running the focus effect (re-running would re-steal/return focus).
  const activeIndexRef = useRef(activeIndex);
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    // D-S2: prefer the invoker captured SYNCHRONOUSLY at openSettings() time
    // (store path) — it survives focus churn between the trigger's click and this
    // mount commit. Fall back to document.activeElement for the direct-render
    // case (tests, or an opener that did not route through the store). Read it
    // ONCE here so the close path is not affected by closeSettings() clearing it.
    const invoker = getSettingsInvoker() ?? document.activeElement;
    dialogRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      // Pitfall 6 / Assumption A3: the License pane's Activate/Reactivate opens
      // the UpsellModal STACKED above this Settings modal (both z-[60]). Both
      // attach document-level keydown listeners, so a single Esc would otherwise
      // close BOTH at once — destroying the Reactivate invoker before the upsell
      // can return focus to it. While the upsell is open (it is uniquely
      // identified by aria-labelledby="upsell-heading"), Settings yields ALL
      // keyboard handling to it: the upsell owns Esc + its own focus trap, and on
      // dismiss restores focus to the still-mounted Reactivate button here.
      if (
        document.querySelector(
          '[role="dialog"][aria-labelledby="upsell-heading"]',
        )
      ) {
        return;
      }

      if (e.key === "Escape") {
        closeSettings();
        return;
      }

      // Pane-list nav (button-list model, LOCKED): arrows/Home/End change the
      // ACTIVE PANE (not just focus) so the right pane updates — the SET-05
      // "move between panes by keyboard". Clamp to [0, len-1], no wrap (mirrors
      // the sidebar resolveRovingTarget clamp). With one pane these are no-ops.
      const last = SETTINGS_PANES.length - 1;
      const i = activeIndexRef.current;
      let next = i;
      if (e.key === "ArrowDown") next = Math.min(last, i + 1);
      else if (e.key === "ArrowUp") next = Math.max(0, i - 1);
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = last;
      if (next !== i) {
        e.preventDefault();
        setActivePane(SETTINGS_PANES[next].id);
        return;
      }

      // Focus trap: aria-modal promises the background is inert, so Tab must
      // cycle within the dialog (WCAG-AA) — wrap at both ends, pull focus back in
      // if it ever lands outside.
      if (e.key === "Tab") {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const focusables = dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusables[0];
        const lastEl = focusables[focusables.length - 1];
        const activeEl = document.activeElement;
        if (e.shiftKey) {
          if (activeEl === first || !dialog.contains(activeEl)) {
            e.preventDefault();
            lastEl.focus();
          }
        } else if (activeEl === lastEl || !dialog.contains(activeEl)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      // Return focus to the invoking control (D-S2 interaction contract).
      if (invoker instanceof HTMLElement && invoker.isConnected) {
        invoker.focus();
      }
    };
  }, []);

  return (
    // z-[60] (matches UpsellModal): the scrim must cover the shell's z-50
    // bottom-right overlay stack so no interactive dialog floats clickable
    // outside this trap while aria-modal claims the background is inert.
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeSettings();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="flex h-[min(640px,86vh)] w-[min(880px,92vw)] flex-col overflow-hidden rounded-[13px] border border-bd-2 bg-win shadow-2xl outline-none"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header bar — title (aria-labelledby target) + close ×. */}
        <div className="flex flex-none items-center justify-between border-b border-bd px-6 py-4">
          <h2
            id={titleId}
            className="text-[16px] font-semibold leading-[1.2] text-tx"
          >
            Settings
          </h2>
          <button
            type="button"
            aria-label="Close settings"
            onClick={() => closeSettings()}
            className="flex h-6 w-6 flex-none items-center justify-center rounded-[6px] text-tx-2 outline-none transition-colors hover:text-tx focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        {/* Body — left nav list / right content pane. min-h-0 lets the right
            pane scroll independently while the nav + header stay fixed. */}
        <div className="flex min-h-0 flex-1">
          {/* Left nav list — the pane registry. Active item: accent-soft fill +
              3px accent left-bar + accent icon (the only accent in the nav;
              selected-only rule). aria-current="page" marks it (button-list
              model, NOT tablist — locked for Phases 23-25). */}
          <nav className="flex w-[200px] flex-none flex-col gap-0.5 border-r border-bd bg-sidebar p-[14px]">
            {SETTINGS_PANES.map((pane) => {
              const on = pane.id === active;
              const Icon = pane.icon;
              return (
                <button
                  key={pane.id}
                  type="button"
                  aria-current={on ? "page" : undefined}
                  onClick={() => setActivePane(pane.id)}
                  className={`relative flex items-center gap-2 rounded-[9px] px-[11px] py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
                    on
                      ? "bg-accent-soft text-tx"
                      : "text-tx-2 hover:bg-input-bg hover:text-tx"
                  }`}
                >
                  {on ? (
                    <span
                      aria-hidden="true"
                      className="absolute left-[3px] top-1/2 h-[56%] w-[3px] -translate-y-1/2 rounded-full bg-accent"
                    />
                  ) : null}
                  <Icon
                    aria-hidden="true"
                    className={`h-3.5 w-3.5 flex-none ${on ? "text-accent" : ""}`}
                  />
                  <span className="text-[13.5px] font-semibold">
                    {pane.label}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Right pane — the active pane's content rendered DIRECTLY (no extra
              padding; LicenseSettings owns its own overflow-auto p-8). */}
          <div className="flex-1 overflow-auto bg-pane">
            {activePane?.render()}
          </div>
        </div>

        {/* SET-05 active-pane announcement (polite, visually hidden). */}
        <div aria-live="polite" className="sr-only">
          {activePane?.label} settings
        </div>
      </div>
    </div>
  );
}
