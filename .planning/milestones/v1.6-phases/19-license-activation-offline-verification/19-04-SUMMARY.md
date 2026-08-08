---
phase: 19-license-activation-offline-verification
plan: 04
subsystem: ui
tags: [licensing, keygen, tauri, react, wcag, e2e, keychain]

# Dependency graph
requires:
  - phase: 19-license-activation-offline-verification (plan 02)
    provides: Rust license core — fail-closed verify, LicenseStatusPayload contract, trait-mocked Keychain
  - phase: 19-license-activation-offline-verification (plan 03)
    provides: 4-command Tauri surface + platform.license seam with deterministic stubs
provides:
  - Inline activation UX in the shared upsell panel (D-33..D-39, D-44) with licensed/error/problem states
  - D-43 footer attention state on the D-29 "Unlock Pro" row
  - licenseUi snapshot store (footer + panel share one pure-local status source, D-45)
  - Real-WKWebView e2e proof (license.e2e.ts) incl. seeded-corrupt machine.lic fail-closed flow
  - Per-process Keychain stored-key cache (max one auth prompt per launch)
affects: [phase-21-entitlements-wiring, licensing, upsell]

# Tech tracking
tech-stack:
  added: []
  patterns: [snapshot-store + useSyncExternalStore for license UI state, readOnly-not-disabled for in-flight form fields, persistent helper line over placeholder-only affordances]

key-files:
  created:
    - src/lib/license/licenseUi.ts
    - src/lib/license/licenseUi.test.ts
    - src/shell/useLicenseUi.ts
    - test/e2e/license.e2e.ts
  modified:
    - src/components/UpsellPanel.tsx
    - src/components/UpsellPanel.test.tsx
    - src/components/Sidebar.tsx
    - src/main.tsx
    - src/lib/entitlements/store.ts
    - src-tauri/src/license/mod.rs
    - src-tauri/src/license/keygen_client.rs
    - scripts/e2e-spike.sh
    - scripts/keygen-ce/README.md

key-decisions:
  - "Copy says 'device', never 'Mac' (user decision 2026-06-12, overrides the D-36/D-44 draft wording) — cross-platform future"
  - "Successful activation clears the persisted D-31 dev free-tier override so Pro visibly unlocks live; the override stays downgrade-only everywhere else"
  - "UpsellModal scrim z-[60] over the shell's z-50 overlay stack — nothing interactive floats outside the aria-modal trap"
  - "Keychain stored-key flag cached per process — each uncached read can raise the macOS auth prompt on signature change; fresh users (no item) are never prompted (errSecItemNotFound has no UI)"
  - "Release builds cannot activate against the local CE — DEVTOOLS_KEYGEN_CA is compiled out (T-19-16, by design); local-CE activation is dev-build-only"

patterns-established:
  - "In-flight form fields use readOnly (not disabled) + disabled submit, so keyboard/SR focus survives the async window"
  - "e2e-spike preflight deletes the dev license Keychain item — deterministic e2e regardless of prior manual activations"

requirements-completed: [LIC-01, LIC-02, LIC-03, LIC-06]

# Metrics
duration: ~3h (incl. two live-walkthrough debug cycles + fix batch)
completed: 2026-06-12
---

# Plan 19-04: Activation UX + fail-closed surfacing + phase boundary Summary

**Inline license activation in the shared upsell panel with live entitlement unlock, fail-closed footer/panel surfacing, real-WKWebView e2e proof, and a human-approved walkthrough against live local Keygen CE**

## Performance

- **Duration:** ~3h wall (automation ~70min; rest live human walkthrough + feedback cycles)
- **Completed:** 2026-06-12
- **Tasks:** 3/3 (Task 3 = human-verify checkpoint, approved)
- **Files modified:** 13

## Accomplishments
- Activation UX: D-33 inline reveal, D-34 aria-live status, D-35 dismissible licensed state with live entitlement refresh, D-36/D-37/D-38 calm typed error copy with value retention, D-44 problem state with stored-key reactivation
- D-43 footer attention state; entitlements-independent condition (survives the Phase-21 flip)
- Walkthrough fix batch (user feedback): device wording, WCAG fixes (z-[60] scrim, readOnly focus retention, persistent stored-key helper line), activation clears the dev free-tier override, Keychain prompt-flood fix
- Full gate green at sign-off: tsc · vitest 838/838 · eslint · cargo 50/50 · WKWebView e2e 16/16 · UI audit 22/24 · release build + human walkthrough approved

## Task Commits

1. **Task 1: Inline activation UX (D-33..D-39, D-44)** - `b0f375df` (feat)
2. **Task 2: D-43 footer attention + real-WKWebView e2e** - `a3c0280f` (feat)
3. **Task 3 (checkpoint feedback batch):**
   - `06f7835f` (fix) — device wording, WCAG a11y, activation clears dev free-tier override
   - `1ad7d838` (fix) — DEVTOOLS_KEYGEN_CA ergonomics + deterministic e2e keychain state
   - `efc0929a` (fix) — per-process Keychain stored-key cache (one auth prompt max)

## Files Created/Modified
- `src/components/UpsellPanel.tsx` — activation form + all states; z-[60] scrim; readOnly-in-flight; stored-key helper line
- `src/lib/license/licenseUi.ts` + `src/shell/useLicenseUi.ts` — snapshot store over pure-local status
- `src/components/Sidebar.tsx` — D-43 "License needs attention" on the D-29 row
- `src/lib/entitlements/store.ts` — clearEntitlementsOverride() (activation-success path)
- `src-tauri/src/license/mod.rs` — stored_key_flag cache + counting-keychain regression tests
- `src-tauri/src/license/keygen_client.rs` — relative CA path retry (debug-only); "Device" fallback
- `test/e2e/license.e2e.ts` — form mechanics + seeded-corrupt fail-closed flow on the real WKWebView
- `scripts/e2e-spike.sh` — preflight Keychain item delete

## Decisions Made
See key-decisions frontmatter. All five originated from the live walkthrough (user decisions or empirical findings).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] DEVTOOLS_KEYGEN_CA relative path silently fell back to default roots**
- **Found during:** Task 3 walkthrough (activate → serviceUnreachable despite healthy CE)
- **Issue:** `tauri dev` runs the binary with cwd `src-tauri/`; the documented repo-relative CA path missed → TLS untrusted → every activate failed
- **Fix:** README documents the absolute-path invocation; debug-only retry one level up in build_http_client()
- **Committed in:** `1ad7d838`

**2. [Rule 1 - Bug] Keychain prompt flood in problem/not-activated sessions**
- **Found during:** Task 3 release walkthrough (5+ prompts)
- **Issue:** has_stored_key read the Keychain on every status query; each read prompts when the binary signature changed
- **Fix:** per-process cache maintained by the manager's own writes; counting-keychain tests pin it
- **Committed in:** `efc0929a`

**3. [Rule 3 - Blocking] e2e state pollution from manual walkthroughs**
- **Found during:** Task 3 gate re-run (3 spec failures)
- **Issue:** persisted `entitlementsOverride:"free"` + leftover Keychain item (auth prompt hang) broke e2e assumptions
- **Fix:** reset polluted pref; e2e-spike preflight now deletes the dev license Keychain item
- **Committed in:** `1ad7d838`

**Total deviations:** 3 auto-fixed + 1 user-directed scope addition (UI-audit fixes 1–3 + device copy + override clear, all user-approved at checkpoint)
**Impact on plan:** all fixes serve the plan's own acceptance criteria; no scope creep beyond user-approved items.

## Issues Encountered
- Release app cannot activate against local CE — **by design** (DEVTOOLS_KEYGEN_CA compiled out of release, T-19-16). Walkthrough restores machine.lic via the dev app instead.
- Offline activate "succeeds" against local CE — expected test-setup artifact (CE is localhost; Wi-Fi off doesn't cut localhost).

## User Setup Required
None — local CE infra was Plan 01; nothing new.

## Next Phase Readiness
- LIC-05 (refresh) and LIC-07 (deactivate) primitives are callable-but-unwired; UI wiring is Phase 21
- resolveEntitlements' Tauri arm still defaults FULL — Phase 21 swaps it for license_status
- Known dev-time noise: each dev rebuild re-prompts Keychain once per launch (signature churn); release binaries are stable per build

---
*Phase: 19-license-activation-offline-verification*
*Completed: 2026-06-12*
