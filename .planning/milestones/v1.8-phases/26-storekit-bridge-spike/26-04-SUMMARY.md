---
phase: 26-storekit-bridge-spike
plan: 04
subsystem: appstore-setup
tags: [storekit, iap, mac-app-store, app-store-connect, asc-setup, human-gate, paid-apps-agreement]

# Dependency graph
requires: []
provides:
  - "docs/appstore/PHASE-26-ASC-CHECKLIST.md — the in-order, value-filled ASC setup checklist (Paid-Apps Agreement first), referencing ASC-SETUP.md §§1-6"
  - "docs/appstore/ASC-SETUP.md — the full TinkerDev ASC + Apple Developer setup guide the checklist references (now repo-tracked; was untracked)"
  - "the four Apple-side prerequisites for the Plan 06 live sandbox purchase round-trip are CONFIRMED in place (Paid-Apps Agreement Active, App ID + product Ready-to-Submit, ≥1 Sandbox tester)"
affects: [26-05, 26-06, 30-pkg-build-asc-submission]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "agent-produces-checklist / human-executes-clicks: Claude cannot touch Apple's web console (no CLI/API for App-ID registration, agreement signing, IAP creation, or Sandbox testers) — it emits an exact-value, dependency-ordered checklist and a blocking human-action gate, the user does the console work, returns a resume signal"

key-files:
  created: []
  modified: []
  committed-this-plan:
    - "docs/appstore/PHASE-26-ASC-CHECKLIST.md (Task 1 deliverable — committed e18d6c76)"
    - "docs/appstore/ASC-SETUP.md (the referenced source guide — was untracked; committed this plan to close the dangling reference)"

key-decisions:
  - "Task 1 (the checklist) shipped exactly as planned at e18d6c76 — NOT re-done in this continuation."
  - "Task 2 (the blocking human-action ASC gate) is SATISFIED: the user completed the Apple-side setup and signalled 'ASC ready' (2026-06-22), verified against App Store Connect screenshots."
  - "Small Business Program enrollment is DEFERRED / non-blocking — it is optional-but-recommended (checklist step 4), it is NOT one of the four Plan-06 gate prerequisites, and the enrollment option only surfaces hours after the Paid-Apps Agreement goes Active (which happened today). The user will enroll once it appears. Recorded as pending, NOT fabricated as done."
  - "docs/appstore/ASC-SETUP.md was committed as part of finalizing this plan: the shipped checklist (e18d6c76) references it in every step but it was untracked — a dangling reference to a non-repo file (Rule 3 blocking)."

requirements-completed: [MAS-IAP-01]

# Metrics
duration: continuation
completed: 2026-06-22
---

# Phase 26 Plan 04: ASC Setup Checklist + Human Gate Summary

**The in-order, exact-value App Store Connect setup checklist (Paid-Apps Agreement first) shipped, and the four Apple-side prerequisites for the Plan 06 live sandbox purchase round-trip are confirmed in place by the user — Small Business Program enrollment deferred as optional/non-blocking.**

## Performance

- **Duration:** continuation (Task 1 committed e18d6c76 in the prior session; this session finalizes after the human gate cleared)
- **Completed:** 2026-06-22
- **Tasks:** 2 (Task 1 auto — done prior; Task 2 blocking human-action — satisfied this session)

## Accomplishments

- **Task 1 — `docs/appstore/PHASE-26-ASC-CHECKLIST.md` (committed `e18d6c76`, 97 lines):** a tight, numbered, dependency-ordered checklist that REFERENCES `ASC-SETUP.md` (does not duplicate the how-to). Sequences the **Paid Applications Agreement FIRST** (hours-long propagation), then App ID `com.tinkerdev.app` (Team `FK4HQK83WX`), the app record, Small Business enrollment, the non-consumable `com.tinkerdev.app.pro` (~US$9, drive to Ready-to-Submit), and ≥1 Sandbox tester (plus-alias, never the real Apple ID — T-26-11). Carries an explicit **"Deferred to Phase 30 — do NOT do now"** section (screenshots, privacy nutrition label, age rating, Notes-for-Review, App Review submission, distribution certs/.pkg) and the OQ-1 note that the `.storekit` file is NOT load-bearing for macOS — the live test runs against Apple's sandbox via the tester.
- **Task 2 — the blocking human-action ASC gate is SATISFIED.** The user worked the checklist on Apple's console and returned the resume signal "ASC ready". Verified against the user's App Store Connect screenshots (2026-06-22) — see the prerequisite state below.
- **`docs/appstore/ASC-SETUP.md` committed (235 lines).** The shipped checklist references this guide in every step, but it was untracked — committing it closes the dangling reference so the checklist points at a repo file (Rule 3, blocking).

## Verified ASC prerequisite state (from the user's App Store Connect screenshots, 2026-06-22)

The four Plan-06 gate prerequisites are confirmed in place:

- ☑ **Paid Applications Agreement = ACTIVE** — All Countries, 22 Jun 2026 – 20 Jun 2027. Banking (DBS Bank Ltd, Singapore, USD) Active. Tax forms done: U.S. W-8BEN Active, Certificate of Foreign Status Active, Singapore Tax Questionnaire Complete.
- ☑ **App record + explicit App ID `com.tinkerdev.app`** present (implied — the IAP product is attached to the app record).
- ☑ **Non-consumable IAP `com.tinkerdev.app.pro`** — reference name "TinkerDev Pro Unlock", type Non-Consumable, status **READY TO SUBMIT** (the IAP review screenshot is deferrable — needs the built paywall UI, Phase 28/30).
- ☑ **≥1 Sandbox tester** — `bkbklim+tinkerdev@gmail.com` ("Tinkerdev Tester", United States), a plus-alias not tied to the real Apple ID (T-26-11 honored).

### Deferred / non-blocking

- ☐ **Small Business Program enrollment — NOT yet done (optional, non-blocking).** It is checklist step 4 (optional-but-recommended, the 15% rate), NOT one of the four Plan-06 gate prerequisites. The enrollment option only surfaces hours after the Paid-Apps Agreement goes Active (which happened today, 22 Jun 2026), so it is not yet available. The user will enroll once it appears. Recorded here as pending — **NOT fabricated as done.**

## Files

- **Committed `e18d6c76` (prior session):** `docs/appstore/PHASE-26-ASC-CHECKLIST.md` — the Task 1 checklist.
- **Committed this session:** `docs/appstore/ASC-SETUP.md` — the referenced source guide (was untracked).
- No code change in this plan (docs-only). decoder.ts + its 19 tests untouched by definition.

## Decisions Made

- **Did NOT re-do Task 1.** The checklist shipped exactly as planned at `e18d6c76`; this continuation only finalizes after the human gate cleared.
- **Small Business Program recorded as deferred, not done.** It is optional/non-blocking and the option had not surfaced yet (Paid-Apps Agreement only went Active today). Fabricating it as complete would be false; it is tracked as pending for the user.
- **Committed the dangling `ASC-SETUP.md` reference.** The shipped checklist linked a non-repo file; tracking it makes the deliverable self-contained (Rule 3 blocking).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Committed the referenced `docs/appstore/ASC-SETUP.md`**
- **Found during:** finalization — git status showed `docs/appstore/ASC-SETUP.md` untracked.
- **Issue:** the shipped Task-1 checklist (`e18d6c76`) references `ASC-SETUP.md` §§1-6 in every step, but the file was never committed — a dangling reference to a non-repo file. The checklist deliverable is incomplete without its referenced guide.
- **Fix:** committed `docs/appstore/ASC-SETUP.md` (the full TinkerDev ASC setup guide, 235 lines) so the checklist points at a repo file.
- **Files modified:** `docs/appstore/ASC-SETUP.md` (added to repo; content unchanged).

**Total deviations:** 1 auto-fixed (Rule 3 — committed a referenced-but-untracked doc).
**Impact on plan:** none on scope — it completes the Task-1 deliverable's references. No code, no behavior change.

## Issues Encountered

None. The human gate cleared cleanly; the prerequisite state matches the checklist's four-item confirmation block (Small Business Program correctly left pending).

## Known Stubs

None. This is a docs + Apple-console-setup plan; no code, no UI, no stubs.

## Next Phase Readiness

- **Plan 06 (the live sandbox purchase round-trip human gate) is UNBLOCKED on the ASC side** — Paid-Apps Agreement Active, App ID + `com.tinkerdev.app.pro` (Ready to Submit), and a Sandbox tester all exist. The remaining Plan-06 prerequisite is the **distribution-signed rebuild** (the spike .app is ad-hoc signed; the live native purchase sheet needs an Apple Distribution/MAS cert) — tracked separately in STATE.md, not part of this plan.
- **Phase 30** owns the deferred App-Review metadata (screenshots, privacy label, age rating, Notes-for-Review, the first-binary submission, distribution certs/.pkg) and will pick up the IAP review screenshot once the Phase 28 paywall UI exists, plus the Small Business Program enrollment if the user has not done it by then.

## Self-Check: PASSED

- Files: `docs/appstore/PHASE-26-ASC-CHECKLIST.md`, `docs/appstore/ASC-SETUP.md`, `26-04-SUMMARY.md` all FOUND.
- Commits: `e18d6c76` (Task 1 checklist) FOUND.

---
*Phase: 26-storekit-bridge-spike*
*Completed: 2026-06-22*
