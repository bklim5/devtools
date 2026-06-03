// Pure URL helpers for the URL tool (Phase 13, URL-01..05). Thin error-as-value
// wrappers over native URL / URLSearchParams / encodeURI(Component) — zero new
// runtime deps. Every helper returns a discriminated result so the view never
// needs its own try/catch (D-14); the only throwers (decodeURI*, encodeURI) are
// caught here and converted to { error }. Empty input is a neutral value, never
// an error (D-15). NOTE (T-13-02): parseUrl surfaces `password` plainly by
// decision (D-09) — this module never logs or persists it.

/** Discriminated result for the four encode/decode helpers (D-14). */
export type StrResult = { value: string } | { error: string };

const BAD_PERCENT = "Invalid percent-encoding (e.g. %zz)";
const BAD_ENCODE = "Cannot encode (malformed Unicode, e.g. a lone surrogate)";

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
