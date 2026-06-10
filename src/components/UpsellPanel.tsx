// UpsellPanel (D-19..D-22) — the ONE shared upsell surface for every locked
// feature: rendered in place of a locked tool's UI (route placement, D-30) and
// inside UpsellModal for app-level locks (D-28 affordances + the D-29 footer
// row). Layout is FINAL from this phase; Phase 19 wires the license-key
// affordance, Phase 20 swaps in the real checkout link.
//
// WCAG-AA (per 18-UI-SPEC): real heading element, visible focus-visible rings,
// all buttons Tab-reachable, neutral tokens everywhere — accent appears ONLY on
// the primary CTA's accent-soft fill + focus rings, never a solid accent fill.
// Layout-agnostic: no fixed positioning inside the card; callers place it.

import { useEffect, useRef, type ComponentType } from "react";

/** Stub — Phase 20 swaps in the real MoR checkout link. The CTA is a no-op
 *  until then (D-21): ONE constant so the swap is a single edit. */
export const BUY_LICENSE_URL = "https://example.invalid/devtools/buy";

export interface UpsellPanelProps {
  /** Locked feature display name, e.g. "Theming" or "Tool ordering & pinning". */
  feature: string;
  /** Feature icon (lucide-react component), rendered neutral beside the heading. */
  icon: ComponentType<{ className?: string }>;
  /** Optional heading id so a wrapping dialog can point aria-labelledby at it. */
  headingId?: string;
}

export function UpsellPanel({ feature, icon: Icon, headingId }: UpsellPanelProps) {
  return (
    <div className="flex max-w-[420px] flex-col gap-4 rounded-[7px] border border-bd bg-panel p-6">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 flex-none text-tx-2" aria-hidden="true" />
        <h2
          id={headingId}
          className="text-[16px] font-semibold leading-[1.2] text-tx"
        >
          Thank you for using TinkerDev ❤️
        </h2>
      </div>
      <div className="flex flex-col gap-2 text-[12px] leading-[1.5] text-tx-2">
        <p>
          TinkerDev is built to make everyday developer tasks faster and easier.
          Most features are free, because I want it to be genuinely useful in
          your daily workflow.
        </p>
        <p>
          If TinkerDev has saved you time, solved a problem, or earned a spot in
          your toolkit, please consider supporting it with a lifetime license.
          Your support directly funds ongoing maintenance, bug fixes, and new
          features.
        </p>
        <p>
          As a thank you, you&apos;ll also unlock premium extras like custom
          themes, tool reordering, and more to come.
        </p>
        <p>Would you like to upgrade to a lifetime license today?</p>
      </div>
      {/* D-19: the locked feature stays identifiable — a quiet meta line names
          exactly WHAT this panel unlocks. */}
      <p className="text-[11px] leading-[1.5] text-tx-2">Unlocks: {feature}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            // D-21 stub: the CTA reads the single URL constant but stays a
            // no-op this phase — Phase 20 wires the real checkout open.
            void BUY_LICENSE_URL;
          }}
          className="cursor-pointer rounded-[7px] border border-accent-line bg-accent-soft px-3 py-1 text-[12px] text-accent outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent"
        >
          Buy license
        </button>
        <button
          type="button"
          // D-22: inert stub — Phase 19 wires key-paste activation here.
          className="cursor-pointer rounded-[7px] border border-bd bg-input-bg px-3 py-1 text-[12px] text-tx-2 outline-none transition-colors hover:border-bd-2 hover:text-tx focus-visible:ring-2 focus-visible:ring-accent"
        >
          I have a license key
        </button>
      </div>
    </div>
  );
}

const MODAL_HEADING_ID = "upsell-heading";

export interface UpsellModalProps {
  feature: string;
  icon: ComponentType<{ className?: string }>;
  onClose: () => void;
}

/** Modal wrapper for app-level locks (D-28/D-29 surfaces). Reuses the ⌘K
 *  palette's scrim/dismiss pattern: Esc + scrim-click dismiss, focus moves into
 *  the dialog on mount and returns to the invoking control on unmount. */
export function UpsellModal({ feature, icon, onClose }: UpsellModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // Keep the latest onClose visible to the mount-once effect without re-running
  // it (re-running would re-steal and re-return focus on every prop change).
  // Synced in an effect, not during render (react-hooks/refs).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const invoker = document.activeElement;
    dialogRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      // Focus trap: aria-modal promises the background is inert, so Tab must
      // cycle within the dialog (WCAG-AA) — wrap at both ends, and pull focus
      // back in if it ever lands outside.
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
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey) {
          if (active === first || !dialog.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else if (active === last || !dialog.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      // Return focus to the invoking control (UI-SPEC interaction contract).
      if (invoker instanceof HTMLElement && invoker.isConnected) {
        invoker.focus();
      }
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={MODAL_HEADING_ID}
        tabIndex={-1}
        className="outline-none"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <UpsellPanel feature={feature} icon={icon} headingId={MODAL_HEADING_ID} />
      </div>
    </div>
  );
}
