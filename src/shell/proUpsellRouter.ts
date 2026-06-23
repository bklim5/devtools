// The SINGLE static switch point (D-01) selecting the Pro-upsell router for the
// not-Pro triggers (free ⌘K, locked pin/reorder/Alt+P/Reset, free Appearance Save).
// Both routers share the exact signature `(invokerEl?) => void`:
//
//   • direct build  → openProUpsell      — routes by Keygen license state (a free
//     user gets the pitch modal; a lapsed/attention PAYING customer gets the
//     Settings ▸ License recovery form, never the pitch — D-44).
//   • store build   → storeOpenProUpsell — routes UNCONDITIONALLY to the StoreKit
//     Buy/Restore modal (no Keygen recovery states exist in-store — D-02/D-14).
//
// Because IS_APPSTORE is a Vite build-time constant, this ternary tree-shakes the
// dead arm + its import subtree out of each bundle: the store build drops the
// Keygen `getLicenseUiSnapshot`/`openSettings` recovery path; the direct build
// drops nothing it didn't already ship. Putting the switch HERE (one place) is
// cleaner than three inline ternaries at the three call sites, and is still fully
// static-tree-shakeable (the unused arm is never referenced at runtime).
import { IS_APPSTORE } from "@/lib/platform/channel";
import { openProUpsell } from "./proUpsell";
import { storeOpenProUpsell } from "./storeProUpsell";

export const routeProUpsell: (invokerEl?: HTMLElement | null) => void =
  IS_APPSTORE ? storeOpenProUpsell : openProUpsell;
