// D-04 static switch for the Sidebar footer's "License needs attention" hint.
//
// The hint surfaces ONLY the Keygen license-recovery states (problem /
// refreshNeeded) — concepts that DO NOT EXIST in the store build (StoreKit has no
// lapsed/attention/foreign-machine state). The direct arm reads the Keygen
// license-UI snapshot via useLicenseUi (which statically imports
// @/lib/license/licenseUi); the store arm is a no-op hook that returns false and
// imports NOTHING from the license subtree.
//
// Selecting the impl at a single module-level IS_APPSTORE ternary makes the direct
// arm (and its @/lib/license/licenseUi import) statically UNREACHABLE in the store
// build, so Rollup tree-shakes the Keygen license-UI module out of the appstore
// bundle (D-04 — the fold-in the appstore generateBundle guard otherwise catches).
// The Sidebar ships in BOTH builds and called useLicenseUi() unconditionally, which
// is exactly what pulled licenseUi into the store bundle before this seam.
//
// Both arms are hooks (always called once per render — Rules of Hooks safe); only
// which one is wired in is decided at build time.
import { IS_APPSTORE } from "@/lib/platform/channel";
import { useLicenseUi } from "./useLicenseUi";

/** Direct build: the footer attention hint reflects the Keygen recovery states. */
function useLicenseAttentionDirect(): boolean {
  const state = useLicenseUi().state;
  return state === "problem" || state === "refreshNeeded";
}

/** Store build: no Keygen license states exist — the hint is never shown, and the
 *  license-UI module is never imported (the no-op hook keeps Rules-of-Hooks happy). */
function useLicenseAttentionStore(): boolean {
  return false;
}

export const useLicenseAttention: () => boolean = IS_APPSTORE
  ? useLicenseAttentionStore
  : useLicenseAttentionDirect;
