//! The Mac App Store IAP command surface (Phase 26, MAS-IAP-01/04).
//!
//! Thin `#[tauri::command]` wrappers behind the `platform.iap` seam, ALL
//! `#[cfg(feature = "appstore")]` — the direct build compiles none of them. Plan
//! 05 swapped the Plan-01 deterministic stub bodies for the PROVEN MODE A
//! integration (26-02 PREFLIGHT): each command calls `tauri-plugin-iap`'s public
//! Rust API (`IapExt::iap()` → `Iap<R>::{get_products, purchase,
//! restore_purchases, get_product_status}`) and routes the result through the
//! Plan-01 fail-closed decision core (`grant_from_outcome` / `intersect_pro`).
//! The `@choochmeque` JS companion is never imported — the StoreKit reach is
//! entirely Rust-side.
//!
//! VERIFICATION / finish() (OQ-2, T-26-13/16): the plugin verifies the StoreKit
//! JWS in its bundled Swift and only `.verified` transactions cross the FFI — an
//! `.unverified` purchase THROWS ("Transaction verification failed",
//! macos/Sources/IapPlugin.swift:148), and unverified entitlements are SKIPPED on
//! restore/status (IapPlugin.swift:195-197, 272-273). `Transaction.finish()` is
//! called by the plugin's Swift immediately after a verified purchase
//! (IapPlugin.swift:142) and on every background update (IapPlugin.swift:295) —
//! we never see an unfinished transaction. So a `purchase()` that RESOLVES is, by
//! construction, verified → we map it to `Purchased(Verified)`; a `purchase()`
//! that REJECTS (verification failed / cancelled / pending) grants nothing. The
//! Plan-01 core (`grant_from_outcome` + `intersect_pro`) is the defense-in-depth
//! over-grant + fail-closed guard on top of the native verify. The plugin gives
//! no structured reject discriminant, so `iap_purchase` maps the two CALM
//! rejections (user-cancel, pending) onto their non-error union states by the
//! thrown message; a verification failure or any other reject fails closed.
//!
//! Errors serialize as `{"code": "..."}` (mirrors the license rejection contract,
//! T-19-19): the webview's copy layer keys on the code string, never on prose.

use super::{
    grant_from_outcome, intersect_pro, IapProduct, IapPurchaseResult, PurchaseOutcome, Verification,
};
use tauri::{AppHandle, Runtime};
use tauri_plugin_iap::{IapExt, PurchaseRequest};

/// The single non-consumable Pro product id (one perpetual product). One central
/// definition used by every command + the over-grant guard's product scope.
const PRO_PRODUCT_ID: &str = "com.tinkerdev.app.pro";

/// StoreKit in-app product type (vs "subs"); TinkerDev Pro is a one-time
/// non-consumable, so the StoreKit query/purchase type is always "inapp".
const PRODUCT_TYPE: &str = "inapp";

/// IAP command errors. The wire shape is `{"code": "..."}` (mirrors the license
/// module's prose-free rejection contract). The webview keys on these codes; the
/// underlying plugin/StoreKit prose is logged Rust-side, never surfaced.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IapError {
    /// StoreKit / the App Store could not be reached (or the plugin call failed
    /// for a non-purchase reason: product not found, no bundle, FFI error).
    ServiceUnreachable,
    /// `Product.purchase()` failed for a non-cancel, non-pending reason —
    /// including a FAILED on-device JWS verification (the plugin throws
    /// "Transaction verification failed"). User-cancel and pending are CALM
    /// `IapPurchaseResult` states, not this error. Fail-closed: this NEVER grants
    /// Pro.
    PurchaseFailed,
}

impl IapError {
    /// The serialized contract string — the webview keys on these.
    pub fn code(&self) -> &'static str {
        match self {
            IapError::ServiceUnreachable => "serviceUnreachable",
            IapError::PurchaseFailed => "purchaseFailed",
        }
    }
}

/// Tauri command errors must Serialize; the wire shape is `{"code": "..."}`.
impl serde::Serialize for IapError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeStruct;
        let mut s = serializer.serialize_struct("IapError", 1)?;
        s.serialize_field("code", self.code())?;
        s.end()
    }
}

/// List purchasable products. MODE A: `app.iap().get_products([PRO_PRODUCT_ID],
/// "inapp")` → map StoreKit's localized `formattedPrice`/`title` onto the TS
/// contract. A missing localized price falls back to the product title only — we
/// never fabricate a price.
#[tauri::command]
pub async fn iap_products<R: Runtime>(app: AppHandle<R>) -> Result<Vec<IapProduct>, IapError> {
    let resp = app
        .iap()
        .get_products(vec![PRO_PRODUCT_ID.to_string()], PRODUCT_TYPE.to_string())
        .await
        .map_err(|e| {
            eprintln!("iap: get_products failed: {e}");
            IapError::ServiceUnreachable
        })?;

    Ok(resp
        .products
        .into_iter()
        .map(|p| IapProduct {
            id: p.product_id,
            // StoreKit-localized price; empty when the store has no price yet.
            display_price: p.formatted_price.unwrap_or_default(),
            display_name: p.title,
        })
        .collect())
}

/// Start a purchase. MODE A: `app.iap().purchase(...)`. The plugin verifies the
/// JWS in Swift and calls `Transaction.finish()` (IapPlugin.swift:142) BEFORE
/// returning — and it THROWS on every non-verified outcome (verification failed
/// :148, user-cancelled :152, pending :155). So a RESOLVED `Purchase` is, by
/// construction, a verified + finished transaction → we map it to
/// `Purchased(Verified)` through the Plan-01 `grant_from_outcome` (fail-closed +
/// `intersect_pro` over-grant guard).
///
/// The plugin gives NO structured discriminant for the rejection cases — cancel,
/// pending and verification-failure all arrive as one thrown error whose only
/// signal is its (English) message (see PHASE-26-BRIDGE-VIABILITY.md criterion 2).
/// We map the two CALM outcomes (user cancel, Ask-to-Buy pending) onto their
/// non-error union states so a routine sheet-cancel is NOT surfaced as a failure
/// (MAS-IAP-01); everything else — including a failed verification — fails closed
/// to `PurchaseFailed` and grants nothing.
#[tauri::command]
pub async fn iap_purchase<R: Runtime>(
    app: AppHandle<R>,
    product_id: String,
) -> Result<IapPurchaseResult, IapError> {
    // Defense-in-depth (T-26-18): the seam only ever sells the ONE Pro product.
    // Reject any other id from an IPC caller BEFORE constructing the request or
    // invoking the native sheet — a forged/compromised `invoke` must not be able
    // to drive a StoreKit purchase sheet for an arbitrary or future product. Fail
    // closed, never grant.
    if product_id != PRO_PRODUCT_ID {
        eprintln!("iap: refusing purchase for unexpected product {product_id:?}");
        return Err(IapError::PurchaseFailed);
    }

    let req = PurchaseRequest {
        product_id,
        product_type: PRODUCT_TYPE.to_string(),
        options: None,
    };

    match app.iap().purchase(req).await {
        // RESOLVED → verified + finished by the plugin's Swift (product is pinned
        // to Pro above). Route the Purchased(Verified) through the grant core
        // (intersects against PRO_ENTITLEMENTS — a forged/extra code can never
        // over-grant).
        Ok(_purchase) => Ok(grant_from_outcome(PurchaseOutcome::Purchased(
            Verification::Verified,
        ))),
        // REJECTED. The plugin's error message is the only discriminant. Map the
        // calm outcomes to their union states; fail closed on everything else.
        Err(e) => {
            eprintln!("iap: purchase rejected: {e}");
            match calm_reject_outcome(&e.to_string()) {
                Some(outcome) => Ok(grant_from_outcome(outcome)),
                None => Err(IapError::PurchaseFailed),
            }
        }
    }
}

/// Classify a plugin `purchase()` REJECT by its (English) message. The plugin
/// throws one undifferentiated error for cancel / pending / verification-failure
/// (no structured code — PHASE-26-BRIDGE-VIABILITY.md criterion 2), so the thrown
/// message is the only signal. Returns the CALM outcome for a user-cancel or a
/// pending (Ask-to-Buy) purchase, or `None` when the reject must fail closed
/// (verification failure, network error, anything unrecognized → grant nothing).
fn calm_reject_outcome(message: &str) -> Option<PurchaseOutcome> {
    let m = message.to_lowercase();
    if m.contains("cancel") {
        Some(PurchaseOutcome::Cancelled)
    } else if m.contains("pending") {
        Some(PurchaseOutcome::Pending)
    } else {
        None
    }
}

/// Restore previous purchases. MODE A: `app.iap().restore_purchases("inapp")`.
/// The plugin re-enumerates `Transaction.currentEntitlements` (verified only;
/// unverified skipped, IapPlugin.swift:195). The webview re-reads
/// `iap_current_entitlements` afterward to observe the re-granted codes (Codex
/// #5 — restore() resolving is not itself proof of a re-grant).
#[tauri::command]
pub async fn iap_restore<R: Runtime>(app: AppHandle<R>) -> Result<(), IapError> {
    app.iap()
        .restore_purchases(PRODUCT_TYPE.to_string())
        .await
        .map(|_| ())
        .map_err(|e| {
            eprintln!("iap: restore_purchases failed: {e}");
            IapError::ServiceUnreachable
        })
}

/// The currently-owned entitlement codes. MODE A: `app.iap().get_product_status`.
/// `isOwned` is true only for a verified, owned transaction (the plugin skips
/// unverified, IapPlugin.swift:272). When owned, grant the intersect-guarded pro
/// set; otherwise the empty free-tier set. `intersect_pro` is the over-grant
/// guard (T-26-14) — the granted set can never exceed PRO_ENTITLEMENTS.
#[tauri::command]
pub async fn iap_current_entitlements<R: Runtime>(
    app: AppHandle<R>,
) -> Result<Vec<String>, IapError> {
    let status = app
        .iap()
        .get_product_status(PRO_PRODUCT_ID.to_string(), PRODUCT_TYPE.to_string())
        .await
        .map_err(|e| {
            eprintln!("iap: get_product_status failed: {e}");
            IapError::ServiceUnreachable
        })?;

    if status.is_owned {
        // Owned → grant the full pro set, filtered through the over-grant guard.
        Ok(intersect_pro(
            &super::PRO_ENTITLEMENTS
                .iter()
                .map(|s| s.to_string())
                .collect::<Vec<_>>(),
        ))
    } else {
        Ok(Vec::new())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn iap_error_serializes_code() {
        assert_eq!(
            serde_json::to_string(&IapError::ServiceUnreachable).unwrap(),
            r#"{"code":"serviceUnreachable"}"#
        );
        assert_eq!(
            serde_json::to_string(&IapError::PurchaseFailed).unwrap(),
            r#"{"code":"purchaseFailed"}"#
        );
    }

    #[test]
    fn resolved_purchase_maps_to_verified_grant() {
        // The exact mapping iap_purchase applies on a RESOLVED plugin purchase:
        // a verified transaction → the intersected pro set (fail-closed core).
        let result = grant_from_outcome(PurchaseOutcome::Purchased(Verification::Verified));
        match result {
            IapPurchaseResult::Success { mut entitlements } => {
                entitlements.sort();
                assert_eq!(entitlements, vec!["pro.ordering", "pro.theming"]);
            }
            other => panic!("expected Success, got {other:?}"),
        }
    }

    #[test]
    fn calm_rejects_map_to_their_union_state() {
        // The EXACT plugin messages (macos/Sources/IapPlugin.swift:152, :155) map
        // to the calm outcomes — a sheet-cancel is NOT a failure (MAS-IAP-01).
        assert_eq!(
            calm_reject_outcome("Purchase cancelled by user"),
            Some(PurchaseOutcome::Cancelled)
        );
        assert_eq!(
            calm_reject_outcome("Purchase is pending"),
            Some(PurchaseOutcome::Pending)
        );
    }

    #[test]
    fn non_calm_rejects_fail_closed() {
        // Verification failure + genuine errors must NOT be swallowed as calm —
        // they fail closed to PurchaseFailed (None here), never granting Pro.
        assert_eq!(calm_reject_outcome("Transaction verification failed"), None);
        assert_eq!(calm_reject_outcome("Purchase failed: network down"), None);
        assert_eq!(calm_reject_outcome("Product not found"), None);
    }

    #[test]
    fn owned_status_grants_only_the_intersected_pro_set() {
        // The exact over-grant guard iap_current_entitlements applies when owned.
        let granted = intersect_pro(
            &super::super::PRO_ENTITLEMENTS
                .iter()
                .map(|s| s.to_string())
                .collect::<Vec<_>>(),
        );
        let mut sorted = granted;
        sorted.sort();
        assert_eq!(sorted, vec!["pro.ordering", "pro.theming"]);
    }
}
