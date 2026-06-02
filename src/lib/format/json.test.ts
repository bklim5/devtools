import { describe, expect, it } from "vitest";
import { formatJson } from "./json";

// Byte length of a UTF-8 string, matching the implementation's TextEncoder use.
function byteLen(s: string): number {
  return new TextEncoder().encode(s).length;
}

describe("formatJson", () => {
  describe("prettify (default indent 2)", () => {
    it("prettifies with 2-space indent, no trailing newline, correct byte counts", () => {
      const input = '{"b":1,"a":2}';
      const result = formatJson(input, { indent: "2", minify: false });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.output).toBe(JSON.stringify(JSON.parse(input), null, 2));
      expect(result.output.endsWith("\n")).toBe(false);
      expect(result.inputBytes).toBe(byteLen(input));
      expect(result.outputBytes).toBe(byteLen(result.output));
    });
  });

  describe("indent 4 and tab", () => {
    it("uses 4 spaces for indent '4'", () => {
      const input = '{"a":1}';
      const result = formatJson(input, { indent: "4", minify: false });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.output).toBe(JSON.stringify(JSON.parse(input), null, 4));
      expect(result.output).toContain('    "a"');
    });

    it("uses a literal tab for indent 'tab'", () => {
      const input = '{"a":1}';
      const result = formatJson(input, { indent: "tab", minify: false });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.output).toBe(JSON.stringify(JSON.parse(input), null, "\t"));
      expect(result.output).toContain('\t"a"');
    });
  });

  describe("minify wins over prettify", () => {
    it("collapses to a single line regardless of indent", () => {
      const input = '{\n  "b": 1,\n  "a": 2\n}';
      const result = formatJson(input, { indent: "2", minify: true });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.output).toBe(JSON.stringify(JSON.parse(input)));
      expect(result.output).toBe('{"b":1,"a":2}');
      expect(result.output).not.toContain("\n");
    });
  });

  describe("sort-keys recursive, arrays preserved", () => {
    it("sorts object keys at every level", () => {
      const input = '{"b":1,"a":{"d":1,"c":2}}';
      const result = formatJson(input, {
        indent: "2",
        minify: true,
        sortKeys: true,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.output).toBe('{"a":{"c":2,"d":1},"b":1}');
    });

    it("preserves array order (does not sort array elements)", () => {
      const input = '{"z":[3,1,2]}';
      const result = formatJson(input, {
        indent: "2",
        minify: true,
        sortKeys: true,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.output).toBe('{"z":[3,1,2]}');
    });

    it("sorts keys inside objects nested within arrays, array order intact", () => {
      const input = '{"arr":[{"y":1,"x":2},{"b":1,"a":2}]}';
      const result = formatJson(input, {
        indent: "2",
        minify: true,
        sortKeys: true,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.output).toBe('{"arr":[{"x":2,"y":1},{"a":2,"b":1}]}');
    });
  });

  describe("invalid input maps to line:col", () => {
    it("returns ok:false with a non-empty message and numeric line/col >= 1", () => {
      const result = formatJson('{"a": }', { indent: "2", minify: false });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message.length).toBeGreaterThan(0);
      expect(typeof result.error.line).toBe("number");
      expect(typeof result.error.col).toBe("number");
      expect(result.error.line as number).toBeGreaterThanOrEqual(1);
      expect(result.error.col as number).toBeGreaterThanOrEqual(1);
    });

    it("computes line > 1 for an error on a later line", () => {
      const input = '{\n  "a": 1,\n  "b": ,\n}';
      const result = formatJson(input, { indent: "2", minify: false });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(typeof result.error.line).toBe("number");
      expect(result.error.line as number).toBeGreaterThan(1);
    });
  });

  describe("empty input is ok-empty (not an error)", () => {
    it("treats '' as ok with empty output and zero byte counts", () => {
      const result = formatJson("", { indent: "2", minify: false });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.output).toBe("");
      expect(result.inputBytes).toBe(0);
      expect(result.outputBytes).toBe(0);
    });

    it("treats whitespace-only input as ok-empty", () => {
      const result = formatJson("   ", { indent: "2", minify: false });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.output).toBe("");
      expect(result.inputBytes).toBe(0);
      expect(result.outputBytes).toBe(0);
    });
  });
});
