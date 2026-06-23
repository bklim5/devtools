// useStoreCheckout (MAS-IAP-07, Phase 28) — the SHARED StoreKit Buy + Restore
// handler logic for the `appstore` build variant. Extracted from StoreUpsellBody
// and StoreLicenseSettings, which carried byte-identical handler bodies (the only
// difference was the on-unlock action — a modal dismiss vs a pane re-render).
//
// Fully tree-shakeable into the store bundle: it imports ONLY the platform.iap
// seam + refreshEntitlements — NO @/lib/license subtree, NO Keygen activation
// logic — so the store build that pulls it carries none of the D-03 forbidden
// copy markers and the D-04 fold-in guard stays satisfied.
//
// Buy/Restore wire the platform.iap seam ONLY (never the native Tauri API
// directly, never a locally-fabricated grant). On Buy SUCCESS / a re-granting
// Restore the handler calls refreshEntitlements() DIRECTLY (belt-and-suspenders) —
// it does NOT rely solely on the Plan-02 boot listener (which may emit no
// background event for a foreground purchase, may race boot, or may have failed to
// register); the direct refresh guarantees the foreground purchaser unlocks
// (T-28-24). Neither GRANTS anything client-side: refreshEntitlements re-reads
// iap.currentEntitlements() through the Rust JWS-verified core, so the gate stays
// baseFromStoreKit-only (fall-closed invariant intact; T-28-15).
//
// Calm tone (D-15): ONE aria-live readout carries every in-flight + result string
// as plain text. Every reject lands on the calm "App Store isn't available" line,
// never a red/amber banner or an uncaught throw (T-28-17).

import { useEffect, useRef, useState } from "react";

import { platform } from "@/lib/platform";
import { refreshEntitlements } from "@/lib/entitlements/store";

/** The fixed non-consumable Pro product id (matches the 26-01 Rust constant). */
const PRODUCT_ID = "com.tinkerdev.app.pro";

/** The calm "App Store unavailable" line — every Buy/Restore reject lands here
 *  (never a red banner / uncaught throw). */
const UNAVAILABLE =
  "The App Store isn't available right now — try again shortly.";

/** Fetch the localized StoreKit price for the Pro product (e.g. "$9.99").
 *
 *  Returns null until products() resolves — and stays null on the no-op/direct
 *  arm (products() → []) or any reject, so a host shows its price-unavailable
 *  fallback. The real value is the OS-localized displayPrice (never a hardcoded
 *  number — keeps the D-03 grep clean; the price only exists at runtime). */
export function useProDisplayPrice(): string | null {
  const [displayPrice, setDisplayPrice] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void platform.iap
      .products()
      .then((products) => {
        if (!alive) return;
        const pro = products.find((p) => p.id === PRODUCT_ID);
        if (pro) setDisplayPrice(pro.displayPrice);
      })
      .catch(() => {
        // No StoreKit / reject → leave null; the host renders its fallback copy.
      });
    return () => {
      alive = false;
    };
  }, []);
  return displayPrice;
}

export interface StoreCheckout {
  /** Calm aria-live readout — `null` renders empty. */
  readout: string | null;
  /** Debounces double-clicks while a Buy/Restore is in flight. */
  busy: boolean;
  onBuy: () => void;
  onRestore: () => void;
}

/** Shared Buy + Restore handlers for the store surfaces.
 *
 *  @param onUnlocked Called after a successful Buy / a Restore that re-grants Pro,
 *    AFTER the in-flight readout is cleared — a modal host passes its dismiss; the
 *    inline pane / ToolRoute hosts pass none (the entitlement flip re-renders to
 *    the unlocked surface, so a dismiss would be a dead control). */
export function useStoreCheckout(onUnlocked?: () => void): StoreCheckout {
  const [readout, setReadout] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Synchronous in-flight latch. `busy` (React state) drives the disabled UI, but
  // it only updates on the next render — two clicks dispatched in the SAME frame
  // both read busy===false and would fire two purchase()/restore() calls (a double
  // App Store sheet). The ref flips synchronously, so the second click is rejected
  // before React commits.
  const inFlight = useRef(false);

  // The gate has flipped to Pro (the live re-render unlocks). Clear the in-flight
  // line; a modal host additionally dismisses via onUnlocked.
  const unlock = () => {
    setReadout(null);
    onUnlocked?.();
  };

  const onBuy = () =>
    void (async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      setReadout("Opening the App Store…");
      try {
        const result = await platform.iap.purchase(PRODUCT_ID);
        switch (result.state) {
          case "success":
            await refreshEntitlements();
            unlock();
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
        inFlight.current = false;
        setBusy(false);
      }
    })();

  const onRestore = () =>
    void (async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      setReadout("Restoring your purchases…");
      try {
        await platform.iap.restore();
        // Re-resolve the gate from the freshly-synced StoreKit cache (grants
        // nothing client-side — same baseFromStoreKit authority as Buy success).
        await refreshEntitlements();
        // Read the now-current owned codes: if StoreKit re-granted nothing, tell
        // the user calmly; otherwise the live flip unlocks Pro.
        const owned = await platform.iap.currentEntitlements();
        if (owned.length > 0) {
          unlock();
        } else {
          setReadout("No purchases found for this Apple ID.");
        }
      } catch {
        setReadout(UNAVAILABLE);
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    })();

  return { readout, busy, onBuy, onRestore };
}
