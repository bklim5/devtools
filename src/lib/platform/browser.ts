// Browser-fallback platform impl. Used when the app is NOT running inside the
// Tauri WKWebView (e.g. `vite preview` for the HRN-02 fallback UI gate, or jsdom
// tests). Clipboard routes to navigator.clipboard so the skeleton's copy button
// works outside Tauri. This file must NOT import @tauri-apps/* — that import
// lives ONLY in tauri.ts, reached via a dynamic import from index.ts.

import type { Platform } from "./index";
import { createStoreStub, type Store } from "./stub";

/** Namespace persisted keys so the app's prefs never collide with anything else
 *  sharing the origin's localStorage (e.g. under `vite preview`). */
const NS = "devtools:";

/**
 * Browser/dev Store impl backed by localStorage (D-09 fallback). Values are
 * JSON-serialised so objects/arrays round-trip. Persisted values are treated as
 * UNTRUSTED (threat T-02-02): a corrupt/non-JSON entry yields `undefined` from
 * `get` rather than throwing. When localStorage is absent (jsdom-without-storage,
 * node), falls back to the in-memory stub so the seam never throws. This file
 * must NOT import @tauri-apps/* — that import lives only in tauri.ts.
 */
export function createLocalStorageStore(): Store {
  if (typeof localStorage === "undefined") return createStoreStub();
  return {
    async get(key: string): Promise<unknown> {
      const raw = localStorage.getItem(NS + key);
      if (raw == null) return undefined;
      try {
        return JSON.parse(raw);
      } catch {
        return undefined;
      }
    },
    async set(key: string, value: unknown): Promise<void> {
      localStorage.setItem(NS + key, JSON.stringify(value));
    },
  };
}

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
  store: createLocalStorageStore(),
  // Harmless no-ops outside Tauri (NAT-01, threat T-05-05): the seam must never
  // throw under vite preview / jsdom. `isVisible` resolves true (there is no
  // hidden window to summon in the browser); `isRegistered` resolves false (no
  // OS shortcut is ever registered). This file must NOT import @tauri-apps/*.
  window: {
    async show(): Promise<void> {},
    async setFocus(): Promise<void> {},
    async unminimize(): Promise<void> {},
    async minimize(): Promise<void> {},
    async isVisible(): Promise<boolean> {
      return true;
    },
  },
  nativeShortcut: {
    async register(): Promise<void> {},
    async unregister(): Promise<void> {},
    async isRegistered(): Promise<boolean> {
      return false;
    },
  },
  // Updater no-op outside Tauri (DST-02, D-12): check resolves null (no update,
  // no network call ever — preserves offline-by-design in jsdom/vite preview);
  // downloadAndInstall resolves without doing anything. This file must NOT
  // import @tauri-apps/*.
  updater: {
    async check() {
      return null;
    },
    async downloadAndInstall() {},
  },
  // Tray/menu events no-op outside Tauri (DST-02): the `menu://check-updates`
  // event never fires in the browser/jsdom, so the subscription is inert and the
  // returned unsubscribe is a no-op. This file must NOT import @tauri-apps/*.
  events: {
    async onMenuCheckUpdates() {
      return () => {};
    },
  },
};
