// Pure regex core for the Regex tester (Phase 14, RGX-01..07). Thin error-as-value
// wrappers over native RegExp / String.prototype.matchAll / String.prototype.replace
// — zero new runtime deps. The whole testable surface lives here (the worker is a
// dumb transport): build/compile, enumerate, native replace, and the runRegex
// orchestrator returning a discriminated result so the view never needs try/catch.
//
// This module is PURE and TOTAL — it never throws and never touches the DOM or a
// Worker. Two invariants:
//   • Enumeration is g-FORCED (D-07): matchAll throws without the `g` flag, so
//     buildRegex force-adds it. No RegExp is cached across calls (fresh compile
//     each time — a shared lastIndex would corrupt subsequent matchAll runs).
//   • Replace uses the USER's true flags (D-07): `g` => replace all, no `g` =>
//     first only. Native $1 / $<name> / $& / $$ expansion (never hand-rolled).
//
// It never logs the input pattern or sample text.

/** Request the worker receives and the pure runRegex consumes (RESEARCH Pattern 2). */
export interface RegexRequest {
  id: number;
  source: string; // the pattern
  flags: string; // the user's true flags, e.g. "gi"
  text: string; // sample text
  replace?: string; // replacement template; undefined => no replace preview
}

/** One enumerated match (RGX-02). groups = numbered ($1..$n); named = named groups. */
export interface RegexMatch {
  index: number;
  length: number;
  full: string;
  groups: (string | undefined)[]; // numbered groups; undefined = unmatched optional
  named: Record<string, string | undefined>;
}

/**
 * Discriminated result the view renders without try/catch (mirror src/lib/url.ts).
 * `timedOut` is produced by the VIEW watchdog (Plan 03), NOT by runRegex — runRegex
 * is synchronous and total and never returns timedOut.
 */
export type RegexResult =
  | { matches: RegexMatch[]; replaced?: string } // success (matches may be [])
  | { error: string } // invalid regex (RGX-07)
  | { empty: true }; // empty pattern or empty text (D-13)

/**
 * Compile a RegExp for ENUMERATION, force-adding `g` if absent — matchAll throws
 * without it (RESEARCH Pitfall 3). Invalid source becomes { error } carrying the
 * native message verbatim (RGX-07); never throws.
 */
export function buildRegex(
  source: string,
  flags: string,
): { re: RegExp } | { error: string } {
  const enumFlags = flags.includes("g") ? flags : flags + "g";
  try {
    return { re: new RegExp(source, enumFlags) };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

/**
 * Enumerate every match over a prebuilt (g-flagged) RegExp. matchAll advances past
 * zero-length matches internally (RESEARCH Pitfall 4 — no manual exec loop, no
 * infinite hang on /^/gm). Numbered groups come from m.slice(1); named from m.groups.
 */
export function enumerate(text: string, re: RegExp): RegexMatch[] {
  return [...text.matchAll(re)].map((m) => ({
    index: m.index ?? 0,
    length: m[0].length,
    full: m[0],
    groups: m.slice(1), // numbered (RGX-02)
    named: m.groups ? { ...m.groups } : {}, // named (RGX-02)
  }));
}

/**
 * Native replace expansion ($1 / $<name> / $& / $$) over a prebuilt RegExp whose
 * flags decide all-vs-first. Hand-rolling token expansion is forbidden — native is
 * correct and total.
 */
export function applyReplace(text: string, re: RegExp, repl: string): string {
  return text.replace(re, repl);
}

/**
 * Orchestrate one run, totally (never throws). Empty pattern OR empty text is the
 * neutral empty state (D-13). Otherwise compile a g-forced regex for enumeration
 * (invalid => { error }, RGX-07), enumerate, and — only when req.replace is defined
 * (an empty string IS a valid replacement, distinct from undefined) — compile a
 * SECOND regex with the user's TRUE flags and attach the replace preview (D-07).
 */
export function runRegex(req: RegexRequest): RegexResult {
  if (req.source === "" || req.text === "") return { empty: true }; // D-13

  const built = buildRegex(req.source, req.flags);
  if ("error" in built) return { error: built.error }; // RGX-07

  const matches = enumerate(req.text, built.re);
  if (req.replace === undefined) return { matches };

  // USER's true flags (g => all, no g => first); fresh compile, never cached (D-07).
  const userRe = new RegExp(req.source, req.flags);
  return { matches, replaced: applyReplace(req.text, userRe, req.replace) };
}

/**
 * The three insertable common patterns (RGX-05 / D-09). Frozen `as const`, exactly
 * Email / URL / IPv4 in that order. Kept SIMPLE/linear (no nested quantifiers, D-12)
 * so the library itself never trips the Plan-03 watchdog.
 */
export const COMMON_PATTERNS = [
  { label: "Email", source: "[\\w.+-]+@[\\w-]+\\.[\\w.-]+", flags: "g" },
  { label: "URL", source: "https?://[^\\s]+", flags: "g" },
  { label: "IPv4", source: "\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b", flags: "g" },
] as const;
