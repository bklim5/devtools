---
phase: 15-cron-tool
fixed_at: 2026-06-04T19:23:45Z
review_path: .planning/phases/15-cron-tool/15-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 4
status: all_fixed
---

# Phase 15: Cron Tool — Code Review Fix Report

**Fixed at:** 2026-06-04T19:23:45Z
**Source review:** .planning/phases/15-cron-tool/15-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 2 (MD-02, LO-01 — the two low-risk, post-sign-off polish items)
- Fixed: 2
- Skipped (deferred by design): 4 (MD-01, LO-02, LO-03, LO-04)
- Verification: `pnpm tsc --noEmit` clean; full `pnpm vitest run` **650/650 green**
  (648 pre-fix + 1 MD-02 consistency test + 1 LO-01 ordinal edge-case test).
  Both commits passed the lefthook gate (typecheck + full suite) — no `--no-verify`.

## Fixed Issues

### MD-02: `relativeTime` caption used a live `Date.now()` while run instants were frozen

**Files modified:** `src/tools/cron/CronTool.tsx`, `src/tools/cron/CronTool.test.tsx`
**Commit:** 25daf5d6
**Applied fix:** Replaced the bare `const result = useMemo(() => analyzeCron(expr, new Date(), zone), [expr, zone])`
with a memo that freezes ONE `now` per `[expr, zone]` compute and returns both
`{ result, now }`, then threaded that frozen `now` into the caption call:
`relativeTime(run.date.getTime(), now)`. `relativeTime` in `src/lib/timeFormat.ts`
already accepts an optional second `nowMs` param defaulting to `Date.now()`, so the
signature needed no change and the other callers (JWT, UUID/ULID tools) are
unaffected. Added a CronTool test that, under fake timers, captures the first run's
relative caption, advances the wall-clock 45 minutes, forces an unrelated re-render
(`rerender` with the same element so the memo + frozen `now` are reused), and asserts
the caption does not drift. Verified the test is a real guard: it fails against the
old live-clock code and passes with the fix.

### LO-01: ungrammatical "3-th-from-last" ordinal in the L-n description

**Files modified:** `src/lib/cron/cron.ts`, `src/lib/cron/cron.test.ts`
**Commit:** 2ce37ed9
**Applied fix:** Added a small local `ordinal(n)` helper (1→"1st", 2→"2nd", 3→"3rd",
4→"4th"…, with the 11/12/13→"th" teen rule and 21st/22nd/23rd handled correctly) next
to the other description helpers in `cron.ts` — no new file, no new dependency.
`domPhrase` now renders ``the ${ordinal(dom.lastOffset)}-from-last day of the month``,
producing "the 3rd-from-last day of the month". Updated the one locked assertion at
`cron.test.ts:510` from the literal `"3-th-from-last"` to `"3rd-from-last"` (the only
literal assertion on that string; the line 469 occurrence is a test *description*, not
an assertion). Added ordinal edge-case assertions (L-1→1st, L-2→2nd, L-11→11th,
L-21→21st) to lock the helper.

## Skipped Issues (deferred by design — out of scope for this polish pass)

### MD-01: `nextRuns` intra-day inner loop iterates seconds×minutes×hours for whole-day expressions

**File:** `src/lib/cron/cron.ts:565-583`
**Reason:** skipped by design — correctness-safe (bounded by `CANDIDATE_DAY_CAP`,
returns within the first minute in the common case) and the review explicitly flags it
as v1-out-of-scope pure-perf, to be checked at the WKWebView timing gate (T-15-10).

### LO-02: `timeOfDayPhrase` "past hour 09" phrasing for single-hour/minute-list shapes

**File:** `src/lib/cron/cron.ts:707-712`
**Reason:** skipped by design — optional copy polish only, no correctness impact and
24-hour discipline is preserved; changing the phrasing would churn locked description
assertions for a purely cosmetic gain.

### LO-03: run-label formatter uses the system locale (locale-dependent digit script/ordering)

**File:** `src/lib/cron/cron.ts:544-549`
**Reason:** skipped by design — this is a conscious display decision (localized output
is arguably correct); computation is unaffected (the internal read-back pins `en-US`).
Pinning the display locale is a deliberate choice to make outside this low-risk pass.

### LO-04: candidate-day walk recomputes per iteration; advances one day even across excluded months

**File:** `src/lib/cron/cron.ts:565-582`
**Reason:** skipped by design — the review states "None required"; the cap guarantees
termination, so this is correctness-safe and explicitly out of v1 perf scope.

---

_Fixed: 2026-06-04T19:23:45Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
