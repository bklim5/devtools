# Phase 10: bump-and-tag driver - Context

**Gathered:** 2026-06-02
**Status:** Ready for planning

<domain>
## Phase Boundary

A thin `scripts/bump-and-tag.mjs` (wired to `pnpm release:bump`) that imports Phase 9's pure `src/lib/release/version.ts` and turns it into a real maintainer command: bump the app semver in **lockstep** across the three manifests (`package.json` + `src-tauri/tauri.conf.json` + `src-tauri/Cargo.toml` `[package]` only) from **one** computed version → regenerate and stage both lockfiles (`pnpm-lock.yaml`, `Cargo.lock`) → make the bump commit → create and push the **annotated** `vX.Y.Z` tag + commit to the private `origin` (`bklim5/devtools`). Guarded by `--dry-run` (zero side effects) and fail-fast preflights that abort before any irreversible git action.

**This is the bump half only.** The build / sign / universal-binary / `latest.json` / cross-repo `gh` publish / real updater round-trip all belong to **Phase 11** and are explicitly out of scope here. No app UI is touched (the per-task real-WKWebView gate is N/A for this phase).

</domain>

<decisions>
## Implementation Decisions

### CLI surface
- **D-01:** **Level-only grammar** — accept `patch | minor | major` (computed via the Phase 9 `bumpSemver`) plus `--dry-run`. **No explicit-version argument** (e.g. `0.3.0`) — that reintroduces a hand-typed version string, the exact failure mode Phase 9's single-computed-source design eliminates.
- **D-02:** **Flags are minimal: only `--dry-run`.** No `--no-push` and no `--skip-checks` escape hatches — the pre-push confirm prompt already covers "don't push yet," and the gate must not be skippable by habit.

### Commit & tag shape
- **D-03:** Bump commit message is **`chore(release): vX.Y.Z`** (conventional-commits style, consistent with the repo's existing `docs(NN): …` / `fix(NN): …` history; greppable for a later CI release trigger). Version `X.Y.Z` is derived from the written file, never typed twice (criterion #3).
- **D-04:** The tag is **annotated** — `git tag -a vX.Y.Z -m "vX.Y.Z"`. Annotated tags carry tagger/date/message and are the git-recommended default for releases; `gh`/GitHub treat them as first-class. The tag message is just `vX.Y.Z` — **no release notes in the tag** (release notes, if any, belong in the Phase 11 GitHub Release body; duplicating them in the tag is avoided).

### Push & confirmation policy
- **D-05:** **Local-first, then confirm, then push.** Do ALL local work (bump → lockfile regen+stage → commit → annotated tag), then print exactly what is about to be pushed and where (commit + tag → `origin`), then require an interactive **y/N confirmation** before the push. The push is the only effectively-irreversible action; everything before it is trivially undoable, so the confirm is the single deliberate gate.
- **D-05a:** A `--dry-run` prints the full intended plan (computed version, the three file edits, lockfile regen, git commands, push target) and performs **zero** file writes and **zero** git/network actions (REL-10, criterion #4).

### Preflight check gate
- **D-06:** **The script runs the checks itself** and aborts non-zero on any failure — the gate cannot be forgotten. This is the bump half (no slow `tauri build` yet), so it is seconds.
- **D-07:** Checks run = **vitest + tsc + eslint** (the full Phase 9 gate, not just the vitest/tsc named in criterion #5). The tagged tree should pass the same bar every other commit does; eslint is fast.
- **D-08:** Git preflights also fail fast **before any write**: working tree dirty, branch is not `master`, or the target `vX.Y.Z` tag already exists **locally or on the remote** (REL-11, criterion #5). All preflights run before the first irreversible action.

### Failure recovery — never a tool-initiated destructive reset
- **D-09:** If the **push fails** after the commit + tag are already created locally (network down, remote rejects), the script **stops, exits non-zero, and prints the exact recovery commands** — both the retry-push command and the undo commands (`git tag -d vX.Y.Z`, `git reset --hard HEAD~1` or `--soft`, as appropriate). It does **not** auto-rollback: a transient network blip must not silently discard good local work, and a tool-triggered `git reset --hard` is exactly the surprise to avoid.
- **D-10:** If the maintainer answers **"no" at the pre-push confirm**, the script behaves identically to D-09: **keep** the local commit + tag, print how to push later or how to undo. Consistent, predictable, and preserves the option to push manually.

### Lockfiles
- **D-11:** After the version edits, both `pnpm-lock.yaml` and `Cargo.lock` are **regenerated and staged into the same commit** so the tagged tree is clean and reproducible — `git status --porcelain` must be empty before the tag is created (REL-03, criterion #2). The exact regen mechanism (e.g. `pnpm install --lockfile-only`, `cargo generate-lockfile` / `cargo update -p devtools`) is Claude's discretion at planning time, but it must honor the offline/zero-network ethos where possible and only touch the lockfiles, not pull unrelated dependency churn.

### Claude's Discretion
- Exact lockfile-regeneration commands and how to assert "only the lockfiles changed" (D-11).
- How `bump-and-tag.mjs` loads the Phase 9 `.ts` core (e.g. `tsx` loader vs a pre-build step) — `tsx` is already a devDep and is the expected path.
- The precise wording/format of the dry-run plan output and the recovery-command output, error message phrasing, and exit codes.
- Internal helper decomposition of the `.mjs` driver.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements & roadmap (authoritative acceptance bar)
- `.planning/ROADMAP.md` §"Phase 10: `bump-and-tag` driver" — goal + 5 success criteria
- `.planning/REQUIREMENTS.md` — REL-01 (lockstep bump), REL-03 (lockfile regen+stage), REL-04 (tag + push to private origin), REL-10 (`--dry-run`, bump half), REL-11 (preflights, bump half). Note the cross-phase note: REL-10/REL-11's build/publish halves land in Phase 11.

### Phase 9 pure core this phase wires to real I/O
- `src/lib/release/version.ts` — `bumpSemver(version, level)` (single computed next version) + the three surgical editors `setPackageJsonVersion` / `setTauriConfVersion` / `setCargoVersion` (`[package]`-scoped). All throw loudly on 0/>1 matches — the driver must surface those errors, not swallow them.
- `src/lib/release/version.test.ts` — the behaviour contract (rollover, leading-zero rejection, safe-integer bound, single-match assertion) the driver relies on.
- `.planning/phases/09-pure-release-core-housekeeping/09-CONTEXT.md` — D-01/D-01a (surgical edits, fail-loud), D-02/D-02a (hand-rolled semver), zero-new-deps ethos.

### Release process context (the manual dance this replaces)
- `docs/RELEASE.md` §1 "Bump the version (lockstep — D-16)" — the manual 2-file bump this automates (now 3-file incl. Cargo `[package]`); the sanity-check-they-match step the lockstep write makes unnecessary.
- `.planning/ROADMAP.md` §"Phase 999.2 (BACKLOG)" pre-discussion decisions — split-repo publish, app-semver decoupled from GSD tags, two-script split, push-to-origin-fires-release model (CI parked).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/lib/release/version.ts`** (Phase 9) — the entire pure core this driver wraps. The driver reads each manifest file, pipes its content through the matching `setXVersion`, writes it back, and uses `bumpSemver` once for the single source of truth.
- **`tsx` devDependency** — already present; lets the `.mjs` driver import the TypeScript core directly without a build step.
- **`scripts/e2e-spike.sh`** — the only existing `scripts/` entry; shows the repo's convention of executable helper scripts living under `scripts/`.

### Established Patterns
- **Pure logic in `src/lib/`, I/O in thin callers** — formatters and the Phase 9 release core keep transforms pure and route side effects through thin outer layers. `bump-and-tag.mjs` is that thin I/O caller for `version.ts`.
- **Zero new runtime AND dev dependencies** — Node builtins (`fs`, `child_process`/`execFileSync`, `readline` for the confirm prompt) + `tsx` + the `git`/`pnpm`/`cargo` CLIs cover everything. No `semver`/`commander`/`prompts` libs.
- **Conventional-commit messages** — repo history uses `docs(NN): …`, `fix(NN): …`; the release commit follows suit with `chore(release): vX.Y.Z`.

### Integration Points
- **`package.json` scripts** — add `release:bump` wired to `tsx scripts/bump-and-tag.mjs` (or equivalent). Sits alongside existing `test`/`lint`/`build` scripts.
- **Three manifests** the lockstep writes: `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` `[package].version` (all currently `0.2.1` after the Phase 9 reconcile).
- **`origin`** = `git@github.com:bklim5/devtools.git` (verified) — the private source remote the commit + tag push to.
- **Phase 11** consumes the `vX.Y.Z` tag this driver produces.

### Verified repo state (2026-06-02, confirm at execution)
- All three manifests at `0.2.1` (Phase 9 reconciled `Cargo.toml` from `0.1.0`).
- `package.json` `type: module`, `tsx` in devDeps, no existing `release:*` scripts.
- Single remote `origin` → `bklim5/devtools` (private source). Current branch `master`.

</code_context>

<specifics>
## Specific Ideas

- The driver must be **idempotent-safe via preflights**, not via cleanup: re-running after a successful tag must abort on the "tag already exists (local or remote)" preflight rather than clobbering.
- The pre-push confirm prompt and the recovery-command output are the two human-facing surfaces of this otherwise-headless script — they should print the literal commands a maintainer can copy-paste (retry push / `git tag -d` / `git reset`).
- The single-computed-version rule is load-bearing: bump once with `bumpSemver`, thread the same string into all three editors AND the tag name — never recompute or re-read.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within the bump-half scope. Out of scope by design and owned elsewhere:
- Build / sign / universal binary / `latest.json` generation / cross-repo `gh` publish / post-publish endpoint verify / real updater round-trip → **Phase 11**.
- Explicit-version CLI argument (`0.3.0`) → considered and **rejected** (D-01), not deferred.
- `--no-push` / `--skip-checks` escape hatches → considered and **rejected** (D-02), not deferred.
- CI integration, cross-repo PAT, Actions secrets → **ROADMAP backlog 999.2**.

</deferred>

---

*Phase: 10-bump-and-tag-driver*
*Context gathered: 2026-06-02*
