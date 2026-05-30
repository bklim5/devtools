// resolveStartupTool — the SINGLE seam deciding which tool the app opens into
// (SHL-06, D-12/13/14). Centralising the precedence in ONE pure function means a
// future "default tool" preference (D-12) is a single edit here, not scattered
// conditionals across the router.
//
// Precedence (highest first):
//   1. explicit `target`  — a `#/tools/<id>` deep-link / future summon (D-14)
//   2. `lastUsedId`       — restore the last-used tool (D-13 happy path)
//   3. HERO_TOOL_ID       — first run, or any invalid id falls through (D-12)
//
// SECURITY (threats T-02-07 deep-link, T-02-08 persisted prefs): both `target`
// and `lastUsedId` are UNTRUSTED. We validate each through `getToolById` — which
// searches ENABLED_TOOLS only — BEFORE returning it, so a disabled/removed/
// unknown id (e.g. `#/tools/evil`) is silently ignored and never navigated to.
// The function therefore can only ever return a real, enabled tool id.

import { getToolById } from "@/lib/tools/registry";

/** First-run / fallback tool: the schema-less Protobuf decoder hero (D-12).
 *  A future default-tool preference reads its value here instead of this const. */
export const HERO_TOOL_ID = "protobuf-decoder";

export function resolveStartupTool(
  target: string | undefined,
  lastUsedId: string | undefined | null,
): string {
  if (target && getToolById(target)) return target; // D-14 explicit override
  if (lastUsedId && getToolById(lastUsedId)) return lastUsedId; // D-13 restore
  return HERO_TOOL_ID; // D-12 first-run / invalid-id fallback
}
