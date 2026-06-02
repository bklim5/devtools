// XML formatter tool (FMT-05..08, D-07/D-08) — thin, mirroring JsonFormatterTool
// but WITHOUT sort-keys (D-06: XML never sorts). Owns input + option state (indent
// default "2", minify off) and nothing else: on every change it synchronously
// calls the pure `formatXml` (no debounce, D-07) inside a `timed()`-style wrapper,
// then hands the derived output + status to the shared presentational FormatterView.
// On a parse failure the output pane CLEARS and the status bar shows the
// parsererror message (D-08); empty/whitespace input is status "empty", not an error.
import { useMemo, useState } from "react";
import { formatXml } from "@/lib/format/xml";
import { timed, type IndentMode } from "@/lib/format/types";
import { FormatterView } from "@/components/FormatterView";
import type { ParseState } from "@/components/StatusBar";

function byteLen(s: string): number {
  return new TextEncoder().encode(s).length;
}

export default function XmlFormatterTool() {
  const [input, setInput] = useState("");
  const [indent, setIndent] = useState<IndentMode>("2");
  const [minify, setMinify] = useState(false);

  // Derive synchronously — formatXml is pure and cheap (D-07). Time the pure call
  // HERE, where the work actually happens; the old code measured around setInput (a
  // state setter that only schedules a re-render) so it read ~0 ms and never
  // reflected the format pass (WR-02). useMemo keeps the timing tied to the actual
  // (re)computation and out of React's impure-call-in-render lint.
  const { result, timingMs } = useMemo(
    () => timed(() => formatXml(input, { indent, minify })),
    [input, indent, minify],
  );

  const isEmpty = input.trim() === "";
  // On a parse failure the output pane CLEARS (D-08) and the status bar shows the
  // parsererror; otherwise the formatted output + byte delta flow through.
  const output = result.ok ? result.output : "";
  const byteCount = result.ok ? result.inputBytes : byteLen(input);
  const outputBytes = result.ok ? result.outputBytes : undefined;
  const error = result.ok
    ? null
    : result.error.line !== undefined
      ? `line ${result.error.line}: ${result.error.message}`
      : result.error.message;
  const parseState: ParseState = result.ok ? (isEmpty ? "empty" : "ok") : "error";

  return (
    <FormatterView
      inputId="xml-input"
      outputId="xml-output"
      input={input}
      onInputChange={setInput}
      output={output}
      controls={{
        indent,
        onIndent: setIndent,
        minify,
        onMinify: setMinify,
        // No onSortKeys: XML has no sort-keys toggle (D-06).
      }}
      status={{ parseState, byteCount, outputBytes, error, timingMs }}
    />
  );
}
