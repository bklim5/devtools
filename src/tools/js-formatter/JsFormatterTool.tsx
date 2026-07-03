// JS/TS formatter tool (PRT-09/10/12, D-01..D-10) — the 13th tool. Clones the
// Phase-33 HtmlFormatterTool pattern EXACTLY (module-level mode-dispatching async
// runner, memo'd opts, hook-supplied byteCount/isEmpty, shared conciseError) and
// adds the two Prettify-only style toggles. ONE combined tool with NO language
// picker: Prettify drives `formatJsTs` (typescript→babel fallback chain, 34-01),
// Minify drives `minifyJsTs` (tsx→ts fallback chain, 34-01). It owns input + option
// state (indent "2", printWidth 80, semi true / singleQuote false = Prettier
// defaults per D-05, mode prettify) and nothing else, handing the derived output +
// status to the shared FormatterView.
//
// SC5 tool-seam fix (carried from the P33 harness remediation): byteCount is read
// STRAIGHT from the hook's `inputBytes` (`number | undefined`) — the tool NEVER
// re-encodes the input to measure it (no full-string TextEncoder pass in the render
// path) and NEVER re-runs a raw trim over the input value (emptiness comes from the
// hook's `isEmpty`). On an over-cap paste the hook's guard rejects it BEFORE the engine and
// BEFORE any full-length encode/trim; `inputBytes` is `undefined` so StatusBar shows
// no size readout while the calm role=alert "Input too large" text conveys size. NO
// `?? 0` fallback (it would regress the over-cap no-readout behavior).
//
// Errors render as line:col (D-03) — mirroring the JSON/HTML tools' `${line}:${col}
// ${message}` via the shared conciseError helper, NOT the XML line-only form.
import { useMemo, useState } from "react";
import { formatJsTs } from "@/lib/format/prettier";
import { minifyJsTs } from "@/lib/format/minify";
import { conciseError } from "@/lib/format/conciseError";
import type { IndentMode, FormatResult } from "@/lib/format/types";
import { useAsyncFormat } from "@/shell/useAsyncFormat";
import { FormatterView, type FormatMode } from "@/components/FormatterView";
import type { ParseState } from "@/components/StatusBar";

// Module-level (stable identity) opts + runner. `useAsyncFormat` compares opts BY
// IDENTITY, so the component memoizes the opts object; the runner is a stable
// module constant dispatching on mode. Minify ignores the Prettier style options
// (semi/singleQuote/printWidth) — esbuild has no such surface (D-06).
interface JsOpts {
  indent: IndentMode;
  printWidth: number;
  semi: boolean;
  singleQuote: boolean;
  mode: FormatMode;
}

const runJs = (input: string, o: JsOpts): Promise<FormatResult> =>
  o.mode === "minify"
    ? minifyJsTs(input)
    : formatJsTs(input, {
        indent: o.indent,
        minify: false,
        printWidth: o.printWidth,
        semi: o.semi,
        singleQuote: o.singleQuote,
      });

export default function JsFormatterTool() {
  const [input, setInput] = useState("");
  const [indent, setIndent] = useState<IndentMode>("2");
  const [printWidth, setPrintWidth] = useState(80);
  // D-05: Prettier defaults — semicolons ON, single-quote OFF (double quotes) —
  // so the default output stays byte-identical to `prettier --write` + the goldens.
  const [semi, setSemi] = useState(true);
  const [singleQuote, setSingleQuote] = useState(false);
  const [mode, setMode] = useState<FormatMode>("prettify");

  // Memoized so the hook's identity-compared opts is stable across renders.
  const opts = useMemo<JsOpts>(
    () => ({ indent, printWidth, semi, singleQuote, mode }),
    [indent, printWidth, semi, singleQuote, mode],
  );

  // Omit the 4th arg → inherit the default 2 MB guard. Read size AND emptiness from
  // the hook — the tool NEVER recomputes the byte length NOR re-runs a raw trim on
  // the input value. Re-trimming here would re-open the DoS the hook guard closes.
  const { result, pending, inputBytes, isEmpty } = useAsyncFormat(
    input,
    opts,
    runJs,
  );
  const output = result.ok ? result.output : "";
  // STRAIGHT from the hook (`number | undefined`) — no re-encode, no `?? 0`
  // fallback. Over-cap is `undefined` → StatusBar suppresses the size readout.
  const byteCount = inputBytes;
  const outputBytes = result.ok ? result.outputBytes : undefined;
  const error = result.ok
    ? null
    : result.error.line !== undefined && result.error.col !== undefined
      ? `${result.error.line}:${result.error.col} ${conciseError(result.error.message)}`
      : conciseError(result.error.message);
  const parseState: ParseState = result.ok ? (isEmpty ? "empty" : "ok") : "error";

  return (
    <FormatterView
      inputId="js-input"
      outputId="js-output"
      input={input}
      inputPlaceholder="Paste JavaScript, TypeScript, JSX, or TSX to format…"
      onInputChange={setInput}
      output={output}
      controls={{
        mode,
        onMode: setMode,
        indent,
        onIndent: setIndent,
        printWidth,
        onPrintWidth: setPrintWidth,
        semi,
        onSemi: setSemi,
        singleQuote,
        onSingleQuote: setSingleQuote,
        // No onSortKeys: JS/TS has none.
      }}
      status={{ parseState, byteCount, outputBytes, error, pending }}
    />
  );
}
