---
phase: 07-formatters
plan: 01
subsystem: ui
tags: [react, typescript, status-bar, resizable-split, formatter, types]

# Dependency graph
requires:
  - phase: 03-hero-encoding-ux
    provides: ResizableSplit component + StatusBar component (both promoted/extended here)
provides:
  - "ResizableSplit promoted to src/components/ (tool-agnostic shared location)"
  - "StatusBar additive optional outputBytes prop driving an input->output byte delta (1,240 -> 890 bytes)"
  - "Shared src/lib/format/types.ts: FormatResult discriminated union + FormatOptions + IndentMode"
affects: [07-02 json-formatter, 07-03 xml-formatter, 08 statusbar-cleanup]

# Tech tracking
tech-stack:
  added: []  # zero new runtime dependencies (native APIs / TS types only)
  patterns:
    - "Shared formatter result contract as a pure discriminated union (FormatResult) defined before any formatter is written"
    - "Additive, backward-compatible StatusBar extension: new optional prop, single-count branch byte-identical"

key-files:
  created:
    - src/components/ResizableSplit.tsx
    - src/components/ResizableSplit.test.tsx
    - src/lib/format/types.ts
    - src/lib/format/types.test.ts
    - src/components/StatusBar.test.tsx
  modified:
    - src/components/StatusBar.tsx
    - src/tools/protobuf-decoder/ProtobufDecoder.tsx

key-decisions:
  - "ResizableSplit moved with git mv (history preserved); ProtobufDecoder import rewired to @/components/ResizableSplit to match the StatusBar import pattern"
  - "outputBytes is additive-only; byteCount stays REQUIRED this phase (Phase 8 owns making it optional, D-05)"
  - "formatN thousands-separator (toLocaleString en-US) used ONLY in the delta branch, so single-count callers (Base64/Protobuf) stay byte-identical"

patterns-established:
  - "Pure src/lib/format/ modules: no react/components/tauri/platform imports — plain data the tool components consume"
  - "Type-only contract locked by a runtime test that constructs each FormatResult variant and narrows on ok"

requirements-completed: [FMT-01, FMT-04, FMT-07]

# Metrics
duration: 25min
completed: 2026-06-02
---

# Phase 7 Plan 01: Shared Foundation Summary

**Promoted ResizableSplit to src/components/, added an additive StatusBar input->output byte-delta prop, and defined the pure FormatResult/FormatOptions/IndentMode contract — the three shared surfaces both the JSON and XML formatters depend on, landed conflict-free in wave 1.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-02T10:32:04Z
- **Completed:** 2026-06-02T10:36:00Z
- **Tasks:** 3
- **Files modified:** 7 (5 created, 2 modified)

## Accomplishments

- `ResizableSplit` promoted from `src/tools/protobuf-decoder/` to the tool-agnostic `src/components/` (D-02), `git mv` preserving history, colocated test moved alongside, decoder's 19 logic tests untouched and green.
- `StatusBar` gained an additive optional `outputBytes` prop: when a formatter passes it, the byte readout renders an input->output delta (`1,240 → 890 bytes`, D-04); existing single-count callers (Base64/Hex/Bytes, Protobuf) render byte-identically with `byteCount` still required (D-05).
- `src/lib/format/types.ts` defines the shared, pure `FormatResult` discriminated union plus `FormatOptions`/`IndentMode` (D-09/D-06/D-10) — the contract `formatJson`/`formatXml` will return, locked by a narrowing test before any formatter exists.
- Whole repo green: 311 vitest tests pass (incl. the 19 immovable decoder tests), `tsc --noEmit` clean, `eslint .` clean, zero new runtime dependencies.

## Task Commits

Each task was committed atomically:

1. **Task 1: Promote ResizableSplit to src/components/** - `281b77bc` (refactor)
2. **Task 2: Add additive input->output byte-delta to StatusBar** (TDD) - `90ec2fe2` (test, RED) → `d8ecdc64` (feat, GREEN)
3. **Task 3: Define the shared FormatResult type** (TDD) - `4726fc39` (test, RED) → `05c9c620` (feat, GREEN)

_TDD tasks 2 and 3 have a RED test commit followed by a GREEN implementation commit._

## Files Created/Modified

- `src/components/ResizableSplit.tsx` - Shared resizable two-pane split (moved verbatim from protobuf-decoder)
- `src/components/ResizableSplit.test.tsx` - Colocated test (moved; same-dir relative import unchanged)
- `src/components/StatusBar.tsx` - Added optional `outputBytes` prop + `formatN` helper + delta render branch
- `src/components/StatusBar.test.tsx` - 4 new tests: single count, delta, equal in/out, singular byte
- `src/lib/format/types.ts` - Pure `FormatResult` / `FormatOptions` / `IndentMode` contract
- `src/lib/format/types.test.ts` - 4 contract tests (variant construction + narrowing)
- `src/tools/protobuf-decoder/ProtobufDecoder.tsx` - Rewired `ResizableSplit` import to `@/components/ResizableSplit` (see Deviations)

## Decisions Made

- Used `git mv` for the ResizableSplit relocation so the component's history follows it.
- Kept `formatN` (thousands separators) scoped to the new delta branch only, so existing Base64/Protobuf StatusBar output is byte-identical and their snapshot/text tests stay green.
- `byteCount` deliberately left REQUIRED — making it optional is Phase 8's job (UIX-01), avoiding scope bleed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Rewired ProtobufDecoder's ResizableSplit import after the move**
- **Found during:** Task 1 (Promote ResizableSplit)
- **Issue:** The plan's `<interfaces>` note asserted "ResizableSplit is currently imported by NOTHING except its own colocated test." This was wrong — `src/tools/protobuf-decoder/ProtobufDecoder.tsx:20` imports `ResizableSplit` from `./ResizableSplit`. After the `git mv`, that relative import broke (`tsc TS2307` + Vite resolve failure), surfaced by the pre-commit hook (typecheck + test).
- **Fix:** Updated the import in `ProtobufDecoder.tsx` from `./ResizableSplit` to `@/components/ResizableSplit`, matching the file's existing `@/components/StatusBar` import pattern.
- **Files modified:** `src/tools/protobuf-decoder/ProtobufDecoder.tsx`
- **Verification:** `pnpm tsc --noEmit` clean; protobuf-decoder UI tests + ResizableSplit test + the 19 decoder logic tests all green; full suite 311 tests green.
- **Committed in:** `281b77bc` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** The deviation was a one-line import rewire required to keep the build/tests green after a relocation the plan already mandated. No behavior change, no scope creep. The hero decoder's 19 logic tests (`src/lib/protobuf/decoder.test.ts`) were never affected — they do not import the UI component.

## Issues Encountered

- An initial `grep` for `ResizableSplit` in `src/tools/protobuf-decoder/` returned no match (likely a stalled tool-output channel — a known intermittent issue), which briefly suggested the plan's "no importers" note was accurate. The lefthook pre-commit hook caught the real broken import on the first commit attempt and the import was rewired (above). Lesson reinforced: the pre-commit typecheck+test gate is the source of truth, not a single grep.

## UI Verification Note

This plan touches `StatusBar`'s render branch (a UI surface), but the new `outputBytes` delta only renders when a caller passes `outputBytes` — and no caller does yet (formatters arrive in 07-02/07-03). Existing callers (Base64/Hex/Bytes, Protobuf) render byte-identically, proven by their unregressed unit tests. Meaningful real-WKWebView UI verification of the delta belongs to 07-02 (JSON formatter), the first plan that actually renders it. ResizableSplit was moved verbatim with no behavior change. No standalone e2e/visual gate is warranted for this wave-1 foundation plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **07-02 (json-formatter):** can now import `FormatResult`/`FormatOptions`/`IndentMode` from `@/lib/format/types`, reuse `@/components/ResizableSplit` in the shared `FormatterView`, and pass `outputBytes` to `StatusBar` for the minify size delta.
- **07-03 (xml-formatter):** same shared surfaces available; `sortKeys` stays unset for XML per the contract.
- **Phase 8 (StatusBar cleanup):** `byteCount` intentionally left required here — Phase 8 makes it optional once the full caller set (incl. formatters) is in place.
- No blockers.

## Self-Check: PASSED

Files verified present: `src/components/ResizableSplit.tsx`, `src/components/ResizableSplit.test.tsx`, `src/components/StatusBar.tsx`, `src/components/StatusBar.test.tsx`, `src/lib/format/types.ts`, `src/lib/format/types.test.ts`. Old path `src/tools/protobuf-decoder/ResizableSplit.tsx` confirmed removed.
Commits verified in git log: `281b77bc`, `90ec2fe2`, `d8ecdc64`, `4726fc39`, `05c9c620`.

---
*Phase: 07-formatters*
*Completed: 2026-06-02*
