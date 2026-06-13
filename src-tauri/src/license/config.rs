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
//! D-41: everything in this file is safe to commit. The account id appears in
//! every API URL, the Ed25519 public key is public by design (minisign-pubkey
//! posture), and APP_SALT only de-correlates fingerprints (see its doc).

use ed25519_dalek::VerifyingKey;

/// Keygen host. Dev = local CE behind Caddy `tls internal`; release = the
/// production CE at `license.tinkerdev.io` (D-52). The active profile selects.
#[cfg(debug_assertions)]
pub const KEYGEN_HOST: &str = "localhost";
#[cfg(not(debug_assertions))]
pub const KEYGEN_HOST: &str = "license.tinkerdev.io";

/// Keygen account id — present in every API URL path; not a secret (D-41).
/// Dev value from 19-SPIKE-OUTCOME.md (local CE instance); the prod value is
/// minted by Plan 03's `setup.sh` (D-51), placeholder until then.
#[cfg(debug_assertions)]
pub const KEYGEN_ACCOUNT_ID: &str = "23c88309-2584-4771-81df-1d351672ff91"; // local CE
#[cfg(not(debug_assertions))]
pub const KEYGEN_ACCOUNT_ID: &str = "PROD_ACCOUNT_ID_PLACEHOLDER"; // ← Plan 03 setup.sh (D-51)

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
pub const KEYGEN_ED25519_PUBKEY_B64: &str = "PROD_PUBKEY_PLACEHOLDER"; // ← Plan 03 setup.sh (D-51)

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
