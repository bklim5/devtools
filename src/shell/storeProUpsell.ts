// Store-build upsell router (D-02/D-14). The store build has NO Keygen license
// states — there is no lapsed/attention "recovery form" to route a paying
// customer to (StoreKit has no offline-grace / attention / lapsed concept). So
// EVERY not-Pro trigger (sidebar "Unlock Pro", locked pin/reorder/Command
// Palette) opens the SAME StoreKit Buy/Restore upsell surface. Mirrors the Keygen
// router's signature so Plan 05's static switch can select it
// (`IS_APPSTORE ? storeOpenProUpsell : openProUpsell`). Imports ONLY openUpsell —
// NOT the Keygen license-snapshot / settings-route recovery path — so the
// recovery subtree tree-shakes out of the store bundle.
import { openUpsell } from "./upsellStore";

export function storeOpenProUpsell(invokerEl?: HTMLElement | null): void {
  openUpsell(invokerEl);
}
