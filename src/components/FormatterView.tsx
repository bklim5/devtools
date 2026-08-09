// Shared presentational formatter shell (D-01/D-03/D-04/D-06/D-08) — TOOL-AGNOSTIC.
// JSON, XML, and (Phase 33/34) the HTML + JS/TS tools all render this; it owns no
// transform logic. A single top toolbar carries a mutually-exclusive
// [ Prettify | Minify ] segmented MODE selector (D-03), the indent 2/4/tab segmented
// group, an OPTIONAL printWidth 80/100/120 group (D-06 — rendered only when a tool
// supplies `onPrintWidth`, Prettier-tools only; JSON/XML omit it), an OPTIONAL
// sort-keys toggle (JSON yes, XML no), plus the output copy button, then a resizable
// input | output split, then the StatusBar footer. When Minify mode is active the
// indent + printWidth groups are HIDDEN (D-04 — meaningless for minified output).
// The container and panes are layout-agnostic (no fixed widths, min-w-0/min-h-0; UX-05).
//
// Output is a READ-ONLY <textarea> showing plain monospace text — NO syntax
// highlighting and NO raw-HTML injection (D-03 / threat T-07-05). Copy is a real,
// visible, focusable <button> (FMT-08, no hover gate) writing through the platform
// clipboard seam. Accent = selected only: the active mode/indent/width segment and
// an ON toggle carry aria-pressed + accent classes; inactive ones stay neutral.
import { Check, Copy } from "lucide-react";
import { platform } from "@/lib/platform";
import { useCopyFeedback } from "@/shell/useCopyFeedback";
import { useToolSuccess } from "@/shell/useToolSuccess";
import { ResizableSplit } from "@/components/ResizableSplit";
import { StatusBar, type ParseState } from "@/components/StatusBar";
import type { IndentMode } from "@/lib/format/types";

/** Mutually-exclusive prettify/minify mode (D-03) — replaces the old minify toggle. */
export type FormatMode = "prettify" | "minify";

export interface FormatterControls {
  mode: FormatMode;
  onMode: (m: FormatMode) => void;
  indent: IndentMode;
  onIndent: (m: IndentMode) => void;
  /** Present (with `onPrintWidth`) = Prettier tools (P33/P34); JSON/XML OMIT it (D-06). */
  printWidth?: number;
  onPrintWidth?: (w: number) => void;
  /** Present (with `onSortKeys`) = JSON; omit for XML. Visible in both modes (D-04). */
  sortKeys?: boolean;
  onSortKeys?: (v: boolean) => void;
  /** Present (with onSemi) = JS/TS tool; Prettify-only (D-06). Prettier `semi`. */
  semi?: boolean;
  onSemi?: (v: boolean) => void;
  /** Present (with onSingleQuote) = JS/TS tool; Prettify-only (D-06). Prettier `singleQuote`. */
  singleQuote?: boolean;
  onSingleQuote?: (v: boolean) => void;
}

export interface FormatterStatus {
  parseState: ParseState;
  // OPTIONAL (widened Phase 33-03): an async tool reads byteCount straight from
  // useAsyncFormat's `inputBytes`, which is `undefined` for an over-cap (>2 MB)
  // paste (the Plan-01 bounded counter never fully encodes it). Forwarded verbatim
  // to StatusBar, whose own `byteCount?: number` renders NO size readout when it is
  // not a number — so the over-cap case suppresses the readout instead of a `?? 0`
  // fallback that would wrongly print "0 bytes". Every json/xml caller still passes
  // a concrete number, so nothing existing changes.
  byteCount?: number;
  outputBytes?: number;
  error?: string | null;
  timingMs?: number;
  /** Subtle "Formatting…" StatusBar hint while an async format is in-flight (D-01). */
  pending?: boolean;
}

export interface FormatterViewProps {
  /** Registry tool id (json-formatter / xml-formatter / html-formatter /
   *  js-formatter), used ONLY by the shared success seam — it is part of the
   *  success-episode identity so the same text from two formatters counts twice.
   *  Rendered nowhere. */
  toolId: string;
  /** Stable id for the input textarea (e2e selector). */
  inputId: string;
  /** Stable id for the read-only output region (e2e selector). */
  outputId: string;
  input: string;
  /**
   * Optional empty-state hint shown on the input textarea while it is blank —
   * a short paste-instant prompt (e.g. "Paste JSON to format…") surfacing the
   * tool's promise. Omit for no placeholder.
   */
  inputPlaceholder?: string;
  onInputChange: (raw: string) => void;
  /** Derived output; "" when the tool clears it on error/empty (D-08). */
  output: string;
  controls: FormatterControls;
  status: FormatterStatus;
}

const MODE_OPTIONS: { value: FormatMode; label: string }[] = [
  { value: "prettify", label: "Prettify" },
  { value: "minify", label: "Minify" },
];

const INDENT_OPTIONS: { value: IndentMode; label: string }[] = [
  { value: "2", label: "2" },
  { value: "4", label: "4" },
  { value: "tab", label: "tab" },
];

// D-06: printWidth = the max line length before Prettier wraps a long line
// (independent of indent). Prettier-tools only; JSON/XML omit onPrintWidth.
const PRINT_WIDTH_OPTIONS: { value: number; label: string }[] = [
  { value: 80, label: "80" },
  { value: 100, label: "100" },
  { value: 120, label: "120" },
];

/** Shared accent-on-selected toggle/segment styling (mirrors Base64's AlphabetToggle). */
function toggleClasses(active: boolean): string {
  return [
    "rounded-[5px] px-2 py-0.5 text-[11px] font-medium outline-none transition-colors",
    "focus-visible:ring-2 focus-visible:ring-accent",
    active
      ? "border border-accent-line bg-accent-soft text-accent"
      : "border border-transparent text-tx-2 hover:text-tx",
  ].join(" ");
}

interface SegmentGroupProps<T extends string | number> {
  /** Visible + accessible-name label for the group (e.g. "Mode", "Indent", "Width"). */
  label: string;
  /** Stable id linking the label span to the role=group container (aria-labelledby). */
  labelId: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}

/** A labelled, accent-on-selected segmented control (mode / indent / printWidth). */
function SegmentGroup<T extends string | number>({
  label,
  labelId,
  options,
  value,
  onChange,
}: SegmentGroupProps<T>) {
  return (
    <div className="flex items-center gap-2">
      <span
        id={labelId}
        className="text-[11px] font-medium uppercase tracking-wide text-tx-2"
      >
        {label}
      </span>
      <div
        role="group"
        aria-labelledby={labelId}
        className="flex items-center gap-1 rounded-[7px] border border-bd bg-input-bg p-0.5"
      >
        {options.map((opt) => (
          <button
            key={String(opt.value)}
            type="button"
            aria-pressed={value === opt.value}
            onClick={() => onChange(opt.value)}
            className={toggleClasses(value === opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface ToggleProps {
  label: string;
  pressed: boolean;
  onToggle: (next: boolean) => void;
  /** Full accessible name when it must differ from the short visible label (D-07). */
  ariaLabel?: string;
}

function Toggle({ label, pressed, onToggle, ariaLabel }: ToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={ariaLabel ?? label}
      onClick={() => onToggle(!pressed)}
      className={[
        toggleClasses(pressed),
        "rounded-[7px] border bg-input-bg px-2 py-1",
        pressed ? "" : "border-bd",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

export function FormatterView({
  toolId,
  inputId,
  outputId,
  input,
  inputPlaceholder,
  onInputChange,
  output,
  controls,
  status,
}: FormatterViewProps) {
  const [copied, confirmCopy] = useCopyFeedback();

  // Shared success seam (UP5-01) — one call, no counting logic here. This ONE
  // call covers all four formatter tools. `pending` excludes deliberately: an
  // async formatter keeps its previous "ok" parseState while the NEXT format is
  // in flight, so a pending render is showing a stale result, not a settled one.
  useToolSuccess(toolId, status.parseState === "ok" && !status.pending, output);

  function handleCopy() {
    void platform.clipboard.writeText(output);
    confirmCopy();
  }

  const inputPane = (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 p-3">
      <label
        htmlFor={inputId}
        className="text-[12px] font-semibold uppercase tracking-wide text-tx-2"
      >
        Input
      </label>
      <textarea
        id={inputId}
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        placeholder={inputPlaceholder}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        className="min-h-0 w-full flex-1 resize-none rounded-lg border border-bd bg-input-bg p-3 font-mono text-[13px] text-tx outline-none transition-colors focus-visible:border-accent-line focus-visible:ring-2 focus-visible:ring-accent"
      />
    </section>
  );

  const outputPane = (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 p-3">
      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor={outputId}
          className="text-[12px] font-semibold uppercase tracking-wide text-tx-2"
        >
          Output
        </label>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy output"
          className={[
            "flex items-center gap-1.5 rounded-[7px] border bg-input-bg px-2 py-1 text-[11.5px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
            copied
              ? "border-accent-line text-accent"
              : "border-bd text-tx-2 hover:border-bd-2 hover:text-tx",
          ].join(" ")}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <textarea
        id={outputId}
        value={output}
        readOnly
        spellCheck={false}
        className="min-h-0 w-full flex-1 resize-none rounded-lg border border-bd bg-input-bg p-3 font-mono text-[13px] text-tx outline-none"
      />
    </section>
  );

  return (
    // `h-full` (not flex-1): the shell mounts tools inside a BLOCK overflow-auto
    // host, so flex-1 has no flex parent to grow against — we fill the host's
    // (definite) height directly so the panes use the whole window (UX: a few
    // key/value pairs shouldn't force a scroll). The host stays exactly filled,
    // so it doesn't scroll; the textareas scroll internally instead.
    <div className="flex h-full min-w-0 flex-col">
      {/* Shared top toolbar */}
      <div className="flex flex-none flex-wrap items-center gap-3 border-b border-bd px-3 py-2">
        {/* Mutually-exclusive [ Prettify | Minify ] mode selector (D-03). */}
        <SegmentGroup
          label="Mode"
          labelId={`${inputId}-mode-label`}
          options={MODE_OPTIONS}
          value={controls.mode}
          onChange={controls.onMode}
        />
        {/* D-04: indent is meaningless for minified output, so it is HIDDEN in
            Minify mode and restored in Prettify. "Indent" (not "Spaces") because
            one option is a literal tab. */}
        {controls.mode === "prettify" && (
          <SegmentGroup
            label="Indent"
            labelId={`${inputId}-indent-label`}
            options={INDENT_OPTIONS}
            value={controls.indent}
            onChange={controls.onIndent}
          />
        )}
        {/* Optional printWidth (D-06): Prettier tools only (onPrintWidth supplied)
            AND only in Prettify mode — likewise hidden in Minify (D-04). */}
        {controls.onPrintWidth && controls.mode === "prettify" ? (
          <SegmentGroup
            label="Width"
            labelId={`${inputId}-width-label`}
            options={PRINT_WIDTH_OPTIONS}
            value={controls.printWidth ?? 80}
            onChange={controls.onPrintWidth}
          />
        ) : null}
        {controls.onSortKeys ? (
          <Toggle
            label="Sort keys"
            pressed={controls.sortKeys ?? false}
            onToggle={controls.onSortKeys}
          />
        ) : null}
        {/* Semi + Single-quotes (D-06/D-07): JS/TS tool only (handler supplied) AND
            Prettify-only — hidden in Minify like indent/printWidth. Short visible
            labels, full aria-labels. Defaults match the engine (semi ON, singleQuote
            OFF). */}
        {controls.onSemi && controls.mode === "prettify" ? (
          <Toggle
            label="Semi"
            ariaLabel="semicolons"
            pressed={controls.semi ?? true}
            onToggle={controls.onSemi}
          />
        ) : null}
        {controls.onSingleQuote && controls.mode === "prettify" ? (
          <Toggle
            label="Single quotes"
            ariaLabel="single quotes"
            pressed={controls.singleQuote ?? false}
            onToggle={controls.onSingleQuote}
          />
        ) : null}
      </div>

      {/* Resizable input | output. Layout-agnostic, no fixed widths (UX-05); the
          panes carry min-w-0/min-h-0 so the shell can stack them responsively. */}
      <ResizableSplit left={inputPane} right={outputPane} />


      <StatusBar
        parseState={status.parseState}
        byteCount={status.byteCount}
        outputBytes={status.outputBytes}
        error={status.error}
        timingMs={status.timingMs}
        pending={status.pending}
      />
    </div>
  );
}
