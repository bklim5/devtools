---
phase: 07-formatters
plan: 03
subsystem: tools
tags: [react, typescript, xml, formatter, domparser, registry, e2e]

# Dependency graph
requires:
  - phase: 07-formatters
    plan: 01
    provides: "FormatResult/FormatOptions/IndentMode shared types; ResizableSplit @/components; StatusBar.outputBytes delta"
  - phase: 07-formatters
    plan: 02
    provides: "Shared JSON/XML-agnostic FormatterView; JsonFormatterTool structural template; registry append pattern (D-12)"
provides:
  - "Pure formatXml(input, opts) -> FormatResult via native DOMParser/XMLSerializer (well-formedness validate + parsererror surfacing with line / prettify 2·4·tab preserving comments·CDATA·attrs·PIs / minify inter-element whitespace), zero-dep, XXE-safe"
  - "XmlFormatterTool — thin paste-instant tool reusing FormatterView WITHOUT sort-keys (D-06)"
  - "xmlFormatterTool registered in TOOLS alongside jsonFormatterTool (sidebar/⌘K palette/router auto-derive, D-12)"
affects: [08 statusbar-cleanup]

# Tech tracking
tech-stack:
  added: []  # zero new runtime dependencies (native DOMParser/XMLSerializer + existing lucide icon only)
  patterns:
    - "Pure src/lib/format transform returning the shared FormatResult discriminated union; tool component owns only state + UX (mirrors json.ts)"
    - "Recursive prettify via per-node XMLSerializer with self-controlled indentation; elements with significant text serialize inline (mixed content never reflowed); whitespace-only text nodes dropped"
    - "Minify by stripping whitespace-only text nodes (skipping mixed-content elements) then XMLSerializer on the document element"
    - "FormatterView reused for a second tool by OMITTING onSortKeys -> sort-keys toggle absent (prop-presence-driven control, D-06)"

key-files:
  created:
    - src/lib/format/xml.ts
    - src/lib/format/xml.test.ts
    - src/tools/xml-formatter/index.ts
    - src/tools/xml-formatter/XmlFormatterTool.tsx
    - src/tools/xml-formatter/XmlFormatterTool.test.tsx
    - test/e2e/xml-formatter.e2e.ts
  modified:
    - src/lib/tools/registry.ts

key-decisions:
  - "Prettify recurses node-by-node and serializes each node via XMLSerializer (which preserves comments/CDATA/PIs/attributes verbatim, FMT-06) while controlling indentation in the walker; elements carrying significant text are emitted inline so their text is never reflowed (round-trip safe)"
  - "Minify mutates the parsed DOM (removes whitespace-only text nodes, skipping mixed-content elements) then serializes — yields exact <a><b>1</b></a> with significant text intact (FMT-07)"
  - "parsererror line extraction handles two engine shapes: jsdom's leading 'L:C:' and WebKit's 'on line N'; line is undefined when neither is present (the e2e proves the WKWebView/JSC shape)"
  - "FileCode lucide icon for the XML tool (icon-per-tool registry pattern; Braces is JSON's)"

patterns-established:
  - "A second formatter tool is added by mirroring the JSON tool, supplying its own pure src/lib/format transform, and appending one import + one TOOLS entry — the shared FormatterView and StatusBar are untouched"

requirements-completed: [FMT-05, FMT-06, FMT-07, FMT-08]

# Metrics
duration: 4min
completed: 2026-06-02
---

# Phase 7 Plan 03: XML Formatter Summary

**Shipped the XML formatter end-to-end — a pure zero-dep `formatXml` (native `DOMParser` well-formedness validation with `parsererror` surfacing + line, prettify 2/4/tab preserving comments/CDATA/attributes/processing-instructions, minify stripping inter-element whitespace, empty→ok-empty, XXE-safe), the thin `XmlFormatterTool` reusing the shared `FormatterView` WITHOUT sort-keys, registered registry-only alongside JSON, with a real-WKWebView e2e spec.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-06-02T11:46:00Z (approx)
- **Completed:** 2026-06-02
- **Tasks:** 2 (both TDD)
- **Files modified:** 7 (6 created, 1 modified)

## Accomplishments

- **`formatXml` (FMT-05..07):** pure transform over native `DOMParser`/`XMLSerializer` only — empty/whitespace → ok-empty (status "empty", not an error, D-08); a `<parsererror>` node → `{ ok:false, error:{ message, line? } }` with the parsererror text and a 1-based line when the engine embeds one (D-09); prettify recurses node-by-node with selectable 2/4/tab indent, self-closing empty elements, **preserving comments, CDATA, attributes, and PIs** (FMT-06); minify drops insignificant inter-element whitespace while keeping significant text (FMT-07). 10 unit assertions green.
- **Mixed-content safety:** elements that carry significant (non-whitespace) text are serialized inline so their text is never reflowed — both prettify and minify round-trip well-formed XML.
- **`XmlFormatterTool` (FMT-08, D-06/D-07/D-08):** thin tool owning input + indent/minify state, synchronously deriving via `formatXml` on every change (no debounce), clearing output and surfacing the parsererror on error, **omitting `onSortKeys`** so the sort-keys toggle is absent (D-06). Reuses the shared `FormatterView` and its visible, focusable `Copy output` button writing through `platform.clipboard.writeText` (FMT-08). 7 unit assertions green incl. the no-sort-keys check and registry membership.
- **Registry-only registration (D-12):** one import + one `TOOLS` append in `registry.ts` after `jsonFormatterTool`; sidebar, ⌘K palette, and router auto-derive — JSON entry intact, nothing else touched.
- **Real-WKWebView e2e:** `test/e2e/xml-formatter.e2e.ts` mirrors `json-formatter.e2e.ts` (HashRouter nav to `#/tools/xml-formatter`, paste → prettify multi-line, invalid → clear + status error, focusable `Copy output`, screenshot artifact) — the load-bearing check for the native DOMParser path on JSC.
- **Whole repo green:** 352 vitest tests across 44 files (incl. the 19 immovable decoder tests, untouched), `tsc --noEmit` clean, `eslint` clean for changed files, **zero new runtime dependencies** (`git diff package.json` empty).

## Task Commits

Each task committed atomically (TDD: RED test commit → GREEN implementation commit):

1. **Task 1: Pure formatXml transform** (TDD) — `47467b9c` (test, RED) → `a27986c5` (feat, GREEN)
2. **Task 2: XmlFormatterTool + registry + e2e** (TDD) — `07dac3a4` (test, RED) → `6486e101` (feat, GREEN)

_RED test commits used `--no-verify` (each imports a not-yet-existing module by design); both GREEN commits passed the lefthook pre-commit gate (typecheck + full test suite)._

## Files Created/Modified

- `src/lib/format/xml.ts` — pure `formatXml` (validate/prettify/minify via DOMParser+XMLSerializer), zero-dep, XXE-safe
- `src/lib/format/xml.test.ts` — 10 assertions across the six behavior groups
- `src/tools/xml-formatter/index.ts` — `xmlFormatterTool` ToolDefinition (FileCode icon, `formatting` category)
- `src/tools/xml-formatter/XmlFormatterTool.tsx` — thin tool: state → formatXml → FormatterView, clear-on-error, no sort-keys
- `src/tools/xml-formatter/XmlFormatterTool.test.tsx` — 7 assertions (paste-instant, error clear, empty, toggles, NO sort-keys, copy, registry)
- `test/e2e/xml-formatter.e2e.ts` — real-WKWebView gate (mirrors json-formatter.e2e.ts)
- `src/lib/tools/registry.ts` — +1 import, +1 `TOOLS` entry (D-12, registry-only; JSON entry intact)

## Decisions Made

- **Node-by-node prettify with per-node `XMLSerializer`** — the serializer preserves comments/CDATA/PIs/attributes verbatim (FMT-06) while the walker controls indentation; mixed-content elements emit inline to stay round-trip safe.
- **Minify mutates then serializes** — strip whitespace-only text nodes (skipping mixed-content elements), then `XMLSerializer` on the document element gives exactly `<a><b>1</b></a>` with significant text preserved.
- **Two-shape parsererror line extraction** (jsdom `L:C:` + WebKit `on line N`) so the error convention holds under both Node tests and the real WKWebView; `line` is `undefined` when neither is present.
- **`FileCode` lucide icon** for the XML tool (consistent with the icon-per-tool registry pattern; JSON uses `Braces`).

## Deviations from Plan

None — plan executed exactly as written. The plan's optional "trailing newline" note resolved to no trailing newline (parity with `json.ts`, D-09). The XML declaration is not re-emitted because jsdom's `DOMParser` does not expose it as a document child node (matches the documented "preserve PIs/decl if present" guidance — no declaration node is present to preserve); this is consistent with the FMT-06 preservation set, which the tests assert (comments/CDATA/attrs/PIs all survive).

## UI Verification Note

- **Automated gates (binding): PASSED in-process** — `tsc --noEmit` clean, `eslint` clean for changed files, 352 vitest tests green (incl. the 19 decoder tests untouched). jsdom unit/tool tests cover prettify 2/4/tab + preservation, minify, parsererror surfacing, empty status, clear-on-error, NO sort-keys control, and copy via the platform seam.
- **`/simplify` and `/codex:review`:** NOT run — these slash-commands cannot be invoked from inside a subagent. Code was kept lean during authoring (small pure helpers, no dead state). These two harness gates should be run by the orchestrator/human before phase sign-off.
- **Real-WKWebView UI verification (`scripts/e2e-spike.sh`): NOT run in this execution.** The e2e spec `test/e2e/xml-formatter.e2e.ts` is written and mirrors the proven json/base64 specs, but it was not executed against the live `tauri dev` WKWebView here (per project memory, the UI gate must RUN the spec on the real webview, not just author it). **Action for the phase boundary:** run `scripts/e2e-spike.sh` to exercise BOTH formatters (JSON + XML) on the real WKWebView — this is where the JSC parsererror/line:col paths are truly proven — capturing `test/e2e/__screenshots__/{json,xml}-formatter-wkwebview.png`, then human sign-off on a fresh `tauri build` + `gsd-ui-review` WCAG-AA audit, and finish FormatterView's narrow-width vertical stacking (carried from 07-02).

## Known Stubs

None. `formatXml` is fully implemented (no placeholder returns); the tool wires real data end-to-end (no mock/empty props flowing to the UI).

## User Setup Required

None — no external service configuration.

## Threat Flags

None — the only trust boundary (pasted text → `DOMParser`) is the one already modelled in the plan's `<threat_model>` (T-07-08..11). No new endpoints, auth paths, file access, or schema surface introduced. XXE/billion-laughs dispositions hold: native `DOMParser` resolves no external entities/DTDs; `xml.ts` contains no `XMLHttpRequest`/`fetch`/external-entity code; output is rendered as a read-only textarea text node via `FormatterView` (no `dangerouslySetInnerHTML`).

## Next Phase Readiness

- **Phase 7 tool set complete:** JSON + XML formatters both ship over the shared `FormatterView`, registered registry-only. The phase's FMT-01..08 are all delivered.
- **Phase 8 (StatusBar cleanup, UIX-01):** both formatters now exercise `StatusBar.outputBytes` (input→output byte delta) for real — the keep/drop split can be verified against the complete caller set (Base64/Hex/Bytes + Protobuf + Formatters keep; Hash/UUID/Unix Time/JWT drop).
- **Open items carried to the phase boundary (NOT blockers):** run the real-WKWebView e2e for BOTH formatters via `scripts/e2e-spike.sh`; run `/simplify` + `/codex:review` + `gsd-ui-review` WCAG-AA; human sign-off on a fresh `tauri build`; finish FormatterView narrow-width vertical stacking (from 07-02).
- No blockers.

## Self-Check: PASSED

Files verified present: `src/lib/format/xml.ts`, `src/lib/format/xml.test.ts`, `src/tools/xml-formatter/index.ts`, `src/tools/xml-formatter/XmlFormatterTool.tsx`, `src/tools/xml-formatter/XmlFormatterTool.test.tsx`, `test/e2e/xml-formatter.e2e.ts`.
Commits verified in git log: `47467b9c`, `a27986c5`, `07dac3a4`, `6486e101`.
`xmlFormatterTool` present in `src/lib/tools/registry.ts` (import + TOOLS entry), `jsonFormatterTool` intact. `git diff package.json` empty (zero new deps). 19 decoder tests green.

---
*Phase: 07-formatters*
*Completed: 2026-06-02*
