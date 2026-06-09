---
phase: quick-260609-ard
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/release/changelog.ts
  - src/lib/release/changelog.test.ts
  - scripts/changelog.mjs
  - package.json
  - scripts/bump-and-tag.mjs
  - src/lib/release/bumpPlan.ts
  - src/lib/release/bumpPlan.test.ts
autonomous: true
requirements: [REL-changelog-cli]

must_haves:
  truths:
    - "Running `pnpm release:changelog \"Added X\"` appends `- Added X` to the END of the Unreleased bullet list in CHANGELOG.md, with NO git commit"
    - "An entry the user typed with a leading `- ` is normalized so the file never gets `- - Added X`"
    - "The first real Unreleased entry REPLACES the `- _Nothing yet._` placeholder rather than stacking above it"
    - "Running the command with no/empty argument prints a usage line plus the current Unreleased bullets and exits 0 (a query, not an error)"
    - "Running `pnpm release:bump` promotes `## [Unreleased]` to `## [<nextVersion>] - <today>` and inserts a fresh empty Unreleased section, and that CHANGELOG.md edit rides in the SAME bump commit + supplies the tag notes"
    - "`pnpm release:bump --dry-run` writes ZERO files — promotion does not run on a dry run"
  artifacts:
    - path: "src/lib/release/changelog.ts"
      provides: "appendUnreleasedEntry + promoteUnreleased pure functions alongside extractChangelogSection"
      contains: "export function appendUnreleasedEntry"
    - path: "scripts/changelog.mjs"
      provides: "edit-only release:changelog driver (fs read -> appendUnreleasedEntry -> fs write)"
      contains: "appendUnreleasedEntry"
    - path: "src/lib/release/bumpPlan.ts"
      provides: "CHANGELOG.md added to ALLOWED_PATHS (optional path, NOT a required manifest)"
      contains: "CHANGELOG.md"
  key_links:
    - from: "scripts/changelog.mjs"
      to: "src/lib/release/changelog.ts"
      via: "import { appendUnreleasedEntry } from ../src/lib/release/changelog.ts (run via tsx)"
      pattern: "appendUnreleasedEntry"
    - from: "scripts/bump-and-tag.mjs"
      to: "promoteUnreleased"
      via: "called in main() AFTER the --dry-run short-circuit, BEFORE writeManifests"
      pattern: "promoteUnreleased"
    - from: "scripts/bump-and-tag.mjs commitAndTag"
      to: "ALLOWED_PATHS"
      via: "changed ∩ ALLOWED now includes the promoted CHANGELOG.md, staged into the bump commit"
      pattern: "ALLOWED"
---

<objective>
Add a terminal-driven CHANGELOG workflow:
1. `pnpm release:changelog "xxx"` appends an entry to the `## [Unreleased]` section (edit-only, no commit).
2. `pnpm release:bump` auto-promotes `## [Unreleased]` to a dated, versioned section so the bump commit carries the changelog and the tag message picks up the real notes.

Purpose: let the maintainer log changes as they work, and make the bump the single moment that "cuts" the version — eliminating the manual edit-Unreleased-before-bump step the file header currently describes.

Output: two new pure functions (`appendUnreleasedEntry`, `promoteUnreleased`) with tests; a new thin `scripts/changelog.mjs` driver wired as `release:changelog`; promotion wired into `bump-and-tag.mjs`; CHANGELOG.md added to `ALLOWED_PATHS` (optional path only).

NO UI surface. This is release tooling — the real-webview UI gate is N/A here (stated honestly per the harness). The load-bearing gates are: `/simplify` -> `/codex:review` -> vitest + tsc + eslint green -> `node --check` on the edited `.mjs` files -> the smoke notes in the verify blocks.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md

<interfaces>
Existing pure helpers in src/lib/release/changelog.ts (USE these — do not re-derive):

```typescript
// Internal (not exported) — the two new fns may reuse these or local mirrors:
function isAnyHeading(line: string): boolean;          // line.trim().startsWith("## ")
function isVersionHeading(line: string, version: string): boolean;

// Exported, already shipped:
export function extractChangelogSection(changelog: string, version: string): string;
```

Convention notes for the new pure fns (mirror extractChangelogSection EXACTLY):
- Split on "\n", strip a trailing "\r" per line (CRLF tolerance), operate on string arrays.
- Treat `## [Unreleased]` as the section whose heading line, `\r`-stripped + trimmed, equals `## [Unreleased]` (Unreleased is NOT a version — do NOT route it through isVersionHeading; match the literal heading, bracket-tolerant in the same spirit but a literal "Unreleased" token).
- A version section heading is any line where `isAnyHeading` is true AND the text after `## ` starts with `[` and a digit (i.e. `## [x.y.z]`). Use this to find "the newest (first) version section" insertion point.
- Pure: no fs, no clock, no Date, no deps. `date` for promoteUnreleased is an INJECTED param.

Driver conventions (scripts/lib/releaseNotes.mjs + scripts/build-and-publish.mjs):
- `import { ... } from "../src/lib/release/changelog.ts";` (run via tsx — .ts import from .mjs is fine).
- `log()` writes stdout, `logErr()`/`abort()` writes stderr + non-zero exit.
- fs is `node:fs` (readFileSync/writeFileSync/existsSync). `process.argv.slice(2)` for args.

bump-and-tag.mjs structure (already read):
- main() order: parseBumpArgs -> readCurrentVersion -> buildBumpPlan -> preflights -> [if (dryRun) { print; exit(0) }] -> writeManifests -> regenLockfiles -> commitAndTag -> push.
- `node:fs` import at top is `import { readFileSync, writeFileSync } from "node:fs";` (line 26) — add `existsSync`.
- commitAndTag() stages `changedPaths().filter(p => ALLOWED.has(p))`; `ALLOWED = new Set(ALLOWED_PATHS)`. resolveReleaseNotes(plan.nextVersion, ...) keys on the version being tagged.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add appendUnreleasedEntry + promoteUnreleased pure functions with tests</name>
  <files>src/lib/release/changelog.ts, src/lib/release/changelog.test.ts</files>
  <behavior>
    appendUnreleasedEntry(changelog, entry):
    - "Added X" -> the Unreleased bullet list gains a trailing "- Added X" (after the last existing bullet, before the section's trailing blank line / next `## ` heading).
    - "- Added X" and "-Added X" both normalize to exactly "- Added X" (strip ONE leading "- " or "-", then trim — never produce "- - Added X").
    - When Unreleased holds ONLY "- _Nothing yet._", the first real entry REPLACES the placeholder (placeholder gone, "- Added X" in its place).
    - Two successive appends produce two bullets in call order (second below first).
    - No `## [Unreleased]` section -> a new `## [Unreleased]` section (with the entry) is created ABOVE the newest (first) `## [x.y.z]` version section; if there is also no version section, appended at end.
    - Empty / whitespace-only entry -> throws an Error (clear message).
    - CRLF input still parses + appends (tolerant like extractChangelogSection).

    promoteUnreleased(changelog, version, date):
    - Renames `## [Unreleased]` to `## [<version>] - <date>` AND inserts a fresh `## [Unreleased]` section (with "- _Nothing yet._" placeholder) above the now-versioned section.
    - Still promotes when Unreleased held only the placeholder (heading rename + fresh-section insert is always a real diff).
    - NO-OP returning the input string UNCHANGED when there is no `## [Unreleased]` section.
    - date is injected (pure, no clock).
    - Round-trip sanity: after promoteUnreleased(text, "0.4.0", "2026-06-09"), extractChangelogSection(result, "0.4.0") returns the body that had been under Unreleased.
  </behavior>
  <action>
    In src/lib/release/changelog.ts, add the two exported functions BELOW extractChangelogSection, mirroring the file-header "Decisions:" comment style and the existing line-array / `\r`-strip approach. Reuse isAnyHeading; add a small internal `isUnreleasedHeading(line)` (literal "Unreleased", bracket-tolerant) and an internal helper to detect a `## [x.y.z]` version heading (after `## `, starts with `[` + digit) for the insertion-point logic. Keep them pure — NO fs, NO Date, NO new imports. Extend the file-header Decisions block with one bullet per new fn explaining the placeholder-replace and no-op rules.

    Normalization for the entry: `entry.replace(/^-\s?/, "").trim()` then reject if empty (throw `new Error("changelog entry is empty")` or similar clear text). Prefix exactly "- " when writing.

    In changelog.test.ts, add two new `describe` blocks ("appendUnreleasedEntry", "promoteUnreleased") covering every bullet in <behavior> above — mirror the existing test file's literal-fixture style (build small CHANGELOG strings inline; reuse a placeholder-only fixture and a multi-bullet fixture). Land tests GREEN with the impl in one commit (lefthook rejects failing tsc/vitest — see project memory tdd-red-commits-blocked-by-lefthook). Do NOT touch the existing extractChangelogSection tests.
  </action>
  <verify>
    <automated>pnpm vitest run src/lib/release/changelog.test.ts && pnpm exec tsc --noEmit && pnpm lint</automated>
  </verify>
  <done>Both functions exported and pure (no fs/Date/deps); new test cases cover placeholder-replace, leading-dash normalization, empty-entry throw, no-Unreleased creation, promote rename+fresh-section, promote no-op, and CRLF — all green; existing 19-decoder + extractChangelogSection tests untouched and still green.</done>
</task>

<task type="auto">
  <name>Task 2: Add scripts/changelog.mjs driver and wire release:changelog in package.json</name>
  <files>scripts/changelog.mjs, package.json</files>
  <action>
    Create scripts/changelog.mjs as a thin EDIT-ONLY driver (NO git, NO subprocess), mirroring releaseNotes.mjs / build-and-publish.mjs conventions (file-header comment, `log()`/`abort()` helpers, `node:fs` only):
    - `import { appendUnreleasedEntry } from "../src/lib/release/changelog.ts";` (run via tsx).
    - entry = `process.argv.slice(2).join(" ").trim()`.
    - Empty/missing entry (a QUERY, not an error): print a one-line usage (`Usage: pnpm release:changelog "<entry>"`) and the CURRENT Unreleased bullets, then `process.exit(0)`. To print the Unreleased block: read CHANGELOG.md (if it exists) and slice from the `## [Unreleased]` line to the next `## ` line; if the file is missing, print "(no CHANGELOG.md yet)". Do NOT route Unreleased through extractChangelogSection (Unreleased is not a version). A tiny inline slice is fine — keep it dumb display logic, no new pure export needed.
    - Non-empty entry: if CHANGELOG.md is MISSING, first create a minimal file matching the current file's preamble shape (the `# Changelog` header + the Keep-a-Changelog blurb + an empty `## [Unreleased]` with `- _Nothing yet._`), then apply. Otherwise read it. Call `appendUnreleasedEntry(text, entry)`, `writeFileSync("CHANGELOG.md", result)`, and `log` a one-line confirmation. Let a thrown empty-entry Error surface via a top-level catch -> stderr + non-zero exit (but note empty arg is handled as the query path above, so the throw mainly guards a whitespace-only quoted arg; still wire the catch).
    - Top-level: `main().catch(err => { logErr(...); process.exit(1); })` per the other drivers.

    In package.json "scripts", add `"release:changelog": "tsx scripts/changelog.mjs",` next to the existing `release:bump` / `release:publish` lines (do not disturb other scripts).
  </action>
  <verify>
    <automated>node --check scripts/changelog.mjs && pnpm exec tsc --noEmit</automated>
  </verify>
  <done>`node --check scripts/changelog.mjs` passes; `pnpm release:changelog "test smoke entry"` appends `- test smoke entry` to Unreleased (verify the diff, then revert the smoke edit); `pnpm release:changelog` with no arg prints usage + the current Unreleased bullets and exits 0; package.json has the new script. NO git commit performed by the driver.</done>
</task>

<task type="auto">
  <name>Task 3: Wire promotion into bump-and-tag.mjs and add CHANGELOG.md to ALLOWED_PATHS</name>
  <files>scripts/bump-and-tag.mjs, src/lib/release/bumpPlan.ts, src/lib/release/bumpPlan.test.ts</files>
  <action>
    bumpPlan.ts: add `"CHANGELOG.md"` to `ALLOWED_PATHS` ONLY (do NOT add to `REQUIRED_MANIFESTS` — an absent CHANGELOG or a no-op promotion must still pass assertOnlyExpectedPaths). Update the ALLOWED_PATHS doc-comment: it currently says "5-path allowlist ... 3 manifests plus the 2 lockfiles" — reword to note the added OPTIONAL `CHANGELOG.md` path (e.g. "6-path allowlist: 3 manifests, 2 lockfiles, plus the optional CHANGELOG.md the bump promotes").

    bumpPlan.test.ts: update the "ALLOWED_PATHS is exactly ..." test to include `"CHANGELOG.md"`. Add an assertOnlyExpectedPaths case: a changed set of `[...MANIFESTS, "CHANGELOG.md"]` passes (CHANGELOG is allowed); and confirm `[...MANIFESTS]` alone (no CHANGELOG) STILL passes (CHANGELOG is NOT required). Keep the existing stray/missing-manifest cases.

    bump-and-tag.mjs:
    - Add `existsSync` to the `node:fs` import (line 26: `import { readFileSync, writeFileSync } from "node:fs";` -> add existsSync).
    - Add `import { promoteUnreleased } from "../src/lib/release/changelog.ts";` to the bumpPlan import group.
    - In main(), place promotion AFTER the `if (dryRun) { ...; process.exit(0); }` short-circuit and BEFORE `writeManifests(plan)` (so --dry-run stays ZERO writes): if `existsSync("CHANGELOG.md")`, read it, compute `const today = new Date().toISOString().slice(0, 10);` (the driver MAY read the clock — the pure fn must not), call `promoteUnreleased(text, plan.nextVersion, today)`, and `writeFileSync("CHANGELOG.md", promoted)` ONLY if `promoted !== text`. Add a short `log(...)` line when it promotes. A small helper `promoteChangelog(plan)` mirroring writeManifests' style is fine.
    - No change to commitAndTag's staging loop: once CHANGELOG.md is in ALLOWED and was changed by promotion, `changed ∩ ALLOWED` stages it into the SAME bump commit, and resolveReleaseNotes(plan.nextVersion, ...) then finds the freshly-promoted section for the tag message. Confirm by reading the ordering (promote in main before commitAndTag).
  </action>
  <verify>
    <automated>node --check scripts/bump-and-tag.mjs && pnpm vitest run src/lib/release/bumpPlan.test.ts && pnpm exec tsc --noEmit && pnpm lint</automated>
  </verify>
  <done>ALLOWED_PATHS contains CHANGELOG.md (and REQUIRED_MANIFESTS does NOT); bumpPlan tests green incl. the new CHANGELOG-allowed + CHANGELOG-not-required cases; `node --check scripts/bump-and-tag.mjs` passes; promotion call sits AFTER the dry-run short-circuit; `pnpm release:bump --dry-run` runs and writes ZERO files (confirm `git status` clean after — no CHANGELOG diff).</done>
</task>

</tasks>

<verification>
- `pnpm vitest run` fully green (decoder's 19 + extractChangelogSection + new changelog cases + bumpPlan cases). `pnpm exec tsc --noEmit` clean. `pnpm lint` clean.
- `node --check scripts/changelog.mjs` and `node --check scripts/bump-and-tag.mjs` both pass.
- Smoke: `pnpm release:changelog "smoke"` appends correctly; no-arg prints Unreleased + usage at exit 0; revert any smoke edit before finishing.
- Smoke: `pnpm release:bump --dry-run` leaves the tree clean (NO CHANGELOG.md write) — proves promotion is gated after the dry-run short-circuit.
- Zero new runtime AND dev dependencies (tsx already present). decoder.ts + its 19 tests untouched.
- UI gate: N/A — this task has no webview surface (stated per the harness; the binding gates here are simplify -> code-review -> vitest+tsc+eslint -> node --check).
</verification>

<success_criteria>
- `pnpm release:changelog "xxx"` appends `- xxx` to Unreleased (placeholder-replacing on first real entry, dash-normalized), edit-only, no commit; no-arg is a clean exit-0 query.
- `pnpm release:bump` promotes Unreleased -> `## [<version>] - <date>` with a fresh Unreleased, rides the same bump commit (via ALLOWED_PATHS), and feeds the tag notes; `--dry-run` writes nothing.
- The two new functions are pure (no fs/clock/deps), fully unit-tested, and sit beside extractChangelogSection in the same style.
- CHANGELOG.md is an OPTIONAL allowed path (in ALLOWED_PATHS, not REQUIRED_MANIFESTS) so changelog-less / no-op-promotion bumps still pass assertOnlyExpectedPaths.
</success_criteria>

<output>
After completion, create `.planning/quick/260609-ard-add-pnpm-release-changelog-command-auto-/260609-ard-SUMMARY.md`
</output>
