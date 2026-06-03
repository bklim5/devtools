// Pure URL helpers for the URL tool (Phase 13, URL-01..05). Thin error-as-value
// wrappers over native URL / URLSearchParams / encodeURI(Component) — zero new
// runtime deps. Every helper returns a discriminated result so the view never
// needs its own try/catch (D-14); the only throwers (decodeURI*, encodeURI) are
// caught here and converted to { error }. Empty input is a neutral value, never
// an error (D-15). NOTE (T-13-02): parseUrl surfaces `password` plainly by
// decision (D-09) — this module never logs or persists it.

/** Discriminated result for the four encode/decode helpers (D-14). */
export type StrResult = { value: string } | { error: string };

/** A single decoded query-string occurrence (D-10/11) — order + multiplicity preserved. */
export interface QueryRow {
  key: string;
  value: string;
}

/** A parsed absolute URL split into its parts (D-08). `password` is plain by decision (D-09). */
export interface ParsedUrl {
  scheme: string;
  host: string;
  port: string;
  path: string;
  query: string;
  fragment: string;
  origin: string;
  username: string;
  password: string;
  queryRows: QueryRow[];
}

/** parseUrl result: a parse, an inline error (D-13), or a neutral empty state (D-15). */
export type ParseResult = { url: ParsedUrl } | { error: string } | { empty: true };

const BAD_PERCENT = "Invalid percent-encoding (e.g. %zz)";
const BAD_ENCODE = "Cannot encode (malformed Unicode, e.g. a lone surrogate)";
const NEEDS_ABSOLUTE =
  "Enter an absolute URL (with a scheme), e.g. https://example.com/path";

/**
 * Percent-encode a single component (`encodeURIComponent`): escapes the
 * URL-structural chars (/ ? : @ & = #) too, so it's safe for one query value or
 * path segment. Cannot throw, but keeps the uniform return type.
 */
export function encodeComponent(s: string): StrResult {
  return { value: encodeURIComponent(s) };
}

/** Decode a percent-encoded component; bad sequences become { error } (D-14). */
export function decodeComponent(s: string): StrResult {
  try {
    return { value: decodeURIComponent(s) };
  } catch {
    return { error: BAD_PERCENT };
  }
}

/**
 * Percent-encode a whole URL string (`encodeURI`): keeps URL structure
 * (:// / ? : @ & =) intact, escaping only what would break it (e.g. spaces).
 * Throws URIError on malformed Unicode (lone surrogate) → caught as { error }.
 */
export function encodeFull(s: string): StrResult {
  try {
    return { value: encodeURI(s) };
  } catch {
    return { error: BAD_ENCODE };
  }
}

/** Decode a full URL string; bad percent-sequences become { error } (D-14). */
export function decodeFull(s: string): StrResult {
  try {
    return { value: decodeURI(s) };
  } catch {
    return { error: BAD_PERCENT };
  }
}

/**
 * Parse an absolute URL into its components (D-08) plus an ordered, decoded
 * query table (D-10/11/12). Empty/whitespace-only input is a neutral empty
 * state (D-15); a relative / scheme-less URL throws in `new URL` and is returned
 * as an inline error (D-13) — we do NOT auto-resolve against a base.
 */
export function parseUrl(input: string): ParseResult {
  if (input.trim() === "") return { empty: true };

  let u: URL;
  try {
    u = new URL(input);
  } catch {
    return { error: NEEDS_ABSOLUTE };
  }

  // Iterate searchParams directly: preserves URL order + multiplicity and
  // auto-decodes both key and value (D-10/11). Empty values stay "" (D-12).
  const queryRows: QueryRow[] = [];
  for (const [key, value] of u.searchParams) {
    queryRows.push({ key, value });
  }

  return {
    url: {
      scheme: u.protocol.replace(/:$/, ""), // strip trailing ":" for display (D-08)
      host: u.hostname,
      port: u.port,
      path: u.pathname,
      query: u.search,
      fragment: u.hash,
      origin: u.origin,
      username: u.username,
      password: u.password, // surfaced plainly by decision (D-09); never logged/persisted
      queryRows,
    },
  };
}
