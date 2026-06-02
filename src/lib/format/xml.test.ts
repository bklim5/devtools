// @vitest-environment jsdom
// formatXml (FMT-05..07, D-08/D-09/D-11): validate well-formedness via native
// DOMParser, prettify with selectable indent preserving comments/CDATA/attrs/PIs,
// minify inter-element whitespace, empty -> ok-empty. jsdom supplies DOMParser +
// XMLSerializer, mirroring the WKWebView path (the e2e proves the real engine).
import { describe, expect, it } from "vitest";
import { formatXml } from "./xml";

// UTF-8 byte length, matching the implementation's TextEncoder use.
function byteLen(s: string): number {
  return new TextEncoder().encode(s).length;
}

describe("formatXml", () => {
  describe("prettify (default indent 2)", () => {
    it("puts each element on its own 2-space-indented line, keeps self-close", () => {
      const result = formatXml("<a><b>1</b><c/></a>", { indent: "2", minify: false });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.output).toBe("<a>\n  <b>1</b>\n  <c/>\n</a>");
      expect(result.output).toContain("<c/>"); // self-closing preserved
      expect(result.inputBytes).toBe(byteLen("<a><b>1</b><c/></a>"));
      expect(result.outputBytes).toBe(byteLen(result.output));
    });

    it("round-trips well-formed (re-parsing the output succeeds)", () => {
      const result = formatXml("<a><b>1</b><c/></a>", { indent: "2", minify: false });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const reparsed = formatXml(result.output, { indent: "2", minify: false });
      expect(reparsed.ok).toBe(true);
    });
  });

  describe("indent 4 and tab", () => {
    it("uses 4 spaces for indent '4'", () => {
      const result = formatXml("<a><b>1</b></a>", { indent: "4", minify: false });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.output).toBe("<a>\n    <b>1</b>\n</a>");
    });

    it("uses a literal tab per depth level for indent 'tab'", () => {
      const result = formatXml("<a><b><c>1</c></b></a>", { indent: "tab", minify: false });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.output).toBe("<a>\n\t<b>\n\t\t<c>1</c>\n\t</b>\n</a>");
    });
  });

  describe("preserve comments + CDATA + PIs + attributes (FMT-06)", () => {
    it("keeps <!--comment-->, CDATA, <?pi?>, and attributes through prettify", () => {
      const input = '<r x="1"><!--note--><![CDATA[a<b]]><?pi data?></r>';
      const result = formatXml(input, { indent: "2", minify: false });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.output).toContain("<!--note-->");
      expect(result.output).toContain("<![CDATA[a<b]]>");
      expect(result.output).toContain("<?pi data?>");
      expect(result.output).toContain('x="1"');
    });
  });

  describe("minify (FMT-07)", () => {
    it("strips inter-element whitespace, preserving significant text", () => {
      const result = formatXml("<a>\n  <b>1</b>\n</a>", { indent: "2", minify: true });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.output).toBe("<a><b>1</b></a>");
    });

    it("preserves significant text inside a single element when minifying", () => {
      const result = formatXml("<a> hello world </a>", { indent: "2", minify: true });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.output).toContain("hello world");
    });
  });

  describe("invalid XML -> parsererror surfaced (FMT-05)", () => {
    it("returns ok:false with a non-empty message and a numeric line when available", () => {
      const result = formatXml("<a><b></a>", { indent: "2", minify: false });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message.length).toBeGreaterThan(0);
      // line is a number when the engine provides one, else undefined.
      if (result.error.line !== undefined) {
        expect(typeof result.error.line).toBe("number");
        expect(result.error.line).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe("empty input is ok-empty (not an error)", () => {
    it("treats '' as ok with empty output and zero byte counts", () => {
      const result = formatXml("", { indent: "2", minify: false });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.output).toBe("");
      expect(result.inputBytes).toBe(0);
      expect(result.outputBytes).toBe(0);
    });

    it("treats whitespace-only input as ok-empty", () => {
      const result = formatXml("   \n  ", { indent: "2", minify: false });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.output).toBe("");
      expect(result.inputBytes).toBe(0);
      expect(result.outputBytes).toBe(0);
    });
  });
});
