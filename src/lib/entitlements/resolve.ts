// The single environment-split entitlement resolution point (ENT-03).
//
// Mirrors the platform seam's Tauri detection (src/lib/platform/index.ts) so
// the gate and the capability seam can never disagree about the environment.

import { loadPreferences } from "@/shell/prefsStore";
import { FREE_SET, FULL_SET, type EntitlementSet } from "./entitlements";

/** True only inside the Tauri WKWebView (same check as src/lib/platform). */
export function isTauriEnv(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** ENT-03 — THE single resolution point. Phase 18: in-Tauri default =
 *  everything unlocked (shipped behavior unchanged); browser/jsdom/vite-preview =
 *  deterministic free tier (tests never touch licensing). Phase 21 swaps the
 *  Tauri arm for the Rust `license_status` command — flip HERE and nowhere else.
 *  The D-31 override is DOWNGRADE-ONLY: it can force FREE, never add entitlements. */
export async function resolveEntitlements(): Promise<EntitlementSet> {
  const base = isTauriEnv() ? FULL_SET : FREE_SET;
  const prefs = await loadPreferences(); // awaits initPlatform() internally — store-race safe
  return prefs.entitlementsOverride === "free" ? FREE_SET : base;
}
