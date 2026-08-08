---
phase: 28-entitlement-source-swap
plan: 01
subsystem: entitlements
tags: [entitlements, storekit, appstore, iap, gate, tree-shaking]

# Dependency graph
requires:
  - phase: 26-storekit-bridge-spike
    provides: platform.iap.currentEntitlements() seam (verified on-device StoreKit cache, [] when nothing owned)
  - phase: 27-build-variant-seam
    provides: IS_APPSTORE build-time channel constant (@/lib/platform/channel) for static tree-shaking
provides:
  - baseFromStoreKit arm in resolveEntitlements — the ONE gate-flip point (D-04/D-05) that resolves Pro from StoreKit in the appstore build
  - IS_APPSTORE-gated branch: store build reads platform.iap.currentEntitlements, never platform.license.status
  - over-grant + empty fall-closed guard mirroring baseFromLicense
affects: [28-store-license-pane, 28-purchase-handlers, 28-refund-revoke, refreshEntitlements]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Build-time IS_APPSTORE ternary selects the entitlement source; the unused arm + its import subtree tree-shake out of the store bundle"
    - "baseFromStoreKit mirrors baseFromLicense 1:1 — same intersection-with-ALL_ENTITLEMENTS over-grant discipline, one mental model"

key-files:
  created: []
  modified:
    - src/lib/entitlements/resolve.ts
    - src/lib/entitlements/resolve.test.ts

key-decisions:
  - "baseFromStoreKit intersects StoreKit codes with ALL_ENTITLEMENTS (defence-in-depth atop the Rust intersect_pro guard) so an over-broad code can never exceed pro.theming+pro.ordering"
  - "The appstore/direct source swap is a single IS_APPSTORE ternary inside resolveEntitlements; baseFromLicense is retained (direct build needs it, tree-shaken out of the store bundle)"
  - "The entitlementsOverride 'free' downgrade + DEV-only 'full' apply to BOTH arms unchanged"

patterns-established:
  - "StoreKit source arm: baseFromStoreKit(await platform.iap.currentEntitlements()) under IS_APPSTORE"
  - "Test mocks @/lib/platform/channel with a vi.hoisted mutable to flip IS_APPSTORE per-block; defaults false so existing direct-arm tests are unaffected"

requirements-completed: [MAS-IAP-02]

# Metrics
duration: ~10min
completed: 2026-06-23
---

# Phase 28 Plan 01: Entitlement-Source Swap (StoreKit arm) Summary

**`baseFromStoreKit` + the `IS_APPSTORE`-gated resolution arm — the appstore build now resolves Pro from the on-device StoreKit verified cache (`platform.iap.currentEntitlements()`) instead of the Keygen license, while the direct build's `baseFromLicense` path stays byte-behaviourally identical.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-23T13:39:35Z
- **Completed:** 2026-06-23T13:42:30Z
- **Tasks:** 1 (TDD)
- **Files modified:** 2

## Accomplishments

- Added `baseFromStoreKit(codes)` — mirrors `baseFromLicense`: intersects the StoreKit codes with `ALL_ENTITLEMENTS` (over-grant guard, T-28-01) and falls closed to FREE_SET on empty (T-28-02).
- Wired the `IS_APPSTORE` ternary inside `resolveEntitlements`: the store build calls `baseFromStoreKit(await platform.iap.currentEntitlements())` and NEVER `platform.license.status()` (T-28-03); the direct build keeps `baseFromLicense`. Because `IS_APPSTORE` is a Vite build-time constant, the dead arm + its license-seam import subtree tree-shake out of the store bundle (3.1.1 compliance).
- Preserved the `entitlementsOverride` "free" downgrade + DEV-only "full" for both arms (T-28-04).
- 7 mirror unit tests (intersection happy path, partial, over-grant drop, empty→FREE, status-spy-0-calls, store-empty, downgrade-only) — channel module mocked per-block via a `vi.hoisted` mutable.

## Task Commits

1. **Task 1: Add baseFromStoreKit + the IS_APPSTORE resolution arm (TDD)** — `d1fd34c9` (feat)

_TDD: tests + implementation landed in one commit (lefthook rejects failing-test commits — memory `tdd-red-commits-blocked-by-lefthook`)._

## Files Created/Modified

- `src/lib/entitlements/resolve.ts` — added `IS_APPSTORE` import, `baseFromStoreKit`, and the `IS_APPSTORE`-gated `base` computation.
- `src/lib/entitlements/resolve.test.ts` — added the channel-module mock + `iapArm`/`seedAppstorePrefs` helpers + the 7-test "appstore arm" describe block.

## Decisions Made

- StoreKit codes are intersected with `ALL_ENTITLEMENTS` (defence-in-depth atop the Rust `intersect_pro` 26-01 over-grant guard) so a forged/over-broad code can never exceed the two defined entitlements.
- `baseFromLicense` is retained verbatim (the direct build still needs it; the static `IS_APPSTORE` ternary drops it from the store bundle automatically).

## Deviations from Plan

None — plan executed exactly as written. The plan's Tests 1–4 described `baseFromStoreKit` directly; since that function is internal (same as `baseFromLicense`), they were exercised through `resolveEntitlements` with `IS_APPSTORE` true + a StoreKit iap arm, which is the same code path and the plan's stated behaviour for the arm.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Known Stubs

None new. The `else { base = FREE_SET }` arm is the pre-existing deterministic jsdom/preview free path (not a stub — no native/licensing path outside Tauri).

## Next Phase Readiness

- The resolution arm is live for the store build. Plan 02 supplies the live-flip trigger (`onPurchaseUpdated → refreshEntitlements`) that re-runs this arm after a purchase (no relaunch). The Restore/Buy handlers and the refund/revoke drop-notice all funnel through `refreshEntitlements()` → this arm.
- Gate/registry/`useEntitlements` are byte-unchanged; both variants still resolve to the same `pro.*` map.

## Self-Check: PASSED

- FOUND: src/lib/entitlements/resolve.ts
- FOUND: src/lib/entitlements/resolve.test.ts
- FOUND: .planning/phases/28-entitlement-source-swap/28-01-SUMMARY.md
- FOUND commit: d1fd34c9

---
*Phase: 28-entitlement-source-swap*
*Completed: 2026-06-23*
