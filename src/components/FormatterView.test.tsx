// @vitest-environment jsdom
// FormatterView (D-01/D-03/D-06/D-08): the shared presentational shell both the
// JSON and XML formatters render. Two panes (editable input | read-only output),
// a single top toolbar (indent 2/4/tab + minify + conditional sort-keys), a
// visible focusable output copy button writing through the platform seam, and a
// StatusBar footer. It owns NO formatter logic — props in, callbacks out.
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
import { FormatterView } from "./FormatterView";
import type { IndentMode } from "@/lib/format/types";

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

interface Overrides {
  input?: string;
  output?: string;
  indent?: IndentMode;
  minify?: boolean;
  sortKeys?: boolean;
  onSortKeys?: ((v: boolean) => void) | undefined;
  onInputChange?: (raw: string) => void;
  onIndent?: (m: IndentMode) => void;
  onMinify?: (v: boolean) => void;
  status?: {
    parseState: "ok" | "error" | "empty";
    byteCount: number;
    outputBytes?: number;
    error?: string | null;
    timingMs?: number;
  };
}

function renderView(o: Overrides = {}) {
  const onInputChange = o.onInputChange ?? vi.fn();
  const onIndent = o.onIndent ?? vi.fn();
  const onMinify = o.onMinify ?? vi.fn();
  const hasSort = "onSortKeys" in o ? o.onSortKeys !== undefined : true;
  const onSortKeys = hasSort ? (o.onSortKeys ?? vi.fn()) : undefined;
  const utils = render(
    <FormatterView
      inputId="fv-input"
      outputId="fv-output"
      input={o.input ?? ""}
      onInputChange={onInputChange}
      output={o.output ?? ""}
      controls={{
        indent: o.indent ?? "2",
        onIndent,
        minify: o.minify ?? false,
        onMinify,
        sortKeys: hasSort ? (o.sortKeys ?? false) : undefined,
        onSortKeys,
      }}
      status={
        o.status ?? { parseState: "empty", byteCount: 0 }
      }
    />,
  );
  return { ...utils, onInputChange, onIndent, onMinify, onSortKeys };
}

function input(container: HTMLElement): HTMLTextAreaElement {
  const el = container.querySelector<HTMLTextAreaElement>("#fv-input");
  if (!el) throw new Error("input #fv-input not found");
  return el;
}
function output(container: HTMLElement): HTMLTextAreaElement {
  const el = container.querySelector<HTMLTextAreaElement>("#fv-output");
  if (!el) throw new Error("output #fv-output not found");
  return el;
}

describe("FormatterView", () => {
  it("renders an editable input that fires onInputChange with the raw string", () => {
    const onInputChange = vi.fn();
    const { container } = renderView({ onInputChange });
    const inEl = input(container);
    fireEvent.change(inEl, { target: { value: '{"a":1}' } });
    expect(onInputChange).toHaveBeenCalledWith('{"a":1}');
  });

  it("renders a read-only output displaying the output prop verbatim", () => {
    const { container } = renderView({ output: '{\n  "a": 1\n}' });
    const outEl = output(container);
    expect(outEl.readOnly).toBe(true);
    expect(outEl.value).toBe('{\n  "a": 1\n}');
  });

  it("renders indent group + minify always; sort-keys only when onSortKeys provided", () => {
    const withSort = renderView({ onSortKeys: vi.fn() });
    expect(withSort.container.querySelector('[aria-label="Indentation"]')).toBeTruthy();
    expect(
      withSort.getByRole("button", { name: /minify/i }),
    ).toBeTruthy();
    expect(withSort.queryByRole("button", { name: /sort keys/i })).toBeTruthy();

    cleanup();

    const noSort = renderView({ onSortKeys: undefined });
    expect(noSort.container.querySelector('[aria-label="Indentation"]')).toBeTruthy();
    expect(noSort.getByRole("button", { name: /minify/i })).toBeTruthy();
    expect(noSort.queryByRole("button", { name: /sort keys/i })).toBeNull();
  });

  it("has a visible copy button that writes the output through the platform seam", () => {
    const { getByRole } = renderView({ output: '{"a":1}' });
    const copy = getByRole("button", { name: /copy output/i });
    fireEvent.click(copy);
    expect(writeText).toHaveBeenCalledWith('{"a":1}');
  });

  it("wires StatusBar from the status prop and clears output text on error", () => {
    const { container, getByRole } = renderView({
      output: "",
      status: {
        parseState: "error",
        byteCount: 7,
        error: "1:7 Unexpected token",
        timingMs: 0.3,
      },
    });
    const statusFooter = getByRole("status");
    expect(within(statusFooter).getByLabelText("parse state").textContent).toBe(
      "Error",
    );
    // The error span's accessible name IS the full message (Fix-2), so it is
    // reachable by that text rather than the literal word "error".
    expect(
      within(statusFooter).getByLabelText("1:7 Unexpected token").textContent,
    ).toContain("1:7");
    expect(output(container).value).toBe("");
  });

  it("marks the active indent option and an ON toggle with aria-pressed (accent = selected)", () => {
    const { getByRole } = renderView({
      indent: "4",
      minify: true,
      sortKeys: false,
      onSortKeys: vi.fn(),
    });
    expect(getByRole("button", { name: "4" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(getByRole("button", { name: "2" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
    expect(
      getByRole("button", { name: /minify/i }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      getByRole("button", { name: /sort keys/i }).getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("fires the toolbar callbacks on interaction", () => {
    const onIndent = vi.fn();
    const onMinify = vi.fn();
    const onSortKeys = vi.fn();
    const { getByRole } = renderView({
      onIndent,
      onMinify,
      onSortKeys,
      minify: false,
    });
    fireEvent.click(getByRole("button", { name: "tab" }));
    expect(onIndent).toHaveBeenCalledWith("tab");
    fireEvent.click(getByRole("button", { name: /minify/i }));
    expect(onMinify).toHaveBeenCalledWith(true);
    fireEvent.click(getByRole("button", { name: /sort keys/i }));
    expect(onSortKeys).toHaveBeenCalledWith(true);
  });
});
