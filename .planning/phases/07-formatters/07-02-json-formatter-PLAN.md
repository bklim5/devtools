---
phase: 07-formatters
plan: 02
type: execute
wave: 2
depends_on: [01]
files_modified:
  - src/lib/format/json.ts
  - src/lib/format/json.test.ts
  - src/components/FormatterView.tsx
  - src/components/FormatterView.test.tsx
  - src/tools/json-formatter/index.ts
  - src/tools/json-formatter/JsonFormatterTool.tsx
  - src/tools/json-formatter/JsonFormatterTool.test.tsx
  - src/lib/tools/registry.ts
  - test/e2e/json-formatter.e2e.ts
autonomous: true
requirements: [FMT-01, FMT-02, FMT-03, FMT-04, FMT-08]
must_haves:
  truths:
    - "User can paste JSON and see it prettified instantly with no format button"
    - "Invalid JSON clears the output pane and surfaces the error as line:col + message in the status bar"
    - "Empty input shows status 'empty' (not an error)"
    - "User can select indent 2 / 4 / tab (default 2) and the output re-derives live"
    - "User can toggle minify to compress to a single line (minify wins over prettify)"
    - "User can toggle sort-keys to recursively sort object keys with array order preserved"
    - "The output pane has a visible, keyboard-focusable copy control reachable in <=1 keystroke, copying via the platform clipboard seam"
    - "json-formatter appears in sidebar, palette, and router solely by appending to the TOOLS array"
  artifacts:
    - path: "src/lib/format/json.ts"
      provides: "Pure formatJson(input, opts) -> FormatResult"
      exports: ["formatJson"]
    - path: "src/components/FormatterView.tsx"
      provides: "Shared presentational 2-pane + toolbar + StatusBar"
      exports: ["FormatterView"]
    - path: "src/tools/json-formatter/index.ts"
      provides: "jsonFormatterTool ToolDefinition"
      exports: ["jsonFormatterTool"]
    - path: "src/lib/tools/registry.ts"
      provides: "jsonFormatterTool appended to TOOLS"
      contains: "jsonFormatterTool"
  key_links:
    - from: "src/tools/json-formatter/JsonFormatterTool.tsx"
      to: "src/lib/format/json.ts"
      via: "formatJson call on input change"
      pattern: "formatJson"
    - from: "src/tools/json-formatter/JsonFormatterTool.tsx"
      to: "src/components/FormatterView.tsx"
      via: "renders FormatterView with derived output + toolbar config"
      pattern: "FormatterView"
    - from: "src/components/FormatterView.tsx"
      to: "src/lib/platform"
      via: "copy button -> platform.clipboard.writeText"
      pattern: "platform.clipboard.writeText"
    - from: "src/lib/tools/registry.ts"
      to: "src/tools/json-formatter"
      via: "TOOLS array entry"
      pattern: "jsonFormatterTool"
---

<objective>
Ship the JSON formatter end-to-end: the pure `formatJson` transform (validate with line:col errors, prettify 2/4/tab, minify, recursive sort-keys), the shared presentational `FormatterView` (resizable two-pane + shared toolbar + read-only copy-bearing output + StatusBar byte delta), the thin `JsonFormatterTool`, registry registration (D-12), and the real-WKWebView e2e spec.

Purpose: Delivers FMT-01..04 + FMT-08 for JSON and creates the shared `FormatterView` the XML plan (wave 3) consumes — so it must be JSON/XML-agnostic.
Output: `src/lib/format/json.ts` (+test), `src/components/FormatterView.tsx` (+test), `src/tools/json-formatter/*`, a `jsonFormatterTool` entry in `TOOLS`, and `test/e2e/json-formatter.e2e.ts`.
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
@src/components/StatusBar.tsx
@src/components/ResizableSplit.tsx
@src/shell/useCopyFeedback.ts
@src/lib/format/types.ts
@src/lib/tools/registry.ts
@src/lib/tools/types.ts

<interfaces>
<!-- From wave 1 (Plan 01). Use these directly — do not re-derive. -->
```typescript
// src/lib/format/types.ts
export type IndentMode = "2" | "4" | "tab";
export interface FormatOptions { indent: IndentMode; minify: boolean; sortKeys?: boolean; }
export type FormatResult =
  | { ok: true; output: string; inputBytes: number; outputBytes: number }
  | { ok: false; error: { message: string; line?: number; col?: number } };

// src/components/StatusBar.tsx (extended in Plan 01)
export interface StatusBarProps {
  parseState: "ok" | "error" | "empty";
  byteCount: number;
  outputBytes?: number;   // renders input->output delta when provided
  encoding?: string;
  error?: string | null;
  timingMs?: number;
}

// src/components/ResizableSplit.tsx (promoted in Plan 01)
export function ResizableSplit(p: { left: React.ReactNode; right: React.ReactNode; initial?: number; min?: number }): JSX.Element;

// src/shell/useCopyFeedback.ts
export function useCopyFeedback(durationMs?: number): [boolean, () => void];

// src/lib/platform (clipboard seam — never import @tauri-apps/* directly)
platform.clipboard.writeText(text: string): Promise<void>;

// src/lib/tools/types.ts -> ToolDefinition { id, name, description, category, keywords, icon, component, enabled? }
// "formatting" already exists in ToolCategory.
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Pure formatJson transform + tests (FMT-01..04)</name>
  <files>src/lib/format/json.ts, src/lib/format/json.test.ts</files>
  <read_first>
    - src/lib/format/types.ts (FormatResult / FormatOptions / IndentMode — import, do not redefine)
    - src/lib/protobuf/decoder.ts (reference for a pure src/lib module style; do NOT modify it)
    - docs/superpowers/specs/2026-06-02-json-xml-formatters-design.md (JSON formatter behavior, lines ~96-104)
    - .planning/phases/07-formatters/07-CONTEXT.md (D-08 error convention, D-09 line:col mapping, D-10 sort-keys)
  </read_first>
  <behavior>
    - Test 1 (prettify, default indent "2"): `formatJson('{"b":1,"a":2}', { indent:"2", minify:false })` → ok:true, output is `JSON.stringify(parsed, null, 2)`, ends with no trailing newline, `inputBytes` = byte length of input, `outputBytes` = byte length of output.
    - Test 2 (indent "4" and "tab"): same input with `indent:"4"` uses 4 spaces; `indent:"tab"` uses a literal tab ("\t") as the indent unit.
    - Test 3 (minify wins): `{ indent:"2", minify:true }` → output equals `JSON.stringify(parsed)` (single line, no spaces), regardless of indent.
    - Test 4 (sort-keys recursive, arrays preserved): `formatJson('{"b":1,"a":{"d":1,"c":2}}', { indent:"2", minify:false, sortKeys:true })` → keys sorted at every object level (`a` before `b`, `c` before `d`); for `'{"z":[3,1,2]}'` the array stays `[3,1,2]` (order preserved).
    - Test 5 (invalid → line:col): `formatJson('{"a": }', { indent:"2", minify:false })` → ok:false, `error.message` non-empty, `error.line` and `error.col` are numbers >= 1 computed from the parse error's char offset over the input.
    - Test 6 (empty input): `formatJson('', { indent:"2", minify:false })` → ok:true with `output:""`, `inputBytes:0`, `outputBytes:0` (empty is NOT an error — the tool maps this to status "empty"). Also `'   '` (whitespace only) → same empty-ok result.
  </behavior>
  <action>
    Create `src/lib/format/json.ts` exporting `export function formatJson(input: string, opts: FormatOptions): FormatResult` — pure, importing only `FormatResult`/`FormatOptions`/`IndentMode` from `./types` and using native `JSON` only (zero deps).
    Implementation:
    - Empty/whitespace-only input → return `{ ok:true, output:"", inputBytes:0, outputBytes:0 }`.
    - `const parsed = JSON.parse(input)` inside try/catch. On throw, compute line:col: most engines put a character position in the SyntaxError message (e.g. "position 7" / "in JSON at position 7") — parse that integer offset, then count newlines up to it for `line` and the offset within the current line for `col` (both 1-based). If no position is parseable, return `line`/`col` undefined and just the message. Return `{ ok:false, error:{ message, line?, col? } }`.
    - Apply sort-keys BEFORE stringify when `opts.sortKeys`: a recursive function that, for plain objects, rebuilds with `Object.keys(obj).sort()` order and recurses into values; for arrays, maps over elements recursively WITHOUT reordering (D-10); primitives pass through.
    - indentUnit = `opts.indent === "tab" ? "\t" : Number(opts.indent)` (so `2`→2, `4`→4, `"tab"`→"\t"). When `opts.minify` → `JSON.stringify(value)`; else `JSON.stringify(value, null, indentUnit)`.
    - Compute `inputBytes`/`outputBytes` via `new TextEncoder().encode(s).length`.
    Use a small local byte-length helper if it reads cleaner. No trailing newline appended.
    Create `src/lib/format/json.test.ts` covering all six behaviors above with concrete inputs/outputs.
  </action>
  <verify>
    <automated>pnpm vitest run src/lib/format/json.test.ts && pnpm tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `src/lib/format/json.ts` exports `formatJson` (grep: `export function formatJson`).
    - File imports from `./types` and uses native `JSON` only — no new package import (grep: no `from "` lines referencing a node_module that isn't already a dependency; specifically no `sort-keys`, no `jsonlint`).
    - `pnpm vitest run src/lib/format/json.test.ts` exits 0 with all six behavior groups green (prettify 2/4/tab, minify-wins, recursive sort with array preserved, line:col error, empty-ok).
    - Test asserts `error.line` and `error.col` are numbers for an invalid input (grep test for `.line` / `.col`).
    - `pnpm tsc --noEmit` exits 0.
  </acceptance_criteria>
  <done>formatJson validates/prettifies/minifies/sorts strict JSON, maps parse errors to line:col, treats empty as ok-empty, is pure + zero-dep, fully unit-tested.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Shared FormatterView (resizable 2-pane + toolbar + copy + StatusBar)</name>
  <files>src/components/FormatterView.tsx, src/components/FormatterView.test.tsx</files>
  <read_first>
    - src/tools/base64/Base64Tool.tsx (Pane/copy/StatusBar wiring, `timed()` status-timing wrapper, focus-ring + CSS-var token classes to mirror)
    - src/components/ResizableSplit.tsx (the split to render input|output, promoted in Plan 01)
    - src/components/StatusBar.tsx (extended props: parseState, byteCount, outputBytes, error, timingMs)
    - src/shell/useCopyFeedback.ts (copy confirmation hook)
    - .planning/phases/07-formatters/07-CONTEXT.md (D-01 resizable side-by-side + responsive-stack narrow; D-03 read-only output + visible copy; D-06 shared toolbar; D-08 error clears output)
  </read_first>
  <behavior>
    - Test 1 (two panes render): renders an editable input region and a read-only output region; typing in input fires `onInputChange` with the raw string.
    - Test 2 (read-only output): the output region has `readOnly` (or is a non-editable element) and displays the `output` prop verbatim.
    - Test 3 (toolbar controls render conditionally): given `controls={{ indent, onIndent, minify, onMinify, sortKeys?, onSortKeys? }}`, indent group (2/4/tab) + minify toggle render always; the sort-keys toggle renders only when `onSortKeys` is provided (JSON), and is absent when omitted (XML).
    - Test 4 (copy): the output pane has a visible `<button aria-label="Copy …">`; clicking it calls `platform.clipboard.writeText` with the current `output`. (Mock the platform seam.)
    - Test 5 (StatusBar wired): passes `parseState`, `byteCount`, `outputBytes`, `error`, `timingMs` through to StatusBar; on error the output region shows empty/cleared text (the tool passes `output:""`).
    - Test 6 (selected accent): the active indent option and an ON minify/sort toggle carry the accent classes (`aria-pressed="true"`), inactive ones do not (accent = selected only).
  </behavior>
  <action>
    Create `src/components/FormatterView.tsx` — presentational only, JSON/XML-agnostic. Props:
    ```ts
    interface FormatterViewProps {
      inputId: string;                 // stable id for the input textarea (e2e selector)
      outputId: string;                // stable id for the output region (e2e selector)
      input: string;
      onInputChange: (raw: string) => void;
      output: string;                  // "" when error/empty (tool clears it)
      controls: {
        indent: IndentMode; onIndent: (m: IndentMode) => void;
        minify: boolean; onMinify: (v: boolean) => void;
        sortKeys?: boolean; onSortKeys?: (v: boolean) => void;  // present = JSON
      };
      status: { parseState: ParseState; byteCount: number; outputBytes?: number; error?: string | null; timingMs?: number };
    }
    ```
    Layout: a single shared top toolbar (indent segmented group `2`/`4`/`tab`, a minify toggle, a sort-keys toggle rendered ONLY when `controls.onSortKeys` is defined, and the output copy button), then a `<ResizableSplit left={inputPane} right={outputPane} />`. The container is layout-agnostic: no fixed widths; on narrow widths it must responsive-stack vertically — wrap the split in a flex column and apply Tailwind responsive classes (e.g. stack the panes via `flex-col` under a breakpoint) consistent with UX-05. Then the `<StatusBar {...status} />` footer.
    Input pane: an editable `<textarea id={inputId}>` mirroring Base64Tool's textarea classes (font-mono, `focus-visible:ring-accent`, CSS-var tokens `bg-input-bg`/`border-bd`/`text-tx`), `spellCheck={false}` etc., firing `onInputChange(e.target.value)`.
    Output pane: a READ-ONLY region `id={outputId}` (a `<textarea readOnly>` or `<pre>` — prefer `<textarea readOnly>` for selection + a stable `.getValue()` e2e hook) showing `output` as plain monospace text. NO `dangerouslySetInnerHTML`, NO syntax highlighting (D-03). It carries the visible, focusable copy `<button type="button" aria-label="Copy output">` using `useCopyFeedback` and `platform.clipboard.writeText(output)` (copy reachable in <=1 keystroke — it is a real focusable button, no hover gate; FMT-08).
    Toolbar toggle/segment styling: copy Base64Tool's `AlphabetToggle` pattern (`aria-pressed`, accent-soft/accent-line when active, transparent border + text-tx-2 when inactive, `focus-visible:ring-accent`). Indent options labeled "2", "4", "tab".
    Create `src/components/FormatterView.test.tsx` (jsdom + @testing-library/react, mock `@/lib/platform`) covering the six behaviors.
  </action>
  <verify>
    <automated>pnpm vitest run src/components/FormatterView.test.tsx && pnpm tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `src/components/FormatterView.tsx` exports `FormatterView` (grep: `export function FormatterView` or `export default function FormatterView`).
    - It renders `<ResizableSplit` (grep) and `<StatusBar` (grep) and imports them from `@/components/...`.
    - Output copy path: grep shows `platform.clipboard.writeText` and `useCopyFeedback`.
    - Sort-keys toggle is conditional: grep shows it gated on `onSortKeys` (e.g. `controls.onSortKeys &&` or `props.controls.onSortKeys`).
    - No `dangerouslySetInnerHTML` anywhere in the file (grep returns nothing).
    - The output region is read-only (grep: `readOnly`).
    - `pnpm vitest run src/components/FormatterView.test.tsx` exits 0 with all six behaviors; `pnpm tsc --noEmit` exits 0.
  </acceptance_criteria>
  <done>FormatterView is a JSON/XML-agnostic presentational shell: resizable input|output, read-only copy-bearing output, conditional sort-keys, StatusBar byte-delta wired, accent-on-selected toolbar, no HTML injection.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: JsonFormatterTool + registry registration + e2e (FMT-01..04, FMT-08, D-12)</name>
  <files>src/tools/json-formatter/index.ts, src/tools/json-formatter/JsonFormatterTool.tsx, src/tools/json-formatter/JsonFormatterTool.test.tsx, src/lib/tools/registry.ts, test/e2e/json-formatter.e2e.ts</files>
  <read_first>
    - src/tools/base64/Base64Tool.tsx (state + `timed()` wrapper + parseState derivation to mirror)
    - src/tools/base64/index.ts (ToolDefinition shape to mirror for index.ts)
    - src/components/FormatterView.tsx (the view this tool renders — from Task 2)
    - src/lib/format/json.ts (formatJson — from Task 1)
    - src/lib/tools/registry.ts (the TOOLS array — append only, +1 import +1 entry)
    - test/e2e/base64.e2e.ts (the real-WKWebView e2e spec structure + HashRouter nav + selector style to mirror)
  </read_first>
  <behavior>
    - Test 1 (paste-instant prettify): rendering the tool and setting input to `'{"b":1,"a":2}'` derives a prettified output (contains newlines + 2-space indent) with NO format button; status parseState "ok".
    - Test 2 (invalid clears + errors): input `'{"a": }'` → output region empty AND StatusBar error shows a line:col message; parseState "error".
    - Test 3 (empty status): input `''` → output empty, parseState "empty", no error text.
    - Test 4 (toggles drive output): switching indent to "4" re-derives with 4-space indent; turning minify ON collapses to a single line (minify wins over the indent); turning sort-keys ON reorders object keys.
    - Test 5 (copy): the output copy button calls `platform.clipboard.writeText` with the derived output (mock platform).
    - Test 6 (registry): `jsonFormatterTool` is exported and present in `TOOLS`; `getToolById("json-formatter")` returns it.
  </behavior>
  <action>
    Create `src/tools/json-formatter/JsonFormatterTool.tsx` — thin, mirroring Base64Tool: owns `input` state + options state (`indent: IndentMode = "2"`, `minify = false`, `sortKeys = false`). On every input/option change, synchronously call `formatJson(input, { indent, minify, sortKeys })` (no debounce, D-07) inside a `timed()` wrapper (copy Base64Tool's `timed`/`timingMs` pattern). Derive: if `result.ok` → `output = result.output`, `outputBytes = result.outputBytes`, `byteCount = result.inputBytes`, `parseState = input.trim()===""?"empty":"ok"`, `error = null`; if `!result.ok` → `output = ""` (CLEAR per D-08), `error = result.error.line ? \`${result.error.line}:${result.error.col} ${result.error.message}\` : result.error.message`, `parseState = "error"`, `byteCount = byteLen(input)`, `outputBytes` omitted. Render `<FormatterView inputId="json-input" outputId="json-output" ... controls={{ indent, onIndent:setIndent, minify, onMinify:setMinify, sortKeys, onSortKeys:setSortKeys }} status={{...}} />`. Sort-keys IS passed (JSON enables it, D-06).
    Create `src/tools/json-formatter/index.ts` exporting `jsonFormatterTool: ToolDefinition` with `id:"json-formatter"`, `name:"JSON"`, `description:"JSON validate / prettify / minify / sort keys"`, `category:"formatting"`, `keywords:["json","format","prettify","minify","validate","lint","sort"]`, a lucide icon (e.g. `Braces`), `component: JsonFormatterTool`, `enabled:true`. Mirror base64/index.ts exactly.
    Edit `src/lib/tools/registry.ts`: add `import { jsonFormatterTool } from "@/tools/json-formatter";` and append `jsonFormatterTool` to the `TOOLS` array. NOTHING else changes (sidebar/palette/router auto-derive, D-12).
    Create `src/tools/json-formatter/JsonFormatterTool.test.tsx` (jsdom, mock `@/lib/platform`) covering behaviors 1-5; add a tiny registry assertion (behavior 6) either here or in the tool test importing `TOOLS`/`getToolById`.
    Create `test/e2e/json-formatter.e2e.ts` mirroring `test/e2e/base64.e2e.ts`: navigate via `window.location.hash = "#/tools/json-formatter"`, wait for `#json-input`, set `'{"b":1,"a":2}'`, assert `#json-output` value contains the prettified 2-space form; set an invalid value and assert `#json-output` clears and the `footer[role=status]` shows an error; assert the output copy `<button aria-label="Copy output">` exists and is focusable. Write the screenshot to `test/e2e/__screenshots__/json-formatter-wkwebview.png`.
  </action>
  <verify>
    <automated>pnpm vitest run src/tools/json-formatter && pnpm tsc --noEmit && grep -q "jsonFormatterTool" src/lib/tools/registry.ts</automated>
  </verify>
  <acceptance_criteria>
    - `src/tools/json-formatter/index.ts` exports `jsonFormatterTool` with `id: "json-formatter"` and `category: "formatting"` (grep both).
    - `src/lib/tools/registry.ts` imports and includes `jsonFormatterTool` in the `TOOLS` array (grep: import line + array membership); NO other files changed for wiring (sidebar/router/palette untouched).
    - `JsonFormatterTool.tsx` calls `formatJson` and renders `FormatterView` (grep both) and passes `onSortKeys` (grep).
    - On `!result.ok` the tool sets output to "" (grep: clear-on-error path).
    - `test/e2e/json-formatter.e2e.ts` exists and references `#json-input`, `#json-output`, and `footer[role=status]` (grep all three).
    - `pnpm vitest run src/tools/json-formatter` exits 0; `pnpm tsc --noEmit` exits 0.
    - Decoder bar intact: `pnpm vitest run src/lib/protobuf/decoder.test.ts` still exits 0 (19 tests).
  </acceptance_criteria>
  <done>JsonFormatterTool delivers paste-instant validate/prettify/minify/sort with line:col errors + visible copy, registered registry-only, with jsdom + real-WKWebView e2e coverage; decoder bar green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| pasted text → formatJson | Untrusted user-pasted string crosses into `JSON.parse`. Output is plain text rendered into a read-only region and copied via the platform seam. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-07-04 | Denial of service | `JSON.parse` on large/deeply-nested input (synchronous, no debounce per D-07) | accept | Inputs are small per D-07; native `JSON.parse` has no catastrophic-backtracking class (it's a linear scanner) and throws `RangeError` only on pathological nesting, which the try/catch maps to an error result — the UI degrades gracefully, never hangs the app indefinitely on realistic clipboard payloads. No regex used in JSON path. |
| T-07-05 | Injection / Tampering | Output rendered to the output pane | mitigate | Output is written to a read-only `<textarea>`/`<pre>` as a text node — NO `dangerouslySetInnerHTML`, no syntax highlighting (D-03). Acceptance criteria grep asserts no `dangerouslySetInnerHTML`. Even malicious JSON string content cannot become live HTML. |
| T-07-06 | Information disclosure | Clipboard write | accept | Copy goes through `platform.clipboard.writeText` (the seam), only on explicit user action (button click/keypress). No network at runtime; nothing leaves the device. |
| T-07-07 | Tampering | Error-message line:col parsing from SyntaxError text | accept | We only read an integer offset from the engine's message and compute line/col over the user's own input; no eval, no reflection. Worst case: line/col undefined (message-only). Low/info. |
</threat_model>

<verification>
- `pnpm vitest run` passes (json.ts, FormatterView, JsonFormatterTool, plus untouched suites incl. 19 decoder tests).
- `pnpm tsc --noEmit` clean; `pnpm eslint .` clean for changed files.
- No new entry in package.json dependencies (zero-dep: `git diff package.json` shows no dependency additions).
- `test/e2e/json-formatter.e2e.ts` runs green on the real WKWebView via `scripts/e2e-spike.sh` (paste → prettify, invalid → clear+error, focusable copy).
- json-formatter shows in the sidebar + ⌘K palette by virtue of the single registry append.
</verification>

<success_criteria>
- Pasting JSON prettifies instantly with no button; invalid JSON clears output and shows line:col + message; empty shows "empty" (FMT-01).
- Indent 2/4/tab selectable, default 2 (FMT-02); minify collapses to one line and wins over prettify (FMT-03); sort-keys recursively sorts objects, arrays preserved (FMT-04).
- Output pane has a visible, keyboard-focusable copy control copying via the platform seam (FMT-08).
- Registered registry-only (D-12); FormatterView is JSON/XML-agnostic and ready for the XML plan; decoder's 19 tests green; zero new deps.
</success_criteria>

<output>
After completion, create `.planning/phases/07-formatters/07-02-SUMMARY.md`.
</output>
