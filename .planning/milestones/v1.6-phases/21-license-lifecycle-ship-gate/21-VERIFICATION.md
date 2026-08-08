---
phase: 21-license-lifecycle-ship-gate
verified: 2026-06-15T09:41:49Z
status: human_needed
score: 5/5 success criteria code-verified (2 carry open human/Phase-20-gated live checks)
overrides_applied: 0
re_verification:
  previous_status: none
  note: "Initial verification"
human_verification:
  - test: "21-04 live walkthrough on the built/packaged app"
    expected: "Open #/settings/license from footer + ⌘K 'License'; correct state copy; Refresh shows calm 'Refreshing…' (no spinner); reveal Deactivate, read confirm copy, cancel → focus returns to trigger, Pro stays; toggle dev free-tier flip → theming + ordering/pinning LOCK with lock badge (not hidden), saved theme/order/pins restore on unlock (D-86); OfflineGrace shows no footer nag (D-77), refreshNeeded/problem do; no Pro→FREE boot flash; no startup Keychain prompt for a licensed launch"
    why_human: "Real-WKWebView GUI behavior, focus/visual/timing — not observable headlessly; the executor cannot drive the GUI"
  - test: "21-04 manual Buy-CTA browser-open (WebDriver-non-observable)"
    expected: "Free tier → open upsell (footer 'Unlock Pro' or ⌘K) → click 'Buy license' → OS DEFAULT BROWSER opens https://tinkerdev.io/buy while the app stays put (no in-app navigation, no crash)"
    why_human: "Every Tauri IPC layer on this hardened WKWebView is non-writable/non-configurable; openUrl cannot be observed from WebDriver. Positive contract is unit-pinned (UpsellPanel.test.tsx); native browser-open is manual-only"
  - test: "21-04 gsd-ui-review WCAG-AA live confirmation for #/settings/license"
    expected: "Live WKWebView audit confirms the 24/24 code audit (keyboard reachability from footer + palette, focus rings, aria-live, calm neutral tokens, no alarm color on grace/refreshNeeded/revoked)"
    why_human: "Code audit is 24/24; the binding visual gate is the real WKWebView, not a Chromium preview"
  - test: "21-05 ship-gate live cases 1, 2, 7, 8 against prod CE (license.tinkerdev.io)"
    expected: "Case 1 valid first-device activation unlocks Pro; Case 2 second device rejected with calm seat-limit + self-serve path; Case 7 deactivate/transfer frees the seat (release-seat.sh, D-81) and reactivates on a new device; Case 8 CE-admin revoke → Refresh → entitlements drop to free, calm 'Pro is no longer active'"
    why_human: "BLOCKED on a real prod-CE key minted via the live Phase-20 purchase (PAY-03) — explicitly allowed by the 21-05 plan to be gated-on-Phase-20. Fixture cases 4/5 GREEN on real WKWebView; 3/6 cargo-clock-injection proven"
deferred:
  - truth: "Ship-gate live cases 1/2/7/8 evidence on prod CE"
    addressed_in: "Phase 20 (PAY-03 live purchase) — resume condition for the 21-05 Wave-5 sign-off"
    evidence: "21-05 plan + 21-SHIP-GATE-MATRIX.md: 'Resume when a real prod-CE key is available (Phase 20 PAY-03 closed)'; ROADMAP Phase 21 Depends-on Phase 20"
---

# Phase 21: License Lifecycle & Ship Gate Verification Report

**Phase Goal:** The license behaves correctly across its whole lifetime — opportunistic refresh, self-serve transfer, revocation propagation, a status UI — the free-tier default flips live, and the full 8-case ship-gate matrix passes end-to-end on a real build.
**Verified:** 2026-06-15T09:41:49Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria — the contract)

| # | Truth (Success Criterion) | Status | Evidence |
|---|---------------------------|--------|----------|
| 1 | Cached machine.lic (~30d TTL) refreshes opportunistically in background when online, generous offline grace, never a hard per-launch network check, every tool offline | ✓ VERIFIED | `config.rs` TTL=30/RENEW=7/GRACE=7/POLL=24 (line 93-108); `mod.rs` `classify_expiry`/`needs_refresh_at`/`refresh_if_needed` (568/309/415); `resolve_status_at` body has ZERO `self.client`/`.await` (network-free); `lib.rs` fire-and-forget `tauri::async_runtime::spawn` + `tokio::time::interval(POLL_INTERVAL_HOURS*3600)` launch+24h poll (102-118). cargo `resolve_status_never_touches_network_on_the_expiry_path` + `refresh_if_needed_*` pass (82/82) |
| 2 | User can self-serve deactivate this Mac, freeing the seat, then activate the same key on a new Mac (transfer) | ✓ VERIFIED (code); live leg = human | In-app confirm-first Deactivate in `LicenseSettings.tsx` (`platform.license.deactivate`, "Deactivate this device"/"Keep Pro here"); D-79 offline no-clear PINNED by cargo tests (`offline_deactivate_returns_offline_and_clears_nothing_locally` — key + machine.lic byte-unchanged, line 1591/1621); `infra/keygen/release-seat.sh` committed (bash -n clean, --key/--order-id, token server-side only). Live transfer = ship-gate case 7 (human/Phase-20) |
| 3 | Revoked/suspended license drops entitlements to free at next TTL refresh — calm, no crash | ✓ VERIFIED (code); live leg = human | `keygen_client.rs` SUSPENDED/BANNED/EXPIRED → `LicenseError::Suspended` (190); `SUSPENDED_CHECKOUT_CODES` (231); write-after-verify keeps last-good, ages to RefreshNeeded; `LicenseSettings`/`Sidebar` map refreshNeeded → one calm "Pro is no longer active". cargo revocation tests pass. Live revoke = ship-gate case 8 (human/Phase-20) |
| 4 | Keyboard-reachable WCAG-AA status UI: 5 states, masked key + licensee email, working refresh + deactivate | ✓ VERIFIED (code); live a11y = human | `LicenseSettings.tsx` 428 lines, 5 states, `focus-visible:ring-accent`, aria-live/aria-busy, `ui.maskedKey`/`ui.email` (never raw key); `#/settings/license` registered in `router.tsx` (49) as non-tool child; verbatim copy present. UI-REVIEW 24/24 code audit (0 BLOCK). Live WCAG = human |
| 5 | In-Tauri free-tier flips live (unlicensed locks theming + ordering/pinning, all tools free) AND all 8 ship-gate cases pass on a fresh build | ⚠ PARTIAL — flip code-VERIFIED; matrix 4/8 proven, 4 live-gated | D-85 flip LIVE in `resolve.ts`: Tauri arm derives from `platform.license.status()` intersected with `ALL_ENTITLEMENTS` (30), non-Pro→FREE_SET (32); awaits `initPlatform` (64); FULL_SET only under `import.meta.env.DEV` (73). Matrix: cases 4/5 GREEN on real WKWebView (19/19), 3/6 cargo-clock-injection (82/82), 1/2/7/8 BLOCKED on Phase-20 key (allowed by plan) |

**Score:** 5/5 success criteria code-verified. Criteria 2, 3, 5 carry live legs that are open human-verify / Phase-20-gated items (not code defects).

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|--------------|----------|
| 1 | Ship-gate live cases 1/2/7/8 (valid activation, second-device reject, deactivate/transfer, revocation) evidence on prod CE | Phase 20 (PAY-03 live purchase) | 21-05 plan + matrix explicit resume condition; ROADMAP Phase 21 depends-on Phase 20; fixture cases 4/5 + clock-injection 3/6 already proven |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src-tauri/src/license/config.rs` | TTL/grace/renew/poll consts | ✓ VERIFIED | TTL=30, RENEW=7, GRACE=7, POLL=24; invariant test; APP_SALT `e14f0d16` byte-identical |
| `src-tauri/src/license/mod.rs` | 5-state enum, expiry-aware resolve_status, needs_refresh, refresh_if_needed, mask_key, masked_key cache, D-79 tests | ✓ VERIFIED | OfflineGrace/RefreshNeeded variants; classify_expiry; per-process masked_key_cache; raw key feeds only mask_key |
| `src-tauri/src/license/verify.rs` | email extraction from included licenses resource | ✓ VERIFIED | `pub email: Option<String>` from `attributes.metadata.email` (178-192); None for pre-D-89 |
| `src-tauri/src/license/keygen_client.rs` | suspended/revoked mapping | ✓ VERIFIED | SUSPENDED/BANNED/EXPIRED + checkout codes → `LicenseError::Suspended` |
| `src-tauri/src/lib.rs` | background scheduler + route-only license_status_detail | ✓ VERIFIED | spawn + tokio interval poll; `license_status_detail` command registered (startup Keychain-free) |
| `src/lib/entitlements/resolve.ts` | D-85 live flip | ✓ VERIFIED | Tauri arm reads license_status ∩ ALL_ENTITLEMENTS; non-Pro→FREE; awaits initPlatform; FULL_SET DEV-only |
| `src/components/LicenseSettings.tsx` | status route (≥120 lines) | ✓ VERIFIED | 428 lines, 5 states, masked key/email, Refresh, confirm-first Deactivate, drop notice |
| `src/router.tsx` | #/settings/license non-tool route | ✓ VERIFIED | sibling of ENABLED_TOOLS.map (line 49), not derived from registry |
| `src/components/Sidebar.tsx` + `CommandPalette.tsx` | D-88 state routing | ✓ VERIFIED | footer + ⌘K "License" route to status route / shared upsell; licenseAttention extended to refreshNeeded |
| `server/webhook/src/keygen.ts` + `fulfill.ts` | D-89 email-in-license | ✓ VERIFIED | `createLicense(orderId, email)` stamps `metadata.email`; markEmailed preserves; fulfill passes customerEmail |
| `infra/keygen/release-seat.sh` | idempotent seat-release | ✓ VERIFIED | bash -n clean, --key/--order-id, `set -euo pipefail`, token server-side only; RUNBOOK section |
| `test/e2e/license-settings.e2e.ts` | real-WKWebView spec | ✓ VERIFIED | exists |
| `test/e2e/ship-gate.e2e.ts` | 8-case matrix driver | ✓ VERIFIED | exists; cases 4/5 GREEN |
| `21-SHIP-GATE-MATRIX.md` | matrix record | ✓ VERIFIED | 8 rows, honest method/evidence/status |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| `resolve.ts` | `platform.license.status()` | Tauri arm maps payload entitlements → EntitlementSet | ✓ WIRED |
| `lib.rs` scheduler | `LicenseManager::refresh_if_needed` | spawned async task, online via offline-classification | ✓ WIRED |
| `LicenseSettings.tsx` | `platform.license.refresh`/`deactivate` + refreshEntitlements | button handlers, live flip | ✓ WIRED |
| `router.tsx` | `LicenseSettings` | non-tool child route | ✓ WIRED |
| `Sidebar` + `CommandPalette` | status route vs Unlock Pro | state-dependent routing (D-88) | ✓ WIRED |
| `verify.rs` | machine.lic licenses resource `metadata.email` | parse included | ✓ WIRED |
| `keygen.ts createLicense` | Keygen license `metadata.email` | POST body carries email | ✓ WIRED |
| `release-seat.sh` | CE admin machines API (localhost) | SSH + server-side token | ✓ WIRED |
| raw Keychain key | masked_key payload | mask_key() output only — raw never serialized | ✓ WIRED (LIC-04 invariant holds) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `LicenseSettings.tsx` | `ui` (state/maskedKey/email) | `useLicenseUi()` ← `license_status_detail` Rust command ← resolve_status_with_masked_key | Yes (real verified-cert data) | ✓ FLOWING |
| `resolve.ts` entitlement set | `status.entitlements` | `platform.license.status()` ← resolve_status (verify machine.lic) | Yes | ✓ FLOWING |
| scheduler | on-disk machine.lic freshness | refresh_if_needed → refresh checkout | Yes (when online+needs_refresh) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| cargo license suite | `cargo test license::` | 82 passed; 0 failed | ✓ PASS |
| full vitest suite | `pnpm exec vitest run` | 940 passed (76 files) | ✓ PASS |
| tsc root | `pnpm exec tsc --noEmit` | exit 0 | ✓ PASS |
| tsc server/webhook | `pnpm exec tsc --noEmit -p server/webhook/tsconfig.json` | exit 0 | ✓ PASS |
| release-seat.sh syntax | `bash -n infra/keygen/release-seat.sh` | SYNTAX OK | ✓ PASS |
| decoder.ts untouched | `git diff --stat HEAD -- src/lib/protobuf/decoder.ts` | empty | ✓ PASS |
| real-WKWebView e2e | (per SUMMARY/MATRIX) | 19/19 stable | ? SKIP (requires GUI harness; folded into human walkthrough) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| LIC-05 | 21-01, 21-02 | ~30d TTL, opportunistic background refresh, generous offline grace, never per-launch hard check | ✓ SATISFIED | config consts + classify_expiry + scheduler + needs_refresh; network-free status path |
| LIC-07 | 21-03, 21-04 | Self-serve in-app deactivate freeing the seat (transfer) | ✓ SATISFIED (code); live = ship-gate case 7 (human/Phase-20) | confirm-first Deactivate UI + D-79 cargo no-clear + release-seat.sh |
| LIC-08 | 21-03 | Revoked/suspended propagates to free at next refresh | ✓ SATISFIED (code); live = ship-gate case 8 (human/Phase-20) | suspended mapping + write-after-verify + calm UI |
| LIC-09 | 21-04 | Status UI: states, masked key + email, refresh + deactivate, keyboard WCAG-AA | ✓ SATISFIED (code); live a11y = human | LicenseSettings + route + D-88 routing; UI-REVIEW 24/24 |

All 4 phase requirement IDs (LIC-05/07/08/09) accounted for. LIC-01/02/03/04/06 belong to Phase 19 (REQUIREMENTS.md traceability confirms — out of scope here). REQUIREMENTS.md still lists LIC-05/07/09 "Pending" and LIC-08 "Complete" in the traceability table; the implementation evidence shows LIC-05/07/09 code-complete with only the open human/Phase-20 live legs remaining — the table will close at phase sign-off (not a code gap).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src-tauri/src/lib.rs` | 119 | `TODO(21-04): emit license://refreshed event` | ℹ️ Info | Explicitly planned non-blocking nice-to-have (Plan 02/04). Live-flip works via status-open + explicit-Refresh re-querying fresh disk state; long-uptime live-flip is the only deferred nicety. Not a goal gap. |

No stubs, placeholders, empty-return rendering paths, or hardcoded-empty data found in LicenseSettings.tsx or resolve.ts. The raw license key never enters any serializable payload field (LIC-04 invariant read-verified + cargo-pinned).

### Human Verification Required

The phase has KNOWN-OPEN human-verify gates (by design — automated gates are all GREEN):

1. **21-04 live walkthrough (built app):** status route from footer + ⌘K; Refresh calm state; confirm-first Deactivate + focus return; dev free-tier flip lock/unlock restore (D-86); OfflineGrace silent footer (D-77); no boot flash; no startup Keychain prompt.
2. **21-04 manual Buy-CTA:** free tier → "Buy license" → OS default browser opens https://tinkerdev.io/buy, app stays put (WebDriver-non-observable; unit-pinned positive contract).
3. **21-04 gsd-ui-review WCAG-AA live** confirmation for #/settings/license (code audit 24/24).
4. **21-05 ship-gate live cases 1/2/7/8** against prod CE — BLOCKED on a real prod-CE key from the live Phase-20 purchase (PAY-03). Fixture cases 4/5 GREEN on real WKWebView; cases 3/6 cargo-clock-injection proven. Explicitly allowed by the 21-05 plan to be gated-on-Phase-20.

### Gaps Summary

No genuine code-deliverable gaps. Every must-have artifact exists, is substantive, is wired, and has real data flowing. All automated evidence is independently re-confirmed GREEN: cargo license:: 82/82, vitest 940/940, tsc root + server clean, release-seat.sh syntax clean, decoder.ts byte-for-byte untouched (zero diff). The D-85 free-tier flip is live in resolve.ts; the 5-state lifecycle, masked-key/email, revocation mapping, D-79 no-clear, scheduler, status route, and D-88 routing are all present and correct.

The only outstanding items are the four KNOWN-OPEN human-verify / Phase-20-gated live checks listed above — these are intentional phase-boundary gates (real-WKWebView GUI walkthrough, non-observable Buy-CTA, live WCAG audit, and the four live prod-CE ship-gate cases blocked on a real minted key). Per the gate taxonomy these are Escalation-gate items requiring developer action, not defects. Status is therefore `human_needed`, not `gaps_found`.

---

_Verified: 2026-06-15T09:41:49Z_
_Verifier: Claude (gsd-verifier)_
