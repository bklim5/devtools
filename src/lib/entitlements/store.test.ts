// @vitest-environment jsdom
// Drop-diff in refreshEntitlements (D-07, MAS-IAP-05): a LIVE Pro→not-Pro
// transition (a refund/revoke landing while the app runs) fires the drop-notice
// exactly once, via the SHARED usePreferences singleton (prefs-blob-single-writer),
// and NEVER on an unlock (free→Pro) or a no-op (free→free / Pro→Pro).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// resolveEntitlements is the source of `next`; mock it so each test drives an
// exact Pro→free / free→Pro / unchanged transition without touching the platform.
const resolveMock = vi.hoisted(() => vi.fn());
vi.mock("./resolve", () => ({
  resolveEntitlements: resolveMock,
}));

// updatePreferences is the shared module singleton write path (the SAME fn
// markLicenseDropNotice's hook callback routes through). Spy it to assert the
// drop write — and ONLY the drop write — happens. whenPreferencesLoaded gates the
// write behind prefs hydration (resolves immediately here); the drop write is thus
// deferred a microtask, so Test 1 flushes before asserting.
const updatePreferencesMock = vi.hoisted(() => vi.fn());
const whenPreferencesLoadedMock = vi.hoisted(() =>
  vi.fn(() => Promise.resolve()),
);
vi.mock("@/shell/usePreferences", () => ({
  updatePreferences: updatePreferencesMock,
  whenPreferencesLoaded: whenPreferencesLoadedMock,
}));

/** Drain microtasks so the deferred (whenPreferencesLoaded-gated) drop write lands. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

import { FREE_SET, FULL_SET } from "./entitlements";
import {
  refreshEntitlements,
  resetEntitlementsForTest,
  setEntitlementsForTest,
} from "./store";

beforeEach(() => {
  resolveMock.mockReset();
  updatePreferencesMock.mockReset();
  resetEntitlementsForTest(); // snapshot back to FREE_SET, resolved=false
});

afterEach(() => {
  resetEntitlementsForTest();
});

describe("refreshEntitlements drop-diff (D-07 / T-28-08)", () => {
  it("Test 1: a live Pro→free drop sets licenseDropNoticeAck=false exactly once", async () => {
    setEntitlementsForTest(FULL_SET); // current = Pro
    resolveMock.mockResolvedValue(FREE_SET); // next = free (refund landed)

    await refreshEntitlements();
    await flush(); // the drop write is deferred behind whenPreferencesLoaded()

    expect(whenPreferencesLoadedMock).toHaveBeenCalledTimes(1);
    expect(updatePreferencesMock).toHaveBeenCalledTimes(1);
    expect(updatePreferencesMock).toHaveBeenCalledWith({
      licenseDropNoticeAck: false,
    });
  });

  it("Test 2: Pro→Pro (unchanged) never touches the drop flag", async () => {
    setEntitlementsForTest(FULL_SET);
    resolveMock.mockResolvedValue(FULL_SET); // identical set — no change

    await refreshEntitlements();
    await flush();

    expect(updatePreferencesMock).not.toHaveBeenCalled();
  });

  it("Test 3: a free→Pro unlock (purchase) does NOT fire the drop notice", async () => {
    setEntitlementsForTest(FREE_SET); // current = free
    resolveMock.mockResolvedValue(FULL_SET); // next = Pro — an unlock, not a drop

    await refreshEntitlements();
    await flush();

    expect(updatePreferencesMock).not.toHaveBeenCalled();
  });

  it("Test 4: free→free never writes", async () => {
    setEntitlementsForTest(FREE_SET);
    resolveMock.mockResolvedValue(FREE_SET);

    await refreshEntitlements();
    await flush();

    expect(updatePreferencesMock).not.toHaveBeenCalled();
  });
});
