import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { initPlatform } from "@/lib/platform";
import { registerSummon } from "./shell/summon";
import "./index.css";

// Kick off resolving the real platform impl (FND-04) early so the lazy
// `import("./tauri")` is in flight before first paint. The prefs hooks no longer
// depend on this completing first — loadPreferences/savePreferences each
// `await initPlatform()` themselves, so every read and write goes to the SAME
// real store regardless of timing (this preload just warms the import).
//
// Chain the NAT-01 summon registration onto the resolved init so the global
// chord is registered exactly once, AFTER the real platform impl is installed,
// without ever blocking first paint. registerSummon already awaits initPlatform
// internally (and swallows a taken-chord failure); the chain just guarantees
// ordering and keeps a single .catch for both init and summon.
void initPlatform()
  .then(() => registerSummon())
  .catch((err) => {
    console.error("[platform] init/summon failed:", err);
  });

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error('Root element "#root" not found');

createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
