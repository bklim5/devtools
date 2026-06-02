// @vitest-environment jsdom
// XmlFormatterTool (FMT-05..08, D-07/D-08/D-12): a thin tool over formatXml +
// FormatterView. Paste-instant derive (no format button), error clears output +
// shows the parsererror message, empty -> status "empty", toggles re-derive,
// visible copy through the platform seam, NO sort-keys control (XML), registered
// registry-only alongside JSON.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import {
  resetPlatformForTest,
  setPlatformForTest,
  type Platform,
} from "@/lib/platform";
import { createStoreStub } from "@/lib/platform/stub";
import {
  noopWindow,
  noopNativeShortcut,
  noopUpdater,
  noopEvents,
} from "@/shell/testStore";
import XmlFormatterTool from "./XmlFormatterTool";
import { xmlFormatterTool } from "./index";
import { jsonFormatterTool } from "@/tools/json-formatter";
import { TOOLS, getToolById } from "@/lib/tools/registry";
import * as formatXmlModule from "@/lib/format/xml";

let writeText: ReturnType<typeof vi.fn<(text: string) => Promise<void>>>;

beforeEach(() => {
  writeText = vi.fn<(text: string) => Promise<void>>(async () => {});
  const p: Platform = {
    clipboard: { writeText, readText: async () => "" },
    store: createStoreStub(),
    window: noopWindow,
    nativeShortcut: noopNativeShortcut,
    updater: noopUpdater,
    events: noopEvents,
  };
  setPlatformForTest(p);
});

afterEach(() => {
  cleanup();
  resetPlatformForTest();
});

function inputEl(container: HTMLElement): HTMLTextAreaElement {
  const el = container.querySelector<HTMLTextAreaElement>("#xml-input");
  if (!el) throw new Error("#xml-input not found");
  return el;
}
function outputEl(container: HTMLElement): HTMLTextAreaElement {
  const el = container.querySelector<HTMLTextAreaElement>("#xml-output");
  if (!el) throw new Error("#xml-output not found");
  return el;
}

describe("XmlFormatterTool", () => {
  it("prettifies instantly on input with no format button", () => {
    const { container } = render(<XmlFormatterTool />);
    expect(container.querySelector('button[aria-label*="Format" i]')).toBeNull();
    fireEvent.change(inputEl(container), { target: { value: "<a><b>1</b></a>" } });
    const out = outputEl(container).value;
    expect(out).toContain("\n");
    expect(out).toBe("<a>\n  <b>1</b>\n</a>");
    const status = container.querySelector("footer[role=status]")! as HTMLElement;
    expect(within(status).getByLabelText("parse state").textContent).toBe("OK");
    // Size readout is KEPT for the formatters (UIX-01) — byte count present.
    expect(within(status).getByLabelText("byte count")).toBeTruthy();
  });

  it("clears output and shows the parsererror on invalid XML", () => {
    const { container } = render(<XmlFormatterTool />);
    fireEvent.change(inputEl(container), { target: { value: "<a><b></a>" } });
    expect(outputEl(container).value).toBe("");
    const status = container.querySelector("footer[role=status]")! as HTMLElement;
    expect(within(status).getByLabelText("parse state").textContent).toBe("Error");
    // The error span's accessible name IS the message (Fix-2); locate it via its
    // title tooltip rather than the old literal "error" label.
    const errEl = status.querySelector<HTMLElement>("span[title]")!;
    expect(errEl.textContent!.length).toBeGreaterThan(0);
  });

  it("shows status 'empty' for empty input with no error", () => {
    const { container } = render(<XmlFormatterTool />);
    fireEvent.change(inputEl(container), { target: { value: "   " } });
    expect(outputEl(container).value).toBe("");
    const status = container.querySelector("footer[role=status]")! as HTMLElement;
    expect(within(status).getByLabelText("parse state").textContent).toBe("Empty");
    expect(within(status).queryByLabelText("error")).toBeNull();
  });

  it("re-derives on indent / minify toggles", () => {
    const { container, getByRole } = render(<XmlFormatterTool />);
    fireEvent.change(inputEl(container), { target: { value: "<a><b>1</b></a>" } });

    fireEvent.click(getByRole("button", { name: "4" }));
    expect(outputEl(container).value).toBe("<a>\n    <b>1</b>\n</a>");

    fireEvent.click(getByRole("button", { name: /minify/i }));
    expect(outputEl(container).value).toBe("<a><b>1</b></a>");
  });

  it("renders NO sort-keys control (XML omits onSortKeys, D-06)", () => {
    const { queryByRole } = render(<XmlFormatterTool />);
    expect(queryByRole("button", { name: /sort keys/i })).toBeNull();
  });

  it("copies the derived output through the platform seam", () => {
    const { container, getByRole } = render(<XmlFormatterTool />);
    fireEvent.change(inputEl(container), { target: { value: "<a>1</a>" } });
    fireEvent.click(getByRole("button", { name: /copy output/i }));
    expect(writeText).toHaveBeenCalledWith(outputEl(container).value);
  });

  it("times the pure formatXml call, not the state setter (WR-02)", () => {
    // WR-02: timing was measured around setInput (a state setter that only
    // schedules a re-render), so it always read ~0 ms. The fix brackets the pure
    // formatXml call during render. The format spy advances the clock by 7 ms each
    // time it runs, so a bracket around it measures +7 ms; one around setInput would
    // never move the clock (0.0 ms).
    let clock = 0;
    const nowSpy = vi.spyOn(performance, "now").mockImplementation(() => clock);
    const original = formatXmlModule.formatXml;
    const formatSpy = vi
      .spyOn(formatXmlModule, "formatXml")
      .mockImplementation((...args) => {
        const out = original(...args);
        clock += 7;
        return out;
      });

    const { container } = render(<XmlFormatterTool />);
    fireEvent.change(inputEl(container), { target: { value: "<a>1</a>" } });

    const status = container.querySelector("footer[role=status]")! as HTMLElement;
    const timing = within(status).getByLabelText("timing").textContent ?? "";
    expect(timing).toBe("7.0 ms");

    formatSpy.mockRestore();
    nowSpy.mockRestore();
  });

  it("is registered in TOOLS alongside JSON and resolvable by id (D-12)", () => {
    expect(xmlFormatterTool.id).toBe("xml-formatter");
    expect(xmlFormatterTool.category).toBe("formatting");
    expect(TOOLS).toContain(xmlFormatterTool);
    expect(TOOLS).toContain(jsonFormatterTool); // append did not drop JSON
    expect(getToolById("xml-formatter")).toBe(xmlFormatterTool);
  });
});
