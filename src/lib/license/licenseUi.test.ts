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
});
