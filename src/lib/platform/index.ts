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
  /** Native window summon/focus control (NAT-01). No-op in the browser fallback. */
  window: {
    show(): Promise<void>;
    setFocus(): Promise<void>;
    unminimize(): Promise<void>;
    minimize(): Promise<void>;
    isVisible(): Promise<boolean>;
  };
  /** OS-level global hotkey register/unregister (NAT-01). No-op in the browser fallback. */
  nativeShortcut: {
    register(accelerator: string, handler: () => void): Promise<void>;
    unregister(accelerator: string): Promise<void>;
    isRegistered(accelerator: string): Promise<boolean>;
  };
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

// Memoised init promise: the FIRST caller resolves the environment impl and every
// later caller awaits the SAME promise. This is what lets prefsStore.load/save
// `await initPlatform()` cheaply on every read/write so they can never run
// against the browser fallback before the real Tauri store is installed (the
// packaged-app "reads localStorage, writes prefs.json" split-brain bug).
let initPromise: Promise<Platform> | null = null;

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
  get window() {
    return active.window;
  },
  get nativeShortcut() {
    return active.nativeShortcut;
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
 *  Memoised: the chosen impl is resolved exactly once and every caller awaits the
 *  same promise, so it is cheap to `await` on every prefs read/write. */
export async function initPlatform(): Promise<Platform> {
  initPromise ??= createPlatform().then((p) => {
    active = p;
    return p;
  });
  return initPromise;
}

/** True under vitest or a dev build — never in a production bundle. Guards the
 *  test seam so production code can't silently swap capability routing. */
function isTestOrDev(): boolean {
  // `import.meta.env` is defined by Vite/vitest; MODE is "test" under vitest,
  // "development" under `vite dev`, and "production" in the shipped bundle.
  const env = (import.meta as { env?: { MODE?: string; DEV?: boolean } }).env;
  return env?.MODE === "test" || env?.DEV === true;
}

/** Test seam (FND-04): inject a stub impl so jsdom/node tests exercise the seam
 *  WITHOUT importing @tauri-apps/*. Also seeds the memoised init promise so code
 *  that `await initPlatform()` (e.g. prefsStore) resolves to the INJECTED stub
 *  rather than re-resolving the browser fallback. No-op outside test/dev builds. */
export function setPlatformForTest(p: Platform): void {
  if (!isTestOrDev()) return;
  active = p;
  initPromise = Promise.resolve(p);
}

/** Reset the active impl back to the browser fallback (test cleanup).
 *  No-op outside test/dev builds. */
export function resetPlatformForTest(): void {
  if (!isTestOrDev()) return;
  active = browserPlatform;
  initPromise = null;
}
