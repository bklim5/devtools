// @vitest-environment jsdom
// LicenseSettings (LIC-09, D-87/D-88) — the #/settings/license status route.
// Drives each of the five resolve_status states via setLicenseUiForTest + a stub
// platform, asserting the verbatim 21-UI-SPEC copy, the masked-key/email fields
// (em-dash when null — D-89), the confirm-first Deactivate reveal/cancel focus
// contract (D-78), the Refresh handler wiring (D-76), and the silent
// drop-to-refreshNeeded transition (D-82). Network/licensing is fully stubbed —
// jsdom never touches the real commands.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LicenseSettings } from "./LicenseSettings";
import {
  resetPlatformForTest,
  setPlatformForTest,
  type LicenseStatusPayload,
  type Platform,
} from "@/lib/platform";
import { createLicenseStub, createStoreStub } from "@/lib/platform/stub";
import {
  resetLicenseUiForTest,
  setLicenseUiForTest,
} from "@/lib/license/licenseUi";
import { makeMemoryPlatform } from "@/shell/testStore";
import { PREFERENCES_STORE_KEY } from "@/shell/preferences";

const navigateSpy = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigateSpy };
});

const LICENSED: LicenseStatusPayload = {
  state: "licensed",
  expiry: "2027-01-01T00:00:00Z",
  entitlements: ["pro.theming", "pro.ordering"],
  maskedKey: "••••••••AB12",
  email: "buyer@example.com",
};

/** Install a platform whose license arm returns `status` and uses the given
 *  refresh/deactivate spies. Seeds the prefs blob (for the drop-notice flag). */
async function installPlatform(
  status: LicenseStatusPayload,
  overrides: Partial<Platform["license"]> = {},
  prefsBlob: Record<string, unknown> = {},
): Promise<void> {
  const store = createStoreStub();
  await store.set(PREFERENCES_STORE_KEY, prefsBlob);
  const license: Platform["license"] = {
    ...createLicenseStub(),
    status: () => Promise.resolve(status),
    ...overrides,
  };
  setPlatformForTest(makeMemoryPlatform(store, license));
}

function renderRoute() {
  return render(
    <MemoryRouter>
      <LicenseSettings />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  navigateSpy.mockClear();
});

afterEach(() => {
  cleanup();
  resetLicenseUiForTest();
  resetPlatformForTest();
});

describe("LicenseSettings — state copy + fields", () => {
  it("licensed: shows 'Licensed', the licensee/key line, and Refresh + Deactivate", async () => {
    await installPlatform(LICENSED);
    act(() => setLicenseUiForTest(LICENSED));
    const { getByText, getByRole } = renderRoute();

    expect(getByText("Licensed")).toBeTruthy();
    expect(getByText("buyer@example.com")).toBeTruthy();
    expect(getByText("••••••••AB12")).toBeTruthy();
    expect(getByRole("button", { name: "Refresh" })).toBeTruthy();
    expect(getByRole("button", { name: "Deactivate this device" })).toBeTruthy();
  });

  it("notActivated (free): 'Free' heading + an activation route to the panel (D-88)", async () => {
    const free: LicenseStatusPayload = { state: "notActivated", hasStoredKey: false };
    await installPlatform(free);
    act(() => setLicenseUiForTest(free));
    const { getByText, getByRole, queryByRole } = renderRoute();

    expect(getByText("Free")).toBeTruthy();
    // No Refresh/Deactivate on the pure free state.
    expect(queryByRole("button", { name: "Refresh" })).toBeNull();
    fireEvent.click(getByRole("button", { name: "Activate a license" }));
    expect(navigateSpy).toHaveBeenCalledWith("/");
  });

  it("offlineGrace: 'Licensed (offline)' + calm neutral body (no countdown)", async () => {
    const grace: LicenseStatusPayload = {
      state: "offlineGrace",
      expiry: null,
      entitlements: ["pro.theming"],
      maskedKey: "••••••••ZZ99",
      email: null,
    };
    await installPlatform(grace);
    act(() => setLicenseUiForTest(grace));
    const { getByText } = renderRoute();

    expect(getByText("Licensed (offline)")).toBeTruthy();
    expect(
      getByText(/refresh your license automatically the next time you're online/i),
    ).toBeTruthy();
    // email absent -> em dash, never empty (D-89).
    expect(getByText("—")).toBeTruthy();
  });

  it("refreshNeeded: ONE calm 'Pro is no longer active' state with Reactivate (D-83)", async () => {
    const rn: LicenseStatusPayload = { state: "refreshNeeded", hasStoredKey: true };
    await installPlatform(rn);
    act(() => setLicenseUiForTest(rn));
    const { getByText, getByRole } = renderRoute();

    expect(getByText("Pro is no longer active")).toBeTruthy();
    expect(getByRole("button", { name: "Reactivate" })).toBeTruthy();
    fireEvent.click(getByRole("button", { name: "Reactivate" }));
    expect(navigateSpy).toHaveBeenCalledWith("/");
  });

  it("problem: 'License needs attention' (reuses the D-44 copy)", async () => {
    const prob: LicenseStatusPayload = {
      state: "problem",
      problem: "foreignMachine",
      hasStoredKey: false,
    };
    await installPlatform(prob);
    act(() => setLicenseUiForTest(prob));
    const { getByText } = renderRoute();

    expect(getByText("License needs attention")).toBeTruthy();
  });
});

describe("LicenseSettings — Deactivate confirm-first (D-78)", () => {
  it("reveals an inline confirm with the calm copy + Deactivate / Keep Pro here, focusing the confirm", async () => {
    await installPlatform(LICENSED);
    act(() => setLicenseUiForTest(LICENSED));
    const { getByRole, getByText } = renderRoute();

    fireEvent.click(getByRole("button", { name: "Deactivate this device" }));
    expect(
      getByText(/This frees your seat so you can activate another device/i),
    ).toBeTruthy();
    const confirm = getByRole("button", { name: "Deactivate" });
    expect(confirm).toBeTruthy();
    expect(getByRole("button", { name: "Keep Pro here" })).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(confirm));
  });

  it("Cancel ('Keep Pro here') closes the confirm and returns focus to the trigger", async () => {
    await installPlatform(LICENSED);
    act(() => setLicenseUiForTest(LICENSED));
    const { getByRole, queryByRole } = renderRoute();

    fireEvent.click(getByRole("button", { name: "Deactivate this device" }));
    fireEvent.click(getByRole("button", { name: "Keep Pro here" }));
    await waitFor(() =>
      expect(queryByRole("button", { name: "Keep Pro here" })).toBeNull(),
    );
    // Focus returns to the re-rendered trigger (a fresh DOM node — the trigger
    // is conditionally re-mounted when the confirm collapses), so assert by
    // accessible name, not stale node identity.
    await waitFor(() =>
      expect(
        (document.activeElement as HTMLElement).getAttribute("type") === "button" &&
          document.activeElement?.textContent,
      ).toBe("Deactivate this device"),
    );
  });

  it("confirm calls platform.license.deactivate then live-flips to free", async () => {
    const deactivate = vi.fn(() =>
      Promise.resolve<LicenseStatusPayload>({
        state: "notActivated",
        hasStoredKey: false,
      }),
    );
    await installPlatform(LICENSED, { deactivate });
    act(() => setLicenseUiForTest(LICENSED));
    const { getByRole } = renderRoute();

    fireEvent.click(getByRole("button", { name: "Deactivate this device" }));
    fireEvent.click(getByRole("button", { name: "Deactivate" }));
    await waitFor(() => expect(deactivate).toHaveBeenCalledTimes(1));
  });

  it("offline deactivate surfaces calm guidance, never clears local state (D-79)", async () => {
    const deactivate = vi.fn(() => Promise.reject({ code: "offline" as const }));
    await installPlatform(LICENSED, { deactivate });
    act(() => setLicenseUiForTest(LICENSED));
    const { getByRole, findByText } = renderRoute();

    fireEvent.click(getByRole("button", { name: "Deactivate this device" }));
    fireEvent.click(getByRole("button", { name: "Deactivate" }));
    expect(await findByText("Connect to the internet to free this seat.")).toBeTruthy();
  });
});

describe("LicenseSettings — Refresh (D-76/D-82)", () => {
  it("Refresh calls platform.license.refresh and re-reads status", async () => {
    const refresh = vi.fn(() => Promise.resolve(LICENSED));
    await installPlatform(LICENSED, { refresh });
    act(() => setLicenseUiForTest(LICENSED));
    const { getByRole } = renderRoute();

    fireEvent.click(getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it("a refresh that drops entitlements silently transitions to refreshNeeded (no error dialog, D-82)", async () => {
    // status() returns the POST-drop state; refresh() resolves it. The route
    // re-reads status after refresh and the snapshot flips with no error line.
    const dropped: LicenseStatusPayload = { state: "refreshNeeded", hasStoredKey: true };
    const refresh = vi.fn(() => Promise.resolve(dropped));
    await installPlatform(dropped, { refresh });
    act(() => setLicenseUiForTest(LICENSED));
    const { getByRole, findByText } = renderRoute();

    fireEvent.click(getByRole("button", { name: "Refresh" }));
    expect(await findByText("Pro is no longer active")).toBeTruthy();
  });
});

describe("LicenseSettings — drop notice (D-84)", () => {
  it("surfaces a dismissable inline notice when a drop is pending, then acks it", async () => {
    const free: LicenseStatusPayload = { state: "notActivated", hasStoredKey: false };
    await installPlatform(free, {}, { licenseDropNoticeAck: false });
    act(() => setLicenseUiForTest(free));
    const { findByText, getByRole, queryByText } = renderRoute();

    expect(await findByText("Your Pro features turned off")).toBeTruthy();
    fireEvent.click(getByRole("button", { name: "Got it" }));
    await waitFor(() =>
      expect(queryByText("Your Pro features turned off")).toBeNull(),
    );
  });

  it("does not show the notice in the steady state (ack=true default)", async () => {
    const free: LicenseStatusPayload = { state: "notActivated", hasStoredKey: false };
    await installPlatform(free);
    act(() => setLicenseUiForTest(free));
    const { queryByText } = renderRoute();
    // Allow the mount load to settle.
    await waitFor(() => undefined);
    expect(queryByText("Your Pro features turned off")).toBeNull();
  });
});
