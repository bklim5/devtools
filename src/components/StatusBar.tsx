// Shared tool status bar (UX-03): parse state · byte count · current encoding ·
// errors · timing. Generic + presentational so every tool reuses it verbatim —
// it takes only primitives, owns no tool logic. Mirrors the mockup's `.statusbar`
// (.st-left / .st-right) with Tailwind tokens. Errors show in text-bad (never
// opacity-only, UX-04). Lives at a tool-agnostic path (D-04) so Base64, Unix Time,
// JWT, Hash, and UUID/ULID all import from here. The size readout is opt-in
// (UIX-01): it renders only where input/output size is meaningful.
export type ParseState = "ok" | "error" | "empty";

export interface StatusBarProps {
  parseState: ParseState;
  /**
   * Input size in bytes. OPT-IN (UIX-01): when omitted, NO size readout renders —
   * tools where input/output size isn't meaningful (Hash/UUID/Unix Time/JWT) omit
   * it. When provided, the size span renders as before: a single `N byte(s)` count,
   * or — if `outputBytes` is also given — an `input → output` delta.
   */
  byteCount?: number;
  /**
   * Human label for the current encoding (e.g. "base64url"). Optional: most
   * useful when the encoding is AUTO-DETECTED (the protobuf hero tool). Tools
   * where the user picks the encoding explicitly (Base64) omit it to avoid a
   * redundant chip.
   */
  encoding?: string;
  /**
   * Output size in bytes (optional). When provided, the byte readout becomes an
   * input->output delta (e.g. `1,240 → 890 bytes`) so formatters can show the
   * minify/prettify size change (D-04). Omitted by single-count callers
   * (Base64/Hex/Bytes, Protobuf), which stay byte-identical. The delta requires
   * `byteCount` too — passing `outputBytes` WITHOUT `byteCount` renders nothing.
   */
  outputBytes?: number;
  /** Active error text, if any — named here AND inline on the field (D-13). */
  error?: string | null;
  /** Last operation timing in ms (optional; omitted when not measured). */
  timingMs?: number;
}

/** Thousands-separated count, used ONLY in the delta branch (D-04). */
function formatN(n: number): string {
  return n.toLocaleString("en-US");
}

const STATE_LABEL: Record<ParseState, string> = {
  ok: "OK",
  error: "Error",
  empty: "Empty",
};

export function StatusBar({
  parseState,
  byteCount,
  outputBytes,
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
        {typeof byteCount === "number" ? (
          <span aria-label="byte count">
            {typeof outputBytes === "number"
              ? `${formatN(byteCount)} → ${formatN(outputBytes)} bytes`
              : `${byteCount} ${byteCount === 1 ? "byte" : "bytes"}`}
          </span>
        ) : null}
        {encoding ? <span aria-label="encoding">{encoding}</span> : null}
      </div>
      <div className="flex min-w-0 items-center gap-[11px]">
        {error ? (
          // Clipped with `truncate`, so the full message must stay reachable: the
          // accessible name carries the actual error (not the literal word "error")
          // and `title` gives a native hover/focus tooltip for the full text.
          // `data-status="error"` is a stable, message-independent hook for tests.
          <span
            className="truncate text-bad"
            title={error}
            aria-label={error}
            data-status="error"
          >
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
