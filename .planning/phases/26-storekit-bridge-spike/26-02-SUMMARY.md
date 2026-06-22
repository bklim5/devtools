---
phase: 26-storekit-bridge-spike
plan: 02
subsystem: platform-iap-seam
tags: [storekit, iap, mac-app-store, platform-seam, preflight, environment-safe]
requires:
  - "src/lib/platform/{index,tauri,browser,stub}.ts (the license-capability seam shape to mirror)"
  - "src/shell/testStore.ts makeMemoryPlatform (the canonical full-Platform test factory)"
  - "26-01 iap_* Rust commands + IapPurchaseResult/IapProduct serde mirror types (the contract the tauri.ts arm invokes)"
provides:
  - "PROVEN integration mode: tauri-plugin-iap@0.9 exposes a Rust-callable API (MODE A, compile-checked) — the seam uses pure invoke(iap_*), the @choochmeque JS companion is never imported"
  - "platform.iap capability on the Platform interface (products/purchase/restore/currentEntitlements/onPurchaseUpdated) + the get iap() proxy getter"
  - "IapProduct / IapPurchaseResult TS contract types (the exact serde camelCase mirror of 26-01)"
  - "the real tauri.ts iap arm: invoke(iap_*) + listen(storekit://updated), no plugin/native import outside tauri.ts"
  - "deterministic no-op iap arm (createIapStub) wired into browser.ts + testStore.ts; setPlatformForTest injects it"
affects:
  - "Plan 05 (swaps the 26-01 iap_* command bodies to call the plugin Rust API app.iap().get_products/purchase/restore_purchases/get_product_status; registers tauri_plugin_iap::init())"
  - "Phase 28 (the future Store License pane + baseFromStoreKit read platform.iap.currentEntitlements/purchase through this seam)"
tech-stack:
  added: []
  patterns:
    - "per-capability getter auto-forward (adding iap to the interface flows through the proxy with no per-method forwarder)"
    - "deterministic no-op arm mirroring createLicenseStub (Tauri-only capability kept native-free in jsdom/vite-preview)"
    - "preflight compile-check (a throwaway #[cfg(feature)] fn that NAMES+calls the plugin Rust API, built green then deleted) — the integration-mode claim is machine-checked, not prose"
key-files:
  created:
    - "docs/appstore/PHASE-26-PLUGIN-API-PREFLIGHT.md (the proven MODE A finding + compile-check evidence + OQ-2 note for Plan 05)"
    - "src/lib/platform/iap.test.ts (no-op arm + setPlatformForTest forwarding + exhaustive-union contract + reset, 6 tests)"
  modified:
    - "src/lib/platform/index.ts (iap capability + getter + IapProduct/IapPurchaseResult types)"
    - "src/lib/platform/tauri.ts (real MODE A iap arm: invoke iap_* + listen storekit://updated)"
    - "src/lib/platform/browser.ts (no-op iap arm via createIapStub)"
    - "src/lib/platform/stub.ts (createIapStub factory)"
    - "src/shell/testStore.ts (noopIap + makeMemoryPlatform wiring)"
    - "src/lib/platform/platform.test.ts (4 inline Platform literals widened with an iap arm)"
decisions:
  - "MODE A PROVEN (Codex #2 / OQ-2): tauri-plugin-iap@0.9.1 exposes a public Rust API (IapExt::iap() -> &Iap<R> with pub async get_products/purchase/restore_purchases/get_product_status); compile-checked under cargo build --features appstore. The seam stays pure invoke(iap_*); @choochmeque == 0 criterion STANDS."
  - "OQ-2 verified-vs-unverified: the plugin verifies JWS in Swift and only .verified transactions cross the FFI (.unverified throws on purchase / is skipped on status). No in-band verified:bool. Plan 05 maps a successful purchase() -> Purchased(Verified); the 26-01 fail-closed core remains the over-grant guard."
  - "Plan 05 reconciliation: NONE — the 26-01 iap_* commands ARE the integration path (the MODE B unused-command branch did not trigger)."
metrics:
  duration: "~20 min"
  tasks: 4
  files-created: 2
  files-modified: 6
  tests-added: 6
  completed: 2026-06-22
---

# Phase 26 Plan 02: platform.iap Seam Summary

Landed the production-shaped `platform.iap` seam on master (success criterion 3, D-10): the capability on the `Platform` interface, the real `tauri.ts` arm calling the Plan-01 `iap_*` commands, and deterministic no-op `browser.ts`/`stub.ts` arms — exactly mirroring `platform.license`. `vitest`/`vite dev` run with ZERO native call; Phases 27/28 build directly on it. Before any wiring, **Task 0 PROVED with cited evidence + a passing compile check** that `tauri-plugin-iap@0.9` exposes a Rust-callable API (MODE A) — so the design assumption (a Rust path the custom `iap_*` commands drive) is not a guess, and Wave 2 does not stall on a JS-companion-only plugin.

## What Was Built

- **Task 0 — Plugin-API preflight (`docs/appstore/PHASE-26-PLUGIN-API-PREFLIGHT.md`).** Inspected the published `tauri-plugin-iap@0.9.1` crate source: it re-exports its models (`pub use models::*`) and declares a public `IapExt<R>` extension trait (`fn iap(&self) -> &Iap<R>`, impl'd for any `Manager`), where `Iap<R>` has public async `get_products`/`purchase`/`restore_purchases`/`get_product_status`. **PROOF:** a throwaway `#[cfg(feature="appstore")]` scratch fn that NAMES + calls all four methods (plus the public models `GetProductsResponse`/`Purchase`/`PurchaseRequest`/`ProductStatus`/`RestorePurchasesResponse`) compiled green under `cargo build --features appstore`; `cargo tree --features appstore` shows `tauri-plugin-iap v0.9.1` (+ its swift-bridge Swift package) in the tree, `0` without the feature. The scratch fn was then deleted. Recorded `npm view @choochmeque/tauri-plugin-iap-api version` (= `0.10.0-rc.5`, drifted from research's "0.9" but **irrelevant in MODE A — never imported**) + `cargo add tauri-plugin-iap@0.9 --dry-run` (resolves `0.9.1`).
- **Task 1 — interface + types (`index.ts`).** Exported `IapProduct` (`{ id; displayPrice; displayName }`) and `IapPurchaseResult` (`{ success; entitlements } | userCancelled | pending`) — the exact serde camelCase mirror of 26-01. Added the `iap` capability beside `license` (products/purchase/restore/currentEntitlements/onPurchaseUpdated) + `get iap()` to the proxy (auto-forward).
- **Task 2 — real `tauri.ts` arm (MODE A).** Pure `invoke<IapProduct[]>("iap_products")` / `invoke<IapPurchaseResult>("iap_purchase", { productId })` / `invoke<void>("iap_restore")` / `invoke<string[]>("iap_current_entitlements")` + `listen("storekit://updated", …)`, reusing the already-imported `invoke`/`listen` — **no new import**. The `storekit://updated` channel mirrors `menu://check-updates` (no payload; the handler re-reads entitlements via the verified Rust path — T-26-07).
- **Task 3 — no-op arms + tests.** `createIapStub()` in `stub.ts` (`products`/`currentEntitlements` → `[]`, `purchase`/`restore` → reject `{ code: "serviceUnreachable" }`, `onPurchaseUpdated` → no-op unsubscribe); reused in `browser.ts` (`iap: createIapStub()`) and `testStore.ts` (`noopIap` + `makeMemoryPlatform` wiring). The 4 inline `platform.test.ts` Platform literals widened. New `iap.test.ts` (6 tests): the no-op arm returns `[]` / rejects with NO native call (T-26-06 elevation guard), `setPlatformForTest` injection forwards through `platform.iap`, `resetPlatformForTest` restores the browser no-op, and an exhaustive `never`-guarded `IapPurchaseResult` switch (compile-checked union shape).

## Verification

- `pnpm vitest run` — **1211/1211** (+6 new iap tests); `pnpm tsc --noEmit` clean; `eslint` clean (the 2 pre-existing SidebarResetMenu warnings, out of scope).
- Task 0 doc verify: `test -f … && grep -ci "Rust-callable|MODE A|MODE B"` = 10.
- ENVIRONMENT-SAFE (T-26-05): `grep -c '@choochmeque'` = **0** in `index.ts`/`browser.ts`/`stub.ts`/`tauri.ts`; no `^import .*@tauri-apps` and no `^import .*@choochmeque` in `index`/`browser`/`stub`. The native/plugin import never enters the webview seam at all (MODE A reaches StoreKit Rust-side).
- Task 2 criterion (MODE A): `grep -c 'iap_purchase' tauri.ts` = 1, `storekit://updated` = 2, `@choochmeque` = 0 — matches the proven mode.
- `cargo build` (direct, no feature) green AND `cargo tree | grep -c iap` = **0** (the preflight did not regress the direct channel; scratch removed, `iap/mod.rs` byte-reverted).
- `decoder.ts` (`src/lib/protobuf/decoder.ts`) + its 19 tests byte-for-byte untouched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - acceptance-grep] Reworded two doc-comment `@choochmeque` mentions**
- **Found during:** Task 2/3 grep verification.
- **Issue:** My new doc comments in `tauri.ts` and `browser.ts` mentioned the literal `@choochmeque/tauri-plugin-iap-api` package name, tripping the MODE A acceptance grep `grep -c '@choochmeque' tauri.ts == 0` (which targets the literal token, not just imports). A false-positive on a tripwire grep is a latent gate failure.
- **Fix:** Reworded to "the tauri-plugin-iap JS companion" / "the native StoreKit plugin companion" — same meaning, no literal token (established project precedent: Phase 18/20/23/25 comment-wording tweaks so literal acceptance greps pass). No behavior change.
- **Files modified:** `src/lib/platform/tauri.ts`, `src/lib/platform/browser.ts`
- **Commit:** `af50eeb4`

> Note: `iap.test.ts` retains ONE `@choochmeque` mention in a comment ("run WITHOUT any @tauri-apps / @choochmeque mock") — the test file is NOT in the acceptance-grep scope (index/browser/stub/tauri), the comment is descriptive + accurate, and the criterion is about the four seam source files (all 0). Left intentionally.

## Known Stubs

The no-op `iap` arms (`browser.ts`/`stub.ts`/`testStore.ts`: `products`/`currentEntitlements` → `[]`, mutations reject) are **intentional environment-safe no-ops** — the whole reason the seam exists (T-26-05/06). The REAL arm (`tauri.ts`) routes to the live Rust `iap_*` commands. Those command BODIES are deterministic spike stubs landed in Plan 01 (documented there: `iap_products` returns a fixture product, `iap_purchase` → `Pending`, `iap_current_entitlements` → `[]`); **Plan 05 swaps each body to the proven plugin Rust API** (`app.iap().get_products/purchase/restore_purchases/get_product_status`). This is the deliberate spike sequencing (bridge proven, command bodies wired next), not an unintentional stub.

## Notes for the Next Plan (Plan 05)

- Integration mode is **MODE A** — register `tauri_plugin_iap::init()` in `lib.rs` and back each `iap_*` command with the plugin Rust API: `app.iap().get_products(vec![PRO_PRODUCT_ID], "inapp")`, `.purchase(PurchaseRequest{ product_id, product_type: "inapp", options: None })`, `.restore_purchases("inapp")`, `.get_product_status(PRO_PRODUCT_ID, "inapp")`. Map `PurchaseStateValue` (0/1/2) → `IapPurchaseResult` via the 26-01 `purchase_state_to_result`; route verified grants through `grant_from_outcome`. **No unused-command reconciliation needed** (that was MODE B).
- **OQ-2 (verified/unverified):** the plugin verifies JWS in Swift and only `.verified` transactions cross the FFI (`.unverified` → `purchase()` throws `"Transaction verification failed"`; skipped in restore/status). There is NO in-band `verified: bool` to test — so map a successful `purchase()` to `PurchaseOutcome::Purchased(Verification::Verified)`, treat the verification-failed error as not-granted, and lean on the 26-01 fail-closed core as the over-grant guard. The `.unverified` proof is the plugin's documented native skip/throw + the unit-tested Rust core (mirrors the OQ-1 reshape: human gate for the live verified path).
- Crate pinned/compile-checked at `tauri-plugin-iap@0.9` (resolves 0.9.1). Re-confirm before any 0.10 bump (the JS companion `latest` is already on a 0.10.0-rc prerelease).
- The `iap:default` capability + `tauri-plugin-iap` registration + the minimal sandbox harness (`app-sandbox` + `network.client`, macOS 13.0 floor) are the Plan 05 / phase-checkpoint work, per 26-RESEARCH "minimal sandbox build harness".

## Commits

- `59980381` — docs(26-02): preflight proves tauri-plugin-iap@0.9 Rust-callable API (MODE A)
- `af50eeb4` — feat(26-02): platform.iap seam (MODE A invoke arm + no-op arms + tests)

## Self-Check: PASSED

- Files: `docs/appstore/PHASE-26-PLUGIN-API-PREFLIGHT.md`, `src/lib/platform/iap.test.ts`, `26-02-SUMMARY.md` all FOUND.
- Commits: `59980381`, `af50eeb4` both FOUND.
