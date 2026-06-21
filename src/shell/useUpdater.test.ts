// @vitest-environment jsdom
// useUpdater is the shared updater state machine (D-25-3). These tests pin the two
// invariants Plan 04 relies on — and that unit tests CAN prove (the real
// download/verify round-trip + the on-disk prefs.json persistence are Plan 05
// real-WKWebView gates):
//   1. IN-FLIGHT DE-DUPE — two concurrent runUpdateCheck calls fire
//      platform.updater.check EXACTLY once (one network call, T-25-18).
//   2. LOAD-SAFE STAMP (no clobber) — a stamp fired BEFORE a delayed load that
//      carries NON-default prefs must not overwrite them; the user's theme/pins
//      survive AND the stamp lands (T-25-17, memory tauri-store-async-init-race).
// Plus the manual-vs-silent status discipline + stamp-on-every-resolution (D-25-6).
//
// All checking goes through the platform seam (setPlatformForTest + an injected
// updater/store stub) — no @tauri-apps import, no network.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resetPlatformForTest,
  setPlatformForTest,
  type Platform,
  type Store,
  type UpdateInfo,
} from "@/lib/platform";
import { createStoreStub } from "@/lib/platform/stub";
import { makeMemoryPlatform } from "./testStore";
import {
  getSharedPreferences,
  resetPreferencesForTest,
} from "./usePreferences";
import { DEFAULT_PREFERENCES, PREFERENCES_STORE_KEY } from "./preferences";
import {
  getChecking,
  getUpdateInfo,
  getUpdateStatus,
  resetUpdaterForTest,
  runUpdateCheck,
} from "./useUpdater";

const SAMPLE_UPDATE: UpdateInfo = {
  version: "9.9.9",
  notes: "shiny",
  date: "2026-06-21",
};

/** A manually-resolvable deferred so two checks can overlap before the network
 *  call settles. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Install a platform whose updater.check resolves `info` (default: no update) and
 *  records its call count. Returns the spy so tests can assert exactly-once. */
function installPlatform(opts?: {
  check?: Platform["updater"]["check"];
  store?: Store;
}) {
  const base = makeMemoryPlatform(opts?.store ?? createStoreStub());
  const check = vi.fn(opts?.check ?? (async () => null));
  const platform: Platform = {
    ...base,
    updater: { ...base.updater, check },
  };
  setPlatformForTest(platform);
  return { check };
}

beforeEach(() => {
  resetPreferencesForTest();
  resetUpdaterForTest();
});

afterEach(() => {
  resetPlatformForTest();
  vi.restoreAllMocks();
});

describe("useUpdater — in-flight de-dupe (D-25-3, T-25-18)", () => {
  it("two concurrent checks fire platform.updater.check EXACTLY once", async () => {
    const gate = deferred<UpdateInfo | null>();
    const { check } = installPlatform({ check: () => gate.promise });

    // Fire both entry points before releasing the gate — they overlap.
    const a = runUpdateCheck(false); // silent launch
    const b = runUpdateCheck(true); // manual tray click
    expect(getChecking()).toBe(true);

    gate.resolve(null);
    await Promise.all([a, b]);

    // The second caller reused the in-flight promise → ONE network call.
    expect(check).toHaveBeenCalledTimes(1);
    expect(getChecking()).toBe(false);
  });

  it("a subsequent (non-overlapping) call runs a FRESH check", async () => {
    const { check } = installPlatform();
    await runUpdateCheck(true);
    await runUpdateCheck(true);
    expect(check).toHaveBeenCalledTimes(2);
  });
});

describe("useUpdater — stamp on every resolution (D-25-6)", () => {
  it("STAMP-ON-CURRENT: manual current stamps lastUpdateCheck + sets the up-to-date status", async () => {
    const before = Date.now();
    installPlatform({ check: async () => null });
    await runUpdateCheck(true);

    const stamp = getSharedPreferences().lastUpdateCheck;
    expect(typeof stamp).toBe("number");
    expect(stamp as number).toBeGreaterThanOrEqual(before);
    expect(getUpdateStatus()).toBe("You're up to date");
  });

  it("SILENT-QUIET: a silent current stamps but sets NO status", async () => {
    installPlatform({ check: async () => null });
    await runUpdateCheck(false);

    expect(typeof getSharedPreferences().lastUpdateCheck).toBe("number");
    expect(getUpdateStatus()).toBeNull();
  });

  it("STAMP-ON-ERROR: a manual error stamps + sets the failed status", async () => {
    installPlatform({
      check: async () => {
        throw new Error("offline");
      },
    });
    await runUpdateCheck(true);

    expect(typeof getSharedPreferences().lastUpdateCheck).toBe("number");
    expect(getUpdateStatus()).toBe("Update check failed");
    expect(getUpdateInfo()).toBeNull();
  });

  it("STAMP-ON-UPDATE: a detected update sets updateInfo + stamps, no up-to-date status", async () => {
    installPlatform({ check: async () => SAMPLE_UPDATE });
    await runUpdateCheck(true);

    expect(getUpdateInfo()).toEqual(SAMPLE_UPDATE);
    expect(typeof getSharedPreferences().lastUpdateCheck).toBe("number");
    expect(getUpdateStatus()).toBeNull();
  });
});

describe("useUpdater — load-safe stamp does NOT clobber persisted prefs (T-25-17)", () => {
  it("a stamp fired before a DELAYED non-default load preserves the real theme/pins", async () => {
    // Back the store with a DELAYED get that returns a NON-DEFAULT blob only after
    // the stamp has had a chance to fire — reproducing the async-init race window.
    const NON_DEFAULT = {
      ...DEFAULT_PREFERENCES,
      theme: "light",
      pinnedToolIds: ["base64", "unix-time"],
      entitlementsOverride: "free",
    };
    const loadGate = deferred<unknown>();
    const map = new Map<string, unknown>();
    const delayedStore: Store = {
      get(key) {
        return key === PREFERENCES_STORE_KEY
          ? loadGate.promise
          : Promise.resolve(map.get(key));
      },
      set(key, value) {
        map.set(key, value);
        return Promise.resolve();
      },
    };
    installPlatform({ check: async () => null, store: delayedStore });

    // Fire the check WITHOUT awaiting the load — runUpdateCheck must wait for the
    // real blob (whenPreferencesLoaded) before merging the stamp.
    const checkPromise = runUpdateCheck(true);
    // Now let the real (non-default) persisted blob land.
    loadGate.resolve(NON_DEFAULT);
    await checkPromise;

    const prefs = getSharedPreferences();
    // The stamp landed...
    expect(typeof prefs.lastUpdateCheck).toBe("number");
    // ...AND the user's real non-default values were preserved (not clobbered by
    // DEFAULT_PREFERENCES + stamp).
    expect(prefs.theme).toBe("light");
    expect(prefs.pinnedToolIds).toEqual(["base64", "unix-time"]);
    expect(prefs.entitlementsOverride).toBe("free");
  });
});
