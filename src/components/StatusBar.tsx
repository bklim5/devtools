// Shared tool status bar (UX-03): parse state · byte count · current encoding ·
// errors · timing. Generic + presentational so every tool reuses it verbatim —
// it takes only primitives, owns no tool logic. Mirrors the mockup's `.statusbar`
// (.st-left / .st-right) with Tailwind tokens. Always renders, even for empty
// input (neutral "0 bytes"); errors show in text-bad (never opacity-only, UX-04).
// Lives at a tool-agnostic path (D-04) so Base64, Unix Time, JWT, Hash, and
// UUID/ULID all import from here.
export type ParseState = "ok" | "error" | "empty";

export interface StatusBarProps {
  parseState: ParseState;
  byteCount: number;
  /**
   * Human label for the current encoding (e.g. "base64url"). Optional: most
   * useful when the encoding is AUTO-DETECTED (the protobuf hero tool). Tools
   * where the user picks the encoding explicitly (Base64) omit it to avoid a
   * redundant chip.
   */
  encoding?: string;
  /** Active error text, if any — named here AND inline on the field (D-13). */
  error?: string | null;
  /** Last operation timing in ms (optional; omitted when not measured). */
  timingMs?: number;
}

const STATE_LABEL: Record<ParseState, string> = {
  ok: "OK",
  error: "Error",
  empty: "Empty",
};

export function StatusBar({
  parseState,
  byteCount,
  encoding,
  error,
  timingMs,
}: StatusBarProps) {
  return (
    <footer
      className="flex h-[38px] flex-none items-center justify-between gap-3 border-t border-bd px-3 font-mono text-[11.5px] text-tx-2"
      role="status"
      aria-live="polite"
    >
      <div className="flex min-w-0 items-center gap-[11px]">
        <span
          className={parseState === "error" ? "text-bad" : "text-tx-2"}
          aria-label="parse state"
        >
          {STATE_LABEL[parseState]}
        </span>
        <span aria-label="byte count">
          {byteCount} {byteCount === 1 ? "byte" : "bytes"}
        </span>
        {encoding ? <span aria-label="encoding">{encoding}</span> : null}
      </div>
      <div className="flex min-w-0 items-center gap-[11px]">
        {error ? (
          <span className="truncate text-bad" aria-label="error">
            {error}
          </span>
        ) : null}
        {typeof timingMs === "number" ? (
          <span aria-label="timing">{timingMs.toFixed(1)} ms</span>
        ) : null}
      </div>
    </footer>
  );
}
