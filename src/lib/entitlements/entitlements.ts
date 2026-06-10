// Entitlement vocabulary + predicates — the central gating seam (ENT-01/ENT-02).
//
// ONE vocabulary covers both tool-level gates (`requiredEntitlements` on
// ToolDefinition) and app-level gates (theming, ordering/pinning). Every
// surface (sidebar, palette, router, prefs apply) consumes ONLY these
// predicates — no scattered checks. The strings are embedded later in the
// Keygen license (Phase 21); keep them stable.

import type { ToolDefinition } from "@/lib/tools/types";
import { DEFAULT_PREFERENCES, type Preferences } from "@/shell/preferences";

export const ENT_THEMING = "pro.theming";
export const ENT_ORDERING = "pro.ordering"; // covers reorder + pin + reset (ONE arrangement feature, D-26/D-28)

/** Every entitlement the FULL tier resolves to (Phase 21: comes from machine.lic). */
export const ALL_ENTITLEMENTS: readonly string[] = [ENT_THEMING, ENT_ORDERING];

export type EntitlementSet = ReadonlySet<string>;
export const FULL_SET: EntitlementSet = new Set(ALL_ENTITLEMENTS);
export const FREE_SET: EntitlementSet = new Set();

export function isEntitled(
  set: EntitlementSet,
  required: readonly string[],
): boolean {
  return required.every((e) => set.has(e));
}

/** ENT-01: the ONE predicate all three surfaces (sidebar, palette, router) consume. */
export function isToolLocked(tool: ToolDefinition, set: EntitlementSet): boolean {
  return !!tool.requiredEntitlements?.length && !isEntitled(set, tool.requiredEntitlements);
}

/** D-26/D-27: the prefs-APPLY seam — a pure render-time VIEW of effective
 *  preferences. Stored values are NEVER touched; unlocking restores instantly. */
export function gatePreferences(prefs: Preferences, ents: EntitlementSet): Preferences {
  return {
    ...prefs,
    ...(ents.has(ENT_THEMING)
      ? {}
      : { theme: DEFAULT_PREFERENCES.theme, accent: DEFAULT_PREFERENCES.accent }),
    ...(ents.has(ENT_ORDERING) ? {} : { toolOrder: [], pinnedToolIds: [] }),
  };
}
