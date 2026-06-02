# Design: JSON + XML Formatters

*Date: 2026-06-02 · Status: approved (pre-implementation) · Milestone: v1.1 (Formatters)*

## Summary

Add two new tools to DevTools — a **JSON formatter** and an **XML formatter** — as the
first batch of post-v1.0 tools. Both are implemented **zero-runtime-dependency** using native
browser APIs (`JSON`, `DOMParser`). Each offers a jsonlint-style feature set (validate,
prettify, compress/minify, and — for JSON — sort keys) in a two-pane, paste-instant UI that
follows the existing tool patterns exactly.

SQL formatting is explicitly **out of scope** for this milestone (it needs the `sql-formatter`
library and can only reformat, not lint) — it remains parked in backlog `999.1`.

A small sibling cleanup ships in the same milestone: make the shared `StatusBar` byte-count
readout **opt-in** so it only appears on tools where input/output size is meaningful.

## Goals

- Two new tools (`json-formatter`, `xml-formatter`) under `category: "formatting"`.
- Full feature set, zero new runtime dependencies, fully offline.
- Paste-instant (<2s) two-pane interaction consistent with the existing `Base64` tool.
- WCAG-AA, keyboard-driven, layout-agnostic — same constraints as every DevTools tool.
- No changes to existing tools' behavior beyond the opt-in `StatusBar` byte-count change.
- The hero decoder (`src/lib/protobuf/decoder.ts`) and its 19 tests stay byte-for-byte untouched.

## Non-Goals (YAGNI)

- **SQL formatter** — deferred (backlog 999.1); would require `sql-formatter`.
- **JSON5 / JSONC** — strict JSON only for v1.1 (no comments, no trailing commas).
- **XML schema/XSD validation** — only *well-formedness* validation in v1.1.
- **JSON sort by value, or XML attribute/node sorting** — out of scope.
- No new dependencies of any kind.

## Architecture

Both tools follow the established DevTools pattern: a self-contained directory under
`src/tools/`, **pure transform logic isolated in `src/lib/`**, and registration by appending
to the `TOOLS` array in `src/lib/tools/registry.ts`. The router, sidebar, and command palette
auto-derive from the registry — no other wiring changes. `category: "formatting"` already
exists in the `ToolCategory` union.

```
src/lib/format/
  json.ts            # pure: formatJson(input, opts) → FormatResult
  json.test.ts
  xml.ts             # pure: formatXml(input, opts) → FormatResult
  xml.test.ts
src/components/
  FormatterView.tsx       # shared presentational 2-pane + toolbar + StatusBar
  FormatterView.test.tsx
src/tools/json-formatter/
  index.ts                # ToolDefinition
  JsonFormatterTool.tsx
  JsonFormatterTool.test.tsx
src/tools/xml-formatter/
  index.ts
  XmlFormatterTool.tsx
  XmlFormatterTool.test.tsx
test/e2e/json-formatter.e2e.ts
test/e2e/xml-formatter.e2e.ts
src/lib/tools/registry.ts  # +2 imports, +2 array entries
src/components/StatusBar.tsx  # byteCount prop becomes optional (cleanup)
```

### Units and boundaries

- **`src/lib/format/json.ts`** — pure, no React/DOM-of-the-app/platform. `formatJson(input, opts)`.
  Depends only on native `JSON`. Independently testable.
- **`src/lib/format/xml.ts`** — pure (uses native `DOMParser`, available in both WKWebView and
  jsdom). `formatXml(input, opts)`. Independently testable.
- **`FormatterView`** — presentational only. Renders input pane → output pane, a configurable
  toolbar, the output copy button, and the `StatusBar`. Knows nothing about JSON vs XML; the
  tool passes in the derived output, status, and which toolbar controls to show. Reuses existing
  `StatusBar`, `CopyButton`/`useCopyFeedback`, and the platform seam for clipboard.
- **`JsonFormatterTool` / `XmlFormatterTool`** — thin: own the input state + options, call the
  pure formatter on change, and render `FormatterView`. JSON enables the sort-keys control;
  XML does not.

## Tool behavior

### Shared interaction (approved)

Two-pane: **input** (left/top) → **output** (right/bottom). On every input change the tool
**auto-validates and auto-prettifies instantly** (paste-instant ethos). Toolbar controls
re-derive immediately. The output pane has a **visible, focusable** copy button (no hover-only).
The `StatusBar` shows parse state, input→output byte counts, and timing.

Toolbar:
- **Indent**: `2` / `4` / `tab` (default `2`).
- **Minify** toggle (mutually exclusive with prettify — minify wins when on).
- **Sort keys** toggle — **JSON only**.
- **Copy** (output).

### JSON formatter (`json-formatter`, zero-dep)

- **Validate** — `JSON.parse`. On failure, map the error to **line:col + message** for the
  status bar (compute line/col from the error's character position over the input).
- **Prettify** — `JSON.stringify(value, null, indent)`.
- **Compress/minify** — `JSON.stringify(value)`.
- **Sort keys** — recursive deterministic key sort applied before stringify (objects sorted;
  array order preserved).

### XML formatter (`xml-formatter`, zero-dep)

- **Validate** — `new DOMParser().parseFromString(input, "application/xml")`; detect a
  `<parsererror>` node and surface its message (with line if the engine provides one).
- **Prettify** — walk the parsed DOM and re-emit with indentation, **preserving comments,
  CDATA sections, attributes, and processing instructions**. Indent `2`/`4`/`tab`.
- **Compress/minify** — strip insignificant inter-element whitespace.
- No sort-keys (N/A for XML).

## Data flow & error handling

Pure formatters return a discriminated result:

```ts
type FormatResult =
  | { ok: true; output: string; inputBytes: number; outputBytes: number }
  | { ok: false; error: { message: string; line?: number; col?: number } };
```

The tool component owns only UX: synchronous derive on change (inputs are small; native APIs
are fast — no debounce needed for v1.1), and the existing Base64-style error convention —
**on error the output pane clears and the status bar shows the error** (with line:col when
available). **Empty input → empty output, status "empty"** (not an error).

`byteCount` for the `StatusBar` is **passed by the formatters** (so minify shows e.g.
`1,240 → 890 bytes`), but is **optional** at the `StatusBar` level (see cleanup below).

## Sibling cleanup: opt-in StatusBar byte count

`StatusBar`'s byte-count readout is noise on tools where input size is irrelevant. Make the
`byteCount` prop **optional** and render it only when provided. Then:

- **Keep byte/size readout:** Base64/Hex/Bytes, Protobuf decoder, and the new Formatters
  (for the minify size delta).
- **Drop it (status text only):** Hash/Checksum, UUID, Unix Time, JWT — anywhere input length
  isn't what the user came for.

This ships as its own small phase/plan in the v1.1 milestone (not folded into the formatter
tools), and goes through the normal harness gates. The decoder and its tests are untouched.

## Testing (binding harness)

- **Pure logic unit tests (TDD)** — `json.test.ts` / `xml.test.ts`: valid prettify/minify,
  JSON sort-keys, error cases with line:col, and XML comment/CDATA/attribute/PI preservation.
- **Component tests (jsdom — has both `JSON` and `DOMParser`)** — two-pane render, auto-format
  on change, toggles (indent/minify/sort), copy → `platform.clipboard.writeText`, error → status.
- **e2e per tool on the real WKWebView** — `test/e2e/json-formatter.e2e.ts`,
  `test/e2e/xml-formatter.e2e.ts` (validates the native `JSON`/`DOMParser` path).
- **StatusBar cleanup** — update affected tools' tests to assert byte count is absent where
  dropped and present where kept.
- Per-task DoD order: `/simplify` → `/codex:review` → `vitest` + `tsc` + `eslint` green →
  real-webview UI verification. **Decoder's 19 tests remain the immovable bar.**
- Phase boundary: human sign-off on a `tauri build` + a passing `gsd-ui-review` WCAG-AA audit.

## Rollout / GSD framing

v1.0 is complete, so this is a **new milestone, v1.1 "Formatters"**, with (proposed) phases:

1. **Formatters** — shared `FormatterView` + JSON tool + XML tool (likely 2–3 plans:
   `FormatterView` + JSON first, then XML).
2. **StatusBar size-readout cleanup** — opt-in `byteCount`; update Hash/UUID/Unix Time/JWT.

Created via `/gsd-new-milestone`, then planned/executed through the normal GSD gates. SQL stays
in backlog 999.1; the DevTools CLI idea stays in backlog 999.4.

## Open questions

None blocking. (Strict-JSON-only and well-formedness-only-XML are deliberate v1.1 scope lines,
revisitable in a later milestone.)
