---
phase: 26-storekit-bridge-spike
plan: 06
subsystem: storekit-bridge-spike
tags: [storekit, iap, mac-app-store, app-sandbox, tauri-plugin-iap, sandbox-tester, go-no-go, human-gate]
requires:
  - phase: 26-05
    provides: "the universal App-Sandboxed signed .app + criteria 1+2 + OQ-2 + cited finish() + the static D-04 audit; the recorded-at-checkpoint provisional GO"
  - phase: 26-04
    provides: "the ASC prerequisites: Paid Apps Agreement Active, com.tinkerdev.app.pro Ready to Submit, sandbox tester bkbklim+tinkerdev@gmail.com"
provides:
  - "the human Sandbox-tester round-trip gate artifact (PHASE-26-SANDBOX-WALKTHROUGH.md) with the LIVE results table filled in"
  - "the finalized four-criterion go/no-go = go-plugin (tauri-plugin-iap@0.9), live criteria 3 + 4(check 2) folded into PHASE-26-BRIDGE-VIABILITY.md"
  - "the signing reality: LOCAL sandbox StoreKit testing needs DEVELOPMENT signing (Apple Development + Mac Development profile); distribution profile fails local launch with AMFI -413; entitlements.appstore.plist gained com.apple.application-identifier"
affects:
  - "Phase 27 (build-variant seam — proven appstore feature + entitlements + dev-signing flow for local IAP test)"
  - "Phase 28 (entitlement-source swap — StoreKit baseFromStoreKit, onPurchaseUpdated wiring, removes the D-11 spike block)"
  - "Phase 30 (.pkg submission — the Apple Distribution + Mac Installer Distribution certs + Mac App Store profile are for this, not local launch)"
  - "Plan 07 (swift-rs fallback) — SKIPPED (conditional on nogo-swiftrs; go-plugin means not needed)"
tech-stack:
  added: []
  patterns:
    - "LOCAL sandbox StoreKit gate = DEVELOPMENT signing (Apple Development cert + Mac Development profile incl. this Mac), NOT distribution — a MAS distribution profile fails local launch with AMFI -413"
    - "process-scoped serverless-verify proof: nettop -p <app PID> during a purchase (the app process opens ZERO sockets; StoreKit is brokered by Apple system daemons)"
key-files:
  created:
    - "docs/appstore/PHASE-26-SANDBOX-WALKTHROUGH.md (created Plan 05/06; LIVE results table filled this plan)"
  modified:
    - "docs/appstore/PHASE-26-BRIDGE-VIABILITY.md (criteria 3 + 4-check-2 folded in; go/no-go = go-plugin stamped; signing reality recorded)"
    - "docs/appstore/PHASE-26-SANDBOX-WALKTHROUGH.md (results table + free-text notes + resume-signal satisfied)"
key-decisions:
  - "Go/No-Go = go-plugin (FINAL, user-confirmed 2026-06-23): all four criteria PASS; tauri-plugin-iap@0.9 is the bridge; Phase 26 completes"
  - "Plan 07 (swift-rs fallback) SKIPPED — it was conditional on nogo-swiftrs; go-plugin means the fallback is not needed"
  - "LOCAL sandbox testing requires DEVELOPMENT signing — distribution profile fails local launch (AMFI -413); the walkthrough's STEP 0 was corrected from distribution to development signing"
patterns-established:
  - "The longest-pole milestone dependency (live native sheet + on-device serverless verify) is proven end-to-end on a real Sandbox-tester round-trip"
requirements-completed: [MAS-IAP-01, MAS-IAP-04]

duration: ~15min
completed: 2026-06-23
---

# Phase 26 Plan 06: Sandbox-Tester Round-Trip Gate Summary

**The live StoreKit bridge gate PASSED — a real Sandbox-tester purchase round-trip on a dev-signed sandboxed `.app` granted `pro.theming, pro.ordering`, cancelled calmly, relaunched with no duplicate transaction, restored from the on-device cache, and showed ZERO app-originated network; the four-criterion go/no-go is FINAL = `go-plugin` (keep `tauri-plugin-iap@0.9`), so Phase 26 completes and the conditional swift-rs Plan 07 is SKIPPED.**

## Performance

- **Duration:** ~15 min (docs/tracking fold-in; the live gate itself was the user's walkthrough)
- **Completed:** 2026-06-23
- **Tasks:** 2 auto tasks (walkthrough authored Plan 05/06; results fold-in this plan) + 1 human-verify checkpoint (the live round-trip, user-run + approved)
- **Files modified:** 2 docs (BRIDGE-VIABILITY.md, SANDBOX-WALKTHROUGH.md)

## Accomplishments

- **Live four-criterion go/no-go finalized = `go-plugin`.** A real Sandbox-tester round-trip on a dev-signed App-Sandboxed `.app` (tester `bkbklim+tinkerdev@gmail.com`, 2026-06-23) confirmed the two criteria the agent could not verify in Plan 05:
  - **Criterion 3 (sheet presents):** native sandbox sheet showed `com.tinkerdev.app.pro` "TinkerDev Pro" $8.99 "For testing purposes only"; PURCHASE → granted `pro.theming, pro.ordering` through the fail-closed core; CANCEL → calm `Purchase cancelled` (NOT an error — validates the harness calm-cancel fix; plugin throws "Purchase cancelled by user" → `calm_reject_outcome` → `UserCancelled`); relaunch → NO duplicate transaction (cited `IapPlugin.swift:142` confirmed live); Restore → re-granted `pro.theming, pro.ordering` from the on-device verified-transaction cache (serverless, persists across sandbox sign-out). PENDING/Ask-to-Buy not live-reproduced — source-verified + unit-tested.
  - **Criterion 4 check 2 (live serverless verify):** `nettop -p <app PID>` during the spike calls showed ZERO sockets in the app process (StoreKit is brokered by Apple system daemons to Apple hosts; our process opens no outbound). Combined with the Plan-05 static audit (check 1) → criterion 4 PASSES.
- **Folded the live results into `PHASE-26-BRIDGE-VIABILITY.md`:** criteria 3 + 4(check 2) flipped PENDING → PASS; the four-criteria table updated; the Go/No-Go section stamped `go-plugin` (FINAL, user-confirmed 2026-06-23) with the live evidence and the explicit Plan-07-SKIPPED routing.
- **Filled the walkthrough results table** in `PHASE-26-SANDBOX-WALKTHROUGH.md` (all 12 rows recorded as observed) + free-text notes + a resume-signal-satisfied marker.
- **Recorded the signing reality discovered at the gate:** LOCAL sandbox StoreKit testing requires DEVELOPMENT signing (Apple Development cert + Mac Development profile incl. this Mac); a Mac App Store *distribution* profile fails local launch with AMFI -413 "No matching profile found"; `entitlements.appstore.plist` gained `com.apple.application-identifier` (required for StoreKit binding); the Apple Distribution + Mac Installer Distribution certs + the Mac App Store profile already created are for the Phase-30 `.pkg` submission, not local launch.

## Task Commits

Docs/tracking-only plan (no source changes). Committed as one metadata commit alongside STATE.md:

1. **Task 1: walkthrough checklist** — authored at Plan 05/06 (the in-order gate checklist); the LIVE results table + notes filled this plan.
2. **Task 2: fold live criteria 3 + 4 into the bridge-viability decision + route the disposition** — `go-plugin` stamped; Plan 07 routed as SKIPPED.

**Plan metadata:** see the final `docs(26-06): …` commit.

## Files Created/Modified

- `docs/appstore/PHASE-26-BRIDGE-VIABILITY.md` — FINAL verdict = `go-plugin`; criteria 3 + 4(check 2) flipped to PASS with live evidence; four-criteria table updated; Go/No-Go section stamped + dated; signing-reality section added.
- `docs/appstore/PHASE-26-SANDBOX-WALKTHROUGH.md` — LIVE results table (12 rows) filled; free-text notes recorded; resume-signal marked SATISFIED.
- `.planning/STATE.md` — 26-05 + 26-06 marked complete; 26-07 noted SKIPPED (go-plugin); bridge gate PASSED/GO.

## Decisions Made

- **Go/No-Go = `go-plugin` (FINAL, user-confirmed 2026-06-23).** All four criteria PASS; `tauri-plugin-iap@0.9` is the single bridge proven against all four. Phase 26 completes.
- **Plan 07 (swift-rs fallback) SKIPPED.** It was conditional on `nogo-swiftrs`; criteria 1/2/3 all hold and criterion 4 holds on the plugin, so the fallback is not needed.
- **LOCAL sandbox testing requires DEVELOPMENT signing.** The walkthrough's STEP 0 had assumed distribution signing; the gate proved a MAS distribution profile fails local launch (AMFI -413), so development signing (Apple Development + Mac Development profile incl. this Mac) is the correct local-test flow.

## Deviations from Plan

None — the plan is a human gate + docs fold-in, executed as written. The one substantive *discovery* (development-not-distribution signing for local launch) was made during the user's STEP-0 build and is recorded as the signing-reality note, not a plan deviation.

## Issues Encountered

- **STEP 0 distribution-signing assumption was wrong for local launch.** The walkthrough originally said "distribution-signed"; a Mac App Store distribution profile fails local launch with AMFI -413 (the `app-sandbox` + `application-identifier` entitlements are profile-restricted to App-Store-installed apps). Resolved by switching to Apple Development + a Mac Development profile that includes this Mac; documented in the signing matrix.

## User Setup Required

None — no further external configuration. The ASC prerequisites (Plan 04) and the dev signing identity (this gate) are already in place.

## Next Phase Readiness

- **Phase 26 COMPLETE — the bridge is proven.** `tauri-plugin-iap@0.9` is the locked bridge; Phase 27 (build-variant seam) and Phase 28 (entitlement-source swap + store license pane) can proceed on the confirmed plugin path.
- **Carried forward:** Phase 27's `tauri.appstore.conf.json` overlay MUST NOT re-grant `iap:default` (the MODE A Rust-side path needs no webview iap capability — confirmed live). Phase 28 wires `onPurchaseUpdated` (the plugin's real update channel) + removes the temporary D-11 spike block. Phase 30 uses the Apple Distribution + Mac Installer Distribution certs + the Mac App Store profile for the `.pkg`.

## Self-Check: PASSED

- Files: `docs/appstore/PHASE-26-BRIDGE-VIABILITY.md`, `docs/appstore/PHASE-26-SANDBOX-WALKTHROUGH.md`, `.planning/phases/26-storekit-bridge-spike/26-06-SUMMARY.md` — verified below.
- decoder.ts + its 19 tests + all `src/` / `src-tauri/` source byte-for-byte untouched (docs/tracking-only plan).

---
*Phase: 26-storekit-bridge-spike*
*Completed: 2026-06-23*
