// @vitest-environment jsdom
// StoreLicenseSettings (MAS-IAP-03/06/07, Phase 28-03) — the App-Store-managed
// License pane. Two mutually-exclusive layouts gated on isPro(useEntitlements()):
// Pro-active (green banner + always-visible Restore) XOR Free (status + Buy +
// Restore). Buy/Restore drive the platform.iap seam with a calm aria-live readout;
// Buy SUCCESS and Restore BOTH call refreshEntitlements() directly (belt-and-
// suspenders — not sole reliance on the boot listener) while granting NOTHING
// client-side (the gate stays baseFromStoreKit-only). Zero Keygen concepts, zero
// amber/red attention states (D-11). Network/StoreKit is fully stubbed — jsdom
// never touches a real command.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import {
  resetPlatformForTest,
  setPlatformForTest,
  type IapPurchaseResult,
  type Platform,
} from "@/lib/platform";
import { createStoreStub } from "@/lib/platform/stub";
import { makeMemoryPlatform } from "@/shell/testStore";
import { resetPreferencesForTest } from "@/shell/usePreferences";
import { PREFERENCES_STORE_KEY } from "@/shell/preferences";
import { FREE_SET, FULL_SET } from "@/lib/entitlements/entitlements";

// Spy on the gate-refresh seam: the component must call it (belt-and-suspenders)
// on BOTH Buy success and Restore, and must NEVER write the entitlement set
// directly (no client-side grant — the gate stays baseFromStoreKit-only).
const refreshEntitlementsSpy = vi.fn(() => Promise.resolve());
vi.mock("@/lib/entitlements/store", () => ({
  refreshEntitlements: () => refreshEntitlementsSpy(),
}));

// Drive the isPro gate per-test via a mutable hook mock (the SAME channel every
// consumer reads). FREE_SET → Free layout; FULL_SET → Pro-active layout.
let entitlementSet = FREE_SET;
vi.mock("@/shell/useEntitlements", () => ({
  useEntitlements: () => entitlementSet,
}));

const PRODUCT_ID = "com.tinkerdev.app.pro";

/** Install a platform whose iap arm uses the given purchase/restore/
 *  currentEntitlements overrides (everything else the deterministic no-op stub). */
function installPlatform(iap: Partial<Platform["iap"]> = {}): void {
  const base = makeMemoryPlatform();
  setPlatformForTest({ ...base, iap: { ...base.iap, ...iap } });
}

async function renderPane() {
  const { StoreLicenseSettings } = await import("./StoreLicenseSettings");
  return render(<StoreLicenseSettings />);
}

beforeEach(() => {
  entitlementSet = FREE_SET;
  refreshEntitlementsSpy.mockClear();
  installPlatform();
});

afterEach(() => {
  cleanup();
  resetPlatformForTest();
  // The drop-notice tests drive the real usePreferences singleton; reset it so the
  // loaded/dirty latches never leak across cases (every test loads fresh prefs).
  resetPreferencesForTest();
});

/** Install a platform whose prefs store is seeded with the given blob (so
 *  usePreferences hydrates to it) — for the D-07 drop-notice tests. */
async function installPlatformWithPrefs(
  prefsBlob: Record<string, unknown>,
): Promise<void> {
  resetPreferencesForTest(); // force a fresh load from the seeded store
  const store = createStoreStub();
  await store.set(PREFERENCES_STORE_KEY, prefsBlob);
  setPlatformForTest(makeMemoryPlatform(store));
}

describe("StoreLicenseSettings — two layouts", () => {
  it("Test 1 — Pro-active layout: green banner + managed copy, NO Buy, NO Restore", async () => {
    entitlementSet = FULL_SET;
    const { getAllByText, getByText, queryByText, container } =
      await renderPane();

    // "Pro" appears twice: the banner heading <h4> + the green pill <span>.
    expect(getAllByText("Pro").length).toBeGreaterThanOrEqual(2);
    expect(
      getByText("Pro is active — managed through the App Store."),
    ).toBeTruthy();
    // An already-Pro user has nothing to buy or restore (Restore lives on the
    // Free pitch for not-yet-Pro users — Apple's requirement is still met).
    expect(queryByText("Buy Pro")).toBeNull();
    expect(queryByText("Restore Purchases")).toBeNull();
    // Green ok token banner (never amber/red).
    expect(container.querySelector(".border-ok-line")).toBeTruthy();
    expect(container.querySelector(".bg-ok-soft")).toBeTruthy();
  });

  it("Test 2 — Free layout: the shared store pitch (thank-you + Buy + Restore)", async () => {
    entitlementSet = FREE_SET;
    const { getByText, getByRole } = await renderPane();

    expect(getByText("Thank you for using TinkerDev ❤️")).toBeTruthy();
    expect(getByRole("button", { name: "Buy Pro" })).toBeTruthy();
    expect(getByRole("button", { name: "Restore Purchases" })).toBeTruthy();
  });

  it("Test 3 — Restore is on the Free pitch, absent on the Pro pane", async () => {
    entitlementSet = FREE_SET;
    const free = await renderPane();
    expect(
      free.getByRole("button", { name: "Restore Purchases" }),
    ).toBeTruthy();
    cleanup();

    entitlementSet = FULL_SET;
    const pro = await renderPane();
    expect(pro.queryByText("Restore Purchases")).toBeNull();
  });
});

describe("StoreLicenseSettings — Buy handler", () => {
  it("Test 4 — Buy calls purchase(productId); userCancelled → calm 'Purchase cancelled.'", async () => {
    const purchase = vi.fn(
      (): Promise<IapPurchaseResult> =>
        Promise.resolve({ state: "userCancelled" }),
    );
    installPlatform({ purchase });
    const { getByRole, findByText } = await renderPane();

    fireEvent.click(getByRole("button", { name: "Buy Pro" }));

    expect(await findByText("Purchase cancelled.")).toBeTruthy();
    expect(purchase).toHaveBeenCalledWith(PRODUCT_ID);
    // No grant on a cancel.
    expect(refreshEntitlementsSpy).not.toHaveBeenCalled();
  });

  it("Test 5 — Buy pending → calm pending-approval line", async () => {
    const purchase = vi.fn(
      (): Promise<IapPurchaseResult> => Promise.resolve({ state: "pending" }),
    );
    installPlatform({ purchase });
    const { getByRole, findByText } = await renderPane();

    fireEvent.click(getByRole("button", { name: "Buy Pro" }));

    expect(
      await findByText(
        "Purchase pending approval. Pro unlocks automatically once it's approved.",
      ),
    ).toBeTruthy();
    // Pending is not a grant — the boot listener handles the later approval.
    expect(refreshEntitlementsSpy).not.toHaveBeenCalled();
  });

  it("Test 6 — Buy success refreshes the gate (belt-and-suspenders), grants nothing client-side, NO readout string", async () => {
    const purchase = vi.fn(
      (): Promise<IapPurchaseResult> =>
        Promise.resolve({ state: "success", entitlements: ["pro.theming"] }),
    );
    installPlatform({ purchase });
    const { getByRole, queryByText } = await renderPane();

    fireEvent.click(getByRole("button", { name: "Buy Pro" }));

    // The foreground success path calls refreshEntitlements DIRECTLY — it does NOT
    // rely solely on the Plan-02 boot listener.
    await waitFor(() =>
      expect(refreshEntitlementsSpy).toHaveBeenCalledTimes(1),
    );
    // No client-side grant: success renders NO readout string (the live flip
    // re-renders to Pro-active); the component never fabricated a grant.
    expect(queryByText("Opening the App Store…")).toBeNull();
    expect(queryByText("Purchase cancelled.")).toBeNull();
  });

  it("Test 8 — Buy reject → calm unavailable line, never a thrown error / red banner; no refresh on reject", async () => {
    const purchase = vi.fn(
      (): Promise<IapPurchaseResult> =>
        Promise.reject({ code: "serviceUnreachable" }),
    );
    installPlatform({ purchase });
    const { getByRole, findByText, container } = await renderPane();

    fireEvent.click(getByRole("button", { name: "Buy Pro" }));

    expect(
      await findByText(
        "The App Store isn't available right now — try again shortly.",
      ),
    ).toBeTruthy();
    // A reject is NOT a success — refreshEntitlements is not required.
    expect(refreshEntitlementsSpy).not.toHaveBeenCalled();
    // Never an amber/red attention state.
    expect(container.querySelector(".text-bad")).toBeNull();
    expect(container.querySelector(".text-warn")).toBeNull();
  });
});

describe("StoreLicenseSettings — Restore handler", () => {
  it("Test 7 — Restore calls restore() THEN refreshEntitlements(); empty → 'No purchases found'", async () => {
    const restore = vi.fn((): Promise<void> => Promise.resolve());
    const currentEntitlements = vi.fn(
      (): Promise<string[]> => Promise.resolve([]),
    );
    installPlatform({ restore, currentEntitlements });
    const { getByRole, findByText } = await renderPane();

    fireEvent.click(getByRole("button", { name: "Restore Purchases" }));

    expect(
      await findByText("No purchases found for this Apple ID."),
    ).toBeTruthy();
    expect(restore).toHaveBeenCalledTimes(1);
    expect(refreshEntitlementsSpy).toHaveBeenCalledTimes(1);
  });

  it("Restore that finds Pro → refreshes the gate, NO 'nothing found' string", async () => {
    const restore = vi.fn((): Promise<void> => Promise.resolve());
    const currentEntitlements = vi.fn(
      (): Promise<string[]> => Promise.resolve(["pro.theming"]),
    );
    installPlatform({ restore, currentEntitlements });
    const { getByRole, queryByText } = await renderPane();

    fireEvent.click(getByRole("button", { name: "Restore Purchases" }));

    await waitFor(() =>
      expect(refreshEntitlementsSpy).toHaveBeenCalledTimes(1),
    );
    expect(queryByText("No purchases found for this Apple ID.")).toBeNull();
  });

  it("Restore reject → calm unavailable line", async () => {
    const restore = vi.fn(
      (): Promise<void> => Promise.reject({ code: "serviceUnreachable" }),
    );
    installPlatform({ restore });
    const { getByRole, findByText } = await renderPane();

    fireEvent.click(getByRole("button", { name: "Restore Purchases" }));

    expect(
      await findByText(
        "The App Store isn't available right now — try again shortly.",
      ),
    ).toBeTruthy();
  });
});

describe("StoreLicenseSettings — grep-clean copy (no Keygen concepts)", () => {
  it("Test 9 — renders NO key field, no license.tinkerdev.io, no Deactivate/$9/⌘K/seat/fingerprint", async () => {
    entitlementSet = FREE_SET;
    const { container, queryByText } = await renderPane();
    const html = container.innerHTML;

    // No key input field of any kind.
    expect(container.querySelector("input")).toBeNull();
    expect(html).not.toContain("license.tinkerdev.io");
    expect(html).not.toContain("$9");
    expect(html).not.toContain("⌘K");
    expect(queryByText("Deactivate")).toBeNull();
    expect(html.toLowerCase()).not.toContain("seat");
    expect(html.toLowerCase()).not.toContain("fingerprint");
    expect(html.toLowerCase()).not.toContain("check your purchase email");
  });
});

describe("StoreLicenseSettings — D-07 drop notice (MAS-IAP-05)", () => {
  it("Test 9 — a pending drop (licenseDropNoticeAck=false) shows the calm notice; dismiss acks it", async () => {
    // A live refund/revoke flipped the gate to free AND set the flag false.
    entitlementSet = FREE_SET;
    await installPlatformWithPrefs({ licenseDropNoticeAck: false });
    const { findByText, getByRole, queryByText, container } = await renderPane();

    // The notice surfaces once prefs load (Free layout — gate already dropped).
    expect(await findByText("Your Pro features turned off")).toBeTruthy();
    // Calm, never red/amber.
    expect(container.querySelector(".text-bad")).toBeNull();
    expect(container.querySelector(".text-warn")).toBeNull();

    // Dismiss → ack persists → the notice is gone (the flag flips true).
    fireEvent.click(getByRole("button", { name: "Got it" }));
    await waitFor(() =>
      expect(queryByText("Your Pro features turned off")).toBeNull(),
    );
  });

  it("Test 10 — no drop notice when acknowledged (default true)", async () => {
    entitlementSet = FREE_SET;
    await installPlatformWithPrefs({ licenseDropNoticeAck: true });
    const { queryByText } = await renderPane();

    // Give the async prefs load a tick to settle, then assert it never appears.
    await waitFor(() =>
      expect(queryByText("Buy Pro")).toBeTruthy(),
    );
    expect(queryByText("Your Pro features turned off")).toBeNull();
  });
});
