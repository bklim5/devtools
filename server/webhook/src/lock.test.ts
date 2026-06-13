import { describe, it, expect } from "vitest";
import { createKeyedMutex } from "./lock.ts";

/** A promise plus its resolver, for deterministic ordering control. */
function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("createKeyedMutex", () => {
  it("serializes same-key calls: B's fn does not begin until A settles", async () => {
    const mutex = createKeyedMutex();
    const order: string[] = [];
    const gateA = deferred<void>();

    const a = mutex.withLock("order_1", async () => {
      order.push("A:start");
      await gateA.promise; // hold the lock open
      order.push("A:end");
    });

    const b = mutex.withLock("order_1", async () => {
      order.push("B:start");
    });

    // Let microtasks flush: A has started, B must NOT have started yet.
    await Promise.resolve();
    expect(order).toEqual(["A:start"]);

    gateA.resolve();
    await Promise.all([a, b]);
    expect(order).toEqual(["A:start", "A:end", "B:start"]);
  });

  it("runs different-key calls concurrently", async () => {
    const mutex = createKeyedMutex();
    const order: string[] = [];
    const gate1 = deferred<void>();

    const one = mutex.withLock("order_1", async () => {
      order.push("1:start");
      await gate1.promise; // hold order_1 open
      order.push("1:end");
    });

    const two = mutex.withLock("order_2", async () => {
      order.push("2:start");
      order.push("2:end");
    });

    // order_2 should run to completion even while order_1 is held.
    await two;
    expect(order).toEqual(["1:start", "2:start", "2:end"]);

    gate1.resolve();
    await one;
    expect(order).toEqual(["1:start", "2:start", "2:end", "1:end"]);
  });

  it("releases the lock after a rejection so later same-key calls still run", async () => {
    const mutex = createKeyedMutex();

    await expect(
      mutex.withLock("order_1", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    const result = await mutex.withLock("order_1", async () => "ok");
    expect(result).toBe("ok");
  });
});
