---
phase: 26-storekit-bridge-spike
verified: 2026-06-23T00:00:00Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  note: "Initial verification — no prior VERIFICATION.md existed"
---

# Phase 26: StoreKit Bridge Spike Verification Report

**Phase Goal:** The store build can present the native StoreKit purchase sheet for the one non-consumable "Pro" product and verify the result on-device, behind a `platform.iap` seam that mirrors `platform.license` — proving the highest-risk, longest-pole dependency before anything downstream is built on it.

**Verified:** 2026-06-23
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

This is a SPIKE phase. Its live criteria (native sheet presenting, on-device verified grant, serverless no-network) were proven at a mandatory, WebDriver-impossible HUMAN gate (Plan 06 / D-06) on a dev-signed sandboxed build with a real Sandbox tester (`bkbklim+tinkerdev@gmail.com`, 2026-06-23). Those recorded results are accepted as evidence for the live criteria per the verification brief. All agent-verifiable claims were re-checked against the live codebase + bundle below (NOT trusted from SUMMARYs).

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `platform.iap` seam exists mirroring `platform.license` (products/purchase/restore/currentEntitlements/onPurchaseUpdated + getter) | ✓ VERIFIED | `index.ts`: `get iap` =1, `IapPurchaseResult`/`onPurchaseUpdated` =5; all 4 seam files present; tsc clean |
| 2 | The real `tauri.ts` arm reaches StoreKit via MODE A `invoke(iap_*)` + `listen(storekit://updated)`; no plugin/native import in seam files | ✓ VERIFIED | `tauri.ts`: 4 `iap_*` invokes + 2 `storekit://updated`; `@choochmeque` =0 across index/tauri/browser/stub; browser/stub iap arm = `createIapStub()` (native-free; the 9 `@tauri-apps` hits in browser.ts are doc-comment prose, not imports) |
| 3 | Rust fail-closed decision core: `.verified`→pro grant, `.unverified`/cancelled/pending→`[]`, over-grant intersect | ✓ VERIFIED | `mod.rs`: `intersect_pro`/`grant_from_outcome`/`granted_entitlements`/`purchase_state_to_result` =26 refs; 17 fail/unverified refs; serde camelCase JSON pinned (`"state":"pending"`/`"success"` =4); `cargo test --features appstore` = **99 passed / 0 failed** |
| 4 | `iap_*` commands wired to the plugin Rust API (MODE A), routed through the grant core, gated to appstore | ✓ VERIFIED | `commands.rs`: `get_products`/`.purchase(`/`restore_purchases`/`get_product_status`/`.iap()` =17; `intersect_pro` applied =7; `{ code }` IapError =6; `tauri_plugin_iap::init` in lib.rs =3 under `cfg appstore` (=6) |
| 5 | The `appstore` feature gates the plugin; direct build excludes it entirely | ✓ VERIFIED | `cargo tree` (default) `tauri-plugin-iap` =**0**; `cargo tree --features appstore` =**1**; `cargo build` (direct) Finished clean; `cargo build --features appstore` green |
| 6 | Minimal sandbox harness builds a universal App-Sandboxed signed `.app`; base config untouched | ✓ VERIFIED | `entitlements.appstore.plist` = app-sandbox + network.client + StoreKit-binding (application-identifier + team-identifier); 0 speculative (keychain/files.user-selected); base `tauri.conf.json` `10.15` =1; bundle `lipo` = `x86_64 arm64`, codesigned (Signature present) |
| 7 | Live round-trip: native sheet presents, verified grant, serverless verify, calm cancel, no-replay, restore re-grant (HUMAN gate, D-06) | ✓ VERIFIED (human gate) | Recorded in BRIDGE-VIABILITY + SANDBOX-WALKTHROUGH (2026-06-23): sheet presented `com.tinkerdev.app.pro` $8.99; PURCHASE→`pro.theming, pro.ordering`; CANCEL→calm; relaunch→no duplicate (finish() live-confirmed); Restore→re-granted; `nettop -p <PID>`→ZERO sockets. All four criteria PASS = `go-plugin` |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/platform/{index,tauri,browser,stub}.ts` | iap seam mirroring license | ✓ VERIFIED | iap capability + getter + MODE A arm + no-op stub; native-free seam |
| `src/lib/platform/iap.test.ts` | no-op + injection + contract tests | ✓ VERIFIED | 6 tests, part of vitest 1211/1211 |
| `src-tauri/src/iap/mod.rs` | fail-closed grant core + serde mirror | ✓ VERIFIED | 12980 bytes; 26 core-fn refs; serde pinned |
| `src-tauri/src/iap/commands.rs` | MODE A `iap_*` bodies + `{ code }` IapError | ✓ VERIFIED | real plugin calls + intersect_pro guard |
| `src-tauri/Cargo.toml` | appstore feature + optional plugin | ✓ VERIFIED | `appstore = ["dep:tauri-plugin-iap"]`; gating confirmed by cargo tree |
| `src-tauri/entitlements.appstore.plist` | app-sandbox + network.client (minimal) | ✓ VERIFIED | + 2 StoreKit-binding keys (required, documented); 0 speculative |
| `src/components/LicenseSettings.tsx` | temporary D-11 spike block | ✓ VERIFIED | TEMPORARY comment + platform.iap + currentEntitlements + product id; `@tauri-apps` =0 |
| `test/e2e/iap-spike.e2e.ts` | no-op-arm WKWebView smoke | ✓ VERIFIED | present |
| `docs/appstore/PHASE-26-{BRIDGE-VIABILITY,SANDBOX-WALKTHROUGH,PLUGIN-API-PREFLIGHT,ASC-CHECKLIST}.md` | gate evidence | ✓ VERIFIED | all 4 present; go/no-go = go-plugin FINAL |
| Universal signed `.app` bundle | criterion-1 artifact | ✓ VERIFIED | `TinkerDev.app` binary universal + signed |
| swift-rs bridge (Plan 07) | conditional — SKIPPED | ✓ CORRECT | `IapBridge.swift` absent, no swift-rs/SwiftLinker in Cargo/build.rs — correctly skipped on go-plugin |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `index.ts` Platform.iap | `active.iap` | `get iap()` getter | ✓ WIRED | auto-forward getter present |
| `tauri.ts` | `iap_*` Rust commands | `invoke()` | ✓ WIRED | 4 invokes mapped |
| `iap_*` commands | plugin StoreKit | `app.iap().<method>` MODE A | ✓ WIRED | 4 plugin Rust calls |
| grant decision | `PRO_ENTITLEMENTS` | verified→intersect filter | ✓ WIRED | `intersect_pro` over-grant guard on live results |
| `lib.rs` | `tauri_plugin_iap::init()` | `cfg(appstore) builder.plugin` | ✓ WIRED | registered under appstore cfg |
| spike button | `platform.iap.*` | `onClick → platform.iap` | ✓ WIRED | products/purchase/restore/currentEntitlements |

### Data-Flow Trace (Level 4)

The seam's no-op arms (browser/stub) intentionally produce `[]`/reject `{ code }` — these are environment-safe by design (T-26-05/06), NOT hollow stubs. The REAL data path (tauri.ts → `iap_*` → plugin Rust API → StoreKit → fail-closed grant core) was proven to produce real data at the live human gate: a verified purchase flowed `pro.theming, pro.ordering` through to the D-11 readout. Data flows: ✓ FLOWING (confirmed live).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Rust decision core green | `cargo test --features appstore` | 99 passed / 0 failed | ✓ PASS |
| Direct build excludes plugin | `cargo tree \| grep tauri-plugin-iap` | 0 | ✓ PASS |
| appstore build includes plugin | `cargo tree --features appstore` | 1 | ✓ PASS |
| Direct cargo build | `cargo build` | Finished clean | ✓ PASS |
| Frontend types | `pnpm tsc --noEmit` | exit 0 | ✓ PASS |
| Full JS suite | `pnpm vitest run` | 1211/1211 passed | ✓ PASS |
| IAP network audit | `grep -rEnc network-constructs src/iap/` | 0 | ✓ PASS |
| Universal bundle | `lipo -archs` | x86_64 arm64 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|--------------|-------------|--------|----------|
| MAS-IAP-01 | 01,02,03,04,05,06 | Native StoreKit sheet, one non-consumable, success/userCancelled/pending handled calmly | ✓ SATISFIED | Live gate: sheet presented, purchase granted, cancel calm; pending source-verified + unit-tested; `purchase_state_to_result` 0/1/2 mapper unit-tested |
| MAS-IAP-04 | 01,02,05,06,07 | On-device JWS verify; `.unverified`/failed falls closed to free | ✓ SATISFIED | OQ-2: plugin verifies JWS in Swift, only `.verified` crosses FFI; fail-closed Rust core (unverified→`[]`) unit-tested; both serverless checks (static audit + live `nettop` PID capture) PASS |

No orphaned requirements — both IDs mapped to Phase 26 in REQUIREMENTS.md appear in plan frontmatter and are marked Complete.

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| browser.ts / stub.ts / testStore.ts iap arms | `products → []`, mutations reject | ℹ️ Info | Intentional environment-safe no-ops (the seam's purpose); REAL arm is tauri.ts. NOT a stub. |
| LicenseSettings.tsx D-11 block | temporary dev scaffolding | ℹ️ Info | Explicitly marked temporary; removed in Phase 28 per D-11. UI audit not proportionate (permanent pane unchanged from Phase 25 which passed WCAG-AA). |
| `#![allow(dead_code)]` on iap/mod.rs | unused fail-closed branches | ℹ️ Info | Documented; the `Unverified`/`Cancelled`/`Pending` branches are unreachable on the happy path (plugin throws on non-success) but are the unit-tested fail-closed contract reserved for Phase 28 status mapping. |

No blockers or warnings. The two documented plugin limitations (fragile cancel/pending message string-match; not-yet-wired `onPurchaseUpdated`) did not trip a NO-GO and are explicitly deferred to Phase 28 — these are honest, recorded marks, not hidden gaps.

### Human Verification Required

None outstanding. The one mandatory human gate (Plan 06 live Sandbox-tester round-trip, D-06) was already run and approved by the user on 2026-06-23 ("round-trip approved"), with all four go/no-go criteria recorded PASS. Re-driving the native StoreKit sheet is explicitly out of scope per the verification brief.

### Gaps Summary

No gaps. The phase goal — a `platform.iap` seam mirroring `platform.license` that drives the native StoreKit sheet for the one non-consumable Pro product and verifies on-device serverlessly — is achieved and proven:

- The seam exists and is wired end-to-end (interface → getter → tauri.ts invoke → `iap_*` → plugin Rust API → fail-closed grant core), with browser/stub kept native-free.
- The Rust decision core is fail-closed and over-grant-guarded, unit-tested across all four StoreKit states (99 cargo tests green).
- The appstore feature gates the plugin so the direct channel is byte-unaffected (cargo tree 0/1).
- The longest-pole live dependency was proven at the mandatory human gate: native sheet presents, verified purchase grants the real pro codes, cancel is calm, relaunch fires no duplicate (finish() confirmed), Restore re-grants, and a process-scoped capture shows zero non-Apple outbound.
- decoder.ts + its 19 tests are byte-for-byte untouched.
- The conditional swift-rs fallback (Plan 07) is correctly SKIPPED given the go-plugin decision.
- Harness gates (simplify, code-review xhigh, codex adversarial — incl. the dropped `iap:default` over-grant + the pre-purchase product-id pin) were run by the orchestrator with findings fixed.

The go/no-go is FINAL = `go-plugin` (`tauri-plugin-iap@0.9`). Phase 26 completes.

---

_Verified: 2026-06-23_
_Verifier: Claude (gsd-verifier)_
