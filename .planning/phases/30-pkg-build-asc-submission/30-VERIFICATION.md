---
phase: 30-pkg-build-asc-submission
verified: 2026-06-29T20:56:14Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  note: initial verification
---

# Phase 30: `.pkg` Build + App Store Connect Submission — Verification Report

**Phase Goal:** `.pkg` Build + App Store Connect Submission — productbuild → altool pipeline (Apple Distribution + Mac Installer Distribution + embedded profile, separate from the direct Developer-ID/notarytool path); IAP attached to the binary; ASC guidance + metadata (privacy label Data-Not-Collected + PrivacyInfo.xcprivacy, 4+ rating, real-state screenshots, Notes-for-Review); direct channel un-regressed (DMG still notarises; decoder + 19 tests untouched).
**Verified:** 2026-06-29T20:56:14Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (requirement) | Status | Evidence |
|---|---------------------|--------|----------|
| 1 | MAS-SHIP-01 — signed `.pkg` pipeline (Apple Distribution app-sign → productbuild → Mac Installer Distribution pkg-sign + embedded profile), separate from direct path | ✓ VERIFIED | `scripts/build-appstore-pkg.sh` (21661 B, 0755, `bash -n` clean); on-disk `TinkerDev.pkg` signed by `3rd Party Mac Developer Installer: Boon Khai Lim (FK4HQK83WX)` chain. Notary env scrubbed; strong embedded-profile gate (`security cms -D` + TeamIdentifier/app-id/ExpirationDate/get-task-allow). Dev-signed `build-appstore-bundle.sh` left untouched. |
| 2 | MAS-SHIP-02 — `.pkg` uploads to ASC (productbuild → altool/Transporter) | ✓ VERIFIED | `productbuild --component` in script; `.pkg` built + uploaded via Transporter; Submit-for-Review clicked 2026-06-27 (status "Waiting for Review"). Two Transporter bounces (409 category, 91109 quarantine) fixed permanently in the script (`bundle.category=DeveloperTools`; `xattr -cr` + FATAL quarantine guard). |
| 3 | MAS-SHIP-03 — step-by-step ASC setup guidance | ✓ VERIFIED | `docs/appstore/SUBMISSION-RUNBOOK.md` (107 lines) ties ASC-SETUP.md + Notes-for-Review + screenshots + Transporter + ship-gate; references the non-consumable `com.tinkerdev.app.pro` + Sandbox testers. IAP attached for first-release co-review. |
| 4 | MAS-SHIP-04 — submission metadata (Data-Not-Collected + PrivacyInfo.xcprivacy, 4+, real-state screenshots, support/privacy URLs, Notes-for-Review) | ✓ VERIFIED | `PrivacyInfo.xcprivacy` lints OK (NSPrivacyTracking=false, CA92.1); `ITSAppUsesNonExemptEncryption=false` in Info.plist; 7 screenshots @ 2880×1800 no-alpha; `listing.md` (69 lines); `Notes-for-Review.md` (on-device StoreKit 2, `com.tinkerdev.app.pro`); runbook cites Data Not Collected + Support/Privacy URLs. |
| 5 | MAS-SHIP-05 — direct channel un-regressed (DMG builds/signs/notarises; decoder + 19 tests untouched) | ✓ VERIFIED | `pnpm release:build-only` produced signed+notarised+stapled universal DMG `TinkerDev_1.0.0_universal.dmg` (on disk); decoder.ts + decoder.test.ts byte-identical since port commit `90583b79` (last touched 2026-05-30, before phase); 19 decoder tests green; no `v1.0.0` app tag, no release cut. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/build-appstore-pkg.sh` | productbuild pipeline + pre-ITMS gates | ✓ VERIFIED | All gate patterns present (productbuild, app-sandbox, security cms -D, ExpirationDate, get-task-allow, pkgutil --check-signature, verify-appstore-bundle.sh, ASC-SETUP pointer, xattr/quarantine guard); no bare `--features appstore` (HYBRID guard); spctl info-only (not gated) |
| `src-tauri/PrivacyInfo.xcprivacy` | Data Not Collected, CA92.1 | ✓ VERIFIED | plutil OK; NSPrivacyTracking=false; CA92.1 |
| `src-tauri/tauri.conf.json` | version 1.0.0 + category DeveloperTools | ✓ VERIFIED | 1.0.0; `bundle.category=DeveloperTools` (fixes 409) |
| `package.json` | 1.0.0 + release:build-only + tauri:build:appstore:pkg | ✓ VERIFIED | All three present, exact script strings |
| `src-tauri/Cargo.toml` | crate 1.0.0 | ✓ VERIFIED | `version = "1.0.0"` |
| `src/lib/release/publishPlan.ts` | parsePublishArgs {dryRun, buildOnly} + mutual-exclusion | ✓ VERIFIED | buildOnly field + guard at lines 39/57/65/73/79 |
| `scripts/build-and-publish.mjs` | build-only early return before publish writes | ✓ VERIFIED | `if (buildOnly)` return placed AFTER spctl-accept, BEFORE latest.json write + gh create |
| `docs/appstore/*` (runbook, notes, listing, screenshots) | metadata deliverables | ✓ VERIFIED | All present; 7 PNGs 2880×1800; runbook 107 lines |
| `.gitignore` | `*.pkg` ignored | ✓ VERIFIED | line 74 `*.pkg` |
| `src-tauri/Info.plist` | ITSAppUsesNonExemptEncryption=false | ✓ VERIFIED | `<false/>` |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| package.json 1.0.0 | build-and-publish.mjs readCurrentVersion | release tooling reads package.json | ✓ WIRED |
| tauri.conf.json 1.0.0 | tauri.appstore.conf.json | overlay inherits (no version key) | ✓ WIRED (overlay confirmed has no version key) |
| parsePublishArgs buildOnly | publish() early-return | threads into publish(view, version, {x86Present, buildOnly}) | ✓ WIRED |
| build-appstore-pkg.sh | verify-appstore-bundle.sh | reuses compliance + freshness gate | ✓ WIRED |
| build-appstore-pkg.sh | signed .pkg | productbuild --component ... --sign INSTALLER_ID | ✓ WIRED (on-disk .pkg has installer chain) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Decoder hero tests | `vitest run decoder.test.ts` | 19 pass | ✓ PASS |
| publishPlan arg parser | `vitest run publishPlan.test.ts` | 61 pass (80 total w/ decoder) | ✓ PASS |
| pkg script syntax | `bash -n build-appstore-pkg.sh` | exit 0 | ✓ PASS |
| .pkg installer chain | `pkgutil --check-signature TinkerDev.pkg` | 3rd Party Mac Developer Installer FK4HQK83WX | ✓ PASS |
| build-only return order | string-index assert | spctl(415) < buildOnly(429) < latest.json(452) < gh create(461) | ✓ PASS |
| No app release tag | `git tag --points-at HEAD` / `v1.0.0` | empty / absent | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
|-------------|-------------|--------|----------|
| MAS-SHIP-01 | 30-03 | ✓ SATISFIED | build-appstore-pkg.sh + on-disk installer-signed .pkg |
| MAS-SHIP-02 | 30-03 | ✓ SATISFIED | productbuild + Transporter upload + Submit 2026-06-27 |
| MAS-SHIP-03 | 30-02/03 | ✓ SATISFIED | SUBMISSION-RUNBOOK + ASC-SETUP + Notes-for-Review |
| MAS-SHIP-04 | 30-01/02 | ✓ SATISFIED | PrivacyInfo + screenshots + listing + URLs + encryption flag |
| MAS-SHIP-05 | 30-01 | ✓ SATISFIED | real DMG build-only proof + decoder byte-identity |

All five MAS-SHIP-01..05 declared in plan frontmatter and mapped in REQUIREMENTS.md (line 96-100, all marked Complete). No orphaned requirements.

### Anti-Patterns Found

None blocking. The pkg script's `spctl` appears only in info-only/comment context (correct — a MAS pkg legitimately rejects under Gatekeeper, not gated). No bare `--features appstore` (HYBRID guard intact). No secrets committed; `.pkg` gitignored.

### Human Verification Required

None outstanding. The terminal human ship-gate (D-04 — Submit for Review) is an irreversible 100%-human action that already COMPLETED 2026-06-27 (app now "Waiting for Review"). Apple's review OUTCOME is external and out of GSD scope — not a phase gap.

### Gaps Summary

No gaps. All 5 must-haves (MAS-SHIP-01..05) verify against the codebase: the signed `.pkg` pipeline exists and produced an installer-signed artifact; the metadata deliverables (PrivacyInfo, screenshots, listing, Notes, URLs, encryption flag) are present; the direct channel is proven un-regressed by a real DMG build with the decoder + its 19 tests byte-for-byte untouched. The human Submit-for-Review gate already passed; only Apple's external review remains.

---

_Verified: 2026-06-29T20:56:14Z_
_Verifier: Claude (gsd-verifier)_
