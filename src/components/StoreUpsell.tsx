// StoreUpsell (MAS-IAP-07, Phase 28-04, D-02/D-14) — the StoreKit Buy + Restore
// upsell modal for the `appstore` build variant. REPLACES the Keygen UpsellModal
// activation form (which renders the sales pitch + a license-key field via the
// shared ActivationSurface). A SEPARATE module from UpsellPanel (NOT an
// `if (IS_APPSTORE)` branch inside it) so Plan 05's static IS_APPSTORE switch in
// App.tsx can tree-shake the Keygen activation subtree OUT of the store bundle and
// pass the D-03 grep gate.
//
// The dialog A11Y WRAPPER (scrim + focus-trap + Esc→onClose + return-focus-to-
// invoker + aria-modal + aria-labelledby) is COPIED from UpsellModal (UpsellPanel.tsx
// L600-692). UpsellModal's body hardcodes <UpsellPanel> (the Keygen ActivationSurface),
// so reusing the component directly would re-pull the Keygen subtree; instead the
// wrapper markup/effect is copied here and the store pitch + Buy + Restore body is
// rendered in its place (T-28-14). The class constants (PITCH_CARD/GLOW/MEDALLION/
// TITLE + PRIMARY/SECONDARY button) are likewise COPIED VERBATIM as LOCAL constants
// — NOT imported from UpsellPanel/LicenseSettings, which would re-pull the Keygen
// import subtree and break the tree-shake.
//
// Buy/Restore wire the platform.iap seam ONLY (never the native Tauri API directly,
// never a locally-fabricated grant). On Buy SUCCESS the handler calls
// refreshEntitlements() DIRECTLY (belt-and-suspenders) — it does NOT rely solely on
// the Plan-02 boot listener, which may emit no background event for a foreground
// purchase, may race boot, or may have failed to register; the direct refresh
// guarantees the foreground purchaser unlocks (T-28-24). Restore likewise calls
// refreshEntitlements() after re-syncing. Neither GRANTS anything client-side:
// refreshEntitlements re-reads iap.currentEntitlements() through the Rust JWS-verified
// core, so the gate stays baseFromStoreKit-only (fall-closed invariant intact;
// T-28-15). On Buy success the live flip closes the gate behind the modal, so the
// handler also calls onClose() (Pro is now unlocked).
//
// Calm tone (D-15): ONE aria-live="polite" role="status" readout region carries
// in-flight + result strings as plain text — no spinners, no toasts. Every reject
// renders the calm "App Store isn't available" line, never a red/amber banner or an
// uncaught throw (T-28-17). The store build has NO Keygen recovery states.

import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
} from "react";

import { platform } from "@/lib/platform";
import { refreshEntitlements } from "@/lib/entitlements/store";
import { getUpsellInvoker } from "@/shell/upsellStore";

/** Heading id linking the dialog to the pitch heading (aria-labelledby). Stable
 *  so e2e can assert the labelled dialog. */
const MODAL_HEADING_ID = "store-upsell-heading";

/** The fixed non-consumable Pro product id (matches the 26-01 Rust constant). */
const PRODUCT_ID = "com.tinkerdev.app.pro";

/** The calm "App Store unavailable" line — every Buy/Restore reject lands here
 *  (never a red banner / uncaught throw). */
const UNAVAILABLE =
  "The App Store isn't available right now — try again shortly.";

// Pitch chrome — COPIED VERBATIM from UpsellPanel (do not drift). The accent glow
// card + borderless medallion + larger hero title. The glow is a CSS background
// layered over --color-panel (inline so the token stays the source of truth).
const PITCH_CARD_CLASS =
  "relative flex w-full flex-col gap-5 overflow-hidden rounded-[7px] border border-bd p-6";
const PITCH_GLOW_STYLE = {
  background:
    "radial-gradient(125% 85% at 50% 0%, color-mix(in srgb, var(--color-accent) 13%, transparent) 0%, transparent 58%), var(--color-panel)",
};
const MEDALLION_CLASS =
  "flex h-11 w-11 flex-none items-center justify-center rounded-[10px] bg-accent-soft";
const PITCH_TITLE_CLASS = "text-[24px] font-semibold leading-[1.2] text-tx";
const PITCH_BODY_CLASS = "text-[13px] leading-[1.5] text-tx-3";
// Accent CTA — copied verbatim from UpsellPanel.
const PRIMARY_BTN_CLASS =
  "cursor-pointer rounded-[7px] border border-accent-line bg-accent-soft px-3 py-1 text-[12px] text-accent outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default disabled:border-bd disabled:bg-input-bg disabled:text-tx-2";
const SECONDARY_BTN_CLASS =
  "cursor-pointer rounded-[7px] border border-bd bg-input-bg px-3 py-1 text-[12px] text-tx-2 outline-none transition-colors hover:border-bd-2 hover:text-tx focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default";

/** Pitch feature list — store copy (28-UI-SPEC §Surface 2). The Command-Palette
 *  sub uses the "Command Palette" wording, never the command-key glyph (which is
 *  Keygen-pitch copy compiled out of the store build). */
const PITCH_FEATURES: ReadonlyArray<{ label: string; sub: string }> = [
  {
    label: "Command palette",
    sub: "Jump to any tool from the Command Palette — no mouse.",
  },
  { label: "Custom themes", sub: "Recolor the whole app to taste." },
  {
    label: "Reorder & pin tools",
    sub: "Arrange the sidebar around your workflow.",
  },
  {
    label: "Fund what's next",
    sub: "Directly support maintenance and new tools.",
  },
];

export interface StoreUpsellProps {
  /** Feature icon (lucide-react component), rendered in the accent medallion. */
  icon: ComponentType<{ className?: string }>;
  /** Dismiss the modal (Esc / scrim / Buy-success). */
  onClose: () => void;
}

/** The StoreKit Buy + Restore upsell modal. A dialog wrapper (focus trap + Esc +
 *  return-focus + scrim) — COPIED from UpsellModal — around the store pitch + Buy
 *  + Restore body. No Keygen activation logic is reachable. */
export function StoreUpsell({ icon: Icon, onClose }: StoreUpsellProps) {
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

  // ONE calm aria-live readout carries every Buy/Restore in-flight + result
  // string. `null` renders empty. A `busy` flag debounces double-clicks.
  const [readout, setReadout] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onBuy = () =>
    void (async () => {
      if (busy) return;
      setBusy(true);
      setReadout("Opening the App Store…");
      try {
        const result = await platform.iap.purchase(PRODUCT_ID);
        switch (result.state) {
          case "success":
            // Belt-and-suspenders: refresh the gate DIRECTLY rather than relying
            // solely on the Plan-02 boot listener. GRANTS NOTHING — it re-reads
            // iap.currentEntitlements() through the Rust JWS-verified core, so the
            // gate stays baseFromStoreKit-only. Pro is now unlocked: close behind.
            await refreshEntitlements();
            onCloseRef.current();
            break;
          case "userCancelled":
            setReadout("Purchase cancelled.");
            break;
          case "pending":
            // Ask-to-Buy / SCA — the approval arrives later via the boot listener.
            setReadout(
              "Purchase pending approval. Pro unlocks automatically once it's approved.",
            );
            break;
          default:
            // The state crosses the invoke() FFI boundary — guard an unmodeled
            // value at runtime rather than resolving to undefined.
            setReadout(UNAVAILABLE);
        }
      } catch {
        // A reject means NO success — refreshEntitlements is intentionally not
        // called here (nothing changed). Calm guidance, never a thrown error.
        setReadout(UNAVAILABLE);
      } finally {
        setBusy(false);
      }
    })();

  const onRestore = () =>
    void (async () => {
      if (busy) return;
      setBusy(true);
      setReadout("Restoring your purchases…");
      try {
        await platform.iap.restore();
        // Re-resolve the gate from the freshly-synced StoreKit cache (grants
        // nothing client-side — same baseFromStoreKit authority as Buy success).
        await refreshEntitlements();
        // Read the now-current owned codes: if StoreKit re-granted nothing, tell
        // the user calmly; otherwise the live flip unlocks Pro behind the modal.
        const owned = await platform.iap.currentEntitlements();
        if (owned.length > 0) {
          onCloseRef.current();
        } else {
          setReadout("No purchases found for this Apple ID.");
        }
      } catch {
        setReadout(UNAVAILABLE);
      } finally {
        setBusy(false);
      }
    })();

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
        <div className={PITCH_CARD_CLASS} style={PITCH_GLOW_STYLE}>
          {/* Medallion ABOVE a larger title — borderless accent-soft tile, then
              the hero heading on its own line. */}
          <div className="flex flex-col gap-4">
            <span className={MEDALLION_CLASS}>
              <Icon
                className="h-5 w-5 flex-none text-accent"
                aria-hidden="true"
              />
            </span>
            <h2 id={MODAL_HEADING_ID} className={PITCH_TITLE_CLASS}>
              Thank you for using TinkerDev ❤️
            </h2>
          </div>
          <p className={PITCH_BODY_CLASS}>
            Most of TinkerDev is free — built to make your everyday dev tasks
            faster. A one-time, lifetime Pro purchase unlocks the extras and
            funds what&apos;s next.
          </p>

          {/* Feature list — 4 rows, each a borderless accent-soft icon square +
              a bold label + a one-line greyer sub. */}
          <ul className="flex flex-col gap-3">
            {PITCH_FEATURES.map(({ label, sub }) => (
              <li key={label} className="flex items-start gap-3">
                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-[6px] bg-accent-soft">
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full bg-accent"
                  />
                </span>
                <div className="flex flex-col gap-0.5">
                  <p className="text-[12px] font-semibold leading-[1.3] text-tx">
                    {label}
                  </p>
                  <p className="text-[12px] leading-[1.4] text-tx-3">{sub}</p>
                </div>
              </li>
            ))}
          </ul>

          {/* Neutral divider. */}
          <hr className="border-t border-bd" />

          {/* Price block — REPLACES the Keygen in-app price block. NO in-app
              price number: the App Store sheet carries it (D-12). */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[16px] font-semibold text-tx">
              Lifetime Pro
            </span>
            <span className="text-[12px] text-tx-3">
              One-time purchase · price shown on the App Store
            </span>
          </div>

          {/* CTA row — Buy + the Apple-mandatory always-available Restore. */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onBuy}
              disabled={busy}
              className={PRIMARY_BTN_CLASS}
            >
              Buy Pro — Lifetime
            </button>
            <button
              type="button"
              onClick={onRestore}
              disabled={busy}
              className={SECONDARY_BTN_CLASS}
            >
              Restore Purchases
            </button>
          </div>

          {/* Claims footer — all true (one-time / lifetime / store-managed). */}
          <p className="font-mono text-[11px] text-tx-3">
            One-time payment · Lifetime · Managed by the App Store
          </p>

          {/* ONE calm readout region — plain text, no spinner, never red/amber. */}
          <p
            role="status"
            aria-live="polite"
            className="min-h-[18px] break-words text-[12px] leading-[1.5] text-tx-2"
          >
            {readout ?? ""}
          </p>
        </div>
      </div>
    </div>
  );
}
