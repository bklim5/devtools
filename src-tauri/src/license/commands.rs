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
#[tauri::command]
pub async fn license_status(
    state: State<'_, LicenseState>,
) -> Result<LicenseStatusPayload, LicenseError> {
    Ok(state.0.lock().await.resolve_status())
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
