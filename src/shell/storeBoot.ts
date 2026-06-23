// Store-build-only boot wiring (D-06 / D-08, MAS-IAP-02 / MAS-IAP-05).
//
// Mounted ONCE from main.tsx behind the `IS_APPSTORE` build-time gate (so the
// direct build never imports or runs this — its iap subtree tree-shakes out,
// T-28-09). This is the SINGLE store-build boot listener:
//
//   (1) Passive boot read: main.tsx already calls refreshEntitlements(), which
//       in the store build resolves Pro from iap.currentEntitlements() — a
//       passive read of the on-device StoreKit transaction cache. NO
//       AppStore.sync, NO Apple-ID auth prompt (D-08). We deliberately do NOT
//       trigger an explicit Restore / AppStore.sync here — Restore is the
//       explicit-button-only sync (D-09); a boot that synced would leak an
//       unwanted Apple-ID dialog (T-28-07).
//
//   (2) Live updates: subscribe to onPurchaseUpdated and re-run
//       refreshEntitlements() on every transaction update, so a purchase unlocks
//       Pro live (MAS-IAP-02) AND a refund/revoke-while-running drops Pro live
//       (MAS-IAP-05) through the SAME path — no relaunch. The drop-diff inside
//       refreshEntitlements fires the drop-notice on a live Pro→free transition.
//
// Reaches StoreKit ONLY through the platform.iap seam (never @tauri-apps/* —
// project constraint). Returns the unsubscribe fn (for symmetry / tests).

import { initPlatform, platform } from "@/lib/platform";
import { refreshEntitlements } from "@/lib/entitlements/store";

export async function mountStoreBoot(): Promise<() => void> {
  // Ensure the real platform impl is resolved before subscribing, so the live
  // arm (tauri.ts) is the one we register the listener Channel against.
  await initPlatform();
  return platform.iap.onPurchaseUpdated(() => {
    void refreshEntitlements();
  });
}
