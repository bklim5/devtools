---
phase: 10-bump-and-tag-driver
plan: 03
subsystem: infra
tags: [release-tooling, semver, git-tag, tsx, execFileSync, bump-and-tag, pnpm-script]

# Dependency graph
requires:
  - phase: 09-pure-release-core
    provides: "src/lib/release/version.ts (bumpSemver + three surgical setXVersion editors)"
  - phase: 10-bump-and-tag-driver (Plan 02)
    provides: "src/lib/release/bumpPlan.ts pure core (parseBumpArgs/buildBumpPlan/assertOnlyExpectedPaths/renderDryRunPlan/renderRecovery/isAffirmative/ALLOWED_PATHS)"
  - phase: 10-bump-and-tag-driver (Plan 01)
    provides: "Cargo.lock 0.1.0->0.2.1 reconcile (clean tree for the D-08 preflight)"
provides:
  - "scripts/bump-and-tag.mjs: thin Node ESM I/O driver wrapping the Plan 02 pure core — preflights -> lockstep 3-manifest write -> lockfile regen+stage -> commit -> annotated tag -> y/N confirm -> push commit-then-tag to origin"
  - "package.json release:bump script (tsx scripts/bump-and-tag.mjs) — the real maintainer command"
  - "Verified --dry-run zero-side-effect path + three fail-fast preflight aborts (dirty tree / non-master / existing tag)"
  - "A real, pushed release: chore(release): v0.2.2 commit + annotated tag v0.2.2 on origin (bklim5/devtools)"
affects: [phase-11-build-and-publish, release-process, REL-04, REL-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Thin .mjs I/O driver imports the pure .ts core via tsx (no build step); all decision logic stays in the unit-tested core"
    - "execFileSync with argv ARRAYS for every git/pnpm/cargo call (no execSync string interpolation — shell-injection guard T-10-04)"
    - "Read git porcelain RAW (untrimmed) — the leading status-code columns are significant for slice(3) path extraction"
    - "Stage-only-if-changed allowlist diff: tolerate the pnpm-lock no-op (3/4/5 paths all valid), abort on any stray before the tag"
    - "Script NEVER executes git reset / git tag -d — on decline/push-fail it only PRINTS the copy-pasteable recovery (D-09/D-10)"

key-files:
  created:
    - "scripts/bump-and-tag.mjs"
  modified:
    - "package.json (release:bump script)"
    - "src-tauri/tauri.conf.json (0.2.1 -> 0.2.2, by the real bump)"
    - "src-tauri/Cargo.toml (0.2.1 -> 0.2.2, by the real bump)"
    - "src-tauri/Cargo.lock (devtools-app 0.2.1 -> 0.2.2, by the real bump)"

key-decisions:
  - "run() got a `raw` option; changedPaths() reads porcelain untrimmed so the first changed path is not mangled (fix commit 365d341f)"
  - "The real push (REL-04) was the single documented manual-only verification — maintainer-gated, irreversible, network-bound"

patterns-established:
  - "Pure-core + thin-driver split: bumpPlan.ts owns all decisions (47 unit tests); bump-and-tag.mjs owns only fs/git/cargo/pnpm I/O + the two human-facing print surfaces"
  - "Raw vs trimmed subprocess output: trim is the convenient default, but porcelain/columnar git output must be read raw"

requirements-completed: [REL-01, REL-03, REL-04, REL-10, REL-11]

# Metrics
duration: ~spanned the human-gated checkpoint
completed: 2026-06-02
---

# Phase 10 Plan 03: bump-and-tag Driver Summary

**`scripts/bump-and-tag.mjs` wires the pure bumpPlan core to real git/pnpm/cargo I/O behind `pnpm release:bump`, and cut the live v0.2.2 release — lockstep 3-manifest bump, regenerated lockfiles, annotated `v0.2.2` tag, and commit+tag pushed to the private origin after a y/N confirm.**

## Performance

- **Duration:** Spanned the human-gated live-push checkpoint (Task 3, REL-04)
- **Completed:** 2026-06-02
- **Tasks:** 3 (2 autonomous + 1 human-gated checkpoint)
- **Files modified:** 2 driver files (`scripts/bump-and-tag.mjs`, `package.json`) + 3 manifests + 1 lockfile touched by the real bump

## Accomplishments

- **The real maintainer command exists and works end-to-end.** `pnpm release:bump patch|minor|major` reads the current version, computes ONE next version via the Plan 02 core, and threads it identically into `package.json` + `src-tauri/tauri.conf.json` + `src-tauri/Cargo.toml` (`[package]` only), regenerates + stages `pnpm-lock.yaml` (no-op, root version not recorded) and `Cargo.lock`, commits `chore(release): vX.Y.Z`, creates the annotated `vX.Y.Z` tag, and after a TTY-guarded y/N confirm pushes the commit then the tag to `origin`.
- **Live release cut and verified:** `chore(release): v0.2.2` (commit `802707d6`) + annotated tag `v0.2.2` are on the private origin (`git ls-remote --tags origin v0.2.2` returns `b210ed19…`). All three manifests + `Cargo.lock` read `0.2.2`; working tree clean.
- **Safety rails proven before the irreversible push:** `--dry-run` changes zero files / performs zero git/network actions; the dirty-tree, non-master, and existing-tag preflights each abort non-zero BEFORE any write (REL-10/REL-11).
- **Zero new dependencies; decoder + its 19 tests untouched.** The driver is a thin `.mjs` over the already-tested pure core, run via the existing `tsx`.

## Task Commits

1. **Task 1: Write scripts/bump-and-tag.mjs + wire release:bump** — `a74cfc1b` (feat) — 301-line driver + `package.json` `release:bump` script.
2. **Task 2: Verify --dry-run zero side effects + preflight aborts** — verification-only (no code change required to pass), then the porcelain-raw bug surfaced and was fixed at `365d341f` (fix) during the live run (see Deviations).
3. **Task 3: Human-gated real bump + push (REL-04)** — the live release commit `802707d6` (`chore(release): v0.2.2`) + annotated tag `v0.2.2`, pushed to origin by the maintainer.

**Plan metadata:** committed separately (docs: complete plan — this SUMMARY + STATE.md + REQUIREMENTS.md).

## Files Created/Modified

- `scripts/bump-and-tag.mjs` — Thin Node ESM I/O driver: parse args -> read current version -> all read-only preflights (clean tree, branch==master, tag absent local+remote, vitest+tsc+eslint gate) -> `--dry-run` short-circuit (zero side effects) -> apply 3 manifest edits -> `pnpm install --lockfile-only --offline` + `cargo update -p devtools-app --offline` (cwd src-tauri) -> allowlist diff -> stage-only-if-changed -> commit -> annotated tag -> clean-tree assert -> print push plan -> y/N (node:readline/promises, isTTY-guarded) -> push commit then tag, with `renderRecovery` printed on decline/failure (never a tool-initiated reset).
- `package.json` — added `"release:bump": "tsx scripts/bump-and-tag.mjs"`.
- `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` — bumped `0.2.1 -> 0.2.2` by the real `release:bump patch` run (commit `802707d6`).

## Decisions Made

- **`run()` gained a `raw` option; `changedPaths()` reads porcelain untrimmed.** The global trim convenience was the right default for most subprocess output but wrong for columnar git porcelain — the fix scopes the rawness to exactly where it matters rather than removing trim everywhere.
- **The real push stayed maintainer-gated.** Per 10-VALIDATION.md, the irreversible network push to the private origin is the single documented manual-only verification; the executor automated everything up to the prompt and paused.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `git status --porcelain` was globally trimmed, mangling the first changed path**
- **Found during:** Task 3 (the live `pnpm release:bump patch` run — the bug only surfaced against a real dirty tree at allowlist-diff time, which the dry-run/preflight paths in Task 2 never exercised)
- **Issue:** The driver's `run()` helper trimmed all subprocess stdout. For `git status --porcelain`, that stripped the significant leading space of the FIRST status line, so `changedPaths()`'s `slice(3)` over-consumed and mangled the first changed path (`package.json` -> `ackage.json`). `assertOnlyExpectedPaths` then saw a stray path and aborted the bump.
- **Fix:** Added a `raw` option to `run()` and made `changedPaths()` read porcelain untrimmed, so each line's leading status columns are preserved and `slice(3)` extracts the correct path.
- **Files modified:** `scripts/bump-and-tag.mjs`
- **Verification:** Reproduced against the dirty tree (abort observed), then re-verified via `--dry-run` and a full non-interactive real run (commit+tag created, then undone), then the maintainer re-ran interactively and pushed for real. Final end-state: `802707d6 chore(release): v0.2.2` + tag `v0.2.2` on origin, all manifests at 0.2.2, clean tree.
- **Committed in:** `365d341f` (`fix(10-03): read git porcelain raw so first changed path is not mangled`)

---

**Total deviations:** 1 auto-fixed (1 bug, Rule 1)
**Impact on plan:** The fix was load-bearing for correctness — without it `release:bump` aborts on every real run. No scope creep: the change is a one-helper-option fix scoped to porcelain parsing; the pure core and the rest of the pipeline were unchanged. The bug was invisible to Task 2's automated checks (dry-run/preflights never reach the post-write allowlist diff), which is exactly why the human-gated live run is the documented verification for REL-04.

## Issues Encountered

- The porcelain-trim bug (above) is the only issue; resolved at `365d341f`. It is a textbook case of the "raw vs trimmed subprocess output" hazard now recorded as a pattern.

## User Setup Required

None — no external service configuration required. The release flow uses the maintainer's existing local `git` auth to the private origin; no tokens are read or echoed by the script (confirmed during Task 3 step 6).

## Next Phase Readiness

- **Phase 10 complete** (all 5 mapped requirements — REL-01, REL-03, REL-04, REL-10, REL-11 — delivered and live-verified). The bump half of the release pipeline is done; `v0.2.2` is the live tag on origin.
- **Phase 11 (`build-and-publish`)** depends on Phase 9's `manifest.ts` + this phase's tag, and remains the FLAGGED phase — its universal-binary dual-arch updater behavior must be proven by a real updater round-trip (the milestone's load-bearing human gate).
- The `--dry-run` and preflight half of REL-10/REL-11 established here is the pattern Phase 11's build/publish driver reuses.

## Self-Check: PASSED

- FOUND: `scripts/bump-and-tag.mjs`
- FOUND: `.planning/phases/10-bump-and-tag-driver/10-03-SUMMARY.md`
- FOUND commit `a74cfc1b` (feat: driver + wiring)
- FOUND commit `365d341f` (fix: porcelain raw)
- FOUND commit `802707d6` (chore(release): v0.2.2)
- FOUND `release:bump` in `package.json`
- Verified live: tag `v0.2.2` on origin (`b210ed19…`); all 3 manifests + `Cargo.lock` at `0.2.2`; working tree clean.

---
*Phase: 10-bump-and-tag-driver*
*Completed: 2026-06-02*
