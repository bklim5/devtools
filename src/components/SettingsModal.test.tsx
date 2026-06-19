// @vitest-environment jsdom
// SettingsModal (D-S1..D-S6) — the shell-level Settings dialog with a paned
// layout. Modeled on UpsellPanel.test.tsx's UpsellModal suite: the a11y mechanics
// are a verbatim clone (aria-modal, labelled-by, Esc/backdrop/× dismiss, Tab trap,
// focus return), extended for the pane list (aria-current + aria-live announce).
//
// The License pane hosts LicenseSettings UNCHANGED (SET-06); it reads license
// status on mount, so we point the platform + license-ui seam at a deterministic
// free (notActivated) state before rendering.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { SettingsModal } from "./SettingsModal";
import {
  resetPlatformForTest,
  setPlatformForTest,
  type LicenseStatusPayload,
} from "@/lib/platform";
import {
  resetLicenseUiForTest,
  setLicenseUiForTest,
} from "@/lib/license/licenseUi";
import { makeMemoryPlatform, noopLicense } from "@/shell/testStore";
import {
  closeSettings,
  getSettingsOpen,
  openSettings,
} from "@/shell/settingsStore";

const NOT_ACTIVATED: LicenseStatusPayload = {
  state: "notActivated",
  hasStoredKey: false,
};

function seedFreeState() {
  setPlatformForTest({
    ...makeMemoryPlatform(),
    license: { ...noopLicense, status: () => Promise.resolve(NOT_ACTIVATED) },
  });
  setLicenseUiForTest(NOT_ACTIVATED);
}

afterEach(() => {
  cleanup();
  closeSettings();
  resetLicenseUiForTest();
  resetPlatformForTest();
});

describe("SettingsModal (dialog shell)", () => {
  it("renders role=dialog with aria-modal, z-[60] scrim, and aria-labelledby pointing at the 'Settings' title", () => {
    seedFreeState();
    const { getByRole } = render(<SettingsModal />);
    const dialog = getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.parentElement?.className).toContain("z-[60]");
    const labelledBy = dialog.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    const title = getByRole("heading", { name: "Settings" });
    expect(title.id).toBe(labelledBy);
  });

  it("closes on Escape (document-level keydown)", () => {
    seedFreeState();
    openSettings();
    render(<SettingsModal />);
    expect(getSettingsOpen()).toBe(true);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(getSettingsOpen()).toBe(false);
  });

  it("closes on backdrop mousedown but NOT on clicks inside the dialog", () => {
    seedFreeState();
    openSettings();
    const { getByRole } = render(<SettingsModal />);
    const dialog = getByRole("dialog");
    const scrim = dialog.parentElement!;
    // Inside the dialog: stopPropagation keeps the scrim handler silent.
    fireEvent.mouseDown(getByRole("heading", { name: "Settings" }));
    expect(getSettingsOpen()).toBe(true);
    // On the scrim itself (target === currentTarget): dismiss.
    fireEvent.mouseDown(scrim);
    expect(getSettingsOpen()).toBe(false);
  });

  it("closes on the × control (aria-label 'Close settings')", () => {
    seedFreeState();
    openSettings();
    const { getByRole } = render(<SettingsModal />);
    fireEvent.click(getByRole("button", { name: "Close settings" }));
    expect(getSettingsOpen()).toBe(false);
  });

  it("traps Tab inside the dialog (wraps at both ends — WCAG-AA modal semantics)", () => {
    seedFreeState();
    const { getByRole } = render(<SettingsModal />);
    const dialog = getByRole("dialog");
    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    expect(focusables.length).toBeGreaterThan(0);

    // Tab from the LAST focusable wraps to the first.
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    // Shift+Tab from the FIRST focusable wraps to the last.
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);

    // If focus escapes the dialog, Tab pulls it back in.
    document.body.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(first);
  });

  it("moves focus into the dialog on mount and returns it to the invoker on unmount", () => {
    seedFreeState();
    const { getByRole: getInvoker } = render(
      <button type="button">invoker</button>,
    );
    const invoker = getInvoker("button", { name: "invoker" });
    invoker.focus();
    expect(document.activeElement).toBe(invoker);

    const { getByRole, unmount } = render(<SettingsModal />);
    expect(document.activeElement).toBe(getByRole("dialog"));

    unmount();
    expect(document.activeElement).toBe(invoker);
  });
});

describe("SettingsModal (paned layout — License pane)", () => {
  it("marks the active pane nav item with aria-current='page'", () => {
    seedFreeState();
    openSettings("license"); // open ON the License pane (no longer the default)
    const { getByRole } = render(<SettingsModal />);
    // The License nav item (button-list model, NOT a tab).
    const navItem = getByRole("button", { name: /License/ });
    expect(navItem.getAttribute("aria-current")).toBe("page");
  });

  it("does NOT use a tablist (button-list model locked for Phases 23-25)", () => {
    seedFreeState();
    const { queryByRole } = render(<SettingsModal />);
    expect(queryByRole("tablist")).toBeNull();
    expect(queryByRole("tab")).toBeNull();
  });

  it("announces the active pane via a polite aria-live region ('License settings')", () => {
    seedFreeState();
    openSettings("license"); // open ON the License pane (no longer the default)
    const { container } = render(<SettingsModal />);
    // LicenseSettings owns its own aria-live regions (status heading etc.); the
    // modal's pane announcement is the sr-only polite region carrying "{label}
    // settings". Match it specifically rather than the first polite region.
    const live = container.querySelector('[aria-live="polite"].sr-only');
    expect(live).not.toBeNull();
    expect(live?.textContent).toContain("License settings");
  });

  it("renders the License pane content (LicenseSettings) — the sr-only 'License' landmark is present", () => {
    seedFreeState();
    openSettings("license"); // open ON the License pane (no longer the default)
    const { getByRole } = render(<SettingsModal />);
    // LicenseSettings carries an <h3 className="sr-only">License</h3> landmark —
    // h3 nests one level under the dialog's "Settings" <h2> (no heading inversion).
    expect(getByRole("heading", { level: 3, name: "License" })).toBeDefined();
  });
});
