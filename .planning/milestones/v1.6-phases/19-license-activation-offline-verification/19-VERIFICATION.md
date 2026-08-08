---
phase: 19-license-activation-offline-verification
verified: 2026-06-12T00:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification_completed:
  approved: 2026-06-12
  evidence: "Plan 04 Task 3 human-verify checkpoint approved — live paste-key activation vs local CE, offline licensed relaunch, seat-limit rejection, fail-closed corrupt machine.lic (dev + release), stored-key empty-field reactivation, release-build offline launch, Keychain item verified via security find-generic-password; 19-UI-REVIEW.md WCAG audit 22/24 with all 3 priority fixes applied"
---

# Phase 19: License Activation & Offline Verification — Verification Report

**Phase Goal:** A user with a license key can activate this Mac once online and thereafter launch fully licensed, fully offline — all verification and key material Rust-owned, never in the webview.
**Verified:** 2026-06-12
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Paste key → one online activation (validate → activate → checkout), HMAC fingerprint in Rust, machine.lic cached, entitlements unlock live | ✓ VERIFIED | `fingerprint.rs` HMAC-SHA256(APP_SALT, IOPlatformUUID); `mod.rs:237/279` `verify_then_persist` → `write_atomic` then `set_key` (write-after-verify, no partial state); `UpsellPanel.tsx:151` `platform.license.activate(trimmed \|\| null)`, `:156-160` `clearEntitlementsOverride` + `refreshEntitlements` (D-32 live flip). Human walkthrough: live activation approved |
| 2 | Second-Mac activation rejected with calm error naming resolution path | ✓ VERIFIED | `keygen_client.rs:22` `SEAT_LIMIT_CODE = "MACHINE_LIMIT_EXCEEDED"` (verbatim from SPIKE), `:188` `FINGERPRINT_SCOPE_MISMATCH` → SeatTakenElsewhere — both map to `seatLimit`; `UpsellPanel.tsx:61` "already active on another device. Deactivate it on the other device first" (user-approved "device" wording). Walkthrough: seat-limit rejection approved |
| 3 | Offline launch resolves licensed — Ed25519 verify_strict + fingerprint check, zero network | ✓ VERIFIED | `verify.rs:142-143` `verify_strict` over literal `"machine/"+enc`; `commands.rs:26-30` `license_status` = lock + `resolve_status()` only (pure-local, D-45); real-CE fixture cross-validation test green (verify.rs:335 `include_str!` ce-machine.lic). Walkthrough: offline licensed relaunch (dev + release build) approved |
| 4 | Corrupt/tampered/foreign machine.lic fails closed — no crash, calm messaging, re-activation offered | ✓ VERIFIED | `verify.rs:34-45` typed `Corrupt\|UnsupportedAlg\|Tampered\|ForeignMachine` (each constructed by tests, 50/50 cargo green); `Sidebar.tsx:612` "License needs attention" footer (entitlements-independent); UpsellPanel D-44 problem state with stored-key reactivation; `license.e2e.ts` seeded-corrupt flow green on real WKWebView. Walkthrough: fail-closed approved |
| 5 | Key Keychain-only, never readable from JS; key→token SPIKE outcome recorded | ✓ VERIFIED | `keychain.rs:19` service `com.tinkerdev.app.license` (keyring 3.6 apple-native); `LicenseStatusPayload` (mod.rs:28-41) carries only `has_stored_key: bool` — no key field; 19-SPIKE-OUTCOME.md `## Verdict`: token exchange DENIED (403) → raw key stored. Walkthrough: Keychain item exists, no key on disk |

**Score:** 5/5 truths verified

### Required Artifacts (all 4 plans, gsd-tools `verify artifacts`)

| Plan | Artifacts | Status |
|------|-----------|--------|
| 19-01 | compose.yaml, bootstrap.sh, 19-SPIKE-OUTCOME.md, ce-machine.lic, ce-ed25519-pubkey.b64 | ✓ 5/5 passed (PEM markers + min-lines + pattern checks) |
| 19-02 | verify.rs, fingerprint.rs, config.rs, keychain.rs, store.rs | ✓ 5/5 passed |
| 19-03 | keygen_client.rs, commands.rs, platform/index.ts, platform/tauri.ts | ✓ 4/4 passed |
| 19-04 | UpsellPanel.tsx, licenseUi.ts, Sidebar.tsx, license.e2e.ts | ✓ 4/4 passed |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| spike.sh | 19-SPIKE-OUTCOME.md | MACHINE_LIMIT transcript | ✓ WIRED |
| bootstrap.sh | CE policies | authenticationStrategy LICENSE | ✓ WIRED |
| verify.rs | ce-machine.lic | cross-validation test | ✓ WIRED (manual: verify.rs:335 `include_str!("../../fixtures/ce-machine.lic")` — tool regex false-negative) |
| mod.rs | verify.rs | verify_machine_file in status path | ✓ WIRED |
| lib.rs | license/mod.rs | `mod license` + manage(LicenseState) + generate_handler! 4 commands | ✓ WIRED |
| tauri.ts | Rust commands | invoke × 4 | ✓ WIRED (manual: tauri.ts:121-124 all 4 invokes — tool regex was malformed) |
| mod.rs | keychain.rs | set_key on verified checkout | ✓ WIRED |
| UpsellPanel.tsx | platform.license | activate(trimmed \|\| null) | ✓ WIRED (manual: line 151 — tool false-negative) |
| UpsellPanel.tsx | entitlements/store.ts | refreshEntitlements on success | ✓ WIRED |
| Sidebar.tsx | licenseUi.ts | useLicenseUi drives footer attention | ✓ WIRED |
| main.tsx | licenseUi.ts | startup refreshLicenseUi (pure-local) | ✓ WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Real Data | Status |
|----------|--------------|--------|-----------|--------|
| Sidebar footer | `licenseAttention` | useLicenseUi() ← licenseUi snapshot store ← platform.license.status() ← Rust resolve_status (file read + Ed25519 verify) | Yes | ✓ FLOWING |
| UpsellPanel states | license snapshot + activate result | platform.license.activate → invoke → state machine → KeygenClient (live-proven vs local CE) | Yes | ✓ FLOWING |
| main.tsx startup | refreshLicenseUi | pure-local license_status (D-45 — no launch network) | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| License Rust core + client + state machine | `cargo test license::` | 50 passed, 0 failed | ✓ PASS |
| License/platform/UpsellPanel webview suites | `pnpm vitest run src/lib/platform/ src/lib/license/ UpsellPanel.test.tsx` | 44 passed (4 files) | ✓ PASS |
| Type contract | `pnpm exec tsc --noEmit` | exit 0 | ✓ PASS |
| Real-WKWebView e2e | per close gates (context) | 16/16 specs incl. license.e2e.ts | ✓ PASS (recorded at phase close) |

### Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
|-------------|-------------|--------|----------|
| LIC-01 paste-key activation, fingerprint binding | 19-01, 19-02, 19-03, 19-04 | ✓ SATISFIED | SC1 evidence; live walkthrough approved |
| LIC-02 server-side seat limit, calm error | 19-01, 19-03, 19-04 | ✓ SATISFIED | SC2 evidence; verbatim MACHINE_LIMIT_EXCEEDED mapping |
| LIC-03 offline launch verify, zero network | 19-02, 19-04 | ✓ SATISFIED | SC3 evidence; networking-off relaunch approved |
| LIC-04 key Keychain-only, Rust-owned | 19-01, 19-02, 19-03 | ✓ SATISFIED | SC5 evidence; already Complete in REQUIREMENTS.md traceability |
| LIC-06 fail-closed to free tier | 19-02, 19-04 | ✓ SATISFIED | SC4 evidence; corrupt-lic walkthrough approved |

No orphaned requirements: REQUIREMENTS.md maps exactly LIC-01/02/03/04/06 to Phase 19; all five appear in plan frontmatter.

**Info (non-blocking):** REQUIREMENTS.md traceability rows for LIC-01/02/03/06 still read "Pending / —"; 19-04-SUMMARY frontmatter declares `requirements-completed: [LIC-01, LIC-02, LIC-03, LIC-06]`. Update the traceability table to `Phase 19 | 19-01..19-04 | Complete` at milestone bookkeeping.

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| — | No TODO/FIXME/stub/empty-return patterns in src-tauri/src/license/, src/lib/license/, UpsellPanel.tsx (matches were test fixtures, CSS placeholder styling, and explanatory comments) | — | None |
| src/lib/platform/* (non-tauri.ts), CopyButton.tsx | `@tauri-apps` strings | ℹ️ Info | Comment-only — no actual imports; containment intact (`grep platform.license src/tools/` = 0) |

### User-Approved Deviations (recorded, not gaps)

1. Copy says "device" not "Mac" (overrides D-36/D-44 draft wording — cross-platform future; user decision 2026-06-12).
2. Successful activation clears the dev free-tier entitlements override (user-approved scope addition for live unlock visibility).
3. `refresh_license`/`deactivate_machine` callable-but-unwired — by design; UI wiring is Phase 21 (LIC-05/LIC-07).

### Human Verification Required

None outstanding. The Plan 04 Task 3 blocking checkpoint was completed and APPROVED 2026-06-12 against live local Keygen CE, covering every item that would otherwise route here: live paste-key activation, offline licensed relaunch (dev + release), seat-limit rejection message, fail-closed corrupt machine.lic surfacing, stored-key empty-field reactivation, Keychain item check. WCAG-AA audit 19-UI-REVIEW.md 22/24 with all 3 priority fixes applied; code review 19-REVIEW.md 0 critical / 6 advisory warnings.

### Gaps Summary

No gaps. All five ROADMAP success criteria are verified in the codebase at all four levels (exists, substantive, wired, data flowing), the merged plan-level truths hold, all five phase requirements are satisfied with evidence, gates were green at close (tsc, vitest 838/838, eslint, cargo 50/50, WKWebView e2e 16/16), and the human walkthrough is approved. Phase 19 goal achieved.

---

_Verified: 2026-06-12_
_Verifier: Claude (gsd-verifier)_
