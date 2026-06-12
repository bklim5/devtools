//! Machine fingerprint (LIC-01): `hex(HMAC-SHA256(key = APP_SALT, msg = IOPlatformUUID))`.
//!
//! Privacy invariant (T-19-11): the raw IOPlatformUUID never leaves this module —
//! there is no public accessor for it; only the HMAC hex digest is ever exposed.
//!
//! NORMALIZATION LOCK (research assumption A5): the HMAC message is the UUID
//! string EXACTLY as `ioreg` prints it — uppercase, hyphenated, no trimming
//! beyond the surrounding quotes. Changing this normalization (lowercasing,
//! de-hyphenating, ...) after first release would change every fingerprint and
//! orphan every existing activation. Never change it.

use hmac::{Hmac, Mac};
use sha2::Sha256;

use super::config;

#[derive(Debug, thiserror::Error, PartialEq)]
pub enum FingerprintError {
    /// `ioreg` could not be spawned or produced non-UTF-8 output.
    #[error("failed to read IORegistry: {0}")]
    Io(String),
    /// The ioreg output contains no IOPlatformUUID line.
    #[error("IOPlatformUUID not found in ioreg output")]
    NotFound,
}

/// Pure parser: extract the IOPlatformUUID value from `ioreg -rd1 -c
/// IOPlatformExpertDevice` output. Pattern source-verified from machineid-rs:
/// find the line containing `IOPlatformUUID`, split on `=`, trim whitespace and
/// surrounding quotes.
fn parse_io_platform_uuid(ioreg_output: &str) -> Result<String, FingerprintError> {
    ioreg_output
        .lines()
        .find(|l| l.contains("IOPlatformUUID"))
        .and_then(|l| l.split('=').nth(1))
        .map(|s| s.trim().trim_matches('"').to_string())
        .filter(|s| !s.is_empty())
        .ok_or(FingerprintError::NotFound)
}

/// Pure HMAC step: lowercase-hex HMAC-SHA256 of the verbatim UUID string,
/// keyed with the given salt. Split out so tests can pin a known vector
/// without touching `ioreg` or the committed APP_SALT.
fn hmac_fingerprint(salt: &[u8], uuid: &str) -> String {
    let mut mac =
        Hmac::<Sha256>::new_from_slice(salt).expect("HMAC-SHA256 accepts any key length");
    mac.update(uuid.as_bytes());
    hex::encode(mac.finalize().into_bytes())
}

/// I/O wrapper: read the machine's IOPlatformUUID via `ioreg` and HMAC it with
/// the committed [`config::APP_SALT`]. Returns the 64-char lowercase hex
/// fingerprint. Only exercised by the real app — unit tests cover the pure
/// parser and HMAC halves.
pub fn machine_fingerprint() -> Result<String, FingerprintError> {
    let output = std::process::Command::new("ioreg")
        .args(["-rd1", "-c", "IOPlatformExpertDevice"])
        .output()
        .map_err(|e| FingerprintError::Io(e.to_string()))?;
    let text =
        String::from_utf8(output.stdout).map_err(|e| FingerprintError::Io(e.to_string()))?;
    let uuid = parse_io_platform_uuid(&text)?;
    Ok(hmac_fingerprint(config::APP_SALT, &uuid))
}

#[cfg(test)]
mod tests {
    use super::*;

    // Precomputed once via:
    //   printf '264D91D9-3A3A-4DF6-9F2E-9B7C5C51F3A1' | openssl dgst -sha256 \
    //     -hmac 'e14f0d1630565bf022fe7d40de2aeceefb254a01151d3df397489335b4e45c75'
    #[test]
    fn hmac_fingerprint_matches_known_openssl_vector() {
        let salt = b"e14f0d1630565bf022fe7d40de2aeceefb254a01151d3df397489335b4e45c75";
        let uuid = "264D91D9-3A3A-4DF6-9F2E-9B7C5C51F3A1";
        assert_eq!(
            hmac_fingerprint(salt, uuid),
            "937b82f67b4e8624d8c24920b3a9d33970e98ccf81c6e8423c910f5deff8f839"
        );
    }

    #[test]
    fn parses_uuid_from_canned_ioreg_transcript() {
        let transcript = concat!(
            "+-o J316sAP  <class IOPlatformExpertDevice, id 0x100000111, registered, matched, active, busy 0 (12 ms), retain 38>\n",
            "  {\n",
            "    \"IOInterruptSpecifiers\" = (<deadbeef>)\n",
            "    \"IOPlatformUUID\" = \"264D91D9-3A3A-4DF6-9F2E-9B7C5C51F3A1\"\n",
            "    \"serial-number\" = <0011223344>\n",
            "    \"IOPlatformSerialNumber\" = \"C02XXXXXXX\"\n",
            "  }\n",
        );
        assert_eq!(
            parse_io_platform_uuid(transcript).unwrap(),
            "264D91D9-3A3A-4DF6-9F2E-9B7C5C51F3A1"
        );
    }

    #[test]
    fn parser_returns_not_found_without_uuid_line() {
        let transcript = "  {\n    \"IOPlatformSerialNumber\" = \"C02XXXXXXX\"\n  }\n";
        assert_eq!(
            parse_io_platform_uuid(transcript),
            Err(FingerprintError::NotFound)
        );
    }
}
