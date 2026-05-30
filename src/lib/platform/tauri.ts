// The ONLY file in the codebase allowed to import @tauri-apps/*. It is reached
// EXCLUSIVELY through a dynamic `import("./tauri")` inside index.ts, gated on a
// runtime `__TAURI_INTERNALS__` check — never via a top-level import in index.ts.
// This keeps the Tauri impl out of the vite-preview fallback bundle and out of
// jsdom/node test runs (so tests need no @tauri-apps mock).

import { writeText, readText } from "@tauri-apps/plugin-clipboard-manager";
import type { Platform } from "./index";
import { createStoreStub } from "./stub";

export const tauriPlatform: Platform = {
  clipboard: {
    writeText: (text: string) => writeText(text),
    readText: () => readText(),
  },
  // store is a Phase-1 stub; Phase 2 (SHL-05) swaps in @tauri-apps/plugin-store.
  store: createStoreStub(),
};
