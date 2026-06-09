---
phase: quick-260609-ard
plan: 01
subsystem: release-tooling
tags: [release, changelog, cli, pure-functions]
requires:
  - src/lib/release/changelog.ts (extractChangelogSection, isAnyHeading)
  - scripts/bump-and-tag.mjs
  - src/lib/release/bumpPlan.ts (ALLOWED_PATHS, assertOnlyExpectedPaths)
provides:
  - "release:changelog CLI (edit-only Unreleased logger)"
  - "appendUnreleasedEntry + promoteUnreleased pure functions"
  - "bump auto-promotes Unreleased into a dated/versioned section in the same commit"
affects:
  - scripts/bump-and-tag.mjs (release:bump now cuts the changelog)
tech-stack:
  added: []
  patterns:
    - "pure string core (src/lib/release/) + thin tsx .mjs I/O driver"
    - "injected date keeps promote* pure; the driver reads the wall clock"
key-files:
  created:
    - scripts/changelog.mjs
  modified:
    - src/lib/release/changelog.ts
    - src/lib/release/changelog.test.ts
    - scripts/bump-and-tag.mjs
    - src/lib/release/bumpPlan.ts
    - src/lib/release/bumpPlan.test.ts
    - package.json
decisions:
  - "CHANGELOG.md is an OPTIONAL allowed path (ALLOWED_PATHS, not REQUIRED_MANIFESTS) so changelog-less / no-op-promotion bumps still pass assertOnlyExpectedPaths"
  - "promotion sits AFTER the --dry-run short-circuit so --dry-run stays ZERO writes"
  - "no-arg release:changelog is a clean exit-0 query (usage + current Unreleased), not an error"
metrics:
  tasks: 3
  tests-delta: +21
  completed: 2026-06-09
---

# Phase quick-260609-ard Plan 01: pnpm release:changelog + auto-cut Unreleased on bump — Summary

A terminal-driven CHANGELOG workflow: `pnpm release:changelog "xxx"` appends a dash-normalized bullet to `## [Unreleased]` (edit-only, no commit), and `pnpm release:bump` now auto-promotes `## [Unreleased]` to `## [<version>] - <date>` (with a fresh empty Unreleased) so the bump commit carries the changelog and the annotated tag message picks up the real notes — eliminating the manual edit-Unreleased-before-bump step.

## What shipped

- **Two pure functions** in `src/lib/release/changelog.ts`, beside `extractChangelogSection` in the same line-array / `\r`-strip style (no fs, no clock, no deps):
  - `appendUnreleasedEntry(changelog, entry)` — appends `- <entry>` to the END of the Unreleased bullet list. ONE leading `- `/`-` is stripped + trimmed (never `- - X`); an empty/whitespace-only entry throws; the sole `- _Nothing yet._` placeholder is REPLACED by the first real entry; a missing Unreleased section is CREATED above the newest `## [x.y.z]` version section (or at EOF); CRLF-tolerant.
  - `promoteUnreleased(changelog, version, date)` — renames `## [Unreleased]` to `## [<version>] - <date>` and inserts a fresh empty `## [Unreleased]` above it; NO-OP (input returned unchanged) when there is no Unreleased section; `date` is injected (pure).
- **`scripts/changelog.mjs`** — a thin EDIT-ONLY driver (no git, no subprocess) over `appendUnreleasedEntry`. Non-empty arg appends (creating a minimal `CHANGELOG.md` if missing); no/empty arg prints usage + the current Unreleased bullets and exits 0; a whitespace-only quoted arg surfaces the core's throw via the top-level catch. Wired as `release:changelog` in `package.json`.
- **`scripts/bump-and-tag.mjs`** — imports `promoteUnreleased` + `existsSync`; a new `promoteChangelog(plan)` helper reads the wall clock (`new Date().toISOString().slice(0,10)`) and rewrites the changelog only on a real diff, called in `main()` AFTER the `--dry-run` short-circuit and BEFORE `writeManifests`. The promoted `CHANGELOG.md` rides the same bump commit via `commitAndTag`'s `changed ∩ ALLOWED` staging, and `resolveReleaseNotes(plan.nextVersion, ...)` then finds the freshly-promoted section for the tag message.
- **`src/lib/release/bumpPlan.ts`** — `CHANGELOG.md` added to `ALLOWED_PATHS` only (NOT `REQUIRED_MANIFESTS`); doc-comment reworded to "6-path allowlist".

### Function signatures

```ts
export function appendUnreleasedEntry(changelog: string, entry: string): string;
export function promoteUnreleased(changelog: string, version: string, date: string): string;
```

## Verification

- **Full suite green: 728/728** (`pnpm test`). New: 19 changelog cases + 2 bumpPlan cases (+21 total over the 707 baseline; 726 after T1, 728 after T3). `pnpm exec tsc --noEmit` clean; `pnpm lint` clean.
- **`node --check`** passes on both `scripts/changelog.mjs` and `scripts/bump-and-tag.mjs`.
- **`release:changelog` smoke:** `pnpm release:changelog "Smoke test entry"` appended a bullet under `## [Unreleased]` — and correctly REPLACED the `- _Nothing yet._` placeholder rather than stacking. `pnpm release:changelog` (no arg) printed `Usage: ...` + the current Unreleased bullets and exited 0. **CHANGELOG.md was restored via `git checkout CHANGELOG.md` — the smoke edit is NOT committed.**
- **`release:bump --dry-run` zero-writes smoke:** ran `pnpm release:bump patch --dry-run` on a genuinely clean tree (planning dir temporarily moved aside so the clean-tree preflight passed). It ran all preflights + the full gate, printed the plan, exited 0, and `git status --porcelain` was EMPTY afterward — ZERO writes, no CHANGELOG.md diff — proving promotion is gated after the `if (dryRun)` short-circuit. (No real, non-dry-run bump was run — that tags + prompts to push.)
- **Decoder bar intact:** `src/lib/protobuf/` is byte-for-byte untouched across the whole feature range (empty `git diff --stat`); its 19 tests pass.
- **Zero new dependencies:** the only `package.json` change is the `release:changelog` SCRIPT entry; no `dependencies`/`devDependencies` change; `src-tauri/Cargo.toml` unchanged. `tsx` was already present.

## UI gate

**N/A — this task has no webview surface.** It is release tooling (pure string functions + two `.mjs` drivers run from the terminal). The binding gates here were: `/simplify` + `/codex:review` (run by the orchestrator on the committed diff), vitest + tsc + eslint green, `node --check` on the edited `.mjs` files, and the documented smokes. Stated honestly per the harness.

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Task | Commit | Description |
| ---- | ------ | ----------- |
| 1 | `b6ddb05b` | feat(quick-260609-ard): add appendUnreleasedEntry + promoteUnreleased pure fns |
| 2 | `c2c92865` | feat(quick-260609-ard): add release:changelog edit-only driver |
| 3 | `60216b71` | feat(quick-260609-ard): promote Unreleased on bump + allow CHANGELOG.md |

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: scripts/changelog.mjs
- FOUND: src/lib/release/changelog.ts (appendUnreleasedEntry + promoteUnreleased)
- FOUND: commit b6ddb05b, c2c92865, 60216b71
- decoder dir untouched; CHANGELOG.md smoke restored (uncommitted); dry-run zero-writes confirmed
