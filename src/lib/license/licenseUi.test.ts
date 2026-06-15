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
  refreshLicenseUiDetailed,
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

const LICENSED_WITH_KEY: LicenseStatusPayload = {
  state: "licensed",
  expiry: "2027-01-01T00:00:00Z",
  entitlements: ["pro.theming", "pro.ordering"],
  maskedKey: "••••••••AB12",
  email: "buyer@example.com",
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

  it("refreshLicenseUi() reads the KEYCHAIN-FREE status() seam, NOT statusDetail() (T-19-10, finding 2)", async () => {
    // The startup/footer/panel path must use status() (no masked-key Keychain
    // read on a licensed launch). Prove it never calls statusDetail().
    const status = vi.fn(() => Promise.resolve(PROBLEM));
    const statusDetail = vi.fn(() => Promise.resolve(PROBLEM));
    setPlatformForTest({
      ...makeMemoryPlatform(),
      license: { ...noopLicense, status, statusDetail },
    });

    await refreshLicenseUi();

    expect(status).toHaveBeenCalledTimes(1);
    expect(statusDetail).not.toHaveBeenCalled();
  });

  it("refreshLicenseUiDetailed() reads the ROUTE-ONLY statusDetail() seam (D-89 masked key)", async () => {
    // The license settings route resolves the masked key via statusDetail() —
    // the ONLY licensed path allowed to read the Keychain.
    const LICENSED_WITH_KEY: LicenseStatusPayload = {
      state: "licensed",
      expiry: null,
      entitlements: ["pro.theming"],
      maskedKey: "••••••••AB12",
      email: "buyer@example.com",
    };
    const status = vi.fn(() =>
      Promise.resolve<LicenseStatusPayload>({
        ...LICENSED_WITH_KEY,
        maskedKey: null,
        email: null,
      }),
    );
    const statusDetail = vi.fn(() => Promise.resolve(LICENSED_WITH_KEY));
    setPlatformForTest({
      ...makeMemoryPlatform(),
      license: { ...noopLicense, status, statusDetail },
    });

    await refreshLicenseUiDetailed();

    expect(statusDetail).toHaveBeenCalledTimes(1);
    expect(status).not.toHaveBeenCalled();
    const snap = getLicenseUiSnapshot();
    expect(snap.state === "licensed" ? snap.maskedKey : null).toBe("••••••••AB12");
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

  // --- maskedKey/email stickiness (Phase 22.1 bug fix) --------------------
  // A non-detailed refresh (status(), the KEYCHAIN-FREE seam) resolves
  // maskedKey:null/email:null for a licensed machine. It must NEVER overwrite a
  // populated key/email from a prior detailed (route) read — otherwise visiting
  // #/settings/license shows the key, then a footer/panel refreshLicenseUi()
  // blanks it. The non-detailed payload CARRIES FORWARD current's key/email when
  // the state is unchanged (licensed/offlineGrace, populated); the user-initiated
  // detailed read still updates them. payloadsEqual is NOT weakened.

  it("a non-detailed refresh after a detailed read KEEPS the maskedKey/email (no downgrade to null)", async () => {
    const detailed = LICENSED_WITH_KEY;
    // status() is keychain-free: same licensed state, but key/email blanked.
    const keychainFree: LicenseStatusPayload = {
      ...LICENSED_WITH_KEY,
      maskedKey: null,
      email: null,
    };
    setPlatformForTest({
      ...makeMemoryPlatform(),
      license: {
        ...noopLicense,
        status: () => Promise.resolve(keychainFree),
        statusDetail: () => Promise.resolve(detailed),
      },
    });

    // Route reads detailed → key/email populated.
    await refreshLicenseUiDetailed();
    const afterDetailed = getLicenseUiSnapshot();
    expect(afterDetailed.state === "licensed" ? afterDetailed.maskedKey : null).toBe(
      "••••••••AB12",
    );

    // A subsequent non-detailed refresh (footer/panel) must NOT blank them.
    await refreshLicenseUi();
    const afterPlain = getLicenseUiSnapshot();
    expect(afterPlain.state === "licensed" ? afterPlain.maskedKey : null).toBe(
      "••••••••AB12",
    );
    expect(afterPlain.state === "licensed" ? afterPlain.email : null).toBe(
      "buyer@example.com",
    );
  });

  it("the carry-forward stickiness applies to offlineGrace too", async () => {
    const detailed = OFFLINE_GRACE;
    const keychainFree: LicenseStatusPayload = {
      ...OFFLINE_GRACE,
      maskedKey: null,
      email: null,
    };
    setPlatformForTest({
      ...makeMemoryPlatform(),
      license: {
        ...noopLicense,
        status: () => Promise.resolve(keychainFree),
        statusDetail: () => Promise.resolve(detailed),
      },
    });

    await refreshLicenseUiDetailed();
    await refreshLicenseUi();
    const snap = getLicenseUiSnapshot();
    expect(snap.state === "offlineGrace" ? snap.maskedKey : null).toBe(
      "••••••••AB12",
    );
    expect(snap.state === "offlineGrace" ? snap.email : null).toBe(
      "buyer@example.com",
    );
  });

  it("a detailed read STILL updates the maskedKey/email (carry-forward never blocks a real value)", async () => {
    // Seed a stale detailed snapshot, then a fresh detailed read with a new key.
    setLicenseUiForTest(LICENSED_WITH_KEY);
    expect(
      (() => {
        const s = getLicenseUiSnapshot();
        return s.state === "licensed" ? s.maskedKey : null;
      })(),
    ).toBe("••••••••AB12");

    const renewed: LicenseStatusPayload = {
      ...LICENSED_WITH_KEY,
      maskedKey: "••••••••ZZ99",
      email: "renewed@example.com",
    };
    setPlatformForTest({
      ...makeMemoryPlatform(),
      license: {
        ...noopLicense,
        statusDetail: () => Promise.resolve(renewed),
      },
    });

    await refreshLicenseUiDetailed();
    const snap = getLicenseUiSnapshot();
    expect(snap.state === "licensed" ? snap.maskedKey : null).toBe("••••••••ZZ99");
    expect(snap.state === "licensed" ? snap.email : null).toBe(
      "renewed@example.com",
    );
  });

  it("a non-detailed refresh that CHANGES state (licensed→refreshNeeded) still flips, no stale carry-forward", async () => {
    // The carry-forward is ONLY same-state; a real drop must propagate.
    setLicenseUiForTest(LICENSED_WITH_KEY);
    const dropped: LicenseStatusPayload = {
      state: "refreshNeeded",
      hasStoredKey: true,
    };
    setPlatformForTest({
      ...makeMemoryPlatform(),
      license: { ...noopLicense, status: () => Promise.resolve(dropped) },
    });

    const listener = vi.fn();
    const unsubscribe = subscribeLicenseUi(listener);
    await refreshLicenseUi();
    expect(getLicenseUiSnapshot()).toEqual(dropped);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("a non-detailed refresh whose key/email already match is still a silent no-op (carry-forward doesn't force a notify)", async () => {
    // current already has the key (e.g. a prior detailed read); the keychain-free
    // status() blanks it, but carry-forward restores the SAME values → payloads
    // equal → no notify.
    setLicenseUiForTest(LICENSED_WITH_KEY);
    setPlatformForTest({
      ...makeMemoryPlatform(),
      license: {
        ...noopLicense,
        status: () =>
          Promise.resolve<LicenseStatusPayload>({
            ...LICENSED_WITH_KEY,
            maskedKey: null,
            email: null,
          }),
      },
    });

    const listener = vi.fn();
    const unsubscribe = subscribeLicenseUi(listener);
    await refreshLicenseUi();
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});
