---
phase: quick-260611-awo
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/release/changelog.ts
  - src/lib/release/changelog.test.ts
  - scripts/changelog.mjs
autonomous: true
requirements: ["QUICK-260611-AWO"]

must_haves:
  truths:
    - "pnpm release:changelog \"entry\" --commit appends the entry AND creates a commit `docs(changelog): entry` containing ONLY CHANGELOG.md"
    - "pnpm release:changelog \"entry\" (no flag) behaves byte-for-byte as today: edit-only, no git, no subprocess"
    - "pnpm release:changelog --commit (no entry) errors non-zero with usage — commit without an entry is rejected, not query mode"
    - "Other dirty/staged files are untouched by --commit: not staged into the commit, left exactly as found"
    - "pnpm release:bump patch passes its clean-tree preflight immediately after a --commit run (when CHANGELOG.md was the only dirt)"
  artifacts:
    - path: "src/lib/release/changelog.ts"
      provides: "parseChangelogArgs (pure argv grammar) + changelogCommitMessage (pure message builder)"
      exports: ["parseChangelogArgs", "changelogCommitMessage"]
    - path: "src/lib/release/changelog.test.ts"
      provides: "unit tests for the new pure functions (grammar, rejection cases, message shape)"
      contains: "parseChangelogArgs"
    - path: "scripts/changelog.mjs"
      provides: "driver wired through the parser + opt-in git add/commit step (execFileSync argv arrays)"
      contains: "execFileSync"
  key_links:
    - from: "scripts/changelog.mjs"
      to: "src/lib/release/changelog.ts"
      via: "import { parseChangelogArgs, changelogCommitMessage }"
      pattern: "parseChangelogArgs"
    - from: "scripts/changelog.mjs"
      to: "git"
      via: "execFileSync('git', ['commit', '-m', msg, '--', 'CHANGELOG.md'])"
      pattern: "--.*CHANGELOG\\.md"
---

<objective>
Add an opt-in `--commit` flag to `pnpm release:changelog "<entry>"`: when present, after appending the entry to `## [Unreleased]` the script creates its OWN commit (`docs(changelog): <entry>`, CHANGELOG.md only), so `pnpm release:bump patch` passes its clean-tree preflight immediately afterwards. Default (no flag) stays edit-only exactly as today.

Purpose: removes the manual "commit the changelog edit first" step between logging and bumping, without weakening any bump preflight.
Output: extended pure core (`parseChangelogArgs`, `changelogCommitMessage`) + tests; `scripts/changelog.mjs` wired through them with an opt-in pathspec commit.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md
@scripts/changelog.mjs
@scripts/bump-and-tag.mjs
@src/lib/release/changelog.ts
@src/lib/release/changelog.test.ts
@src/lib/release/bumpPlan.ts

<interfaces>
<!-- Existing contracts the executor builds on — no exploration needed. -->

From src/lib/release/changelog.ts (extend this file; do NOT touch existing exports):
```typescript
export const UNRELEASED_PLACEHOLDER = "- _Nothing yet._";
export function isUnreleasedHeading(line: string): boolean;
export function extractChangelogSection(changelog: string, version: string): string;
export function appendUnreleasedEntry(changelog: string, entry: string): string; // throws on empty entry; strips ONE leading "- "
export function promoteUnreleased(changelog: string, version: string, date: string): string;
```

From scripts/bump-and-tag.mjs (the subprocess idiom to mirror, NOT import):
```javascript
// execFileSync with an argv ARRAY (never execSync string) — no shell-injection surface.
execFileSync(file, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
```

Existing precedent for pure argv parsing: `parseBumpArgs` in src/lib/release/bumpPlan.ts (throws with usage text on bad grammar; the driver catches and exits non-zero).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Pure core — parseChangelogArgs + changelogCommitMessage (with tests)</name>
  <files>src/lib/release/changelog.ts, src/lib/release/changelog.test.ts</files>
  <behavior>
    parseChangelogArgs(argv: string[]) returns a discriminated result:
    - `{ mode: "query" }` when argv has no tokens (or only whitespace tokens) and NO `--commit` — preserves today's no-arg query behavior.
    - `{ mode: "append", entry: string, commit: boolean }` when a non-empty entry remains after extracting flags. `--commit` is recognized at ANY position in argv (before or after the entry); all `--commit` tokens are removed before joining the rest with single spaces into the entry.
    - THROWS (message includes the usage line) when:
      * `--commit` present but the remaining entry is empty/whitespace — commit needs an entry; query+commit is ambiguous, reject it.
      * any standalone argv token starts with `--` and is not exactly `--commit` (e.g. `--comit`, `--dry-run`) — a typo'd flag must never be silently logged as changelog text. (A quoted entry CONTAINING `--` inside one token, e.g. "add --dry-run flag", is ONE token not starting with `--`... careful: it starts with "add", fine. Only reject tokens whose own first two chars are `--`.)
    Tests (changelog.test.ts, same describe-block style as existing tests):
    - ["fix x", "--commit"] and ["--commit", "fix x"] both → { mode: "append", entry: "fix x", commit: true }
    - ["fix", "x"] → { mode: "append", entry: "fix x", commit: false }
    - [] → { mode: "query" }
    - ["--commit"] → throws (usage in message)
    - ["--comit", "fix x"] → throws
    - duplicate ["--commit", "--commit", "fix"] → append, commit true, entry "fix"
    changelogCommitMessage(entry: string) returns `docs(changelog): ${normalized}` where normalized = ONE leading `- `/`-` stripped + trimmed (same rule as appendUnreleasedEntry, so the commit subject matches the bullet text exactly).
    Tests: plain entry; entry with leading "- "; whitespace-padded entry. Throws on empty/whitespace-only entry (mirrors appendUnreleasedEntry).
  </behavior>
  <action>
    Extend src/lib/release/changelog.ts (pure module: NO fs, NO clock, NO subprocess, zero deps — keep the file's header contract intact). Add the two exported functions per the behavior block. Reuse the existing private normalizeEntry helper for changelogCommitMessage (export nothing extra). Define the usage string ONCE in the pure module (export it, e.g. `CHANGELOG_USAGE = 'Usage: pnpm release:changelog "<entry>" [--commit]'`) so parser throws and the driver's query print share one source of truth — the driver's local USAGE const is replaced in Task 2. Update the file's doc-comment decision list with the new grammar (one short bullet). Do NOT modify appendUnreleasedEntry / promoteUnreleased / extractChangelogSection or any existing test. Land tests GREEN with the impl in one commit (lefthook rejects failing RED commits).
  </action>
  <verify>
    <automated>pnpm vitest run src/lib/release/changelog.test.ts && pnpm exec tsc --noEmit</automated>
  </verify>
  <done>parseChangelogArgs + changelogCommitMessage + CHANGELOG_USAGE exported and unit-tested per the behavior matrix; all pre-existing changelog tests untouched and green; module still imports nothing from node builtins.</done>
</task>

<task type="auto">
  <name>Task 2: Wire --commit into scripts/changelog.mjs (pathspec commit, CHANGELOG.md only)</name>
  <files>scripts/changelog.mjs</files>
  <action>
    Rework main() in scripts/changelog.mjs to route through the pure parser:
    1. `const parsed = parseChangelogArgs(process.argv.slice(2))` inside a try/catch — on throw, logErr the message and exit 1 (mirrors bump driver's abort-on-parse idiom). Import parseChangelogArgs, changelogCommitMessage, CHANGELOG_USAGE from ../src/lib/release/changelog.ts; delete the local USAGE const and use CHANGELOG_USAGE in the query print.
    2. `mode === "query"` → existing query path unchanged (usage + sliceUnreleasedBlock, exit 0).
    3. `mode === "append"` → existing append path unchanged (bootstrap MINIMAL_CHANGELOG if missing, appendUnreleasedEntry, writeFileSync, confirmation log).
    4. NEW, only when `parsed.commit`: after the write + confirmation, commit CHANGELOG.md alone:
       - `import { execFileSync } from "node:child_process"`; add a tiny local `run(file, args)` helper that calls execFileSync with an argv ARRAY and `stdio: ["ignore", "pipe", "pipe"]` (mirror bump-and-tag.mjs run(), no shell — injection-safe even though the entry lands only in `-m`).
       - `run("git", ["add", "--", "CHANGELOG.md"])` — needed for the first-ever bootstrap case where CHANGELOG.md is untracked (a pathspec commit errors on untracked paths).
       - `run("git", ["commit", "-m", changelogCommitMessage(parsed.entry), "--", "CHANGELOG.md"])` — the `-- CHANGELOG.md` pathspec is the load-bearing decision: it commits ONLY CHANGELOG.md's working-tree state even if the user had OTHER files already staged; those stay staged/dirty untouched, and bump's own preflight still guards them. Document this in a comment.
       - log `Committed: ${message}`.
       - If either git call throws (not a repo, identity unset, hook rejection): the file edit is ALREADY safely on disk — catch, logErr the git stderr/message plus a one-line note that the CHANGELOG.md edit is kept and can be committed manually, exit 1. Never retry, never reset.
    5. Update the file's header comment: it is no longer strictly "NEVER touches git" — default mode still never does; `--commit` is the documented opt-in exception. Keep the no-flag path byte-identical in behavior.
    Manual smoke (executor runs, then restores): in the repo, `node --experimental-strip-types scripts/changelog.mjs "smoke test entry" --commit` matching however package.json's release:changelog script invokes node — verify `git log -1 --stat` shows `docs(changelog): smoke test entry` touching ONLY CHANGELOG.md, then `git reset --hard HEAD~1` to discard the smoke commit. Also verify `pnpm release:changelog` (no args) still prints usage + Unreleased block, exit 0.
  </action>
  <verify>
    <automated>pnpm test && pnpm exec tsc --noEmit && pnpm lint</automated>
  </verify>
  <done>--commit run produces exactly one commit `docs(changelog): &lt;entry&gt;` containing only CHANGELOG.md (proven by the smoke + reset); pre-staged unrelated files survive untouched; no-flag and no-arg paths behave exactly as today; git failure leaves the edit on disk with a clear message and non-zero exit; full suite + tsc + eslint green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| CLI argv → git subprocess | maintainer-typed entry text flows into a `git commit -m` argument |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-Q-AWO-01 | Tampering (shell injection) | scripts/changelog.mjs git calls | mitigate | execFileSync with argv ARRAY only (never execSync/string) — entry never touches a shell; mirrors bump-and-tag T-10-04 |
| T-Q-AWO-02 | Tampering (over-commit) | `--commit` sweeping unrelated staged files into the changelog commit | mitigate | pathspec commit `git commit -m &lt;msg&gt; -- CHANGELOG.md` — only CHANGELOG.md's content is committed regardless of index state |
| T-Q-AWO-03 | Repudiation (silent typo'd flag) | parseChangelogArgs | mitigate | any `--`-leading token other than `--commit` throws with usage — a misspelled flag can never be logged as changelog text |
| T-Q-AWO-04 | DoS (lost edit on git failure) | commit step after writeFileSync | accept | edit is already durably on disk before git runs; failure path prints the kept-edit note + manual recovery, exits non-zero |
</threat_model>

<verification>
- `pnpm vitest run src/lib/release/changelog.test.ts` — new grammar + message tests green, existing tests untouched.
- `pnpm test && pnpm exec tsc --noEmit && pnpm lint` — full gate green (decoder's 19 tests untouched, byte-for-byte).
- Smoke-proven on the real repo: `--commit` → one `docs(changelog): …` commit, CHANGELOG.md-only stat, then reset; immediately-following `pnpm release:bump patch --dry-run` clean-tree preflight passes (run dry-run only, then confirm; do NOT execute a real bump).
- Per-task harness DoD honored in order: /simplify → /codex:review (--wait --scope working-tree) → vitest/tsc/eslint. No UI surface → no webview gate.
- Zero new runtime/dev dependencies (node builtins only).
</verification>

<success_criteria>
- `pnpm release:changelog "x" --commit` (flag in either position) appends + commits CHANGELOG.md only; default mode unchanged; `--commit` without entry and unknown `--flags` rejected non-zero with usage.
- Pure grammar/message logic lives unit-tested in src/lib/release/changelog.ts; scripts/changelog.mjs stays a thin I/O shell.
- Full suite + tsc + eslint green; zero new deps; decoder + 19 tests untouched.
</success_criteria>

<output>
After completion, create `.planning/quick/260611-awo-release-changelog-commit-flag-opt-in-own/260611-awo-SUMMARY.md`
</output>
