// In-memory store stub for Phase 1. The platform `store` capability is a thin
// no-op/in-memory placeholder here; Phase 2 (SHL-05) replaces it with the real
// @tauri-apps/plugin-store impl. Kept in its own module so both the Tauri and
// browser platform impls share the same stub without duplicating it.

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
