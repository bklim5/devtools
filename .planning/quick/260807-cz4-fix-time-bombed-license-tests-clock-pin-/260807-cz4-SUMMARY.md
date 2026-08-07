---
phase: 260807-cz4
plan: 01
subsystem: license
tags: [rust, license, test-timing, clock-injection]
requires: []
provides: [refresh_if_needed_with_clock-seam, refresh_if_needed-clock-pinned-tests, far-future-regression-lock]
affects: [src-tauri/src/license/mod.rs]
tech-stack:
  added: []
  patterns: [clock-injection-seam-now-fn]
key-files:
  created: []
  modified: [src-tauri/src/license/mod.rs]
decisions:
  - "seam takes a clock FUNCTION (refresh_if_needed_with_clock(now_fn: impl Fn() -> DateTime<Utc>)), not a fixed instant — an await sits between the gate read and the non-success status reads, so each arm re-reads now_fn(), restoring the old two-read Utc::now() semantics exactly (xhigh F1)"
  - "non-success arms honor the debug-only dev_state_override via shared resolve_status_or_override_at; resolve_status() re-pointed to the same helper (single implementation, release byte-identical) (xhigh F2)"
  - "dead pub needs_refresh() removed (last production caller moved to the injected-clock seam); tests re-pointed to needs_refresh_at with pinned now (xhigh F7)"
  - "swallow-error test pinned to 2026-07-08 (inside renew-ahead window, pre-expiry) — genuinely drives the in-window refresh-attempt branch, with the checkout attempt now ASSERTED via the Recorder"
metrics:
  duration: "~15m"
  completed: 2026-08-07
requirements: [LIC-05, LIC-07]
---

# Phase 260807-cz4 Plan 01: Fix Time-Bombed License Tests (Clock Pin) Summary

Extended the D-73 clock-injection seam with a clock-function-taking `refresh_if_needed_with_clock(now_fn)` inner method (public `refresh_if_needed()` passes `Utc::now`), pinned the two time-bombed tests inside the fixture's validity window, and added a 2030 far-future regression lock plus a monotonicity-safe public-wrapper test — unblocking lefthook pre-push with production release semantics byte-identical to before.

## What Changed

**Seam (mod.rs ~519, final shape after xhigh review):**
- `pub async fn refresh_if_needed()` body is now `self.refresh_if_needed_with_clock(Utc::now).await` (public D-76 doc-comment kept, `needs_refresh()` references updated to `needs_refresh_at()`).
- New private `async fn refresh_if_needed_with_clock(&mut self, now_fn: impl Fn() -> DateTime<Utc>)`: the gate calls `now_fn()`, and EACH non-success arm calls `now_fn()` again for its returned status — a clock **function**, not a fixed instant, because the network `.await` sits between the gate read and the status reads (the old body read `Utc::now()` fresh for each; a grace boundary crossed during an in-flight attempt, e.g. a 60s timeout, must be reflected in the payload). Tests pass constant closures `|| at("...")` — fully pinned, wall-clock-independent.
- New shared `fn resolve_status_or_override_at(&mut self, now)`: honors the debug-only `#[cfg(debug_assertions)]` `dev_state_override` short-circuit before falling to `resolve_status_at(now, false)`. Used by BOTH `resolve_status()` (re-pointed, semantics identical) and the seam's non-success arms — so the dev/e2e override behaves identically on both paths, and release builds (override compiled out) are byte-identical to the pre-change body.
- Dead API removed: `pub fn needs_refresh()` (this change removed its last production caller; it was test-only). Its doc merged onto `needs_refresh_at`; the two tests using it re-pointed to `needs_refresh_at` with a pinned `now` (NotActivated/Problem are clock-independent classifications — any pin proves them).

**Pinned dates:**
- `refresh_if_needed_makes_no_network_call_when_not_needed` → **2026-06-14** (pre-renew-window: gate false, NoNetwork client never touched, stays Licensed).
- `refresh_if_needed_swallows_refresh_error_and_returns_prior_status` → **2026-07-08** (inside the 7-day renew-ahead window opening 2026-07-05, before 2026-07-12 expiry): gate true, the erroring checkout IS attempted — **asserted** via the Recorder (counting only calls after the test's earlier direct `refresh()`), then swallowed → exactly `Licensed` returned (OfflineGrace alternative dropped; pre-expiry pin makes it the only correct answer). The obsolete "~28 days from expiry / false by construction" workaround comment was deleted.
- `refresh_if_needed_with_clock_is_wall_clock_independent_far_future` → **2030-01-01** (Lapsed past grace → RefreshNeeded, gate true); checkout attempt asserted via the Recorder; scripted error swallowed → RefreshNeeded, never Err/panic. Proves the seam holds for any future date the fixture reaches (no `faketime` needed).
- `refresh_if_needed_public_wrapper_swallows_error_on_real_clock` → the ONE deliberate wall-clock test, covering the public wrapper (the only entry lib.rs scheduler + commands.rs use). Safe forever **by monotonicity**: real `now` is already past the fixture's grace end (2026-07-19) and only moves forward, so classification stays Lapsed → RefreshNeeded for any future run.

## xhigh Review Findings (7 confirmed; 6 fixed in `0958901b`, 1 out of scope)

| # | Finding | Fix |
|---|---------|-----|
| F1 | Error-swallow arm classified at the pre-await `now` (old body re-read `Utc::now()` after the failed attempt); "byte-identical" docstring claim was false | Seam takes `now_fn: impl Fn() -> DateTime<Utc>`; non-success arms re-read `now_fn()`; docstring rewritten accurately |
| F2 | Non-success arms bypassed the debug-only `dev_state_override` that the old `resolve_status()` honored (debug/e2e sessions would flip synthetic Licensed back to real status) | Shared `resolve_status_or_override_at` helper honors the override on both paths; rationalizing doc paragraph deleted |
| F3 | **NOT FIXED — pre-existing, out of scope** (see Known Pre-existing Issues) | — |
| F4 | Scripted tests claimed "refresh IS attempted" without asserting it (a wrongly-false gate would stay green) | Both swallow + far-future tests assert the Recorder captured a `checkout(` call (swallow test counts only post-`refresh()` calls) |
| F5 | Public `refresh_if_needed()` wrapper had zero test callers (yet is the only lib.rs/commands.rs entry) | New monotonicity-safe real-clock test asserting `RefreshNeeded` |
| F6 | Swallow test's `Licensed \| OfflineGrace` alternation was slack — pinned 2026-07-08 is pre-expiry, only `Licensed` is correct | Assertion tightened to `Licensed { .. }` only |
| F7 | `pub fn needs_refresh()` became dead API (test-only after this diff) | Removed; doc merged onto `needs_refresh_at`; tests re-pointed with pinned `now` |

## Known Pre-existing Issues (recorded, NOT fixed here)

- **F3:** `refresh_if_needed_with_clock`'s `Ok(fresh)` arm returns `verify_then_persist`'s unconditional `Licensed` without classifying the fresh cert's expiry against `now`. Pre-existing behavior (identical before this change); out of scope for this task.
- 5 e2e spec files (license drop-notice chain) started failing ~2026-07-14 from the same cert-expiry rot at the e2e layer — separate follow-up task.

## Audit Sign-off

The whole `mod tests` module was grepped for REAL_CERT + `Utc::now`-dependent assertions. Findings: **exactly TWO latent time bombs** (the original mod.rs:1755, 1769), both fixed. All other REAL_CERT tests are already clock-safe:
- status tests pin the clock via `resolve_status_at(at(...))`;
- wrong-fingerprint tests (~862, ~1174) resolve to `Problem` — verify fails before any date math;
- activate/refresh/deactivate tests return `Licensed` via `verify_then_persist`, which performs NO expiry classification.

(The new public-wrapper test is a deliberate, documented wall-clock test, safe by monotonicity — not a bomb.)

## Verification

- `cd src-tauri && cargo test`: **87 passed; 0 failed** (85 original + far-future regression lock + public-wrapper test). The far-future test IS the time-independence proof.
- `cargo check --release`: clean (removed pub fn + cfg-gated override compile fine in release).
- Diff is **Rust-only**: all three commits touch only `src-tauri/src/license/mod.rs`.
- `fixtures/ce-machine.lic` + `src/lib/decoder.ts` byte-untouched.
- Public API surface: `refresh_if_needed()` signature unchanged; release semantics byte-identical (F1/F2 restored the exact old two-read + override-honoring behavior; the only removed symbol, `needs_refresh()`, had no production callers).
- lefthook pre-commit (tsc/vitest/lint) green on all three commits — Rust-only change leaves the JS/TS gates untouched.

## Harness Applicability

Per the CLAUDE.md binding harness: Rust-only, test-timing fix with NO webview or native-window surface — harness step 5 (real-WKWebView + native-chrome capture) and both-channel `tauri build` are **N/A**. Applicable gates run: `/code-review xhigh` (7 findings, 6 fixed, 1 recorded pre-existing) + `cargo test` green + `cargo check --release` clean + lefthook green.

## Deviations from Plan

- The plan's `refresh_if_needed_at(now)` fixed-instant seam was superseded mid-execution by the coordinator's xhigh review (F1): a fixed instant is stale across the await, so the landed shape is `refresh_if_needed_with_clock(now_fn)`. The plan's key_link pattern `refresh_if_needed_at\(Utc::now\(\)\)` is intentionally NOT present — the wrapper passes `Utc::now` as the clock function instead, which is the corrected form of the same delegation.
- Otherwise executed as written; `ScriptedClient.checkout` field name matched the file.

## Out of Scope (recorded)

- HEAD carried an unpushed release commit v1.0.1 + tag; this fix lands on top as normal commits. Not pushed.

## Commits

- `20b0d9e3` fix(260807-cz4): pin clock in refresh_if_needed tests via injectable seam
- `1cda667e` test(260807-cz4): add far-future (2030) regression lock for refresh_if_needed_at
- `0958901b` fix(260807-cz4): address xhigh review findings on clock seam

## Self-Check: PASSED

- FOUND commits `20b0d9e3`, `1cda667e`, `0958901b`
- FOUND `src-tauri/src/license/mod.rs` with `fn refresh_if_needed_with_clock`
- `cargo test` 87/87 green; `cargo check --release` clean
