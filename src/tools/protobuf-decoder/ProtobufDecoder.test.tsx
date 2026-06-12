// @vitest-environment jsdom
// ProtobufDecoder (PRO-01/02/06, D-01/03/07/10/11, UX-01/03): the hero tool root.
//   - decodes on input change (no decode button) — PRO-01
//   - a group byte ("1c") surfaces an error + an inline error state, never throws — PRO-02
//   - empty input is a neutral empty state (no error)
//   - the AUTO-DETECTED encoding shows as an ACCENT chip near the override toggle
//     (03-CONTEXT refinement); a manual override forces the other encoding — D-01
//   - example payload chips fill + decode the input — D-03
//   - the rows/cards toggle reads + persists protobufTreeStyle via usePreferences — D-07
//   - copy-all-as-JSON writes fieldsToJson(...) through the platform clipboard seam — D-11
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, within } from "@testing-library/react";
import {
  resetPlatformForTest,
  setPlatformForTest,
  type Platform,
} from "@/lib/platform";
import { makeMemoryPlatform } from "@/shell/testStore";
import ProtobufDecoder from "./ProtobufDecoder";
import { EXAMPLES } from "./examples";
import { detectEncoding } from "./detectEncoding";

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

function input(container: HTMLElement): HTMLTextAreaElement {
  const el = container.querySelector<HTMLTextAreaElement>("#protobuf-input");
  if (!el) throw new Error("protobuf input textarea not found");
  return el;
}

describe("ProtobufDecoder", () => {
  it("decodes on input change with no decode button (paste-instant, PRO-01)", () => {
    const { container } = render(<ProtobufDecoder />);
    // No button labelled decode/submit/convert triggers decoding.
    const buttons = Array.from(container.querySelectorAll("button"));
    expect(
      buttons.some((b) => /decode|submit|convert/i.test(b.textContent ?? "")),
    ).toBe(false);

    fireEvent.change(input(container), { target: { value: "089601" } });
    // field #1 renders, with a uint64=150 chip selected by default.
    const fnums = Array.from(container.querySelectorAll("[data-fnum]")).map(
      (n) => n.textContent,
    );
    expect(fnums.some((t) => t?.includes("#1"))).toBe(true);
    expect(container.textContent).toContain("150");
    // Size readout is KEPT for the protobuf decoder (UIX-01) — byte count present.
    const status = container.querySelector("footer[role='status']")! as HTMLElement;
    expect(within(status).getByLabelText("byte count")).toBeTruthy();
  });

  it("renders a group byte ('1c') as an error and does NOT throw (PRO-02)", () => {
    const { container } = render(<ProtobufDecoder />);
    expect(() =>
      fireEvent.change(input(container), { target: { value: "1c" } }),
    ).not.toThrow();
    const status = container.querySelector("footer[role='status']")!;
    expect(within(status as HTMLElement).getByLabelText("parse state").textContent).toBe(
      "Error",
    );
    expect(container.textContent?.toLowerCase()).toContain("group");
  });

  it("empty input is a neutral empty state (no error)", () => {
    const { container } = render(<ProtobufDecoder />);
    const status = container.querySelector("footer[role='status']")!;
    expect(within(status as HTMLElement).getByLabelText("parse state").textContent).toBe(
      "Empty",
    );
    expect(status.querySelector(".text-bad")).toBeNull();
  });

  it("shows the auto-detected encoding via the toggle's active (accent) segment (D-01)", () => {
    const { container } = render(<ProtobufDecoder />);
    fireEvent.change(input(container), { target: { value: "089601" } });
    // No separate chip — the encoding toggle's active segment IS the readout.
    expect(container.querySelector("[data-encoding-chip]")).toBeNull();
    const hexBtn = within(container).getByRole("button", { name: /^hex$/i });
    expect(hexBtn.getAttribute("aria-pressed")).toBe("true");
    expect(hexBtn.className).toContain("text-accent"); // accent = active (D-08)
    expect(
      within(container).getByRole("button", { name: /^base64$/i }).getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("a manual override toggle forces base64 (active segment moves)", () => {
    const { container } = render(<ProtobufDecoder />);
    fireEvent.change(input(container), { target: { value: "6869" } }); // valid hex -> detected hex
    const hexBtn = within(container).getByRole("button", { name: /^hex$/i });
    const base64Btn = within(container).getByRole("button", { name: /^base64$/i });
    expect(hexBtn.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(base64Btn);
    expect(base64Btn.getAttribute("aria-pressed")).toBe("true");
    expect(hexBtn.getAttribute("aria-pressed")).toBe("false");
    // clicking the active segment again clears the override → back to auto-detect (hex)
    fireEvent.click(base64Btn);
    expect(hexBtn.getAttribute("aria-pressed")).toBe("true");
  });

  it("clicking an example chip fills + decodes the input (D-03)", () => {
    const { container } = render(<ProtobufDecoder />);
    const example = container.querySelector("[data-example]") as HTMLButtonElement;
    expect(example).toBeTruthy();
    fireEvent.click(example);
    expect(input(container).value.length).toBeGreaterThan(0);
    // something decoded (a field rendered)
    expect(container.querySelector("[data-fnum]")).toBeTruthy();
  });

  it("auto-detects a decimal byte array and lights the decimal segment (D-01/D-08, PRO-08)", () => {
    const { container } = render(<ProtobufDecoder />);
    // Canonical decimal array — same wire bytes as {1:150}.
    fireEvent.change(input(container), { target: { value: "10, 3, 80, 81, 82" } });
    const decimalBtn = within(container).getByRole("button", { name: /^decimal$/i });
    expect(decimalBtn.getAttribute("aria-pressed")).toBe("true");
    expect(decimalBtn.className).toContain("text-accent"); // accent = active (D-08)
    // It decodes: field #1 renders with the uint64=150 reading, no error state.
    expect(container.querySelector("[data-fnum]")).toBeTruthy();
    expect(container.textContent).toContain("150");
    const status = container.querySelector("footer[role='status']")!;
    expect(within(status as HTMLElement).getByLabelText("parse state").textContent).toBe(
      "OK",
    );
  });

  it("surfaces a named decimal range error, not a base64 error, on an out-of-range token (PRO-09)", () => {
    const { container } = render(<ProtobufDecoder />);
    expect(() =>
      fireEvent.change(input(container), { target: { value: "1, 2, 999" } }),
    ).not.toThrow();
    const status = container.querySelector("footer[role='status']")!;
    expect(within(status as HTMLElement).getByLabelText("parse state").textContent).toBe(
      "Error",
    );
    // Scope the assertion to the inline error message itself — "base64" is always
    // present as a toggle segment label, so check the alert is the DECIMAL error.
    const alert = container.querySelector("[role='alert']")!;
    const alertText = alert.textContent?.toLowerCase() ?? "";
    expect(alertText).toContain("999"); // the offending token is named
    expect(alertText).toContain("out of range");
    expect(alertText).toContain("decimal byte"); // a decimal error, never a base64 fallback
    expect(alertText).not.toContain("base64");
  });

  it("clicking the decimal example chip fills + decodes the canonical array (D-10)", () => {
    const { container } = render(<ProtobufDecoder />);
    const decimalChip = within(container).getByRole("button", { name: /^decimal bytes$/i });
    fireEvent.click(decimalChip);
    expect(input(container).value).toBe("10, 3, 80, 81, 82");
    expect(container.querySelector("[data-fnum]")).toBeTruthy();
    expect(within(container).getByRole("button", { name: /^decimal$/i }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("EXAMPLES-detection contract: every example value auto-detects to its declared encoding", () => {
    // Chip clicks clear the override to auto-detect (no forced encoding), so the
    // chips only stay deterministic if detectEncoding resolves each example's
    // value to its declared `encoding`. This locks that contract test-time.
    for (const ex of EXAMPLES) {
      expect(detectEncoding(ex.value), `example "${ex.label}"`).toBe(ex.encoding);
    }
  });

  it("an example chip click clears a stale forced override — auto-detect flips to hex", () => {
    const { container } = render(<ProtobufDecoder />);
    // Seed a hex value first (detected hex) so clicking base64 genuinely FORCES a
    // mismatched override — on empty input base64 is already the active segment
    // and the click would clear back to auto-detect instead (codex review).
    fireEvent.change(input(container), { target: { value: "6869" } });
    const base64Btn = within(container).getByRole("button", { name: /^base64$/i });
    expect(base64Btn.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(base64Btn);
    expect(base64Btn.getAttribute("aria-pressed")).toBe("true");
    // Click the "{1:150}" hex example chip → the override is CLEARED, auto-detect
    // resolves hex (EXAMPLES contract), the segment flips, and it decodes.
    fireEvent.click(within(container).getByRole("button", { name: /^\{1:150\}$/ }));
    const hexBtn = within(container).getByRole("button", { name: /^hex$/i });
    expect(hexBtn.getAttribute("aria-pressed")).toBe("true");
    expect(base64Btn.getAttribute("aria-pressed")).toBe("false");
    expect(container.querySelector("[data-fnum]")).toBeTruthy();
    expect(container.querySelector("[role='alert']")).toBeNull();
  });

  it("the decimal example chip clears a forced-hex override — auto-detect flips to decimal", () => {
    const { container } = render(<ProtobufDecoder />);
    // Force hex.
    const hexBtn = within(container).getByRole("button", { name: /^hex$/i });
    fireEvent.click(hexBtn);
    expect(hexBtn.getAttribute("aria-pressed")).toBe("true");
    // Click "decimal bytes" → override cleared, auto-detect routes the comma
    // array to decimal, the segment flips, and the canonical array decodes.
    fireEvent.click(within(container).getByRole("button", { name: /^decimal bytes$/i }));
    const decimalBtn = within(container).getByRole("button", { name: /^decimal$/i });
    expect(decimalBtn.getAttribute("aria-pressed")).toBe("true");
    expect(hexBtn.getAttribute("aria-pressed")).toBe("false");
    expect(input(container).value).toBe("10, 3, 80, 81, 82");
    expect(container.querySelector("[data-fnum]")).toBeTruthy();
    expect(container.querySelector("[role='alert']")).toBeNull();
  });

  it("segment clicks still force + click-active-clears after a chip click (sticky force unchanged)", () => {
    const { container } = render(<ProtobufDecoder />);
    // Chip click → decimal auto-detected (no override stored).
    fireEvent.click(within(container).getByRole("button", { name: /^decimal bytes$/i }));
    const decimalBtn = within(container).getByRole("button", { name: /^decimal$/i });
    const hexBtn = within(container).getByRole("button", { name: /^hex$/i });
    expect(decimalBtn.getAttribute("aria-pressed")).toBe("true");
    // Segment click still FORCES a sticky override post-chip.
    fireEvent.click(hexBtn);
    expect(hexBtn.getAttribute("aria-pressed")).toBe("true");
    expect(decimalBtn.getAttribute("aria-pressed")).toBe("false");
    // Clicking the active segment clears the override → auto-detect re-derives
    // decimal for this value, and nothing errors.
    fireEvent.click(hexBtn);
    expect(decimalBtn.getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector("[data-fnum]")).toBeTruthy();
    expect(container.querySelector("[role='alert']")).toBeNull();
  });

  it("typing decimal input after a hex example chip re-activates decimal (stale-override regression)", () => {
    const { container } = render(<ProtobufDecoder />);
    const decimalBtn = within(container).getByRole("button", { name: /^decimal$/i });
    // User repro: type decimal first — auto-detects decimal.
    fireEvent.change(input(container), { target: { value: "10,3,50,51,52" } });
    expect(decimalBtn.getAttribute("aria-pressed")).toBe("true");
    // Click the "nested message" hex chip — hex activates and decodes.
    fireEvent.click(within(container).getByRole("button", { name: /^nested message$/i }));
    expect(
      within(container).getByRole("button", { name: /^hex$/i }).getAttribute("aria-pressed"),
    ).toBe("true");
    // Type decimal AGAIN — the chip must not have left a sticky hex override
    // (was: forced-hex → "Hex must have an even number of digits").
    fireEvent.change(input(container), { target: { value: "10,3,50,51,52" } });
    expect(decimalBtn.getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector("[data-fnum]")).toBeTruthy();
    expect(container.querySelector("[role='alert']")).toBeNull();
  });

  it("the rows/cards toggle calls setTreeStyle and re-renders the tree style (D-07)", () => {
    const { container } = render(<ProtobufDecoder />);
    fireEvent.change(input(container), { target: { value: "089601" } });
    // default cards
    expect(container.querySelector(".tree-cards")).toBeTruthy();
    const rowsToggle = within(container).getByRole("button", { name: /rows/i });
    fireEvent.click(rowsToggle);
    expect(container.querySelector(".tree-rows")).toBeTruthy();
    expect(container.querySelector(".tree-cards")).toBeNull();
  });

  it("copy-all-as-JSON writes fieldsToJson through the platform clipboard seam (D-11)", () => {
    const { container } = render(<ProtobufDecoder />);
    fireEvent.change(input(container), { target: { value: "089601" } });
    const copyAll = within(container).getByRole("button", { name: /copy all as json/i });
    fireEvent.click(copyAll);
    expect(writeText).toHaveBeenCalledTimes(1);
    const written = writeText.mock.calls[0][0];
    // pretty JSON keyed by field number, value = selected reading (uint64 default 150)
    expect(written).toContain('"1": "150"');
  });

  it("resets stale per-node selection + expansion on a new decode (no leak into display or copy)", () => {
    const { container } = render(<ProtobufDecoder />);
    const fnums = () =>
      Array.from(container.querySelectorAll("[data-fnum]")).map((n) => n.textContent ?? "");

    // Payload A: {3:{1:150}} — outer #3 is a message, auto-expanded → inner #1 shows.
    fireEvent.change(input(container), { target: { value: "1a03089601" } });
    expect(fnums().some((t) => t.includes("#1"))).toBe(true);

    // Override the OUTER node to its non-message floor chip (last radio in the first
    // group) → its subtree hides. This stores a non-message selection at path "0".
    const firstGroup = container.querySelector('[role="radiogroup"]')!;
    const radios = firstGroup.querySelectorAll('[role="radio"]');
    fireEvent.click(radios[radios.length - 1]);
    expect(fnums().some((t) => t.includes("#1"))).toBe(false); // subtree hidden by the selection

    // Payload B: {3:{1:300}} — different bytes, still a message at path "0". A new
    // decode MUST reset selection/expansion (D-04/D-05) — otherwise the stale
    // non-message selection hides the subtree and serializes it as hex in copy.
    fireEvent.change(input(container), { target: { value: "1a0308ac02" } });
    expect(fnums().some((t) => t.includes("#1"))).toBe(true); // auto-expanded again

    const copyAll = within(container).getByRole("button", { name: /copy all as json/i });
    fireEvent.click(copyAll);
    const calls = writeText.mock.calls;
    const written = calls[calls.length - 1][0];
    expect(written).toContain('"3"');
    expect(written).toContain('"1"'); // nested object, not a hex string
  });

  it("per-node copy writes the selected reading through the clipboard seam", () => {
    const { container } = render(<ProtobufDecoder />);
    fireEvent.change(input(container), { target: { value: "089601" } });
    const nodeCopy = container.querySelector("button[data-copy-node]") as HTMLButtonElement;
    fireEvent.click(nodeCopy);
    expect(writeText).toHaveBeenCalledWith("150");
  });

  it("copy-all shows a momentary 'Copied' confirmation that reverts", () => {
    vi.useFakeTimers();
    try {
      const { container } = render(<ProtobufDecoder />);
      fireEvent.change(input(container), { target: { value: "089601" } });
      const copyAll = within(container).getByRole("button", { name: /copy all as json/i });
      expect(copyAll.textContent).toContain("Copy all as JSON");
      fireEvent.click(copyAll);
      expect(copyAll.textContent).toContain("Copied");
      act(() => vi.advanceTimersByTime(1200));
      expect(copyAll.textContent).toContain("Copy all as JSON");
    } finally {
      vi.useRealTimers();
    }
  });

  it("per-node copy shows a momentary confirmation (accent state)", () => {
    vi.useFakeTimers();
    try {
      const { container } = render(<ProtobufDecoder />);
      fireEvent.change(input(container), { target: { value: "089601" } });
      const nodeCopy = container.querySelector("button[data-copy-node]") as HTMLButtonElement;
      expect(nodeCopy.className).not.toContain("text-accent");
      fireEvent.click(nodeCopy);
      expect(nodeCopy.className).toContain("text-accent");
      act(() => vi.advanceTimersByTime(1200));
      expect(nodeCopy.className).not.toContain("text-accent");
    } finally {
      vi.useRealTimers();
    }
  });
});
