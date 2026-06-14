---
phase: 21
plan: 02
type: execute
wave: 2
depends_on: [21-01]
files_modified:
  - src-tauri/src/license/mod.rs
  - src-tauri/src/license/commands.rs
  - src-tauri/src/lib.rs
  - src/lib/platform/index.ts
  - src/lib/license/licenseUi.ts
autonomous: true
requirements: [LIC-05]
must_haves:
  truths:
    - "On launch (after the window paints) the app attempts a background refresh ONLY when online and the cert is in the renew/grace/expired window — never a hard per-launch network check"
    - "While running, a 24h periodic poll re-attempts refresh under the same online + needs-refresh guard"
    - "A failed refresh attempt leaves the current state untouched (silent, non-blocking — no error surfaced)"
    - "The TS LicenseStatusPayload union mirrors the Rust 5-state enum (offlineGrace + refreshNeeded added)"
    - "Grace is silent outside the status UI — no footer nag while in OfflineGrace"
  artifacts:
    - path: "src-tauri/src/lib.rs"
      provides: "background refresh scheduler — launch trigger + 24h poll, online + needs_refresh gated"
      contains: "POLL_INTERVAL_HOURS"
    - path: "src/lib/platform/index.ts"
      provides: "TS LicenseStatusPayload extended with offlineGrace + refreshNeeded"
      contains: "offlineGrace"
    - path: "src/lib/license/licenseUi.ts"
      provides: "payloadsEqual covers the two new states"
      contains: "offlineGrace"
  key_links:
    - from: "src-tauri/src/lib.rs scheduler"
      to: "LicenseManager::needs_refresh + refresh"
      via: "spawned async task, online check first"
      pattern: "needs_refresh"
    - from: "src/lib/license/licenseUi.ts payloadsEqual"
      to: "offlineGrace/refreshNeeded variants"
      via: "structural equality arms"
      pattern: "refreshNeeded"
---

<objective>
Wire the opportunistic background refresh scheduler (D-76) and propagate the two new lifecycle states across the Rust→TS contract. The scheduler attempts `refresh()` at launch (after first paint, non-blocking) and on a 24h poll while running — but ONLY when online AND `needs_refresh()` is true (renew-ahead / grace / expired window). Refresh is silent: a failure leaves state untouched, no toast, no launch interruption (D-76/D-77). The TS `LicenseStatusPayload` union and the `payloadsEqual` change-detector gain the `offlineGrace` + `refreshNeeded` arms so consumers (footer, status route in Plan 04) see them.

Purpose: This is the "renew-ahead is the centerpiece" mechanism — a connected user refreshes before ever entering grace, so OfflineGrace/RefreshNeeded only appear when genuinely long-offline. Honors the v1.6 "never per-launch hard network check" amendment.
Output: A Rust scheduler in lib.rs (launch + tokio interval poll), an online-detection gate, the extended TS union + change-detector, and a new `refresh_if_needed`-style command path the scheduler uses. Grace stays silent outside the status route.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/21-license-lifecycle-ship-gate/21-CONTEXT.md
@.planning/phases/21-license-lifecycle-ship-gate/21-01-SUMMARY.md

<interfaces>
<!-- Plan 01 added: needs_refresh(&mut self) -> bool; OfflineGrace + RefreshNeeded variants;
     POLL_INTERVAL_HOURS const in config.rs. -->

LicenseManager<C: LicenseApi> (mod.rs):
  pub async fn refresh(&mut self) -> Result<LicenseStatusPayload, LicenseError>   // stored-key checkout against the existing machine; LOCAL VERIFY before persist
  pub fn needs_refresh(&mut self) -> bool                                          // Plan 01: renew-ahead | grace | expired
  pub fn resolve_status(&mut self) -> LicenseStatusPayload                         // pure-local, zero network

Managed singleton (commands.rs):
  pub struct LicenseState(pub tauri::async_runtime::Mutex<LicenseManager<KeygenClient>>);

lib.rs setup() composes the manager + app.manage(LicenseState(...)) at line ~76-86; the AppHandle is available there. tauri::async_runtime::spawn is the spawn primitive.

TS union (src/lib/platform/index.ts:35):
  export type LicenseStatusPayload =
    | { state: "notActivated"; hasStoredKey: boolean }
    | { state: "licensed"; expiry: string | null; entitlements: string[] }
    | { state: "problem"; problem: LicenseProblem; hasStoredKey: boolean };

payloadsEqual (src/lib/license/licenseUi.ts:29) — structural equality, must gain offlineGrace + refreshNeeded arms.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Online-gated refresh command + scheduler trigger in the manager</name>
  <read_first>
    - src-tauri/src/license/mod.rs (refresh, needs_refresh, resolve_status; the LicenseError variants offline/serviceUnreachable from keygen_client)
    - src-tauri/src/license/commands.rs (the 4-command surface + LicenseState)
    - src-tauri/src/license/keygen_client.rs (how offline vs serviceUnreachable is classified — D-38; reqwest transport)
    - src-tauri/src/license/config.rs (POLL_INTERVAL_HOURS)
  </read_first>
  <action>
    Add a manager method `pub async fn refresh_if_needed(&mut self) -> LicenseStatusPayload` that:
    1. Calls `self.needs_refresh()`; if false, returns `self.resolve_status()` unchanged (no network — the common connected-and-fresh case).
    2. If true, attempts `self.refresh().await`. On Ok, returns the fresh Licensed payload. On Err (offline / serviceUnreachable / any), SWALLOWS the error and returns `self.resolve_status()` (the current local state — D-76: a failed attempt leaves state untouched, silent). NEVER propagates the error to a caller — the scheduler must not surface failure.
    Add a thin command `#[tauri::command] pub async fn refresh_license_if_needed(state: State<'_, LicenseState>) -> Result<LicenseStatusPayload, ()>` in commands.rs that locks the mutex and calls it (returns Ok always — silent). Register it in the lib.rs invoke_handler list alongside the existing 4. Keep the existing user-triggered `refresh_license` (which DOES return LicenseError) intact — the status route's explicit Refresh button uses that one; the scheduler uses the silent one.
    Online detection: the refresh attempt's own offline classification (D-38 `LicenseError::offline`) IS the online check — do NOT add a separate connectivity probe. `needs_refresh()` gates whether to even try; if offline, `refresh()` returns `offline` and `refresh_if_needed` swallows it. Document this: "the network call's own offline result is the connectivity signal; no extra probe."
  </action>
  <verify>
    <automated>cd src-tauri && cargo test license:: 2>&1 | grep -q "test result: ok"</automated>
  </verify>
  <acceptance_criteria>
    - `grep "refresh_if_needed" src-tauri/src/license/mod.rs` matches
    - `grep "refresh_license_if_needed" src-tauri/src/license/commands.rs` matches
    - `grep -c "refresh_license_if_needed" src-tauri/src/lib.rs` returns >= 1 (registered in invoke_handler)
    - A cargo test proves: needs_refresh=false -> no client call (NoNetwork client does not panic); refresh error -> refresh_if_needed returns the prior resolve_status, no Err
    - `cargo test license::` exits 0
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Launch + 24h-poll scheduler in lib.rs</name>
  <read_first>
    - src-tauri/src/lib.rs (the setup() block line 57-90 where LicenseState is managed; the AppHandle/app.manage call)
    - src-tauri/src/license/config.rs (POLL_INTERVAL_HOURS = 24)
    - src/main.tsx (the launch-time refreshLicenseUi() comment — the no-per-launch-network amendment rationale; the scheduler must NOT block first paint)
  </read_first>
  <action>
    In lib.rs `setup()`, AFTER `app.manage(LicenseState(...))`, spawn a background task via `tauri::async_runtime::spawn` that:
    1. Launch trigger (D-76): does NOT block setup/first-paint. Inside the spawned task, optionally `tokio::time::sleep` a short delay (e.g. 2s) so the window paints first, then lock the LicenseState mutex and call `refresh_if_needed()`. The result is discarded server-side (the webview re-queries via its own status refresh — Plan 04 wires the status-open trigger and a Tauri event; for this plan, the scheduler's job is to keep machine.lic fresh on disk so the next `license_status` reflects it).
    2. Periodic poll (D-76): loop with `let mut interval = tokio::time::interval(Duration::from_secs(POLL_INTERVAL_HOURS * 3600)); loop { interval.tick().await; <lock + refresh_if_needed>; }`. The first `tick()` fires immediately — guard so the launch trigger and first poll tick don't double-fire (e.g. consume one tick before the loop, or fold the launch trigger into the loop's first iteration after the sleep).
    Hold the AppHandle clone the task needs (`app.handle().clone()`), get `State` via `handle.state::<LicenseState>()`. Keep the whole thing non-blocking: setup() returns immediately; the task runs for the app's lifetime.
    Emit a Tauri event `"license://refreshed"` after each refresh_if_needed attempt that CHANGED the on-disk state (compare the payload state before/after) so Plan 04 can subscribe and live-flip the UI without a restart — but if wiring the emit is non-trivial, leave a clearly-commented `// TODO(21-04): emit license://refreshed for live UI flip` and the webview's status-open + explicit-Refresh paths (Plan 04) still pick up the fresh disk state. The event is a nice-to-have for the long-running-window case, not a blocker.
  </action>
  <verify>
    <automated>cd src-tauri && cargo build 2>&1 | tail -1 && cargo test license:: 2>&1 | grep -q "test result: ok"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "interval\|refresh_if_needed\|spawn" src-tauri/src/lib.rs` returns >= 3
    - `grep "POLL_INTERVAL_HOURS" src-tauri/src/lib.rs` matches
    - `cargo build` succeeds (the spawned task compiles with the AppHandle/State access)
    - setup() does not `.await` the scheduler (the spawn is fire-and-forget; grep confirms `spawn(` not `block_on(` for the scheduler)
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Mirror the 5-state union in TS + extend the change-detector</name>
  <read_first>
    - src/lib/platform/index.ts (LicenseStatusPayload union line 35-38; LicenseProblem; the comment "EXACT mirror of the serde-pinned camelCase JSON")
    - src/lib/license/licenseUi.ts (payloadsEqual line 29-48, defaultSnapshot, the snapshot-store pattern)
    - src/lib/license/licenseUi.test.ts (if present — extend, don't break)
  </read_first>
  <action>
    1. Extend the TS `LicenseStatusPayload` union in src/lib/platform/index.ts to add the two arms mirroring the Rust serde shapes (Plan 01):
       `| { state: "offlineGrace"; expiry: string | null; entitlements: string[] }`
       `| { state: "refreshNeeded"; hasStoredKey: boolean }`
       Keep the existing three. Update the doc comment to note the 5-state mirror.
    2. Extend `payloadsEqual` in licenseUi.ts with structural-equality arms for both new states (offlineGrace compares expiry + entitlements like licensed; refreshNeeded compares hasStoredKey like notActivated). The final `return false` fallback stays.
    3. Add/extend vitest coverage in licenseUi.test.ts: setLicenseUiForTest with an offlineGrace payload and a refreshNeeded payload propagates and is change-detected (a second identical set is a no-op; a state change notifies).
    4. Confirm the browser/test stub arm (src/lib/platform/browser.ts or stub) still returns `notActivated` for `license.status()` — no change needed, but verify it type-checks against the widened union.
  </action>
  <verify>
    <automated>pnpm exec tsc --noEmit && pnpm exec vitest run src/lib/license/licenseUi.test.ts 2>&1 | grep -qE "passed|✓"</automated>
  </verify>
  <acceptance_criteria>
    - `grep "offlineGrace" src/lib/platform/index.ts` matches
    - `grep "refreshNeeded" src/lib/platform/index.ts` matches
    - `grep -c "offlineGrace\|refreshNeeded" src/lib/license/licenseUi.ts` returns >= 2 (both payloadsEqual arms)
    - `pnpm exec tsc --noEmit` exits 0
    - `vitest run src/lib/license/licenseUi.test.ts` exits 0 with new-state cases present
    - decoder.ts + its 19 tests untouched (`git diff --stat src/lib/protobuf/` empty)
  </acceptance_criteria>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| scheduler → Keygen refresh endpoint | The opportunistic background `refresh()` is the only network the scheduler triggers; carries the Keychain key Rust-side (never to JS). |
| Tauri event → webview | A `license://refreshed` event (if emitted) crosses Rust→JS; carries no key material, only a refresh signal. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-21-04 | Information disclosure | scheduler refresh() | mitigate | refresh() reuses the Phase-19 primitive: the key stays Rust-side, only the signed cert returns; the scheduler discards the payload server-side. No key material reaches the spawned task's logs (log only state names, never the key). |
| T-21-05 | Denial (poll storm) | 24h interval loop | mitigate | The loop is gated by `needs_refresh()` (no call when fresh) and a fixed 24h interval — it cannot busy-loop or hammer the endpoint; a failed attempt waits the full interval before the next try. |
| T-21-06 | Tampering | license://refreshed event payload | accept | The event carries no entitlement decision — it only nudges the webview to re-query `license_status` (which re-verifies locally). A spoofed event at most triggers a redundant local re-verify. |
</threat_model>

<verification>
- `cargo test license::` + `cargo build` green (scheduler compiles, refresh_if_needed tested).
- `tsc --noEmit` + `vitest` (full suite) green; the new union arms type-check everywhere LicenseStatusPayload is consumed (UpsellPanel switch, footer).
- Manual/real-WKWebView verification of the launch-no-block (first paint not delayed) is folded into Plan 04's e2e + the phase-boundary walkthrough — this plan's gate is unit/build only.
- decoder.ts + 19 tests untouched.
</verification>

<success_criteria>
- Launch + 24h-poll scheduler attempts refresh only when online + needs_refresh; failures are silent and leave state untouched.
- The TS union is a faithful 5-state mirror; payloadsEqual handles all five.
- No first-paint block, no per-launch hard network check (amendment honored).
</success_criteria>

<output>
After completion, create `.planning/phases/21-license-lifecycle-ship-gate/21-02-SUMMARY.md`.
</output>
