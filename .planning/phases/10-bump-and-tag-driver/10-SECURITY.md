---
phase: 10
slug: bump-and-tag-driver
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-02
---

# Phase 10 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| CLI argv → driver | The level/flag string is untrusted text that drives git tag/push operations | `patch\|minor\|major` + `--dry-run` (validated, allowlisted) |
| computed version → shelled git/pnpm/cargo | The version/tag string is passed to subprocesses | strict `MAJOR.MINOR.PATCH` from `bumpSemver` (no shell metacharacters representable) |
| working tree → git history | A lockfile/manifest diff is committed and tagged; a stray edit could be tagged if not isolated | allowlisted file set only |
| working tree → private origin | The push is the single irreversible network action against the live private remote (`bklim5/devtools`) | commit + annotated `vX.Y.Z` tag, behind preflights + TTY y/N confirm |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-10-01 | Tampering | Cargo.lock housekeeping commit | mitigate | Diff-verify only the `devtools-app` own-version line changed; explicit `git add src-tauri/Cargo.lock` (never `git add -A`). Verified: commit `8a0b2975` changed only `Cargo.lock` (1 line). | closed |
| T-10-02 | Tampering | bump-commit purity | mitigate | Deferred lock isolated into a separate commit so the later `chore(release):` commit stays diff-pure. Verified: bump commit `802707d6` touched exactly the 4 allowlisted files (1 line each), zero stray diffs. | closed |
| T-10-03 | Tampering | `parseBumpArgs` | mitigate | Allowlist level to exactly `patch\|minor\|major`, only flag `--dry-run`; throw on any other token. `bumpPlan.ts:41-69` (LEVELS:22); tested `bumpPlan.test.ts:79-99`. | closed |
| T-10-04 | Tampering | shelled git/pnpm/cargo calls + version string | mitigate | `execFileSync(file, argsArray)` throughout (`bump-and-tag.mjs:62,88`); no `execSync` string anywhere (grep clean). Version/tag derives solely from validated `bumpSemver` output (single `nextVersion`, `bumpPlan.ts:111-114`); `plan.gitCommands` strings are render-only, never executed. | closed |
| T-10-05 | Elevation/Safety | `renderDryRunPlan` / `renderRecovery` | accept | Pure return-string builders, no side effects; only risk is misleading text, mitigated by exact-content tests (`bumpPlan.test.ts:242-276`). See Accepted Risks Log. | closed |
| T-10-06 | Info disclosure | plan/recovery output (core) | mitigate | `bumpPlan.ts` reads no env/secret; helpers render only version + git commands. Purity audit: no `node:fs`/`node:child_process`/`process.argv`/`console.`. | closed |
| T-10-07 | Safety/Elevation | irreversible push (wrong branch / dup tag / dirty tree) | mitigate | `preflights()` (`bump-and-tag.mjs:122-167`): clean-tree, branch==master, tag-absent local+remote (abort if origin unreachable), vitest+tsc+eslint gate — ALL before any write. `--dry-run` short-circuits before writes; `confirmPush()` defaults NO on non-TTY/non-`y`. | closed |
| T-10-08 | Repudiation/Safety | tool-initiated destructive reset | mitigate | Script never executes `git reset`/`git tag -d` (grep clean); on decline/push-failure it only PRINTS `renderRecovery(plan)` (recovery commands exist solely inside rendered text, `bumpPlan.ts:245-250`). | closed |
| T-10-09 | Info disclosure | plan/recovery/console output (driver) | mitigate | Bump half reads/echoes no secret/token (signing env is Phase 11); output is version + git commands only. | closed |
| T-10-10 | Tampering | tagging a dirty/unexpected tree | mitigate | `commitAndTag()` calls `assertOnlyExpectedPaths(changed)` before commit, stages only allowlisted paths, and asserts a clean tree after commit before push (`bump-and-tag.mjs:206-228`); allowlist diff tested `bumpPlan.test.ts:198-240`. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-10-01 | T-10-05 | `renderDryRunPlan` / `renderRecovery` are pure string builders with no side effects. The only residual risk is misleading on-screen text (not a tampering/disclosure surface), and it is mitigated by tests asserting exact command content. No code mitigation required. | BK Lim (maintainer) | 2026-06-02 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-02 | 10 | 10 | 0 | gsd-security-auditor (ASVS L1) |

**Cross-check:** Code review (`10-REVIEW.md`) found 0 critical; WR-01 (post-tag failure printed no recovery) is FIXED (commit `0c936193` — `taggedPlan` sentinel + throw-routing), which strengthens T-10-07/T-10-08/T-10-10. WR-02/WR-03 and IN-01..04 are fail-safe robustness/clarity items; no threat disposition depends on them.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-02
