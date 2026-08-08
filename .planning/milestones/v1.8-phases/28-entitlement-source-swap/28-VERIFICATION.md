---
phase: 28-entitlement-source-swap
verified: 2026-06-23T22:50:00Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  note: initial verification — phase went through the human ship-gate + two post-execution fix rounds (all on master, all gates green)
human_verification: []
---

# Phase 28: Entitlement-Source Swap + Store License Pane — Verification Report

**Phase Goal:** A StoreKit Pro purchase unlocks the same theming/ordering/⌘K capabilities through the one existing central gate (no relaunch); the store-build License pane shows only Buy + Restore + status (no Keygen concepts); a refund drops Pro live; and the entire Keygen surface is compiled out of the store bundle (the 3.1.1 compliance phase).
**Verified:** 2026-06-23T22:50:00Z
**Status:** passed
**Re-verification:** No — initial verification (post human ship-gate + 2 fix rounds)

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth (SC) | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Purchase unlocks Pro live through `resolveEntitlements` via a new `baseFromStoreKit` branch — no relaunch | ✓ VERIFIED | `resolve.ts:42` `baseFromStoreKit` intersects StoreKit codes with `ALL_ENTITLEMENTS`; `resolve.ts:82` `IS_APPSTORE ? baseFromStoreKit(await platform.iap.currentEntitlements()) : baseFromLicense(...)` — store arm NEVER calls `license.status()`. Live-flip: `storeBoot.ts` `onPurchaseUpdated → refreshEntitlements`; Buy-success also calls `refreshEntitlements()` directly (`useStoreCheckout.ts:107`, belt-and-suspenders). `store.ts` adds monotonic `refreshSeq` so a stale read can't overwrite a newer purchase. Live round-trip human-approved (sandbox purchase → Pro unlocked, no relaunch). |
| 2 | Restore Purchases behind an explicit button (Apple-mandatory; never silent at launch) | ✓ VERIFIED | `useStoreCheckout.ts:134` `onRestore` → `platform.iap.restore()` then `refreshEntitlements()` then reads `currentEntitlements()`. Restore button renders on the Free pitch (`StoreUpsellBody.tsx:175-179`). `storeBoot.ts` boot listener NEVER calls `restore` (no silent AppStore.sync — D-08; unit Test 6). Restore human-approved working. **Deviation:** Restore now lives on the Free pitch only (removed from the Pro-active pane in fb37295b — an already-Pro user has nothing to restore). Achieves the requirement intent (always-available restore for a not-yet-Pro user). |
| 3 | A refund/revocation drops Pro live, reusing the "Pro features turned off" drop-notice | ✓ VERIFIED (mechanism + unit + human-by-mechanism) | `store.ts:89,117` captures `wasPro` and on `wasPro && !isPro(next)` writes `licenseDropNoticeAck=false` through the shared `updatePreferences` singleton, guarded by `whenPreferencesLoaded()` (hydrate-guard, dc9ba512/d06968c2). Drop-notice rendered in `StoreLicenseSettings.tsx:45-69`. Unit-covered (store.test.ts drop-diff Tests 1–4 + StoreLicenseSettings.test.tsx). LIVE refund path not directly exercised (sandbox can't issue a non-consumable refund without Xcode local StoreKit testing) — documented in REFUND-TEST-RUNBOOK.md; treated as human-verified-by-mechanism per phase context, not a gap. |
| 4 | Store License pane: status + Buy ("Buy Pro — Lifetime", price on the App Store sheet, not in-app) + Restore; NO key field/external buy link/literal price; every upsell trigger → StoreKit Buy/Restore, never the Keygen form | ✓ VERIFIED | `StoreLicenseSettings.tsx` two layouts gated on `isPro`; Free renders `StoreUpsellBody` (Buy + Restore + live OS-localized `displayPrice` via `useProDisplayPrice`, never a hardcoded number — D-12). `settingsPanes.tsx:39-55` static `IS_APPSTORE` switch selects Store* panes; `App.tsx:31` selects `StoreUpsell`; `proUpsellRouter.ts` routes all not-Pro triggers via an `if (IS_APPSTORE)` STATEMENT (consumers: CommandPalette/AppearanceSettings/Sidebar). Signed-bundle grep: zero `license.tinkerdev.io`/`tinkerdev.io/buy`/`$9`/key-field markers. |
| 5 | Store UI omits every Keygen-only concept; App-Store-managed wording for status | ✓ VERIFIED | Store surfaces are SEPARATE modules importing no Keygen subtree (StoreLicenseSettings/StoreUpsell/StoreUpsellBody copy class constants verbatim, never import LicenseSettings/UpsellPanel). `storeOpenProUpsell` routes unconditionally (no refreshNeeded/problem recovery split). Pro-active copy: "Pro is active — managed through the App Store." Bundle grep confirms no Keygen copy survived. |
| 6 | Keygen surface compiled OUT of the store build and grep-verifiable clean on the bundle | ✓ VERIFIED | `verify-appstore-bundle.sh --require-bundle`: "OK: no Keygen COPY markers … in the appstore-build dist/" + "OK: src/lib/license/licenseUi ABSENT from every store chunk (D-04, sentinel)". The D-04 fold-in guard (`licenseUiFoldInGuard.mjs`, shared by vite.config.ts + the `--selftest-realbuild` harness) inspects real `chunk.modules` fold-in inventory; dist sentinel reads `{licenseUiInChunks:false}`. `--selftest` exits 0 (all 4 copy markers + fold-in/missing-sentinel load-bearing; benign 'Activate' + clean sentinel pass). `main.tsx` has no static `licenseUi` import. |
| 7 | Store Updates pane RETAINED, App-Store-managed line, Check/Install REMOVED (not disabled); version readout may remain | ✓ VERIFIED | `StoreUpdatesSettings.tsx` keeps `platform.app.getVersion()` readout + "Your app updates are managed by the App Store."; imports none of the updater machinery (useUpdater/SettingToggle/time formatters). Selected via the `settingsPanes.tsx` static switch. |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/entitlements/resolve.ts` | baseFromStoreKit + IS_APPSTORE arm | ✓ VERIFIED | Present, intersect guard, store arm never reads license.status |
| `src/lib/entitlements/store.ts` | drop-diff + monotonic refresh | ✓ VERIFIED | wasPro diff, refreshSeq, whenPreferencesLoaded-guarded singleton write |
| `src/shell/storeBoot.ts` | onPurchaseUpdated → refreshEntitlements; no restore | ✓ VERIFIED | 34 lines, subscribes, never calls restore |
| `src/lib/platform/tauri.ts` | register_listener Channel wiring | ✓ VERIFIED | onPurchaseUpdated wired via plugin:iap|register_listener (per SUMMARY 02) |
| `src/main.tsx` | !IS_APPSTORE-gated licenseUi (dynamic, branch-local) | ✓ VERIFIED | runBoot() extracted, no module-scope licenseUi import |
| `src/components/StoreLicenseSettings.tsx` | Buy/Restore/status, drop-notice | ✓ VERIFIED | 118 lines, two layouts, drop-notice render |
| `src/components/StoreUpdatesSettings.tsx` | version + managed line | ✓ VERIFIED | 58 lines, no updater machinery |
| `src/components/StoreUpsell.tsx` | StoreKit Buy/Restore modal | ✓ VERIFIED | 133 lines, copied a11y wrapper + StoreUpsellBody |
| `src/components/StoreUpsellBody.tsx` | shared pitch + Buy + Restore + live price | ✓ VERIFIED | 198 lines (fb37295b shared pitch) |
| `src/shell/useStoreCheckout.ts` | shared Buy/Restore + useProDisplayPrice | ✓ VERIFIED | 162 lines (055225e2 /simplify extraction) |
| `src/shell/storeProUpsell.ts` / `proUpsellRouter.ts` | unconditional store router + static switch | ✓ VERIFIED | if(IS_APPSTORE) statement (not value ternary — tree-shake fix) |
| `scripts/licenseUiFoldInGuard.mjs` | generateBundle chunk-module guard | ✓ VERIFIED | 50 lines, chunk.modules inventory + sentinel emit |
| `scripts/verify-appstore-bundle.sh` | 4 copy markers + D-04 sentinel + freshness | ✓ VERIFIED | 666 lines; --selftest exits 0 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| resolve.ts | platform.iap.currentEntitlements | IS_APPSTORE-gated arm | ✓ WIRED | resolve.ts:83 |
| storeBoot.ts | refreshEntitlements | onPurchaseUpdated handler | ✓ WIRED | storeBoot.ts |
| store.ts | licenseDropNoticeAck=false | wasPro diff → updatePreferences singleton | ✓ WIRED | store.ts:117-121 |
| useStoreCheckout | platform.iap.purchase/restore + refreshEntitlements | Buy/Restore handlers | ✓ WIRED | useStoreCheckout.ts:104,107,141,144 |
| settingsPanes.tsx | StoreLicenseSettings/StoreUpdatesSettings | IS_APPSTORE lazy switch | ✓ WIRED | settingsPanes.tsx:39-55 |
| App.tsx | StoreUpsell | IS_APPSTORE lazy switch | ✓ WIRED | App.tsx:31 |
| proUpsellRouter.ts | storeOpenProUpsell | if(IS_APPSTORE) statement (3 consumers) | ✓ WIRED | tree-shake-correct (statement, not ternary) |
| verify script | dist sentinel | licenseui-inventory.json exact-root read | ✓ WIRED | licenseUiInChunks:false |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite | `pnpm vitest run` | 104 files, 1266/1266 passed | ✓ PASS |
| Type check | `pnpm tsc --noEmit` | exit 0 | ✓ PASS |
| Verify gate selftest | `verify-appstore-bundle.sh --selftest` | exit 0, all markers load-bearing, benign fixtures pass | ✓ PASS |
| Bundle D-04 + copy purity | `--require-bundle` (content checks) | "no Keygen COPY markers" + "licenseUi ABSENT from every store chunk" | ✓ PASS |
| Bundle freshness/linkage | `--require-bundle` (freshness) | FAIL — binary mtime older than last commit | ⚠️ see note below |
| decoder.ts + 19 tests | `git log` | last touched Phase 01 (90583b79), untouched in Phase 28 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| MAS-IAP-02 | 01, 02, 05 | Pro unlocks live, no relaunch, central gate | ✓ SATISFIED | baseFromStoreKit + live-flip; human-approved |
| MAS-IAP-03 | 03 | Explicit Restore from Settings ▸ License | ✓ SATISFIED | useStoreCheckout.onRestore; human-approved |
| MAS-IAP-05 | 02, 05 | Refund/revoke drops Pro live + drop-notice | ✓ SATISFIED (mechanism+unit+documented) | store.ts drop-diff; RUNBOOK; live-refund not directly driven (per context) |
| MAS-IAP-06 | 03 | Store License: status+Buy+Restore, no key/link/price | ✓ SATISFIED | StoreLicenseSettings + StoreUpsellBody; bundle grep-clean |
| MAS-IAP-07 | 03, 04, 05 | Omit Keygen concepts; upsell = StoreKit everywhere | ✓ SATISFIED | StoreUpsell + storeOpenProUpsell + static switches |
| MAS-BUILD-04 | 05 | Keygen surface compiled OUT + grep-clean bundle | ✓ SATISFIED | --require-bundle content checks pass; D-04 sentinel false |
| MAS-BUILD-07 | 03 | Updates pane retained, App-Store-managed, Check/Install removed | ✓ SATISFIED | StoreUpdatesSettings |

All 7 plan-declared requirement IDs are present in REQUIREMENTS.md and mapped to Phase 28 (lines 80–91). No orphaned requirements — REQUIREMENTS.md line 105 lists exactly these 7 for Phase 28, all claimed by plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | — | — | No stubs, TODOs, placeholders, or hollow data flows in the Phase-28 surfaces. All handlers fully wired to the platform.iap seam; no client-side grant. |

### Human Verification Required

None outstanding. The blocking live StoreKit purchase/Restore round-trip was driven at the human sandbox ship-gate and APPROVED (purchase → Pro live, no relaunch; Restore works; Free-state pitch renders). The live refund→drop-notice path is covered by mechanism (store.ts drop-diff) + unit tests + documentation (REFUND-TEST-RUNBOOK.md); per phase context it is treated as human-verified-by-mechanism, not a gap.

### Gaps Summary

No goal-blocking gaps. All 7 roadmap success criteria and all 7 requirement IDs are satisfied. Test suite (1266/1266), tsc, the verify-script selftest, and the signed-bundle content/D-04 purity checks all pass. The decoder and its 19 tests are byte-for-byte untouched.

**One non-blocking advisory (NOT a gap):** the `verify-appstore-bundle.sh --require-bundle` *freshness/linkage* check fails because the signed `.app` binary mtime (2026-06-23 22:28:09) predates the last commit `c06f897f` (22:44:28). Investigation confirms the two post-build commits (`60a70599`, `c06f897f`) touched ONLY `docs/appstore/REFUND-TEST-RUNBOOK.md` and `src-tauri/TinkerDev.storekit` (a local Xcode StoreKit-testing config) — ZERO frontend/Rust/build-config source changes landed after the gate build (`git log --since=22:28 -- src/ src-tauri/src/ scripts/ vite.config.ts` → 0). The last *source* commit `fb37295b` (22:26:45) predates the build. The bundle the human approved was therefore built after every behavior-affecting change; the freshness FAIL is a harness-conservative stale-artifact flag triggered by documentation commits, not a content or behavior regression. The bundle's content-purity proofs (Keygen-clean, D-04 sentinel false) PASS.

Recommended (housekeeping, not a phase blocker): a no-op rebuild of the signed bundle before the Phase-30 submission so the freshness/linkage check goes green and a stale `.app` is never carried into the irreversible ASC upload. (Phase 30 already mandates a build-LAST after all source lands.) Also worth confirming at Phase 30 that the checked-in `src-tauri/TinkerDev.storekit` test config is not shipped in the distribution bundle (it is bundled in the current dev-signed `.app`).

---

_Verified: 2026-06-23T22:50:00Z_
_Verifier: Claude (gsd-verifier)_
