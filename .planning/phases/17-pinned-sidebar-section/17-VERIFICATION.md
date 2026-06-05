---
phase: 17-pinned-sidebar-section
verified: 2026-06-05T23:50:00Z
status: human_needed
score: 6/6 success criteria verified (automated)
overrides_applied: 0
human_verification:
  - test: "Native pointer DRAG reorder WITHIN each group (pinned and unpinned)"
    expected: "A dragged row reorders inside its own group via native OS pointer drag and NEVER crosses the pinned↔unpinned divider; the neutral insertion line tracks the drop slot"
    why_human: "macOS WebKit's embedded WebDriver cannot synthesize native OS drag (dragDropEnabled:false from v1.4); the keyboard reorder path IS e2e-proven, only the pointer-drag path needs a human"
  - test: "Pin-icon reveal on pointer HOVER for unpinned rows"
    expected: "Hovering an unpinned row reveals its outline pin icon (group-hover:opacity-100); pinned rows show a persistent filled pin; clicking the icon toggles membership without navigating"
    why_human: "WebDriver cannot synthesize native pointer hover; the focus-visible reveal is keyboard-reachable and e2e-covered, but the hover affordance is visual/pointer-only"
  - test: "tauri build walkthrough + gsd-ui-review WCAG-AA audit"
    expected: "Fresh `pnpm tauri build` produces a launchable .app/.dmg under src-tauri/target/release/bundle/macos/ (ignore the absent-updater-key non-zero exit); human launches, walks the pin/unpin/reorder flow, and a gsd-ui-review WCAG-AA audit passes"
    why_human: "Phase-boundary human sign-off gate (binding harness); visual/UX quality + WCAG-AA audit are not programmatically verifiable"
---

# Phase 17: Pinned Sidebar Section Verification Report

**Phase Goal:** A user can pin the tools they use most into a distinct "Pinned" section above the rest of the sidebar — by a row pin icon or a keyboard shortcut — and that pinned set is remembered across restarts, reorderable independently of the unpinned list, while the registry stays the canonical source of truth.
**Verified:** 2026-06-05T23:50:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria — the contract)

| # | Truth (Success Criterion) | Status | Evidence |
| --- | --- | --- | --- |
| SC-1 | Pin icon (hover AND keyboard-focus) moves a tool into a "Pinned" section at the top; clicking again returns it to the main list *(PIN-01/02/04)* | ✓ VERIFIED | `Sidebar.tsx:496-517` — pin `<button>` LEFT of grip (`right-7`), `togglePin(tool.id)` on click with `preventDefault`+`stopPropagation` (no navigate); pinned rows persistent `text-tx-2` filled `Pin`, unpinned `opacity-0 group-hover:opacity-100 focus-visible:opacity-100`. Pinned group rendered at `:592-596`. e2e Alt+P pin/unpin proven (`sidebar.e2e.ts:350-369`, `:421-442`). |
| SC-2 | "Pinned" section + divider appear only when ≥1 pinned; vanish entirely at zero *(PIN-03)* | ✓ VERIFIED | `Sidebar.tsx:592-599` — both group `<div role="group" aria-label="Pinned tools">` and `<hr>` divider gated on `pinned.length > 0` (the post-reconcile array, Pitfall 5). e2e asserts group null at zero, non-null after Alt+P, vanishes on unpin (`sidebar.e2e.ts:339-343, 360-363, 427-437`). |
| SC-3 | Keyboard shortcut pins/unpins the focused tool with no mouse; every pin/unpin announced via aria-live *(PIN-05)* | ✓ VERIFIED | `Sidebar.tsx:271-275` Alt+P branch in `onHandleKeyDown` (Alt-guarded, `:267`); `togglePin` announces `Pinned ${tool.name}`/`Unpinned ${tool.name}` (`:183`) via the `aria-live="polite"` sr-only region (`:606-608`) using the registry `tool.name` (T-17-05 closed). e2e asserts `/^Pinned .+/` and `/^Unpinned .+/` (`sidebar.e2e.ts:365-369, 438-442`). |
| SC-4 | Tools reorder independently within each group; membership changes only by pin/unpin, never drag-across-boundary *(PIN-06)* | ✓ VERIFIED (keyboard) / ⚠ human (pointer drag) | `draggingGroup` state (`:73`) scopes drag; `onRowDragOver` ignores cross-group (`:201`); `onNavDragOver` parks at active group length (`:222`); `commitMove` routes pinned→`setPinnedToolIds`, unpinned→`setToolOrder` (`:158-159`); Alt+↑/↓ clamps within own group (`:278-284`). Keyboard no-cross-boundary e2e-proven both directions (`sidebar.e2e.ts:371-397`). Native pointer drag → human. |
| SC-5 | Pinned set survives restart (`pinnedToolIds: string[]` via prefs seam); unknown/removed ID degrades gracefully — unknown dropped, dupes collapsed, no crash/missing/dup *(PIN-07/08)* | ✓ VERIFIED | `preferences.ts:40,55` field + default `[]`; `prefsStore.ts:90-101` `coercePinnedToolIds` (non-array→[], drop non-strings, de-dupe, NO cap) wired in `mergePreferences:116`; `toolOrder.ts:61-82` `partitionTools` registry-gates + de-dupes, reuses `reconcileToolOrder` for the remainder (full registry partition). 14 partition cases + 10 coerce cases green; e2e persistence across `browser.refresh` (`sidebar.e2e.ts:404-419`). |
| SC-6 | Keyboard-reachable "Unpin all" (alongside "Reset order") clears the whole set in one action *(PIN-09)* | ✓ VERIFIED | `Sidebar.tsx:637-647` second `role="menuitem"` "Unpin all" in the Shift+F10 reset menu, gated on `pinned.length > 0`; `unpinAll` calls `setPinnedToolIds([])` + announces "All tools unpinned" (`:378-382`). e2e drives Shift+F10 → click "Unpin all" → set cleared (`sidebar.e2e.ts:444-479`). |

**Score:** 6/6 success criteria verified by automated means. SC-4's native-pointer-drag path and the hover affordance are routed to human verification (WebDriver cannot synthesize native drag/hover — a binding constraint, not a gap).

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `src/shell/preferences.ts` | `pinnedToolIds: string[]` + default `[]` | ✓ VERIFIED | Field `:40`, default `:55`. |
| `src/shell/prefsStore.ts` | `coercePinnedToolIds` (no cap) wired in `mergePreferences` | ✓ VERIFIED | `:90-101` + wired `:116`. |
| `src/shell/usePreferences.ts` | `setPinnedToolIds` + `togglePinned` | ✓ VERIFIED | Interface `:36,39`; impl `:94-108`; returned `:125-126`. togglePinned deps on `preferences.pinnedToolIds` (correct closure). |
| `src/shell/toolOrder.ts` | pure `partitionTools` + `ToolPartition`, reusing `reconcileToolOrder` | ✓ VERIFIED | `:48-82`; remainder via `reconcileToolOrder(toolOrder, remainderRegistry)` `:80`. |
| `src/components/Sidebar.tsx` | two-group render, pin icon, Alt+P, per-group reorder, "Unpin all" | ✓ VERIFIED | 652 lines (min 480); `partitionTools` consumed `:54`; all behaviors present + WIRED. |
| `*.test.ts` (3 files) | partition matrix (14), coerce (10), togglePinned (4) | ✓ VERIFIED | All present; full vitest 685/685 green. |
| `test/e2e/sidebar.e2e.ts` | keyboard e2e: Alt+P, per-group Alt+↑/↓, Unpin all, persistence | ✓ VERIFIED | `dispatchAltP`, "Pinned tools", "Unpin all", F10, `browser.refresh` all present; screenshot artifact `sidebar-pinned-wkwebview.png` written 2026-06-05. |

### Key Link Verification

| From | To | Via | Status |
| --- | --- | --- | --- |
| Sidebar.tsx | toolOrder.ts | `partitionTools(preferences.pinnedToolIds, preferences.toolOrder, registryIds)` `:54-58` | ✓ WIRED |
| Sidebar.tsx | usePreferences.ts | `togglePinned`/`setPinnedToolIds`/`setToolOrder` per group `:47,158-159,182` | ✓ WIRED |
| Sidebar.tsx | aria-live region | `announce(\`Pinned ${tool.name}\`)` `:183` → sr-only region `:606` | ✓ WIRED |
| prefsStore.ts | mergePreferences | `coercePinnedToolIds(blob.pinnedToolIds)` `:116` | ✓ WIRED |
| toolOrder.ts | reconcileToolOrder | partitionTools remainder `:80` | ✓ WIRED |
| sidebar.e2e.ts | Alt+P handler | dispatched bubbling `KeyboardEvent({ key:"p", altKey:true })` `:74-80` | ✓ WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| Sidebar.tsx pinned group | `pinned` | `partitionTools(preferences.pinnedToolIds, …)` over `ENABLED_TOOLS` | Yes — real registry IDs reconciled from persisted prefs | ✓ FLOWING |
| Sidebar.tsx unpinned group | `unpinned` | `reconcileToolOrder` over registry-minus-pinned | Yes — full registry remainder | ✓ FLOWING |
| pin state per row | `pinnedSet` | `useMemo(new Set(pinned))` (reconciled, not raw pref) | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Full unit suite green | `pnpm vitest run` | 57 files, 685/685 passed | ✓ PASS |
| Decoder 19 tests untouched + green | `pnpm vitest run …/decoder.test.ts` | 19/19 passed | ✓ PASS |
| Typecheck clean | `pnpm exec tsc --noEmit` | exit 0 | ✓ PASS |
| Zero new deps | `git diff package.json pnpm-lock.yaml` (6 commits) | no diff | ✓ PASS |
| decoder.ts byte-untouched | `git log` decoder.ts | last change phase 01-01; no phase-17 touch | ✓ PASS |
| Registry/router/palette untouched | `git diff` phase commits | no changes; CommandPalette last touched Phase 2 | ✓ PASS |
| HashRouter only | grep src | `createHashRouter`, no `BrowserRouter` | ✓ PASS |
| Real-WKWebView e2e | scripts/e2e-spike.sh (per SUMMARY 14/14) | screenshot artifact present, dated 2026-06-05 | ? SKIP (re-run is phase-gate; artifact + green claim consistent) |

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
| --- | --- | --- | --- |
| PIN-01 (pin → Pinned section) | 17-02 | ✓ SATISFIED | SC-1 |
| PIN-02 (unpin → main list) | 17-02 | ✓ SATISFIED | SC-1 |
| PIN-03 (section + divider only when ≥1 pinned) | 17-02 | ✓ SATISFIED | SC-2 |
| PIN-04 (pin icon on hover + focus) | 17-02 | ✓ SATISFIED | SC-1 (focus path automated; hover → human) |
| PIN-05 (keyboard shortcut + aria-live) | 17-02 | ✓ SATISFIED | SC-3 |
| PIN-06 (independent per-group reorder, no cross-boundary) | 17-02 | ✓ SATISFIED | SC-4 (keyboard automated; pointer drag → human) |
| PIN-07 (persist pinnedToolIds via prefs seam) | 17-01 | ✓ SATISFIED | SC-5 |
| PIN-08 (graceful degrade — drop unknown, collapse dupes) | 17-01 | ✓ SATISFIED | SC-5 |
| PIN-09 ("Unpin all" keyboard-reachable) | 17-02 | ✓ SATISFIED | SC-6 |

All 9 phase requirement IDs accounted for. REQUIREMENTS.md maps exactly these 9 to Phase 17 — no orphaned requirements.

### Anti-Patterns Found

None blocking. No TODO/FIXME/placeholder/stub patterns in the modified files. The 17-REVIEW.md WR-01/WR-02 menu-focus warnings are already addressed in the final `Sidebar.tsx` (`:357-368` body/tabIndex guard; `:403-405` deferred click-away listener). IN-04 group-naming polish was applied (`groupSuffix`, `:135-139`). No accent misuse (pin icons use neutral `text-tx-2`/`text-tx-3` tokens; insertion line `bg-tx-2`).

### Human Verification Required

1. **Native pointer DRAG reorder within each group** — drag a row inside the pinned group and inside the unpinned list; confirm it reorders and NEVER crosses the divider. (WebDriver cannot synth native drag; keyboard path is proven.)
2. **Pin-icon reveal on pointer HOVER** for unpinned rows — hover reveals the outline pin; pinned rows show a persistent filled pin; click toggles without navigating.
3. **tauri build walkthrough + gsd-ui-review WCAG-AA audit** — fresh build launches; walk the full pin/unpin/reorder/"Unpin all" flow; pass the WCAG-AA audit. (Binding phase-boundary human gate.)

### Gaps Summary

No gaps. All 6 ROADMAP success criteria and all 9 PIN requirements are satisfied with substantive, wired, data-flowing implementations. Backbone (17-01) and UI (17-02) are byte-consistent with their SUMMARY claims, verified against source. Constraints hold: zero new runtime/dev deps, `decoder.ts` + 19 tests byte-for-byte untouched and green, HashRouter only, registry/⌘K palette/router unmutated (single control plane preserved), full vitest 685/685, tsc clean. Status is `human_needed` solely because three items are inherently human-only by the project's binding context: native pointer drag, hover reveal, and the phase-boundary `tauri build` + `gsd-ui-review` sign-off — none are implementation gaps.

---

_Verified: 2026-06-05T23:50:00Z_
_Verifier: Claude (gsd-verifier)_
