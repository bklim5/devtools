// The Cron tool (CRON-01..11; the 12th registry-driven tool / 6th and final of
// v1.3). ONE combined scrolling view, NO mode switch and NO Parse/Compute button
// — the description + next 5 runs recompute LIVE on every keystroke (the project's
// paste-instant wedge). A thin, layout-agnostic presentation layer over the pure
// `analyzeCron` core (src/lib/cron/cron.ts, Plans 01–03); all scheduling/DST math
// lives there, this file only renders the discriminated CronResult.
//
// XSS discipline (T-15-09): the description headline and every run label are
// user-influenced text rendered ONLY as escaped React children — NO
// dangerouslySetInnerHTML anywhere in this directory (absence-grep enforced, same
// as Regex/URL). Copy goes through the platform.clipboard seam ONLY (never the
// Tauri APIs directly). DoS (T-15-10): analyzeCron is bounded by the Plan-02
// CANDIDATE_DAY_CAP, so the synchronous useMemo can never hang.
import { useMemo, useState } from "react";
import { platform } from "@/lib/platform";
import { useCopyFeedback } from "@/shell/useCopyFeedback";
import { analyzeCron } from "@/lib/cron/cron";
import { relativeTime } from "@/lib/timeFormat";

/** A visible, focusable copy button (no hover gate — CLAUDE.md). Writes through the seam. */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, confirmCopy] = useCopyFeedback();
  function handleCopy() {
    void platform.clipboard.writeText(value);
    confirmCopy();
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label}
      className={[
        "flex shrink-0 items-center gap-1 rounded-[6px] border bg-input-bg px-1.5 py-0.5 text-[11px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
        copied
          ? "border-accent-line text-accent"
          : "border-bd text-tx-2 hover:border-bd-2 hover:text-tx",
      ].join(" ")}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

const LABEL_CLASS =
  "text-[12px] font-semibold uppercase tracking-wide text-tx-2";

export default function CronTool() {
  const [expr, setExpr] = useState("");

  // System zone only (locked — no picker). Resolved once; the core formats every
  // run label into this zone (24-hour, hourCycle:"h23").
  const zone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  );

  // Paste-instant: freeze ONE `now` per [expr, zone] compute and reuse it for both
  // the run instants AND the relative captions, so the absolute run labels and the
  // "in N minutes" lines stay consistent across unrelated re-renders (MD-02).
  // analyzeCron is pure + bounded so this is cheap and never hangs.
  const { result, now } = useMemo(() => {
    const n = new Date();
    return { result: analyzeCron(expr, n, zone), now: n.getTime() };
  }, [expr, zone]);

  const isError = result.kind === "error";

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-auto p-4">
        {/* CRON EXPRESSION INPUT (CRON-01..04) — paste-instant, no button. */}
        <section className="flex min-w-0 flex-col gap-2">
          <label htmlFor="cron-expression" className={LABEL_CLASS}>
            Cron expression
          </label>
          <input
            id="cron-expression"
            value={expr}
            onChange={(e) => setExpr(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            placeholder="0 9 * * 1-5   ·   @daily   ·   0 0 L * *"
            aria-invalid={isError ? true : undefined}
            className="w-full rounded-lg border border-bd bg-input-bg p-3 font-mono text-[13px] text-tx outline-none transition-colors focus-visible:border-accent-line focus-visible:ring-2 focus-visible:ring-accent"
          />
        </section>

        {/* EMPTY STATE — neutral hint, NOT an error (no role=alert). */}
        {result.kind === "empty" && (
          <p className="text-[12px] text-tx-3">
            Paste a cron expression to see its description and next 5 run times.
          </p>
        )}

        {/* ERROR STATE (CRON-11 + the W/#/LW reject) — inline role=alert, the
            description + run list suppressed; aria-invalid on the input above. */}
        {result.kind === "error" && (
          <p role="alert" className="text-[12px] text-bad">
            {result.message}
          </p>
        )}

        {/* DESCRIPTION HEADLINE (CRON-01/03) — rendered for scheduled / never /
            reboot (each supplies its own description); escaped React text. */}
        {(result.kind === "scheduled" ||
          result.kind === "never" ||
          result.kind === "reboot") && (
          <section className="flex min-w-0 flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className={LABEL_CLASS}>Description</span>
              <CopyButton
                value={result.description}
                label="Copy description"
              />
            </div>
            <h2 className="text-[16px] font-semibold leading-[1.3] text-tx">
              {result.description}
            </h2>
          </section>
        )}

        {/* @reboot (CRON-09) — NEUTRAL banner, NO run list, NO zone caption. */}
        {result.kind === "reboot" && (
          <p className="text-[12px] text-tx-2">
            No scheduled runs — <code className="font-mono">@reboot</code> fires
            only on startup, so there is no upcoming time to compute.
          </p>
        )}

        {/* NEVER (CRON-08) — calm, NON-error "no upcoming runs" line under the
            NEXT RUNS heading; the description still shows above. */}
        {result.kind === "never" && (
          <section className="flex min-w-0 flex-col gap-2">
            <h3 className={LABEL_CLASS}>Next runs</h3>
            <p className="text-[12px] text-tx-3">
              No upcoming runs in the next 5 years — this expression may never
              fire (e.g. February 30).
            </p>
          </section>
        )}

        {/* SCHEDULED (CRON-05/06/07/10) — NEXT RUNS (5) heading + zone caption +
            5 labeled rows (ordinal neutral, mono 24-hour datetime, relative
            caption, visible copy button). */}
        {result.kind === "scheduled" && (
          <section className="flex min-w-0 flex-col gap-2">
            <h3 className={LABEL_CLASS}>Next runs ({result.runs.length})</h3>
            <p className="text-[12px] text-tx-3">Local time · {zone}</p>
            <div className="flex min-w-0 flex-col gap-2">
              {result.runs.map((run, i) => (
                <div
                  key={`${run.date.getTime()}-${i}`}
                  data-run-row
                  className="flex items-center justify-between gap-3 rounded-lg border border-bd bg-input-bg px-3 py-2"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex min-w-0 items-baseline gap-2">
                      {/* Ordinal is NEUTRAL (enumeration, not selection) — never accent. */}
                      <span className="shrink-0 font-mono text-[11px] text-tx-3">
                        #{i + 1}
                      </span>
                      <span className="min-w-0 break-all font-mono text-[13px] text-tx">
                        {run.label}
                      </span>
                    </div>
                    <span className="text-[12px] text-tx-3">
                      {relativeTime(run.date.getTime(), now)}
                    </span>
                  </div>
                  <CopyButton value={run.label} label={`Copy run ${i + 1}`} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
