---
phase: 12-protobuf-decimal-input
plan: 01
subsystem: protobuf-decoder
tags: [protobuf, bytes, decimal, input-encoding, parser, tdd]

# Dependency graph
requires:
  - phase: 03-protobuf-hero
    provides: detectEncoding classifier + useDecode decode boundary (hex/base64) + decodeInput try/catch error-as-value
provides:
  - "decimalToBytes(input: string): Uint8Array — strict comma/space-separated decimal byte-array parser in src/lib/bytes.ts"
  - "InputEncoding union widened to 'hex' | 'base64' | 'decimal'"
  - "comma-first detection branch in detectEncoding (comma anywhere => decimal, D-01/D-02)"
  - "three-way encoding switch in useDecode routing decimal through decimalToBytes"
affects: [12-02-decimal-ui-mode]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Comma-first detection then validate: detection routes on a cheap .includes(',') ; range/integer validation is the parser's job, not a detection gate"
    - "Strict-surface parser: split on commas (non-empty segments enforced), then spaces within a segment; named-token errors"
    - "Error-as-value inheritance: decimal path throws plain Error inside decodeInput's existing try/catch, no new error wiring"

key-files:
  created: []
  modified:
    - src/lib/bytes.ts
    - src/lib/bytes.test.ts
    - src/tools/protobuf-decoder/detectEncoding.ts
    - src/tools/protobuf-decoder/detectEncoding.test.ts
    - src/tools/protobuf-decoder/useDecode.ts

key-decisions:
  - "decimalToBytes splits on commas FIRST (each segment must be non-empty -> catches doubled/trailing commas per D-05), then on spaces within each segment (so comma-less '10 3 80' parses while ', ' stays one valid separator)"
  - "Out-of-range error message uses the parsed number; non-integer/unparseable errors quote the raw token verbatim so the offending token is always named (D-07)"
  - "detectEncoding's comma check is a plain .includes(',') (no regex) — not a ReDoS surface (T-12-02); the classifier stays pure, no @/lib/bytes import"

patterns-established:
  - "Detect-then-validate: presence-of-comma routes to decimal unconditionally; decimalToBytes surfaces the precise range/integer error (so '1, 2, 999' yields a decimal range error, never a base64 fallback)"
  - "Per-token bounded /^\\d+$/ validation (anchored, linear) instead of any global backtracking pattern (ReDoS-safe)"

requirements-completed: [PRO-08, PRO-09]

# Metrics
duration: 3min
completed: 2026-06-03
---

# Phase 12 Plan 01: Decimal Parse Layer Summary

**Pure string→bytes decimal layer for the Protobuf hero: a strict `decimalToBytes` parser, a comma-first `detectEncoding` branch, and a three-way `useDecode` switch — `decoder.ts` and its 19 tests byte-for-byte untouched.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-06-03T11:25:11Z
- **Completed:** 2026-06-03T11:28:21Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- `decimalToBytes(input)` parses `10, 3, 80, 81, 82` → `Uint8Array([10,3,80,81,82])` and throws named-token errors on out-of-range (>255), negative, non-integer, unparseable, trailing-comma, doubled-comma, bracketed, and newline-separated input (D-04/05/06/07).
- `detectEncoding` now routes a comma anywhere to `decimal` FIRST (D-01/D-02), so `1, 2, 999` surfaces a clear decimal range error instead of a confusing base64 fallback; space-only input still falls through to hex/base64 (D-03). Classifier stays pure (no `@/lib/bytes` import).
- `useDecode` decode boundary extended to a three-way switch routing `decimal` through `decimalToBytes`; the decimal path inherits the existing single try/catch (error-as-value, never a crash — T-12-01).
- The full suite is green (519 tests) including the 19 immovable decoder tests; `decoder.ts` + `decoder.test.ts` verified byte-for-byte untouched (`git diff --quiet`); `tsc --noEmit` clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: TDD decimalToBytes in src/lib/bytes.ts** - `78cbb143` (feat)
2. **Task 2: Widen InputEncoding + comma-first detectEncoding branch** - `ee8ea11e` (feat)
3. **Task 3: Wire decimal into the useDecode decode boundary** - `2f44b130` (feat)

_Note: Tasks 1 and 2 were executed TDD (RED tests written and confirmed failing before GREEN implementation); the RED tests and GREEN implementation were committed together per task as one coherent unit._

## Files Created/Modified
- `src/lib/bytes.ts` - Added `decimalToBytes` (strict comma/space parser, named-token errors, ReDoS-safe per-token validation).
- `src/lib/bytes.test.ts` - 12 new cases: canonical, space-only, comma+space mix, boundary 0/255, and all error shapes (999, -1, 3.5, 0x0a, abc, trailing comma, doubled comma, bracket, newline).
- `src/tools/protobuf-decoder/detectEncoding.ts` - Widened `InputEncoding` to include `"decimal"`; added the comma-first detection branch; doc comment updated (classifier stays pure).
- `src/tools/protobuf-decoder/detectEncoding.test.ts` - 4 new cases including the `1, 2, 999` → decimal anchor and the space-only `.not.toBe("decimal")` D-03 guard.
- `src/tools/protobuf-decoder/useDecode.ts` - Import `decimalToBytes`; extend the converter selection to a three-way switch (decimal → `decimalToBytes`). Try/catch and empty-state short-circuit untouched.

## Decisions Made
- **Split-on-commas-first, then spaces:** the naive single `split(/[ ,]/)` produced spurious empty tokens for the valid `", "` separator. Splitting on commas first (each segment required non-empty to honor D-05's reject-doubled/trailing-comma rule), then on spaces within each segment, cleanly distinguishes a conventional `", "` separator from a doubled `,,`. Discovered and corrected during Task 1 GREEN (within the same task, no separate commit).
- **Named tokens in errors:** out-of-range errors print the parsed number; non-integer/unparseable errors quote the raw token, so the offending value is always identifiable in a long list (D-07).
- **Detection is presence-only:** `.includes(",")` routes to decimal before any validation; the 0–255 / integer checks belong to `decimalToBytes`, keeping `detectEncoding` pure and ReDoS-free.

## Deviations from Plan

None - plan executed exactly as written. (The split-strategy correction during Task 1 GREEN was an in-task implementation refinement — the plan explicitly left the tokenizer approach to Claude's discretion as long as D-04/05/06 held — not a deviation from the plan's contract.)

## Issues Encountered
- Initial `decimalToBytes` used `split(/[ ,]/)`, which treated the two characters of a `", "` separator as two delimiters and emitted an empty token between every comma+space pair, failing the valid-list cases. Resolved by splitting on commas first (segments must be non-empty per D-05) then on spaces within each segment — all 16 bytes tests green afterward.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The entire string→bytes decimal path is complete and tested. Plan 12-02 can now surface the mode in the UI: add the `decimal` segment to the encoding override toggle (D-08), update the textarea placeholder (D-09), add the `10, 3, 80, 81, 82` example chip (D-10), and extend the e2e + phase-boundary sign-off. The widened `InputEncoding` union already flows out through `useDecode`'s re-export, so the toggle picks up `"decimal"` with no extra type plumbing.
- No blockers. `decoder.ts` + its 19 tests remain untouched (the immovable bar), confirmed by `git diff --quiet`.

## Self-Check: PASSED

All 5 modified files present on disk; all 3 task commits (`78cbb143`, `ee8ea11e`, `2f44b130`) present in git history.

---
*Phase: 12-protobuf-decimal-input*
*Completed: 2026-06-03*
