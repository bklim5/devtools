// Pure JSON formatter (FMT-01..04, D-07..10). Validate + prettify / minify /
// recursively sort object keys over STRICT JSON only — native `JSON` exclusively,
// ZERO runtime dependencies. No React / DOM / platform imports: plain data the
// JsonFormatterTool consumes, returning the shared `FormatResult` (D-09).
//
// Behavior:
// - Empty / whitespace-only input -> ok with empty output (D-08: the tool maps
//   this to status "empty", NOT an error).
// - `JSON.parse` failure -> ok:false with a human message and, when the engine
//   exposes a char offset in its SyntaxError text, a 1-based line:col computed
//   over the user's own input (D-09).
// - sort-keys (D-10): recursive object-key sort applied BEFORE stringify; array
//   order is PRESERVED.
// - minify wins over prettify (D-06): `JSON.stringify(value)` (single line).
import type { FormatOptions, FormatResult, IndentMode } from "./types";

/** UTF-8 byte length, matching how the StatusBar delta is measured. */
function byteLen(s: string): number {
  return new TextEncoder().encode(s).length;
}

/**
 * Recursively rebuild a parsed value with object keys in sorted order. Arrays
 * keep their element order (D-10) — only their elements are recursed into.
 * Primitives (incl. null) pass through unchanged.
 */
function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      sorted[key] = sortKeysDeep(source[key]);
    }
    return sorted;
  }
  return value;
}

/** The `space` arg for `JSON.stringify`: number of spaces, or a literal tab. */
function indentSpace(indent: IndentMode): number | string {
  return indent === "tab" ? "\t" : Number(indent);
}

/** Convert a 0-based char offset over `input` into a 1-based line:col. */
function offsetToLineCol(input: string, offset: number): { line: number; col: number } {
  const clamped = Math.max(0, Math.min(offset, input.length));
  let line = 1;
  let lastNewline = -1;
  for (let i = 0; i < clamped; i++) {
    if (input[i] === "\n") {
      line += 1;
      lastNewline = i;
    }
  }
  return { line, col: clamped - lastNewline }; // col is 1-based
}

/**
 * Best-effort 1-based line:col from a `SyntaxError` message — engine-portable
 * across V8 (Node) and JavaScriptCore (the real WKWebView), whose message shapes
 * differ. Strategy, in order:
 *  1. An explicit char offset ("... at position 7" / "in JSON at position 7").
 *  2. An explicit "line L column C" pair (some JSC / V8 messages).
 *  3. V8's snippet form ("Unexpected token 'X', \"<snippet>\" is not valid JSON"):
 *     locate the quoted context snippet inside the input to recover the offset.
 * Returns `undefined`s only when none of these are parseable (message-only).
 */
function lineColFromError(
  message: string,
  input: string,
): { line?: number; col?: number } {
  const positionMatch = /position\s+(\d+)/i.exec(message);
  if (positionMatch) {
    return offsetToLineCol(input, Number(positionMatch[1]));
  }

  const lineColMatch = /line\s+(\d+)\s+column\s+(\d+)/i.exec(message);
  if (lineColMatch) {
    return { line: Number(lineColMatch[1]), col: Number(lineColMatch[2]) };
  }

  // V8 snippet form: the message quotes a context snippet (possibly elided with
  // leading "...") around the failure. Find that snippet in the input to recover
  // an offset, then point at the offending token within it when given.
  const snippetMatch = /"((?:\\.|[^"\\])*)"\s+is not valid JSON/i.exec(message);
  if (snippetMatch) {
    let snippet = snippetMatch[1];
    if (snippet.startsWith("...")) snippet = snippet.slice(3);
    if (snippet.endsWith("...")) snippet = snippet.slice(0, -3);
    const at = snippet ? input.indexOf(snippet) : -1;
    if (at >= 0) {
      const tokenMatch = /Unexpected token '(.+?)'/i.exec(message);
      const within = tokenMatch ? snippet.indexOf(tokenMatch[1]) : -1;
      const offset = within >= 0 ? at + within : at;
      return offsetToLineCol(input, offset);
    }
  }

  return {};
}

/**
 * Validate + format strict JSON.
 *
 * @param input Raw user-pasted text.
 * @param opts  Indent (`2`/`4`/`tab`), `minify` (wins over prettify), and
 *              optional recursive `sortKeys`.
 */
export function formatJson(input: string, opts: FormatOptions): FormatResult {
  if (input.trim() === "") {
    return { ok: true, output: "", inputBytes: 0, outputBytes: 0 };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: { message, ...lineColFromError(message, input) } };
  }

  const value = opts.sortKeys ? sortKeysDeep(parsed) : parsed;
  const output = opts.minify
    ? JSON.stringify(value)
    : JSON.stringify(value, null, indentSpace(opts.indent));

  return {
    ok: true,
    output,
    inputBytes: byteLen(input),
    outputBytes: byteLen(output),
  };
}
