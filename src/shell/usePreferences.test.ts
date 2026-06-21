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
import { resetPreferencesForTest, usePreferences } from "./usePreferences";
import { useRecentTools } from "./useRecentTools";
import { DEFAULT_PREFERENCES, PREFERENCES_STORE_KEY } from "./preferences";
import { makeMemoryPlatform } from "./testStore";

let store: Store;

beforeEach(() => {
  // The prefs blob is a module-singleton (shared across all usePreferences
  // instances for live cross-component apply, Phase 23-03) — reset it so each
  // test gets a fresh load from its own platform store.
  resetPreferencesForTest();
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

  it("setToolOrder persists the order and round-trips through the seam (REORD-05)", async () => {
    const { result } = renderHook(() => usePreferences());
    await act(async () => {
      result.current.setToolOrder(["x", "y"]);
    });
    // Local state reflects the choice immediately (write-on-change).
    expect(result.current.preferences.toolOrder).toEqual(["x", "y"]);
    // The persisted blob under the prefs key round-trips the order.
    const stored = (await platform.store.get(PREFERENCES_STORE_KEY)) as {
      toolOrder: string[];
    };
    expect(stored.toolOrder).toEqual(["x", "y"]);
  });

  it("setPinnedToolIds persists the set and round-trips through the seam (PIN-07)", async () => {
    const { result } = renderHook(() => usePreferences());
    await act(async () => {
      result.current.setPinnedToolIds(["a"]);
    });
    // Local state reflects the choice immediately (write-on-change).
    expect(result.current.preferences.pinnedToolIds).toEqual(["a"]);
    // The persisted blob under the prefs key round-trips the set.
    const stored = (await platform.store.get(PREFERENCES_STORE_KEY)) as {
      pinnedToolIds: string[];
    };
    expect(stored.pinnedToolIds).toEqual(["a"]);
  });

  it("togglePinned appends-on-pin (bottom) and removes-on-unpin (PIN-07)", async () => {
    const { result } = renderHook(() => usePreferences());
    // Pin on an empty set → ["a"].
    await act(async () => {
      result.current.togglePinned("a");
    });
    expect(result.current.preferences.pinnedToolIds).toEqual(["a"]);
    // Pin a second → appends to the bottom → ["a", "b"].
    await act(async () => {
      result.current.togglePinned("b");
    });
    expect(result.current.preferences.pinnedToolIds).toEqual(["a", "b"]);
    // Toggle "a" again → removes it → ["b"].
    await act(async () => {
      result.current.togglePinned("a");
    });
    expect(result.current.preferences.pinnedToolIds).toEqual(["b"]);
    // The removal persisted through the seam.
    const stored = (await platform.store.get(PREFERENCES_STORE_KEY)) as {
      pinnedToolIds: string[];
    };
    expect(stored.pinnedToolIds).toEqual(["b"]);
  });

  it("setTreeStyle persists the choice and round-trips through a fresh load", async () => {
    const first = renderHook(() => usePreferences());
    await act(async () => {
      first.result.current.setTreeStyle("rows");
    });
    // Local state reflects the choice immediately (write-on-change).
    expect(first.result.current.preferences.protobufTreeStyle).toBe("rows");
    // A fresh hook over the SAME memory store loads "rows" back, proving
    // savePreferences persisted protobufTreeStyle to the seam (PRO-06, D-07).
    const second = renderHook(() => usePreferences());
    await waitFor(() =>
      expect(second.result.current.preferences.protobufTreeStyle).toBe("rows"),
    );
  });

  it("setAutoUpdateCheck persists true and round-trips through a fresh load", async () => {
    const first = renderHook(() => usePreferences());
    await act(async () => {
      first.result.current.setAutoUpdateCheck(true);
    });
    expect(first.result.current.preferences.autoUpdateCheck).toBe(true);
    const stored = (await platform.store.get(PREFERENCES_STORE_KEY)) as {
      autoUpdateCheck: boolean | null;
    };
    expect(stored.autoUpdateCheck).toBe(true);
    // A fresh hook over the SAME memory store loads the opt-in back (D-09).
    const second = renderHook(() => usePreferences());
    await waitFor(() =>
      expect(second.result.current.preferences.autoUpdateCheck).toBe(true),
    );
  });

  it("setAutoUpdateCheck persists false (explicit opt-out, no re-prompt)", async () => {
    const { result } = renderHook(() => usePreferences());
    await act(async () => {
      result.current.setAutoUpdateCheck(false);
    });
    expect(result.current.preferences.autoUpdateCheck).toBe(false);
    const stored = (await platform.store.get(PREFERENCES_STORE_KEY)) as {
      autoUpdateCheck: boolean | null;
    };
    expect(stored.autoUpdateCheck).toBe(false);
  });

  it("REGRESSION (round-3 clobber): a useRecentTools tool switch AFTER a theme/pin change does NOT revert theme or pins", async () => {
    // Reproduces the user-reported bug: change theme + pin tools, switch tools,
    // quit+relaunch → theme/pins reverted. Root cause was useRecentTools writing
    // a stale mount-era snapshot back to the shared blob. Both hooks must share
    // ONE live writer, so a recents/lastUsed write merges against the NEW
    // theme/pins instead of clobbering them.
    const { result: prefs } = renderHook(() => usePreferences());
    const { result: recents } = renderHook(() => useRecentTools());
    // Let both hooks resolve their (shared) mount load.
    await waitFor(() => expect(recents.current.loaded).toBe(true));

    // User changes theme + pins AFTER mount.
    await act(async () => {
      prefs.current.setTheme("light");
    });
    await act(async () => {
      prefs.current.setPinnedToolIds(["base64", "unix-time"]);
    });

    // User switches tools (the recents writer fires).
    await act(async () => {
      recents.current.recordSwitch("uuid-ulid");
    });

    // The PERSISTED blob must still carry the NEW theme + pins AND the recents.
    const stored = (await platform.store.get(PREFERENCES_STORE_KEY)) as {
      theme: string;
      pinnedToolIds: string[];
      recentToolIds: string[];
      lastUsedId: string | null;
    };
    expect(stored.theme).toBe("light");
    expect(stored.pinnedToolIds).toEqual(["base64", "unix-time"]);
    expect(stored.recentToolIds).toEqual(["uuid-ulid"]);
    expect(stored.lastUsedId).toBe("uuid-ulid");
    // And the live hook state agrees (one source of truth).
    expect(prefs.current.preferences.theme).toBe("light");
    expect(prefs.current.preferences.pinnedToolIds).toEqual(["base64", "unix-time"]);
  });

  // --- Phase 24 additive single-writer setters (SET-08/SET-09) ---------------
  // Each new setter must route through updatePreferences (the ONE writer), so a
  // round-trip through the shared seam proves the write landed. The chord setters
  // persist whatever they're given (the coercer is the load-time gate).
  it("setSummonChord persists through the single writer and round-trips", async () => {
    const { result } = renderHook(() => usePreferences());
    await act(async () => {
      result.current.setSummonChord("CommandOrControl+Shift+J");
    });
    expect(result.current.preferences.summonChord).toBe("CommandOrControl+Shift+J");
    const stored = (await platform.store.get(PREFERENCES_STORE_KEY)) as { summonChord: string };
    expect(stored.summonChord).toBe("CommandOrControl+Shift+J");
  });

  it("setPaletteChord persists through the single writer", async () => {
    const { result } = renderHook(() => usePreferences());
    await act(async () => {
      result.current.setPaletteChord("Alt+P");
    });
    expect(result.current.preferences.paletteChord).toBe("Alt+P");
    const stored = (await platform.store.get(PREFERENCES_STORE_KEY)) as { paletteChord: string };
    expect(stored.paletteChord).toBe("Alt+P");
  });

  it("setLaunchAtLogin persists the toggle", async () => {
    const { result } = renderHook(() => usePreferences());
    await act(async () => {
      result.current.setLaunchAtLogin(true);
    });
    expect(result.current.preferences.launchAtLogin).toBe(true);
    const stored = (await platform.store.get(PREFERENCES_STORE_KEY)) as { launchAtLogin: boolean };
    expect(stored.launchAtLogin).toBe(true);
  });

  it("setStartInTray persists the toggle", async () => {
    const { result } = renderHook(() => usePreferences());
    await act(async () => {
      result.current.setStartInTray(true);
    });
    expect(result.current.preferences.startInTray).toBe(true);
    const stored = (await platform.store.get(PREFERENCES_STORE_KEY)) as { startInTray: boolean };
    expect(stored.startInTray).toBe(true);
  });

  it("setDefaultToolId persists the id (and null = Last used)", async () => {
    const { result } = renderHook(() => usePreferences());
    await act(async () => {
      result.current.setDefaultToolId("base64");
    });
    expect(result.current.preferences.defaultToolId).toBe("base64");
    await act(async () => {
      result.current.setDefaultToolId(null);
    });
    expect(result.current.preferences.defaultToolId).toBeNull();
    const stored = (await platform.store.get(PREFERENCES_STORE_KEY)) as {
      defaultToolId: string | null;
    };
    expect(stored.defaultToolId).toBeNull();
  });

  // setLastUpdateCheck (D-25-6) routes through updatePreferences (the ONE
  // writer), so a fresh hook over the SAME memory store loads it back, proving
  // the write persisted through the seam. T-25-05: setting lastUpdateCheck must
  // NOT clobber a previously-set theme/pin (single-writer merge against live).
  it("setLastUpdateCheck persists through the single writer and round-trips through a fresh load", async () => {
    const first = renderHook(() => usePreferences());
    await act(async () => {
      first.result.current.setLastUpdateCheck(1718900000000);
    });
    expect(first.result.current.preferences.lastUpdateCheck).toBe(1718900000000);
    const stored = (await platform.store.get(PREFERENCES_STORE_KEY)) as {
      lastUpdateCheck: number | null;
    };
    expect(stored.lastUpdateCheck).toBe(1718900000000);
    // A fresh hook over the SAME memory store loads the stamp back.
    const second = renderHook(() => usePreferences());
    await waitFor(() =>
      expect(second.result.current.preferences.lastUpdateCheck).toBe(1718900000000),
    );
  });

  it("setLastUpdateCheck does NOT clobber a previously-set theme/pin (single-writer, T-25-05)", async () => {
    const { result } = renderHook(() => usePreferences());
    // Resolve the mount load first so writes merge against the loaded blob.
    await waitFor(() => expect(result.current.prefsLoaded).toBe(true));
    await act(async () => {
      result.current.setTheme("light");
    });
    await act(async () => {
      result.current.setPinnedToolIds(["base64", "unix-time"]);
    });
    await act(async () => {
      result.current.setLastUpdateCheck(1718900000000);
    });
    // The persisted blob carries the stamp AND keeps the prior theme + pins.
    const stored = (await platform.store.get(PREFERENCES_STORE_KEY)) as {
      theme: string;
      pinnedToolIds: string[];
      lastUpdateCheck: number | null;
    };
    expect(stored.lastUpdateCheck).toBe(1718900000000);
    expect(stored.theme).toBe("light");
    expect(stored.pinnedToolIds).toEqual(["base64", "unix-time"]);
    // And the live hook state agrees (one source of truth).
    expect(result.current.preferences.theme).toBe("light");
    expect(result.current.preferences.pinnedToolIds).toEqual(["base64", "unix-time"]);
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
