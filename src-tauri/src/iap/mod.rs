//! Mac App Store IAP decision core (Phase 26, MAS-IAP-04 / MAS-IAP-01).
//!
//! The PURE, cargo-testable heart of the StoreKit verify/grant decision —
//! the agent-driven inner loop OQ-1 prescribes in place of a `.storekit` file.
//! The four StoreKit states are exercised as INJECTED data over pure functions,
//! never via a live sheet: no native call, no I/O, error-as-value.
//!
//! Fail-closed discipline mirrors the v1.6 Ed25519 license core (LIC-04): the
//! verification status is the ONLY trust signal — a `.verified` transaction
//! grants the pro entitlement set, everything else (`.unverified`, cancelled,
//! pending) grants nothing.
//!
//! The whole module is `#[cfg(feature = "appstore")]` so the direct build never
//! compiles it (T-26-03; mirrors the webdriver gating). Plan 05 wires the real
//! `tauri-plugin-iap` purchase/verify path onto these functions.
#![cfg(feature = "appstore")]
// The verify/grant decision core (intersect_pro/granted_entitlements/
// grant_from_outcome/purchase_state_to_result + the Verification/PurchaseOutcome
// inputs) is fully unit-tested here but not yet CALLED by the Phase-26 spike
// command bodies (deterministic stubs). Plan 05 swaps those stubs to route real
// verified purchases through this core, at which point the dead-code goes away.
// Allow it now so the gated `--features appstore` build stays warning-clean (a
// noisy build masks real warnings) — this is a spike landing the tested core
// ahead of its wiring, by design.
#![allow(dead_code)]

pub mod commands;

/// The over-grant allow-list (T-26-02). Kept in lock-step with the TS contract
/// `ALL_ENTITLEMENTS` in src/lib/entitlements/entitlements.ts
/// (`ENT_THEMING = "pro.theming"`, `ENT_ORDERING = "pro.ordering"`). A granted
/// transaction can NEVER unlock more than these two real pro codes — the
/// Rust-side mirror of `baseFromLicense`'s intersection (T-21-12).
pub const PRO_ENTITLEMENTS: [&str; 2] = ["pro.theming", "pro.ordering"];

/// A StoreKit `VerificationResult` modeled as injectable DATA (no StoreKit
/// dependency). Plan 05's plugin path maps the real `VerificationResult` onto
/// this so the grant decision stays pure + unit-testable.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Verification {
    /// JWS signature checked out against Apple's public keys on-device.
    Verified,
    /// Signature check FAILED — the only safe action is to grant nothing.
    Unverified,
}

/// The outcome of a `Product.purchase()` modeled as injectable data, mirroring
/// StoreKit's `Product.PurchaseResult` (`.success(VerificationResult)` /
/// `.userCancelled` / `.pending`) without depending on StoreKit.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PurchaseOutcome {
    /// `.success(VerificationResult)` — carries the on-device verify result.
    Purchased(Verification),
    /// `.userCancelled` — the user dismissed the sheet.
    Cancelled,
    /// `.pending` — "waiting for approval" (Ask to Buy / SCA). A CALM
    /// non-error state, not a failure (MAS-IAP-01).
    Pending,
}

/// The webview-facing purchase result (the TS contract for Plan 05+). The serde
/// test below pins the exact internally-tagged camelCase JSON shapes:
///   `{ "state": "success", "entitlements": [...] }`
///   `{ "state": "userCancelled" }`
///   `{ "state": "pending" }`
#[derive(serde::Serialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase", tag = "state")]
pub enum IapPurchaseResult {
    /// PurchaseState 0 (PURCHASED). `entitlements` is the intersect-filtered pro
    /// set — empty if the transaction was `.unverified` (fail closed).
    #[serde(rename_all = "camelCase")]
    Success { entitlements: Vec<String> },
    /// PurchaseState 1 (CANCELED).
    UserCancelled,
    /// PurchaseState 2 (PENDING). Calm — the UI shows "waiting for approval".
    Pending,
}

/// The webview-facing product shape (the TS contract). `tauri-plugin-iap`'s
/// `getProducts` result maps onto this in Plan 05.
#[derive(serde::Serialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct IapProduct {
    pub id: String,
    pub display_price: String,
    pub display_name: String,
}

/// The V4/V5 over-grant guard (T-26-02): filter `codes` down to those in
/// [`PRO_ENTITLEMENTS`]. A forged/unexpected code is dropped, so the granted set
/// can never exceed the two real pro entitlements. Mirrors `baseFromLicense`
/// (T-21-12) — the same intersect-with-the-allow-list discipline.
pub fn intersect_pro(codes: &[String]) -> Vec<String> {
    codes
        .iter()
        .filter(|c| PRO_ENTITLEMENTS.contains(&c.as_str()))
        .cloned()
        .collect()
}

/// The fail-closed grant decision (T-26-01, MAS-IAP-04). Returns the granted pro
/// codes ONLY for a `.verified` purchase; `.unverified`/cancelled/pending all
/// FAIL CLOSED to `[]` (free tier). The verification status is the ONLY trust
/// signal — this is the heart of the milestone's serverless-verify proof.
pub fn granted_entitlements(outcome: &PurchaseOutcome) -> Vec<String> {
    match outcome {
        // VERIFIED transaction → grant the intersected pro set.
        PurchaseOutcome::Purchased(Verification::Verified) => {
            intersect_pro(&PRO_ENTITLEMENTS.iter().map(|s| s.to_string()).collect::<Vec<_>>())
        }
        // FAIL CLOSED: an unverified signature grants nothing (free tier).
        PurchaseOutcome::Purchased(Verification::Unverified) => Vec::new(),
        // No purchase happened → grant nothing.
        PurchaseOutcome::Cancelled | PurchaseOutcome::Pending => Vec::new(),
    }
}

/// Build the webview-facing [`IapPurchaseResult`] from a purchase outcome.
/// `Success` carries the [`granted_entitlements`] vec (empty when fail-closed);
/// `Cancelled`/`Pending` carry no entitlements.
pub fn grant_from_outcome(outcome: PurchaseOutcome) -> IapPurchaseResult {
    match outcome {
        PurchaseOutcome::Purchased(_) => IapPurchaseResult::Success {
            entitlements: granted_entitlements(&outcome),
        },
        PurchaseOutcome::Cancelled => IapPurchaseResult::UserCancelled,
        PurchaseOutcome::Pending => IapPurchaseResult::Pending,
    }
}

/// Map `tauri-plugin-iap`'s `PurchaseState` (MAS-IAP-01) onto the webview result:
/// 0 = PURCHASED → `Success { granted }`, 1 = CANCELED → `UserCancelled`,
/// 2 = PENDING → `Pending` (calm). Any other/`@unknown` u8 is treated
/// CONSERVATIVELY as not-granted (UserCancelled-equivalent) — fail closed.
pub fn purchase_state_to_result(state: u8, granted: Vec<String>) -> IapPurchaseResult {
    match state {
        0 => IapPurchaseResult::Success { entitlements: granted },
        2 => IapPurchaseResult::Pending,
        // 1 = CANCELED, and any unrecognized state → grant nothing (conservative).
        _ => IapPurchaseResult::UserCancelled,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sorted(mut v: Vec<String>) -> Vec<String> {
        v.sort();
        v
    }

    #[test]
    fn verified_grants_the_intersected_pro_set() {
        let granted = granted_entitlements(&PurchaseOutcome::Purchased(Verification::Verified));
        assert_eq!(
            sorted(granted),
            vec!["pro.ordering".to_string(), "pro.theming".to_string()]
        );
    }

    #[test]
    fn unverified_grants_nothing_fail_closed() {
        let granted = granted_entitlements(&PurchaseOutcome::Purchased(Verification::Unverified));
        assert_eq!(granted, Vec::<String>::new());
    }

    #[test]
    fn cancelled_grants_nothing() {
        assert_eq!(
            granted_entitlements(&PurchaseOutcome::Cancelled),
            Vec::<String>::new()
        );
    }

    #[test]
    fn pending_grants_nothing_and_is_calm() {
        assert_eq!(
            granted_entitlements(&PurchaseOutcome::Pending),
            Vec::<String>::new()
        );
        // PurchaseState 2 (PENDING) → Pending, NOT an error.
        assert_eq!(
            purchase_state_to_result(2, vec![]),
            IapPurchaseResult::Pending
        );
    }

    #[test]
    fn purchase_state_mapping() {
        assert_eq!(
            purchase_state_to_result(0, vec!["pro.theming".to_string()]),
            IapPurchaseResult::Success {
                entitlements: vec!["pro.theming".to_string()]
            }
        );
        assert_eq!(
            purchase_state_to_result(1, vec![]),
            IapPurchaseResult::UserCancelled
        );
        assert_eq!(
            purchase_state_to_result(2, vec![]),
            IapPurchaseResult::Pending
        );
        // @unknown / out-of-range → conservative grant-nothing.
        assert_eq!(
            purchase_state_to_result(99, vec!["pro.theming".to_string()]),
            IapPurchaseResult::UserCancelled
        );
    }

    #[test]
    fn intersect_pro_drops_over_grant() {
        let codes = vec![
            "pro.theming".to_string(),
            "pro.future-superpower".to_string(),
        ];
        assert_eq!(intersect_pro(&codes), vec!["pro.theming".to_string()]);
    }

    #[test]
    fn grant_from_outcome_builds_results() {
        match grant_from_outcome(PurchaseOutcome::Purchased(Verification::Verified)) {
            IapPurchaseResult::Success { entitlements } => {
                assert_eq!(sorted(entitlements), vec!["pro.ordering", "pro.theming"]);
            }
            other => panic!("expected Success, got {other:?}"),
        }
        assert_eq!(
            grant_from_outcome(PurchaseOutcome::Purchased(Verification::Unverified)),
            IapPurchaseResult::Success { entitlements: vec![] }
        );
        assert_eq!(
            grant_from_outcome(PurchaseOutcome::Cancelled),
            IapPurchaseResult::UserCancelled
        );
        assert_eq!(
            grant_from_outcome(PurchaseOutcome::Pending),
            IapPurchaseResult::Pending
        );
    }

    #[test]
    fn serde_pins_camelcase_json() {
        // Success → {"state":"success","entitlements":[...]}
        let success = IapPurchaseResult::Success {
            entitlements: vec!["pro.theming".to_string()],
        };
        assert_eq!(
            serde_json::to_string(&success).unwrap(),
            r#"{"state":"success","entitlements":["pro.theming"]}"#
        );
        // Pending → {"state":"pending"}
        assert_eq!(
            serde_json::to_string(&IapPurchaseResult::Pending).unwrap(),
            r#"{"state":"pending"}"#
        );
        // UserCancelled → {"state":"userCancelled"}
        assert_eq!(
            serde_json::to_string(&IapPurchaseResult::UserCancelled).unwrap(),
            r#"{"state":"userCancelled"}"#
        );
    }

    #[test]
    fn iap_product_serializes_camelcase() {
        let p = IapProduct {
            id: "com.tinkerdev.app.pro".to_string(),
            display_price: "$9.00".to_string(),
            display_name: "TinkerDev Pro".to_string(),
        };
        assert_eq!(
            serde_json::to_string(&p).unwrap(),
            r#"{"id":"com.tinkerdev.app.pro","displayPrice":"$9.00","displayName":"TinkerDev Pro"}"#
        );
    }
}
