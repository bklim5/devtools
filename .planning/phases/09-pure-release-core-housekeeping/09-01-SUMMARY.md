---
phase: 09-pure-release-core-housekeeping
plan: 01
subsystem: infra
tags: [release, semver, tauri, cargo, version-bump, pure-logic, vitest]

# Dependency graph
requires:
  - phase: 07-formatters
    provides: the src/lib/format/ co-located pure-logic + vitest convention this mirrors
provides:
  - "src/lib/release/version.ts — bumpSemver (hand-rolled MAJOR.MINOR.PATCH) + setPackageJsonVersion + setTauriConfVersion + setCargoVersion surgical string editors"
  - "version.test.ts — 25 cases incl. the setCargoVersion [package]-scoped / dependency-pin-untouched proof and all bumpSemver throw paths"
  - "src-tauri/Cargo.toml [package].version reconciled 0.1.0 -> 0.2.1 (dependency pins untouched)"
  - "confirmed latest.json untracked + /latest.json gitignored (verify-only no-op)"
affects: [10-bump-and-tag, 11-build-and-publish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Surgical single-line string->string manifest version edits (no JSON.parse round-trips); fail loudly on 0 or >1 matches"
    - "Hand-rolled semver bump (zero deps) as the single computed source of truth for the next version"
    - "Dogfood the pure transform against the real file for one-time reconciles (D-07)"

key-files:
  created:
    - src/lib/release/version.ts
    - src/lib/release/version.test.ts
  modified:
    - src-tauri/Cargo.toml

key-decisions:
  - "Count regex matches with a global-cloned regex (non-global .match returns [full, g1, g2] = length 3, which miscounts)"
  - "Isolate the Cargo [package] section header-to-next-[ before matching its version line so dependency pins in other sections are never touched"
  - "Restore Cargo.lock after the reconcile — lockfile regen belongs to Phase 10"

patterns-established:
  - "src/lib/release/ co-located source + test, pure (no I/O / React / DOM / platform / fs), zero new deps — mirrors src/lib/format/"
  - "Every manifest editor anchors precisely and throws a file-named error on 0 or >1 matches (T-09-01 mitigation)"

requirements-completed: [REL-02, REL-08]

# Metrics
duration: 64min
completed: 2026-06-02
---

# Phase 09 Plan 01: Pure release version core + housekeeping Summary

**Hand-rolled `bumpSemver` plus three surgical `setXVersion` string editors in a new `src/lib/release/version.ts` (zero deps, 25 vitest cases incl. the `[package]`-scoped Cargo dependency-pin proof), then dogfooded `setCargoVersion` to reconcile `Cargo.toml` 0.1.0 -> 0.2.1.**

## Performance

- **Duration:** ~64 min
- **Started:** 2026-06-02T17:54:55Z
- **Completed:** 2026-06-02T18:58:36Z
- **Tasks:** 3
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- `bumpSemver` — strict `^\d+\.\d+\.\d+$` parse, standard patch/minor/major rollover from a single computed source, throws clearly on malformed input and unknown level (D-02/D-02a).
- Three surgical `string->string` manifest editors (`setPackageJsonVersion`, `setTauriConfVersion`, `setCargoVersion`) that rewrite ONLY the version line, preserve every other byte, and throw on 0 or >1 matches (D-01/D-01a, T-09-01). `setCargoVersion` is provably `[package]`-scoped, leaving dependency `version = "..."` pins untouched.
- 25 unit tests including the load-bearing `setCargoVersion` dependency-pin-untouched proof and every `bumpSemver` throw path — auto-covered by the existing vitest/tsc/eslint gate, no new wiring.
- `src-tauri/Cargo.toml` `[package].version` reconciled `0.1.0 -> 0.2.1` by dogfooding the real `setCargoVersion` against the actual file (D-07); `git diff` shows ONLY line 3 changed.
- Confirmed `latest.json` untracked (`git ls-files` empty) and `/latest.json` gitignored — verify-only no-op (REL-08, D-06); on-disk copy left intact.

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement bumpSemver + the three version editors** - `71cfaeff` (feat)
2. **Task 2: version.test.ts incl. setCargoVersion dependency-pin proof** - `6939c299` (test; also carried the Task 1 match-count fix)
3. **Task 3: Dogfood setCargoVersion to reconcile Cargo + verify latest.json** - `2b5064f3` (chore)

_TDD note: Task 2's commit also folds in the match-count bug fix to `version.ts` that the test exposed (RED -> GREEN -> fix in one logical change)._

## Files Created/Modified
- `src/lib/release/version.ts` - `bumpSemver` + the three surgical manifest version editors (pure, zero deps).
- `src/lib/release/version.test.ts` - 25 vitest cases covering rollover, all throw paths, surgical-rewrite proofs, and the `setCargoVersion` `[package]`-scoped / dependency-pin-untouched proof.
- `src-tauri/Cargo.toml` - `[package].version` reconciled `0.1.0 -> 0.2.1` (dependency pins byte-identical).

## Decisions Made
- **Match counting via a global-cloned regex.** `String.prototype.match` with a non-global regex returns `[fullMatch, group1, group2]` (length 3), which the 0/>1 guard misread as ">1 match". Switched the count to a `g`-flagged clone of the same pattern; the replace still uses the single-match regex.
- **Cargo `[package]` section isolation.** `setCargoVersion` first slices the `[package]` section (header up to the next `[` section header) and only matches the bare `version = "..."` line within it, so inline-table dependency pins like `tauri-build = { version = "2", ... }` in other sections can never be hit.
- **Cargo.lock left to Phase 10.** A Cargo invocation in the environment mirrored the package's own version entry into `Cargo.lock`; restored it to HEAD because lockstep + lockfile regen is explicitly Phase 10's job.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Match-count guard miscounted via non-global `.match`**
- **Found during:** Task 2 (writing version.test.ts — the "changes ONLY the [package] version line" case)
- **Issue:** `replaceSingleVersion` counted matches with `content.match(re)` where `re` was non-global, so a single match returned `[full, g1, g2]` (length 3) and the `count !== 1` guard threw `expected exactly one version match, found 3` on valid input.
- **Fix:** Count occurrences with a `g`-flagged clone of the pattern (`new RegExp(re.source, flags+"g")`); the replace still uses the original single-match regex.
- **Files modified:** src/lib/release/version.ts
- **Verification:** All 25 version tests pass; full suite 403/403 green; tsc + eslint clean.
- **Committed in:** `6939c299` (Task 2 commit)

**2. [Rule 1 - Bug] Unnecessary regex escape flagged by eslint**
- **Found during:** Task 1 (eslint gate after writing version.ts)
- **Issue:** `[^\[]` inside a character class triggered `no-useless-escape` (the `[` needs no escaping inside `[...]`).
- **Fix:** Changed to `[^[]`.
- **Files modified:** src/lib/release/version.ts
- **Verification:** `npx eslint src/lib/release/` clean; tsc clean.
- **Committed in:** `71cfaeff` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs, both in the just-written code).
**Impact on plan:** Both fixes were in this plan's own new code, necessary for correctness. No scope creep; all behaviors and success criteria met as specified.

## Issues Encountered
- The reconcile `tsx` snippet had to be written into the repo root (not `/tmp`) so its relative `./src/lib/release/version.ts` import resolved; it was removed immediately after running (no stray file committed).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `version.ts` exports the exact four contracts Phase 10's `bump-and-tag.mjs` imports (`bumpSemver` + the three `setXVersion` editors), starting from a verified, drift-free state.
- Cargo `[package].version` now matches `package.json` / `tauri.conf.json` (all 0.2.1); the first real bump in Phase 10 begins from lockstep parity.
- Reminder for Phase 10: `Cargo.lock` regeneration (and the lockstep 3-file write + tag/push) is its job — this plan deliberately left the lockfile at HEAD.

## Self-Check: PASSED

All created files exist on disk (`src/lib/release/version.ts`, `src/lib/release/version.test.ts`) and the reconciled `src-tauri/Cargo.toml` is present; all three task commits (`71cfaeff`, `6939c299`, `2b5064f3`) are in git history.

---
*Phase: 09-pure-release-core-housekeeping*
*Completed: 2026-06-02*
