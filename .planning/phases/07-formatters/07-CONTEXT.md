# Phase 7: Formatters - Context

**Gathered:** 2026-06-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship two new registry tools — `json-formatter` and `xml-formatter` (`category: "formatting"`,
already in the `ToolCategory` union) — behind a shared, presentational two-pane, paste-instant
`FormatterView`. Pure transform logic lives in `src/lib/format/{json,xml}.ts` (zero new runtime
deps; native `JSON` and `DOMParser`). Feature set: validate, prettify, minify, plus JSON
sort-keys (FMT-01..08).

**In scope:** the shared `FormatterView`, both formatter tools, their pure-logic units + tests,
and a small `StatusBar` API touch to show the minify size delta.
**Out of scope (other phases / milestones):** the broader opt-in `StatusBar` byteCount cleanup
across Hash/UUID/Unix Time/JWT (Phase 8, UIX-01); SQL formatter (backlog 999.1); JSON5/JSONC;
XML XSD validation; JSON sort-by-value / XML node sorting.
</domain>

<decisions>
## Implementation Decisions

### Pane layout
- **D-01:** `FormatterView` uses a **side-by-side, resizable** split — input left, output right —
  reusing the protobuf decoder's existing `ResizableSplit` component. It must remain
  layout-agnostic and **responsive-stack vertically on narrow widths** (no fixed widths, UX-05).
  This intentionally differs from Base64's stacked full-width panes because a 2-pane derive reads
  better as a left→right transform.
- **D-02:** `ResizableSplit` currently lives at `src/tools/protobuf-decoder/ResizableSplit.tsx`.
  Since a second feature now consumes it, **promote it to a shared location** (e.g.
  `src/components/ResizableSplit.tsx`) and update the decoder's import. *Claude's discretion on the
  exact path, but the decoder's behavior and its 19 tests must stay byte-for-byte unchanged.*

### Output pane behavior
- **D-03:** The output pane is a **read-only text region** (non-editable; derived-only), plain
  monospace text — **no syntax highlighting** (zero-dep constraint). It carries the **visible,
  keyboard-focusable copy control** (≤1 keystroke, no hover-only) via the shared
  `CopyButton`/`useCopyFeedback` and the platform clipboard seam (FMT-08).

### Status bar size readout
- **D-04:** The status bar shows the **input → output byte delta** (e.g. `1,240 → 890 bytes`) so
  minify's compression is visible at a glance. This requires a **small `StatusBar` API touch** —
  the formatters pass both input and output byte counts.
- **D-05:** This `StatusBar` change must be made **in coordination with Phase 8** (UIX-01), which
  makes `byteCount` opt-in. Phase 7 may extend the `StatusBar` props (e.g. add an optional
  output/delta byte count) but must not regress the existing single-`byteCount` callers
  (Base64/Hex/Bytes, Protobuf). *Exact prop shape is Claude's discretion — keep it additive and
  presentational; the decoder + its 19 tests stay untouched.*

### Toolbar
- **D-06:** A **single shared top toolbar** sits above both panes inside `FormatterView`. The tool
  component passes in which controls to render so `FormatterView` stays presentational and
  JSON-vs-XML-agnostic. JSON enables the **sort-keys** toggle; XML does not. Controls:
  indent (`2`/`4`/`tab`, default `2`), minify toggle (minify wins over prettify), sort-keys
  (JSON only), and the output copy button.

### Behavior (locked by the approved spec — restated for downstream agents)
- **D-07:** **Paste-instant**: auto-validate + auto-format on every input change, synchronous
  derive, **no debounce** (inputs small, native APIs fast). FMT-01/FMT-05.
- **D-08:** Error convention follows Base64 (Phase 3): **on error the output pane clears and the
  status bar shows the error**; **empty input → empty output, status "empty"** (not an error).
- **D-09:** Pure formatters return a discriminated `FormatResult`
  (`{ ok: true; output; inputBytes; outputBytes } | { ok: false; error: { message; line?; col? } }`).
  JSON maps `JSON.parse` failures to **line:col + message** (compute line/col from the error's
  char offset over the input). XML detects a `<parsererror>` node and surfaces its message (with
  line where the engine provides one).
- **D-10:** **JSON sort-keys** is a recursive deterministic object-key sort applied before
  stringify; **array order is preserved** (FMT-04). Strict JSON only (no JSON5/JSONC).
- **D-11:** **XML prettify preserves comments, CDATA, attributes, and processing instructions**
  (FMT-06); minify strips insignificant inter-element whitespace (FMT-07). Well-formedness
  validation only (no XSD).
- **D-12:** Registration is **registry-only** — append `jsonFormatterTool` and `xmlFormatterTool`
  to the `TOOLS` array in `src/lib/tools/registry.ts` (+2 imports). Sidebar, ⌘K palette, and
  router auto-derive; no other wiring.

### Claude's Discretion
- Exact `ResizableSplit` shared path and import rewiring (D-02).
- Exact additive `StatusBar` prop shape for the byte delta (D-04/D-05).
- Default split ratio and min pane widths for the resizable layout.
- Internal `FormatResult` typing details and where the shared `FormatResult` type lives.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design spec (authoritative for this phase)
- `docs/superpowers/specs/2026-06-02-json-xml-formatters-design.md` — full approved design:
  architecture, file layout, tool behavior, `FormatResult` shape, error handling, the StatusBar
  cleanup framing, and the testing/harness requirements.

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` §Formatters (FMT) — FMT-01..08 acceptance criteria.
- `.planning/ROADMAP.md` §"Phase 7: Formatters" — goal + 5 success criteria; §"Phase 8" for the
  StatusBar cleanup boundary this phase must coordinate with.

### Reusable code to follow / extend (read before writing)
- `src/tools/base64/Base64Tool.tsx` — the canonical two-pane, paste-instant, copy-per-pane,
  status-bar-wired tool pattern to mirror (layout-agnostic, `timed()` wrapper for status timing).
- `src/components/StatusBar.tsx` — shared status bar (`ParseState`, props); the byte-delta touch
  (D-04) extends this. Coordinate with Phase 8.
- `src/components/CopyButton.tsx` + `src/shell/useCopyFeedback` — the visible, focusable copy
  affordance (FMT-08).
- `src/tools/protobuf-decoder/ResizableSplit.tsx` (+ `ResizableSplit.test.tsx`) — the resizable
  split to promote/reuse (D-01/D-02).
- `src/lib/tools/registry.ts` + `src/lib/tools/types.ts` — single control plane; `ToolDefinition`
  shape and the `"formatting"` category (already present).
- `src/lib/platform/` — clipboard seam (never import `@tauri-apps/*` directly).

### Project guardrails
- `CLAUDE.md` and `.planning/PROJECT.md` §Constraints — HashRouter only, no network, no new deps,
  decoder + 19 tests untouched, WCAG-AA, per-task DoD harness order.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Base64Tool.tsx**: copy the structure — derived panes, `timed()` wrapper feeding `StatusBar`
  timing, per-pane copy button, layout-agnostic flex column. Best template for the tool components.
- **StatusBar.tsx**: reused verbatim except the additive byte-delta prop (D-04).
- **CopyButton.tsx / useCopyFeedback**: drop-in for the output copy control (FMT-08).
- **ResizableSplit.tsx** (protobuf-decoder): the side-by-side resizable split for `FormatterView`
  (D-01) — promote to shared (D-02).
- **registry.ts / types.ts**: `"formatting"` category exists; registration is +2 imports +2 array
  entries, nothing else.
- **platform seam** (`src/lib/platform`): clipboard goes through here only.

### Established Patterns
- Pure transform logic isolated under `src/lib/` (e.g. `bytes.ts`, `protobuf/decoder.ts`,
  `timeFormat.ts`), independently unit-tested → formatters go in `src/lib/format/`.
- Each tool is a self-contained dir under `src/tools/<id>/` with `index.ts` (`ToolDefinition`) +
  component + colocated tests; e2e specs under `test/e2e/<tool>.e2e.ts`.
- Status timing measured around the edit handler via a `timed()` wrapper.
- Accent = selected-only; visible focus rings (`focus-visible:ring-accent`); CSS-var tokens
  (`bg-input-bg`, `border-bd`, `text-tx`/`text-tx-2`, `text-bad`).

### Integration Points
- `src/lib/tools/registry.ts` `TOOLS` array — the only wiring change (sidebar/palette/router
  auto-derive).
- `src/components/StatusBar.tsx` — shared by all tools; the byte-delta change must stay backward
  compatible (Base64/Protobuf) and coordinate with Phase 8.
- `src/tools/protobuf-decoder/*` — only touched to update the `ResizableSplit` import after
  promotion (no behavior change; decoder tests stay green).
</code_context>

<specifics>
## Specific Ideas

- "jsonlint-style" feel: paste → instant validate/prettify, line:col errors. Side-by-side
  input→output transform reading (left = what you pasted, right = the result).
- Minify's headline value is the size reduction — surface it as a visible `input → output` byte
  delta in the status bar.
</specifics>

<deferred>
## Deferred Ideas

- **Syntax highlighting** for the output pane — would need a highlighting dependency; violates the
  zero-dep constraint. Not in v1.1.
- **JSON5 / JSONC** (comments, trailing commas) — strict JSON only for v1.1.
- **XML XSD/schema validation** — well-formedness only for v1.1.
- **SQL formatter** — needs `sql-formatter`; parked in backlog 999.1.
- **Broad opt-in StatusBar byteCount cleanup** (drop on Hash/UUID/Unix Time/JWT) — Phase 8
  (UIX-01). Phase 7 only makes the additive byte-delta change the formatters need.

None of the above were scope creep from this discussion — they're pre-existing scope lines.
</deferred>

---

*Phase: 07-formatters*
*Context gathered: 2026-06-02*
