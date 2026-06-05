---
phase: 16-reorderable-sidebar-tool-list
plan: 02
subsystem: ui
tags: [sidebar, reorder, drag-and-drop, keyboard-a11y, aria-live, wcag, e2e, wkwebview]
requires:
  - phase: 16-01
    provides: "reconcileToolOrder + moveToolInOrder (src/shell/toolOrder.ts), toolOrder Preferences field, usePreferences().setToolOrder"
  - phase: 02
    provides: "Sidebar.tsx registry projection + NavLink active styling"
provides:
  - "Reorderable Sidebar.tsx: reconciled toolOrder overlay over ENABLED_TOOLS (registry/palette/router untouched)"
  - "Handle-initiated native HTML5 drag with a neutral (non-accent) insertion-line drop indicator"
  - "Alt+up/down keyboard reorder (one slot/press, moved item keeps focus, plain arrows unbound)"
  - "aria-live=polite announcements ('Moved {tool} to position N of M') on every move"
  - "Reset-order affordance (right-click context menu + Shift+F10 keyboard path) that sets toolOrder=[]"
  - "Real-WKWebView e2e gate (test/e2e/sidebar.e2e.ts) + sign-off screenshot"
affects: [future pinning feature, settings surface, any new tool added to the registry]
tech-stack:
  added: []
  patterns:
    - "Presentation-overlay render (reconcileToolOrder) layered over the canonical registry — D-10"
    - "Native HTML5 drag events on a dedicated grip handle (zero dnd library) — D-02"
    - "Handle-only draggable so plain NavLink clicks still navigate — D-01/REORD-02"
    - "Additive Alt+arrow keyboard reorder that does NOT introduce roving navigation — D-04/D-05"
    - "Ref-map + post-render focus restoration so the moved item keeps keyboard focus"
    - "aria-live=polite live region for perceivable, sight-free reorder feedback — D-06"
key-files:
  created:
    - "test/e2e/sidebar.e2e.ts"
    - "test/e2e/__screenshots__/sidebar-wkwebview.png"
    - ".planning/phases/16-reorderable-sidebar-tool-list/16-UI-REVIEW.md"
  modified:
    - "src/components/Sidebar.tsx"
key-decisions:
  - "Drop-indicator token bd-2 -> tx-2 to clear WCAG 1.4.11 non-text contrast (3:1) on the neutral insertion line"
  - "Drove Alt+ArrowDown in the e2e via a bubbling KeyboardEvent dispatch to work around a WebKit WebDriver Alt-modifier key-chord gap"
  - "Keyboard-reachable reset via Shift+F10 (opens the context menu) + focus-on-open + Escape-restore, so the reset affordance is not mouse-only (WCAG)"
patterns-established:
  - "Reorder UI is an overlay, never a registry mutation — the registry stays the single control plane"
  - "Accent stays selected-only; reorder chrome (grip, insertion line) uses neutral tokens"
requirements-completed: [REORD-01, REORD-02, REORD-03, REORD-04, REORD-05, REORD-06, REORD-07]
duration: ~human-paced (multi-session: implement + e2e + UI review + build + walkthrough)
completed: 2026-06-05
---

# Phase 16 Plan 02: Reorderable Sidebar UI Summary

**A user-reorderable sidebar — handle-initiated native HTML5 drag with a neutral insertion line, Alt+up/down keyboard reorder (moved item keeps focus, plain arrows unbound), `aria-live` "Moved {tool} to position N of M" announcements, and a keyboard-reachable Reset-order affordance — all as a persisted `toolOrder` overlay over the untouched registry, proven on the real macOS WKWebView and human-approved.**

## Performance

- **Tasks:** 3 (2 auto + 1 human-verify checkpoint, approved)
- **Files modified:** 1 (`Sidebar.tsx`)
- **Files created:** 3 (e2e spec, sign-off screenshot, UI-review report)
- **Completed:** 2026-06-05

## Accomplishments

- **Reordered overlay render (D-10, REORD-05/06):** `Sidebar.tsx` renders `reconcileToolOrder(preferences.toolOrder, ENABLED_TOOLS.map(t => t.id))` mapped through `getToolById` — the registry array, the ⌘K palette, and the router are never mutated. New tools append, unknown/removed ids drop, duplicates collapse (the list can never crash, drop, or duplicate a tool).
- **Handle-initiated native drag (D-01/D-02/D-03, REORD-01/02):** a `GripVertical` handle appears on row hover AND on its own `focus-visible`; only the handle is `draggable`, so a plain click on the row body still navigates via the existing `NavLink`. A thin neutral insertion line (NOT accent) shows the drop position during a drag, including an end-of-list drop zone. Zero new dependencies — native HTML5 drag events only.
- **Alt+arrow keyboard reorder (D-04/D-05, REORD-03/04):** the focused handle consumes only `Alt+ArrowUp`/`Alt+ArrowDown` (one slot per press) and re-focuses the moved tool after re-render; plain `ArrowUp`/`ArrowDown` stay unbound (no roving navigation introduced).
- **aria-live announcements (D-06, REORD-04):** one visually-hidden `aria-live="polite"` region announces `Moved {tool.name} to position {n} of {total}` on every drag and keyboard move, using the registry-controlled `tool.name` (closing the injection concern T-16-04).
- **Reset affordance (D-12, REORD-07):** a right-click context menu (plus a keyboard-reachable Shift+F10 path with focus-on-open and Escape-restore) with a "Reset order" item that calls `setToolOrder([])` and announces the reset.
- **Persistence (REORD-05):** every drag, Alt+arrow, and reset calls `setToolOrder(next)`, persisting through the Plan 01 prefs seam and surviving an app restart (proven across a webview reload in the e2e and in the human restart walkthrough).
- **Real-WKWebView e2e (`test/e2e/sidebar.e2e.ts`):** proves the default order renders, Alt+ArrowDown reorders by one slot and persists across reload, the move is announced via `aria-live`, and a plain NavLink click still navigates — with a sign-off screenshot captured.

## Task Commits

1. **Task 1: Reorderable Sidebar** — `026575b4` (feat) + WCAG drop-indicator fix `a3dc2927` (fix)
2. **Task 2: Real-WKWebView e2e gate** — `f91a777a` (test) + `4c64b900` (test, WebKit Alt-modifier workaround)
3. **UI-review a11y fixes** — `8c23ac9a` (fix: boundary aria-live announce, keyboard-reachable reset via Shift+F10 + focus-on-open + Escape-restore, end-of-list drop zone)
4. **gsd-ui-review WCAG-AA audit report** — `b7896524` (docs: `16-UI-REVIEW.md`)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified

- `src/components/Sidebar.tsx` — reorderable sidebar: reconciled overlay render, grip handle, native drag + neutral insertion line, Alt+arrow keyboard reorder with focus retention, `aria-live` region, right-click + Shift+F10 reset.
- `test/e2e/sidebar.e2e.ts` — real-WKWebView gate: default order renders, Alt+ArrowDown reorders + persists across reload, `aria-live` announces, plain click navigates.
- `test/e2e/__screenshots__/sidebar-wkwebview.png` — sign-off screenshot.
- `.planning/phases/16-reorderable-sidebar-tool-list/16-UI-REVIEW.md` — gsd-ui-review WCAG-AA audit (22/24, all 3 findings fixed).

## Decisions Made

- **Drop-indicator token `bd-2` → `tx-2`:** the neutral insertion line at `bd-2` did not meet WCAG 1.4.11 non-text contrast (3:1) against the sidebar background; moving to `tx-2` makes the drop position perceivable while still staying neutral (NOT accent — accent remains selected-only).
- **Keyboard-reachable reset:** the reset affordance is a right-click context menu, which is mouse-only by itself; added Shift+F10 to open it, focus-on-open, and Escape-to-restore so keyboard and screen-reader users can reach reset (WCAG).
- **e2e Alt+arrow via bubbling KeyboardEvent:** the WebKit WebDriver does not reliably deliver an Alt key-chord, so the e2e dispatches a bubbling `KeyboardEvent` to exercise the real `onKeyDown` handler rather than relying on the driver's key-chord path.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical (WCAG)] Drop-indicator contrast fix (`bd-2` → `tx-2`)**
- **Found during:** Task 1 / UI verification
- **Issue:** The neutral insertion-line token (`bd-2`) failed WCAG 1.4.11 non-text contrast (needs 3:1) against the sidebar background, so the drop position was not reliably perceivable.
- **Fix:** Switched the insertion-line token to `tx-2` — still neutral (accent stays selected-only) but contrast-compliant.
- **Files modified:** `src/components/Sidebar.tsx`
- **Verification:** gsd-ui-review WCAG-AA audit; visible on the real WKWebView.
- **Committed in:** `a3dc2927`

**2. [Rule 3 - Blocking (test harness)] WebKit WebDriver Alt-modifier key-chord gap**
- **Found during:** Task 2 (real-WKWebView e2e)
- **Issue:** The WebKit WebDriver did not reliably deliver an `Alt+ArrowDown` key chord, so the keyboard-reorder assertion could not exercise the real handler via the driver's native key path.
- **Fix:** Dispatched a bubbling `KeyboardEvent` (altKey + ArrowDown) so the e2e drives the actual `onKeyDown` handler on the real webview.
- **Files modified:** `test/e2e/sidebar.e2e.ts`
- **Verification:** e2e passes on the real WKWebView (14/14); the reorder persists across reload and is announced.
- **Committed in:** `4c64b900`

**3. [Rule 2 - Missing Critical (WCAG)] UI-review a11y closures**
- **Found during:** gsd-ui-review WCAG-AA audit (3 findings)
- **Issue:** Boundary-move feedback, keyboard-reachable reset, and an end-of-list drop target were missing/insufficient for AA.
- **Fix:** Added a boundary aria-live announcement (move-past-edge feedback), a keyboard-reachable reset (Shift+F10 + focus-on-open + Escape-restore), and an explicit end-of-list drop zone.
- **Files modified:** `src/components/Sidebar.tsx`
- **Verification:** gsd-ui-review re-run — 22/24, all 3 findings resolved (`16-UI-REVIEW.md`).
- **Committed in:** `8c23ac9a`

---

**Total deviations:** 3 auto-fixed (2 missing-critical WCAG, 1 blocking test-harness).
**Impact on plan:** All auto-fixes were correctness/accessibility requirements for the binding WCAG-AA gate and the real-WKWebView proof. No scope creep — the feature surface matches the plan exactly.

## Issues Encountered

- The WebKit WebDriver Alt-modifier gap (above) — resolved via a bubbling `KeyboardEvent` dispatch in the e2e; documented for future keyboard-chord e2e work.

## Verification Results

- **`pnpm exec tsc --noEmit`** → clean (exit 0).
- **`pnpm exec eslint`** → clean (exit 0).
- **Full `pnpm vitest run`** → 668/668 green; the **decoder suite 19/19** byte-for-byte untouched (immovable bar).
- **Real-WKWebView e2e** (`scripts/e2e-spike.sh`) → 14/14 green; `test/e2e/sidebar.e2e.ts` proves default order renders, Alt+ArrowDown reorders by one slot + persists across reload, `aria-live` announces, plain click navigates; screenshot captured.
- **Zero new dependencies** — `git diff package.json pnpm-lock.yaml` empty.
- **gsd-ui-review WCAG-AA audit** → 22/24, all 3 findings fixed (`16-UI-REVIEW.md`, commit `b7896524`).
- **`pnpm tauri build`** → bundle refreshed (`devtools-app.app` + `devtools-app_0.2.2_aarch64.dmg` under `src-tauri/target/release/bundle/macos/`); confirmed via the produced artifact, not the exit code (final non-zero exit is only the absent updater-signing key, per the harness).
- **Human sign-off:** the human walked the drag / click-safe / keyboard / VoiceOver / persist / reset steps on the handed-off built `.app` and typed **"approved"** on the real-WKWebView walkthrough.

## Threat Model Coverage

All STRIDE register mitigations for this plan implemented as planned:
- **T-16-05 (Tampering, tampered/oversized `toolOrder`):** render goes through `reconcileToolOrder` — output bounded by the registry set, unknown ids dropped, duplicates collapsed (D-11/REORD-06). The list cannot crash, drop, or duplicate a tool.
- **T-16-06 (Injection/XSS, tool name/id → DOM + aria-live):** React escapes text content; the aria-live message uses the registry-controlled `tool.name`, never raw stored `toolOrder` strings; no `dangerouslySetInnerHTML`.
- **T-16-07 (Elevation/Scope creep, drag/keyboard mutating registry/router):** reorder only writes the `toolOrder` pref overlay; `ENABLED_TOOLS`, the ⌘K palette, and the router are never mutated (D-10).
- **T-16-08 (DoS, rapid drag/key spam):** accepted as planned — each move is a single bounded `setToolOrder` over a tiny (≤11 id) blob; local-only, no network, no unbounded growth.

No new threat surface introduced beyond the register.

## Next Phase Readiness

- All seven REORD requirements (REORD-01..07) are delivered: REORD-05/06 backbone landed in 16-01; this plan completes 01/02/03/04/07 and consumes 05/06.
- Phase 16 (the sole v1.4 phase) is complete pending the orchestrator's phase-complete step; v1.4 "Reorderable Tools" is ready to ship/archive.
- No blockers. Deferred (by design, not this milestone): pinning the Protobuf hero / favourites; a dedicated settings surface for the reset control.

## Self-Check: PASSED

- FOUND: src/components/Sidebar.tsx
- FOUND: test/e2e/sidebar.e2e.ts
- FOUND: test/e2e/__screenshots__/sidebar-wkwebview.png
- FOUND: .planning/phases/16-reorderable-sidebar-tool-list/16-UI-REVIEW.md
- FOUND: commit 026575b4 (Task 1)
- FOUND: commit a3dc2927 (drop-indicator WCAG fix)
- FOUND: commit f91a777a (e2e)
- FOUND: commit 4c64b900 (e2e Alt-modifier workaround)
- FOUND: commit 8c23ac9a (UI-review a11y fixes)
- FOUND: commit b7896524 (UI-review report)

---
*Phase: 16-reorderable-sidebar-tool-list*
*Completed: 2026-06-05*
