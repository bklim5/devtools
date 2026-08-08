---
phase: 21
plan: 01
type: tdd
wave: 1
depends_on: []
files_modified:
  - src-tauri/src/license/config.rs
  - src-tauri/src/license/mod.rs
autonomous: true
requirements: [LIC-05]
must_haves:
  truths:
    - "resolve_status compares the cert expiry vs now and returns OfflineGrace while within the 7-day grace past expiry"
    - "resolve_status returns RefreshNeeded once the grace window has lapsed (cert past expiry + 7 days)"
    - "A still-valid (not-yet-expired) cert continues to resolve to Licensed exactly as before"
    - "Local verify stays fully offline — no network call is added to resolve_status"
  artifacts:
    - path: "src-tauri/src/license/config.rs"
      provides: "TTL/grace/poll constants (TTL_DAYS=30, RENEW_AHEAD_DAYS=7, GRACE_DAYS=7, POLL_INTERVAL_HOURS=24)"
      contains: "GRACE_DAYS"
    - path: "src-tauri/src/license/mod.rs"
      provides: "OfflineGrace + RefreshNeeded variants on LicenseStatusPayload, expiry-aware resolve_status, needs_refresh helper"
      contains: "OfflineGrace"
  key_links:
    - from: "src-tauri/src/license/mod.rs resolve_status"
      to: "verify_machine_file LicenseData.expiry"
      via: "parse RFC3339 expiry, compare to now"
      pattern: "expiry"
    - from: "resolve_status"
      to: "config::GRACE_DAYS"
      via: "grace-window math"
      pattern: "GRACE_DAYS"
---

<objective>
Make the Rust `resolve_status` TTL/expiry-aware (D-73), adding the two new lifecycle states **OfflineGrace** and **RefreshNeeded** to `LicenseStatusPayload`, and land the tunable TTL/grace/poll constants (D-74/D-75). This is the pure-Rust lifecycle core: it stays fully offline (D-45 — zero network added to `resolve_status`) and decides Pro-active-vs-dropped purely from the locally-verified cert's embedded `expiry` vs the current clock.

Purpose: LIC-05's offline-grace model — a normally-connected user renews ahead (Plan 02) and never sees these states; grace exists only for the genuinely-long-offline case. This plan is the state machine those decisions feed.
Output: Extended `LicenseStatusPayload` enum (5 states), expiry-comparison logic in `resolve_status`, a `needs_refresh()` helper Plan 02's scheduler consumes, and the constants block. All TDD with cargo tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/21-license-lifecycle-ship-gate/21-CONTEXT.md

<interfaces>
<!-- The exact shapes this plan extends. resolve_status currently returns 3 states;
     verify_machine_file already surfaces `expiry: Option<String>` verbatim (RFC3339,
     e.g. "2026-07-12T15:14:47.247Z") but does NOT enforce it (verify.rs line ~49, A6). -->

Current LicenseStatusPayload (src-tauri/src/license/mod.rs:28) — serde camelCase, tag="state":
  NotActivated { has_stored_key: bool }                      -> {"state":"notActivated","hasStoredKey":...}
  Licensed { expiry: Option<String>, entitlements: Vec<String> } -> {"state":"licensed","expiry":...,"entitlements":[...]}
  Problem { problem: ProblemKind, has_stored_key: bool }     -> {"state":"problem","problem":...,"hasStoredKey":...}

verify_machine_file -> Ok(LicenseData { expiry: Option<String>, issued, fingerprint, entitlements })
  expiry is RFC3339 UTC ("...Z"); already test-proven surfaced verbatim, NOT enforced (verify.rs test `expired_cert_still_verifies_expiry_surfaced_verbatim`).

Available time/date crate: `chrono` is NOT yet a dep. Prefer `time` if already present; else add `chrono` (Rust dep — allowed; webview-dep ban does not apply to src-tauri). Check Cargo.toml first.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add TTL/grace/poll constants to config.rs</name>
  <read_first>
    - src-tauri/src/license/config.rs (the per-env constants file; add the tunables near the bottom, NOT inside the cfg-split arms — these are profile-invariant)
    - .planning/phases/21-license-lifecycle-ship-gate/21-CONTEXT.md (D-74/D-75 exact values)
  </read_first>
  <behavior>
    - Test: TTL_DAYS == 30, RENEW_AHEAD_DAYS == 7, GRACE_DAYS == 7, POLL_INTERVAL_HOURS == 24.
    - Test: RENEW_AHEAD_DAYS < TTL_DAYS (renew-ahead window opens before expiry).
  </behavior>
  <action>
    Add four profile-invariant `pub const` values to config.rs (these are NOT cfg-split — identical dev and release):
    `pub const TTL_DAYS: i64 = 30;` (D-74 cache TTL),
    `pub const RENEW_AHEAD_DAYS: i64 = 7;` (D-74 renew within 7 days of expiry),
    `pub const GRACE_DAYS: i64 = 7;` (D-75 tight grace past expiry),
    `pub const POLL_INTERVAL_HOURS: u64 = 24;` (D-76 periodic poll cadence).
    Doc-comment each with its decision id and the "worst-case revocation exposure ≈ 37 days" rationale (TTL margin + grace). Add a `#[cfg(test)]` test asserting the four values and the `RENEW_AHEAD_DAYS < TTL_DAYS` invariant. Do NOT touch the cfg(debug_assertions) host/account/pubkey arms or APP_SALT.
  </action>
  <verify>
    <automated>cd src-tauri && cargo test license::config 2>&1 | grep -q "test result: ok"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "GRACE_DAYS\|RENEW_AHEAD_DAYS\|TTL_DAYS\|POLL_INTERVAL_HOURS" src-tauri/src/license/config.rs` returns >= 4
    - `cargo test license::config` exits 0
    - APP_SALT line in config.rs is byte-identical (`grep "e14f0d16" src-tauri/src/license/config.rs` still matches)
  </acceptance_criteria>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add OfflineGrace + RefreshNeeded variants and make resolve_status expiry-aware</name>
  <read_first>
    - src-tauri/src/license/mod.rs (LicenseStatusPayload enum line 28-41; resolve_status line 166-182; the serde-contract test `serde_json_shapes_are_the_pinned_ts_contract` line ~558; existing pure-local mock tests using REAL_CERT/REAL_FP)
    - src-tauri/src/license/verify.rs (LicenseData.expiry shape, RFC3339 format, the `expired_cert_still_verifies` test)
    - src-tauri/src/license/config.rs (the constants from Task 1)
    - src-tauri/Cargo.toml (confirm whether chrono/time is a dep before importing)
  </read_first>
  <behavior>
    - Test: a cert whose expiry is in the FUTURE -> Licensed { expiry, entitlements } (unchanged behavior — use REAL_CERT with an injected "now" before its 2026-07-12 expiry).
    - Test: a cert past expiry but within GRACE_DAYS (now = expiry + 3 days) -> OfflineGrace { expiry, entitlements } (Pro still active).
    - Test: a cert past expiry + GRACE_DAYS (now = expiry + 8 days) -> RefreshNeeded { has_stored_key } (dropped to free).
    - Test: boundary — now exactly at expiry resolves Licensed/OfflineGrace deterministically (document the inclusive edge; recommend `now <= expiry` => Licensed).
    - Test: a cert with expiry = None (no expiry field) -> Licensed (treat absent expiry as non-expiring; never crash).
    - Test: corrupt/foreign/tampered cert still -> Problem (verify failure precedes any expiry check).
    - Test: serde JSON shape pins — OfflineGrace -> `{"state":"offlineGrace","expiry":...,"entitlements":[...]}`; RefreshNeeded -> `{"state":"refreshNeeded","hasStoredKey":...}`.
    - Test: D-45 — resolve_status with the NoNetwork client never panics (no network on the expiry path).
  </behavior>
  <action>
    1. Extend `LicenseStatusPayload` (mod.rs) with two variants, both `#[serde(rename_all = "camelCase")]`:
       `OfflineGrace { expiry: Option<String>, entitlements: Vec<String> }` (Pro active, cert past expiry, within grace),
       `RefreshNeeded { has_stored_key: bool }` (Pro dropped to free, grace lapsed).
       These serialize with `tag="state"` to `"offlineGrace"` and `"refreshNeeded"` respectively.
    2. Make `resolve_status` expiry-aware. On a successful `verify_machine_file` (the `Ok(data)` arm at line 173), branch on `data.expiry`:
       - `None` => Licensed (non-expiring).
       - `Some(exp)` parse as RFC3339. If parse fails => Licensed (fail-OPEN on unparseable date — a verified cert is trusted; never downgrade a verified user on a date-format quirk; document this).
       - Let `now = <current UTC>`. If `now <= expiry` => Licensed.
       - Else if `now <= expiry + GRACE_DAYS days` => OfflineGrace.
       - Else => RefreshNeeded { has_stored_key: self.has_stored_key() }.
       Use the per-process `has_stored_key()` for the RefreshNeeded arm (same Keychain-cache discipline as NotActivated/Problem — RefreshNeeded is a dropped state that may offer reactivation).
    3. Inject "now" testably: add a private `fn now_utc() -> <DateTime>` OR make the expiry-comparison a pure helper `fn classify_expiry(expiry: Option<&str>, now: DateTime, has_stored_key: bool) -> LicenseStatusPayload`-style function that resolve_status calls with the real clock — tests call the pure helper with a fixed `now`. The pure-helper approach is preferred (deterministic, no clock mocking).
    4. Add a `pub fn needs_refresh(&mut self) -> bool` helper: returns true when the current status is OfflineGrace or RefreshNeeded, OR Licensed-but-within-RENEW_AHEAD_DAYS of expiry (D-74 renew-ahead). Plan 02's scheduler consumes this to decide whether to attempt a background refresh. Cover with tests (within renew window -> true; freshly licensed far from expiry -> false; OfflineGrace -> true; NotActivated -> false).
    5. Update the existing `serde_json_shapes_are_the_pinned_ts_contract` test to add the two new variant shapes.
    6. If chrono/time is not a dep, add `chrono = { version = "0.4", default-features = false, features = ["clock"] }` to src-tauri/Cargo.toml (Rust dep, allowed). Run `cargo build` to confirm it resolves.
  </action>
  <verify>
    <automated>cd src-tauri && cargo test license:: 2>&1 | grep -q "test result: ok" && cargo build 2>&1 | tail -1</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "OfflineGrace\|RefreshNeeded" src-tauri/src/license/mod.rs` returns >= 4 (2 variant defs + match arms + tests)
    - `grep "offlineGrace" src-tauri/src/license/mod.rs` matches (serde rename pinned in the contract test)
    - `grep "refreshNeeded" src-tauri/src/license/mod.rs` matches
    - `src-tauri/src/license/mod.rs` contains `fn needs_refresh`
    - `cargo test license::` exits 0 with the new tests present (grep run output for `offlineGrace` shape assertion)
    - resolve_status still contains the existing `verify_machine_file(...)` call and NO new `client.`/`.await` network call on the status path (grep resolve_status body shows zero `self.client`)
    - The decoder is untouched: `git diff --stat src/lib/protobuf/decoder.ts` is empty
  </acceptance_criteria>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| local clock → grace decision | The OS clock is the untrusted input deciding Pro-active-vs-dropped; a user can roll it back to stay in grace. |
| machine.lic (on disk) → resolve_status | Already a Phase-19 boundary; this plan adds expiry parsing on the verified dataset only. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-21-01 | Tampering (clock rollback) | resolve_status expiry compare | accept | Accepted by design — webview/local gating is UX-gating not DRM (PROJECT.md locked); a determined user rolling the clock back only extends grace; the real seat binding (server-side fingerprint) is unaffected. Worst case ≈ a free upgrade window, not a security breach. Documented, no obfuscation. |
| T-21-02 | Elevation (downgrade-on-quirk) | RFC3339 parse failure path | mitigate | Fail-OPEN on an unparseable expiry (stay Licensed) so a verified paying user is NEVER downgraded by a date-format edge; a verified signature already proves authenticity, so trusting it on a parse quirk is correct. Test-pinned. |
| T-21-03 | Denial (panic on bad date) | expiry parsing | mitigate | All parsing is `Result`-handled; no `.unwrap()` on the cert-derived expiry string — a malformed date returns Licensed, never panics (test: `None` and unparseable cases). |
</threat_model>

<verification>
- `cargo test license::` passes (all new expiry/grace/needs_refresh tests + the extended serde contract).
- `cargo test --release license::config` still tripwire-gated (placeholder pubkey) — this plan does not touch the prod constants, so the release tripwire status is unchanged.
- `tsc --noEmit` + `vitest` unaffected (no TS touched this plan) — run the full lefthook gate (`pnpm lint` + `tsc` + `vitest`) to confirm green.
- decoder.ts + its 19 tests byte-for-byte untouched.
</verification>

<success_criteria>
- LicenseStatusPayload has 5 states; resolve_status returns OfflineGrace within grace and RefreshNeeded after, Licensed otherwise — all proven by cargo tests with an injected `now`.
- The constants (TTL/grace/renew/poll) are committed and test-asserted.
- `needs_refresh()` exists and is correct for Plan 02 to consume.
- Zero network added to the status path (D-45 intact).
</success_criteria>

<output>
After completion, create `.planning/phases/21-license-lifecycle-ship-gate/21-01-SUMMARY.md`.
</output>
