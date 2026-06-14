---
phase: 21
plan: 03
type: execute
wave: 3
depends_on: [21-01, 21-02]
files_modified:
  - src-tauri/src/license/verify.rs
  - src-tauri/src/license/mod.rs
  - src-tauri/src/license/keychain.rs
  - src-tauri/src/license/store.rs
  - src/lib/platform/index.ts
  - src/lib/license/licenseUi.ts
  - server/webhook/src/keygen.ts
  - server/webhook/src/keygen.test.ts
  - infra/keygen/release-seat.sh
  - infra/keygen/RUNBOOK.md
autonomous: true
requirements: [LIC-07, LIC-08]
must_haves:
  truths:
    - "The webhook embeds the buyer email in each minted Keygen license so it flows into machine.lic"
    - "verify_machine_file extracts the licensee email from the verified cert's license resource"
    - "The Licensed/OfflineGrace payloads carry maskedKey (last-N chars, Rust-side) and email — the raw key never round-trips through JS"
    - "Revocation/suspension propagates: a refresh that returns revoked/suspended drops entitlements to free with no crash"
    - "An admin can free a seat by license key / order ID via a committed infra helper run over SSH against the CE admin API on localhost"
    - "An offline deactivate() returns the offline error and leaves the Keychain key + machine.lic byte-unchanged (D-79 no-clear, pinned by a cargo test)"
  artifacts:
    - path: "src-tauri/src/license/verify.rs"
      provides: "email extraction from the cert's included license resource"
      contains: "email"
    - path: "src-tauri/src/license/mod.rs"
      provides: "maskedKey + email on Licensed/OfflineGrace payloads; masking helper"
      contains: "masked_key"
    - path: "server/webhook/src/keygen.ts"
      provides: "buyer email stamped into the created license (D-89)"
      contains: "email"
    - path: "infra/keygen/release-seat.sh"
      provides: "idempotent admin seat-release by key/orderId (D-81)"
      contains: "release-seat"
  key_links:
    - from: "server/webhook/src/keygen.ts createLicense"
      to: "Keygen license attributes/metadata email"
      via: "POST body carries customerEmail"
      pattern: "email"
    - from: "src-tauri/src/license/verify.rs"
      to: "machine.lic included license resource attributes.email"
      via: "parse the licenses resource"
      pattern: "email"
    - from: "infra/keygen/release-seat.sh"
      to: "CE admin machines API (localhost)"
      via: "SSH + privileged token server-side"
      pattern: "machines"
---

<objective>
Complete the transfer (LIC-07) and revocation (LIC-08) surfaces that the status UI (Plan 04) wires, plus the D-89 email-in-license coordination and the D-81 admin seat-release helper.

Three threads:
1. **D-89 email + masked key:** the Phase-20 webhook stamps the buyer email into each minted license; `verify_machine_file` extracts it from the verified cert; the Rust `Licensed`/`OfflineGrace` payloads expose `maskedKey` (last-N chars, computed Rust-side — the raw key NEVER reaches JS, LIC-04) + `email`. Required by ROADMAP criterion 4 and the D-80 support-lookup path.
2. **LIC-08 revocation:** confirm/extend that a `refresh()` returning a revoked/suspended/expired license drops to free with no crash (D-82) — the propagation path is the existing re-checkout, so this is mostly a test + the `suspended` error mapping; revocation surfaces as RefreshNeeded (Plan 01) or the `suspended` LicenseError.
3. **D-81 infra helper:** a committed, idempotent `infra/keygen/release-seat.sh` that frees a seat by license key or Lemon Squeezy order ID, run over SSH against the CE admin API on localhost (privileged token stays server-side, D-55) — makes the D-80 "reply to your license email" fallback one repeatable command.

The deactivate() primitive itself already exists (Phase 19) and is wired to UI in Plan 04 (D-78/D-79); this plan ensures the payload/email/revocation data it needs is present.
Purpose: every piece of data and every server-side lever the status UI and support path depend on.
Output: extended verify.rs (email), extended payload (maskedKey+email), webhook email-embedding, revocation tests, the infra helper + RUNBOOK entry.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/21-license-lifecycle-ship-gate/21-CONTEXT.md
@.planning/phases/20-purchase-pipeline/20-CONTEXT.md
@.planning/phases/21-license-lifecycle-ship-gate/21-01-SUMMARY.md
@.planning/phases/21-license-lifecycle-ship-gate/21-02-SUMMARY.md

<interfaces>
<!-- verify.rs LicenseData (line 50) already extracts entitlements from `included` entries of
     type "entitlements". The license resource (type "licenses") is also in `included` — its
     attributes can carry the email. -->

verify.rs:
  pub struct LicenseData { pub expiry: Option<String>, pub issued: Option<String>, pub fingerprint: String, pub entitlements: Vec<String> }
  // included[] entries: { type: "licenses"|"entitlements"|..., attributes: serde_json::Value }
  // current code filters type=="entitlements" for code; ADD: read type=="licenses" attributes for an email field.

mod.rs LicenseStatusPayload::Licensed { expiry, entitlements } — ADD masked_key + email.
  LicenseManager has `keychain` (get_key) — masking reads the key Rust-side, exposes only last-N.
  NOTE (serialization order): Plan 02 (now a dependency) has ALREADY landed the settled 5-state Rust enum
  (Licensed/OfflineGrace/RefreshNeeded) + its serde-contract test, AND the TS union licensed/offlineGrace
  arms + payloadsEqual in src/lib/platform/index.ts + licenseUi.ts. This plan ADDS masked_key/email ONTO
  those settled arms and OWNS the FINAL serde-contract test shape. No parallel rewrite of the same arm.

webhook keygen.ts:
  createLicense(orderId: string): Promise<{ id; key }>  // POST body: attributes.metadata.{orderId}, relationships.policy
  // OrderEvent already carries customerEmail (mor.ts: data.attributes.user_email).
  // fulfill.ts calls deps.create(orderId) — customerEmail is in scope (fulfill.ts line ~73).

Keygen license attributes support `metadata` (free-form) and the license `name`/owner. CE: embed email in
  attributes.metadata.email (simplest, flows to included license resource metadata) OR as the license name.
  Verify against keygen.test.ts canned-JSON expectations.

infra pattern (Phase 20): infra/keygen/{setup.sh,deploy.sh,swap.sh,RUNBOOK.md}, privileged admin token on the VPS, CE admin API on localhost.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Embed buyer email in the minted license (webhook D-89) + verify.rs email extraction</name>
  <read_first>
    - server/webhook/src/keygen.ts (createLicense POST body; the metadata.orderId stamp; markEmailed PATCH that re-sends metadata)
    - server/webhook/src/keygen.test.ts (canned-JSON expectations for the create body)
    - server/webhook/src/fulfill.ts (where create(orderId) is called; customerEmail in scope)
    - server/webhook/src/mor.ts (OrderEvent.customerEmail = data.attributes.user_email)
    - src-tauri/src/license/verify.rs (LicenseData struct line 50; the included-entitlements extraction line 163-169; the test fixtures `make_fixture` that build the included[] array)
  </read_first>
  <action>
    Webhook side (D-89):
    - Change `createLicense(orderId)` -> `createLicense(orderId, email)` in the KeygenClient interface (keygen.ts) and stamp the buyer email into the create POST body at `attributes.metadata.email` (alongside the existing `metadata.orderId`). Keygen embeds license metadata into the checkout cert's license resource, so it flows to machine.lic. Update `markEmailed`'s metadata re-send to preserve `email` too (Keygen REPLACES metadata on PATCH — re-send orderId + email + emailed:true).
    - Update fulfill.ts to pass `event.customerEmail` to `create`. Update the FulfillDeps `create` signature.
    - Update keygen.test.ts + fulfill.test.ts canned expectations to assert `metadata.email` is present in the create body and preserved in markEmailed. Keep all existing idempotency (D-58) assertions green.
    Rust side:
    - Add `pub email: Option<String>` to `LicenseData` (verify.rs). Extract it from the verified dataset's `included` entries of type "licenses": read `attributes.metadata.email` (mirror the entitlements extraction pattern). Fall back to None if absent (older pre-D-89 licenses). Add a verify.rs test: a fixture whose included licenses resource carries `metadata.email` -> LicenseData.email == Some(that); a fixture without it -> None.
    - Update the verify.rs `make_fixture` helper (or add a variant) so the licenses resource can carry metadata.email for the test.
  </action>
  <verify>
    <automated>cd src-tauri && cargo test license::verify 2>&1 | grep -q "test result: ok" && cd .. && pnpm exec tsc --noEmit -p server/webhook/tsconfig.json && pnpm exec vitest run server/webhook 2>&1 | grep -qE "passed|✓"</automated>
  </verify>
  <acceptance_criteria>
    - `grep "metadata.*email\|email.*metadata\|attributes.*email" server/webhook/src/keygen.ts` matches (email stamped in create body)
    - `grep "customerEmail\|event.customerEmail\|, email" server/webhook/src/fulfill.ts` shows email passed to create
    - `grep "pub email" src-tauri/src/license/verify.rs` matches
    - `cargo test license::verify` exits 0 with an email-extraction test present (grep output shows the new test name)
    - `tsc --noEmit -p server/webhook/tsconfig.json` exits 0; `vitest run server/webhook` exits 0
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: maskedKey + email on the Licensed/OfflineGrace payloads (Rust-side masking)</name>
  <read_first>
    - src-tauri/src/license/mod.rs (LicenseStatusPayload Licensed variant + the Plan-01 OfflineGrace variant; resolve_status Ok arm; the keychain field; the serde-contract test)
    - src-tauri/src/license/keychain.rs (get_key signature/KeychainError)
    - src/lib/platform/index.ts (the TS union — Plan 02 has ALREADY landed the licensed/offlineGrace arms; this plan ADDS maskedKey/email fields onto those settled arms, no rewrite)
    - src/lib/license/licenseUi.ts (payloadsEqual — Plan 02 settled the licensed/offlineGrace arms; this plan EXTENDS them to compare maskedKey/email)
    - .planning/phases/21-license-lifecycle-ship-gate/21-UI-SPEC.md (Field — Key row: recommend `••••••••{last4}`; absent email -> "—")
  </read_first>
  <action>
    Rust:
    - Add `masked_key: Option<String>` and `email: Option<String>` to the `Licensed` AND `OfflineGrace` payload variants (both are Pro-active states the status route renders).
    - Add a pure masking helper `fn mask_key(key: &str) -> String` returning `••••••••{last4}` (D-89 discretion; last-4 recommended in UI-SPEC). For keys shorter than 4 chars, mask all. Cover with a unit test (a normal key -> bullets + last4; a short key -> all bullets).
    - In resolve_status, when building Licensed/OfflineGrace: compute `email = data.email` (from Task 1) and `masked_key` by reading the Keychain key (`self.keychain.get_key()`), masking it Rust-side, and exposing ONLY the masked form. The raw key NEVER enters the payload. If the Keychain read errors or is empty, `masked_key = None` (fail-soft — same posture as has_stored_key). IMPORTANT: respect the per-process Keychain-read discipline — a Licensed launch previously NEVER read the Keychain (Pitfall 5 prompt-flood). Reading it now to mask is acceptable ONLY because the status route is user-initiated; gate the read so it happens at most once per process (reuse/extend the `stored_key_flag` cache mechanism, or cache the masked key similarly). Document the tradeoff: the masked key is shown only on the status route, and the read is cached to avoid prompt-flood.
    - Update the serde-contract test for the new Licensed/OfflineGrace shapes: `{"state":"licensed","expiry":...,"entitlements":[...],"maskedKey":"••••••••AB12","email":"a@b.com"}` (and null cases serialize the fields as null — confirm camelCase `maskedKey`).
    TS mirror (DETERMINISTIC ORDERING — no hope-it-merges): Plan 02 is a hard dependency (wave 3 after wave 2) and has ALREADY landed the settled 5-state `licensed`/`offlineGrace` union arms in src/lib/platform/index.ts AND `payloadsEqual` in src/lib/license/licenseUi.ts. This plan does NOT re-declare or rewrite those arms — it ADDS `maskedKey: string | null; email: string | null` onto the EXISTING licensed + offlineGrace arms, and EXTENDS the existing payloadsEqual licensed/offlineGrace cases to also compare maskedKey + email. Likewise on the Rust side, this plan OWNS the FINAL serde-contract test shape (the maskedKey/email-bearing licensed/offlineGrace JSON) — Plan 02 landed the 3-field shape, this plan extends it to the 5-field shape. There is no parallel rewrite of the same union arm or the same serde-contract test; the sequencing (21-01 → 21-02 → 21-03) makes the contract evolution append-only.
  </action>
  <verify>
    <automated>cd src-tauri && cargo test license:: 2>&1 | grep -q "test result: ok" && cd .. && pnpm exec tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `grep "masked_key\|mask_key" src-tauri/src/license/mod.rs` matches (field + helper)
    - `grep "maskedKey" src-tauri/src/license/mod.rs` matches (serde-contract test pins camelCase)
    - mod.rs contains a `mask_key` unit test producing `••••••••` + last-4
    - the raw key never appears in any payload: `grep -n "get_key" src-tauri/src/license/mod.rs` usages feed ONLY into mask_key, never into a payload field directly (verify by reading)
    - `grep "maskedKey" src/lib/platform/index.ts` matches
    - prompt-flood guard PINNED BY A TEST: `cargo test resolve_status_reads_the_keychain_at_most_once_per_process` still passes after the masked-key read is wired (the masked-key read must reuse/extend the existing `stored_key_flag` per-process cache — if a new test name is used, it must assert the Keychain is read at most once per process even when resolve_status is called repeatedly while masking)
    - `cargo test license::` exits 0; `tsc --noEmit` exits 0
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Revocation propagation test (D-82) + suspended mapping + D-79 offline-deactivate no-clear gate</name>
  <read_first>
    - src-tauri/src/license/mod.rs (refresh(); the ScriptedClient test harness; LicenseError variants)
    - src-tauri/src/license/keygen_client.rs (how a suspended/revoked license validate/checkout response is classified — does it map to LicenseError::suspended? confirm the code path)
    - src-tauri/src/license/mod.rs deactivate() (Phase 19: server delete-machine FIRST, then clear Keychain key + machine.lic; the ScriptedClient/keychain test harness)
    - src-tauri/src/license/keychain.rs + store.rs (get_key / machine.lic read-write — what the no-clear test inspects)
    - .planning/phases/21-license-lifecycle-ship-gate/21-CONTEXT.md (D-82: revocation propagates only on successful online refresh; D-83 one calm state; D-79: offline deactivate is BLOCKED with a calm message and local state is NEVER cleared until the server delete confirms — a local-only forget would orphan a consumed seat)
  </read_first>
  <action>
    D-82 is "eventual consistency on refresh" — the propagation mechanism is already the re-checkout. Add the proof + the calm-drop path:
    - Add a cargo test: a `refresh()` whose checkout returns a SUSPENDED/revoked outcome (a `LicenseError::suspended` or a checkout that yields a cert that no longer verifies / a server 403) does NOT panic and surfaces a typed error the command layer can map. Confirm the existing keygen_client classification: a revoked license at checkout -> which LicenseError? If it's not already `suspended`, ensure revoked/suspended checkout maps to `LicenseError::suspended` (D-83's calm "no longer active" maps from this + the RefreshNeeded state).
    - Add a manager-level test: when refresh returns `suspended`, the on-disk machine.lic is NOT overwritten with a bad cert (write-after-verify invariant holds — a revoked checkout that fails local verify writes nothing, the user keeps their last-good cert until grace lapses to RefreshNeeded). Document the propagation chain: revoke in Keygen -> next refresh checkout fails/returns revoked -> no fresh cert -> existing cert eventually expires -> grace -> RefreshNeeded (free). The "≤37 day eventual consistency" is this chain.
    - D-79 no-clear regression gate (promote from prose+walkthrough to a deterministic Rust test): add a cargo test asserting that an OFFLINE `deactivate()` (the server delete-machine call fails with `LicenseError::offline` / service-unreachable) returns the offline error AND leaves the Keychain key present + `machine.lic` BYTE-UNCHANGED — no local clear happens before the server delete confirms. Use the test harness to record key + machine.lic bytes before, attempt the offline deactivate, assert the error and that key + bytes are identical after. This pins D-79 (the never-orphan-a-seat invariant) at the Rust level, independent of the Plan-04 UI/e2e walkthrough.
    - No new UI here — Plan 04 maps `suspended` + `refreshNeeded` to the one calm "Pro is no longer active" copy (D-83); Plan 04 also surfaces the D-79 calm offline-deactivate message, but the no-clear invariant itself is now pinned by THIS plan's cargo test.
  </action>
  <verify>
    <automated>cd src-tauri && cargo test license:: 2>&1 | grep -q "test result: ok"</automated>
  </verify>
  <acceptance_criteria>
    - mod.rs (or keygen_client tests) contains a test exercising a revoked/suspended refresh that does not panic and yields a typed error
    - the write-after-verify invariant test confirms a bad/revoked checkout writes no cert (`cert_writes` empty)
    - D-79 PINNED BY A CARGO TEST (not just UI/e2e/walkthrough): a test proves an offline `deactivate()` returns the offline/service-unreachable error AND leaves the Keychain key + `machine.lic` byte-unchanged (no local clear before the server-delete confirms) — grep mod.rs for the test name
    - `cargo test license::` exits 0
    - `suspended` is a reachable LicenseError on the refresh path (grep keygen_client.rs / mod.rs)
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 4: Committed infra/ admin seat-release helper (D-81) + RUNBOOK</name>
  <read_first>
    - infra/keygen/RUNBOOK.md (the Phase-20 human runbook — append a seat-release section in the same voice)
    - infra/keygen/setup.sh + infra/keygen/deploy.sh (the established infra script shape: idempotent, privileged token server-side, CE admin API on localhost)
    - .planning/phases/21-license-lifecycle-ship-gate/21-CONTEXT.md (D-80 contact fallback, D-81 helper by key/orderId, D-55 privileged token server-side)
  </read_first>
  <action>
    Create `infra/keygen/release-seat.sh` — an idempotent admin helper that frees a seat so a buyer who lost their old device can reactivate (the D-80 "reply to your license email" fallback made one command):
    - Accepts `--key <license-key>` OR `--order-id <ls-order-id>` (resolve a license by either). Usage/`-h` prints both forms.
    - Runs against the CE admin API on **localhost** (the script is meant to run ON the VPS over SSH — `ssh tinkerdev-box 'bash -s' < release-seat.sh ...` or copied + run there). The privileged Keygen admin token is read from the server-side env (e.g. `KEYGEN_ADMIN_TOKEN` already on the box from Phase 20 setup) — NEVER hardcoded, NEVER passed from the client (D-55).
    - Logic: resolve the license (by key via validate, or by `metadata[orderId]` search — mirror the webhook's searchByOrderId filter), list its machines, DELETE each machine (frees the seat). Idempotent: zero machines -> succeed with "already free" message; never error on a no-op.
    - Fail loud on a missing token or an unresolvable key/order. Echo the resolved license id + machine count before/after.
    - Match the Phase-20 script conventions (set -euo pipefail, curl against the CE base URL, jq for parsing if jq is the established tool — check the other scripts).
    Append a "Freeing a seat (lost-device transfer fallback)" section to infra/keygen/RUNBOOK.md: when to use it (D-80 support email), the exact SSH command, and the expected output. Note this is the manual-but-repeatable path until the deferred admin dashboard lands.
    This is glue/ops scripting — no unit test framework for bash; verify by `bash -n` (syntax) + a `--help`/dry-run path.
  </action>
  <verify>
    <automated>bash -n infra/keygen/release-seat.sh && grep -q "release-seat\|Freeing a seat" infra/keygen/RUNBOOK.md && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - `infra/keygen/release-seat.sh` exists; `bash -n infra/keygen/release-seat.sh` exits 0 (valid syntax)
    - the script reads the admin token from env, never a hardcoded token: `grep -i "token" infra/keygen/release-seat.sh` shows only `$KEYGEN_ADMIN_TOKEN`-style env reads, no literal token
    - the script accepts both `--key` and `--order-id` (grep both flags)
    - `grep -i "set -euo pipefail" infra/keygen/release-seat.sh` matches (fail-loud)
    - RUNBOOK.md contains a seat-release section (`grep -i "freeing a seat\|release-seat" infra/keygen/RUNBOOK.md`)
  </acceptance_criteria>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| webhook → Keygen (email in license) | The buyer email becomes license metadata; it later round-trips to the client via the signed cert. |
| Keychain key → masked-key payload | The raw key is read Rust-side to mask; only the masked form crosses to JS (LIC-04). |
| operator SSH → CE admin API (localhost) | The privileged admin token frees seats; must stay server-side. |
| webview/UI → deactivate() (offline) | An offline deactivate must block and NEVER clear local state before the server delete confirms (D-79). |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-21-07 | Information disclosure | masked-key payload | mitigate | The raw key is read inside Rust and ONLY `mask_key()` output (`••••••••{last4}`) is placed in the payload — the full key never enters a serializable field (LIC-04 architecturally prior; test-pinned that get_key feeds only mask_key). |
| T-21-08 | Information disclosure | email in cert / payload | mitigate | The licensee email is the buyer's own address shown back to them + the support-lookup key; it is verified cert data (signed), not attacker-injectable. No third-party PII. Email field is the user's own — acceptable exposure to that user. |
| T-21-09 | Elevation | release-seat.sh admin token | mitigate | The privileged token is read from server-side env on the VPS only (D-55); the script is never client-reachable and never embeds the token. `check-dev-strip.sh`-style grep confirms no token literal committed. |
| T-21-10 | Spoofing (forged seat-release) | release-seat.sh resolve-by-key/order | accept | The helper runs only by an operator with SSH access to the box (already fully trusted); resolving by key/orderId then deleting machines is the intended privileged operation. No additional auth needed beyond SSH. |
| T-21-11 | Tampering | revoked cert on refresh | mitigate | Write-after-verify (Phase 19, re-tested here): a revoked/garbled checkout never overwrites the last-good machine.lic; the user simply ages into grace→RefreshNeeded (D-82 eventual consistency), never a crash or a forged-licensed state. |
| T-21-11b | Data-loss / Repudiation | offline deactivate (D-79) | mitigate | Server-delete-FIRST: an offline `deactivate()` rejects (`offline`/service-unreachable) BEFORE any local clear, so the Keychain key + machine.lic stay byte-unchanged and the seat is never orphaned. Now PINNED by a Task-3 cargo test (key+bytes identical before/after an offline deactivate), not only the Plan-04 UI walkthrough. |
</threat_model>

<verification>
- `cargo test license::` green (email extraction, mask_key, revocation/write-after-verify tests, the D-79 offline-deactivate no-clear test, and the keychain-at-most-once test still passing after masking).
- `tsc --noEmit -p server/webhook/tsconfig.json` + `vitest run server/webhook` green (email embedding); full webview `tsc --noEmit` + `vitest` green (TS union fields).
- `bash -n infra/keygen/release-seat.sh` clean; RUNBOOK updated.
- No token literal committed (grep). decoder.ts + 19 tests untouched.
- Live seat-release execution against the prod CE is a phase-boundary/ship-gate item (Plan 05, case 7 transfer) — this plan delivers the committed, syntax-valid, conventions-matching helper; the live run is gated on Phase 20 completion.
</verification>

<success_criteria>
- Email flows webhook → license → machine.lic → verified-cert → payload; masked key is Rust-computed and the raw key never reaches JS.
- Revocation propagates calmly via refresh (no crash, no forged state); the data for D-83's one calm state is present.
- The D-81 seat-release helper is committed, idempotent, token-server-side, and runbook-documented.
</success_criteria>

<output>
After completion, create `.planning/phases/21-license-lifecycle-ship-gate/21-03-SUMMARY.md`.
</output>
