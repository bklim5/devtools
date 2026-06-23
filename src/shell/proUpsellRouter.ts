// The SINGLE static switch point (D-01/D-04) selecting the Pro-upsell router for
// the not-Pro triggers (free ⌘K, locked pin/reorder/Alt+P/Reset, free Appearance
// Save). Both routers share the exact signature `(invokerEl?) => void`:
//
//   • direct build  → openProUpsell      — routes by Keygen license state (a free
//     user gets the pitch modal; a lapsed/attention PAYING customer gets the
//     Settings ▸ License recovery form, never the pitch — D-44).
//   • store build   → storeOpenProUpsell — routes UNCONDITIONALLY to the StoreKit
//     Buy/Restore modal (no Keygen recovery states exist in-store — D-02/D-14).
//
// D-04 tree-shake: a plain `IS_APPSTORE ? storeOpenProUpsell : openProUpsell`
// (value position) does NOT drop the dead arm — the conditional EXPRESSION
// references BOTH bindings, so Rollup keeps both module subtrees and the Keygen
// `proUpsell` → `@/lib/license/licenseUi` subtree folds into the store bundle (the
// exact fold-in the appstore generateBundle guard caught). The fix routes the two
// arms through a build-time `if (IS_APPSTORE)` STATEMENT instead: because
// IS_APPSTORE is a Vite compile-time constant, Rollup eliminates the dead branch,
// and a static import referenced ONLY inside an eliminated branch becomes
// unreferenced and tree-shakes out. So in the STORE build the `else` body (and its
// `openProUpsell` import → `@/lib/license/licenseUi` subtree) is dropped; in the
// DIRECT build the `if` body is dropped and `openProUpsell` runs SYNCHRONOUSLY,
// byte-behaviourally identical to before (no dynamic-import latency on the click).
//
// This keeps BOTH arms synchronous (preserving the focus-return + sync-dispatch
// contract the callers + tests rely on) while still dropping the Keygen subtree
// from the store bundle.
import { IS_APPSTORE } from "@/lib/platform/channel";
import { openProUpsell } from "./proUpsell";
import { storeOpenProUpsell } from "./storeProUpsell";

export function routeProUpsell(invokerEl?: HTMLElement | null): void {
  if (IS_APPSTORE) {
    // Store build: the unconditional StoreKit Buy/Restore surface. The `else` body
    // (and the `openProUpsell` import it is the SOLE reference to) is statically
    // eliminated here, so the Keygen `@/lib/license/licenseUi` subtree is absent
    // from the store bundle (D-04).
    storeOpenProUpsell(invokerEl);
  } else {
    // Direct build: the Keygen license-state router, called SYNCHRONOUSLY (this
    // branch survives; the `if` body — and the `storeOpenProUpsell` reference — is
    // eliminated).
    openProUpsell(invokerEl);
  }
}
