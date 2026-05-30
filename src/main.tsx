import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { initPlatform } from "@/lib/platform";
import { loadPreferences } from "@/shell/prefsStore";
import "./index.css";

// Initialize the platform seam (FND-04), THEN warm the prefs store so the
// startup redirect resolves against the REAL last-used value (Pitfall 3): inside
// Tauri the real store impl must be installed (initPlatform) before any get()
// reads persisted prefs. Render happens regardless (StartupRedirect awaits the
// same async load via usePreferences and holds first paint until prefs resolve),
// so this preload only ensures the seam is on the real impl before that read.
void initPlatform()
  .then(() => loadPreferences())
  .catch((err) => {
    console.error("[platform] init failed; using browser fallback:", err);
  });

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error('Root element "#root" not found');

createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
