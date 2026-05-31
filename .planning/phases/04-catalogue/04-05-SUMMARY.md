---
phase: 04-catalogue
plan: 05
subsystem: tools
tags: [uuid, ulid, uuidv7, crypto, generate, decode, react, typescript]

# Dependency graph
requires:
  - phase: 04-catalogue
    plan: 01
    provides: "Pure ulid.ts/uuidv7.ts (generate*/decode*), CopyButton, StatusBar, timeFormat, bytes.ts, registry placeholder entry"
provides:
  - "decodeId (src/tools/uuid-ulid/decodeId.ts): auto-detect UUID vs ULID + full breakdown, never-throw boundary"
  - "UuidUlidTool (src/tools/uuid-ulid/UuidUlidTool.tsx): generate v4/v7/ULID (on-open + 1-keystroke regen + batch + copy-all) + decode UI"
  - "Real UUID/ULID tool wired into the registry-driven shell at #/tools/uuid-ulid (placeholder swapped)"
affects: [04-06-phase-boundary]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Generate-on-open via a lazy useState initializer (NOT a mount effect — the React Compiler lint forbids setState-in-effect; mirrors the clock-purity fixes in 04-02/04-03)"
    - "Detect-then-delegate: decodeId only shapes-checks + routes to the Plan-01 decode libs, adding no parsing of its own"

key-files:
  created:
    - src/tools/uuid-ulid/decodeId.ts
    - src/tools/uuid-ulid/decodeId.test.ts
    - src/tools/uuid-ulid/UuidUlidTool.tsx
    - src/tools/uuid-ulid/UuidUlidTool.test.tsx
    - test/e2e/uuid-ulid.e2e.ts
  modified:
    - src/tools/uuid-ulid/index.ts

key-decisions:
  - "Generate-on-open uses the lazy useState initializer, not a mount effect — the on-open id is produced purely and the React Compiler set-state-in-effect lint stays satisfied"
  - "decodeId normalizes a ULID to uppercase before calling decodeUlid (Plan-01 decodeUlid is case-sensitive Crockford); the UUID shape is matched case-insensitively"

requirements-completed: [UID-01]

# Metrics
duration: 5min
completed: 2026-05-31
---

# Phase 4 Plan 05: UUID / ULID Tool Summary

**Shipped the UUID/ULID tool (UID-01) into the registry — a pure `decodeId` that auto-detects a pasted UUID vs ULID and returns a full breakdown (or an explicit no-throw error), plus a `UuidUlidTool` UI that generates UUID v4 / v7 / ULID (one on open, single-keystroke regen, optional batch + copy-all) from a CSPRNG and decodes ids live — consuming the Plan-01 `ulid.ts`/`uuidv7.ts` libs verbatim with zero duplication.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-31T13:07:50Z
- **Completed:** 2026-05-31T13:12:15Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 6 (5 created, 1 modified)

## Accomplishments
- **`decodeId.ts` (D-17):** a `{empty|error|ok uuid|ok ulid}` discriminated union that trims input, shape-matches the 8-4-4-4-12 UUID layout (case-insensitive) or the 26-char Crockford ULID, and delegates to Plan-01 `decodeUuid`/`decodeUlid`. Wrapped so it NEVER throws past the boundary (T-04-14) — wrong length, bad hex nibble, out-of-alphabet char (I/L/O/U), and a generic non-id all return an explicit `kind:"error"`.
- **`UuidUlidTool.tsx` (D-15/D-16/D-17):** a kind toggle (UUID v4 / UUID v7 / ULID, accent = selected only, aria-pressed) + a count input; ONE id generated on open via a lazy `useState` initializer; a default-focused **Generate** button regenerates in ≤1 keystroke; count>1 → N freshly-generated rows each with its own visible focusable `CopyButton` + a **Copy all** (newline-joined). A decode field runs `decodeId` on every change (paste-instant) → a breakdown (UUID: type/version/variant + humanized embedded ts for v7; ULID: humanized ts + randomness hex), empty neutral, malformed = a single field-scoped `aria-invalid`+`text-bad` error. Generation is `crypto.randomUUID` (v4) + the Plan-01 CSPRNG libs (v7/ULID) — never a non-crypto PRNG (T-04-15); clipboard via the platform seam only.
- **Registry swap:** `index.ts` `makePlaceholder("UUID / ULID")` → real `UuidUlidTool` (registry.ts untouched, per the Wave-1 concentration rule).
- **Real-WKWebView gate ADDED + GREEN:** `test/e2e/uuid-ulid.e2e.ts` asserts an id is generated on open (the secure-context check for `crypto.randomUUID`/`getRandomValues`, A1), the Copy affordance is displayed, Generate produces a different id, and a pasted ULID's decoded 2016 timestamp renders. `bash scripts/e2e-spike.sh` → **6 passing on webkit** (base64, hash, jwt, protobuf, unix-time, uuid-ulid).
- Suite grew 247 → **269** (decoder 19 untouched, +22 new: 10 decodeId + 12 tool), tsc clean, eslint 0.

## Task Commits

1. **Task 1: decodeId pure module — auto-detect + breakdown (D-17)** — `527c84f5` (feat, TDD test+impl together)
2. **Task 2: UuidUlidTool UI + registry swap + real-WKWebView e2e (UID-01)** — `1da64bbd` (feat, TDD test+impl together)

_TDD note: lefthook blocks committing a red suite (Phase-2/3/4 precedent), so each TDD task's test + impl land together in one GREEN commit; RED was verified locally via `vitest run` before writing the impl (Task 1 RED confirmed: "no tests / module not found")._

## Files Created/Modified
- `src/tools/uuid-ulid/decodeId.ts` (+`.test.ts`) — auto-detect UUID vs ULID + breakdown; no-throw boundary; consumes Plan-01 `decodeUuid`/`decodeUlid`
- `src/tools/uuid-ulid/UuidUlidTool.tsx` (+`.test.tsx`) — generate (v4/v7/ULID, on-open + regen + batch + copy-all) + decode UI; consumes Plan-01 `generateUlid`/`generateUuidV7` + native `crypto.randomUUID`
- `src/tools/uuid-ulid/index.ts` — `component` swapped placeholder → `UuidUlidTool`; `makePlaceholder` import removed
- `test/e2e/uuid-ulid.e2e.ts` — real-WKWebView gate (on-open gen, Generate-changes, decoded ULID ts)

## Decisions Made
- **Generate-on-open via a lazy `useState` initializer, not a mount effect.** `useState(() => generateBatch("uuid-v4", 1))` produces the on-open id purely; a `useEffect(() => setIds(...), [])` tripped the React Compiler `react-hooks/set-state-in-effect` lint (the same purity class 04-02/04-03 hit with the clock). The lazy initializer is both simpler and lint-clean, and the unit test still asserts an id is present immediately on render.
- **`decodeId` uppercases a ULID before `decodeUlid`.** Plan-01's `decodeUlid` is case-sensitive (uppercase Crockford); the tool accepts a lowercase-typed ULID by normalizing in the shape-matched branch. The UUID branch is matched case-insensitively and passed through (`decodeUuid` already accepts mixed case).

## Deviations from Plan

None — the plan executed as written. Two adjustments were anticipated discretion within the plan, not deviations:
- The on-open generation was implemented with a lazy initializer rather than the plan's suggested `useEffect` once, because the project's React Compiler lint forbids setState-in-effect (a known, documented constraint from 04-02/04-03). Behavior is identical (one id on open) and all `<behavior>` assertions pass.
- A comment containing the literal phrase "Math.random" was reworded to "a non-crypto PRNG" so the acceptance-criteria grep (`grep -E 'Math.random' … finds NOTHING`) passes cleanly; there was never an actual `Math.random` call.

## Known Stubs
None. The placeholder is fully replaced by the real `UuidUlidTool`; both pure modules are fully implemented and vector-tested. `grep makePlaceholder src/tools/uuid-ulid/index.ts` finds nothing.

## Issues Encountered
- **e2e first-run flake (pre-existing, out of scope):** the first `e2e-spike.sh` run reported "5 passed, 1 failed" — the documented intermittent `base64.e2e.ts` cold-start navigation flake (logged at 04-03 and 04-04). An immediate re-run was **6/6 green** including the new `uuid-ulid.e2e.ts`. Not this plan's code.

## User Setup Required
None — no external service configuration; generation uses native Web Crypto, present on the WKWebView (A1 confirmed for `crypto.subtle` in 04-04, and now for `crypto.randomUUID`/`getRandomValues` here).

## Next Phase Readiness
- All four catalogue tools (Unix Time, JWT, Hash, UUID/ULID) are now shipped over the Wave-1 foundation; **Wave 2 is complete**.
- **Next: `04-06` / phase boundary** — human sign-off on a fresh `tauri build` + a passing `gsd-ui-review` WCAG-AA audit covering the new tools.

---
*Phase: 04-catalogue*
*Completed: 2026-05-31*

## Self-Check: PASSED

All 5 created source files + the modified `index.ts` + the SUMMARY exist on disk; both task commits (`527c84f5`, `1da64bbd`) are present in git history. Full gate green at completion: 269/269 vitest (decoder 19 untouched), tsc clean, eslint 0, e2e 6/6 on webkit.
