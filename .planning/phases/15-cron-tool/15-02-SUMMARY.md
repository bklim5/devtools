---
phase: 15-cron-tool
plan: 02
subsystem: api
tags: [cron, time, dst, scheduling, typescript]

# Dependency graph
requires:
  - phase: 15-cron-tool
    plan: 01
    provides: "CronFields / CronResult / CronRun contract + parseExpression + describe (the parse/describe core this plan extends)"
provides:
  - "nextRuns(f, now, zone, want=5) — DST-correct wall-clock next-run engine on the Plan 01 CronFields"
  - "wallClockToInstant(y,mo,d,h,mi,s,zone) — Intl.formatToParts offset-correct-then-verify round-trip; null on the spring-forward gap"
  - "dayMatches(f,y,mo,d) — Vixie DOM/DOW OR-union day-matcher (0/7 Sunday correct)"
  - "analyzeCron now computes 5 local 24-hour runs and returns kind:never for impossible expressions within a bounded cap"
affects: [15-03-l-syntax, 15-04-cron-tool-view]

# Tech tracking
tech-stack:
  added: []  # zero new runtime/dev deps — native Intl.DateTimeFormat.formatToParts + Date.UTC only
  patterns:
    - "Wall-clock field iteration (NOT millisecond-delta stepping) for DST correctness"
    - "Offset-correct-then-verify Intl round-trip; null round-trip = the wall-clock time does not exist (spring-forward gap)"
    - "Hard candidate-day cap (5*366) as the freeze protection for impossible expressions — for-loop, never while(true)"
    - "Day-granular outer odometer (Date.UTC overflow normalization) sidesteps month-length/leap carry math"

key-files:
  created: []
  modified:
    - src/lib/cron/cron.ts
    - src/lib/cron/cron.test.ts

key-decisions:
  - "Exported wallClockToInstant + dayMatches (beyond the planned nextRuns) so the DST round-trip and OR-union are unit-tested directly against fixtures, not only through analyzeCron"
  - "DST fixtures keyed to 2026: spring-forward 2026-03-08 (02:30 has no instant → null), fall-back 2026-11-01 (01:30 occurs twice → de-duped to one run)"
  - "Spring-forward convention = skip the non-existent time (null + advance); fall-back = de-dupe consecutive equal instants by epoch ms (Assumption A4, locked)"
  - "Odometer starts from the zoned calendar day of `now` (not now+1day) so intra-day candidates strictly after now are honored"
  - "analyzeCron stays injectable: zone is a param (caller passes resolvedOptions().timeZone), never read inside the pure core"

patterns-established:
  - "Cron next-run is bounded/cheap → runs synchronously on the main thread; the cap (not a Worker) is the DoS protection (T-15-04, unlike Phase 14's regex Worker)"
  - "The cron-logic ↔ timezone-math seam stays crisp: cron logic picks the wanted wall-clock fields; Intl/Date answer what real instant that is and whether it exists"

requirements-completed: [CRON-05, CRON-06, CRON-07, CRON-08]

# Metrics
duration: 3min
completed: 2026-06-04
---

# Phase 15 Plan 02: Cron Next-Run Engine Summary

**DST-correct wall-clock next-run odometer on `src/lib/cron/cron.ts` — `nextRuns` fills the next 5 local 24-hour runs onto the Plan 01 `scheduled` result via an `Intl.formatToParts` offset-correct-then-verify zone round-trip, the Vixie DOM/DOW OR-union day-matcher (0/7 Sunday), spring-forward-skip + fall-back-de-dupe, and a hard `5*366` candidate-day cap that turns impossible expressions into `kind:"never"` without ever hanging.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-06-04T06:43:40Z
- **Completed:** 2026-06-04T06:46:45Z
- **Tasks:** 2
- **Files modified:** 2 (both extended; none created)

## Accomplishments
- `zonedParts` reads an instant's wall-clock Y/M/D/h/m/s in any IANA zone via `Intl.DateTimeFormat("en-US", { …, hourCycle:"h23" }).formatToParts` — fixed locale + h23 so midnight is `00` and digits are Latin (Pitfall 8).
- `wallClockToInstant` is the Temporal-less round-trip: UTC guess → read back in-zone → correct by `(asked − shown)` → VERIFY the corrected instant round-trips to the exact requested fields; returns `null` when it does not (the spring-forward gap, CRON-07).
- `dayMatches` implements the Vixie OR-union rule: `(dom.restricted && dow.restricted) ? (domMatch || dowMatch) : (domMatch && dowMatch)`; 0/7-Sunday is correct for free because Plan 01 normalized 7→0 and `getUTCDay()` returns 0 for Sunday.
- `nextRuns` is the day-granular wall-clock odometer: walk candidate days (`addOneDay` via `Date.UTC` overflow normalization), skip non-matching months/days, iterate hour×minute×second ascending, skip spring-forward `null`s, de-dupe consecutive equal instants (fall-back), and stop at 5 runs — all under a hard `CANDIDATE_DAY_CAP = 5 * 366` for-loop.
- `analyzeCron` now computes the 5 next runs in local 24-hour time and returns `{ kind:"never", description }` when nothing fires within the cap (the description still renders; the expression parsed fine, it just never fires) — CRON-08.

## Task Commits

Each task committed atomically (TDD landed GREEN with its impl — the locked lefthook Rule-4 pattern; no standalone RED commit):

1. **Task 1: Zone round-trip + DOM/DOW union day-matcher (CRON-06/07)** — `0aa2ef68` (feat)
2. **Task 2: Bounded next-run odometer → fills runs / kind:never (CRON-05/08)** — `608b8658` (feat)

## Files Created/Modified
- `src/lib/cron/cron.ts` — added `zonedParts` (internal), `wallClockToInstant` (exported), `dayMatches` (exported), `nextRuns` (exported), `CANDIDATE_DAY_CAP`, `addOneDay`, `asc`; rewired `analyzeCron` to compute runs / return `kind:"never"`.
- `src/lib/cron/cron.test.ts` — added DOM/DOW OR-union (incl. 0/7 Sunday), DST spring-forward-null + fall-back-instant + non-UTC round-trip, 5-ascending-09:00-runs (no AM/PM), every-30-min spacing, fall-back distinct-instants, and Feb-30 `kind:"never"`-terminates fixtures; updated the prior `runs:[]` assertion to `toHaveLength(5)`.

## Decisions Made
- **Exported `wallClockToInstant` + `dayMatches`** (beyond the plan's `nextRuns`) so the DST round-trip and the OR-union are unit-tested directly against fixtures rather than only end-to-end through `analyzeCron` — the two highest-risk pieces (Assumptions A1/A4) get their own crisp coverage.
- **DST fixtures keyed to concrete 2026 transitions** (verified at the node REPL before writing): spring-forward `America/New_York` 2026-03-08 (02:30 → null), fall-back 2026-11-01 (01:30 twice → 5 distinct instants). Locks the spring-forward-skip / fall-back-de-dupe convention (A4).
- **Odometer starts from the zoned day of `now`**, not `now+1day`, so an intra-day run strictly after `now` on the current day is honored; the `ms > nowMs` guard enforces strictly-after.

## Deviations from Plan

None — both tasks executed exactly as written. No bugs, no missing-functionality, no blocking issues; no architectural decisions required.

## Issues Encountered
None.

## Verification
- `pnpm vitest run src/lib/cron` — 40/40 green (5 new next-run/DST/OR-union/impossible-expr tests on top of Plan 01's 35).
- `pnpm vitest run` (full suite) — **621/621 green** (the 19 immovable decoder tests included).
- `pnpm tsc --noEmit` — clean. `pnpm eslint src/lib/cron/*` — clean.
- `git diff --quiet src/lib/protobuf/decoder.ts` — decoder byte-for-byte untouched.
- `git diff --quiet package.json pnpm-lock.yaml` — zero dependency changes.
- Grep invariants: `CANDIDATE_DAY_CAP = 5 * 366` present (1), `kind: "never"` returned (2), `hourCycle` in formatters (3), `nextRuns` defined+used (3); **no real `while(true)` loop** (the single match is a doc-comment naming the anti-pattern we avoid) and **no `+= 60_000` ms-delta stepping** (0).

## Next Phase Readiness
- **Plan 03 (L-syntax)** extends `parseField` to populate `dom.lastDay`/`dom.lastOffset`/`dow.lastWeekday`, then adds the L/nL/L-n branches inside `dayMatches` (the function already centralizes day-matching and is exported for direct fixture testing — the leap-year/month-length idiom `new Date(Date.UTC(y, mo, 0)).getUTCDate()` slots straight in).
- **Plan 04 (view)** consumes `analyzeCron(input, now, zone)` with `zone = Intl.DateTimeFormat().resolvedOptions().timeZone`; each `CronRun.label` is already a locale 24-hour local string, and the relative caption can reuse `timeFormat.ts` `relativeTime`.
- No blockers.

---
*Phase: 15-cron-tool*
*Completed: 2026-06-04*

## Self-Check: PASSED
- FOUND: src/lib/cron/cron.ts
- FOUND: src/lib/cron/cron.test.ts
- FOUND: .planning/phases/15-cron-tool/15-02-SUMMARY.md
- FOUND commit: 0aa2ef68 (Task 1)
- FOUND commit: 608b8658 (Task 2)
