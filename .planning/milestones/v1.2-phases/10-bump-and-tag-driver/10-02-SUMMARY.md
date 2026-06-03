---
phase: 10-bump-and-tag-driver
plan: 02
subsystem: infra
tags: [release, semver, cli, tsx, pure-core, tdd]

# Dependency graph
requires:
  - phase: 09-pure-release-core-housekeeping
    provides: "version.ts — bumpSemver + setPackageJsonVersion/setTauriConfVersion/setCargoVersion (surgical, fail-loud manifest editors)"
provides:
  - "src/lib/release/bumpPlan.ts — the PURE, side-effect-free decision core of the bump driver"
  - "parseBumpArgs — D-01/D-02 CLI grammar (patch|minor|major + --dry-run only; rejects explicit version / --no-push / --skip-checks)"
  - "buildBumpPlan — single computed version threaded into 3 manifest edits + vX.Y.Z tag + chore(release) commit msg + git command list (REL-01)"
  - "assertOnlyExpectedPaths + ALLOWED_PATHS — 5-path allowlist diff tolerating the pnpm-lock no-op (REL-11)"
  - "renderDryRunPlan + renderRecovery — pure return-string builders for the dry-run plan (REL-10) and the literal copy-pasteable recovery block (D-09/D-10)"
  - "isAffirmative — confirm-default helper (true only for y/yes; default NO)"
affects: [10-03-bump-and-tag-driver-script, phase-11-build-and-publish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure decision core in src/lib/, I/O in thin caller (Plan 03's .mjs imports this)"
    - "Single-computed-version threading: bumpSemver called exactly once, result is the sole source for all derived fields"
    - "render* helpers RETURN strings (no console writes); the caller prints"

key-files:
  created:
    - "src/lib/release/bumpPlan.ts"
    - "src/lib/release/bumpPlan.test.ts"
  modified: []

key-decisions:
  - "Removed the unused version.ts import in the Task-1 commit and re-added it in Task 2 where buildBumpPlan consumes it, keeping each atomic commit tsc/eslint-clean"
  - "assertOnlyExpectedPaths requires all 3 manifests present AND rejects strays, but tolerates fewer lockfiles (pnpm-lock no-op) — empty changed set is an error"
  - "renderDryRunPlan reuses plan.gitCommands so the dry-run and the real run print identical commands"

patterns-established:
  - "Single-computed-version rule: bumpSemver called once; tag, commit message, all 3 manifest edits, and every git command derive from the one nextVersion const"
  - "Pure return-string human surfaces: dry-run + recovery text built from plan fields, zero side effects, idempotent across calls"

requirements-completed: [REL-01, REL-10, REL-11]

# Metrics
duration: 5min
completed: 2026-06-02
---

# Phase 10 Plan 02: Pure bumpPlan decision core Summary

**Side-effect-free `bumpPlan.ts` decision core — D-01/D-02 CLI grammar, a single-computed-version plan threaded into 3 manifests + tag + commit message, a pnpm-lock-no-op-tolerant allowlist diff, and pure dry-run/recovery text — all TDD-covered (47 new cases), giving REL-01/REL-10/REL-11 automated verification.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-02T21:26:19Z
- **Completed:** 2026-06-02T21:31:18Z
- **Tasks:** 4
- **Files modified:** 2 (both created)

## Accomplishments
- `parseBumpArgs` enforces the locked CLI grammar (D-01/D-02): accepts only `patch|minor|major` + `--dry-run`, order-independent; throws naming the offending token for an explicit-version arg, `--no-push`, `--skip-checks`, a duplicate level, or any unknown token — with the accepted usage in every message.
- `buildBumpPlan` calls `bumpSemver` EXACTLY ONCE (the load-bearing single-source rule, REL-01) and threads the one `nextVersion` into all three manifest `apply` closures, the `vX.Y.Z` annotated tag (D-04), the `chore(release): vX.Y.Z` commit message (D-03), and the git command list (commit pushed before tag per RESEARCH §Q6). Malformed input lets `bumpSemver`'s throw propagate (fail loud).
- `assertOnlyExpectedPaths` + `ALLOWED_PATHS` diff the changed set against the 5-path allowlist (3 manifests + 2 lockfiles), accepting the pnpm-lock no-op (4 paths) and the both-lockfiles-no-op case (3 paths), rejecting any stray path and any run missing a manifest.
- `renderDryRunPlan` / `renderRecovery` are pure return-string builders carrying the single computed version, the file edits, the lockfile regen, the git commands, and the literal copy-pasteable retry-push + `git tag -d` / `git reset --hard|--soft HEAD~1` recovery block (D-09/D-10). `isAffirmative` defaults to NO for empty/non-y input.
- Provably pure: no `node:fs` / `node:child_process` / `process.argv` / `console.*`, no top-level executable statements. Full gate green (463 vitest / 47 files, `tsc --noEmit` clean, `eslint .` clean); decoder's 19 tests untouched.

## Task Commits

Each task was committed atomically (TDD: RED tests + GREEN impl combined per task since the module is new):

1. **Task 1: parseBumpArgs + isAffirmative** - `612f07ba` (feat)
2. **Task 2: buildBumpPlan single-source threading** - `fe76c888` (feat)
3. **Task 3: assertOnlyExpectedPaths + renderDryRunPlan + renderRecovery** - `578e4a25` (feat)
4. **Task 4: Full gate + purity audit** - verification-only, no code changes (no commit)

## Files Created/Modified
- `src/lib/release/bumpPlan.ts` (262 lines) - Pure decision core: `parseBumpArgs`, `buildBumpPlan`, `assertOnlyExpectedPaths`, `renderDryRunPlan`, `renderRecovery`, `ALLOWED_PATHS`, `isAffirmative`, plus `BumpLevel`/`BumpArgs`/`ManifestEdit`/`BumpPlan` types.
- `src/lib/release/bumpPlan.test.ts` (292 lines) - 47 vitest cases covering the CLI grammar, single-computed-version threading, the allowlist diff (incl. the pnpm-lock no-op), the dry-run/recovery text, and the confirm default.

## Decisions Made
- Imported `version.ts` only in the Task-2 commit (where `buildBumpPlan` consumes the editors) rather than Task 1, so the Task-1 commit stays `tsc`/`eslint`-clean (unused-import errors otherwise). Each atomic commit independently passes the gate.
- `assertOnlyExpectedPaths` treats an empty changed set and any missing manifest as errors (a real bump always edits all 3), but tolerates fewer than 5 paths — the pnpm-lock no-op (and even a Cargo.lock no-op) are valid (RESEARCH §Q1/§P2). A naive "2 lockfiles changed" assertion would falsely fail every run.
- `renderDryRunPlan` and `renderRecovery` reuse `plan.gitCommands` / `plan.pushTarget` / `plan.tag` so the previewed and real commands are byte-identical and can never drift.

## Deviations from Plan

None - plan executed exactly as written. (Two trivial in-task adjustments, not deviations: reworded two doc comments in `bumpPlan.ts` to avoid the literal `process.argv` substring the acceptance grep forbids; and the import-ordering decision above. Both are within the plan's stated purity/acceptance constraints.)

## Issues Encountered
None. The full D-07 gate (vitest + tsc + eslint) passed cleanly at every task boundary; the decoder's 19 tests stayed green throughout.

## User Setup Required
None - no external service configuration required. This module is pure logic with no I/O.

## Next Phase Readiness
- Plan 10-03's thin `scripts/bump-and-tag.mjs` can now import this fully-tested core via `tsx` and wire only the git/pnpm/cargo/fs I/O around it. All decision logic (arg parsing, plan building, allowlist diff, dry-run/recovery text, confirm default) is unit-covered, so the driver task stays thin and the only manual-only gate is the live push (REL-04).
- REL-01/REL-10/REL-11 now have automated verification (the Wave 0 harness `bumpPlan.test.ts` exists).

## Self-Check: PASSED

- FOUND: `src/lib/release/bumpPlan.ts`
- FOUND: `src/lib/release/bumpPlan.test.ts`
- FOUND: `.planning/phases/10-bump-and-tag-driver/10-02-SUMMARY.md`
- FOUND commit `612f07ba` (Task 1), `fe76c888` (Task 2), `578e4a25` (Task 3)

---
*Phase: 10-bump-and-tag-driver*
*Completed: 2026-06-02*
