---
phase: 09-pure-release-core-housekeeping
plan: 02
subsystem: infra
tags: [release, latest-json, tauri-updater, manifest, dual-arch, pure-logic, vitest]

# Dependency graph
requires:
  - phase: 09-pure-release-core-housekeeping
    provides: the src/lib/release/ co-located pure-logic + vitest convention (plan 01) this mirrors
  - phase: 07-formatters
    provides: the src/lib/format/ pure-logic style (module-doc header, no I/O, no platform imports) ultimately mirrored
provides:
  - "src/lib/release/manifest.ts — buildLatestJson({version,pubDate,url,signature,notes?}) + dual-key platformKey, PURE (no clock/fs), zero deps"
  - "manifest.test.ts — 8 cases proving dual-key same-url+signature output, no combined single-key variant, default-empty notes, injected snake_case pub_date"
affects: [11-build-and-publish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single options-object input (D-04) so adjacent url/signature strings can't be swapped positionally at the call site"
    - "Dual-arch platforms map derived from ONE {url,signature} so darwin-aarch64 and darwin-x86_64 can never diverge (D-05)"
    - "PURE manifest assembly — all time/I-O injected by the caller (D-03); pub_date sourced only from the passed arg"

key-files:
  created:
    - src/lib/release/manifest.ts
    - src/lib/release/manifest.test.ts
  modified: []

key-decisions:
  - "Both arch entries built from one {url,signature} via platformKey — the two keys are deep-equal by construction, so a swapped/divergent signature is structurally impossible (T-09-06)"
  - "No combined single-key variant emitted — output is exactly the two per-arch keys the updater queries; a stray key it ignores would risk a silent no-update (T-09-07)"
  - "notes defaults to \"\" via `input.notes ?? \"\"` (D-04a); pub_date is snake_case sourced only from input.pubDate (D-03 purity)"
  - "Reworded the module doc to avoid the literal strings `Date.now` / `darwin-universal` so the plan's negative-grep acceptance checks pass (doc prose vs forbidden-literal grep)"

patterns-established:
  - "src/lib/release/ manifest assembly: pure object builder, options-object input, dual-arch from one source, unit-asserted with zero mocks"

requirements-completed: [REL-06]

# Metrics
duration: ~62min
completed: 2026-06-02
---

# Phase 09 Plan 02: Pure latest.json manifest assembly Summary

**A PURE `buildLatestJson({version,pubDate,url,signature,notes?})` plus a dual-key `platformKey` in a new `src/lib/release/manifest.ts` (zero deps): both `darwin-aarch64` and `darwin-x86_64` are built from ONE `{url,signature}` so they can never diverge, no combined single-key variant is emitted, `notes` defaults to `""`, and `pub_date` is sourced only from the injected arg — covered by 8 vitest cases.**

## Performance

- **Duration:** ~62 min (start 18:02Z; the two TDD tasks themselves took ~2 min of execution, the rest was context load + verification gates)
- **Tasks:** 2
- **Files modified:** 2 (2 created, 0 modified)

## Accomplishments
- `buildLatestJson(input)` assembles the full `latest.json` shape (`version` / `notes` / `pub_date` / `platforms`) matching the on-disk file exactly, with `pub_date` as the snake_case key.
- `platformKey({url,signature})` (D-05) emits BOTH `darwin-aarch64` and `darwin-x86_64` carrying the IDENTICAL `{signature,url}` — one universal `.app.tar.gz` artifact serves both arches; the two keys are deep-equal by construction so they cannot diverge or carry a swapped signature (T-09-06). No combined single-key variant (T-09-07).
- PURE (D-03): no clock read, no `fs`, no time/IO imports; `pub_date` flows only from `input.pubDate`, so calling twice with identical input yields deep-equal objects.
- Single options-object input (D-04) so the two adjacent `url`/`signature` strings can't be swapped positionally at the call site; `notes` optional, defaults to `""` (D-04a).
- 8 vitest cases (full-shape deep-equal, `Object.keys === [darwin-aarch64, darwin-x86_64]`, `not.toHaveProperty(darwin-universal)`, arch entries deep-equal, injected `pub_date` with no `pubDate` key, default-empty + passthrough notes, purity, plus a direct `platformKey` case). Full suite 411/411 green; tsc + eslint clean; zero new deps; decoder + its 19 tests byte-for-byte untouched.

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement buildLatestJson + platformKey** - `d45ddaf6` (feat)
2. **Task 2: manifest.test.ts (dual-key, same url+signature, default notes)** - `5e07c50d` (test)

_TDD note: the plan structures Task 1 as the implementation and Task 2 as the failing/then-green coverage; both committed separately. Each commit passed the repo's lefthook pre-commit gate (typecheck + full vitest suite)._

## Files Created/Modified
- `src/lib/release/manifest.ts` - `buildLatestJson` + dual-key `platformKey` + `LatestJson`/`PlatformEntry`/`BuildLatestJsonInput` types (pure, zero deps).
- `src/lib/release/manifest.test.ts` - 8 vitest cases proving the dual-key same-url/same-signature output, absence of a combined single-key variant, default-empty notes, and injected snake_case `pub_date`.

## Decisions Made
- **Both arch entries from one `{url,signature}`.** `platformKey` takes a single `PlatformEntry` and clones it into both keys, making the two entries deep-equal by construction — a divergent/swapped signature is structurally impossible (the test asserts the deep-equality as a regression guard).
- **No combined single-key variant.** Output is exactly the two per-arch keys the Tauri updater queries; the test asserts `not.toHaveProperty("darwin-universal")` so a stray key the updater would silently ignore can't slip in (T-09-07).
- **Doc prose vs forbidden-literal grep.** The plan's acceptance criteria negative-grep for the literals `Date.now` and `darwin-universal`. The initial module-doc comment used both phrases descriptively; reworded the comment ("the clock is read upstream", "no combined single-key variant") so the negative greps pass while the documentation intent is preserved.

## Deviations from Plan

None - plan executed exactly as written. (The doc-comment rewording above is an in-spec adjustment to satisfy the plan's own acceptance greps, not a behavior change.)

## Authentication Gates
None - no external service or credentials required (pure logic, no I/O).

## Known Stubs
None - `buildLatestJson` is fully implemented. The wiring to real I/O (fresh `.sig` glob, `pub_date = now`, computed URL, file write) is intentionally deferred to Phase 11's `build-and-publish.mjs` per the plan objective (REL-06); this plan delivers only the pure, unit-tested core it will import.

## Next Phase Readiness
- `manifest.ts` exports the exact contract Phase 11's `build-and-publish.mjs` imports (`buildLatestJson`, plus `platformKey` and the `LatestJson`/`BuildLatestJsonInput` types).
- The dual-arch behavior is unit-asserted here, but its LIVE proof (the universal-binary updater round-trip) remains Phase 11's load-bearing human gate per STATE.md — not provable in a pure unit test.

## Self-Check: PASSED

- `src/lib/release/manifest.ts` — FOUND
- `src/lib/release/manifest.test.ts` — FOUND
- Commit `d45ddaf6` (feat) — FOUND in git history
- Commit `5e07c50d` (test) — FOUND in git history
- `npx vitest run src/lib/release/manifest.test.ts` — 8/8 green; full suite 411/411; tsc + eslint clean; decoder 19 tests untouched.

---
*Phase: 09-pure-release-core-housekeeping*
*Completed: 2026-06-02*
