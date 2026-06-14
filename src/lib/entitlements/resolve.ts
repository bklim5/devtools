// The single environment-split entitlement resolution point (ENT-03).
//
// Mirrors the platform seam's Tauri detection (src/lib/platform/index.ts) so
// the gate and the capability seam can never disagree about the environment.

import { platform } from "@/lib/platform";
import { loadPreferences } from "@/shell/prefsStore";
import {
  ALL_ENTITLEMENTS,
  FREE_SET,
  FULL_SET,
  type EntitlementSet,
} from "./entitlements";

/** True only inside the Tauri WKWebView (same check as src/lib/platform). */
export function isTauriEnv(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Map a license-status payload to the resolved entitlement base (D-85).
 *  Pro-active states (`licensed`/`offlineGrace`) carry the cert's `entitlements`
 *  string[]; the rest are free. The cert entitlements are INTERSECTED with
 *  ALL_ENTITLEMENTS so an unexpected/forged code can never unlock more than the
 *  two defined entitlements (T-21-12 over-grant). Non-Pro states
 *  (`notActivated`/`refreshNeeded`/`problem`) resolve to FREE_SET. */
function baseFromLicense(
  status: Awaited<ReturnType<typeof platform.license.status>>,
): EntitlementSet {
  if (status.state === "licensed" || status.state === "offlineGrace") {
    return new Set(status.entitlements.filter((e) => ALL_ENTITLEMENTS.includes(e)));
  }
  return FREE_SET;
}

/** ENT-03 — THE single resolution point. Phase 18 shipped an in-Tauri "everything
 *  unlocked" default; the **Phase 21 flip is LIVE** — the Tauri arm now reads the
 *  Rust `license_status` command (was hardcoded `FULL_SET`), so an unlicensed
 *  in-Tauri install actually locks theming + ordering/pinning (all 11 tools stay
 *  free). Browser/jsdom/vite-preview stay deterministically free (the status stub
 *  returns notActivated → FREE_SET — tests never touch licensing). Flip HERE and
 *  nowhere else.
 *
 *  The D-31 override is DOWNGRADE-ONLY in production: `"free"` forces FREE_SET, and
 *  nothing stored can ever UPGRADE past the environment base (T-18-10 / T-21-15 prod
 *  invariant). The single exception is the DEV-only `"full"` value: under
 *  `import.meta.env.DEV` (tree-shaken statically-false out of every release bundle)
 *  it resolves to FULL_SET so the dev/e2e harness can reach Pro after the D-85 flip
 *  made an unlicensed in-Tauri install resolve FREE. In a release build the coercer
 *  already nulls `"full"` (prefsStore.ts), and this branch is shaken out — the
 *  override stays strictly downgrade-only in prod. */
export async function resolveEntitlements(): Promise<EntitlementSet> {
  // Outside Tauri: deterministic free, no licensing/network path (jsdom/preview).
  // Inside Tauri: the live license_status (pure-local file read + Ed25519 verify,
  // D-45 — never network) drives the base entitlement set.
  const base = isTauriEnv()
    ? baseFromLicense(await platform.license.status())
    : FREE_SET;
  const prefs = await loadPreferences(); // awaits initPlatform() internally — store-race safe
  if (prefs.entitlementsOverride === "free") return FREE_SET; // downgrade-only (all builds)
  // DEV-only Pro override (e2e/dev harness). Statically false in production →
  // tree-shaken; the coercer also nulls "full" in prod, so this can never unlock
  // a release build (the prod downgrade-only invariant holds).
  if (import.meta.env.DEV && prefs.entitlementsOverride === "full") return FULL_SET;
  return base;
}
