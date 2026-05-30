// Platform capability seam (FND-04, D-11). Tools reach OS capabilities ONLY
// through this module — never by importing @tauri-apps/* directly.
//
// ENVIRONMENT-SAFE (HIGH-4): there is NO top-level `import ... from "@tauri-apps/*"`
// here. The real Tauri clipboard impl (./tauri) is loaded LAZILY via a dynamic
// import, and only when we detect we are actually running inside the Tauri
// WKWebView (`__TAURI_INTERNALS__` present on window). Outside Tauri — under
// `vite preview` or jsdom/node tests — the synchronous browser fallback
// (navigator.clipboard) is used, so importing this module never pulls in Tauri.

import { browserPlatform } from "./browser";
import type { Store } from "./stub";

export type { Store };

export interface Platform {
  clipboard: {
    writeText(text: string): Promise<void>;
    readText(): Promise<string>;
  };
  /** STUB in Phase 1 (in-memory). Phase 2 (SHL-05) swaps in the real store. */
  store: Store;
}

/**
 * True only inside the Tauri WKWebView. `__TAURI_INTERNALS__` is injected by the
 * Tauri runtime; it is absent under `vite preview`, jsdom, and node — so this is
 * false in every test/fallback environment and the Tauri impl is never loaded.
 */
function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

// The active impl. Defaults to the browser fallback synchronously so consumers
// (e.g. the skeleton copy button) can use `platform` immediately; if we are in
// Tauri, `initPlatform()` swaps in the real impl after a lazy import.
let active: Platform = browserPlatform;

/** Synchronous accessor — always usable; backed by the browser fallback until
 *  the Tauri impl lazily resolves (when inside the WKWebView). Delegates per
 *  capability via getters so it can never drift from `Platform`: adding a
 *  capability to the interface flows through automatically (no per-method
 *  forwarder to keep in sync). */
export const platform: Platform = {
  get clipboard() {
    return active.clipboard;
  },
  get store() {
    return active.store;
  },
};

/**
 * Pick the platform impl for the current environment. Inside Tauri, lazily
 * `import("./tauri")` (the ONLY place @tauri-apps/* is reached); otherwise the
 * browser fallback. Returns the chosen impl.
 */
export async function createPlatform(): Promise<Platform> {
  if (isTauri()) {
    const { tauriPlatform } = await import("./tauri");
    return tauriPlatform;
  }
  return browserPlatform;
}

/** Resolve and install the environment-appropriate impl into `platform`.
 *  Call once at startup (main.tsx). No-op-safe to call repeatedly. */
export async function initPlatform(): Promise<Platform> {
  active = await createPlatform();
  return active;
}

/** Test seam (FND-04): inject a stub impl so jsdom/node tests exercise the seam
 *  WITHOUT importing @tauri-apps/*. */
export function setPlatformForTest(p: Platform): void {
  active = p;
}

/** Reset the active impl back to the browser fallback (test cleanup). */
export function resetPlatformForTest(): void {
  active = browserPlatform;
}
