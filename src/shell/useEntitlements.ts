// React hook over the entitlements snapshot store (ENT-03). Every consumer
// (sidebar, palette, router gate, prefs apply) reads the resolved set ONLY
// through this hook, so a flip via refreshEntitlements() propagates everywhere.
import { useSyncExternalStore } from "react";
import {
  getEntitlementsResolved,
  getEntitlementsSnapshot,
  subscribeEntitlements,
} from "@/lib/entitlements/store";
import type { EntitlementSet } from "@/lib/entitlements/entitlements";

export function useEntitlements(): EntitlementSet {
  return useSyncExternalStore(subscribeEntitlements, getEntitlementsSnapshot);
}

/** Whether the first entitlement resolution has completed (D-23-5). Reuses the
 *  SAME subscribeEntitlements channel (the resolved flip notifies subscribers) so
 *  useAppearance can hold the flash-free apply gate until entitlements are known. */
export function useEntitlementsResolved(): boolean {
  return useSyncExternalStore(subscribeEntitlements, getEntitlementsResolved);
}
