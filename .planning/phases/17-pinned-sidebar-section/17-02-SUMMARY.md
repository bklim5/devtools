---
phase: 17-pinned-sidebar-section
plan: 02
subsystem: sidebar-ui
tags: [pinning, sidebar, a11y, aria-live, two-group, per-group-reorder, PIN-01, PIN-02, PIN-03, PIN-04, PIN-05, PIN-06, PIN-09]
requires:
  - "src/shell/toolOrder.ts: partitionTools + moveToolInOrder (17-01)"
  - "src/shell/usePreferences.ts: setPinnedToolIds, togglePinned, setToolOrder, preferences.pinnedToolIds (17-01)"
  - "src/lib/tools/registry.ts: ENABLED_TOOLS, getToolById"
  - "test/e2e/sidebar.e2e.ts: v1.4 dispatchKey/readOrder harness (16-02)"
provides:
  - "Two-group pinned/unpinned Sidebar via partitionTools (SR-named groups + neutral divider)"
  - "Left-of-grip pin toggle (filled-persistent on pinned / outline hover+focus on unpinned) + aria-pressed"
  - "Alt+P pin/unpin on the focused handle, aria-live-announced with the registry name"
  - "Per-group drag + Alt+arrow reorder (draggingGroup scope; pinned→setPinnedToolIds, unpinned→setToolOrder)"
  - "'Unpin all' second item in the Shift+F10 reset menu (gated on partition.pinned.length > 0)"
  - "Extended real-WKWebView e2e: Alt+P membership+aria-live, per-group no-cross-boundary, Unpin all, persistence"
affects:
  - "Sidebar render only — registry array, ⌘K palette, and router untouched (single control plane preserved)"
tech-stack:
  added: []
  patterns:
    - "Shared renderRow(id, index, group) closure across both groups; group arg routes drag/keyboard to the right array+setter"
    - "ONE handleRefs + focusAfterMoveRef map across both groups so focus survives cross-group pin/unpin re-renders"
    - "Gate divider/group/'Unpin all' on the post-reconcile partition.pinned.length, never the raw pref (Pitfall 5)"
    - "Drive Alt chords in e2e via dispatched bubbling KeyboardEvent (WebKit WebDriver drops Alt on the Actions API)"
key-files:
  created: []
  modified:
    - "src/components/Sidebar.tsx"
    - "test/e2e/sidebar.e2e.ts"
decisions:
  - "Single onHandleKeyDown carries Alt+↑/↓ (per-group clamp) AND the Alt+P toggle — the grip handle is the row's one keyboard control"
  - "pinnedSet memoised (useMemo over the reconciled pinned array) so the togglePin/renderRow callbacks keep a stable identity (no every-render churn)"
  - "Pin glyph: lucide Pin with fill-current when pinned (filled), stroke-only when unpinned (outline); PinOff reserved for the 'Unpin all' menuitem"
  - "NavLink right padding widened pr-7 → pr-12 to clear the two stacked controls (pin at right-7, grip at right-1) without truncating the tool name"
metrics:
  duration: "~10 min"
  completed: "2026-06-05"
  tasks: 2
  files: 2
---

# Phase 17 Plan 02: Pinned Sidebar UI Summary

Extended the v1.4 reorderable `Sidebar.tsx` into a two-group pinned/unpinned sidebar over the Plan 17-01 backbone — a left-of-grip pin toggle (Alt+P + click), an SR-named pinned group above a bare neutral divider, per-group drag + Alt+↑/↓ reorder that never crosses the boundary, and "Unpin all" in the reset menu — plus a real-WKWebView keyboard e2e proving it. Zero new deps, registry/⌘K/router untouched, the decoder's 19 tests byte-for-byte untouched.

## What Was Built

**Task 1 — two-group Sidebar UI** (`aee22ada`)
- **Two-group render:** replaced the single `reconcileToolOrder` line with `partitionTools(preferences.pinnedToolIds, preferences.toolOrder, registryIds)`. The `<nav>` renders a `<div role="group" aria-label="Pinned tools">` (shown only when `pinned.length > 0`), a bare neutral `<hr aria-hidden>` divider (NO visible "PINNED" label — D-15), then always a `<div role="group" aria-label="Tools">`. Both gates use the **post-reconcile** `pinned.length`, never the raw pref (Pitfall 5).
- **Pin toggle button** LEFT of the grip (pin at `right-7`, grip stays outermost at `right-1`): pinned rows show a persistent neutral filled `Pin` (`fill-current`, `text-tx-2`, no opacity-0); unpinned rows show an outline `Pin` revealed on `group-hover`/`focus-visible` only (mirrors the grip). `onClick` does `preventDefault()`+`stopPropagation()` so the NavLink never navigates (PIN-04), then `togglePin(id)`. `aria-label="Pin/Unpin {name}"`, `aria-pressed={isPinned}`.
- **Alt+P** added to `onHandleKeyDown` (after the `!e.altKey` guard, before the Arrow branch): `togglePin(id)` → `togglePinned` + `announce("Pinned/Unpinned {tool.name}")` using the registry name (Pitfall 4 / T-17-05). Alt-family only — no plain 'P' (D-13).
- **Per-group reorder:** added `draggingGroup: "pinned" | "unpinned" | null`. `onDragStart` records the group; `onRowDragOver`/`onNavDragOver`/`onDrop` compute the gap index against the **active group's** array and ignore drags from the other group; `commitMove(group, …)` routes to `setPinnedToolIds(moveToolInOrder(pinned, …))` vs `setToolOrder(moveToolInOrder(unpinned, …))`. Alt+↑/↓ clamps against the row's OWN group length and announces the boundary against it — a pinned tool at the bottom hits the *group* edge, never sliding into the unpinned list (Pitfalls 1+2, PIN-06).
- **Shared `renderRow(id, index, group)`** factored from the v1.4 row JSX; both groups call it, the `group` arg routes drag/keyboard. `handleRefs` + `focusAfterMoveRef` stay ONE shared map across both groups, and `togglePin` sets `focusAfterMoveRef` before the toggle so focus survives the cross-group re-render (Pitfall 3).
- **"Unpin all"** added as a second `role="menuitem"` (a `PinOff` icon + the exact label) inside the existing `resetMenu`, after "Reset order", shown only when `pinned.length > 0`; `onClick` → `setPinnedToolIds([])` + `announce("All tools unpinned")` + `closeResetMenu({ restoreFocus: true })`. The menu's existing Shift+F10/ContextMenu open path is reused unchanged (PIN-09).
- **CLAUDE.md/simplify nits applied:** `pinnedSet` wrapped in `useMemo` (stable callback deps); NavLink padding `pr-7 → pr-12` (Pitfall 6).

**Task 2 — real-WKWebView keyboard e2e** (`cb24e74f`)
- New `describe("Pinned sidebar section (real WKWebView)")` block in `test/e2e/sidebar.e2e.ts`. Hoisted the v1.4 `dispatchKey` to module scope and added `dispatchAltP` (literal `key: "p", altKey: true` bubbling KeyboardEvent), plus `readPinnedOrder`/`readUnpinnedOrder`/`readLiveRegion`/`focusHandle` helpers. All Alt chords go through dispatched bubbling KeyboardEvents — NOT the Actions API (WebKit WebDriver drops Alt; RESEARCH.md:499).
- Asserts: a clean-start unpin-all; zero-pinned → no group (PIN-03); **Alt+P pins** (membership in `[role=group][aria-label="Pinned tools"]` + aria-live `/^Pinned .+/`, PIN-01/05); group appears (PIN-03); **per-group Alt+↓/↑ no cross-boundary** both directions (PIN-06); **persistence across `browser.refresh`** (PIN-07); **Alt+P unpins** (group vanishes + `/^Unpinned .+/`, PIN-02/03); **"Unpin all" via Shift+F10** clears the set + "All tools unpinned" (PIN-09). Saves a `sidebar-pinned-wkwebview.png` artifact; existing reorder spec untouched.

## Verification

- `pnpm exec tsc --noEmit` clean; `pnpm exec eslint .` clean (the `pinnedSet`/`useMemo` warnings resolved).
- Full `pnpm vitest run` **685/685** green (unchanged from 17-01 — e2e specs are WDIO, excluded from vitest; the decoder's **19 tests byte-for-byte untouched**). Ran green inside the lefthook pre-commit on BOTH commits (no `--no-verify`).
- **Real WKWebView gate:** `scripts/e2e-spike.sh` exit 0 — **14/14 spec files**, `sidebar.e2e.ts` **2/2** (the existing reorder spec + the new pinned-section spec both ✓). Screenshots written: `test/e2e/__screenshots__/sidebar-wkwebview.png`, `sidebar-pinned-wkwebview.png`.
- `git diff package.json pnpm-lock.yaml` empty — zero new runtime AND dev deps (lucide `Pin`/`PinOff` already installed).
- No mutation of `ENABLED_TOOLS`, the router, or the ⌘K palette — pin/reorder write only `pinnedToolIds`/`toolOrder` through the prefs seam (T-17-04 mitigated by construction).

## Deviations from Plan

None — plan executed exactly as written. Two in-scope quality refinements applied during the per-task `simplify` step (not behavior changes): `pinnedSet` memoised via `useMemo` to keep the `togglePin`/`renderRow` `useCallback` deps stable (eslint react-hooks warning), and a dedicated `dispatchAltP` helper added in the e2e so the load-bearing pin chord carries the literal `key: "p", altKey: true` (clearer than threading the parameterized `dispatchKey` for the assertion the verifier greps).

## Manual-Walkthrough Items Carried to the Phase Gate

Per VALIDATION.md:85-90 and project MEMORY ([tauri-native-dragdrop-blocks-html5-dnd]), the WebDriver cannot synthesize native pointer input, so two items ride the human walkthrough at the phase boundary (`tauri build` + `gsd-ui-review`):
1. **Native pointer DRAG reorder WITHIN each group** — a dragged row reorders inside its group and NEVER crosses the divider (PIN-06 pointer path; keyboard path is e2e-proven).
2. **Pin-icon reveal on pointer HOVER** for unpinned rows (the `group-hover:opacity-100` affordance; `focus-visible` reveal is keyboard-reachable and covered).

## Threat Surface

No new surface beyond the plan's `<threat_model>`. T-17-03/05/06 mitigated as designed (post-reconcile partition gating; `getToolById(id).name` in `announce`; `draggingGroup`/per-group clamp + e2e no-cross-boundary assertion). T-17-04 mitigated — only `pinnedToolIds`/`toolOrder` are written.

## Self-Check: PASSED

- src/components/Sidebar.tsx — FOUND (partitionTools, draggingGroup, Alt+P, "Unpin all")
- test/e2e/sidebar.e2e.ts — FOUND (dispatchAltP, "Pinned tools", "Unpin all", browser.refresh)
- test/e2e/__screenshots__/sidebar-pinned-wkwebview.png — FOUND (e2e artifact)
- Commit aee22ada — FOUND (Task 1)
- Commit cb24e74f — FOUND (Task 2)
