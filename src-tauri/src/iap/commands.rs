//! The Mac App Store IAP command surface (Phase 26, MAS-IAP-01/04).
//!
//! Thin `#[tauri::command]` wrappers behind the `platform.iap` seam, ALL
//! `#[cfg(feature = "appstore")]` — the direct build compiles none of them. The
//! command CONTRACT (names + serde shapes + `{ code }` rejection) lands here so
//! the seam is testable now; the SPIKE bodies are deterministic stubs (no native
//! call, no network — threat T-26-04 is `accept` this plan). Plan 05 swaps each
//! body to call `tauri-plugin-iap`'s `getProducts`/`purchase`/`restorePurchases`/
//! `getProductStatus` and routes verified purchases through the Plan-02 decision
//! core (`grant_from_outcome`). The plugin itself (`tauri_plugin_iap::init()`) is
//! registered in lib.rs by Plan 05's minimal harness, NOT here.
//!
//! Errors serialize as `{"code": "..."}` (mirrors the license rejection contract,
//! T-19-19): the webview's copy layer keys on the code string, never on prose.

use super::IapProduct;

/// The single non-consumable Pro product id (one perpetual product, D-of the
/// milestone). The fixture price/name are stand-ins until Plan 05 reads the real
/// localized `displayPrice`/`displayName` from StoreKit.
const PRO_PRODUCT_ID: &str = "com.tinkerdev.app.pro";

/// IAP command errors. The wire shape is `{"code": "..."}` (mirrors
/// `license::keygen_client::LicenseError`). Spike bodies never return an error,
/// but the type + contract land now so Plan 05's plugin failures (a dropped
/// StoreKit connection, a failed purchase) have a typed, prose-free channel.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IapError {
    /// StoreKit / the App Store could not be reached.
    ServiceUnreachable,
    /// `Product.purchase()` failed for a non-cancel reason.
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

/// List purchasable products. SPIKE: returns the single fixture Pro product so
/// the seam + store license pane are testable now. Plan 05 swaps the body to
/// `getProducts([PRO_PRODUCT_ID])` and maps the localized fields.
#[tauri::command]
pub async fn iap_products() -> Result<Vec<IapProduct>, IapError> {
    Ok(vec![IapProduct {
        id: PRO_PRODUCT_ID.to_string(),
        display_price: "$9.00".to_string(),
        display_name: "TinkerDev Pro".to_string(),
    }])
}

/// Start a purchase. SPIKE: returns `Pending` deterministically so the command
/// compiles + is callable end-to-end. Plan 05 swaps the body to
/// `Product.purchase()` → on `.success` runs the verify + `grant_from_outcome`
/// decision core, on `.userCancelled`/`.pending` returns the calm result.
#[tauri::command]
pub async fn iap_purchase(product_id: String) -> Result<super::IapPurchaseResult, IapError> {
    let _ = product_id; // Plan 05 will purchase this specific product.
    Ok(super::IapPurchaseResult::Pending)
}

/// Restore previous purchases. SPIKE: `Ok(())`. Plan 05 wires `restorePurchases`.
#[tauri::command]
pub async fn iap_restore() -> Result<(), IapError> {
    Ok(())
}

/// The currently-owned entitlement codes. SPIKE: `Ok(vec![])`. Plan 05 wires
/// `getProductStatus` and routes the verified set through the decision core's
/// intersect guard.
#[tauri::command]
pub async fn iap_current_entitlements() -> Result<Vec<String>, IapError> {
    Ok(vec![])
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
}
