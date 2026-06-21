---
phase: 25-updates-pane-milestone-ship
plan: 02
subsystem: shell/preferences
tags: [updates, preferences, persistence]
requires:
  - "the single-writer prefs seam (usePreferences updatePreferences singleton, Phase 23-03)"
provides:
  - "Preferences.lastUpdateCheck: number | null (epoch ms; null = never checked)"
  - "coerceLastUpdateCheck untrusted coercer (finite positive number, else null)"
  - "usePreferences.setLastUpdateCheck single-writer setter"
affects:
  - "Plan 03 (stamps lastUpdateCheck on every check resolution)"
  - "Plan 04 (Updates pane 'Last checked' readout)"
tech-stack:
  added: []
  patterns:
    - "field-by-field untrusted coercion over DEFAULT_PREFERENCES"
    - "single-writer setter routed through updatePreferences"
key-files:
  created: []
  modified:
    - src/shell/preferences.ts
    - src/shell/prefsStore.ts
    - src/shell/usePreferences.ts
    - src/shell/prefsStore.test.ts
    - src/shell/usePreferences.test.ts
decisions:
  - "lastUpdateCheck stored as epoch ms (number | null); null = never checked, renders 'Never'"
  - "Untrusted coercion accepts ONLY a finite positive number; non-number/NaN/Infinity/<=0/absent -> null"
metrics:
  duration: ~4 min
  tasks: 2
  files: 5
  completed: 2026-06-21
---

# Phase 25 Plan 02: lastUpdateCheck Preference Field Summary

Added a `lastUpdateCheck` epoch-ms timestamp (`number | null`; null = never checked → "Never") to `Preferences`, persisted through the established single-writer, async-load-safe, untrusted-coerced prefs seam — the foundation for the Updates pane's "Last checked" readout. Coerced field-by-field over defaults (non-finite / non-positive / non-number → null) and exposed via a `setLastUpdateCheck` setter routed through the `updatePreferences` singleton. Field + coercer + setter only; the stamping wiring lands in Plan 03.

## What Shipped

- **`src/shell/preferences.ts`** — `lastUpdateCheck: number | null` on the `Preferences` interface (after `autoUpdateCheck`) with a doc comment; `lastUpdateCheck: null` in `DEFAULT_PREFERENCES`.
- **`src/shell/prefsStore.ts`** — `coerceLastUpdateCheck(value)`: accepts only `typeof value === "number" && Number.isFinite(value) && value > 0`, else `null` (mirrors `coerceAutoUpdateCheck`'s untrusted discipline); wired into the `mergePreferences` return object.
- **`src/shell/usePreferences.ts`** — `setLastUpdateCheck: (ms: number) => void` on the `UsePreferences` interface; a `useCallback` `(ms) => update({ lastUpdateCheck: ms })` mirroring `setAutoUpdateCheck`; included in the returned object. Routes through the single-writer `updatePreferences` singleton — never a second direct disk writer.
- **`src/shell/prefsStore.test.ts`** — `describe("lastUpdateCheck coercion")`: valid positive passthrough; string / NaN / Infinity / negative / 0 / absent → null; sibling-field non-regression. Tested THROUGH `mergePreferences` (coercer is module-private).
- **`src/shell/usePreferences.test.ts`** — `setLastUpdateCheck` persists through the single writer + round-trips through a fresh load; and does NOT clobber a previously-set theme/pin (T-25-05 single-writer merge against live).

## Verification

- `pnpm exec tsc --noEmit` — clean
- `pnpm exec eslint src/shell/preferences.ts src/shell/prefsStore.ts src/shell/usePreferences.ts` — clean
- `pnpm exec vitest run src/shell/prefsStore.test.ts src/shell/usePreferences.test.ts` — 88/88
- Full pre-commit suite (lefthook): vitest **1178/1178**, tsc clean, eslint clean (2 pre-existing SidebarResetMenu warnings, out of scope)
- `git diff --stat src/lib/protobuf/decoder.ts` — 0 changes (decoder + its 19 tests byte-for-byte untouched)
- Zero new runtime/dev deps

## Threat Mitigations Applied

- **T-25-04 (Tampering, lastUpdateCheck on load)** — `coerceLastUpdateCheck` accepts only a finite positive number; a hand-edited string/NaN/Infinity/negative/0 → null ("Never"); no crash, no misleading future/garbage date. Tested.
- **T-25-05 (Tampering / clobber, second prefs writer)** — the setter routes through the single-writer `updatePreferences` singleton; merges against live state, never clobbers theme/pins. Pinned by the "does NOT clobber a previously-set theme/pin" test. No new direct disk writer added.

## Deviations from Plan

None — plan executed exactly as written. The three source edits matched the `<interfaces>` block verbatim; the tests follow the existing coercer (via `mergePreferences`) and single-writer setter templates.

## Commits

- `082a733a` — feat(25-02): add lastUpdateCheck prefs field + coercer + setter
- `69ba769d` — test(25-02): pin lastUpdateCheck coercer + single-writer setter

## Known Stubs

None. The field + coercer + setter are fully implemented and tested. The consumer wiring (Plan 03 stamping, Plan 04 display) is out of scope by design — this plan is intentionally the foundation only.

## Harness note

`/simplify` → `/code-review xhigh` → `/codex:adversarial-review` were NOT auto-invoked by the executor (per the project gate discipline they run at the phase checkpoint). Recommend `/codex:review --scope working-tree` at the Phase-25 checkpoint. SET-10 stays PARTIAL — this is foundation only; the Updates pane UI + Check-for-updates wiring + real-WKWebView e2e land in Plans 03/04.

## Self-Check: PASSED

All 5 modified files present; both commits (`082a733a`, `69ba769d`) in history; field/merge/setter key-links grep-confirmed.
