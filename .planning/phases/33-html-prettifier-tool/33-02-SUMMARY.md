---
phase: 33-html-prettifier-tool
plan: 02
subsystem: testing
tags: [prettier, esbuild, golden-fixture, html, byte-equality, formatter]

# Dependency graph
requires:
  - phase: 32-prettier-esbuild-engine
    provides: "formatHtml (prettier.ts) + minifyHtml/__setEsbuildInitForTest (minify.ts) engine wrappers"
provides:
  - "SC1 CLI-generated script+style HTML prettify golden (RED on prettier version/option/wrapper drift)"
  - "SC2 frozen minifyHtml golden (RED on esbuild version drift or HTML-collapse logic change)"
  - "html-tool.html + html-tool.html.golden fixtures + gen-prettier-golden.mjs extended"
  - "test/fixtures/html/minify-input.html frozen-minify fixture"
affects: [33-html-prettifier-tool, 34-js-ts-prettifier-tool]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Committed CLI-golden byte-equality lock (read off disk, never regenerated in-suite)"
    - "Frozen inline EXPECTED constant for esbuild output (bootstrapped from actual output, then committed)"

key-files:
  created:
    - test/fixtures/prettier/html-tool.html
    - test/fixtures/prettier/html-tool.html.golden
    - test/fixtures/html/minify-input.html
    - src/lib/format/html-golden.test.ts
  modified:
    - scripts/gen-prettier-golden.mjs

key-decisions:
  - "SC2 EXPECTED frozen inline in the test (not a regenerate-then-compare) — captures esbuild's actual output incl. param-name minification (add(t,n)) + trailing \\n after CSS/JS"
  - "SC1 golden authored by the pinned Prettier CLI via the existing gen-prettier-golden.mjs FIXTURES append — same OPTIONS block, no divergence from the wrapper defaults"

patterns-established:
  - "Phase owns its own SC1/SC2 acceptance locks (html-tool.html) rather than leaning on P32's embedded.html"

requirements-completed: [PRT-07]

# Metrics
duration: 5min
completed: 2026-07-01
---

# Phase 33 Plan 02: HTML Engine Golden Locks Summary

**SC1 CLI-generated script+style HTML prettify golden + SC2 frozen minifyHtml golden — both byte-equality-locked, RED on prettier/esbuild drift, engine files byte-untouched.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-07-01T18:38:39Z
- **Completed:** 2026-07-01T18:42:00Z
- **Tasks:** 2
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments

- **SC1 prettify parity** — `test/fixtures/prettier/html-tool.html` (a tool-representative messy doc with compressed embedded `<style>` + `<script>`), its CLI-authored `.golden` (via the extended `gen-prettier-golden.mjs`), and a `html-golden.test.ts` suite asserting `formatHtml(input, {indent:"2",minify:false}).output` byte-equals the committed golden PLUS that both embedded bodies were reformatted (JS `const items = [1, 2, 3];`, CSS `margin: 0;`; messy forms absent).
- **SC2 minify golden** — `test/fixtures/html/minify-input.html` (inter-tag whitespace, a non-conditional comment, a `<pre>` block, an embedded `<style>` + `<script>`) frozen against an inline `EXPECTED` constant; behavior locks assert `<pre>` preserved verbatim, comment stripped, script + style minified. esbuild bootstrapped via `__setEsbuildInitForTest` in `beforeAll` (node env, mirroring `minify.test.ts`).
- Engine files (`prettier.ts`/`minify.ts`/`types.ts`) and `decoder.ts` + its 19 tests byte-for-byte untouched.

## Task Commits

1. **Task 1: SC1 script+style HTML prettify golden** - `abf3a85a` (test)
2. **Task 2: SC2 frozen minifyHtml golden** - `52922221` (test)

## Files Created/Modified

- `test/fixtures/prettier/html-tool.html` - messy pasted-HTML doc with compressed embedded `<style>` + `<script>`
- `test/fixtures/prettier/html-tool.html.golden` - CLI (`prettier --write`) source-of-truth golden
- `scripts/gen-prettier-golden.mjs` - FIXTURES appended with `{ file: "html-tool.html", parser: "html" }`
- `src/lib/format/html-golden.test.ts` - SC1 (formatHtml vs golden) + SC2 (minifyHtml vs frozen EXPECTED)
- `test/fixtures/html/minify-input.html` - frozen-minify input fixture

## Decisions Made

- **SC2 EXPECTED captured from actual esbuild output.** Bootstrapped by writing the real `minifyHtml` output to disk (vitest suppresses `console.log`), then freezing it inline. It reflects esbuild's actual behavior — param-name minification (`function add(t,n)`) and a trailing `\n` after minified CSS/JS bodies — so the golden RED-s on any esbuild drift.
- **SC1 golden generated through the existing generator, not hand-authored** — guarantees it equals a fresh pinned-CLI run (`git diff --exit-code -- test/fixtures/prettier/` clean).

## Deviations from Plan

None - plan executed exactly as written. No Rule 1-4 deviations.

The one Task-1 self-correction (removing an unused `minifyHtml`/`beforeAll` import so Task 1's commit stays eslint-green, then adding them in Task 2) was normal split-commit hygiene, not a plan deviation.

## Issues Encountered

- **Capturing the exact SC2 byte string.** vitest suppresses `console.log` and its assertion-diff wraps long lines, so the exact whitespace/newlines weren't recoverable from the failure output. Resolved by a throwaway test writing `JSON.stringify(output)` to `/tmp`, then pasting the exact string into `EXPECTED` (throwaway test deleted, not committed).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SC1 + SC2 acceptance locks now owned directly by Phase 33, independent of the tool wiring (ran in parallel with Plan 01). The HtmlFormatterTool (33-03) can mount against proven engine contracts.
- No blockers.

## Self-Check: PASSED

All 5 created files present on disk; both task commits (`abf3a85a`, `52922221`) present in history.

---
*Phase: 33-html-prettifier-tool*
*Completed: 2026-07-01*
