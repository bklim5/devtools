// In-process per-key mutex (D-47: the backend runs single-instance on one box).
//
// Closes the idempotency TOCTOU: two concurrent deliveries for the same order
// both search()->null and both create()->double-mint. Serializing the critical
// section per orderId makes the second wait until the first has searched,
// created, emailed and marked — so it sees the existing license and skips.
//
// SINGLE-INSTANCE ONLY. A multi-instance deploy would need a distributed lock
// (e.g. Postgres advisory lock / Redis), not this in-memory map.

export interface KeyedMutex {
  withLock<T>(key: string, fn: () => Promise<T>): Promise<T>;
}

/** Build a keyed mutex that chains promises per key. */
export function createKeyedMutex(): KeyedMutex {
  // tail = the promise that settles when the last queued task for a key finishes.
  const tails = new Map<string, Promise<unknown>>();

  return {
    async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
      // Wait for the prior task on this key (if any) to settle before running.
      const prior = tails.get(key) ?? Promise.resolve();
      const run = prior.then(() => fn(), () => fn());
      tails.set(key, run);

      try {
        return await run;
      } finally {
        // Clean up only if we're still the tail, so the map doesn't grow
        // unbounded and a later task can start a fresh chain.
        if (tails.get(key) === run) {
          tails.delete(key);
        }
      }
    },
  };
}
