// The real Base64 / Hex / Bytes tool (UX-01..05, ENC-03). A thin, layout-agnostic
// shell over useBytesConvert: three stacked full-width panes (Text / Base64 / Hex),
// each an editable <textarea> that fires its edit handler on every change (paste
// transforms instantly — no convert button, UX-01). The base64 pane carries a
// base64/base64url toggle (active = accent, the project-wide "accent = selected
// only" rule). Each pane has a VISIBLE, focusable <button> copy affordance — never
// hover-gated (UX-02). Per-field errors render as a text-bad node below the field
// AND in the status bar (not opacity-only, UX-04). No fixed widths anywhere (UX-05).
// Clipboard goes through the platform seam ONLY — never the Tauri APIs directly.
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { platform } from "@/lib/platform";
import { useCopyFeedback } from "@/shell/useCopyFeedback";
import { useBytesConvert } from "./useBytesConvert";
import { SegmentedControl } from "@/components/SegmentedControl";
import { StatusBar, type ParseState } from "@/components/StatusBar";

interface PaneProps {
  label: string;
  value: string;
  onChange: (raw: string) => void;
  error?: string;
  /** Optional extra controls rendered in the pane header (e.g. alphabet toggle). */
  headerExtra?: React.ReactNode;
  /** Stable id fragment for label/textarea/error wiring. */
  paneId: string;
}

function Pane({ label, value, onChange, error, headerExtra, paneId }: PaneProps) {
  const errorId = `${paneId}-error`;
  const [copied, confirmCopy] = useCopyFeedback();

  function handleCopy() {
    void platform.clipboard.writeText(value);
    confirmCopy();
  }

  return (
    <section className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <label
            htmlFor={paneId}
            className="text-[12px] font-semibold uppercase tracking-wide text-tx-2"
          >
            {label}
          </label>
          {headerExtra}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={`Copy ${label}`}
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
        id={paneId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="min-h-[88px] w-full resize-y rounded-lg border border-bd bg-input-bg p-3 font-mono text-[13px] text-tx outline-none transition-colors focus-visible:border-accent-line focus-visible:ring-2 focus-visible:ring-accent"
      />
      {error ? (
        <p id={errorId} aria-live="polite" className="text-[12px] text-bad">
          {error}
        </p>
      ) : null}
    </section>
  );
}

/** base64/base64url alphabet options for the shared SegmentedControl. */
const ALPHABET_OPTIONS = [
  { value: "base64", label: "base64" },
  { value: "base64url", label: "base64url" },
] as const;

export default function Base64Tool() {
  const {
    text,
    base64,
    hex,
    alphabet,
    errors,
    byteCount,
    editText,
    editBase64,
    editHex,
    setAlphabet,
  } = useBytesConvert();

  // The status bar timing reflects the most recent derive (cheap, but surfaced
  // per UX-03). We measure around the edit handlers via a wrapper.
  const [timingMs, setTimingMs] = useState<number | undefined>(undefined);

  function timed<A extends unknown[]>(fn: (...args: A) => void) {
    return (...args: A) => {
      const start = performance.now();
      fn(...args);
      setTimingMs(performance.now() - start);
    };
  }

  const firstError = errors.text ?? errors.base64 ?? errors.hex ?? null;
  const parseState: ParseState = firstError
    ? "error"
    : byteCount === 0
      ? "empty"
      : "ok";

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-auto p-4">
        <Pane
          paneId="base64-pane-text"
          label="Text"
          value={text}
          onChange={timed(editText)}
          error={errors.text}
        />
        <Pane
          paneId="base64-pane-b64"
          label="Base64"
          value={base64}
          onChange={timed(editBase64)}
          error={errors.base64}
          headerExtra={
            <SegmentedControl
              options={ALPHABET_OPTIONS}
              value={alphabet}
              onChange={timed(setAlphabet)}
              ariaLabel="Base64 alphabet"
            />
          }
        />
        <Pane
          paneId="base64-pane-hex"
          label="Hex"
          value={hex}
          onChange={timed(editHex)}
          error={errors.hex}
        />
      </div>
      <StatusBar
        parseState={parseState}
        byteCount={byteCount}
        error={firstError}
        timingMs={timingMs}
      />
    </div>
  );
}
