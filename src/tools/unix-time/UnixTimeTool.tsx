// The real Unix Time tool (TIME-01, UX-01..05). A thin, layout-agnostic shell over
// the shared src/lib/timeFormat module (Plan 01) — NO date math is duplicated here.
//
// Forward pane: an editable timestamp field. On every change (paste transforms
// instantly — no convert button, UX-01) the integer is parsed; empty is the neutral
// state (no error). The unit (s/ms) is auto-detected by magnitude via classifyUnit
// unless the user forces an override with the s/ms toggle (mirrors Base64's
// AlphabetToggle: aria-pressed, active = accent, the project-wide "accent = selected
// only" rule). The value is normalised to ms (×1000 for "s") and formatTimestamp
// renders LOCAL + UTC + ISO rows, each with a VISIBLE focusable CopyButton (UX-02).
//
// Reverse pane (D-06): an editable ISO/datetime field; on change toUnixFromIso
// derives the timestamp (in the active unit) back into the forward field — two-way.
//
// Live "now" (D-06): the current unix time (in the active unit), refreshed every 1s,
// with its own CopyButton.
//
// All parsing is wrapped in try/catch (timeFormat throws bounded explicit Errors);
// malformed input → a field-scoped error node (aria-invalid + text-bad, never
// opacity-only, UX-04), never a crash (threat T-04-05). Clipboard goes through the
// CopyButton → platform seam ONLY — never the Tauri clipboard APIs directly.
import { useEffect, useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { StatusBar, type ParseState } from "@/components/StatusBar";
import {
  classifyUnit,
  formatTimestamp,
  toUnixFromIso,
  type FormattedTimestamp,
} from "@/lib/timeFormat";

type Unit = "s" | "ms";

interface UnitToggleProps {
  value: Unit;
  onChange: (next: Unit) => void;
}

function UnitToggle({ value, onChange }: UnitToggleProps) {
  const options: Unit[] = ["s", "ms"];
  return (
    <div
      role="group"
      aria-label="Timestamp unit"
      className="flex items-center gap-1 rounded-[7px] border border-bd bg-input-bg p-0.5"
    >
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            aria-pressed={active}
            className={[
              "rounded-[5px] px-2 py-0.5 text-[11px] font-medium outline-none transition-colors",
              "focus-visible:ring-2 focus-visible:ring-accent",
              active
                ? "border border-accent-line bg-accent-soft text-accent"
                : "border border-transparent text-tx-2 hover:text-tx",
            ].join(" ")}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

interface OutputRowProps {
  label: string;
  value: string;
  rowId: string;
}

function OutputRow({ label, value, rowId }: OutputRowProps) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-bd bg-input-bg px-3 py-2">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-tx-2">
          {label}
        </span>
        <span id={rowId} className="truncate font-mono text-[13px] text-tx">
          {value}
        </span>
      </div>
      <CopyButton value={value} label={label} />
    </div>
  );
}

/** Convert a timestamp expressed in `unit` to milliseconds. */
function toMs(value: number, unit: Unit): number {
  return unit === "s" ? value * 1000 : value;
}

/** Convert a millisecond timestamp to the given unit's integer value. */
function fromMs(ms: number, unit: Unit): number {
  return unit === "s" ? Math.floor(ms / 1000) : ms;
}

export default function UnixTimeTool() {
  // Forward field raw text + an optional manual unit override (null = auto-detect).
  const [raw, setRaw] = useState("");
  const [override, setOverride] = useState<Unit | null>(null);
  // Reverse field raw text + its own field-scoped error.
  const [isoInput, setIsoInput] = useState("");
  const [isoError, setIsoError] = useState<string | null>(null);
  // Most-recent forward-derive timing (UX-03). Measured in the change handler (an
  // event, not render) so the clock read stays out of the render body.
  const [timingMs, setTimingMs] = useState<number | undefined>(undefined);

  // Live "now", refreshed every second (cleanup on unmount).
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const trimmed = raw.trim();
  const isEmpty = trimmed === "";

  // The active unit: a manual override wins; otherwise auto-detect by magnitude.
  // For an empty forward field there is nothing to classify → default to "ms" so
  // the reverse field (D-06) derives full-precision ms back into it.
  const parsedValue = isEmpty ? NaN : Number(trimmed);
  const numericValid = !isEmpty && /^-?\d+$/.test(trimmed) && Number.isFinite(parsedValue);
  const activeUnit: Unit =
    override ?? (numericValid ? classifyUnit(parsedValue) : "ms");

  // Derive the forward output. Errors become a field-scoped message (never a throw,
  // threat T-04-05). Pure + deterministic from the inputs, so it lives in render.
  let formatted: FormattedTimestamp | null = null;
  let forwardError: string | null = null;
  if (!isEmpty) {
    try {
      if (!numericValid) throw new Error("Enter an integer unix timestamp");
      formatted = formatTimestamp(toMs(parsedValue, activeUnit));
    } catch (e) {
      forwardError = e instanceof Error ? e.message : "Invalid timestamp";
    }
  }

  function handleRawChange(next: string) {
    const start = performance.now();
    setRaw(next);
    setTimingMs(next.trim() === "" ? undefined : performance.now() - start);
  }

  function handleIsoChange(next: string) {
    setIsoInput(next);
    if (next.trim() === "") {
      setIsoError(null);
      return;
    }
    try {
      const ms = toUnixFromIso(next);
      setIsoError(null);
      // Write the derived timestamp into the forward field, in the active unit.
      setRaw(String(fromMs(ms, activeUnit)));
    } catch (e) {
      setIsoError(e instanceof Error ? e.message : "Invalid date string");
    }
  }

  const firstError = forwardError ?? isoError ?? null;
  const parseState: ParseState = forwardError
    ? "error"
    : isEmpty
      ? "empty"
      : "ok";

  const nowValue = String(fromMs(nowMs, activeUnit));

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-auto p-4">
        {/* Forward: timestamp → datetimes */}
        <section className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor="unix-time-input"
              className="text-[12px] font-semibold uppercase tracking-wide text-tx-2"
            >
              Unix Timestamp
            </label>
            <UnitToggle
              value={activeUnit}
              onChange={(u) => setOverride(u)}
            />
          </div>
          <textarea
            id="unix-time-input"
            value={raw}
            onChange={(e) => handleRawChange(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            placeholder="1469922850259"
            aria-invalid={forwardError ? true : undefined}
            aria-describedby={forwardError ? "unix-time-input-error" : undefined}
            className="min-h-[64px] w-full resize-y rounded-lg border border-bd bg-input-bg p-3 font-mono text-[13px] text-tx outline-none transition-colors focus-visible:border-accent-line focus-visible:ring-2 focus-visible:ring-accent"
          />
          {forwardError ? (
            <p
              id="unix-time-input-error"
              aria-live="polite"
              className="text-[12px] text-bad"
            >
              {forwardError}
            </p>
          ) : null}
        </section>

        {/* Derived datetimes (local + UTC + ISO), each with a visible copy. */}
        {formatted ? (
          <div className="flex min-w-0 flex-col gap-2">
            <OutputRow label="Local" value={formatted.local} rowId="unix-time-local" />
            <OutputRow label="UTC" value={formatted.utc} rowId="unix-time-utc" />
            <OutputRow label="ISO 8601" value={formatted.iso} rowId="unix-time-iso" />
          </div>
        ) : null}

        {/* Reverse: ISO/datetime → timestamp (two-way, D-06). */}
        <section className="flex min-w-0 flex-col gap-2">
          <label
            htmlFor="unix-time-iso-input"
            className="text-[12px] font-semibold uppercase tracking-wide text-tx-2"
          >
            ISO / Datetime → Timestamp
          </label>
          <input
            id="unix-time-iso-input"
            type="text"
            value={isoInput}
            onChange={(e) => handleIsoChange(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            placeholder="2016-07-30T23:54:10.259Z"
            aria-invalid={isoError ? true : undefined}
            aria-describedby={isoError ? "unix-time-iso-input-error" : undefined}
            className="w-full rounded-lg border border-bd bg-input-bg p-3 font-mono text-[13px] text-tx outline-none transition-colors focus-visible:border-accent-line focus-visible:ring-2 focus-visible:ring-accent"
          />
          {isoError ? (
            <p
              id="unix-time-iso-input-error"
              aria-live="polite"
              className="text-[12px] text-bad"
            >
              {isoError}
            </p>
          ) : null}
        </section>

        {/* Live "now" with ≤1-keystroke copy. */}
        <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-bd bg-input-bg px-3 py-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-tx-2">
              Now ({activeUnit})
            </span>
            <span id="unix-time-now" className="truncate font-mono text-[13px] text-tx">
              {nowValue}
            </span>
          </div>
          <CopyButton value={nowValue} label="now" />
        </div>
      </div>
      <StatusBar
        parseState={parseState}
        byteCount={0}
        error={firstError}
        timingMs={timingMs}
      />
    </div>
  );
}
