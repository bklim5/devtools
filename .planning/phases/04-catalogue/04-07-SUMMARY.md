---
phase: 04-catalogue
plan: 07
subsystem: ui
tags: [hash, uuid, ulid, react, tailwind, ux-polish, gap-closure]

# Dependency graph
requires:
  - phase: 04-catalogue
    provides: "Hash tool (04-04), UUID/ULID tool (04-05), shared CopyButton (04-01)"
provides:
  - "Text-only Hash tool (no input-encoding selector; input always UTF-8)"
  - "Flicker-free Hash digest layout (five fixed-height rows from mount)"
  - "Editable UUID count field (transient empty allowed, normalized on blur)"
  - "Hard 100-cap on UUID batch generation across input/clamp/generateBatch"
  - "cursor-pointer on every Phase-4 interactive button"
affects: [04-catalogue human sign-off, Phase-5 packaged-build human verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "String-backed numeric input: hold the raw string in state, clamp-on-read for logic, normalize on blur — lets the user clear/retype freely (G-04-3)"
    - "Stable-layout rendering: always-mounted fixed-height row containers so typing swaps only inner text, never geometry (G-04-2)"
    - "Defense-in-depth bound: same cap (100) enforced at input max, clamp helper, and generation guard"

key-files:
  created: []
  modified:
    - "src/tools/hash/HashTool.tsx"
    - "src/tools/hash/HashTool.test.tsx"
    - "src/tools/uuid-ulid/UuidUlidTool.tsx"
    - "src/tools/uuid-ulid/UuidUlidTool.test.tsx"
    - "src/components/CopyButton.tsx"

key-decisions:
  - "Hash input is always UTF-8 text (G-04-1, supersedes D-11) — utf8ToBytes never throws, so the entire encoding selector + error path is deleted, not just hidden."
  - "All five Hash digest rows render from mount in min-h-[2.5rem] containers; the empty state shows blank rows (not row absence) so the layout never reflows (G-04-2)."
  - "UUID count is stored as a raw string (countText) and clamped on read via clampCount (1..100); onBlur normalizes empty/invalid back to a valid number (G-04-3)."
  - "Batch cap is 100 in three layers — input max={100}, clampCount, and generateBatch's Math.min(n, MAX_COUNT) (G-04-4); no 1000 literal remains."
  - "cursor-pointer added to the shared CopyButton base class covers every per-row copy in all four catalogue tools in one edit; tool-owned buttons (Generate, Copy-all, KindToggle, CasingToggle) got it directly (G-04-5)."

patterns-established:
  - "Clamp-on-read for editable numeric fields keeps the field text user-controlled while keeping the derived value bounded."
  - "Always-mounted fixed-height containers eliminate keystroke reflow without a fixed pixel width (stays layout-agnostic, UX-05)."

requirements-completed: [HASH-01, UID-01]

# Metrics
duration: ~5min (execution); +~2 builds for the real-WKWebView gate
completed: 2026-05-31
---

# Phase 4 Plan 07: Hash + UUID/ULID UAT Gap Closure Summary

**Closed the five Phase-4 human-UAT defects: text-only flicker-free Hash tool, an editable UUID count hard-capped at 100, and cursor-pointer on every Phase-4 button — all green on the full unit suite, tsc, eslint, and the 7-spec real-WKWebView gate.**

## Performance

- **Duration:** ~5 min execution (plus two real-WKWebView builds for the e2e gate)
- **Started:** 2026-05-31T21:17:25Z
- **Completed:** 2026-05-31T21:21:50Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- **G-04-1 (Hash text-only):** Deleted the hex/base64 input-encoding selector, the `parseInput` switch, the `EncodingToggle` component, the `encoding` state, and the entire error path. Input is now always parsed via `utf8ToBytes` (which never throws on a string).
- **G-04-2 (Hash stable layout):** All five digest rows (`MD5`, `SHA-1/256/384/512`) render from mount in fixed-height (`min-h-[2.5rem]`, `leading-5`) containers; typing swaps only the inner `<code>` text — no mount/unmount, no reflow, no flicker.
- **G-04-3 (UUID editable count):** Count state is now a raw string (`countText`); the field can be cleared to `""` and retyped without select-then-replace, normalized back to a valid number on blur.
- **G-04-4 (UUID cap at 100):** Hard-capped at 100 across `max={100}`, `clampCount`, and `generateBatch` (`Math.min(n, MAX_COUNT)`); no `1000` literal remains; no path can produce more than 100 entries.
- **G-04-5 (cursor-pointer):** Added to the shared `CopyButton` base class (covers every per-row copy across all four catalogue tools) plus the Generate, Copy-all, KindToggle, and CasingToggle buttons directly.

## Task Commits

Each task was committed atomically:

1. **Task 1: Hash text-only input (G-04-1) + stable flicker-free layout (G-04-2)** — `6d651626` (fix)
2. **Task 2: UUID editable count (G-04-3) + hard cap at 100 (G-04-4)** — `713d8c5b` (fix; also added cursor-pointer to KindToggle/Generate/Copy-all)
3. **Task 3: cursor-pointer on shared CopyButton (G-04-5)** — `1d2b9bfa` (fix)

_Note: TDD tasks 1 & 2 landed test + impl in one green commit — the binding lefthook gate forbids committing a red suite and `--no-verify` is disallowed (Phase 2-5 precedent)._

## Files Created/Modified

- `src/tools/hash/HashTool.tsx` — Removed the encoding selector/parse/error path; always-render five fixed-height digest rows from a stable `ALL_ALGOS` map.
- `src/tools/hash/HashTool.test.tsx` — Dropped the three encoding tests; the empty test now asserts status "Empty" + blank digest text (rows always present), not row absence.
- `src/tools/uuid-ulid/UuidUlidTool.tsx` — String-backed `countText` + `clampCount` (1..100), `onBlur` normalization, `MAX_COUNT=100` across input/clamp/generation; cursor-pointer on KindToggle/Generate/Copy-all.
- `src/tools/uuid-ulid/UuidUlidTool.test.tsx` — Added the "250 → 100" cap test and the "clear-to-empty field" test.
- `src/components/CopyButton.tsx` — Added `cursor-pointer` to the base button class.

## Decisions Made

None beyond the plan — the five gap fixes were executed exactly as specified. One minor naming choice: the 100 cap is a named `MAX_COUNT` constant rather than a bare `Math.min(n, 100)` literal, so all three enforcement layers reference one source of truth (the cap is still genuinely 100; grep confirms no `1000` remains and `Math.min` clamps to `MAX_COUNT`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Stale processes occupying the e2e ports/single-instance lock**
- **Found during:** Real-WKWebView verification gate (post-Task-3)
- **Issue:** The first e2e run failed because an orphaned vite dev server (PID 9358) held port 1420; the second failed because a stray packaged release `devtools-app` instance (PID 46684) was running — the single-instance plugin (registered first in `lib.rs`) made the dev binary focus-and-exit instead of binding the WebDriver port :4445. Both were leaks from prior sessions, not this plan's code.
- **Fix:** Killed the orphaned vite server and the stray release app; re-ran with `MAX_WAIT=300` to absorb the ~10s compile + launch.
- **Files modified:** None (environment only).
- **Verification:** `scripts/e2e-spike.sh` → **7 passing on webkit, 100% completed, WDIO exit 0**.
- **Committed in:** N/A (no code change).

---

**Total deviations:** 1 auto-fixed (1 blocking, environment-only). No code deviations.
**Impact on plan:** None on the code; the harness gate ran clean once the orphaned processes were cleared. No scope creep.

## Final Gate Numbers

- **vitest:** **276/276 passed** (full suite). Net −1 vs the prior 277 because the three removed Hash encoding tests are replaced by one consolidated empty-state test; the UUID suite gained two (cap + clearable field).
- **Decoder 19:** **19/19 passed** — `src/lib/protobuf/decoder.test.ts` byte-for-byte untouched.
- **tsc --noEmit:** clean.
- **eslint:** 0 errors.
- **Real WKWebView (`scripts/e2e-spike.sh`):** **7/7 specs passing on webkit** (base64, hash, jwt, protobuf-decoder, summon, unix-time, uuid-ulid) — confirming the stable-layout refactor kept the Hash `[data-algo] code`/SHA-256 selectors and the UUID count refactor left the generate/decode flow intact.
- **Grep audit:** no `@tauri-apps/*` import added to any tool; no `1000` in `UuidUlidTool.tsx`; no `INPUT_ENCODINGS`/`InputEncoding`/`EncodingToggle`/`hexToBytes`/`base64ToBytes` in `HashTool.tsx`; `cursor-pointer` present in `CopyButton.tsx` (1) + `UuidUlidTool.tsx` (3) + `HashTool.tsx` (1).

## Issues Encountered

Orphaned dev-server + stray packaged-app processes blocked the first two e2e attempts (see Deviations / Rule 3). Resolved by clearing them; the gate then passed clean.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All five UAT gaps (G-04-1..G-04-5) are closed and gated green on every automated layer.
- **Remaining step (verification debt):** the packaged-build human re-verification of the Hash and UUID/ULID tools. This folds into the deferred Phase-4 / Phase-5 human sign-off (user is AFK; will verify Phase 4 + Phase 5 together). The defects were UX-only and are now corrected in source; the human just needs to confirm on the packaged `.app`.
- No new blockers.

---
*Phase: 04-catalogue*
*Completed: 2026-05-31*

## Self-Check: PASSED

- FOUND: `.planning/phases/04-catalogue/04-07-SUMMARY.md`
- FOUND commit `6d651626` (Task 1 — Hash text-only + stable layout)
- FOUND commit `713d8c5b` (Task 2 — UUID editable count + cap 100)
- FOUND commit `1d2b9bfa` (Task 3 — cursor-pointer on CopyButton)
