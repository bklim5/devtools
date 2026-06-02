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
    expect(within(status).getByLabelText("error").textContent).toMatch(/\d+:\d+/);
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

  it("is registered in TOOLS and resolvable by id (registry-only, D-12)", () => {
    expect(jsonFormatterTool.id).toBe("json-formatter");
    expect(jsonFormatterTool.category).toBe("formatting");
    expect(TOOLS).toContain(jsonFormatterTool);
    expect(getToolById("json-formatter")).toBe(jsonFormatterTool);
  });
});
