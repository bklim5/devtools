//! machine.lic on-disk storage: read + atomic write in the app data dir.
//!
//! Behind a trait so the status path is testable with an in-memory mock; the
//! real impl is dir-injected (Plan 03 passes `app.path().app_data_dir()` =
//! `~/Library/Application Support/com.tinkerdev.app/`).

use std::path::PathBuf;

const LIC_FILE: &str = "machine.lic";
const LIC_TMP: &str = "machine.lic.tmp";

pub trait LicFileStore {
    /// Read the stored certificate. `None` = not activated (missing file is a
    /// normal state, not an error); unreadable files also map to `None` —
    /// the fail-closed direction (resolves to NotActivated, never licensed).
    fn read(&self) -> Option<String>;
    /// Atomically replace the certificate: write `machine.lic.tmp` in the SAME
    /// directory, then rename over `machine.lic` (atomic on APFS same-volume).
    fn write_atomic(&self, cert: &str) -> std::io::Result<()>;
    /// Remove the certificate (deactivation). Missing file is Ok.
    fn remove(&self) -> std::io::Result<()>;
}

pub struct AppDataLicStore {
    dir: PathBuf,
}

impl AppDataLicStore {
    pub fn new(dir: PathBuf) -> Self {
        Self { dir }
    }
}

impl LicFileStore for AppDataLicStore {
    fn read(&self) -> Option<String> {
        std::fs::read_to_string(self.dir.join(LIC_FILE)).ok()
    }

    fn write_atomic(&self, cert: &str) -> std::io::Result<()> {
        std::fs::create_dir_all(&self.dir)?;
        let tmp = self.dir.join(LIC_TMP);
        std::fs::write(&tmp, cert)?;
        std::fs::rename(&tmp, self.dir.join(LIC_FILE))
    }

    fn remove(&self) -> std::io::Result<()> {
        match std::fs::remove_file(self.dir.join(LIC_FILE)) {
            Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(e),
            _ => Ok(()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Unique tempdir per test without the tempfile crate.
    fn temp_store(tag: &str) -> AppDataLicStore {
        let dir = std::env::temp_dir().join(format!(
            "devtools-lic-store-test-{}-{}",
            std::process::id(),
            tag
        ));
        let _ = std::fs::remove_dir_all(&dir);
        AppDataLicStore::new(dir)
    }

    #[test]
    fn atomic_write_round_trips_and_leaves_no_tmp_file() {
        let store = temp_store("roundtrip");
        let cert = "-----BEGIN MACHINE FILE-----\nabc\n-----END MACHINE FILE-----";
        store.write_atomic(cert).expect("write must succeed");
        assert_eq!(store.read().as_deref(), Some(cert));
        assert!(
            !store.dir.join(LIC_TMP).exists(),
            "a .tmp file must never survive a successful write"
        );
        let _ = std::fs::remove_dir_all(&store.dir);
    }

    #[test]
    fn read_of_missing_file_is_none_not_an_error() {
        let store = temp_store("missing");
        assert_eq!(store.read(), None);
    }

    #[test]
    fn remove_is_ok_when_file_missing_and_removes_when_present() {
        let store = temp_store("remove");
        store.remove().expect("remove of missing file is Ok");
        store.write_atomic("cert").unwrap();
        store.remove().expect("remove of existing file is Ok");
        assert_eq!(store.read(), None);
        let _ = std::fs::remove_dir_all(&store.dir);
    }
}
