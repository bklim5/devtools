// @vitest-environment jsdom
// FormatterView (D-01/D-03/D-04/D-06/D-08): the shared presentational shell every
// formatter tool renders. Two panes (editable input | read-only output), a single
// top toolbar (a mutually-exclusive [ Prettify | Minify ] mode selector + indent
// 2/4/tab + an OPTIONAL printWidth 80/100/120 + conditional sort-keys), a visible
// focusable output copy button writing through the platform seam, and a StatusBar
// footer. It owns NO formatter logic — props in, callbacks out. Phase 32 generalized
// it: the standalone minify toggle became the mode selector, and indent + printWidth
// are HIDDEN in Minify mode (D-04).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import {
  resetPlatformForTest,
  setPlatformForTest,
  type Platform,
} from "@/lib/platform";
import { makeMemoryPlatform } from "@/shell/testStore";
import { FormatterView, type FormatMode } from "./FormatterView";
import type { IndentMode } from "@/lib/format/types";

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

interface Overrides {
  input?: string;
  inputPlaceholder?: string;
  output?: string;
  mode?: FormatMode;
  indent?: IndentMode;
  printWidth?: number;
  onPrintWidth?: ((w: number) => void) | undefined;
  sortKeys?: boolean;
  onSortKeys?: ((v: boolean) => void) | undefined;
  semi?: boolean;
  onSemi?: ((v: boolean) => void) | undefined;
  singleQuote?: boolean;
  onSingleQuote?: ((v: boolean) => void) | undefined;
  onInputChange?: (raw: string) => void;
  onIndent?: (m: IndentMode) => void;
  onMode?: (m: FormatMode) => void;
  status?: {
    parseState: "ok" | "error" | "empty";
    byteCount: number;
    outputBytes?: number;
    error?: string | null;
    timingMs?: number;
    pending?: boolean;
  };
}

function renderView(o: Overrides = {}) {
  const onInputChange = o.onInputChange ?? vi.fn();
  const onIndent = o.onIndent ?? vi.fn();
  const onMode = o.onMode ?? vi.fn();
  const hasSort = "onSortKeys" in o ? o.onSortKeys !== undefined : true;
  const onSortKeys = hasSort ? (o.onSortKeys ?? vi.fn()) : undefined;
  const hasWidth = "onPrintWidth" in o ? o.onPrintWidth !== undefined : false;
  const onPrintWidth = hasWidth ? (o.onPrintWidth ?? vi.fn()) : undefined;
  const hasSemi = "onSemi" in o ? o.onSemi !== undefined : false;
  const onSemi = hasSemi ? (o.onSemi ?? vi.fn()) : undefined;
  const hasSingleQuote = "onSingleQuote" in o ? o.onSingleQuote !== undefined : false;
  const onSingleQuote = hasSingleQuote ? (o.onSingleQuote ?? vi.fn()) : undefined;
  const utils = render(
    <FormatterView
      inputId="fv-input"
      outputId="fv-output"
      input={o.input ?? ""}
      inputPlaceholder={o.inputPlaceholder}
      onInputChange={onInputChange}
      output={o.output ?? ""}
      controls={{
        mode: o.mode ?? "prettify",
        onMode,
        indent: o.indent ?? "2",
        onIndent,
        printWidth: hasWidth ? (o.printWidth ?? 80) : undefined,
        onPrintWidth,
        sortKeys: hasSort ? (o.sortKeys ?? false) : undefined,
        onSortKeys,
        semi: hasSemi ? (o.semi ?? true) : undefined,
        onSemi,
        singleQuote: hasSingleQuote ? (o.singleQuote ?? false) : undefined,
        onSingleQuote,
      }}
      status={o.status ?? { parseState: "empty", byteCount: 0 }}
    />,
  );
  return {
    ...utils,
    onInputChange,
    onIndent,
    onMode,
    onSortKeys,
    onPrintWidth,
    onSemi,
    onSingleQuote,
  };
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

describe("FormatterView panes + copy", () => {
  it("renders an editable input that fires onInputChange with the raw string", () => {
    const onInputChange = vi.fn();
    const { container } = renderView({ onInputChange });
    fireEvent.change(input(container), { target: { value: '{"a":1}' } });
    expect(onInputChange).toHaveBeenCalledWith('{"a":1}');
  });

  it("renders the inputPlaceholder on the input textarea when provided (Fix-3)", () => {
    const { container } = renderView({ inputPlaceholder: "Paste JSON to format…" });
    expect(input(container).placeholder).toBe("Paste JSON to format…");
  });

  it("renders no placeholder when inputPlaceholder is omitted", () => {
    const { container } = renderView();
    expect(input(container).placeholder).toBe("");
  });

  it("renders a read-only output displaying the output prop verbatim", () => {
    const { container } = renderView({ output: '{\n  "a": 1\n}' });
    const outEl = output(container);
    expect(outEl.readOnly).toBe(true);
    expect(outEl.value).toBe('{\n  "a": 1\n}');
  });

  it("has a visible copy button that writes the output through the platform seam", () => {
    const { getByRole } = renderView({ output: '{"a":1}' });
    fireEvent.click(getByRole("button", { name: /copy output/i }));
    expect(writeText).toHaveBeenCalledWith('{"a":1}');
  });
});

describe("FormatterView mode selector (D-03)", () => {
  it("renders the [ Prettify | Minify ] mode segments", () => {
    const { getByRole } = renderView();
    expect(getByRole("button", { name: "Prettify" })).toBeTruthy();
    expect(getByRole("button", { name: "Minify" })).toBeTruthy();
  });

  it("marks the active mode segment with aria-pressed", () => {
    const { getByRole } = renderView({ mode: "minify" });
    expect(getByRole("button", { name: "Minify" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(
      getByRole("button", { name: "Prettify" }).getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("calls onMode with the clicked mode", () => {
    const onMode = vi.fn();
    const { getByRole } = renderView({ onMode });
    fireEvent.click(getByRole("button", { name: "Minify" }));
    expect(onMode).toHaveBeenCalledWith("minify");
  });
});

describe("FormatterView indent / printWidth / sort-keys visibility (D-04/D-06)", () => {
  it("shows the Indent group + fires onIndent; sort-keys only when onSortKeys given", () => {
    const onIndent = vi.fn();
    const withSort = renderView({ onIndent, onSortKeys: vi.fn() });
    expect(withSort.getByRole("group", { name: "Indent" })).toBeTruthy();
    fireEvent.click(withSort.getByRole("button", { name: "tab" }));
    expect(onIndent).toHaveBeenCalledWith("tab");
    expect(withSort.queryByRole("button", { name: /sort keys/i })).toBeTruthy();

    cleanup();

    const noSort = renderView({ onSortKeys: undefined });
    expect(noSort.getByRole("group", { name: "Indent" })).toBeTruthy();
    expect(noSort.queryByRole("button", { name: /sort keys/i })).toBeNull();
  });

  it("hides the Indent AND printWidth groups in Minify mode (D-04)", () => {
    const { queryByRole, getByRole } = renderView({
      mode: "minify",
      printWidth: 80,
      onPrintWidth: vi.fn(),
    });
    expect(queryByRole("group", { name: "Indent" })).toBeNull();
    expect(queryByRole("group", { name: "Width" })).toBeNull();
    // ...the mode selector itself is still present.
    expect(getByRole("button", { name: "Minify" })).toBeTruthy();
  });

  it("shows the printWidth group only in Prettify mode when onPrintWidth is supplied", () => {
    const { getByRole } = renderView({ printWidth: 100, onPrintWidth: vi.fn() });
    expect(getByRole("group", { name: "Width" })).toBeTruthy();
    expect(getByRole("button", { name: "80" })).toBeTruthy();
    expect(getByRole("button", { name: "120" })).toBeTruthy();
    expect(getByRole("button", { name: "100" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("renders NO printWidth control for a tool without onPrintWidth (JSON/XML, D-06)", () => {
    const { queryByRole, getByRole } = renderView();
    expect(queryByRole("group", { name: "Width" })).toBeNull();
    expect(getByRole("group", { name: "Indent" })).toBeTruthy();
  });

  it("calls onPrintWidth with the clicked width", () => {
    const onPrintWidth = vi.fn();
    const { getByRole } = renderView({ printWidth: 80, onPrintWidth });
    fireEvent.click(getByRole("button", { name: "120" }));
    expect(onPrintWidth).toHaveBeenCalledWith(120);
  });
});

describe("FormatterView Semi / Single-quotes toggles (D-06/D-07)", () => {
  it("renders both toggles (by full aria-label) in Prettify when handlers supplied", () => {
    const { getByRole } = renderView({ onSemi: vi.fn(), onSingleQuote: vi.fn() });
    expect(getByRole("button", { name: "semicolons" })).toBeTruthy();
    expect(getByRole("button", { name: "single quotes" })).toBeTruthy();
  });

  it("gives the toggles short visible labels distinct from their aria-labels", () => {
    const { getByRole } = renderView({ onSemi: vi.fn(), onSingleQuote: vi.fn() });
    const semi = getByRole("button", { name: "semicolons" });
    const single = getByRole("button", { name: "single quotes" });
    expect(semi.textContent).toBe("Semi");
    expect(single.textContent).toBe("Single quotes");
  });

  it("reflects semi/singleQuote via aria-pressed (semi ON, singleQuote OFF by default)", () => {
    const { getByRole } = renderView({
      semi: true,
      onSemi: vi.fn(),
      singleQuote: false,
      onSingleQuote: vi.fn(),
    });
    expect(
      getByRole("button", { name: "semicolons" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      getByRole("button", { name: "single quotes" }).getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("hides BOTH toggles in Minify mode (D-06)", () => {
    const { queryByRole } = renderView({
      mode: "minify",
      onSemi: vi.fn(),
      onSingleQuote: vi.fn(),
    });
    expect(queryByRole("button", { name: "semicolons" })).toBeNull();
    expect(queryByRole("button", { name: "single quotes" })).toBeNull();
  });

  it("renders NEITHER toggle for a tool that omits the handlers (JSON/XML/HTML)", () => {
    const { queryByRole } = renderView();
    expect(queryByRole("button", { name: "semicolons" })).toBeNull();
    expect(queryByRole("button", { name: "single quotes" })).toBeNull();
  });

  it("fires onSemi / onSingleQuote with the negated value", () => {
    const onSemi = vi.fn();
    const onSingleQuote = vi.fn();
    const { getByRole } = renderView({
      semi: true,
      onSemi,
      singleQuote: false,
      onSingleQuote,
    });
    fireEvent.click(getByRole("button", { name: "semicolons" }));
    expect(onSemi).toHaveBeenCalledWith(false);
    fireEvent.click(getByRole("button", { name: "single quotes" }));
    expect(onSingleQuote).toHaveBeenCalledWith(true);
  });
});

describe("FormatterView StatusBar wiring", () => {
  it("wires the error StatusBar (role=alert) and clears output text on error", () => {
    const { container, getByRole } = renderView({
      output: "",
      status: {
        parseState: "error",
        byteCount: 7,
        error: "1:7 Unexpected token",
        timingMs: 0.3,
      },
    });
    // On error the footer is now an assertive alert live region (D-07).
    const statusFooter = getByRole("alert");
    expect(within(statusFooter).getByLabelText("parse state").textContent).toBe(
      "Error",
    );
    expect(
      within(statusFooter).getByLabelText("1:7 Unexpected token").textContent,
    ).toContain("1:7");
    expect(output(container).value).toBe("");
  });

  it("passes the pending flag through to the StatusBar Formatting… hint (D-01)", () => {
    const { getByLabelText } = renderView({
      status: { parseState: "ok", byteCount: 12, pending: true },
    });
    expect(getByLabelText("formatting").textContent).toContain("Formatting");
  });
});
