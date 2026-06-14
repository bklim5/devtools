//! License-key storage in the macOS Keychain (LIC-04), behind a trait.
//!
//! The raw license key lives ONLY here (D-42 SPIKE: key->token exchange is
//! denied on CE, so the key itself is the stored credential). It is Rust-owned:
//! no command ever returns it to the webview — JS only ever sees the
//! `has_stored_key` boolean in LicenseStatusPayload (T-19-10).
//!
//! Pitfall 5 (dev builds): each `tauri dev` rebuild is freshly ad-hoc-signed,
//! so the Keychain ACL no longer matches the item creator and macOS re-prompts
//! ("devtools-app wants to use your confidential information") across rebuilds.
//! Expected dev-time noise; the signed `tauri build` artifact has a stable
//! signature. Unit tests must NEVER construct [`MacKeychain`] — trait mocks
//! only (a test touching the real Keychain would prompt and flake).

use keyring::Entry;

/// Keychain service string, split by build profile (260614, mirrors config.rs
/// D-52). The bundle id `com.tinkerdev.app` (tauri.conf.json) is shared by dev
/// and release builds, so a single service let dev/e2e activity overwrite (and
/// e2e-spike preflight DELETE) the shipped buyer's item. A DEBUG build (incl.
/// `cargo test` + `tauri dev`) embeds the local-CE Ed25519 key (config.rs D-52),
/// so its license can only verify against the `.dev.license` item — isolating it
/// from the release `.license` item. The release arm is byte-identical to the
/// pre-260614 value, so shipped installs are unaffected.
#[cfg(debug_assertions)]
const SERVICE: &str = "com.tinkerdev.app.dev.license";
#[cfg(not(debug_assertions))]
const SERVICE: &str = "com.tinkerdev.app.license";
const USER: &str = "license-key";

#[derive(Debug, thiserror::Error, PartialEq, Eq, Clone)]
pub enum KeychainError {
    #[error("keychain access failed: {0}")]
    Access(String),
}

pub trait KeychainAccess {
    /// Read the stored license key. `Ok(None)` = no key stored (normal state).
    fn get_key(&self) -> Result<Option<String>, KeychainError>;
    fn set_key(&self, key: &str) -> Result<(), KeychainError>;
    fn delete_key(&self) -> Result<(), KeychainError>;
}

pub struct MacKeychain;

impl MacKeychain {
    fn entry() -> Result<Entry, KeychainError> {
        Entry::new(SERVICE, USER).map_err(|e| KeychainError::Access(e.to_string()))
    }
}

impl KeychainAccess for MacKeychain {
    fn get_key(&self) -> Result<Option<String>, KeychainError> {
        match Self::entry()?.get_password() {
            Ok(key) => Ok(Some(key)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(KeychainError::Access(e.to_string())),
        }
    }

    fn set_key(&self, key: &str) -> Result<(), KeychainError> {
        Self::entry()?
            .set_password(key)
            .map_err(|e| KeychainError::Access(e.to_string()))
    }

    fn delete_key(&self) -> Result<(), KeychainError> {
        match Self::entry()?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(KeychainError::Access(e.to_string())),
        }
    }
}
