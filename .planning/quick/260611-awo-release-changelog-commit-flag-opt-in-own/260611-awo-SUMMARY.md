---
phase: quick-260611-awo
plan: "01"
subsystem: release-tooling
tags: [changelog, cli, git, release]
requires:
  - "src/lib/release/changelog.ts pure core (appendUnreleasedEntry et al.)"
  - "scripts/bump-and-tag.mjs execFileSync argv-array idiom"
provides:
  - "parseChangelogArgs / changelogCommitMessage / CHANGELOG_USAGE pure exports"
  - "pnpm release:changelog \"<entry>\" --commit opt-in pathspec commit"
affects:
  - "release workflow: log + commit in one step before release:bump"
tech-stack:
  added: []
  patterns:
    - "pure argv grammar in src/lib (parseBumpArgs precedent), thin .mjs driver"
    - "git pathspec commit (`-- CHANGELOG.md`) to isolate from pre-staged files"
key-files:
  created: []
  modified:
    - src/lib/release/changelog.ts
    - src/lib/release/changelog.test.ts
    - scripts/changelog.mjs
decisions:
  - "--commit accepted at any argv position; duplicates tolerated"
  - "any non---commit token starting with -- throws with usage (typo'd flag never logged as changelog text)"
  - "--commit without an entry rejected (not query mode) — ambiguous intent"
  - "pathspec commit `git commit -m <msg> -- CHANGELOG.md` so pre-staged unrelated files stay staged/dirty untouched"
  - "git failure keeps the on-disk edit + prints manual-recovery note, exit 1 — never retry/reset"
metrics:
  duration: "~7 min"
  completed: "2026-06-11"
  tasks: 2
  files: 3
---

# Quick 260611-awo: release:changelog --commit flag (opt-in own commit) Summary

Opt-in `--commit` flag on `pnpm release:changelog` makes the script create its own `docs(changelog): <entry>` pathspec commit of CHANGELOG.md alone, via a new pure argv grammar (`parseChangelogArgs`) mirroring `parseBumpArgs`.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Pure core — parseChangelogArgs + changelogCommitMessage (with tests) | fc46ef67 | src/lib/release/changelog.ts, src/lib/release/changelog.test.ts |
| 2 | Wire --commit into scripts/changelog.mjs (pathspec commit) | b51f2ed0 | scripts/changelog.mjs |

## What was built

- **`parseChangelogArgs(argv)`** (pure, zero builtins): `{ mode: "query" }` for empty/whitespace argv; `{ mode: "append", entry, commit }` otherwise, `--commit` extracted at any position; throws with `CHANGELOG_USAGE` on entry-less `--commit` or any unknown `--`-leading token. 11 new tests.
- **`changelogCommitMessage(entry)`**: `docs(changelog): <normalized>` using the same one-leading-dash-strip rule as `appendUnreleasedEntry`, so subject == bullet text; throws on empty. 5 new tests.
- **`CHANGELOG_USAGE`** exported as the single usage source of truth (driver's local `USAGE` const deleted).
- **Driver**: `main()` routes through the parser (parse throw → stderr + exit 1); query and no-flag append paths behaviorally unchanged; `--commit` runs `git add -- CHANGELOG.md` (untracked-bootstrap case) then `git commit -m <msg> -- CHANGELOG.md` via an argv-array `execFileSync` helper mirroring bump-and-tag's `run()`. Git failure keeps the edit on disk, prints a recovery note, exits 1.

## Verification

- `pnpm vitest run src/lib/release/changelog.test.ts` — 47/47 (31 pre-existing untouched + 16 new).
- `pnpm exec tsc --noEmit` + `pnpm lint` clean; lefthook pre-commit ran the full suite (816 tests, 65 files) green on both commits. Decoder's 19 tests untouched.
- Codex review (`--wait --scope working-tree`) per task: Task 1 review's only P1 was "driver not wired yet" (= Task 2, by design); Task 2 review: no issues.
- **Real-repo smoke (then restored exactly):** `pnpm release:changelog "smoke test entry" --commit` → one commit `docs(changelog): smoke test entry`, `git log -1 --stat` = CHANGELOG.md only (2+/1-); other dirty files (.planning/*, scripts) untouched; CHANGELOG.md clean afterwards (the property bump's preflight needs). Restored via `git reset --soft HEAD^` + `git restore --staged CHANGELOG.md` + byte-exact content restore (`cmp` verified, `git status --short` diff identical, HEAD back to fc46ef67).
- Rejection smokes: `pnpm release:changelog` → usage + Unreleased block, exit 0; `--commit` alone → exit 1 with usage; `--comit` typo → exit 1 with usage, no file edit.
- Zero new dependencies (node builtins only in the driver; pure module imports nothing).

## Deviations from Plan

**1. [Constraint] `pnpm release:bump patch --dry-run` post-smoke preflight not run**
- **Found during:** Task 2 verification
- **Issue:** A parallel agent's in-progress changes (.planning/STATE.md, a SUMMARY, protobuf-decoder work) keep the working tree dirty, so bump's clean-tree preflight would fail for reasons unrelated to this change; the plan's own scenario is "when CHANGELOG.md was the only dirt".
- **Mitigation:** The equivalent property was proven directly in the smoke — immediately after `--commit`, CHANGELOG.md no longer appears in `git status` (its dirt is committed), which is exactly what the bump preflight checks.

**2. [Constraint] Smoke restore used `reset --soft` + content restore instead of the plan's `git reset --hard HEAD~1`**
- **Reason:** Orchestrator constraint — `--hard` would have destroyed the parallel agent's working-tree changes. Restoration verified byte-exact.

## Known Stubs

None — no UI surface; all paths wired and smoke-proven.

## Threat Flags

None beyond the plan's register. All mitigations applied: T-Q-AWO-01 (execFileSync argv arrays, no shell), T-Q-AWO-02 (pathspec commit, proven by smoke with pre-existing dirty files), T-Q-AWO-03 (unknown `--flag` throws), T-Q-AWO-04 (edit kept on git failure, accepted).

## Self-Check: PASSED

- src/lib/release/changelog.ts, changelog.test.ts, scripts/changelog.mjs exist with required exports/patterns (parseChangelogArgs, changelogCommitMessage, CHANGELOG_USAGE, execFileSync, `-- CHANGELOG.md` pathspec).
- Commits fc46ef67 and b51f2ed0 on master.
