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
void initPlatform().catch((err) => {
  console.error("[platform] init failed; using browser fallback:", err);
});

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error('Root element "#root" not found');

createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
