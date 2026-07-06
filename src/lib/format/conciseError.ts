/**
 * Strip Prettier's explanatory boilerplate + spec URL + a trailing "(1:14)" locus
 * from an engine error message, leaving only the essential head (the line:col is
 * surfaced separately by the tool). esbuild errors carry no such boilerplate, so
 * they pass through unchanged aside from a trailing paren-locus. Shared by the
 * HTML and JS/TS formatter tools.
 *
 * The leading first-line cut handles the babel/typescript parser shape, whose
 * errors carry a multi-line ASCII code frame (`Expression expected. (1:11)\n> 1 |
 * …\n    |           ^`) after the head line. Cutting at the first newline drops
 * the frame AND re-exposes the `(1:11)` locus as trailing so the paren-locus
 * regex strips it (otherwise it sits mid-string and both transforms miss). HTML
 * `html`-parser errors are single-line, so this cut is a no-op for them.
 */
export function conciseError(message: string): string {
  return message
    .split("\n")[0]
    .split(/\.\s+(?:It may happen\b|For more info(?:rmation)? see\b)/i)[0]
    .replace(/\s*\(\d+:\d+\)\s*$/, "")
    .trim();
}
