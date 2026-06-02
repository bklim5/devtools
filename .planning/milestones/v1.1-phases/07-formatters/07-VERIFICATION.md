---
phase: 07-formatters
verified: 2026-06-02T12:12:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: null
  previous_score: null
human_verification:
  - test: "Run scripts/e2e-spike.sh against the live tauri dev WKWebView for json-formatter.e2e.ts and xml-formatter.e2e.ts"
    expected: "Both specs pass on JavaScriptCore: paste -> prettify, invalid -> clear + status error (proving the JSC SyntaxError line:col mapping and the DOMParser parsererror path on the real engine), focusable Copy output button; screenshots json-formatter-wkwebview.png + xml-formatter-wkwebview.png written"
    why_human: "Specs are WRITTEN but NOT YET executed against the real WKWebView. The line:col (JSC) and parsererror (WebKit) shapes differ from Node/jsdom and are only truly proven on the live engine. Phase-boundary gate owned by the human."
  - test: "gsd-ui-review WCAG-AA audit of both formatter tools (sidebar entry, two-pane layout, toolbar toggles, copy control, status bar)"
    expected: "WCAG-AA clean: focus-visible rings, aria-pressed toggles, role=status aria-live status bar, keyboard-reachable copy in <=1 keystroke, contrast on accent-on-selected tokens"
    why_human: "Visual + a11y audit cannot be verified programmatically; binding phase-boundary gate per CLAUDE.md harness."
  - test: "Human sign-off on a fresh `tauri build` with both formatters live"
    expected: "App builds and launches; JSON + XML tools reachable via sidebar and Cmd-K palette; paste-to-format feels instant (<2s)"
    why_human: "Real desktop build + perceived-performance sign-off is the binding per-phase-boundary human gate."
  - test: "Finish FormatterView narrow-width responsive vertical stacking (UX-05)"
    expected: "Below a breakpoint the input|output panes stack vertically (layout-agnostic, no fixed widths) without duplicating ids/copy buttons"
    why_human: "Flagged as a deferred CSS refinement in the 07-02 and 07-03 SUMMARYs; the panes carry min-w-0/min-h-0 but breakpoint-driven stacking is a UI-pass item, best confirmed visually on the real webview."
---

# Phase 7: Formatters Verification Report

**Phase Goal:** Two new tools — `json-formatter` and `xml-formatter` under `category: "formatting"` — ship into the registry-driven shell behind a shared two-pane paste-instant `FormatterView`, giving the user a jsonlint-style validate/prettify/minify (+ JSON sort-keys) experience entirely offline with zero new runtime dependencies.
**Verified:** 2026-06-02T12:12:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Pasting JSON validates instantly (no button), renders prettified; invalid clears output + shows line:col + message; empty -> "empty" not error (FMT-01) | ✓ VERIFIED | `JsonFormatterTool.tsx` derives synchronously via `useMemo(() => timed(() => formatJson(...)))` — no format button. Spot-check: `formatJson('{"a": }')` -> `{ok:false, error:{message,line:1,col:7}}`; tool maps to `error = "1:7 ..."` and `output=""` (clear-on-error, line 37/40-44). `'   '` -> `{ok:true,output:"",inputBytes:0}` and `parseState="empty"` (line 45). |
| 2 | JSON toolbar drives output live: indent 2/4/tab (FMT-02), minify wins (FMT-03), sort-keys recursive preserving array order (FMT-04) | ✓ VERIFIED | Spot-check: indent "4" -> 4-space output; "tab" -> `\t`; `minify:true` with `indent:"4"` -> single line `{"b":1,"a":2}` (minify wins); sortKeys -> `a` before `b`, nested `c` before `d`, array `[3,1,2]` order preserved. `INDENT_OPTIONS` 2/4/tab in FormatterView; default `"2"` in tool. |
| 3 | Pasting XML validates via DOMParser; parsererror surfaced + clears output (FMT-05); prettify preserves comments/CDATA/attrs/PIs (FMT-06); minify strips inter-element whitespace (FMT-07) | ✓ VERIFIED | `xml.ts` uses native `DOMParser.parseFromString(input,"application/xml")` + `querySelector("parsererror")`. `xml.test.ts` (jsdom) asserts exact outputs: `<a>\n  <b>1</b>\n  <c/>\n</a>`, preservation of `<!--note-->`/`<![CDATA[a<b]]>`/`<?pi data?>`/`x="1"`, document-level comments + `<?xml?>` decl (WR-01 fix), minify -> `<a><b>1</b></a>`, invalid -> `ok:false` non-empty message. All 10 xml assertions green in suite run. |
| 4 | Each tool's output pane exposes a visible, keyboard-focusable copy control in <=1 keystroke (no hover-only), copying via the platform clipboard seam (FMT-08) | ✓ VERIFIED | `FormatterView.tsx` renders a real `<button type="button" aria-label="Copy output">` (always visible, focusable, no hover gate) calling `platform.clipboard.writeText(output)` + `useCopyFeedback`. Shared by both tools. |
| 5 | Both tools in sidebar/palette/router by appending to TOOLS only; layout-agnostic; pure formatters in src/lib/format/ unit-tested; decoder 19 green; zero new deps | ✓ VERIFIED | `registry.ts` imports + appends `jsonFormatterTool` + `xmlFormatterTool` to `TOOLS` (only wiring change). `ToolCategory` includes `"formatting"`. `json.ts`/`xml.ts`/`types.ts` pure (no react/platform imports), independently tested. Suite: 73/73 green incl. 19 decoder tests; `tsc --noEmit` exit 0; `git diff package.json` empty. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `src/lib/format/types.ts` | FormatResult/FormatOptions/IndentMode (+timed) | ✓ VERIFIED | Pure discriminated union; `timed()` helper added (WR-02 fix) so timing is measured around the pure call, not a state setter. No react/DOM/platform imports. |
| `src/lib/format/json.ts` | Pure formatJson -> FormatResult | ✓ VERIFIED | Native JSON only; empty-ok, line:col (3 engine shapes incl. WR-03 lastIndexOf fix), minify-wins, recursive sortKeys array-preserved. |
| `src/lib/format/xml.ts` | Pure formatXml via DOMParser | ✓ VERIFIED | Native DOMParser/XMLSerializer; WR-01 fix serializes doc child nodes + re-emits `<?xml?>` decl; preserves comments/CDATA/PIs/attrs; minify strips whitespace-only text; XXE-safe (no fetch/XHR/external-entity). |
| `src/components/FormatterView.tsx` | Shared 2-pane + toolbar + copy + StatusBar | ✓ VERIFIED | JSON/XML-agnostic; read-only `<textarea>` output (no dangerouslySetInnerHTML); conditional sort-keys gated on `onSortKeys`; accent-on-selected via aria-pressed; StatusBar wired with outputBytes delta. |
| `src/components/StatusBar.tsx` | Additive optional outputBytes delta | ✓ VERIFIED | `outputBytes?` drives `formatN(byteCount) → formatN(outputBytes) bytes`; single-count branch byte-identical (`byteCount byte(s)`); byteCount still required. |
| `src/components/ResizableSplit.tsx` | Promoted shared split | ✓ VERIFIED | Lives at `src/components/`; old `src/tools/protobuf-decoder/ResizableSplit.tsx` removed; no stale source imports; ProtobufDecoder rewired to `@/components/ResizableSplit`. |
| `src/tools/json-formatter/index.ts` | jsonFormatterTool ToolDefinition | ✓ VERIFIED | `id:"json-formatter"`, `category:"formatting"`, Braces icon, enabled. |
| `src/tools/xml-formatter/index.ts` | xmlFormatterTool ToolDefinition | ✓ VERIFIED | `id:"xml-formatter"`, `category:"formatting"`, FileCode icon, enabled. |
| `src/lib/tools/registry.ts` | Both tools appended to TOOLS | ✓ VERIFIED | Both imported + present in TOOLS; only wiring change (D-12). |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| JsonFormatterTool | json.ts | formatJson on change | ✓ WIRED | `timed(() => formatJson(input,{indent,minify,sortKeys}))` in useMemo. |
| JsonFormatterTool | FormatterView | renders with onSortKeys | ✓ WIRED | Passes `onSortKeys: setSortKeys` -> sort-keys toggle present (JSON). |
| XmlFormatterTool | xml.ts | formatXml on change | ✓ WIRED | `timed(() => formatXml(input,{indent,minify}))`. |
| XmlFormatterTool | FormatterView | renders WITHOUT onSortKeys | ✓ WIRED | No `onSortKeys` passed -> sort-keys toggle absent (XML, D-06). |
| FormatterView | platform.clipboard | copy button -> writeText | ✓ WIRED | `platform.clipboard.writeText(output)` in `handleCopy`. |
| registry.ts | both tools | TOOLS array entries | ✓ WIRED | Both present; sidebar/palette/router auto-derive. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| JsonFormatterTool output | `output` | `formatJson(input,...)` real transform of user input | Yes | ✓ FLOWING |
| XmlFormatterTool output | `output` | `formatXml(input,...)` real DOMParser transform | Yes | ✓ FLOWING |
| StatusBar delta | `byteCount`/`outputBytes` | `result.inputBytes`/`result.outputBytes` from transform | Yes | ✓ FLOWING |

No hollow props or hardcoded-empty data: both tools wire real transform output end-to-end; SUMMARYs' "Known Stubs: None" confirmed against source.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Full formatter + decoder suites | `vitest run src/lib/format src/components/FormatterView.test.tsx src/tools/json-formatter src/tools/xml-formatter src/lib/protobuf/decoder.test.ts` | 7 files, 73 tests passed | ✓ PASS |
| Typecheck | `tsc --noEmit` | exit 0 | ✓ PASS |
| Zero new deps | `git diff HEAD~6 -- package.json` | empty | ✓ PASS |
| formatJson invalid -> line:col | direct call `'{"a": }'` | `{ok:false,error:{line:1,col:7}}` | ✓ PASS |
| formatJson minify-wins + sort + indent | direct calls | minify single-line w/ indent 4; sort recursive, array preserved; tab/4-space honored | ✓ PASS |
| formatXml preserve/minify/parsererror/self-close | `xml.test.ts` (jsdom) assertions in suite | exact-output assertions green | ✓ PASS |

Note: an ad-hoc XML spot-check run in the default (node) vitest env reported `DOMParser is not defined` — this is a harness artifact of the temp file lacking the `// @vitest-environment jsdom` pragma, NOT a code defect. The committed `xml.test.ts` carries the pragma and passes (10 assertions) in the full suite run above.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| FMT-01 | 07-01, 07-02 | JSON validate instantly, line:col on invalid | ✓ SATISFIED | formatJson + tool clear-on-error + empty status |
| FMT-02 | 07-02 | JSON prettify indent 2/4/tab | ✓ SATISFIED | indentSpace + INDENT_OPTIONS; spot-checked |
| FMT-03 | 07-02 | JSON minify single line | ✓ SATISFIED | minify-wins branch; spot-checked |
| FMT-04 | 07-01, 07-02 | JSON sort keys recursive, array preserved | ✓ SATISFIED | sortKeysDeep; spot-checked |
| FMT-05 | 07-03 | XML well-formedness via DOMParser, parsererror surfaced | ✓ SATISFIED | DOMParser + parsererror query; xml.test.ts |
| FMT-06 | 07-03 | XML prettify preserving comments/CDATA/attrs/PIs | ✓ SATISFIED | prettyNode + per-node XMLSerializer; WR-01 doc-level fix; xml.test.ts |
| FMT-07 | 07-01, 07-03 | XML minify strips inter-element whitespace | ✓ SATISFIED | stripInsignificantWhitespace; xml.test.ts |
| FMT-08 | 07-02, 07-03 | Visible keyboard-focusable copy, no hover-only | ✓ SATISFIED | FormatterView Copy output button via platform seam |

All 8 FMT IDs accounted for. No orphaned requirements (REQUIREMENTS.md maps FMT-01..08 to Phase 7, all present in plans 02/03; plan 01 contributes foundation).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `src/lib/tools/registry.ts` | 14-19 | Stale comment ("enabled:false ID-reserving stubs … ENABLED_TOOLS is currently EMPTY") contradicts current 8-tool live array (IN-02) | ℹ️ Info | Cosmetic/misleading-to-reader only; runtime behavior correct (all tools `enabled`, ENABLED_TOOLS non-empty). Not goal-blocking. |
| `src/lib/format/json.ts`, `xml.ts`, both tools | byteLen | `byteLen` duplicated across 4 files (IN-04) | ℹ️ Info | DRY nit; values provably identical. Not goal-blocking. |

No blocker or warning anti-patterns. WR-01/WR-02/WR-03 from 07-REVIEW confirmed fixed in source (xml.ts doc-level serialization + `xmlDeclaration`; `timed()` in types.ts used via useMemo in both tools; `lastIndexOf` snippet bias in json.ts).

### Human Verification Required

1. **Real-WKWebView e2e** — Run `scripts/e2e-spike.sh` for `json-formatter.e2e.ts` + `xml-formatter.e2e.ts` on live `tauri dev`. Expected: both pass on JSC (paste->prettify, invalid->clear+error, focusable copy); screenshots written. The JSC line:col and WebKit parsererror shapes are only truly proven here. Specs written, not yet executed (no `{json,xml}-formatter-wkwebview.png` present).
2. **gsd-ui-review WCAG-AA** — Audit both tools' a11y/visual fidelity.
3. **tauri build sign-off** — Fresh build, both tools live, paste-to-format feels instant (<2s).
4. **FormatterView narrow-width stacking (UX-05)** — Finish breakpoint-driven vertical stacking (deferred CSS refinement flagged in 07-02/07-03 SUMMARYs).

### Gaps Summary

No code-level gaps. All 5 success criteria and all 8 FMT requirements are satisfied in the actual codebase: pure transforms are correct (spot-checked + unit-tested), the shared FormatterView wires real data through a visible focusable copy control, both tools are registered registry-only under `category:"formatting"`, the decoder's 19 tests stay green, and zero new runtime dependencies were added. The three code-review warnings (WR-01/02/03) are confirmed fixed in source.

Status is **human_needed** (not passed) solely because the binding phase-boundary gates are human-owned and outstanding: the real-WKWebView e2e run (specs written but not executed — load-bearing for the engine-specific error-message paths), the gsd-ui-review WCAG-AA audit, the `tauri build` human sign-off, and the deferred narrow-width responsive-stacking refinement. Two Info-level cleanups (stale registry comment, duplicated `byteLen`) are noted but non-blocking.

---

_Verified: 2026-06-02T12:12:00Z_
_Verifier: Claude (gsd-verifier)_
