import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { initPlatform } from "./lib/platform";
import "./index.css";

// Resolve the environment-appropriate platform impl before first paint: inside
// the Tauri WKWebView this lazily loads the real clipboard impl; under vite
// preview it stays on the navigator.clipboard browser fallback. Fire-and-forget
// — `platform` is usable synchronously (browser fallback) until this resolves.
void initPlatform();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
