// @vitest-environment jsdom
// useTrackActiveTool: the SINGLE on-navigation recorder. Proves that opening a
// tool via ANY route change (sidebar, palette, deep-link) persists it as
// last-used + recents — the fix for "switching via the sidebar never restored".
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import {
  resetPlatformForTest,
  setPlatformForTest,
  type Store,
} from "@/lib/platform";
import { createStoreStub } from "@/lib/platform/stub";
import { makeMemoryPlatform } from "./testStore";
import { PREFERENCES_STORE_KEY } from "./preferences";
import { useTrackActiveTool } from "./useTrackActiveTool";

let store: Store;

beforeEach(() => {
  store = createStoreStub();
  setPlatformForTest(makeMemoryPlatform(store));
});

afterEach(() => {
  cleanup();
  resetPlatformForTest();
});

// A host that runs the recorder under a route, mirroring how App mounts it as
// the layout element wrapping the routed tools.
function Host() {
  useTrackActiveTool();
  return null;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/tools/:id" element={<Host />} />
        <Route path="*" element={<Host />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function readPrefs() {
  return (await store.get(PREFERENCES_STORE_KEY)) as
    | { lastUsedId?: string; recentToolIds?: string[]; accent?: string }
    | undefined;
}

describe("useTrackActiveTool (records the open tool on navigation)", () => {
  it("records the routed tool as last-used + recents (e.g. a sidebar switch)", async () => {
    renderAt("/tools/base64");
    await waitFor(async () => {
      const prefs = await readPrefs();
      expect(prefs?.lastUsedId).toBe("base64");
      expect(prefs?.recentToolIds?.[0]).toBe("base64");
    });
  });

  it("ignores an unknown/tampered tool id — nothing is persisted (T-02-07)", async () => {
    renderAt("/tools/does-not-exist");
    // Give the load + any effect a chance to run, then assert nothing was written.
    await new Promise((r) => setTimeout(r, 30));
    expect(await readPrefs()).toBeUndefined();
  });

  it("does not record on the index/unknown route (no tool open)", async () => {
    renderAt("/");
    await new Promise((r) => setTimeout(r, 30));
    expect(await readPrefs()).toBeUndefined();
  });

  it("preserves other prefs and existing recents when recording (loaded-gate)", async () => {
    await store.set(PREFERENCES_STORE_KEY, {
      theme: "dark",
      accent: "#10b981",
      lastUsedId: "unix-time",
      recentToolIds: ["unix-time"],
    });
    renderAt("/tools/base64");
    await waitFor(async () => {
      const prefs = await readPrefs();
      expect(prefs?.lastUsedId).toBe("base64");
      // base64 moves to front; the previously-stored recent is preserved.
      expect(prefs?.recentToolIds).toEqual(["base64", "unix-time"]);
      expect(prefs?.accent).toBe("#10b981"); // untouched
    });
  });
});
