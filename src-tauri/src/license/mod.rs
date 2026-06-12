//! Licensing core (Phase 19, LIC-01/03/04/06).
//!
//! Pure, cargo-testable modules: no network in this tree (D-45 — the only
//! network call, user-initiated activation, joins in Plan 03's client module).

// TEMPORARY until Plan 03 wires the Tauri commands: nothing outside this module
// consumes it yet, so every public item dead-code-warns. Remove with Plan 03.
#![allow(dead_code)]

pub mod config;
pub mod fingerprint;
pub mod keychain;
pub mod store;
pub mod verify;

use keychain::KeychainAccess;
use store::LicFileStore;
use verify::{verify_machine_file, VerifyError};

/// Webview-facing license status (the TS contract for Plans 03/04 — the serde
/// test below pins the exact camelCase JSON shapes).
///
/// LIC-04 invariant: no variant ever carries key material — `has_stored_key`
/// is the ONLY Keychain-derived value JS may see (T-19-10).
#[derive(serde::Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase", tag = "state")]
pub enum LicenseStatusPayload {
    #[serde(rename_all = "camelCase")]
    NotActivated { has_stored_key: bool },
    #[serde(rename_all = "camelCase")]
    Licensed {
        expiry: Option<String>,
        entitlements: Vec<String>,
    },
    #[serde(rename_all = "camelCase")]
    Problem {
        problem: ProblemKind,
        has_stored_key: bool,
    },
}

/// Serializes as: "corrupt" | "tampered" | "foreignMachine" | "unsupportedAlg".
#[derive(serde::Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ProblemKind {
    Corrupt,
    Tampered,
    ForeignMachine,
    UnsupportedAlg,
}

impl From<VerifyError> for ProblemKind {
    fn from(e: VerifyError) -> Self {
        match e {
            VerifyError::Corrupt => ProblemKind::Corrupt,
            VerifyError::Tampered => ProblemKind::Tampered,
            VerifyError::ForeignMachine => ProblemKind::ForeignMachine,
            VerifyError::UnsupportedAlg => ProblemKind::UnsupportedAlg,
        }
    }
}

/// Owns the licensing collaborators behind traits (mockable in tests; the
/// network client slot joins in Plan 03). The machine fingerprint is injected
/// once at construction (computed at startup in Plan 03) so `resolve_status`
/// stays deterministic — it never shells out to ioreg itself.
pub struct LicenseManager {
    store: Box<dyn LicFileStore>,
    keychain: Box<dyn KeychainAccess>,
    fingerprint: String,
}

impl LicenseManager {
    pub fn new(
        store: Box<dyn LicFileStore>,
        keychain: Box<dyn KeychainAccess>,
        fingerprint: String,
    ) -> Self {
        Self {
            store,
            keychain,
            fingerprint,
        }
    }

    /// PURE-LOCAL license status (D-45: zero network, every launch): read
    /// machine.lic -> Ed25519 verify + fingerprint check -> typed payload.
    /// Every verify failure is a typed Problem — fail closed, never licensed
    /// on error (LIC-06).
    ///
    /// `has_stored_key` is computed lazily, ONLY for the NotActivated/Problem
    /// variants — a licensed launch never touches the Keychain (avoids the
    /// Pitfall 5 dev-build prompt on every start).
    pub fn resolve_status(&self) -> LicenseStatusPayload {
        let Some(cert) = self.store.read() else {
            return LicenseStatusPayload::NotActivated {
                has_stored_key: self.has_stored_key(),
            };
        };
        match verify_machine_file(&cert, &config::verifying_key(), &self.fingerprint) {
            Ok(data) => LicenseStatusPayload::Licensed {
                expiry: data.expiry,
                entitlements: data.entitlements,
            },
            Err(e) => LicenseStatusPayload::Problem {
                problem: e.into(),
                has_stored_key: self.has_stored_key(),
            },
        }
    }

    /// Fail-soft FOR THIS BOOLEAN ONLY: a Keychain read error maps to `false`
    /// (the verify path itself stays fail-closed). The key string never
    /// crosses this boundary — only its presence.
    fn has_stored_key(&self) -> bool {
        matches!(self.keychain.get_key(), Ok(Some(_)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use keychain::KeychainError;

    /// Real CE-issued fixture (Plan 01) — the one cert that verifies against
    /// the real config pubkey, so the Licensed path needs no key injection.
    const REAL_CERT: &str = include_str!("../../fixtures/ce-machine.lic");
    const REAL_FP: &str = "b70ebcaf8c4684c767208ac8d656da87c7917a0141d5540f0196ec4d23bcf2a5";

    struct MockStore(Option<&'static str>);
    impl LicFileStore for MockStore {
        fn read(&self) -> Option<String> {
            self.0.map(str::to_string)
        }
        fn write_atomic(&self, _cert: &str) -> std::io::Result<()> {
            Ok(())
        }
        fn remove(&self) -> std::io::Result<()> {
            Ok(())
        }
    }

    enum MockKeychain {
        WithKey,
        Empty,
        Erroring,
    }
    impl KeychainAccess for MockKeychain {
        fn get_key(&self) -> Result<Option<String>, KeychainError> {
            match self {
                MockKeychain::WithKey => Ok(Some("KEY-AAAA-BBBB".into())),
                MockKeychain::Empty => Ok(None),
                MockKeychain::Erroring => Err(KeychainError::Access("denied".into())),
            }
        }
        fn set_key(&self, _key: &str) -> Result<(), KeychainError> {
            Ok(())
        }
        fn delete_key(&self) -> Result<(), KeychainError> {
            Ok(())
        }
    }

    fn manager(
        cert: Option<&'static str>,
        keychain: MockKeychain,
        fingerprint: &str,
    ) -> LicenseManager {
        LicenseManager::new(
            Box::new(MockStore(cert)),
            Box::new(keychain),
            fingerprint.to_string(),
        )
    }

    #[test]
    fn missing_file_resolves_to_not_activated_with_keychain_flag() {
        let status = manager(None, MockKeychain::WithKey, REAL_FP).resolve_status();
        assert_eq!(
            status,
            LicenseStatusPayload::NotActivated {
                has_stored_key: true
            }
        );
    }

    #[test]
    fn valid_cert_with_matching_fingerprint_resolves_to_licensed() {
        let status = manager(Some(REAL_CERT), MockKeychain::Empty, REAL_FP).resolve_status();
        assert_eq!(
            status,
            LicenseStatusPayload::Licensed {
                expiry: Some("2026-07-12T15:14:47.247Z".into()),
                entitlements: vec![],
            }
        );
    }

    #[test]
    fn corrupt_cert_resolves_to_problem_corrupt() {
        let status = manager(Some("garbage"), MockKeychain::WithKey, REAL_FP).resolve_status();
        assert_eq!(
            status,
            LicenseStatusPayload::Problem {
                problem: ProblemKind::Corrupt,
                has_stored_key: true,
            }
        );
    }

    #[test]
    fn valid_cert_with_wrong_fingerprint_resolves_to_foreign_machine() {
        let other_fp = "ffffeeeeddddccccffffeeeeddddccccffffeeeeddddccccffffeeeeddddcccc";
        let status = manager(Some(REAL_CERT), MockKeychain::Empty, other_fp).resolve_status();
        assert_eq!(
            status,
            LicenseStatusPayload::Problem {
                problem: ProblemKind::ForeignMachine,
                has_stored_key: false,
            }
        );
    }

    #[test]
    fn keychain_error_fails_soft_to_has_stored_key_false() {
        // Status itself is unaffected by the erroring keychain — only the boolean.
        let status = manager(None, MockKeychain::Erroring, REAL_FP).resolve_status();
        assert_eq!(
            status,
            LicenseStatusPayload::NotActivated {
                has_stored_key: false
            }
        );
        let status = manager(Some("garbage"), MockKeychain::Erroring, REAL_FP).resolve_status();
        assert_eq!(
            status,
            LicenseStatusPayload::Problem {
                problem: ProblemKind::Corrupt,
                has_stored_key: false,
            }
        );
    }

    // The TS contract for Plans 03/04 — exact camelCase JSON shapes, pinned.
    #[test]
    fn serde_json_shapes_are_the_pinned_ts_contract() {
        assert_eq!(
            serde_json::to_string(&LicenseStatusPayload::NotActivated {
                has_stored_key: false
            })
            .unwrap(),
            r#"{"state":"notActivated","hasStoredKey":false}"#
        );
        assert_eq!(
            serde_json::to_string(&LicenseStatusPayload::Licensed {
                expiry: Some("2026-07-12T15:14:47.247Z".into()),
                entitlements: vec!["pro.theming".into()],
            })
            .unwrap(),
            r#"{"state":"licensed","expiry":"2026-07-12T15:14:47.247Z","entitlements":["pro.theming"]}"#
        );
        assert_eq!(
            serde_json::to_string(&LicenseStatusPayload::Problem {
                problem: ProblemKind::ForeignMachine,
                has_stored_key: false,
            })
            .unwrap(),
            r#"{"state":"problem","problem":"foreignMachine","hasStoredKey":false}"#
        );
        // Remaining ProblemKind spellings.
        for (kind, expected) in [
            (ProblemKind::Corrupt, "\"corrupt\""),
            (ProblemKind::Tampered, "\"tampered\""),
            (ProblemKind::UnsupportedAlg, "\"unsupportedAlg\""),
        ] {
            assert_eq!(serde_json::to_string(&kind).unwrap(), expected);
        }
    }
}
