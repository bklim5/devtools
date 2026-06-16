//! The locked 4-command licensing surface (the ENTIRE webview-reachable
//! license API, T-19-19). Thin wrappers only — all logic lives in
//! [`super::LicenseManager`]; no transport types appear in this layer.
//!
//! Documented Tauri rule: async commands borrowing `State<'_, T>` MUST return
//! `Result` — all four do. Errors serialize as `{"code": "..."}` (the pinned
//! webview contract); payloads as the serde-pinned LicenseStatusPayload.
//! Key material never crosses to JS: `activate_license` ACCEPTS a key (or
//! `None` for the D-44 stored-key path) and nothing ever returns one
//! (T-19-14).

use tauri::State;

use super::keygen_client::{KeygenClient, LicenseError};
use super::{LicenseManager, LicenseStatusPayload};

/// Managed singleton: the production manager behind an async Mutex
/// (`activate` holds `&mut self` across awaits, so a std Mutex guard would
/// not be Send).
pub struct LicenseState(pub tauri::async_runtime::Mutex<LicenseManager<KeygenClient>>);

/// PURE-LOCAL status (D-45): file read + Ed25519 verify only. The single
/// `.await` is the state-mutex lock — there is NO client/network call on this
/// path, every launch works fully offline.
///
/// KEYCHAIN-FREE (T-19-10, codex finding 2): this is the STARTUP/footer/panel
/// path, so it never reads the Keychain on a licensed launch (the masked key is
/// NOT resolved here — it stays `null`). The license settings ROUTE uses
/// [`license_status_detail`] to additionally show the masked key.
#[tauri::command]
pub async fn license_status(
    state: State<'_, LicenseState>,
) -> Result<LicenseStatusPayload, LicenseError> {
    Ok(state.0.lock().await.resolve_status())
}

/// ROUTE-ONLY status (D-89): same pure-local read as [`license_status`] but also
/// resolves the masked license key for the Licensed/OfflineGrace arms. This is
/// the ONLY licensed status path that reads the Keychain, and it is invoked
/// ONLY by the user-initiated license settings route — so a licensed LAUNCH
/// never prompts (T-19-10 invariant restored). LIC-04: only the masked form
/// ever crosses to JS; the raw key is masked Rust-side and never retained.
#[tauri::command]
pub async fn license_status_detail(
    state: State<'_, LicenseState>,
) -> Result<LicenseStatusPayload, LicenseError> {
    Ok(state.0.lock().await.resolve_status_with_masked_key())
}

/// The phase's ONLY user-triggerable network call (D-45). `key: None` =
/// reactivate with the Keychain-stored key (D-44; the key never round-trips
/// through JS — LIC-04).
#[tauri::command]
pub async fn activate_license(
    state: State<'_, LicenseState>,
    key: Option<String>,
) -> Result<LicenseStatusPayload, LicenseError> {
    state.0.lock().await.activate(key).await
}

/// TTL refresh primitive — callable now; the UI wiring is Phase 21.
#[tauri::command]
pub async fn refresh_license(
    state: State<'_, LicenseState>,
) -> Result<LicenseStatusPayload, LicenseError> {
    state.0.lock().await.refresh().await
}

/// D-76 silent background refresh — invoked ONLY by the lib.rs scheduler
/// (launch trigger + 24h poll), never by user-facing UI (the status route's
/// explicit Refresh button uses `refresh_license`, which DOES surface errors).
///
/// Always returns `Ok` (the inner manager method swallows every error): a
/// failed attempt leaves the on-disk state untouched and surfaces nothing
/// (D-76/D-77). The `()` error type is unreachable by construction — it exists
/// only because Tauri commands borrowing `State<'_, T>` must return `Result`.
#[tauri::command]
pub async fn refresh_license_if_needed(
    state: State<'_, LicenseState>,
) -> Result<LicenseStatusPayload, ()> {
    Ok(state.0.lock().await.refresh_if_needed().await)
}

/// Seat-transfer primitive (LIC-07) — callable-but-unwired this phase.
#[tauri::command]
pub async fn deactivate_machine(
    state: State<'_, LicenseState>,
) -> Result<LicenseStatusPayload, LicenseError> {
    state.0.lock().await.deactivate().await
}

/// DEV-ONLY license-state override (the e2e seam, 22.1-04). Sets a process-local
/// synthetic override on the managed `LicenseManager` so the real-WKWebView e2e
/// can deterministically drive free/licensed/problem (+offlineGrace/refreshNeeded)
/// without a live CE checkout (which needs a server-side signing key, impossible
/// headlessly). `Some(state)` makes `license_status` AND `license_status_detail`
/// return a SYNTHETIC payload for that state, bypassing the cert/Keychain; `None`
/// clears it (real behavior). Recognized states: "licensed" | "offlineGrace" |
/// "refreshNeeded" | "problem" | "notActivated" (alias "free") — any unrecognized
/// value clears the override (treated as `None`).
///
/// DOUBLE-GATED, mirroring the dev-CA idiom in keygen_client.rs + the webdriver
/// plugin in lib.rs: this command, the manager's `set_dev_state_override` setter,
/// the `DevLicenseState` enum, and the synthetic builder are ALL
/// `#[cfg(debug_assertions)]`, and lib.rs registers it ONLY under
/// `#[cfg(debug_assertions)]` — a release build compiles every part out entirely,
/// so no webview call can ever reach it (the prod binary is byte-identical to
/// today bar the debug-only code; scripts/check-dev-strip.sh asserts both the
/// command name and the synthetic literals are absent from the release binary).
#[cfg(debug_assertions)]
#[tauri::command]
pub async fn dev_set_license_state(
    state: State<'_, LicenseState>,
    new_state: Option<String>,
) -> Result<LicenseStatusPayload, LicenseError> {
    let parsed = new_state
        .as_deref()
        .and_then(super::DevLicenseState::parse);
    let mut mgr = state.0.lock().await;
    mgr.set_dev_state_override(parsed);
    // Return the now-resolved status so the caller can await the flip deterministically.
    Ok(mgr.resolve_status_with_masked_key())
}
