---
phase: quick-260608-avk
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - CHANGELOG.md
  - src/lib/release/changelog.ts
  - src/lib/release/changelog.test.ts
  - scripts/build-and-publish.mjs
  - scripts/bump-and-tag.mjs
  - src/components/UpdateBanner.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "extractChangelogSection returns the body of a version's section, trimmed, up to the next ## heading or EOF"
    - "A version string matches its heading whether written bracketed, unbracketed, or date-suffixed; exact version only (0.3.0 != 0.3.10)"
    - "Missing section or empty body returns \"\""
    - "pnpm release:publish stamps real CHANGELOG notes into latest.json AND the gh release body, falling back to the tag when absent/empty"
    - "pnpm release:bump stamps the same real notes into the annotated tag message, falling back to the tag"
    - "The updater banner preserves multi-line notes line breaks (whitespace-pre-line) without affecting single-line notes"
  artifacts:
    - path: "CHANGELOG.md"
      provides: "Keep-a-Changelog file with an [Unreleased] section + a real 0.3.0 section"
      contains: "## [0.3.0]"
    - path: "src/lib/release/changelog.ts"
      provides: "Pure extractChangelogSection(changelog, version) -> string"
      exports: ["extractChangelogSection"]
      min_lines: 25
    - path: "src/lib/release/changelog.test.ts"
      provides: "vitest coverage of all heading-shape + boundary + no-false-prefix cases"
  key_links:
    - from: "scripts/build-and-publish.mjs"
      to: "src/lib/release/changelog.ts"
      via: "import extractChangelogSection; notes = extractChangelogSection(text, version) || view.tag"
      pattern: "extractChangelogSection"
    - from: "scripts/build-and-publish.mjs"
      to: "gh release create / buildLatestJson"
      via: "notes passed as a separate argv element + manifest notes field"
      pattern: "notes"
---

<objective>
Plumb REAL, version-keyed release notes through the maintainer release pipeline via a root `CHANGELOG.md`. Today both `pnpm release:bump` and `pnpm release:publish` stamp the bare git tag string (e.g. "0.3.0") into every notes slot, so the in-app updater banner and the GitHub release body just echo the version. This plan introduces a pure, unit-tested `extractChangelogSection` reader, seeds `CHANGELOG.md`, and wires the two drivers (plus a one-class banner fix) to use the extracted notes with a resilient fall-back to the tag.

Purpose: Maintainers ship meaningful notes; users see what changed in the updater banner and on the GitHub release.
Output: `CHANGELOG.md`, a tested pure `changelog.ts` module, wired `build-and-publish.mjs` + `bump-and-tag.mjs`, and a banner `whitespace-pre-line` fix.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md

# Pure-module + test conventions to mirror EXACTLY (file-header doc-comment + Decisions block):
@src/lib/release/manifest.ts
@src/lib/release/manifest.test.ts

# The two drivers to wire — note the argv-array / no-secret-log / assets-first safety invariants:
@scripts/build-and-publish.mjs
@scripts/bump-and-tag.mjs

# The one-line banner change site (notes <p> ~line 57):
@src/components/UpdateBanner.tsx

<interfaces>
<!-- The pure manifest fn already accepts an optional `notes` — the publish driver just needs to pass a real string. -->

From src/lib/release/manifest.ts:
```typescript
export interface BuildLatestJsonInput {
  version: string;
  pubDate: string;
  url: string;
  signature: string;
  notes?: string; // defaults to "" (D-04a)
}
export function buildLatestJson(input: BuildLatestJsonInput): LatestJson;
```

New contract THIS plan creates (Task 1):
```typescript
// src/lib/release/changelog.ts
export function extractChangelogSection(changelog: string, version: string): string;
```

Current version (from package.json): `0.3.0` — seed CHANGELOG.md's first real section as `## [0.3.0] - 2026-06-08`.
</interfaces>
</context>

<constraints>
- **Zero new runtime AND dev dependencies.** `changelog.ts` is PURE: no fs, no clock, no I/O, no regex deps — plain string logic, mirroring `manifest.ts`.
- **Do NOT touch `src/lib/protobuf/decoder.ts` or its 19 tests.** Untouched by this plan.
- **Argv-array safety in both drivers:** the notes string is ALWAYS passed as a SEPARATE `execFileSync` argv element (to `gh release create --notes <notes>` and `git tag -a <tag> -m <notes>`) — NEVER interpolated into a shell string. Do not log secret values. Do not change the assets-first / manifest-last ordering. Do not `git add` latest.json.
- **Resilience:** a missing `CHANGELOG.md` or an empty/missing section must NOT crash — guard the read, fall back to `view.tag` (publish) / `plan.tag` (bump), and emit a non-fatal `log(...)` warning so the maintainer notices.
- **Tests land GREEN with their implementation** (lefthook rejects failing `tsc`/`vitest` commits — see project memory `tdd-red-commits-blocked-by-lefthook`). Do NOT plan a standalone RED-only commit.
</constraints>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Pure changelog reader + tests + seed CHANGELOG.md</name>
  <files>src/lib/release/changelog.ts, src/lib/release/changelog.test.ts, CHANGELOG.md</files>
  <behavior>
    extractChangelogSection(changelog, version):
    - Exact-version match: "## [0.3.0] - 2026-06-08", "## [0.3.0]", and "## 0.3.0" all match version "0.3.0".
    - Tolerates optional brackets, an optional " - <date>" suffix, and surrounding whitespace on the heading line.
    - Returns the body from just AFTER the heading line up to (but excluding) the next "## " heading or EOF, trimmed.
    - No false prefix match: version "0.3.0" must NOT match heading "## [0.3.10]" or "## [10.3.0]".
    - Missing section -> "". Empty/whitespace-only body -> "".
    - Last-section-in-file (EOF boundary) returns the trailing body.
    - CRLF tolerance (if cheap): "\r\n" line endings still match + extract.
  </behavior>
  <action>
    Create `src/lib/release/changelog.ts` exporting `export function extractChangelogSection(changelog: string, version: string): string`. PURE — no fs/clock/IO/deps. Mirror `manifest.ts`'s file-header doc-comment + a short `Decisions:` block explaining: heading-shape tolerance (optional `[]`, optional ` - date`), exact-version-only matching (escape the version's `.` so `0.3.0` cannot match `0.3.10`/`10.3.0` — e.g. anchor the version between the optional bracket/whitespace and an optional ` - …`/end), and the "body up to next `## ` or EOF, trimmed" rule.

    Implementation sketch (keep it simple, no new deps): split into lines (handle `\r` by stripping trailing `\r` per line or normalising once). Build a per-line heading test: a line that, after trim, starts with `## `, optional `[`, the EXACT version, optional `]`, then optionally whitespace + `-` + anything, and nothing else version-like before it. Escape `.` in the version when building the matcher so dots are literal. On the first matching heading, collect subsequent lines until the next line whose trim starts with `## ` (any heading) or EOF; join + trim; return (""  if empty). Return "" if no heading matched.

    Create `src/lib/release/changelog.test.ts` beside it (vitest, `import { describe, expect, it } from "vitest"`), mirroring `manifest.test.ts` style. Cover every <behavior> bullet: exact match; bracketed vs unbracketed vs date-suffixed headings (3 cases, same body); body-stops-at-next-`## `-heading; missing section -> ""; empty body -> ""; no-false-prefix (0.3.0 vs 0.3.10 AND vs 10.3.0); last-section-EOF boundary; CRLF tolerance.

    Create root `CHANGELOG.md` in Keep-a-Changelog style: a top `## [Unreleased]` section (can be empty placeholder bullets), then `## [0.3.0] - 2026-06-08` with a concise, REAL summary of what shipped through v0.3.0 (the maintainer may edit before the next publish). Derive a short, honest summary from STATE.md's milestone history (e.g. the six-tool DevTools app: schema-less Protobuf decoder hero + Base64/Hex/Bytes/JSON/XML/URL/Regex/Cron tools, reorderable + pinnable sidebar, self-updating signed macOS build). Keep it a handful of bullets — do not over-claim.
  </action>
  <verify>
    <automated>pnpm test src/lib/release/changelog.test.ts && pnpm exec tsc --noEmit</automated>
  </verify>
  <done>`extractChangelogSection` exported and pure; changelog.test.ts green covering all heading shapes + boundaries + no-false-prefix + EOF + CRLF; CHANGELOG.md exists with `## [Unreleased]` and a real `## [0.3.0]` section; full `pnpm test` + `tsc --noEmit` green; decoder's 19 tests untouched.</done>
</task>

<task type="auto">
  <name>Task 2: Wire both release drivers to real notes (resilient fallback)</name>
  <files>scripts/build-and-publish.mjs, scripts/bump-and-tag.mjs</files>
  <action>
    **build-and-publish.mjs:**
    - Add `import { extractChangelogSection } from "../src/lib/release/changelog.ts";` beside the existing `buildLatestJson` import (~line 52).
    - Add a small resilient helper (or inline guard) that reads `CHANGELOG.md` with the existing `readFileSync`/`existsSync` imports and returns `extractChangelogSection(text, version) || tag`, returning `tag` (and a non-fatal `log("note: no CHANGELOG.md section for <version> — shipping the tag as notes.")` warning) when the file is missing OR the section is empty. Wrap the read so a missing file never throws.
    - In `publish(view, version, ...)`, compute `const notes = <resilientRead>(version, view.tag);` before building latest.json (after the assets are resolved is fine; before the `buildLatestJson({...})` call at ~line 287).
    - Replace `notes: view.tag` in the `buildLatestJson({...})` call (~line 292) with `notes`.
    - Replace the `--notes` value in the `gh release create` argv (~lines 311-312) from `view.tag` to `notes`. Keep it a SEPARATE argv element — do NOT interpolate. Leave `--title view.tag` as-is.
    - Do NOT change: the execFileSync argv arrays, the `{ env: process.env }` inheritance, secret-logging discipline, assets-first/manifest-last ordering, or the no-`git add` rule for latest.json.

    **bump-and-tag.mjs (optional — INCLUDE it; it is low-risk, same pattern):**
    - Add the same `import { extractChangelogSection }` (the file already imports `readFileSync`).
    - Add `existsSync` to the `node:fs` import (currently only `readFileSync, writeFileSync`) for the guarded read.
    - In `commitAndTag(plan)`, before the `git tag -a` call (~line 218), compute `const notes = <resilientRead>(plan.nextVersion, plan.tag);` using the same resilient-read shape (missing file / empty section -> `plan.tag` + a non-fatal `log(...)` warning). Note: bump runs BEFORE publish and BEFORE package.json is what publish reads — use `plan.nextVersion` (the version being tagged) as the lookup key so the maintainer's CHANGELOG entry for the NEW version is found.
    - Replace `run("git", ["tag", "-a", plan.tag, "-m", plan.tag])` (~line 218) with `run("git", ["tag", "-a", plan.tag, "-m", notes])`. Keep `notes` a SEPARATE argv element (annotated tag message), never a shell string.
    - Preserve all argv-array safety, the no-`git reset`/`git tag -d` rule, and the preflight-before-write ordering.

    If wiring bump turns out to add meaningful risk/complexity (it should not — it is the identical guarded-read pattern), the executor may defer it and note that in the SUMMARY; the publish wiring is the load-bearing half.
  </action>
  <verify>
    <automated>node --check scripts/build-and-publish.mjs && node --check scripts/bump-and-tag.mjs && pnpm exec tsc --noEmit && pnpm test</automated>
  </verify>
  <done>Both drivers import `extractChangelogSection`; publish stamps real notes into BOTH latest.json (`buildLatestJson` notes) and the `gh release create --notes` argv (separate element), falling back to the tag with a non-fatal warning when CHANGELOG.md/section is absent; bump stamps the same real notes into the `git tag -a -m` argv keyed on `plan.nextVersion`, same fallback; argv-array safety + assets-first ordering + no-`git add`/`git reset` invariants intact; `node --check` clean on both scripts; `tsc --noEmit` + full `pnpm test` green.</done>
</task>

<task type="auto">
  <name>Task 3: UpdateBanner multi-line notes (whitespace-pre-line)</name>
  <files>src/components/UpdateBanner.tsx</files>
  <action>
    On the notes `<p>` (~line 57), add the Tailwind class `whitespace-pre-line` to its className so multi-line CHANGELOG notes keep their line breaks in-app (newlines render as breaks; runs of whitespace still collapse). Change ONLY this class string — e.g. `className="text-[12px] leading-5 text-tx-2 whitespace-pre-line"`. Do not alter the conditional render, the tokens, or any other markup. Single-line notes are visually unaffected by `whitespace-pre-line`.

    HONEST verification note (put in the SUMMARY): triggering the real updater banner live on the WKWebView requires an actual newer published release, which is impractical to stage here. The load-bearing verification is therefore the unit tests (Task 1) plus a static/DOM check that the `whitespace-pre-line` class is present on the notes paragraph and that single-line notes still render unchanged — NOT a live updater round-trip. Scope the real-webview gate to exactly that DOM assertion; do not claim a live updater verification.
  </action>
  <verify>
    <automated>pnpm exec tsc --noEmit && grep -q "whitespace-pre-line" src/components/UpdateBanner.tsx && pnpm test</automated>
  </verify>
  <done>The notes `<p>` carries `whitespace-pre-line`; no other markup/tokens changed; `tsc --noEmit` + full `pnpm test` green; SUMMARY records the honest banner-verification scope (DOM class check, not a live updater round-trip).</done>
</task>

</tasks>

<verification>
- `pnpm test` (full suite) green — new changelog.test.ts included; decoder's 19 tests untouched and passing.
- `pnpm exec tsc --noEmit` clean.
- `node --check scripts/build-and-publish.mjs` and `node --check scripts/bump-and-tag.mjs` clean.
- `CHANGELOG.md` exists with `## [Unreleased]` + `## [0.3.0]`.
- Manual reasoning (no live publish required): a `--dry-run` of publish is unchanged (notes are only computed/used in the irreversible `publish()` path, after the dry-run short-circuit) — confirm the dry-run path still exits 0 with zero writes.
- Zero new entries in package.json dependencies/devDependencies and src-tauri/Cargo.toml.
- Per-task binding harness (executor runs, in order): `/simplify` on the just-written changes -> `/codex:review --wait --scope working-tree` (address findings) -> unit tests green (`pnpm test` + `pnpm exec tsc --noEmit` + `pnpm lint`) -> real-webview UI verification scoped to the banner DOM class check ONLY (Task 3; the script/module tasks have no UI surface).
</verification>

<success_criteria>
- `extractChangelogSection` is pure, exported, and passes tests for every heading shape (bracketed / unbracketed / date-suffixed), the body-to-next-heading and EOF boundaries, missing/empty -> "", and no-false-prefix (0.3.0 vs 0.3.10 / 10.3.0), with CRLF tolerance.
- `pnpm release:publish` writes real CHANGELOG notes into latest.json AND the GitHub release body, with a resilient tag fallback + non-fatal warning when the section is absent.
- `pnpm release:bump` writes the same real notes into the annotated tag message (keyed on the bumped version), same resilient fallback.
- The updater banner preserves multi-line note breaks (`whitespace-pre-line`) without affecting single-line notes.
- Argv-array / no-secret-log / assets-first / no-`git add` / no-`git reset` safety invariants are all preserved; zero new runtime or dev dependencies; decoder + its 19 tests byte-for-byte untouched; `tsc` + `vitest` green.
</success_criteria>

<output>
After completion, create `.planning/quick/260608-avk-plumb-release-notes-through-changelog-md/260608-avk-SUMMARY.md` (mirror the summary template). Record: the final `extractChangelogSection` signature + matcher decisions, whether bump wiring was included or deferred (with rationale), and the HONEST banner-verification scope (DOM class check, not a live updater round-trip).
</output>
