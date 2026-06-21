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
import {
  coercePinnedToolIds,
  loadPreferences,
  mergePreferences,
  savePreferences,
} from "./prefsStore";
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

// theme is light/dark (D-23-4; "system" removed), read from the same untrusted
// on-disk blob (threat T-23-01: the user can hand-edit prefs.json). coerceTheme
// (module-private — tested THROUGH mergePreferences) accepts ONLY the two known
// names; anything else — incl. a hand-edited/legacy "system", non-string, absent —
// coerces to the "dark" default. The accent default is now #5b9bf8 (the applied
// dark blue — Pitfall 1; the dead #3b82f6 is gone).
describe("coerceTheme (D-23-4, T-23-01)", () => {
  it("preserves the valid name \"light\"", () => {
    expect(mergePreferences({ theme: "light" }).theme).toBe("light");
  });

  it("preserves the valid name \"dark\"", () => {
    expect(mergePreferences({ theme: "dark" }).theme).toBe("dark");
  });

  it("coerces a hand-edited/legacy \"system\" to \"dark\"", () => {
    expect(mergePreferences({ theme: "system" }).theme).toBe("dark");
  });

  it("coerces an unknown string to \"dark\" (untrusted hand-edited prefs.json)", () => {
    expect(mergePreferences({ theme: "purple" }).theme).toBe("dark");
    expect(mergePreferences({ theme: "bogus" }).theme).toBe("dark");
  });

  it("coerces a non-string value to \"dark\"", () => {
    expect(mergePreferences({ theme: 42 }).theme).toBe("dark");
    expect(mergePreferences({ theme: undefined }).theme).toBe("dark");
    expect(mergePreferences({ theme: null }).theme).toBe("dark");
  });

  it("defaults to \"dark\" when absent (fresh install, D-23-4)", () => {
    expect(mergePreferences({}).theme).toBe("dark");
  });

  it("does not regress a sibling field in the same merged blob", () => {
    const merged = mergePreferences({ theme: "light", protobufTreeStyle: "rows" });
    expect(merged.theme).toBe("light");
    expect(merged.protobufTreeStyle).toBe("rows");
  });
});

// The default accent is now the applied dark default-blue #5b9bf8 (Pitfall 1):
// index.css --color-accent is #5b9bf8, but DEFAULT_PREFERENCES.accent USED to be
// the dead/AA-failing #3b82f6. Now that the App root applies accent (D-23-9) the
// default must be the real color so a fresh install applies the correct blue.
describe("accent default is #5b9bf8 (Pitfall 1 — D-23-4)", () => {
  it("defaults to #5b9bf8 when absent", () => {
    expect(mergePreferences({}).accent).toBe("#5b9bf8");
  });

  it("is NOT the dead #3b82f6", () => {
    expect(mergePreferences({}).accent).not.toBe("#3b82f6");
  });

  it("preserves an explicit accent (coerceAccent unchanged — any non-empty string)", () => {
    expect(mergePreferences({ accent: "#a78bfa" }).accent).toBe("#a78bfa");
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

// pinnedToolIds is the user's pinned set (PIN-07), read from the same untrusted
// on-disk blob (threat T-17-01: hand-edited prefs.json). coercePinnedToolIds
// mirrors coerceToolOrder — keeps only string members, de-dupes, yields [] for a
// non-array — and (like toolOrder, unlike recents) applies NO length cap.
describe("coercePinnedToolIds (PIN-07, T-17-01)", () => {
  it("keeps string ids, drops non-strings, and de-dupes", () => {
    expect(coercePinnedToolIds(["a", "a", "b"])).toEqual(["a", "b"]);
    expect(coercePinnedToolIds([1, "a", null])).toEqual(["a"]);
  });

  it("yields [] for a non-array value (untrusted hand-edited prefs.json)", () => {
    expect(coercePinnedToolIds("nope")).toEqual([]);
    expect(coercePinnedToolIds(null)).toEqual([]);
    expect(coercePinnedToolIds(undefined)).toEqual([]);
  });

  it("applies NO length cap (distinct from normalizeRecents' cap of 5)", () => {
    const fifty = Array.from({ length: 50 }, (_, i) => `t${i}`);
    expect(coercePinnedToolIds(fifty)).toEqual(fifty);
    expect(coercePinnedToolIds(fifty)).toHaveLength(50);
  });

  it("is wired into mergePreferences (defaults to [], round-trips a value)", () => {
    expect(mergePreferences({}).pinnedToolIds).toEqual([]);
    expect(mergePreferences({ pinnedToolIds: ["x"] }).pinnedToolIds).toEqual(["x"]);
  });

  it("does not regress a sibling field in the same merged blob", () => {
    const merged = mergePreferences({ pinnedToolIds: ["a"], toolOrder: ["b"] });
    expect(merged.pinnedToolIds).toEqual(["a"]);
    expect(merged.toolOrder).toEqual(["b"]);
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

// lastUpdateCheck is the epoch-ms stamp of the last completed update check
// (D-25-6), read from the same untrusted on-disk blob (threat T-25-04: the user
// can hand-edit prefs.json). coerceLastUpdateCheck (module-private — tested
// THROUGH mergePreferences) accepts ONLY a finite POSITIVE number; everything
// else — non-number, NaN, Infinity, 0, negative, absent — coerces to null
// ("never checked", renders "Never"), so a garbage value can never render as a
// misleading future/garbage date.
describe("lastUpdateCheck coercion (D-25-6, T-25-04)", () => {
  it("preserves a valid positive epoch-ms number", () => {
    expect(mergePreferences({ lastUpdateCheck: 1718900000000 }).lastUpdateCheck).toBe(
      1718900000000,
    );
  });

  it("coerces a string to null (untrusted hand-edited prefs.json)", () => {
    expect(mergePreferences({ lastUpdateCheck: "x" }).lastUpdateCheck).toBeNull();
  });

  it("coerces NaN to null", () => {
    expect(mergePreferences({ lastUpdateCheck: NaN }).lastUpdateCheck).toBeNull();
  });

  it("coerces Infinity to null", () => {
    expect(mergePreferences({ lastUpdateCheck: Infinity }).lastUpdateCheck).toBeNull();
  });

  it("coerces a negative number to null", () => {
    expect(mergePreferences({ lastUpdateCheck: -1 }).lastUpdateCheck).toBeNull();
  });

  it("coerces 0 to null (not a valid epoch stamp)", () => {
    expect(mergePreferences({ lastUpdateCheck: 0 }).lastUpdateCheck).toBeNull();
  });

  it("defaults to null when absent (never checked)", () => {
    expect(mergePreferences({}).lastUpdateCheck).toBeNull();
  });

  it("does not regress a sibling field in the same merged blob", () => {
    const merged = mergePreferences({ lastUpdateCheck: 1718900000000, toolOrder: ["a"] });
    expect(merged.lastUpdateCheck).toBe(1718900000000);
    expect(merged.toolOrder).toEqual(["a"]);
  });
});

// entitlementsOverride is the dev/test override (D-31), read from the same
// untrusted on-disk blob (threat T-18-01: hand-edited prefs.json). "free" is
// honored in any build (downgrade-only). "full" is DEV-ONLY: it survives the
// coercer only under isTestOrDev() (vitest MODE==="test" satisfies this here) so
// the dev/e2e harness can reach Pro after the D-85 flip; in a RELEASE build "full"
// coerces to null. Everything else → null.
describe("entitlementsOverride coercion (D-31, T-18-01 — downgrade-only + DEV-only full)", () => {
  it("preserves the exact string \"free\"", () => {
    expect(mergePreferences({ entitlementsOverride: "free" }).entitlementsOverride).toBe(
      "free",
    );
  });

  it("preserves \"full\" under test/dev (DEV-only Pro override for the e2e harness)", () => {
    // vitest runs with import.meta.env.MODE === "test" → isTestOrDev() is true, so
    // "full" survives here. A RELEASE bundle (DEV false / MODE "production") nulls it
    // — the prod downgrade-only invariant is grep-pinned by check-dev-strip.sh.
    expect(
      mergePreferences({ entitlementsOverride: "full" }).entitlementsOverride,
    ).toBe("full");
  });

  it("coerces junk values to null (untrusted hand-edited prefs.json)", () => {
    expect(mergePreferences({ entitlementsOverride: 123 }).entitlementsOverride).toBeNull();
    expect(mergePreferences({ entitlementsOverride: {} }).entitlementsOverride).toBeNull();
    expect(mergePreferences({ entitlementsOverride: true }).entitlementsOverride).toBeNull();
    expect(
      mergePreferences({ entitlementsOverride: undefined }).entitlementsOverride,
    ).toBeNull();
  });

  it("defaults to null (no override) when absent", () => {
    expect(mergePreferences({}).entitlementsOverride).toBeNull();
  });

  it("\"free\" survives a save → load round-trip through the store seam", async () => {
    await savePreferences({ ...DEFAULT_PREFERENCES, entitlementsOverride: "free" });
    await expect(loadPreferences()).resolves.toMatchObject({
      entitlementsOverride: "free",
    });
  });

  it("does not regress a sibling field in the same merged blob", () => {
    const merged = mergePreferences({ entitlementsOverride: "free", toolOrder: ["a"] });
    expect(merged.entitlementsOverride).toBe("free");
    expect(merged.toolOrder).toEqual(["a"]);
  });
});

// licenseDropNoticeAck is the one-shot D-84 drop notice flag, read from the same
// untrusted on-disk blob (the user can hand-edit prefs.json). ONLY an explicit
// `false` ("a drop is pending") is honored; everything else — absent, junk,
// `true` — coerces to `true` (steady "nothing to acknowledge"), so a corrupt
// value can never wrongly surface the notice.
describe("licenseDropNoticeAck coercion (D-84 — one-shot drop notice)", () => {
  it("defaults to true (nothing to acknowledge) when absent", () => {
    expect(mergePreferences({}).licenseDropNoticeAck).toBe(true);
  });

  it("honors an explicit false (a detected drop is pending acknowledgement)", () => {
    expect(mergePreferences({ licenseDropNoticeAck: false }).licenseDropNoticeAck).toBe(
      false,
    );
  });

  it("coerces junk values to true (untrusted hand-edited prefs.json)", () => {
    expect(mergePreferences({ licenseDropNoticeAck: "no" }).licenseDropNoticeAck).toBe(
      true,
    );
    expect(mergePreferences({ licenseDropNoticeAck: 0 }).licenseDropNoticeAck).toBe(true);
    expect(mergePreferences({ licenseDropNoticeAck: null }).licenseDropNoticeAck).toBe(
      true,
    );
  });

  it("survives a save → load round-trip through the store seam (false preserved)", async () => {
    await savePreferences({ ...DEFAULT_PREFERENCES, licenseDropNoticeAck: false });
    await expect(loadPreferences()).resolves.toMatchObject({
      licenseDropNoticeAck: false,
    });
  });

  it("does not regress a sibling field in the same merged blob", () => {
    const merged = mergePreferences({ licenseDropNoticeAck: false, toolOrder: ["a"] });
    expect(merged.licenseDropNoticeAck).toBe(false);
    expect(merged.toolOrder).toEqual(["a"]);
  });
});

// --- Phase 24 additive fields (SET-08/SET-09) --------------------------------

// summonChord / paletteChord are accelerator strings read from the untrusted
// on-disk blob (T-24-01, D-24-12). Reuse the Task-1 isValidAccelerator gate: a
// junk/invalid/non-string chord coerces to the shipped default so a dead chord
// can never persist; a valid chord is kept verbatim.
describe("summonChord / paletteChord coercion (SET-08, T-24-01, D-24-12)", () => {
  it("coerces a junk summonChord to the shipped default", () => {
    expect(mergePreferences({ summonChord: "garbage" }).summonChord).toBe(
      "CommandOrControl+Shift+D",
    );
  });

  it("keeps a valid summonChord verbatim", () => {
    expect(mergePreferences({ summonChord: "CommandOrControl+Shift+J" }).summonChord).toBe(
      "CommandOrControl+Shift+J",
    );
  });

  it("defaults summonChord when absent", () => {
    expect(mergePreferences({}).summonChord).toBe("CommandOrControl+Shift+D");
  });

  it("coerces a non-string paletteChord to the shipped default", () => {
    expect(mergePreferences({ paletteChord: 42 }).paletteChord).toBe("CommandOrControl+K");
  });

  it("keeps a valid paletteChord verbatim", () => {
    expect(mergePreferences({ paletteChord: "Alt+P" }).paletteChord).toBe("Alt+P");
  });

  it("defaults paletteChord when absent", () => {
    expect(mergePreferences({}).paletteChord).toBe("CommandOrControl+K");
  });

  it("rejects a bare-key chord (no non-shift modifier) → default", () => {
    expect(mergePreferences({ summonChord: "D" }).summonChord).toBe("CommandOrControl+Shift+D");
  });
});

// launchAtLogin / startInTray are boolean toggles (SET-09): only the literal
// booleans are honored; everything else → false.
describe("launchAtLogin / startInTray coercion (SET-09)", () => {
  it("coerces a junk string launchAtLogin to false", () => {
    expect(mergePreferences({ launchAtLogin: "yes" }).launchAtLogin).toBe(false);
  });

  it("preserves launchAtLogin true", () => {
    expect(mergePreferences({ launchAtLogin: true }).launchAtLogin).toBe(true);
  });

  it("coerces a number startInTray to false", () => {
    expect(mergePreferences({ startInTray: 1 }).startInTray).toBe(false);
  });

  it("preserves startInTray true", () => {
    expect(mergePreferences({ startInTray: true }).startInTray).toBe(true);
  });

  it("both default to false when absent", () => {
    expect(mergePreferences({}).launchAtLogin).toBe(false);
    expect(mergePreferences({}).startInTray).toBe(false);
  });
});

// defaultToolId is the General-pane "Default tool" (SET-09, T-24-02): accept ONLY
// a currently-enabled tool id (validated via getToolById against ENABLED_TOOLS);
// an unknown/removed id — or null — coerces to null ("Last used").
describe("defaultToolId coercion (SET-09, T-24-02)", () => {
  it("preserves a valid enabled tool id", () => {
    expect(mergePreferences({ defaultToolId: "protobuf-decoder" }).defaultToolId).toBe(
      "protobuf-decoder",
    );
  });

  it("coerces an unknown id to null (= Last used)", () => {
    expect(mergePreferences({ defaultToolId: "evil" }).defaultToolId).toBeNull();
  });

  it("preserves an explicit null", () => {
    expect(mergePreferences({ defaultToolId: null }).defaultToolId).toBeNull();
  });

  it("defaults to null when absent (backward-compatible = Last used)", () => {
    expect(mergePreferences({}).defaultToolId).toBeNull();
  });

  it("coerces a non-string to null", () => {
    expect(mergePreferences({ defaultToolId: 7 }).defaultToolId).toBeNull();
  });
});
