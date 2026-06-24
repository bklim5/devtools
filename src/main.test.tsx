// @vitest-environment jsdom
// The boot-gate (D-04 / T-28-22): main.tsx splits its licensing boot work
// STATICALLY by build channel. The store build (IS_APPSTORE true) mounts ONLY
// the StoreKit boot listener and NEVER reaches refreshLicenseUi (the Keygen
// platform.license.status path forbidden in the App Store build, 3.1.1). The
// direct build (IS_APPSTORE false) runs refreshLicenseUi exactly once and mounts
// nothing — byte-behaviourally unchanged.
//
// main.tsx renders at module top (createRoot), so every heavy boot dependency is
// mocked to an inert spy and a #root element is provided; we import main.tsx
// fresh per channel (vi.resetModules + vi.doMock) and assert which boot path ran.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mountStoreBootMock = vi.fn(() => Promise.resolve(() => {}));
const refreshLicenseUiMock = vi.fn(() => Promise.resolve());

/** Install all the inert module mocks main.tsx pulls at load, with IS_APPSTORE
 *  set to the requested channel, then import a FRESH main.tsx (its module-top
 *  runBoot() runs under that channel). Returns nothing — assert on the spies. */
async function importMainWithChannel(isAppstore: boolean): Promise<void> {
  vi.resetModules();
  mountStoreBootMock.mockClear();
  refreshLicenseUiMock.mockClear();

  // Ensure a #root element exists so createRoot(...).render() doesn't throw.
  document.body.innerHTML = '<div id="root"></div>';

  vi.doMock("@/lib/platform/channel", () => ({ IS_APPSTORE: isAppstore }));
  vi.doMock("@/shell/storeBoot", () => ({ mountStoreBoot: mountStoreBootMock }));
  // The dynamic import("@/lib/license/licenseUi") in the direct arm resolves to
  // this spy.
  vi.doMock("@/lib/license/licenseUi", () => ({
    refreshLicenseUi: refreshLicenseUiMock,
  }));

  // Inert mocks for the rest of main.tsx's module-top side effects.
  vi.doMock("@/lib/platform", () => ({
    initPlatform: vi.fn(() => Promise.resolve()),
  }));
  vi.doMock("@/lib/entitlements/store", () => ({
    refreshEntitlements: vi.fn(() => Promise.resolve()),
  }));
  vi.doMock("@/shell/usePreferences", () => ({
    ensurePreferencesLoaded: vi.fn(),
    getPreferencesLoaded: vi.fn(() => false),
    getSharedPreferences: vi.fn(() => ({})),
    subscribePreferences: vi.fn(() => () => {}),
  }));
  vi.doMock("@/shell/summon", () => ({ registerSummon: vi.fn() }));
  vi.doMock("@/shell/startupReveal", () => ({ revealOnStartup: vi.fn() }));
  vi.doMock("./router", () => ({ router: {} }));
  vi.doMock("react-router-dom", () => ({ RouterProvider: () => null }));
  vi.doMock("react-dom/client", () => ({
    createRoot: vi.fn(() => ({ render: vi.fn() })),
  }));
  vi.doMock("./index.css", () => ({}));

  await import("./main");
  // runBoot()'s direct arm does a dynamic import("@/lib/license/licenseUi").then(...).
  // A dynamic import resolves on a later task, so flush a macrotask (setTimeout 0)
  // before asserting refreshLicenseUi ran.
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.doUnmock("@/lib/platform/channel");
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("main.tsx boot gate (D-04 / T-28-22)", () => {
  it("Test 7: store build (IS_APPSTORE true) mounts the StoreKit boot listener and NEVER calls refreshLicenseUi", async () => {
    await importMainWithChannel(true);

    expect(mountStoreBootMock).toHaveBeenCalledTimes(1);
    // The Keygen direct-channel license-status path is never reached (D-04).
    expect(refreshLicenseUiMock).toHaveBeenCalledTimes(0);
  });

  it("Test 8: direct build (IS_APPSTORE false) calls refreshLicenseUi once and mounts nothing", async () => {
    await importMainWithChannel(false);

    expect(refreshLicenseUiMock).toHaveBeenCalledTimes(1);
    expect(mountStoreBootMock).toHaveBeenCalledTimes(0);
  });
});

// D-03 boot-path no-license-IPC + no-updater-IPC assertion (the load-bearing proof
// that Plan 29-01's Rust compile-out is SAFE and the inert seam plugin JS (D-05) is
// never driven). Per keygen-compileout-d04-proof: a string/package-absence grep is
// INSUFFICIENT — the shared tauriPlatform object carries license/updater IPC string
// literals (the iap arm pulls the whole object), so the proof must be a RUNTIME
// no-invoke assertion, not a grep.
//
// This block runs the REAL store-boot resolution: with IS_APPSTORE true + a Tauri env,
// it drives refreshEntitlements (which main.tsx fires at boot and mountStoreBoot re-runs
// on every transaction) against a spied platform and asserts the license-status /
// license-detail / activate / refresh / deactivate / updater-check spies are each
// called ZERO times, while iap.currentEntitlements IS reached. Imports run fresh per
// channel (the module-graph reads the doMocked channel + the test platform singleton).
describe("main boot-path no-license/updater IPC (D-03 / T-29-06)", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@/lib/platform/channel");
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    const w = window as unknown as { __TAURI_INTERNALS__?: object };
    delete w.__TAURI_INTERNALS__;
  });

  it("the store boot resolution invokes 0 license/updater IPC and reaches iap.currentEntitlements", async () => {
    vi.resetModules();
    // Test 7/8's importMainWithChannel doMocks these inert — undo them so this
    // block runs the REAL entitlements store + seam (the no-invoke assertion needs
    // the real resolution arm, not an inert spy).
    vi.doUnmock("@/lib/entitlements/store");
    vi.doUnmock("@/lib/platform");
    vi.doUnmock("@/shell/usePreferences");
    vi.doMock("@/lib/platform/channel", () => ({ IS_APPSTORE: true }));

    // Real seam + entitlements store from the fresh graph; a Tauri env so the
    // resolution takes the native (not the jsdom-FREE) arm.
    const w = window as unknown as { __TAURI_INTERNALS__?: object };
    w.__TAURI_INTERNALS__ = {};

    const platformMod = await import("@/lib/platform");
    const { createStoreStub, createLicenseStub } = await import(
      "@/lib/platform/stub"
    );
    const { makeMemoryPlatform } = await import("@/shell/testStore");
    const { refreshEntitlements, resetEntitlementsForTest } = await import(
      "@/lib/entitlements/store"
    );
    const { PREFERENCES_STORE_KEY, DEFAULT_PREFERENCES } = await import(
      "@/shell/preferences"
    );
    const { resetPreferencesForTest } = await import("@/shell/usePreferences");

    resetEntitlementsForTest();
    resetPreferencesForTest();

    // Spy every license IPC command (the Rust command names: license_status,
    // license_status_detail, activate_license, refresh_license, deactivate_machine)
    // + the updater check; resolve a Pro code from iap_current_entitlements. The
    // base stub gives the correctly-typed return shapes; vi.fn wraps each so the
    // call counts are observable.
    const licenseBase = createLicenseStub();
    const licenseStatusSpy = vi.fn(licenseBase.status);
    const licenseDetailSpy = vi.fn(licenseBase.statusDetail);
    const activateSpy = vi.fn(licenseBase.activate);
    const licenseRefreshSpy = vi.fn(licenseBase.refresh);
    const deactivateSpy = vi.fn(licenseBase.deactivate);
    const updaterCheckSpy = vi.fn(async () => null);
    const iapCurrentSpy = vi.fn(async () => ["pro.theming", "pro.ordering"]);

    const store = createStoreStub();
    await store.set(PREFERENCES_STORE_KEY, { ...DEFAULT_PREFERENCES });
    const base = makeMemoryPlatform(store);
    platformMod.setPlatformForTest({
      ...base,
      license: {
        status: licenseStatusSpy,
        statusDetail: licenseDetailSpy,
        activate: activateSpy,
        refresh: licenseRefreshSpy,
        deactivate: deactivateSpy,
      },
      updater: { ...base.updater, check: updaterCheckSpy },
      iap: { ...base.iap, currentEntitlements: iapCurrentSpy },
    });

    // The boot resolution (main.tsx fires this; mountStoreBoot re-runs it live).
    await refreshEntitlements();

    // D-03: the store boot path invokes ZERO license/updater IPC...
    expect(licenseStatusSpy).toHaveBeenCalledTimes(0);
    expect(licenseDetailSpy).toHaveBeenCalledTimes(0);
    expect(activateSpy).toHaveBeenCalledTimes(0);
    expect(licenseRefreshSpy).toHaveBeenCalledTimes(0);
    expect(deactivateSpy).toHaveBeenCalledTimes(0);
    expect(updaterCheckSpy).toHaveBeenCalledTimes(0);
    // ...while the StoreKit entitlement read IS reached.
    expect(iapCurrentSpy.mock.calls.length).toBeGreaterThanOrEqual(1);

    platformMod.resetPlatformForTest();
  });
});
