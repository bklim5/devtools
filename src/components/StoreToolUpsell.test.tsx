// @vitest-environment jsdom
// StoreToolUpsell (MAS-IAP-07, Phase 28-05, D-02/D-14, user Option A) — the inline
// locked-tool upsell panel for the store build. A tree-shakeable sibling of the
// Keygen UpsellPanel: ToolRoute renders it (via the build-time IS_APPSTORE lazy
// switch) IN PLACE of a locked tool's UI. It reuses the SAME StoreUpsell pitch +
// Buy + Restore body (StoreUpsellBody) but WITHOUT the modal chrome (no dialog
// role, no scrim, no focus-trap) — it is an in-place panel, not a dialog. NO Keygen
// concepts: no key field, no license.tinkerdev.io, no $9, no ⌘K, no
// "I have a license key", no tinkerdev.io/buy. Buy success + Restore call
// refreshEntitlements() directly (belt-and-suspenders) and grant NOTHING
// client-side. StoreKit fully stubbed — jsdom never touches a real command.
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

const refreshEntitlementsSpy = vi.fn(() => Promise.resolve());
vi.mock("@/lib/entitlements/store", () => ({
  refreshEntitlements: () => refreshEntitlementsSpy(),
}));

const PRODUCT_ID = "com.tinkerdev.app.pro";

function installPlatform(iap: Partial<Platform["iap"]> = {}): void {
  const base = makeMemoryPlatform();
  setPlatformForTest({ ...base, iap: { ...base.iap, ...iap } });
}

async function renderPanel() {
  const { StoreToolUpsell } = await import("./StoreToolUpsell");
  return render(<StoreToolUpsell icon={Lock} />);
}

beforeEach(() => {
  refreshEntitlementsSpy.mockClear();
  installPlatform();
});

afterEach(() => {
  cleanup();
  resetPlatformForTest();
});

describe("StoreToolUpsell — inline panel (no modal chrome)", () => {
  it("Test 1 — renders the pitch + Buy + Restore body, but NOT as a dialog (no scrim/role=dialog)", async () => {
    const { getByText, getByRole, queryByRole } = await renderPanel();

    expect(getByText("Thank you for using TinkerDev ❤️")).toBeTruthy();
    expect(getByRole("button", { name: "Buy Pro — Lifetime" })).toBeTruthy();
    expect(getByRole("button", { name: "Restore Purchases" })).toBeTruthy();
    expect(getByText("Lifetime Pro")).toBeTruthy();
    // In-place panel, NOT a dialog: no role=dialog, no aria-modal scrim wrapper.
    expect(queryByRole("dialog")).toBeNull();
  });

  it("Test 2 — heading is a real h2 (top-level page chrome, no heading inversion)", async () => {
    const { getByRole } = await renderPanel();
    const heading = getByRole("heading", { level: 2 });
    expect(heading.textContent).toContain("Thank you for using TinkerDev");
  });
});

describe("StoreToolUpsell — Buy/Restore (same body as StoreUpsell)", () => {
  it("Test 3 — Buy success refreshes the gate directly, grants nothing client-side", async () => {
    const purchase = vi.fn(
      (): Promise<IapPurchaseResult> =>
        Promise.resolve({ state: "success", entitlements: ["pro.theming"] }),
    );
    installPlatform({ purchase });
    const { getByRole } = await renderPanel();

    fireEvent.click(getByRole("button", { name: "Buy Pro — Lifetime" }));

    await waitFor(() =>
      expect(refreshEntitlementsSpy).toHaveBeenCalledTimes(1),
    );
    expect(purchase).toHaveBeenCalledWith(PRODUCT_ID);
  });

  it("Test 4 — Restore calls restore() THEN refreshEntitlements()", async () => {
    const restore = vi.fn((): Promise<void> => Promise.resolve());
    installPlatform({ restore });
    const { getByRole } = await renderPanel();

    fireEvent.click(getByRole("button", { name: "Restore Purchases" }));

    await waitFor(() =>
      expect(refreshEntitlementsSpy).toHaveBeenCalledTimes(1),
    );
    expect(restore).toHaveBeenCalledTimes(1);
  });

  it("Test 5 — Buy reject → calm unavailable line, no throw, no refresh on reject", async () => {
    const purchase = vi.fn(
      (): Promise<IapPurchaseResult> =>
        Promise.reject({ code: "serviceUnreachable" }),
    );
    installPlatform({ purchase });
    const { getByRole, findByText } = await renderPanel();

    fireEvent.click(getByRole("button", { name: "Buy Pro — Lifetime" }));

    expect(
      await findByText(
        "The App Store isn't available right now — try again shortly.",
      ),
    ).toBeTruthy();
    expect(refreshEntitlementsSpy).not.toHaveBeenCalled();
  });
});

describe("StoreToolUpsell — grep-clean (no Keygen concepts)", () => {
  it("Test 6 — NO key field, no license.tinkerdev.io, no $9/⌘K/'I have a license key'/tinkerdev.io/buy", async () => {
    const { container, queryByText } = await renderPanel();
    const html = container.innerHTML;

    expect(container.querySelector("input")).toBeNull();
    expect(html).not.toContain("license.tinkerdev.io");
    expect(html).not.toContain("tinkerdev.io/buy");
    expect(html).not.toContain("$9");
    expect(html).not.toContain("⌘K");
    expect(queryByText("I have a license key")).toBeNull();
  });
});
