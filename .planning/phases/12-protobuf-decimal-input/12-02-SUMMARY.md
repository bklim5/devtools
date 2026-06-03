---
phase: 12-protobuf-decimal-input
plan: 02
subsystem: protobuf-decoder
tags: [protobuf, ui, decimal, input-encoding, toggle, e2e, wkwebview, wcag-aa]

# Dependency graph
requires:
  - phase: 12-protobuf-decimal-input (Plan 12-01)
    provides: "decimalToBytes parse layer + comma-first detectEncoding + three-way useDecode switch + widened InputEncoding union ('hex' | 'base64' | 'decimal')"
  - phase: 03-protobuf-hero
    provides: "encoding override toggle (active-segment-is-readout pattern) + EXAMPLES chips + ProtobufDecoder shell"
provides:
  - "decimal segment in the ProtobufDecoder encoding override toggle (D-08, active-segment-is-the-readout, no duplicate detected-mode chip)"
  - "generic-value EXAMPLES array (renamed hex→value) with the decimal example chip '10, 3, 80, 81, 82' (D-10)"
  - "placeholder + empty-state hint updated to mention decimal (D-09)"
  - "real-WKWebView e2e coverage of decimal decode + the 1,2,999 named-error anchor; component-layer coverage of aria-pressed + role=alert"
affects: [13-url-tool, 14-regex-tester, 15-cron-tool]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Active-segment-is-the-readout: the third toggle segment plugs into OVERRIDES.map with zero render-logic change; the accented active segment IS the detected-mode indicator (no duplicate chip)"
    - "Generic-value EXAMPLES: renamed the hex-specific field to a neutral `value` so format-diverse example chips (hex + decimal) coexist without the field name lying"
    - "DOM/a11y is the gate, screenshots are preview: e2e + component tests assert aria-pressed / role=alert / accent-on-active, not pixels"

key-files:
  created: []
  modified:
    - src/tools/protobuf-decoder/ProtobufDecoder.tsx
    - test/e2e/protobuf-decoder.e2e.ts
    - src/tools/protobuf-decoder/ProtobufDecoder.test.tsx

key-decisions:
  - "Reused the existing active-segment-is-readout toggle pattern verbatim: adding 'decimal' to OVERRIDES needed no render change — the third segment becomes the accented active readout when decodeInput returns encoding:'decimal', and clicking it clears back to auto-detect (D-08, no duplicate detected-mode chip)"
  - "Renamed EXAMPLES' `hex` field to generic `value` so a decimal example chip sits beside hex chips without the field name lying; no lingering ex.hex reference"
  - "Kept all assertions DOM/aria/text-based (aria-pressed, role=alert, accent-on-active) per the project's real-WKWebView UI gate — screenshots are preview-only"

patterns-established:
  - "Adding an input-encoding mode to the hero is additive: widen the union (12-01) → append to OVERRIDES → the toggle picks it up automatically"
  - "Format-diverse example chips share one generic-value EXAMPLES array keyed by unique label"

requirements-completed: [PRO-08, PRO-09]

# Metrics
duration: 1min
completed: 2026-06-03
---

# Phase 12 Plan 02: Decimal UI Mode Summary

**Surfaced the decimal input mode in the Protobuf hero UI — a `decimal` segment in the encoding toggle (active-segment-is-the-readout, no duplicate chip), a `10, 3, 80, 81, 82` example chip on a generic-`value` EXAMPLES array, a decimal-aware placeholder/empty-state, and named-token inline errors — verified on the real WKWebView with `decoder.ts` + its 19 tests byte-for-byte untouched and a 24/24 WCAG-AA sign-off.**

## Performance

- **Duration:** ~1 min (wrap-up; Tasks 1–2 + review gate executed in the prior session)
- **Completed:** 2026-06-03
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint, APPROVED)
- **Files modified:** 3

## Accomplishments
- Added `"decimal"` as a third segment to the `OVERRIDES` encoding toggle (D-08): it plugs into the existing `OVERRIDES.map` with zero render-logic change and becomes the accented active readout when `decodeInput` returns `encoding: "decimal"`; clicking the active segment clears back to auto-detect (PRO-08's visible, overridable detected-mode indicator — no duplicate chip).
- Refactored the `EXAMPLES` array from a hex-specific `hex` field to a generic `value` field and appended the canonical decimal chip `{ label: "decimal bytes", value: "10, 3, 80, 81, 82" }` (D-10); updated the textarea placeholder and empty-state hint to mention decimal (D-09).
- Extended `test/e2e/protobuf-decoder.e2e.ts` with real-WKWebView coverage: pasting `10, 3, 80, 81, 82` lights the decimal segment as the active readout and decodes; pasting `1, 2, 999` surfaces a `role=alert` inline error naming `999` (range/decimal, NOT base64) with the tool still responsive (PRO-09, T-12-05 mitigated).
- Added component-layer coverage in `ProtobufDecoder.test.tsx` (review-gate addition): aria-pressed lights to `true` + `text-accent` on a comma array; out-of-range surfaces the named decimal error via `role="alert"`, never base64.
- Full suite green (522/522 vitest), `tsc --noEmit` clean; `decoder.ts` + its 19 tests verified byte-for-byte untouched (`git diff --quiet` across the whole plan).
- **Phase-boundary sign-off APPROVED:** `gsd-ui-review` reported **24/24, WCAG-AA PASS** (written to `12-UI-REVIEW.md`, committed `8554a625`); the human approved the manual `tauri build` walkthrough (decimal decode, clearable override, `1,2,999` non-crashing named error, example chip, space-only D-03 behavior).

## Task Commits

Each task was committed atomically:

1. **Task 1: Decimal segment + decimal example chip + placeholder** - `6ccbf365` (feat: surface decimal input mode in Protobuf hero UI)
2. **Task 2: Extend the protobuf-decoder e2e spec for decimal mode** - `50274e4e` (test: cover decimal input mode on the real WKWebView)
   - Review-gate addition: `cd16e61a` (test: cover decimal mode at the component layer)
3. **Task 3: Human sign-off on tauri build + gsd-ui-review (phase boundary)** - **APPROVED**. `gsd-ui-review` 24/24 WCAG-AA PASS written to `12-UI-REVIEW.md` (`8554a625`); manual build walkthrough approved by the user. (Checkpoint — no feature code.)

**Plan metadata:** this docs commit (SUMMARY + STATE + ROADMAP + REQUIREMENTS).

## Files Created/Modified
- `src/tools/protobuf-decoder/ProtobufDecoder.tsx` — Added `"decimal"` to `OVERRIDES`; renamed `EXAMPLES` `hex`→`value` and appended the `10, 3, 80, 81, 82` decimal chip; updated the placeholder and empty-state hint to mention decimal.
- `test/e2e/protobuf-decoder.e2e.ts` — Appended decimal coverage: canonical-array decode + decimal-segment active-readout, the `1, 2, 999` named-error anchor (role=alert, names 999, not base64, no crash), and the example-chip load.
- `src/tools/protobuf-decoder/ProtobufDecoder.test.tsx` — Component-layer assertions (aria-pressed + accent-on-active on a comma array; named decimal `role="alert"` on out-of-range) added during the review gate.

## Decisions Made
- **Active-segment-is-the-readout reuse:** the decimal segment needed no new render logic — adding it to `OVERRIDES` was sufficient because the toggle already maps over the array with `active = result.encoding === enc`. This avoids a duplicate detected-mode chip (D-08) and keeps the surface minimal.
- **Generic `value` EXAMPLES field:** renaming `hex`→`value` lets a decimal example chip coexist with hex chips without a misleading field name; unique labels keep `key={ex.label}` valid.
- **DOM/a11y as the gate:** all new e2e and component assertions are aria/role/text-based (aria-pressed, role=alert, accent class), matching the project's real-WKWebView UI gate — Chromium screenshots are preview-only.

## Deviations from Plan

None — plan executed exactly as written. (One in-scope addition during the `/codex:review` gate: component-layer tests in `ProtobufDecoder.test.tsx` — `cd16e61a` — strengthening the aria-pressed / role=alert coverage below the e2e level. This is the review gate doing its job, not a deviation from the plan's contract.)

## Issues Encountered
None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness
- **Phase 12 is COMPLETE.** Both plans done (12-01 parse layer, 12-02 UI mode), phase boundary signed off (24/24 WCAG-AA PASS + approved `tauri build` walkthrough). PRO-08 and PRO-09 delivered end-to-end on the real WKWebView. `decoder.ts` + its 19 tests remain byte-for-byte untouched (the immovable bar), confirmed by `git diff --quiet`.
- Phases 13 (URL), 14 (Regex), 15 (Cron) are independent and may be planned in any order; recommended risk order 13 → 14 → 15. Phases 14 and 15 should each run `/gsd-research-phase` before planning.
- No blockers.

## Self-Check: PASSED

- Commits present in git history: `6ccbf365` (feat), `50274e4e` (test), `cd16e61a` (test review gate), `8554a625` (UI review docs) — all FOUND via `git log`.
- Key files present on disk: `src/tools/protobuf-decoder/ProtobufDecoder.tsx`, `test/e2e/protobuf-decoder.e2e.ts`, `src/tools/protobuf-decoder/ProtobufDecoder.test.tsx`, `.planning/phases/12-protobuf-decimal-input/12-UI-REVIEW.md` — all FOUND.
- `decoder.ts` + `decoder.test.ts` byte-for-byte untouched across the plan (`git diff --quiet a61a5a62 HEAD -- src/lib/protobuf/decoder.ts src/lib/protobuf/decoder.test.ts` clean); 19 decoder tests intact.

---
*Phase: 12-protobuf-decimal-input*
*Completed: 2026-06-03*
