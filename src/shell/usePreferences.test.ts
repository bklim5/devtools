// @vitest-environment jsdom
// usePreferences round-trips theme/accent/lastUsedId through the REAL Store seam
// (via setPlatformForTest + the in-memory stub) and falls back to defaults on a
// corrupt/absent blob (untrusted-store mitigation, threat T-02-08). No
// @tauri-apps import anywhere.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import {
  platform,
  resetPlatformForTest,
  setPlatformForTest,
  type Store,
} from "@/lib/platform";
import { createStoreStub } from "@/lib/platform/stub";
import { usePreferences } from "./usePreferences";
import { DEFAULT_PREFERENCES, PREFERENCES_STORE_KEY } from "./preferences";
import { makeMemoryPlatform } from "./testStore";

let store: Store;

beforeEach(() => {
  store = createStoreStub();
  setPlatformForTest(makeMemoryPlatform(store));
});

afterEach(() => {
  resetPlatformForTest();
});

describe("usePreferences", () => {
  it("returns DEFAULT_PREFERENCES before the async load resolves (no undefined flash)", () => {
    const { result } = renderHook(() => usePreferences());
    expect(result.current.preferences).toEqual(DEFAULT_PREFERENCES);
  });

  it("loads persisted prefs from the store on mount", async () => {
    await store.set(PREFERENCES_STORE_KEY, {
      theme: "dark",
      accent: "#10b981",
      lastUsedId: "base64",
      recentToolIds: ["base64"],
    });
    const { result } = renderHook(() => usePreferences());
    await waitFor(() => expect(result.current.preferences.accent).toBe("#10b981"));
    expect(result.current.preferences.lastUsedId).toBe("base64");
  });

  it("setAccent persists through platform.store.set (round-trip)", async () => {
    const { result } = renderHook(() => usePreferences());
    await act(async () => {
      result.current.setAccent("#10b981");
    });
    expect(result.current.preferences.accent).toBe("#10b981");
    const stored = (await platform.store.get(PREFERENCES_STORE_KEY)) as {
      accent: string;
    };
    expect(stored.accent).toBe("#10b981");
  });

  it("setTheme persists the named theme value", async () => {
    const { result } = renderHook(() => usePreferences());
    await act(async () => {
      result.current.setTheme("dark");
    });
    const stored = (await platform.store.get(PREFERENCES_STORE_KEY)) as {
      theme: string;
    };
    expect(stored.theme).toBe("dark");
  });

  it("setLastUsedId persists the id", async () => {
    const { result } = renderHook(() => usePreferences());
    await act(async () => {
      result.current.setLastUsedId("base64");
    });
    expect(result.current.preferences.lastUsedId).toBe("base64");
    const stored = (await platform.store.get(PREFERENCES_STORE_KEY)) as {
      lastUsedId: string;
    };
    expect(stored.lastUsedId).toBe("base64");
  });

  it("falls back to DEFAULT_PREFERENCES for a corrupt/garbage stored blob", async () => {
    // A non-object value (e.g. a corrupt entry surfaced as a primitive).
    await store.set(PREFERENCES_STORE_KEY, "not-an-object");
    const { result } = renderHook(() => usePreferences());
    await waitFor(() => expect(result.current.preferences).toEqual(DEFAULT_PREFERENCES));
  });

  it("ignores unknown/wrong-typed fields, keeping known fields valid", async () => {
    await store.set(PREFERENCES_STORE_KEY, {
      theme: "neon", // invalid → coerced to default "dark"
      accent: 42, // wrong type → default accent
      lastUsedId: 7, // wrong type → null
      recentToolIds: "nope", // wrong type → []
      injected: "ignored",
    });
    const { result } = renderHook(() => usePreferences());
    await waitFor(() => expect(result.current.preferences.theme).toBe("dark"));
    expect(result.current.preferences.accent).toBe(DEFAULT_PREFERENCES.accent);
    expect(result.current.preferences.lastUsedId).toBeNull();
    expect(result.current.preferences.recentToolIds).toEqual([]);
  });
});
