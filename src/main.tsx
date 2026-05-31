import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { initPlatform } from "@/lib/platform";
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
void initPlatform().catch((err) => {
  console.error("[platform] init failed:", err);
});

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error('Root element "#root" not found');

createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
