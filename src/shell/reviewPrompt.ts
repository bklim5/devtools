// App Store review prompt core (UP5-01/UP5-02) — APPSTORE BUILD ONLY.
//
// This module is loaded ONLY through the channel-gated dynamic import in
// src/shell/useToolSuccess.ts (`IS_APPSTORE ? import("./reviewPrompt") : …`), so
// it must NEVER be statically imported by shell/tool/prefs code — a static import
// would fold it into the DIRECT build's chunk graph and RED the fold-in guard.
// (That is also why prefsStore.ts duplicates MAX_TOOL_SUCCESS_COUNT instead of
// importing it from here.)
//
// APPLE 5.6.1 POSTURE. We ask the OS and nothing else: no custom pre-prompt, no
// card, no "rate us" UI anywhere in the webview, no incentive, and no feature is
// ever gated on reviewing. The OS decides whether a sheet actually appears — it
// legitimately showing NOTHING is a normal outcome, never an error.
//
// CADENCE CONTRACT (user-locked 2026-08-09, recurring — supersedes the earlier
// one-shot design). A request fires at EVERY 3rd settled success (toolSuccessCount
// 3, 6, 9, … forever), gated by a MINIMUM 7-DAY GAP since the last SUCCESSFUL
// request. The counter is never reset by a request; there is deliberately NO
// forever-latch. "Only if the user never reviewed" is DELEGATED TO THE OS:
// StoreKit exposes no submitted-a-review signal, `requestReview` silently no-ops
// for users who already reviewed, and macOS caps real prompts at 3 per 365 days
// however often we ask. Our gap is a floor on top of that cap, not a substitute.
//
// STAMP-AFTER-SUCCESS. `lastReviewRequestAt` is persisted ONLY after the native
// request RESOLVES. A native failure (run_on_main_thread failure, Swift
// `Unavailable`, no window/anchor) means the OS was never asked, so stamping
// would burn a whole 7-day window on a request that never happened.
//
// CONCURRENCY. Same-instance callers are deduped by the promise-chain queue
// below (it IS this instance's pending claim — a concurrent caller cannot reach
// the request gate while one is in flight). Callers this module cannot see (a
// second module instance) are deduped natively by the process-level IN-FLIGHT
// guard in src-tauri/src/review/mod.rs, and their persisted stamp write is
// suppressed by the post-resolve gap re-read.

import { platform } from "@/lib/platform";
import {
  getPreferencesLoadOk,
  getSharedPreferences,
  updatePreferences,
  whenPreferencesLoaded,
} from "./usePreferences";

/** Ask at every Nth settled success (UP5-01): counts 3, 6, 9, … */
export const SUCCESS_INTERVAL = 3;

/** Minimum elapsed time between two SUCCESSFUL review requests (UP5-02): 7 days. */
export const MIN_REQUEST_GAP_MS = 7 * 24 * 60 * 60 * 1000;

/** Ceiling for the lifetime settled-success counter. DELIBERATELY not a multiple
 *  of SUCCESS_INTERVAL (1_000_000 % 3 === 1) so a counter pinned at the ceiling
 *  can never stand PERMANENTLY on a request boundary. Duplicated (not imported)
 *  in prefsStore.ts — that module is always loaded, so it must not reach into
 *  this appstore-only one; Test 13 asserts the two stay equal. */
export const MAX_TOOL_SUCCESS_COUNT = 1_000_000;

/** True under vitest or a dev build — never in a production bundle. Mirrors the
 *  guard in src/lib/platform/index.ts (setPlatformForTest). */
function isTestOrDev(): boolean {
  const env = (import.meta as { env?: { MODE?: string; DEV?: boolean } }).env;
  return env?.MODE === "test" || env?.DEV === true;
}

// INJECTABLE CLOCK (mandatory). Every read of "now" — the gap comparison AND the
// stamp value — goes through this one seam, mirroring the license `_with_clock`
// discipline. A cadence test that reaches for the wall clock is a time bomb that
// rots the moment a fixture ages (memory: license-fixture-cert-time-bombs), so
// no test may call Date.now() to build an expectation.
let now: () => number = Date.now;

// THE serialization primitive. Every call enqueues behind the previous one, so
// the read-modify-write of toolSuccessCount can never lose an update and a
// concurrent caller can never reach the request gate mid-request. There is NO
// `done` latch: the counter must keep incrementing forever and a later boundary
// may legitimately request again.
let queue: Promise<void> = Promise.resolve();

/** Has the 7-day floor elapsed since `last`? `null` (never requested) always
 *  passes. FAIL-CLOSED by construction against a backwards system clock or a
 *  hand-edited FUTURE stamp: a negative delta simply never reaches the gap, so a
 *  forged value can only DELAY a prompt, never trigger one early. The OS enforces
 *  its own 3-per-365-day cap on top of this floor. */
function gapElapsed(last: number | null): boolean {
  return last === null || now() - last >= MIN_REQUEST_GAP_MS;
}

async function runOnce(): Promise<void> {
  // (a) Wait for the REAL persisted blob, and never write over it after a
  // transient read failure (the DEFAULT_PREFERENCES fail-soft fallback).
  await whenPreferencesLoaded();
  if (!getPreferencesLoadOk()) return;

  // (b) Count the settled success. Single-writer: updatePreferences merges
  // against the LIVE shared blob, so theme/pins/license are never clobbered.
  const prev = getSharedPreferences();
  const next = Math.min(prev.toolSuccessCount + 1, MAX_TOOL_SUCCESS_COUNT);
  if (next !== prev.toolSuccessCount) updatePreferences({ toolSuccessCount: next });

  // (c) Boundary test. The ceiling is deliberately not a multiple of
  // SUCCESS_INTERVAL, so a clamped counter can never stand permanently here.
  if (next === 0 || next % SUCCESS_INTERVAL !== 0) return;

  // (d) 7-day floor since the last SUCCESSFUL request.
  if (!gapElapsed(prev.lastReviewRequestAt)) return;

  // (e) Not frontmost → skip entirely. The NEXT boundary (three successes later)
  // gets the turn; there is deliberately no mid-interval retry, so a backgrounded
  // app can never queue up a sheet that pops later out of context.
  if (typeof document !== "undefined" && !document.hasFocus()) return;

  // (f) The final gate: re-read → invoke → stamp ONLY on success. Do not trust
  // the (b) snapshot: another writer (a second module instance, a prefs reload,
  // a settings pane) may have stamped since.
  await whenPreferencesLoaded();
  if (!gapElapsed(getSharedPreferences().lastReviewRequestAt)) return; // another writer won

  try {
    await platform.review.request(); // may reject; may be a legitimate OS no-op
  } catch {
    // (g) Swallow: a failed OS call must never throw into a React effect. Persist
    // NOTHING — the prefs blob is untouched, so the NEXT boundary genuinely
    // retries instead of the failure consuming a 7-day window.
    return;
  }

  // The stamp lands AFTER the await, so re-apply the gap test once more: a
  // concurrent instance may have stamped while we were awaiting the OS, and the
  // loser must skip rather than write a second stamp.
  await whenPreferencesLoaded();
  if (!gapElapsed(getSharedPreferences().lastReviewRequestAt)) return; // loser skips
  updatePreferences({ lastReviewRequestAt: now() }); // stamped after success only
}

/** Record ONE settled successful tool output (UP5-01). Increments the lifetime
 *  counter and, at every SUCCESS_INTERVAL boundary that clears the 7-day gap,
 *  asks the OS for a review. Never throws. Serialized: the returned promise
 *  resolves when THIS call's read-modify-write (and any request it triggered)
 *  has completed. */
export function recordSettledSuccess(): Promise<void> {
  // Both arms are runOnce so a rejection can never poison the chain.
  queue = queue.then(runOnce, runOnce);
  // Hand the CALLER a promise that can NEVER reject. This is called
  // fire-and-forget from a React effect, where an unhandled rejection is a dev
  // overlay crash and prod console noise. The chain keeps the RAW promise (its
  // rejection handler is the next runOnce), so recovery is unaffected.
  return queue.catch(() => {});
}

/** TEST-ONLY: drive the 7-day gap and the stamp off an injected clock. No-op
 *  outside test/dev builds. */
export function __setReviewClockForTest(fn: () => number): void {
  if (!isTestOrDev()) return;
  now = fn;
}

/** TEST-ONLY: restore the real clock and drop the serialization queue so module
 *  state never leaks across test cases. No-op outside test/dev builds. */
export function __resetReviewPromptForTest(): void {
  if (!isTestOrDev()) return;
  now = Date.now;
  queue = Promise.resolve();
}
