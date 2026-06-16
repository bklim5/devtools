// React hook over the shared upsell-modal open-state store. The shell mount
// (App.tsx) reads this to project the single UpsellModal; openers (Sidebar
// footer + locked affordances, the ⌘K free-tier License command) call the
// store's openUpsell() directly. Mirrors useLicenseUi / useEntitlements (the
// established useSyncExternalStore hook placement convention).
import { useSyncExternalStore } from "react";
import { getUpsellOpen, subscribeUpsell } from "./upsellStore";

export function useUpsellOpen(): boolean {
  return useSyncExternalStore(subscribeUpsell, getUpsellOpen);
}
