---
phase: 34-js-ts-prettifier-tool
plan: 05
subsystem: testing
tags: [e2e, wdio, wkwebview, prettier, esbuild, javascript, typescript, jsx, tsx, minify]

# Dependency graph
requires:
  - phase: 34-04
    provides: mounted JsFormatterTool (registry-only, free) + its jsdom suite
  - phase: 34-01
    provides: formatJsTs (typescript→babel) + minifyJsTs (tsx→ts) engine chains
  - phase: 33
    provides: the proven useAsyncFormat + StatusBar + real-WKWebView e2e pattern (html-formatter.e2e.ts)
provides:
  - real-WKWebView e2e gate for the JS/TS tool across ALL FOUR dialects (JS/TS/JSX/TSX)
  - two Codex-driven minify-semantics fixes (jsx:preserve + verbatimModuleSyntax side-effecting imports)
  - human boundary sign-off (offline paste proof + Option A JSX-factory ratification) closing Phase 34
affects: [future formatter tools, any esbuild-minify consumer, v1.9 close-out]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "real-WKWebView e2e clones html-formatter.e2e.ts: single-round-trip readState, fresh-handle error read, browser.waitUntil on async debounce + lazy chunk"
    - "esbuild minify passes jsx:'preserve' + tsconfigRaw verbatimModuleSyntax:true so a MINIFY never changes runtime semantics (no JSX lowering, side-effecting imports survive)"

key-files:
  created:
    - test/e2e/js-formatter.e2e.ts
    - .planning/phases/34-js-ts-prettifier-tool/34-05-OFFLINE-PROOF.md
  modified:
    - src/lib/format/minify.ts
    - src/lib/format/minify.test.ts

key-decisions:
  - "Option A (human): unused JSX factory bindings dropped under preserve-mode minify is accepted (correct for the modern automatic runtime) — no code change, no rebuild"
  - "Minify must never change runtime semantics: jsx:preserve (no React.createElement lowering) + verbatimModuleSyntax (side-effecting imports survive) — both no-ops for js/css/HTML-embedded loaders so the 33-02 SC2 golden stays byte-identical"

patterns-established:
  - "Four-dialect e2e assertion: a JSX/TSX-only JavaScriptCore parser/lazy-chunk failure REDs the automated gate, not just the human walkthrough"

requirements-completed: [PRT-09, PRT-10, PRT-12]

# Metrics
duration: ~3 days wall (2026-07-03 → 2026-07-06, spanning the human checkpoint)
completed: 2026-07-06
---

# Phase 34 Plan 05: JS/TS Boundary e2e + Human Sign-off Summary

**Real-WKWebView e2e proving lazy Prettier + esbuild load/format on JavaScriptCore for all four dialects (JS/TS/JSX/TSX), two Codex-driven minify-semantics fixes (jsx:preserve + side-effecting-import survival), and the human boundary sign-off (offline + Option A ratified) closing Phase 34.**

## Performance

- **Duration:** ~3 days wall (spans the blocking human-verify checkpoint)
- **Started:** 2026-07-03
- **Completed:** 2026-07-06 (human sign-off received)
- **Tasks:** 3 (2 auto + 1 checkpoint)
- **Files modified:** 3 source/test (js-formatter.e2e.ts, minify.ts, minify.test.ts) + 2 planning docs

## Accomplishments
- `test/e2e/js-formatter.e2e.ts` — real-WKWebView gate: all four dialects prettify via the lazy Prettier chunk on JavaScriptCore (JS `const a = 1;`, TS `interface P {`, JSX `className="x"`/`{1 + 1}`, TSX `<K,>`/`<span>{String(p.v)}</span>`), esbuild minify (incl. JSX-preserve + side-effecting-import guards), Semi/Single-quotes toggles drive the engine, malformed paste → calm `role=alert` line:col + recovery, no-remote resource check. GREEN on webkit.
- Two Codex adversarial-review findings fixed on the minify path (both diff-introduced by 34-01's `minifyJsTs`, both wrong-output on common input — Rule 1):
  - **jsx:preserve** — MINIFY no longer lowers `<div/>` to `React.createElement(...)` (a runtime change requiring React in scope; breaks automatic-runtime/custom-factory projects).
  - **verbatimModuleSyntax** — MINIFY no longer drops an unused *value* import (TypeScript import elision); a static import still evaluates its module for side effects (bare `import"mod"`), while `import type` still elides.
- Human boundary sign-off closing Phase 34: approved ("looks ok") on the freshly built both-channel app; **Option A** ratified for the JSX factory-import minify semantics (no code change).

## Task Commits

1. **Task 1: js-formatter real-WKWebView e2e (all four dialects)** - `abfd8da6` (test)
2. **Task 2: whole-phase harness gates + both-channel build + Codex fixes** - `4924ca86` (fix: jsx:preserve), `d7141217` (fix: verbatimModuleSyntax side-effecting imports)
3. **Task 3: human boundary sign-off** - no code commit (checkpoint) → `34-05-OFFLINE-PROOF.md`

**Plan metadata:** this docs commit.

## Files Created/Modified
- `test/e2e/js-formatter.e2e.ts` - real-WKWebView e2e gate for the JS/TS tool (four dialects, toggles, minify-semantics guards, error/recovery, no-remote, screenshot)
- `src/lib/format/minify.ts` - esbuild.transform now passes `jsx:"preserve"` + `tsconfigRaw` `verbatimModuleSyntax:true` (no-op for js/css/HTML-embedded loaders)
- `src/lib/format/minify.test.ts` - coverage for JSX-preserved (no React.createElement) + `{1+1}`→`{2}` fold + side-effecting import survives + `import type` elides
- `.planning/phases/34-js-ts-prettifier-tool/34-05-OFFLINE-PROOF.md` - human sign-off + offline evidence + Option A ratification
- `.planning/phases/34-js-ts-prettifier-tool/34-05-SUMMARY.md` - this file

## Decisions Made
- **Option A (human, 2026-07-06):** unused JSX factory bindings dropped under preserve-mode minify is accepted — correct for the modern automatic runtime (no explicit factory import needed). NO code change, NO rebuild.
- **Minify never changes runtime semantics:** the two Codex fixes are the load-bearing decision — a MINIFY action must preserve dialect (no JSX lowering) and preserve module side effects. Both changes are no-ops for the js/css/HTML-embedded loaders, so the Phase 33-02 HTML SC2 golden stays byte-identical and every existing caller is safe.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Minify lowered JSX to React.createElement**
- **Found during:** Task 2 (Codex adversarial-review over the phase diff)
- **Issue:** `minifyJsTs` ran esbuild's tsx loader with default JSX handling, so a MINIFY silently transpiled `<div className='x'>{1+1}</div>` → `React.createElement("div",{className:"x"},2)` — a runtime change, not minification.
- **Fix:** `minify.ts` passes `jsx:"preserve"` to `esbuild.transform`; JSX/TSX minify tests now assert JSX is preserved + `{1+1}`→`{2}` still folds; e2e adds a JSX-minify guard.
- **Files modified:** src/lib/format/minify.ts, src/lib/format/minify.test.ts, test/e2e/js-formatter.e2e.ts
- **Verification:** full suite 1427/1427, tsc clean, e2e green on webkit
- **Committed in:** `4924ca86`

**2. [Rule 1 - Bug] Minify dropped side-effecting value imports**
- **Found during:** Task 2 (Codex adversarial-review over the phase diff)
- **Issue:** under the tsx/ts loader esbuild applied TypeScript import elision, so `import x from "mod"; console.log(1);` minified to `console.log(1);` — a static import must still evaluate the module for its side effects.
- **Fix:** `minify.ts` passes `tsconfigRaw` `verbatimModuleSyntax:true` — keeps the import as a bare `import"mod"` while still eliding an explicit `import type`. No-op for js/jsx/css loaders (incl. HTML embedded blocks) so the 33-02 HTML SC2 golden is byte-identical.
- **Files modified:** src/lib/format/minify.ts, src/lib/format/minify.test.ts, test/e2e/js-formatter.e2e.ts
- **Verification:** full suite 1429/1429, tsc clean, e2e green on webkit; `git diff --quiet HEAD -- src/lib/protobuf/` (decoder + 19 tests untouched)
- **Committed in:** `d7141217`

---

**Total deviations:** 2 auto-fixed (both Rule 1 — wrong output on common input, surfaced by the boundary Codex gate). The four-dialect e2e initially only minified local declarations/JSX, so both module-semantics regressions slipped its first pass; the Codex review + added coverage closed the gap.
**Impact on plan:** Both fixes essential for minify correctness (runtime semantics preserved). No scope creep — confined to `minify.ts` + its tests + the e2e guard; every existing caller and the HTML SC2 golden unchanged.

## Issues Encountered
- The blocking human-verify checkpoint (Task 3) spanned days 07-03 → 07-06; a continuation agent recorded the sign-off after the human responded. The prior executor's Task-2 both-channel build was the artifact under review; per the harness the human launches/tests/approves.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- **Phase 34 COMPLETE (5/5 plans), human APPROVED 2026-07-06.** PRT-09/PRT-10 now complete (combined JS/TS/JSX/TSX prettify + esbuild minify, indent/printWidth/semi/single-quote toggles, paste-instant, focusable copy, byte-delta status bar). PRT-12 now fully complete (both tools registry-only, free, WCAG-AA — the JS/TS half closes the "both tools" clause).
- **v1.9 "Prettier Formatters" (Phases 31–34) is now fully delivered** modulo PRT-03/PRT-11 tracking (async seam + FormatterView generalization, landed in Phase 32; verify their checkboxes on v1.9 close-out).
- The `jsx:preserve` + `verbatimModuleSyntax` minify decision is a reusable invariant for any future esbuild-minify consumer.

---
*Phase: 34-js-ts-prettifier-tool*
*Completed: 2026-07-06*

## Self-Check: PASSED

- FOUND: `.planning/phases/34-js-ts-prettifier-tool/34-05-OFFLINE-PROOF.md`
- FOUND: `.planning/phases/34-js-ts-prettifier-tool/34-05-SUMMARY.md`
- FOUND: `test/e2e/js-formatter.e2e.ts`
- FOUND commits: `abfd8da6` (test), `4924ca86` (fix), `d7141217` (fix)
