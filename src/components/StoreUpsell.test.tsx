// @vitest-environment jsdom
// StoreUpsell (MAS-IAP-07, Phase 28-04, D-02/D-14) — the StoreKit Buy + Restore
// upsell modal that REPLACES the Keygen UpsellModal activation form in the store
// build. Reuses the UpsellModal a11y dialog wrapper (scrim + focus-trap + Esc +
// return-focus + aria-modal/aria-labelledby) but renders a store pitch + Buy +
// Restore body — never a license-key field. Buy SUCCESS and Restore BOTH call
// refreshEntitlements() directly (belt-and-suspenders) while granting NOTHING
// client-side (the gate stays baseFromStoreKit-only). Network/StoreKit is fully
// stubbed — jsdom never touches a real command.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { Lock } from "lucide-react";
import {
  resetPlatformForTest,
  setPlatformForTest,
  type IapPurchaseResult,
  type Platform,
} from "@/lib/platform";
import { makeMemoryPlatform } from "@/shell/testStore";

// Spy on the gate-refresh seam: the component must call it (belt-and-suspenders)
// on BOTH Buy success and Restore, and must NEVER write the entitlement set
// directly (no client-side grant — the gate stays baseFromStoreKit-only).
const refreshEntitlementsSpy = vi.fn(() => Promise.resolve());
vi.mock("@/lib/entitlements/store", () => ({
  refreshEntitlements: () => refreshEntitlementsSpy(),
}));

const PRODUCT_ID = "com.tinkerdev.app.pro";

/** Install a platform whose iap arm uses the given purchase/restore overrides
 *  (everything else the deterministic no-op stub). */
function installPlatform(iap: Partial<Platform["iap"]> = {}): void {
  const base = makeMemoryPlatform();
  setPlatformForTest({ ...base, iap: { ...base.iap, ...iap } });
}

async function renderModal(onClose: () => void = () => {}) {
  const { StoreUpsell } = await import("./StoreUpsell");
  return render(<StoreUpsell icon={Lock} onClose={onClose} />);
}

beforeEach(() => {
  refreshEntitlementsSpy.mockClear();
  installPlatform();
});

afterEach(() => {
  cleanup();
  resetPlatformForTest();
});

describe("StoreUpsell — pitch", () => {
  it("Test 1 — renders the locked pitch heading + Buy + Restore + price + claims", async () => {
    const { getByText, getByRole } = await renderModal();

    expect(getByText("Thank you for using TinkerDev ❤️")).toBeTruthy();
    expect(getByRole("button", { name: "Buy Pro" })).toBeTruthy();
    expect(getByRole("button", { name: "Restore Purchases" })).toBeTruthy();
    expect(getByText("Lifetime Pro")).toBeTruthy();
    expect(
      getByText("One-time payment · Lifetime · Managed by the App Store"),
    ).toBeTruthy();
  });

  it("Test 2 — Command Palette feature copy, never ⌘K", async () => {
    const { getByText, container } = await renderModal();

    expect(getByText("Command palette")).toBeTruthy();
    expect(
      getByText("Jump to any tool from the Command Palette."),
    ).toBeTruthy();
    expect(container.innerHTML).not.toContain("⌘K");
  });
});

describe("StoreUpsell — Buy handler", () => {
  it("Test 3 — Buy calls purchase(productId); userCancelled → calm 'Purchase cancelled.'", async () => {
    const purchase = vi.fn(
      (): Promise<IapPurchaseResult> =>
        Promise.resolve({ state: "userCancelled" }),
    );
    installPlatform({ purchase });
    const { getByRole, findByText } = await renderModal();

    fireEvent.click(getByRole("button", { name: "Buy Pro" }));

    expect(await findByText("Purchase cancelled.")).toBeTruthy();
    expect(purchase).toHaveBeenCalledWith(PRODUCT_ID);
    expect(refreshEntitlementsSpy).not.toHaveBeenCalled();
  });

  it("Test 4 — Buy success refreshes the gate directly (belt-and-suspenders), grants nothing client-side", async () => {
    const purchase = vi.fn(
      (): Promise<IapPurchaseResult> =>
        Promise.resolve({ state: "success", entitlements: ["pro.theming"] }),
    );
    const onClose = vi.fn();
    installPlatform({ purchase });
    const { getByRole } = await renderModal(onClose);

    fireEvent.click(getByRole("button", { name: "Buy Pro" }));

    // Foreground success calls refreshEntitlements DIRECTLY — not sole reliance
    // on the Plan-02 boot listener.
    await waitFor(() =>
      expect(refreshEntitlementsSpy).toHaveBeenCalledTimes(1),
    );
    // No client-side grant: the modal only drives the seam + refresh; it never
    // writes the entitlement set.
    expect(purchase).toHaveBeenCalledWith(PRODUCT_ID);
  });

  it("Test 6 — Buy reject → calm unavailable line, no throw, no refresh on reject", async () => {
    const purchase = vi.fn(
      (): Promise<IapPurchaseResult> =>
        Promise.reject({ code: "serviceUnreachable" }),
    );
    installPlatform({ purchase });
    const { getByRole, findByText, container } = await renderModal();

    fireEvent.click(getByRole("button", { name: "Buy Pro" }));

    expect(
      await findByText(
        "The App Store isn't available right now — try again shortly.",
      ),
    ).toBeTruthy();
    expect(refreshEntitlementsSpy).not.toHaveBeenCalled();
    expect(container.querySelector(".text-bad")).toBeNull();
    expect(container.querySelector(".text-warn")).toBeNull();
  });
});

describe("StoreUpsell — Restore handler", () => {
  it("Test 5 — Restore calls restore() THEN refreshEntitlements()", async () => {
    const restore = vi.fn((): Promise<void> => Promise.resolve());
    installPlatform({ restore });
    const { getByRole } = await renderModal();

    fireEvent.click(getByRole("button", { name: "Restore Purchases" }));

    await waitFor(() =>
      expect(refreshEntitlementsSpy).toHaveBeenCalledTimes(1),
    );
    expect(restore).toHaveBeenCalledTimes(1);
  });
});

describe("StoreUpsell — dialog a11y", () => {
  it("Test 7 — role=dialog + aria-modal + aria-labelledby the pitch heading; Esc calls onClose", async () => {
    const onClose = vi.fn();
    const { getByRole, getByText } = await renderModal(onClose);

    const dialog = getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const labelledBy = dialog.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    // aria-labelledby points at the pitch heading element.
    const heading = getByText("Thank you for using TinkerDev ❤️");
    expect(heading.getAttribute("id")).toBe(labelledBy);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("StoreUpsell — grep-clean (no Keygen concepts)", () => {
  it("Test 8 — NO key field, no license.tinkerdev.io, no $9/⌘K/'I have a license key'/Activate", async () => {
    const { container, queryByText } = await renderModal();
    const html = container.innerHTML;

    expect(container.querySelector("input")).toBeNull();
    expect(html).not.toContain("license.tinkerdev.io");
    expect(html).not.toContain("$9");
    expect(html).not.toContain("⌘K");
    expect(queryByText("I have a license key")).toBeNull();
    expect(queryByText("Activate")).toBeNull();
  });
});

describe("StoreUpsell — price + feature icons", () => {
  it("Test 9 — shows the live StoreKit displayPrice in the price block once products() resolves", async () => {
    const products = vi.fn(() =>
      Promise.resolve([
        { id: PRODUCT_ID, displayPrice: "$9.99", displayName: "Pro" },
      ]),
    );
    installPlatform({ products });
    const { findByText } = await renderModal();

    expect(await findByText("Lifetime Pro · $9.99")).toBeTruthy();
  });

  it("Test 10 — falls back to the App-Store-price copy when products() is empty", async () => {
    // default installPlatform → products() resolves []
    const { findByText } = await renderModal();

    expect(
      await findByText("One-time purchase · price shown on the App Store"),
    ).toBeTruthy();
  });

  it("Test 11 — each feature row renders a real lucide icon, not a bare dot", async () => {
    const { container } = await renderModal();

    // 4 feature <li> rows, each carrying a lucide <svg> (Command/Palette/…).
    const featureIcons = container.querySelectorAll("li svg");
    expect(featureIcons.length).toBe(4);
  });
});
