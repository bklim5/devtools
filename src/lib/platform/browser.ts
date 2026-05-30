// Browser-fallback platform impl. Used when the app is NOT running inside the
// Tauri WKWebView (e.g. `vite preview` for the HRN-02 fallback UI gate, or jsdom
// tests). Clipboard routes to navigator.clipboard so the skeleton's copy button
// works outside Tauri. This file must NOT import @tauri-apps/* — that import
// lives ONLY in tauri.ts, reached via a dynamic import from index.ts.

import type { Platform } from "./index";
import { createStoreStub } from "./stub";

export const browserPlatform: Platform = {
  clipboard: {
    async writeText(text: string): Promise<void> {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
      // No secure-context clipboard available (e.g. non-https jsdom). No-op so
      // the skeleton never throws when copy is unavailable outside Tauri.
    },
    async readText(): Promise<string> {
      if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
        return navigator.clipboard.readText();
      }
      return "";
    },
  },
  store: createStoreStub(),
};
