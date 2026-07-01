// Unit spec for the async Prettier wrapper (PRT-01) — proves the JS/TS/HTML
// prettify paths, the embedded-code path, the empty short-circuit, error-as-value
// on malformed input, and the indent→option mapping. Pure (no DOM); the engine
// loads via dynamic import at call time.
import { describe, expect, it } from "vitest";
import type { FormatOptions } from "./types";
import { formatHtml, formatScript } from "./prettier";

const DEFAULT: FormatOptions = { indent: "2", minify: false };

describe("formatScript", () => {
  it("prettifies JS with Prettier's own defaults (babel parser)", async () => {
    const r = await formatScript("const a=1", "babel", DEFAULT);
    expect(r).toEqual({
      ok: true,
      output: "const a = 1;\n",
      inputBytes: 9,
      outputBytes: 13,
    });
  });

  it("prettifies TypeScript via the typescript parser", async () => {
    const r = await formatScript("type X=1", "typescript", DEFAULT);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toBe("type X = 1;\n");
  });

  it("formats real TS-only syntax the babel path could not (interface + annotations)", async () => {
    const r = await formatScript(
      "interface Y{a:number;b:string}const z:Y={a:1,b:'h'}",
      "typescript",
      DEFAULT,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).toContain("interface Y {");
      expect(r.output).toContain("const z: Y = { a: 1, b: \"h\" };");
    }
  });

  it("maps indent '4' → tabWidth 4", async () => {
    const r = await formatScript("function f(){return 1}", "babel", {
      indent: "4",
      minify: false,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toBe("function f() {\n    return 1;\n}\n");
  });

  it("maps indent 'tab' → useTabs (a literal tab per level)", async () => {
    const r = await formatScript("function f(){return 1}", "babel", {
      indent: "tab",
      minify: false,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toBe("function f() {\n\treturn 1;\n}\n");
  });

  it("honours an explicit printWidth override", async () => {
    const src = "const items = [aaaaaa, bbbbbb, cccccc, dddddd, eeeeee, ffffff];";
    const wide = await formatScript(src, "babel", { ...DEFAULT, printWidth: 120 });
    const narrow = await formatScript(src, "babel", { ...DEFAULT, printWidth: 20 });
    expect(wide.ok && narrow.ok).toBe(true);
    if (wide.ok && narrow.ok) {
      expect(wide.output).toBe(src + "\n"); // fits on one line at 120
      expect(narrow.output).toContain("\n  aaaaaa,"); // wraps at 20
    }
  });

  it("returns an error VALUE (never throws) on malformed input with 1-based line:col", async () => {
    const r = await formatScript("const a = {", "babel", DEFAULT);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(typeof r.error.message).toBe("string");
      expect(r.error.message.length).toBeGreaterThan(0);
      expect(r.error.line).toBe(1);
      expect(typeof r.error.col).toBe("number");
      expect(r.error.col).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("formatHtml", () => {
  it("prettifies canonical HTML structure", async () => {
    const r = await formatHtml("<div><span>hi</span></div>", DEFAULT);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).toContain("<div><span>hi</span></div>");
      expect(r.output.endsWith("\n")).toBe(true);
    }
  });

  it("reformats embedded <script> AND <style> (proves [html,babel,estree,postcss] wired)", async () => {
    const input =
      "<script>const a=1;function f(){return a}</script>\n" +
      "<style>body{color:red}</style>";
    const r = await formatHtml(input, DEFAULT);
    expect(r.ok).toBe(true);
    if (r.ok) {
      // embedded JS reformatted (spaces + semicolons + block body)
      expect(r.output).toContain("const a = 1;");
      expect(r.output).toContain("function f() {");
      expect(r.output).toContain("return a;");
      // embedded CSS reformatted (multi-line declaration block)
      expect(r.output).toContain("body {");
      expect(r.output).toContain("color: red;");
      // the raw messy bodies are gone
      expect(r.output).not.toContain("const a=1");
      expect(r.output).not.toContain("body{color:red}");
    }
  });

  it("never throws — always returns a discriminated FormatResult (lenient html parser)", async () => {
    // Prettier's `html` parser is deliberately lenient and does NOT reject a
    // half-typed embedded <script>; the contract we lock is that the wrapper
    // resolves a well-formed FormatResult and never rejects/throws.
    const r = await formatHtml("<script>const a = {</script>", DEFAULT);
    expect(typeof r.ok).toBe("boolean");
    if (r.ok) expect(typeof r.output).toBe("string");
    else expect(typeof r.error.message).toBe("string");
  });
});

describe("empty short-circuit (both entries)", () => {
  it("formatScript maps empty/whitespace to ok with empty output and 0 bytes", async () => {
    for (const input of ["", "   ", "\n\t "]) {
      const r = await formatScript(input, "babel", DEFAULT);
      expect(r).toEqual({ ok: true, output: "", inputBytes: 0, outputBytes: 0 });
    }
  });

  it("formatHtml maps empty/whitespace to ok with empty output and 0 bytes", async () => {
    const r = await formatHtml("   \n  ", DEFAULT);
    expect(r).toEqual({ ok: true, output: "", inputBytes: 0, outputBytes: 0 });
  });
});
