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

/** Shape returned by `updater.check()` when a newer version is available (DST-02).
 *  Mapped from the plugin's `Update` so the shell never touches @tauri-apps types. */
export interface UpdateInfo {
  version: string;
  notes: string | null;
  date: string | null;
}

/** Problem kinds for a stored-but-unusable machine.lic — mirrors the Rust
 *  serde contract pinned in src-tauri/src/license/mod.rs (LIC-06). */
export type LicenseProblem =
  | "corrupt"
  | "tampered"
  | "foreignMachine"
  | "unsupportedAlg";

/** License status union — EXACT mirror of the serde-pinned camelCase JSON the
 *  Rust commands return (do not invent fields; `hasStoredKey` is the ONLY
 *  Keychain-derived value JS ever sees — LIC-04/T-19-10). */
export type LicenseStatusPayload =
  | { state: "notActivated"; hasStoredKey: boolean }
  | { state: "licensed"; expiry: string | null; entitlements: string[] }
  | { state: "problem"; problem: LicenseProblem; hasStoredKey: boolean };

/** Typed license error codes. Tauri rejects command errors with the serialized
 *  `{ code: LicenseErrorCode }` object — the webview copy layer (Plan 04) maps
 *  these to messages; Rust never sends prose (D-36/D-37/D-38). */
export type LicenseErrorCode =
  | "seatLimit"
  | "offline"
  | "serviceUnreachable"
  | "invalidKey"
  | "suspended"
  | "activationFailed"
  | "noStoredKey"
  | "licenseProblem";

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
  /** Auto-updater (DST-02, D-12). check() resolves null when up-to-date/unavailable;
   *  downloadAndInstall() verifies the minisign signature internally then relaunches.
   *  No-op (check→null) in the browser fallback so jsdom/vite preview never call the network. */
  updater: {
    check(): Promise<UpdateInfo | null>;
    downloadAndInstall(onProgress?: (pct: number) => void): Promise<void>;
  };
  /** App-internal tray/menu events (DST-02). `onMenuCheckUpdates` subscribes the
   *  shell to the tray's `menu://check-updates` event (emitted by the Rust side,
   *  06-03) so the JS shell can run a MANUAL check via the updater seam — the
   *  actual `listen` lives ONLY in tauri.ts (D-12), never in the shell. Returns an
   *  unsubscribe fn. No-op (never fires) in the browser fallback. */
  events: {
    onMenuCheckUpdates(handler: () => void): Promise<() => void>;
  };
  /** Licensing (LIC-01..04). The webview reaches the 4 Rust commands ONLY
   *  through this capability; key material never returns to JS. Rejections
   *  carry the serialized `{ code: LicenseErrorCode }` object untransformed.
   *  Browser/test arms are deterministic: status -> notActivated, mutations
   *  reject serviceUnreachable — never a network call (ENT-03 mirror). */
  license: {
    /** Pure-local status (file read + Ed25519 verify) — never network (D-45). */
    status(): Promise<LicenseStatusPayload>;
    /** One-time online activation — the phase's ONLY network call. `null` key
     *  => Rust uses the Keychain-stored key (D-44, LIC-04-safe). */
    activate(key: string | null): Promise<LicenseStatusPayload>;
    /** TTL refresh primitive — callable; UI wiring is Phase 21. */
    refresh(): Promise<LicenseStatusPayload>;
    /** Seat-transfer primitive — callable-but-unwired this phase. */
    deactivate(): Promise<LicenseStatusPayload>;
  };
  /** Open an external URL in the OS default browser (PAY-01, D-67). https-only
   *  (capability-scoped). No-op in the browser/test fallback — NEVER navigates
   *  jsdom/vite-preview. Only tauri.ts reaches the opener plugin. */
  opener: {
    openUrl(url: string): Promise<void>;
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
  get updater() {
    return active.updater;
  },
  get events() {
    return active.events;
  },
  get license() {
    return active.license;
  },
  get opener() {
    return active.opener;
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
