// React hook over the entitlements snapshot store (ENT-03). Every consumer
// (sidebar, palette, router gate, prefs apply) reads the resolved set ONLY
// through this hook, so a flip via refreshEntitlements() propagates everywhere.
import { useSyncExternalStore } from "react";
import {
  getEntitlementsSnapshot,
  subscribeEntitlements,
} from "@/lib/entitlements/store";
import type { EntitlementSet } from "@/lib/entitlements/entitlements";

export function useEntitlements(): EntitlementSet {
  return useSyncExternalStore(subscribeEntitlements, getEntitlementsSnapshot);
}
