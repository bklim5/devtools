---
phase: 34-js-ts-prettifier-tool
plan: 01
subsystem: format-engine
tags: [prettier, esbuild, javascript, typescript, jsx, tsx, fallback-chain, minify]

# Dependency graph
requires:
  - phase: 32-prettier-esbuild-engine-async-seam
    provides: "formatScript(input, lang, opts) Prettier wrapper + minifyScript(input, loader) esbuild wrapper + PrettierFormatOptions"
provides:
  - "formatJsTs(input, opts, run?) — typescript→babel prettify fallback with first-attempt error attribution (D-01/D-03)"
  - "minifyJsTs(input, run?) — tsx→ts minify fallback with first-attempt error attribution (D-02/D-03)"
  - "PrettierFormatOptions.semi? / .singleQuote? plumbed through optionsFrom() (D-10), defaulting to the old hardcoded values"
affects: [34-02-jsts-golden-parity, 34-04-jsts-formatter-tool]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fallback chain via an ADDITIVE injectable-runner seam: fn(input, …, run = realFn) — composes the real engine twice, default keeps callers arg-count-stable, and the injected recording runner is the ORDER-proof observation point (intra-module calls defeat a module-boundary vi.spyOn)"
    - "Routing proof independent of output bytes: record attempt/loader order, not just result — typescript/babel and tsx/ts emit byte-identical output for common inputs, so byte goldens are drift locks only, the order test is the load-bearing routing lock (T-34-07 mitigation)"

key-files:
  created: []
  modified:
    - "src/lib/format/prettier.ts — formatJsTs + semi/singleQuote plumb-through"
    - "src/lib/format/prettier.test.ts — formatJsTs describe + byte-stability describe"
    - "src/lib/format/minify.ts — minifyJsTs (pure addition; minifyScript/ensureEsbuild/minifyHtml untouched)"
    - "src/lib/format/minify.test.ts — minifyJsTs describe"

key-decisions:
  - "Fallback lives in the engine wrapper (formatJsTs/minifyJsTs), not the tool runner — Claude's-discretion per 34-CONTEXT, keeps the retry pure + unit-testable"
  - "First-attempt error attribution (D-03): on total-chain failure return the primary (typescript / tsx) error, not the fallback's"
  - "BABEL_ONLY fixture = throw expression `const req=(o,k)=>o[k]||throw new Error('x')` (author-verified ts-reject/babel-accept at pin 3.8.3)"
  - "ANGLE_BRACKET_CAST fixture = `type T = number;\\nconst v = 1;\\nconst y = <T>v;` (author-verified tsx-reject/ts-accept at the pinned esbuild-wasm)"

patterns-established:
  - "Additive injectable-runner fallback seam (default = real engine) as both the compose mechanism and the routing-ORDER test seam"

requirements-completed: [PRT-09, PRT-10]

# Metrics
duration: 4min
completed: 2026-07-03
---

# Phase 34 Plan 01: JS/TS Engine Fallback Chains + Prettier Toggle Plumb-through Summary

**formatJsTs (typescript→babel) + minifyJsTs (tsx→ts) fallback chains composing the existing P32 engine wrappers, plus semi/singleQuote plumbed through PrettierFormatOptions — all default-path byte-stable, routing-locked by injectable-runner ORDER tests.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-07-03T00:06:35Z
- **Completed:** 2026-07-03T00:09:49Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `formatJsTs` implements the no-language-picker prettify coverage (D-01/D-04): typescript parser first, babel fallback ONLY on parse error, first-attempt (typescript) error on total failure (D-03). Fallback SUCCESS is proven (not just error attribution).
- `minifyJsTs` implements the same shape for minify (D-02): tsx loader first, ts fallback on error (recovers angle-bracket type casts tsx mis-lexes as JSX), first-attempt (tsx) error on total failure.
- `semi`/`singleQuote` added as optional `PrettierFormatOptions` fields (D-10), read in `optionsFrom()` with `?? true` / `?? false` defaults so every existing caller (HTML tool, JSON/XML, goldens) stays byte-identical.
- Routing ORDER proofs (T-34-07 mitigation): injectable recording runners assert typescript-before-babel / tsx-before-ts — a mis-routed impl REDs here even though no byte comparison (unit or 34-02 parity goldens) can distinguish it.

## Task Commits

Each task was committed atomically (test + impl together — lefthook rejects failing RED-only commits):

1. **Task 1: formatJsTs fallback + semi/singleQuote plumb-through** - `71216c48` (feat)
2. **Task 2: minifyJsTs tsx→ts fallback** - `d9db1837` (feat)

_TDD tasks: tests landed GREEN with their implementation in one commit each (project's "TDD RED blocked by lefthook" constraint)._

## Files Created/Modified
- `src/lib/format/prettier.ts` - Widened `PrettierFormatOptions` (`semi?`/`singleQuote?`); `optionsFrom` defaults to old hardcoded values; added `formatJsTs` composing `formatScript` via an additive injectable `run` param.
- `src/lib/format/prettier.test.ts` - `describe("formatJsTs …")` (fallback success, semi/singleQuote, first-attempt attribution, empty short-circuit, two ORDER proofs) + a byte-stability describe for existing `formatScript` defaults.
- `src/lib/format/minify.ts` - Added `minifyJsTs` composing `minifyScript` via an additive injectable `run` param (pure addition; `minifyScript`/`ensureEsbuild`/`minifyHtml` bodies unchanged).
- `src/lib/format/minify.test.ts` - `describe("minifyJsTs …")` (angle-bracket-cast fallback success, first-attempt attribution, empty short-circuit, two ORDER proofs).

## Decisions Made
- Fallback lives in the engine wrapper (not the tool runner) per 34-CONTEXT Claude's-discretion — keeps the retry pure and unit-testable; the DEFAULT path stays byte-identical for existing callers.
- Author-time verified both divergence fixtures at the pinned engines before locking: throw-expression (ts-reject/babel-accept) for `BABEL_ONLY`, and `<T>v` cast (tsx-reject/ts-accept) for `ANGLE_BRACKET_CAST`. Both tests also assert the divergence in-test (sanity) so a future pin drift that removes the divergence RED-flags rather than silently passing a vacuous fallback.

## Deviations from Plan

None - plan executed exactly as written. No Rule 1–4 deviations.

## Issues Encountered
None. The two divergence fixtures both diverged at the current pins on first check (verified via throwaway node scripts against the real prettier + esbuild-wasm packages, deleted after use — not committed).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `formatJsTs`/`minifyJsTs` exported and unit-locked, ready for the 34-02 four-dialect parity goldens and the 34-04 JS/TS formatter tool (both call the two-arg / one-arg default signatures — the injectable `run` param is additive, test-only).
- Binding harness (`/simplify` → `/code-review xhigh` → `/codex:adversarial-review` → real-WKWebView UI verification) is NOT auto-run by this executor — it runs at the Phase-34 boundary (Plan 34-05). This plan is a pure engine change with no mounted UI surface of its own (exercised through the 34-04 tool + 34-05 e2e).

## Self-Check: PASSED

- All 4 modified files present on disk.
- Both task commits present in git history (`71216c48`, `d9db1837`).
- `formatJsTs` (prettier.ts) + `minifyJsTs` (minify.ts) exported and grep-verified.
- Full plan verification green: prettier.test.ts + minify.test.ts 58/58; `tsc --noEmit` exit 0; parity + goldens byte-untouched (`git diff --quiet` clean); protobuf hero + 19 tests untouched (`git diff --quiet src/lib/protobuf/` clean).

---
*Phase: 34-js-ts-prettifier-tool*
*Completed: 2026-07-03*
