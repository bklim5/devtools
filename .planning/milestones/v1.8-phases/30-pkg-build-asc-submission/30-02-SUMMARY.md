---
phase: 30-pkg-build-asc-submission
plan: 02
subsystem: appstore-submission-metadata
tags: [appstore, metadata, submission, cross-repo, privacy, docs]
requires:
  - "Phase 26–29 store-build source (StoreKit bridge, variant seam, entitlement swap, sandbox-safe native)"
  - "ASC-SETUP.md §§1–8 + PHASE-26-ASC-CHECKLIST deferred-item list"
  - "tinkerdev-io LegalShell + SUPPORT_EMAIL pattern (app/refunds/page.tsx)"
provides:
  - "SUBMISSION-RUNBOOK.md — master ship-gate checklist (D-05)"
  - "Notes-for-Review.md — on-device StoreKit 2 IAP exercise notes (D-05)"
  - "screenshots/README.md — MAS screenshot spec + staging (D-05)"
  - "tinkerdev-io /support page — live http(s) ASC Support URL (D-07)"
  - "tinkerdev-io /privacy — channel-aware copy (D-07)"
affects:
  - "Plan 30-03 ship-gate (human references these artifacts at the terminal gate)"
tech-stack:
  added: []
  patterns:
    - "Cross-repo committed separately in tinkerdev-io (not this repo's git)"
    - "Channel-aware legal copy: store=StoreKit-only, direct=Keygen/LS/Resend/updater retained"
key-files:
  created:
    - docs/appstore/SUBMISSION-RUNBOOK.md
    - docs/appstore/Notes-for-Review.md
    - docs/appstore/screenshots/README.md
    - /Users/boonkhailim/Documents/projects/bk/playground/tinkerdev-io/app/support/page.tsx
  modified:
    - /Users/boonkhailim/Documents/projects/bk/playground/tinkerdev-io/app/privacy/page.tsx
decisions:
  - "No agent-captured PNGs — screenshots staged as spec + placeholders, captured by human during the ship-gate walkthrough"
  - "Cross-repo /support + /privacy committed in the tinkerdev-io repo (b242e01), not vendored into devtools"
metrics:
  duration: "~3 min"
  completed: "2026-06-25"
  tasks: 2
  files: 5
---

# Phase 30 Plan 02: App Store Submission Metadata + Cross-Repo URLs Summary

All committed submission-metadata deliverables (D-05) and the cross-repo Support/Privacy URL pages (D-07), tied together by one master `SUBMISSION-RUNBOOK.md` — no `.app` build (parallelizes with Plan 01; these are the human's reference material for the Plan-03 terminal ship-gate).

## What was built

### Task 1 — committed metadata artifacts (devtools repo, commit `83d4162c`)

- **`docs/appstore/SUBMISSION-RUNBOOK.md`** (107 lines) — the master ship-gate checklist in dependency order: (1) pre-build gate / Build-LAST freshness, (2) the **blocking Mac Installer Distribution cert** prerequisite (Apple Distribution already present; only the installer cert may be missing — `ASC-SETUP.md §7`), (3) `.pkg` build + local verify, (4) the human walkthrough (launch the **DEV-signed** `.app`, not the distribution `.pkg`'s app — AMFI -413; Sandbox purchase round-trip, Restore, refund→Pro-drop via `REFUND-TEST-RUNBOOK.md`, capture screenshots), (5) **Transporter** upload (D-01; ITMS-90238/90296 noted), (6) ASC finalize + Submit (attach `com.tinkerdev.app.pro`, Data Not Collected, 4+, screenshots, Support/Privacy URLs verified 200), (7) the deferred-item delta closing `PHASE-26-ASC-CHECKLIST` lines ~84–93. Cross-references the other two docs + ASC-SETUP + REFUND-TEST-RUNBOOK by name.
- **`docs/appstore/Notes-for-Review.md`** — App Review reviewer notes: one non-consumable `com.tinkerdev.app.pro`, verified **on-device via StoreKit 2 JWS, serverless** (no account/login/server call beyond Apple's StoreKit; licensing service compiled out of the store build); step-by-step Buy → live Pro unlock → Restore; states Data Not Collected + fully offline.
- **`docs/appstore/screenshots/README.md`** — MAS resolution spec (16:10 strict, capture at **2880×1800**, ≥3 flattened PNG no-alpha), the three real testable states (Protobuf decoded blob; JWT decode; Settings ▸ License Buy/Restore = the IAP review screenshot), explicit "captured **during the walkthrough**, not agent-generated" note + placeholder filenames.

### Task 2 — cross-repo URL deliverables (tinkerdev-io repo, commit `b242e01`)

- **`app/support/page.tsx`** (new) — mirrors `app/refunds/page.tsx`: imports `LegalShell` + `SUPPORT_EMAIL`, exports `metadata` + a default `SupportPage()` with help content (email link, what-to-include incl. edition: App Store vs direct download, links to Privacy + Refund). Gives ASC a real http(s) Support URL (not a `mailto:`).
- **`app/privacy/page.tsx`** (edited, channel-aware) — added an explicit "App Store edition" framing: the store build has the licensing service (Keygen) + update checker **compiled out** → no license-validation/update-check calls, StoreKit-only, Apple handles purchases. The direct-channel disclosures (Keygen / Lemon Squeezy / Resend / updater) are **retained, reframed as "direct download"** — not deleted. `metadata.description` made channel-aware too (no longer unconditionally claims license validation + update checks for all builds).

## Threat mitigations applied

- **T-30-05** (compliance / info-disclosure on /privacy): channel-aware edit — store network claims accurate (StoreKit only), direct-channel disclosures retained + true.
- **T-30-06** (info disclosure on Notes-for-Review): states serverless/on-device StoreKit 2, no server/account/data — matches the actual store binary.
- **T-30-07** (broken ASC Support field): real http(s) `/support` page (not mailto:); human verifies 200 before Submit (runbook Step 6).

## Deviations from Plan

None — both tasks executed exactly as written (no Rule 1–4 deviations).

## Verification

- **Task 1:** file-existence + grep asserts all pass (`com.tinkerdev.app.pro`, `Mac Installer Distribution`, `2880`, `Transporter`, `Data Not Collected`, `on-device|serverless`, `during the…walkthrough`); runbook 107 lines (≥60). Committed through lefthook (vitest **1276/1276**, tsc + lint clean — 4 pre-existing eslint warnings out of scope).
- **Task 2:** `/support` exists with `LegalShell` + `SUPPORT_EMAIL` + default export; `/privacy` channel-aware (`StoreKit`/`App Store edition`) AND retains `Lemon Squeezy` + `direct` framing. `tsc --noEmit` exit 0 in tinkerdev-io.
- **Human (Plan 03 ship-gate):** deploy both pages live, verify `https://tinkerdev.io/support` + `/privacy` return 200 before Submit.

## Notes / handoff

- The tinkerdev-io pages are committed in that repo (`b242e01`) but **not yet deployed** — the human deploys both live + verifies the URLs 200 at the ship-gate (recorded in SUBMISSION-RUNBOOK.md Step 6).
- Screenshots are intentionally NOT captured here — they require the running DEV-signed `.app` (Plan 03 walkthrough).

## Self-Check: PASSED

- FOUND: docs/appstore/SUBMISSION-RUNBOOK.md
- FOUND: docs/appstore/Notes-for-Review.md
- FOUND: docs/appstore/screenshots/README.md
- FOUND: tinkerdev-io/app/support/page.tsx
- FOUND (modified): tinkerdev-io/app/privacy/page.tsx
- FOUND: commit 83d4162c (devtools Task 1)
- FOUND: commit b242e01 (tinkerdev-io Task 2)
