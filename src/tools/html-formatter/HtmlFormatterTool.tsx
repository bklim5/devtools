// HTML formatter tool (PRT-07/08, D-11) — the FIRST async-hook consumer. Unlike
// the sync JSON/XML siblings it drives the shared `useAsyncFormat` (with the
// Plan-01 2 MB size guard) via a mode-dispatching async runner: Prettify calls
// `formatHtml` (reformatting embedded <script>/<style>), Minify calls `minifyHtml`.
// It owns input + option state (indent "2", printWidth 80, mode prettify) and
// nothing else, then hands the derived output + status to the shared FormatterView.
//
// SC6 tool-seam fix: byteCount is read STRAIGHT from the hook's `inputBytes`
// (`number | undefined`) — the tool NEVER re-encodes the input to measure it (no
// full-string TextEncoder pass in the render path). On an over-cap paste the hook's
// guard rejects it and `inputBytes` is `undefined`, so a multi-MB blob is never
// re-encoded (the Plan-01 guard actually holds at the mounted seam) and the
// StatusBar simply shows no size readout while the calm role=alert "Input too
// large" error text conveys size. NO `?? 0` fallback (it would regress the over-cap
// no-readout behavior) — the widened optional FormatterStatus.byteCount carries the
// undefined.
//
// Errors render as line:col (D-11) — mirroring the JSON tool's `${line}:${col}
// ${message}`, NOT the XML tool's line-only form: the malformed-HTML case carries
// a real column that must never be dropped.
import { useMemo, useState } from "react";
import { formatHtml } from "@/lib/format/prettier";
import { minifyHtml } from "@/lib/format/minify";
import type { IndentMode, FormatResult } from "@/lib/format/types";
import { useAsyncFormat } from "@/shell/useAsyncFormat";
import { FormatterView, type FormatMode } from "@/components/FormatterView";
import type { ParseState } from "@/components/StatusBar";

// Module-level (stable identity) opts + runner. `useAsyncFormat` compares opts BY
// IDENTITY, so the component memoizes the opts object; the runner is a stable
// module constant dispatching on mode.
interface HtmlOpts {
  indent: IndentMode;
  printWidth: number;
  mode: FormatMode;
}

const runHtml = (input: string, o: HtmlOpts): Promise<FormatResult> =>
  o.mode === "minify"
    ? minifyHtml(input)
    : formatHtml(input, { indent: o.indent, minify: false, printWidth: o.printWidth });

// Prettier's HTML-parser errors tack an explanatory clause + a spec URL onto the
// essential message (e.g. `Unexpected closing tag "div". It may happen when the tag
// has already been closed by another tag. For more info see https://…`). The status
// bar wants only the essential head — the line:col is surfaced separately — so drop
// everything from the first boilerplate marker onward, plus any trailing "(1:14)"
// Prettier repeats. esbuild minify errors carry no such boilerplate, so they pass
// through unchanged (aside from a trailing paren-locus, if any).
function conciseError(message: string): string {
  return message
    .split(/\.\s+(?:It may happen\b|For more info(?:rmation)? see\b)/i)[0]
    .replace(/\s*\(\d+:\d+\)\s*$/, "")
    .trim();
}

export default function HtmlFormatterTool() {
  const [input, setInput] = useState("");
  const [indent, setIndent] = useState<IndentMode>("2");
  const [printWidth, setPrintWidth] = useState(80);
  const [mode, setMode] = useState<FormatMode>("prettify");

  // Memoized so the hook's identity-compared opts is stable across renders.
  const opts = useMemo<HtmlOpts>(
    () => ({ indent, printWidth, mode }),
    [indent, printWidth, mode],
  );

  // Omit the 4th arg → inherit the default 2 MB guard. Read size AND emptiness from
  // the hook — the tool NEVER recomputes byteLen(input) NOR re-runs input.trim() on
  // the raw value. Re-trimming here would re-open the DoS the hook guard closes: an
  // over-cap all-whitespace paste would get a full-length main-thread trim() scan at
  // the tool seam. The hook's isEmpty is derived AFTER the bounded byte scan, so an
  // over-cap payload is oversize (isEmpty false) without ever being trimmed.
  const { result, pending, inputBytes, isEmpty } = useAsyncFormat(
    input,
    opts,
    runHtml,
  );
  // On error the output pane CLEARS; otherwise the formatted output flows through.
  const output = result.ok ? result.output : "";
  // STRAIGHT from the hook (`number | undefined`) — no re-encode, no `?? 0`
  // fallback. Over-cap is `undefined` → StatusBar suppresses the size readout.
  const byteCount = inputBytes;
  const outputBytes = result.ok ? result.outputBytes : undefined;
  // JSON-style line:col (D-11): both present → "line:col message"; otherwise the
  // bare message — mirroring the JSON sibling exactly. The malformed-HTML case
  // always carries a real column (engines emit line+col together via
  // offsetToLineCol), so the column is never dropped in practice.
  const error = result.ok
    ? null
    : result.error.line !== undefined && result.error.col !== undefined
      ? `${result.error.line}:${result.error.col} ${conciseError(result.error.message)}`
      : conciseError(result.error.message);
  const parseState: ParseState = result.ok ? (isEmpty ? "empty" : "ok") : "error";

  return (
    <FormatterView
      inputId="html-input"
      outputId="html-output"
      input={input}
      inputPlaceholder="Paste HTML to format…"
      onInputChange={setInput}
      output={output}
      controls={{
        mode,
        onMode: setMode,
        indent,
        onIndent: setIndent,
        printWidth,
        onPrintWidth: setPrintWidth,
        // No onSortKeys: HTML has none.
      }}
      status={{ parseState, byteCount, outputBytes, error, pending }}
    />
  );
}
