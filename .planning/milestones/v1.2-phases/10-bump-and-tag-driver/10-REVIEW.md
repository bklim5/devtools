---
phase: 10-bump-and-tag-driver
reviewed: 2026-06-02T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/lib/release/bumpPlan.ts
  - src/lib/release/bumpPlan.test.ts
  - scripts/bump-and-tag.mjs
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-06-02T00:00:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Reviewed the Phase 10 bump-and-tag helper: a pure decision core (`bumpPlan.ts`) and a thin I/O driver (`bump-and-tag.mjs`). The overall design is sound and the stated safety invariants hold up under inspection:

- **Command/shell injection: clean.** Every subprocess goes through `execFileSync(file, argsArray, ...)` with an argv array — there is no `execSync`-with-string anywhere, so the version/tag strings never touch a shell. The one place strings *look* shell-bound (`plan.gitCommands` in `bumpPlan.ts`) is documentation-only text rendered for the dry-run/recovery output; it is never executed. Good.
- **Irreversible-action safety: strong.** Tag/push are gated behind a full read-only preflight battery (clean tree, branch==master, tag absent locally AND on origin, vitest+tsc+eslint gate), a TTY-guarded `y/N` that defaults to NO (including the non-TTY decline), and `--dry-run` that short-circuits before any write. The script never auto-runs `git reset`/`git tag -d` — it only prints recovery text. `ls-remote` unreachable correctly aborts rather than risking a duplicate remote tag.
- **The porcelain-parsing fix is sound.** `run(..., { raw: true })` in `changedPaths()` preserves the byte-exact stdout so `line.slice(3)` lands on the path (porcelain format is `XY<space>path`, path at index 3). A blanket `.trim()` would have eaten the leading status space of the first line and mis-sliced it. The fix is correctly scoped to only this one caller; all other `run()` consumers still get the convenient trim. Verified no sibling mis-parse: `branch` (`rev-parse --abbrev-ref`) and `remoteTag.stdout` are single-token/whitespace-tolerant, so trimming them is correct.

The issues below are about **failure/recovery completeness** and a couple of **porcelain edge cases** — not injection or core-logic bugs. None are blocking, but WR-01 is worth fixing before relying on this for real releases.

## Warnings

### WR-01: A subprocess failure after the tag is created prints no recovery text

**File:** `scripts/bump-and-tag.mjs:280-281, 199-219, 302-307`
**Issue:** `regenLockfiles()` and `commitAndTag()` issue their mutations via `run(...)` with `allowFailure` defaulting to `false`, so any non-zero exit throws. Those throws are caught only by the top-level `main().catch` (line 302), which prints `bump failed: <msg>` and exits — with **no recovery block**. The problem is that `commitAndTag()` can fail *after* it has already created the commit and/or the annotated tag: e.g. `git tag -a` succeeds (line 211) but the post-commit clean-tree assertion aborts (line 215), or some later step throws. At that point the local commit + tag exist, but the maintainer is told nothing about how to retry or undo — exactly the state `renderRecovery()` exists to explain. Only the `push()` path (line 244) and the explicit decline path (line 292) print recovery today.
**Fix:** Track whether the tag has been created and route post-tag failures through recovery. For example, wrap the post-write pipeline so that once `commitAndTag` has run, any thrown error prints `renderRecovery(plan)` before exiting:
```js
// in main(), after writeManifests/regenLockfiles/commitAndTag:
let tagged = false;
try {
  writeManifests(plan);
  regenLockfiles();
  commitAndTag(plan);
  tagged = true;
  // ...confirm + push...
} catch (err) {
  logErr(`\nbump failed: ${err?.message ?? err}`);
  if (tagged) logErr(`\n${renderRecovery(plan)}`);
  process.exit(1);
}
```
Note the line 215 `abort()` (clean-tree-after-commit) calls `process.exit(1)` directly and so bypasses any try/catch — it should also emit recovery, since the tag already exists at that point.

### WR-02: `changedPaths()` mis-handles renamed and quoted porcelain entries

**File:** `scripts/bump-and-tag.mjs:110-116`
**Issue:** `line.slice(3)` assumes every porcelain line is `XY<space><path>`. Two porcelain shapes break this:
1. **Renames/copies** are emitted as `R  old -> new` (and `C  old -> new`), so `slice(3)` yields the literal string `old -> new`, not a real path. That string is not in the allowlist, so `assertOnlyExpectedPaths` would reject it — which is *fail-safe* (it aborts rather than tags wrongly), but the error message would be confusing.
2. **Paths with special characters** (spaces, non-ASCII, control chars) are emitted **quoted and C-escaped** by git (e.g. `"src-tauri/odd name.toml"`), so `slice(3)` returns a quoted string that won't match the allowlist either.
Because the bump only ever touches fixed ASCII manifest/lock paths, neither case should arise from a legitimate bump, and both fail closed (abort, never mis-tag). So this is a robustness/clarity issue, not a safety hole — but the preflight "working tree is dirty" check at line 126 also runs through this parser, and a pre-existing rename in the tree would produce a confusing changed-path count.
**Fix:** Parse with porcelain's documented format, or switch to `git status --porcelain -z` (NUL-separated, and renames come as `new\0old`) for unambiguous splitting. Minimally, document that `slice(3)` is only valid because the allowlist rejects anything unexpected, and that the dirty-tree preflight reports raw lines. Given the preflight requires a fully clean tree before any bump, the simplest robust option is to keep the strict parse but make the dirty-tree abort echo the raw `git status --porcelain` output so the maintainer sees what is dirty.

### WR-03: `git push origin master` hard-codes the branch name and bypasses upstream tracking

**File:** `src/lib/release/bumpPlan.ts:143` and `scripts/bump-and-tag.mjs:240`
**Issue:** The push target branch `master` is hard-coded in two places (the rendered command in the core and the real `execFileSync` in the driver). The preflight does assert `branch === "master"` (line 133), so the local branch is guaranteed to be master at push time, making the hard-code *consistent*. However, `git push origin master` pushes to `refs/heads/master` on origin regardless of the local branch's configured upstream. If the repo's `master` tracked a differently-named remote branch, or push.default conventions differ, this would silently push to the wrong (or a new) remote ref. For this single-maintainer repo with a conventional `origin/master` it is fine, but the duplication means a future rename of the default branch must be changed in two files in lockstep.
**Fix:** Either keep `master` but centralize it as a single named constant in `bumpPlan.ts` that both the rendered command and the driver consume (so they can't drift), or push the validated current branch explicitly, e.g. capture `branch` from the preflight and pass it to `push()` so the rendered recovery text and the real push always agree on the same branch string.

## Info

### IN-01: `readCurrentVersion` has an unreachable return after a failed `abort`

**File:** `scripts/bump-and-tag.mjs:101-107`
**Issue:** When `pkg.version` is not a string, `abort(...)` is called — which runs `process.exit(1)` and never returns. Control therefore never reaches `return pkg.version` in the failure case, but a reader cannot tell that `abort` is `-> never` from the call site (it isn't typed, and this is plain `.mjs`). If `abort` were ever changed to not exit, this function would return `undefined` and feed it into `buildBumpPlan`. Minor, but the implicit "abort never returns" contract is load-bearing in several spots (e.g. line 126, 133).
**Fix:** Either annotate `abort` as never-returning (a JSDoc `@returns {never}`), or `throw` from `abort` instead of `process.exit` and let a single top-level handler exit, so the control flow is explicit to both readers and tooling.

### IN-02: Top-level catch label ("bump failed") differs from the abort label ("bump aborted") without explanation

**File:** `scripts/bump-and-tag.mjs:90, 95, 305`
**Issue:** Three different abort/failure phrasings exist — `gate failed:` (line 90), `bump aborted:` (line 95), and `bump failed:` (line 305). They map to meaningfully different states (a gate check vs. a preflight refusal vs. an uncaught throw), which is good, but nothing documents the taxonomy, so a maintainer triaging output can't immediately tell whether local state was mutated. Tie-in with WR-01: "bump failed" is exactly the message that may appear *after* a tag was created, yet it currently carries no recovery hint.
**Fix:** Add a one-line comment near `abort`/`main().catch` documenting the three states and which ones can leave a local commit/tag behind, and (per WR-01) attach recovery text to the post-tag failure case.

### IN-03: `cargo update -p devtools-app` package name is an undocumented coupling

**File:** `scripts/bump-and-tag.mjs:190`
**Issue:** The relock targets the crate name `devtools-app` literally. Confirmed correct against `src-tauri/Cargo.toml` (`name = "devtools-app"`). But this string is decoupled from the manifest it must track: if the crate is ever renamed, `cargo update -p devtools-app` fails with a non-obvious error and the bump aborts. The comment explains *why* `-p` (surgical single-package relock) but not that the literal name must match `[package].name`.
**Fix:** Add a comment noting the name must match `src-tauri/Cargo.toml [package].name`, or derive it (the version core already parses the `[package]` section; the package name could be surfaced the same way to keep them from drifting).

### IN-04: `pnpm-lock.yaml` is in the allowlist but never explicitly staged when it does change

**File:** `src/lib/release/bumpPlan.ts:163-169` and `scripts/bump-and-tag.mjs:203-206`
**Issue:** `ALLOWED_PATHS` and `commitAndTag` correctly handle the lockfiles dynamically — `toStage = changed.filter(p => ALLOWED.has(p))` stages whatever actually changed, so a (rare) pnpm-lock change *would* be staged and committed. That is correct. The only nuance: `stagePaths` in the core (lines 133-138) lists `pnpm-lock.yaml`'s sibling `Cargo.lock` explicitly but **omits `pnpm-lock.yaml`** from the rendered `git add` command, while the real driver stages dynamically. So the dry-run text and the real behavior can diverge in the (documented-as-rare) case where pnpm-lock does change: the dry-run would not show it being added, but the real run would add it. Cosmetic, since the driver does the right thing.
**Fix:** For dry-run/real parity, either add `pnpm-lock.yaml` to the rendered `stagePaths` with a "(if changed)" note, or render the `git add` line generically (e.g. `git add <changed allowlisted paths>`) so the rendered plan can't claim a more specific set than the driver actually stages.

---

_Reviewed: 2026-06-02T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
