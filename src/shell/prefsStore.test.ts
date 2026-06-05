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
import { loadPreferences, mergePreferences, savePreferences } from "./prefsStore";
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

// protobufTreeStyle is read from the same untrusted on-disk blob (threat T-03-01:
// the user can hand-edit prefs.json). mergePreferences must accept only the two
// valid enum values and coerce everything else — absent, unknown strings, and
// non-strings — to the "cards" default, exactly like the Phase-2 coercers.
describe("protobufTreeStyle coercion", () => {
  it("defaults to \"cards\" when absent", () => {
    expect(mergePreferences({}).protobufTreeStyle).toBe("cards");
  });

  it("preserves a valid \"rows\" value", () => {
    expect(mergePreferences({ protobufTreeStyle: "rows" }).protobufTreeStyle).toBe(
      "rows",
    );
  });

  it("coerces an unknown string to \"cards\" (untrusted hand-edited prefs.json)", () => {
    expect(
      mergePreferences({ protobufTreeStyle: "banana" }).protobufTreeStyle,
    ).toBe("cards");
  });

  it("coerces a non-string value to \"cards\"", () => {
    expect(mergePreferences({ protobufTreeStyle: 42 }).protobufTreeStyle).toBe(
      "cards",
    );
  });
});

// toolOrder is the user's custom sidebar order (REORD-05, D-09), read from the
// same untrusted on-disk blob (threat T-16-01: hand-edited prefs.json). coerce
// keeps only string members, de-dupes, and yields [] for a non-array — but
// (unlike recents) applies NO length cap, since the full order can be all ids.
describe("toolOrder coercion (REORD-05, D-09)", () => {
  it("keeps string ids, drops non-strings, and de-dupes", () => {
    expect(mergePreferences({ toolOrder: ["b", "a", 5, "a"] }).toolOrder).toEqual([
      "b",
      "a",
    ]);
  });

  it("defaults to [] when absent", () => {
    expect(mergePreferences({}).toolOrder).toEqual([]);
  });

  it("yields [] for a non-array value (untrusted hand-edited prefs.json)", () => {
    expect(mergePreferences({ toolOrder: "nope" }).toolOrder).toEqual([]);
  });

  it("does not regress a sibling field in the same merged blob", () => {
    const merged = mergePreferences({ toolOrder: ["a"], protobufTreeStyle: "rows" });
    expect(merged.toolOrder).toEqual(["a"]);
    expect(merged.protobufTreeStyle).toBe("rows");
  });
});

// autoUpdateCheck is the first-run opt-in (D-09), read from the same untrusted
// on-disk blob (threat T-06-03: the user can hand-edit prefs.json). Only the
// booleans true/false are honored; anything else — absent, junk string, number —
// coerces to null ("never asked"), so the one-time prompt re-appears.
describe("autoUpdateCheck coercion (D-09)", () => {
  it("preserves true", () => {
    expect(mergePreferences({ autoUpdateCheck: true }).autoUpdateCheck).toBe(true);
  });

  it("preserves false", () => {
    expect(mergePreferences({ autoUpdateCheck: false }).autoUpdateCheck).toBe(false);
  });

  it("coerces a junk string to null (untrusted hand-edited prefs.json)", () => {
    expect(mergePreferences({ autoUpdateCheck: "yes" }).autoUpdateCheck).toBeNull();
  });

  it("coerces a non-boolean number to null", () => {
    expect(mergePreferences({ autoUpdateCheck: 1 }).autoUpdateCheck).toBeNull();
  });

  it("defaults to null (first-run) when absent", () => {
    expect(mergePreferences({}).autoUpdateCheck).toBeNull();
  });

  it("does not regress a sibling field in the same merged blob", () => {
    // A blob carrying both fields must coerce each independently.
    const merged = mergePreferences({ autoUpdateCheck: true, protobufTreeStyle: "rows" });
    expect(merged.autoUpdateCheck).toBe(true);
    expect(merged.protobufTreeStyle).toBe("rows");
  });
});
