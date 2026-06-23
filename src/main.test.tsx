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
