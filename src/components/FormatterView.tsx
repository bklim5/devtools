// Shared presentational formatter shell (D-01/D-03/D-06/D-08) — JSON/XML-AGNOSTIC.
// Both JsonFormatterTool and (wave 3) XmlFormatterTool render this; it owns no
// transform logic. A single top toolbar (indent 2/4/tab segmented group, a minify
// toggle, an OPTIONAL sort-keys toggle rendered only when `onSortKeys` is given —
// JSON yes, XML no, D-06 — plus the output copy button), then a resizable
// input | output split, then the StatusBar footer. The container and panes are
// layout-agnostic (no fixed widths, min-w-0/min-h-0; UX-05).
//
// Output is a READ-ONLY <textarea> showing plain monospace text — NO syntax
// highlighting and NO raw-HTML injection (D-03 / threat T-07-05). Copy is a real,
// visible, focusable <button> (FMT-08, no hover gate) writing through the platform
// clipboard seam. Accent = selected only: the active indent option and an ON toggle
// carry aria-pressed + accent classes; inactive ones stay neutral.
import { Check, Copy } from "lucide-react";
import { platform } from "@/lib/platform";
import { useCopyFeedback } from "@/shell/useCopyFeedback";
import { ResizableSplit } from "@/components/ResizableSplit";
import { StatusBar, type ParseState } from "@/components/StatusBar";
import type { IndentMode } from "@/lib/format/types";

export interface FormatterControls {
  indent: IndentMode;
  onIndent: (m: IndentMode) => void;
  minify: boolean;
  onMinify: (v: boolean) => void;
  /** Present (with `onSortKeys`) = JSON; omit for XML. */
  sortKeys?: boolean;
  onSortKeys?: (v: boolean) => void;
}

export interface FormatterStatus {
  parseState: ParseState;
  byteCount: number;
  outputBytes?: number;
  error?: string | null;
  timingMs?: number;
}

export interface FormatterViewProps {
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

const INDENT_OPTIONS: { value: IndentMode; label: string }[] = [
  { value: "2", label: "2" },
  { value: "4", label: "4" },
  { value: "tab", label: "tab" },
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

interface ToggleProps {
  label: string;
  pressed: boolean;
  onToggle: (next: boolean) => void;
}

function Toggle({ label, pressed, onToggle }: ToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
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
        <div className="flex items-center gap-2">
          {/* Visible label so the 2/4/tab segments are self-explanatory. "Indent"
              (not "Spaces") because one option is a literal tab, not spaces. */}
          <span
            id={`${inputId}-indent-label`}
            className="text-[11px] font-medium uppercase tracking-wide text-tx-2"
          >
            Indent
          </span>
          <div
            role="group"
            aria-labelledby={`${inputId}-indent-label`}
            className="flex items-center gap-1 rounded-[7px] border border-bd bg-input-bg p-0.5"
          >
            {INDENT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={controls.indent === opt.value}
                onClick={() => controls.onIndent(opt.value)}
                className={toggleClasses(controls.indent === opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <Toggle label="Minify" pressed={controls.minify} onToggle={controls.onMinify} />
        {controls.onSortKeys ? (
          <Toggle
            label="Sort keys"
            pressed={controls.sortKeys ?? false}
            onToggle={controls.onSortKeys}
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
      />
    </div>
  );
}
