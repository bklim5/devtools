// @vitest-environment jsdom
// JsFormatterTool (PRT-09/10/12, D-01..D-10, SC5 tool half): a thin ASYNC tool over
// formatJsTs/minifyJsTs + the shared useAsyncFormat guard + FormatterView. Like the
// P33 HTML test it uses REAL timers + waitFor — the format runs after the 180ms
// debounce and dynamically imports the real Prettier/esbuild engines (which resolve
// under jsdom as in the golden/parity suites).
//
// The load-bearing proofs here: async prettify across ALL FOUR dialects (JS, TS,
// JSX, TSX — the no-language-picker promise), Minify via esbuild, the two Prettify-
// only style toggles (Semi/Single-quotes, incl. their Minify-hidden visibility), the
// oversize role=alert guard surfacing WITHOUT a "0 bytes" readout regression, the
// DISTINCT tool-seam 0-encode proof over ASCII + multibyte + malformed-surrogate
// over-cap input (the tool never re-encodes the over-cap paste) + the over-cap
// all-whitespace no-re-trim proof, the line:col malformed error (D-03) + recovery,
// copy through the platform seam, and free registry registration (PRT-12).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import {
  resetPlatformForTest,
  setPlatformForTest,
  type Platform,
} from "@/lib/platform";
import { makeMemoryPlatform } from "@/shell/testStore";
import JsFormatterTool from "./JsFormatterTool";
import { jsFormatterTool } from "./index";
import { htmlFormatterTool } from "@/tools/html-formatter";
import { TOOLS, getToolById } from "@/lib/tools/registry";
import * as prettier from "@/lib/format/prettier";

// esbuild-wasm's startup invariant trips under jsdom's cross-realm TextEncoder, so
// the REAL Minify engine can't run in this DOM env (it is exercised for real in the
// node-env minify.test.ts / html-golden.test.ts SC2 goldens + the 34-05 WKWebView
// e2e). Here the tool test's job is narrower: prove the tool DISPATCHES to
// minifyJsTs in Minify mode and renders its output — so minifyJsTs is stubbed with a
// faithful compact stand-in. The Prettify path (formatJsTs) stays the REAL engine.
vi.mock("@/lib/format/minify", () => ({
  __setEsbuildInitForTest: () => {},
  minifyJsTs: vi.fn(
    async (input: string): Promise<import("@/lib/format/types").FormatResult> => ({
      ok: true,
      output: "const a=1;console.log(a);",
      inputBytes: input.length,
      outputBytes: 25,
    }),
  ),
}));

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

function inputEl(container: HTMLElement): HTMLTextAreaElement {
  const el = container.querySelector<HTMLTextAreaElement>("#js-input");
  if (!el) throw new Error("#js-input not found");
  return el;
}
function outputEl(container: HTMLElement): HTMLTextAreaElement {
  const el = container.querySelector<HTMLTextAreaElement>("#js-output");
  if (!el) throw new Error("#js-output not found");
  return el;
}

describe("JsFormatterTool", () => {
  // ---- Four-dialect prettify (the no-language-picker promise, D-01/D-04) ----

  it("prettifies plain JS on paste (typescript-first path)", async () => {
    const { container } = render(<JsFormatterTool />);
    fireEvent.change(inputEl(container), { target: { value: "const a=1" } });
    await waitFor(
      () => expect(outputEl(container).value).toContain("const a = 1;"),
      { timeout: 5000 },
    );
  });

  it("prettifies TS-only syntax (typescript parser)", async () => {
    const { container } = render(<JsFormatterTool />);
    fireEvent.change(inputEl(container), {
      target: { value: "interface Y{a:number}const z:Y={a:1}" },
    });
    await waitFor(
      () => {
        const v = outputEl(container).value;
        expect(v).toContain("interface Y {");
        expect(v).toContain("a: number;");
      },
      { timeout: 5000 },
    );
  });

  it("prettifies JSX (no crash, no language picker)", async () => {
    const { container } = render(<JsFormatterTool />);
    fireEvent.change(inputEl(container), {
      target: { value: "const x=<div className='a'/>" },
    });
    // Formatted JSX; singleQuote defaults OFF so the attribute is double-quoted.
    await waitFor(
      () => expect(outputEl(container).value).toContain('<div className="a" />'),
      { timeout: 5000 },
    );
  });

  it("prettifies TSX (generic + JSX)", async () => {
    const { container } = render(<JsFormatterTool />);
    fireEvent.change(inputEl(container), {
      target: { value: "const f=<T,>(x:T):T=>x;const el=<div className='b'/>" },
    });
    await waitFor(
      () => {
        const v = outputEl(container).value;
        expect(v).toContain("<T,>");
        expect(v).toContain('<div className="b" />');
      },
      { timeout: 5000 },
    );
  });

  // ---- Minify (esbuild, D-02) ----

  it("minifies valid JS to compact output via esbuild", async () => {
    const { container, getByRole } = render(<JsFormatterTool />);
    fireEvent.change(inputEl(container), {
      target: { value: "const a = 1;\nconsole.log(a);" },
    });
    fireEvent.click(getByRole("button", { name: "Minify" }));
    // Gate on real content, then assert whitespace was collapsed (spaces gone).
    await waitFor(
      () => expect(outputEl(container).value).toContain("console.log"),
      { timeout: 5000 },
    );
    // Compact: whitespace collapsed away (no source newline, spaces stripped).
    expect(outputEl(container).value).toContain("const a=1");
    expect(outputEl(container).value.includes("\n")).toBe(false);
  });

  // ---- Prettify-only style toggles (D-05/D-06/D-07) ----

  it("Semi toggle OFF drops trailing semicolons from prettified output", async () => {
    const { container, getByRole } = render(<JsFormatterTool />);
    fireEvent.change(inputEl(container), { target: { value: 'const s = "hi"' } });
    // Default (semi ON): a trailing semicolon.
    await waitFor(
      () => expect(outputEl(container).value).toContain('const s = "hi";'),
      { timeout: 5000 },
    );
    fireEvent.click(getByRole("button", { name: "semicolons" }));
    await waitFor(
      () => {
        const v = outputEl(container).value;
        expect(v).toContain('const s = "hi"');
        expect(v).not.toContain(";");
      },
      { timeout: 5000 },
    );
  });

  it("Single-quotes toggle ON switches double quotes to single in prettified output", async () => {
    const { container, getByRole } = render(<JsFormatterTool />);
    fireEvent.change(inputEl(container), { target: { value: 'const s = "hi"' } });
    // Default (singleQuote OFF): double quotes.
    await waitFor(
      () => expect(outputEl(container).value).toContain('"hi"'),
      { timeout: 5000 },
    );
    fireEvent.click(getByRole("button", { name: "single quotes" }));
    await waitFor(
      () => {
        const v = outputEl(container).value;
        expect(v).toContain("'hi'");
        expect(v).not.toContain('"hi"');
      },
      { timeout: 5000 },
    );
  });

  it("shows Semi + Single-quotes toggles in Prettify and HIDES them in Minify (D-06)", () => {
    const { getByRole, queryByRole } = render(<JsFormatterTool />);
    expect(getByRole("button", { name: "semicolons" })).toBeTruthy();
    expect(getByRole("button", { name: "single quotes" })).toBeTruthy();
    fireEvent.click(getByRole("button", { name: "Minify" }));
    expect(queryByRole("button", { name: "semicolons" })).toBeNull();
    expect(queryByRole("button", { name: "single quotes" })).toBeNull();
    fireEvent.click(getByRole("button", { name: "Prettify" }));
    expect(getByRole("button", { name: "semicolons" })).toBeTruthy();
    expect(getByRole("button", { name: "single quotes" })).toBeTruthy();
  });

  // ---- Inherited 2 MB guard (SC5) — cloned SC6 proofs ----

  it("oversize paste surfaces a calm role=alert 'Input too large', clears output, and shows NO size readout", async () => {
    const { container } = render(<JsFormatterTool />);
    fireEvent.change(inputEl(container), {
      target: { value: "a".repeat(2_100_000) },
    });
    await waitFor(
      () => {
        const footer = container.querySelector("footer")!;
        expect(footer.getAttribute("role")).toBe("alert");
      },
      { timeout: 5000 },
    );
    const err = container.querySelector<HTMLElement>('[data-status="error"]')!;
    expect(err.textContent ?? "").toMatch(/Input too large/);
    expect(outputEl(container).value).toBe("");
    // byteCount is the hook's `undefined` (not a `?? 0` fallback) → no size readout.
    expect(container.querySelector('[aria-label="byte count"]')).toBeNull();
  });

  it("oversize paste does ZERO full-string encodes in the render path — ASCII, multibyte, AND malformed-surrogate (SC5 tool-seam 0-encode proof)", async () => {
    const bigAscii = "a".repeat(2_100_000); // UTF-16 length over cap
    const bigMb = "€".repeat(700_000); // length 700k <= cap, but 2.1M UTF-8 bytes
    const bigSurr = "\uD800€".repeat(400_000); // length 800k <= cap, but 2.4M UTF-8 bytes
    // The malformed-surrogate fixture must be genuinely over-cap by the REAL encoder
    // (its code-unit length is UNDER the cap — a naive length filter would miss it).
    expect(new TextEncoder().encode(bigSurr).length).toBeGreaterThan(2_000_000);

    for (const bigInput of [bigAscii, bigMb, bigSurr]) {
      const encodeSpy = vi.spyOn(TextEncoder.prototype, "encode");
      const fmtSpy = vi.spyOn(prettier, "formatJsTs");
      try {
        const { container } = render(<JsFormatterTool />);
        fireEvent.change(inputEl(container), { target: { value: bigInput } });
        await waitFor(
          () => {
            const footer = container.querySelector("footer")!;
            expect(footer.getAttribute("role")).toBe("alert");
          },
          { timeout: 5000 },
        );
        // Never reached the engine (guard short-circuits before the runner)…
        expect(fmtSpy).not.toHaveBeenCalled();
        // …and the over-cap string itself was NEVER encoded. IDENTITY check, not a
        // `.length` filter: bigMb/bigSurr code-unit lengths (700k/800k) are UNDER
        // the cap, so a length filter would silently pass a re-encode regression.
        expect(encodeSpy.mock.calls.every(([s]) => s !== bigInput)).toBe(true);
      } finally {
        fmtSpy.mockRestore();
        encodeSpy.mockRestore();
        cleanup();
      }
    }
  });

  it("over-cap ALL-WHITESPACE paste is oversize WITHOUT a full-length trim at the tool seam", async () => {
    // The tool must not re-run a raw trim on the input value: an over-cap
    // all-whitespace paste would otherwise get a full-length main-thread trim scan
    // at the tool seam, re-opening the exact DoS the hook guard closes. The tool
    // reads `isEmpty` from the hook instead.
    const bigWs = " ".repeat(2_100_000); // 2.1M whitespace bytes > 2 MB cap
    const realTrim = String.prototype.trim;
    const trimmedLengths: number[] = [];
    const trimSpy = vi
      .spyOn(String.prototype, "trim")
      .mockImplementation(function (this: string) {
        trimmedLengths.push(this.length);
        return realTrim.call(this);
      });
    const fmtSpy = vi.spyOn(prettier, "formatJsTs");
    try {
      const { container } = render(<JsFormatterTool />);
      fireEvent.change(inputEl(container), { target: { value: bigWs } });
      await waitFor(
        () => {
          const footer = container.querySelector("footer")!;
          expect(footer.getAttribute("role")).toBe("alert");
        },
        { timeout: 5000 },
      );
      const err = container.querySelector<HTMLElement>('[data-status="error"]')!;
      expect(err.textContent ?? "").toMatch(/Input too large/);
      expect(outputEl(container).value).toBe("");
      expect(fmtSpy).not.toHaveBeenCalled();
      // NO trim call ever saw the full 2.1M-char payload.
      expect(trimmedLengths.every((len) => len < bigWs.length)).toBe(true);
    } finally {
      fmtSpy.mockRestore();
      trimSpy.mockRestore();
    }
  });

  // ---- Errors + recovery (D-03) ----

  it("surfaces a line:col role=alert for malformed input, clears output, and recovers on next valid paste", async () => {
    const { container } = render(<JsFormatterTool />);
    fireEvent.change(inputEl(container), { target: { value: "const a = )" } });
    await waitFor(
      () => {
        const footer = container.querySelector("footer")!;
        expect(footer.getAttribute("role")).toBe("alert");
      },
      { timeout: 5000 },
    );
    const err = container.querySelector<HTMLElement>('[data-status="error"]')!;
    expect(err.textContent ?? "").toMatch(/^\d+:\d+ /);
    expect(outputEl(container).value).toBe("");
    // Recover: a valid paste clears the error and produces output.
    fireEvent.change(inputEl(container), { target: { value: "const a=1" } });
    await waitFor(
      () => expect(outputEl(container).value).toContain("const a = 1;"),
      { timeout: 5000 },
    );
    expect(container.querySelector("footer")!.getAttribute("role")).not.toBe(
      "alert",
    );
  });

  // ---- Copy + registry ----

  it("copies the derived output through the platform seam", async () => {
    const { container, getByRole } = render(<JsFormatterTool />);
    fireEvent.change(inputEl(container), { target: { value: "const a=1" } });
    await waitFor(
      () => expect(outputEl(container).value.length).toBeGreaterThan(0),
      { timeout: 5000 },
    );
    fireEvent.click(getByRole("button", { name: /copy output/i }));
    expect(writeText).toHaveBeenCalledWith(outputEl(container).value);
  });

  it("is registered in TOOLS as a free formatting tool resolvable by id (PRT-12)", () => {
    expect(jsFormatterTool.id).toBe("js-formatter");
    expect(jsFormatterTool.category).toBe("formatting");
    expect(jsFormatterTool.requiredEntitlements).toBeUndefined();
    expect(TOOLS).toContain(jsFormatterTool);
    expect(TOOLS).toContain(htmlFormatterTool); // append did not drop HTML
    expect(getToolById("js-formatter")).toBe(jsFormatterTool);
  });
});
