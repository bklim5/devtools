# Phase 10: bump-and-tag driver - Research

**Researched:** 2026-06-02
**Domain:** Node ESM maintainer script (thin I/O caller) wrapping a pure TS release core with git + lockfile side effects
**Confidence:** HIGH (every gray-area command was executed in THIS repo on THIS toolchain)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01..D-11 — DO NOT re-litigate)
- **D-01:** Level-only grammar — accept `patch | minor | major` (computed via Phase 9 `bumpSemver`) plus `--dry-run`. **No explicit-version argument.**
- **D-02:** Flags are minimal: only `--dry-run`. No `--no-push`, no `--skip-checks`.
- **D-03:** Bump commit message is **`chore(release): vX.Y.Z`**. Version derived from the written file, never typed twice.
- **D-04:** Tag is **annotated** — `git tag -a vX.Y.Z -m "vX.Y.Z"`. No release notes in the tag.
- **D-05:** Local-first, then confirm, then push. Do ALL local work (bump → lockfile regen+stage → commit → annotated tag), print exactly what is about to be pushed and where, then require interactive **y/N** before push.
- **D-05a:** `--dry-run` prints the full intended plan and performs **zero** file writes and **zero** git/network actions.
- **D-06:** The script runs the checks itself and aborts non-zero on any failure.
- **D-07:** Checks run = **vitest + tsc + eslint** (the full Phase 9 gate).
- **D-08:** Git preflights fail fast **before any write**: dirty tree, branch not `master`, or target `vX.Y.Z` tag exists **locally or on remote**.
- **D-09:** If the **push fails** after commit+tag exist locally: stop, exit non-zero, print exact recovery commands (retry-push AND undo). **Never auto-rollback / never tool-initiated `git reset --hard`.**
- **D-10:** If maintainer answers **"no"** at the confirm: behave identically to D-09 — keep local commit+tag, print how to push later / how to undo.
- **D-11:** Both `pnpm-lock.yaml` and `Cargo.lock` are regenerated and staged into the same commit; `git status --porcelain` must be empty before the tag is created. Regen mechanism is Claude's discretion but must honor offline/zero-network ethos and touch only the lockfiles.

### Claude's Discretion (research answers these below)
- Exact lockfile-regeneration commands + how to assert "only the lockfiles changed" (D-11). → §Standard Stack, §Code Examples Q1/Q2/Q3
- How `bump-and-tag.mjs` loads the Phase 9 `.ts` core (`tsx` is the expected path). → §Code Examples Q4
- Precise wording/format of dry-run plan + recovery-command output, error phrasing, exit codes. → planner's call; §Pitfalls gives the safe shapes
- Internal helper decomposition of the `.mjs` driver.

### Deferred Ideas (OUT OF SCOPE — do not research/plan)
- Build / sign / universal binary / `latest.json` / cross-repo `gh` publish / updater round-trip → **Phase 11**.
- Explicit-version CLI argument → rejected (D-01), not deferred.
- `--no-push` / `--skip-checks` → rejected (D-02), not deferred.
- CI integration, cross-repo PAT, Actions secrets → ROADMAP backlog 999.2.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REL-01 | Bump app semver across `package.json` + `tauri.conf.json` + `Cargo.toml` (`[package]` only) in lockstep from one computed version | `bumpSemver` once → thread the SAME string into all three `setXVersion` editors AND the tag name (§Code Examples Q4; the editors already exist + are tested in Phase 9) |
| REL-03 | Lockfiles regenerated + staged so the tagged commit is clean (no dirty tree after a bump) | `pnpm install --lockfile-only --offline` (likely a NO-OP — see §Q1) + `cargo update -p devtools-app --offline` (the surgical, verified command — §Q2); stage only what changed (§Q3) |
| REL-04 | Bump creates `vX.Y.Z` tag and pushes commit + tag to private `origin` (`bklim5/devtools`) | annotated `git tag -a` (D-04), `git push origin master` then `git push origin vX.Y.Z` (§Q6); remote verified `git@github.com:bklim5/devtools.git` |
| REL-10 | `--dry-run` prints full plan, zero side effects | All side-effecting commands have safe preview forms (`cargo update --dry-run`, `pnpm install --lockfile-only` skipped, no `fs.writeFile`, no `git` writes) (§Q1/Q2, §Pitfalls P1) |
| REL-11 | Preflights fail fast before any write (clean tree, on master, tag absent local+remote, vitest+tsc[+eslint] green) | `git status --porcelain`, `git rev-parse --abbrev-ref HEAD`, `git rev-parse -q --verify refs/tags/...`, `git ls-remote --tags origin` (§Q6); run gate via `pnpm test`/`tsc --noEmit`/`pnpm lint` (§Pitfalls P5) |
</phase_requirements>

## Summary

This phase is a **thin I/O caller** — there is no library to choose and no architecture to design. Everything runs on Node builtins (`node:fs`, `node:child_process`, `node:readline/promises`) plus the `git`/`pnpm`/`cargo` CLIs already on the machine. The only genuine unknowns were six command-level behaviours that are environment-dependent; all six were **executed in this repo on this toolchain** (pnpm 11.5.0, cargo 1.96.0, node v22.21.1, git 2.50.1, tsx 4.22.3) and are reported below as verified facts, not training recall.

**Two findings materially change the plan and protect the success-criterion checks:**

1. **The pnpm lockfile does NOT record the root package's own `version`** (lockfileVersion 9.0; the `importers..:` block lists only dependency resolutions, no own-version key). Bumping `package.json`'s `version` therefore leaves `pnpm-lock.yaml` **byte-identical**. The plan MUST treat a pnpm regen as a likely no-op and **stage only if the file actually changed** — otherwise `git add pnpm-lock.yaml` adds nothing and a naive "I changed 2 lockfiles" assertion would falsely fail.

2. **`Cargo.lock` at HEAD is still `0.1.0`** and the working tree already carries an **uncommitted** `Cargo.lock` change to `0.2.1` (Phase 9 reconciled `Cargo.toml` but deliberately deferred the `Cargo.lock` regen to Phase 10 — per STATE.md). This means **the dirty-tree preflight (D-08) will fire on a clean checkout** because of this pre-existing modification. The planner must decide how the first run handles this (see §Pitfalls P6 — it is the single biggest false-fail risk in the phase).

**Primary recommendation:** `scripts/bump-and-tag.mjs`, run via `pnpm release:bump`, importing `../src/lib/release/version.ts` directly through `tsx`. Lockfile regen = `pnpm install --lockfile-only --offline` (expect no-op) + `cargo update -p devtools-app --offline` (surgical, 1-package). Assert "only expected paths changed" by diffing `git status --porcelain` against an allowlist of the 3 manifests + 2 lockfiles. Order all preflights (including the gate and remote-tag check) **before** the first file write; never auto-rollback.

## Standard Stack

This phase adds **zero dependencies** (runtime or dev). It composes builtins + already-present CLIs.

### Core
| Tool | Version (verified) | Purpose | Why standard here |
|------|--------------------|---------|-------------------|
| Node builtins | v22.21.1 | `node:fs` (read/write manifests), `node:child_process` `execFileSync` (run git/pnpm/cargo), `node:readline/promises` (y/N confirm), `process.argv`/`process.exitCode` | Zero-dep ethos (CLAUDE.md, Phase 9 D); `readline/promises` is stable in Node 22 [VERIFIED: node --version → v22.21.1] |
| `tsx` | 4.22.3 | Run `.mjs` and import the Phase 9 `.ts` core with no build step | Already a devDep; confirmed working both with `.ts` extension and extensionless (§Q4) [VERIFIED: `pnpm exec tsx --version`, smoke import ran] |
| `git` CLI | 2.50.1 (Apple) | tree state, branch, tag create/verify, push, ls-remote | Native; all subcommands below tested |
| `pnpm` CLI | 11.5.0 | `install --lockfile-only --offline` | Project package manager (`packageManager: pnpm@11.5.0`) |
| `cargo` CLI | 1.96.0 | `update -p devtools-app --offline` | Rust toolchain for the Tauri crate |

### Phase 9 core consumed (no changes to it)
| Symbol | Source | Use in driver |
|--------|--------|---------------|
| `bumpSemver(version, level)` | `src/lib/release/version.ts` | Call **once** to compute the single next version string |
| `setPackageJsonVersion(content, v)` | same | Edit `package.json` content (string→string) |
| `setTauriConfVersion(content, v)` | same | Edit `src-tauri/tauri.conf.json` content |
| `setCargoVersion(content, v)` | same | Edit `src-tauri/Cargo.toml` `[package]` only |

All four **throw on 0/>1 matches or malformed input** [VERIFIED: read version.ts + version.test.ts]. The driver must let those throws propagate (fail loud) and surface the message — do not try/catch-swallow (CONTEXT canonical_refs).

### Alternatives Considered
| Instead of | Could Use | Why rejected |
|------------|-----------|--------------|
| `tsx` loader | pre-compile `version.ts` → `.js` build step | Extra build artifact + staleness risk; tsx is already present and CONTEXT names it the expected path |
| `cargo update -p` | `cargo generate-lockfile` | **Verified to re-lock all 574 packages and pull unrelated churn** (e.g. `toml_edit` version drift) — violates D-11 "only touch the lockfiles, no unrelated dependency churn" (§Q2) |
| `node:readline/promises` | a `prompts`/`inquirer` dep | Zero-new-deps line; builtin `question()` covers single y/N (§Q5) |
| `execFileSync` | `execSync` (shell string) | `execFileSync` (argv array) avoids shell-injection/quoting of the version string; prefer it |

**Installation:** none — nothing to install. Wire one `package.json` script:
```jsonc
"release:bump": "tsx scripts/bump-and-tag.mjs"
```
Invocation: `pnpm release:bump patch` / `minor` / `major` / `--dry-run` (args after `pnpm <script>` pass through; or use `pnpm release:bump patch --dry-run`).

**Version verification:** No npm packages added, so no `npm view` needed. Toolchain versions above are all `--version` outputs captured this session.

## Architecture Patterns

### Recommended file layout
```
scripts/
├── e2e-spike.sh          # existing — the repo's "executable helper lives in scripts/" convention
└── bump-and-tag.mjs      # NEW — this phase
src/lib/release/
├── version.ts            # Phase 9 — imported, NOT modified
└── version.test.ts       # Phase 9 — the immovable contract
```

### Pattern 1: Single computed version, threaded everywhere (load-bearing — REL-01, criterion #3)
**What:** Call `bumpSemver` exactly once; the returned string is the ONLY source for all three file edits AND the tag name AND the commit message.
**Why:** This is the entire point of Phase 9's design — never re-read or recompute a version, so the three manifests + tag can never drift.
```js
// Source: derived from src/lib/release/version.ts contract [VERIFIED: read + smoke-ran]
const current = readVersionFromPackageJson(); // read the value to feed bumpSemver
const next = bumpSemver(current, level);       // <-- the ONE computation
// thread `next` into setPackageJsonVersion / setTauriConfVersion / setCargoVersion,
// the tag `v${next}`, and the message `chore(release): v${next}`
```

### Pattern 2: Phases as an ordered pipeline with a single irreversible gate
**What:** `preflights (read-only) → file writes → lockfile regen → stage → commit → annotated tag → PRINT plan → y/N → push`. Everything left of the push is locally undoable; the push is the only effectively-irreversible step (D-05).
**When:** Always, for this script. Order matters for `--dry-run` and for fail-fast (D-08).

### Pattern 3: `--dry-run` short-circuits at the write boundary
**What:** In dry-run, run the read-only preflights and PRINT the full plan, but never reach any `fs.writeFile`/`git`-write/`cargo`-write. Use `cargo update --dry-run` if you want to *preview* the lock change without writing (it prints "warning: not updating lockfile due to dry run") [VERIFIED].
**When:** REL-10, criterion #4 ("changes zero files").

### Anti-Patterns to Avoid
- **Re-reading the version from a second file to "double-check":** reintroduces the drift class Phase 9 eliminated. Compute once.
- **`git add -A` / `git commit -a`:** would sweep in the stray on-disk gitignored `latest.json` or any unrelated edit. Stage an explicit allowlist of paths (§Q3).
- **`git reset --hard` anywhere in the script:** D-09/D-10 forbid tool-initiated destructive resets. Print the command for the human; never run it.
- **`cargo generate-lockfile`:** re-locks the whole graph (§Q2).
- **Swallowing the `setXVersion` throws:** they are the fail-loud contract.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Semver bump math | regex/parse in the driver | Phase 9 `bumpSemver` | Already tested (rollover, leading-zero reject, safe-int bound) |
| Manifest version edits | JSON.parse→stringify or ad-hoc regex | Phase 9 `setXVersion` | Surgical, formatting-preserving, fail-loud, tested |
| Cargo.lock own-version reconcile | hand-edit the lock | `cargo update -p devtools-app --offline` | Surgical 1-package relock; hand-editing risks checksum/format drift |
| pnpm-lock regen | hand-edit | `pnpm install --lockfile-only --offline` | …though it's a no-op here (§Q1) |
| y/N prompt | raw `process.stdin` byte handling | `node:readline/promises` `rl.question()` | Builtin, handles TTY line editing |
| Tag existence (local) | parse `git tag` output | `git rev-parse -q --verify refs/tags/vX.Y.Z` | Clean exit-code contract (§Q6) |

**Key insight:** This phase's value is precisely that it does NOT hand-roll — it orchestrates the already-tested pure core + standard CLIs. The only original code is the orchestration, the I/O, and the human-facing print surfaces.

---

## Code Examples / Targeted Findings (the six gray areas — all VERIFIED in-repo)

### Q1. pnpm lockfile-only regen — and the no-op reality
**Command (offline, lockfile-only):**
```bash
pnpm install --lockfile-only --offline
```
- `--lockfile-only` "Dependencies are not downloaded. Only `pnpm-lock.yaml` is updated." [VERIFIED: `pnpm install --help`]
- `--offline` "Trigger an error if any required dependencies are not available in the local store" — safe to add for the no-network ethos [VERIFIED: help text].

**CRITICAL behaviour — the pnpm lockfile does NOT store the root package's own version.** lockfileVersion is `9.0`; the `importers..:` block contains only resolved **dependency** versions, with **no own-version key** for the root package [VERIFIED: read `pnpm-lock.yaml` head + scanned the entire `importers:`→`packages:` block]. Therefore **bumping `package.json`'s `version` field leaves `pnpm-lock.yaml` byte-identical.**

**Plan implication:** Run the command for correctness/future-proofing, but **expect zero diff**. Stage `pnpm-lock.yaml` **only if `git status --porcelain` shows it changed** (§Q3). Do NOT assert "2 lockfiles changed" — assert "≤2 lockfiles changed, and any change is confined to the lockfiles" (§Q3). A hard "pnpm-lock.yaml must differ" check would **falsely fail every run**.

> Edge: `--frozen-lockfile` is the opposite of what we want (it refuses to write). Do not use it here.

### Q2. Cargo lockfile-only regen — the surgical command
**Package name is `devtools-app`** (NOT `devtools`) [VERIFIED: `src-tauri/Cargo.toml` line 2 `name = "devtools-app"`; `Cargo.lock` line 820].

**Command (run from inside `src-tauri/`):**
```bash
cargo update -p devtools-app --offline
```
**Verified behaviour** (controlled test: bumped a temp `Cargo.toml` to `0.2.99`, restored after):
- `cargo update -p devtools-app --offline` → `Locking 1 package … devtools-app v0.2.1 -> v0.2.99`, updated **only** that entry. **Offline, surgical.** [VERIFIED]
- `cargo generate-lockfile --offline` → `Locking 574 packages …` and surfaced unrelated churn (`Adding toml_edit v0.20.2 (available: v0.20.7)`). **Rejected** — violates D-11. [VERIFIED]
- `cargo update -p devtools-app --offline --dry-run` → prints the plan, writes nothing (`warning: not updating lockfile due to dry run`). Use this in `--dry-run`. [VERIFIED]

**Network:** `--offline` succeeds for the own-package relock (the crate is already in the local registry cache). The script should pass `--offline` to honor the no-network ethos; if a future cold cache makes it fail, that's a loud, correct failure, not a silent fetch.

**`cd` note:** cargo must run with cwd = `src-tauri/`. From the `.mjs`, pass `{ cwd: 'src-tauri' }` to `execFileSync` rather than shelling `cd` (avoids the harness's `cd`-permission prompt and keeps it deterministic).

### Q3. Asserting "only the lockfiles + manifests changed"
**Concrete check** (allowlist diff against `git status --porcelain`):
```js
// Source: pattern over `git status --porcelain` [VERIFIED: porcelain format on this git 2.50.1]
const ALLOWED = new Set([
  "package.json",
  "src-tauri/tauri.conf.json",
  "src-tauri/Cargo.toml",
  "pnpm-lock.yaml",
  "src-tauri/Cargo.lock",
]);
// porcelain line = "XY <path>"; slice(3) is the path (rename "R  old -> new" not expected here)
const changed = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" })
  .split("\n").filter(Boolean).map((l) => l.slice(3));
const stray = changed.filter((p) => !ALLOWED.has(p));
if (stray.length) { /* abort BEFORE commit: "unexpected changes: " + stray */ }
```
- This runs **after** the writes + lockfile regen, **before** the commit, and aborts on any path outside the allowlist (a stray edit must not get tagged).
- For staging, `git add` exactly the members of `changed` that are in `ALLOWED` (so the no-op `pnpm-lock.yaml` is simply absent from `changed` and never staged — handles Q1 gracefully).
- After `git commit`, assert `git status --porcelain` is **empty** (criterion #2). Note the stray on-disk gitignored `latest.json` does NOT appear in porcelain output (it's gitignored), so it won't break this — confirmed it's gitignored in Phase 9 [CITED: STATE.md Phase 09 record].

### Q4. tsx loading a `.ts` module from the script
**Verified both forms work** [VERIFIED: created `scripts/_smoke_tmp.mjs`, ran via `pnpm exec tsx`, got correct bump output, deleted]:
```js
// scripts/bump-and-tag.mjs — both resolve under tsx:
import { bumpSemver } from "../src/lib/release/version.ts"; // explicit .ts  ✅
import { bumpSemver } from "../src/lib/release/version";    // extensionless ✅
```
- `tsx scripts/bump-and-tag.mjs` runs and imports the `.ts` core with **no build step**. tsx 4.22.3 present in devDeps [VERIFIED: `pnpm exec tsx --version → 4.22.3`].
- **Recommendation: keep the driver as `.mjs`** (CONTEXT names `bump-and-tag.mjs` explicitly; D and code_context both say `.mjs`). It needs no TS of its own — it just imports the typed core. `.mts` is unnecessary; `.ts` for the driver would also work under tsx but `.mjs` matches the stated artifact name. Use the **explicit `.ts` extension** in the import for clarity (both work; explicit is self-documenting).
- `package.json` is `type: module`, so `.mjs` and ESM `import` are native [VERIFIED: read package.json].

### Q5. Node-builtin y/N confirm (TTY-aware, defaults to "no")
```js
// Source: node:readline/promises (stable in Node 22) [VERIFIED: node v22.21.1]
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

async function confirmYesNo(promptText) {
  if (!stdin.isTTY) return false;            // non-interactive (CI/pipe) → default NO (safe)
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const ans = (await rl.question(`${promptText} [y/N] `)).trim().toLowerCase();
    return ans === "y" || ans === "yes";     // anything else (incl. empty Enter) → NO
  } finally {
    rl.close();
  }
}
```
- **`stdin.isTTY` is the guard:** when stdin is not a TTY (CI, piped input), return `false` immediately — do NOT block on a prompt that can never be answered. Default-no means a non-interactive run does all local work then declines the push (→ D-10 path: keep commit+tag, print recovery). [VERIFIED: `isTTY` is the documented Node property; behaviour reasoning is standard]
- Empty input (bare Enter) → `false` (capital N is the default). Matches D-05's deliberate-gate intent.

### Q6. git plumbing + irreversible-action ordering
All commands below were syntax/exit-code verified on git 2.50.1 in this repo.

**Read-only preflights (run ALL before the first write — D-08):**
```bash
git status --porcelain                       # empty == clean tree
git rev-parse --abbrev-ref HEAD              # must equal "master"  [VERIFIED → master]
git rev-parse -q --verify refs/tags/vX.Y.Z   # exit 0 == tag EXISTS locally; exit 1 == absent  [VERIFIED: v0.2.1 → exit 1]
git ls-remote --tags origin vX.Y.Z           # NON-EMPTY stdout == tag exists on remote
```
- **`git ls-remote` needs network.** This is an acceptable preflight network call (it's a read, and the whole point is to catch a tag that already exists on `origin` before creating a local one). If `origin` is unreachable, decide: the safest default is to **abort** ("could not verify remote tag — refusing to proceed") rather than silently skip the remote check, because a duplicate remote tag is exactly the irreversible mistake D-08 guards. The planner sets the exact policy; recommend abort-on-unreachable for the tag preflight.
- `git rev-parse --abbrev-ref HEAD` returns `master` here [VERIFIED]; compare exactly.

**Write/irreversible sequence (after preflights pass + after y/N = yes):**
```bash
# (local, reversible)
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock  # + pnpm-lock.yaml IF changed
git commit -m "chore(release): vX.Y.Z"
git tag -a vX.Y.Z -m "vX.Y.Z"                # annotated (D-04)
# (the single irreversible step — push commit FIRST, then tag)
git push origin master                       # 1) push the bump commit
git push origin vX.Y.Z                       # 2) then push the tag
```
**Push ordering rationale:** push the **commit before the tag**. If only the commit lands and the tag push fails, the remote has a valid history with no dangling tag pointing at an unreachable commit — re-running `git push origin vX.Y.Z` cleanly recovers. The reverse (tag first) can momentarily publish a tag whose commit isn't yet on the remote. Two separate pushes are clearer for recovery than one combined `git push origin master vX.Y.Z` (a combined push is atomic-ish per-ref but reports partial failures less legibly). Recommend two pushes with the commit first.

**Recovery output the script must PRINT (D-09/D-10 — never execute):**
```bash
# To retry the push later:
git push origin master && git push origin vX.Y.Z
# To undo the local tag + commit (only if you want to discard this bump):
git tag -d vX.Y.Z
git reset --hard HEAD~1     # discards the bump commit AND working changes
# ...or keep the changes staged/working:
git reset --soft HEAD~1     # undo the commit, keep the edits staged
```
Print the literal copy-pasteable block (CONTEXT "Specific Ideas": recovery output is one of two human-facing surfaces).

## Runtime State Inventory

> This is a script-authoring phase (new file + one package.json script), not a rename/migration. Most categories are N/A, but two runtime-state items materially affect the success-criterion checks and are documented.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no datastore touched. | None. |
| Live service config | None — no external service. The push targets `origin` (`git@github.com:bklim5/devtools.git`) [VERIFIED: `git remote -v`]. | None. |
| OS-registered state | None. | None. |
| Secrets/env vars | None for the bump half. (Signing env `TAURI_SIGNING_*` / `APPLE_*` is Phase 11 only.) | None. |
| Build artifacts | **`Cargo.lock` is `0.1.0` at HEAD but `0.2.1` in the working tree (uncommitted)** — Phase 9 reconciled `Cargo.toml` but deferred the `Cargo.lock` regen to THIS phase [VERIFIED: `git show HEAD:src-tauri/Cargo.lock` → 0.1.0; `git diff` → +0.2.1; STATE.md Plan 01 record]. The stale gitignored on-disk `latest.json` exists but does NOT appear in `git status` (gitignored). | The pre-existing `Cargo.lock` modification will trip the dirty-tree preflight on a fresh checkout — see §Pitfalls P6. |

## Common Pitfalls

### P1: `--dry-run` accidentally writes via a sub-command
**What goes wrong:** `cargo update -p` or `pnpm install` write the lockfile even in a "preview" path, so criterion #4 ("zero files changed") fails.
**Avoid:** In dry-run, never call the writing forms. Use `cargo update -p devtools-app --offline --dry-run` (verified: writes nothing) and **skip** `pnpm install` entirely (it'd be a no-op anyway, §Q1). Never call `fs.writeFile` or any `git` write in dry-run. After a dry-run, assert `git status --porcelain` is unchanged from before.
**Warning sign:** dry-run leaves a modified file.

### P2: pnpm-lock "must have changed" check → false fail
**What goes wrong:** Asserting `pnpm-lock.yaml` differs after the bump. It won't (§Q1) — the lockfile doesn't store the root version.
**Avoid:** Treat the pnpm regen as best-effort; stage-only-if-changed (§Q3). Frame criterion #2 as "tree is clean after commit," not "both lockfiles changed."
**Warning sign:** every run aborts complaining pnpm-lock is unchanged.

### P3: `cargo generate-lockfile` pulls unrelated churn
**What goes wrong:** Using `generate-lockfile` re-locks all 574 packages (verified) and can shift unrelated versions → the allowlist diff (§Q3) sees `Cargo.lock` change *content beyond the own-version line*, and the diff is huge/noisy, violating D-11.
**Avoid:** Use `cargo update -p devtools-app --offline` (1-package relock).
**Warning sign:** `Cargo.lock` diff touches packages other than `devtools-app`.

### P4: wrong cargo cwd / shell `cd` permission prompt
**What goes wrong:** Running `cargo update` from repo root fails (no manifest there) or a `cd src-tauri && cargo …` compound command triggers the harness `cd` permission prompt.
**Avoid:** `execFileSync("cargo", [...], { cwd: "src-tauri" })`.
**Warning sign:** "could not find `Cargo.toml`" or a permission prompt.

### P5: running the gate (D-07) the wrong way / slow
**What goes wrong:** Forgetting eslint (D-07 mandates vitest+tsc+eslint, not just the two in criterion #5), or running `vitest` in watch mode (hangs the script).
**Avoid:** Run the one-shot forms: `pnpm test` (= `vitest run`, non-watch [VERIFIED: package.json `"test": "vitest run"`]), `pnpm exec tsc --noEmit` (note `build` script is `tsc && vite build` — for a preflight use `tsc --noEmit`, not `pnpm build`), `pnpm lint` (= `eslint .`). Run these as read-only preflights **before** any write; abort non-zero on failure.
**Warning sign:** script hangs (watch mode) or tags a tree that eslint would reject.

### P6: the pre-existing uncommitted `Cargo.lock` trips the clean-tree preflight (HIGHEST RISK)
**What goes wrong:** On a fresh checkout the working tree is **already dirty** (`M src-tauri/Cargo.lock`, the deferred 0.1.0→0.2.1 regen) [VERIFIED: `git status --porcelain`]. The dirty-tree preflight (D-08) will abort the very first real `pnpm release:bump` run, even though nothing is wrong.
**Avoid (planner decision — flag for the plan):** The cleanest resolution is to **commit the deferred `Cargo.lock` 0.1.0→0.2.1 reconcile as a separate housekeeping commit before/at the start of Phase 10** (it's the completion of Phase 9's deliberately-deferred step), so the tree is clean before the bump driver runs. Do NOT have the bump script silently absorb a pre-existing unrelated lock change into the release commit — that would put a non-bump diff in the tagged commit and muddy criterion #1 ("no other file content touched"). Alternatively the first plan task explicitly commits it.
**Warning sign:** "working tree dirty — aborting" on a checkout the maintainer believes is clean; or an unexpected `Cargo.lock` 0.1.0→0.2.1 hunk riding along in the `chore(release):` commit.

### P7: `git add -A` sweeps unintended files
**What goes wrong:** Broad staging captures stray edits or (if un-ignored) the on-disk `latest.json`.
**Avoid:** Stage the explicit allowlist (§Q3). The gitignored `latest.json` is invisible to porcelain anyway, but explicit staging is the durable guard.

## State of the Art

| Old approach | Current approach | Why |
|--------------|------------------|-----|
| Manual 2-file edit + `grep` sanity check (`docs/RELEASE.md` §1) | One computed `bumpSemver` → 3-file lockstep write via `setXVersion` | Removes the hand-typed version (the exact failure Phase 9 designed out) |
| `node:readline` callback API | `node:readline/promises` `rl.question()` | Async/await, stable in Node 18+/22 |
| Lightweight tag | **annotated** `git tag -a` (D-04) | Carries tagger/date/message; git+GitHub treat as first-class |

**Deprecated/outdated for THIS repo:**
- `docs/RELEASE.md` §1's manual lockstep is what this script replaces (now 3-file incl. `Cargo.toml [package]`).
- `cargo generate-lockfile` as a "just relock" tool — too broad here.

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | `--offline` flags will succeed because the crates/store are already cached (they are, on this dev machine) | Q1/Q2 | On a cold cache `--offline` fails loudly (correct fail, not silent fetch) — low risk; it's the desired behaviour |
| A2 | Resolving the pre-existing `Cargo.lock` 0.1.0→0.2.1 as a separate commit is the right call (vs. folding into the bump) | P6 | If folded in instead, criterion #1's "no other content touched" is muddied; recommend separate commit but this is a planner decision |
| A3 | Abort-on-unreachable-`origin` for the remote-tag preflight is the safe default | Q6 | If the maintainer is offline-by-design at bump time, this blocks the bump; could be relaxed to a warning — planner's call |

**Everything else in this research was VERIFIED by executing the command in-repo this session.** No `[ASSUMED]` facts about command behaviour remain.

## Open Questions

1. **How is the deferred `Cargo.lock` 0.1.0→0.2.1 committed?** (P6/A2)
   - Known: HEAD lock is 0.1.0; working tree is 0.2.1 (uncommitted), tree is dirty on checkout.
   - Unclear: separate housekeeping commit vs. first plan task vs. folding in.
   - Recommendation: a dedicated first commit/task that lands the reconcile, leaving the tree clean before the bump driver's preflights run.

2. **Remote-tag preflight when `origin` is unreachable.** (Q6/A3)
   - Recommendation: abort with a clear message (safe default); planner may downgrade to a warning if offline bumps are desired.

3. **Exact wording/exit codes of the plan + recovery output.** Explicitly Claude's discretion (CONTEXT). Recommend: non-zero exit on any preflight failure, push failure, or declined confirm; exit 0 only on a completed push (or a clean `--dry-run`).

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| node | run the script | ✓ | v22.21.1 | — |
| tsx | import the `.ts` core | ✓ (devDep) | 4.22.3 | — |
| pnpm | lockfile regen, run gate | ✓ | 11.5.0 | — |
| cargo | Cargo.lock regen | ✓ | 1.96.0 | — |
| git | tag/push/preflights | ✓ | 2.50.1 | — |
| origin (network) | remote-tag preflight + push | ✓ (reachable; `git@github.com:bklim5/devtools.git`) | — | abort with recovery message if unreachable (D-09) |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** network for `git ls-remote`/`git push` — handled by abort+recovery-print (A3), never a silent skip.

## Validation Architecture

> `workflow.nyquist_validation: true` [VERIFIED: config.json]. Phases 9–11 touch NO app UI, so the real-WKWebView gate is N/A this phase (per STATE.md/CLAUDE.md); validation is unit + the script's own behaviour.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.7 [VERIFIED: package.json] |
| Config file | vitest picks up `src/**/*.test.ts` (Phase 9 release tests already run) |
| Quick run command | `pnpm test` (= `vitest run`, non-watch) |
| Full suite command | `pnpm test && pnpm exec tsc --noEmit && pnpm lint` |

### Phase Requirements → Test Map
| Req | Behavior | Test type | Automated command | File exists? |
|-----|----------|-----------|-------------------|--------------|
| REL-01 | bump math + 3-file lockstep edit | unit (logic in `version.ts`) | `pnpm test` (existing version.test.ts) | ✅ (Phase 9) |
| REL-01 driver wiring | one computed version threaded to 3 files + tag | integration / manual `--dry-run` | `pnpm release:bump minor --dry-run` (plan shows ONE version everywhere) | ❌ Wave 0 (driver new) |
| REL-03 | lockfiles regen + staged, clean tree after | integration | run on a scratch branch; assert `git status --porcelain` empty post-commit | ❌ Wave 0 |
| REL-04 | tag created + pushed to origin | manual (irreversible — push) | exercised in a real bump; preflight + recovery paths unit-testable in isolation | ❌ manual-only (network/irreversible) |
| REL-10 | `--dry-run` zero side effects | integration | `git status --porcelain` identical before/after `--dry-run` | ❌ Wave 0 |
| REL-11 | preflights abort before write | integration | force dirty tree / wrong branch / existing tag → assert non-zero exit + no writes | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm test` (the immovable 19 decoder tests + release-core tests must stay green).
- **Per wave merge / before tagging:** `pnpm test && pnpm exec tsc --noEmit && pnpm lint` (the D-07 gate the script itself also runs).
- **Phase gate:** full gate green + a real `--dry-run` proving zero side effects; human sign-off on a real bump.

### Wave 0 Gaps
- [ ] Decide how driver behaviour is tested without performing real pushes — extract the pure decision helpers (version threading, allowlist diff, plan-string builder, confirm-default) so they're unit-testable; keep `git push` behind the manual gate. The plan should make the irreversible parts thin and the testable parts pure (mirrors the project's pure-logic-in-`src/lib` ethos).
- [ ] `--dry-run` integration check (no test file exists yet — driver is new).
- No framework install needed (vitest present).

## Security Domain

> `security_enforcement` not set in config → treated as enabled; this is a local maintainer script (no untrusted input, no auth surface), so the applicable surface is narrow.

### Applicable ASVS Categories
| ASVS | Applies | Control |
|------|---------|---------|
| V5 Input Validation | yes (narrow) | CLI arg is one of `patch\|minor\|major\|--dry-run`; reject anything else (don't pass arbitrary strings to git/cargo). `bumpSemver` already validates the version string. |
| V6 Cryptography | no | No signing in the bump half (Phase 11). |
| V2/V3/V4 Auth/Session/Access | no | No auth surface; push auth is the maintainer's existing SSH key to `origin`. |

### Known Threat Patterns
| Pattern | STRIDE | Mitigation |
|---------|--------|------------|
| Shell injection via the version/level string | Tampering | Use `execFileSync` (argv array), never `execSync` with an interpolated string. Validate the level against an allowlist; `vX.Y.Z` comes from the validated `bumpSemver` output. |
| Accidental irreversible push (wrong branch/dup tag) | — (safety) | Preflights (branch==master, tag absent local+remote) + y/N confirm before push (D-05/D-08). |
| Tagging a dirty/unexpected tree | Tampering | Allowlist diff (§Q3) + clean-tree assertion before tag (D-11). |
| No secrets in the bump half | Info disclosure | N/A here (Phase 11 owns signing env). |

## Sources

### Primary (HIGH — executed/observed this session)
- `pnpm --version` → 11.5.0; `node --version` → v22.21.1; `cargo --version` → 1.96.0; `git --version` → 2.50.1; `pnpm exec tsx --version` → 4.22.3
- `git remote -v` → `origin git@github.com:bklim5/devtools.git`; `git rev-parse --abbrev-ref HEAD` → master
- `pnpm-lock.yaml` head + full `importers:` block (no root version key; lockfileVersion 9.0)
- `Cargo.lock` `devtools-app` entry (HEAD=0.1.0, worktree=0.2.1) + `git diff`/`git show HEAD:` comparison
- Controlled cargo test: `cargo update -p devtools-app --offline` (1-package), `--dry-run` (no write), `cargo generate-lockfile --offline` (574-package + churn) — temp Cargo.toml bumped to 0.2.99, fully restored
- tsx smoke import of `src/lib/release/version.ts` from a `scripts/*.mjs` (both `.ts` and extensionless) — ran, output correct, file removed
- `pnpm install --help`, `cargo update --help` (flag confirmation)
- `git rev-parse -q --verify refs/tags/v0.2.1` → exit 1 (absent)
- Read in full: `version.ts`, `version.test.ts`, `package.json`, `src-tauri/Cargo.toml`, CONTEXT (Phase 9 + 10), REQUIREMENTS, ROADMAP, STATE, RELEASE.md, config.json

### Secondary (MEDIUM)
- Node `readline/promises` `isTTY` behaviour — standard documented API on Node 22 (the snippet shape is conventional; not separately executed)

### Tertiary (LOW)
- None — no claim in this research rests on unverified web search.

## Metadata

**Confidence breakdown:**
- Lockfile commands (Q1/Q2/Q3): **HIGH** — executed in-repo, including the destructive-churn comparison.
- tsx loading (Q4): **HIGH** — smoke-imported successfully.
- git plumbing/ordering (Q6): **HIGH** for command/exit-code shapes (verified); **MEDIUM** for the abort-on-unreachable policy (a recommendation, A3).
- y/N confirm (Q5): **MEDIUM-HIGH** — standard builtin; isTTY guard not separately exercised but well-established.
- The two plan-shaping findings (pnpm no-op, pre-existing dirty Cargo.lock): **HIGH** — directly observed.

**Research date:** 2026-06-02
**Valid until:** ~2026-07-02 (stable toolchain; re-confirm pnpm/cargo versions if the lockfile format or `packageManager` pin changes).
