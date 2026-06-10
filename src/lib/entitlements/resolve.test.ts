// @vitest-environment jsdom
// resolveEntitlements is THE single environment-split resolution point (ENT-03):
// Tauri (__TAURI_INTERNALS__ present) → FULL_SET, browser/jsdom → FREE_SET,
// with the persisted D-31 override able only to DOWNGRADE to FREE. The snapshot
// store propagates flips to subscribers exactly when the set changes.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetPlatformForTest, setPlatformForTest } from "@/lib/platform";
import { createStoreStub } from "@/lib/platform/stub";
import { makeMemoryPlatform } from "@/shell/testStore";
import { PREFERENCES_STORE_KEY } from "@/shell/preferences";
import { FREE_SET, FULL_SET } from "./entitlements";
import { isTauriEnv, resolveEntitlements } from "./resolve";
import {
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

async function seedStoredPrefs(blob: unknown): Promise<void> {
  const store = createStoreStub();
  await store.set(PREFERENCES_STORE_KEY, blob);
  setPlatformForTest(makeMemoryPlatform(store));
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

describe("resolveEntitlements (ENT-03 — the Phase 21 flip point)", () => {
  it("resolves FREE_SET outside Tauri (jsdom — no __TAURI_INTERNALS__)", async () => {
    expect(isTauriEnv()).toBe(false);
    await expect(resolveEntitlements()).resolves.toBe(FREE_SET);
  });

  it("resolves FULL_SET inside Tauri (everything unlocked pre-licensing)", async () => {
    setTauriEnv();
    expect(isTauriEnv()).toBe(true);
    await expect(resolveEntitlements()).resolves.toBe(FULL_SET);
  });

  it("entitlementsOverride=\"free\" downgrades to FREE_SET even inside Tauri (D-31)", async () => {
    setTauriEnv();
    await seedStoredPrefs({ entitlementsOverride: "free" });
    await expect(resolveEntitlements()).resolves.toBe(FREE_SET);
  });

  it("junk override values never change the environment base (coercer nulls them)", async () => {
    setTauriEnv();
    await seedStoredPrefs({ entitlementsOverride: "full" });
    await expect(resolveEntitlements()).resolves.toBe(FULL_SET);

    await seedStoredPrefs({ entitlementsOverride: 123 });
    await expect(resolveEntitlements()).resolves.toBe(FULL_SET);

    // Outside Tauri, junk cannot upgrade either — the base stays FREE.
    delete win.__TAURI_INTERNALS__;
    await seedStoredPrefs({ entitlementsOverride: "full" });
    await expect(resolveEntitlements()).resolves.toBe(FREE_SET);
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

    // Flip the environment to Tauri-FULL → the set changes → ONE notification.
    setTauriEnv();
    await refreshEntitlements();
    expect(calls).toBe(1);
    expect(getEntitlementsSnapshot()).toBe(FULL_SET);

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
