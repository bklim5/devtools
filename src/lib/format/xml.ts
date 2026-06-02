// Pure XML formatter (FMT-05..07, D-08/D-09/D-11). Validate well-formedness +
// prettify / minify over the native `DOMParser` + `XMLSerializer` only — ZERO
// runtime dependencies. No React / platform imports: plain data the
// XmlFormatterTool consumes, returning the shared `FormatResult` (D-09).
//
// Behavior:
// - Empty / whitespace-only input -> ok with empty output (D-08: the tool maps
//   this to status "empty", NOT an error).
// - A `<parsererror>` node from `DOMParser.parseFromString(input, "application/xml")`
//   -> ok:false with the parsererror text and, when the engine embeds a line
//   number in that text, a 1-based `line` (D-09). XML never sorts (no sortKeys).
// - Prettify re-emits with `opts.indent` (2/4/tab), each element node on its own
//   indented line, PRESERVING comments, CDATA, processing instructions, and
//   attributes (FMT-06); empty elements stay self-closing.
// - Minify strips insignificant inter-element whitespace (FMT-07) while keeping
//   significant text.
//
// XXE/billion-laughs safety (threats T-07-08/09): the browser/WKWebView and jsdom
// `DOMParser` do NOT resolve external entities or retrieve external DTDs. This
// module uses no other XML engine and enables no external-entity option — there is
// no network or file access reachable from the parse.
import type { FormatOptions, FormatResult, IndentMode } from "./types";

/** UTF-8 byte length, matching how the StatusBar delta is measured. */
function byteLen(s: string): number {
  return new TextEncoder().encode(s).length;
}

/** One indentation unit: a literal tab, or N spaces. */
function indentUnit(indent: IndentMode): string {
  return indent === "tab" ? "\t" : " ".repeat(Number(indent));
}

/** True for a text node that is only whitespace (insignificant between elements). */
function isWhitespaceText(node: Node): boolean {
  return node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim() === "";
}

/**
 * Does this element hold significant (non-whitespace) text directly? Such
 * elements are serialized inline so their text content is never reflowed.
 */
function hasSignificantText(el: Element): boolean {
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE && (child.textContent ?? "").trim() !== "") {
      return true;
    }
  }
  return false;
}

/**
 * Pretty-print a single node at `depth`. Element nodes whose children are all
 * structural (other elements / comments / PIs / CDATA, plus droppable whitespace)
 * are expanded one-child-per-line; elements carrying significant text — or any
 * non-element node — are serialized inline (preserving comments/CDATA/PIs verbatim).
 */
function prettyNode(node: Node, depth: number, unit: string, serializer: XMLSerializer): string {
  const pad = unit.repeat(depth);

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return pad + serializer.serializeToString(node);
  }

  const el = node as Element;
  const structuralChildren = Array.from(el.childNodes).filter((c) => !isWhitespaceText(c));

  // Leaf, or holds text / mixed content -> emit inline (serializer preserves it).
  if (structuralChildren.length === 0 || hasSignificantText(el)) {
    return pad + serializer.serializeToString(el);
  }

  // Expand: open tag, each structural child on its own deeper line, close tag.
  const open = serializer.serializeToString(el);
  const openTag = open.slice(0, open.indexOf(">") + 1);
  const lines = structuralChildren.map((c) => prettyNode(c, depth + 1, unit, serializer));
  return `${pad}${openTag}\n${lines.join("\n")}\n${pad}</${el.tagName}>`;
}

/** Recursively strip whitespace-only text nodes so the serializer emits no gaps. */
function stripInsignificantWhitespace(node: Node): void {
  // Never strip inside elements that carry significant text (mixed content).
  if (node.nodeType === Node.ELEMENT_NODE && hasSignificantText(node as Element)) {
    return;
  }
  for (const child of Array.from(node.childNodes)) {
    if (isWhitespaceText(child)) {
      child.parentNode?.removeChild(child);
    } else {
      stripInsignificantWhitespace(child);
    }
  }
}

/**
 * Pull a 1-based line number out of a `<parsererror>` message when present.
 * jsdom emits "L:C: message" (leading "line:col:"); WebKit emits "...on line N...".
 * Returns undefined when neither shape is found.
 */
function lineFromParseError(message: string): number | undefined {
  const onLine = /line\s+(\d+)/i.exec(message);
  if (onLine) return Number(onLine[1]);
  const leading = /^\s*(\d+):\d+:/.exec(message);
  if (leading) return Number(leading[1]);
  return undefined;
}

/**
 * Validate + format XML.
 *
 * @param input Raw user-pasted text.
 * @param opts  Indent (`2`/`4`/`tab`) and `minify` (wins over prettify). `sortKeys`
 *              is ignored — XML never sorts (D-06).
 */
export function formatXml(input: string, opts: FormatOptions): FormatResult {
  if (input.trim() === "") {
    return { ok: true, output: "", inputBytes: 0, outputBytes: 0 };
  }

  const doc = new DOMParser().parseFromString(input, "application/xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    const message = (parseError.textContent ?? "").trim() || "Invalid XML";
    return { ok: false, error: { message, line: lineFromParseError(message) } };
  }

  const serializer = new XMLSerializer();
  let output: string;
  if (opts.minify) {
    stripInsignificantWhitespace(doc);
    output = serializer.serializeToString(doc.documentElement);
  } else {
    output = prettyNode(doc.documentElement, 0, indentUnit(opts.indent), serializer);
  }

  return {
    ok: true,
    output,
    inputBytes: byteLen(input),
    outputBytes: byteLen(output),
  };
}
