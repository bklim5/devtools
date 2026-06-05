---
phase: 16-reorderable-sidebar-tool-list
plan: 01
subsystem: shell/preferences
tags: [preferences, persistence, reorder, pure-logic, wcag-prep]
requires:
  - "src/shell/preferences.ts (Preferences + DEFAULT_PREFERENCES)"
  - "src/shell/prefsStore.ts (mergePreferences untrusted-merge seam)"
  - "src/shell/usePreferences.ts (write-on-change hook over platform.store)"
  - "src/lib/tools/registry.ts (ENABLED_TOOLS canonical order)"
provides:
  - "Preferences.toolOrder: string[] (default []) persisted through the existing prefs blob"
  - "coerceToolOrder(value): untrusted string-array merge (string-only, de-dupe, no cap, non-array -> [])"
  - "usePreferences().setToolOrder(order): write-on-change setter mirroring setLastUsedId"
  - "reconcileToolOrder(savedOrder, registryIds): D-11 render overlay (permutation of registry)"
  - "moveToolInOrder(order, id, toIndex): clamped relocate returning a fresh array"
affects:
  - "Plan 02 Sidebar (consumes reconcileToolOrder + moveToolInOrder + setToolOrder)"
tech-stack:
  added: []
  patterns:
    - "Pure shell helper module (no React/DOM/platform) mirroring resolveStartupTool.ts style"
    - "Additive untrusted-merge coercer mirroring normalizeRecents (no length cap)"
    - "Write-on-change setter mirroring setLastUsedId"
key-files:
  created:
    - "src/shell/toolOrder.ts"
    - "src/shell/toolOrder.test.ts"
  modified:
    - "src/shell/preferences.ts"
    - "src/shell/prefsStore.ts"
    - "src/shell/usePreferences.ts"
    - "src/shell/prefsStore.test.ts"
    - "src/shell/usePreferences.test.ts"
decisions:
  - "coerceToolOrder is a dedicated helper (not folded into normalizeRecents) because toolOrder has NO length cap while recents caps at 5 — a shared function would obscure the difference"
  - "moveToolInOrder clamps against the post-removal array length so an item can land at the last slot (toIndex 99 -> end)"
  - "loadPreferences catch-fallback left as-is: DEFAULT_PREFERENCES.toolOrder is already [], so no sibling override line needed alongside the explicit recentToolIds: []"
metrics:
  duration: ~3 min
  tasks: 2
  files: 7
  completed: 2026-06-05
---

# Phase 16 Plan 01: toolOrder Persistence + Pure Ordering Backbone Summary

The persistence + pure ordering/reconciliation contract layer for the user-reorderable sidebar (REORD-05/06/07) — a `toolOrder: string[]` Preferences field persisted through the existing prefs seam plus two pure, fully-tested `toolOrder.ts` helpers (`reconcileToolOrder` D-11 render overlay + `moveToolInOrder` drag/Alt-arrow relocate). No UI; Plan 02's Sidebar is thin wiring over this.

## What Was Built

**Task 1 — `src/shell/toolOrder.ts` (pure, no React/DOM/platform):**
- `reconcileToolOrder(savedOrder, registryIds)` — D-10/D-11 render overlay. Honors the saved order gated by registry-membership + de-dupe, then appends any registry id missing from the saved order in canonical registry order. Output is always a permutation of `registryIds` (no missing, no duplicate, untrusted-blob safe). Drops non-strings and ids no longer in the registry.
- `moveToolInOrder(order, id, toIndex)` — clamped relocate returning a fresh array; unknown id is a no-op (fresh copy of input). Shared by drag-drop and the Alt+↑/↓ keyboard path (caller computes `toIndex = currentIndex ± 1`).
- 13 vitest cases: empty/full/append-new/drop-unknown/de-dupe/drop-junk/permutation-invariant for reconcile; move-up/down/clamp-low/clamp-high/unknown-noop/no-mutate for move.

**Task 2 — persistence wiring (additive, zero behavior change to existing fields):**
- `preferences.ts`: `toolOrder: string[]` on `Preferences` + `toolOrder: []` in `DEFAULT_PREFERENCES`.
- `prefsStore.ts`: `coerceToolOrder` untrusted-merge (string-only, de-dupe, NO length cap; non-array → `[]`) wired into `mergePreferences`.
- `usePreferences.ts`: `setToolOrder` in the interface + `useCallback` + returned, mirroring `setLastUsedId`.
- Tests: 4 coercion cases in `prefsStore.test.ts` (drop non-string/de-dupe, absent → `[]`, non-array → `[]`, sibling-field independence) + a round-trip case in `usePreferences.test.ts`.

## Verification Results

- `pnpm vitest run src/shell/toolOrder.test.ts src/shell/prefsStore.test.ts src/shell/usePreferences.test.ts` → **40/40 green** (13 toolOrder + 14 prefsStore + 13 usePreferences).
- `pnpm exec tsc --noEmit` → clean (exit 0).
- `pnpm exec eslint` over all 7 files → clean (exit 0).
- `pnpm vitest run src/lib/protobuf/decoder.test.ts` → **19/19** (immovable bar; decoder byte-for-byte untouched).
- `git diff package.json pnpm-lock.yaml` → empty (zero new runtime/dev deps).
- `grep -E "react|@tauri-apps/|@/lib/platform" src/shell/toolOrder.ts` → none (pure module confirmed).
- No UI touched → real-WKWebView gate is N/A for this plan (deferred to Plan 02, which owns the Sidebar render).

## Threat Model Coverage

All STRIDE register mitigations implemented as planned:
- **T-16-01 (Tampering, prefs.json toolOrder):** `coerceToolOrder` accepts only string members, de-dupes, non-array → `[]`; no throw.
- **T-16-02 (DoS, oversized/dup-stuffed):** `reconcileToolOrder` gates membership against the registry `Set`, so output length is bounded by the registry regardless of saved-blob size; duplicates collapse.
- **T-16-03 (Tampering, unknown/removed ids):** `reconcileToolOrder` drops ids not in `registryIds` (D-11) — never renders a phantom tool.
- **T-16-04 (Injection toward DOM):** accepted here (no DOM in this plan); ids stay opaque registry-controlled strings.

## Deviations from Plan

None — plan executed exactly as written. Tests landed GREEN with their implementation in the same commit (project constraint: lefthook rejects failing tsc/vitest commits — no standalone RED commit), which the plan explicitly directed.

## Commits

- `90857271` — feat(16-01): pure reconcileToolOrder + moveToolInOrder helpers
- `72955ab3` — feat(16-01): persist toolOrder via the existing prefs seam

## Self-Check: PASSED

- FOUND: src/shell/toolOrder.ts
- FOUND: src/shell/toolOrder.test.ts
- FOUND (modified): src/shell/preferences.ts, prefsStore.ts, usePreferences.ts, prefsStore.test.ts, usePreferences.test.ts
- FOUND: commit 90857271
- FOUND: commit 72955ab3
