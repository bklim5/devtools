// @vitest-environment jsdom
// resolveEntitlements is THE single environment-split resolution point (ENT-03):
// Tauri (__TAURI_INTERNALS__ present) → FULL_SET, browser/jsdom → FREE_SET,
// with the persisted D-31 override able only to DOWNGRADE to FREE. The snapshot
// store propagates flips to subscribers exactly when the set changes.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  initPlatform,
  platform,
  resetPlatformForTest,
  setPlatformForTest,
  type LicenseStatusPayload,
  type Platform,
} from "@/lib/platform";
import { createLicenseStub, createStoreStub } from "@/lib/platform/stub";
import { makeMemoryPlatform } from "@/shell/testStore";
import { PREFERENCES_STORE_KEY } from "@/shell/preferences";
import { ENT_ORDERING, ENT_THEMING, FREE_SET, FULL_SET } from "./entitlements";
import { isTauriEnv, resolveEntitlements } from "./resolve";
import {
  clearEntitlementsOverride,
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

beforeEach(async () => {
  // Default: no Tauri marker, empty stored prefs.
  delete win.__TAURI_INTERNALS__;
  await seedStoredPrefs({});
});

afterEach(() => {
  delete win.__TAURI_INTERNALS__;
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

describe("entitlements snapshot store", () => {
  it("refreshEntitlements notifies subscribers exactly when the set CHANGES", async () => {
    // jsdom default snapshot is FREE; with no override the resolved set is also
    // FREE → equal sets must short-circuit (no notification).
    let calls = 0;
    const unsubscribe = subscribeEntitlements(() => {
      calls += 1;
    });

    await refreshEntitlements();
    expect(calls).toBe(0);
    expect(getEntitlementsSnapshot()).toBe(FREE_SET);

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
