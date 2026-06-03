# Phase 10: bump-and-tag driver - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-02
**Phase:** 10-bump-and-tag-driver
**Areas discussed:** Commit & tag shape, Push & confirm policy, Preflight check gate, Failure recovery, CLI grammar

---

## Commit & tag shape

| Option | Description | Selected |
|--------|-------------|----------|
| chore(release): vX.Y.Z | Conventional-commit style, matches repo history, greppable for later CI trigger | ✓ |
| release: vX.Y.Z | Shorter, no scope | |
| vX.Y.Z (bare) | Just the version as subject | |

| Option | Description | Selected |
|--------|-------------|----------|
| Annotated, message `vX.Y.Z` | `git tag -a vX.Y.Z -m "vX.Y.Z"`; git-recommended for releases | ✓ |
| Annotated + release notes | Tag carries real notes; risks duplication with Phase 11 Release body | |
| Lightweight tag | Pointer only, no metadata; discouraged for releases | |

**User's choice:** `chore(release): vX.Y.Z` commit + annotated tag with message `vX.Y.Z`.
**Notes:** Release notes kept out of the tag — they belong in the Phase 11 GitHub Release body.

---

## Push & confirm policy

| Option | Description | Selected |
|--------|-------------|----------|
| Print plan + confirm | Local work first, print push plan, y/N confirm before push | ✓ |
| Auto-push, no prompt | Push automatically after preflights | |
| Tag local, never push | Always stop after local tag (contradicts criterion #3) | |

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, add --no-push | Escape hatch to skip push | |
| No, keep it minimal | Only --dry-run + confirm prompt | ✓ |

**User's choice:** Local-first → print push plan → y/N confirm → push. Flags limited to `--dry-run` (no `--no-push`).
**Notes:** The confirm prompt already covers "don't push yet," so a separate flag is unnecessary.

---

## Preflight check gate

| Option | Description | Selected |
|--------|-------------|----------|
| Script runs them | Preflight invokes checks itself, aborts on failure | ✓ |
| Assume already run | Only git-state checks, trust manual test run | |

| Option | Description | Selected |
|--------|-------------|----------|
| vitest + tsc + eslint | Full Phase 9 gate | ✓ |
| vitest + tsc only | Exactly criterion #5's wording | |

| Option | Description | Selected |
|--------|-------------|----------|
| No escape hatch | Checks always run on a real bump | ✓ |
| Yes, add --skip-checks | Bypass tests/lint (foot-gun) | |

**User's choice:** Script runs vitest + tsc + eslint itself and aborts on failure; no `--skip-checks`.
**Notes:** Bump half has no slow build, so running the full gate is seconds. Tagged tree passes the same bar as every commit.

---

## Failure recovery

| Option | Description | Selected |
|--------|-------------|----------|
| Stop + print cleanup steps | Keep local commit+tag, print retry/undo commands | ✓ |
| Auto-rollback | Tool auto-deletes tag + resets commit | |

| Option | Description | Selected |
|--------|-------------|----------|
| Keep + print undo steps | Declining confirm keeps local commit+tag, prints undo | ✓ |
| Auto-undo on decline | Declining rolls back local commit+tag | |

**User's choice:** Never a tool-initiated destructive reset. On push-failure OR declined confirm: keep the local commit+tag and print exact retry/undo commands.
**Notes:** A transient network blip must not discard good local work; a tool-triggered `git reset --hard` is the surprise to avoid.

---

## CLI grammar (closing question)

| Option | Description | Selected |
|--------|-------------|----------|
| Level-only, I'm ready | Accept only patch\|minor\|major + --dry-run | ✓ |
| Also allow explicit version | Support an explicit X.Y.Z argument | |
| Explore more gray areas | Discuss another decision | |

**User's choice:** Level-only (`patch|minor|major`) + `--dry-run`. Ready for context.
**Notes:** An explicit version reintroduces a hand-typed string — the exact failure mode Phase 9 was designed to eliminate.

## Claude's Discretion

- Exact lockfile-regeneration commands and the "only lockfiles changed" assertion.
- How the `.mjs` driver loads the Phase 9 `.ts` core (tsx loader expected).
- Dry-run plan / recovery-command output formatting, error wording, exit codes.

## Deferred Ideas

None — build/publish half is Phase 11; CI track stays in ROADMAP backlog 999.2. Rejected (not deferred): explicit-version arg, `--no-push`, `--skip-checks`.
