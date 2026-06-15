// In-memory Store impl. Kept as the test/regression stub and the no-localStorage
// fallback. Phase 2 (SHL-05) added the real on-disk impl (Tauri plugin-store in
// tauri.ts, localStorage in browser.ts) behind this same `Store` interface; this
// in-memory Map remains the seam used by tests via setPlatformForTest. Lives in
// its own module so every impl shares one stub without duplicating it.

import type { Platform } from "./index";

export interface Store {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

/** Build a fresh in-memory store backed by a Map (one per platform impl). */
export function createStoreStub(): Store {
  const map = new Map<string, unknown>();
  return {
    get(key) {
      return Promise.resolve(map.get(key));
    },
    set(key, value) {
      map.set(key, value);
      return Promise.resolve();
    },
  };
}

/** Deterministic license arm for every non-Tauri environment (LIC-01..04,
 *  ENT-03 mirror): licensing is a Tauri-only capability, so jsdom/vite-preview
 *  NEVER touch it — status always resolves "not activated" and any mutation
 *  rejects with the same `{ code }` shape the real Tauri commands reject with.
 *  No network, no conditionals. */
export function createLicenseStub(): Platform["license"] {
  const reject = () =>
    // Same rejection shape as a serialized Rust LicenseError — callers handle
    // one contract in both environments (intentionally not an Error instance).
    Promise.reject({ code: "serviceUnreachable" as const });
  const notActivated = () =>
    Promise.resolve({ state: "notActivated" as const, hasStoredKey: false });
  return {
    status: notActivated,
    // Route-only masked-key path (D-89) — same deterministic free stub outside
    // Tauri (no Keychain, no masked key); identical contract to `status`.
    statusDetail: notActivated,
    activate: reject,
    refresh: reject,
    deactivate: reject,
  };
}
