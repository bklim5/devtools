# Phase 30: `.pkg` Build + App Store Connect Submission - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-25
**Phase:** 30-pkg-build-asc-submission
**Areas discussed:** Upload automation level, First-release version, Phase terminal state, Metadata artifacts

---

## Upload automation level

| Option | Description | Selected |
|--------|-------------|----------|
| Script builds, human uploads via Transporter | Script produces + verifies the signed .pkg; human drags into Transporter.app | ✓ |
| Fully scripted altool upload | `altool --validate-app` + `--upload-app` with ASC API key, headless | |
| Build only, human does productbuild + upload | Script only produces the .app; human runs productbuild + upload manually | |

**User's choice:** Script builds + locally verifies the signed .pkg, human uploads via Transporter.
**Notes:** First submission is delicate — Transporter surfaces ITMS bounce reasons legibly.

### Follow-up: validation preflight

| Option | Description | Selected |
|--------|-------------|----------|
| Transporter validates — no API key | Script stops at .pkg + local checks; Transporter does ITMS validation | ✓ |
| CLI altool --validate-app preflight | Adds ASC API key (.p8/issuer/key-id) to validate before handoff | |

**User's choice:** No API key this phase — local checks only, Transporter validates on upload.

---

## First-release version

| Option | Description | Selected |
|--------|-------------|----------|
| Bump to 1.0.0 | Public store debut at 1.0.0; version bump in tauri.conf.json + ASC record | ✓ |
| Keep 0.4.1 | Ship as-is, no version churn | |
| Other version | A different number | |

**User's choice:** Bump to 1.0.0 — AND bump the direct channel to 1.0.0 too, to keep both consistent.
**Notes:** A single base `version` edit in tauri.conf.json propagates to both variants. No direct release/tag is cut in this phase.

---

## Phase terminal state

| Option | Description | Selected |
|--------|-------------|----------|
| Stop at 'uploaded + Ready to Submit' | Agent delivers verified .pkg + runbook + staged metadata + green checklist; human uploads, attaches IAP, clicks Submit | ✓ |
| Stop at 'signed .pkg verified locally' | Agent stops earlier; human does the entire ASC side | |
| Agent drives submission via API | Agent uploads + sets metadata + submits programmatically | |

**User's choice:** Stop at uploaded + Ready to Submit; the irreversible Submit for Review is 100% human, behind the ship-gate walkthrough.

---

## Metadata artifacts

| Option | Description | Selected |
|--------|-------------|----------|
| Committed artifacts + one runbook | Real files in repo (PrivacyInfo.xcprivacy, screenshots, Notes-for-Review.md) + SUBMISSION-RUNBOOK.md | ✓ |
| Doc-only guidance | Extend ASC-SETUP.md, commit nothing concrete | |
| Mixed: bundle + capture-on-demand | Commit text/manifest; screenshots captured live during walkthrough | |

**User's choice:** Committed artifacts + one SUBMISSION-RUNBOOK.md.

### Follow-up: support + privacy URLs

| Option | Description | Selected |
|--------|-------------|----------|
| Need to create them | No suitable pages exist; create privacy + support pages | ✓ (partial) |
| Use existing tinkerdev.io pages | Pages already exist; point submission at them | ✓ (partial) |
| Decide at submit time | Leave to the human during walkthrough | |

**User's choice:** Create pages in the `tinkerdev-io` repo (`/Users/boonkhailim/Documents/projects/bk/playground/tinkerdev-io`).
**Notes (refined during scout):** The privacy page **already exists** (`app/privacy/page.tsx`) — reuse it, but review its copy for MAS accuracy (it currently mentions license-validation + update checks, which the store build doesn't do). A **support page does not exist** and must be **created** (`/support`), because ASC's support field needs an `http(s)` URL, not a `mailto:`. Reuse `LegalShell` + `SUPPORT_EMAIL`.

---

## Claude's Discretion

- Pipeline structure: new dedicated `scripts/build-appstore-pkg.sh` reusing the existing bundle builder (keeps local-launch path untouched).
- Direct-channel un-regression proof: `release:publish --dry-run` + local notarised DMG build with no `gh release`; assert decoder.ts + 19 tests byte-untouched.
- Screenshot count/resolutions, Notes-for-Review wording, `/support` page copy.

## Deferred Ideas

- Fully scripted altool/ASC-API upload + programmatic submission (revisit for later updates).
- ASC API key plumbing.
- Windows/Linux store channels (MAS-SHIP-06, v2).
- Automated screenshot capture in CI.
