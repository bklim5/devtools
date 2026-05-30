// @vitest-environment jsdom
// useRecentTools: most-recent-first, de-duped, capped at 5, persisted through
// the REAL Store seam (in-memory stub via setPlatformForTest). No @tauri-apps.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import {
  platform,
  resetPlatformForTest,
  setPlatformForTest,
  type Store,
} from "@/lib/platform";
import { createStoreStub } from "@/lib/platform/stub";
import { useRecentTools } from "./useRecentTools";
import { PREFERENCES_STORE_KEY } from "./preferences";
import { makeMemoryPlatform } from "./testStore";

let store: Store;

beforeEach(() => {
  store = createStoreStub();
  setPlatformForTest(makeMemoryPlatform(store));
});

afterEach(() => {
  resetPlatformForTest();
});

describe("useRecentTools", () => {
  it("push keeps most-recent-first", async () => {
    const { result } = renderHook(() => useRecentTools());
    await act(async () => {
      result.current.push("base64");
    });
    await act(async () => {
      result.current.push("unix-time");
    });
    expect(result.current.recentToolIds).toEqual(["unix-time", "base64"]);
  });

  it("pushing an existing id moves it to front without duplicating", async () => {
    const { result } = renderHook(() => useRecentTools());
    await act(async () => {
      result.current.push("base64");
    });
    await act(async () => {
      result.current.push("unix-time");
    });
    await act(async () => {
      result.current.push("base64");
    });
    expect(result.current.recentToolIds).toEqual(["base64", "unix-time"]);
  });

  it("caps the list at 5, dropping the oldest", async () => {
    const { result } = renderHook(() => useRecentTools());
    for (const id of ["a", "b", "c", "d", "e", "f"]) {
      await act(async () => {
        result.current.push(id);
      });
    }
    expect(result.current.recentToolIds).toHaveLength(5);
    expect(result.current.recentToolIds).toEqual(["f", "e", "d", "c", "b"]);
    expect(result.current.recentToolIds).not.toContain("a");
  });

  it("persists recents through the store seam", async () => {
    const { result } = renderHook(() => useRecentTools());
    await act(async () => {
      result.current.push("base64");
    });
    const stored = (await platform.store.get(PREFERENCES_STORE_KEY)) as {
      recentToolIds: string[];
    };
    expect(stored.recentToolIds).toEqual(["base64"]);
  });

  it("loads recents from the store on mount", async () => {
    await store.set(PREFERENCES_STORE_KEY, {
      theme: "dark",
      accent: "#3b82f6",
      lastUsedId: null,
      recentToolIds: ["protobuf-decoder", "base64"],
    });
    const { result } = renderHook(() => useRecentTools());
    await waitFor(() =>
      expect(result.current.recentToolIds).toEqual(["protobuf-decoder", "base64"]),
    );
  });

  it("recordSwitch persists recents AND lastUsedId in one atomic blob write", async () => {
    // Seed an existing accent so we can prove the single write preserves it.
    await store.set(PREFERENCES_STORE_KEY, {
      theme: "dark",
      accent: "#10b981",
      lastUsedId: null,
      recentToolIds: [],
    });
    const { result } = renderHook(() => useRecentTools());
    await waitFor(() => expect(result.current.recentToolIds).toEqual([]));
    await act(async () => {
      result.current.recordSwitch("base64");
    });
    const stored = (await platform.store.get(PREFERENCES_STORE_KEY)) as {
      accent: string;
      lastUsedId: string | null;
      recentToolIds: string[];
    };
    expect(stored.lastUsedId).toBe("base64");
    expect(stored.recentToolIds).toEqual(["base64"]);
    expect(stored.accent).toBe("#10b981"); // other fields untouched
  });

  it("drops non-string ids from a tampered stored recents array (untrusted)", async () => {
    await store.set(PREFERENCES_STORE_KEY, {
      recentToolIds: ["base64", 7, null, "base64", "unix-time"],
    });
    const { result } = renderHook(() => useRecentTools());
    await waitFor(() =>
      expect(result.current.recentToolIds).toEqual(["base64", "unix-time"]),
    );
  });
});
