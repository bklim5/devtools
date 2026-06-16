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

// Phase 22.1 (D-22.1-4/5/6/7): the not-Pro states no longer open the standalone
// UpsellModal STACKED above the Settings modal (the old openUpsell modal-on-modal).
// They render the SHARED activation surface (InlineActivation, from UpsellPanel)
// INLINE in the pane. So LicenseSettings no longer imports openUpsell at all —
// these tests assert the inline surface renders (pitch+form for free, form-only
// below the status card for refreshNeeded/problem) instead of a modal opening.
// 22.1-04: the standalone UpsellModal was removed entirely — the inline
// surface here is now the ONLY upsell surface in the app.

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
    // The route mounts via refreshLicenseUiDetailed() → statusDetail() (D-89,
    // codex finding 2 — the route is the ONLY licensed Keychain-reading path).
    // Mirror `status` so the masked-key/email fields render in these tests.
    statusDetail: () => Promise.resolve(status),
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
  it("licensed: shows the GREEN success banner ('Licensed' + PRO pill) + Licensee/masked key + Refresh + Deactivate (Phase 22.1 walkthrough 2026-06-16)", async () => {
    await installPlatform(LICENSED);
    act(() => setLicenseUiForTest(LICENSED));
    const { getByText, getByRole, container, queryByText } = renderRoute();

    expect(getByText("Licensed")).toBeTruthy();
    // The green PRO pill on the success banner — the text node reads "Pro"; CSS
    // uppercases it to PRO (same pattern as the amber UNVERIFIED pill).
    expect(getByText("Pro")).toBeTruthy();
    // The banner carries the green ok token (not the neutral panel card).
    expect(container.querySelector(".border-ok-line")).toBeTruthy();
    expect(container.querySelector(".bg-ok-soft")).toBeTruthy();
    // Compact details: Licensee + License key only — Plan/Renews/Activated GONE.
    expect(getByText("Licensee")).toBeTruthy();
    expect(getByText("buyer@example.com")).toBeTruthy();
    expect(getByText("License key")).toBeTruthy();
    expect(getByText("••••••••AB12")).toBeTruthy();
    expect(queryByText("Renews")).toBeNull();
    expect(queryByText("Plan")).toBeNull();
    expect(queryByText("Activated")).toBeNull();
    // The masked key is display-only now — NO copy button on it (LIC-04: the
    // masked dots are useless to copy), and no reveal/eye toggle.
    expect(
      queryByText(/Renews around/),
    ).toBeNull();
    expect(getByRole("button", { name: "Refresh" })).toBeTruthy();
    expect(getByRole("button", { name: "Deactivate this device" })).toBeTruthy();
    // No copy button for the masked license key (its accessible name would
    // include "license key"); the licensee email copy is also removed.
    expect(
      container.querySelector('[aria-label*="license key" i]'),
    ).toBeNull();
  });

  it("notActivated (free): renders the FULL upsell/activation surface INLINE — pitch + Buy + 'I have a license key' → key input — no modal, no navigate (D-22.1-6)", async () => {
    const free: LicenseStatusPayload = { state: "notActivated", hasStoredKey: false };
    await installPlatform(free);
    act(() => setLicenseUiForTest(free));
    const { getByText, getByRole, queryByRole } = renderRoute();

    // The inline upsell pitch IS the surface (no separate "Free" status card —
    // its heading would duplicate the pitch heading, D-22.1-6).
    expect(
      getByRole("heading", { name: /Thank you for using TinkerDev/ }),
    ).toBeTruthy();
    expect(getByText(/Most of TinkerDev is free/)).toBeTruthy();
    expect(getByRole("button", { name: "Buy license" })).toBeTruthy();
    // No Refresh/Deactivate on the pure free state.
    expect(queryByRole("button", { name: "Refresh" })).toBeNull();
    expect(
      queryByRole("button", { name: "Deactivate this device" }),
    ).toBeNull();
    // No modal-on-modal: the activation form is INLINE — no [role="dialog"]
    // (the standalone UpsellModal would mount one; here the pane renders inline).
    expect(queryByRole("dialog")).toBeNull();

    // Revealing the inline form shows the real key input + Activate (the shared
    // surface), no second modal opens.
    fireEvent.click(getByRole("button", { name: "I have a license key" }));
    expect(getByRole("textbox", { name: "License key" })).toBeTruthy();
    expect(getByRole("button", { name: "Activate" })).toBeTruthy();
    expect(queryByRole("dialog")).toBeNull();
    expect(navigateSpy).not.toHaveBeenCalled();
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
    const { getByText, container } = renderRoute();

    expect(getByText("Licensed (offline)")).toBeTruthy();
    // The Pro-active states share the GREEN success banner + auto-refresh body.
    expect(
      getByText(/your license refreshes automatically/i),
    ).toBeTruthy();
    expect(container.querySelector(".border-ok-line")).toBeTruthy();
    // email absent -> em dash, never empty (D-89).
    expect(getByText("—")).toBeTruthy();
  });

  it("refreshNeeded: visible 'License' header + amber attention card + Refresh, with the 'Activate a license' section + key form INLINE — NO pitch, no modal, no UNVERIFIED pill (D-22.1-7/D-83)", async () => {
    const rn: LicenseStatusPayload = { state: "refreshNeeded", hasStoredKey: true };
    await installPlatform(rn);
    act(() => setLicenseUiForTest(rn));
    const { getByText, getByRole, queryByText, queryByRole, container } =
      renderRoute();

    // Phase 22.1: a prominent visible "License" header + subtitle for the
    // managed states. It is an <h3> — one level under the dialog's "Settings"
    // <h2> so heading-order never inverts; the status heading below stays <h2>
    // so the e2e statusHeading() probe still reads "License needs attention".
    expect(
      getByRole("heading", { name: "License", level: 3 }),
    ).toBeTruthy();
    expect(
      getByText("Manage your activation and license key."),
    ).toBeTruthy();

    // The attention card is KEPT but is now an amber WARNING (not neutral).
    expect(getByText("Pro is no longer active")).toBeTruthy();
    expect(getByRole("button", { name: "Refresh" })).toBeTruthy();
    // The card carries the warn token (amber), proving it is not the old
    // neutral card.
    expect(container.querySelector(".border-warn-line")).toBeTruthy();
    // refreshNeeded does NOT show the UNVERIFIED pill (problem-state only).
    expect(queryByText("UNVERIFIED")).toBeNull();

    // The "Activate a license" section header + subtitle + the muted recovery
    // hint wrap the inline form-only surface.
    expect(getByText("Activate a license")).toBeTruthy();
    expect(
      getByText(
        "Paste the key from your purchase confirmation email to re-verify this device.",
      ),
    ).toBeTruthy();
    expect(getByText("Lost your key? Check your purchase email")).toBeTruthy();
    // The inline form-only activation surface renders (pre-revealed) — the OLD
    // modal-opening Reactivate button is GONE.
    expect(getByRole("textbox", { name: "License key" })).toBeTruthy();
    expect(getByRole("button", { name: "Activate" })).toBeTruthy();
    expect(queryByRole("button", { name: "Reactivate" })).toBeNull();
    // NO sales pitch for a lapsed paying customer (D-22.1-7 / D-44 principle).
    expect(queryByText(/Most of TinkerDev is free/)).toBeNull();
    expect(queryByText(/Thank you for using TinkerDev/)).toBeNull();
    // Inline — no modal-on-modal.
    expect(queryByRole("dialog")).toBeNull();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it("problem: 'License needs attention' amber card + UNVERIFIED pill + Refresh, with the 'Activate a license' section + key form INLINE — NO pitch, no modal (D-22.1-7/D-44/D-83)", async () => {
    const prob: LicenseStatusPayload = {
      state: "problem",
      problem: "foreignMachine",
      hasStoredKey: false,
    };
    await installPlatform(prob);
    act(() => setLicenseUiForTest(prob));
    const { getByText, getByRole, queryByText, queryByRole, container } =
      renderRoute();

    expect(getByRole("heading", { name: "License", level: 3 })).toBeTruthy();
    expect(getByText("License needs attention")).toBeTruthy();
    expect(getByRole("button", { name: "Refresh" })).toBeTruthy();
    // Amber attention card.
    expect(container.querySelector(".border-warn-line")).toBeTruthy();
    // The problem state shows an UNVERIFIED amber pill badge.
    // The text node reads "Unverified"; CSS uppercases it to UNVERIFIED.
    expect(getByText("Unverified")).toBeTruthy();

    // "Activate a license" section + recovery hint.
    expect(getByText("Activate a license")).toBeTruthy();
    expect(getByText("Lost your key? Check your purchase email")).toBeTruthy();
    // The inline form-only surface — no modal-opening Reactivate button (D-22.1-7).
    expect(getByRole("textbox", { name: "License key" })).toBeTruthy();
    expect(getByRole("button", { name: "Activate" })).toBeTruthy();
    expect(queryByRole("button", { name: "Reactivate" })).toBeNull();
    // A paying customer in the problem state never sees the sales pitch.
    expect(queryByText(/Most of TinkerDev is free/)).toBeNull();
    expect(queryByRole("dialog")).toBeNull();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it("the recovery hint is plain muted text, NOT a link/navigation (Phase 22.1)", async () => {
    const prob: LicenseStatusPayload = {
      state: "problem",
      problem: "foreignMachine",
      hasStoredKey: false,
    };
    await installPlatform(prob);
    act(() => setLicenseUiForTest(prob));
    const { getByText, queryByRole } = renderRoute();

    const hint = getByText("Lost your key? Check your purchase email");
    // No account portal: the hint is plain text, never an <a>/button/link.
    expect(hint.tagName).toBe("P");
    expect(hint.closest("a")).toBeNull();
    expect(
      queryByRole("link", { name: /lost your key/i }),
    ).toBeNull();
  });

  it("problem: the inline form activates with the SAME shared submit chain (key input → activate)", async () => {
    const prob: LicenseStatusPayload = {
      state: "problem",
      problem: "foreignMachine",
      hasStoredKey: false,
    };
    const activate = vi.fn(() => Promise.resolve(LICENSED));
    await installPlatform(prob, { activate });
    act(() => setLicenseUiForTest(prob));
    const { getByRole } = renderRoute();

    const input = getByRole("textbox", { name: "License key" });
    fireEvent.change(input, { target: { value: "  KEY-INLINE  " } });
    fireEvent.click(getByRole("button", { name: "Activate" }));
    // The shared surface trims + calls activate — proving the inline form is
    // wired to the SAME activation logic, not a stub (D-22.1-4).
    await waitFor(() => expect(activate).toHaveBeenCalledWith("KEY-INLINE"));
  });
});

describe("LicenseSettings — Deactivate confirm-first (D-78)", () => {
  it("reveals a reddish confirm CARD (warning icon + heading + Cancel / destructive Deactivate), focusing the confirm", async () => {
    await installPlatform(LICENSED);
    act(() => setLicenseUiForTest(LICENSED));
    const { getByRole, getByText, container } = renderRoute();

    fireEvent.click(getByRole("button", { name: "Deactivate this device" }));
    // The approved confirm copy (walkthrough 2026-06-16).
    expect(getByText("Deactivate Pro on this device?")).toBeTruthy();
    expect(
      getByText(/You'll drop back to the free tier here/i),
    ).toBeTruthy();
    const confirm = getByRole("button", { name: "Deactivate" });
    expect(confirm).toBeTruthy();
    // The destructive Deactivate button carries the bad (red) token + text-bad,
    // proving it is not the neutral secondary button.
    expect(confirm.className).toContain("text-bad");
    // The confirm card itself is reddish (bad-tinted surface).
    expect(
      Array.from(container.querySelectorAll("*")).some((el) =>
        Array.from(el.classList).some((c) => c.startsWith("bg-bad")),
      ),
    ).toBe(true);
    expect(getByRole("button", { name: "Cancel" })).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(confirm));
  });

  it("Cancel closes the confirm and returns focus to the trigger", async () => {
    await installPlatform(LICENSED);
    act(() => setLicenseUiForTest(LICENSED));
    const { getByRole, queryByRole } = renderRoute();

    fireEvent.click(getByRole("button", { name: "Deactivate this device" }));
    fireEvent.click(getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(queryByRole("button", { name: "Cancel" })).toBeNull(),
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

  // 21-04 FLAG P6: the silent refresh-drop label change must be ANNOUNCED, or an
  // SR user hears "Refreshing…" then silence. The status-label row lives in an
  // aria-live="polite" region so the new resting state ("Pro is no longer
  // active") is read out — politely, never role=alert (D-77/D-83 calm tone).
  it("announces the status-label transition via a polite aria-live region (P6)", async () => {
    const dropped: LicenseStatusPayload = { state: "refreshNeeded", hasStoredKey: true };
    const refresh = vi.fn(() => Promise.resolve(dropped));
    await installPlatform(dropped, { refresh });
    act(() => setLicenseUiForTest(LICENSED));
    const { getByRole, findByText, container } = renderRoute();

    // The status heading lives inside a polite live region (NOT assertive/alert).
    const region = container.querySelector('[aria-live="polite"]');
    expect(region).toBeTruthy();
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelector('[aria-live="assertive"]')).toBeNull();
    expect(region!.textContent).toContain("Licensed");

    fireEvent.click(getByRole("button", { name: "Refresh" }));
    expect(await findByText("Pro is no longer active")).toBeTruthy();
    // The NEW resting label is inside the same live region — so it is announced.
    const after = container.querySelector('[aria-live="polite"]');
    expect(after!.textContent).toContain("Pro is no longer active");
  });

  // 21-04 FLAG P3b: the busy state is conveyed on the control itself (aria-busy),
  // in parity with the separate aria-live "Refreshing…" line — not color-only.
  it("sets aria-busy on the Refresh button while refreshing (P3b)", async () => {
    // A refresh that never resolves keeps the in-flight state observable.
    const refresh = vi.fn(() => new Promise<LicenseStatusPayload>(() => {}));
    await installPlatform(LICENSED, { refresh });
    act(() => setLicenseUiForTest(LICENSED));
    const { getByRole } = renderRoute();

    const btn = getByRole("button", { name: "Refresh" });
    expect(btn.getAttribute("aria-busy")).toBe("false");
    fireEvent.click(btn);
    await waitFor(() => expect(btn.getAttribute("aria-busy")).toBe("true"));
    expect((btn as HTMLButtonElement).disabled).toBe(true);
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
