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

/** Neutral empty state — a successful format of nothing (stable ref so an empty
 *  input never churns a re-render). Returned whenever the input is blank. */
const EMPTY_OK: FormatResult = {
  ok: true,
  output: "",
  inputBytes: 0,
  outputBytes: 0,
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
 * - A stale resolve (`id !== reqIdRef.current`) is dropped — the ordering guarantee.
 *
 * `opts` is compared by identity — callers pass primitives or a memoized object.
 */
export function useAsyncFormat<O>(
  input: string,
  opts: O,
  runner: (input: string, opts: O) => Promise<FormatResult>,
): { result: FormatResult; pending: boolean } {
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

  const isEmpty = input.trim() === "";

  // Adjust state during render (React's documented pattern) — a blank input clears
  // any stale `pending` from a run that was dropped, so it never lingers true. The
  // `pending` guard makes this a one-shot, not a render loop.
  if (isEmpty && pending) setPending(false);

  useEffect(() => {
    // Empty/whitespace is the neutral state; the prior render's cleanup already
    // bumped the reqId (dropping any in-flight resolve), so just don't run.
    if (isEmpty) return;

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
  }, [isEmpty, input, opts]);

  return { result: isEmpty ? EMPTY_OK : resolved, pending };
}
