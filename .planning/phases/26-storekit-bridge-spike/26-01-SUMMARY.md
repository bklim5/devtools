---
phase: 26-storekit-bridge-spike
plan: 01
subsystem: iap-decision-core
tags: [storekit, iap, mac-app-store, cargo-feature, fail-closed, entitlements]
requires:
  - "src/lib/entitlements/entitlements.ts (ALL_ENTITLEMENTS = pro.theming, pro.ordering)"
  - "the webdriver optional-dep + feature-gating precedent (Cargo.toml :36/:94)"
  - "license/mod.rs serde camelCase tagged-enum + license/commands.rs { code } rejection style"
provides:
  - "appstore cargo feature gating an optional tauri-plugin-iap@0.9 dep (direct build excludes it)"
  - "pure fail-closed IAP verify/grant decision core (grant_from_outcome / granted_entitlements / intersect_pro / purchase_state_to_result)"
  - "IapPurchaseResult + IapProduct serde camelCase mirror types (the TS contract)"
  - "iap_products / iap_purchase / iap_restore / iap_current_entitlements commands, all #[cfg(feature=appstore)]"
  - "the debug x appstore 2x2 generate_handler! matrix in lib.rs"
affects:
  - "Plan 05 (wires real tauri-plugin-iap purchase/verify onto this core)"
  - "Phase 27 (the build-variant seam drives the appstore feature)"
  - "Phase 28 (baseFromStoreKit consumes the granted entitlement set)"
tech-stack:
  added:
    - "tauri-plugin-iap 0.9 (optional, behind the appstore cargo feature)"
  patterns:
    - "cargo-feature gating of an optional native dep (mirrors webdriver)"
    - "pure error-as-value decision core, native call deferred to a later plan"
    - "serde internally-tagged camelCase enum mirroring the TS contract (mirrors LicenseStatusPayload)"
    - "{ code } prose-free rejection contract (mirrors LicenseError)"
key-files:
  created:
    - "src-tauri/src/iap/mod.rs (decision core + serde mirror types + 9 unit tests)"
    - "src-tauri/src/iap/commands.rs (4 iap_* command stubs + IapError + serde test)"
  modified:
    - "src-tauri/Cargo.toml (appstore feature + optional tauri-plugin-iap dep)"
    - "src-tauri/src/lib.rs (mod iap + the 2x2 generate_handler! matrix)"
decisions:
  - "appstore = [dep:tauri-plugin-iap] mirrors webdriver exactly; direct cargo tree excludes the plugin (T-26-03)"
  - "the whole iap module is #![cfg(feature=appstore)] so the direct build compiles zero iap code"
  - "fail-closed grant: ONLY Purchased(Verified) returns pro codes; everything else returns [] (T-26-01)"
  - "intersect_pro guards over-grant against PRO_ENTITLEMENTS (T-26-02), mirroring baseFromLicense (T-21-12)"
  - "invoke_handler is single-call -> the appstore commands fold into a debug x appstore 2x2 arm matrix (exactly one compiles per config)"
  - "spike command bodies are deterministic stubs (no native/network); Plan 05 swaps each to the real plugin call"
  - "#![allow(dead_code)] on the iap module keeps the gated build warning-clean while the tested core awaits Plan 05 wiring"
metrics:
  duration: "~25 min"
  tasks: 3
  files-created: 2
  files-modified: 2
  tests-added: 10
  completed: 2026-06-22
---

# Phase 26 Plan 01: IAP Decision Core Summary

Landed the Rust-side IAP decision core — the pure, fail-closed verify/grant heart of MAS-IAP-04 — plus the `appstore` cargo feature and the `iap_*` command surface, all gated so the direct `pnpm tauri build` compiles none of it. This is the agent-driven inner loop OQ-1 prescribes in place of a `.storekit` file: the four StoreKit states are exercised as injected data over a pure decision function, proven deterministically in CI before any native plugin or sandbox build exists.

## What Was Built

- **`appstore` cargo feature** (Task 1) gating an optional `tauri-plugin-iap@0.9` dep, mirroring the `webdriver` optional-dep precedent. `cargo tree` without `--features appstore` excludes the plugin entirely; `--features appstore` pulls it in.
- **IAP decision core** (Task 2, `src-tauri/src/iap/mod.rs`) — pure, error-as-value, no native call:
  - `granted_entitlements(&PurchaseOutcome)` — fail-closed: `Purchased(Verified)` → intersected pro set; `Unverified`/`Cancelled`/`Pending` → `[]`.
  - `intersect_pro(&[String])` — over-grant guard against `PRO_ENTITLEMENTS` (kept in lock-step with the TS `ALL_ENTITLEMENTS`).
  - `purchase_state_to_result(u8, Vec<String>)` — PurchaseState 0/1/2 → Success/UserCancelled/Pending (any other u8 → conservative UserCancelled).
  - `grant_from_outcome` + the serde camelCase `IapPurchaseResult` / `IapProduct` mirror types pinned to the TS contract.
- **`iap_*` command surface** (Task 3, `src-tauri/src/iap/commands.rs`) — `iap_products` / `iap_purchase` / `iap_restore` / `iap_current_entitlements`, all `#[cfg(feature="appstore")]`, with deterministic spike stubs and an `IapError` that serializes as `{ code }`. Registered via a debug × appstore 2×2 `generate_handler!` matrix in `lib.rs`.

## Verification

- `cargo test --features appstore` — **95 passed / 0 failed** (10 new iap tests: all four StoreKit states, the PurchaseState mapper, over-grant drop, fail-closed `.unverified`→`[]`, and the serde camelCase JSON pin for Success/Pending/UserCancelled/IapProduct/IapError).
- `cargo build` (default) green AND `cargo tree | grep iap` = **0** — the direct channel is byte-unaffected.
- `cargo build --features appstore` + `cargo build --features appstore,webdriver` both green — the 2×2 cfg matrix resolves to exactly one arm per config, warning-clean.
- `decoder.ts` + its 19 tests **byte-for-byte untouched** (0 decoder files in the plan diff); no webview change in this plan.
- lefthook gate (tsc + vitest 1205/1205 + eslint) green on every commit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] `#![allow(dead_code)]` on the iap module**
- **Found during:** Task 3 (`cargo build --features appstore`)
- **Issue:** The verify/grant decision core is fully unit-tested but not yet CALLED by the spike's deterministic command stubs — `cargo build --features appstore` emitted 9 dead-code warnings (`#[cfg(test)]` usage does not suppress non-test dead-code lints). A noisy gated build masks real warnings later.
- **Fix:** Added a documented `#![allow(dead_code)]` inner attribute to `iap/mod.rs` (propagates to the child `commands.rs` module), explaining Plan 05 swaps the stubs to route real verified purchases through the core. Build is now warning-clean under the feature.
- **Files modified:** `src-tauri/src/iap/mod.rs`
- **Commit:** `362f1fd0`

## Commits

- `1d446559` — chore(26-01): appstore cargo feature + optional tauri-plugin-iap dep
- `2a5c580f` — feat(26-01): IAP verify/grant decision core + serde mirror types
- `362f1fd0` — feat(26-01): iap_* command wrappers + cfg-gated 2x2 lib.rs registration

## Notes for the Next Plan

- Plan 05 swaps each `iap_*` stub body to call `tauri-plugin-iap`'s `getProducts`/`purchase`/`restorePurchases`/`getProductStatus`, routing `.success(VerificationResult)` through `grant_from_outcome`, and registers `tauri_plugin_iap::init()` in lib.rs. The dead-code allow can be removed at that point.
- The `@choochmeque/tauri-plugin-iap-api` JS companion + the `platform.iap` seam (`tauri.ts` real arm, `browser.ts`/`stub.ts` no-op) are a later wave's work — not touched here.
- `PRO_ENTITLEMENTS` in `iap/mod.rs` must stay in sync with `ALL_ENTITLEMENTS` in `src/lib/entitlements/entitlements.ts` (cited in a comment).

## Self-Check: PASSED

- Files: `src-tauri/src/iap/mod.rs`, `src-tauri/src/iap/commands.rs`, `26-01-SUMMARY.md` all FOUND.
- Commits: `1d446559`, `2a5c580f`, `362f1fd0` all FOUND.
