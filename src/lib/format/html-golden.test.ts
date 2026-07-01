// HTML tool engine-contract golden locks (SC1 + SC2), owned by Phase 33 directly
// rather than leaning on P32's `embedded.html`. Two independent locks:
//
//   SC1 (prettify parity) — `formatHtml` output byte-equals a CHECKED-IN golden
//   authored by the pinned Prettier CLI (`scripts/gen-prettier-golden.mjs`, the
//   dev-time `prettier --write` source of truth), proving BOTH the embedded
//   <script> (JS via babel+estree) and <style> (CSS via postcss) are reformatted.
//   The golden is read off disk and NEVER regenerated here, so it RED-s on any
//   Prettier version/option/wrapper drift (the P32 pin-guard in
//   prettier.parity.test.ts covers the version float too).
//
//   SC2 (minify golden) — `minifyHtml` output byte-equals a FROZEN committed
//   EXPECTED constant (not a regenerate-then-compare), so it RED-s on esbuild
//   version drift or the HTML-collapse logic changing.
//
// Runs in the default `node` env (no jsdom pragma): esbuild-wasm resolves to its
// node build under vitest, whose `initialize()` self-loads the vendored service and
// rejects the browser-only flags — so `beforeAll` injects an empty init provider,
// exactly like minify.test.ts.
import { beforeAll, describe, expect, it } from "vitest";
import type { FormatOptions } from "./types";
import { formatHtml } from "./prettier";
import { __setEsbuildInitForTest, minifyHtml } from "./minify";

const DEFAULT: FormatOptions = { indent: "2", minify: false };

// esbuild's node build self-loads the vendored service; inject an empty init
// provider so the browser-only wasmURL/worker flags are never passed (SC2).
beforeAll(() => {
  __setEsbuildInitForTest(async () => ({}));
});

// Committed messy input + its CLI-generated golden, read off disk (mirror
// prettier.parity.test.ts's glob+bySuffix). The two globs are disjoint: the golden
// ends in `.golden`, the input in `.html`.
const sc1Inputs = import.meta.glob(
  "../../../test/fixtures/prettier/html-tool.html",
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;
const sc1Goldens = import.meta.glob(
  "../../../test/fixtures/prettier/html-tool.html.golden",
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

const sc2Inputs = import.meta.glob(
  "../../../test/fixtures/html/minify-input.html",
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

function bySuffix(map: Record<string, string>, suffix: string): string {
  const hit = Object.entries(map).find(([path]) => path.endsWith(suffix));
  if (!hit) throw new Error(`fixture not found: ${suffix}`);
  return hit[1];
}

describe("HTML prettify parity (SC1)", () => {
  it("formatHtml output byte-equals the committed CLI golden", async () => {
    const input = bySuffix(sc1Inputs, "/html-tool.html");
    const golden = bySuffix(sc1Goldens, "/html-tool.html.golden");
    const result = await formatHtml(input, DEFAULT);
    expect(result.ok).toBe(true);
    // Byte-equality (===) vs the committed golden — RED on any wrapper/version/
    // option drift, never a fuzzy compare.
    if (result.ok) expect(result.output).toBe(golden);
  });

  it("the golden reformatted BOTH the embedded JS and the embedded CSS", () => {
    const golden = bySuffix(sc1Goldens, "/html-tool.html.golden");
    // Embedded JS canonicalised (babel+estree): spacing + arrow-param parens.
    expect(golden).toContain("const items = [1, 2, 3];");
    expect(golden).not.toContain("const items=[1,2,3]");
    // Embedded CSS canonicalised (postcss): one declaration per line, spaced.
    expect(golden).toContain("margin: 0;");
    expect(golden).not.toContain("margin:0;color:red");
  });
});

// FROZEN minify golden — the exact `minifyHtml` output for minify-input.html,
// committed inline. This is NOT regenerate-then-compare: any esbuild version bump
// or HTML-collapse-logic change shifts this byte string and RED-s the test.
const EXPECTED =
  '<!doctype html> <html> <head>  <style>body{margin:0;color:red}.card{display:flex;gap:8px}\n</style> </head> <body> <div class="card"> <span>hello</span> <span>world</span> </div> <pre>  line one\n    line two\n  line three  </pre> <script>function add(t,n){return t+n}const total=add(1,2);\n</script> </body> </html>';

describe("HTML minify golden (SC2)", () => {
  it("minifyHtml output byte-equals the frozen committed golden", async () => {
    const input = bySuffix(sc2Inputs, "/minify-input.html");
    const r = await minifyHtml(input);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toBe(EXPECTED);
  });

  it("locks the load-bearing minify behaviors regardless of the frozen string", async () => {
    const input = bySuffix(sc2Inputs, "/minify-input.html");
    const r = await minifyHtml(input);
    expect(r.ok).toBe(true);
    if (r.ok) {
      // <pre> preserved verbatim (internal whitespace + newlines intact).
      expect(r.output).toContain("<pre>  line one\n    line two\n  line three  </pre>");
      // Non-conditional comment stripped.
      expect(r.output).not.toContain("<!--");
      expect(r.output).not.toContain("strip me");
      // Embedded script minified (no double-spaces, compact form).
      expect(r.output).toContain("function add(");
      expect(r.output).not.toContain("return a + b;");
      // Embedded style minified.
      expect(r.output).toContain("body{margin:0");
    }
  });
});
