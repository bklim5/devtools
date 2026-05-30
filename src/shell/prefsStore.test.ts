// @vitest-environment jsdom
// prefsStore load/save must go through the platform impl resolved by
// initPlatform() — NOT a stale browser fallback. This guards the packaged-app
// bug where a startup read hit localStorage while writes hit the Tauri
// plugin-store, so last-used never restored. Here we install an in-memory impl
// via the test seam and prove load/save use it (and never touch localStorage).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  resetPlatformForTest,
  setPlatformForTest,
  type Store,
} from "@/lib/platform";
import { createStoreStub } from "@/lib/platform/stub";
import { makeMemoryPlatform } from "./testStore";
import { loadPreferences, savePreferences } from "./prefsStore";
import { DEFAULT_PREFERENCES, PREFERENCES_STORE_KEY } from "./preferences";

let store: Store;

beforeEach(() => {
  if (typeof localStorage !== "undefined") localStorage.clear();
  store = createStoreStub();
  setPlatformForTest(makeMemoryPlatform(store));
});

afterEach(() => {
  resetPlatformForTest();
  if (typeof localStorage !== "undefined") localStorage.clear();
});

describe("prefsStore routes through the init-resolved platform store", () => {
  it("save then load round-trips via the installed store", async () => {
    const prefs = {
      ...DEFAULT_PREFERENCES,
      lastUsedId: "base64",
      recentToolIds: ["base64"],
    };
    await savePreferences(prefs);
    await expect(loadPreferences()).resolves.toMatchObject({
      lastUsedId: "base64",
      recentToolIds: ["base64"],
    });
  });

  it("writes land in the installed store, never the browser localStorage fallback", async () => {
    await savePreferences({
      ...DEFAULT_PREFERENCES,
      lastUsedId: "unix-time",
      recentToolIds: ["unix-time"],
    });
    // The value is in the injected store...
    await expect(store.get(PREFERENCES_STORE_KEY)).resolves.toMatchObject({
      lastUsedId: "unix-time",
    });
    // ...and NOT smeared into localStorage (the split-brain the fix prevents).
    expect(localStorage.getItem(`devtools:${PREFERENCES_STORE_KEY}`)).toBeNull();
  });
});
