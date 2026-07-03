// Golden parity lock (PRT-05) — byte-equal the async wrapper's prettified output
// to the CHECKED-IN goldens the generator script produced from the pinned
// Prettier CLI (dev-time `prettier --write` source of truth).
//
// The goldens were produced by the CLI at pin 3.8.3 with the wrapper's EXACT
// default options. This test locks the WRAPPER to the COMMITTED goldens: it reads
// them DIRECTLY off disk (Vite ?raw, eager) and NEVER regenerates them, so it
// RED-s the moment the wrapper output != committed golden (wrapper / version /
// option drift). A SEPARATE generator-integrity check (the golden generator under
// scripts/ + `git diff --exit-code -- test/fixtures/prettier/`, run outside this
// suite) locks the COMMITTED goldens to a fresh CLI run (RED on stale goldens).
// Neither step regenerates-then-compares in the same breath, so a drifted golden
// can never pass green. This suite deliberately imports NO generator / child
// process / fs-write — it only reads what is committed.
import { describe, expect, it } from "vitest";
import type { FormatOptions } from "./types";
import { formatHtml, formatJsTs, formatScript, type ScriptLang } from "./prettier";

const DEFAULT: FormatOptions = { indent: "2", minify: false };

// Committed messy inputs + their CLI-generated goldens, read off disk. The two
// globs are disjoint: `*.golden` never matches `*.{js,ts,html}` (goldens end in
// `.golden`), so inputs and expected outputs stay cleanly separated.
const inputs = import.meta.glob(
  "../../../test/fixtures/prettier/*.{js,ts,jsx,tsx,html}",
  {
    query: "?raw",
    import: "default",
    eager: true,
  },
) as Record<string, string>;
const goldens = import.meta.glob("../../../test/fixtures/prettier/*.golden", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const pkgRaw = import.meta.glob("../../../package.json", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function bySuffix(map: Record<string, string>, suffix: string): string {
  const hit = Object.entries(map).find(([path]) => path.endsWith(suffix));
  if (!hit) throw new Error(`fixture not found: ${suffix}`);
  return hit[1];
}

type Case =
  | { name: string; kind: "script"; lang: ScriptLang }
  | { name: string; kind: "html" };

const CASES: Case[] = [
  { name: "messy.js", kind: "script", lang: "babel" },
  { name: "messy.ts", kind: "script", lang: "typescript" },
  { name: "messy.jsx", kind: "script", lang: "babel" },
  { name: "messy.tsx", kind: "script", lang: "typescript" },
  { name: "embedded.html", kind: "html" },
];

describe("Prettier wrapper ↔ committed CLI golden parity", () => {
  for (const c of CASES) {
    it(`wrapper output byte-equals the committed golden for ${c.name}`, async () => {
      const input = bySuffix(inputs, `/${c.name}`);
      const golden = bySuffix(goldens, `/${c.name}.golden`);
      const result =
        c.kind === "html"
          ? await formatHtml(input, DEFAULT)
          : await formatScript(input, c.lang, DEFAULT);
      expect(result.ok).toBe(true);
      // Byte-equality (===) against the committed golden bytes — NOT a fuzzy or
      // normalized compare. RED on any wrapper/version/option drift.
      if (result.ok) expect(result.output).toBe(golden);
    });
  }

  it("embedded HTML golden reformats BOTH the <script> and the <style> bodies", () => {
    const rawInput = bySuffix(inputs, "/embedded.html");
    const golden = bySuffix(goldens, "/embedded.html.golden");
    // The golden's embedded bodies are canonicalised (differ from the messy raw).
    expect(golden).toContain("const a = 1;");
    expect(golden).toContain("color: red;");
    expect(golden).not.toContain("const a=1");
    expect(golden).not.toContain("color:red");
    // Sanity: the raw input really was messy in both bodies.
    expect(rawInput).toContain("const a=1");
    expect(rawInput).toContain("color:red");
  });

  it("prettier is pinned to exactly 3.8.3 with no caret/tilde/range (RED on a float)", () => {
    const raw = Object.values(pkgRaw)[0];
    expect(raw).toBeTypeOf("string");
    expect(raw).toMatch(/"prettier":\s*"3\.8\.3"/);
    // A future `^3.8.3` / `~3.8.3` / `>=3.8.3` / `3.9.0` must fail this suite.
    expect(raw).not.toMatch(/"prettier":\s*"[\^~>=<]/);
    expect(raw).not.toMatch(/"prettier":\s*"3\.8\.3-/);
  });
});

// ROUTING DRIFT LOCK — the tool's REAL no-picker path is `formatJsTs`
// (typescript-first, babel-on-parse-error, from 34-01), NOT the named parsers
// above. formatJsTs's canonical output for every well-formed dialect is the
// typescript-parser CLI output, so it byte-equals the committed `.jsts.golden`
// set. This REDs on Prettier version/option DRIFT of the real path. It does NOT
// catch a babel-first mis-route: typescript & babel emit byte-identical output
// for these inputs (verified at pin 3.8.3), so the ORDER contract is proven by
// 34-01's injectable-runner order test — not by these byte goldens.
const JSTS_CASES = ["messy.js", "messy.ts", "messy.jsx", "messy.tsx"];

describe("formatJsTs routing ↔ committed CLI golden parity (the tool's real path)", () => {
  for (const name of JSTS_CASES) {
    it(`formatJsTs output byte-equals the routing golden for ${name}`, async () => {
      const input = bySuffix(inputs, `/${name}`);
      const golden = bySuffix(goldens, `/${name}.jsts.golden`);
      const result = await formatJsTs(input, DEFAULT);
      expect(result.ok).toBe(true);
      // Byte-equality against the committed typescript-parser golden.
      if (result.ok) expect(result.output).toBe(golden);
    });
  }

  it("formatJsTs falls back to babel for valid-JS the TS parser rejects (output locked)", async () => {
    const input = bySuffix(inputs, "/fallback.js");
    const golden = bySuffix(goldens, "/fallback.js.golden");
    // Assert the TS primary GENUINELY rejects this input FIRST, so a subsequent
    // ok:true from formatJsTs can ONLY have come from the babel fallback firing —
    // a DEAD fallback chain REDs here (this is the fallback-fires proof; the
    // ts-before-babel ORDER is proven in 34-01, not by this byte golden).
    const tsPrimary = await formatScript(input, "typescript", DEFAULT);
    expect(tsPrimary.ok).toBe(false);
    const result = await formatJsTs(input, DEFAULT);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.output).toBe(golden);
  });
});
