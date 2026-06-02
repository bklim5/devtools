// JSON formatter tool (FMT-01..04, FMT-08, D-07/D-08) — thin, mirroring Base64Tool.
// Owns input + option state (indent default "2", minify off, sort-keys off) and
// nothing else: on every input/option change it synchronously calls the pure
// `formatJson` (no debounce, D-07) inside a `timed()` wrapper, then hands the
// derived output + status to the shared presentational FormatterView. On a parse
// failure the output pane CLEARS and the status bar shows the line:col + message
// (D-08); empty/whitespace input is status "empty", not an error.
import { useMemo, useState } from "react";
import { formatJson } from "@/lib/format/json";
import { timed, type IndentMode } from "@/lib/format/types";
import { FormatterView } from "@/components/FormatterView";
import type { ParseState } from "@/components/StatusBar";

function byteLen(s: string): number {
  return new TextEncoder().encode(s).length;
}

export default function JsonFormatterTool() {
  const [input, setInput] = useState("");
  const [indent, setIndent] = useState<IndentMode>("2");
  const [minify, setMinify] = useState(false);
  const [sortKeys, setSortKeys] = useState(false);

  // Derive synchronously — formatJson is pure and cheap (D-07). Time the pure call
  // HERE, where the work actually happens; the old code measured around setInput (a
  // state setter that only schedules a re-render) so it read ~0 ms and never
  // reflected the format pass (WR-02). useMemo keeps the timing tied to the actual
  // (re)computation and out of React's impure-call-in-render lint.
  const { result, timingMs } = useMemo(
    () => timed(() => formatJson(input, { indent, minify, sortKeys })),
    [input, indent, minify, sortKeys],
  );

  const isEmpty = input.trim() === "";
  // On a parse failure the output pane CLEARS (D-08) and the status bar shows the
  // line:col + message; otherwise the formatted output + byte delta flow through.
  const output = result.ok ? result.output : "";
  const byteCount = result.ok ? result.inputBytes : byteLen(input);
  const outputBytes = result.ok ? result.outputBytes : undefined;
  const error = result.ok
    ? null
    : result.error.line !== undefined && result.error.col !== undefined
      ? `${result.error.line}:${result.error.col} ${result.error.message}`
      : result.error.message;
  const parseState: ParseState = result.ok ? (isEmpty ? "empty" : "ok") : "error";

  return (
    <FormatterView
      inputId="json-input"
      outputId="json-output"
      input={input}
      onInputChange={setInput}
      output={output}
      controls={{
        indent,
        onIndent: setIndent,
        minify,
        onMinify: setMinify,
        sortKeys,
        onSortKeys: setSortKeys,
      }}
      status={{ parseState, byteCount, outputBytes, error, timingMs }}
    />
  );
}
