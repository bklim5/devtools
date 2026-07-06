---
phase: 32-prettier-esbuild-engine-async-seam
plan: 02
subsystem: ui
tags: [async, hook, debounce, latest-wins, react, formatter]

# Dependency graph
requires:
  - phase: 32-01
    provides: "async FormatResult contract (Promise<FormatResult>) the runner returns"
provides:
  - "src/shell/useAsyncFormat.ts — shared latest-wins async formatting hook (debounce + reqId gate + pending)"
  - "the single async-plumbing seam P33 (HTML) + P34 (JS/TS) tools (and any retrofitted JSON/XML) consume"
affects: [33-html-prettifier, 34-js-ts-prettifier, formatterview-generalization]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "regex-tool reqId latest-wins gate WITHOUT the worker (plain async runner)"
    - "derive-empty-state + adjust-state-during-render to avoid setState-in-effect cascades"

key-files:
  created:
    - src/shell/useAsyncFormat.ts
    - src/shell/useAsyncFormat.test.tsx
  modified: []

key-decisions:
  - "DEBOUNCE_MS = 180 (D-02 150–200ms window)"
  - "Empty state DERIVED at render + stale pending reset during render, not setState-in-effect (eslint react-hooks/set-state-in-effect + regex precedent)"
  - "Single effect cleanup bumps reqId on both re-run and unmount — no separate unmount effect needed"

patterns-established:
  - "useAsyncFormat<O>(input, opts, runner) → { result, pending }: the shared async formatter seam"
  - "reqId monotonic gate protects ordering independently of debounce; last-good output stays visible while pending"

requirements-completed: [PRT-03]

# Metrics
duration: 12min
completed: 2026-07-01
---

# Phase 32 Plan 02: Shared Latest-Wins Async Format Hook Summary

**`useAsyncFormat(input, opts, runner) → { result, pending }` — a 180ms-debounced, reqId-gated async formatting hook (regex cancellation discipline minus the worker) that keeps last-good output visible, resets cleanly on empty, and drops stale/out-of-order resolves; proven by an inverted-timing stale-drop test.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-01T13:43:00Z
- **Completed:** 2026-07-01T13:49:00Z
- **Tasks:** 1 (TDD, landed GREEN with impl)
- **Files modified:** 2 (both created)

## Accomplishments
- `src/shell/useAsyncFormat.ts` — the single shared async-plumbing hook both P33/P34 prettier tools will consume: 180ms debounce, monotonic `reqIdRef` latest-wins gate, `pending` flag, last-good output retained while pending, empty/whitespace reset that drops in-flight work and never calls the runner.
- 7 tests covering every `<behavior>` bullet, especially the load-bearing out-of-order-resolution stale-drop (earlier call resolving AFTER the later call does not overwrite newer output — T-32-04) and unmount cleanup (no setState-after-unmount — T-32-05).
- No worker/terminate/watchdog (ARCHITECTURE.md §3 — Prettier/esbuild parse is linear/freeze-free); grep-confirmed absent.

## Task Commits

1. **Task 1: useAsyncFormat hook with reqId latest-wins gate + pending (RED→GREEN)** — `47799569` (feat)

_TDD landed GREEN in one commit — lefthook rejects failing RED-only commits (memory: tdd-red-commits-blocked-by-lefthook)._

## Files Created/Modified
- `src/shell/useAsyncFormat.ts` — the shared latest-wins async formatting hook (debounce + reqId gate + pending; derived empty state).
- `src/shell/useAsyncFormat.test.tsx` — jsdom `renderHook`/`act` + fake timers + a hand-resolved deferred runner; locks stale-drop ordering, pending lifecycle, last-good visibility, empty reset, and unmount cleanup.

## Decisions Made
- **DEBOUNCE_MS = 180** — mid-window of the D-02 150–200ms range.
- **Empty state derived, not set in the effect** — see Deviations (eslint `react-hooks/set-state-in-effect` is an error here; the regex tool derives its neutral state for the same reason).
- **Single effect cleanup bumps `reqId`** on both re-run and unmount, so a separate unmount effect is unnecessary; the in-flight resolve is superseded the moment input changes or the component unmounts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Empty-state reset restructured to avoid `react-hooks/set-state-in-effect` (lint error, blocks commit)**
- **Found during:** Task 1 (first commit attempt — lefthook lint stage)
- **Issue:** The plan's `<action>` prescribed calling `setResult(EMPTY_OK)` + `setPending(false)` synchronously inside the effect's empty branch. The repo's eslint config treats `react-hooks/set-state-in-effect` as an **error** (not a warning), so lefthook rejected the commit — the same synchronous-setState-in-effect cascade the regex tool explicitly avoids by deriving its neutral state from the inputs.
- **Fix:** Derive the empty result at render (`result: isEmpty ? EMPTY_OK : resolved`) and reset a stale `pending` during render via the documented React "adjust state during render" pattern (`if (isEmpty && pending) setPending(false)`, one-shot guarded by `pending`). Only the async run's own resolve/reject (in timer/promise callbacks, not the effect body) call setState. Folded the former separate unmount effect into the single effect's cleanup (which already bumps `reqId`). All 7 tests still pass; behavior is identical (all `<behavior>` bullets and `<acceptance_criteria>` satisfied).
- **Files modified:** src/shell/useAsyncFormat.ts
- **Verification:** `pnpm exec vitest run` 7/7 green; `pnpm exec eslint` 0 errors; lefthook GREEN on the commit.
- **Committed in:** `47799569` (Task 1 commit)

**2. [Rule 3 - Blocking] Suppressed a spurious `react-hooks/exhaustive-deps` warning on the intentional cleanup `reqIdRef.current++`**
- **Found during:** Task 1 (post-restructure lint)
- **Issue:** eslint warns "the ref value 'reqIdRef.current' will likely have changed by cleanup time" — a false positive: `reqIdRef` is a monotonic COUNTER, not a DOM-node ref, and I deliberately want the latest value at cleanup time to supersede any in-flight run.
- **Fix:** `// eslint-disable-next-line react-hooks/exhaustive-deps` with a justifying comment. (Not commit-blocking — a warning — but suppressed to keep the file clean, matching the regex precedent's cleanup pattern.)
- **Files modified:** src/shell/useAsyncFormat.ts
- **Verification:** `pnpm exec eslint` 0 problems on the file.
- **Committed in:** `47799569` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking, lint-driven)
**Impact on plan:** Both are lint-conformance restructurings that preserve the exact specified behavior — no scope creep, all acceptance criteria met. The empty-state derivation is arguably cleaner than the plan's synchronous-setState sketch (matches the regex-tool precedent the plan itself cites).

## Issues Encountered
None beyond the two lint deviations above (resolved before the successful commit).

## Threat Flags
None — this is a pure client-side hook; no new network endpoint, auth path, file access, or schema surface. T-32-04 (stale-result overwrite) and T-32-05 (setState-after-unmount) are both mitigated and test-locked.

## Known Stubs
None — the hook is fully wired to the runner it is given; no placeholder data or hardcoded empty flows.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The shared async seam is ready. P33 (HTML) and P34 (JS/TS) tools import `useAsyncFormat` and pass `formatHtml`/`formatScript` (from 32-01) as the runner; the retrofitted JSON/XML can adopt it if they ever go async.
- **Harness note (NOT auto-run by the executor):** per the binding harness this plan's `/simplify` → `/code-review xhigh` → `/codex:adversarial-review` → real-WKWebView UI verification run at the Phase-32 boundary. This plan is a pure hook with no UI/native surface of its own yet (it is exercised through the P33/P34 tools + FormatterView generalization); the chunk-split/offline proofs land in 32-05.

---
*Phase: 32-prettier-esbuild-engine-async-seam*
*Completed: 2026-07-01*
