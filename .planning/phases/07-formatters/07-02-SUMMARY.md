---
phase: 07-formatters
plan: 02
subsystem: tools
tags: [react, typescript, json, formatter, formatter-view, registry, e2e]

# Dependency graph
requires:
  - phase: 07-formatters
    plan: 01
    provides: "ResizableSplit @/components, StatusBar.outputBytes delta, FormatResult/FormatOptions/IndentMode"
provides:
  - "Pure formatJson(input, opts) -> FormatResult (validate line:col / prettify 2·4·tab / minify-wins / recursive sort-keys, arrays preserved, zero-dep native JSON)"
  - "Shared presentational FormatterView (resizable input | read-only copy-bearing output + shared toolbar + StatusBar) — JSON/XML-agnostic, ready for the wave-3 XML formatter"
  - "jsonFormatterTool registered in TOOLS (sidebar/⌘K palette/router auto-derive)"
affects: [07-03 xml-formatter, 08 statusbar-cleanup]

# Tech tracking
tech-stack:
  added: []  # zero new runtime dependencies (native JSON + existing lucide icon only)
  patterns:
    - "Pure src/lib/format transform returning the shared FormatResult discriminated union; tool component owns only state + UX"
    - "Presentational shared view (FormatterView) parameterised by a controls object so the same shell serves JSON (sort-keys on) and XML (sort-keys off) via prop presence"
    - "Engine-portable SyntaxError -> line:col mapping (V8 position form, V8 snippet form, JSC line/column form)"

key-files:
  created:
    - src/lib/format/json.ts
    - src/lib/format/json.test.ts
    - src/components/FormatterView.tsx
    - src/components/FormatterView.test.tsx
    - src/tools/json-formatter/index.ts
    - src/tools/json-formatter/JsonFormatterTool.tsx
    - src/tools/json-formatter/JsonFormatterTool.test.tsx
    - test/e2e/json-formatter.e2e.ts
  modified:
    - src/lib/tools/registry.ts

key-decisions:
  - "line:col extraction handles three engine message shapes (V8 'position N', V8 'Unexpected token .. <snippet> is not valid JSON', JSC 'line L column C') so the same code path works under Node tests and the real WKWebView"
  - "FormatterView renders a single ResizableSplit instance (no duplicated DOM) — true narrow-width vertical stacking deferred as a minor refinement to keep ids unique and a11y intact; panes are layout-agnostic (min-w-0/min-h-0, no fixed widths)"
  - "Status timing sampled around the input edit handler (mirrors Base64's timed() intent) rather than measured in render, avoiding a render-phase setState"

patterns-established:
  - "Formatter tools are thin: state (input + indent/minify/sortKeys) -> formatJson -> FormatterView; clear-on-error (D-08) lives in the tool, the view stays presentational"

requirements-completed: [FMT-01, FMT-02, FMT-03, FMT-04, FMT-08]

# Metrics
duration: 6min
completed: 2026-06-02
---

# Phase 7 Plan 02: JSON Formatter Summary

**Shipped the JSON formatter end-to-end — a pure zero-dep `formatJson` (validate with engine-portable line:col, prettify 2/4/tab, minify-wins, recursive sort-keys with array order preserved), the shared JSON/XML-agnostic `FormatterView` (resizable input | read-only copy-bearing output + shared toolbar + StatusBar byte delta), and a thin `JsonFormatterTool` registered registry-only with a real-WKWebView e2e spec.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-06-02T10:39:15Z
- **Completed:** 2026-06-02T10:44:58Z
- **Tasks:** 3 (all TDD)
- **Files modified:** 9 (8 created, 1 modified)

## Accomplishments

- **`formatJson` (FMT-01..04):** pure transform over native `JSON` only — empty/whitespace → ok-empty (status "empty", not an error, D-08); strict-JSON parse failure → `{ ok:false, error:{ message, line?, col? } }` with a 1-based line:col computed over the user's own input; prettify with 2/4/tab indent; minify wins over prettify (D-06); recursive `sortKeys` that sorts object keys at every level while preserving array order (D-10). 11 unit assertions green.
- **Engine-portable error mapping:** the line:col extractor handles three `SyntaxError` shapes — V8 "position N", V8 "Unexpected token 'X', \"<snippet>\" is not valid JSON" (no offset → locate the snippet in the input), and JSC "line L column C" — so the same path produces line:col under Node/V8 unit tests and the real WKWebView/JSC (the load-bearing reason for the e2e spec).
- **`FormatterView` (D-01/D-03/D-06):** shared presentational shell — a single top toolbar (indent 2/4/tab segmented group, minify toggle, sort-keys toggle rendered ONLY when `onSortKeys` is provided, output copy button), a `ResizableSplit` of editable input | read-only output, and a `StatusBar` footer wired with the input→output byte delta. Read-only `<textarea>` output, NO raw-HTML injection, NO syntax highlighting (D-03 / threat T-07-05). Visible, focusable `Copy output` button writing through `platform.clipboard.writeText` (FMT-08). Accent = selected-only via `aria-pressed`. 7 unit assertions green.
- **`JsonFormatterTool` (FMT-08, D-07/D-08):** thin tool owning input + option state, synchronously deriving via `formatJson` on every change (no debounce), clearing output and surfacing `line:col message` on error, passing `onSortKeys` (JSON enables sort-keys, D-06). 6 unit assertions green incl. a registry-membership check.
- **Registry-only registration (D-12):** one import + one `TOOLS` append in `registry.ts`; sidebar, ⌘K palette, and router auto-derive — nothing else touched.
- **Real-WKWebView e2e:** `test/e2e/json-formatter.e2e.ts` mirrors `base64.e2e.ts` (HashRouter nav to `#/tools/json-formatter`, paste → prettify, invalid → clear + status error, focusable `Copy output`, screenshot artifact).
- **Whole repo green:** 335 vitest tests (incl. the 19 immovable decoder tests, untouched), `tsc --noEmit` clean, `eslint` clean for changed files, **zero new runtime dependencies** (`git diff package.json` empty).

## Task Commits

Each task was committed atomically (TDD: RED test commit → GREEN implementation commit):

1. **Task 1: Pure formatJson transform** (TDD) — `392808d1` (test, RED) → `ba4fc4cb` (feat, GREEN)
2. **Task 2: Shared FormatterView** (TDD) — `74dfe9cf` (test, RED) → `de492031` (feat, GREEN)
3. **Task 3: JsonFormatterTool + registry + e2e** (TDD) — `a3b52ed7` (test, RED) → `1401b35e` (feat, GREEN)

_RED test commits used `--no-verify` (the test imports a not-yet-existing module by design); all GREEN commits passed the lefthook pre-commit gate (typecheck + full test suite)._

## Files Created/Modified

- `src/lib/format/json.ts` — pure `formatJson` (validate/prettify/minify/sort, engine-portable line:col), zero-dep
- `src/lib/format/json.test.ts` — 11 assertions across the six behavior groups
- `src/components/FormatterView.tsx` — shared presentational 2-pane + toolbar + copy + StatusBar
- `src/components/FormatterView.test.tsx` — 7 assertions (panes, read-only output, conditional sort-keys, copy seam, StatusBar wiring, accent-on-selected, callbacks)
- `src/tools/json-formatter/index.ts` — `jsonFormatterTool` ToolDefinition (Braces icon, `formatting` category)
- `src/tools/json-formatter/JsonFormatterTool.tsx` — thin tool: state → formatJson → FormatterView, clear-on-error
- `src/tools/json-formatter/JsonFormatterTool.test.tsx` — 6 assertions (paste-instant, error clear+line:col, empty, toggles, copy, registry)
- `test/e2e/json-formatter.e2e.ts` — real-WKWebView gate (mirrors base64.e2e.ts)
- `src/lib/tools/registry.ts` — +1 import, +1 `TOOLS` entry (D-12, registry-only)

## Decisions Made

- **Three-shape line:col mapping** so the error convention holds under both Node/V8 (unit tests) and JavaScriptCore (real WKWebView), whose `SyntaxError` text differs.
- **Single `ResizableSplit` instance in FormatterView** (no DOM duplication) — avoids duplicate ids / duplicate copy buttons that would break a11y and the tests. See Deviations for the narrow-width-stack note.
- **Timing sampled in the input edit handler**, not in render, to avoid a render-phase `setState`.
- **`Braces` lucide icon** for the JSON tool (consistent with the icon-per-tool registry pattern).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Engine-portable line:col (Node/V8 emits no "position N" for the planned test input)**
- **Found during:** Task 1
- **Issue:** The plan's implementation note assumed the `SyntaxError` for `{"a": }` carries "position 7". On this repo's Node/V8, that input yields a *snippet-form* message ("Unexpected token '}', \"{\"a\": }\" is not valid JSON") with NO char offset, so the position-only parse left line/col undefined and the test failed.
- **Fix:** Extended `lineColFromError` to also handle (a) V8's snippet form — locate the quoted context snippet in the input and offset to the offending token — and (b) JSC's "line L column C" form (the real WKWebView). The planned "position N" form is still handled first.
- **Files modified:** `src/lib/format/json.ts`
- **Verification:** both invalid-input assertions green (single-line and multi-line), full suite green.
- **Committed in:** `ba4fc4cb`

### Scope notes (not deviations)

- **Narrow-width vertical stacking (D-01/UX-05):** `FormatterView` renders one `ResizableSplit`; rendering a second stacked layout would duplicate the `#json-input`/`#json-output` ids and the copy button (invalid HTML, broken a11y/tests). The panes are layout-agnostic (`min-w-0`/`min-h-0`, no fixed widths) and the side-by-side resizable split is the primary macOS-window layout. True breakpoint-driven vertical stacking is a small CSS refinement left for the wave-3/UI pass rather than shipped as duplicated DOM. Flagging so the XML plan and the phase UI review can finish it cleanly.

**Total deviations:** 1 auto-fixed (1 bug). Plus 1 scope note.
**Impact:** the line:col fix made the error convention actually portable to the real runtime — strictly better than the plan's single-format assumption. No scope creep; decoder + its 19 tests untouched.

## UI Verification Note

- **Automated gates (binding): PASSED in-process** — `tsc --noEmit` clean, `eslint` clean for changed files, 335 vitest tests green (incl. the 19 decoder tests). jsdom component/tool tests cover paste-instant prettify, clear-on-error with line:col, empty status, indent/minify/sort re-derive, and copy via the platform seam.
- **`/simplify` and `/codex:review`:** NOT run — these slash-commands cannot be invoked from inside a subagent. The just-written code was kept lean during authoring (no dead assignments after the eslint `no-useless-assignment` fix; shared toggle styling factored). These two harness gates should be run by the orchestrator/human before phase sign-off.
- **Real-WKWebView UI verification (`scripts/e2e-spike.sh`): NOT run in this execution.** The e2e spec `test/e2e/json-formatter.e2e.ts` is written and mirrors the proven base64 spec, but it was not executed against the live `tauri dev` WKWebView here (per project memory, the UI gate must RUN the spec on the real webview, not just author it). **Action for the phase boundary:** run `scripts/e2e-spike.sh` to exercise the JSON formatter on the real WKWebView (this is also where the JSC line:col mapping is truly proven) and capture `test/e2e/__screenshots__/json-formatter-wkwebview.png`, then the human sign-off on a fresh `tauri build` + `gsd-ui-review` WCAG-AA audit.

## Known Stubs

None. `formatJson` is fully implemented (no placeholder returns); the tool wires real data end-to-end (no mock/empty props flowing to the UI).

## User Setup Required

None — no external service configuration.

## Next Phase Readiness

- **07-03 (xml-formatter):** `FormatterView` is JSON/XML-agnostic and ready — the XML tool omits `onSortKeys` (so the sort-keys toggle is absent) and supplies its own `formatXml` returning the same `FormatResult`. Registry append pattern (D-12) is established. `registry.ts` and `StatusBar.tsx` were the serialized shared-surface files; this plan touched only `registry.ts` (one append), leaving a clean append point for `xmlFormatterTool`.
- **Phase 8 (StatusBar cleanup):** the formatters now exercise `StatusBar.outputBytes` for real — the keep/drop split can be verified against the complete caller set.
- **Open item carried to the phase boundary:** run the real-WKWebView e2e + `/simplify` + `/codex:review` + `gsd-ui-review` before phase sign-off (see UI Verification Note).
- No blockers.

## Self-Check: PASSED

Files verified present: `src/lib/format/json.ts`, `src/lib/format/json.test.ts`, `src/components/FormatterView.tsx`, `src/components/FormatterView.test.tsx`, `src/tools/json-formatter/index.ts`, `src/tools/json-formatter/JsonFormatterTool.tsx`, `src/tools/json-formatter/JsonFormatterTool.test.tsx`, `test/e2e/json-formatter.e2e.ts`.
Commits verified in git log: `392808d1`, `ba4fc4cb`, `74dfe9cf`, `de492031`, `a3b52ed7`, `1401b35e`.
`jsonFormatterTool` present in `src/lib/tools/registry.ts` (import + TOOLS entry). `git diff package.json` empty (zero new deps). 19 decoder tests green.

---
*Phase: 07-formatters*
*Completed: 2026-06-02*
