---
phase: 34-js-ts-prettifier-tool
plan: 02
subsystem: testing
tags: [prettier, golden-parity, jsx, tsx, formatJsTs, fixtures]

# Dependency graph
requires:
  - phase: 34-01
    provides: formatJsTs (typescript-first, babel-on-parse-error) + PrettierFormatOptions semi/singleQuote
provides:
  - Four-dialect named-parser golden lock (js/ts/jsx/tsx) RED-on-drift
  - formatJsTs OUTPUT drift-lock for all four dialects via the .jsts.golden set (the tool's real no-picker path)
  - Babel-fallback output pinned via fallback.js (valid JS the TS parser rejects); fallback-fires proof (TS-primary asserted !ok first)
  - Generator gains an optional per-entry `out` field for renamed goldens
affects: [34-04, 34-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Routing DRIFT lock: byte-equal the tool's REAL path (formatJsTs) output to a typescript-parser CLI golden, separate from the named-parser engine locks"
    - "Fallback-fires proof: assert the TS primary is !ok BEFORE asserting formatJsTs ok, so ok:true is reachable only via the babel fallback"

key-files:
  created:
    - test/fixtures/prettier/messy.jsx
    - test/fixtures/prettier/messy.jsx.golden
    - test/fixtures/prettier/messy.tsx
    - test/fixtures/prettier/messy.tsx.golden
    - test/fixtures/prettier/messy.js.jsts.golden
    - test/fixtures/prettier/messy.ts.jsts.golden
    - test/fixtures/prettier/messy.jsx.jsts.golden
    - test/fixtures/prettier/messy.tsx.jsts.golden
    - test/fixtures/prettier/fallback.js
    - test/fixtures/prettier/fallback.js.golden
  modified:
    - scripts/gen-prettier-golden.mjs
    - src/lib/format/prettier.parity.test.ts

key-decisions:
  - "The four .jsts.golden routing goldens use --parser typescript (formatJsTs's primary); fallback.js uses --parser babel"
  - "fallback.js = throw-expression (const req=(o,k)=>o[k]||throw new Error(...)); author-verified TS-parser-reject / babel-accept at pin 3.8.3"
  - "Byte goldens are DRIFT locks only — they cannot catch a babel-first mis-route (ts & babel emit byte-identical output for these inputs); the ORDER contract is proven by 34-01's injectable-runner test"

patterns-established:
  - "Optional per-entry `out` in the golden generator lets one input emit a second, differently-named golden"

requirements-completed: [PRT-09]

# Metrics
duration: 8min
completed: 2026-07-03
---

# Phase 34 Plan 02: Four-Dialect JS/TS Golden Locks Summary

**Golden-locks all four JS/TS dialects (js/ts/jsx/tsx) at the named parser AND byte-DRIFT-locks the tool's real no-picker path (formatJsTs) output for every dialect, plus pins the babel-fallback output via a TS-parser-reject fixture (fallback proven to fire).**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-03T01:21:00Z
- **Completed:** 2026-07-03T01:24:00Z
- **Tasks:** 2
- **Files modified:** 12 (10 created, 2 modified)

## Accomplishments
- messy.jsx (babel) + messy.tsx (typescript) dialect fixtures + goldens — D-09 first-class JSX/TSX
- Four `.jsts.golden` routing goldens (typescript parser) byte-DRIFT-lock formatJsTs's actual output for all four dialects
- fallback.js (valid JS the TS parser rejects, babel accepts) + its babel golden — pins the fallback output and proves the chain fires
- Generator extended with an optional per-entry `out` field; OPTIONS block unchanged; fresh-vs-committed integrity check green

## Task Commits

1. **Task 1: jsx/tsx + fallback fixtures + routing/fallback goldens + generator `out` field** — `e1457926` (test)
2. **Task 2: parity cases for jsx/tsx + formatJsTs routing/fallback** — `0870c0f2` (test)

_Note: Task 2 is TDD but lands GREEN in a single commit — lefthook rejects failing commits (repo convention: no standalone RED-only commits)._

## Files Created/Modified
- `test/fixtures/prettier/messy.jsx` + `.golden` — messy JSX fixture (babel canonical output)
- `test/fixtures/prettier/messy.tsx` + `.golden` — messy TSX fixture (typescript canonical output; disambiguating `<T,>` generic)
- `test/fixtures/prettier/messy.{js,ts,jsx,tsx}.jsts.golden` — routing goldens (typescript parser = formatJsTs primary)
- `test/fixtures/prettier/fallback.js` + `.golden` — TS-reject/babel-accept fixture + locked babel output
- `scripts/gen-prettier-golden.mjs` — optional per-entry `out` field + six new FIXTURES entries (OPTIONS unchanged)
- `src/lib/format/prettier.parity.test.ts` — 2 named-parser cases + a `formatJsTs` routing/fallback describe block; inputs glob widened to `*.{js,ts,jsx,tsx,html}`

## Decisions Made
- **fallback.js = throw-expression.** `const req=(o,k)=>o[k]||throw new Error('missing '+k)` — author-verified at pin 3.8.3: `--parser typescript` errors `SyntaxError: Expression expected. (1:24)`; `--parser babel` succeeds. So `fallback.js.golden` is genuinely the babel-only output.
- **Observed byte-identity:** `messy.js.jsts.golden` (typescript, 185B) byte-equals `messy.js.golden` (babel, 185B), and `messy.jsx.jsts.golden` byte-equals `messy.jsx.golden` — confirming the plan's premise that ts/babel emit byte-identical output for common JS, so these byte goldens are DRIFT locks only, not routing-ORDER proofs.

## Deviations from Plan

None - plan executed exactly as written (no Rule 1-4 deviations).

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None.

## Next Phase Readiness
- Four-dialect golden lock in place; 34-04 (JsFormatterTool) + 34-05 (e2e) can proceed.
- Binding harness (/simplify → /code-review xhigh → /codex:adversarial-review → real-WKWebView) is NOT auto-run here — this plan is pure test infrastructure with no UI surface; it runs at the Phase-34 boundary in Plan 34-05.

## Self-Check: PASSED

All 12 claimed files exist on disk; both task commits (`e1457926`, `0870c0f2`) present in history.

---
*Phase: 34-js-ts-prettifier-tool*
*Completed: 2026-07-03*
