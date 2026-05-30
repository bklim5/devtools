// @vitest-environment jsdom
// PHASE 1 THROWAWAY — component tests for the walking-skeleton byte inspector.
// Deleted with the skeleton before Phase 2. Proves the UX-constraint surface the
// per-task UI gate must verify: instant-paste transform, an always-visible +
// focusable copy affordance (not hover-only), and a status bar.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ByteInspector } from "./index";
import { setPlatformForTest, resetPlatformForTest, type Platform } from "@/lib/platform";

afterEach(() => {
  cleanup();
  resetPlatformForTest();
});

describe("ByteInspector skeleton", () => {
  it("transforms instantly on input WITHOUT clicking any button", () => {
    render(<ByteInspector />);
    const input = screen.getByTestId("skeleton-input");

    // Simulate paste/typing via a change event — no button click in between.
    fireEvent.change(input, { target: { value: "abc" } });

    const output = screen.getByTestId("skeleton-output");
    expect(output.textContent).toContain("616263"); // hex of "abc"
    expect(output.textContent).toContain("ABC"); // uppercase
  });

  it("renders an always-visible, keyboard-focusable copy button (NOT hover-only)", () => {
    render(<ByteInspector />);
    const copy = screen.getByTestId("skeleton-copy");

    // It is a real <button>, so it is in the tab order (focusable).
    expect(copy.tagName).toBe("BUTTON");
    expect((copy as HTMLButtonElement).disabled).toBe(false);
    expect(copy.getAttribute("tabindex")).not.toBe("-1");

    // Focusable in practice: focusing it makes it the active element (≤1 keystroke reachable).
    copy.focus();
    expect(document.activeElement).toBe(copy);

    // Not hover-gated: no opacity-0 / group-hover class hiding it by default.
    expect(copy.className).not.toMatch(/opacity-0/);
    expect(copy.className).not.toMatch(/group-hover/);
  });

  it("copies through the platform seam (NOT @tauri-apps/*)", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const stub: Platform = {
      clipboard: { writeText, readText: vi.fn().mockResolvedValue("") },
      store: { get: vi.fn(), set: vi.fn() },
    };
    setPlatformForTest(stub);

    render(<ByteInspector />);
    fireEvent.change(screen.getByTestId("skeleton-input"), { target: { value: "abc" } });
    fireEvent.click(screen.getByTestId("skeleton-copy"));

    // Microtask flush for the async onCopy handler.
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith("616263");
  });

  it("shows a status bar with byte count and a timing value", () => {
    render(<ByteInspector />);
    fireEvent.change(screen.getByTestId("skeleton-input"), { target: { value: "abc" } });

    expect(screen.getByTestId("skeleton-status")).toBeTruthy();
    expect(screen.getByTestId("skeleton-bytecount").textContent).toContain("3 bytes");
    expect(screen.getByTestId("skeleton-timing").textContent).toMatch(/ms$/);
  });
});
