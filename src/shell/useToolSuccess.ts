// The ONE shared settled-success seam (UP5-01).
//
// This is the ONLY place a successful tool output is counted. Tools never import
// or call `./reviewPrompt` — they make exactly ONE `useToolSuccess(id, ok, output)`
// call and hold zero counting logic. Ten call sites cover all thirteen tools
// (`FormatterView` covers the four formatter tools with one call).
//
// WHAT IS EXCLUDED, by construction: errors, empty input, an async format still
// pending, and plain navigation all arrive as `ok === false`, so they can never
// start a success episode.
//
// WHAT "SETTLED" MEANS: a successful output must sit UNCHANGED for SETTLE_MS
// before it counts. That quiet window IS the "natural pause" the review request
// rides on (UP5-02) — mid-paste and mid-typing keystrokes restart it, so the OS
// sheet can never land on top of someone still working.
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

/** Milliseconds a successful output must sit UNCHANGED before it counts as one
 *  settled success. This is also the "natural pause" the review request rides
 *  on — never mid-paste, never mid-typing. */
export const SETTLE_MS = 3000;

/** Test-only instrumentation: how many times fnv1a32 has run in this module
 *  instance. Exists so a test can prove the RENDER PATH does no hashing (a
 *  2 MB output re-rendered 50 times inside one quiet window must hash ZERO
 *  times, then exactly once when the window elapses). A single integer
 *  increment — not a behavioural dependency. */
let hashCalls = 0;

export function __hashCallCountForTest(): number {
  return hashCalls;
}

/** FNV-1a 32-bit over the WHOLE string. Inline and dependency-free (the
 *  zero-new-dep wedge holds). This is an IDENTITY hash, NOT a security hash —
 *  a collision only ever UNDERCOUNTS episodes, it can never fire the prompt
 *  early. Called ONLY from the settle callback below, never per render. */
export function fnv1a32(s: string): number {
  hashCalls++;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Stable SEMANTIC identity of one successful output: WHICH tool produced WHAT.
 *
 *  Hashes the FULL output. A head/tail window cannot tell apart two equal-length
 *  outputs that differ only in the MIDDLE — which is exactly what a large
 *  JSON/XML edit looks like — so there is deliberately no truncation. Cost is
 *  bounded by CALL FREQUENCY, not by truncation: this runs at most once per
 *  SETTLE_MS quiet window, where a few ms for a multi-megabyte scan is
 *  irrelevant.
 *
 *  Deliberately excludes timing and any size-only signal: `timingMs` churns on
 *  every recompute of the SAME output (double-count), and byte counts collide
 *  across genuinely different outputs (undercount). */
export function successIdentity(toolId: string, output: string): string {
  return `${toolId}:${output.length}:${fnv1a32(output).toString(36)}`;
}

// Build-constant arm selection — see the CHANNEL GATE note in the header.
const notifySettledSuccess: () => void = IS_APPSTORE
  ? () => void import("./reviewPrompt").then((m) => m.recordSettledSuccess())
  : () => {};

/**
 * The single shared tool-output success seam (UP5-01).
 *
 * @param toolId registry tool id — part of the episode identity, so the same
 *   text produced by two different tools is two episodes.
 * @param ok this tool is currently displaying a SUCCESSFUL result. Callers MUST
 *   pass false while an async format is pending, on an error, and on empty input.
 * @param output the actual produced text. Any change to (toolId, output)
 *   restarts the pause window and begins a new episode.
 *
 * THE RENDER PATH DOES NO HASHING. It only reads the latest (toolId, output)
 * into a ref; the digest is computed inside the settle callback, so a 2 MB
 * output costs one scan per quiet window instead of one per render. The effect
 * deps use the raw `output` string (Object.is compares strings BY VALUE, so an
 * unchanged output never restarts the timer), and `lastNotified` additionally
 * collapses a re-settle of the IDENTICAL identity (StrictMode double-effect,
 * remount) into a single episode.
 */
export function useToolSuccess(toolId: string, ok: boolean, output: string): void {
  // Written in the EFFECT (not during render): a render-phase ref mutation is
  // both a React-purity violation and unnecessary here, since the effect below
  // already re-runs whenever (ok, toolId, output) changes.
  const latest = useRef({ toolId, output });
  const lastNotified = useRef<string | null>(null);
  useEffect(() => {
    latest.current = { toolId, output };
    if (!ok) return;
    const t = setTimeout(() => {
      const { toolId: id, output: text } = latest.current;
      const identity = successIdentity(id, text); // hashed HERE, at settle, once
      if (identity === lastNotified.current) return; // same output re-settled = one episode
      lastNotified.current = identity;
      notifySettledSuccess();
    }, SETTLE_MS);
    return () => clearTimeout(t);
  }, [ok, toolId, output]);
}
