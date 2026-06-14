// licenseUi snapshot store (D-43/D-44 source of truth): refreshLicenseUi()
// pulls platform.license.status() through the seam (injected test platform)
// and notifies subscribers ONLY on change; the default snapshot matches a
// fresh machine (notActivated, no stored key). No DOM needed — node env.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  resetPlatformForTest,
  setPlatformForTest,
  type LicenseStatusPayload,
  type Platform,
} from "@/lib/platform";
import { makeMemoryPlatform, noopLicense } from "@/shell/testStore";
import {
  getLicenseUiSnapshot,
  refreshLicenseUi,
  resetLicenseUiForTest,
  setLicenseUiForTest,
  subscribeLicenseUi,
} from "./licenseUi";

afterEach(() => {
  resetLicenseUiForTest();
  resetPlatformForTest();
});

/** A memory platform whose license.status resolves the given payload. */
function platformWithStatus(payload: LicenseStatusPayload): Platform {
  return {
    ...makeMemoryPlatform(),
    license: { ...noopLicense, status: () => Promise.resolve(payload) },
  };
}

const PROBLEM: LicenseStatusPayload = {
  state: "problem",
  problem: "corrupt",
  hasStoredKey: false,
};

const OFFLINE_GRACE: LicenseStatusPayload = {
  state: "offlineGrace",
  expiry: "2026-07-12T15:14:47.247Z",
  entitlements: ["pro.theming", "pro.ordering"],
  maskedKey: "••••••••AB12",
  email: "buyer@example.com",
};

const REFRESH_NEEDED: LicenseStatusPayload = {
  state: "refreshNeeded",
  hasStoredKey: true,
};

describe("licenseUi snapshot store", () => {
  it("defaults to { state: 'notActivated', hasStoredKey: false }", () => {
    expect(getLicenseUiSnapshot()).toEqual({
      state: "notActivated",
      hasStoredKey: false,
    });
  });

  it("refreshLicenseUi() pulls platform.license.status() and notifies subscribers", async () => {
    setPlatformForTest(platformWithStatus(PROBLEM));
    const listener = vi.fn();
    const unsubscribe = subscribeLicenseUi(listener);

    await refreshLicenseUi();

    expect(getLicenseUiSnapshot()).toEqual(PROBLEM);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("notifies ONLY on change — an unchanged refresh is silent", async () => {
    setPlatformForTest(platformWithStatus(PROBLEM));
    const listener = vi.fn();
    const unsubscribe = subscribeLicenseUi(listener);

    await refreshLicenseUi();
    await refreshLicenseUi(); // same payload again — must short-circuit

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("an unchanged default refresh never notifies (browser stub = notActivated)", async () => {
    // No injection: the browser fallback's deterministic license stub resolves
    // the same payload as the default snapshot, so nothing fires.
    const listener = vi.fn();
    const unsubscribe = subscribeLicenseUi(listener);

    await refreshLicenseUi();

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("setLicenseUiForTest forces a snapshot and resetLicenseUiForTest restores the default", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeLicenseUi(listener);

    setLicenseUiForTest(PROBLEM);
    expect(getLicenseUiSnapshot()).toEqual(PROBLEM);
    expect(listener).toHaveBeenCalledTimes(1);

    resetLicenseUiForTest();
    expect(getLicenseUiSnapshot()).toEqual({
      state: "notActivated",
      hasStoredKey: false,
    });
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  // --- 5-state mirror (Plan 21-02): offlineGrace + refreshNeeded ----------

  it("refreshLicenseUi() propagates an offlineGrace payload and change-detects it", async () => {
    setPlatformForTest(platformWithStatus(OFFLINE_GRACE));
    const listener = vi.fn();
    const unsubscribe = subscribeLicenseUi(listener);

    await refreshLicenseUi();
    expect(getLicenseUiSnapshot()).toEqual(OFFLINE_GRACE);
    expect(listener).toHaveBeenCalledTimes(1);

    // A second identical refresh is a no-op (payloadsEqual offlineGrace arm).
    await refreshLicenseUi();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("refreshLicenseUi() propagates a refreshNeeded payload and change-detects it", async () => {
    setPlatformForTest(platformWithStatus(REFRESH_NEEDED));
    const listener = vi.fn();
    const unsubscribe = subscribeLicenseUi(listener);

    await refreshLicenseUi();
    expect(getLicenseUiSnapshot()).toEqual(REFRESH_NEEDED);
    expect(listener).toHaveBeenCalledTimes(1);

    // Identical refresh short-circuits (payloadsEqual refreshNeeded arm).
    await refreshLicenseUi();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("a state change from offlineGrace to refreshNeeded notifies", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeLicenseUi(listener);

    setLicenseUiForTest(OFFLINE_GRACE);
    expect(getLicenseUiSnapshot()).toEqual(OFFLINE_GRACE);
    expect(listener).toHaveBeenCalledTimes(1);

    setLicenseUiForTest(REFRESH_NEEDED);
    expect(getLicenseUiSnapshot()).toEqual(REFRESH_NEEDED);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("offlineGrace differing only in entitlements is a change", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeLicenseUi(listener);

    setLicenseUiForTest(OFFLINE_GRACE);
    expect(listener).toHaveBeenCalledTimes(1);

    setLicenseUiForTest({
      ...OFFLINE_GRACE,
      entitlements: ["pro.theming"],
    });
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("a maskedKey-only diff (D-89) is a change", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeLicenseUi(listener);

    setLicenseUiForTest(OFFLINE_GRACE);
    expect(listener).toHaveBeenCalledTimes(1);

    setLicenseUiForTest({ ...OFFLINE_GRACE, maskedKey: "••••••••ZZZZ" });
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("an email-only diff (D-89) is a change", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeLicenseUi(listener);

    setLicenseUiForTest(OFFLINE_GRACE);
    expect(listener).toHaveBeenCalledTimes(1);

    setLicenseUiForTest({ ...OFFLINE_GRACE, email: "other@example.com" });
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
});
