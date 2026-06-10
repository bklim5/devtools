// @vitest-environment jsdom
// UpsellPanel (D-19..D-22): the ONE shared upsell surface. Card content + copy
// per the 18-UI-SPEC Copywriting Contract; UpsellModal reuses the ⌘K palette's
// scrim/dismiss pattern with full WCAG-AA dialog semantics (aria-modal,
// labelled-by heading, Esc + scrim dismiss, focus into the dialog on mount and
// back to the invoker on unmount).
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { Lock } from "lucide-react";
import { BUY_LICENSE_URL, UpsellModal, UpsellPanel } from "./UpsellPanel";

afterEach(cleanup);

describe("UpsellPanel (card)", () => {
  it("renders the feature heading as a real heading element", () => {
    const { getByRole } = render(<UpsellPanel feature="Theming" icon={Lock} />);
    const heading = getByRole("heading", { name: "Theming is a Pro feature" });
    expect(heading.tagName).toBe("H2");
  });

  it("renders the body copy with no pricing (D-20)", () => {
    const { getByText, container } = render(
      <UpsellPanel feature="Theming" icon={Lock} />,
    );
    expect(
      getByText(
        /Unlock Theming and future power features with a DevTools Pro license — one purchase, yours for life\./,
      ),
    ).toBeDefined();
    expect(container.textContent).not.toMatch(/\$|price/i);
  });

  it("renders the 'Buy license' CTA as a Tab-reachable button (stub no-op, D-21)", () => {
    const { getByRole } = render(<UpsellPanel feature="Theming" icon={Lock} />);
    const buy = getByRole("button", { name: "Buy license" });
    expect(buy.tagName).toBe("BUTTON");
    expect(buy.getAttribute("tabindex")).not.toBe("-1");
    // Stub: clicking must not navigate or throw (no-op this phase).
    fireEvent.click(buy);
    expect(window.location.href).not.toContain(BUY_LICENSE_URL);
  });

  it("exports BUY_LICENSE_URL as a single stub constant", () => {
    expect(typeof BUY_LICENSE_URL).toBe("string");
    expect(BUY_LICENSE_URL.length).toBeGreaterThan(0);
  });

  it("renders the inert 'I have a license key' affordance (D-22)", () => {
    const { getByRole } = render(<UpsellPanel feature="Theming" icon={Lock} />);
    const key = getByRole("button", { name: "I have a license key" });
    expect(key.tagName).toBe("BUTTON");
    expect(key.getAttribute("tabindex")).not.toBe("-1");
    fireEvent.click(key); // inert stub — must not throw
  });

  it("gives both CTAs visible focus rings and keeps the lock treatment neutral (no solid accent fill)", () => {
    const { getByRole } = render(<UpsellPanel feature="Theming" icon={Lock} />);
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
    const { container } = render(<UpsellPanel feature="Theming" icon={Lock} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("UpsellModal (dialog wrapper)", () => {
  it("renders role=dialog with aria-modal and aria-labelledby pointing at the panel heading", () => {
    const { getByRole } = render(
      <UpsellModal feature="Theming" icon={Lock} onClose={() => {}} />,
    );
    const dialog = getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const labelledBy = dialog.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    const heading = getByRole("heading", { name: "Theming is a Pro feature" });
    expect(heading.id).toBe(labelledBy);
  });

  it("calls onClose on Escape (document-level keydown)", () => {
    const onClose = vi.fn();
    render(<UpsellModal feature="Theming" icon={Lock} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose on scrim click but NOT on clicks inside the dialog", () => {
    const onClose = vi.fn();
    const { getByRole } = render(
      <UpsellModal feature="Theming" icon={Lock} onClose={onClose} />,
    );
    const dialog = getByRole("dialog");
    const scrim = dialog.parentElement!;
    // Inside the dialog: stopPropagation keeps the scrim handler silent.
    fireEvent.mouseDown(getByRole("heading", { name: /Pro feature/ }));
    expect(onClose).not.toHaveBeenCalled();
    // On the scrim itself (target === currentTarget): dismiss.
    fireEvent.mouseDown(scrim);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("traps Tab inside the dialog (wraps at both ends — WCAG-AA modal semantics)", () => {
    const { getByRole } = render(
      <UpsellModal feature="Theming" icon={Lock} onClose={() => {}} />,
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
      <UpsellModal feature="Theming" icon={Lock} onClose={() => {}} />,
    );
    expect(document.activeElement).toBe(getByRole("dialog"));

    unmount();
    expect(document.activeElement).toBe(invoker);
  });
});
