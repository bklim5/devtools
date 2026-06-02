---
phase: 07-formatters
plan: 03
type: execute
wave: 3
depends_on: [01, 02]
files_modified:
  - src/lib/format/xml.ts
  - src/lib/format/xml.test.ts
  - src/tools/xml-formatter/index.ts
  - src/tools/xml-formatter/XmlFormatterTool.tsx
  - src/tools/xml-formatter/XmlFormatterTool.test.tsx
  - src/lib/tools/registry.ts
  - test/e2e/xml-formatter.e2e.ts
autonomous: true
requirements: [FMT-05, FMT-06, FMT-07, FMT-08]
must_haves:
  truths:
    - "User can paste XML and see it validated for well-formedness instantly via DOMParser"
    - "A <parsererror> surfaces its message (with line where the engine provides one) and clears the output"
    - "User can prettify XML with selectable indent 2/4/tab, preserving comments, CDATA, attributes, and processing instructions"
    - "User can minify XML by stripping insignificant inter-element whitespace"
    - "The output pane has a visible, keyboard-focusable copy control reachable in <=1 keystroke, copying via the platform clipboard seam"
    - "xml-formatter appears in sidebar, palette, and router solely by appending to the TOOLS array"
  artifacts:
    - path: "src/lib/format/xml.ts"
      provides: "Pure formatXml(input, opts) -> FormatResult via native DOMParser"
      exports: ["formatXml"]
    - path: "src/tools/xml-formatter/index.ts"
      provides: "xmlFormatterTool ToolDefinition"
      exports: ["xmlFormatterTool"]
    - path: "src/lib/tools/registry.ts"
      provides: "xmlFormatterTool appended to TOOLS"
      contains: "xmlFormatterTool"
  key_links:
    - from: "src/tools/xml-formatter/XmlFormatterTool.tsx"
      to: "src/lib/format/xml.ts"
      via: "formatXml call on input change"
      pattern: "formatXml"
    - from: "src/tools/xml-formatter/XmlFormatterTool.tsx"
      to: "src/components/FormatterView.tsx"
      via: "renders FormatterView WITHOUT sort-keys"
      pattern: "FormatterView"
    - from: "src/lib/tools/registry.ts"
      to: "src/tools/xml-formatter"
      via: "TOOLS array entry"
      pattern: "xmlFormatterTool"
---

<objective>
Ship the XML formatter end-to-end on top of the wave-1 foundation and the wave-2 `FormatterView`: the pure `formatXml` transform (DOMParser well-formedness validation + parsererror surfacing, prettify preserving comments/CDATA/attributes/PIs, minify), the thin `XmlFormatterTool` (no sort-keys), registry registration (D-12), and the real-WKWebView e2e spec.

Purpose: Delivers FMT-05..07 + FMT-08 for XML, completing the phase's tool set. Reuses the shared `FormatterView` unchanged.
Output: `src/lib/format/xml.ts` (+test), `src/tools/xml-formatter/*`, an `xmlFormatterTool` entry appended to `TOOLS`, and `test/e2e/xml-formatter.e2e.ts`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/07-formatters/07-CONTEXT.md
@docs/superpowers/specs/2026-06-02-json-xml-formatters-design.md

# Patterns to mirror EXACTLY:
@src/tools/base64/Base64Tool.tsx
@src/tools/base64/index.ts
@src/lib/format/types.ts
@src/lib/tools/registry.ts
@src/lib/tools/types.ts

<interfaces>
<!-- From wave 1 (Plan 01) and wave 2 (Plan 02). Use directly — do not re-derive. -->
```typescript
// src/lib/format/types.ts
export type IndentMode = "2" | "4" | "tab";
export interface FormatOptions { indent: IndentMode; minify: boolean; sortKeys?: boolean; }
export type FormatResult =
  | { ok: true; output: string; inputBytes: number; outputBytes: number }
  | { ok: false; error: { message: string; line?: number; col?: number } };

// src/components/FormatterView.tsx (built in Plan 02) — render it WITHOUT onSortKeys (XML has no sort-keys, D-06)
interface FormatterViewProps {
  inputId: string; outputId: string;
  input: string; onInputChange: (raw: string) => void;
  output: string;
  controls: { indent: IndentMode; onIndent: (m: IndentMode) => void;
    minify: boolean; onMinify: (v: boolean) => void;
    sortKeys?: boolean; onSortKeys?: (v: boolean) => void; };  // OMIT sortKeys/onSortKeys for XML
  status: { parseState: "ok"|"error"|"empty"; byteCount: number; outputBytes?: number; error?: string|null; timingMs?: number };
}

// native DOMParser is available in BOTH the WKWebView and the jsdom test env.
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Pure formatXml transform + tests (FMT-05..07)</name>
  <files>src/lib/format/xml.ts, src/lib/format/xml.test.ts</files>
  <read_first>
    - src/lib/format/types.ts (FormatResult / FormatOptions / IndentMode — import, do not redefine)
    - src/lib/format/json.ts (the sibling pure-formatter built in Plan 02 — mirror its structure: empty-ok, byte counts via TextEncoder, FormatResult return)
    - docs/superpowers/specs/2026-06-02-json-xml-formatters-design.md (XML formatter behavior, lines ~105-113; FMT-06 preservation list)
    - .planning/phases/07-formatters/07-CONTEXT.md (D-08 error clears output, D-09 parsererror surfacing, D-11 prettify preserves comments/CDATA/attrs/PIs, minify strips inter-element whitespace, well-formedness only)
  </read_first>
  <behavior>
    - Test 1 (prettify, default indent "2"): `formatXml('<a><b>1</b><c/></a>', { indent:"2", minify:false })` → ok:true, output has each element on its own indented line using 2 spaces; `<c/>` stays self-closing; round-trips well-formed.
    - Test 2 (indent 4 / tab): `indent:"4"` uses 4 spaces; `indent:"tab"` uses a literal "\t" per depth level.
    - Test 3 (preserve comments + CDATA + PIs + attributes, FMT-06): `formatXml('<r x="1"><!--note--><![CDATA[a<b]]><?pi data?></r>', {indent:"2",minify:false})` → output STILL contains `<!--note-->`, `<![CDATA[a<b]]>`, `<?pi data?>`, and the `x="1"` attribute (none dropped or escaped away).
    - Test 4 (minify, FMT-07): `formatXml('<a>\n  <b>1</b>\n</a>', { indent:"2", minify:true })` → output has NO inter-element whitespace/newlines between tags (e.g. `<a><b>1</b></a>`); significant text inside `<b>` is preserved.
    - Test 5 (invalid → parsererror surfaced, FMT-05): `formatXml('<a><b></a>', {indent:"2",minify:false})` → ok:false, `error.message` is the parsererror text (non-empty); `error.line` is a number when the engine provides one, else undefined.
    - Test 6 (empty input): `formatXml('', ...)` and whitespace-only → ok:true, `output:""`, `inputBytes:0`, `outputBytes:0` (empty is NOT an error).
  </behavior>
  <action>
    Create `src/lib/format/xml.ts` exporting `export function formatXml(input: string, opts: FormatOptions): FormatResult` — pure, importing only `FormatResult`/`FormatOptions`/`IndentMode` from `./types` and using native `DOMParser`/DOM serialization only (zero deps; `opts.sortKeys` is ignored — XML never sorts).
    Implementation:
    - Empty/whitespace-only input → `{ ok:true, output:"", inputBytes:0, outputBytes:0 }`.
    - `const doc = new DOMParser().parseFromString(input, "application/xml")`. Detect a parse error by querying for a `<parsererror>` element: `doc.querySelector("parsererror")`. If present, extract its text (`parsererror.textContent`), pull a line number from the message when present (WebKit/jsdom include "line N" patterns — parse an integer after "line " if found, else undefined). Return `{ ok:false, error:{ message, line? } }`.
    - On success, serialize: walk the document recursively and re-emit. Preserve node types: ELEMENT (with all attributes in source order, self-close empty elements), TEXT (trim/collapse insignificant whitespace-only text nodes between elements when prettifying; KEEP significant text), COMMENT (`<!--...-->`), CDATA (`<![CDATA[...]]>`), PROCESSING_INSTRUCTION (`<?target data?>`). Use `XMLSerializer` for individual node serialization where convenient, but control indentation yourself by recursing depth-first and prefixing each emitted node with `indentUnit.repeat(depth)` and a newline (prettify) — for MINIFY, emit with NO inter-node whitespace and no added newlines (strip whitespace-only text nodes; FMT-07). indentUnit = `opts.indent === "tab" ? "\t" : " ".repeat(Number(opts.indent))`.
    - Preserve the XML declaration / PIs at document top if present.
    - Compute `inputBytes`/`outputBytes` via `new TextEncoder().encode(s).length`. No trailing newline appended (or a single one — keep tests aligned; prefer none for parity with json.ts).
    Create `src/lib/format/xml.test.ts` (jsdom has DOMParser/XMLSerializer) covering all six behaviors with concrete inputs/outputs.
    NOTE on XXE safety (security): `DOMParser` with `"application/xml"` in the browser/WKWebView and jsdom does NOT resolve external entities or fetch DTDs — no network, no entity expansion. Do not add any option that would enable external entity loading; do not pass the input to any other XML engine.
  </action>
  <verify>
    <automated>pnpm vitest run src/lib/format/xml.test.ts && pnpm tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `src/lib/format/xml.ts` exports `formatXml` (grep: `export function formatXml`).
    - Uses native `DOMParser` and detects `parsererror` (grep: `DOMParser`, `parsererror`); no new package import (grep: no `fast-xml-parser`, no `xmldom`, no `prettier`).
    - `pnpm vitest run src/lib/format/xml.test.ts` exits 0 with all six behavior groups green — including the preservation test asserting `<!--`, `CDATA`, `<?`, and the attribute survive prettify, and the minify test asserting no inter-element whitespace.
    - Test asserts an invalid XML returns `ok:false` with a non-empty `error.message` (grep test for `parsererror` / `ok).toBe(false`).
    - No code path enables external entity / DTD resolution (grep: no `XMLHttpRequest`, no `fetch`, no `resolveExternalEntities`).
    - `pnpm tsc --noEmit` exits 0.
  </acceptance_criteria>
  <done>formatXml validates well-formedness via DOMParser, surfaces parsererror (with line when available), prettifies preserving comments/CDATA/attrs/PIs, minifies inter-element whitespace, treats empty as ok-empty, is pure + zero-dep + XXE-safe, fully unit-tested.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: XmlFormatterTool + registry registration + e2e (FMT-05..08, D-12)</name>
  <files>src/tools/xml-formatter/index.ts, src/tools/xml-formatter/XmlFormatterTool.tsx, src/tools/xml-formatter/XmlFormatterTool.test.tsx, src/lib/tools/registry.ts, test/e2e/xml-formatter.e2e.ts</files>
  <read_first>
    - src/tools/json-formatter/JsonFormatterTool.tsx (the sibling tool from Plan 02 — mirror it, but DROP sort-keys)
    - src/tools/base64/index.ts (ToolDefinition shape)
    - src/components/FormatterView.tsx (the view to render WITHOUT onSortKeys)
    - src/lib/format/xml.ts (formatXml — from Task 1)
    - src/lib/tools/registry.ts (now contains jsonFormatterTool from Plan 02 — append xmlFormatterTool, +1 import +1 entry; do NOT remove the json entry)
    - test/e2e/json-formatter.e2e.ts (the sibling e2e from Plan 02 to mirror for selectors/structure)
  </read_first>
  <behavior>
    - Test 1 (paste-instant prettify): setting input to `'<a><b>1</b></a>'` derives an indented multi-line output; parseState "ok".
    - Test 2 (invalid clears + errors): input `'<a><b></a>'` → output empty AND StatusBar shows the parsererror message; parseState "error".
    - Test 3 (empty status): input `''` → output empty, parseState "empty", no error.
    - Test 4 (toggles): indent "4" re-derives with 4-space indent; minify ON collapses to no inter-element whitespace.
    - Test 5 (no sort-keys control): the rendered toolbar has NO sort-keys toggle (XML omits `onSortKeys`).
    - Test 6 (copy + registry): output copy button calls `platform.clipboard.writeText`; `xmlFormatterTool` is exported and present in `TOOLS`; `getToolById("xml-formatter")` returns it.
  </behavior>
  <action>
    Create `src/tools/xml-formatter/XmlFormatterTool.tsx` — thin, mirroring `JsonFormatterTool` but WITHOUT sort-keys. Owns `input` state + options (`indent: IndentMode = "2"`, `minify = false`). On every change, synchronously call `formatXml(input, { indent, minify })` (no debounce, D-07) inside the same `timed()` timing wrapper pattern. Derive: ok → `output`, `outputBytes`, `byteCount=inputBytes`, `parseState = input.trim()===""?"empty":"ok"`, `error=null`; not-ok → `output=""` (CLEAR, D-08), `error = result.error.line ? \`line ${result.error.line}: ${result.error.message}\` : result.error.message`, `parseState="error"`, `byteCount=byteLen(input)`. Render `<FormatterView inputId="xml-input" outputId="xml-output" ... controls={{ indent, onIndent:setIndent, minify, onMinify:setMinify }} status={{...}} />` — DO NOT pass `sortKeys`/`onSortKeys` (so the toggle is absent, D-06).
    Create `src/tools/xml-formatter/index.ts` exporting `xmlFormatterTool: ToolDefinition` with `id:"xml-formatter"`, `name:"XML"`, `description:"XML validate / prettify / minify"`, `category:"formatting"`, `keywords:["xml","format","prettify","minify","validate"]`, a lucide icon (e.g. `Code` or `FileCode`), `component: XmlFormatterTool`, `enabled:true`.
    Edit `src/lib/tools/registry.ts`: add `import { xmlFormatterTool } from "@/tools/xml-formatter";` and append `xmlFormatterTool` to `TOOLS` AFTER `jsonFormatterTool`. Keep the json import + entry intact. NOTHING else changes (D-12).
    Create `src/tools/xml-formatter/XmlFormatterTool.test.tsx` (jsdom, mock `@/lib/platform`) covering behaviors 1-6 (including asserting NO sort-keys control is rendered and the registry membership).
    Create `test/e2e/xml-formatter.e2e.ts` mirroring `test/e2e/json-formatter.e2e.ts`: navigate via `window.location.hash = "#/tools/xml-formatter"`, wait for `#xml-input`, set `'<a><b>1</b></a>'`, assert `#xml-output` value is the prettified multi-line form; set `'<a><b></a>'` and assert `#xml-output` clears and `footer[role=status]` shows an error; assert the output copy `<button aria-label="Copy output">` exists and is focusable. Screenshot → `test/e2e/__screenshots__/xml-formatter-wkwebview.png`. (Validates the native DOMParser path on the real WKWebView.)
  </action>
  <verify>
    <automated>pnpm vitest run src/tools/xml-formatter && pnpm tsc --noEmit && grep -q "xmlFormatterTool" src/lib/tools/registry.ts && grep -q "jsonFormatterTool" src/lib/tools/registry.ts</automated>
  </verify>
  <acceptance_criteria>
    - `src/tools/xml-formatter/index.ts` exports `xmlFormatterTool` with `id: "xml-formatter"` and `category: "formatting"` (grep both).
    - `src/lib/tools/registry.ts` imports + includes BOTH `jsonFormatterTool` and `xmlFormatterTool` in `TOOLS` (grep both still present — XML append did not remove JSON).
    - `XmlFormatterTool.tsx` calls `formatXml` and renders `FormatterView` (grep both) and does NOT pass `onSortKeys` (grep: no `onSortKeys` in the file).
    - On not-ok the tool sets output to "" (grep: clear-on-error path).
    - `test/e2e/xml-formatter.e2e.ts` exists and references `#xml-input`, `#xml-output`, and `footer[role=status]` (grep all three).
    - `pnpm vitest run src/tools/xml-formatter` exits 0; `pnpm tsc --noEmit` exits 0.
    - Decoder bar intact: `pnpm vitest run src/lib/protobuf/decoder.test.ts` still exits 0 (19 tests).
  </acceptance_criteria>
  <done>XmlFormatterTool delivers paste-instant well-formedness validate/prettify/minify with parsererror surfacing + visible copy and NO sort-keys, registered registry-only alongside JSON, with jsdom + real-WKWebView e2e coverage; decoder bar green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| pasted text → DOMParser | Untrusted user-pasted string crosses into `new DOMParser().parseFromString(input, "application/xml")`. Output is plain text rendered to a read-only region and copied via the platform seam. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-07-08 | Information disclosure (XXE) | `DOMParser.parseFromString(..., "application/xml")` | mitigate | Browser/WKWebView and jsdom `DOMParser` do NOT resolve external entities or fetch external DTDs — there is no XXE path. Mitigation is enforced by NOT using any other XML engine and NOT enabling external-entity options; acceptance grep asserts no `XMLHttpRequest`/`fetch`/external-entity code in `xml.ts`. No file or network access is reachable from the parse. |
| T-07-09 | Denial of service (billion-laughs / entity expansion) | XML entity expansion | mitigate | The browser `DOMParser` does not expand external/general entity bombs from inline DTDs the way a server parser would; internal predefined entities only. Combined with small inputs (D-07) and synchronous degrade-to-error, there is no unbounded-expansion hang. Accepted residual: a pathologically large literal document is bounded by clipboard size and parses in linear time. |
| T-07-10 | Injection / Tampering | Output rendered to the output pane | mitigate | Serialized XML is written to a read-only `<textarea>`/`<pre>` as a text node via `FormatterView` — NO `dangerouslySetInnerHTML`, no HTML interpretation (D-03). Re-uses Plan 02's injection-safe output path. |
| T-07-11 | Denial of service | Synchronous serialize of deeply-nested DOM (no debounce, D-07) | accept | Inputs small per D-07; recursion depth bounded by realistic clipboard payloads; degrades to a slow-but-finite derive, never a hang on realistic input. |
</threat_model>

<verification>
- `pnpm vitest run` passes (xml.ts, XmlFormatterTool, plus untouched suites incl. 19 decoder tests).
- `pnpm tsc --noEmit` clean; `pnpm eslint .` clean for changed files.
- No new package.json dependency (`git diff package.json` shows no dependency additions).
- `test/e2e/xml-formatter.e2e.ts` runs green on the real WKWebView via `scripts/e2e-spike.sh` (paste → prettify, invalid → clear+error, focusable copy) — proving the native DOMParser path.
- Both json-formatter and xml-formatter appear in the sidebar + ⌘K palette from the single registry array.
</verification>

<success_criteria>
- Pasting XML validates well-formedness instantly via DOMParser; a parsererror surfaces its message (with line when provided) and clears output (FMT-05).
- Prettify re-emits with selectable indent 2/4/tab preserving comments, CDATA, attributes, and PIs (FMT-06); minify strips insignificant inter-element whitespace (FMT-07).
- Output pane has a visible, keyboard-focusable copy control via the platform seam (FMT-08); no sort-keys control (XML).
- Registered registry-only alongside JSON (D-12); XXE/billion-laughs not exposed (native DOMParser, no external entities); decoder's 19 tests green; zero new deps.
</success_criteria>

<output>
After completion, create `.planning/phases/07-formatters/07-03-SUMMARY.md`.
</output>
