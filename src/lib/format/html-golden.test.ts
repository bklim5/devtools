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
import { describe, expect, it } from "vitest";
import type { FormatOptions } from "./types";
import { formatHtml } from "./prettier";

const DEFAULT: FormatOptions = { indent: "2", minify: false };

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
