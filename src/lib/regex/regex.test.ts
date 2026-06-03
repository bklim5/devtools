// Pure-core spec for the Regex tester (Phase 14, RGX-01..07) — TDD Wave 0 (RED).
//
// This is the executable contract Plan 02 implements against: it pins the exact
// regex.ts API surface (buildRegex / enumerate / applyReplace / runRegex /
// COMMON_PATTERNS) and the RegexRequest/RegexMatch/RegexResult shapes the worker
// + view consume. Pure logic only — NO worker, NO DOM, NO timers in this file
// (node environment, no jsdom pragma). The import below will NOT resolve until
// Plan 02 creates ./regex.ts; that RED state is correct and intended.
//
// globals:false in vite.config.ts → import describe/it/expect from "vitest".
import { describe, it, expect } from "vitest";
import {
  buildRegex,
  enumerate,
  applyReplace,
  runRegex,
  COMMON_PATTERNS,
  type RegexRequest,
} from "./regex";

// Small helper: assert the success branch of RegexResult (matches present) so the
// per-case assertions read cleanly without `"matches" in result` boilerplate.
function expectMatches(req: RegexRequest) {
  const result = runRegex(req);
  expect("matches" in result).toBe(true);
  if (!("matches" in result)) throw new Error("expected a matches result");
  return result;
}

describe("runRegex — RGX-01: enumerate matches with correct indices", () => {
  it("enumerates every match with the right index + full text", () => {
    const result = expectMatches({
      id: 1,
      source: "\\w+",
      flags: "",
      text: "hello world",
    });
    expect(result.matches.length).toBe(2);
    expect(result.matches[0].index).toBe(0);
    expect(result.matches[0].full).toBe("hello");
    expect(result.matches[1].index).toBe(6);
    expect(result.matches[1].full).toBe("world");
  });

  it("finds ALL matches even when the user did NOT supply g (g-forced internally, D-07)", () => {
    // Same call, no `g` in flags — enumeration must still return both matches,
    // not just the first. matchAll throws without g, so buildRegex force-adds it.
    const result = expectMatches({
      id: 1,
      source: "\\w+",
      flags: "",
      text: "hello world",
    });
    expect(result.matches.length).toBe(2);
  });
});

describe("runRegex — RGX-02: numbered + named capture groups", () => {
  it("exposes numbered groups in order and an empty named map when there are none", () => {
    const result = expectMatches({
      id: 1,
      source: "(\\w+)\\s(\\w+)",
      flags: "",
      text: "hello world foo bar",
    });
    expect(result.matches[0].groups).toEqual(["hello", "world"]);
    expect(result.matches[0].named).toEqual({});
  });

  it("exposes named groups keyed by name", () => {
    const result = expectMatches({
      id: 1,
      source: "(?<year>\\d{4})-(?<month>\\d{2})",
      flags: "",
      text: "2026-06",
    });
    expect(result.matches[0].named.year).toBe("2026");
    expect(result.matches[0].named.month).toBe("06");
  });

  it("renders an unmatched optional group as undefined (not empty string)", () => {
    const result = expectMatches({
      id: 1,
      source: "(a)(b)?",
      flags: "",
      text: "a",
    });
    expect(result.matches[0].groups[1]).toBe(undefined);
  });
});

describe("runRegex — RGX-03: flags g/i/m/s/u alter results", () => {
  it("i — case-insensitive matching", () => {
    expect(expectMatches({ id: 1, source: "hello", flags: "i", text: "HELLO" }).matches.length).toBe(1);
    expect(expectMatches({ id: 1, source: "hello", flags: "", text: "HELLO" }).matches.length).toBe(0);
  });

  it("s — dotAll lets . cross a newline", () => {
    expect(expectMatches({ id: 1, source: "a.b", flags: "s", text: "a\nb" }).matches.length).toBe(1);
    expect(expectMatches({ id: 1, source: "a.b", flags: "", text: "a\nb" }).matches.length).toBe(0);
  });

  it("m — multiline anchors ^/$ at line boundaries", () => {
    expect(expectMatches({ id: 1, source: "^x", flags: "m", text: "a\nx" }).matches.length).toBe(1);
  });
});

describe("runRegex — RGX-04: replace preview ($1 / $<name> / $&)", () => {
  it("$1 / $2 — numbered backreferences", () => {
    const result = runRegex({
      id: 1,
      source: "(\\w+)\\s(\\w+)",
      flags: "g",
      text: "hello world foo bar",
      replace: "$2 $1",
    });
    expect("matches" in result && result.replaced).toBe("world hello bar foo");
  });

  it("$<name> — named backreference", () => {
    const result = runRegex({
      id: 1,
      source: "(?<y>\\d{4})",
      flags: "g",
      text: "2026 1999",
      replace: "[$<y>]",
    });
    expect("matches" in result && result.replaced).toBe("[2026] [1999]");
  });

  it("$& — the whole match", () => {
    const result = runRegex({
      id: 1,
      source: "\\d+",
      flags: "g",
      text: "a1b2",
      replace: "<$&>",
    });
    expect("matches" in result && result.replaced).toBe("a<1>b<2>");
  });

  it("g controls replace all-vs-first (D-07): no g => first only, g => all", () => {
    const first = runRegex({ id: 1, source: "\\d+", flags: "", text: "a1b2", replace: "X" });
    expect("matches" in first && first.replaced).toBe("aXb2");
    const all = runRegex({ id: 1, source: "\\d+", flags: "g", text: "a1b2", replace: "X" });
    expect("matches" in all && all.replaced).toBe("aXbX");
  });
});

describe("runRegex / buildRegex — RGX-07: invalid regex is an error-as-value, never a throw", () => {
  it("runRegex never throws on an invalid pattern and returns a string error", () => {
    expect(() => runRegex({ id: 1, source: "(", flags: "", text: "abc" })).not.toThrow();
    const result = runRegex({ id: 1, source: "(", flags: "", text: "abc" });
    expect("error" in result).toBe(true);
    if (!("error" in result)) throw new Error("expected an error result");
    expect(typeof result.error).toBe("string");
    expect(result.error.length).toBeGreaterThan(0);
  });

  it("buildRegex returns { error } (not { re }) for an invalid pattern", () => {
    const built = buildRegex("(", "");
    expect("error" in built).toBe(true);
    expect("re" in built).toBe(false);
    if (!("error" in built)) throw new Error("expected an error result");
    expect(typeof built.error).toBe("string");
  });

  it("buildRegex returns { re } for a valid pattern and FORCES the g flag (D-07)", () => {
    const built = buildRegex("\\w+", "");
    expect("re" in built).toBe(true);
    if (!("re" in built)) throw new Error("expected a re result");
    expect(built.re.flags.includes("g")).toBe(true);
  });
});

describe("enumerate — pure match enumeration over a prebuilt RegExp", () => {
  it("returns the same shape runRegex exposes (index/length/full/groups/named)", () => {
    const built = buildRegex("(\\w)(\\w)", "");
    if (!("re" in built)) throw new Error("expected a re result");
    const matches = enumerate("ab cd", built.re);
    expect(matches.length).toBe(2);
    expect(matches[0].index).toBe(0);
    expect(matches[0].length).toBe(2);
    expect(matches[0].full).toBe("ab");
    expect(matches[0].groups).toEqual(["a", "b"]);
    expect(matches[0].named).toEqual({});
  });
});

describe("applyReplace — native replace expansion over a prebuilt RegExp", () => {
  it("expands $1 against the user's own RegExp", () => {
    const built = buildRegex("(\\w+)", "g");
    if (!("re" in built)) throw new Error("expected a re result");
    expect(applyReplace("hi there", built.re, "[$1]")).toBe("[hi] [there]");
  });
});

describe("runRegex — zero-length advance must not hang (RESEARCH Pitfall 4)", () => {
  it("/^/gm enumerates each line start as a zero-length match and completes", () => {
    const result = expectMatches({ id: 1, source: "^", flags: "gm", text: "a\nb\nc" });
    expect(result.matches.length).toBe(3);
    for (const m of result.matches) expect(m.length).toBe(0);
  });
});

describe("runRegex — empty state (D-13)", () => {
  it("empty pattern => { empty: true }", () => {
    const result = runRegex({ id: 1, source: "", flags: "", text: "abc" });
    expect("empty" in result).toBe(true);
    if (!("empty" in result)) throw new Error("expected an empty result");
    expect(result.empty).toBe(true);
  });

  it("empty sample text => { empty: true }", () => {
    const result = runRegex({ id: 1, source: "\\w+", flags: "", text: "" });
    expect("empty" in result).toBe(true);
    if (!("empty" in result)) throw new Error("expected an empty result");
    expect(result.empty).toBe(true);
  });
});

describe("COMMON_PATTERNS — RGX-05 / D-09 / D-12: exactly three, simple/linear", () => {
  it("has exactly three entries labeled Email / URL / IPv4 in that order", () => {
    expect(COMMON_PATTERNS.length).toBe(3);
    expect(COMMON_PATTERNS.map((p) => p.label)).toEqual(["Email", "URL", "IPv4"]);
  });

  it("every entry is a valid { source, flags } RegExp that compiles", () => {
    for (const entry of COMMON_PATTERNS) {
      expect(typeof entry.source).toBe("string");
      expect(typeof entry.flags).toBe("string");
      expect(() => new RegExp(entry.source, entry.flags)).not.toThrow();
    }
  });

  it("every entry is linear — no group-repetition like )+ or )* (D-12 watchdog-safe)", () => {
    for (const entry of COMMON_PATTERNS) {
      expect(entry.source).not.toMatch(/\)\s*[+*]/);
    }
  });
});
