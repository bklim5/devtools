// StoreUpsell (MAS-IAP-07, Phase 28-04, D-02/D-14) — the StoreKit Buy + Restore
// upsell MODAL for the `appstore` build variant. REPLACES the Keygen UpsellModal
// activation form (which renders the sales pitch + a license-key field via the
// shared ActivationSurface). A SEPARATE module from UpsellPanel (NOT an
// `if (IS_APPSTORE)` branch inside it) so Plan 05's static IS_APPSTORE switch in
// App.tsx can tree-shake the Keygen activation subtree OUT of the store bundle and
// pass the D-03 grep gate.
//
// The dialog A11Y WRAPPER (scrim + focus-trap + Esc→onClose + return-focus-to-
// invoker + aria-modal + aria-labelledby) is COPIED from UpsellModal (UpsellPanel.tsx
// L600-692). The store pitch + Buy + Restore body lives in the SHARED
// StoreUpsellBody (Phase 28-05) — rendered here inside the dialog, and by
// StoreToolUpsell inline (ToolRoute) without a dialog. Reusing the shared body keeps
// both surfaces byte-identical and pulls NO Keygen import subtree.
//
// On Buy success / a re-granting Restore the body invokes onPurchased — here wired
// to onClose so the modal dismisses behind the now-unlocked Pro gate.

import {
  useEffect,
  useRef,
  type ComponentType,
} from "react";

import { getUpsellInvoker } from "@/shell/upsellStore";
import { StoreUpsellBody } from "./StoreUpsellBody";

/** Heading id linking the dialog to the pitch heading (aria-labelledby). Stable
 *  so e2e can assert the labelled dialog. */
const MODAL_HEADING_ID = "store-upsell-heading";

export interface StoreUpsellProps {
  /** Feature icon (lucide-react component), rendered in the accent medallion. */
  icon: ComponentType<{ className?: string }>;
  /** Dismiss the modal (Esc / scrim / Buy-success). */
  onClose: () => void;
}

/** The StoreKit Buy + Restore upsell modal. A dialog wrapper (focus trap + Esc +
 *  return-focus + scrim) — COPIED from UpsellModal — around the shared
 *  StoreUpsellBody. No Keygen activation logic is reachable. */
export function StoreUpsell({ icon, onClose }: StoreUpsellProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // Keep the latest onClose visible to the mount-once effect without re-running
  // it (re-running would re-steal and re-return focus on every prop change).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    // Prefer the invoker captured SYNCHRONOUSLY at openUpsell() time (store path)
    // — it survives any focus churn between the trigger's click and this mount
    // commit. Fall back to document.activeElement for a direct-render case (tests).
    const invoker = getUpsellInvoker() ?? document.activeElement;
    dialogRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
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
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey) {
          // `active === dialog`: on mount focus sits on the dialog WRAPPER (so SR
          // announces the dialog). A Shift+Tab from there must wrap to `last`.
          if (active === first || active === dialog || !dialog.contains(active)) {
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
    // z-[60]: the scrim must cover the shell's bottom-right overlay stack (z-50)
    // so no interactive control floats clickable outside this trap.
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim"
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
        // The card is w-full (layout-agnostic); the dialog wrapper bounds the
        // modal's width (with a viewport margin) so the pitch reads as a card.
        className="w-full max-w-[520px] px-4 outline-none"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <StoreUpsellBody
          icon={icon}
          headingId={MODAL_HEADING_ID}
          // Buy success / re-granting Restore: dismiss the modal behind the now-
          // unlocked Pro gate (the live flip already closed the gate).
          onPurchased={() => onCloseRef.current()}
        />
      </div>
    </div>
  );
}
