// @vitest-environment jsdom
// (jsdom provides a real localStorage so the browser Store impl is exercised
// directly; the default test env is node, where localStorage is absent.)
//
// Store-seam tests (SHL-05, D-09). Cover the browser/localStorage Store impl and
// the in-memory stub regression guard. This file MUST NOT import @tauri-apps/* —
// the jsdom run must never pull Tauri in (that import lives only in tauri.ts,
// reached via a dynamic import gated on __TAURI_INTERNALS__). The Tauri
// plugin-store path is exercised by the real-webview UI gate, not unit tests.
import { afterEach, describe, expect, it } from "vitest";
import { createLocalStorageStore } from "./browser";
import { createStoreStub } from "./stub";

afterEach(() => {
  // jsdom provides a real localStorage; clear it between tests so keys don't leak.
  if (typeof localStorage !== "undefined") localStorage.clear();
});

describe("localStorage-backed store", () => {
  it("round-trips objects via JSON serialisation (deep-equal)", async () => {
    const store = createLocalStorageStore();
    await store.set("k", { a: 1, nested: [1, 2, 3] });
    await expect(store.get("k")).resolves.toEqual({ a: 1, nested: [1, 2, 3] });
  });

  it("returns undefined (not null, not a throw) for an unset key", async () => {
    const store = createLocalStorageStore();
    await expect(store.get("missing")).resolves.toBeUndefined();
  });

  it("degrades a corrupted/non-JSON stored value to undefined (Tampering)", async () => {
    // Treat persisted values as untrusted input (threat T-02-02): a user-edited
    // prefs entry that is not valid JSON must yield undefined, never throw.
    const store = createLocalStorageStore();
    // Write a raw, non-JSON value directly under the namespaced key.
    localStorage.setItem("devtools:bad", "{ not json ]");
    await expect(store.get("bad")).resolves.toBeUndefined();
  });
});

describe("in-memory store stub (regression guard — kept for tests)", () => {
  it("still round-trips get/set", async () => {
    const stub = createStoreStub();
    await expect(stub.set("k", 42)).resolves.toBeUndefined();
    await expect(stub.get("k")).resolves.toBe(42);
    await expect(stub.get("missing")).resolves.toBeUndefined();
  });
});
