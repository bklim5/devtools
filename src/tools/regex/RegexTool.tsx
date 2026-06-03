// The Regex tester (RGX-01..07, D-01..D-15; the 11th registry-driven tool). ONE
// combined scrolling view, no mode switch (D-04): library chips → pattern + flag
// toggles → sample-text overlay editor → matches + capture-group breakdown →
// replace + preview, all live at once (paste-instant useMemo/effect).
//
// SAFETY IS STRUCTURAL, not heuristic — the two hostile inputs are handled by
// construction:
//   • ReDoS (the pattern is the threat): matching runs OFF-THREAD in a Web Worker
//     (src/lib/regex/worker.ts). A synchronous catastrophic-backtracking RegExp
//     CANNOT be cooperatively interrupted — `worker.terminate()` is the ONLY kill
//     (RESEARCH/VERIFIED). This view owns the terminate-on-timeout watchdog +
//     eager respawn + request-id gating (drops stale replies); it renders a
//     `timedOut` state the pure core never returns (D-15).
//   • XSS (the match text is the threat): the highlight backdrop is built by
//     slicing the text into matched/unmatched segments rendered as React text
//     CHILDREN (<span>{seg}</span> / <mark>{seg}</mark>) — NO HTML string is ever
//     constructed, and the raw-inner-HTML React escape hatch is never used
//     anywhere in this directory (D-03; an absence-grep enforces that literally).
//
// Copy goes through the platform clipboard seam ONLY (never the Tauri APIs
// directly). The
// worker is spawned via `new Worker(new URL("../../lib/regex/worker.ts",
// import.meta.url), { type: "module" })` — a same-origin Vite chunk that passes
// `script-src 'self'` with no CSP change (the relative literal, NOT the `@/`
// alias, so Vite's import.meta.url worker detection bundles it). Layout-agnostic:
// responsive Tailwind, min-w-0, no fixed widths.
import { useEffect, useMemo, useRef, useState } from "react";
import { platform } from "@/lib/platform";
import { useCopyFeedback } from "@/shell/useCopyFeedback";
import {
  COMMON_PATTERNS,
  type RegexMatch,
  type RegexRequest,
  type RegexResult,
} from "@/lib/regex/regex";

/** D-15 / RESEARCH Open Decision 3 — start at 1s, tuned at the real-WKWebView gate. */
const TIMEOUT_MS = 1000;
/** Small debounce before posting (RESEARCH Open Decision 2). Distinct from the locked
 *  "no debounce instead of a worker" — id-gating still guarantees correctness. */
const DEBOUNCE_MS = 80;

/** The five toggleable flags in fixed order (D-06). */
const FLAGS = ["g", "i", "m", "s", "u"] as const;
type Flag = (typeof FLAGS)[number];

/**
 * The EXACT box metrics shared by the overlay backdrop <div> and the editable
 * <textarea> (D-01/D-02). They MUST be byte-for-byte identical — font, size,
 * line-height, letter-spacing, padding, border width, and wrapping — or the
 * highlight backdrop drifts out from under the caret/characters (the human-review
 * round-1 desync bug). `tracking-normal` pins letter-spacing on BOTH (a textarea
 * and a div can otherwise inherit different defaults), `border` (1px) matches the
 * textarea's visible border so text starts at the same x, and `whitespace-pre-wrap
 * break-words` makes the backdrop wrap exactly like the textarea. NO `resize` on the
 * textarea (a user-resized textarea would desync from the inset-0 backdrop), so the
 * editor uses a fixed, generous min-height instead.
 */
const EDITOR_BOX =
  "whitespace-pre-wrap break-words rounded-lg border p-3 font-mono text-[13px] leading-[1.5] tracking-normal";

const FLAG_LABEL: Record<Flag, string> = {
  g: "Toggle global flag (g)",
  i: "Toggle case-insensitive flag (i)",
  m: "Toggle multiline flag (m)",
  s: "Toggle dotAll flag (s)",
  u: "Toggle unicode flag (u)",
};

/** The view's result: the pure-core RegexResult plus the watchdog-only timedOut state. */
type ViewResult = RegexResult | { timedOut: true };

function makeWorker(): Worker {
  // Relative literal (NOT the `@/` alias) so Vite's import.meta.url worker
  // detection bundles the same-origin chunk; passes script-src 'self' (no CSP change).
  return new Worker(new URL("../../lib/regex/worker.ts", import.meta.url), {
    type: "module",
  });
}

/** A visible, focusable copy button (no hover gate, D-08). Writes through the seam. */
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

/**
 * The XSS-safe highlight backdrop (D-03 / RESEARCH §overlay). Slices `text` into
 * alternating unmatched/matched segments rendered as React text children — never an
 * HTML string, never the raw-inner-HTML escape hatch. With no matches it renders the raw
 * text as a single escaped <span> so the editor still shows the text (and the
 * escaped-render invariant holds). A trailing "\n" gets a zero-width guard so the
 * backdrop's last line height matches the textarea's.
 */
function Highlighted({
  text,
  matches,
}: {
  text: string;
  matches: RegexMatch[];
}) {
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  matches.forEach((m, i) => {
    if (m.index > cursor) {
      parts.push(<span key={`u${i}`}>{text.slice(cursor, m.index)}</span>);
    }
    // A zero-length match has nothing to wrap; skip drawing an empty <mark>.
    if (m.length > 0) {
      parts.push(
        <mark
          key={`m${i}`}
          className="rounded-[2px] bg-accent-soft text-accent"
        >
          {text.slice(m.index, m.index + m.length)}
        </mark>,
      );
    }
    cursor = Math.max(cursor, m.index + m.length);
  });
  if (cursor < text.length) {
    parts.push(<span key="tail">{text.slice(cursor)}</span>);
  }
  // Keep the final newline visible so backdrop/textarea heights stay in lockstep.
  parts.push(<span key="nl">{"​"}</span>);
  return <>{parts}</>;
}

export default function RegexTool() {
  const [pattern, setPattern] = useState("");
  const [text, setText] = useState("");
  const [replace, setReplace] = useState("");
  const [flags, setFlags] = useState<Set<Flag>>(() => new Set<Flag>(["g"]));
  const [result, setResult] = useState<ViewResult>({ empty: true });

  const workerRef = useRef<Worker | null>(null);
  const reqIdRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const backdropContentRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const flagString = useMemo(
    () => FLAGS.filter((f) => flags.has(f)).join(""),
    [flags],
  );

  // Empty pattern OR empty text is the neutral empty state (D-13), derived from the
  // inputs — never set in the effect (synchronous setState in an effect is a
  // cascading-render smell). When empty we don't post to the worker and ignore any
  // in-flight reply via the id-gate.
  const isEmpty = pattern === "" || text === "";

  // Live match run: when non-empty, debounce, then post with a fresh request id; a
  // setTimeout watchdog races the reply (terminate + respawn on timeout), and
  // id-gating drops stale replies (RESEARCH Pattern 1).
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);

    if (isEmpty) {
      // Bump the id so any in-flight reply for the now-cleared input is dropped.
      reqIdRef.current++;
      return;
    }

    const req: RegexRequest = {
      id: 0, // stamped below
      source: pattern,
      flags: flagString,
      text,
      replace: replace === "" ? undefined : replace,
    };

    debounceRef.current = setTimeout(() => {
      const id = ++reqIdRef.current;

      // Arm the watchdog FIRST, before touching the Worker — so even a worker
      // CONSTRUCTION failure (e.g. the chunk 404s under tauri.localhost, A1) still
      // surfaces the timeout state instead of silently never resolving. The timer
      // is the single source of "this run did not finish in time".
      timerRef.current = setTimeout(() => {
        workerRef.current?.terminate(); // the ONLY kill for a sync catastrophic regex
        workerRef.current = null; // drop the wedged worker; lazily respawn next run
        if (id === reqIdRef.current) setResult({ timedOut: true }); // D-15
      }, TIMEOUT_MS);

      try {
        const worker =
          workerRef.current ?? (workerRef.current = makeWorker());

        worker.onmessage = (e: MessageEvent<{ id: number } & RegexResult>) => {
          if (e.data.id !== reqIdRef.current) return; // drop stale replies
          if (timerRef.current) clearTimeout(timerRef.current);
          const { id: replyId, ...rest } = e.data;
          void replyId;
          setResult(rest as RegexResult);
        };

        worker.postMessage({ ...req, id });
      } catch {
        // Worker construction/post failed synchronously — let the already-armed
        // watchdog render the timeout state (the worker chunk is unreachable).
        workerRef.current = null;
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [isEmpty, pattern, text, replace, flagString]);

  // Terminate the worker + clear timers on unmount.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  function toggleFlag(f: Flag) {
    setFlags((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  }

  function insertPattern(source: string, patFlags: string) {
    setPattern(source); // OVERWRITE, no confirm (D-11)
    setFlags(new Set(patFlags.split("").filter((c): c is Flag =>
      (FLAGS as readonly string[]).includes(c),
    )));
  }

  // Mirror the textarea's scroll position onto the backdrop so the highlight
  // <mark>s stay EXACTLY under the matched characters/caret (D-02 — the load-bearing
  // overlay alignment). The backdrop is `overflow-hidden` (so it CANNOT be given a
  // non-zero scrollTop/scrollLeft — the browser clamps those to 0 on a clipped box,
  // which was the human-review desync bug). Instead we TRANSLATE the backdrop's inner
  // content by the negative scroll offsets — a layout-independent technique that
  // tracks BOTH axes regardless of overflow. Pulled out of the JSX handler so it's
  // unit-testable: pass the live scroll offsets and the content element.
  function applyScrollSync(
    source: { scrollTop: number; scrollLeft: number },
    content: HTMLElement | null,
  ): void {
    if (!content) return;
    content.style.transform = `translate(${-source.scrollLeft}px, ${-source.scrollTop}px)`;
  }

  function handleScroll(e: React.UIEvent<HTMLTextAreaElement>): void {
    applyScrollSync(e.currentTarget, backdropContentRef.current);
  }

  // Re-sync after EVERY render that can change the backdrop's content/height: the
  // highlight segments (matches), the text, or the box. When the <mark> segments
  // re-render the translated content can reset, drifting it off the textarea — re-apply
  // the textarea's current scroll so they never separate (the human-review desync fix).
  useEffect(() => {
    applyScrollSync(
      textareaRef.current ?? { scrollTop: 0, scrollLeft: 0 },
      backdropContentRef.current,
    );
  });

  // When the input is empty the neutral state wins regardless of any stale worker
  // reply still in `result` (D-13). Otherwise render whatever the worker/watchdog set.
  const view: ViewResult = isEmpty ? { empty: true } : result;
  const isError = "error" in view;
  const matches = "matches" in view ? view.matches : [];

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-auto p-4">
        {/* PATTERN FIELD + FLAG TOGGLES (RGX-01/03 / D-06/07). */}
        <section className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label
              htmlFor="regex-pattern"
              className="text-[12px] font-semibold uppercase tracking-wide text-tx-2"
            >
              Pattern
            </label>
            <div
              role="group"
              aria-label="Regex flags"
              className="flex items-center gap-1 rounded-[7px] border border-bd bg-input-bg p-0.5"
            >
              {FLAGS.map((f) => {
                const active = flags.has(f);
                return (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={active}
                    aria-label={FLAG_LABEL[f]}
                    onClick={() => toggleFlag(f)}
                    className={[
                      "rounded-[5px] px-2 py-0.5 font-mono text-[12px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
                      active
                        ? "border border-accent-line bg-accent-soft text-accent"
                        : "border border-transparent text-tx-2 hover:text-tx",
                    ].join(" ")}
                  >
                    {f}
                  </button>
                );
              })}
            </div>
          </div>
          <input
            id="regex-pattern"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            placeholder="\w+ or (?<year>\d{4})-(?<month>\d{2})"
            aria-invalid={isError ? true : undefined}
            className="w-full rounded-lg border border-bd bg-input-bg p-3 font-mono text-[13px] text-tx outline-none transition-colors focus-visible:border-accent-line focus-visible:ring-2 focus-visible:ring-accent"
          />
          {/* COMMON-PATTERN CHIPS (RGX-05 / D-09/10/11) — directly UNDER the pattern
              input (human-review round 1) with a muted "Common patterns" caption so
              their purpose is clear. Neutral buttons, accent only on focus. Clicking
              overwrites the pattern + flags, no confirm. */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-tx-3">Common patterns</span>
            <div
              role="group"
              aria-label="Insert a common pattern"
              className="flex flex-wrap items-center gap-2"
            >
              {COMMON_PATTERNS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => insertPattern(p.source, p.flags)}
                  title={`Insert the ${p.label} pattern`}
                  className="rounded-[7px] border border-bd bg-input-bg px-2.5 py-1 text-[11.5px] font-medium text-tx-2 outline-none transition-colors hover:border-bd-2 hover:text-tx focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* SAMPLE-TEXT OVERLAY EDITOR (RGX-01/07 / D-01/02/03) — transparent textarea
            over an escaped-React-node backdrop sharing identical font metrics. */}
        <section className="flex min-w-0 flex-col gap-2">
          <label
            htmlFor="regex-text"
            className="text-[12px] font-semibold uppercase tracking-wide text-tx-2"
          >
            Sample text
          </label>
          {/* The backdrop and textarea share EDITOR_BOX (identical metrics) so the
              highlight tracks the caret. The textarea scrolls internally
              (overflow-auto); the backdrop clips (overflow-hidden) and its INNER
              content is translate()-d by the textarea's scroll offsets (an overflow-
              hidden box can't take a non-zero scrollTop — that was the desync bug).
              resize is OFF so a user-resized textarea can't desync the inset-0
              backdrop. The inner content carries EDITOR_BOX (padding/font/wrapping) so
              it lays out identically to the textarea; the outer clip box is a bare
              border so the translated content is clipped at the same border edge. */}
          <div className="relative min-h-[220px] min-w-0">
            {/* The outer clip box is a BARE rounded box (overflow-hidden, NO border) so
                the inner content's single 1px transparent border (from EDITOR_BOX) is
                the ONLY border on the backdrop — matching the textarea's single border
                EXACTLY. A border on this outer box too would offset + narrow the backdrop
                text box by 2px vs the textarea (measured), reintroducing a small wrap
                mismatch. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg text-tx"
            >
              <div ref={backdropContentRef} className={`${EDITOR_BOX} border-transparent`}>
                <Highlighted text={text} matches={matches} />
              </div>
            </div>
            <textarea
              ref={textareaRef}
              id="regex-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onScroll={handleScroll}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              placeholder="Paste sample text to match against…"
              // `no-scrollbar` makes the textarea's scrollbar take ZERO layout width
              // (src/index.css) so its text content box is the SAME width as the
              // backdrop's and the two layers wrap at the SAME column. Without it, on a
              // mac with "Show scroll bars: Always" the ~14px scrollbar narrows ONLY the
              // textarea, so it wraps lines earlier than the backdrop and the <mark>s
              // drift one line lower per wrap (the accumulating-drift bug — measured
              // textarea.clientWidth 1182 vs backdrop 1194 on the real WKWebView).
              className={`no-scrollbar absolute inset-0 h-full w-full resize-none overflow-auto border-bd bg-transparent text-transparent caret-tx outline-none transition-colors focus-visible:border-accent-line focus-visible:ring-2 focus-visible:ring-accent ${EDITOR_BOX}`}
            />
          </div>
        </section>

        {/* MATCHES + CAPTURE-GROUP BREAKDOWN (RGX-01/02 / D-08/13/14/15). */}
        <section className="flex min-w-0 flex-col gap-2">
          <h2 className="text-[12px] font-semibold uppercase tracking-wide text-tx-2">
            Matches ({matches.length})
          </h2>
          {"empty" in view ? (
            <p className="text-[12px] text-tx-3">
              Enter a pattern and some sample text to see live matches.
            </p>
          ) : "timedOut" in view ? (
            <p role="alert" className="text-[12px] text-bad">
              Pattern timed out — it may cause catastrophic backtracking. Try
              simplifying it.
            </p>
          ) : isError ? (
            <p role="alert" className="text-[12px] text-bad">
              {view.error}
            </p>
          ) : matches.length === 0 ? (
            <p className="text-[12px] text-tx-3">No matches.</p>
          ) : (
            <div className="flex min-w-0 flex-col gap-2">
              {matches.map((m, i) => (
                <div
                  key={`${m.index}-${i}`}
                  data-match-row
                  className="flex min-w-0 flex-col gap-1 rounded-md border border-bd bg-input-bg/40 p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="break-all font-mono text-[13px] text-tx">
                      {m.full}
                    </span>
                    <span className="shrink-0 text-[11px] text-tx-3">
                      @ {m.index}
                    </span>
                  </div>
                  {(m.groups.length > 0 ||
                    Object.keys(m.named).length > 0) && (
                    <div className="flex min-w-0 flex-col gap-1 pl-4">
                      {m.groups.map((g, gi) => (
                        <div
                          key={`g${gi}`}
                          className="flex min-w-0 items-center gap-2"
                        >
                          <span className="shrink-0 font-mono text-[11px] text-tx-3">
                            ${gi + 1}
                          </span>
                          {g === undefined ? (
                            <span className="font-mono text-[12px] text-tx-3">
                              —
                            </span>
                          ) : (
                            <>
                              <span className="min-w-0 flex-1 break-all font-mono text-[12px] text-tx">
                                {g}
                              </span>
                              <CopyButton value={g} label={`Copy group ${gi + 1}`} />
                            </>
                          )}
                        </div>
                      ))}
                      {Object.entries(m.named).map(([name, val]) => (
                        <div
                          key={`n${name}`}
                          className="flex min-w-0 items-center gap-2"
                        >
                          <span className="shrink-0 font-mono text-[11px] text-tx-2">
                            {name}
                          </span>
                          <span className="text-tx-3" aria-hidden="true">
                            →
                          </span>
                          {val === undefined ? (
                            <span className="font-mono text-[12px] text-tx-3">
                              —
                            </span>
                          ) : (
                            <>
                              <span className="min-w-0 flex-1 break-all font-mono text-[12px] text-tx">
                                {val}
                              </span>
                              <CopyButton
                                value={val}
                                label={`Copy group ${name}`}
                              />
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* REPLACE + RESULT (RGX-04 / D-04/05) — the Result pane (the replaced output)
            is hidden until the replace field is non-empty. The label + helper caption
            make the Pattern → Matches → Replace → Result flow explicit (human-review
            round 1: users couldn't tell the Replace field replaced the matches, nor
            where the output was). */}
        <section className="flex min-w-0 flex-col gap-2">
          <label
            htmlFor="regex-replace"
            className="text-[12px] font-semibold uppercase tracking-wide text-tx-2"
          >
            Replace
          </label>
          <p id="regex-replace-help" className="text-[12px] text-tx-3">
            Replacement applied to each match. Use $1, $&lt;name&gt; and $&amp; to
            reference captured groups.
          </p>
          <input
            id="regex-replace"
            value={replace}
            onChange={(e) => setReplace(e.target.value)}
            aria-describedby="regex-replace-help"
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            placeholder="$1 $2 or $<name> or $&"
            className="w-full rounded-lg border border-bd bg-input-bg p-3 font-mono text-[13px] text-tx outline-none transition-colors focus-visible:border-accent-line focus-visible:ring-2 focus-visible:ring-accent"
          />
          {replace !== "" && (
            <div className="mt-1 flex min-w-0 flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-tx-2">
                  Result
                </span>
                {"replaced" in view && view.replaced !== undefined ? (
                  <CopyButton value={view.replaced} label="Copy result" />
                ) : null}
              </div>
              <p className="text-[11px] text-tx-3">
                The sample text with every match replaced.
              </p>
              <div
                id="regex-preview"
                className="min-h-[44px] w-full whitespace-pre-wrap break-words rounded-lg border border-bd bg-input-bg p-3 font-mono text-[13px] text-tx"
              >
                {"replaced" in view && view.replaced !== undefined ? (
                  view.replaced
                ) : (
                  <span className="text-tx-3">—</span>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
