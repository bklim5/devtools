import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { initPlatform } from "@/lib/platform";
import { refreshEntitlements } from "@/lib/entitlements/store";
import { refreshLicenseUi } from "@/lib/license/licenseUi";
import "./index.css";

// Kick off resolving the real platform impl (FND-04) early so the lazy
// `import("./tauri")` is in flight before first paint. The prefs hooks no longer
// depend on this completing first — loadPreferences/savePreferences each
// `await initPlatform()` themselves, so every read and write goes to the SAME
// real store regardless of timing (this preload just warms the import).
//
// NAT-01 summon is NOT auto-registered at startup (Phase-5 decision G-05-1):
// macOS gives no reliable "is this chord taken?" API, so any hardcoded global
// chord either fails silently (the default Cmd+Shift+D collided with a system
// shortcut) or shadows one of the user's own shortcuts. Summon ships this
// milestone via the tray "Show DevTools" menu + single-instance focus instead.
// The platform seam (platform.nativeShortcut) and shell/summon.ts registration
// path are kept intact for a future Settings phase to reuse as an explicit opt-in.
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

// LIC-06/D-43: one startup license-status refresh so the footer hint can show
// a "needs attention" state without any panel visit. This is a LOCAL file read
// + Ed25519 verify only — no network at launch, ever (D-45; the v1.6 amendment
// forbids launch-time network — the phase's only network call is the
// user-initiated activate inside the panel). Non-blocking: first paint never
// waits on it.
void refreshLicenseUi().catch((err) => {
  console.error("[license] status refresh failed:", err);
});

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error('Root element "#root" not found');

createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
