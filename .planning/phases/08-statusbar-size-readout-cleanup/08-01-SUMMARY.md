---
phase: 08-statusbar-size-readout-cleanup
plan: 01
subsystem: ui-statusbar
tags: [statusbar, ui, refactor, uix-01, presentational]
requires: [FMT-01, FMT-04, FMT-07]
provides: [UIX-01]
affects:
  - src/components/StatusBar.tsx
  - src/tools/hash/HashTool.tsx
  - src/tools/uuid-ulid/UuidUlidTool.tsx
  - src/tools/unix-time/UnixTimeTool.tsx
  - src/tools/jwt/JwtTool.tsx
tech-stack:
  added: []
  patterns:
    - "Opt-in presentational render guard: optional primitive prop + `typeof x === \"number\"` gate (no discriminated/conditional types)"
    - "Present/absent UI assertions via a stable aria-label hook (within(status).getBy/queryByLabelText) instead of text-matching"
key-files:
  created:
    - .planning/phases/08-statusbar-size-readout-cleanup/08-01-SUMMARY.md
  modified:
    - src/components/StatusBar.tsx
    - src/components/StatusBar.test.tsx
    - src/tools/hash/HashTool.tsx
    - src/tools/uuid-ulid/UuidUlidTool.tsx
    - src/tools/unix-time/UnixTimeTool.tsx
    - src/tools/jwt/JwtTool.tsx
    - src/tools/hash/HashTool.test.tsx
    - src/tools/uuid-ulid/UuidUlidTool.test.tsx
    - src/tools/unix-time/UnixTimeTool.test.tsx
    - src/tools/jwt/JwtTool.test.tsx
    - src/tools/protobuf-decoder/ProtobufDecoder.test.tsx
    - src/tools/json-formatter/JsonFormatterTool.test.tsx
    - src/tools/xml-formatter/XmlFormatterTool.test.tsx
decisions:
  - "byteCount made optional via the minimal additive change (D-03): `byteCount?: number` + a `typeof byteCount === \"number\"` render guard, no discriminated/conditional prop type."
  - "Hash dropped despite carrying a real byte count today (D-01) — consistency across the four drop tools wins; its now-dead `const byteCount` was removed to keep tsc/eslint clean."
  - "Drop tools keep their ParseState label/error/timing exactly as-is (D-02); only the size span is removed."
  - "Present/absent locked via the `aria-label=\"byte count\"` span (D-05), not rendered text — message-independent and stable."
metrics:
  tasks: 3
  files-changed: 13
  commits: 3
  tests-total: 378
  completed: 2026-06-02
---

# Phase 8 Plan 01: StatusBar Size-Readout Cleanup Summary

Made the shared `StatusBar` size readout opt-in (UIX-01): `byteCount` is now optional and the `aria-label="byte count"` span renders only when a caller passes a number — dropped from Hash/UUID·ULID/Unix Time/JWT, kept (byte-identical) on Base64/Hex/Bytes, the Protobuf decoder, and both Formatters.

## What Was Built

### Task 1 — `StatusBar.byteCount` optional + size-span guard (TDD) — `c57edb55`
- `StatusBarProps.byteCount` changed from `number` (required) to `byteCount?: number` with an opt-in JSDoc; `outputBytes` JSDoc clarified the delta needs `byteCount` too.
- The size `<span aria-label="byte count">` is now wrapped in `{typeof byteCount === "number" ? (…) : null}`. The inner single-count / `input → output` delta expressions are byte-identical to before, so keep callers render exactly as they did.
- Added a `describe("StatusBar optional byteCount", …)` block: absent → no span (parse-state span still "Empty"); present single count → "5 bytes"; present delta → "1,240 → 890 bytes"; `outputBytes` without `byteCount` → no span. All 6 pre-existing byte-readout/error tests still pass.

### Task 2 — drop the readout from the four drop tools + assert ABSENT — `0c831e7f`
- Removed the `byteCount` prop from the `<StatusBar>` JSX in HashTool, UuidUlidTool, UnixTimeTool, JwtTool (parseState/error/timing left untouched).
- Deleted Hash's now-unused `const byteCount = bytes.length` (verified `byteCount` referenced nowhere else) so tsc/eslint stay clean.
- Each drop-tool test now renders with real content (Hash "abc", UUID v7 vector, a seconds timestamp, a decoded token) and asserts `within(status).queryByLabelText("byte count")` is null while `getByLabelText("parse state")` is still present. Added `within` to the imports of the three test files that lacked it.

### Task 3 — assert the readout is PRESENT on the keep tools — `4b61ddf0`
- Protobuf, JSON formatter, and XML formatter tests now assert `within(status).getByLabelText("byte count")` is truthy after valid input (folded into each tool's existing paste-instant/decode test).
- Base64's existing present assertion (`bar.getByLabelText("byte count")`) was confirmed and left as-is.
- TEST FILES ONLY — no keep-tool component (Base64Tool.tsx, ProtobufDecoder.tsx, FormatterView.tsx, JsonFormatterTool.tsx, XmlFormatterTool.tsx) was modified.

## Deviations from Plan

None — plan executed exactly as written. All D-01..D-05 honored; the only test-file `within` imports added were the ones flagged in the plan's action notes.

## Verification

- Full suite: **378 tests / 44 files green** (`npx vitest run`).
- `npx tsc --noEmit` exit 0; `npx eslint src` exit 0.
- **Decoder untouched:** `src/lib/protobuf/decoder.ts` blob hash unchanged (`08ef2387…`), zero diff vs phase start, its **19 tests green**.
- Drop set absent: `grep -L 'byteCount'` lists all four drop tools (no matches in any).
- Keep components untouched: `git diff --name-only` lists none of the five keep-tool component files.
- Zero new runtime dependencies (native-only; presentational change).

### Deferred to phase boundary (per binding harness / executor environment)
- `/codex:review` (`--wait --scope working-tree`) and the **real-WKWebView UI verification** (`scripts/e2e-spike.sh` against `tauri dev`): Hash/UUID/Unix Time/JWT status bars show NO size text; Base64/Protobuf/both Formatters STILL show the size readout. Plus the phase-boundary `gsd-ui-review` WCAG-AA audit + human sign-off on a fresh `tauri build`. The unit gates (vitest + tsc + eslint) are all green here.

## Known Stubs

None.

## Self-Check: PASSED

- SUMMARY.md: created at the expected path.
- Commits c57edb55, 0c831e7f, 4b61ddf0: all present in `git log`.
