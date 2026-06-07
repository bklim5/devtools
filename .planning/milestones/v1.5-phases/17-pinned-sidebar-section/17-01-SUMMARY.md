---
phase: 17-pinned-sidebar-section
plan: 01
subsystem: shell-preferences
tags: [pinning, preferences, persistence, pure-backbone, untrusted-merge, PIN-07, PIN-08]
requires:
  - "src/shell/toolOrder.ts: reconcileToolOrder (v1.4)"
  - "src/shell/preferences.ts: Preferences + DEFAULT_PREFERENCES"
  - "src/shell/prefsStore.ts: mergePreferences (untrusted-merge seam)"
  - "src/shell/usePreferences.ts: update() prefs-write seam"
provides:
  - "preferences.pinnedToolIds: string[] (persisted, default [])"
  - "coercePinnedToolIds (untrusted-merge, no cap) wired into mergePreferences"
  - "setPinnedToolIds + togglePinned setters on UsePreferences"
  - "partitionTools(pinnedToolIds, toolOrder, registryIds) → { pinned, unpinned }"
  - "ToolPartition interface"
affects:
  - "src/components/Sidebar.tsx (Plan 17-02 consumer — not touched here)"
tech-stack:
  added: []
  patterns:
    - "Untrusted prefs coercion: dedicated coercer mirroring coerceToolOrder (no cap), wired field-by-field in mergePreferences"
    - "Pure registry-partition overlay reusing reconcileToolOrder for the remainder (no re-derivation)"
    - "togglePinned closure deps on preferences.pinnedToolIds to read the current set"
key-files:
  created: []
  modified:
    - "src/shell/preferences.ts"
    - "src/shell/prefsStore.ts"
    - "src/shell/prefsStore.test.ts"
    - "src/shell/usePreferences.ts"
    - "src/shell/usePreferences.test.ts"
    - "src/shell/toolOrder.ts"
    - "src/shell/toolOrder.test.ts"
decisions:
  - "Dedicated coercePinnedToolIds (duplicate of coerceToolOrder) over a shared coerceStringIdList — clearest provenance, matches the existing coerceToolOrder/normalizeRecents split that already avoids cap-coupling"
  - "No second persisted order array: pinned group order IS pinnedToolIds (append-on-pin = bottom-append for free); unpinned remainder = reconcileToolOrder(toolOrder) over registry-minus-pinned"
metrics:
  duration: "~4 min"
  completed: "2026-06-05"
  tasks: 2
  files: 7
---

# Phase 17 Plan 01: Persistence + Pure Pinning Backbone Summary

Added a persisted `pinnedToolIds: string[]` prefs overlay plus a pure, fully-tested `partitionTools` registry-partition helper — the contract layer Plan 17-02's Sidebar consumes — with NO UI, zero new deps, and the decoder's 19 tests byte-for-byte untouched.

## What Was Built

**Task 1 — `pinnedToolIds` prefs field + coercer + setters** (`8bac1768`)
- `preferences.ts`: `pinnedToolIds: string[]` field on `Preferences` (beside `toolOrder`) + `DEFAULT_PREFERENCES.pinnedToolIds = []`.
- `prefsStore.ts`: exported `coercePinnedToolIds(value)` — a byte-identical mirror of `coerceToolOrder` (non-array → `[]`, drop non-strings, de-dupe, **NO length cap**), wired into `mergePreferences` as `pinnedToolIds: coercePinnedToolIds(blob.pinnedToolIds)`.
- `usePreferences.ts`: `setPinnedToolIds(ids)` (mirrors `setToolOrder`) and `togglePinned(id)` (append-on-pin to the bottom / remove-on-unpin), both on the `UsePreferences` interface and returned object. `togglePinned` deps on `preferences.pinnedToolIds` so the closure reads the current set.
- Tests: `coercePinnedToolIds` matrix (de-dupe, drop non-strings, non-array→[], 50-item no-cap, mergePreferences wiring, sibling-field isolation) + `setPinnedToolIds` round-trip and `togglePinned` append/remove round-trip through the seam.

**Task 2 — pure `partitionTools` + immovable-bar matrix** (`c7b94741`)
- `toolOrder.ts`: exported `interface ToolPartition { pinned; unpinned }` and pure `partitionTools(pinnedToolIds, toolOrder, registryIds): ToolPartition`. The `pinned` group is the `pinnedToolIds` order, registry-gated + de-duped; the `unpinned` group is `reconcileToolOrder(toolOrder, registryMinusPinned)` (**reused**, not re-derived). Untrusted-safe: non-array → `[]`, non-strings dropped, unknown ids dropped, duplicates collapsed.
- `toolOrder.test.ts`: the 10-case PIN-08 immovable-bar matrix, each asserting the invariant `union.sort() === registry.sort()`, `Set(union).size === registry.length`, and disjointness. Existing `reconcileToolOrder`/`moveToolInOrder` bodies + tests untouched (additions only).

## Exports Plan 17-02 Consumes

- `partitionTools(pinnedToolIds, toolOrder, registryIds)` and `ToolPartition` — `src/shell/toolOrder.ts`
- `setPinnedToolIds`, `togglePinned`, `preferences.pinnedToolIds` — `src/shell/usePreferences.ts`

Composition: `const { pinned, unpinned } = partitionTools(preferences.pinnedToolIds, preferences.toolOrder, registryIds);` — `pinned` order = pinnedToolIds order; `unpinned` = reconcileToolOrder over the remainder. Union = registry; intersection = ∅ (immovable bar by construction).

## Deviations from Plan

None — plan executed exactly as written. Chose the dedicated `coercePinnedToolIds` duplicate over a shared `coerceStringIdList` (the plan explicitly permitted either and defaulted to the duplicate for clearest provenance).

## Verification

- `pnpm vitest run src/shell/{prefsStore,usePreferences,toolOrder}.test.ts` — green (Task 1: 34, Task 2: 23).
- `pnpm exec tsc --noEmit` clean; `pnpm exec eslint` clean on all 7 files.
- Plan-boundary full suite **685/685** (was 668 + 17 new cases); decoder **19/19** byte-for-byte untouched.
- `git diff package.json pnpm-lock.yaml` empty — zero new runtime AND dev dependencies.
- Pre-commit lefthook (typecheck + full vitest) passed on both commits (no `--no-verify`).

## Notes for 17-02

- Gate the divider / "Unpin all" on `partition.pinned.length > 0` (the post-reconcile array), not the raw `preferences.pinnedToolIds.length` (RESEARCH Pitfall 5 — a blob of only stale ids reconciles to an empty pinned group).
- Persistence rides the existing `loadPreferences`/`savePreferences` path that already `await initPlatform()` — verify the round-trip on the real WKWebView in the e2e, not just jsdom (project MEMORY: tauri-store-async-init-race).

## Self-Check: PASSED

- src/shell/toolOrder.ts — FOUND (partitionTools + ToolPartition)
- src/shell/preferences.ts, prefsStore.ts, usePreferences.ts — FOUND (modified)
- Commit 8bac1768 — FOUND
- Commit c7b94741 — FOUND
