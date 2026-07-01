// The shared latest-wins async formatting hook (PRT-03). Every consuming tool
// (P33 HTML, P34 JS/TS, and the retrofitted JSON/XML if they ever go async) runs
// its formatter through this hook so a slow, stale result can never clobber newer
// output. It isolates the async plumbing — debounce, a monotonic request-id gate,
// and a pending flag — so tool components stay as thin as the sync ones.
//
// This is the REGEX tool's cancellation discipline (`src/tools/regex/RegexTool.tsx`:
// a monotonic `reqIdRef`, a debounce timer, an on-resolve `if (id !==
// reqIdRef.current) return` stale-drop, and a cleanup that bumps the id + clears
// the timer) MINUS the off-thread machinery (no background thread, no kill-switch,
// no watchdog). Prettier/esbuild parse is linear and freeze-free on typical pastes
// (ARCHITECTURE.md §3 — off-threading buys nothing for the common case and
// complicates the single shared lazy chunk), so the runner is a plain async
// function, not an interruptible off-thread job.
//
// The empty state and the pending flag are DERIVED / reset during render rather
// than set from inside the effect: a synchronous setState in an effect is the
// cascading-render smell the regex tool also avoids (it derives its neutral state
// from the inputs). Only the async run's own resolve/reject — which happen in
// timer/promise callbacks, not directly in the effect body — call setState.
import { useEffect, useRef, useState } from "react";
import type { FormatResult } from "@/lib/format/types";

/**
 * Keystroke debounce before the (potentially chunk-loading) formatter runs.
 * 180ms sits in the D-02 150–200ms window — long enough to coalesce fast typing
 * into one run, short enough to keep the paste-instant feel. The latest-wins
 * reqId gate below protects ordering INDEPENDENTLY of this value (D-02): a stale
 * resolve is dropped even when the debounce coalesced nothing.
 */
export const DEBOUNCE_MS = 180;

/**
 * Hard input-size cap (SC6 / PRT-04): 2 MB UTF-8 (D-02). Comfortably covers real
 * pasted HTML (~200–500 KB) while keeping the worst-case 4-plugin Prettier-with-
 * embedded-code parse well under the <2s paste-instant promise; messaged to the
 * user as "2 MB". A paste over this never enters the (chunk-loading, synchronous
 * main-thread) engine path, so a multi-MB blob can't freeze the UI.
 */
export const MAX_FORMAT_INPUT_BYTES = 2_000_000;

/**
 * Bounded UTF-8 byte length: returns the exact byte count when it is <= max, or
 * null (over-cap) the instant the running total exceeds max — never allocating/
 * encoding the whole string. Work is O(min(n, max)), bounded by the cap, not the
 * input length. This is the DoS-safe replacement for byteLen() (a full
 * TextEncoder.encode) AND for an input.length pre-check (which is UTF-16 code
 * units and wrongly passes a multibyte over-cap input).
 *
 * Byte-for-byte identical to TextEncoder for ALL inputs: it consumes the next code
 * unit ONLY for a genuine surrogate PAIR (a supplementary code point = 4 bytes); a
 * lone/unpaired high OR low surrogate is 3 bytes (TextEncoder emits U+FFFD) and does
 * NOT swallow the following unit. The naive "every high surrogate ⇒ 4 bytes + i++"
 * under-counts "\uD800€" as 4 bytes and drops the €, letting a crafted malformed
 * paste under-report and slip past the cap into the runner (a guard BYPASS).
 */
function utf8LenBounded(s: string, max: number): number | null {
  let bytes = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (
      c >= 0xd800 &&
      c <= 0xdbff && // high surrogate …
      i + 1 < s.length &&
      s.charCodeAt(i + 1) >= 0xdc00 && // … immediately followed by a
      s.charCodeAt(i + 1) <= 0xdfff // genuine LOW surrogate → a real pair
    ) {
      bytes += 4; // valid surrogate PAIR = one supplementary code point (4 UTF-8 bytes)
      i++; // consume the paired low surrogate ONLY when it is actually there
    } else {
      bytes += 3; // BMP char OR unpaired/lone surrogate → 3 bytes (matches TextEncoder U+FFFD)
    }
    if (bytes > max) return null; // over-cap: bail immediately, no full encode
  }
  return bytes;
}

/** Neutral empty state — a successful format of nothing (stable ref so an empty
 *  input never churns a re-render). Returned whenever the input is blank. */
const EMPTY_OK: FormatResult = {
  ok: true,
  output: "",
  inputBytes: 0,
  outputBytes: 0,
};

/** Stable over-cap rejection (mirrors the EMPTY_OK stable-ref pattern so an
 *  over-cap render never churns a new object). A SINGLE static message — with a
 *  bounded counter the exact over-cap byte count is deliberately never computed,
 *  so it says "> 2 MB", not an exact "X.X MB" (D-01/D-02). */
const OVERSIZE_RESULT: FormatResult = {
  ok: false,
  error: { message: "Input too large (> 2 MB) — 2 MB max" },
};

/**
 * Run `runner(input, opts)` asynchronously with a debounce + a latest-wins guard.
 *
 * - Debounces `input`/`opts` changes by {@link DEBOUNCE_MS}, then runs. `runner` is
 *   read from a ref (see below), so its identity never resets the debounce.
 * - `pending` is true from when a debounced run starts until its result is applied.
 * - The previously-resolved `result` stays readable while `pending` (no blank flash).
 * - Empty/whitespace input returns {@link EMPTY_OK}, clears `pending`, and bumps the
 *   reqId so any in-flight resolve is dropped; the runner is never called for empty.
 * - Over-cap input (> `maxInputBytes` UTF-8, default {@link MAX_FORMAT_INPUT_BYTES})
 *   short-circuits to {@link OVERSIZE_RESULT} BEFORE the debounce/runner — a
 *   multi-MB paste never enters the engine path (SC6). Oversize is detected by
 *   {@link utf8LenBounded}, which bails the instant the running byte total exceeds
 *   the cap, so the pathological paste is NEVER fully encoded just to measure it
 *   (ASCII, multibyte, AND malformed-surrogate alike).
 * - A stale resolve (`id !== reqIdRef.current`) is dropped — the ordering guarantee.
 *
 * Returns `inputBytes` alongside so a consuming tool reads the input size straight
 * from the hook and NEVER recomputes `byteLen(input)`: `0` when empty · `undefined`
 * when over-cap (deliberately unmeasured — the bounded counter returned null
 * without a full encode) · the engine's `inputBytes` when the result is ok · the
 * bounded exact count when under-cap but the result is an error.
 *
 * `opts` is compared by identity — callers pass primitives or a memoized object.
 */
export function useAsyncFormat<O>(
  input: string,
  opts: O,
  runner: (input: string, opts: O) => Promise<FormatResult>,
  maxInputBytes: number = MAX_FORMAT_INPUT_BYTES,
): {
  result: FormatResult;
  pending: boolean;
  inputBytes: number | undefined;
  isEmpty: boolean;
} {
  const [resolved, setResolved] = useState<FormatResult>(EMPTY_OK);
  const [pending, setPending] = useState(false);

  const reqIdRef = useRef(0);

  // The runner is read from a ref, not an effect dep: a tool that passes an inline
  // `(i, o) => formatX(i, o)` (the natural call shape) would otherwise give the
  // effect a fresh identity every render, resetting the debounce timer forever so
  // the format never fires. A per-tool runner is effectively constant, so reading
  // the latest from a ref at call time is both safe and thrash-proof. The ref is
  // synced in a commit effect (the latest-ref pattern — writing it during render
  // is forbidden), which always lands before the 180ms debounce timer fires.
  const runnerRef = useRef(runner);
  useEffect(() => {
    runnerRef.current = runner;
  });

  // Bounded byte scan FIRST — returns null (over-cap) the instant the running total
  // crosses the cap, so an oversize paste is NEVER fully scanned just to be measured
  // (the load-bearing DoS fix). This MUST run before any full-string whitespace
  // check: `input.trim()` scans the entire leading-whitespace run, which for an
  // all-whitespace blob is the WHOLE payload — an unbounded scan on the exact large-
  // paste path the guard exists to protect. Scanning bytes first lets an over-cap
  // all-whitespace paste be classified oversize (not empty) without ever trimming it.
  const measured = utf8LenBounded(input, maxInputBytes);
  const isOversize = measured === null; // counter bailed → over-cap, no full scan
  const exactBytes = measured === null ? undefined : measured; // exact count when under-cap

  // Empty/whitespace neutral state — computed ONLY once the input is known under-cap,
  // so the bounded `trim()` scan runs on a <= cap string. An over-cap all-whitespace
  // paste short-circuits to oversize above and never reaches this trim.
  const isEmpty = !isOversize && input.trim() === "";

  // Adjust state during render (React's documented pattern) — a blank or oversize
  // input clears any stale `pending` from a run that was dropped, so it never
  // lingers true. The `pending` guard makes this a one-shot, not a render loop.
  if ((isEmpty || isOversize) && pending) setPending(false);

  useEffect(() => {
    // Empty/whitespace is the neutral state and oversize is a hard reject; the
    // prior render's cleanup already bumped the reqId (dropping any in-flight
    // resolve), so in either case just don't run.
    if (isEmpty || isOversize) return;

    const timer = setTimeout(() => {
      const id = ++reqIdRef.current;
      setPending(true);
      runnerRef.current(input, opts)
        .then((r) => {
          if (id !== reqIdRef.current) return; // stale — a newer run superseded it
          setPending(false);
          setResolved(r);
        })
        .catch(() => {
          if (id !== reqIdRef.current) return;
          // The runner is total (error-as-value); this catch is defence-in-depth.
          // Keep the last-good result visible; just clear pending.
          setPending(false);
        });
    }, DEBOUNCE_MS);

    // Runs before every re-run AND on unmount: cancel the pending debounce and
    // bump the reqId so any in-flight/late resolve is dropped (no setState after
    // unmount, and the newer run always wins).
    return () => {
      clearTimeout(timer);
      // Intentionally the LATEST reqId at cleanup time (a counter, not a DOM-node
      // ref) — bumping it supersedes any in-flight run so a late resolve is dropped.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      reqIdRef.current++;
    };
  }, [isEmpty, isOversize, input, opts]);

  // The size metadata a consuming tool reads INSTEAD of recomputing byteLen(input).
  // Over-cap is deliberately `undefined` — the ONE place that would otherwise
  // re-encode a multi-MB string at the tool seam is eliminated by construction.
  const inputBytes: number | undefined = isEmpty
    ? 0
    : isOversize
      ? undefined // over-cap: deliberately unmeasured — the tool must NOT re-encode
      : resolved.ok
        ? resolved.inputBytes // engine-provided count (last-good during pending)
        : exactBytes; // under-cap error: exact count from the bounded counter

  return {
    result: isEmpty ? EMPTY_OK : isOversize ? OVERSIZE_RESULT : resolved,
    pending,
    inputBytes,
    // Emptiness derived from the bounded-first ordering above — a consuming tool
    // reads this INSTEAD of re-running input.trim() on the raw value, so an over-cap
    // all-whitespace paste is never full-scanned at the tool seam either (an
    // over-cap payload is oversize, so isEmpty is false without touching trim).
    isEmpty,
  };
}
