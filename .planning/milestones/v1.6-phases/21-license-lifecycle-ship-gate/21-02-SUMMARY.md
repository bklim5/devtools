---
phase: 21
plan: 02
subsystem: licensing-lifecycle
tags: [rust, tauri, scheduler, license, lifecycle, offline-grace, tokio, ts-contract]
requires:
  - "Plan 21-01: needs_refresh() helper, OfflineGrace/RefreshNeeded variants, POLL_INTERVAL_HOURS const"
  - "Phase 19: LicenseManager::refresh()/resolve_status(), LicenseState managed singleton, 4-command surface"
provides:
  - "LicenseManager::refresh_if_needed() — silent, needs_refresh-gated, error-swallowing scheduler entry point"
  - "refresh_license_if_needed Tauri command (always Ok — scheduler-only, never user-facing)"
  - "lib.rs background scheduler: launch trigger + 24h tokio interval poll, fire-and-forget (no first-paint block)"
  - "TS LicenseStatusPayload is a faithful 5-state mirror (+ offlineGrace + refreshNeeded)"
  - "payloadsEqual covers all 5 states"
affects:
  - "Plan 04 status UI subscribes to the fresh on-disk state the scheduler maintains; wires the license://refreshed live-flip event (TODO marker left)"
  - "Plan 04 consumers (footer, status route) read the widened union"
tech-stack:
  added:
    - "tokio 1 (default-features=false, features=[time]) — Rust dep, src-tauri only; already in the Tauri tree, declared direct for interval/sleep"
  patterns:
    - "fire-and-forget tauri::async_runtime::spawn in setup() — never blocks first paint"
    - "single tokio::time::interval: immediate first tick = launch trigger, subsequent = poll (no double-fire)"
    - "the refresh network call's own offline result IS the connectivity signal (no separate probe, D-38)"
    - "silent refresh: every error swallowed, prior resolve_status returned, state untouched (D-76/D-77)"
key-files:
  created: []
  modified:
    - "src-tauri/src/license/mod.rs"
    - "src-tauri/src/license/commands.rs"
    - "src-tauri/src/license/config.rs"
    - "src-tauri/src/lib.rs"
    - "src-tauri/Cargo.toml"
    - "src-tauri/Cargo.lock"
    - "src/lib/platform/index.ts"
    - "src/lib/license/licenseUi.ts"
    - "src/lib/license/licenseUi.test.ts"
    - "src/components/UpsellPanel.tsx"
decisions:
  - "D-76 silent scheduler: refresh_if_needed swallows EVERY error (offline/service down/no key/verify fail) — never propagates, command always returns Ok"
  - "No separate connectivity probe — needs_refresh() gates whether to try; if offline, refresh() returns Offline and is swallowed (the call's own result is the online check)"
  - "Single tokio::time::interval consumes its immediate first tick as the launch trigger (after a 2s paint delay), subsequent ticks as the 24h poll — guarantees no launch/first-poll double-fire"
  - "tokio declared direct (time feature only) — already transitively present via Tauri; the spawned task runs on Tauri's own async_runtime, no second runtime"
  - "license://refreshed live-flip event deferred to Plan 04 (clear TODO marker) — non-blocking nice-to-have for the long-uptime window; Plan 04's status-open + explicit-Refresh already read the fresh disk state"
metrics:
  duration: ~35m
  completed: 2026-06-14
  tasks: 3
  commits: 3
  cargo_license_tests: 69
  vitest: 893
---

# Phase 21 Plan 02: Background Refresh Scheduler + 5-State TS Mirror Summary

Wired the opportunistic background license-refresh scheduler (D-76, LIC-05) and propagated Plan 01's two new lifecycle states across the Rust→TS contract. A fire-and-forget `tauri::async_runtime::spawn` task in `setup()` attempts a refresh at launch (after a 2s first-paint delay) and on a 24h `tokio::time::interval` poll — both funnelling through the new silent `refresh_if_needed()`, which is `needs_refresh()`-gated (zero network when the cert is fresh) and swallows every error (a failed attempt leaves state untouched, no toast, no launch interruption). The TS `LicenseStatusPayload` union and `payloadsEqual` change-detector now faithfully mirror the Rust 5-state enum (`offlineGrace` + `refreshNeeded` added). No first-paint block, no per-launch hard network check — the v1.6 amendment is honored.

## What Was Built

**Task 1 — silent `refresh_if_needed` manager method + command (`mod.rs` + `commands.rs` + `lib.rs`, commit `d779c68b`):**
- `LicenseManager::refresh_if_needed(&mut self) -> LicenseStatusPayload`: calls `needs_refresh()`; false → returns `resolve_status()` with ZERO network (common connected-and-fresh case); true → attempts `refresh().await`, returns the fresh payload on Ok, SWALLOWS every Err and returns the prior `resolve_status()` (D-76). Never returns an error — the scheduler can't surface failure.
- Online detection is the refresh call's own `LicenseError::Offline` classification (D-38) — no separate connectivity probe; documented inline.
- `#[tauri::command] refresh_license_if_needed` (returns `Result<_, ()>`, always `Ok`) — scheduler-only; the user-triggered `refresh_license` (which DOES surface errors) is left intact for Plan 04's explicit Refresh button.
- Registered in the lib.rs `invoke_handler` beside the existing 4 commands (now 5).
- Removed the now-stale `#[allow(dead_code)]` from `needs_refresh` + `within_renew_ahead` (both are now runtime-reachable via the scheduler).
- 3 cargo tests: no-network-when-fresh (NoNetwork client never panics), swallow-error (erroring checkout → prior Licensed returned, no Err), fresh-on-success.

**Task 2 — launch + 24h-poll scheduler (`lib.rs` + `Cargo.toml` + `config.rs`, commit `158aca6e`):**
- After `app.manage(LicenseState(...))`, a `tauri::async_runtime::spawn` fire-and-forget task: `app.handle().clone()`, a 2s `tokio::time::sleep` for first paint, then a single `tokio::time::interval(POLL_INTERVAL_HOURS * 3600)` loop. The interval's immediate first tick is the launch trigger; subsequent ticks the 24h poll — no double-fire. Each iteration locks `LicenseState` via `handle.state::<LicenseState>()` and calls `refresh_if_needed()` (result discarded server-side).
- `TODO(21-04)` marker for the `license://refreshed` live-flip event (Plan 04 wires it; non-blocking).
- `tokio = { version = "1", default-features = false, features = ["time"] }` added (Rust-only; already in the Tauri tree).
- `setup()` returns immediately — no `.await`/`block_on` of the scheduler; first paint never blocked.

**Task 3 — 5-state TS mirror + change-detector (`index.ts` + `licenseUi.ts` + test + `UpsellPanel.tsx`, commit `bf40d158`):**
- `LicenseStatusPayload` gains `{ state: "offlineGrace"; expiry; entitlements }` and `{ state: "refreshNeeded"; hasStoredKey }` — exact serde mirror of the Rust shapes; doc comment notes the 5-state contract.
- `payloadsEqual` gains structural-equality arms for both (offlineGrace compares expiry+entitlements like licensed; refreshNeeded compares hasStoredKey like notActivated).
- 4 vitest cases: offlineGrace + refreshNeeded propagate and change-detect (identical re-set is a no-op); a grace→refreshNeeded change notifies; an entitlements-only diff is a change.

## Verification

- `cargo test license::` — **69/69 pass** (66 from Plan 01 + 3 new refresh_if_needed tests).
- `cargo build` — **0 warnings** (POLL_INTERVAL_HOURS now consumed by the scheduler; TTL_DAYS given a documented `#[allow(dead_code)]` — server-enforced, config-test-only).
- `pnpm exec tsc --noEmit` — clean (after the union-widening fallout fix in UpsellPanel).
- `pnpm exec vitest run` — **893/893** (+4 new license cases; was 889).
- Full lefthook webview gate green on all 3 commits (typecheck + test + lint). The 2 pre-existing `SidebarResetMenu.tsx` lint warnings are untouched/out-of-scope.
- `decoder.ts` + its 19 tests byte-for-byte untouched (`git diff --stat src/lib/protobuf/` empty).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] UpsellPanel `hasStoredKey` check broke on the widened union**
- **Found during:** Task 3 (`tsc --noEmit`)
- **Issue:** `UpsellPanel.tsx:111` read `ui.state !== "licensed" && ui.hasStoredKey`. The new `offlineGrace` state ALSO lacks `hasStoredKey` (it carries expiry+entitlements like licensed), so the `!== "licensed"` branch no longer guaranteed the field exists — TS2339.
- **Fix:** Made the check state-precise — `hasStoredKey` is true only for the three states that actually carry it (`notActivated | problem | refreshNeeded`).
- **Files modified:** `src/components/UpsellPanel.tsx`
- **Commit:** `bf40d158`

**2. [Rule 3 - Blocking] tokio not a direct dependency**
- **Found during:** Task 2 (`cargo build` — `E0433: cannot find module tokio`)
- **Issue:** `tokio::time::{interval, sleep}` are needed for the scheduler but tokio was only a transitive dep (via Tauri); `tauri::async_runtime` does not re-export the timer primitives.
- **Fix:** Declared `tokio = { version = "1", default-features = false, features = ["time"] }` directly. It is already in the lock tree (1.52.3), so no new transitive crates; the spawned task still runs on Tauri's own runtime. Rust-only — the webview zero-new-dep wedge does not apply to src-tauri.
- **Files modified:** `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`
- **Commit:** `158aca6e`

**3. [Rule 3 - Blocking] `TTL_DAYS` dead-code warning in `cargo build`**
- **Found during:** Task 2 (`cargo build`)
- **Issue:** Once `POLL_INTERVAL_HOURS` was consumed by the scheduler, `TTL_DAYS` was the only remaining lifecycle constant with no runtime reader (it is server-enforced via the cert's expiry; only the config tests + doc comments reference it), surfacing a lib-target dead-code warning.
- **Fix:** Added a documented `#[allow(dead_code)]` to `TTL_DAYS` (matching the 19-02/21-01 precedent for documentation/invariant constants), restoring a 0-warning `cargo build`.
- **Files modified:** `src-tauri/src/license/config.rs`
- **Commit:** `158aca6e`

## Threat Model Notes

- **T-21-04 (info disclosure, scheduler refresh):** mitigated — `refresh_if_needed` reuses the Phase-19 `refresh()` primitive: the key stays Rust-side (Keychain), only the signed cert returns, and the scheduler discards the payload server-side. Nothing logs the key (the scheduler logs nothing at all — `let _ =` discards).
- **T-21-05 (poll-storm denial):** mitigated — the loop is gated by `needs_refresh()` (no call when fresh) and a fixed 24h interval; it cannot busy-loop, and a failed attempt waits the full interval before retrying.
- **T-21-06 (license://refreshed tampering):** accepted — the event is not yet emitted (TODO for Plan 04) and carries no entitlement decision when it is; a spoofed event at most triggers a redundant local re-verify.

## Threat Flags

None — no new network surface, auth path, or trust boundary beyond the plan's threat model. The scheduler reuses the existing Phase-19 refresh network path; the new command is local-only (returns the resolved status).

## Notes for Plan 04

- The scheduler keeps `machine.lic` fresh on disk; the next `license_status` (panel open / explicit Refresh) reflects it. For live-flip on a long-running window, wire the `license://refreshed` Tauri event at the `TODO(21-04)` marker in `lib.rs` and subscribe in the webview status route.
- The status UI maps the two new states: `offlineGrace` → Pro active (within grace), `refreshNeeded` → Pro off (one-click reactivate via `hasStoredKey`).

## Self-Check: PASSED

- FOUND: src-tauri/src/license/mod.rs (refresh_if_needed present)
- FOUND: src-tauri/src/license/commands.rs (refresh_license_if_needed present)
- FOUND: src-tauri/src/lib.rs (refresh_license_if_needed registered + scheduler spawn)
- FOUND: src/lib/platform/index.ts (offlineGrace + refreshNeeded)
- FOUND: src/lib/license/licenseUi.ts (both payloadsEqual arms)
- FOUND: commit d779c68b
- FOUND: commit 158aca6e
- FOUND: commit bf40d158
- cargo test license:: = 69/69; cargo build 0 warnings; tsc clean; vitest 893/893
- decoder.ts + 19 tests byte-for-byte untouched
