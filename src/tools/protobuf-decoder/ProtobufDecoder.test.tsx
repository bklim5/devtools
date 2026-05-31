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
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import {
  resetPlatformForTest,
  setPlatformForTest,
  type Platform,
} from "@/lib/platform";
import { createStoreStub } from "@/lib/platform/stub";
import ProtobufDecoder from "./ProtobufDecoder";

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

  it("surfaces the auto-detected encoding as an accent chip (D-01 refinement)", () => {
    const { container } = render(<ProtobufDecoder />);
    fireEvent.change(input(container), { target: { value: "089601" } });
    const chip = container.querySelector("[data-encoding-chip]") as HTMLElement;
    expect(chip).toBeTruthy();
    expect(chip.textContent?.toLowerCase()).toContain("hex");
    // accent = the active detection (the override toggle selects it) — D-08
    expect(chip.className).toContain("text-accent");
  });

  it("a manual override toggle forces base64", () => {
    const { container } = render(<ProtobufDecoder />);
    // "AA==" is base64 but would NOT be valid hex; auto-detect picks base64 anyway,
    // so force the question by typing something hex-shaped then overriding.
    fireEvent.change(input(container), { target: { value: "6869" } }); // valid hex -> detected hex
    expect(
      (container.querySelector("[data-encoding-chip]") as HTMLElement).textContent?.toLowerCase(),
    ).toContain("hex");
    const base64Override = within(container).getByRole("button", { name: /^base64$/i });
    fireEvent.click(base64Override);
    expect(
      (container.querySelector("[data-encoding-chip]") as HTMLElement).textContent?.toLowerCase(),
    ).toContain("base64");
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

  it("per-node copy writes the selected reading through the clipboard seam", () => {
    const { container } = render(<ProtobufDecoder />);
    fireEvent.change(input(container), { target: { value: "089601" } });
    const nodeCopy = container.querySelector("button[data-copy-node]") as HTMLButtonElement;
    fireEvent.click(nodeCopy);
    expect(writeText).toHaveBeenCalledWith("150");
  });
});
