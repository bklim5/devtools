---
phase: 34-js-ts-prettifier-tool
reviewed: 2026-07-06T20:26:18Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - scripts/gen-prettier-golden.mjs
  - src/components/FormatterView.test.tsx
  - src/components/FormatterView.tsx
  - src/lib/format/conciseError.test.ts
  - src/lib/format/conciseError.ts
  - src/lib/format/minify.test.ts
  - src/lib/format/minify.ts
  - src/lib/format/prettier.ts
  - src/lib/format/prettier.test.ts
  - src/lib/format/prettier.parity.test.ts
  - src/lib/tools/registry.ts
  - src/tools/html-formatter/HtmlFormatterTool.tsx
  - src/tools/js-formatter/index.ts
  - src/tools/js-formatter/JsFormatterTool.test.tsx
  - src/tools/js-formatter/JsFormatterTool.tsx
  - test/e2e/js-formatter.e2e.ts
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
fixed: 1
status: issues_found
---

# Phase 34: Code Review Report

**Reviewed:** 2026-07-06T20:26:18Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Reviewed the Phase-34 diff (combined JS/TS/JSX/TSX prettify+minify tool): the
`formatJsTs`/`minifyJsTs` fallback chains, the shared `conciseError` extraction,
the FormatterView semi/singleQuote toggles, the golden generator + parity/routing
locks, the new tool component + registry entry, and the WKWebView e2e. Fixture
inputs/goldens (`fallback.js`, `messy.jsx`, `messy.tsx` + goldens) were read as
context.

Overall quality is high: error-as-value discipline is consistent, the fallback
ORDER contracts are proven via injectable runners (not just output bytes), the
routing-golden blind spot is honestly documented, the 2 MB guard's 0-encode /
no-re-trim proofs are cloned correctly at the new tool seam, `toError`'s 1-based
column claim holds for BOTH parsers (verified empirically at pin 3.8.3: column 11
for the offset-10 token in `const a = )` on both `typescript` and `babel`), and
the registry addition is minimal. No security issues; no source-file bugs that
produce wrong output.

One phase-introduced Warning: `conciseError` does not handle the multi-line code
frame that the `babel`/`typescript` Prettier parsers attach to parse errors — a
new error shape the new JS/TS tool feeds it that its HTML-tool origin never saw.
Two Info items on process wiring and duplication.

Cross-references checked: `useAsyncFormat` (identity-compared opts — both tools
memoize correctly), `StatusBar` (all e2e selectors — `[data-status="error"]`,
`aria-label` full-error carry, `aria-label="byte count"` suppression on
`undefined` — exist as the tests assume), `types.ts` (`offsetToLineCol` /
`byteLen` usage consistent).

## Warnings

### WR-01 (FIXED — commit daebe052): `conciseError` leaks Prettier's multi-line code frame (and a redundant mid-message locus) into the status bar on the JS/TS Prettify error path

**Resolution:** `conciseError` now cuts the message at the first newline before
the existing pipeline, dropping the babel/typescript code frame and re-exposing
the `(1:11)` locus as trailing so the paren-locus regex strips it. Regression
tests added for both the typescript and babel parser code-frame shapes. HTML
single-line errors are unaffected (no-op cut). Full suite 1431 green, tsc clean.


**File:** `src/lib/format/conciseError.ts:8-13` (consumer: `src/tools/js-formatter/JsFormatterTool.tsx:83-87`)
**Issue:** The helper was extracted from the HTML tool, whose `html`-parser
errors are single-line boilerplate (`… It may happen … For more info see …
(1:14)`). The NEW consumer feeds it `babel`/`typescript` parser errors, which
have a different shape — verified against the pinned 3.8.3:

```
"Expression expected. (1:11)\n> 1 | const a = )\n    |           ^"
```

Neither transform fires: there is no boilerplate clause to split on, and the
`(1:11)` locus is mid-string (followed by the code frame), so the
trailing-locus regex `/\s*\(\d+:\d+\)\s*$/` never matches. The composed status
error becomes:

```
1:11 Expression expected. (1:11)
> 1 | const a = )
    |           ^
```

Consequences: (a) a redundant duplicate `(1:11)` in the visible truncated line;
(b) the full ASCII code frame lands in the span's `title` AND `aria-label`, and
the footer is `role=alert` / `aria-live=assertive` — screen readers announce the
raw frame glyphs on every malformed keystroke; (c) the D-11/D-03 "concise error"
contract is violated on the tool's PRIMARY error path (Prettify of malformed
input). No existing test catches it: the jsdom test only asserts `/^\d+:\d+ /`
and the e2e error step (#4) runs in Minify mode, where esbuild's message is
clean — the e2e's own no-boilerplate assertion never sees a Prettify error.
**Fix:** Cut the message at the first newline before the existing pipeline —
the head line is always the essential message, and the trailing-locus regex then
correctly strips the now-trailing `(1:11)`:

```ts
export function conciseError(message: string): string {
  return message
    .split("\n")[0]
    .split(/\.\s+(?:It may happen\b|For more info(?:rmation)? see\b)/i)[0]
    .replace(/\s*\(\d+:\d+\)\s*$/, "")
    .trim();
}
```

All existing `conciseError` fixtures are single-line, so behavior for the HTML
tool stays byte-identical. Add a test with a real code-frame message (e.g. the
string above → `"Expression expected."`), and consider extending the e2e/jsdom
error assertions to a Prettify-mode error with `not.toContain("\n")` /
`not.toContain("|")`.

## Info

### IN-01: The documented golden-integrity check is not wired anywhere — manual-only

**File:** `scripts/gen-prettier-golden.mjs:17-19` (also referenced in `src/lib/format/prettier.parity.test.ts:9-14`)
**Issue:** Both headers describe a two-leg drift design where leg 2 is "this
generator + `git diff --exit-code -- test/fixtures/prettier/`, run outside this
suite". Grep of `package.json` scripts, `lefthook.yml`, and `scripts/` finds no
wiring — the second leg exists only as a comment, so stale-golden-vs-fresh-CLI
drift is caught only if someone remembers to run it by hand. Residual risk is
low (exact `3.8.3` pin + the parity lock make wrapper↔CLI divergence unlikely),
but the design's stated guarantee is currently aspirational.
**Fix:** Add a script, e.g. `"golden:check": "node scripts/gen-prettier-golden.mjs && git diff --exit-code -- test/fixtures/prettier/"`,
and hang it off lefthook pre-push or the phase-boundary checklist.

### IN-02: JsFormatterTool duplicates HtmlFormatterTool's derivation block verbatim

**File:** `src/tools/js-formatter/JsFormatterTool.tsx:78-88` (mirror: `src/tools/html-formatter/HtmlFormatterTool.tsx:74-88`)
**Issue:** The `output` / `byteCount` / `outputBytes` / composed
`line:col`-error / `parseState` derivation (~11 lines plus their load-bearing
SC5/SC6 comments) is copy-identical across the two async tools. The phase plan
deliberately "clones the pattern EXACTLY", which is defensible, but a third
async formatter would make this a three-way copy of subtle guard-preserving
logic. Low priority.
**Fix:** When convenient, extract a small
`deriveFormatterStatus(result, inputBytes, isEmpty, pending)` helper next to
`conciseError` (which already proved the extraction pattern this phase).

---

_Reviewed: 2026-07-06T20:26:18Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
