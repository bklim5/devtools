//! Per-environment compile-time licensing constants (D-40/D-41).
//!
//! D-40: dev points at the local Keygen CE instance (`scripts/keygen-ce/`).
//! The production swap is a constants change in THIS file at the Phase 21 ship
//! gate — no runtime configuration, no env vars.
//!
//! D-41: everything in this file is safe to commit. The account id appears in
//! every API URL, the Ed25519 public key is public by design (minisign-pubkey
//! posture), and APP_SALT only de-correlates fingerprints (see its doc).

use ed25519_dalek::VerifyingKey;

/// Keygen host (dev = local CE behind Caddy `tls internal`).
/// Phase 21 ship gate swaps this to the production host (D-40).
pub const KEYGEN_HOST: &str = "localhost";

/// Keygen account id — present in every API URL path; not a secret.
/// Value from 19-SPIKE-OUTCOME.md (local CE instance).
pub const KEYGEN_ACCOUNT_ID: &str = "23c88309-2584-4771-81df-1d351672ff91";

/// Account Ed25519 public key, base64 of the RAW 32 bytes.
///
/// NOTE (SPIKE finding): CE's API serializer exposes `meta.keys.ed25519` as
/// base64-of-HEX (the DB stores a 64-char hex string). This constant is the
/// normalized form — base64 of the raw 32 bytes — which is what
/// `ed25519_dalek::VerifyingKey::from_bytes` wants. Mirrors
/// `src-tauri/fixtures/ce-ed25519-pubkey.b64`.
pub const KEYGEN_ED25519_PUBKEY_B64: &str = "ZBd2u102TCpivzVAisQZi7h5YUqhmtT6DA1Ej0YPes4=";

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
}
