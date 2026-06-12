//! Typed Keygen HTTP client (LIC-01/02): the 3 activation calls + machine
//! delete, against the exact endpoints/payloads proven live in
//! 19-SPIKE-OUTCOME.md.
//!
//! Architecture: PURE response-parsing functions (`parse_*` — the cargo-test
//! targets, exercised with canned JSON, never a socket) are separated from the
//! thin async transport methods that call them. Branching is ALWAYS on HTTP
//! status + the JSON:API `code` field — never on `detail`/`title` prose
//! (anti-pattern: those strings are not contractual).
//!
//! D-38: transport failures are classified in Rust (single source of truth)
//! into `Offline` vs `ServiceUnreachable` — see [`classify_transport_error`].

use std::time::Duration;

use super::config;

/// JSON:API media type — mirrors the headers the live spike used verbatim.
const JSON_API: &str = "application/vnd.api+json";

/// The exact seat-limit `code` recorded verbatim in 19-SPIKE-OUTCOME.md (A1).
const SEAT_LIMIT_CODE: &str = "MACHINE_LIMIT_EXCEEDED";

// ---------------------------------------------------------------------------
// Error contract (D-36/D-37/D-38)
// ---------------------------------------------------------------------------

/// Typed license errors. Serializes for the Tauri command Err arm as
/// `{"code": "<camelCase>"}` — the copy that renders these lives in the
/// webview (Plan 04); Rust never sends prose.
#[derive(Debug, thiserror::Error, PartialEq, Eq, Clone, Copy)]
pub enum LicenseError {
    /// Seat taken on another machine — from validate's
    /// FINGERPRINT_SCOPE_MISMATCH or the 422 machine-limit error (D-36).
    #[error("license seat is already in use on another machine")]
    SeatLimit,
    /// OS-level network-down: no route to anywhere (D-38).
    #[error("no network connection")]
    Offline,
    /// Network is up but the licensing service did not answer (D-38).
    #[error("licensing service unreachable")]
    ServiceUnreachable,
    /// Key rejected: unknown to the server, or empty after trim (D-39).
    #[error("license key is not valid")]
    InvalidKey,
    /// Calm terminal license states: SUSPENDED / BANNED / EXPIRED.
    #[error("license is suspended or expired")]
    Suspended,
    /// Catch-all server/protocol failure (unexpected status, malformed body,
    /// configuration errors like the 403 policy pitfall).
    #[error("activation failed")]
    ActivationFailed,
    /// activate(None) with nothing in the Keychain (D-44 path precondition).
    #[error("no stored license key")]
    NoStoredKey,
    /// A locally-held machine.lic failed verification when one was required
    /// (refresh with a corrupt cache, or a checkout cert that fails verify).
    #[error("stored license file failed verification")]
    LicenseProblem,
}

impl LicenseError {
    /// The serialized contract string — the webview's copy layer keys on these.
    pub fn code(&self) -> &'static str {
        match self {
            LicenseError::SeatLimit => "seatLimit",
            LicenseError::Offline => "offline",
            LicenseError::ServiceUnreachable => "serviceUnreachable",
            LicenseError::InvalidKey => "invalidKey",
            LicenseError::Suspended => "suspended",
            LicenseError::ActivationFailed => "activationFailed",
            LicenseError::NoStoredKey => "noStoredKey",
            LicenseError::LicenseProblem => "licenseProblem",
        }
    }
}

/// Tauri command errors must Serialize; the wire shape is `{"code": "..."}`.
impl serde::Serialize for LicenseError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeStruct;
        let mut s = serializer.serialize_struct("LicenseError", 1)?;
        s.serialize_field("code", self.code())?;
        s.end()
    }
}

// ---------------------------------------------------------------------------
// Validate-key outcome (Pitfall 3: branch on meta.code, NEVER meta.valid)
// ---------------------------------------------------------------------------

/// Non-terminal validate-key outcomes the activation state machine branches on.
/// Terminal states (NOT_FOUND, SUSPENDED, ...) come back as `Err(LicenseError)`
/// directly from [`parse_validate_response`].
#[derive(Debug, PartialEq, Eq, Clone)]
pub enum ValidateOutcome {
    /// NO_MACHINE / NO_MACHINES: expected first-activation state — proceed to
    /// machine creation. `valid:false` here is NORMAL (Pitfall 3).
    NotYetActivated { license_id: String },
    /// VALID: already activated on THIS machine — skip creation, go straight
    /// to checkout (idempotent re-activation, the D-44 recovery path).
    ActiveOnThisMachine { license_id: String },
    /// FINGERPRINT_SCOPE_MISMATCH: the seat is bound to a DIFFERENT machine.
    SeatTakenElsewhere,
}

// ---------------------------------------------------------------------------
// Wire-format serde structs (permissive: read only what we need)
// ---------------------------------------------------------------------------

#[derive(serde::Deserialize)]
struct ValidateResponse {
    meta: ValidateMeta,
    #[serde(default)]
    data: Option<ResourceId>,
}

#[derive(serde::Deserialize)]
struct ValidateMeta {
    #[serde(default)]
    code: Option<String>,
}

#[derive(serde::Deserialize)]
struct DocWithId {
    data: ResourceId,
}

#[derive(serde::Deserialize)]
struct ResourceId {
    id: String,
}

#[derive(serde::Deserialize, Default)]
struct ErrorsBody {
    #[serde(default)]
    errors: Vec<ApiError>,
}

#[derive(serde::Deserialize)]
struct ApiError {
    #[serde(default)]
    code: Option<String>,
}

#[derive(serde::Deserialize)]
struct CheckoutResponse {
    data: CheckoutData,
}

#[derive(serde::Deserialize)]
struct CheckoutData {
    attributes: CheckoutAttributes,
}

#[derive(serde::Deserialize)]
struct CheckoutAttributes {
    certificate: String,
}

// ---------------------------------------------------------------------------
// Pure response parsers (the unit-test surface — no network, no reqwest)
// ---------------------------------------------------------------------------

/// Parse `POST /licenses/actions/validate-key`. Branches on `meta.code` only
/// (Pitfall 3 — pre-activation responses carry `valid:false` + NO_MACHINE and
/// are the EXPECTED state, not a failure). `data` is null for NOT_FOUND.
pub fn parse_validate_response(status: u16, body: &str) -> Result<ValidateOutcome, LicenseError> {
    if status != 200 {
        return Err(LicenseError::ActivationFailed);
    }
    let resp: ValidateResponse =
        serde_json::from_str(body).map_err(|_| LicenseError::ActivationFailed)?;
    let license_id = || {
        resp.data
            .as_ref()
            .map(|d| d.id.clone())
            .ok_or(LicenseError::ActivationFailed)
    };
    match resp.meta.code.as_deref() {
        Some("VALID") => Ok(ValidateOutcome::ActiveOnThisMachine {
            license_id: license_id()?,
        }),
        // CE returned the singular form live; treat plural as equivalent.
        Some("NO_MACHINE") | Some("NO_MACHINES") => Ok(ValidateOutcome::NotYetActivated {
            license_id: license_id()?,
        }),
        Some("FINGERPRINT_SCOPE_MISMATCH") => Ok(ValidateOutcome::SeatTakenElsewhere),
        Some("NOT_FOUND") => Err(LicenseError::InvalidKey),
        Some("SUSPENDED") | Some("BANNED") | Some("EXPIRED") => Err(LicenseError::Suspended),
        _ => Err(LicenseError::ActivationFailed),
    }
}

/// Parse `POST /machines`. 201 → machine id; 422 with the exact
/// MACHINE_LIMIT_EXCEEDED code → SeatLimit; 403 → configuration error
/// (Pitfall 1: policy created without authenticationStrategy=LICENSE).
pub fn parse_create_machine_response(status: u16, body: &str) -> Result<String, LicenseError> {
    match status {
        201 => serde_json::from_str::<DocWithId>(body)
            .map(|d| d.data.id)
            .map_err(|_| LicenseError::ActivationFailed),
        422 => {
            let errs: ErrorsBody = serde_json::from_str(body).unwrap_or_default();
            if errs
                .errors
                .iter()
                .any(|e| e.code.as_deref() == Some(SEAT_LIMIT_CODE))
            {
                Err(LicenseError::SeatLimit)
            } else {
                Err(LicenseError::ActivationFailed)
            }
        }
        403 => {
            eprintln!(
                "license: machine activation returned 403 — the Keygen policy was likely \
                 created WITHOUT authenticationStrategy=LICENSE (Pitfall 1; recreate via \
                 scripts/keygen-ce/bootstrap.sh)"
            );
            Err(LicenseError::ActivationFailed)
        }
        _ => Err(LicenseError::ActivationFailed),
    }
}

/// Parse `POST /machines/{id}/actions/check-out` → the certificate text
/// (`-----BEGIN MACHINE FILE-----` …) extracted verbatim.
pub fn parse_checkout_response(status: u16, body: &str) -> Result<String, LicenseError> {
    if status != 200 {
        return Err(LicenseError::ActivationFailed);
    }
    serde_json::from_str::<CheckoutResponse>(body)
        .map(|r| r.data.attributes.certificate)
        .map_err(|_| LicenseError::ActivationFailed)
}

/// Parse `DELETE /machines/{id}` → 204 is the only success.
pub fn parse_delete_response(status: u16) -> Result<(), LicenseError> {
    if status == 204 {
        Ok(())
    } else {
        Err(LicenseError::ActivationFailed)
    }
}

// ---------------------------------------------------------------------------
// D-38 transport-error classification (single source of truth, in Rust)
// ---------------------------------------------------------------------------

/// Walk an error chain looking for an OS-level "the network itself is down"
/// io error. Anything else — connection refused, timeout, TLS failure against
/// a resolvable host, or an ambiguous chain — defaults to ServiceUnreachable
/// (the more actionable message; research A4: reqwest's DNS errors are not
/// introspectable enough to distinguish no-network DNS failure reliably, so
/// the ambiguous residual deliberately lands on ServiceUnreachable).
fn classify_error_chain(root: &(dyn std::error::Error + 'static)) -> LicenseError {
    let mut current: Option<&(dyn std::error::Error + 'static)> = Some(root);
    while let Some(err) = current {
        if let Some(io) = err.downcast_ref::<std::io::Error>() {
            use std::io::ErrorKind as K;
            match io.kind() {
                K::NetworkUnreachable | K::NetworkDown | K::HostUnreachable => {
                    return LicenseError::Offline;
                }
                _ => {}
            }
        }
        current = err.source();
    }
    LicenseError::ServiceUnreachable
}

/// D-38: classify a reqwest transport error into Offline vs ServiceUnreachable.
pub fn classify_transport_error(e: &reqwest::Error) -> LicenseError {
    if e.is_timeout() {
        // A timeout means packets went somewhere — the service, not the
        // network, is the problem.
        return LicenseError::ServiceUnreachable;
    }
    classify_error_chain(e)
}

// ---------------------------------------------------------------------------
// Transport (built once; NEVER constructed by unit tests)
// ---------------------------------------------------------------------------

/// Keygen HTTP client. One `reqwest::Client` (15s timeout) for the 4 calls;
/// every method delegates response handling to the pure parsers above.
pub struct KeygenClient {
    http: reqwest::Client,
    base_url: String,
}

fn build_http_client() -> reqwest::Client {
    let builder = reqwest::Client::builder().timeout(Duration::from_secs(15));
    // Dev-only TLS trust for the local Keygen CE behind Caddy `tls internal`
    // (T-19-16). DOUBLE-GATED — the same idiom as the webdriver plugin in
    // lib.rs: the code path exists ONLY in debug builds
    // (`#[cfg(debug_assertions)]`), AND only acts when DEVTOOLS_KEYGEN_CA is
    // set at runtime (path to scripts/keygen-ce/caddy-root.crt). A release
    // (non-debug) build compiles this block out entirely, so no environment
    // variable can weaken release TLS.
    #[cfg(debug_assertions)]
    let builder = match std::env::var("DEVTOOLS_KEYGEN_CA") {
        Ok(path) => {
            let cert = std::fs::read(&path)
                .map_err(|e| e.to_string())
                .and_then(|pem| {
                    reqwest::Certificate::from_pem(&pem).map_err(|e| e.to_string())
                });
            match cert {
                Ok(cert) => builder.add_root_certificate(cert),
                Err(e) => {
                    eprintln!(
                        "license: DEVTOOLS_KEYGEN_CA at {path} unusable ({e}) — \
                         continuing with default roots"
                    );
                    builder
                }
            }
        }
        Err(_) => builder,
    };
    builder
        .build()
        .expect("static reqwest client configuration must build")
}

/// Machine display name for `POST /machines`: the hostname, or "Mac" when the
/// `hostname` binary is unavailable/garbled (the name is cosmetic — the
/// fingerprint is the identity).
fn machine_name() -> String {
    std::process::Command::new("hostname")
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "Mac".to_string())
}

impl KeygenClient {
    pub fn new() -> Self {
        Self {
            http: build_http_client(),
            base_url: format!(
                "https://{}/v1/accounts/{}",
                config::KEYGEN_HOST,
                config::KEYGEN_ACCOUNT_ID
            ),
        }
    }

    /// Send with the JSON:API headers the live spike used; map transport
    /// failures through the D-38 classifier; return (status, body) for the
    /// pure parsers.
    async fn send(&self, req: reqwest::RequestBuilder) -> Result<(u16, String), LicenseError> {
        let resp = req
            .header(reqwest::header::CONTENT_TYPE, JSON_API)
            .header(reqwest::header::ACCEPT, JSON_API)
            .send()
            .await
            .map_err(|e| classify_transport_error(&e))?;
        let status = resp.status().as_u16();
        let body = resp
            .text()
            .await
            .map_err(|e| classify_transport_error(&e))?;
        Ok((status, body))
    }

    /// Call 1 — UNAUTHENTICATED validate (the key in the body IS the
    /// credential). The response carries `data.id` (license id) so no extra
    /// lookup call is needed.
    pub async fn validate_key(
        &self,
        key: &str,
        fingerprint: &str,
    ) -> Result<ValidateOutcome, LicenseError> {
        let body =
            serde_json::json!({ "meta": { "key": key, "scope": { "fingerprint": fingerprint } } });
        let url = format!("{}/licenses/actions/validate-key", self.base_url);
        let (status, text) = self.send(self.http.post(url).json(&body)).await?;
        parse_validate_response(status, &text)
    }

    /// Call 2 — activate this machine on the license (License-key auth).
    pub async fn create_machine(
        &self,
        key: &str,
        license_id: &str,
        fingerprint: &str,
    ) -> Result<String, LicenseError> {
        let body = serde_json::json!({
            "data": {
                "type": "machines",
                "attributes": {
                    "fingerprint": fingerprint,
                    "platform": "macOS",
                    "name": machine_name(),
                },
                "relationships": {
                    "license": { "data": { "type": "licenses", "id": license_id } }
                }
            }
        });
        let url = format!("{}/machines", self.base_url);
        let (status, text) = self
            .send(
                self.http
                    .post(url)
                    .json(&body)
                    .header(reqwest::header::AUTHORIZATION, format!("License {key}")),
            )
            .await?;
        parse_create_machine_response(status, &text)
    }

    /// Call 3 — checkout the signed machine file. Embeds license +
    /// entitlements (Phase 21 forward-compat); ttl = 2629746s (~30.44 days).
    /// Unencrypted is locked — the encrypt query param is never passed
    /// (verify.rs only supports "base64+ed25519").
    pub async fn checkout_machine_file(
        &self,
        key: &str,
        machine_id: &str,
    ) -> Result<String, LicenseError> {
        let url = format!(
            "{}/machines/{}/actions/check-out?include=license,license.entitlements&ttl=2629746",
            self.base_url, machine_id
        );
        let (status, text) = self
            .send(
                self.http
                    .post(url)
                    .header(reqwest::header::AUTHORIZATION, format!("License {key}")),
            )
            .await?;
        parse_checkout_response(status, &text)
    }

    /// Deactivate — DELETE the machine (License-key auth alone suffices,
    /// proven live: spike step h → 204).
    pub async fn delete_machine(&self, key: &str, machine_id: &str) -> Result<(), LicenseError> {
        let url = format!("{}/machines/{}", self.base_url, machine_id);
        let (status, _text) = self
            .send(
                self.http
                    .delete(url)
                    .header(reqwest::header::AUTHORIZATION, format!("License {key}")),
            )
            .await?;
        parse_delete_response(status)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Canned validate-key body in CE's live shape (data present, the normal
    /// case — NOT_FOUND nulls data and gets its own literal below).
    fn validate_body(code: &str) -> String {
        format!(
            r#"{{"meta":{{"ts":"2026-06-12T15:14:47.000Z","valid":false,"detail":"...","code":"{code}","scope":{{"fingerprint":"abc"}}}},"data":{{"id":"lic-123","type":"licenses","attributes":{{}}}}}}"#
        )
    }

    #[test]
    fn no_machine_parses_to_not_yet_activated_with_license_id() {
        for code in ["NO_MACHINE", "NO_MACHINES"] {
            assert_eq!(
                parse_validate_response(200, &validate_body(code)),
                Ok(ValidateOutcome::NotYetActivated {
                    license_id: "lic-123".into()
                }),
                "code {code} must be the expected first-activation state"
            );
        }
    }

    #[test]
    fn valid_parses_to_active_on_this_machine() {
        assert_eq!(
            parse_validate_response(200, &validate_body("VALID")),
            Ok(ValidateOutcome::ActiveOnThisMachine {
                license_id: "lic-123".into()
            })
        );
    }

    #[test]
    fn fingerprint_scope_mismatch_is_seat_taken_elsewhere() {
        assert_eq!(
            parse_validate_response(200, &validate_body("FINGERPRINT_SCOPE_MISMATCH")),
            Ok(ValidateOutcome::SeatTakenElsewhere)
        );
    }

    #[test]
    fn terminal_validate_codes_map_to_typed_errors() {
        // NOT_FOUND nulls `data` — the parser must not require an id there.
        let not_found = r#"{"meta":{"valid":false,"code":"NOT_FOUND","detail":"does not exist"},"data":null}"#;
        assert_eq!(
            parse_validate_response(200, not_found),
            Err(LicenseError::InvalidKey)
        );
        for code in ["SUSPENDED", "BANNED", "EXPIRED"] {
            assert_eq!(
                parse_validate_response(200, &validate_body(code)),
                Err(LicenseError::Suspended),
                "code {code} must be the calm Suspended terminal"
            );
        }
        // Unknown code → fail closed, never licensed.
        assert_eq!(
            parse_validate_response(200, &validate_body("SOME_FUTURE_CODE")),
            Err(LicenseError::ActivationFailed)
        );
        // Unexpected HTTP status → ActivationFailed.
        assert_eq!(
            parse_validate_response(500, &validate_body("VALID")),
            Err(LicenseError::ActivationFailed)
        );
    }

    #[test]
    fn machines_422_with_exact_limit_code_is_seat_limit() {
        // Byte-verbatim error body from 19-SPIKE-OUTCOME.md (key fields).
        let body = r#"{"errors":[{"title":"Unprocessable resource","detail":"machine count has exceeded maximum allowed for license (1)","code":"MACHINE_LIMIT_EXCEEDED","source":{"pointer":"/data"},"links":{"about":"https://keygen.sh/docs/api/machines/#machines-object"}}],"meta":{"id":"019ebc66-63bd-70e7-abce-b2843c6cf2b5"}}"#;
        assert_eq!(
            parse_create_machine_response(422, body),
            Err(LicenseError::SeatLimit)
        );
        // A different 422 code must NOT masquerade as seat-limit.
        let other = r#"{"errors":[{"title":"Unprocessable resource","code":"FINGERPRINT_TAKEN"}]}"#;
        assert_eq!(
            parse_create_machine_response(422, other),
            Err(LicenseError::ActivationFailed)
        );
    }

    #[test]
    fn machines_201_returns_machine_id_and_403_is_activation_failed() {
        let created = r#"{"data":{"id":"mach-456","type":"machines","attributes":{}}}"#;
        assert_eq!(
            parse_create_machine_response(201, created),
            Ok("mach-456".into())
        );
        // The spike's token-denial-shaped 403 body has NO code field.
        let denied = r#"{"meta":{"id":"x"},"errors":[{"title":"Access denied","detail":"You do not have permission to complete the request (license lacks permission to perform action)"}]}"#;
        assert_eq!(
            parse_create_machine_response(403, denied),
            Err(LicenseError::ActivationFailed)
        );
    }

    #[test]
    fn checkout_certificate_extracted_verbatim() {
        let cert = "-----BEGIN MACHINE FILE-----\nQUJDREVG\n-----END MACHINE FILE-----";
        let body = serde_json::json!({
            "data": {
                "type": "machines",
                "attributes": { "certificate": cert, "issued": "2026-06-12T15:14:47.247Z", "ttl": 2629746 }
            }
        })
        .to_string();
        assert_eq!(parse_checkout_response(200, &body), Ok(cert.to_string()));
        assert_eq!(
            parse_checkout_response(404, "{}"),
            Err(LicenseError::ActivationFailed)
        );
    }

    #[test]
    fn delete_204_is_ok_anything_else_fails() {
        assert_eq!(parse_delete_response(204), Ok(()));
        assert_eq!(parse_delete_response(404), Err(LicenseError::ActivationFailed));
        assert_eq!(parse_delete_response(403), Err(LicenseError::ActivationFailed));
    }

    // --- D-38 classification (the mapping logic over synthesized io kinds;
    // --- the reqwest::Error wrapper itself is not constructible in tests —
    // --- research A4 residual is exercised live in the Plan 04 walkthrough).

    /// Wrapper so the chain-walk (not just the root) is exercised.
    #[derive(Debug)]
    struct Wrap(std::io::Error);
    impl std::fmt::Display for Wrap {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            write!(f, "wrapped: {}", self.0)
        }
    }
    impl std::error::Error for Wrap {
        fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
            Some(&self.0)
        }
    }

    #[test]
    fn network_down_io_kinds_classify_as_offline() {
        use std::io::ErrorKind as K;
        for kind in [K::NetworkUnreachable, K::NetworkDown, K::HostUnreachable] {
            let err = Wrap(std::io::Error::new(kind, "no route"));
            assert_eq!(
                classify_error_chain(&err),
                LicenseError::Offline,
                "{kind:?} must classify as Offline"
            );
        }
    }

    #[test]
    fn reachable_host_failures_classify_as_service_unreachable() {
        use std::io::ErrorKind as K;
        for kind in [K::ConnectionRefused, K::ConnectionReset, K::TimedOut] {
            let err = Wrap(std::io::Error::new(kind, "refused"));
            assert_eq!(
                classify_error_chain(&err),
                LicenseError::ServiceUnreachable,
                "{kind:?} must classify as ServiceUnreachable"
            );
        }
    }

    #[test]
    fn ambiguous_chain_defaults_to_service_unreachable() {
        // A chain with no io::Error at all (e.g. a TLS error) → the more
        // actionable ServiceUnreachable (A4 documented default).
        #[derive(Debug)]
        struct Opaque;
        impl std::fmt::Display for Opaque {
            fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                write!(f, "opaque tls failure")
            }
        }
        impl std::error::Error for Opaque {}
        assert_eq!(
            classify_error_chain(&Opaque),
            LicenseError::ServiceUnreachable
        );
    }

    // --- Serialized error contract: the exact strings the webview keys on.

    #[test]
    fn every_error_variant_serializes_to_the_code_contract() {
        // The SeatLimit literal is the load-bearing acceptance assert.
        assert_eq!(
            serde_json::to_string(&LicenseError::SeatLimit).unwrap(),
            r#"{"code":"seatLimit"}"#
        );
        for (err, code) in [
            (LicenseError::Offline, "offline"),
            (LicenseError::ServiceUnreachable, "serviceUnreachable"),
            (LicenseError::InvalidKey, "invalidKey"),
            (LicenseError::Suspended, "suspended"),
            (LicenseError::ActivationFailed, "activationFailed"),
            (LicenseError::NoStoredKey, "noStoredKey"),
            (LicenseError::LicenseProblem, "licenseProblem"),
        ] {
            assert_eq!(
                serde_json::to_string(&err).unwrap(),
                format!(r#"{{"code":"{code}"}}"#)
            );
        }
    }
}
