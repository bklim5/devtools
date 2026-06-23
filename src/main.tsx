import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { initPlatform } from "@/lib/platform";
import { IS_APPSTORE } from "@/lib/platform/channel";
import { refreshEntitlements } from "@/lib/entitlements/store";
import { mountStoreBoot } from "@/shell/storeBoot";
import {
  ensurePreferencesLoaded,
  getPreferencesLoaded,
  getSharedPreferences,
  subscribePreferences,
} from "@/shell/usePreferences";
import { registerSummon } from "@/shell/summon";
import { revealOnStartup } from "@/shell/startupReveal";
import "./index.css";

// Kick off resolving the real platform impl (FND-04) early so the lazy
// `import("./tauri")` is in flight before first paint. The prefs hooks no longer
// depend on this completing first — loadPreferences/savePreferences each
// `await initPlatform()` themselves, so every read and write goes to the SAME
// real store regardless of timing (this preload just warms the import).
//
// DST-02 (Phase 6) — the post-init action that slot now carries is the updater
// LAUNCH CHECK, but it is co-located in App.tsx's mount effect (gated on
// `prefsLoaded` + `shouldAutoCheck(autoUpdateCheck)`) rather than here: that keeps
// it next to the banner/opt-in state it drives and avoids a cross-module event
// just for launch. The constraint it enforces — NO automatic network call unless
// the user opted in (offline-by-design, T-06-11), and first paint never blocked —
// holds because the check is non-blocking and only fires when shouldAutoCheck is
// true (false/null make no call). This warm-up just keeps the lazy tauri import
// in flight; the prefs hooks each await initPlatform() themselves.
void initPlatform().catch((err) => {
  console.error("[platform] init failed:", err);
});

// ENT-03: kick off resolving the entitlement set (folds in the persisted D-31
// override) beside the platform warm-up so it lands before/shortly after first
// paint. Non-blocking — first paint never waits on it; the store's synchronous
// environment default already matches the resolved set when no override exists.
void refreshEntitlements().catch((err) => {
  console.error("[entitlements] refresh failed:", err);
});

// The licensing boot work, split STATICALLY by build channel (D-04). Extracted
// into an exported fn so the boot-gate is unit-testable (main.test.tsx) without
// re-running the createRoot render below. Called once at module load.
//
// CRITICAL (D-04): the store build must NEVER statically import
// `@/lib/license/licenseUi` (it calls platform.license.status() — the Keygen
// direct-channel path forbidden in the App Store build, guideline 3.1.1). The
// top-level import is REMOVED; refreshLicenseUi is reached ONLY via a dynamic
// branch-local import of the licenseUi module inside the `!IS_APPSTORE` arm below.
// Because
// IS_APPSTORE is a Vite build-time constant, the store build inlines it `true`,
// drops the `else` arm as dead code, and the dynamic import (its only reference)
// makes the whole licenseUi subtree statically unreachable — it tree-shakes out
// of the store bundle (T-28-22; the D-03 copy-string grep can't catch a stale
// import of this module, so the gate must be structural). The direct build
// inlines `false`, drops the `if` arm (mountStoreBoot + its iap subtree), and
// runs refreshLicenseUi exactly as before — byte-behaviourally unchanged.
export function runBoot(): void {
  if (IS_APPSTORE) {
    // Store build: the ONLY licensing boot work is the StoreKit path.
    // refreshEntitlements() above already does the passive currentEntitlements
    // read (D-08); mountStoreBoot subscribes the live refund/approval listener so
    // a purchase unlocks and a refund/revoke drops Pro live, no relaunch (D-06).
    // platform.license.status() is NEVER imported or called here (D-04).
    void mountStoreBoot().catch((err) => {
      console.error("[iap] store boot listener failed:", err);
    });
  } else {
    // Direct build only (LIC-06/D-43): one startup license-status refresh so the
    // footer hint can show a "needs attention" state without any panel visit — a
    // LOCAL file read + Ed25519 verify only, no launch-time network (D-45).
    // Lazily imported so @/lib/license/licenseUi is statically UNREACHABLE from
    // the store bundle (the import lives only in this dead-in-store branch).
    // Non-blocking: first paint never waits on it.
    void import("@/lib/license/licenseUi")
      .then(({ refreshLicenseUi }) => refreshLicenseUi())
      .catch((err) => {
        console.error("[license] status refresh failed:", err);
      });
  }
}

runBoot();

// NAT-01/G-05-1 PROMOTED (Phase 24): register the persisted summon chord at
// startup AND reveal the window unless start-in-tray is on — both behind the
// prefs-load gate (Pitfall 4 / tauri-store-async-init-race). The summon chord is
// now configurable (Hotkeys pane) and the start-in-tray no-flash contract is
// honored at the native layer (lib.rs drops the window-state VISIBLE auto-show),
// so this webview reveal is the SOLE normal-launch reveal (D-24-8/9).
//
// We gate on getPreferencesLoaded() so the PERSISTED chord registers, never the
// default-then-real double-register (T-24-06): act only once the async prefs load
// resolves. A one-shot latch fires runStartup exactly once and unsubscribes.
let startupFired = false;
const runStartup = () => {
  if (startupFired || !getPreferencesLoaded()) return; // wait for the async load
  startupFired = true;
  unsubStartup();
  const prefs = getSharedPreferences();
  void registerSummon(prefs.summonChord); // prefs-driven, non-fatal at startup
  void revealOnStartup(prefs); // sole reveal unless start-in-tray (D-24-8/9)
};
ensurePreferencesLoaded();
const unsubStartup = subscribePreferences(runStartup);
runStartup(); // in case the load already resolved synchronously

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error('Root element "#root" not found');

createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
