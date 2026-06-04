---
phase: 15-cron-tool
plan: 04
subsystem: ui
tags: [cron, ui, registry, react, e2e, intl]

# Dependency graph
requires:
  - phase: 15-cron-tool
    plan: 01
    provides: "analyzeCron + CronResult/CronRun contract + 24-hour describe()"
  - phase: 15-cron-tool
    plan: 02
    provides: "nextRuns DST-correct engine (CronRun.label = Intl h23 local string) + kind:never"
  - phase: 15-cron-tool
    plan: 03
    provides: "L/nL/L-n last-day syntax honored by analyzeCron"
  - phase: 13-url-tool
    provides: "registry-append pattern + visible-CopyButton-over-platform-seam idiom"
  - phase: 14-regex-tester
    provides: "RegexTool single-view skeleton (frame classes, CopyButton, absence-grep discipline) mirrored here"
provides:
  - "src/tools/cron/CronTool.tsx — thin paste-instant Cron view over analyzeCron (12th registry-driven tool)"
  - "src/tools/cron/index.ts — cronTool ToolDefinition (id cron, Clock, converters)"
  - "registry append → #/tools/cron auto-derived (sidebar/palette/router)"
  - "test/e2e/cron.e2e.ts — real-WKWebView spec (scheduled/zone/reboot/never/invalid)"
affects: [v1.3-milestone-close]

# Tech tracking
tech-stack:
  added: []  # zero new runtime/dev deps — native Intl + the existing shared primitives only
  patterns:
    - "Thin layout-agnostic tool view: useMemo over a pure error-as-value core; render by discriminated kind"
    - "Paste-instant (no Parse/Compute button) — the wedge; fresh new Date() per render keeps relative captions honest"
    - "Neutral states (empty/@reboot/never) use text-tx ramp, NEVER role=alert or text-bad; only the error path is role=alert + aria-invalid"
    - "Run ordinals #1..#5 neutral text-tx-3 (enumeration, not selection) — the hero #N rule generalized"

key-files:
  created:
    - src/tools/cron/CronTool.tsx
    - src/tools/cron/CronTool.test.tsx
    - src/tools/cron/index.ts
    - test/e2e/cron.e2e.ts
  modified:
    - src/lib/tools/registry.ts

key-decisions:
  - "Description CopyButton kept (UI-SPEC marks it optional) — cheap, consistent with the run-row copy affordance"
  - "Run-row React key uses run.date.getTime() (stable, unique per instant) rather than the formatted label"
  - "REQUIREMENTS.md CRON-01..11 were already flipped Complete by Plans 01–03 (the UI surfaces them); no requirement-tracking edit needed this plan"

patterns-established:
  - "Cron view: input → (empty hint | error alert) → description headline → @reboot banner | never line | NEXT RUNS list, all in one scrolling frame"
  - "e2e reads run-row text via single browser.execute round-trips (no chained stale element handles — the url.e2e.ts WebKit lesson)"

requirements-completed: [CRON-01, CRON-02, CRON-03, CRON-04, CRON-05, CRON-06, CRON-07, CRON-08, CRON-09, CRON-10, CRON-11]

# Metrics
duration: ~5min (autonomous tasks; human-verify checkpoint pending)
completed: 2026-06-04
---

# Phase 15 Plan 04: Cron Tool View + Registry + e2e Summary

**The 12th registry-driven tool shipped: a thin, paste-instant `src/tools/cron/CronTool.tsx` over the pure `analyzeCron` core — a 24-hour description headline + 5 next-run rows (mono datetime + relative caption + visible copy), the neutral `@reboot` / "no upcoming runs" states, an inline `role=alert` error path, and a "Local time · {zone}" caption — registered at `#/tools/cron` via one registry append, covered by 7 jsdom component tests and a real-WKWebView e2e spec (13/13 specs green).**

## Status

**Autonomous tasks (1–2) COMPLETE.** Task 3 — the Phase-15 boundary `checkpoint:human-verify` (`tauri build` walkthrough + `gsd-ui-review` WCAG-AA sign-off) — is PENDING a human. This summary is written at the checkpoint and will be finalized (decision + phase close) on "approved". The phase is NOT marked complete here; no human sign-off is fabricated.

## Performance

- **Duration:** ~5 min (autonomous Tasks 1–2)
- **Started:** 2026-06-04T06:55:41Z
- **Tasks:** 2 of 3 (Task 3 = human checkpoint, pending)
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments
- `CronTool.tsx` renders every `CronResult` kind per the UI-SPEC Copywriting Contract: empty hint, `role=alert` error (CRON-11 + the W/#/LW reject), the 16px/600 sans description headline (scheduled/never/reboot), the neutral `@reboot` startup banner (no list, CRON-09), the calm "No upcoming runs" line (CRON-08), and the `NEXT RUNS (5)` list with a `Local time · {zone}` caption (CRON-05) and 5 rows (neutral `#N` ordinal + mono 24-hour datetime + `relativeTime` caption + visible focusable copy, CRON-06/07/10).
- Color discipline held: accent only on focus rings + copy-confirmed; ordinals/zone/`@reboot`/never all neutral (never `text-bad`/accent). No `dangerouslySetInnerHTML` (T-15-09, absence-grep clean). No StatusBar/byteCount (cron is not a byte transform).
- Registered as the 12th tool with one import + one `TOOLS` append — sidebar/palette/router auto-derive `#/tools/cron` (verified live in the WKWebView screenshot: the `Cron` sidebar entry with the `Clock` glyph).
- 7 jsdom component tests (every kind + a clipboard-seam copy assertion) and a real-WKWebView e2e (`test/e2e/cron.e2e.ts`) driving scheduled→zone→reboot→never→invalid; the e2e proves the native `Intl` h23 path renders 24-hour `09:00` (no AM/PM) on JavaScriptCore.

## Task Commits

1. **Task 1: CronTool.tsx + CronTool.test.tsx + index.ts + registry append (CRON-01..11)** — `26230213` (feat)
2. **Task 2: real-WKWebView e2e spec test/e2e/cron.e2e.ts** — `ebfe49f6` (test)
3. **Task 3: Phase-15 boundary sign-off** — PENDING human-verify checkpoint (no commit)

_Note: TDD landed GREEN with the impl (the locked lefthook Rule-4 pattern — no standalone RED commit)._

## Files Created/Modified
- `src/tools/cron/CronTool.tsx` (191 lines) — thin paste-instant view over `analyzeCron`; system-zone `useMemo`; render-by-kind; local `CopyButton` over `platform.clipboard` + `useCopyFeedback`.
- `src/tools/cron/CronTool.test.tsx` (157 lines) — 7 jsdom tests: empty hint, scheduled 5 rows + 24-hour headline + zone caption, clipboard-seam copy, `@reboot` banner + 0 rows, impossible "No upcoming runs" + no alert, invalid `role=alert` + `aria-invalid`, the W/#/LW reject path.
- `src/tools/cron/index.ts` (18 lines) — `cronTool` ToolDefinition (`id: "cron"`, `icon: Clock`, `category: "converters"`).
- `src/lib/tools/registry.ts` — one import + one `TOOLS` append (`cronTool`).
- `test/e2e/cron.e2e.ts` (146 lines) — real-WKWebView spec; HRN-02 screenshot to `test/e2e/__screenshots__/cron-wkwebview.png` (gitignored artifact).

## Decisions Made
- Kept a `CopyButton` beside the description headline (UI-SPEC marks it optional/low-priority) for affordance consistency with the run rows.
- Run-row React key = `run.date.getTime()` (stable + unique per instant), not the formatted label.
- No REQUIREMENTS.md edit: CRON-01..11 were already marked Complete by Plans 01–03 (this plan surfaces them in the UI; the requirement tracking was already flipped). ROADMAP plan-row left In Progress until the human sign-off closes Task 3.

## Deviations from Plan

None — both autonomous tasks executed exactly as written. No bugs, no missing-functionality, no blocking issues in the code itself.

## Issues Encountered
- **Single-instance e2e collision (known gotcha, MEMORY: e2e-spike-port-and-single-instance).** The first `scripts/e2e-spike.sh` run exited before binding `:4445` — the dev binary launched then immediately exited because a previously-running release `devtools-app` held the single-instance lock. Reaped that process (`kill 62263`) and re-ran; the spike then passed **13/13 specs** (the new cron spec + 12 existing, no regression), exit 0, screenshot saved. No code change.

## User Setup Required
None — pure frontend, no external service configuration.

## Next Phase Readiness
- The full cron pure core (Plans 01–03) + this view complete CRON-01..11 end-to-end. Component + real-WKWebView e2e are green; full suite 648/648 + `tsc` + eslint clean; `decoder.ts` + its 19 tests byte-for-byte untouched; zero new deps.
- **BLOCKING (Task 3):** Phase-15 boundary needs a human `tauri build` walkthrough + a `gsd-ui-review` WCAG-AA PASS on the Cron tool. On "approved", flip the ROADMAP Phase-15 row to Complete and close milestone v1.3 (all of Cron/URL/Regex/Protobuf-decimal delivered).

---
*Phase: 15-cron-tool*
*Completed: autonomous tasks 2026-06-04; phase pending human sign-off*

## Self-Check: PASSED (autonomous portion; human checkpoint Task 3 still open)
- FOUND: src/tools/cron/CronTool.tsx
- FOUND: src/tools/cron/CronTool.test.tsx
- FOUND: src/tools/cron/index.ts
- FOUND: test/e2e/cron.e2e.ts
- FOUND: src/lib/tools/registry.ts (cronTool import + TOOLS append)
- FOUND: test/e2e/__screenshots__/cron-wkwebview.png (HRN-02 artifact, gitignored)
- FOUND commit: 26230213 (Task 1)
- FOUND commit: ebfe49f6 (Task 2)
- PENDING: Task 3 human-verify (tauri build walkthrough + gsd-ui-review WCAG-AA)
