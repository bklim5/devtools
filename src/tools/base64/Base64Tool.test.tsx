// @vitest-environment jsdom
// Base64Tool (UX-01..05, ENC-03): three editable panes derive each other instantly
// on change; a base64/base64url toggle re-derives base64; invalid hex shows a
// non-opacity error cue (aria-invalid + text node); the status bar shows byte count
// + encoding; each pane has a VISIBLE focusable <button> copy (NOT hover-gated) that
// writes the pane value through the platform clipboard seam (no @tauri-apps).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, within } from "@testing-library/react";
import {
  resetPlatformForTest,
  setPlatformForTest,
  type Platform,
} from "@/lib/platform";
import { makeMemoryPlatform } from "@/shell/testStore";
import Base64Tool from "./Base64Tool";

let writeText: ReturnType<typeof vi.fn<(text: string) => Promise<void>>>;

beforeEach(() => {
  writeText = vi.fn<(text: string) => Promise<void>>(async () => {});
  const p: Platform = {
    ...makeMemoryPlatform(),
    clipboard: { writeText, readText: async () => "" },
  };
  setPlatformForTest(p);
});

afterEach(() => {
  cleanup();
  resetPlatformForTest();
});

function textareaFor(container: HTMLElement, id: string): HTMLTextAreaElement {
  const el = container.querySelector<HTMLTextAreaElement>(`#${id}`);
  if (!el) throw new Error(`textarea #${id} not found`);
  return el;
}

describe("Base64Tool", () => {
  it("renders three editable textareas (Text / Base64 / Hex)", () => {
    const { container } = render(<Base64Tool />);
    expect(container.querySelectorAll("textarea")).toHaveLength(3);
    expect(textareaFor(container, "base64-pane-text")).toBeTruthy();
    expect(textareaFor(container, "base64-pane-b64")).toBeTruthy();
    expect(textareaFor(container, "base64-pane-hex")).toBeTruthy();
  });

  it("typing into the hex pane derives text + base64 instantly (no convert button)", () => {
    const { container } = render(<Base64Tool />);
    fireEvent.change(textareaFor(container, "base64-pane-hex"), {
      target: { value: "68656c6c6f" },
    });
    expect(textareaFor(container, "base64-pane-text").value).toBe("hello");
    expect(textareaFor(container, "base64-pane-b64").value).toBe("aGVsbG8=");
  });

  it("each pane has a visible, focusable <button> copy affordance (NOT hover-only)", () => {
    const { container } = render(<Base64Tool />);
    const buttons = container.querySelectorAll("button[aria-label^='Copy ']");
    expect(buttons).toHaveLength(3);
    buttons.forEach((b) => {
      expect(b.tagName).toBe("BUTTON");
      expect(b.getAttribute("data-copy")).not.toBe("hover");
      // not hover-revealed: no zero-opacity hide class on the button
      const hiddenClass = ["opacity", "0"].join("-");
      expect(b.className).not.toContain(hiddenClass);
      // tabbable: a <button> without tabindex=-1 is keyboard-reachable
      expect(b.getAttribute("tabindex")).not.toBe("-1");
    });
  });

  it("copy writes the pane's current value through the platform clipboard seam", () => {
    const { container } = render(<Base64Tool />);
    fireEvent.change(textareaFor(container, "base64-pane-text"), {
      target: { value: "hello" },
    });
    const copyText = container.querySelector("button[aria-label='Copy Text']")!;
    fireEvent.click(copyText);
    expect(writeText).toHaveBeenCalledWith("hello");

    const copyB64 = container.querySelector("button[aria-label='Copy Base64']")!;
    fireEvent.click(copyB64);
    expect(writeText).toHaveBeenCalledWith("aGVsbG8=");
  });

  it("copy shows a momentary 'Copied' confirmation that reverts to 'Copy'", () => {
    vi.useFakeTimers();
    try {
      const { container } = render(<Base64Tool />);
      fireEvent.change(textareaFor(container, "base64-pane-text"), {
        target: { value: "hello" },
      });
      const copyText = container.querySelector(
        "button[aria-label='Copy Text']",
      )!;
      expect(copyText.textContent).toContain("Copy");
      expect(copyText.textContent).not.toContain("Copied");

      fireEvent.click(copyText);
      expect(copyText.textContent).toContain("Copied");

      act(() => {
        vi.advanceTimersByTime(1200);
      });
      expect(copyText.textContent).not.toContain("Copied");
      expect(copyText.textContent).toContain("Copy");
    } finally {
      vi.useRealTimers();
    }
  });

  it("a rapid second copy re-arms the 'Copied' window (timer restarts)", () => {
    vi.useFakeTimers();
    try {
      const { container } = render(<Base64Tool />);
      fireEvent.change(textareaFor(container, "base64-pane-text"), {
        target: { value: "hello" },
      });
      const copyText = container.querySelector(
        "button[aria-label='Copy Text']",
      )!;
      fireEvent.click(copyText);
      // ...most of the window elapses, then a second click before it ends
      act(() => vi.advanceTimersByTime(1000));
      fireEvent.click(copyText);
      // Old (first) timer's deadline passes — confirmation must still be showing
      act(() => vi.advanceTimersByTime(400));
      expect(copyText.textContent).toContain("Copied");
      // Full window after the SECOND click then reverts
      act(() => vi.advanceTimersByTime(800));
      expect(copyText.textContent).not.toContain("Copied");
    } finally {
      vi.useRealTimers();
    }
  });

  it("a field error clears the OTHER panes (no stale last-good shown)", () => {
    const { container } = render(<Base64Tool />);
    fireEvent.change(textareaFor(container, "base64-pane-text"), {
      target: { value: "hello" },
    });
    expect(textareaFor(container, "base64-pane-hex").value).toBe("68656c6c6f");
    // odd-length hex → error; text + base64 panes are cleared
    fireEvent.change(textareaFor(container, "base64-pane-hex"), {
      target: { value: "6" },
    });
    expect(textareaFor(container, "base64-pane-text").value).toBe("");
    expect(textareaFor(container, "base64-pane-b64").value).toBe("");
  });

  it("the base64/base64url toggle re-derives base64 (and only base64)", () => {
    const { container } = render(<Base64Tool />);
    // 0xFB 0xFF → base64 contains + or / ; base64url differs and drops padding
    fireEvent.change(textareaFor(container, "base64-pane-hex"), {
      target: { value: "fbff" },
    });
    const b64Before = textareaFor(container, "base64-pane-b64").value;
    const textBefore = textareaFor(container, "base64-pane-text").value;
    const hexBefore = textareaFor(container, "base64-pane-hex").value;

    const toggle = container.querySelector("button[aria-pressed='false']")!;
    fireEvent.click(toggle);

    expect(textareaFor(container, "base64-pane-b64").value).not.toBe(b64Before);
    expect(textareaFor(container, "base64-pane-text").value).toBe(textBefore);
    expect(textareaFor(container, "base64-pane-hex").value).toBe(hexBefore);
  });

  it("invalid hex shows a non-opacity error cue (aria-invalid + visible text)", () => {
    const { container } = render(<Base64Tool />);
    const hexArea = textareaFor(container, "base64-pane-hex");
    fireEvent.change(hexArea, { target: { value: "6" } });
    expect(hexArea.getAttribute("aria-invalid")).toBe("true");
    expect(container.textContent).toContain(
      "Hex must have an even number of digits",
    );
  });

  it("status bar shows byte count and omits the redundant encoding chip", () => {
    const { container } = render(<Base64Tool />);
    fireEvent.change(textareaFor(container, "base64-pane-text"), {
      target: { value: "hello" },
    });
    const status = container.querySelector("footer[role='status']")!;
    const bar = within(status as HTMLElement);
    expect(bar.getByLabelText("byte count").textContent).toContain("5 bytes");
    // The alphabet toggle above already shows base64/base64url; the status bar
    // does not repeat it (the encoding chip is reserved for auto-detection).
    expect(bar.queryByLabelText("encoding")).toBeNull();
  });
});
