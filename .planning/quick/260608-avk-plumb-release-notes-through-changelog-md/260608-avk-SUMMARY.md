---
phase: quick-260608-avk
plan: 01
subsystem: release-tooling
tags: [release, changelog, updater, notes]
requires:
  - src/lib/release/manifest.ts (buildLatestJson notes field)
  - scripts/build-and-publish.mjs / scripts/bump-and-tag.mjs (drivers)
provides:
  - extractChangelogSection(changelog, version) -> string (pure section reader)
  - CHANGELOG.md (Keep-a-Changelog source of release notes)
  - real version-keyed notes in latest.json, gh release body, and the annotated tag
affects:
  - src/components/UpdateBanner.tsx (multi-line notes render)
tech-stack:
  added: []
  patterns: [pure-module-mirrors-manifest.ts, resilient-guarded-read-with-tag-fallback]
key-files:
  created:
    - src/lib/release/changelog.ts
    - src/lib/release/changelog.test.ts
    - CHANGELOG.md
  modified:
    - scripts/build-and-publish.mjs
    - scripts/bump-and-tag.mjs
    - src/components/UpdateBanner.tsx
decisions:
  - "extractChangelogSection is PURE (text injected by caller) — mirrors manifest.ts; zero new deps"
  - "Exact-version matching: anchored after optional [ + version, only ]/whitespace/'- suffix'/EOL may follow, so 0.3.0 != 0.3.10 / 10.3.0"
  - "Bump wiring INCLUDED (identical low-risk guarded-read pattern), keyed on plan.nextVersion"
  - "Banner verification scope = DOM class check only, NOT a live updater round-trip"
metrics:
  duration: ~12m
  completed: 2026-06-08
  tasks: 3
  files: 6
  test_delta: +10 (694 -> 704)
---

# Phase quick-260608-avk Plan 01: Plumb Release Notes Through CHANGELOG.md Summary

Real, version-keyed release notes now flow from a root `CHANGELOG.md` through a pure, unit-tested `extractChangelogSection` reader into the annotated git tag, the Tauri updater `latest.json`, and the GitHub release body — replacing the bare-tag echo, with a resilient fall-back to the tag (plus a non-fatal warning) when a section is missing.

## What Shipped

- **`src/lib/release/changelog.ts`** — pure `extractChangelogSection(changelog: string, version: string): string`. Zero deps, no fs/clock/IO. Tolerates bracketed / unbracketed / date-suffixed headings, returns the body up to the next `## ` heading or EOF (trimmed), `""` on missing/empty, CRLF-tolerant. File-header doc-comment + `Decisions:` block mirror `manifest.ts`.
- **`src/lib/release/changelog.test.ts`** — 10 vitest cases: exact match + body-stops-at-next-heading; bracketed/unbracketed/date-suffixed (same body); EOF boundary; missing -> `""`; empty body -> `""`; no-false-prefix (0.3.0 vs 0.3.10 AND vs 10.3.0); CRLF; purity.
- **`CHANGELOG.md`** — Keep-a-Changelog seed: `## [Unreleased]` placeholder + a real `## [0.3.0] - 2026-06-08` section (honest summary derived from STATE.md milestone history).
- **`scripts/build-and-publish.mjs`** — imports `extractChangelogSection`; a guarded `resolveReleaseNotes(version, tag)` helper (`existsSync`-guarded read, `|| tag` fallback + non-fatal `log` warning) feeds both `buildLatestJson({ ..., notes })` and the `gh release create --notes <notes>` argv (separate element).
- **`scripts/bump-and-tag.mjs`** — same pattern via `resolveTagNotes(plan.nextVersion, plan.tag)`, stamped into `git tag -a -m <notes>` (separate argv element); added `existsSync` to the `node:fs` import.
- **`src/components/UpdateBanner.tsx`** — added `whitespace-pre-line` to the notes `<p>` so multi-line notes keep their breaks; single-line notes unaffected.

## `extractChangelogSection` Signature + Matcher Approach

```typescript
export function extractChangelogSection(changelog: string, version: string): string;
```

**Matcher (string logic, no regex deps):** per line, strip a trailing `\r`, `trim()`, require a `## ` prefix, drop an optional leading `[`, then require the line to **start with the exact version**. After the version, a bracketed heading must close `]` immediately; what remains is trimmed and must be either empty (`## 0.3.0` / `## [0.3.0]`) or begin with `-` (the ` - <date>` suffix). Any other trailing character (e.g. the `10` of `0.3.10`) fails the match — that is the no-false-prefix guard, achieved by anchoring rather than a prefix `includes`. Body = lines after the matched heading until the next `## ` heading (any version) or EOF, joined and trimmed; `""` if empty or no heading matched.

## Bump Wiring: INCLUDED

The optional `bump-and-tag.mjs` wiring was **included**, not deferred — it is the identical guarded-read pattern with no added risk. It is keyed on `plan.nextVersion` (the version being tagged) so the maintainer's CHANGELOG entry for the NEW version is the one stamped into the annotated tag. Same `existsSync`-guarded read, same tag fallback + warning. Argv-array safety, the no-`git reset`/`git tag -d` rule, and preflight-before-write ordering are all preserved.

## Safety Invariants Preserved

- Notes always passed as a **separate `execFileSync` argv element** (`--notes <notes>`, `git tag -a -m <notes>`) — never interpolated into a shell string.
- `publish()` notes are computed/used only in the irreversible path (after the `--dry-run` short-circuit), so `--dry-run` still exits 0 with zero writes.
- No change to: assets-first/manifest-last ordering, the `{ env: process.env }` secret inheritance, secret-logging discipline, the no-`git add latest.json` rule.
- **Zero new runtime AND dev dependencies** (package.json + Cargo.toml unchanged vs base).
- **`src/lib/protobuf/decoder.ts` + its 19 tests byte-for-byte untouched** (no diff vs base `9c84714f`; 19/19 green).

## Test Count Delta

694 -> **704** (+10, all from `changelog.test.ts`). Full suite 704/704 green; `tsc --noEmit` clean; `pnpm lint` clean; `node --check` clean on both drivers.

## Banner-Verification Scope (HONEST)

Triggering the real updater banner live on the WKWebView requires an actual newer published release, which is impractical to stage here. The load-bearing verification is therefore the unit tests (Task 1) plus a static DOM check that `whitespace-pre-line` is present on the notes paragraph and that single-line notes still render unchanged — **NOT a live updater round-trip**. The orchestrator runs that banner DOM check on the real webview.

## Deviations from Plan

None — plan executed exactly as written. The optional bump wiring was included per the plan's recommendation.

## Pending Orchestrator Gates

Per the execution constraints, the following gates run AFTER this executor returns, on the working tree:
- `/simplify` on the just-written changes
- `/codex:review --wait --scope working-tree` (address findings)
- real-webview UI verification scoped to the banner `whitespace-pre-line` DOM class check (Task 3 has the only UI surface; the script/module tasks have none)

## Commits

- `6b10c3df` feat(quick-260608-avk): pure changelog reader + tests + seed CHANGELOG.md
- `81ddfc8b` feat(quick-260608-avk): wire both release drivers to real CHANGELOG notes
- `05b118f2` feat(quick-260608-avk): preserve multi-line updater notes (whitespace-pre-line)

## Self-Check: PASSED

- FOUND: src/lib/release/changelog.ts
- FOUND: src/lib/release/changelog.test.ts
- FOUND: CHANGELOG.md
- FOUND commit: 6b10c3df
- FOUND commit: 81ddfc8b
- FOUND commit: 05b118f2
