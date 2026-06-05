---
phase: 16-reorderable-sidebar-tool-list
verified: 2026-06-05T08:20:00Z
status: passed
score: 11/11 must-haves verified
overrides_applied: 0
human_verification_completed: true # human walked the real-WKWebView build + typed "approved" (per orchestrator + STATE.md + 16-02-SUMMARY.md)
---

# Phase 16: Reorderable Sidebar Tool List Verification Report

**Phase Goal:** A user can reorder the sidebar tools to suit their own workflow — by drag-and-drop or by keyboard — and that order is remembered across restarts, while the registry stays the canonical source of truth.

**Verified:** 2026-06-05T08:20:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

The phase goal decomposes into four observable outcomes, all verified against the codebase (not SUMMARY claims):
1. Reorder by drag-and-drop — VERIFIED (handle-only native HTML5 drag, neutral insertion line).
2. Reorder by keyboard — VERIFIED (Alt+↑/↓ one slot per press, plain arrows unbound, focus retained, aria-live announced).
3. Order remembered across restarts — VERIFIED (`setToolOrder` → prefs seam round-trip; proven across webview reload in e2e + human restart walkthrough).
4. Registry stays canonical — VERIFIED (`reconcileToolOrder` is a render overlay; `ENABLED_TOOLS`, ⌘K palette, router never mutated).

### Observable Truths

| #   | Truth (source) | Status | Evidence |
| --- | -------------- | ------ | -------- |
| 1 | Saved `toolOrder` persists across restart through the same prefs blob as `recentToolIds` (16-01) | ✓ VERIFIED | `preferences.ts:36` field + `:50` default `[]`; `prefsStore.ts:96` `mergePreferences` returns `toolOrder: coerceToolOrder(...)`; `usePreferences.ts:83-86` `setToolOrder` → `update({ toolOrder })` → `savePreferences`. e2e step 4 reloads webview and asserts order survived. |
| 2 | On load: present registry IDs render in saved order; absent registry IDs append at bottom in registry order; unknown ids dropped — no crash/missing/dup (16-01) | ✓ VERIFIED | `toolOrder.ts:19-43` `reconcileToolOrder`: registry `Set` membership gate (drop unknown), `emitted` Set (de-dupe), trailing append loop over `registryIds`. 13 vitest cases incl. permutation-invariant (Test 7). |
| 3 | A move helper relocates one tool to a new index, returning full new id order (16-01) | ✓ VERIFIED | `toolOrder.ts:49-62` `moveToolInOrder`: fresh array, clamp to `[0, length]`, unknown id no-op. Covered by Tests 8-13. |
| 4 | Reset clears `toolOrder` back to `[]` (16-01) | ✓ VERIFIED | `Sidebar.tsx:293-297` `resetOrder` calls `setToolOrder([])`; `usePreferences` write-on-change persists `[]` = default registry order. |
| 5 | Sidebar renders ENABLED_TOOLS in reconciled order; registry array unmutated (16-02) | ✓ VERIFIED | `Sidebar.tsx:40-41` derives `registryIds = ENABLED_TOOLS.map(...)` then `reconcileToolOrder(preferences.toolOrder, registryIds)`; maps via `getToolById`. No `.sort`/`.splice`/`.reverse` on `ENABLED_TOOLS`. |
| 6 | Grip handle on hover AND keyboard focus; dragging reorders; plain click still navigates (16-02) | ✓ VERIFIED | `Sidebar.tsx:408-427` grip `<button>` with `opacity-0 group-hover:opacity-100 focus-visible:opacity-100`; `draggable` ONLY on line 413 (button), NOT on NavLink (`:366` plain `<NavLink to={/tools/${tool.id}}`). e2e step 5 asserts plain click navigates. |
| 7 | Neutral/subtle insertion line shows drop position during drag (NOT accent) (16-02) | ✓ VERIFIED | `Sidebar.tsx:354-358` + `:430-434` insertion lines use `bg-tx-2` (neutral grey); grep confirms no `bg-accent` on any `h-[2px]` indicator. UI-REVIEW WCAG 1.4.11 pass. |
| 8 | Alt+↑/↓ moves one slot per press; plain arrows unbound; moved item keeps focus (16-02) | ✓ VERIFIED | `Sidebar.tsx:198-229` `onHandleKeyDown`: `if (!e.altKey) return` (plain arrows fall through), Alt+Arrow computes `current ± 1`, `commitMove(..., {focus:true})` + `focusAfterMoveRef` + `useLayoutEffect` (`:63-68`) re-focuses handle. e2e step 2a asserts plain ArrowDown does NOT reorder; 2b asserts Alt+ArrowDown moves one slot. |
| 9 | Each reorder announced via aria-live=polite: "Moved {name} to position {n} of {total}" (16-02) | ✓ VERIFIED | `Sidebar.tsx:100-108` `announceMove` uses registry `tool.name`, 1-based index, `next.length`; `:442-444` `<div aria-live="polite" className="sr-only">`. e2e step 3 asserts `/Moved .+ to position \d+ of \d+/`. |
| 10 | Reset affordance restores default registry order (sets toolOrder=[]) (16-02) | ✓ VERIFIED | `Sidebar.tsx:237-297` right-click (`onContextMenu`) + keyboard Shift+F10/ContextMenu (`:255-268`) open menu; `resetOrder` (`:293`) `setToolOrder([])`. Focus-on-open (`:301-303`), Escape-restore (`:307-319`). |
| 11 | Every reorder persists immediately via setToolOrder and survives restart (16-02) | ✓ VERIFIED | `commitMove` (`:112-120`) + `resetOrder` both call `setToolOrder(next)`; write-on-change via `savePreferences`. e2e step 4 proves persistence across reload; human walkthrough proved across quit/relaunch. |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/shell/toolOrder.ts` | Pure reconcile + move helpers, no React/DOM/platform | ✓ VERIFIED | 62 lines; exports `reconcileToolOrder` + `moveToolInOrder`; grep confirms no react/@tauri-apps/@/lib/platform imports. |
| `src/shell/toolOrder.test.ts` | 13-case vitest coverage | ✓ VERIFIED | Exists (3244 bytes); 13/13 pass. |
| `src/shell/preferences.ts` | `toolOrder: string[]` + default `[]` | ✓ VERIFIED | Interface `:36`, default `:50`. |
| `src/shell/prefsStore.ts` | `coerceToolOrder` in `mergePreferences` | ✓ VERIFIED | `:71-82` helper (string-only, de-dupe, no cap, non-array→[]); wired `:96`. |
| `src/shell/usePreferences.ts` | `setToolOrder` setter | ✓ VERIFIED | Interface `:32`, useCallback `:83-86`, returned `:104`. |
| `src/components/Sidebar.tsx` | Reorderable sidebar (overlay, handle, drag, Alt+arrow, aria-live, reset) | ✓ VERIFIED | 474 lines; contains `aria-live`, `onDragStart`/`onDrop`, `onKeyDown` altKey guard, handle-only `draggable`, neutral indicator, reset menu. |
| `test/e2e/sidebar.e2e.ts` | Real-WKWebView gate | ✓ VERIFIED | Exists; references `Alt`, `aria-live`, the `/Moved .+ to position \d+ of \d+/` regex, reload-persist assertion, plain-click-navigates assertion, screenshot. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `usePreferences.ts` | `preferences.ts` | `update({ toolOrder })` | ✓ WIRED | `:84` `update({ toolOrder: order })`. |
| `prefsStore.ts` | `mergePreferences` | `coerceToolOrder(blob.toolOrder)` | ✓ WIRED | `:96`. |
| `Sidebar.tsx` | `toolOrder.ts` | `reconcileToolOrder(...) + moveToolInOrder` | ✓ WIRED | imports `:27`; calls `:41`, `:114`. |
| `Sidebar.tsx` | `usePreferences.ts` | `setToolOrder(next)` on drop/Alt-arrow/reset | ✓ WIRED | `:35` destructured; called in `commitMove` `:115` and `resetOrder` `:294`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `Sidebar.tsx` rows | `orderedIds` | `reconcileToolOrder(preferences.toolOrder, ENABLED_TOOLS ids)` | Yes — `preferences` from `usePreferences` (async store load) overlaid on live registry | ✓ FLOWING |
| `Sidebar.tsx` aria-live | `announcement` | `announce()` set on every `commitMove`/boundary/reset | Yes — registry `tool.name` + computed index | ✓ FLOWING |
| persisted `toolOrder` | prefs blob | `savePreferences` → `platform.store.set` | Yes — proven across e2e webview reload + human restart | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Pure ordering/persistence units | `pnpm vitest run toolOrder/prefsStore/usePreferences` | 40/40 | ✓ PASS |
| Decoder immovable bar | `pnpm vitest run decoder.test.ts` | 19/19 | ✓ PASS |
| Full suite | `pnpm vitest run` | 668/668 (57 files) | ✓ PASS |
| Type safety | `pnpm exec tsc --noEmit` | exit 0 | ✓ PASS |
| Lint (Sidebar) | `pnpm exec eslint src/components/Sidebar.tsx` | exit 0 | ✓ PASS |
| Zero new deps | `git diff package.json pnpm-lock.yaml` | empty | ✓ PASS |
| Build bundle | `ls .../bundle/macos/` | `devtools-app.app` + `.dmg` present | ✓ PASS |
| NavLink not draggable | grep `draggable` | only line 413 (grip button) | ✓ PASS |
| Indicator not accent | grep `bg-accent` on indicator | none — uses `bg-tx-2` | ✓ PASS |
| Real-WKWebView e2e | `scripts/e2e-spike.sh` (run at last gate) | 14/14 per SUMMARY/STATE | ? SKIP (requires live WebDriver server; verified by prior gated run + human) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| REORD-01 | 16-02 | Drag via grip handle + drop indicator (native, no dnd lib) | ✓ SATISFIED | Handle-only native HTML5 drag (`:408-427`); neutral `tx-2` insertion line + end-of-list zone. |
| REORD-02 | 16-02 | Plain click navigates; drag never from normal click | ✓ SATISFIED | NavLink not draggable; only grip `draggable`. e2e step 5. |
| REORD-03 | 16-02 | Alt+↑/↓ keyboard reorder, no roving nav | ✓ SATISFIED | `onHandleKeyDown` altKey guard; plain arrows fall through. e2e step 2a/2b. |
| REORD-04 | 16-02 | aria-live announcement + focus retention | ✓ SATISFIED | `aria-live="polite"` "Moved … N of M"; `focusAfterMoveRef` + layout-effect re-focus. |
| REORD-05 | 16-01 (+16-02 consume) | Custom order persists across restarts via prefs seam | ✓ SATISFIED | `toolOrder` field + `coerceToolOrder` + `setToolOrder` round-trip; e2e reload + human restart. |
| REORD-06 | 16-01 | New tool appends; unknown/removed id degrades gracefully | ✓ SATISFIED | `reconcileToolOrder` append-new + drop-unknown + de-dupe; permutation-invariant test. |
| REORD-07 | 16-01 (backbone) + 16-02 (UI) | Reset to default registry order | ✓ SATISFIED | `resetOrder` → `setToolOrder([])`; right-click + Shift+F10 keyboard path. |

All 7 declared requirement IDs accounted for. REQUIREMENTS.md maps exactly REORD-01..07 to Phase 16 — no orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `toolOrder.ts` | 54 | `[...order]` then `return next` (empty-looking) | ℹ️ Info | Not a stub — returns a real reordered/copied array; covered by Test 13 (new ref, same set). |
| `Sidebar.tsx` | 340 | `if (!tool) return null` | ℹ️ Info | Defensive guard after `reconcileToolOrder` already guarantees registry membership; not a hollow render. |
| `prefsStore.ts` | 71-82 | `coerceToolOrder` non-array → `[]` | ℹ️ Info | Intentional untrusted-input defense (T-16-01), not an empty-data stub. |

No 🛑 blockers, no ⚠️ warnings. No TODO/FIXME/PLACEHOLDER in the phase files. The two post-approval defensive hardenings noted by the orchestrator (onDrop `from === -1` guard `:175-180`; reset-focus `isConnected` fallback `:280-288`) are present and do not change observed behavior.

### Human Verification Required

None outstanding. This is a binding-harness UI phase whose human sign-off was already completed and documented:
- STATE.md: "Phase 16 Plan 02 complete + human-approved"; 16-02-SUMMARY.md §Verification: human walked drag / click-safe / keyboard / VoiceOver / persist / reset on the built `.app` and typed "approved".
- gsd-ui-review WCAG-AA audit: 22/24, all 3 findings fixed (`16-UI-REVIEW.md`, commit `8c23ac9a` — boundary aria-live announce, keyboard-reachable Shift+F10 reset, end-of-list drop zone — all confirmed present in `Sidebar.tsx`).
- `pnpm tauri build` bundle confirmed under `src-tauri/target/release/bundle/macos/`.

### Gaps Summary

No gaps. All 11 must-haves (4 from Plan 01 + 7 from Plan 02), all 7 REORD requirements, all key links, and all data-flow traces verified against the actual codebase. Static gates re-run green at verification time (tsc 0, eslint 0, vitest 668/668 incl. decoder 19/19, zero new deps). The single SKIP (live-WebDriver e2e) was satisfied by the gated run recorded in STATE.md/SUMMARY (14/14) plus the human's real-WKWebView walkthrough; the e2e spec itself is present and asserts the load-bearing behaviors (render overlay, Alt+ArrowDown reorder+persist-across-reload, aria-live, plain-click-navigates). Registry stays canonical (overlay only — ⌘K palette/router untouched). Phase goal achieved.

---

_Verified: 2026-06-05T08:20:00Z_
_Verifier: Claude (gsd-verifier)_
