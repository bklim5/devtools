---
phase: 19-license-activation-offline-verification
audited: 2026-06-12
threats_total: 26
threats_closed: 26
threats_open: 0
status: secured
---

# Phase 19 Security Audit — License Activation & Offline Verification

**Audited:** 2026-06-12
**Scope:** Threat registers from 19-01..19-04 PLAN.md (T-19-01..T-19-26)
**Result:** SECURED — 26/26 threats closed (22 mitigated + verified, 4 accepted + logged)
**threats_open:** 0

## Verification Method

Each threat verified by declared disposition: `mitigate` rows checked against
implemented code (grep/read of the cited files); `accept` rows logged in the
Accepted Risks register below. Implementation files were read-only — no code
was modified by this audit.

## Threat Verification — Mitigated (22)

| Threat ID | Category | Component | Evidence |
|-----------|----------|-----------|----------|
| T-19-01 | I | CE .env secrets | `.gitignore:45-48` ignores `scripts/keygen-ce/.env`, `caddy-root.crt`, `spike-transcript.log` (+ `!.env.example` negation); `git check-ignore` confirms all three; `git ls-files scripts/keygen-ce/` shows only template/scripts tracked; `.env.example` carries generation-command comments only, zero real secrets |
| T-19-02 | I | bootstrap/spike transcripts | `bootstrap.sh:23` and `spike.sh:27` source credentials from gitignored `.env` at runtime; no hardcoded token/password/key in either script; spike key passed via env/arg (`spike.sh:31`); raw transcript gitignored because validate-key echoes the key (`spike.sh:58-60` comment) |
| T-19-03 | T | curl -> CE TLS | Every curl in both scripts uses `--cacert "$CACERT"` (`bootstrap.sh:38,56`; `spike.sh:48`); both scripts hard-fail if the CA file is missing (`bootstrap.sh:31`, `spike.sh:36`); grep for `-k` in committed scripts: 0 matches |
| T-19-06 | T | forged/tampered machine.lic | `verify.rs:146-148` — `verify_strict` over literal `"machine/" + enc`; tests `flipped_byte_in_enc_is_tampered` + `foreign_keypair_cert_is_tampered` prove rejection |
| T-19-07 | S | copied machine.lic | `verify.rs:155-159` — constant-time fingerprint compare → `ForeignMachine`; tests `wrong_fingerprint_is_foreign_machine` + `valid_cert_with_wrong_fingerprint_resolves_to_foreign_machine` (mod.rs) |
| T-19-08 | T | algorithm confusion | `verify.rs:26,137-140` — exact `alg == "base64+ed25519"` gate, fail-closed `UnsupportedAlg`; test `encrypted_alg_is_unsupported` |
| T-19-09 | D | malformed cert panic/fail-open | `verify.rs:118-177` — every parse step maps to a typed `VerifyError`, zero `unwrap` on untrusted input; tests `truncated_body_is_corrupt`, `empty_and_garbage_input_are_corrupt` |
| T-19-10 | I | key reaching JS via status | `mod.rs:26-41` — `LicenseStatusPayload` carries only `has_stored_key: bool`; serde test `serde_json_shapes_are_the_pinned_ts_contract` pins exact JSON; no variant carries key material |
| T-19-11 | I | raw IOPlatformUUID exposure | `fingerprint.rs:31` — `parse_io_platform_uuid` is private; sole public fn `machine_fingerprint` (line 55) returns only `hex(HMAC-SHA256(salt, uuid))`; no public raw-UUID accessor |
| T-19-13 | T | keyring v4 / missing apple-native | `Cargo.toml:53` — `keyring = { version = "3.6", features = ["apple-native"] }` with pin-rationale comment (lines 46-50) |
| T-19-14 | I | key crossing to JS | `commands.rs` — all 4 commands return `LicenseStatusPayload` / `{code}` errors only; `activate_license` accepts a key, nothing returns one; `LicenseError::serialize` (keygen_client.rs:79-86) emits only `{"code":"..."}` |
| T-19-15 | T | MITM on activation | reqwest rustls default validation (`Cargo.toml:65`, default-features off); `mod.rs:279-301` `verify_then_persist` — checkout cert Ed25519-verified locally before any write; test `unverifiable_checkout_cert_writes_nothing` |
| T-19-16 | T | dev CA weakening release TLS | `keygen_client.rs:304-336` — the ENTIRE `DEVTOOLS_KEYGEN_CA` match expression (including the post-plan relative-path retry from `1ad7d838`) sits under one `#[cfg(debug_assertions)]` attribute; release builds compile the whole block out — double gate intact |
| T-19-17 | S | client-side seat decisions | `keygen_client.rs:168-225` — pure parsers branch only on server `meta.code` / JSON:API `code`; `FINGERPRINT_SCOPE_MISMATCH` and verbatim `MACHINE_LIMIT_EXCEEDED` (line 22) map to `SeatLimit`; zero client seat logic |
| T-19-18 | D | partial activation state | `mod.rs:279-301` — write-after-verify ordering (verify → `write_atomic` → `set_key`); tests `checkout_failure_after_machine_creation_writes_nothing` + `activate_seat_taken_elsewhere_errs_seat_limit_nothing_written` |
| T-19-19 | E | webview privileged ops | `src-tauri/src/lib.rs:148-152` — `generate_handler!` lists exactly the 4 license commands; `commands.rs` is thin wrappers only; no admin tokens exist in app code (only in gitignored CE scripts) |
| T-19-20 | R | silent error swallowing | `keygen_client.rs` — every parser's fallthrough arm is `Err(ActivationFailed)` (unknown codes fail closed, lines 191, 212, 223); no `Ok` fallback; test `terminal_validate_codes_map_to_typed_errors` covers unknown-code + bad-status |
| T-19-21 | I | key material in webview/UI | `UpsellPanel.tsx:114` — key in transient `useState` only; line 161 `setValue("")` clears on success; never persisted/logged (only `console.error` of status-refresh failures, no key); stored-key path is `activate(null)` (line 151) |
| T-19-22 | D | corrupt machine.lic crash/unlock | Typed `Problem` payloads from fail-closed Rust (`mod.rs:166-182`); calm problem view (`UpsellPanel.tsx:265-283`); `test/e2e/license.e2e.ts` exists (12 KB) with seeded-corrupt Flow B; walkthrough steps 5/7 human-approved per 19-04-SUMMARY |
| T-19-24 | I | dev toggle / dev CA in release | `scripts/check-dev-strip.sh` — fail-closed dist grep for "Toggle free tier" (guards missing dist/assets and grep errors); 19-04-SUMMARY records 0 hits at the checkpoint; CA trust cfg-gated per T-19-16 |
| T-19-25 | E | unprompted launch network | `main.tsx:51-53` — startup `refreshLicenseUi()` documented local-only; `licenseUi.ts:69-75` calls only `platform.license.status()` (pure-local, D-45); panel-mount refresh (`UpsellPanel.tsx:124-128`) same path; sole network call is user-initiated `activate` (`commands.rs` doc + `license_status` has no client call) |
| T-19-26 | S | UI trusting own state for seats | `UpsellPanel.tsx:59-79` — UI renders only the typed-code → copy map (`ERROR_COPY`); unknown shapes fall to `activationFailed` copy; no client seat computation anywhere in `src/` |

## Accepted Risks Log (4)

| Threat ID | Category | Risk | Acceptance Rationale | Accepted By |
|-----------|----------|------|----------------------|-------------|
| T-19-04 | E | Privileged CE admin token scope | Admin token is local-instance-only, held in shell vars during bootstrap; CE is loopback-bound on a dev machine — low-value target. Production credentials are a Phase 20 concern. | Plan 19-01 threat model |
| T-19-05 | I | Committed fixtures (ce-machine.lic, ce-ed25519-pubkey.b64) | Pubkey is public by design (D-41); machine file contains a synthetic random fingerprint (no real machine identity) and is signed — integrity-protected, not secret. Verified: fixture fingerprint `b70ebcaf…f2a5` is the spike's `openssl rand -hex 32` value, not a real Mac's. | Plan 19-01 threat model / D-41 |
| T-19-12 | I | Committed APP_SALT + pubkey in public repo | D-41 user decision: salt only de-correlates fingerprints across apps (not a secret key protecting anything); pubkey is minisign-pubkey posture. Doc-commented in `config.rs:30-40` with the never-change-post-release lock (A5). | D-41 (user) / Plan 19-02 threat model |
| T-19-23 | T | Webview gate patching (user edits JS to fake licensed) | Locked architecture: webview gating is UX-gating, not DRM; Rust remains the verification authority (the 4-command surface returns only verified status; entitlement enforcement flip is Phase 21). | Plan 19-04 threat model / locked architecture |

## Threat Flags from SUMMARYs

- 19-02-SUMMARY `## Threat Flags`: **None** (explicit).
- 19-03-SUMMARY `## Threat Flags`: **None** (explicit).
- 19-01 / 19-04 SUMMARYs carry no Threat Flags section. 19-04's post-plan
  checkpoint fixes were assessed against the register — all map to existing
  threat IDs (informational, no unregistered flags):
  - Per-process Keychain stored-key cache (`efc0929a`, `mod.rs:128-140`) — only
    a presence boolean is cached, never the key; T-19-10/T-19-14 invariants
    hold (counting-keychain tests pin it).
  - Debug-only relative-CA-path retry (`1ad7d838`) — verified inside the same
    `#[cfg(debug_assertions)]` block; T-19-16 double gate intact (see table).
  - Activation clears dev free-tier override (`06f7835f`) — privilege-raising
    path runs only after a server-verified, locally-Ed25519-verified
    activation; consistent with T-19-17/T-19-26.
  - e2e-spike preflight Keychain delete — test hygiene on the dev item only;
    no production surface.

## Unregistered Flags

None.

## Residuals (non-blocking, tracked forward)

- TTL/expiry is surfaced but NOT enforced (verify.rs step 8, test 9) — by
  design this phase; enforcement is Phase 21 (A6).
- A4: reqwest transport-error introspection for Offline vs ServiceUnreachable
  has a documented ambiguous-chain default (ServiceUnreachable); mapping logic
  unit-tested, live-proven in the Plan 04 walkthrough.
- Production Keygen host/credentials posture is Phase 20/21 scope (D-40 swap
  point is `config.rs`).
