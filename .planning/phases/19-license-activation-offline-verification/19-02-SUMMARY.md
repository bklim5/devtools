---
phase: 19-license-activation-offline-verification
plan: 02
subsystem: licensing-rust-core
tags: [ed25519, hmac-fingerprint, keychain, machine-lic, fail-closed, tdd, cargo-test]
requires:
  - "19-01: src-tauri/fixtures/ce-machine.lic + ce-ed25519-pubkey.b64 (real CE fixtures)"
  - "19-01: D-42 verdict (raw key in Keychain) + KEYGEN_ACCOUNT_ID from 19-SPIKE-OUTCOME.md"
provides:
  - "src-tauri/src/license/ — pure Rust licensing core, 24 cargo tests green"
  - "verify_machine_file: fail-closed Ed25519 verify, typed VerifyError (Corrupt|UnsupportedAlg|Tampered|ForeignMachine)"
  - "machine_fingerprint: hex(HMAC-SHA256(APP_SALT, IOPlatformUUID)), normalization locked (A5)"
  - "LicenseManager.resolve_status(): pure-local file->verify->LicenseStatusPayload (D-45)"
  - "LicenseStatusPayload serde JSON contract pinned for Plans 03/04 TS bindings"
  - "LicFileStore + KeychainAccess traits (mockable; MacKeychain over keyring 3.6 apple-native)"
  - "lefthook pre-push cargo-test gate"
affects: [19-03, 19-04, phase-21]
tech-stack:
  added: ["ed25519-dalek 2.2", "keyring 3.6 (apple-native)", "hmac 0.12", "sha2 0.10", "base64 0.22", "hex 0.4", "thiserror 2", "rand 0.8 (dev)"]
  patterns: ["pure verify (zero I/O, zero Tauri types) for cargo-testable crypto path", "trait-mocked OS seams (file store, Keychain)", "tmp+rename atomic write", "lazy fail-soft has_stored_key boolean"]
key-files:
  created:
    - src-tauri/src/license/mod.rs
    - src-tauri/src/license/config.rs
    - src-tauri/src/license/fingerprint.rs
    - src-tauri/src/license/verify.rs
    - src-tauri/src/license/store.rs
    - src-tauri/src/license/keychain.rs
  modified:
    - src-tauri/Cargo.toml
    - src-tauri/Cargo.lock
    - src-tauri/src/lib.rs
    - lefthook.yml
decisions:
  - "APP_SALT generated once (openssl rand -hex 32) and committed: e14f0d16…e45c75 — NEVER change post-release (orphans every activation, A5)"
  - "Fingerprint compare = hand-rolled accumulate-XOR constant-time eq (documented; both sides fixed-length hex HMAC outputs — verify_slice re-MACing unnecessary)"
  - "cargo test wired as lefthook pre-PUSH (not pre-commit) per research Open Question 2 — commit latency stays JS-only"
  - "license module carries a documented temporary #![allow(dead_code)] until Plan 03 wires the Tauri commands"
  - "Requirements LIC-01/03/04/06 NOT checked off — cores proven here, user-facing halves land in Plans 03/04 (same precedent as Plan 01)"
metrics:
  duration: "~70 min (cold cargo builds dominated)"
  completed: "2026-06-12"
  tasks: 3
  files: 10
---

# Phase 19 Plan 02: Pure Rust License Core Summary

**One-liner:** Fail-closed Ed25519 machine.lic verification (verify_strict over `"machine/"+enc`, 4-variant typed error taxonomy, real-CE cross-validated), HMAC-SHA256 machine fingerprint with committed salt, atomic store + trait-mocked Keychain, and a pure-local `resolve_status()` whose camelCase JSON contract is pinned for the webview — 24 cargo tests, zero network code.

## What was built

- **Task 1 (`323e9b62`):** Research-locked Cargo deps (ed25519-dalek 2.2 / keyring 3.6 apple-native / hmac 0.12 / sha2 0.10 / base64 0.22 / hex / thiserror 2; dev: rand 0.8); `config.rs` per-env consts (D-40/D-41: KEYGEN_HOST=localhost, account id, raw-32-normalized pubkey + `verifying_key()`, committed APP_SALT with never-change doc); `fingerprint.rs` (pure ioreg parser + HMAC hex, openssl-pinned known vector, raw UUID never exposed — T-19-11); `mod license;` in lib.rs; lefthook pre-push `cargo test` gate.
- **Task 2 (`51c46a06`):** `verify.rs` — `verify_machine_file(cert, pubkey, expected_fingerprint)` implementing the 9-step algorithm exactly: marker strip → envelope → exact `"base64+ed25519"` gate → `verify_strict` over literal `"machine/"+enc` (Pitfall 4) → dataset → constant-time fingerprint compare → expiry surfaced NOT enforced (A6). Zero I/O, zero Tauri types. 9 tests including the **real CE-issued fixture verifying against the real CE pubkey** (`include_str!` cross-validation, fixture fingerprint `b70ebcaf…f2a5`).
- **Task 3 (`c8e2fbb3`):** `store.rs` (LicFileStore trait + AppDataLicStore, tmp+rename atomic, missing→None), `keychain.rs` (KeychainAccess trait + MacKeychain over `keyring::Entry::new("com.tinkerdev.app.license","license-key")`, NoEntry→Ok(None), Pitfall 5 documented, never constructed in tests), `mod.rs` LicenseManager with injected fingerprint + `resolve_status()` (fail-closed, lazy fail-soft `has_stored_key`, zero network — D-45) and the serde-pinned `LicenseStatusPayload`/`ProblemKind` TS contract.

## Threat register dispositions (all `mitigate` rows landed)

| Threat | Mitigation proven by |
|---|---|
| T-19-06 forged/tampered cert | verify_strict; tests 2 (flipped enc byte) + 5 (foreign keypair) |
| T-19-07 copied machine.lic | fingerprint compare → ForeignMachine; test 6 + manager test |
| T-19-08 alg confusion | exact-string alg gate → UnsupportedAlg; test 4 |
| T-19-09 panic/fail-open on malformed | every step typed-errors; tests 3/7 (truncation, empty, garbage) |
| T-19-10 key reaching JS | payload carries only `has_stored_key`; serde test pins shapes; grep confirms no key field |
| T-19-11 raw UUID leaving machine | fingerprint.rs exposes only the HMAC hex; no public UUID accessor |
| T-19-13 keyring v4 / missing apple-native | pinned `keyring = "3.6"` + `features = ["apple-native"]` (acceptance grep) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Cargo.toml `[dev-dependencies]` insert swallowed `tauri-plugin-process`**
- **Found during:** Task 1 (first `cargo test` run)
- **Issue:** the new dep block + `[dev-dependencies]` section was inserted mid-`[dependencies]`, demoting `tauri-plugin-process` to a dev-dep — tauri-build failed with "Permission process:allow-restart not found"
- **Fix:** licensing deps moved AFTER `tauri-plugin-process`, `[dev-dependencies]` placed before `[features]`; fixed before commit
- **Files modified:** `src-tauri/Cargo.toml` · **Commit:** `323e9b62`

### Minor deviations

- **Module-level `#![allow(dead_code)]`** added to `license/mod.rs` with an explicit removal note: until Plan 03 registers the Tauri commands, nothing outside the module consumes it and 9 dead-code warnings would otherwise dirty every build. Remove with Plan 03's wiring.
- **Requirements NOT checked off** — LIC-01/03/04/06 cores are proven here, but all four IDs recur in Plans 03/04 which deliver the user-facing halves (activation UI, launch wiring, calm Problem messaging); checkmarks defer to the implementing plans, same precedent Plan 01 set.
- **`/simplify` / `/codex:review` slash gates** are orchestrator-level commands unavailable in this executor context (same note as Plan 01) — simplification applied inline; flag for orchestrator if a separate review pass on the Rust module is wanted.

## Verification

- `cargo test --manifest-path src-tauri/Cargo.toml` → **24/24** green (config 3, fingerprint 3, verify 9, store 3, manager/status/serde 6); zero compiler warnings
- Real-CE cross-validation green: byte-verbatim `ce-machine.lic` verifies under `config::verifying_key()`
- Acceptance greps all pass: keyring 3.6 apple-native, ed25519-dalek 2.2, APP_SALT 64-hex, `mod license`, pre-push cargo test, `verify_strict` present / bare `.verify(` absent / `"base64+ed25519"` / `machine/` present / `use tauri` zero in verify.rs, `com.tinkerdev.app.license`, `rename` in store.rs, `hasStoredKey` only in serde-pinned test strings
- No test invokes real `ioreg`, real Keychain, or `keyring::Entry` (pure parsers + trait mocks only)
- lefthook unit gate green on all three commits: tsc + **vitest 818/818** + eslint; decoder.ts + its 19 tests byte-for-byte untouched (zero `src/` changes)

## Known Stubs

None — every function is fully implemented; the temporary `dead_code` allow is consumption-pending, not a stub.

## Threat Flags

None — all security surface introduced (machine.lic parse boundary, Keychain access, committed consts) is enumerated in the plan's threat model.

## For downstream plans

- **Plan 03:** consume `LicenseManager` (add the client slot + Tauri commands), `LicenseStatusPayload` JSON contract is pinned by `serde_json_shapes_are_the_pinned_ts_contract`; compute `machine_fingerprint()` once at startup and inject; pass `app.path().app_data_dir()` to `AppDataLicStore`; REMOVE the module's `#![allow(dead_code)]` when wiring lands.
- **Plan 04:** ProblemKind strings for the status UI: `"corrupt" | "tampered" | "foreignMachine" | "unsupportedAlg"`.
- **Phase 21:** `LicenseData.expiry`/`issued` are surfaced verbatim, unenforced — TTL/grace lands there with no format change; prod host swap is a `config.rs` constants change (D-40).

## Self-Check: PASSED

All 6 created files exist on disk; all three task commits (323e9b62, 51c46a06, c8e2fbb3) present in git log.
