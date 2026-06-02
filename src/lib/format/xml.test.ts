// @vitest-environment jsdom
// formatXml (FMT-05..07, D-08/D-09/D-11): validate well-formedness via native
// DOMParser, prettify with selectable indent preserving comments/CDATA/attrs/PIs,
// minify inter-element whitespace, empty -> ok-empty. jsdom supplies DOMParser +
// XMLSerializer, mirroring the WKWebView path (the e2e proves the real engine).
import { describe, expect, it } from "vitest";
import { formatXml, normalizeParseError } from "./xml";

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

  describe("preserve document-level nodes outside the root (WR-01, FMT-06)", () => {
    it("keeps a leading document-level comment through prettify", () => {
      const input = "<!-- top level comment -->\n<root><a>1</a></root>";
      const result = formatXml(input, { indent: "2", minify: false });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.output).toContain("<!-- top level comment -->");
      // root content is still pretty-printed one-element-per-line.
      expect(result.output).toContain("<root>\n  <a>1</a>\n</root>");
    });

    it("keeps both leading and trailing document-level comments", () => {
      const input = "<!-- before --><root><a>1</a></root><!-- after -->";
      const result = formatXml(input, { indent: "2", minify: false });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.output).toContain("<!-- before -->");
      expect(result.output).toContain("<!-- after -->");
      expect(result.output).toContain("<root>\n  <a>1</a>\n</root>");
    });

    it("keeps a processing instruction that precedes the root element", () => {
      const input = '<?xml-stylesheet type="text/xsl" href="x.xsl"?>\n<root><a>1</a></root>';
      const result = formatXml(input, { indent: "2", minify: false });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.output).toContain('<?xml-stylesheet type="text/xsl" href="x.xsl"?>');
      expect(result.output).toContain("<root>\n  <a>1</a>\n</root>");
    });

    it("re-emits the XML declaration when the input had one", () => {
      const input = '<?xml version="1.0" encoding="UTF-8"?>\n<root><a>1</a></root>';
      const result = formatXml(input, { indent: "2", minify: false });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.output).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result.output).toContain("<root>\n  <a>1</a>\n</root>");
    });

    it("preserves document-level comments + declaration when minifying", () => {
      const input = '<?xml version="1.0"?>\n<!-- note -->\n<root>\n  <a>1</a>\n</root>';
      const result = formatXml(input, { indent: "2", minify: true });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.output).toContain('<?xml version="1.0"?>');
      expect(result.output).toContain("<!-- note -->");
      expect(result.output).toContain("<root><a>1</a></root>");
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

    it("strips the jsdom 'L:C:' location prefix, surfacing only the cause", () => {
      // jsdom emits e.g. "1:10: unexpected close tag." — the leading "line:col:"
      // is redundant with the StatusBar's own "line N:" prefix and must be removed.
      const result = formatXml("<a><b></a>", { indent: "2", minify: false });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      // The 1-based line is still extracted for the tool's own prefix.
      expect(result.error.line).toBe(1);
      // The message no longer carries the "1:10:" location text.
      expect(result.error.message).not.toMatch(/^\s*\d+:\d+:/);
      expect(result.error.message).not.toContain(":10:");
      // It still carries the human-meaningful cause.
      expect(result.error.message.toLowerCase()).toContain("close tag");
    });
  });

  describe("normalizeParseError: cleans BOTH WebKit and jsdom shapes (Fix-1)", () => {
    // WebKit/WKWebView (the real e2e engine) emits a multi-line <parsererror>:
    //   "This page contains the following errors:\n
    //    error on line 1 at column 11: Opening and ending tag mismatch: b line 1 and a\n
    //    Below is a rendering of the page up to the first error."
    // normalizeParseError must strip the preamble, the trailing "Below is a
    // rendering…" line, AND the redundant "error on line N at column C:" fragment,
    // leaving just the cause — and still recover the line number.
    const webkitText =
      "This page contains the following errors:\n" +
      "error on line 1 at column 11: Opening and ending tag mismatch: b line 1 and a\n" +
      "Below is a rendering of the page up to the first error.";

    it("WebKit shape: strips preamble + location + trailing render line", () => {
      const { message, line } = normalizeParseError(webkitText);
      expect(line).toBe(1);
      expect(message).not.toContain("This page contains the following errors");
      expect(message).not.toContain("Below is a rendering");
      expect(message).not.toMatch(/error on line \d+ at column \d+:/);
      expect(message).toContain("Opening and ending tag mismatch: b");
    });

    it("jsdom shape: strips the leading 'L:C:' location prefix", () => {
      const { message, line } = normalizeParseError("1:10: unexpected close tag.");
      expect(line).toBe(1);
      expect(message).toBe("unexpected close tag.");
      expect(message).not.toMatch(/^\s*\d+:\d+:/);
    });

    it("falls back to 'Invalid XML' when no cause survives the cleanup", () => {
      const { message } = normalizeParseError(
        "This page contains the following errors:\nBelow is a rendering of the page up to the first error.",
      );
      expect(message).toBe("Invalid XML");
    });

    it("returns undefined line when the engine embeds no location", () => {
      const { message, line } = normalizeParseError("Premature end of data.");
      expect(message).toBe("Premature end of data.");
      expect(line).toBeUndefined();
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
