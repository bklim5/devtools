---
phase: 07-formatters
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/ResizableSplit.tsx
  - src/components/ResizableSplit.test.tsx
  - src/components/StatusBar.tsx
  - src/components/StatusBar.test.tsx
  - src/lib/format/types.ts
  - src/lib/format/types.test.ts
autonomous: true
requirements: [FMT-01, FMT-04, FMT-07]
must_haves:
  truths:
    - "ResizableSplit lives at src/components/ResizableSplit.tsx and renders left/right panes with a focusable separator"
    - "StatusBar shows an input->output byte delta (e.g. 1,240 -> 890 bytes) when a caller provides both counts, and still shows a single byte count for existing callers"
    - "Existing StatusBar callers (Base64/Hex/Bytes, Protobuf) render unchanged — no regression"
    - "The shared FormatResult discriminated type is importable by both formatters"
    - "The decoder's 19 tests in src/lib/protobuf/decoder.test.ts stay byte-for-byte green"
  artifacts:
    - path: "src/components/ResizableSplit.tsx"
      provides: "Shared resizable two-pane split (promoted from protobuf-decoder)"
      exports: ["ResizableSplit", "ResizableSplitProps"]
    - path: "src/components/StatusBar.tsx"
      provides: "Status bar with additive optional output-byte-delta prop"
      exports: ["StatusBar", "StatusBarProps", "ParseState"]
    - path: "src/lib/format/types.ts"
      provides: "Shared FormatResult discriminated union + FormatOptions"
      exports: ["FormatResult", "FormatOptions", "IndentMode"]
  key_links:
    - from: "src/components/StatusBar.tsx"
      to: "byte-delta render branch"
      via: "optional outputBytes prop"
      pattern: "outputBytes"
    - from: "src/lib/format/json.ts (future)"
      to: "src/lib/format/types.ts"
      via: "import type FormatResult"
      pattern: "FormatResult"
---

<objective>
Build the three shared surfaces both formatters depend on, in isolation, so the JSON and XML plans never collide on these files: (1) promote the protobuf-decoder's `ResizableSplit` to a tool-agnostic shared location (D-02), (2) extend `StatusBar` with an additive, backward-compatible input->output byte-delta readout (D-04/D-05), and (3) define the shared `FormatResult` discriminated type the pure formatters return (D-09).

Purpose: These are shared-surface touches. Isolating them in wave 1 keeps the parallel JSON/XML work conflict-free and keeps the additive StatusBar change reviewable on its own.
Output: `src/components/ResizableSplit.tsx`, an extended `src/components/StatusBar.tsx`, and `src/lib/format/types.ts` — all with colocated tests, decoder's 19 tests still green.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/07-formatters/07-CONTEXT.md
@docs/superpowers/specs/2026-06-02-json-xml-formatters-design.md

<interfaces>
<!-- Current StatusBar contract (src/components/StatusBar.tsx) — extend additively, do NOT break -->
```typescript
export type ParseState = "ok" | "error" | "empty";
export interface StatusBarProps {
  parseState: ParseState;
  byteCount: number;          // currently REQUIRED — keep required in this phase (Phase 8 makes it optional)
  encoding?: string;
  error?: string | null;
  timingMs?: number;
}
```
Existing callers pass `byteCount` positionally-by-name only: Base64Tool.tsx passes `{ parseState, byteCount, error, timingMs }`. ProtobufDecoder passes `byteCount` + `encoding`. Both must keep working with zero edits.

<!-- Current ResizableSplit contract (src/tools/protobuf-decoder/ResizableSplit.tsx) -->
```typescript
export interface ResizableSplitProps {
  left: React.ReactNode;
  right: React.ReactNode;
  initial?: number;  // default 0.5
  min?: number;      // default 0.2
}
export function ResizableSplit(props: ResizableSplitProps): JSX.Element;
```
NOTE: `ResizableSplit` is currently imported by NOTHING except its own colocated test (`src/tools/protobuf-decoder/ResizableSplit.test.tsx`). The decoder's 19 tests (`src/lib/protobuf/decoder.test.ts`) do NOT import it. So promotion only requires moving the component + its test and updating the test's relative import.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Promote ResizableSplit to src/components/</name>
  <files>src/components/ResizableSplit.tsx, src/components/ResizableSplit.test.tsx</files>
  <read_first>
    - src/tools/protobuf-decoder/ResizableSplit.tsx (the component to move, verbatim)
    - src/tools/protobuf-decoder/ResizableSplit.test.tsx (the colocated test to move + re-point)
    - src/components/StatusBar.tsx (example of an existing shared component at the target path)
  </read_first>
  <action>
    Move `src/tools/protobuf-decoder/ResizableSplit.tsx` to `src/components/ResizableSplit.tsx` with its body, exports (`ResizableSplit`, `ResizableSplitProps`), and comment header BYTE-FOR-BYTE unchanged — this is a pure relocation, no behavior change.
    Move `src/tools/protobuf-decoder/ResizableSplit.test.tsx` to `src/components/ResizableSplit.test.tsx` and update its import from `./ResizableSplit` to `./ResizableSplit` (still relative, same dir — verify the path resolves after the move). Use `git mv` so history is preserved.
    Delete the originals from `src/tools/protobuf-decoder/` (the `git mv` handles this).
    Do NOT touch `src/lib/protobuf/decoder.ts` or `src/lib/protobuf/decoder.test.ts` — they do not reference ResizableSplit, so the decoder's 19 tests are unaffected.
    Run a repo-wide grep for any other importer of the old path and fix it if found (there should be none).
  </action>
  <verify>
    <automated>test -f src/components/ResizableSplit.tsx && test ! -f src/tools/protobuf-decoder/ResizableSplit.tsx && ! grep -rn "protobuf-decoder/ResizableSplit" src/ test/ && pnpm vitest run src/components/ResizableSplit.test.tsx && pnpm vitest run src/lib/protobuf/decoder.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `src/components/ResizableSplit.tsx` exists and exports `ResizableSplit` and `ResizableSplitProps` (grep: `export function ResizableSplit`, `export interface ResizableSplitProps`).
    - `src/tools/protobuf-decoder/ResizableSplit.tsx` and `...ResizableSplit.test.tsx` no longer exist.
    - `grep -rn "protobuf-decoder/ResizableSplit" src/ test/` returns no matches.
    - `pnpm vitest run src/components/ResizableSplit.test.tsx` exits 0.
    - `pnpm vitest run src/lib/protobuf/decoder.test.ts` exits 0 with 19 passing tests (the immovable bar).
  </acceptance_criteria>
  <done>ResizableSplit promoted to src/components/, colocated test green at new path, decoder 19 tests green, no stale imports.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add additive input->output byte-delta to StatusBar</name>
  <files>src/components/StatusBar.tsx, src/components/StatusBar.test.tsx</files>
  <read_first>
    - src/components/StatusBar.tsx (the file being modified — current props + render)
    - src/tools/base64/Base64Tool.tsx (existing caller — must keep working unchanged)
    - docs/superpowers/specs/2026-06-02-json-xml-formatters-design.md (the "1,240 -> 890 bytes" delta requirement, D-04)
  </read_first>
  <behavior>
    - Test 1: `<StatusBar parseState="ok" byteCount={1240} />` (no outputBytes) renders "1,240 bytes" — single readout, unchanged from today (use a thousands separator if you add one; if not already separated, keep the current `{byteCount} bytes` exactly — see note in action).
    - Test 2: `<StatusBar parseState="ok" byteCount={1240} outputBytes={890} />` renders an input->output delta containing "1,240" and "890" and an arrow ("→" or "->") — e.g. `1,240 → 890 bytes`.
    - Test 3: When `outputBytes === byteCount` the delta still renders both numbers (no special-casing required).
    - Test 4: `byteCount={1}` with no outputBytes still renders "1 byte" (singular) — existing behavior preserved.
  </behavior>
  <action>
    Add ONE new optional prop to `StatusBarProps`: `outputBytes?: number`. Keep `byteCount: number` REQUIRED in this phase (Phase 8 owns making it optional — do not change that here, D-05).
    In the byte-count `<span aria-label="byte count">` render branch: when `outputBytes` is a number, render the delta as `{formatN(byteCount)} → {formatN(outputBytes)} bytes` (use the "→" U+2192 arrow); when `outputBytes` is undefined, render exactly the current output (`{byteCount} {byteCount === 1 ? "byte" : "bytes"}`) so existing callers are byte-identical.
    Add a tiny local `formatN(n: number)` helper that inserts thousands separators via `n.toLocaleString("en-US")` and use it ONLY inside the new delta branch (do not change the single-count branch formatting, to avoid touching Base64/Protobuf snapshots).
    The whole change is presentational and additive — no new imports beyond what's already in the file.
    Create/extend `src/components/StatusBar.test.tsx` (jsdom, @testing-library/react render + `screen` text queries) covering the four behaviors above.
  </action>
  <verify>
    <automated>pnpm vitest run src/components/StatusBar.test.tsx && pnpm tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `src/components/StatusBar.tsx` `StatusBarProps` contains `outputBytes?: number` (grep: `outputBytes\?: number`).
    - `byteCount` remains required (grep shows `byteCount: number` with no `?`).
    - StatusBar source contains the arrow character in the delta branch (grep: `→`).
    - `pnpm vitest run src/components/StatusBar.test.tsx` exits 0 with the 4 new behaviors green.
    - `pnpm vitest run src/tools/base64` and `pnpm vitest run src/tools/protobuf-decoder` still exit 0 (existing single-count callers unregressed).
    - `pnpm tsc --noEmit` exits 0.
  </acceptance_criteria>
  <done>StatusBar renders a byte delta when given outputBytes, is byte-identical for existing single-count callers, type-checks, and existing tool tests stay green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Define the shared FormatResult type</name>
  <files>src/lib/format/types.ts, src/lib/format/types.test.ts</files>
  <read_first>
    - docs/superpowers/specs/2026-06-02-json-xml-formatters-design.md (the FormatResult shape, D-09, lines ~118-122)
    - src/lib/protobuf/decoder.ts (example of a pure src/lib module exporting types)
    - .planning/phases/07-formatters/07-CONTEXT.md (D-06 toolbar controls: indent 2/4/tab default 2; D-10 sort-keys; D-09 result shape)
  </read_first>
  <behavior>
    - Test 1: a value typed as `FormatResult` with `ok: true` exposes `output: string`, `inputBytes: number`, `outputBytes: number` and NOT `error`.
    - Test 2: a value typed as `FormatResult` with `ok: false` exposes `error: { message: string; line?: number; col?: number }` and NOT `output`.
    - Test 3: `IndentMode` accepts only `"2" | "4" | "tab"`; `FormatOptions` has `indent: IndentMode`, `minify: boolean`, and JSON-only `sortKeys?: boolean`.
    (These are compile-time guarantees; assert them with a small runtime test that constructs each variant and narrows on `result.ok`.)
  </behavior>
  <action>
    Create `src/lib/format/types.ts` (pure — no React, no DOM-of-the-app, no platform imports) exporting exactly:
    ```ts
    export type IndentMode = "2" | "4" | "tab";
    export interface FormatOptions {
      indent: IndentMode;   // default "2" is chosen by the caller/tool, not here
      minify: boolean;      // minify wins over prettify when true (D-06)
      sortKeys?: boolean;   // JSON only (D-10); XML never sets it
    }
    export type FormatResult =
      | { ok: true; output: string; inputBytes: number; outputBytes: number }
      | { ok: false; error: { message: string; line?: number; col?: number } };
    ```
    Add a `src/lib/format/types.test.ts` that imports the types, constructs one of each `FormatResult` variant, and asserts narrowing: `if (r.ok) expect(typeof r.output).toBe("string")` else `expect(typeof r.error.message).toBe("string")`. Also assert an `IndentMode` value `"tab"` is assignable. This locks the contract before json.ts / xml.ts are written.
  </action>
  <verify>
    <automated>pnpm vitest run src/lib/format/types.test.ts && pnpm tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `src/lib/format/types.ts` exports `FormatResult`, `FormatOptions`, `IndentMode` (grep: `export type FormatResult`, `export interface FormatOptions`, `export type IndentMode`).
    - `FormatResult` is a discriminated union on `ok` (grep both `ok: true` and `ok: false`).
    - The `ok: false` branch's error shape contains `line?: number` and `col?: number` (grep).
    - `src/lib/format/types.ts` contains no `import` from `react`, `@/components`, `@tauri-apps`, or `@/lib/platform` (grep returns no matches → purity).
    - `pnpm vitest run src/lib/format/types.test.ts` exits 0; `pnpm tsc --noEmit` exits 0.
  </acceptance_criteria>
  <done>Shared FormatResult/FormatOptions/IndentMode types exist, are pure, narrow correctly, and are ready for json.ts/xml.ts to import.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (none new) | This plan creates no new untrusted-input parsing path. ResizableSplit and StatusBar render only props (numbers + plain strings the app itself produces); FormatResult is a type with no runtime parsing. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-07-01 | Information disclosure / Tampering | StatusBar byte-delta render | accept | `byteCount`/`outputBytes` are numbers; the error/encoding strings are app-produced plain text rendered as text nodes (no `dangerouslySetInnerHTML`). No untrusted HTML path introduced. Low/info. |
| T-07-02 | Denial of service | StatusBar `toLocaleString` on large byte counts | accept | Inputs are small per D-07; `Number.toLocaleString` is O(digits) and bounded. No unbounded work. |
| T-07-03 | Tampering | ResizableSplit relocation regressing decoder | mitigate | Decoder's 19 tests (`src/lib/protobuf/decoder.test.ts`) are run in Task 1 verify; the component is moved verbatim with `git mv`, no behavior edit. |
</threat_model>

<verification>
- `pnpm vitest run` passes (all suites, including the 19 decoder tests untouched).
- `pnpm tsc --noEmit` clean.
- `pnpm eslint .` clean for the changed files.
- `grep -rn "protobuf-decoder/ResizableSplit" src/ test/` returns nothing.
- StatusBar renders byte delta only when `outputBytes` provided; single-count callers byte-identical.
</verification>

<success_criteria>
- ResizableSplit promoted to `src/components/`, its colocated test green at the new path, no stale imports anywhere.
- StatusBar has an additive optional `outputBytes` prop driving an input->output byte delta; `byteCount` stays required; Base64/Protobuf tests unregressed.
- `src/lib/format/types.ts` exports a pure `FormatResult`/`FormatOptions`/`IndentMode` contract ready for the formatter plans.
- Decoder's 19 tests stay byte-for-byte green; no new runtime dependencies added.
</success_criteria>

<output>
After completion, create `.planning/phases/07-formatters/07-01-SUMMARY.md`.
</output>
