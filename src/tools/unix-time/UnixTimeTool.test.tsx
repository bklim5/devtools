// @vitest-environment jsdom
// UnixTimeTool (TIME-01, UX-01..05): paste a unix timestamp (s/ms) → LOCAL + UTC +
// ISO render instantly (no convert button, UX-01); the unit is auto-detected by
// magnitude with a manual s/ms override (mirrors the Base64 alphabet toggle —
// aria-pressed, accent = selected only); an editable ISO/datetime field derives the
// timestamp back (two-way, D-06); a live "now" readout carries a VISIBLE focusable
// copy <button> (UX-02). Empty input is neutral (no error); malformed input is a
// field-scoped explicit error (aria-invalid + text-bad, never opacity-only, UX-04).
// Clipboard goes through the platform seam ONLY (no @tauri-apps).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import {
  resetPlatformForTest,
  setPlatformForTest,
  type Platform,
} from "@/lib/platform";
import { createStoreStub } from "@/lib/platform/stub";
import UnixTimeTool from "./UnixTimeTool";

let writeText: ReturnType<typeof vi.fn<(text: string) => Promise<void>>>;

beforeEach(() => {
  writeText = vi.fn<(text: string) => Promise<void>>(async () => {});
  const p: Platform = {
    clipboard: { writeText, readText: async () => "" },
    store: createStoreStub(),
  };
  setPlatformForTest(p);
});

afterEach(() => {
  cleanup();
  resetPlatformForTest();
});

function inputFor(container: HTMLElement, id: string): HTMLTextAreaElement {
  const el = container.querySelector<HTMLTextAreaElement>(`#${id}`);
  if (!el) throw new Error(`field #${id} not found`);
  return el;
}

describe("UnixTimeTool", () => {
  it("typing a seconds timestamp auto-detects 's' and renders UTC + ISO", () => {
    const { container } = render(<UnixTimeTool />);
    fireEvent.change(inputFor(container, "unix-time-input"), {
      target: { value: "1469922850" },
    });
    const iso = container.querySelector("#unix-time-iso")!;
    expect(iso.textContent).toContain("2016-07-30T23:54:10.000Z");
    // The UTC humanized row is present and non-empty.
    const utc = container.querySelector("#unix-time-utc")!;
    expect(utc.textContent).toBeTruthy();
  });

  it("typing a millisecond timestamp auto-detects 'ms' and renders the ms-precise ISO", () => {
    const { container } = render(<UnixTimeTool />);
    fireEvent.change(inputFor(container, "unix-time-input"), {
      target: { value: "1469922850259" },
    });
    const iso = container.querySelector("#unix-time-iso")!;
    expect(iso.textContent).toContain("2016-07-30T23:54:10.259Z");
  });

  it("empty timestamp field → status parseState 'empty' and NO error node", () => {
    const { container } = render(<UnixTimeTool />);
    const status = container.querySelector("footer[role='status']")!;
    expect(status.textContent).toContain("Empty");
    expect(container.querySelector("[aria-label='error']")).toBeNull();
    expect(
      inputFor(container, "unix-time-input").getAttribute("aria-invalid"),
    ).not.toBe("true");
  });

  it("non-numeric timestamp → a field-scoped explicit error (aria-invalid + text-bad), status 'error', no crash", () => {
    const { container } = render(<UnixTimeTool />);
    const field = inputFor(container, "unix-time-input");
    fireEvent.change(field, { target: { value: "notanumber" } });
    expect(field.getAttribute("aria-invalid")).toBe("true");
    const err = container.querySelector("#unix-time-input-error");
    expect(err).toBeTruthy();
    expect(err!.className).toContain("text-bad");
    const status = container.querySelector("footer[role='status']")!;
    expect(status.textContent).toContain("Error");
  });

  it("the unit override toggle reflects the active unit and forcing the other unit re-renders the datetime", () => {
    const { container } = render(<UnixTimeTool />);
    fireEvent.change(inputFor(container, "unix-time-input"), {
      target: { value: "1469922850" }, // auto-detected as seconds
    });
    const isoSecondsView = container.querySelector("#unix-time-iso")!.textContent;
    expect(isoSecondsView).toContain("2016-07-30T23:54:10.000Z");

    // The toggle exposes aria-pressed; "s" is the active (auto-detected) unit.
    const secondsBtn = container.querySelector("button[aria-pressed='true']")!;
    expect(secondsBtn.textContent).toContain("s");

    // Force "ms": 1469922850 ms is a totally different (1970) date → ISO changes.
    const msBtn = container.querySelector(
      "button[aria-pressed='false']",
    ) as HTMLButtonElement;
    fireEvent.click(msBtn);
    const isoMsView = container.querySelector("#unix-time-iso")!.textContent;
    expect(isoMsView).not.toBe(isoSecondsView);
    expect(isoMsView).toContain("1970-01-18");
  });

  it("the reverse ISO field derives the timestamp (two-way, D-06) into the forward field", () => {
    const { container } = render(<UnixTimeTool />);
    fireEvent.change(inputFor(container, "unix-time-iso-input"), {
      target: { value: "2016-07-30T23:54:10.259Z" },
    });
    // Default active unit for an empty forward field is ms → 1469922850259.
    expect(inputFor(container, "unix-time-input").value).toBe("1469922850259");
  });

  it("a 'now' readout exists with a visible focusable Copy button (no hover-only copy)", () => {
    const { container } = render(<UnixTimeTool />);
    const copyBtns = container.querySelectorAll("button[aria-label^='Copy']");
    expect(copyBtns.length).toBeGreaterThan(0);
    copyBtns.forEach((b) => {
      expect(b.tagName).toBe("BUTTON");
      expect(b.getAttribute("tabindex")).not.toBe("-1");
      const hiddenClass = ["opacity", "0"].join("-");
      expect(b.className).not.toContain(hiddenClass);
    });
    const now = container.querySelector("#unix-time-now")!;
    expect(now.textContent).toBeTruthy();
  });

  it("the 'now' copy writes through the platform clipboard seam", () => {
    const { container } = render(<UnixTimeTool />);
    const copyNow = container.querySelector(
      "button[aria-label='Copy now']",
    ) as HTMLButtonElement;
    fireEvent.click(copyNow);
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toMatch(/^\d+$/);
  });
});
