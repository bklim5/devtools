//! Licensing core (Phase 19, LIC-01/02/03/04/06).
//!
//! Pure, cargo-testable modules plus the activation state machine. D-45: the
//! ONLY network calls live behind the [`LicenseApi`] client used by
//! `activate`/`refresh`/`deactivate` — `resolve_status` is pure-local and runs
//! at every launch with zero network.

pub mod commands;
pub mod config;
pub mod fingerprint;
pub mod keychain;
pub mod keygen_client;
pub mod store;
pub mod verify;

use keychain::KeychainAccess;
use keygen_client::{LicenseError, ValidateOutcome};
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

/// The Keygen API surface the activation state machine consumes. Native
/// async-fn-in-trait (Rust 1.75+); the manager is GENERIC over it (a
/// `Box<dyn>` would be dyn-incompatible with async fns) — production composes
/// `LicenseManager<KeygenClient>`, tests a scripted mock with zero network.
pub trait LicenseApi {
    fn validate_key(
        &self,
        key: &str,
        fingerprint: &str,
    ) -> impl std::future::Future<Output = Result<ValidateOutcome, LicenseError>> + Send;
    fn create_machine(
        &self,
        key: &str,
        license_id: &str,
        fingerprint: &str,
    ) -> impl std::future::Future<Output = Result<String, LicenseError>> + Send;
    fn checkout_machine_file(
        &self,
        key: &str,
        machine_id: &str,
    ) -> impl std::future::Future<Output = Result<String, LicenseError>> + Send;
    fn delete_machine(
        &self,
        key: &str,
        machine_id: &str,
    ) -> impl std::future::Future<Output = Result<(), LicenseError>> + Send;
}

impl LicenseApi for keygen_client::KeygenClient {
    // Inherent methods take resolution precedence inside the impl, so these
    // delegate to the real transport methods — no recursion.
    async fn validate_key(
        &self,
        key: &str,
        fingerprint: &str,
    ) -> Result<ValidateOutcome, LicenseError> {
        keygen_client::KeygenClient::validate_key(self, key, fingerprint).await
    }
    async fn create_machine(
        &self,
        key: &str,
        license_id: &str,
        fingerprint: &str,
    ) -> Result<String, LicenseError> {
        keygen_client::KeygenClient::create_machine(self, key, license_id, fingerprint).await
    }
    async fn checkout_machine_file(
        &self,
        key: &str,
        machine_id: &str,
    ) -> Result<String, LicenseError> {
        keygen_client::KeygenClient::checkout_machine_file(self, key, machine_id).await
    }
    async fn delete_machine(&self, key: &str, machine_id: &str) -> Result<(), LicenseError> {
        keygen_client::KeygenClient::delete_machine(self, key, machine_id).await
    }
}

/// Owns the licensing collaborators behind traits (mockable in tests). The
/// machine fingerprint is injected once at construction (computed at startup
/// in lib.rs) so `resolve_status` stays deterministic — it never shells out
/// to ioreg itself. An EMPTY fingerprint is the "fingerprint unavailable"
/// sentinel: it can never match a cert (Problem, fail-closed) and `activate`
/// refuses to run with it.
pub struct LicenseManager<C: LicenseApi> {
    store: Box<dyn LicFileStore + Send + Sync>,
    keychain: Box<dyn KeychainAccess + Send + Sync>,
    client: C,
    fingerprint: String,
}

impl<C: LicenseApi> LicenseManager<C> {
    pub fn new(
        store: Box<dyn LicFileStore + Send + Sync>,
        keychain: Box<dyn KeychainAccess + Send + Sync>,
        client: C,
        fingerprint: String,
    ) -> Self {
        Self {
            store,
            keychain,
            client,
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

    /// LIC-01 activation state machine (the phase's ONLY user-triggerable
    /// network path, D-45): resolve key -> validate -> (create machine if
    /// needed) -> checkout -> LOCAL VERIFY -> atomic write + Keychain store.
    ///
    /// `key: None` = D-44 stored-key reactivation (Rust reads the Keychain;
    /// the key never round-trips through JS — LIC-04).
    ///
    /// No-partial-success invariant (T-19-18): machine.lic and the Keychain
    /// are written ONLY after the checkout certificate passes local Ed25519
    /// verification — never trust the network blob blind (T-19-15).
    pub async fn activate(
        &mut self,
        key: Option<String>,
    ) -> Result<LicenseStatusPayload, LicenseError> {
        if self.fingerprint.is_empty() {
            // Startup fingerprint failure sentinel — activating would bind a
            // junk identity server-side. Fail typed, no network.
            return Err(LicenseError::ActivationFailed);
        }
        // D-39: trim/normalize whitespace only — no format regex; any
        // non-empty key goes to the server (it is the seat authority).
        let key = match key {
            Some(k) => {
                let k = k.trim().to_string();
                if k.is_empty() {
                    return Err(LicenseError::InvalidKey);
                }
                k
            }
            None => self
                .keychain
                .get_key()
                .map_err(|_| LicenseError::NoStoredKey)?
                .ok_or(LicenseError::NoStoredKey)?,
        };

        let machine_id = match self.client.validate_key(&key, &self.fingerprint).await? {
            // D-36: seat bound to a DIFFERENT machine — typed, calm, terminal.
            ValidateOutcome::SeatTakenElsewhere => return Err(LicenseError::SeatLimit),
            // D-44 idempotent re-activation: this machine already holds the
            // seat — skip creation, go straight to checkout. Keygen machine
            // routes accept the URL-safe fingerprint as the machine
            // identifier (no machine UUID is in the validate response, and
            // the fingerprint IS this machine's identity).
            ValidateOutcome::ActiveOnThisMachine { .. } => self.fingerprint.clone(),
            ValidateOutcome::NotYetActivated { license_id } => {
                self.client
                    .create_machine(&key, &license_id, &self.fingerprint)
                    .await?
            }
        };

        let cert = self.client.checkout_machine_file(&key, &machine_id).await?;
        self.verify_then_persist(&cert, Some(&key))
    }

    /// LIC-05 primitive (callable now; UI wiring is Phase 21): stored key ->
    /// checkout against the EXISTING machine -> atomic rewrite. The current
    /// machine.lic must verify locally first — it proves which machine this
    /// is refreshing (its fingerprint is the machine identifier on Keygen's
    /// machine routes).
    pub async fn refresh(&mut self) -> Result<LicenseStatusPayload, LicenseError> {
        let key = self.stored_key()?;
        let current = self.store.read().ok_or(LicenseError::LicenseProblem)?;
        let current_data =
            verify_machine_file(&current, &config::verifying_key(), &self.fingerprint)
                .map_err(|_| LicenseError::LicenseProblem)?;
        let cert = self
            .client
            .checkout_machine_file(&key, &current_data.fingerprint)
            .await?;
        self.verify_then_persist(&cert, None)
    }

    /// LIC-07 primitive (callable-but-unwired this phase): delete the machine
    /// server-side, then clear the local cert AND the stored key.
    pub async fn deactivate(&mut self) -> Result<LicenseStatusPayload, LicenseError> {
        let key = self.stored_key()?;
        // The machine identifier is this machine's fingerprint — the only
        // machine this app ever activates (a verified machine.lic's
        // fingerprint is identical by construction).
        self.client.delete_machine(&key, &self.fingerprint).await?;
        self.store.remove().map_err(|_| LicenseError::ActivationFailed)?;
        self.keychain
            .delete_key()
            .map_err(|_| LicenseError::ActivationFailed)?;
        Ok(LicenseStatusPayload::NotActivated {
            has_stored_key: false,
        })
    }

    /// Shared write-after-verify tail (T-19-15/T-19-18): the cert must pass
    /// local verification BEFORE machine.lic or the Keychain is touched; the
    /// Licensed payload is built from the freshly verified dataset.
    fn verify_then_persist(
        &mut self,
        cert: &str,
        store_key: Option<&str>,
    ) -> Result<LicenseStatusPayload, LicenseError> {
        let data = verify_machine_file(cert, &config::verifying_key(), &self.fingerprint)
            .map_err(|_| LicenseError::LicenseProblem)?;
        self.store
            .write_atomic(cert)
            .map_err(|_| LicenseError::ActivationFailed)?;
        if let Some(key) = store_key {
            // Raw key in the Keychain — SPIKE outcome D-42 (token exchange
            // denied); stored only AFTER the cert proves the activation.
            self.keychain
                .set_key(key)
                .map_err(|_| LicenseError::ActivationFailed)?;
        }
        Ok(LicenseStatusPayload::Licensed {
            expiry: data.expiry,
            entitlements: data.entitlements,
        })
    }

    fn stored_key(&self) -> Result<String, LicenseError> {
        self.keychain
            .get_key()
            .map_err(|_| LicenseError::NoStoredKey)?
            .ok_or(LicenseError::NoStoredKey)
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
    use std::sync::{Arc, Mutex};

    /// Real CE-issued fixture (Plan 01) — the one cert that verifies against
    /// the real config pubkey, so Licensed paths need no key injection.
    const REAL_CERT: &str = include_str!("../../fixtures/ce-machine.lic");
    const REAL_FP: &str = "b70ebcaf8c4684c767208ac8d656da87c7917a0141d5540f0196ec4d23bcf2a5";

    // --- Pure-local status mocks (no client involvement) -------------------

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

    /// Client for pure-local tests: any call is a D-45 violation and panics.
    struct NoNetwork;
    impl LicenseApi for NoNetwork {
        async fn validate_key(
            &self,
            _key: &str,
            _fp: &str,
        ) -> Result<ValidateOutcome, LicenseError> {
            panic!("D-45 violation: resolve_status must never touch the network")
        }
        async fn create_machine(
            &self,
            _key: &str,
            _lid: &str,
            _fp: &str,
        ) -> Result<String, LicenseError> {
            panic!("D-45 violation: resolve_status must never touch the network")
        }
        async fn checkout_machine_file(
            &self,
            _key: &str,
            _mid: &str,
        ) -> Result<String, LicenseError> {
            panic!("D-45 violation: resolve_status must never touch the network")
        }
        async fn delete_machine(&self, _key: &str, _mid: &str) -> Result<(), LicenseError> {
            panic!("D-45 violation: resolve_status must never touch the network")
        }
    }

    fn manager(
        cert: Option<&'static str>,
        keychain: MockKeychain,
        fingerprint: &str,
    ) -> LicenseManager<NoNetwork> {
        LicenseManager::new(
            Box::new(MockStore(cert)),
            Box::new(keychain),
            NoNetwork,
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

    // =======================================================================
    // Activation state machine (mocked client + recording store/keychain —
    // no network, no real Keychain, no fs)
    // =======================================================================

    /// Shared recording handles (Arc so the test keeps a view after the boxes
    /// move into the manager).
    #[derive(Default, Clone)]
    struct Recorder {
        cert_writes: Arc<Mutex<Vec<String>>>,
        store_removed: Arc<Mutex<bool>>,
        key_sets: Arc<Mutex<Vec<String>>>,
        key_deleted: Arc<Mutex<bool>>,
        client_calls: Arc<Mutex<Vec<String>>>,
    }

    struct RecStore {
        cert: Option<String>,
        rec: Recorder,
    }
    impl LicFileStore for RecStore {
        fn read(&self) -> Option<String> {
            self.cert.clone()
        }
        fn write_atomic(&self, cert: &str) -> std::io::Result<()> {
            self.rec.cert_writes.lock().unwrap().push(cert.to_string());
            Ok(())
        }
        fn remove(&self) -> std::io::Result<()> {
            *self.rec.store_removed.lock().unwrap() = true;
            Ok(())
        }
    }

    struct RecKeychain {
        stored: Option<String>,
        rec: Recorder,
    }
    impl KeychainAccess for RecKeychain {
        fn get_key(&self) -> Result<Option<String>, KeychainError> {
            Ok(self.stored.clone())
        }
        fn set_key(&self, key: &str) -> Result<(), KeychainError> {
            self.rec.key_sets.lock().unwrap().push(key.to_string());
            Ok(())
        }
        fn delete_key(&self) -> Result<(), KeychainError> {
            *self.rec.key_deleted.lock().unwrap() = true;
            Ok(())
        }
    }

    /// Scripted client: fixed responses per call, every call recorded with
    /// the key it received (so stored-key reactivation is provable).
    struct ScriptedClient {
        validate: Result<ValidateOutcome, LicenseError>,
        create: Result<String, LicenseError>,
        checkout: Result<String, LicenseError>,
        delete: Result<(), LicenseError>,
        rec: Recorder,
    }
    impl ScriptedClient {
        fn happy(rec: &Recorder) -> Self {
            Self {
                validate: Ok(ValidateOutcome::NotYetActivated {
                    license_id: "lic-123".into(),
                }),
                create: Ok("mach-456".into()),
                checkout: Ok(REAL_CERT.to_string()),
                delete: Ok(()),
                rec: rec.clone(),
            }
        }
    }
    impl LicenseApi for ScriptedClient {
        async fn validate_key(
            &self,
            key: &str,
            _fp: &str,
        ) -> Result<ValidateOutcome, LicenseError> {
            self.rec
                .client_calls
                .lock()
                .unwrap()
                .push(format!("validate({key})"));
            self.validate.clone()
        }
        async fn create_machine(
            &self,
            key: &str,
            license_id: &str,
            _fp: &str,
        ) -> Result<String, LicenseError> {
            self.rec
                .client_calls
                .lock()
                .unwrap()
                .push(format!("create({key},{license_id})"));
            self.create.clone()
        }
        async fn checkout_machine_file(
            &self,
            key: &str,
            machine_id: &str,
        ) -> Result<String, LicenseError> {
            self.rec
                .client_calls
                .lock()
                .unwrap()
                .push(format!("checkout({key},{machine_id})"));
            self.checkout.clone()
        }
        async fn delete_machine(&self, key: &str, machine_id: &str) -> Result<(), LicenseError> {
            self.rec
                .client_calls
                .lock()
                .unwrap()
                .push(format!("delete({key},{machine_id})"));
            self.delete.clone()
        }
    }

    fn scripted_manager(
        cert: Option<&str>,
        stored_key: Option<&str>,
        client: ScriptedClient,
        rec: &Recorder,
    ) -> LicenseManager<ScriptedClient> {
        LicenseManager::new(
            Box::new(RecStore {
                cert: cert.map(str::to_string),
                rec: rec.clone(),
            }),
            Box::new(RecKeychain {
                stored: stored_key.map(str::to_string),
                rec: rec.clone(),
            }),
            client,
            REAL_FP.to_string(),
        )
    }

    fn block_on<F: std::future::Future>(fut: F) -> F::Output {
        tauri::async_runtime::block_on(fut)
    }

    #[test]
    fn activate_happy_path_writes_cert_then_key_and_returns_licensed() {
        let rec = Recorder::default();
        let mut mgr = scripted_manager(None, None, ScriptedClient::happy(&rec), &rec);
        let status = block_on(mgr.activate(Some("KEY-1".into()))).expect("must activate");
        assert_eq!(
            status,
            LicenseStatusPayload::Licensed {
                expiry: Some("2026-07-12T15:14:47.247Z".into()),
                entitlements: vec![],
            }
        );
        assert_eq!(
            *rec.client_calls.lock().unwrap(),
            vec![
                "validate(KEY-1)",
                "create(KEY-1,lic-123)",
                "checkout(KEY-1,mach-456)"
            ]
        );
        assert_eq!(*rec.cert_writes.lock().unwrap(), vec![REAL_CERT.to_string()]);
        assert_eq!(*rec.key_sets.lock().unwrap(), vec!["KEY-1".to_string()]);
    }

    #[test]
    fn activate_when_already_active_skips_create_machine() {
        // D-44 idempotent re-activation: VALID -> straight to checkout, with
        // the fingerprint as the machine identifier.
        let rec = Recorder::default();
        let client = ScriptedClient {
            validate: Ok(ValidateOutcome::ActiveOnThisMachine {
                license_id: "lic-123".into(),
            }),
            ..ScriptedClient::happy(&rec)
        };
        let mut mgr = scripted_manager(None, None, client, &rec);
        block_on(mgr.activate(Some("KEY-1".into()))).expect("must re-activate");
        assert_eq!(
            *rec.client_calls.lock().unwrap(),
            vec![
                "validate(KEY-1)".to_string(),
                format!("checkout(KEY-1,{REAL_FP})")
            ],
            "create_machine must be skipped on the idempotent path"
        );
    }

    #[test]
    fn activate_seat_taken_elsewhere_errs_seat_limit_nothing_written() {
        let rec = Recorder::default();
        let client = ScriptedClient {
            validate: Ok(ValidateOutcome::SeatTakenElsewhere),
            ..ScriptedClient::happy(&rec)
        };
        let mut mgr = scripted_manager(None, None, client, &rec);
        assert_eq!(
            block_on(mgr.activate(Some("KEY-1".into()))),
            Err(LicenseError::SeatLimit)
        );
        assert!(rec.cert_writes.lock().unwrap().is_empty(), "no cert write");
        assert!(rec.key_sets.lock().unwrap().is_empty(), "keychain untouched");
    }

    #[test]
    fn activate_none_uses_the_stored_key() {
        // D-44 stored-key reactivation: the Keychain key drives the flow.
        let rec = Recorder::default();
        let mut mgr =
            scripted_manager(None, Some("STORED-KEY"), ScriptedClient::happy(&rec), &rec);
        block_on(mgr.activate(None)).expect("must activate with the stored key");
        assert_eq!(
            rec.client_calls.lock().unwrap()[0],
            "validate(STORED-KEY)",
            "the stored key must be the credential"
        );
    }

    #[test]
    fn activate_none_without_stored_key_errs_before_any_network_call() {
        let rec = Recorder::default();
        let mut mgr = scripted_manager(None, None, ScriptedClient::happy(&rec), &rec);
        assert_eq!(block_on(mgr.activate(None)), Err(LicenseError::NoStoredKey));
        assert!(
            rec.client_calls.lock().unwrap().is_empty(),
            "no network call may be attempted without a key"
        );
    }

    #[test]
    fn activate_empty_or_whitespace_key_is_invalid_key_without_network() {
        // D-39: trim only; empty-after-trim never reaches the server.
        for key in ["", "   ", "\t\n "] {
            let rec = Recorder::default();
            let mut mgr = scripted_manager(None, None, ScriptedClient::happy(&rec), &rec);
            assert_eq!(
                block_on(mgr.activate(Some(key.into()))),
                Err(LicenseError::InvalidKey)
            );
            assert!(rec.client_calls.lock().unwrap().is_empty());
        }
    }

    #[test]
    fn activate_trims_surrounding_whitespace_off_the_key() {
        let rec = Recorder::default();
        let mut mgr = scripted_manager(None, None, ScriptedClient::happy(&rec), &rec);
        block_on(mgr.activate(Some("  KEY-1  \n".into()))).expect("trimmed key must activate");
        assert_eq!(rec.client_calls.lock().unwrap()[0], "validate(KEY-1)");
        assert_eq!(*rec.key_sets.lock().unwrap(), vec!["KEY-1".to_string()]);
    }

    #[test]
    fn checkout_failure_after_machine_creation_writes_nothing() {
        // T-19-18: no partial-success state — machine created server-side but
        // checkout failed locally => neither machine.lic nor Keychain written.
        let rec = Recorder::default();
        let client = ScriptedClient {
            checkout: Err(LicenseError::ServiceUnreachable),
            ..ScriptedClient::happy(&rec)
        };
        let mut mgr = scripted_manager(None, None, client, &rec);
        assert_eq!(
            block_on(mgr.activate(Some("KEY-1".into()))),
            Err(LicenseError::ServiceUnreachable)
        );
        assert!(rec.cert_writes.lock().unwrap().is_empty());
        assert!(rec.key_sets.lock().unwrap().is_empty());
    }

    #[test]
    fn unverifiable_checkout_cert_writes_nothing() {
        // T-19-15: a MITM'd/garbled cert fails local Ed25519 verification
        // BEFORE any persistence.
        let rec = Recorder::default();
        let client = ScriptedClient {
            checkout: Ok("not a machine file".into()),
            ..ScriptedClient::happy(&rec)
        };
        let mut mgr = scripted_manager(None, None, client, &rec);
        assert_eq!(
            block_on(mgr.activate(Some("KEY-1".into()))),
            Err(LicenseError::LicenseProblem)
        );
        assert!(rec.cert_writes.lock().unwrap().is_empty());
        assert!(rec.key_sets.lock().unwrap().is_empty());
    }

    #[test]
    fn activate_with_empty_fingerprint_sentinel_fails_typed_without_network() {
        let rec = Recorder::default();
        let mut mgr = LicenseManager::new(
            Box::new(RecStore {
                cert: None,
                rec: rec.clone(),
            }),
            Box::new(RecKeychain {
                stored: None,
                rec: rec.clone(),
            }),
            ScriptedClient::happy(&rec),
            String::new(), // startup fingerprint-failure sentinel
        );
        assert_eq!(
            block_on(mgr.activate(Some("KEY-1".into()))),
            Err(LicenseError::ActivationFailed)
        );
        assert!(rec.client_calls.lock().unwrap().is_empty());
    }

    #[test]
    fn refresh_rewrites_the_cert_from_a_checkout_against_the_existing_machine() {
        let rec = Recorder::default();
        let mut mgr = scripted_manager(
            Some(REAL_CERT),
            Some("STORED-KEY"),
            ScriptedClient::happy(&rec),
            &rec,
        );
        let status = block_on(mgr.refresh()).expect("must refresh");
        assert!(matches!(status, LicenseStatusPayload::Licensed { .. }));
        assert_eq!(
            *rec.client_calls.lock().unwrap(),
            vec![format!("checkout(STORED-KEY,{REAL_FP})")],
            "refresh checks out against the existing machine identity, no validate/create"
        );
        assert_eq!(*rec.cert_writes.lock().unwrap(), vec![REAL_CERT.to_string()]);
    }

    #[test]
    fn deactivate_deletes_machine_then_clears_store_and_keychain() {
        let rec = Recorder::default();
        let mut mgr = scripted_manager(
            Some(REAL_CERT),
            Some("STORED-KEY"),
            ScriptedClient::happy(&rec),
            &rec,
        );
        let status = block_on(mgr.deactivate()).expect("must deactivate");
        assert_eq!(
            status,
            LicenseStatusPayload::NotActivated {
                has_stored_key: false
            }
        );
        assert_eq!(
            *rec.client_calls.lock().unwrap(),
            vec![format!("delete(STORED-KEY,{REAL_FP})")]
        );
        assert!(*rec.store_removed.lock().unwrap(), "machine.lic removed");
        assert!(*rec.key_deleted.lock().unwrap(), "Keychain key deleted");
    }
}
