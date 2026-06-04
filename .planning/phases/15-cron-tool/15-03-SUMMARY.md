---
phase: 15-cron-tool
plan: 03
subsystem: api
tags: [cron, time, edge-cases, last-day, leap-year, typescript]

# Dependency graph
requires:
  - phase: 15-cron-tool
    plan: 01
    provides: "CronFields struct (dom.lastDay/lastOffset, dow.lastWeekday slots), parseField pipeline, describe() dayPhrase"
  - phase: 15-cron-tool
    plan: 02
    provides: "dayMatches OR-union day-matcher + nextRuns odometer + CANDIDATE_DAY_CAP (the L-syntax extends dayMatches; the cap bounds L-31)"
provides:
  - "L / L-n (day-of-month) + nL (day-of-week) parse markers — filled into the Plan-01 CronFields slots"
  - "dayMatches L-syntax extension: leap-year/month-length-aware last-day + last-weekday matching via Date.UTC(y,mo,0).getUTCDate()"
  - "describe() L-form phrasing: last day / n-th-from-last day / last <weekday> of the month"
affects: [15-04-cron-tool-view]

# Tech tracking
tech-stack:
  added: []  # zero new runtime/dev deps — native Date.UTC + the existing parse/match pipeline only
  patterns:
    - "L-markers carried out of parseField via an optional lastForm spec ('dom' | 'dow'); fields without lastForm reject L-tokens unchanged"
    - "Leap-correct last-day via new Date(Date.UTC(y, mo, 0)).getUTCDate() — no hand-rolled leap-year ladder (T-15-08)"
    - "Last-weekday test: weekday===n AND d+7 > daysInMonth (no later same weekday this month)"
    - "Over-large offset (L-31) is a no-match, bounded by the Plan-02 day-walk cap → kind:never, never a hang (T-15-07)"

key-files:
  created: []
  modified:
    - src/lib/cron/cron.ts
    - src/lib/cron/cron.test.ts

key-decisions:
  - "L-syntax detected at the TOP of the per-item loop in parseField, gated by spec.lastForm — keeps the L-branches out of the numeric grammar and lets non-L fields reject L-tokens as before"
  - "L-0 normalized to bare L (offset 0 → lastOffset undefined) so L-0 ≡ L behaves identically (boundary fixture)"
  - "nL uses the LOCKED 0–6 mapping (5L = last Friday, 7L → last Sunday via 7→0) — documented in a code-comment AND fixtured; the single most likely off-by-one (Assumption A3)"
  - "describe() refactored dayPhrase into domPhrase + dowPhrase fragment builders so an L-form with an empty value Set still produces wording (bare L has no numeric dom.values)"

requirements-completed: [CRON-10]

# Metrics
duration: 3min
completed: 2026-06-04
---

# Phase 15 Plan 03: Cron L / nL / L-n Last-Day Syntax Summary

**The isolated high-risk CRON-10 slice on `src/lib/cron/cron.ts` — `L` / `L-n` (day-of-month) and `nL` (day-of-week, locked 0–6 mapping) parse into the Plan-01 marker slots and are honored by `dayMatches` via the leap-year- and month-length-correct `Date.UTC(y, mo, 0).getUTCDate()` last-day idiom + a `d + 7 > daysInMonth` last-weekday test, with `describe()` phrasing and dedicated leap-year/month-length fixtures (Feb 28/29, Apr 30, L-3 offsets, last-Friday, the over-large L-31 → kind:never).**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-06-04T06:49:14Z
- **Completed:** 2026-06-04T06:52:41Z
- **Tasks:** 2
- **Files modified:** 2 (both extended; none created)

## Accomplishments
- `parseField` gained an optional `lastForm` spec slot: `"dom"` accepts `L` (last day) and `L-n` (n days before last); `"dow"` accepts `nL` (last weekday-n). Fields without `lastForm` still reject any L-bearing token as unparseable.
- `L-0` is folded to bare `L` (offset 0 → `lastOffset` undefined); an over-large offset like `L-31` parses fine and simply never matches; malformed forms (`L-abc`, `L-`) and out-of-range `nL` (`9L`) error cleanly with the named messages — never a throw.
- `nL` uses the locked **0–6 mapping** (5L = last Friday, 7L → last Sunday via 7→0), documented in a code-comment and fixtured — closing Assumption A3, the most likely off-by-one.
- `dayMatches` now computes `daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate()` (leap-year-correct for free) and matches `L`/`L-n` on the day-of-month side, plus the last-weekday-of-month case (`weekday === n && d + 7 > daysInMonth`) on the day-of-week side — both inside the existing Vixie OR-union wrapper, untouched.
- `describe()` refactored its `dayPhrase` into `domPhrase` + `dowPhrase` fragment builders so an L-form with an empty numeric value Set still produces wording: "on the last day of the month", "the 3-th-from-last day of the month", "the last Friday of the month".

## Task Commits

Each task committed atomically (TDD landed GREEN with its impl — the locked lefthook Rule-4 pattern; no standalone RED commit):

1. **Task 1: Parse L / L-n / nL markers (CRON-10)** — `6ee5e34c` (feat)
2. **Task 2: dayMatches L-syntax + canonical leap-year/month-length fixtures (CRON-10)** — `f4918323` (feat)

## Files Created/Modified
- `src/lib/cron/cron.ts` — extended `FieldSpec` (added `lastForm`), `FieldParse` (added `lastDay`/`lastOffset`/`lastWeekday`), `parseField` (L-form detection branches), `parseFields` (enabled `lastForm` on dom/dow + propagated markers into `CronFields`), `dayMatches` (leap-correct last-day + last-weekday matching), and `describe()` (`domPhrase`/`dowPhrase` L-form wording).
- `src/lib/cron/cron.test.ts` — added a CRON-10 parse-marker block (Task 1: L/L-0/L-3/5L/7L/0L/`1,L`/LW-reject/L-abc/9L/L-31) and a CRON-10 dayMatches/analyzeCron block (Task 2: last-day each month, Feb 28/29 leap, Apr 30, L-3 offsets, L-0≡L, last-Friday, L-31→never) plus three describe L-phrasing assertions.

## Decisions Made
- **L-syntax is detected at the TOP of the per-item loop in `parseField`**, gated by `spec.lastForm`, so the L-branches stay out of the numeric `*`/range/step/list grammar and a non-L field still rejects an L-token exactly as before. `LW` is rejected (W unsupported) *before any field parsing* in `parseExpression`, so a bare `L` reaching `parseField` is never part of `LW`.
- **`L-0` ≡ bare `L`** (offset 0 → `lastOffset` left undefined), matching the boundary fixture.
- **`describe()` split into `domPhrase`/`dowPhrase`** fragment builders because a bare `L` has an empty `dom.values` Set; the previous single-list builder would have emitted nothing. The OR-union wording ("on … or …") is preserved for the both-restricted case.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Canonical-fixture expressions placed `nL` in the wrong field position (test-authoring)**
- **Found during:** Task 1 (first vitest run) and again Task 2
- **Issue:** Test fixtures wrote `0 0 5L 2 *` and `0 0 5L * *`, which put the `nL` token in the day-of-MONTH field (3rd). `nL` is a day-of-WEEK form (5th field), so the parser correctly rejected `5L` as an unparseable day-of-month token — the failure was in my fixtures, not the implementation.
- **Fix:** Moved the `nL` token to the day-of-week position: `0 0 * 2 5L`, `0 0 * * 7L`, `0 0 * * 0L`, `0 0 * * 9L`, `0 0 * * 5L`.
- **Files modified:** src/lib/cron/cron.test.ts
- **Verification:** `pnpm vitest run src/lib/cron` 60/60 green.
- **Committed in:** `6ee5e34c` (Task 1) / `f4918323` (Task 2)

---

**Total deviations:** 1 auto-fixed (1 test-authoring bug). No production-code deviations.
**Impact on plan:** None — the implementation matched the plan exactly; only test fixtures needed the field-position correction.

## Issues Encountered
None beyond the test-authoring field-position fix above.

## Verification
- `pnpm vitest run src/lib/cron` — 60/60 green (10 new CRON-10 parse-marker tests + 7 new dayMatches/describe L-syntax tests on top of Plan 02's 40).
- `pnpm vitest run` (full suite) — **641/641 green** (the 19 immovable decoder tests included).
- `pnpm tsc --noEmit` — clean. `pnpm eslint src/lib/cron/*` — clean (exit 0).
- `git diff --quiet src/lib/protobuf/decoder.ts` — decoder byte-for-byte untouched.
- `git diff --quiet package.json pnpm-lock.yaml` — zero dependency changes.
- Grep invariants: `getUTCDate()` for `daysInMonth` present in dayMatches; the `d + 7 > daysInMonth` last-weekday test present; describe() "last day of the month" / "last ${WEEKDAY...} of the month" phrasing present.

## Threat surface
- T-15-07 (L-31 DoS): mitigated — an over-large offset is a no-match, bounded by the Plan-02 `CANDIDATE_DAY_CAP` day-walk → `kind:"never"`; no new loop introduced. Fixtured (`0 0 L-31 * *` → never, returns without hanging).
- T-15-08 (nL off-by-one / leap math): mitigated — locked 0–6 mapping documented + fixtured; `daysInMonth` via native `Date.UTC(y,mo,0).getUTCDate()`, no hand-rolled leap-year ladder.
- No new security-relevant surface (network/auth/file/schema) introduced.

## Next Phase Readiness
- **Plan 04 (view)** consumes `analyzeCron(input, now, zone)` unchanged — CRON-10 expressions now produce correct `scheduled`/`never` results and L-form descriptions through the same contract. The whole cron pure core (CRON-01..11) is complete; Plan 04 is the thin React view + registry append.
- No blockers.

---
*Phase: 15-cron-tool*
*Completed: 2026-06-04*

## Self-Check: PASSED
- FOUND: src/lib/cron/cron.ts
- FOUND: src/lib/cron/cron.test.ts
- FOUND: .planning/phases/15-cron-tool/15-03-SUMMARY.md
- FOUND commit: 6ee5e34c (Task 1)
- FOUND commit: f4918323 (Task 2)
