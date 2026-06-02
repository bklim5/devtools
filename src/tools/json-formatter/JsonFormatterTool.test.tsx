// @vitest-environment jsdom
// JsonFormatterTool (FMT-01..04, FMT-08, D-07/D-08/D-12): a thin tool over
// formatJson + FormatterView. Paste-instant derive (no format button), error
// clears output + shows line:col, empty -> status "empty", toggles re-derive,
// visible copy through the platform seam, registered registry-only.
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
import JsonFormatterTool from "./JsonFormatterTool";
import { jsonFormatterTool } from "./index";
import { TOOLS, getToolById } from "@/lib/tools/registry";
import * as formatJsonModule from "@/lib/format/json";

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
  const el = container.querySelector<HTMLTextAreaElement>("#json-input");
  if (!el) throw new Error("#json-input not found");
  return el;
}
function outputEl(container: HTMLElement): HTMLTextAreaElement {
  const el = container.querySelector<HTMLTextAreaElement>("#json-output");
  if (!el) throw new Error("#json-output not found");
  return el;
}

describe("JsonFormatterTool", () => {
  it("prettifies instantly on input with no format button", () => {
    const { container } = render(<JsonFormatterTool />);
    expect(
      container.querySelector('button[aria-label*="Format" i]'),
    ).toBeNull();
    fireEvent.change(inputEl(container), { target: { value: '{"b":1,"a":2}' } });
    const out = outputEl(container).value;
    expect(out).toContain("\n");
    expect(out).toContain('  "b": 1');
    const status = container.querySelector("footer[role=status]")!;
    expect(within(status as HTMLElement).getByLabelText("parse state").textContent).toBe(
      "OK",
    );
  });

  it("clears output and shows a line:col error on invalid JSON", () => {
    const { container } = render(<JsonFormatterTool />);
    fireEvent.change(inputEl(container), { target: { value: '{"a": }' } });
    expect(outputEl(container).value).toBe("");
    const status = container.querySelector("footer[role=status]")! as HTMLElement;
    expect(within(status).getByLabelText("parse state").textContent).toBe("Error");
    // The error span's accessible name IS the message (Fix-2); locate it via its
    // title tooltip rather than the old literal "error" label.
    const errEl = status.querySelector<HTMLElement>("span[title]")!;
    expect(errEl.textContent).toMatch(/\d+:\d+/);
  });

  it("shows status 'empty' for empty input with no error", () => {
    const { container } = render(<JsonFormatterTool />);
    fireEvent.change(inputEl(container), { target: { value: "   " } });
    expect(outputEl(container).value).toBe("");
    const status = container.querySelector("footer[role=status]")! as HTMLElement;
    expect(within(status).getByLabelText("parse state").textContent).toBe("Empty");
    expect(within(status).queryByLabelText("error")).toBeNull();
  });

  it("re-derives on indent / minify / sort-keys toggles", () => {
    const { container, getByRole } = render(<JsonFormatterTool />);
    fireEvent.change(inputEl(container), { target: { value: '{"b":1,"a":2}' } });

    fireEvent.click(getByRole("button", { name: "4" }));
    expect(outputEl(container).value).toContain('    "b": 1');

    fireEvent.click(getByRole("button", { name: /minify/i }));
    expect(outputEl(container).value).toBe('{"b":1,"a":2}');

    fireEvent.click(getByRole("button", { name: /sort keys/i }));
    expect(outputEl(container).value).toBe('{"a":2,"b":1}');
  });

  it("copies the derived output through the platform seam", () => {
    const { container, getByRole } = render(<JsonFormatterTool />);
    fireEvent.change(inputEl(container), { target: { value: '{"a":1}' } });
    fireEvent.click(getByRole("button", { name: /copy output/i }));
    expect(writeText).toHaveBeenCalledWith(outputEl(container).value);
  });

  it("times the pure formatJson call, not the state setter (WR-02)", () => {
    // WR-02: timing was measured around setInput (a state setter that only
    // schedules a re-render), so it always read ~0 ms regardless of the actual
    // format cost. The fix brackets the pure formatJson call during render.
    //
    // Discriminator: the format spy advances the clock by 7 ms each time it runs.
    // A bracket that wraps the formatJson call therefore measures +7 ms; a bracket
    // that wraps only setInput (the old handler) never moves the clock -> 0.0 ms.
    let clock = 0;
    const nowSpy = vi.spyOn(performance, "now").mockImplementation(() => clock);
    // Capture the real implementation BEFORE spying — the named import is a live
    // binding, so calling it after spyOn would recurse into the mock.
    const original = formatJsonModule.formatJson;
    const formatSpy = vi
      .spyOn(formatJsonModule, "formatJson")
      .mockImplementation((...args) => {
        const out = original(...args);
        clock += 7;
        return out;
      });

    const { container } = render(<JsonFormatterTool />);
    fireEvent.change(inputEl(container), { target: { value: '{"a":1}' } });

    const status = container.querySelector("footer[role=status]")! as HTMLElement;
    const timing = within(status).getByLabelText("timing").textContent ?? "";
    // Non-zero, tied to the format pass — never the old 0.0 ms.
    expect(timing).toBe("7.0 ms");

    formatSpy.mockRestore();
    nowSpy.mockRestore();
  });

  it("is registered in TOOLS and resolvable by id (registry-only, D-12)", () => {
    expect(jsonFormatterTool.id).toBe("json-formatter");
    expect(jsonFormatterTool.category).toBe("formatting");
    expect(TOOLS).toContain(jsonFormatterTool);
    expect(getToolById("json-formatter")).toBe(jsonFormatterTool);
  });
});
