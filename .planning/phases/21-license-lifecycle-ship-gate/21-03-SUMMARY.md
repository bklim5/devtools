---
phase: 21
plan: 03
subsystem: licensing-lifecycle
tags: [rust, ts, webhook, license, email, masked-key, revocation, infra, keygen, d-89, d-81, d-82, d-79]
requires:
  - "Plan 21-01: 5-state LicenseStatusPayload (Licensed/OfflineGrace/RefreshNeeded), classify_expiry, serde-contract test"
  - "Plan 21-02: TS 5-state union + payloadsEqual; refresh_if_needed scheduler"
  - "Phase 19: verify_machine_file/LicenseData, LicenseManager (activate/refresh/deactivate), keygen_client (LicenseError, parse_checkout_response), keychain trait"
  - "Phase 20: server/webhook (keygen.ts createLicense/markEmailed, fulfill.ts, mor.ts customerEmail); infra/keygen (setup.sh conventions, RUNBOOK)"
provides:
  - "Webhook stamps buyer email into minted license metadata.email (D-89), preserved across markEmailed"
  - "verify.rs LicenseData.email extracted from the included licenses resource attributes.metadata.email"
  - "Licensed/OfflineGrace payloads carry maskedKey (••••••••{last4}, Rust-side) + email; raw key never reaches JS (LIC-04)"
  - "mask_key() pure helper + per-process masked-key Keychain-read cache (Pitfall-5 prompt-flood discipline)"
  - "parse_checkout_response maps revoked/suspended/expired codes to the calm Suspended terminal (D-82/D-83 refresh path)"
  - "D-79 offline-deactivate no-clear invariant pinned by cargo tests (key + machine.lic byte-unchanged)"
  - "infra/keygen/release-seat.sh — idempotent admin seat-release by --key/--order-id (D-81) + RUNBOOK section"
affects:
  - "Plan 04 status route renders maskedKey + email (Licensee/Key fields), maps suspended/refreshNeeded to one calm state (D-83), surfaces the D-79 calm offline-deactivate message"
  - "Plan 05 ship-gate case 7 (transfer) runs release-seat.sh live against prod CE"
tech-stack:
  added: []
  patterns:
    - "per-process Keychain-read cache extended to the masked key (read at most once; seeded directly on activation from the in-hand raw key — no extra prompt)"
    - "code-driven (never prose) error classification extended to the checkout path for revocation propagation (Pitfall 3)"
    - "append-only contract evolution: 21-01 3-field → 21-03 5-field Licensed/OfflineGrace serde shape; no parallel rewrite"
key-files:
  created:
    - "infra/keygen/release-seat.sh"
  modified:
    - "src-tauri/src/license/verify.rs"
    - "src-tauri/src/license/mod.rs"
    - "src-tauri/src/license/keygen_client.rs"
    - "src/lib/platform/index.ts"
    - "src/lib/license/licenseUi.ts"
    - "src/lib/license/licenseUi.test.ts"
    - "src/components/Sidebar.test.tsx"
    - "src/components/UpsellPanel.test.tsx"
    - "server/webhook/src/keygen.ts"
    - "server/webhook/src/keygen.test.ts"
    - "server/webhook/src/fulfill.ts"
    - "server/webhook/src/fulfill.test.ts"
    - "server/webhook/src/index.ts"
    - "infra/keygen/RUNBOOK.md"
decisions:
  - "D-89 email path: webhook stamps attributes.metadata.email at create; verify.rs reads the included licenses resource's attributes.metadata.email; None for pre-D-89 licenses (fail-soft)"
  - "Masked key format ••••••••{last4} (UI-SPEC); keys <4 chars fully masked; raw key read Rust-side once per process and masked immediately — only mask_key() output enters any payload (T-21-07)"
  - "Masked-key Keychain read reuses the per-process cache discipline (acceptable because the status route is user-initiated); seeded directly from the in-hand key on activation so post-activation status never re-prompts"
  - "Revocation propagates on refresh: a suspended/revoked/expired checkout code maps to LicenseError::Suspended (D-83 one calm state); a garbled/revoked checkout writes no cert (write-after-verify, T-21-11) — user keeps last-good until grace lapses to RefreshNeeded (~37d eventual consistency, D-82)"
  - "D-79 promoted from prose/walkthrough to a cargo test: an offline / service-unreachable deactivate returns the error before any local clear; key + machine.lic byte-unchanged (never orphan a seat)"
  - "release-seat.sh reads the admin token from server-side env only (KEYGEN_ADMIN_TOKEN or minted from admin creds); never hardcoded, never from argv (D-55); idempotent (zero machines = no-op success)"
metrics:
  duration: ~50m
  completed: 2026-06-14
  tasks: 4
  commits: 4
  cargo_license_tests: 81
  vitest: 895
---

# Phase 21 Plan 03: Transfer / Revocation / Email / Masked-Key Summary

Completed the data + server-side levers the Plan-04 status UI and the support path depend on, across four threads: (1) the **D-89 email** now flows webhook → license `metadata.email` → `machine.lic` → verified cert → the Rust `LicenseData.email`; (2) the **Licensed/OfflineGrace payloads** expose a Rust-computed **maskedKey** (`••••••••{last4}`) + email — the raw key NEVER reaches JS (LIC-04), and the Keychain read obeys the per-process prompt-flood cache; (3) **revocation propagation** (D-82) is proven — a suspended/revoked checkout maps to the calm `Suspended` terminal (D-83), a garbled/revoked checkout writes no cert (last-good kept), and the **D-79 offline-deactivate no-clear invariant** is now pinned by a cargo test (key + `machine.lic` byte-unchanged); (4) the **D-81 admin seat-release helper** (`infra/keygen/release-seat.sh`) frees a seat by key or order id, idempotently, token-server-side, with a RUNBOOK section.

## What Was Built

**Task 1 — buyer email in the minted license + verify.rs extraction (commit `78b9d316`):**
- Webhook (D-89): `createLicense(orderId, email)` stamps `attributes.metadata.email` beside `orderId`; `markEmailed(licenseId, orderId, email)` re-sends email (Keygen replaces metadata wholesale); `fulfill.ts` passes `event.customerEmail` through (deps `create`/`markEmailed` signatures + `index.ts` wiring updated). Tests assert `metadata.email` present in the create body and preserved in markEmailed; all D-58 idempotency assertions stay green.
- Rust: `LicenseData` gains `email: Option<String>`, read from the included `"licenses"` resource's `attributes.metadata.email` (None for pre-D-89 licenses, fail-soft). `make_fixture_with_email` variant + two extraction tests (present → Some, absent → None).

**Task 2 — maskedKey + email on Licensed/OfflineGrace (Rust-side masking, commit `30cfb895`):**
- `mask_key(key) -> String` pure helper: `••••••••{last4}`; keys <4 chars fully masked (no plaintext tail). Unit-tested.
- `Licensed` AND `OfflineGrace` gain `masked_key` + `email`. `resolve_status` computes `email` from `data.email` and `masked_key` by reading the Keychain key Rust-side, masking it, and exposing ONLY the masked form. A per-process `masked_key_cache` (same Pitfall-5 discipline as `stored_key_flag`) reads at most once; `verify_then_persist` seeds it directly from the in-hand key on activation (no post-activation prompt). Fail-soft → `None` on Keychain error/empty.
- Serde-contract test extended to the 5-field camelCase shape (incl. the null case). TS union + `payloadsEqual` mirror `maskedKey`/`email`; test fixtures + two new change-detection cases (maskedKey-only / email-only diff).

**Task 3 — revocation propagation + suspended mapping + D-79 no-clear (commit `89f62427`):**
- `parse_checkout_response` now maps revoked/suspended/expired error `code`s (`LICENSE_SUSPENDED`/`LICENSE_EXPIRED`/`SUSPENDED`/…) to `LicenseError::Suspended` so the refresh path surfaces D-83's one calm "no longer active" signal; any other non-200 stays the fail-closed `ActivationFailed`. Parser test pins the mapping (+ that a revoked checkout is never Ok).
- Manager cargo tests: a refresh returning `Suspended` yields a typed error without panic; a garbled/revoked checkout writes no cert (write-after-verify, T-21-11) — the user keeps the last-good cert until grace lapses to RefreshNeeded (the ~37-day eventual-consistency chain, D-82).
- **D-79 pinned**: an offline (`Offline`) and a `ServiceUnreachable` `deactivate()` both return the error AND leave the Keychain key + `machine.lic` byte-unchanged (recorded before/after) — no local clear before the server delete confirms (never orphan a seat, T-21-11b).

**Task 4 — committed admin seat-release helper + RUNBOOK (commit `eee54f4b`):**
- `infra/keygen/release-seat.sh`: `--key` OR `--order-id` (resolve by validate-key / by the `metadata[orderId]` filter, never blind data[0]); list the license's machines and DELETE each (frees the seat); idempotent (zero machines → "already free" success). `set -euo pipefail`, fail-loud on missing token / unresolvable license / remaining machines; real-ACME TLS + singleplayer `/v1` routes (matches `setup.sh`). Admin token from `$KEYGEN_ADMIN_TOKEN` or minted from admin creds — server-side env only, never argv (D-55, T-21-09).
- RUNBOOK "Freeing a seat (lost-device transfer fallback)" section: when to use (D-80 support email), exact `ssh tinkerdev-box 'bash -s' -- --key …` / `--order-id …` commands, expected stderr output, idempotent re-run.

## Verification

- `cargo test license::` — **81/81** (66 from 21-01 + 3 from 21-02 + this plan's email extraction ×2, mask_key ×2, masked-key payload/cache/fail-soft ×3, revocation/write-after-verify ×2, D-79 no-clear ×2, suspended-checkout parser ×1, + the serde-contract extension). `cargo build` 0 warnings.
- `pnpm exec tsc --noEmit` clean; `pnpm exec tsc --noEmit -p server/webhook/tsconfig.json` clean.
- `pnpm exec vitest run` — **895/895** (+2 D-89 change-detection cases over 21-02's 893); webhook suite 48/48.
- `bash -n infra/keygen/release-seat.sh` clean; `--help` / no-args / both-args / unknown-arg all fail-loud (exit 1); RUNBOOK updated.
- No token literal committed (`grep -i token` shows only `$KEYGEN_ADMIN_TOKEN`/`$ADMIN_TOKEN` env reads). `decoder.ts` + its 19 tests byte-for-byte untouched (`git diff --stat` empty).
- The masked-key invariant is read-verified: every `get_key()` usage feeds only `mask_key`/`stored_key`/`has_stored_key`; the payload `masked_key` field is set exclusively from `mask_key(...)` output — the raw key never enters a serializable field (T-21-07).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TS test-fixture fallout from the widened Licensed/OfflineGrace arms**
- **Found during:** Task 2 (`tsc --noEmit`)
- **Issue:** Adding `maskedKey`/`email` to the `licensed`/`offlineGrace` union arms broke three test literals that constructed the old 2-field shape (`Sidebar.test.tsx`, `UpsellPanel.test.tsx`, `licenseUi.test.ts`'s `OFFLINE_GRACE`).
- **Fix:** Added `maskedKey: null, email: null` (or sample values) to each fixture; added two `payloadsEqual` change-detection tests for maskedKey-only / email-only diffs.
- **Files modified:** `src/components/Sidebar.test.tsx`, `src/components/UpsellPanel.test.tsx`, `src/lib/license/licenseUi.test.ts`
- **Commit:** `30cfb895`

Otherwise the plan executed as written. (The plan's optional `keychain.rs`/`store.rs` modifications were not needed — masking reads through the existing `KeychainAccess::get_key` trait and the D-79 test inspects state through the existing `LicFileStore`/`KeychainAccess` traits; no signature changes required.)

## Threat Model Notes

- **T-21-07 (masked-key info disclosure):** mitigated — the raw key is read inside Rust, masked immediately via `mask_key`, and ONLY the masked form enters the payload; read-verified that no `get_key` usage routes the raw key into a serializable field. Test-pinned (`licensed_payload_exposes_only_the_masked_key_never_the_raw`).
- **T-21-08 (email PII):** mitigated by design — the email is the buyer's own (verified, signed cert data), shown back to that user + the support-lookup key; no third-party PII.
- **T-21-09 (release-seat.sh admin token):** mitigated — token read from server-side env only, never embedded, never argv; `grep -i token` confirms no literal.
- **T-21-10 (forged seat-release):** accepted — the helper runs only by an SSH-authenticated operator (already fully trusted).
- **T-21-11 (revoked cert on refresh):** mitigated — write-after-verify holds; a revoked/garbled checkout overwrites nothing (`revoked_refresh_writes_no_cert…`), the user ages into grace → RefreshNeeded, never a crash or forged-licensed state.
- **T-21-11b (offline-deactivate seat orphan, D-79):** mitigated — server-delete-FIRST: an offline/service-unreachable `deactivate()` rejects before any local clear; key + `machine.lic` byte-unchanged, now PINNED by cargo tests.

## Threat Flags

None — no new network surface, auth path, or trust boundary beyond the plan's threat model. The email rides the existing signed-cert channel; the masked key is a strictly-narrower disclosure than the existing `has_stored_key`; revocation reuses the existing refresh/checkout path; `release-seat.sh` reuses the established CE admin-API-over-localhost pattern (setup.sh).

## Notes for Plan 04 / 05

- Status route (Plan 04): render `maskedKey` in the "License key" field and `email` in the "Licensee" field (em-dash `—` when null); map `suspended`/`refreshNeeded` to the one calm "Pro is no longer active" copy (D-83); surface the calm offline-deactivate guidance (the no-clear invariant itself is now Rust-pinned, independent of the UI walkthrough).
- Ship-gate (Plan 05): case-7 transfer runs `release-seat.sh` live against the prod CE (gated on Phase 20 completion); this plan delivers the committed, syntax-valid, conventions-matching helper + runbook.

## Self-Check: PASSED

- FOUND: src-tauri/src/license/verify.rs (email extraction)
- FOUND: src-tauri/src/license/mod.rs (masked_key + mask_key + D-79 tests)
- FOUND: src-tauri/src/license/keygen_client.rs (suspended checkout mapping)
- FOUND: src/lib/platform/index.ts (maskedKey + email)
- FOUND: infra/keygen/release-seat.sh (created, executable, bash -n clean)
- FOUND: commit 78b9d316
- FOUND: commit 30cfb895
- FOUND: commit 89f62427
- FOUND: commit eee54f4b
- cargo test license:: = 81/81; tsc (root + webhook) clean; vitest 895/895
- decoder.ts + 19 tests byte-for-byte untouched
