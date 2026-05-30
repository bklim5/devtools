// The ONLY file in the codebase allowed to import @tauri-apps/*. It is reached
// EXCLUSIVELY through a dynamic `import("./tauri")` inside index.ts, gated on a
// runtime `__TAURI_INTERNALS__` check — never via a top-level import in index.ts.
// This keeps the Tauri impl out of the vite-preview fallback bundle and out of
// jsdom/node test runs (so tests need no @tauri-apps mock).

import { writeText, readText } from "@tauri-apps/plugin-clipboard-manager";
import { load } from "@tauri-apps/plugin-store";
import type { Platform } from "./index";
import type { Store } from "./stub";

/**
 * Real on-disk Store impl (SHL-05, D-09), backed by @tauri-apps/plugin-store.
 * `load()` returns a LazyStore that resolves the underlying store on first use;
 * we resolve it ONCE at module scope and delegate get/set behind the unchanged
 * `Store` interface. `autoSave: true` debounces disk writes off the hot path
 * (RESEARCH Pitfall 5 / threat T-02-04). Gated at runtime by the `store:default`
 * capability (Pitfall 2). This is the ONLY file allowed to import @tauri-apps/*.
 */
function createTauriStore(): Store {
  // `defaults: {}` is required by this plugin version's StoreOptions; an empty
  // map means "no seeded keys" (unset keys read back as undefined, matching the
  // Store contract). `autoSave: true` debounces disk writes (100ms default).
  const ready = load("prefs.json", { defaults: {}, autoSave: true });
  return {
    async get(key: string): Promise<unknown> {
      return (await ready).get(key);
    },
    async set(key: string, value: unknown): Promise<void> {
      await (await ready).set(key, value);
    },
  };
}

export const tauriPlatform: Platform = {
  clipboard: {
    writeText: (text: string) => writeText(text),
    readText: () => readText(),
  },
  store: createTauriStore(),
};
