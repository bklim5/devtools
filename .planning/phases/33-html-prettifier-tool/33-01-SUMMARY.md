---
phase: 33-html-prettifier-tool
plan: 01
subsystem: infra
tags: [react-hooks, dos-guard, utf-8, prettier, esbuild, async-format]

# Dependency graph
requires:
  - phase: 32-prettier-esbuild-engine
    provides: useAsyncFormat (180ms debounce + latest-wins reqId gate + pending), FormatResult contract
provides:
  - "MAX_FORMAT_INPUT_BYTES (2 MB UTF-8) shared hard input cap on useAsyncFormat"
  - "utf8LenBounded — bounded UTF-8 counter that bails to null the instant bytes exceed the cap (no full encode), byte-for-byte == TextEncoder incl. unpaired surrogates via a low-surrogate pair-guard"
  - "Oversize short-circuit BEFORE the debounce/runner — over-cap paste never enters the Prettier/esbuild engine path (SC6 DoS mitigation)"
  - "useAsyncFormat now returns inputBytes (0 empty / undefined over-cap / engine count ok / bounded exact under-cap error) so consuming tools never re-encode byteLen(input)"
affects: [33-html-prettifier-tool, 34-js-ts-prettifier-tool]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bounded UTF-8 measurement (O(min(n,cap))) as a DoS-safe replacement for a full TextEncoder.encode when only an over/under-cap decision is needed"
    - "Hook-level size metadata (inputBytes) so a downstream tool reads size from the hook instead of recomputing it — eliminates the tool-seam over-cap re-encode by construction"

key-files:
  created: []
  modified:
    - src/shell/useAsyncFormat.ts
    - src/shell/useAsyncFormat.test.tsx

key-decisions:
  - "Cap is UTF-8 BYTES (2 MB), not input.length UTF-16 code units — closes the multibyte over-cap fall-through (4th Codex finding)"
  - "Surrogate pair-guard: consume a second code unit only for a genuine low surrogate (0xdc00–0xdfff); a lone high/low surrogate is 3 bytes and does not swallow the next unit — closes the malformed-surrogate under-count bypass (5th Codex finding)"
  - "Over-cap inputBytes is deliberately undefined (never measured exactly) so no consumer re-encodes a multi-MB over-cap paste"
  - "Static message 'Input too large (> 2 MB) — 2 MB max' (no exact X.X MB — the bounded counter never fully measures an over-cap input)"

patterns-established:
  - "Bounded-counter guard: measure only up to the cap, bail on cross, never a whole-string allocation for a reject decision"

requirements-completed: [PRT-04]

# Metrics
duration: 3min
completed: 2026-07-01
---

# Phase 33 Plan 01: Shared Large-Paste Size Guard Summary

**A default-on 2 MB UTF-8 size guard on `useAsyncFormat` that rejects an oversize paste (ASCII, multibyte, AND malformed-surrogate) via a bounded counter byte-for-byte equal to TextEncoder — never full-encoding the pathological input — before the Prettier/esbuild runner, plus a hook-returned `inputBytes` so consuming tools never re-encode.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-07-01T18:32:09Z
- **Completed:** 2026-07-01T18:35:11Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `MAX_FORMAT_INPUT_BYTES = 2_000_000` + an optional `maxInputBytes` param to `useAsyncFormat`, short-circuiting an over-cap paste to a stable `ok:false` "too large" result BEFORE the debounce/runner (SC6 / PRT-04 DoS mitigation at the shared seam both v1.9 Prettier tools consume).
- Implemented `utf8LenBounded` — a bounded UTF-8 counter that returns `null` the instant the running byte total exceeds the cap (O(min(n, cap)) work, never a full `TextEncoder.encode`), pair-guarded so it is byte-for-byte identical to TextEncoder for every input class including unpaired/lone surrogates.
- Widened the hook return to include `inputBytes` (`0` empty / `undefined` over-cap / engine count on ok / bounded exact count on under-cap error) so a consuming tool (Plan 03) reads size straight from the hook and never recomputes `byteLen(input)` on an over-cap paste.
- Added a 9-test `describe("size guard (SC6)")` suite proving 0 runner calls, the ok:false message, the multibyte no-full-encode invariant (TextEncoder identity spy), the malformed-surrogate bypass closure (real-encoder-verified fixture), unpaired-surrogate TextEncoder parity, and the full inputBytes mapping.

## Task Commits

Each task was committed atomically:

1. **Task 1: shared size-guard param + constant + bounded counter + inputBytes** - `915990c3` (feat)
2. **Task 2: SC6 guard test suite** - `b8fd9bfe` (test)

_Task 1 landed impl-first (not split into a standalone RED commit) because lefthook runs full tsc+vitest per commit and rejects a failing tree; the guard is additive so the pre-existing 7 tests stayed green at the Task-1 commit, and the SC6 suite landed green in Task 2._

## Files Created/Modified
- `src/shell/useAsyncFormat.ts` - Added `MAX_FORMAT_INPUT_BYTES`, `utf8LenBounded`, `OVERSIZE_RESULT`, the `maxInputBytes` param, the render-time oversize detection + effect early-return, and the `inputBytes` return field.
- `src/shell/useAsyncFormat.test.tsx` - Added an `err()` helper and the `describe("size guard (SC6)")` block (9 tests).

## Decisions Made
None beyond the plan — all four key decisions above were prescribed by the plan (byte-cap not code-unit, pair-guarded surrogates, undefined over-cap inputBytes, static message). Followed as specified.

## Deviations from Plan

None - plan executed exactly as written. No Rule 1–4 deviations; `src/lib/format/types.ts` (scope-locked) and `src/lib/protobuf/` (decoder + 19 tests) byte-for-byte untouched.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The shared guard + `inputBytes` metadata are in place; Plan 03 (HTML tool) can wire `byteCount = inputBytes` directly and drop any `byteLen(input)` call, and can add the tool-level `role=alert` surfacing + the interactive/offline WKWebView proof.
- Phase 34 (JS/TS) inherits the guard and the size-metadata plumbing verbatim with no re-implementation.
- Binding harness (`/simplify` → `/code-review xhigh` → `/codex:adversarial-review` → real-WKWebView UI verification) is orchestrator-run at the phase boundary — this plan is a pure hook change with no mounted UI surface of its own (exercised through the P33 tool).

## Self-Check: PASSED

- `src/shell/useAsyncFormat.ts` modified (verified via git)
- `src/shell/useAsyncFormat.test.tsx` modified (verified via git)
- Commit `915990c3` (Task 1 feat) — found
- Commit `b8fd9bfe` (Task 2 test) — found
- SUMMARY.md — found

---
*Phase: 33-html-prettifier-tool*
*Completed: 2026-07-01*
