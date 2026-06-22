# Phase 26 Plugin API Preflight — `tauri-plugin-iap@0.9` integration mode

**Task:** Phase 26 Plan 02 Task 0 (Codex finding #2 / OQ-2).
**Question:** Does `tauri-plugin-iap@0.9` expose a **Rust-callable** StoreKit API (a public Rust surface a custom `iap_*` `#[tauri::command]` can call to reach `getProducts`/`purchase`/`restorePurchases`/`getProductStatus`), or is it **JS-callable-only** (only the plugin's own Tauri commands, driven from JS via `@choochmeque/tauri-plugin-iap-api`)?
**Date:** 2026-06-22.

---

## Verdict: **MODE A — a Rust-callable API exists (compile-checked).**

`tauri-plugin-iap@0.9.1` exposes a public Rust API a custom `#[tauri::command]` can call directly. The seam therefore uses **pure `invoke("iap_*")`** against the Plan-01 Rust commands (which Plan 05 backs with the plugin's Rust API); the `@choochmeque/tauri-plugin-iap-api` JS companion is **NOT** imported anywhere. The Task 2 criterion `grep -c '@choochmeque' src/lib/platform/tauri.ts == 0` **STANDS**.

---

## Cited public Rust surface

Inspected the published crate source (`~/.cargo/registry/.../tauri-plugin-iap-0.9.1.crate`, extracted). The public Rust API:

**`src/lib.rs`** — re-exports the models and declares the extension trait:
```rust
pub use models::*;                       // GetProductsResponse, Purchase, PurchaseRequest, ProductStatus, RestorePurchasesResponse, PurchaseStateValue, Product, ...
pub use error::{Error, Result};

/// Extensions to tauri::App, tauri::AppHandle and tauri::Window to access the iap APIs.
pub trait IapExt<R: Runtime> {
    fn iap(&self) -> &Iap<R>;
}
impl<R: Runtime, T: Manager<R>> crate::IapExt<R> for T { /* self.state::<Iap<R>>().inner() */ }
```

**`src/macos.rs`** — `Iap<R>` with the public async StoreKit methods a Rust command can call:
```rust
pub struct Iap<R: Runtime> { /* ... */ }
impl<R: Runtime> Iap<R> {
    pub async fn get_products(&self, product_ids: Vec<String>, product_type: String) -> crate::Result<GetProductsResponse>;
    pub async fn purchase(&self, payload: PurchaseRequest) -> crate::Result<Purchase>;
    pub async fn restore_purchases(&self, product_type: String) -> crate::Result<RestorePurchasesResponse>;
    pub async fn get_product_status(&self, product_id: String, product_type: String) -> crate::Result<ProductStatus>;
}
```

So a custom `#[tauri::command]` reaches StoreKit via `app.iap().get_products(...)` / `.purchase(...)` / `.restore_purchases(...)` / `.get_product_status(...)` — the `IapExt::iap()` extension is callable on any `Manager` (`App`/`AppHandle`/`Window`/`State`). This is the same Rust-API shape the official `@tauri-apps/plugin-*` crates use; it is **not** JS-only.

> The plugin still has a JS companion (`@choochmeque/tauri-plugin-iap-api`) and registers its own `invoke_handler` (`get_products`, `purchase`, …) for JS callers — but that is an *additional* path, not the *only* path. The Rust `IapExt` trait is public and is the path the seam uses (MODE A), so the JS companion is never imported.

---

## Compile-check evidence (machine-checked, not a prose claim)

Wrote a throwaway scratch fn `src-tauri/src/iap/preflight_compilecheck.rs` (`#![cfg(feature = "appstore")]`) that NAMES + calls the exact public plugin items:

```rust
use tauri::{AppHandle, Runtime};
use tauri_plugin_iap::{
    GetProductsResponse, IapExt, ProductStatus, Purchase, PurchaseRequest,
    RestorePurchasesResponse,
};

#[allow(dead_code)]
pub async fn _preflight_rust_api_reachable<R: Runtime>(
    app: &AppHandle<R>,
) -> tauri_plugin_iap::Result<()> {
    let iap = app.iap();                                  // IapExt::iap(&self) -> &Iap<R>
    let _products: GetProductsResponse =
        iap.get_products(vec!["com.tinkerdev.app.pro".to_string()], "inapp".to_string()).await?;
    let _purchase: Purchase =
        iap.purchase(PurchaseRequest {
            product_id: "com.tinkerdev.app.pro".to_string(),
            product_type: "inapp".to_string(),
            options: None,
        }).await?;
    let _restored: RestorePurchasesResponse =
        iap.restore_purchases("inapp".to_string()).await?;
    let _status: ProductStatus =
        iap.get_product_status("com.tinkerdev.app.pro".to_string(), "inapp".to_string()).await?;
    Ok(())
}
```

**Result:**
```
$ cargo build --features appstore
   Compiling devtools-app v0.4.1 (.../src-tauri)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 5.80s   # GREEN
```

The fn compiled — so the Rust API is real and reachable from a command. The scratch file was then **deleted** (the preflight proves the mode; it does NOT wire the arm).

Dependency-presence cross-check:
```
$ cargo tree --features appstore | grep tauri-plugin-iap
├── tauri-plugin-iap v0.9.1
│   ├── swift-bridge v0.1.59   (bundles the Swift StoreKit package via swift-bridge FFI)
$ cargo tree | grep -c tauri-plugin-iap            # direct build (no feature)
0                                                  # excluded — mirrors the webdriver gating
```

---

## Package + version confirmation (research valid-until re-confirm)

```
$ npm view @choochmeque/tauri-plugin-iap-api version   ->  0.10.0-rc.5   (dist-tags.latest)
$ cargo add tauri-plugin-iap@0.9 --dry-run             ->  "Adding tauri-plugin-iap v0.9 to optional dependencies"  (resolves 0.9.1)
```

**Note (not a blocker for MODE A):** the JS companion's npm `latest` has moved to a **0.10.0-rc.x** prerelease since the research snapshot (research recorded "matches 0.9"). The Rust crate `tauri-plugin-iap@0.9` (resolving 0.9.1) is still installable and is what the preflight compile-checked. Because MODE A uses the Rust API and never imports the JS companion, the JS package's version drift is irrelevant to the seam. Plan 05 should still pin the crate at the 0.9 line (compile-checked here) and re-confirm before any 0.10 bump.

---

## Seam consequence (what Tasks 1-3 + Plan 05 do)

- **Tasks 1-3 of this plan proceed as written (MODE A plan-of-record):** the `platform.iap` interface + getter (Task 1), the real `tauri.ts` arm as **pure `invoke("iap_products" | "iap_purchase" | "iap_restore" | "iap_current_entitlements")` + `listen("storekit://updated")`** (Task 2, no `@choochmeque` import), and the deterministic no-op `browser.ts`/`stub.ts` arms + `iap.test.ts` (Task 3).
- **Grep criterion (MODE A) STANDS:** `grep -c '@choochmeque' src/lib/platform/tauri.ts == 0` AND `== 0` in `index.ts`/`browser.ts`/`stub.ts`. The native/plugin import never enters the webview seam at all — the StoreKit reach is entirely Rust-side.
- **Plan 05:** swaps each Plan-01 `iap_*` command stub body to call the plugin's Rust API: register `tauri_plugin_iap::init()` in `lib.rs`, then `app.iap().get_products(...)` / `.purchase(PurchaseRequest{..})` / `.restore_purchases(..)` / `.get_product_status(..)`, mapping `PurchaseStateValue` (0/1/2) → `IapPurchaseResult` via the Plan-01 `purchase_state_to_result` and routing verified grants through `grant_from_outcome`. **No reconciliation of unused `iap_*` commands is needed** (that was the MODE B branch) — the Plan-01 commands ARE the integration path.

---

## OQ-2 finding for Plan 05 (verified-vs-unverified surface) — record now, act in Plan 05

OQ-2 also asked whether the plugin exposes the raw `VerificationResult` (`.verified` vs `.unverified`) distinction to the caller. The crate source answers it, and it changes how Plan 05 maps onto the Plan-01 decision core:

- The plugin's **Swift layer performs the on-device JWS verify and only returns `.verified` transactions** (`macos/Sources/IapPlugin.swift`): a purchase whose transaction is `.unverified` throws `FFIResult.Err("Transaction verification failed")`, and `.unverified` transactions are **skipped** when enumerating restore/`getProductStatus` entitlements. The `Purchase` model carries `jwsRepresentation: Option<String>` + `signature: String` but **no `verified: bool` field** and no `.unverified` variant — the unverified case never crosses the FFI boundary as data; it surfaces as an **error** (on purchase) or **absence** (on status/restore).
- **Consequence for Plan 05:** the fail-closed `.unverified → []` discipline is enforced at TWO layers — the plugin already drops unverified at the native boundary (defense in depth), AND the Plan-01 `granted_entitlements`/`grant_from_outcome` core still fail-closes on anything that isn't `Purchased(Verified)`. Plan 05 maps a successful `purchase()` (which is, by construction, verified) → `PurchaseOutcome::Purchased(Verification::Verified)`; a `purchase()` that returns the verification-failed error → treat as not-granted (no Pro). The MAS-IAP-04 serverless on-device JWS verify is satisfied **inside the plugin's Swift**, with the Rust core as the over-grant + fail-closed guard. This is consistent with the Plan-01 core; Plan 05 does **not** get an explicit boolean to test in-band, so its `.unverified` proof is (a) the plugin's documented native skip/throw + (b) the unit-tested Rust core, mirroring the OQ-1 reshape (human gate for the live verified path, unit core for the decision).

---

## Summary table

| Item | Finding |
|------|---------|
| Integration mode | **MODE A — Rust-callable API exists** |
| Public Rust entry | `tauri_plugin_iap::IapExt::iap(&self) -> &Iap<R>` (on any `Manager`) |
| Rust methods | `Iap<R>::{get_products, purchase, restore_purchases, get_product_status}` (all `pub async`) |
| Public models | `GetProductsResponse`, `Purchase`, `PurchaseRequest`, `ProductStatus`, `RestorePurchasesResponse`, `PurchaseStateValue` (`pub use models::*`) |
| Compile check | `cargo build --features appstore` GREEN with a fn naming + calling all four methods |
| Dep presence | `tauri-plugin-iap v0.9.1` in tree under `--features appstore`; `0` without it |
| Crate version | `tauri-plugin-iap@0.9` → resolves `0.9.1` (`cargo add --dry-run`) |
| JS companion version | `@choochmeque/tauri-plugin-iap-api@0.10.0-rc.5` latest (drifted from research's "0.9"; **irrelevant** in MODE A — never imported) |
| Seam grep criterion | MODE A: `grep -c '@choochmeque' tauri.ts == 0` STANDS |
| OQ-2 (verified/unverified) | Plugin verifies in Swift; only `.verified` crosses FFI (`.unverified` throws / is skipped). No in-band boolean. Plan-01 core remains the fail-closed guard. |
| Plan 05 reconciliation | NONE needed — the Plan-01 `iap_*` commands ARE the integration path. |
