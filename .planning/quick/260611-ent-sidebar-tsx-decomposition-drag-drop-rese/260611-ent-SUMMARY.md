---
phase: quick-260611-ent
plan: 01
subsystem: ui
tags: [refactor, sidebar, segmented-control, drag-drop, harness-batch-4]
requires: []
provides:
  - "useSidebarDragDrop hook (drag state + 5 handlers, T-18-12/PIN-06 preserved verbatim)"
  - "SidebarResetMenu file (useSidebarResetMenu hook + role=menu component)"
  - "6 total SegmentedControl call sites (url x2 + base64/hash/unix-time/uuid-ulid)"
affects: [sidebar, base64, hash, unix-time, uuid-ulid]
tech-stack:
  added: []
  patterns:
    - "Sidebar.tsx = composition root; extracted seams receive inputs as args/props, never own prefs setters or announce"
    - "Boolean state maps to SegmentedControl strings at the call site (hash upper/lower) — never widen the generic"
key-files:
  created:
    - src/components/useSidebarDragDrop.ts
    - src/components/SidebarResetMenu.tsx
  modified:
    - src/components/Sidebar.tsx
    - src/tools/base64/Base64Tool.tsx
    - src/tools/hash/HashTool.tsx
    - src/tools/unix-time/UnixTimeTool.tsx
    - src/tools/uuid-ulid/UuidUlidTool.tsx
decisions:
  - "Hook + menu component kept in ONE file (SidebarResetMenu.tsx) per plan; react-refresh/only-export-components suppressed with rationale comment (repo stays 0-warning)"
  - "closeResetMenu dep array [] -> [navRef, rowRefs]: refs are stable identities, zero behavior change, satisfies exhaustive-deps on hook params"
  - "Reset-menu hook returns the ORIGINAL handler names (openResetMenuFromMouse/FromKeyboard) — zero renames, nav JSX bindings byte-identical"
metrics:
  duration: "~75 min (automated portion)"
  completed: "2026-06-11"
  tasks: "3/3 complete; Task 3 human drag walkthrough approved 2026-06-12 (pinned/unpinned reorder, end-zone drop, no cross-boundary, reload persistence, 4 migrated toggles)"
  files: 7
---

# Quick 260611-ent: Sidebar Decomposition + SegmentedControl Migration Summary

**One-liner:** Peer-review batch 4/4 — Sidebar.tsx (823→631 lines) decomposed into a verbatim-moved `useSidebarDragDrop` hook + `SidebarResetMenu` file, and the 4 duplicated inline toggles (base64/hash/unix-time/uuid-ulid) replaced by the shared `SegmentedControl`; zero behavior change, full e2e 15/15 green.

## Task Commits

| Task | Name | Commit |
|------|------|--------|
| 1 | Migrate 4 inline toggles to SegmentedControl | c941dda0 |
| 2 | Decompose Sidebar into drag-drop hook + reset-menu file | c6b2bf9a |
| 3 | Full e2e gate + screenshots (automated half) | — evidence only, no source change |

## What Was Done

### Task 1 — SegmentedControl migration (net -106 lines)
- Deleted `AlphabetToggle`, `CasingToggle`, `UnitToggle`, `KindToggle` + their Props interfaces.
- Each call site renders `SegmentedControl` with byte-identical `role="group"` aria-labels ("Base64 alphabet" / "Hex casing" / "Timestamp unit" / "ID kind"), visible button labels, and `aria-pressed` semantics.
- hash: boolean `upper` mapped at the call site (`value={upper ? "upper" : "lower"}`); SegmentedControl NOT widened.
- uuid-ulid: `KIND_OPTIONS` derived from the existing `KINDS` array.
- Pre-approved markup delta applied: `cursor-pointer` dropped on hash/uuid-ulid toggle buttons (only delta; invisible in screenshots, untested by any spec).

### Task 2 — Sidebar decomposition (823 → 631 lines)
- `useSidebarDragDrop.ts`: `ToolGroup` type (exported, Sidebar imports it), 3 drag states, 5 callbacks moved verbatim — locked path keeps preventDefault + upsell BEFORE any state set (T-18-12); gap-index math + bail-on-missing-id intact (T-Q-01); same-group scoping intact (PIN-06). Inputs: `{ orderingUnlocked, openOrderingUpsell, groupOrder, commitMove }`.
- `SidebarResetMenu.tsx`: `useSidebarResetMenu({ navRef, rowRefs })` hook (open/close/focus-restore/dismiss incl. the timeout-0 deferred click-away and the WR-02 connected/not-body/tabIndex>=0 fallback chain) + `SidebarResetMenu` component rendering the `role="menu"` JSX. `resetOrder`/`unpinAll` STAY in Sidebar (they own prefs setters + announce + the upsell branch) and arrive as props.
- Sidebar.tsx remains the composition root with the same `Sidebar` named export: registry partition, entitlements gate, announce/aria-live, togglePin, commitMove, the WHOLE `onRowKeyDown` keyboard model (incl. `e.code === "KeyP"`), renderRow, footer/upsell — all untouched. The 15 drag JSX bindings keep identical call shapes (handler source = hook returns).

### Task 3 — automated half (DONE)
- `bash scripts/e2e-spike.sh`: **15/15 specs, 20/20 tests green** on the real WKWebView, specs UNMODIFIED (sidebar.e2e.ts + entitlements.e2e.ts included — composed-key Alt+P dispatch `key:"π"/code:"KeyP"` proves the physical-key path survived).
- Fresh screenshots (this run) reviewed — toggle groups render identically:
  - `test/e2e/__screenshots__/base64-wkwebview.png`
  - `test/e2e/__screenshots__/hash-wkwebview.png`
  - `test/e2e/__screenshots__/unix-time-wkwebview.png`
  - `test/e2e/__screenshots__/uuid-ulid-wkwebview.png`
- **Human walkthrough PENDING** (manual drag in both groups, end-zone, no cross-boundary, persistence — WebDriver cannot synthesize HTML5 DnD).

## Verification Evidence

- Per-commit lefthook gate green twice: tsc --noEmit + vitest (816/816) + eslint (0 errors, 0 warnings).
- `git diff HEAD~2 --stat -- '*.test.*' 'test/e2e'` → **0 lines** (unit + e2e specs unmodified).
- `git diff HEAD~2 --stat -- src/lib/protobuf/` → **0 lines** (decoder + 19 tests untouched).
- Line-by-line diff review of the drag/menu extraction vs original: code moved verbatim (the manual net for the WebDriver-uncoverable drag handlers).

## Deviations from Plan

**1. [Rule 3 - Lint hygiene] eslint-disable for react-refresh/only-export-components**
- **Found during:** Task 2
- **Issue:** the plan's mandated single-file shape (hook + component in SidebarResetMenu.tsx) triggers the warn-level react-refresh rule; repo was otherwise 0-warning.
- **Fix:** targeted `eslint-disable-next-line` with rationale comment on the hook export.
- **Files modified:** src/components/SidebarResetMenu.tsx
- **Commit:** c6b2bf9a

**2. [Estimate miss, not a spec break] Sidebar.tsx is 631 lines, not "~under 500"**
- The two plan-specified seams are fully extracted (-192 lines). Everything remaining (keyboard model, renderRow JSX, partition, announce, footer) is explicitly mandated by the plan to stay in Sidebar. Extracting more would violate the conservative-move instruction. The binding must_haves truths carry no line-count requirement.

**3. [Behavior-neutral] closeResetMenu dep array `[]` → `[navRef, rowRefs]`**
- Required once navRef/rowRefs became hook params; both are stable ref identities, so the callback identity and behavior are unchanged.

## Known Stubs

None.

## Threat Flags

None — no new endpoints, input paths, or trust-boundary changes. T-Q-01/02/03 mitigations verified: bail-guard + gap math line-diff-confirmed verbatim; locked branches return before any setter (entitlements e2e green unmodified); announce stays in Sidebar speaking registry names.

## Self-Check: PASSED

- src/components/useSidebarDragDrop.ts — FOUND
- src/components/SidebarResetMenu.tsx — FOUND
- Commit c941dda0 — FOUND
- Commit c6b2bf9a — FOUND
- 15/15 e2e specs green (E2E_EXIT=0)
