// platform.iap seam tests (MAS-IAP-01/04, success criterion 3 / D-10). Like the
// rest of the seam, these run WITHOUT any @tauri-apps / @choochmeque mock — the
// whole point of the env-safe seam (FND-04) is that importing it under node/jsdom
// never pulls in the native StoreKit plugin. The no-op arm proves vitest/jsdom
// exercise the seam with ZERO native call (T-26-05), and the stub can never
// fabricate a Pro grant (T-26-06).
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  platform,
  setPlatformForTest,
  resetPlatformForTest,
  type IapProduct,
  type IapPurchaseResult,
  type Platform,
} from "./index";
import { browserPlatform } from "./browser";

afterEach(() => {
  resetPlatformForTest();
});

describe("platform seam — iap no-op arm (MAS-IAP-01/04)", () => {
  it("browser fallback iap.products / currentEntitlements resolve [] with no native call (Test 1)", async () => {
    setPlatformForTest(browserPlatform);
    await expect(platform.iap.products()).resolves.toEqual([]);
    await expect(platform.iap.currentEntitlements()).resolves.toEqual([]);
  });

  it("browser fallback iap mutations reject with the serviceUnreachable code (Test 2, T-26-06)", async () => {
    setPlatformForTest(browserPlatform);
    // The non-Tauri arm rejects purchase/restore — it can NEVER fabricate a Pro
    // grant (mirrors the license stub's reject discipline).
    await expect(platform.iap.purchase("com.tinkerdev.app.pro")).rejects.toEqual(
      { code: "serviceUnreachable" },
    );
    await expect(platform.iap.restore()).rejects.toEqual({
      code: "serviceUnreachable",
    });
  });

  it("browser fallback iap.onPurchaseUpdated returns a no-op unsubscribe, never fires (Test 3)", async () => {
    setPlatformForTest(browserPlatform);
    const handler = vi.fn();
    const unsubscribe = await platform.iap.onPurchaseUpdated(handler);
    expect(typeof unsubscribe).toBe("function");
    // The storekit://updated event never fires outside Tauri — the subscription
    // is inert and the handler is never called. Unsubscribing is a safe no-op.
    expect(handler).not.toHaveBeenCalled();
    expect(() => unsubscribe()).not.toThrow();
  });
});

describe("platform seam — iap accessor forwarding (success criterion 3 / D-10)", () => {
  it("setPlatformForTest injects an iap stub and platform.iap forwards to it (Test 4)", async () => {
    // Spread the shared factory and override ONLY the iap arm so the delegate is
    // proven to read the ACTIVE impl (not a snapshot) — the fixture can only
    // surface if `platform.iap` forwards to the injected stub.
    const fixture: IapProduct[] = [
      { id: "com.tinkerdev.app.pro", displayPrice: "$9.00", displayName: "TinkerDev Pro" },
    ];
    const products = vi.fn().mockResolvedValue(fixture);
    const purchase = vi
      .fn()
      .mockResolvedValue({ state: "success", entitlements: ["pro.theming"] });
    const stub: Platform = {
      ...browserPlatform,
      iap: {
        products,
        purchase,
        restore: vi.fn().mockResolvedValue(undefined),
        currentEntitlements: vi.fn().mockResolvedValue(["pro.theming"]),
        onPurchaseUpdated: vi.fn().mockResolvedValue(() => {}),
      },
    };
    setPlatformForTest(stub);

    await expect(platform.iap.products()).resolves.toEqual(fixture);
    await expect(
      platform.iap.purchase("com.tinkerdev.app.pro"),
    ).resolves.toMatchObject({ state: "success", entitlements: ["pro.theming"] });
    await expect(platform.iap.currentEntitlements()).resolves.toEqual([
      "pro.theming",
    ]);
    expect(products).toHaveBeenCalledTimes(1);
    expect(purchase).toHaveBeenCalledWith("com.tinkerdev.app.pro");
  });

  it("resetPlatformForTest restores the deterministic browser no-op iap arm (Test 5)", async () => {
    // Inject a Pro-granting stub, then reset — the accessor must fall back to the
    // browser no-op arm ([] / reject), never the injected grant.
    const stub: Platform = {
      ...browserPlatform,
      iap: {
        products: vi.fn().mockResolvedValue([
          { id: "x", displayPrice: "$0", displayName: "x" },
        ]),
        purchase: vi
          .fn()
          .mockResolvedValue({ state: "success", entitlements: ["pro.theming"] }),
        restore: vi.fn().mockResolvedValue(undefined),
        currentEntitlements: vi.fn().mockResolvedValue(["pro.theming"]),
        onPurchaseUpdated: vi.fn().mockResolvedValue(() => {}),
      },
    };
    setPlatformForTest(stub);
    await expect(platform.iap.currentEntitlements()).resolves.toEqual([
      "pro.theming",
    ]);

    resetPlatformForTest();

    await expect(platform.iap.currentEntitlements()).resolves.toEqual([]);
    await expect(platform.iap.purchase("x")).rejects.toEqual({
      code: "serviceUnreachable",
    });
  });
});

describe("platform seam — IapPurchaseResult contract (MAS-IAP-01)", () => {
  it("the three-state union is exhaustively handled (Test 6, compile-checked)", () => {
    // A TS switch over every state; the `never` default makes a missing case a
    // COMPILE error, pinning the union shape (success | userCancelled | pending).
    const describe = (r: IapPurchaseResult): string => {
      switch (r.state) {
        case "success":
          return `granted:${r.entitlements.join(",")}`;
        case "userCancelled":
          return "cancelled";
        case "pending":
          return "pending"; // calm "waiting for approval", not a failure
        default: {
          const exhaustive: never = r;
          return exhaustive;
        }
      }
    };

    expect(
      describe({ state: "success", entitlements: ["pro.theming", "pro.ordering"] }),
    ).toBe("granted:pro.theming,pro.ordering");
    expect(describe({ state: "userCancelled" })).toBe("cancelled");
    expect(describe({ state: "pending" })).toBe("pending");
  });
});
