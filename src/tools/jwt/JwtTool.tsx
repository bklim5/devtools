// The real JWT tool (JWT-01, UX-01..05) — DISPLAY-ONLY (D-09). A thin, layout-agnostic
// shell over decodeJwt (Task 1) + the shared timeFormat lib (Plan 01); NO base64 and NO
// date math is duplicated here. Paste a token (UX-01 — no decode button) → on every change
// decodeJwt(value) runs: empty is neutral; a malformed token surfaces a SINGLE field-scoped
// error node (aria-invalid + text-bad, never opacity-only, UX-04), never a crash (T-04-07);
// a valid token renders three labelled blocks — Header / Payload (pretty-printed JSON) and
// the RAW Signature segment — plus the alg, each block with a VISIBLE focusable CopyButton
// (UX-02). Standard claims (exp/iat/nbf) are humanized via formatTimestamp + relativeTime
// (treated as unix SECONDS), and an EXPIRED or NOT-YET-VALID token is visibly flagged in
// text-bad (D-10) — advisory only, NOT a cryptographic check (no signature verification, no
// key field, D-09). Clipboard goes through the CopyButton → platform seam ONLY.
import { useEffect, useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { StatusBar, type ParseState } from "@/components/StatusBar";
import { formatTimestamp, relativeTime } from "@/lib/timeFormat";
import { decodeJwt } from "./decodeJwt";

/** The standard registered-claim names we humanize (RFC 7519, all unix SECONDS). */
const TIME_CLAIMS = ["exp", "iat", "nbf"] as const;
type TimeClaim = (typeof TIME_CLAIMS)[number];

const CLAIM_LABEL: Record<TimeClaim, string> = {
  exp: "Expires (exp)",
  iat: "Issued At (iat)",
  nbf: "Not Before (nbf)",
};

interface OutputBlockProps {
  label: string;
  value: string;
  blockId: string;
  mono?: boolean;
}

function OutputBlock({ label, value, blockId, mono = true }: OutputBlockProps) {
  return (
    <section className="flex min-w-0 flex-col gap-2 rounded-lg border border-bd bg-input-bg p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-tx-2">
          {label}
        </span>
        <CopyButton value={value} label={label} />
      </div>
      <pre
        id={blockId}
        className={[
          "min-w-0 overflow-auto whitespace-pre-wrap break-words text-[13px] text-tx",
          mono ? "font-mono" : "",
        ].join(" ")}
      >
        {value}
      </pre>
    </section>
  );
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** A humanized standard claim + its expired / not-yet-valid status flag (D-10). */
interface ClaimView {
  claim: TimeClaim;
  label: string;
  ms: number;
  absolute: string;
  relative: string;
  /** "expired" | "not yet valid" | null — advisory only, never cryptographic. */
  flag: "expired" | "not yet valid" | null;
}

/** Build humanized views for whatever exp/iat/nbf NUMBER claims the payload carries. */
function claimViews(payload: unknown, nowMs: number): ClaimView[] {
  if (!isRecord(payload)) return [];
  const views: ClaimView[] = [];
  for (const claim of TIME_CLAIMS) {
    const raw = payload[claim];
    if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
    const ms = raw * 1000; // unix seconds → ms
    let absolute: string;
    try {
      absolute = formatTimestamp(ms).iso;
    } catch {
      continue; // a non-sensible numeric claim — skip rather than crash
    }
    const relative = relativeTime(ms, nowMs);
    let flag: ClaimView["flag"] = null;
    if (claim === "exp" && ms < nowMs) flag = "expired";
    if (claim === "nbf" && ms > nowMs) flag = "not yet valid";
    views.push({ claim, label: CLAIM_LABEL[claim], ms, absolute, relative, flag });
  }
  return views;
}

export default function JwtTool() {
  const [raw, setRaw] = useState("");
  // Most-recent decode timing (UX-03), measured in the change handler (an event, not
  // render) so the clock read stays out of the render body.
  const [timingMs, setTimingMs] = useState<number | undefined>(undefined);

  // "now" lives in state (refreshed every second) so the advisory expired / not-yet-valid
  // flags stay live AND the render body stays pure — the React Compiler purity lint forbids
  // reading the clock (Date.now) directly in render (same pattern as UnixTimeTool).
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const decoded = decodeJwt(raw);
  const claims = decoded.kind === "ok" ? claimViews(decoded.payload, nowMs) : [];

  function handleChange(next: string) {
    const start = performance.now();
    setRaw(next);
    setTimingMs(next.trim() === "" ? undefined : performance.now() - start);
  }

  const error = decoded.kind === "error" ? decoded : null;
  const parseState: ParseState =
    decoded.kind === "error" ? "error" : decoded.kind === "empty" ? "empty" : "ok";

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-auto p-4">
        <section className="flex min-w-0 flex-col gap-2">
          <label
            htmlFor="jwt-input"
            className="text-[12px] font-semibold uppercase tracking-wide text-tx-2"
          >
            JWT
          </label>
          <textarea
            id="jwt-input"
            value={raw}
            onChange={(e) => handleChange(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.…"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "jwt-input-error" : undefined}
            className="min-h-[96px] w-full resize-y rounded-lg border border-bd bg-input-bg p-3 font-mono text-[13px] text-tx outline-none transition-colors focus-visible:border-accent-line focus-visible:ring-2 focus-visible:ring-accent"
          />
          {error ? (
            <p
              id="jwt-input-error"
              aria-live="polite"
              className="text-[12px] text-bad"
            >
              <span className="font-semibold uppercase">{error.scope}:</span>{" "}
              {error.message}
            </p>
          ) : null}
        </section>

        {decoded.kind === "ok" ? (
          <div className="flex min-w-0 flex-col gap-4">
            {/* alg surfaced from the header (D-07). */}
            <div className="flex items-center gap-2 text-[12px] text-tx-2">
              <span className="font-semibold uppercase tracking-wide">Algorithm</span>
              <span id="jwt-alg" className="font-mono text-tx">
                {decoded.alg ?? "—"}
              </span>
              <span className="text-tx-3">· display-only, signature not verified</span>
            </div>

            <OutputBlock
              blockId="jwt-header"
              label="Header"
              value={JSON.stringify(decoded.header, null, 2)}
            />
            <OutputBlock
              blockId="jwt-payload"
              label="Payload"
              value={JSON.stringify(decoded.payload, null, 2)}
            />
            <OutputBlock
              blockId="jwt-signature"
              label="Signature"
              value={decoded.signature}
            />

            {/* Humanized standard claims + advisory expired / not-yet-valid flags (D-10). */}
            {claims.length > 0 ? (
              <section className="flex min-w-0 flex-col gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-tx-2">
                  Claims
                </span>
                <div className="flex min-w-0 flex-col gap-2">
                  {claims.map((c) => (
                    <div
                      key={c.claim}
                      id={`jwt-claim-${c.claim}`}
                      className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-bd bg-input-bg px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-tx-2">
                          {c.label}
                        </span>
                        {c.flag ? (
                          <span
                            className="rounded-[5px] border border-bad/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-bad"
                            role="status"
                          >
                            {c.flag}
                          </span>
                        ) : null}
                      </div>
                      <span className="font-mono text-[13px] text-tx">{c.absolute}</span>
                      {c.relative ? (
                        <span className="text-[12px] text-tx-2">{c.relative}</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
      <StatusBar
        parseState={parseState}
        byteCount={0}
        error={error ? error.message : null}
        timingMs={timingMs}
      />
    </div>
  );
}
