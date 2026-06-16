// @vitest-environment jsdom
// UpsellPanel (D-19..D-22 + Phase 19 D-33..D-39/D-44): the ONE shared upsell
// surface. Card content + copy per the 18-UI-SPEC Copywriting Contract.
// 22.1-04: the standalone UpsellModal wrapper was REMOVED (every former opener
// now routes to Settings ▸ License, which renders InlineActivation) — only the
// route-placement UpsellPanel + the inline ActivationSurface remain under test.
// The Phase-19 describe below covers the inline activation flow: reveal-in-
// place form, calm in-flight/success/error states, the distinct D-44 problem
// state, and stored-key reactivation (activate(null)).
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { Lock } from "lucide-react";
import {
  BUY_LICENSE_URL,
  InlineActivation,
  UpsellModal,
  UpsellPanel,
} from "./UpsellPanel";
import {
  resetPlatformForTest,
  setPlatformForTest,
  type LicenseStatusPayload,
  type Platform,
} from "@/lib/platform";
import {
  getLicenseUiSnapshot,
  resetLicenseUiForTest,
  setLicenseUiForTest,
} from "@/lib/license/licenseUi";
import { makeMemoryPlatform, noopLicense } from "@/shell/testStore";
import { refreshEntitlements } from "@/lib/entitlements/store";
import { createStoreStub } from "@/lib/platform/stub";
import { PREFERENCES_STORE_KEY } from "@/shell/preferences";

// Spy seam for the D-35 success path: UpsellPanel must call the REAL
// refreshEntitlements (the proven live-flip path) — the mock wraps the actual
// implementation so behavior is unchanged and the call is observable.
vi.mock("@/lib/entitlements/store", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/entitlements/store")>();
  return { ...actual, refreshEntitlements: vi.fn(actual.refreshEntitlements) };
});

afterEach(() => {
  cleanup();
  resetLicenseUiForTest();
  resetPlatformForTest();
  vi.mocked(refreshEntitlements).mockClear();
});

describe("UpsellPanel (card)", () => {
  it("renders the standalone-panel thank-you heading as a top-level h2 (route placement, no dialog/pane above)", () => {
    const { getByRole } = render(<UpsellPanel icon={Lock} />);
    const heading = getByRole("heading", {
      name: /Thank you for using TinkerDev/,
    });
    // The standalone panel (ToolRoute placement, D-30) is top-level page chrome
    // with no dialog/pane heading above it, so it stays h2 — a lone h4 there would
    // itself be a heading-order skip (22.1: the level is variant-specific).
    expect(heading.tagName).toBe("H2");
  });

  it("renders the INLINE pitch heading as an h4 (under the License pane's h3 title — 22.1 a11y fix)", () => {
    const { getByRole } = render(<InlineActivation variant="upsell" icon={Lock} />);
    // Inline in Settings: dialog title h2 → pane title h3 → this status heading h4,
    // so heading order never inverts (the bug this fix closes).
    expect(
      getByRole("heading", {
        name: /Thank you for using TinkerDev/,
        level: 4,
      }),
    ).toBeTruthy();
  });

  it("renders the redesigned pitch body copy (Phase 22.1 walkthrough)", () => {
    const { getByText } = render(<UpsellPanel icon={Lock} />);
    expect(getByText(/Most of TinkerDev is free/)).toBeDefined();
    expect(
      getByText(/A lifetime license unlocks the extras and funds what's next/),
    ).toBeDefined();
  });

  it("renders the 3-row feature list with bold labels + muted subs (Phase 22.1)", () => {
    const { getByText } = render(<UpsellPanel icon={Lock} />);
    // Each row: a bold label + a one-line muted sub.
    expect(getByText("Custom themes")).toBeDefined();
    expect(getByText("Recolor the whole app to taste.")).toBeDefined();
    expect(getByText("Reorder & pin tools")).toBeDefined();
    expect(
      getByText("Arrange the sidebar around your workflow."),
    ).toBeDefined();
    expect(getByText("Fund what's next")).toBeDefined();
    expect(
      getByText("Directly support maintenance and new tools."),
    ).toBeDefined();
  });

  it("shows the $9 price block + 'once · lifetime license' sub (Phase 22.1 — REVERSES D-20)", () => {
    // Walkthrough 2026-06-15 (user decision): pricing IS now shown in-app — this
    // intentionally reverses the old D-20 "no pricing in-app". Price = $9.
    const { getByText } = render(<UpsellPanel icon={Lock} />);
    expect(getByText("$9")).toBeDefined();
    expect(getByText(/once · lifetime license/)).toBeDefined();
  });

  it("shows the claims footer line (Phase 22.1)", () => {
    const { getByText } = render(<UpsellPanel icon={Lock} />);
    expect(
      getByText("One-time payment · Free updates forever · 14-day refund"),
    ).toBeDefined();
  });

  it("renders the lock badge in an accent-soft square (Phase 22.1)", () => {
    const { container } = render(<UpsellPanel icon={Lock} />);
    // The pitch leads with a rounded-square badge (accent-soft bg, accent icon).
    const badge = container.querySelector(".bg-accent-soft");
    expect(badge).toBeTruthy();
    expect(badge!.querySelector("svg")).toBeTruthy();
  });

  it("renders the 'Buy license' CTA as a Tab-reachable button that opens the checkout via the opener seam (PAY-01/D-67)", async () => {
    // The CTA opens https://tinkerdev.io/buy through platform.opener.openUrl —
    // NOT by navigating the in-app document. Inject a spy opener arm and assert
    // the seam is reached exactly once with the https URL, and that the in-app
    // location is unchanged (the seam, not the route, is what fires).
    const openUrl = vi.fn().mockResolvedValue(undefined);
    setPlatformForTest({ ...makeMemoryPlatform(), opener: { openUrl } });
    const hrefBefore = window.location.href;

    const { getByRole } = render(<UpsellPanel icon={Lock} />);
    const buy = getByRole("button", { name: "Buy license" });
    expect(buy.tagName).toBe("BUTTON");
    expect(buy.getAttribute("tabindex")).not.toBe("-1");

    fireEvent.click(buy);

    await waitFor(() =>
      expect(openUrl).toHaveBeenCalledWith("https://tinkerdev.io/buy"),
    );
    expect(openUrl).toHaveBeenCalledTimes(1);
    // No in-page navigation: the OS browser opens, the route never changes.
    expect(window.location.href).toBe(hrefBefore);
  });

  it("exports BUY_LICENSE_URL as the single https checkout constant (D-68)", () => {
    expect(BUY_LICENSE_URL).toBe("https://tinkerdev.io/buy");
    expect(BUY_LICENSE_URL.startsWith("https://")).toBe(true);
  });

  it("clicking Buy must not throw even if the opener rejects (best-effort, calm)", () => {
    setPlatformForTest({
      ...makeMemoryPlatform(),
      opener: { openUrl: vi.fn().mockRejectedValue(new Error("nope")) },
    });
    const { getByRole } = render(<UpsellPanel icon={Lock} />);
    // The handler swallows the rejection (logged, never surfaced) — clicking is
    // safe; the synchronous click dispatch must not throw.
    expect(() =>
      fireEvent.click(getByRole("button", { name: "Buy license" })),
    ).not.toThrow();
  });

  it("renders the inert 'I have a license key' affordance (D-22)", () => {
    const { getByRole } = render(<UpsellPanel icon={Lock} />);
    const key = getByRole("button", { name: "I have a license key" });
    expect(key.tagName).toBe("BUTTON");
    expect(key.getAttribute("tabindex")).not.toBe("-1");
    fireEvent.click(key); // inert stub — must not throw
  });

  it("gives both CTAs visible focus rings and keeps the lock treatment neutral (no solid accent fill)", () => {
    const { getByRole } = render(<UpsellPanel icon={Lock} />);
    const buy = getByRole("button", { name: "Buy license" });
    const key = getByRole("button", { name: "I have a license key" });
    expect(buy.className).toContain("focus-visible:ring-accent");
    expect(key.className).toContain("focus-visible:ring-accent");
    // Accent-soft fill only on the primary — never a solid bg-accent fill.
    expect(buy.className).toContain("bg-accent-soft");
    expect(buy.className).not.toMatch(/bg-accent(\s|$)/);
    expect(key.className).toContain("bg-input-bg");
  });

  it("hides the icon from assistive tech (aria-hidden)", () => {
    const { container } = render(<UpsellPanel icon={Lock} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });
});

// --- Phase 19: inline activation flow (D-33..D-39, D-44) --------------------

/** A memory Platform whose license arm is overridden per test. */
function platformWith(license: Partial<Platform["license"]>): Platform {
  return { ...makeMemoryPlatform(), license: { ...noopLicense, ...license } };
}

const LICENSED: LicenseStatusPayload = {
  state: "licensed",
  expiry: null,
  entitlements: ["pro.theming", "pro.ordering"],
  maskedKey: null,
  email: null,
};

type RenderResult = ReturnType<typeof render>;

/** Click the D-22 button and return the revealed key input. */
function revealForm(utils: RenderResult): HTMLInputElement {
  fireEvent.click(utils.getByRole("button", { name: "I have a license key" }));
  return utils.getByRole("textbox", {
    name: "License key",
  }) as HTMLInputElement;
}

/** The single aria-live status/error line under the field (D-34/D-37). */
function liveRegion(utils: RenderResult): HTMLElement {
  const el = utils.container.querySelector('[aria-live="polite"]');
  if (!el) throw new Error("aria-live region not rendered");
  return el as HTMLElement;
}

describe("UpsellPanel activation form (D-33/D-34/D-39)", () => {
  it("clicking 'I have a license key' reveals the inline form in place — same panel, no new dialog (D-33)", () => {
    const utils = render(<UpsellPanel icon={Lock} />);
    const input = revealForm(utils);
    expect(input.tagName).toBe("INPUT");
    expect(utils.getByRole("button", { name: "Activate" })).toBeDefined();
    // Same panel: the heading is still the sales heading, and no dialog appeared.
    expect(
      utils.getByRole("heading", { name: /Thank you for using TinkerDev/ }),
    ).toBeDefined();
    expect(utils.queryByRole("dialog")).toBeNull();
  });

  it("the key input carries the masked placeholder + a key-icon prefix (Phase 22.1)", () => {
    const utils = render(<UpsellPanel icon={Lock} />);
    const input = revealForm(utils);
    // Without a stored key the field shows the masked key shape.
    expect(input.placeholder).toBe("XXXX-XXXX-XXXX-XXXX");
    // A decorative key icon sits inside the field wrapper (aria-hidden — the
    // <label> remains the accessible name, WCAG 3.3.2).
    const wrapper = input.parentElement!;
    const icon = wrapper.querySelector("svg");
    expect(icon).toBeTruthy();
    expect(icon!.getAttribute("aria-hidden")).toBe("true");
  });

  it("disables submit and announces 'Activating…' via aria-live while pending (D-34)", async () => {
    // A never-resolving activate keeps the panel in the in-flight state.
    setPlatformForTest(
      platformWith({
        activate: vi.fn(() => new Promise<LicenseStatusPayload>(() => {})),
      }),
    );
    const utils = render(<UpsellPanel icon={Lock} />);
    const input = revealForm(utils);
    fireEvent.change(input, { target: { value: "KEY-PENDING" } });
    fireEvent.click(utils.getByRole("button", { name: "Activate" }));

    const submit = utils.getByRole("button", {
      name: "Activate",
    }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(liveRegion(utils).textContent).toContain("Activating");
    // 19-UI-REVIEW fix 2: the input is readOnly, NOT disabled, while pending —
    // disabling the focused element would drop keyboard focus to <body>.
    expect(input.readOnly).toBe(true);
    expect(input.disabled).toBe(false);
  });

  it("whitespace-only input never calls activate; a padded key is trimmed before send (D-39)", async () => {
    const activate = vi.fn(() =>
      Promise.reject({ code: "activationFailed" as const }),
    );
    setPlatformForTest(platformWith({ activate }));
    const utils = render(<UpsellPanel icon={Lock} />);
    const input = revealForm(utils);

    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.click(utils.getByRole("button", { name: "Activate" }));
    expect(activate).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "  KEY-TRIM  " } });
    fireEvent.click(utils.getByRole("button", { name: "Activate" }));
    await waitFor(() => expect(activate).toHaveBeenCalledWith("KEY-TRIM"));
  });
});

describe("UpsellPanel activation success (D-35)", () => {
  it("swaps to the dismissible 'Licensed — thank you' state and refreshes entitlements live", async () => {
    const activate = vi.fn(() => Promise.resolve(LICENSED));
    setPlatformForTest(
      platformWith({ activate, status: () => Promise.resolve(LICENSED) }),
    );
    const onDismiss = vi.fn();
    const utils = render(<UpsellPanel icon={Lock} onDismiss={onDismiss} />);
    const input = revealForm(utils);
    fireEvent.change(input, { target: { value: "KEY-OK" } });
    fireEvent.click(utils.getByRole("button", { name: "Activate" }));

    await waitFor(() =>
      expect(
        utils.getByRole("heading", { name: /Licensed — thank you/ }),
      ).toBeDefined(),
    );
    // D-35: the live unlock behind the panel rides the proven D-32 flip path.
    expect(refreshEntitlements).toHaveBeenCalled();
    // Dismissible: the Done button wires through to the caller.
    fireEvent.click(utils.getByRole("button", { name: "Done" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("uses the DETAILED refresh on success so the masked key/email populate the License pane (Phase 22.1 fix)", async () => {
    // The bug: submit()'s success path called the keychain-free refreshLicenseUi()
    // (status() → maskedKey null). A notActivated → licensed TRANSITION is NOT
    // carried forward by carryForwardKeyEmail (it only keeps key/email when the
    // Pro-active state is UNCHANGED), so the License pane showed "License key —"
    // until the route reopened. The fix calls refreshLicenseUiDetailed()
    // (statusDetail) — authoritative, populates the masked key/email immediately.
    const LICENSED_DETAILED: LicenseStatusPayload = {
      state: "licensed",
      expiry: null,
      entitlements: ["pro.theming", "pro.ordering"],
      maskedKey: "••••••••V3",
      email: "buyer@tinkerdev.io",
    };
    const activate = vi.fn(() => Promise.resolve(LICENSED));
    // status() (keychain-free, used by the mount refresh) stays null-key; only the
    // DETAILED seam carries the masked key — proving the success path reads it.
    const status = vi.fn(() => Promise.resolve(LICENSED));
    const statusDetail = vi.fn(() => Promise.resolve(LICENSED_DETAILED));
    setPlatformForTest(platformWith({ activate, status, statusDetail }));
    const utils = render(<UpsellPanel icon={Lock} onDismiss={() => {}} />);
    const input = revealForm(utils);
    fireEvent.change(input, { target: { value: "KEY-OK" } });
    fireEvent.click(utils.getByRole("button", { name: "Activate" }));

    await waitFor(() =>
      expect(
        utils.getByRole("heading", { name: /Licensed — thank you/ }),
      ).toBeDefined(),
    );
    // The success path reads the DETAILED seam (NOT the keychain-free status()).
    await waitFor(() => expect(statusDetail).toHaveBeenCalled());
    // The shared snapshot now carries the masked key/email — the License pane
    // renders them instead of the "—" placeholder.
    const snap = getLicenseUiSnapshot();
    expect(snap.state).toBe("licensed");
    if (snap.state === "licensed") {
      expect(snap.maskedKey).toBe("••••••••V3");
      expect(snap.email).toBe("buyer@tinkerdev.io");
    }
  });

  it("InlineActivation (no onDismiss) hides the dead 'Done' button after activation (gsd-ui #3)", async () => {
    // InlineActivation is rendered WITHOUT onDismiss (the live entitlement flip
    // re-renders behind the License pane), so a "Done" that no-ops is a dead
    // control — it must not render. The standalone panel (onDismiss passed) keeps
    // Done, asserted by the success test above.
    const activate = vi.fn(() => Promise.resolve(LICENSED));
    setPlatformForTest(
      platformWith({ activate, status: () => Promise.resolve(LICENSED) }),
    );
    const utils = render(<InlineActivation variant="upsell" icon={Lock} />);
    const input = revealForm(utils);
    fireEvent.change(input, { target: { value: "KEY-OK" } });
    fireEvent.click(utils.getByRole("button", { name: "Activate" }));

    await waitFor(() =>
      expect(
        utils.getByRole("heading", { name: /Licensed — thank you/ }),
      ).toBeDefined(),
    );
    expect(utils.queryByRole("button", { name: "Done" })).toBeNull();
  });

  it("clears the persisted D-31 free-tier override on success so Pro unlocks live (walkthrough 2026-06-12)", async () => {
    // Seed a persisted dev override, then activate successfully — the panel
    // must clear it BEFORE refreshing entitlements (only success clears it).
    const store = createStoreStub();
    await store.set(PREFERENCES_STORE_KEY, { entitlementsOverride: "free" });
    setPlatformForTest({
      ...makeMemoryPlatform(store),
      license: {
        ...noopLicense,
        activate: () => Promise.resolve(LICENSED),
        status: () => Promise.resolve(LICENSED),
      },
    });
    const utils = render(<UpsellPanel icon={Lock} />);
    const input = revealForm(utils);
    fireEvent.change(input, { target: { value: "KEY-OK" } });
    fireEvent.click(utils.getByRole("button", { name: "Activate" }));

    await waitFor(() =>
      expect(
        utils.getByRole("heading", { name: /Licensed — thank you/ }),
      ).toBeDefined(),
    );
    const blob = (await store.get(PREFERENCES_STORE_KEY)) as {
      entitlementsOverride?: unknown;
    };
    expect(blob.entitlementsOverride).toBeNull();
    expect(refreshEntitlements).toHaveBeenCalled();
  });
});

describe("UpsellPanel activation errors (D-36/D-37/D-38)", () => {
  it("seatLimit renders the resolution path inline and the field keeps its value (D-36/D-37)", async () => {
    setPlatformForTest(
      platformWith({
        activate: () => Promise.reject({ code: "seatLimit" as const }),
      }),
    );
    const utils = render(<UpsellPanel icon={Lock} />);
    const input = revealForm(utils);
    fireEvent.change(input, { target: { value: "KEY-SEAT" } });
    fireEvent.click(utils.getByRole("button", { name: "Activate" }));

    await waitFor(() =>
      expect(liveRegion(utils).textContent).toContain("other device"),
    );
    // D-37: the field RETAINS its value for correction — and focus is restored
    // to it (19-UI-REVIEW fix 2) so the user lands where the fix goes.
    expect(input.value).toBe("KEY-SEAT");
    expect(document.activeElement).toBe(input);
  });

  it("offline and serviceUnreachable render two DIFFERENT messages (D-38)", async () => {
    const messages: string[] = [];
    for (const code of ["offline", "serviceUnreachable"] as const) {
      setPlatformForTest(
        platformWith({ activate: () => Promise.reject({ code }) }),
      );
      const utils = render(<UpsellPanel icon={Lock} />);
      const input = revealForm(utils);
      fireEvent.change(input, { target: { value: "KEY-NET" } });
      fireEvent.click(utils.getByRole("button", { name: "Activate" }));
      await waitFor(() => {
        const text = liveRegion(utils).textContent ?? "";
        expect(text).not.toBe("");
        expect(text).not.toContain("Activating");
      });
      messages.push(liveRegion(utils).textContent ?? "");
      utils.unmount();
    }
    expect(messages[0]).not.toBe(messages[1]);
  });
});

describe("UpsellPanel license-problem state (D-44)", () => {
  const PROBLEM: LicenseStatusPayload = {
    state: "problem",
    problem: "corrupt",
    hasStoredKey: false,
  };
  const PROBLEM_STORED: LicenseStatusPayload = {
    state: "problem",
    problem: "tampered",
    hasStoredKey: true,
  };

  it("renders the problem state — distinct heading, form pre-revealed, field focused, NO sales pitch", async () => {
    setPlatformForTest(
      platformWith({ status: () => Promise.resolve(PROBLEM) }),
    );
    setLicenseUiForTest(PROBLEM);
    const utils = render(<UpsellPanel icon={Lock} />);

    expect(
      utils.getByRole("heading", { name: /couldn't be verified/ }),
    ).toBeDefined();
    const input = utils.getByRole("textbox", { name: "License key" });
    // A paying customer never sees the pitch (D-44).
    expect(utils.queryByText(/Most of TinkerDev is free/)).toBeNull();
    expect(utils.queryByText(/lifetime license/)).toBeNull();
    // The key field is auto-focused (deferred past the modal's mount focus).
    await waitFor(() => expect(document.activeElement).toBe(input));
  });

  it("with a stored key, an empty-field submit calls activate(null) — stored-key reactivation (D-44/LIC-04)", async () => {
    const activate = vi.fn(() => Promise.resolve(LICENSED));
    setPlatformForTest(
      platformWith({
        activate,
        status: () => Promise.resolve(PROBLEM_STORED),
      }),
    );
    setLicenseUiForTest(PROBLEM_STORED);
    const utils = render(<UpsellPanel icon={Lock} />);

    const input = utils.getByRole("textbox", {
      name: "License key",
    }) as HTMLInputElement;
    // The saved-key affordance names the saved key, never the key itself —
    // and a PERSISTENT helper line backs the placeholder (19-UI-REVIEW fix 3:
    // placeholders are not labels per WCAG 3.3.2), wired via aria-describedby.
    expect(input.placeholder).toContain("saved key");
    expect(input.value).toBe("");
    const hint = utils.getByText(/Leave the field empty to use your saved key/);
    expect(input.getAttribute("aria-describedby")).toBe(hint.id);
    // The input's placeholder carries an explicit AA-contrast color class.
    expect(input.className).toContain("placeholder:text-tx-3");

    fireEvent.click(utils.getByRole("button", { name: "Activate" }));
    await waitFor(() => expect(activate).toHaveBeenCalledWith(null));
  });
});

// --- Phase 22.2: the focused Unlock-Pro modal wrapper ----------------------

describe("UpsellModal (Phase 22.2 — focused modal over the shared surface)", () => {
  it("renders an aria-modal dialog wrapping the SAME shared pitch surface", () => {
    const { getByRole } = render(<UpsellModal icon={Lock} onClose={() => {}} />);
    const dialog = getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    // Labelled by the pitch heading (the shared ActivationSurface, not a new one).
    expect(dialog.getAttribute("aria-labelledby")).toBe("upsell-heading");
    expect(
      getByRole("heading", { name: /Thank you for using TinkerDev/ }),
    ).toBeTruthy();
    // The command-palette Pro feature is now in the pitch.
    expect(getByRole("button", { name: "Buy license" })).toBeTruthy();
  });

  it("closes on Escape and on a scrim click (its own dismiss contract)", () => {
    const onClose = vi.fn();
    const { container } = render(<UpsellModal icon={Lock} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    // The scrim is the dialog's parent; a mousedown on it (not the card) dismisses.
    const scrim = container.querySelector(".bg-scrim") as HTMLElement;
    fireEvent.mouseDown(scrim);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("returns focus to the invoking element on unmount (focus-return contract)", () => {
    const invoker = document.createElement("button");
    document.body.appendChild(invoker);
    invoker.focus();
    const { unmount } = render(<UpsellModal icon={Lock} onClose={() => {}} />);
    unmount();
    expect(document.activeElement).toBe(invoker);
    invoker.remove();
  });
});
