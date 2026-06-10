---
phase: 18-entitlements-seam-central-gate
plan: 01
subsystem: licensing
tags: [entitlements, licensing, react, useSyncExternalStore, prefs, upsell, wcag-aa]

# Dependency graph
requires:
  - phase: 17-pinned-tools (v1.5)
    provides: prefs seam (coercer pattern, loadPreferences/savePreferences), platform Tauri-detection + test-seam pattern
provides:
  - "src/lib/entitlements/ module: ENT_THEMING/ENT_ORDERING vocabulary, FULL_SET/FREE_SET, isEntitled/isToolLocked/gatePreferences predicates"
  - "resolveEntitlements() — THE single environment-split resolution point (Phase 21 flip point)"
  - "Snapshot store (refreshEntitlements + guarded set/resetEntitlementsForTest) + useEntitlements() hook"
  - "ToolDefinition.requiredEntitlements?: string[] (premium? deleted)"
  - "Preferences.entitlementsOverride: \"free\" | null (D-31 downgrade-only) + coercer"
  - "Shared UpsellPanel card + UpsellModal wrapper + BUY_LICENSE_URL stub constant (D-19..D-22, layout final)"
affects: [18-02 (router gate + lazy registry), 18-03 (sidebar/palette lock surfaces), 19 (license activation wires key affordance), 20 (real BUY_LICENSE_URL), 21 (flips resolveEntitlements Tauri arm)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Entitlements resolve through ONE module; all surfaces consume isToolLocked/gatePreferences/useEntitlements — no scattered checks (ENT-01/ENT-03)"
    - "Module-level snapshot + useSyncExternalStore with set-equality short-circuit on refresh"
    - "Test seams guarded by MODE === \"test\" || DEV exactly like setPlatformForTest"
    - "gatePreferences is a pure render-time VIEW — stored prefs never mutated on lock (D-26/D-27)"

key-files:
  created:
    - src/lib/entitlements/entitlements.ts
    - src/lib/entitlements/entitlements.test.ts
    - src/lib/entitlements/resolve.ts
    - src/lib/entitlements/store.ts
    - src/lib/entitlements/resolve.test.ts
    - src/shell/useEntitlements.ts
    - src/components/UpsellPanel.tsx
    - src/components/UpsellPanel.test.tsx
  modified:
    - src/lib/tools/types.ts
    - src/shell/preferences.ts
    - src/shell/prefsStore.ts
    - src/shell/prefsStore.test.ts
    - src/main.tsx

key-decisions:
  - "Deleted reserved premium?: boolean from ToolDefinition (zero call sites) — requiredEntitlements?: string[] replaces it (CONTEXT discretion, research recommendation)"
  - "Store's synchronous default snapshot = isTauriEnv() ? FULL_SET : FREE_SET so pre/post-resolution agree when no override exists (no startup lock-flash)"
  - "Added Tab focus trap to UpsellModal beyond plan spec — aria-modal without a trap fails WCAG-AA modal semantics (codex review P2)"

patterns-established:
  - "EntitlementSet = ReadonlySet<string>; FREE_SET/FULL_SET identity-stable module constants (resolved sets compared by setsEqual, returned by reference)"
  - "Entitlement vocabulary strings (pro.theming, pro.ordering) are the SAME strings later embedded in the Keygen license — keep stable"

requirements-completed: [ENT-01, ENT-02, ENT-03, ENT-04]

# Metrics
duration: 18min
completed: 2026-06-10
---

# Phase 18 Plan 01: Entitlements Seam & Central Gate Summary

**Central entitlements seam: `pro.theming`/`pro.ordering` vocabulary with `isToolLocked`/`gatePreferences` predicates, a single environment-split `resolveEntitlements()` (Tauri→FULL, browser→FREE, D-31 downgrade-only override), a `useSyncExternalStore`-backed snapshot store + `useEntitlements()` hook, and the final-layout shared `UpsellPanel`/`UpsellModal` — zero new dependencies, decoder untouched.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-06-10T14:00:11Z
- **Completed:** 2026-06-10T14:18:22Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments

- ENT-01/ENT-02: `requiredEntitlements?: string[]` on `ToolDefinition` (replacing the dead `premium?` seam) + the ONE predicate pair every surface will consume — `isToolLocked` for tools, `gatePreferences` for app-level theming/ordering gates. `gatePreferences` is a pure render-time view: stored prefs are never touched on lock, unlocking restores instantly (D-26/D-27).
- ENT-03: `resolveEntitlements()` is the single resolution point with an explicit Phase-21 flip comment — in-Tauri default FULL (shipped behavior unchanged), browser/jsdom deterministic FREE, and the persisted `entitlementsOverride: "free"` can only DOWNGRADE (coercer accepts exactly `"free"`, everything else → null; structurally impossible to unlock via prefs.json, T-18-01/T-18-02).
- Snapshot store propagates flips to ALL consumers via `useEntitlements()` (set-equality short-circuit prevents no-op re-renders); `set/resetEntitlementsForTest` guarded by the same MODE/DEV check as `setPlatformForTest` (T-18-03); non-blocking `refreshEntitlements()` kick-off wired in `main.tsx` beside `initPlatform()`.
- D-19..D-22: shared `UpsellPanel` (final layout — heading, no-pricing copy, stub "Buy license" CTA reading `BUY_LICENSE_URL`, inert "I have a license key" slot) + `UpsellModal` with full WCAG-AA dialog semantics (aria-modal + labelledby, Esc/scrim dismiss, focus-in on mount, focus-return on unmount, Tab focus trap).
- Suite grew 746 → 766 (20 new tests + the extended prefs matrix); `tsc` + `eslint` clean; `decoder.ts` + its 19 tests byte-for-byte untouched; zero new runtime/dev dependencies.

## Task Commits

Each task was committed atomically (tests landed GREEN with their impl per the lefthook RED-commit constraint):

1. **Task 1: Vocabulary + predicates + downgrade-only override** - `feb6ec97` (feat)
2. **Task 2: Resolver + snapshot store + useEntitlements + startup kick-off** - `dbf03f08` (feat)
3. **Task 3: Shared UpsellPanel card + UpsellModal wrapper** - `af374b0b` (feat) + `f3024ced` (fix: react-hooks/refs lint)

## Files Created/Modified

- `src/lib/entitlements/entitlements.ts` - Vocabulary (ENT_THEMING/ENT_ORDERING), FULL_SET/FREE_SET, isEntitled/isToolLocked/gatePreferences
- `src/lib/entitlements/resolve.ts` - isTauriEnv + resolveEntitlements (the Phase 21 flip point)
- `src/lib/entitlements/store.ts` - Snapshot + listeners, refreshEntitlements, guarded test seams
- `src/shell/useEntitlements.ts` - useSyncExternalStore hook over the store
- `src/components/UpsellPanel.tsx` - UpsellPanel card, UpsellModal wrapper, BUY_LICENSE_URL constant
- `src/lib/tools/types.ts` - requiredEntitlements added, premium? deleted
- `src/shell/preferences.ts` - entitlementsOverride field + default
- `src/shell/prefsStore.ts` - coerceEntitlementsOverride wired into mergePreferences
- `src/main.tsx` - refreshEntitlements() startup kick-off
- Tests: `entitlements.test.ts` (15), `resolve.test.ts` (8), `UpsellPanel.test.tsx` (12), `prefsStore.test.ts` (+6)

## Decisions Made

- Deleted `premium?: boolean` rather than keeping it beside `requiredEntitlements` — zero call sites verified by grep; one seam, not two (plan-sanctioned CONTEXT discretion).
- `setEntitlementsForTest`/`resetEntitlementsForTest` also short-circuit on set equality (consistent notify semantics with refresh).
- Modal focus-trap query uses a standard focusable selector scoped to the dialog; focus pulled back in if it escapes (covers programmatic focus loss too).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Tab focus trap added to UpsellModal**
- **Found during:** Task 3 (codex review of the working tree)
- **Issue:** `aria-modal="true"` promises assistive tech the background is inert, but Tab could move focus behind the scrim — failing WCAG-AA modal semantics (a binding project constraint)
- **Fix:** Document-level Tab handler cycles focus within the dialog (wraps both ends, recaptures focus that lands outside)
- **Files modified:** src/components/UpsellPanel.tsx, src/components/UpsellPanel.test.tsx
- **Verification:** New trap test (wrap forward/backward + recapture) green
- **Committed in:** af374b0b (Task 3 commit)

**2. [Rule 1 - Bug] react-hooks/refs lint error in UpsellModal**
- **Found during:** Plan-level verification (`pnpm lint`)
- **Issue:** `onCloseRef.current = onClose` assigned during render — forbidden ref access under react-hooks/refs
- **Fix:** Ref now synced via `useEffect(..., [onClose])`; the mount-once focus effect unchanged
- **Files modified:** src/components/UpsellPanel.tsx
- **Verification:** `pnpm lint` clean, all 12 component tests still green
- **Committed in:** f3024ced

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 bug)
**Impact on plan:** Both fixes confined to UpsellModal internals; no scope creep. The focus trap strengthens the WCAG-AA contract Plans 03/04 audit against.

## Known Stubs

Both stubs are plan-intentional (D-21/D-22 — layout final, wiring deferred):

| Stub | File | Reason / Resolving plan |
|------|------|------------------------|
| `BUY_LICENSE_URL = "https://example.invalid/devtools/buy"`; CTA onClick is a no-op | src/components/UpsellPanel.tsx | D-21 — Phase 20 swaps in the real MoR checkout link + wires the open |
| "I have a license key" button has no handler | src/components/UpsellPanel.tsx | D-22 — Phase 19 wires key-paste activation; slot reserved so layout is final now |

Neither blocks this plan's goal (the seam + final upsell layout); the gate itself is fully wired (store, hook, startup refresh).

## Issues Encountered

- Codex review of Task 1 flagged (P2) that no production code consumes the new gate yet — anticipated by the plan structure: Task 2 wired the store/hook/startup in this same plan, and Plans 02/03 wire the router/sidebar/palette consumers. Not actionable here.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 02 (router gate + lazy registry) and 03 (sidebar/palette lock surfaces) can now consume `useEntitlements()`, `isToolLocked`, `gatePreferences`, and `UpsellPanel`/`UpsellModal` directly — no further seam work needed.
- `resolveEntitlements()` carries the explicit Phase-21 flip comment; the D-31 override + test seams give Plans 02/03 deterministic free-tier fixtures.
- UpsellPanel visual verification intentionally deferred to Plan 03's surfaces + the Plan 04 phase gate (per plan `<verification>` — lib-only tasks need no real-WKWebView check).

---
*Phase: 18-entitlements-seam-central-gate*
*Completed: 2026-06-10*

## Self-Check: PASSED

All 8 created files + 5 modified files exist on disk; all 4 task commits (feb6ec97, dbf03f08, af374b0b, f3024ced) present in git log.
