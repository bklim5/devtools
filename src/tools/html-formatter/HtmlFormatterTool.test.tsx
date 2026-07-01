// @vitest-environment jsdom
// HtmlFormatterTool (PRT-07/08/12, D-11, SC6 tool half): a thin ASYNC tool over
// formatHtml/minifyHtml + the shared useAsyncFormat guard + FormatterView. Unlike
// the sync JSON/XML tests this uses REAL timers + waitFor/findBy — the format runs
// after the 180ms debounce and dynamically imports the real Prettier/esbuild
// engines (which resolve under jsdom as in the golden/parity suites).
//
// The load-bearing proofs here: async prettify (embedded <script> reformatted),
// minify, the printWidth (Width) control (D-04/PRT-08), the oversize role=alert
// guard surfacing WITHOUT a "0 bytes" readout regression, a DISTINCT tool-seam
// 0-encode proof over ASCII + multibyte + malformed-surrogate over-cap input (the
// tool never re-encodes the over-cap paste), the line:col malformed-HTML error
// (D-11 — column NOT dropped), copy through the platform seam, and free registry
// registration (PRT-12).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import {
  resetPlatformForTest,
  setPlatformForTest,
  type Platform,
} from "@/lib/platform";
import { makeMemoryPlatform } from "@/shell/testStore";
import HtmlFormatterTool from "./HtmlFormatterTool";
import { htmlFormatterTool } from "./index";
import { xmlFormatterTool } from "@/tools/xml-formatter";
import { TOOLS, getToolById } from "@/lib/tools/registry";
import * as prettier from "@/lib/format/prettier";

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
  const el = container.querySelector<HTMLTextAreaElement>("#html-input");
  if (!el) throw new Error("#html-input not found");
  return el;
}
function outputEl(container: HTMLElement): HTMLTextAreaElement {
  const el = container.querySelector<HTMLTextAreaElement>("#html-output");
  if (!el) throw new Error("#html-output not found");
  return el;
}

describe("HtmlFormatterTool", () => {
  it("prettifies HTML asynchronously on paste (embedded script formatted)", async () => {
    const { container } = render(<HtmlFormatterTool />);
    fireEvent.change(inputEl(container), {
      target: { value: "<div><span>hi</span></div><script>const a=1</script>" },
    });
    await waitFor(
      () => expect(outputEl(container).value).toContain("\n"),
      { timeout: 5000 },
    );
    // Embedded JS reformatted by prettier's babel/estree plugins (full parity).
    expect(outputEl(container).value).toContain("const a = 1;");
  });

  it("minifies in Minify mode", async () => {
    const { container, getByRole } = render(<HtmlFormatterTool />);
    fireEvent.change(inputEl(container), {
      target: { value: "<div>\n  <span>hi</span>\n</div>" },
    });
    fireEvent.click(getByRole("button", { name: "Minify" }));
    // Wait for the actual minified output to arrive (the initial output is "",
    // which trivially has no newline — so gate on the real content first).
    await waitFor(
      () => expect(outputEl(container).value).toContain("<span>hi</span>"),
      { timeout: 5000 },
    );
    // Compact: the source newlines/indentation are collapsed away.
    expect(outputEl(container).value.includes("\n")).toBe(false);
  });

  it("exposes the printWidth (Width) control in Prettify and hides it in Minify (D-04)", () => {
    const { getByRole, queryByRole } = render(<HtmlFormatterTool />);
    expect(getByRole("group", { name: "Width" })).toBeTruthy();
    fireEvent.click(getByRole("button", { name: "Minify" }));
    expect(queryByRole("group", { name: "Width" })).toBeNull();
    fireEvent.click(getByRole("button", { name: "Prettify" }));
    expect(getByRole("group", { name: "Width" })).toBeTruthy();
  });

  it("oversize paste surfaces a calm role=alert 'Input too large', clears output, and shows NO size readout (SC6 tool half + byteCount-undefined non-regression)", async () => {
    const { container } = render(<HtmlFormatterTool />);
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
    // byteCount is the hook's `undefined` (not a `?? 0` fallback) → StatusBar
    // renders NO size readout on the over-cap path.
    expect(container.querySelector('[aria-label="byte count"]')).toBeNull();
  });

  it("oversize paste does ZERO full-string encodes in the render path — ASCII, multibyte, AND malformed-surrogate (SC6 tool-seam 0-encode proof)", async () => {
    const bigAscii = "a".repeat(2_100_000); // UTF-16 length over cap
    const bigMb = "€".repeat(700_000); // length 700k <= cap, but 2.1M UTF-8 bytes
    const bigSurr = "\uD800€".repeat(400_000); // length 800k <= cap, but 2.4M UTF-8 bytes
    // The malformed-surrogate fixture must be genuinely over-cap by the REAL encoder
    // (its code-unit length is UNDER the cap — a naive length filter would miss it).
    expect(new TextEncoder().encode(bigSurr).length).toBeGreaterThan(2_000_000);

    for (const bigInput of [bigAscii, bigMb, bigSurr]) {
      const encodeSpy = vi.spyOn(TextEncoder.prototype, "encode");
      const fmtSpy = vi.spyOn(prettier, "formatHtml");
      try {
        const { container } = render(<HtmlFormatterTool />);
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
        // the cap, so a length filter would silently pass a `byteLen(input)`
        // regression. This fails loudly if the tool ever re-encodes the over-cap
        // paste for ANY input class.
        expect(encodeSpy.mock.calls.every(([s]) => s !== bigInput)).toBe(true);
      } finally {
        fmtSpy.mockRestore();
        encodeSpy.mockRestore();
        cleanup();
      }
    }
  });

  it("over-cap ALL-WHITESPACE paste is oversize WITHOUT a full-length trim at the tool seam (Codex adversarial fix — mounted)", async () => {
    // The hook classifies oversize before trimming, but the tool must ALSO not
    // re-run input.trim() on the raw value: an over-cap all-whitespace paste would
    // otherwise get a full-length main-thread trim() scan at the tool seam, re-opening
    // the exact DoS the hook guard closes. The tool now reads `isEmpty` from the hook.
    const bigWs = " ".repeat(2_100_000); // 2.1M whitespace bytes > 2 MB cap
    const realTrim = String.prototype.trim;
    const trimmedLengths: number[] = [];
    const trimSpy = vi
      .spyOn(String.prototype, "trim")
      .mockImplementation(function (this: string) {
        trimmedLengths.push(this.length);
        return realTrim.call(this);
      });
    const fmtSpy = vi.spyOn(prettier, "formatHtml");
    try {
      const { container } = render(<HtmlFormatterTool />);
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
      // Never reached the engine…
      expect(fmtSpy).not.toHaveBeenCalled();
      // …and NO trim() call ever saw the full 2.1M-char payload (the tool reads the
      // hook's isEmpty instead of re-trimming; the hook short-circuits to oversize
      // before its own trim). Fails loudly if either seam re-trims the raw value.
      expect(trimmedLengths.every((len) => len < bigWs.length)).toBe(true);
    } finally {
      fmtSpy.mockRestore();
      trimSpy.mockRestore();
    }
  });

  it("surfaces a role=alert error for a broken embedded <script> in Minify mode (D-11)", async () => {
    const { container, getByRole } = render(<HtmlFormatterTool />);
    fireEvent.click(getByRole("button", { name: "Minify" }));
    fireEvent.change(inputEl(container), {
      target: { value: "<script>function(</script>" },
    });
    await waitFor(
      () => {
        const footer = container.querySelector("footer")!;
        expect(footer.getAttribute("role")).toBe("alert");
      },
      { timeout: 5000 },
    );
    expect(outputEl(container).value).toBe("");
  });

  it("malformed HTML in Prettify surfaces a line:col role=alert (D-11 line:col — column NOT dropped)", async () => {
    const { container } = render(<HtmlFormatterTool />);
    fireEvent.change(inputEl(container), {
      target: { value: "<div><span>hi</div>" },
    });
    await waitFor(
      () => {
        const footer = container.querySelector("footer")!;
        expect(footer.getAttribute("role")).toBe("alert");
      },
      { timeout: 5000 },
    );
    const err = container.querySelector<HTMLElement>('[data-status="error"]')!;
    const text = err.textContent ?? "";
    // line:col form (e.g. "1:14 …") — NOT the XML line-only "line N:" form.
    expect(text).toMatch(/^\d+:\d+ /);
    // CONCISE (D-13 UX): the essential clause only — Prettier's "It may happen…"
    // explanation + spec URL are stripped, so the message shows in full without a
    // hover-only truncation. No verbose boilerplate, no leftover "(1:14)".
    expect(text).toContain('Unexpected closing tag "div"');
    expect(text).not.toMatch(/It may happen|For more info|https?:\/\//i);
    expect(text).not.toMatch(/\(\d+:\d+\)\s*$/);
    expect(outputEl(container).value).toBe("");
  });

  it("copies the derived output through the platform seam", async () => {
    const { container, getByRole } = render(<HtmlFormatterTool />);
    fireEvent.change(inputEl(container), {
      target: { value: "<div><span>hi</span></div>" },
    });
    await waitFor(
      () => expect(outputEl(container).value.length).toBeGreaterThan(0),
      { timeout: 5000 },
    );
    fireEvent.click(getByRole("button", { name: /copy output/i }));
    expect(writeText).toHaveBeenCalledWith(outputEl(container).value);
  });

  it("is registered in TOOLS as a free formatting tool resolvable by id (PRT-12)", () => {
    expect(htmlFormatterTool.id).toBe("html-formatter");
    expect(htmlFormatterTool.category).toBe("formatting");
    expect(htmlFormatterTool.requiredEntitlements).toBeUndefined();
    expect(TOOLS).toContain(htmlFormatterTool);
    expect(TOOLS).toContain(xmlFormatterTool); // append did not drop XML
    expect(getToolById("html-formatter")).toBe(htmlFormatterTool);
  });
});
