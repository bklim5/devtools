---
phase: 19-license-activation-offline-verification
plan: 03
subsystem: licensing-online-half
tags: [keygen-client, reqwest, rustls, tauri-commands, platform-seam, d-38, d-44, tdd]
requires:
  - "19-01: D-42 verdict (raw key in Keychain) + verbatim MACHINE_LIMIT_EXCEEDED / validate-key codes from 19-SPIKE-OUTCOME.md"
  - "19-02: LicenseManager + verify.rs + store/keychain traits + the serde-pinned LicenseStatusPayload contract"
provides:
  - "src-tauri/src/license/keygen_client.rs — typed reqwest client (validate-key, machine create, checkout, delete) with pure cargo-tested parsers + D-38 Offline/ServiceUnreachable classification"
  - "LicenseError serialized as {\"code\":\"camelCase\"} — the pinned webview error contract (8 codes)"
  - "Activation state machine in LicenseManager: validate -> (create) -> checkout -> LOCAL VERIFY -> atomic write + Keychain (no partial-success state)"
  - "The locked 4-command Tauri surface: license_status / activate_license / refresh_license / deactivate_machine, registered + managed in lib.rs"
  - "platform.license seam: TS types mirroring the serde contract, invoke wiring in tauri.ts, deterministic browser/test stubs (createLicenseStub/noopLicense)"
affects: [19-04, phase-21]
tech-stack:
  added: ["reqwest 0.13 (default-features off, json + rustls — no OpenSSL)"]
  patterns: ["pure response parsers separated from async transport (parsers are the test surface, zero sockets in unit tests)", "native async-fn-in-trait with a generic manager (dyn-incompatible trait, plan-endorsed alternative)", "write-after-verify persistence ordering", "fingerprint as the Keygen machine URL identifier"]
key-files:
  created:
    - src-tauri/src/license/keygen_client.rs
    - src-tauri/src/license/commands.rs
  modified:
    - src-tauri/Cargo.toml
    - src-tauri/Cargo.lock
    - src-tauri/src/license/mod.rs
    - src-tauri/src/lib.rs
    - src/lib/platform/index.ts
    - src/lib/platform/tauri.ts
    - src/lib/platform/browser.ts
    - src/lib/platform/stub.ts
    - src/lib/platform/platform.test.ts
    - src/shell/testStore.ts
decisions:
  - "Machine identifier on Keygen machine routes = the URL-safe fingerprint (documented Keygen behavior): the VALID idempotent path has no machine UUID available without an extra call, and refresh/deactivate use the verified lic's fingerprint — live-proven in the Plan 04 walkthrough"
  - "LicenseApi is generic (manager<C: LicenseApi>), not Box<dyn>: async-fn-in-trait is dyn-incompatible; trait methods return impl Future + Send so Tauri's async commands stay Send"
  - "license_status is an async command (tokio-Mutex lock is the only await) — D-45 holds: zero client/network calls on the path"
  - "Empty-fingerprint sentinel: a startup fingerprint failure injects \"\" — resolve_status fails closed (ForeignMachine Problem on any existing lic) and activate refuses with activationFailed before any network"
  - "LIC-04 marked complete (fully delivered here, no later plan carries it); LIC-01/02 defer to Plan 04's UX halves (Plan 01/02 precedent)"
metrics:
  duration: "~80 min"
  completed: "2026-06-12"
  tasks: 3
  files: 25
---

# Phase 19 Plan 03: Keygen Client, Activation Commands & Platform Seam Summary

**One-liner:** The online half of licensing — a rustls-only Keygen client with pure code-branching parsers (seat-limit on the verbatim `MACHINE_LIMIT_EXCEEDED`, D-38 Offline/ServiceUnreachable classified in Rust), an activation state machine that persists machine.lic + the raw Keychain key ONLY after local Ed25519 verification, the locked 4-command Tauri surface, and a `platform.license` seam with deterministic browser/test stubs — 48 cargo + 821 vitest green, zero key material in JS.

## What was built

- **Task 1 (`6f2d3c32`):** `keygen_client.rs` — `KeygenClient` (one 15s-timeout reqwest client; JSON:API headers mirroring the proven spike) with the 4 exact calls; PURE parsers (`parse_validate_response` branching on `meta.code` per Pitfall 3 — NO_MACHINE/NO_MACHINES expected, NOT_FOUND→invalidKey, SUSPENDED/BANNED/EXPIRED→suspended; `parse_create_machine_response` mapping the verbatim 422 `MACHINE_LIMIT_EXCEEDED`→seatLimit and logging the 403 Pitfall-1 hint; checkout certificate extracted verbatim; delete 204-only). D-38 `classify_transport_error` walks the error chain: NetworkUnreachable/NetworkDown/HostUnreachable→`offline`, everything else (refused/timeout/TLS/ambiguous)→`serviceUnreachable` (A4 default documented). `LicenseError` (8 variants) hand-serializes the `{"code":"camelCase"}` contract. Dev-only CA trust (`DEVTOOLS_KEYGEN_CA`) double-gated under `#[cfg(debug_assertions)]` with the lib.rs webdriver rationale (T-19-16). 12 tests, no sockets.
- **Task 2 (`45f90327`):** `LicenseApi` trait (native async-fn-in-trait returning `impl Future + Send`; manager generic over it) + `LicenseManager::activate/refresh/deactivate`. activate: D-39 trim-only key normalization (empty→invalidKey, no network), D-44 stored-key path (`None`→Keychain, missing→noStoredKey before any call), SeatTakenElsewhere→seatLimit untouched-state, VALID→skip-create idempotent checkout, and the shared `verify_then_persist` tail — cert must pass verify.rs Ed25519 + fingerprint BEFORE `store.write_atomic` then `keychain.set_key` (T-19-15/T-19-18; scripted-mock tests pin no-partial-write for both transport failure and unverifiable cert). `commands.rs`: 4 `#[tauri::command]` wrappers over `LicenseState(async_runtime::Mutex<…>)`; zero transport types in the command layer. lib.rs: manager composed in `.setup()` (fingerprint computed once; failure→empty sentinel→fail-closed Problem, never a panic) + `generate_handler!` with exactly the 4 commands. Plan-02's temporary `#![allow(dead_code)]` removed; 48 cargo tests, zero warnings.
- **Task 3 (`94f8b6c2`):** `platform.license` capability + `LicenseStatusPayload`/`LicenseProblem`/`LicenseErrorCode` TS types mirroring the serde-pinned JSON field-for-field; tauri.ts wires the 4 `invoke()`s (rejections pass through untransformed as `{code}`); `createLicenseStub()` in stub.ts is the single deterministic non-Tauri arm (status→notActivated, mutations reject serviceUnreachable — never network), reused by browser.ts and testStore.ts `noopLicense`. 13 test `Platform` literals widened via `makeMemoryPlatform()` spread, keeping `grep "license:" src/tools/` at 0. 3 new seam tests; suite 821/821; zero new webview dependencies.

## Threat register dispositions (all `mitigate` rows landed)

| Threat | Mitigation proven by |
|---|---|
| T-19-14 key material to JS | Commands return payload/`{code}` only; key enters via `activate(key)` and never returns; payload serde test + state-machine asserts |
| T-19-15 MITM on activation | rustls default validation + `verify_then_persist`: checkout cert Ed25519-verified locally before any write; `unverifiable_checkout_cert_writes_nothing` |
| T-19-16 dev CA weakening release | `DEVTOOLS_KEYGEN_CA` path inside `#[cfg(debug_assertions)]` — compiled out of release entirely |
| T-19-17 client-side seat logic | Zero: server codes are the only seat authority; client maps `FINGERPRINT_SCOPE_MISMATCH`/`MACHINE_LIMIT_EXCEEDED` to seatLimit |
| T-19-18 partial activation | Write-after-verify ordering; `checkout_failure_after_machine_creation_writes_nothing` pins it |
| T-19-19 webview privilege | The 4 commands are the entire surface; `license_status` read-only local; no admin tokens in the app |
| T-19-20 silent failures | Every failure path is a typed code; no `Ok` fallback arms; unknown server codes fail closed to activationFailed |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] reqwest 0.13 renamed the rustls feature**
- **Found during:** Task 1 (dependency add)
- **Issue:** the plan's `features = ["json", "rustls-tls"]` is the 0.12 name; reqwest 0.13 calls it `rustls` (rustls is now also the default TLS)
- **Fix:** `features = ["json", "rustls"]` with a Cargo.toml comment; still default-features off, no OpenSSL linkage
- **Files modified:** `src-tauri/Cargo.toml` · **Commit:** `6f2d3c32`

**2. [Rule 3 - Blocking] `Box<dyn LicenseApi>` is dyn-incompatible with async fns**
- **Found during:** Task 2 design
- **Issue:** the plan's primary phrasing ("a `Box<dyn LicenseApi>` client slot") cannot compile with native async-fn-in-trait
- **Fix:** the plan's own endorsed alternative — `LicenseManager<C: LicenseApi>` generic, trait methods returning `impl Future + Send` (keeps Tauri's async command futures Send)
- **Files modified:** `src-tauri/src/license/mod.rs` · **Commit:** `45f90327`

**3. [Rule 3 - Blocking] Widening `Platform` broke 16 test-stub literals**
- **Found during:** Task 3 (tsc)
- **Issue:** adding the required `license` capability fails every inline `Platform` literal; files outside the plan's files_modified list had to change
- **Fix:** `testStore.ts` gained `noopLicense` (reusing `createLicenseStub`) + `makeMemoryPlatform` includes it; the 11 src/tools tests + FormatterView + router tests switched their identical literals to a `...makeMemoryPlatform()` spread (also keeps the acceptance grep `license:` in src/tools/ at 0); platform.test.ts's 3 explicit stubs gained the field
- **Files modified:** `src/shell/testStore.ts`, `src/router.test.tsx`, `src/components/FormatterView.test.tsx`, 11 `src/tools/**/[A-Z]*.test.tsx` · **Commit:** `94f8b6c2`

### Minor deviations

- **Machine identifier = fingerprint on machine URL routes.** The plan's idempotent VALID path ("skip to checkout") provides no machine UUID (validate-key doesn't return one), and "extract machine id from the current verified machine.lic" would have required modifying verify.rs (out of plan files). Keygen machine endpoints accept the URL-safe fingerprint as the identifier, and a verified lic's fingerprint equals this machine's by construction — so checkout/refresh/deactivate use it. Residual (A4-style): documented Keygen behavior, live-proven in the Plan 04 walkthrough.
- **`license_status` is async** (the plan sketched "sync-fast"): the manager sits behind a tokio Mutex (activate holds `&mut self` across awaits), so all 4 commands are async returning Result per the documented Tauri rule. The only await on the status path is the lock — D-45's "no client/network call" criterion holds verbatim.
- **`tauri::async_runtime::Mutex`** (Tauri's tokio re-export) instead of a direct `tokio` dependency — zero new direct Rust deps beyond reqwest.
- **Empty-fingerprint activate guard** added (plan only specified the status-side Problem mapping): a startup fingerprint failure must not bind a junk identity server-side — activate returns activationFailed before any network call (test pinned).
- **A3 (capabilities):** no capability entry was needed — `generate_handler!`-registered app commands invoke fine without one (per plan note; nothing to add).
- **`/simplify` / `/codex:review` slash gates** are orchestrator-level commands unavailable in this executor context (same note as Plans 01/02) — simplification applied inline; flag for the orchestrator if a separate review pass is wanted on the Rust client/state machine.

## Verification

- `cargo test --manifest-path src-tauri/Cargo.toml` → **48/48** (keygen_client 12, state machine 12, verify 9, store 3, fingerprint 3, config 3, status/serde 6); `cargo build` clean, **zero warnings** (dead_code allow removed)
- State-machine coverage: happy path, idempotent re-activation (create skipped), seat-limit (nothing written), stored-key reactivation, no-stored-key (no network), empty/whitespace key, trim, checkout-failure no-partial-write, unverifiable-cert no-partial-write, empty-fingerprint sentinel, refresh, deactivate
- Acceptance greps all pass: `validate-key` literal, `include=license,license.entitlements`, no encrypt param set, `License ` auth scheme, `#[cfg(debug_assertions)]` over `DEVTOOLS_KEYGEN_CA`, `MACHINE_LIMIT_EXCEEDED`, `{"code":"seatLimit"}` literal assert, generate_handler lists exactly the 4 commands, `reqwest` count 0 in commands.rs, `trim()` in the activate path, no client `.await` in license_status, `@tauri-apps` imports only in tauri.ts, all 4 invokes present, `license` refs in src/tools/ = 0
- `pnpm exec tsc --noEmit` clean; **vitest 821/821** (3 new seam tests); eslint clean (2 pre-existing SidebarResetMenu warnings out of scope, logged below); decoder.ts + its 19 tests byte-for-byte untouched (`git diff --stat src/lib/protobuf/` empty)
- lefthook unit gate green on all three commits; no unit test opens a network connection (pure parsers + scripted mocks; the live transport smoke is Plan 04's walkthrough with `DEVTOOLS_KEYGEN_CA=scripts/keygen-ce/caddy-root.crt`)

## Known Stubs

None in the delivered surface. The browser/test `createLicenseStub` arm is the SPECIFIED deterministic non-Tauri behavior (licensing is Tauri-only, ENT-03 mirror), not a placeholder — the real path is fully wired end-to-end (webview → invoke → commands → state machine → Keygen client).

## Threat Flags

None — the new network surface (4 Keygen calls), the command boundary, and the dev CA trust are all enumerated in the plan's threat model (T-19-14..20) and landed `mitigate`.

## Deferred Issues

- Pre-existing eslint warnings in `src/components/SidebarResetMenu.tsx` (unused disable directive + react-refresh export warning) — unrelated to this plan; logged to `deferred-items.md`.

## For downstream plans

- **Plan 04:** build the activation UX purely against `platform.license.*` + `LicenseErrorCode`; inject custom license stubs via `setPlatformForTest` (Test 14 proves the routing). Live walkthrough: mint a FRESH license (`./scripts/keygen-ce/bootstrap.sh mint_license`), run `tauri dev` with `DEVTOOLS_KEYGEN_CA=scripts/keygen-ce/caddy-root.crt`; this also live-proves the fingerprint-as-machine-identifier checkout path and the A4 transport-classification residual.
- **Phase 21:** `refresh_license`/`deactivate_machine` are callable now — wire UI + TTL/grace there; the prod host swap stays a `config.rs` constants change (D-40); checkout already embeds `license.entitlements` (forward-compat).

## Self-Check: PASSED

All created/modified key files exist on disk; all three task commits (6f2d3c32, 45f90327, 94f8b6c2) present in git log; cargo 48/48, vitest 821/821, tsc + eslint clean at completion.
