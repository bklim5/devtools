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
import { formatHtml, formatScript, type ScriptLang } from "./prettier";

const DEFAULT: FormatOptions = { indent: "2", minify: false };

// Committed messy inputs + their CLI-generated goldens, read off disk. The two
// globs are disjoint: `*.golden` never matches `*.{js,ts,html}` (goldens end in
// `.golden`), so inputs and expected outputs stay cleanly separated.
const inputs = import.meta.glob("../../../test/fixtures/prettier/*.{js,ts,html}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
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
