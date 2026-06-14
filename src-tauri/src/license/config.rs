//! Per-environment compile-time licensing constants (D-40/D-41/D-52).
//!
//! D-52: the three env-varying constants are split by build profile via
//! `cfg(debug_assertions)` — mirroring the `#[cfg(debug_assertions)]` dev-CA
//! idiom in `keygen_client.rs`. A DEBUG build (incl. `cargo test` + `tauri dev`)
//! embeds the local CE values; a RELEASE build embeds ONLY the production CE
//! values, so a shipped binary can never point a buyer at localhost. There is
//! no runtime configuration and no env vars — the active profile picks the arm.
//!
//! The prod account-id + pubkey are produced by the production CE in Plan 03's
//! `setup.sh`; until that runs they are clearly-marked placeholder sentinels.
//! The `#[cfg(not(debug_assertions))]` tripwire test below REJECTS the
//! placeholder pubkey, so a release build (`cargo test --release`) FAILS while
//! the placeholder remains — Plan 03 fills the real values and re-runs it.
//!
//! D-41: everything in this file is safe to commit. The account id is a public
//! identifier (under CE singleplayer it is NOT in the API URL path — the API is
//! mounted at `/v1/...`), the Ed25519 public key is public by design
//! (minisign-pubkey posture), and APP_SALT only de-correlates fingerprints.

use ed25519_dalek::VerifyingKey;

/// Keygen host. Dev = local CE behind Caddy `tls internal`; release = the
/// production CE at `license.tinkerdev.io` (D-52). The active profile selects.
#[cfg(debug_assertions)]
pub const KEYGEN_HOST: &str = "localhost";
#[cfg(not(debug_assertions))]
pub const KEYGEN_HOST: &str = "license.tinkerdev.io";

/// Keygen account id — the public account identifier; not a secret (D-41). CE
/// singleplayer mounts the API at `/v1/...` (no `/accounts/{id}` segment), so
/// this is NOT in the URL path; it's retained for the record + release tripwire.
/// Dev value from 19-SPIKE-OUTCOME.md (local CE instance); the prod value is
/// minted by Plan 03's `setup.sh` (D-51).
///
/// `#[allow(dead_code)]`: unused at runtime (singleplayer `/v1` omits it from the
/// URL); only the release tripwire (`#[cfg(test)]`) reads it, so non-test builds
/// would otherwise warn dead_code.
#[cfg(debug_assertions)]
#[allow(dead_code)]
pub const KEYGEN_ACCOUNT_ID: &str = "23c88309-2584-4771-81df-1d351672ff91"; // local CE
#[cfg(not(debug_assertions))]
#[allow(dead_code)]
pub const KEYGEN_ACCOUNT_ID: &str = "0d607683-026f-468b-9cf0-f5bfaf61a7a1"; // prod CE (D-51, setup.sh 2026-06-14)

/// Account Ed25519 public key, base64 of the RAW 32 bytes.
///
/// NOTE (SPIKE finding): CE's API serializer exposes `meta.keys.ed25519` as
/// base64-of-HEX (the DB stores a 64-char hex string). This constant is the
/// normalized form — base64 of the raw 32 bytes — which is what
/// `ed25519_dalek::VerifyingKey::from_bytes` wants. The dev arm mirrors
/// `src-tauri/fixtures/ce-ed25519-pubkey.b64`; the prod arm is minted by Plan
/// 03's `setup.sh` (D-51) and is a placeholder until then (the release-only
/// tripwire test rejects it).
#[cfg(debug_assertions)]
pub const KEYGEN_ED25519_PUBKEY_B64: &str = "ZBd2u102TCpivzVAisQZi7h5YUqhmtT6DA1Ej0YPes4="; // local CE
#[cfg(not(debug_assertions))]
pub const KEYGEN_ED25519_PUBKEY_B64: &str = "huJdyRsBtd7KrPqWv5Z/8GVeLmiqfWTfQnEb090+jO4="; // prod CE (D-51, setup.sh 2026-06-14)

/// App-wide fingerprint salt (D-41): `fingerprint = hex(HMAC-SHA256(APP_SALT, IOPlatformUUID))`.
///
/// Generated ONCE via `openssl rand -hex 32` and committed. Public-safe: the
/// salt only de-correlates fingerprints across apps (a Keygen server or a leaked
/// machine.lic can't be joined to another product's fingerprint of the same Mac);
/// it is NOT a secret key protecting anything.
///
/// NEVER change this value after first release — every activation binds the
/// machine fingerprint server-side, so a new salt orphans every existing
/// activation (research assumption A5).
pub const APP_SALT: &[u8] = b"e14f0d1630565bf022fe7d40de2aeceefb254a01151d3df397489335b4e45c75";

// --- License lifecycle tunables (D-73/D-74/D-75/D-76) ----------------------
//
// Profile-INVARIANT (identical dev and release — NOT cfg-split): these govern
// the offline-grace state machine in `resolve_status` and the background
// refresh cadence (Plan 02). They are public constants so both the Rust core
// and its tests read one source of truth.
//
// Worst-case revocation exposure ≈ 37 days: a revoked seat keeps Pro until the
// cached cert's TTL lapses (≤ TTL_DAYS = 30) plus the GRACE_DAYS = 7 window
// past expiry before `resolve_status` drops to free. Renew-ahead
// (RENEW_AHEAD_DAYS) means a normally-connected user re-checks-out a fresh cert
// before ever entering grace, so the exposure is the genuinely-long-offline
// upper bound, not the common case.

/// D-74: cache TTL of a checked-out `machine.lic` (~30-day Keygen TTL).
///
/// `#[allow(dead_code)]`: a documentation/invariant constant — the TTL is
/// enforced server-side by Keygen (the issued cert's `expiry`), so nothing in
/// the client reads it at runtime; the config tests pin it + the
/// `RENEW_AHEAD_DAYS < TTL_DAYS` invariant.
#[allow(dead_code)]
pub const TTL_DAYS: i64 = 30;

/// D-74: renew-ahead window — attempt a background re-checkout once the cert is
/// within this many days of (or past) `expiry`, so connected users renew BEFORE
/// entering grace. Must be `< TTL_DAYS` (the renew window opens before expiry).
pub const RENEW_AHEAD_DAYS: i64 = 7;

/// D-75: tight grace past `expiry`. If refresh can't succeed (offline/service
/// down) the cert stays Pro-active for this many days past expiry, then drops to
/// free (`RefreshNeeded`) until a successful refresh.
pub const GRACE_DAYS: i64 = 7;

/// D-76: periodic background-poll cadence (hours) while the app runs, used by
/// Plan 02's scheduler — only fires when online and the cert is in the
/// renew/grace/expired window. No per-launch hard network check.
pub const POLL_INTERVAL_HOURS: u64 = 24;

/// The embedded account verifying key, decoded from [`KEYGEN_ED25519_PUBKEY_B64`].
///
/// Panics on malformed constant data — acceptable: the input is compile-time
/// data, so any failure is a build-time authoring error caught by the unit
/// tests below, never a runtime condition.
pub fn verifying_key() -> VerifyingKey {
    use base64::{engine::general_purpose::STANDARD as B64, Engine};
    let bytes = B64
        .decode(KEYGEN_ED25519_PUBKEY_B64)
        .expect("KEYGEN_ED25519_PUBKEY_B64 is not valid base64");
    let bytes: [u8; 32] = bytes
        .as_slice()
        .try_into()
        .expect("KEYGEN_ED25519_PUBKEY_B64 must decode to exactly 32 bytes");
    VerifyingKey::from_bytes(&bytes)
        .expect("KEYGEN_ED25519_PUBKEY_B64 is not a valid Ed25519 public key")
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::{engine::general_purpose::STANDARD as B64, Engine};

    #[test]
    fn pubkey_const_decodes_to_exactly_32_bytes() {
        let bytes = B64.decode(KEYGEN_ED25519_PUBKEY_B64).expect("valid base64");
        assert_eq!(bytes.len(), 32);
    }

    #[test]
    fn pubkey_const_constructs_a_valid_verifying_key() {
        // verifying_key() panics on bad data — reaching the assert proves validity.
        let vk = verifying_key();
        assert_eq!(vk.as_bytes().len(), 32);
    }

    #[test]
    fn app_salt_is_64_hex_chars() {
        assert_eq!(APP_SALT.len(), 64);
        assert!(APP_SALT.iter().all(|b| b.is_ascii_hexdigit()));
    }

    #[test]
    fn lifecycle_tunables_are_the_locked_values() {
        // D-74/D-75/D-76 exact values — pinned so a casual edit is caught.
        assert_eq!(TTL_DAYS, 30);
        assert_eq!(RENEW_AHEAD_DAYS, 7);
        assert_eq!(GRACE_DAYS, 7);
        assert_eq!(POLL_INTERVAL_HOURS, 24);
    }

    #[test]
    fn renew_ahead_window_opens_before_expiry() {
        // The renew-ahead window must open strictly before the cert expires,
        // otherwise a connected user could never renew before grace.
        assert!(RENEW_AHEAD_DAYS < TTL_DAYS);
    }

    /// D-52 release tripwire. This test runs ONLY in a release build
    /// (`#[cfg(not(debug_assertions))]`), so the default debug `cargo test`
    /// never sees it — the dev consts above validate under `cargo test`. Plan
    /// 03's gate is `cargo test --release`: while the prod placeholders remain,
    /// this FAILS (the placeholder pubkey is not valid base64-of-32-bytes),
    /// proving a release binary can never silently ship the placeholder. Plan
    /// 03 fills the real values minted by `setup.sh` and re-runs it green.
    #[cfg(not(debug_assertions))]
    #[test]
    fn release_build_embeds_prod_constants() {
        // The release host MUST be the production CE, never localhost.
        assert_eq!(KEYGEN_HOST, "license.tinkerdev.io");
        assert_ne!(KEYGEN_HOST, "localhost");
        // The release pubkey MUST decode to exactly 32 raw bytes — the
        // placeholder ("PROD_PUBKEY_PLACEHOLDER") fails this, which is the
        // intended tripwire until Plan 03 mints the real key.
        let bytes = B64
            .decode(KEYGEN_ED25519_PUBKEY_B64)
            .expect("release KEYGEN_ED25519_PUBKEY_B64 must be valid base64 (fill via Plan 03 setup.sh)");
        assert_eq!(
            bytes.len(),
            32,
            "release KEYGEN_ED25519_PUBKEY_B64 must decode to 32 bytes (fill via Plan 03 setup.sh)"
        );
        // And the account id must no longer be the placeholder sentinel.
        assert_ne!(KEYGEN_ACCOUNT_ID, "PROD_ACCOUNT_ID_PLACEHOLDER");
    }
}
