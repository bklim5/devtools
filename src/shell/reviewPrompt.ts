// App Store review prompt core (UP5-01/UP5-02) — APPSTORE BUILD ONLY.
//
// ===========================================================================
// THE CHANNEL GATE (canonical statement — everything else points HERE).
//
// This module is loaded ONLY through the gate in src/shell/useToolSuccess.ts:
//
//     const notifySettledSuccess = IS_APPSTORE
//       ? () => { void import("./reviewPrompt")… }
//       : () => {};
//
// WHY THAT SHAPE. `IS_APPSTORE` is a BUILD CONSTANT, so Rollup folds the ternary
// and drops the dead arm — on the direct build the dynamic import is not merely
// unreachable, it is not emitted at all. A plain static import behind a runtime
// `if` would keep BOTH arms in the bundle. (Same idiom as
// src/components/ToolRoute.tsx.)
//
// WHAT THAT BUYS. This module and everything it pulls in are ABSENT from the
// direct bundle, which scripts/reviewPromptFoldInGuard.mjs enforces per build
// (chunk-module inventory + sentinel) and scripts/build-and-publish.mjs asserts
// per release. So: NEVER give this module a static importer from shell/tool/prefs
// code — that single import would fold it back in and RED the guard. It is also
// why prefsStore.ts DUPLICATES MAX_TOOL_SUCCESS_COUNT rather than importing it
// from here (reviewPrompt Test 13 pins the two copies together).
//
// If that guard ever REDs on a direct build, the fix is to strengthen the arm
// selection — NEVER to weaken the guard.
// ===========================================================================
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
// STAMP-AFTER-SUCCESS, DURABLY. `lastReviewRequestAt` is persisted ONLY after the
// native request RESOLVES. A native failure (run_on_main_thread failure, Swift
// `Unavailable`, no window/anchor) means the OS was never asked, so stamping
// would burn a whole 7-day window on a request that never happened. The stamp
// write is also AWAITED to durability (updatePreferencesDurable): a quit — or a
// store rejection — in the moments right after the OS was asked must not lose it,
// or the app re-asks at the next boundary and the 7-day floor means nothing.
// This is the ONLY prefs write in the app that awaits durability; the counter
// increments deliberately do not (see the `persist` note at the increment).
//
// CONCURRENCY. Same-instance callers are deduped by the promise-chain queue
// below (it IS this instance's pending claim — a concurrent caller cannot reach
// the request gate while one is in flight). Callers this module cannot see (a
// second module instance) are deduped natively by the process-level IN-FLIGHT
// guard in src-tauri/src/review/mod.rs, which REJECTS the overlapping call — so
// the loser lands in the catch below and persists nothing. (An `Ok` there would
// have told us the OS was asked and burned a 7-day window on a request that
// never happened.) The post-resolve gap re-read is the second line of defence.

import { platform } from "@/lib/platform";
import { isTestOrDev } from "@/lib/env";
import {
  getPreferencesLoadOk,
  getSharedPreferences,
  updatePreferences,
  updatePreferencesDurable,
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

/** How far in the FUTURE a persisted stamp may sit before it is treated as
 *  garbage rather than as a rate limit. A stamp can legitimately be slightly
 *  ahead of `now` (an NTP correction, a DST-adjacent clock nudge), but a stamp
 *  a full day ahead means the clock moved backwards or the blob was edited —
 *  and honoring it would BRICK the prompt until real time caught up, which for
 *  a hand-edited year-2100 value is forever. See `gapElapsed`. */
export const FUTURE_STAMP_SLACK_MS = 24 * 60 * 60 * 1000;

/** How long a native review request may take before we give up on it. StoreKit
 *  presenting a sheet is fast; a promise that never settles (a wedged main
 *  thread, a lost IPC reply) must not park this module's queue forever, because
 *  the queue IS the serialization primitive — every later settled success would
 *  stop being counted. On timeout nothing is stamped, so the next boundary
 *  genuinely retries. Generous on purpose: this is a deadlock escape, not a
 *  latency budget. */
export const REQUEST_TIMEOUT_MS = 30_000;

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
 *  passes.
 *
 *  A stamp more than FUTURE_STAMP_SLACK_MS AHEAD of `now` is treated as INVALID
 *  (allow the request; the next successful one overwrites it) rather than as a
 *  rate limit. Treating it as a rate limit was fail-closed in the wrong
 *  direction: a backwards system-clock correction, a timezone/RTC mishap, or a
 *  hand-edited year-2100 value would suppress the prompt until real time caught
 *  up — permanently, in the hand-edited case. Nothing is at stake in the other
 *  direction: the worst a forged past/future stamp can buy is ONE extra ask,
 *  which the OS itself rate-limits (3 real prompts per 365 days) and may
 *  legitimately answer with nothing. A small skew still counts as "not
 *  elapsed", so ordinary clock jitter cannot fire the prompt early. */
function gapElapsed(last: number | null): boolean {
  if (last === null) return true;
  const elapsed = now() - last;
  if (elapsed < -FUTURE_STAMP_SLACK_MS) return true; // implausible future stamp → ignore it
  return elapsed >= MIN_REQUEST_GAP_MS;
}

/** Reject after `ms` if `p` has not settled. See REQUEST_TIMEOUT_MS: a native
 *  call that never settles would park the whole queue. The timer is always
 *  cleared, so a resolved request leaves nothing pending. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    p,
    new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error("review request timed out")), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function runOnce(): Promise<void> {
  // (a) Wait for the REAL persisted blob, and never write over it after a
  // transient read failure (the DEFAULT_PREFERENCES fail-soft fallback). This is
  // the ONE load-bearing await: everything below runs in the same call, so the
  // blob cannot become un-loaded again — later re-READS of the blob are still
  // required (another writer may have changed it), but re-awaiting is not.
  await whenPreferencesLoaded();
  if (!getPreferencesLoadOk()) return;

  // (b) Count the settled success. Single-writer: updatePreferences merges
  // against the LIVE shared blob, so theme/pins/license are never clobbered.
  const prev = getSharedPreferences();
  const next = Math.min(prev.toolSuccessCount + 1, MAX_TOOL_SUCCESS_COUNT);
  if (next === prev.toolSuccessCount) return; // pinned at the ceiling — nothing to do

  // (c) Boundary test. The ceiling is deliberately not a multiple of
  // SUCCESS_INTERVAL, so a clamped counter can never stand permanently here.
  const boundary = next % SUCCESS_INTERVAL === 0;

  // Sub-boundary counts are memory-only (`persist: "deferred"`): rewriting the
  // WHOLE prefs blob to disk after every settled success is I/O churn for a
  // number nothing reads until a boundary. Boundary counts persist immediately —
  // those are the ones a restart must not lose, since they gate the request —
  // and a deferred count also lands on any other prefs write or at window-hide
  // (usePreferences.flushPreferences). ACCEPTED BY DESIGN: a HARD kill (SIGKILL,
  // crash) between two boundaries can still lose ≤2 sub-boundary counts — no
  // webview API can make an async write survive that — so at worst ONE boundary
  // arrives a little late. Under-asking is the safe direction here (Apple 5.6.1),
  // and the boundary counts themselves persist immediately, so a lost count can
  // never make the app ask EARLY.
  updatePreferences(
    { toolSuccessCount: next },
    { persist: boundary ? "now" : "deferred" },
  );
  if (!boundary) return;

  // (d) 7-day floor since the last SUCCESSFUL request.
  if (!gapElapsed(prev.lastReviewRequestAt)) return;

  // (e) Not frontmost → skip entirely. The NEXT boundary (three successes later)
  // gets the turn; there is deliberately no mid-interval retry, so a backgrounded
  // app can never queue up a sheet that pops later out of context.
  if (typeof document !== "undefined" && !document.hasFocus()) return;

  // (f) The final gate: re-read → invoke → stamp ONLY on success. Do not trust
  // the (b) snapshot: another writer (a second module instance, a prefs reload,
  // a settings pane) may have stamped since.
  if (!gapElapsed(getSharedPreferences().lastReviewRequestAt)) return; // another writer won

  try {
    // May reject; may be a legitimate OS no-op; may (in the pathological case)
    // never settle at all — hence the timeout.
    await withTimeout(platform.review.request(), REQUEST_TIMEOUT_MS);
  } catch {
    // (g) Swallow: a failed OS call must never throw into a React effect. Persist
    // NOTHING — the prefs blob is untouched, so the NEXT boundary genuinely
    // retries instead of the failure consuming a 7-day window. A TIMEOUT lands
    // here too: we cannot know whether the OS was asked, and the conservative
    // reading ("it was not") only ever costs one extra ask later.
    return;
  }

  // The stamp lands AFTER the await, so re-apply the gap test once more: a
  // concurrent instance may have stamped while we were awaiting the OS, and the
  // loser must skip rather than write a second stamp.
  if (!gapElapsed(getSharedPreferences().lastReviewRequestAt)) return; // loser skips

  // (h) DURABLE stamp. This is the one write in this module whose loss changes
  // behaviour: the OS has just been asked, and a fire-and-forget write that the
  // process outlives by only a few ms (a quit right after the sheet, a rejected
  // store write) would leave `lastReviewRequestAt` null on disk — so the next
  // boundary would ask AGAIN, days early, exactly what the 7-day floor exists to
  // prevent. `updatePreferencesDurable` applies the merge synchronously (the
  // in-session gap gate is correct either way) and resolves only once the blob
  // has reached the store; it never rejects, and a failure is logged in dev.
  //
  // The timeout mirrors the native call's: this await sits ON the serialization
  // queue, so a store write that never settles would stop every later settled
  // success from being counted. Nothing is retried here — the in-memory stamp
  // still holds for this session, and `unsavedChanges` keeps the blob flushable.
  const durable = await withTimeout(
    updatePreferencesDurable({ lastReviewRequestAt: now() }),
    REQUEST_TIMEOUT_MS,
  ).catch(() => false);
  if (!durable && isTestOrDev()) {
    console.warn("[up5] review stamp not durably persisted — a later boundary may re-ask");
  }
}

/** Record ONE settled successful tool output (UP5-01). Increments the lifetime
 *  counter and, at every SUCCESS_INTERVAL boundary that clears the 7-day gap,
 *  asks the OS for a review. Never throws. Serialized: the returned promise
 *  resolves when THIS call's read-modify-write (and any request it triggered)
 *  has completed — and, when a request was made, only after its stamp has been
 *  DURABLY persisted (or the write has definitively failed/timed out). */
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
