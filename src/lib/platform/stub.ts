// In-memory Store impl. Kept as the test/regression stub and the no-localStorage
// fallback. Phase 2 (SHL-05) added the real on-disk impl (Tauri plugin-store in
// tauri.ts, localStorage in browser.ts) behind this same `Store` interface; this
// in-memory Map remains the seam used by tests via setPlatformForTest. Lives in
// its own module so every impl shares one stub without duplicating it.

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
