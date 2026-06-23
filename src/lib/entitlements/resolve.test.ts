// @vitest-environment jsdom
// resolveEntitlements is THE single environment-split resolution point (ENT-03):
// Tauri (__TAURI_INTERNALS__ present) → FULL_SET, browser/jsdom → FREE_SET,
// with the persisted D-31 override able only to DOWNGRADE to FREE. The snapshot
// store propagates flips to subscribers exactly when the set changes.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  initPlatform,
  platform,
  resetPlatformForTest,
  setPlatformForTest,
  type LicenseStatusPayload,
  type Platform,
} from "@/lib/platform";
import { createIapStub, createLicenseStub, createStoreStub } from "@/lib/platform/stub";
import { makeMemoryPlatform } from "@/shell/testStore";

// IS_APPSTORE is a build-time constant; mock the channel module so we can flip
// the appstore vs direct arm per-test. `channelMock.IS_APPSTORE` is mutated in
// each describe block (default false → direct, the existing baseFromLicense path).
const channelMock = vi.hoisted(() => ({ value: false }));
vi.mock("@/lib/platform/channel", () => ({
  get IS_APPSTORE() {
    return channelMock.value;
  },
}));
import { PREFERENCES_STORE_KEY } from "@/shell/preferences";
import { ENT_ORDERING, ENT_THEMING, FREE_SET, FULL_SET } from "./entitlements";
import { isTauriEnv, resolveEntitlements } from "./resolve";
import {
  clearEntitlementsOverride,
  getEntitlementsResolved,
  getEntitlementsSnapshot,
  refreshEntitlements,
  resetEntitlementsForTest,
  setEntitlementsForTest,
  subscribeEntitlements,
} from "./store";

type TauriWindow = Window & { __TAURI_INTERNALS__?: object };
const win = window as TauriWindow;

function setTauriEnv(): void {
  win.__TAURI_INTERNALS__ = {};
}

/** A license arm that returns a fixed status (D-85 flip tests). */
function licenseArm(status: LicenseStatusPayload): Platform["license"] {
  return { ...createLicenseStub(), status: () => Promise.resolve(status) };
}

const LICENSED_BOTH: LicenseStatusPayload = {
  state: "licensed",
  expiry: null,
  entitlements: [ENT_THEMING, ENT_ORDERING],
  maskedKey: null,
  email: null,
};

async function seedStoredPrefs(
  blob: unknown,
  license?: Platform["license"],
): Promise<void> {
  const store = createStoreStub();
  await store.set(PREFERENCES_STORE_KEY, blob);
  setPlatformForTest(makeMemoryPlatform(store, license));
}

/** An iap arm whose currentEntitlements() resolves a fixed set of codes (D-04
 *  StoreKit arm tests). The rest of the seam is the deterministic no-op stub. */
function iapArm(codes: string[]): Platform["iap"] {
  return { ...createIapStub(), currentEntitlements: () => Promise.resolve(codes) };
}

/** Seed prefs + an appstore platform: IS_APPSTORE true, a spied license arm
 *  (its status() must NEVER be called — T-28-03), and a StoreKit iap arm. */
async function seedAppstorePrefs(
  blob: unknown,
  iapCodes: string[],
): Promise<{ statusSpy: ReturnType<typeof vi.fn> }> {
  channelMock.value = true;
  const statusSpy = vi.fn(() => Promise.resolve(LICENSED_BOTH));
  const license: Platform["license"] = { ...createLicenseStub(), status: statusSpy };
  const store = createStoreStub();
  await store.set(PREFERENCES_STORE_KEY, blob);
  const base = makeMemoryPlatform(store, license);
  setPlatformForTest({ ...base, iap: iapArm(iapCodes) });
  return { statusSpy };
}

beforeEach(async () => {
  // Default: no Tauri marker, empty stored prefs.
  delete win.__TAURI_INTERNALS__;
  await seedStoredPrefs({});
});

afterEach(() => {
  delete win.__TAURI_INTERNALS__;
  channelMock.value = false; // restore the direct (baseFromLicense) channel
  resetEntitlementsForTest();
  resetPlatformForTest();
});

describe("resolveEntitlements (ENT-03 — the LIVE Phase 21 D-85 flip point)", () => {
  it("resolves FREE_SET outside Tauri (jsdom — no __TAURI_INTERNALS__, never touches licensing)", async () => {
    expect(isTauriEnv()).toBe(false);
    await expect(resolveEntitlements()).resolves.toBe(FREE_SET);
  });

  it("inside Tauri, a licensed status with both entitlements resolves Pro (BOTH)", async () => {
    setTauriEnv();
    expect(isTauriEnv()).toBe(true);
    await seedStoredPrefs({}, licenseArm(LICENSED_BOTH));
    const ents = await resolveEntitlements();
    expect([...ents].sort()).toEqual([ENT_ORDERING, ENT_THEMING].sort());
  });

  it("inside Tauri, an offlineGrace status keeps Pro active (Pro within grace)", async () => {
    setTauriEnv();
    await seedStoredPrefs(
      {},
      licenseArm({
        state: "offlineGrace",
        expiry: null,
        entitlements: [ENT_THEMING, ENT_ORDERING],
        maskedKey: null,
        email: null,
      }),
    );
    const ents = await resolveEntitlements();
    expect(ents.has(ENT_THEMING)).toBe(true);
    expect(ents.has(ENT_ORDERING)).toBe(true);
  });

  it("inside Tauri, a notActivated status locks to FREE_SET (the live free-tier flip)", async () => {
    setTauriEnv();
    await seedStoredPrefs(
      {},
      licenseArm({ state: "notActivated", hasStoredKey: false }),
    );
    const ents = await resolveEntitlements();
    expect(ents.size).toBe(0);
  });

  it("inside Tauri, refreshNeeded and problem both lock to FREE_SET (Pro dropped)", async () => {
    setTauriEnv();
    await seedStoredPrefs(
      {},
      licenseArm({ state: "refreshNeeded", hasStoredKey: true }),
    );
    expect((await resolveEntitlements()).size).toBe(0);

    await seedStoredPrefs(
      {},
      licenseArm({ state: "problem", problem: "foreignMachine", hasStoredKey: false }),
    );
    expect((await resolveEntitlements()).size).toBe(0);
  });

  it("awaits initPlatform() BEFORE reading license status — no Pro→FREE boot flash (store-init race)", async () => {
    // The race (tauri-store-async-init-race): `platform` starts as the browser
    // fallback and is swapped to the real impl only after initPlatform() resolves.
    // resolveEntitlements() must await init first, or a licensed launch reads the
    // browser stub (notActivated → FREE) and boots into the locked free state.
    //
    // Pin the ordering: the licensed seam must NOT be read until the init promise
    // has resolved. We register an init observer through the SAME public seam the
    // production code awaits; status() records whether init had resolved when it
    // ran. With the fix (await initPlatform() before the read), it always has.
    setTauriEnv();
    await seedStoredPrefs({}, {
      ...createLicenseStub(),
      status: () => Promise.resolve(LICENSED_BOTH),
    });

    let initResolved = false;
    const initObserver = initPlatform().then(() => {
      initResolved = true;
    });
    // resolveEntitlements() must internally await the SAME memoised init promise,
    // so by the time it reads status() and returns, init has resolved.
    const ents = await resolveEntitlements();
    await initObserver;
    expect(initResolved).toBe(true);
    expect([...ents].sort()).toEqual([ENT_ORDERING, ENT_THEMING].sort());
    // Sanity: the resolve went through the live (post-init) seam, not the fallback.
    expect((await platform.license.status()).state).toBe("licensed");
  });

  it("entitlements drive the set, not a blanket FULL (a licensed cert with ONLY theming grants theming, not ordering)", async () => {
    setTauriEnv();
    await seedStoredPrefs(
      {},
      licenseArm({
        state: "licensed",
        expiry: null,
        entitlements: [ENT_THEMING],
        maskedKey: null,
        email: null,
      }),
    );
    const ents = await resolveEntitlements();
    expect(ents.has(ENT_THEMING)).toBe(true);
    expect(ents.has(ENT_ORDERING)).toBe(false);
  });

  it("an unknown entitlement string in the payload is IGNORED (intersect with ALL_ENTITLEMENTS — T-21-12 over-grant)", async () => {
    setTauriEnv();
    await seedStoredPrefs(
      {},
      licenseArm({
        state: "licensed",
        expiry: null,
        entitlements: [ENT_THEMING, "pro.future-superpower"],
        maskedKey: null,
        email: null,
      }),
    );
    const ents = await resolveEntitlements();
    expect(ents.has(ENT_THEMING)).toBe(true);
    expect(ents.has("pro.future-superpower")).toBe(false);
    expect(ents.size).toBe(1);
  });

  it("entitlementsOverride=\"free\" downgrades to FREE_SET even when licensed (D-31 downgrade-only, unchanged)", async () => {
    setTauriEnv();
    await seedStoredPrefs(
      { entitlementsOverride: "free" },
      licenseArm(LICENSED_BOTH),
    );
    await expect(resolveEntitlements()).resolves.toBe(FREE_SET);
  });

  it("entitlementsOverride=\"full\" UPGRADES to FULL_SET under DEV even when notActivated (the e2e Pro-reach override)", async () => {
    // import.meta.env.DEV is true under vitest (same as a dev build) → the DEV-only
    // "full" override resolves Pro, so the e2e harness can reach Pro after the D-85
    // flip made an unlicensed install resolve FREE. A RELEASE bundle nulls "full" at
    // the coercer AND tree-shakes this branch — the prod downgrade-only invariant is
    // grep-pinned by check-dev-strip.sh.
    setTauriEnv();
    await seedStoredPrefs(
      { entitlementsOverride: "full" },
      licenseArm({ state: "notActivated", hasStoredKey: false }),
    );
    await expect(resolveEntitlements()).resolves.toBe(FULL_SET);
  });

  it("\"free\" still beats \"full\" precedence is moot — they are mutually exclusive stored values; junk override values never change the licensed base (coercer nulls them)", async () => {
    setTauriEnv();
    await seedStoredPrefs({ entitlementsOverride: 123 }, licenseArm(LICENSED_BOTH));
    expect((await resolveEntitlements()).size).toBe(2);

    await seedStoredPrefs({ entitlementsOverride: {} }, licenseArm(LICENSED_BOTH));
    expect((await resolveEntitlements()).size).toBe(2);

    // Outside Tauri the base is FREE; the DEV "full" override still upgrades there
    // too (the resolve branch is env-gated by import.meta.env.DEV, not by isTauriEnv).
    delete win.__TAURI_INTERNALS__;
    await seedStoredPrefs({ entitlementsOverride: "full" });
    await expect(resolveEntitlements()).resolves.toBe(FULL_SET);
  });
});

describe("resolveEntitlements (appstore arm — D-04/D-05 StoreKit source swap, MAS-IAP-02)", () => {
  it("baseFromStoreKit happy path: both pro codes resolve the FULL Pro set", async () => {
    setTauriEnv();
    await seedAppstorePrefs({}, [ENT_THEMING, ENT_ORDERING]);
    const ents = await resolveEntitlements();
    expect([...ents].sort()).toEqual([ENT_ORDERING, ENT_THEMING].sort());
    expect([...ents].sort()).toEqual([...FULL_SET].sort());
  });

  it("partial: only theming owned resolves theming alone (not ordering)", async () => {
    setTauriEnv();
    await seedAppstorePrefs({}, [ENT_THEMING]);
    const ents = await resolveEntitlements();
    expect(ents.has(ENT_THEMING)).toBe(true);
    expect(ents.has(ENT_ORDERING)).toBe(false);
    expect(ents.size).toBe(1);
  });

  it("over-grant guard: unexpected/over-broad codes are dropped, never exceed pro.theming+pro.ordering (T-28-01)", async () => {
    setTauriEnv();
    await seedAppstorePrefs({}, [ENT_THEMING, "pro.admin", "not-a-code"]);
    const ents = await resolveEntitlements();
    expect(ents.has(ENT_THEMING)).toBe(true);
    expect(ents.has("pro.admin")).toBe(false);
    expect(ents.has("not-a-code")).toBe(false);
    expect(ents.size).toBe(1);
  });

  it("empty StoreKit result (nothing owned / .unverified filtered to []) falls closed to FREE_SET (T-28-02)", async () => {
    setTauriEnv();
    await seedAppstorePrefs({}, []);
    expect((await resolveEntitlements()).size).toBe(0);
  });

  it("the store arm reads iap.currentEntitlements and NEVER platform.license.status (T-28-03 tamper guard)", async () => {
    setTauriEnv();
    const { statusSpy } = await seedAppstorePrefs({}, [ENT_THEMING, ENT_ORDERING]);
    const ents = await resolveEntitlements();
    expect([...ents].sort()).toEqual([ENT_ORDERING, ENT_THEMING].sort());
    expect(statusSpy).toHaveBeenCalledTimes(0);
  });

  it("store arm with nothing owned resolves FREE_SET, license.status still never called", async () => {
    setTauriEnv();
    const { statusSpy } = await seedAppstorePrefs({}, []);
    expect((await resolveEntitlements()).size).toBe(0);
    expect(statusSpy).toHaveBeenCalledTimes(0);
  });

  it("entitlementsOverride=\"free\" still downgrades the store arm to FREE_SET (T-28-04 downgrade-only invariant holds)", async () => {
    setTauriEnv();
    await seedAppstorePrefs({ entitlementsOverride: "free" }, [ENT_THEMING, ENT_ORDERING]);
    await expect(resolveEntitlements()).resolves.toBe(FREE_SET);
  });
});

describe("entitlements snapshot store", () => {
  it("refreshEntitlements notifies subscribers exactly when the set CHANGES", async () => {
    // The FIRST refresh flips the D-23-5 `resolved` gate (false→true via the
    // afterEach reset) — that ALWAYS notifies once, even when the SET is unchanged
    // (jsdom default FREE → resolved FREE). Drive that first resolve BEFORE
    // subscribing so this test isolates set-change notifications.
    await refreshEntitlements();
    expect(getEntitlementsResolved()).toBe(true);
    expect(getEntitlementsSnapshot()).toBe(FREE_SET);

    let calls = 0;
    const unsubscribe = subscribeEntitlements(() => {
      calls += 1;
    });

    // Resolved is already true; refreshing with no set change stays silent.
    await refreshEntitlements();
    expect(calls).toBe(0);

    // Flip to Tauri AND a licensed cert → the set changes to Pro → ONE notification.
    setTauriEnv();
    await seedStoredPrefs({}, licenseArm(LICENSED_BOTH));
    await refreshEntitlements();
    expect(calls).toBe(1);
    expect([...getEntitlementsSnapshot()].sort()).toEqual(
      [ENT_ORDERING, ENT_THEMING].sort(),
    );

    // Refreshing again with no change stays silent.
    await refreshEntitlements();
    expect(calls).toBe(1);

    unsubscribe();
  });

  it("refreshEntitlements flips the D-23-5 resolved gate on the FIRST resolve, even when the set is unchanged", async () => {
    // Fresh (afterEach reset → resolved false). jsdom default FREE → resolved FREE
    // (set unchanged), but the resolved flip must still fire ONE notification so
    // useAppearance can release its flash-free apply gate.
    expect(getEntitlementsResolved()).toBe(false);
    let calls = 0;
    const unsubscribe = subscribeEntitlements(() => {
      calls += 1;
    });

    await refreshEntitlements();
    expect(getEntitlementsResolved()).toBe(true);
    expect(getEntitlementsSnapshot()).toBe(FREE_SET); // set genuinely unchanged
    expect(calls).toBe(1); // the resolved flip alone notified

    unsubscribe();
  });

  it("setEntitlementsForTest marks resolved; resetEntitlementsForTest clears it (D-23-5)", () => {
    expect(getEntitlementsResolved()).toBe(false);
    setEntitlementsForTest(FULL_SET);
    expect(getEntitlementsResolved()).toBe(true);
    resetEntitlementsForTest();
    expect(getEntitlementsResolved()).toBe(false);
  });

  it("setEntitlementsForTest flips the snapshot and notifies", () => {
    let calls = 0;
    const unsubscribe = subscribeEntitlements(() => {
      calls += 1;
    });

    setEntitlementsForTest(FULL_SET);
    expect(getEntitlementsSnapshot()).toBe(FULL_SET);
    expect(calls).toBe(1);

    unsubscribe();
  });

  it("resetEntitlementsForTest restores the environment default and notifies", () => {
    setEntitlementsForTest(FULL_SET);

    let calls = 0;
    const unsubscribe = subscribeEntitlements(() => {
      calls += 1;
    });

    resetEntitlementsForTest();
    // jsdom (no __TAURI_INTERNALS__) → environment default is FREE.
    expect(getEntitlementsSnapshot()).toBe(FREE_SET);
    expect(calls).toBe(1);

    unsubscribe();
  });

  it("clearEntitlementsOverride removes a persisted 'free' override so the next refresh upgrades (activation-success path)", async () => {
    // The walkthrough-2026-06-12 decision: successful activation is the ONE
    // event allowed to clear the D-31 dev override (downgrade-only otherwise).
    setTauriEnv();
    await seedStoredPrefs({ entitlementsOverride: "free" }, licenseArm(LICENSED_BOTH));
    await refreshEntitlements();
    expect(getEntitlementsSnapshot()).toBe(FREE_SET);

    await clearEntitlementsOverride();
    await refreshEntitlements();
    expect([...getEntitlementsSnapshot()].sort()).toEqual(
      [ENT_ORDERING, ENT_THEMING].sort(),
    );
    expect([...(await resolveEntitlements())].sort()).toEqual(
      [ENT_ORDERING, ENT_THEMING].sort(),
    );
  });

  it("unsubscribe stops notifications", () => {
    let calls = 0;
    const unsubscribe = subscribeEntitlements(() => {
      calls += 1;
    });
    unsubscribe();

    setEntitlementsForTest(FULL_SET);
    expect(calls).toBe(0);
  });
});
