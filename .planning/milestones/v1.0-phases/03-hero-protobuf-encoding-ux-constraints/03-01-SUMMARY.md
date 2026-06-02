---
phase: 03-hero-protobuf-encoding-ux-constraints
plan: 01
subsystem: shell-preferences
tags: [preferences, persistence, protobuf, untrusted-merge, tdd]
requires:
  - "src/shell/preferences.ts (Preferences schema, Phase 2)"
  - "src/shell/prefsStore.ts (mergePreferences untrusted-merge, Phase 2)"
  - "src/shell/usePreferences.ts (write-on-change update(), Phase 2)"
provides:
  - "Preferences.protobufTreeStyle: \"cards\" | \"rows\" (default \"cards\")"
  - "coerceTreeStyle untrusted-merge coercer in mergePreferences"
  - "usePreferences().setTreeStyle setter (write-on-change, round-trips through store seam)"
affects:
  - "03-04 (protobuf tree rows/cards toggle consumes setTreeStyle + preferences.protobufTreeStyle)"
tech-stack:
  added: []
  patterns:
    - "Untrusted-merge coercion (one accept-or-default coercer per field, T-03-01)"
    - "Single-blob prefs schema extension (no Store seam widening)"
    - "TDD RED+GREEN landed in one commit (lefthook blocks red suites)"
key-files:
  created: []
  modified:
    - "src/shell/preferences.ts (ProtobufTreeStyle type + field + default)"
    - "src/shell/prefsStore.ts (coerceTreeStyle + mergePreferences wiring)"
    - "src/shell/usePreferences.ts (setTreeStyle setter)"
    - "src/shell/useRecentTools.ts (cold-start fallback derives from DEFAULT_PREFERENCES — Rule 3)"
    - "src/shell/prefsStore.test.ts (4 coercion cases)"
    - "src/shell/usePreferences.test.ts (setter round-trip case)"
decisions:
  - "useRecentTools cold-start fallback now spreads DEFAULT_PREFERENCES instead of a hardcoded literal, so it never drifts as the schema grows."
metrics:
  duration: ~2 min
  completed: 2026-05-31
  tasks: 2
  files-changed: 6
---

# Phase 3 Plan 01: protobufTreeStyle Preference Persistence Summary

Extended the Phase-2 preferences seam with one persisted field, `protobufTreeStyle: "cards" | "rows"` (default `"cards"`), plus an untrusted-merge coercer and a `setTreeStyle` setter — unblocking the Phase-3 protobuf rows/cards toggle (PRO-06, D-07) without widening the `Store` seam or touching any port-unchanged file.

## What Was Built

- **Schema (`preferences.ts`):** new `ProtobufTreeStyle = "cards" | "rows"` type, a `protobufTreeStyle` field on `Preferences`, and `protobufTreeStyle: "cards"` in `DEFAULT_PREFERENCES`. The Phase-2 schema comment had explicitly reserved this slot.
- **Untrusted merge (`prefsStore.ts`):** `coerceTreeStyle(value)` returns `"rows"` only for the literal `"rows"`, defaulting everything else — unknown strings (`"banana"`) and non-strings (`42`) — to `"cards"`. Wired into `mergePreferences` as `protobufTreeStyle: coerceTreeStyle(blob.protobufTreeStyle)`. The `loadPreferences` catch-fallback spreads `...DEFAULT_PREFERENCES`, so it already covers the new field (verified, not duplicated).
- **Hook (`usePreferences.ts`):** `setTreeStyle(style)` added via the existing `update({ protobufTreeStyle: style })` pattern — write-on-change only, no setter call during render (Pitfall 5). Exposed on the `UsePreferences` interface.

## TDD Flow

RED (Task 1): added 4 `mergePreferences` coercion cases (`prefsStore.test.ts`) and a `setTreeStyle` round-trip case that re-mounts a second hook over the same memory store (`usePreferences.test.ts`). Verified 5 failures referencing `protobufTreeStyle`/`setTreeStyle`. GREEN (Task 2): implemented schema + merge + hook → 14/14 prefs tests pass. Per the plan and Phase-2 precedent, RED tests + GREEN impl landed in one commit because lefthook blocks committing a red suite.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] useRecentTools cold-start fallback missed the new required field**
- **Found during:** Task 2 (`tsc --noEmit` after wiring the schema)
- **Issue:** Making `protobufTreeStyle` a required field broke `src/shell/useRecentTools.ts`, whose `commit()` built a hardcoded `Preferences` literal fallback (`{ theme, accent, lastUsedId, recentToolIds }`) that no longer satisfied the type. This sibling shares the one prefs blob.
- **Fix:** Replaced the hardcoded literal with `{ ...DEFAULT_PREFERENCES }` (imported `DEFAULT_PREFERENCES`), so the fallback tracks the schema permanently and cannot drift again on future field additions.
- **Files modified:** `src/shell/useRecentTools.ts`
- **Commit:** `e0f5403f`

## Verification

- `npx vitest run src/shell/prefsStore.test.ts src/shell/usePreferences.test.ts` → 14/14 pass.
- `npx vitest run src/lib/protobuf/decoder.test.ts` → 19/19 pass (port-unchanged bar intact, untouched).
- Full suite: 101/101 across 13 files.
- `npx tsc --noEmit` clean; eslint 0 issues on all changed files.
- Constraints held: no `@tauri-apps/*` import added (grep confirmed the two matches are doc comments, not imports); `Store` seam not widened; `decoder.ts`/`bytes.ts`/`types.ts`/`registry.ts` untouched (`git status` empty for those paths).

Note: the toggle's real-WKWebView persistence verification is deferred to plan 03-04 (per the plan's Pitfall 6) — this plan has no UI surface to verify against `tauri dev`.

## Threat Mitigation

T-03-01 (Tampering, hand-edited `prefs.json`) is mitigated by `coerceTreeStyle` accepting only `"rows"` and defaulting all else to `"cards"` — unit-proven with `"banana"` and `42`, mirroring the Phase-2 untrusted-merge pattern (T-02-08).

## Commits

- `e0f5403f`: feat(03-01): persist protobufTreeStyle (cards/rows) in prefs schema

## Self-Check: PASSED

- preferences.ts / prefsStore.ts / usePreferences.ts / useRecentTools.ts / both test files — all FOUND and modified (git tracked).
- Commit `e0f5403f` FOUND in git log.
