---
phase: 15-cron-tool
plan: 01
subsystem: api
tags: [cron, parsing, time, error-as-value, typescript]

# Dependency graph
requires:
  - phase: 13-url-tool
    provides: error-as-value discriminated-result pattern (src/lib/url.ts) mirrored here
  - phase: 14-regex-tester
    provides: pure-total-core precedent (src/lib/regex/regex.ts) mirrored here
provides:
  - "src/lib/cron/cron.ts — pure error-as-value cron PARSE + DESCRIBE core"
  - "Exported contract: CronResult, CronFields, CronRun (Plans 02/03/04 import verbatim)"
  - "analyzeCron(input, now, zone): total, never-throws front-half (runs:[] until Plan 02)"
  - "parseExpression(input): normalized-fields helper (single source of truth for describe + Plan 02)"
  - "describe(fields, sixField): hand-rolled 24-hour description generator"
affects: [15-02-next-run-engine, 15-03-l-syntax, 15-04-cron-tool-view]

# Tech tracking
tech-stack:
  added: []  # zero new runtime/dev deps — native string parse only
  patterns:
    - "error-as-value discriminated CronResult (mirror url.ts ParseResult)"
    - "normalized field model (parse once, match many) — Set<number> per field"
    - "single source of truth: describe() + Plan 02 iterator read the SAME CronFields"

key-files:
  created:
    - src/lib/cron/cron.ts
    - src/lib/cron/cron.test.ts
  modified: []

key-decisions:
  - "Exposed parseExpression() so describe() and tests read the SAME normalized fields analyzeCron uses (no parse duplication)"
  - "analyzeCron keeps the locked (input, now, zone) signature now; now/zone are void-referenced until Plan 02 (lint-clean, contract-stable)"
  - "5-field defaults second to {0}; 6-field leading field is seconds — disambiguated strictly by token count"
  - "DOW parsed against 0–7 then 7→0 normalized (0 and 7 both Sunday, CRON-06)"
  - "restricted flag = NOT bare * and NOT a full-range step — for Plan 02's OR-union"

patterns-established:
  - "Pure total cron core: fixed split + integer parse + range-check ONLY; no eval/Function/user-built RegExp (T-15-01/02)"
  - "Named errors name the bad token AND the valid range (mirror url.ts/bytes.ts copy contract)"
  - "Macro table expands to a 5-field string then re-parses; @reboot is a sentinel kind"

requirements-completed: [CRON-01, CRON-02, CRON-03, CRON-04, CRON-09, CRON-11]

# Metrics
duration: 6min
completed: 2026-06-04
---

# Phase 15 Plan 01: Cron Parse + Describe Core Summary

**Pure, total, error-as-value cron parse + 24-hour description core in `src/lib/cron/cron.ts` — field grammar, macros, 5-vs-6-field disambiguation, 7→0 Sunday, the `@reboot` sentinel, full error path, and the `CronResult`/`CronFields`/`CronRun` contract Plans 02/03/04 import.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-06-04T06:34:48Z
- **Completed:** 2026-06-04T06:40:28Z
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments
- `analyzeCron` is a pure, total function: returns `scheduled` (runs:[] until Plan 02) / `reboot` / `empty` / `error`, never throws.
- Full field grammar: `*`, inclusive ranges, steps from a base (`0-30/10`→{0,10,20,30} vs `*/15`→{0,15,30,45}), lists, and JAN/MON names — all range-checked with named errors.
- Macro expansion (`@yearly`/`@annually`, `@monthly`, `@weekly`, `@daily`/`@midnight`, `@hourly`) + `@reboot` sentinel + clean `W`/`#`/`LW` rejection.
- Hand-rolled 24-hour description generator: "At 09:00, Monday through Friday." / "Every 15 minutes." / "Every 6 hours." — never emits AM/PM, honors OR-union wording.
- Exported the `CronResult` / `CronFields` / `CronRun` contract verbatim; added `parseExpression` as the shared normalized-fields source of truth.

## Task Commits

Each task was committed atomically (TDD landed GREEN with its impl — lefthook Rule-4 pattern):

1. **Task 1: Field-grammar parser + macro expansion → CronFields** - `b7f06afd` (feat)
2. **Task 2: Hand-rolled 24-hour description generator** - `aae36324` (feat)

_Note: per the locked lefthook Rule-4 pattern (MEMORY: tdd-red-commits-blocked-by-lefthook), each test file shipped GREEN with its implementation — no standalone RED commit._

## Files Created/Modified
- `src/lib/cron/cron.ts` (506 lines) - Pure error-as-value cron parse + describe core; exports `analyzeCron`, `parseExpression`, `describe`, `CronResult`, `CronFields`, `CronRun`.
- `src/lib/cron/cron.test.ts` (222 lines) - 29 TDD assertions: parse grammar, macros, 0/7-Sunday, restricted flags, named errors, empty/reboot kinds, and the 24-hour description (with an explicit no-AM/PM guard).

## Decisions Made
- **Exposed `parseExpression()`** (beyond the planned exports) so `describe()` and the tests read the SAME normalized `CronFields` that `analyzeCron` produces — eliminates parse duplication and gives Plan 02 a clean entry point. `analyzeCron` is now a thin wrapper over it.
- **Kept the locked `analyzeCron(input, now, zone)` signature** even though `now`/`zone` are unused this plan — they are the contract Plans 02/03 consume. Referenced via `void` to stay eslint-clean (the project's flat config flags unused args even when `_`-prefixed).
- **`restricted` semantics:** a bare `*` and a full-range step both count as NOT restricted; any explicit list/range/single/sub-range step counts as restricted — exactly the input Plan 02's OR-union rule needs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] JSDoc comment prematurely terminated by `*/n`**
- **Found during:** Task 1 (first vitest/tsc run)
- **Issue:** A doc-comment line read "…NOT `*/n` over the…" — the `*/` sequence closed the block comment early, producing a cascade of TS1443/TS1005 parse errors.
- **Fix:** Reworded the comment to "…NOT a full-range step…" (no `*/` literal in any block comment).
- **Files modified:** src/lib/cron/cron.ts
- **Verification:** `pnpm tsc --noEmit` clean; `pnpm vitest run src/lib/cron` 20/20 green.
- **Committed in:** `b7f06afd` (Task 1 commit)

**2. [Rule 3 - Blocking] eslint no-unused-vars on the contract params**
- **Found during:** Task 1 (eslint gate)
- **Issue:** `analyzeCron`'s `now`/`zone` (required by the locked contract, unused this plan) failed `@typescript-eslint/no-unused-vars`; the project config does not ignore `_`-prefixed args.
- **Fix:** Kept the public param names `now`/`zone` and added `void now; void zone;` with a comment (same idiom already used for the describe placeholder).
- **Files modified:** src/lib/cron/cron.ts
- **Verification:** `pnpm eslint` exit 0.
- **Committed in:** `b7f06afd` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both were mechanical fixes to land the planned code clean. No scope change — the public contract and behavior match the plan exactly.

## Issues Encountered
None beyond the two auto-fixed blocking issues above.

## Verification
- `pnpm vitest run src/lib/cron` — 29/29 green.
- `pnpm vitest run` (full suite) — **610/610 green** (the 19 immovable decoder tests included).
- `pnpm tsc --noEmit` — clean. `pnpm eslint src/lib/cron/*` — clean.
- `git diff --quiet src/lib/protobuf/decoder.ts` — decoder byte-for-byte untouched.
- `git diff --quiet package.json pnpm-lock.yaml` — zero dependency changes.
- No `eval` / `new Function` / user-built `new RegExp` in cron.ts (grep clean); the only regexes are fixed linear literals (`/^\d+$/`, `/\s+/`).

## User Setup Required
None - pure logic, no external service configuration.

## Next Phase Readiness
- **Plan 02 (next-run engine)** can import `CronFields` / `CronResult` / `CronRun` and `parseExpression`, then replace `runs: []` in `analyzeCron`'s `scheduled` branch with the wall-clock odometer. The `restricted` flags + the `dom.lastDay`/`dom.lastOffset`/`dow.lastWeekday` struct slots are already in place.
- **Plan 03 (L-syntax)** extends `parseField` to populate the L-marker slots (currently `lastDay:false`, others unset) — the struct shape is ready and `LW` is already rejected so bare `L`/`nL`/`L-n` can be allowed cleanly.
- No blockers.

---
*Phase: 15-cron-tool*
*Completed: 2026-06-04*

## Self-Check: PASSED
- FOUND: src/lib/cron/cron.ts
- FOUND: src/lib/cron/cron.test.ts
- FOUND: .planning/phases/15-cron-tool/15-01-SUMMARY.md
- FOUND commit: b7f06afd (Task 1)
- FOUND commit: aae36324 (Task 2)
