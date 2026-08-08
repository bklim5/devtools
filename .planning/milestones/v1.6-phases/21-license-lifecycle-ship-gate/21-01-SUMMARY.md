---
phase: 21
plan: 01
subsystem: licensing-core
tags: [rust, license, lifecycle, expiry, offline-grace, chrono]
requires:
  - "Phase 19 license core: verify_machine_file (LicenseData.expiry, RFC3339), LicenseStatusPayload, resolve_status"
  - "config.rs per-env constants + verifying_key()"
provides:
  - "LicenseStatusPayload now 5 states: + OfflineGrace + RefreshNeeded (serde offlineGrace/refreshNeeded)"
  - "expiry-aware resolve_status (verify -> classify_expiry(now) -> Licensed | OfflineGrace | RefreshNeeded)"
  - "needs_refresh() helper (Plan 02 scheduler consumes)"
  - "config::TTL_DAYS / RENEW_AHEAD_DAYS / GRACE_DAYS / POLL_INTERVAL_HOURS constants"
affects:
  - "Plan 02 (background refresh scheduler) consumes needs_refresh() + the constants"
  - "Plan 03/04 status UI maps the 2 new states (offlineGrace -> Pro active; refreshNeeded -> Pro off)"
tech-stack:
  added:
    - "chrono 0.4 (default-features=false, features=[clock]) — Rust dep, src-tauri only"
  patterns:
    - "pure injected-now helper (classify_expiry/within_renew_ahead) — deterministic, no clock mocking"
    - "fail-OPEN on unparseable/absent expiry; fail-closed on verify (Problem precedes expiry)"
key-files:
  created: []
  modified:
    - "src-tauri/src/license/config.rs"
    - "src-tauri/src/license/mod.rs"
    - "src-tauri/Cargo.toml"
    - "src-tauri/Cargo.lock"
decisions:
  - "D-73 implemented via a pure classify_expiry(now) returning Active|Grace|Lapsed; resolve_status maps to Licensed|OfflineGrace|RefreshNeeded"
  - "Inclusive boundaries: now==expiry -> Active; now==expiry+GRACE_DAYS -> Grace; strictly beyond -> Lapsed"
  - "Fail-OPEN on absent/unparseable expiry (verified cert never downgraded on a date quirk) — T-21-02/03"
  - "needs_refresh: true in grace/lapsed OR within RENEW_AHEAD_DAYS of expiry; within_renew_ahead fail-closed (false) on absent/unparseable"
metrics:
  duration: ~25m
  completed: 2026-06-14
  tasks: 2
  commits: 2
  cargo_license_tests: 66
---

# Phase 21 Plan 01: Expiry-Aware resolve_status Summary

Made the Rust license core TTL/expiry-aware (D-73): `resolve_status` now compares the locally-verified cert's embedded `expiry` against the clock and resolves to one of five states — adding **OfflineGrace** (Pro active, past expiry, within the 7-day grace) and **RefreshNeeded** (Pro dropped, grace lapsed) — and landed the tunable TTL/grace/renew/poll constants plus a `needs_refresh()` helper for Plan 02's scheduler. Fully offline (D-45 — zero network added to the status path); all date math is in pure injected-`now` helpers (deterministic, no clock mocking).

## What Was Built

**Task 1 — lifecycle constants (`config.rs`, commit `73429583`):**
- `TTL_DAYS=30`, `RENEW_AHEAD_DAYS=7`, `GRACE_DAYS=7`, `POLL_INTERVAL_HOURS=24` — profile-invariant `pub const`s (NOT cfg-split), doc-commented with decision ids + the ~37-day worst-case revocation-exposure rationale.
- Tests pin the four values and the `RENEW_AHEAD_DAYS < TTL_DAYS` invariant.
- APP_SALT and the cfg-split dev/release arms byte-identical (A5 / D-52 untouched).

**Task 2 — expiry-aware state machine (`mod.rs`, commit `ee61c00a`):**
- Two new `LicenseStatusPayload` variants: `OfflineGrace { expiry, entitlements }` -> `{"state":"offlineGrace",...}`, `RefreshNeeded { has_stored_key }` -> `{"state":"refreshNeeded",...}`. The serde contract test now pins both.
- `resolve_status` Ok-arm branches via the pure `classify_expiry(expiry, now) -> ExpiryClass {Active|Grace|Lapsed}`: Active->Licensed, Grace->OfflineGrace, Lapsed->RefreshNeeded (uses the per-process stored-key flag, same Keychain discipline). Verify still gates the expiry branch — a tampered/foreign cert stays `Problem`.
- `needs_refresh(&mut self) -> bool` (Plan 02 scheduler): true for OfflineGrace/RefreshNeeded, or Licensed-within-`RENEW_AHEAD_DAYS` (via pure `within_renew_ahead`); false for fresh-far-from-expiry / NotActivated / Problem.
- Added `chrono 0.4` (`clock` feature only) for `Utc::now()` + RFC3339 parse.

## Verification

- `cargo test license::` — **66/66 pass** (config 5/5 incl. new tunable tests; mod tests incl. classify Active/Grace/Lapsed, inclusive boundaries, fail-OPEN absent+unparseable, within_renew_ahead window, resolve_status Active->Licensed + Problem-precedes-expiry, D-45 NoNetwork no-panic, needs_refresh arms, extended serde contract).
- `cargo build` clean — no lifecycle dead-code warnings (`needs_refresh`/`within_renew_ahead` carry documented `#[allow(dead_code)]` until Plan 02 wires them).
- Full lefthook webview gate green at commit: tsc clean, **vitest 889/889**, eslint 0 errors (2 pre-existing warnings in `SidebarResetMenu.tsx`, untouched/out-of-scope).
- No TS touched this plan; `decoder.ts` + its 19 tests byte-for-byte untouched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `#[allow(dead_code)]` on the two not-yet-wired helpers**
- **Found during:** Task 2 (`cargo build`)
- **Issue:** `needs_refresh` (pub) and `within_renew_ahead` (private) warn dead-code — Plan 02's scheduler is their only runtime consumer and isn't wired yet. The module's earlier blanket `#![allow(dead_code)]` (Phase 19-02) was removed in 19-03.
- **Fix:** Targeted `#[allow(dead_code)]` on each with a "Plan 02 scheduler, not yet wired; tests exercise it now" doc note (matches the 19-02 precedent of deferring usage to the implementing plan).
- **Files modified:** `src-tauri/src/license/mod.rs`
- **Commit:** `ee61c00a`

## Threat Model Notes

- **T-21-02 (downgrade-on-quirk):** mitigated — `classify_expiry` returns `Active` on absent/unparseable expiry (fail-OPEN); a verified signature already proves authenticity, so a date-format edge never downgrades a paying user. Test-pinned (`classify_unparseable_expiry_is_active_fail_open`, `classify_absent_expiry_is_active_fail_open`).
- **T-21-03 (panic on bad date):** mitigated — all parsing is `Result`/`Option`-handled, no `.unwrap()` on cert-derived strings; junk dates return `Active`, never panic.
- **T-21-01 (clock rollback):** accepted by design (UX-gating, not DRM) — unchanged by this plan.

## Self-Check: PASSED

- FOUND: src-tauri/src/license/config.rs (modified)
- FOUND: src-tauri/src/license/mod.rs (modified)
- FOUND: commit 73429583
- FOUND: commit ee61c00a
- grep OfflineGrace|RefreshNeeded in mod.rs = 19 (>=4)
- grep offlineGrace / refreshNeeded / `fn needs_refresh` in mod.rs all match
- config.rs GRACE_DAYS|RENEW_AHEAD_DAYS|TTL_DAYS|POLL_INTERVAL_HOURS grep = 12 (>=4)
- APP_SALT `e14f0d16` still matches (byte-identical)
