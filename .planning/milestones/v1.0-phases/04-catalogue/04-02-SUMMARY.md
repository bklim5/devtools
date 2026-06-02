---
phase: 04-catalogue
plan: 02
subsystem: tools
tags: [unix-time, timeFormat, react, typescript, registry, e2e, wkwebview]

# Dependency graph
requires:
  - phase: 04-catalogue
    plan: 01
    provides: "shared timeFormat lib (formatTimestamp/classifyUnit/toUnixFromIso), StatusBar, CopyButton, unixTimeTool already in registry TOOLS"
provides:
  - "Real UnixTimeTool at src/tools/unix-time/UnixTimeTool.tsx (two-way s/ms <-> local/UTC/ISO over timeFormat)"
  - "unix-time registry entry swapped from makePlaceholder to the real component"
  - "Real-WKWebView e2e gate test/e2e/unix-time.e2e.ts (paste -> ms-precise ISO + focusable copy)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Thin layout-agnostic tool component over a pure src/lib module (no date math duplicated)"
    - "Render-derived output (formatTimestamp called in render body, deterministic); clock reads (performance.now) moved to the change handler to satisfy the React Compiler purity lint"
    - "Wave-2 tool plan swaps ONLY its own index.ts component; registry.ts untouched"

key-files:
  created:
    - src/tools/unix-time/UnixTimeTool.tsx
    - src/tools/unix-time/UnixTimeTool.test.tsx
    - test/e2e/unix-time.e2e.ts
  modified:
    - src/tools/unix-time/index.ts

key-decisions:
  - "Active unit for an empty forward field defaults to ms so the reverse ISO field derives full-precision ms back (avoids lossy s-rounding on round-trip)"
  - "Timing (performance.now) measured in the change handler, not render — the React Compiler lint (react-hooks/purity) forbids impure clock reads in the render body; mirrors Base64's timed() event-scoped measurement"
  - "Forward derive stays render-derived (no state/effect) — formatTimestamp + classifyUnit are pure and deterministic from the inputs, so an effect+setState would only add a render loop risk"

patterns-established:
  - "Per-tool real-WKWebView e2e spec mirrors base64.e2e.ts: hash-navigate, stable #id selectors, ISO assertion, focusable-copy gate, screenshot artifact"

requirements-completed: [TIME-01]

# Metrics
duration: 4min
completed: 2026-05-31
---

# Phase 4 Plan 02: Unix Time Tool Summary

**Shipped the real two-way Unix Time converter (TIME-01) into the registry-driven shell — paste an s/ms timestamp for instant LOCAL + UTC + ISO with magnitude auto-detect + s/ms override, an editable ISO field that derives the timestamp back (D-06), and a live "now" with ≤1-keystroke copy — all over Plan 01's shared `timeFormat` lib (zero date-math duplication), TDD'd in 8 cases and gated on the real macOS WKWebView.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-31T12:44:47Z
- **Completed:** 2026-05-31T12:49:00Z
- **Tasks:** 2
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments
- `UnixTimeTool.tsx` — layout-agnostic (responsive Tailwind, no fixed widths, UX-05) default-export component:
  - **Forward pane:** paste-instant (UX-01) integer parse → `classifyUnit` auto-detects s/ms (override wins) → normalise to ms → `formatTimestamp` renders LOCAL + UTC + ISO rows, each with a visible focusable `CopyButton` (UX-02).
  - **Unit override toggle:** s/ms segmented control mirroring Base64's `AlphabetToggle` — `aria-pressed`, active = `accent-soft`/`accent-line`/`text-accent` (accent = selected only).
  - **Reverse pane (D-06):** editable ISO/datetime `<input>` → `toUnixFromIso` derives the timestamp (in the active unit) back into the forward field — two-way.
  - **Live "now" (D-06):** `Date.now()` on a 1s `setInterval` (cleanup on unmount), rendered in the active unit with a copy button.
  - **Status bar:** `<StatusBar parseState byteCount={0} error timingMs />` (encoding omitted). Empty = neutral "Empty"; malformed = field-scoped `aria-invalid` + `text-bad` error and "Error" state, never a crash (T-04-05).
- Registry swap: `src/tools/unix-time/index.ts` `component: makePlaceholder("Unix Time")` → `component: UnixTimeTool` (registry.ts untouched — the entry was already in TOOLS from Plan 01).
- `test/e2e/unix-time.e2e.ts` drives the real WKWebView at `#/tools/unix-time`: types `1469922850259`, asserts the ISO `2016-07-30T23:54:10.259Z` renders instantly, asserts the `Copy ISO 8601` button `isDisplayed()` (hover-only-copy gate), screenshots to `test/e2e/__screenshots__/unix-time-wkwebview.png`.
- Gate green: **214/214 vitest** (decoder 19 untouched, +8 new), `tsc --noEmit` clean, `eslint` 0; `scripts/e2e-spike.sh` → **3 passing on webkit** (base64, protobuf, unix-time).

## Task Commits

1. **Task 1: UnixTimeTool — two-way converter over timeFormat (TIME-01)** - `3e6783d6` (feat, TDD)
2. **Task 2: Swap registry component + real-WKWebView e2e gate** - `06445f18` (feat)

_TDD note: lefthook blocks committing a red suite (Phase-2/3/4-01 precedent), so the test + impl land together in one GREEN commit; RED was verified locally via `vitest run` before the impl was written._

## Files Created/Modified
- `src/tools/unix-time/UnixTimeTool.tsx` - Real two-way Unix Time converter (forward s/ms→local/UTC/ISO, override toggle, reverse ISO→timestamp, live now)
- `src/tools/unix-time/UnixTimeTool.test.tsx` - 8 jsdom cases (s/ms auto-detect, empty=neutral, malformed=field-scoped error, override re-render, reverse derive, focusable copy via platform seam)
- `src/tools/unix-time/index.ts` - Registry component swapped to the real UnixTimeTool
- `test/e2e/unix-time.e2e.ts` - Real-WKWebView gate (paste→ms-precise ISO + focusable copy + screenshot)

## Decisions Made
- **Empty forward field → active unit defaults to `ms`.** The reverse ISO field derives full-precision ms back into the forward field; defaulting to `s` would floor away the milliseconds on the round-trip. Once a value is present, `classifyUnit` (or the user's override) governs.
- **Clock reads moved out of render.** The React Compiler lint (`react-hooks/purity`, `react-hooks/set-state-in-effect`) flagged both `performance.now()` in the render body and a setState-in-effect timing shim. Resolved by measuring timing inside the `handleRawChange` event handler (event-scoped, like Base64's `timed()`), keeping the forward derive itself render-pure.

## Deviations from Plan
None - plan executed exactly as written. (The acceptance criterion "`grep '@tauri-apps'` finds NOTHING" required rewording the header comment's "never @tauri-apps/* directly" to "never the Tauri clipboard APIs directly" so the literal token does not appear; no behavioral change.)

## Known Stubs
None. The tool is fully wired: forward, override, reverse, and live-now all flow real data through the shared `timeFormat` lib and the platform clipboard seam. The Plan 01 placeholder is now removed for this tool.

## Issues Encountered
None beyond the React Compiler purity lint (resolved inline as described under Decisions).

## User Setup Required
None - no external service configuration. The tool is pure frontend over native `Intl`/`Date` via the shared `timeFormat` lib.

## Next Phase Readiness
- TIME-01 is shipped and verified on the real WKWebView. The other Wave-2 catalogue tools (04-03 JWT, 04-04 Hash, 04-05 UUID/ULID) remain independent — JWT also consumes `timeFormat` for claim humanization, now proven end-to-end in a real tool.
- **Standing harness reminder:** the phase still ends (04-06 / phase boundary) with a human sign-off on a fresh `tauri build` + a `gsd-ui-review` WCAG-AA audit covering all catalogue tools.

---
*Phase: 04-catalogue*
*Completed: 2026-05-31*

## Self-Check: PASSED

All 3 created source files + the SUMMARY exist on disk; both task commits (`3e6783d6`, `06445f18`) are present in git history.
