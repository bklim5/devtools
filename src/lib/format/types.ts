// Shared formatter contract (D-09) — the pure surface both the JSON and XML
// formatters depend on. No React, no app DOM, no platform imports: this is plain
// data so `src/lib/format/json.ts` and `src/lib/format/xml.ts` can return a single,
// uniform shape and the tool components own only UX.

/** Pretty-print indentation: 2 spaces, 4 spaces, or a literal tab (D-06). */
export type IndentMode = "2" | "4" | "tab";

/** Toolbar-driven formatting options shared by both formatters. */
export interface FormatOptions {
  /** Indent width; the caller/tool picks the default ("2"), not this module. */
  indent: IndentMode;
  /** When true, minify wins over prettify (D-06). */
  minify: boolean;
  /** Recursively sort object keys — JSON only (D-10); XML never sets it. */
  sortKeys?: boolean;
}

/**
 * Discriminated result of a pure format pass (D-09). On success, `output` plus
 * the input/output byte counts feed the StatusBar delta; on failure, `error`
 * carries a human message and optional line:col for inline + status-bar display.
 */
export type FormatResult =
  | { ok: true; output: string; inputBytes: number; outputBytes: number }
  | { ok: false; error: { message: string; line?: number; col?: number } };
