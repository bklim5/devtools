---
phase: 03-hero-protobuf-encoding-ux-constraints
plan: 02
subsystem: protobuf-decoder
tags: [protobuf, typescript, tdd, pure-logic, hex, base64, json]

# Dependency graph
requires:
  - phase: 01-scaffold-harness-proof
    provides: "ported src/lib/protobuf/decoder.ts (FieldValue/LenInterpretation, decodeMessage) + src/lib/bytes.ts (hexToBytes/base64ToBytes)"
provides:
  - "detectEncoding(raw): 'hex' | 'base64' — pure D-02 classifier"
  - "chipsForField(field) + defaultChipId(field) — chips derived from the REAL decoder keys, D-04 precedence, smart default"
  - "decodeInput(raw, override?) — decode orchestration turning every error into a status string (PRO-01/02), neutral empty, manual override (D-01)"
  - "fieldsToJson(fields, selection) — copy-as-JSON serializer, field-numbers-as-keys + nested recurse (D-11)"
affects: [03-04-protobuf-ui, protobuf-decoder-rendering]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure logic core extracted from React: four node-unit-testable modules under src/tools/protobuf-decoder/"
    - "Chips bound STRICTLY to the real FieldValue/LenInterpretation keys (mockup keys never referenced)"
    - "Single try/catch boundary: bytes-conversion + decodeMessage both wrapped so nothing throws past decodeInput"
    - "Selection model keyed by node path ('<index>' / '<parentPath>.<index>') shared between chips, copy-JSON, and (later) the UI"

key-files:
  created:
    - src/tools/protobuf-decoder/detectEncoding.ts
    - src/tools/protobuf-decoder/detectEncoding.test.ts
    - src/tools/protobuf-decoder/interpretationChips.ts
    - src/tools/protobuf-decoder/interpretationChips.test.ts
    - src/tools/protobuf-decoder/useDecode.ts
    - src/tools/protobuf-decoder/useDecode.test.ts
    - src/tools/protobuf-decoder/copyAsJson.ts
    - src/tools/protobuf-decoder/copyAsJson.test.ts
  modified: []

key-decisions:
  - "LEN chip precedence locked as message > string > packed-varints > packed-i32 > packed-i64 > bytes(hex); default = first present (D-04)"
  - "Packed-* chip value = comma-joined per-element UNSIGNED reading (asUnsigned / asUint32); copyAsJson emits the same readings as an array"
  - "Repeated field numbers collect into a JSON array under that key in fieldsToJson"
  - "detectEncoding is import-free (classification only); the bytes conversion + its errors live in decodeInput"

patterns-established:
  - "Pure-node TDD: explicit { describe, it, expect } imports, default node env, type-only imports from decoder.ts"
  - "Error-as-string boundary: untrusted paste -> decodeInput never throws (threat T-03-03)"

requirements-completed: [PRO-01, PRO-02, PRO-03, PRO-04]

# Metrics
duration: ~6min
completed: 2026-05-31
---

# Phase 3 Plan 02: Protobuf Logic Core Summary

**Four pure, node-unit-tested modules (detectEncoding, chipsForField, decodeInput, fieldsToJson) that map the UI 1:1 onto the real decoder's FieldValue/LenInterpretation shape — hex/base64 detection (D-02), presence-gated chips with smart default (D-04), error-as-string decode orchestration (PRO-01/02), and copy-as-JSON (D-11) — all green before any rendering.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-31T01:22:00Z
- **Completed:** 2026-05-31T01:26:00Z
- **Tasks:** 3
- **Files modified:** 8 created (4 modules + 4 test suites)

## Accomplishments

- `detectEncoding` classifies hex vs base64 per D-02 (0x prefix, `[\s:_-]` separators, even-nibble rule, empty→base64), self-contained with zero imports.
- `chipsForField`/`defaultChipId` derive chips STRICTLY from the real `FieldValue`/`LenInterpretation` keys present, in the locked D-04 precedence order, with the correct smart default per node — VARINT exposes uint64/int64/sint(zigzag)/bool; LEN never emits a chip for an absent key.
- `decodeInput` wraps both bytes-conversion AND `decodeMessage` in one try/catch so groups/truncation/oversize/bad-bytes surface as an error STRING (never a thrown crash, threat T-03-03); empty is neutral; manual encoding override honoured (D-01); decode is timed.
- `fieldsToJson` serializes field-numbers-as-keys with each node's selected interpretation, recursing nested messages, collecting repeated field numbers into arrays — returns a string only (no `@tauri-apps`, no clipboard; threat T-03-05).

## Task Commits

Each task was committed atomically (TDD RED+GREEN landed together — lefthook blocks red suites, Phase-2 precedent):

1. **Task 1: detectEncoding heuristic (D-02)** - `06009dc2` (feat)
2. **Task 2: interpretationChips + smart default (D-04/D-06)** - `a1cb51d3` (feat)
3. **Task 3: useDecode orchestration + copyAsJson (PRO-01/02, D-11)** - `863f9b6e` (feat)

## Files Created/Modified

- `src/tools/protobuf-decoder/detectEncoding.ts` - Pure hex/base64 classifier (D-02), import-free.
- `src/tools/protobuf-decoder/detectEncoding.test.ts` - 7 cases (prefix/separators/even-nibble/empty/base64).
- `src/tools/protobuf-decoder/interpretationChips.ts` - `chipsForField` + `defaultChipId`; LEN precedence + presence-gating; scalar fixed chip sets.
- `src/tools/protobuf-decoder/interpretationChips.test.ts` - 8 cases (scalar chip lists + LEN precedence/presence/absent-key).
- `src/tools/protobuf-decoder/useDecode.ts` - `decodeInput` orchestration; single error boundary; neutral empty; override; timing.
- `src/tools/protobuf-decoder/useDecode.test.ts` - 9 cases (happy/empty/group/truncation/bad-bytes/override).
- `src/tools/protobuf-decoder/copyAsJson.ts` - `fieldsToJson` serializer; node-path selection; nested recurse; repeated→array.
- `src/tools/protobuf-decoder/copyAsJson.test.ts` - 7 cases (varint/message-recurse/string/bytes/packed/repeated/pretty).

## Decisions Made

- **LEN precedence locked** as message > string > packed-varints > packed-i32 > packed-i64 > bytes(hex); the default-selected chip is the first present per that order (D-04). `hex` is the always-present floor, so every LEN node has at least the "bytes" chip.
- **Packed-* chip `value`** is a compact comma-joined list of each element's UNSIGNED reading (`asUnsigned` for varints/fixed64, `asUint32` for fixed32). `copyAsJson` emits the same underlying readings as a JSON array, so the chip preview and the copied JSON never disagree.
- **Repeated field numbers** collect into a JSON array under that key in `fieldsToJson` (the wire format permits the same field number many times).
- **`detectEncoding` is import-free** — it only classifies; the actual conversion and its error handling live in `decodeInput`, keeping the classifier a pure shape-inspector.

## Deviations from Plan

None - plan executed exactly as written. The four modules and their RED→GREEN suites were implemented to the locked interfaces and acceptance criteria with no auto-fixes required.

## Issues Encountered

None during planned work. Two acceptance-criteria `grep` checks produced false-positive "FAIL" lines because the words "bytes", "@tauri-apps", and "clipboard" appear in the modules' explanatory comment prose (e.g. "does NOT import @tauri-apps"). Confirmed via `import`-line and comment-excluded greps that no such import or call exists in code — the criteria (self-contained classifier; no tauri/clipboard in copyAsJson) are genuinely satisfied.

## User Setup Required

None - no external service configuration required. This is a pure-logic plan.

## Next Phase Readiness

- The logic core is complete and fully unit-tested (49 tests across this plan's 5 suites; decoder's 19 still green). Plan **03-04** renders thin React components over `decodeInput`, `chipsForField`, and `fieldsToJson`, wiring the clipboard via the `src/lib/platform/` seam (the only place `platform.clipboard` is allowed).
- **Real-WKWebView UI verification of these behaviors is deferred to 03-04** (this plan ships no UI surface — the per-task harness's UI gate has nothing to render yet).
- Gate green: 131/131 vitest (decoder 19), tsc clean, eslint 0.

## Self-Check: PASSED

All four modules + four test suites exist on disk; all three task commits present in history (verified below).

---
*Phase: 03-hero-protobuf-encoding-ux-constraints*
*Completed: 2026-05-31*
