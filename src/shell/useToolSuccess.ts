// The ONE shared settled-success seam (UP5-01).
//
// This is the ONLY place a successful tool use is counted. Tools never import
// or call `./reviewPrompt` — they make a single
// `useToolSuccess(id, ok, identityInput)` call and hold zero counting logic.
//
// IDENTITY KEYS ON THE INPUT, NOT THE OUTPUT (review remediation). An episode is
// "the user submitted THIS source to THIS tool", so `identityInput` is the raw
// text the user pasted/typed — never the rendered output. Keying on the output
// made every VIEW change a new episode: a Protobuf LEN-chip click, a formatter
// indent/width/semi toggle, or a regex flag flip all re-serialize the same work
// into different text and would each have counted again. Those are ways of
// LOOKING at one result, not new results. Keying on the input also means no call
// site has to build (and re-allocate) a serialization just for this seam — every
// site passes a string it already holds in state.
//
// WHAT IS EXCLUDED, by construction: errors, empty input, an async format still
// pending, and plain navigation all arrive as `ok === false`, so they can never
// start a success episode. A collision or an over-broad identity can only
// UNDERCOUNT — it can never fire the prompt early.
//
// WHAT "SETTLED" MEANS: a successful (tool, input) pair must sit UNCHANGED for
// SETTLE_MS before it counts. That quiet window IS the "natural pause" the review
// request rides on (UP5-02) — mid-paste and mid-typing keystrokes restart it, so
// the OS sheet can never land on top of someone still working.
//
// CHANNEL GATE: `notifySettledSuccess` is selected at MODULE SCOPE from the
// build constant IS_APPSTORE, as a ternary between a dynamic import and a no-op —
// the same shape src/components/ToolRoute.tsx uses. A plain static import behind a
// runtime `if` keeps BOTH arms in the bundle; this form lets Rollup drop the dead
// arm, so `./reviewPrompt` is statically unreachable in the DIRECT build and the
// fold-in guard passes. If that guard ever REDs on the direct build (Rollup
// keeping the async chunk), the fix is to strengthen this arm selection — NEVER
// to weaken the guard.
import { useEffect, useRef } from "react";
import { IS_APPSTORE } from "@/lib/platform/channel";
import { isTestOrDev } from "@/lib/env";

/** Milliseconds a successful (tool, input) pair must sit UNCHANGED before it
 *  counts as one settled success. This is also the "natural pause" the review
 *  request rides on — never mid-paste, never mid-typing.
 *
 *  Test/dev-overridable (see `__setSettleMsForTest`) so the real-WKWebView e2e
 *  does not have to sleep 3 s per payload; the SHIPPED value is always 3000. */
export const SETTLE_MS = 3000;

/** The live quiet-window length. Production always reads 3000 — only a test/dev
 *  build can move it, and only through the guarded seam below. */
let settleMs: number = SETTLE_MS;

/** Test/dev instrumentation is compiled in unconditionally (it is four lines),
 *  but is INERT in a release build: this constant is false there, so the counter
 *  never increments and the seams below no-op. */
const TEST_OR_DEV = isTestOrDev();

/** Test-only instrumentation: how many times fnv1a32 has run in this module
 *  instance. Exists so a test can prove the RENDER PATH does no hashing (a
 *  2 MB input re-rendered 50 times inside one quiet window must hash ZERO
 *  times, then exactly once when the window elapses). */
let hashCalls = 0;

/** TEST/DEV-ONLY. Returns -1 in a production build, where the counter is never
 *  incremented and the number would be a lie. */
export function __hashCallCountForTest(): number {
  return TEST_OR_DEV ? hashCalls : -1;
}

/** TEST/DEV-ONLY: shrink (or restore) the quiet window. No-op in a production
 *  build — the shipped app can never be talked into a shorter pause. Exposed on
 *  `window.__setSettleMsForTest` by the dev-only registration at the bottom of
 *  this file so the real-WKWebView e2e can drive the seam without three
 *  wall-clock sleeps. Pass no argument to restore SETTLE_MS. */
export function __setSettleMsForTest(ms?: number): void {
  if (!TEST_OR_DEV) return;
  settleMs = typeof ms === "number" && ms > 0 ? ms : SETTLE_MS;
}

/** The quiet window a newly armed timer will use. Reads the override in
 *  test/dev, the constant everywhere else. */
export function currentSettleMs(): number {
  return settleMs;
}

/** FNV-1a 32-bit over the WHOLE string. Inline and dependency-free (the
 *  zero-new-dep wedge holds). This is an IDENTITY hash, NOT a security hash —
 *  a collision only ever UNDERCOUNTS episodes, it can never fire the prompt
 *  early. Called ONLY from the settle callback below, never per render. */
export function fnv1a32(s: string): number {
  if (TEST_OR_DEV) hashCalls++;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Stable SEMANTIC identity of one successful tool use: WHICH tool was given
 *  WHAT source.
 *
 *  Hashes the FULL input. A head/tail window cannot tell apart two equal-length
 *  inputs that differ only in the MIDDLE — which is exactly what a large
 *  JSON/XML edit looks like — so there is deliberately no truncation. Cost is
 *  bounded by CALL FREQUENCY, not by truncation: this runs at most once per
 *  quiet window, where a few ms for a multi-megabyte scan is irrelevant.
 *
 *  Deliberately excludes timing, size-only signals, and every VIEW option
 *  (chips, indent, width, flags): `timingMs` churns on every recompute of the
 *  SAME work (double-count), byte counts collide across genuinely different
 *  inputs (undercount), and a view option re-presents work that was already
 *  counted. */
export function successIdentity(toolId: string, identityInput: string): string {
  return `${toolId}:${identityInput.length}:${fnv1a32(identityInput).toString(36)}`;
}

// Build-constant arm selection — see the CHANNEL GATE note in the header. The
// `.catch` is load-bearing: a failed chunk fetch (offline-first app, but a
// corrupted/evicted lazy chunk is still possible) must be a SILENT SKIP of one
// counted success, never an unhandled rejection surfacing in a React effect.
const notifySettledSuccess: () => void = IS_APPSTORE
  ? () => {
      void import("./reviewPrompt")
        .then((m) => m.recordSettledSuccess())
        .catch((err: unknown) => {
          if (TEST_OR_DEV) console.warn("[up5] review prompt module unavailable", err);
        });
    }
  : () => {};

/**
 * The single shared tool-success seam (UP5-01).
 *
 * @param toolId registry tool id — part of the episode identity, so the same
 *   source given to two different tools is two episodes.
 * @param ok this tool is currently displaying a SUCCESSFUL result for
 *   `identityInput`. Callers MUST pass false while an async result is pending,
 *   on an error, and on empty input.
 * @param identityInput the SOURCE the user submitted (the raw pasted/typed text
 *   this tool is currently succeeding on) — never the rendered output, and never
 *   a view option. Any change to (toolId, identityInput) restarts the pause
 *   window and begins a new episode; a view-only change must not appear here.
 *
 * THE RENDER PATH DOES NO HASHING: the digest is computed inside the settle
 * callback, so a 2 MB input costs one scan per quiet window instead of one per
 * render. The effect deps use the raw strings (Object.is compares strings BY
 * VALUE, so an unchanged input never restarts the timer), and `lastNotified`
 * additionally collapses a re-settle of the IDENTICAL identity (StrictMode
 * double-effect, an ok→false→ok flap) into a single episode.
 *
 * Call it at a level that STAYS MOUNTED across the tool's own view switches —
 * `lastNotified` lives in a ref, so a component that unmounts and remounts
 * (a mode toggle rendering one of two children) would forget what it already
 * counted and re-count the same work.
 */
export function useToolSuccess(toolId: string, ok: boolean, identityInput: string): void {
  const lastNotified = useRef<string | null>(null);
  useEffect(() => {
    if (!ok) return;
    // The effect closure already holds the CURRENT (toolId, identityInput) —
    // its deps are exactly those values — so no ref mirror is needed (and a
    // render-phase ref write would violate React purity / the compiler lint).
    const t = setTimeout(() => {
      const identity = successIdentity(toolId, identityInput); // hashed HERE, once
      if (identity === lastNotified.current) return; // same work re-settled = one episode
      lastNotified.current = identity;
      notifySettledSuccess();
    }, currentSettleMs());
    return () => clearTimeout(t);
  }, [ok, toolId, identityInput]);
}

// DEV/E2E seam registration. Only ever attached in a test/dev build (TEST_OR_DEV
// is false in the shipped bundle), and it hands out nothing but the guarded
// setter above — the release app has no way to shorten its own quiet window.
if (TEST_OR_DEV && typeof window !== "undefined") {
  (window as unknown as { __setSettleMsForTest?: (ms?: number) => void }).__setSettleMsForTest =
    __setSettleMsForTest;
}
