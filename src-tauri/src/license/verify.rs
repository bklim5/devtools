//! Pure machine.lic verification (LIC-03 crypto core, LIC-06 fail-closed taxonomy).
//!
//! ZERO I/O, ZERO Tauri types — `verify_machine_file` takes the certificate
//! text, the embedded account pubkey, and the expected fingerprint, and returns
//! a typed result. Every parse/verify failure maps to a distinct [`VerifyError`]
//! variant; nothing panics on untrusted input, and no failure path falls
//! through to a licensed state (T-19-06/08/09).
//!
//! Format ground truth (source-verified from keygen-api's
//! machine_checkout_service.rb):
//! - Outer: `-----BEGIN MACHINE FILE-----` + base64(envelope JSON, 80-col
//!   wrapped) + `-----END MACHINE FILE-----`
//! - Envelope: `{"enc": <b64 dataset>, "sig": <b64 64-byte ed25519 sig>,
//!   "alg": "base64+ed25519"}`
//! - The signature is over the ASCII string `"machine/" + enc` — the literal
//!   `machine/` prefix on the STILL-BASE64 enc (Pitfall 4; signing the decoded
//!   bytes always fails).

use base64::{engine::general_purpose::STANDARD as B64, Engine};
use ed25519_dalek::{Signature, VerifyingKey};

const BEGIN_MARKER: &str = "-----BEGIN MACHINE FILE-----";
const END_MARKER: &str = "-----END MACHINE FILE-----";
/// Exact-match algorithm gate: anything else (encrypted "aes-256-gcm+ed25519",
/// RSA forms, unknown) is rejected fail-closed — no weaker fallback (T-19-08).
const SUPPORTED_ALG: &str = "base64+ed25519";

/// Typed, fail-closed verification failures (LIC-06). `NotActivated` is NOT a
/// variant — a missing machine.lic is a normal state handled by store/status.
#[derive(Debug, thiserror::Error, PartialEq, Eq, Clone, Copy)]
pub enum VerifyError {
    /// Structurally unreadable: bad markers, bad base64, bad JSON, bad sig bytes.
    #[error("machine file is corrupt")]
    Corrupt,
    /// Envelope `alg` is not exactly "base64+ed25519" (encrypted/unknown forms).
    #[error("machine file uses an unsupported algorithm")]
    UnsupportedAlg,
    /// Ed25519 signature does not verify under the embedded account pubkey
    /// (forged, modified, or issued by a foreign Keygen instance's keypair).
    #[error("machine file signature verification failed")]
    Tampered,
    /// Valid signature but the embedded fingerprint is not this machine's
    /// (machine.lic copied from another Mac — ship-gate case 5).
    #[error("machine file was issued for a different machine")]
    ForeignMachine,
}

/// Successful verification result. `expiry` is surfaced verbatim but NOT
/// enforced this phase — TTL/grace handling is Phase 21 (research A6).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LicenseData {
    pub expiry: Option<String>,
    pub issued: Option<String>,
    pub fingerprint: String,
    pub entitlements: Vec<String>,
    /// Buyer email (D-89), extracted from the included "licenses" resource's
    /// `attributes.metadata.email`. `None` for pre-D-89 licenses minted without
    /// it — the masked-key/status surface degrades gracefully ("—").
    pub email: Option<String>,
}

// --- Wire-format serde structs ---------------------------------------------
// Permissive optional fields throughout: CE adds attributes freely; we only
// read what we need.

#[derive(serde::Deserialize)]
struct Envelope {
    enc: String,
    sig: String,
    alg: String,
}

#[derive(serde::Deserialize)]
struct Dataset {
    #[serde(default)]
    meta: DatasetMeta,
    data: MachineResource,
    #[serde(default)]
    included: Vec<IncludedResource>,
}

#[derive(serde::Deserialize, Default)]
struct DatasetMeta {
    issued: Option<String>,
    expiry: Option<String>,
}

#[derive(serde::Deserialize)]
struct MachineResource {
    attributes: MachineAttributes,
}

#[derive(serde::Deserialize)]
struct MachineAttributes {
    fingerprint: String,
}

#[derive(serde::Deserialize)]
struct IncludedResource {
    #[serde(rename = "type")]
    kind: String,
    #[serde(default)]
    attributes: serde_json::Value,
}

/// Constant-time byte-string equality.
///
/// Choice (documented per plan): a simple accumulate-XOR compare rather than
/// `hmac::Mac::verify_slice` re-MACing — both inputs here are fixed-length
/// lowercase-hex HMAC-SHA256 outputs (64 chars), so a length leak reveals
/// nothing and the per-byte compare never short-circuits.
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

/// Verify a machine.lic certificate: parse → `verify_strict` → fingerprint
/// compare. Pure function — the caller supplies everything (file text, pubkey,
/// expected fingerprint); every failure is a typed [`VerifyError`].
pub fn verify_machine_file(
    cert: &str,
    pubkey: &VerifyingKey,
    expected_fingerprint: &str,
) -> Result<LicenseData, VerifyError> {
    // Steps 2-3: strip markers, drop all whitespace, b64 → envelope JSON.
    let body: String = cert
        .trim()
        .strip_prefix(BEGIN_MARKER)
        .ok_or(VerifyError::Corrupt)?
        .strip_suffix(END_MARKER)
        .ok_or(VerifyError::Corrupt)?
        .chars()
        .filter(|c| !c.is_whitespace())
        .collect();
    let envelope: Envelope =
        serde_json::from_slice(&B64.decode(&body).map_err(|_| VerifyError::Corrupt)?)
            .map_err(|_| VerifyError::Corrupt)?;

    // Step 3b: exact algorithm match, fail closed.
    if envelope.alg != SUPPORTED_ALG {
        return Err(VerifyError::UnsupportedAlg);
    }

    // Steps 4-5: decode sig, verify_strict over the literal "machine/" + enc.
    // verify_strict (not verify) rejects malleable/weak-key edge cases.
    let sig_bytes = B64.decode(&envelope.sig).map_err(|_| VerifyError::Corrupt)?;
    let sig = Signature::from_slice(&sig_bytes).map_err(|_| VerifyError::Corrupt)?;
    pubkey
        .verify_strict(format!("machine/{}", envelope.enc).as_bytes(), &sig)
        .map_err(|_| VerifyError::Tampered)?;

    // Step 6: decode the (now signature-proven) dataset.
    let dataset: Dataset =
        serde_json::from_slice(&B64.decode(&envelope.enc).map_err(|_| VerifyError::Corrupt)?)
            .map_err(|_| VerifyError::Corrupt)?;

    // Step 7: fingerprint binding (ship-gate case 5: copied machine.lic).
    let cert_fingerprint = dataset.data.attributes.fingerprint;
    if !constant_time_eq(cert_fingerprint.as_bytes(), expected_fingerprint.as_bytes()) {
        return Err(VerifyError::ForeignMachine);
    }

    // Steps 8-9: surface expiry (NOT enforced — Phase 21), extract entitlement
    // codes from included entries of type "entitlements".
    let entitlements = dataset
        .included
        .iter()
        .filter(|r| r.kind == "entitlements")
        .filter_map(|r| r.attributes.get("code").and_then(|c| c.as_str()))
        .map(str::to_string)
        .collect();

    // Step 10 (D-89): the buyer email rides in the included "licenses" resource's
    // attributes.metadata.email (the webhook stamps it at create time). Read the
    // first such resource; absent on pre-D-89 licenses → None (fail-soft).
    let email = dataset
        .included
        .iter()
        .find(|r| r.kind == "licenses")
        .and_then(|r| r.attributes.get("metadata"))
        .and_then(|m| m.get("email"))
        .and_then(|e| e.as_str())
        .map(str::to_string);

    Ok(LicenseData {
        expiry: dataset.meta.expiry,
        issued: dataset.meta.issued,
        fingerprint: cert_fingerprint,
        entitlements,
        email,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};

    /// Build a certificate exactly like machine_checkout_service.rb: dataset →
    /// b64 enc → sign "machine/"+enc → envelope JSON → b64 body → markers. The
    /// included "licenses" resource carries NO metadata.email (pre-D-89 shape) —
    /// use [`make_fixture_with_email`] for the email-bearing variant.
    fn make_fixture(fingerprint: &str, expiry: &str) -> (String, VerifyingKey, SigningKey) {
        make_fixture_inner(fingerprint, expiry, None)
    }

    /// Like [`make_fixture`] but stamps `metadata.email` onto the included
    /// "licenses" resource (D-89 — the shape the webhook now mints).
    fn make_fixture_with_email(
        fingerprint: &str,
        expiry: &str,
        email: &str,
    ) -> (String, VerifyingKey, SigningKey) {
        make_fixture_inner(fingerprint, expiry, Some(email))
    }

    fn make_fixture_inner(
        fingerprint: &str,
        expiry: &str,
        email: Option<&str>,
    ) -> (String, VerifyingKey, SigningKey) {
        let sk = SigningKey::generate(&mut rand::rngs::OsRng);
        // Mirror the CE shape: email (when present) lives in the license
        // resource's attributes.metadata.email (D-89).
        let license_attrs = match email {
            Some(e) => serde_json::json!({ "name": "Test", "metadata": { "email": e } }),
            None => serde_json::json!({ "name": "Test" }),
        };
        let dataset = serde_json::json!({
            "meta": { "issued": "2026-06-12T00:00:00.000Z", "expiry": expiry, "ttl": 2629746 },
            "data": {
                "type": "machines",
                "id": "test-machine-id",
                "attributes": { "fingerprint": fingerprint, "platform": "darwin" }
            },
            "included": [
                { "type": "licenses", "id": "test-license-id", "attributes": license_attrs },
                { "type": "entitlements", "id": "ent-1", "attributes": { "code": "pro.theming" } },
                { "type": "entitlements", "id": "ent-2", "attributes": { "code": "pro.ordering" } }
            ]
        });
        let enc = B64.encode(dataset.to_string());
        let sig = B64.encode(sk.sign(format!("machine/{enc}").as_bytes()).to_bytes());
        let vk = sk.verifying_key();
        (assemble_cert(&enc, &sig, "base64+ed25519"), vk, sk)
    }

    /// Assemble the outer certificate from envelope parts (lets tests mutate
    /// individual fields before assembly).
    fn assemble_cert(enc: &str, sig: &str, alg: &str) -> String {
        let envelope = serde_json::json!({ "enc": enc, "sig": sig, "alg": alg });
        let body = B64.encode(envelope.to_string());
        format!("-----BEGIN MACHINE FILE-----\n{body}\n-----END MACHINE FILE-----")
    }

    const FP: &str = "aaaabbbbccccddddaaaabbbbccccddddaaaabbbbccccddddaaaabbbbccccdddd";

    // Test 1: happy path — valid cert + matching fingerprint → Ok with
    // expiry/entitlements extracted.
    #[test]
    fn valid_cert_with_matching_fingerprint_verifies() {
        let (cert, vk, _) = make_fixture(FP, "2026-07-12T00:00:00.000Z");
        let data = verify_machine_file(&cert, &vk, FP).expect("must verify");
        assert_eq!(data.fingerprint, FP);
        assert_eq!(data.expiry.as_deref(), Some("2026-07-12T00:00:00.000Z"));
        assert_eq!(data.issued.as_deref(), Some("2026-06-12T00:00:00.000Z"));
        assert_eq!(data.entitlements, vec!["pro.theming", "pro.ordering"]);
        // The base fixture is the pre-D-89 shape (no metadata.email) → None.
        assert_eq!(data.email, None);
    }

    // Test 2: a flipped byte inside enc → Tampered (signature no longer covers it).
    #[test]
    fn flipped_byte_in_enc_is_tampered() {
        let sk = SigningKey::generate(&mut rand::rngs::OsRng);
        let dataset = serde_json::json!({
            "meta": {}, "data": { "attributes": { "fingerprint": FP } }, "included": []
        });
        let enc = B64.encode(dataset.to_string());
        let sig = B64.encode(sk.sign(format!("machine/{enc}").as_bytes()).to_bytes());
        // Flip one base64 char of enc AFTER signing (stay in the b64 alphabet).
        let mut tampered_enc: Vec<u8> = enc.into_bytes();
        tampered_enc[10] = if tampered_enc[10] == b'A' { b'B' } else { b'A' };
        let cert = assemble_cert(
            &String::from_utf8(tampered_enc).unwrap(),
            &sig,
            "base64+ed25519",
        );
        assert_eq!(
            verify_machine_file(&cert, &sk.verifying_key(), FP),
            Err(VerifyError::Tampered)
        );
    }

    // Test 3: truncated certificate body → Corrupt (never a panic).
    #[test]
    fn truncated_body_is_corrupt() {
        let (cert, vk, _) = make_fixture(FP, "2026-07-12T00:00:00.000Z");
        let body = cert
            .strip_prefix("-----BEGIN MACHINE FILE-----\n")
            .unwrap()
            .strip_suffix("\n-----END MACHINE FILE-----")
            .unwrap();
        let truncated = format!(
            "-----BEGIN MACHINE FILE-----\n{}\n-----END MACHINE FILE-----",
            &body[..body.len() / 2]
        );
        assert_eq!(
            verify_machine_file(&truncated, &vk, FP),
            Err(VerifyError::Corrupt)
        );
    }

    // Test 4: encrypted-form alg → UnsupportedAlg (exact-match gate, no fallback).
    #[test]
    fn encrypted_alg_is_unsupported() {
        let sk = SigningKey::generate(&mut rand::rngs::OsRng);
        let dataset = serde_json::json!({
            "meta": {}, "data": { "attributes": { "fingerprint": FP } }, "included": []
        });
        let enc = B64.encode(dataset.to_string());
        let sig = B64.encode(sk.sign(format!("machine/{enc}").as_bytes()).to_bytes());
        let cert = assemble_cert(&enc, &sig, "aes-256-gcm+ed25519");
        assert_eq!(
            verify_machine_file(&cert, &sk.verifying_key(), FP),
            Err(VerifyError::UnsupportedAlg)
        );
    }

    // Test 5: a valid cert signed by a DIFFERENT keypair (foreign CE instance)
    // → Tampered (different account keypair lands on signature failure).
    #[test]
    fn foreign_keypair_cert_is_tampered() {
        let (cert, _vk_a, _) = make_fixture(FP, "2026-07-12T00:00:00.000Z");
        let (_, vk_b, _) = make_fixture(FP, "2026-07-12T00:00:00.000Z");
        assert_eq!(
            verify_machine_file(&cert, &vk_b, FP),
            Err(VerifyError::Tampered)
        );
    }

    // Test 6: valid cert, wrong expected fingerprint → ForeignMachine
    // (machine.lic copied from another Mac — ship-gate case 5).
    #[test]
    fn wrong_fingerprint_is_foreign_machine() {
        let (cert, vk, _) = make_fixture(FP, "2026-07-12T00:00:00.000Z");
        let other_fp = "ffffeeeeddddccccffffeeeeddddccccffffeeeeddddccccffffeeeeddddcccc";
        assert_eq!(
            verify_machine_file(&cert, &vk, other_fp),
            Err(VerifyError::ForeignMachine)
        );
    }

    // Test 7: empty string and pure garbage → Corrupt, no panic.
    #[test]
    fn empty_and_garbage_input_are_corrupt() {
        let (_, vk, _) = make_fixture(FP, "2026-07-12T00:00:00.000Z");
        assert_eq!(verify_machine_file("", &vk, FP), Err(VerifyError::Corrupt));
        assert_eq!(
            verify_machine_file("complete garbage, not a machine file", &vk, FP),
            Err(VerifyError::Corrupt)
        );
        assert_eq!(
            verify_machine_file(
                "-----BEGIN MACHINE FILE-----\n!!!not base64!!!\n-----END MACHINE FILE-----",
                &vk,
                FP
            ),
            Err(VerifyError::Corrupt)
        );
    }

    // Test 8: REAL-CE CROSS-VALIDATION — the byte-verbatim CE-issued fixture
    // from Plan 01 verifies against the real account pubkey in config.rs.
    // Proves the parser against real server output, not just our constructor.
    #[test]
    fn real_ce_issued_fixture_verifies_against_real_pubkey() {
        let cert = include_str!("../../fixtures/ce-machine.lic");
        // The fixture's embedded fingerprint is SYNTHETIC (openssl rand -hex 32,
        // recorded by decoding the fixture's dataset — see 19-SPIKE-OUTCOME.md).
        let fixture_fp = "b70ebcaf8c4684c767208ac8d656da87c7917a0141d5540f0196ec4d23bcf2a5";
        let data = verify_machine_file(cert, &super::super::config::verifying_key(), fixture_fp)
            .expect("real CE fixture must verify against the real CE pubkey");
        assert_eq!(data.fingerprint, fixture_fp);
        assert_eq!(data.expiry.as_deref(), Some("2026-07-12T15:14:47.247Z"));
        assert_eq!(data.issued.as_deref(), Some("2026-06-12T15:14:47.247Z"));
        // The spike checkout included only the license (no entitlements).
        assert!(data.entitlements.is_empty());
    }

    // Test 9: expiry is surfaced verbatim and NOT enforced — an already-expired
    // cert still verifies Ok (TTL/grace enforcement is Phase 21, research A6).
    #[test]
    fn expired_cert_still_verifies_expiry_surfaced_verbatim() {
        let (cert, vk, _) = make_fixture(FP, "2020-01-01T00:00:00.000Z");
        let data = verify_machine_file(&cert, &vk, FP).expect("expired cert must still verify");
        assert_eq!(data.expiry.as_deref(), Some("2020-01-01T00:00:00.000Z"));
    }

    // Test 10 (D-89): a cert whose included "licenses" resource carries
    // metadata.email → LicenseData.email == Some(that). Proves the email flows
    // webhook → license → machine.lic → verified cert (the support-lookup key).
    #[test]
    fn email_in_license_metadata_is_extracted() {
        let (cert, vk, _) =
            make_fixture_with_email(FP, "2026-07-12T00:00:00.000Z", "buyer@example.com");
        let data = verify_machine_file(&cert, &vk, FP).expect("must verify");
        assert_eq!(data.email.as_deref(), Some("buyer@example.com"));
    }

    // Test 11 (D-89): an older pre-D-89 license with no metadata.email → None.
    // The verifier must degrade gracefully, never panic on the absent field.
    #[test]
    fn absent_email_metadata_is_none() {
        let (cert, vk, _) = make_fixture(FP, "2026-07-12T00:00:00.000Z");
        let data = verify_machine_file(&cert, &vk, FP).expect("must verify");
        assert_eq!(data.email, None);
    }
}
