import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { initPlatform } from "@/lib/platform";
import "./index.css";

// Initialize the platform seam (FND-04). Fire-and-forget: `platform` is usable
// synchronously via the browser fallback until the real impl resolves; inside
// Tauri this swaps in the native clipboard. If the lazy Tauri import or plugin
// init rejects, surface it (don't silently stay on the browser fallback).
void initPlatform().catch((err) => {
  console.error("[platform] init failed; using browser fallback:", err);
});

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error('Root element "#root" not found');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
