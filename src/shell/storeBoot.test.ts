// @vitest-environment jsdom
// The store-build boot listener (D-06 / D-08, MAS-IAP-02 / MAS-IAP-05).
// mountStoreBoot() subscribes the live transaction-update listener and funnels
// every update through refreshEntitlements (a purchase unlocks, a refund drops),
// and NEVER calls restore() at boot (Restore is explicit-button-only, D-09 — a
// boot sync would leak an Apple-ID prompt).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// refreshEntitlements is the shared live-flip engine the listener funnels into;
// spy it so we can assert the captured onPurchaseUpdated handler re-runs it.
const refreshMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock("@/lib/entitlements/store", () => ({
  refreshEntitlements: refreshMock,
}));

import {
  platform,
  resetPlatformForTest,
  setPlatformForTest,
  type Platform,
} from "@/lib/platform";
import { browserPlatform } from "@/lib/platform/browser";
import { mountStoreBoot } from "./storeBoot";

beforeEach(() => {
  refreshMock.mockClear();
});

afterEach(() => {
  resetPlatformForTest();
});

/** Install an iap arm that captures the onPurchaseUpdated handler so the test can
 *  invoke it (simulating a background StoreKit transaction update), plus spies on
 *  restore/currentEntitlements. */
function installCapturingIap(): {
  fireUpdate: () => void;
  restoreSpy: ReturnType<typeof vi.fn>;
} {
  let captured: (() => void) | null = null;
  const restoreSpy = vi.fn(() => Promise.resolve());
  const stub: Platform = {
    ...browserPlatform,
    iap: {
      ...browserPlatform.iap,
      restore: restoreSpy,
      onPurchaseUpdated: vi.fn((handler: () => void) => {
        captured = handler;
        return Promise.resolve(() => {});
      }),
    },
  };
  setPlatformForTest(stub);
  return {
    fireUpdate: () => captured?.(),
    restoreSpy,
  };
}

describe("mountStoreBoot (D-06)", () => {
  it("Test 5: subscribes via onPurchaseUpdated; invoking the handler re-runs refreshEntitlements", async () => {
    const { fireUpdate } = installCapturingIap();
    const onPurchaseUpdated = platform.iap.onPurchaseUpdated as ReturnType<
      typeof vi.fn
    >;

    const unsub = await mountStoreBoot();

    expect(onPurchaseUpdated).toHaveBeenCalledTimes(1);
    expect(typeof unsub).toBe("function");

    // No update yet → the listener hasn't fired refreshEntitlements.
    expect(refreshMock).not.toHaveBeenCalled();

    // A background transaction update (purchase approval / refund / revoke) →
    // the captured handler re-runs the gate.
    fireUpdate();
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("Test 6: boot NEVER calls iap.restore (no silent AppStore.sync / Apple-ID prompt, D-08)", async () => {
    const { restoreSpy } = installCapturingIap();

    await mountStoreBoot();

    expect(restoreSpy).not.toHaveBeenCalled();
  });
});
