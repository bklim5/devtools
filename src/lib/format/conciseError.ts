/**
 * Strip Prettier's explanatory boilerplate + spec URL + a trailing "(1:14)" locus
 * from an engine error message, leaving only the essential head (the line:col is
 * surfaced separately by the tool). esbuild errors carry no such boilerplate, so
 * they pass through unchanged aside from a trailing paren-locus. Shared by the
 * HTML and JS/TS formatter tools.
 */
export function conciseError(message: string): string {
  return message
    .split(/\.\s+(?:It may happen\b|For more info(?:rmation)? see\b)/i)[0]
    .replace(/\s*\(\d+:\d+\)\s*$/, "")
    .trim();
}
