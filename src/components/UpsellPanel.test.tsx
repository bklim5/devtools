// @vitest-environment jsdom
// UpsellPanel (D-19..D-22 + Phase 19 D-33..D-39/D-44): the ONE shared upsell
// surface. Card content + copy per the 18-UI-SPEC Copywriting Contract;
// UpsellModal reuses the ⌘K palette's scrim/dismiss pattern with full WCAG-AA
// dialog semantics (aria-modal, labelled-by heading, Esc + scrim dismiss,
// focus into the dialog on mount and back to the invoker on unmount).
// The Phase-19 describe below covers the inline activation flow: reveal-in-
// place form, calm in-flight/success/error states, the distinct D-44 problem
// state, and stored-key reactivation (activate(null)).
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { Lock } from "lucide-react";
import { BUY_LICENSE_URL, UpsellModal, UpsellPanel } from "./UpsellPanel";
import {
  resetPlatformForTest,
  setPlatformForTest,
  type LicenseStatusPayload,
  type Platform,
} from "@/lib/platform";
import {
  resetLicenseUiForTest,
  setLicenseUiForTest,
} from "@/lib/license/licenseUi";
import { makeMemoryPlatform, noopLicense } from "@/shell/testStore";
import { refreshEntitlements } from "@/lib/entitlements/store";
import { createStoreStub } from "@/lib/platform/stub";
import { PREFERENCES_STORE_KEY } from "@/shell/preferences";
import {
  closeUpsell,
  getUpsellInvoker,
  openUpsell,
} from "@/shell/upsellStore";

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
  it("renders the thank-you heading as a real heading element", () => {
    const { getByRole } = render(<UpsellPanel icon={Lock} />);
    const heading = getByRole("heading", {
      name: /Thank you for using TinkerDev/,
    });
    expect(heading.tagName).toBe("H2");
  });

  it("renders the final two-paragraph body copy with no pricing (D-20) and no feature meta line (D-19 override)", () => {
    const { getByText, queryByText, container } = render(
      <UpsellPanel icon={Lock} />,
    );
    expect(getByText(/Most of TinkerDev is free/)).toBeDefined();
    expect(
      getByText(/consider supporting it with a lifetime license/),
    ).toBeDefined();
    // D-19 override (walkthrough 2026-06-10): NO "Unlocks:" meta line — lock
    // context comes from the affordance the user clicked.
    expect(queryByText(/Unlocks:/)).toBeNull();
    expect(container.textContent).not.toMatch(/\$|price/i);
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

describe("UpsellModal (dialog wrapper)", () => {
  it("renders role=dialog with aria-modal and aria-labelledby pointing at the panel heading", () => {
    const { getByRole } = render(
      <UpsellModal icon={Lock} onClose={() => {}} />,
    );
    const dialog = getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    // 19-UI-REVIEW fix 1: the scrim must stack ABOVE the shell's z-50
    // bottom-right overlays (update consent/banner) so nothing interactive
    // floats clickable outside the aria-modal trap.
    expect(dialog.parentElement?.className).toContain("z-[60]");
    const labelledBy = dialog.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    const heading = getByRole("heading", {
      name: /Thank you for using TinkerDev/,
    });
    expect(heading.id).toBe(labelledBy);
  });

  it("calls onClose on Escape (document-level keydown)", () => {
    const onClose = vi.fn();
    render(<UpsellModal icon={Lock} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose on scrim click but NOT on clicks inside the dialog", () => {
    const onClose = vi.fn();
    const { getByRole } = render(
      <UpsellModal icon={Lock} onClose={onClose} />,
    );
    const dialog = getByRole("dialog");
    const scrim = dialog.parentElement!;
    // Inside the dialog: stopPropagation keeps the scrim handler silent.
    fireEvent.mouseDown(getByRole("heading", { name: /TinkerDev/ }));
    expect(onClose).not.toHaveBeenCalled();
    // On the scrim itself (target === currentTarget): dismiss.
    fireEvent.mouseDown(scrim);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("traps Tab inside the dialog (wraps at both ends — WCAG-AA modal semantics)", () => {
    const { getByRole } = render(
      <UpsellModal icon={Lock} onClose={() => {}} />,
    );
    const buy = getByRole("button", { name: "Buy license" });
    const key = getByRole("button", { name: "I have a license key" });

    // Tab from the LAST focusable wraps to the first.
    key.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(buy);

    // Shift+Tab from the FIRST focusable wraps to the last.
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(key);

    // If focus somehow lands outside the dialog, Tab pulls it back in.
    document.body.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(buy);
  });

  it("moves focus into the dialog on mount and returns it to the invoker on unmount", () => {
    const { getByRole: getInvoker } = render(
      <button type="button">invoker</button>,
    );
    const invoker = getInvoker("button", { name: "invoker" });
    invoker.focus();
    expect(document.activeElement).toBe(invoker);

    const { getByRole, unmount } = render(
      <UpsellModal icon={Lock} onClose={() => {}} />,
    );
    expect(document.activeElement).toBe(getByRole("dialog"));

    unmount();
    expect(document.activeElement).toBe(invoker);
  });

  // 21-04 FLAG E1: via the store path the modal mounts decoupled from the
  // trigger, so document.activeElement at mount-effect time is unreliable. The
  // modal must instead restore focus to the invoker captured SYNCHRONOUSLY by
  // openUpsell() — even if focus has since moved off the trigger. Proves the
  // store→modal seam returns focus to the recorded opener, not <body>.
  it("returns focus to the store-captured invoker even if focus moved before mount (E1)", () => {
    const { getByRole: getInvoker } = render(
      <button type="button">store invoker</button>,
    );
    const invoker = getInvoker("button", { name: "store invoker" });
    invoker.focus();
    // openUpsell() captures the invoker NOW (its click-handler moment).
    openUpsell();
    expect(getUpsellInvoker()).toBe(invoker);

    // Focus churns away before the modal mounts (the decoupled-mount gap).
    document.body.focus();

    const { unmount } = render(<UpsellModal icon={Lock} onClose={() => {}} />);
    unmount();
    // Restored to the recorded opener, not the churned-to <body>.
    expect(document.activeElement).toBe(invoker);
    closeUpsell(); // clear the module singleton for the next test
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
