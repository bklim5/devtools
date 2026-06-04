# Phase 13: URL tool - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning

<domain>
## Phase Boundary

A new **URL tool** (the 9th tool; registry-driven like the rest) that does two related
jobs over native `URL` / `URLSearchParams` / `encodeURI(Component)`, with **zero new runtime
deps** and all errors surfaced as values (never a throw):

1. **Parse** — paste a URL → split into its components (scheme / host / port / path / query /
   fragment, plus origin + userinfo when present) and render the query string as a key→value
   table (repeated keys via `getAll`, empty values, each value decoded).
2. **Encode/Decode** — percent-encode/decode arbitrary strings at the **component** level
   (`encodeURIComponent`/`decodeURIComponent`) and the **full-string** level
   (`encodeURI`/`decodeURI`), both directions, with the component-vs-full distinction made
   clear.

Requirements: **URL-01, URL-02, URL-03, URL-04, URL-05**. The two jobs live in one tool view
behind a top-level mode switch (see D-01). This phase also delivers the **extracted shared
`Toggle`** the roadmap names (promoting the inline `toggleClasses`/`Toggle` idiom currently in
`FormatterView.tsx`). It does NOT add any capability beyond the five URL requirements.

</domain>

<decisions>
## Implementation Decisions

### Overall layout (structural)
- **D-01:** **Top-level mode switch (tabs):** a segmented control `[Parse] [Encode/Decode]`.
  Each mode owns the full view, focused on one job. This is the cleanest fit because the two
  jobs operate on different inputs (a whole URL vs an arbitrary string) — conflating them on
  one input was explicitly rejected.
- **D-02:** **Parse is the default mode on open**, tab order `[Parse] [Encode/Decode]`. Parse
  is the roadmap's centerpiece and the more common need. **No persistence** of last-used mode —
  it always opens on Parse (do NOT add window-geometry-style persistence here).
- **D-03:** The mode switch reuses the **active-segment-as-readout toggle pattern** (Phase 3
  D-08): accented active segment, `aria-pressed`, keyboard operable, WCAG-AA.

### Encode/Decode mode (URL-01, URL-02)
- **D-04:** **Both directions shown at once, no encode/decode switch.** One input; below it an
  **Encoded** output and a **Decoded** output rendered live (paste-instant via `useMemo`),
  exactly mirroring how the existing Base64 tool shows both directions simultaneously. Each
  output is read-only with its own copy button.
- **D-05:** A **`component | full` scope toggle** (this IS the extracted shared `Toggle`)
  selects which pair of functions drives the two outputs:
  - `component` → `encodeURIComponent` / `decodeURIComponent`
  - `full` → `encodeURI` / `decodeURI`
- **D-06:** **Make the component-vs-full distinction clear with a one-line, mode-aware helper
  caption under the toggle** (satisfies URL-02's "difference made clear"). e.g.
  - component: "escapes `/ ? : @ & = #` too — for a single query value or path segment"
  - full: "keeps URL structure (`/ ? : @ & =`) intact — for a whole URL"
  (Exact wording is Claude's discretion; keep it terse and accurate.)

### Parsed components readout (URL-03)
- **D-07:** **Labeled rows** (label→value, monospace values), top-to-bottom, **each row has its
  own copy button** (no hover-only copy; use `useCopyFeedback` + `platform.clipboard`). Card
  grid and copy-all-only were rejected.
- **D-08:** **Show the required six (scheme, host, port, path, query, fragment) PLUS `origin`
  and `username`/`password` (userinfo) when present.** Useful for auth-URL and CORS debugging.
  Map native `URL` fields: scheme=`protocol` (trim trailing `:` for display, Claude's
  discretion), host=`hostname`, port=`port`, path=`pathname`, query=`search`, fragment=`hash`,
  plus `origin`, `username`, `password`.
- **D-09:** **Absent/empty components still render their row** with a muted `—` placeholder, so
  the structure is always visible and the layout doesn't shift between URLs (hide-empties was
  rejected). NOTE: `password` is mildly sensitive — display it plainly (no masking) but the
  planner should be aware it's surfaced.

### Query key→value table (URL-04)
- **D-10:** **One row per occurrence, in URL order** — iterate `URLSearchParams` directly so
  `?tag=a&tag=b` yields two `tag` rows preserving order and multiplicity. No grouping logic
  (grouped-by-key was rejected).
- **D-11:** **Decoded keys and values.** `URLSearchParams` decodes both automatically — show
  the decoded form (URL-04 requires decoded values). Each **value** has its own copy button.
- **D-12:** **Empty values render as a muted `—` placeholder** (e.g. `?empty=` or `?flag`) so
  the row isn't blank.

### Error handling (URL-05)
- **D-13:** **Relative / scheme-less input is a clear inline error** — `new URL('/foo')`
  throws; catch it and surface an error-as-value message like "Enter an absolute URL (with a
  scheme), e.g. https://example.com/path". Do NOT auto-resolve against an assumed base and do
  NOT add a "treat as relative" toggle (both rejected — they invent a host the user didn't type
  and blur the absolute/relative line the spec draws).
- **D-14:** **Bad percent-sequences surface inline, never throw.** `decodeURIComponent('%zz')`
  / `decodeURI` throw `URIError`; catch per-output and render the error in place (the failing
  Encoded/Decoded pane or the affected row), leaving the rest of the view intact.
- **D-15:** **Empty / whitespace-only input = neutral empty state, not an error** — in BOTH
  modes — consistent with the existing Base64/Protobuf empty-state behavior.

### Shared `Toggle` extraction
- **D-16:** Promote the inline `toggleClasses(active)` + `Toggle` idiom (currently in
  `src/components/FormatterView.tsx`) into a **shared component** (e.g. `src/components/Toggle.tsx`
  or a small `SegmentedControl`), and use it for the URL tool's mode switch (D-01) and the
  `component | full` scope toggle (D-05). Keep the existing accented-active + `aria-pressed`
  styling and a11y. Refactoring the existing FormatterView usages to consume the shared
  component is encouraged but not mandatory if it risks the Formatter gates — Claude's
  discretion at plan time.

### Claude's Discretion
- Exact helper-caption wording (D-06) and error-string wording (D-13/14), kept terse and
  consistent with the existing hex/Base64 error voice.
- Whether `scheme` displays with or without the trailing `:` (native `protocol` includes it).
- Whether StatusBar / byteCount appears (likely omit — the URL string isn't byte-transformed;
  follows the StatusBar opt-in pattern, Phase 8).
- The shared-`Toggle` component's exact name/file and whether existing FormatterView usages are
  migrated in this phase (D-16).
- Tool registry metadata: `id` (`url`), `name`, `description`, `category` (`encoding`),
  `keywords`, and Lucide `icon` (e.g. `Link`) — mechanical, follows the Base64 entry shape.
- Whether the pure parse/encode helpers live in a small `src/lib/url.ts` (with tests) vs inline
  in the tool — recommend extracting pure logic to `src/lib/` with unit tests, per the
  established pattern, but the exact module boundary is discretion.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` § "Phase 13: URL tool" — goal, the five success criteria, and the
  risk-order rationale (URL sequenced second as the lowest-novelty pure-logic view; names the
  "parsed-components readout + key→value table" layout and the extracted shared `Toggle`).
- `.planning/REQUIREMENTS.md` — **URL-01** (component encode/decode both ways), **URL-02**
  (full-string encode/decode, distinction made clear), **URL-03** (parse into
  scheme/host/port/path/query/fragment), **URL-04** (query key→value table, `getAll`, empty
  values, decoded), **URL-05** (malformed/relative URL + bad percent-sequence → inline error,
  error-as-value).

### Binding project constraints
- `CLAUDE.md` — Critical constraints: **zero new runtime deps**, no network at runtime,
  registry-as-single-control-plane (sidebar/palette/router derive from it), HashRouter only,
  tools import `src/lib/platform/` not `@tauri-apps/*` directly, layout-agnostic tool
  components, **no hover-only copy**, and the build+verify harness (simplify → /codex:review →
  vitest+tsc → real-WKWebView UI verification).
- `.planning/PROJECT.md` § Current Milestone (v1.3) — wedge gates: paste-instant (<2s),
  keyboard-driven, WCAG-AA; `decoder.ts` + its 19 tests stay byte-for-byte untouched (this
  phase doesn't touch the decoder at all).

No external ADRs/specs beyond the above — requirements are fully captured in the decisions here.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (the exact seams to touch / reuse)
- **`src/tools/base64/Base64Tool.tsx`** — closest analog for Encode/Decode mode: single input,
  stacked output panes both directions live, error-as-value below the field, `useCopyFeedback`
  copy affordance. Mirror its structure for D-04.
- **`src/tools/protobuf-decoder/ProtobufDecoder.tsx`** — the segmented override toggle markup
  (`role="group"` + `aria-pressed` + accented active segment) to reuse for the mode switch
  (D-01/D-03) and as the basis for the extracted shared `Toggle` (D-16).
- **`src/components/FormatterView.tsx`** — currently holds the inline `toggleClasses(active)` +
  `Toggle` idiom that D-16 promotes to a shared component. Reference styling lives here.
- **`src/components/CopyButton.tsx`** + **`src/shell/useCopyFeedback`** + `platform.clipboard`
  — the standard copy pattern for the per-row component copies (D-07) and per-value query
  copies (D-11). Self-contained; reuse per row.
- **`src/lib/tools/registry.ts`** + tool types — add one `ToolDefinition` entry and import it
  into the `TOOLS` array; sidebar/search/router auto-derive (Claude's Discretion metadata).

### Established Patterns (follow, don't reinvent)
- **Error-as-value, never crash:** wrap `new URL(...)` / `decodeURI*` in try/catch, convert any
  throw into a rendered inline `role="alert"` message; keep the rest of the view intact
  (D-13/14). Same shape Base64/Protobuf already use.
- **Active-segment-as-readout toggle (Phase 3 D-08):** accented active segment, `aria-pressed`,
  keyboard operable — used by Base64/Protobuf/FormatterView. The mode switch and scope toggle
  plug into this exact pattern.
- **Paste-instant via `useMemo`:** all parse/encode/decode is pure and instant; derive outputs
  in a `useMemo` on the input (+ scope toggle) — no extra wiring.
- **Pure logic in `src/lib/` with unit tests:** recommend a small `src/lib/url.ts` (parse +
  encode/decode helpers, error-as-value) with a `url.test.ts`, mirroring `bytes.ts`/`format`.
- **StatusBar byteCount is opt-in (Phase 8):** likely omit for the URL tool.

### Greenfield (no existing primitive)
- **No table/grid component exists** — the query key→value table (D-10/11/12) is built from
  scratch (simple semantic rows; values monospace, each with a copy button).

</code_context>

<specifics>
## Specific Ideas

- The component-vs-full footgun is the teaching moment of this tool: encoding a whole URL with
  the *component* function turns `://` into `%3A%2F%2F` and breaks it. The D-06 helper caption
  and the side-by-side encoded/decoded outputs (D-04) exist to make that legible at a glance.
- Good verification anchors: a URL exercising every part —
  `https://user:pass@api.example.com:8080/v1/users?tag=a&tag=b&q=hello%20world&empty=#section`
  — should yield all 8 readout rows populated and 4 query rows (two `tag`, one decoded `q`, one
  empty `empty` shown as `—`). A relative input like `/foo?x=1` must show the D-13 inline error,
  not a parsed result.

</specifics>

<deferred>
## Deferred Ideas

- **Auto-resolve relative URLs against an assumed base** and a **"treat as relative" toggle** —
  explicitly considered and **decided against** for this phase (D-13), not merely deferred. If a
  real need emerges, it's a future enhancement.
- **Showing raw + decoded query values side by side** (D-11 chose decoded-only) — rejected to
  keep the table light; revisit only if users ask to see the encoding inline.
- Persisting the last-used Parse/Encode mode (D-02 chose no persistence) — a possible future
  polish, not in scope.

Otherwise: None — discussion stayed within phase scope.

</deferred>

---

*Phase: 13-url-tool*
*Context gathered: 2026-06-03*
