---
phase: 02-shell
plan: 02
subsystem: shell
tags: [fuzzy-ranker, command-palette, subsequence, zero-dependency, tdd, D-06]

# Dependency graph
requires:
  - phase: 02-shell
    plan: 01
    provides: "ENABLED_TOOLS populated + ToolDefinition contract (name/keywords/description) the ranker scores against"
provides:
  - "rankTools(query, tools): in-house zero-dependency subsequence fuzzy ranker over a tool's name+keywords+description (D-06, SHL-02)"
  - "subsequenceScore(needle, haystack): exported scoring primitive (null = no match) for unit coverage and palette reuse"
  - "Ordering contract: empty query passes through (D-05); no-match → [] (D-07); name > keywords > description; contiguous > scattered; case-insensitive; stable tie-break by registry order"
affects: [02-04 Sidebar + ⌘K CommandPalette (consumes rankTools as the palette filter, replacing searchTools)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zero-runtime-dependency fuzzy matching: a ~110-line subsequence ranker (comments-heavy) instead of cmdk/fuse.js (D-06, offline ethos)"
    - "Pure module: imports ONLY the ToolDefinition *type* — no React, no platform/store, no @tauri-apps (grep-verified)"
    - "Untrusted query scanned char-by-char as a subsequence — never compiled to a RegExp from user input (threat T-02-05)"
    - "Inline-fixture tests independent of the live registry, so the ranker ships and tests standalone"

key-files:
  created:
    - "src/shell/fuzzy.ts — rankTools + subsequenceScore (in-house ranker, D-06)"
    - "src/shell/fuzzy.test.ts — 11 tests asserting the ordering contract with inline fixtures"
  modified: []

key-decisions:
  - "Field weights name:1000 / keywords:100 / description:10 — wide enough gaps that no description-match bonus can overtake a name match (D-06 magnitudes are Claude's discretion; only the ORDERING is the contract)"
  - "subsequenceScore exported (not just rankTools) so the contiguity/word-boundary scoring is unit-covered directly, not only inferred through rankTools"
  - "searchTools() in registry.ts left untouched here — the plan upgrades the PALETTE to rankTools in 02-04; registry.ts is a port-unchanged/no-edit file in this plan's acceptance criteria"

patterns-established:
  - "Per-field haystack scored separately, best field score + field weight wins; tools.forEach captures input index for the stable tie-break"

requirements-completed: []  # SHL-02 spans the palette UI (02-04); the ranker is a building block, not the full requirement

# Metrics
duration: 1min
completed: 2026-05-30
---

# Phase 2 Plan 02: Fuzzy Ranker Summary

**An in-house, zero-dependency subsequence fuzzy ranker (`rankTools`) that scores a query against each tool's name+keywords+description with name>keywords>description weighting and contiguous-run/word-boundary bonuses — the matching engine the ⌘K palette will use, built without cmdk/fuse.js per D-06.**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-05-30T19:45:34Z
- **Completed:** 2026-05-30T19:47:00Z (approx)
- **Tasks:** 1 (single TDD feature)
- **Files created:** 2

## Accomplishments
- `rankTools(query, tools)` returns the matching subset best-first: empty/whitespace query passes through unchanged (caller layers recents — D-05); a query with no subsequence match in any field returns `[]` (powers the palette's quiet "No tools match" — D-07).
- `subsequenceScore(needle, haystack)` is a small primitive returning a number or `null` (null = not a subsequence). It rewards contiguous runs (run-length-scaled), matches starting at a word boundary/field start, and earlier overall position.
- Field weighting `name (1000) > keywords (100) > description (10)` guarantees a NAME match outranks the same query matching only a DESCRIPTION.
- Pure and self-contained: imports ONLY the `ToolDefinition` type — no React, no platform/store, no `@tauri-apps`. The user query is scanned char-by-char, never compiled into a RegExp (threat T-02-05, accept-disposition upheld by construction).
- 11 tests (≥6 required) cover: empty + whitespace passthrough, subsequence match + non-match exclusion, name>description ranking, contiguous>scattered ranking, no-match→`[]`, case-insensitivity, stable tie-break, plus direct `subsequenceScore` coverage.

## Task Commits

Single atomic task (test + impl together — the lefthook pre-commit gate blocks committing a red suite, so TDD RED was verified locally then landed with GREEN, matching the established 02-01 pattern):

1. **Task 1: rankTools fuzzy ranker (TDD)** — `46f96f9` (feat)

**Plan metadata:** _(final commit)_ (docs: complete plan)

## Files Created/Modified
- `src/shell/fuzzy.ts` (created) — `rankTools` + `subsequenceScore`; the in-house ranker (D-06). ~110 lines including the contract-documenting comments; the executable logic is ~50 lines.
- `src/shell/fuzzy.test.ts` (created) — 11 tests with inline fixture `ToolDefinition`s (no live-registry dependency), asserting the ordering contract.

## Decisions Made
- **Field weights 1000/100/10** — the ORDERING (name>keywords>description) is the asserted contract; the exact magnitudes are D-06 discretion. Gaps were chosen wide enough that within-field bonuses can never flip the field ordering.
- **Exported `subsequenceScore`** — the plan permits optionally exporting the internal scorer for unit coverage; doing so lets the contiguous>scattered and no-match guarantees be tested at the primitive level directly.
- **`searchTools()` left as-is** — D-06 says the palette's matcher upgrades to this ranker, but that wiring is Plan 02-04's job (the palette UI). `registry.ts` is on this plan's no-edit list, so the substring `searchTools` stays put; 02-04 imports `rankTools` instead.

## Deviations from Plan

None — plan executed exactly as written. No bugs, missing functionality, or blocking issues surfaced (Rules 1-3 did not fire); no architectural decisions needed (Rule 4 did not fire).

## Verification
- `pnpm exec vitest run src/shell/fuzzy.test.ts` → 11 passed (exits 0).
- Full suite: `pnpm exec vitest run` → **42/42 passed** (was 31; +11 new). The decoder's **19 immovable tests remain green**.
- `pnpm exec tsc --noEmit` → clean (exit 0).
- `pnpm exec eslint src/shell/fuzzy.ts src/shell/fuzzy.test.ts` → 0 errors.
- Import constraint: `grep -E "^import" src/shell/fuzzy.ts` shows only `import type { ToolDefinition }` — no React, no @tauri-apps, no platform import.
- No runtime dependency added (no cmdk/fuse.js — D-06 honored).

## Harness Note
- Per-task DoD gates mapping to interactive slash-commands (`/simplify`, `/codex:review`) are not invocable from a non-interactive subagent. The code was kept simplify-clean by hand (single-responsibility functions, no dead code, narrow exports). The automated gates — `vitest` (42/42, decoder 19 green), `tsc --noEmit` clean, `eslint` 0 errors, and the lefthook pre-commit gate (typecheck + test) on the commit — all passed. No UI in this plan; the ranker is exercised via the real-webview palette in Plan 02-04's UI checkpoint (per the plan's verification note).

## Known Stubs
None — `rankTools` is fully implemented and wired by tests; it has no placeholder data paths.

## User Setup Required
None.

## Next Phase Readiness
- `rankTools` is ready for Plan 02-04's `CommandPalette` to consume as its filter (empty query → recents+all layered by the caller per D-05; non-empty → ranked subset; no match → `[]` quiet state per D-07).
- SHL-02 is NOT yet complete — this plan delivers only the matching engine; the ⌘K open/Enter-navigate palette UI (02-04) completes the requirement.

## Self-Check: PASSED

- `src/shell/fuzzy.ts` — FOUND
- `src/shell/fuzzy.test.ts` — FOUND
- Commit `46f96f9` — FOUND in git history

---
*Phase: 02-shell*
*Completed: 2026-05-30*
