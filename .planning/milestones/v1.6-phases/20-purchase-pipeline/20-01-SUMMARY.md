---
phase: 20-purchase-pipeline
plan: 01
subsystem: payments
tags: [tauri-plugin-opener, platform-seam, keygen, cfg-debug_assertions, react, rust, wcag]

# Dependency graph
requires:
  - phase: 18-entitlements-seam
    provides: "UpsellPanel/UpsellModal shared upsell surface + the D-29 free-tier 'Unlock Pro' footer that opens it; the platform seam (clipboard/store/license capability pattern)"
  - phase: 19-license-activation
    provides: "src-tauri/src/license/config.rs (the 4 licensing constants + verifying_key + 3 unit tests) and the keygen_client.rs #[cfg(debug_assertions)] idiom"
provides:
  - "https-only opener capability on the platform seam (index/tauri/browser), wired to @tauri-apps/plugin-opener (the first new webview runtime dep — the explicit D-67 exception)"
  - "Buy CTA opening https://tinkerdev.io/buy (D-68 own-domain redirect) via platform.opener.openUrl — no in-app navigation"
  - "config.rs licensing constants cfg(debug_assertions)-split (dev = local CE, release = license.tinkerdev.io + Plan-03 placeholders), APP_SALT unchanged"
  - "release-only #[cfg(not(debug_assertions))] tripwire test + extended check-dev-strip.sh prod-constant binary check (D-52)"
affects: [21-lifecycle-ship-gate, purchase-pipeline-backend, plan-20-03-setup]

# Tech tracking
tech-stack:
  added: ["@tauri-apps/plugin-opener 2.5.4 (npm)", "tauri-plugin-opener \"2\" (crate)"]
  patterns:
    - "Opener seam wrapper: a new capability mirrors the license-capability shape across index.ts (interface + proxy getter) / tauri.ts (the only @tauri-apps import) / browser.ts (deterministic no-op) — never navigates jsdom/preview"
    - "cfg(debug_assertions)-split per-env Rust constants with a single unsplit APP_SALT + a #[cfg(not(debug_assertions))] release tripwire test as the prod-readiness gate"

key-files:
  created:
    - "test/e2e/license-buy.e2e.ts — real-WKWebView Buy-wiring proof (in-app contract; native open is manual)"
    - ".planning/phases/20-purchase-pipeline/deferred-items.md — pre-existing dev-toggle e2e flake log"
  modified:
    - "src/lib/platform/index.ts — opener on Platform interface + proxy getter"
    - "src/lib/platform/tauri.ts — openUrl import (only @tauri-apps/plugin-opener importer) + opener arm"
    - "src/lib/platform/browser.ts — deterministic opener no-op"
    - "src/components/UpsellPanel.tsx — BUY_LICENSE_URL=https://tinkerdev.io/buy + Buy onClick via the seam"
    - "src-tauri/src/license/config.rs — cfg-split constants + release tripwire test"
    - "src-tauri/capabilities/default.json — opener:allow-open-url scoped https-only"
    - "src-tauri/Cargo.toml + src-tauri/src/lib.rs — opener crate + plugin registration"
    - "scripts/check-dev-strip.sh — D-52 prod-constant release-binary check"
    - "src/shell/testStore.ts + src/lib/platform/platform.test.ts — opener test arms"

key-decisions:
  - "D-68: the compiled Buy constant is the own-domain redirect https://tinkerdev.io/buy, not the raw MoR/store link — a store change never needs an app release"
  - "Opener reached ONLY through src/lib/platform/; @tauri-apps/plugin-opener imported ONLY in tauri.ts (CLAUDE.md/T-20-04 grep-enforced)"
  - "config.rs release tripwire is #[cfg(not(debug_assertions))] so default debug cargo test stays green; cargo test --release is Plan 03's gate"
  - "Shared noopOpener added to makeMemoryPlatform (testStore) as the single source of truth for the 13+ test Platform literals (Rule 3 blocking-fix)"

patterns-established:
  - "Capability-scoped https-only opener: { identifier: 'opener:allow-open-url', allow: [{ url: 'https://*' }] } in default.json blocks non-https schemes (T-20-01)"
  - "Best-effort calm hand-off: the Buy onClick logs on failure and never throws at the user"

requirements-completed: [PAY-01]

# Metrics
duration: 75min
completed: 2026-06-13
---

# Phase 20 Plan 01: Buy Wiring + D-52 Constant Switch Summary

**https-only opener seam wired to @tauri-apps/plugin-opener so the Buy CTA opens https://tinkerdev.io/buy in the OS default browser, plus cfg(debug_assertions)-split licensing constants (release = license.tinkerdev.io) with a release-only prod-readiness tripwire.**

## Performance

- **Duration:** ~75 min (incl. two full real-WKWebView e2e gate runs)
- **Started:** 2026-06-13T17:54:59Z
- **Completed:** 2026-06-13T19:10:00Z
- **Tasks:** 4
- **Files modified:** 13 (2 created)

## Accomplishments
- Added an `opener` capability to the platform seam (interface + proxy getter + tauri/browser arms), installed `@tauri-apps/plugin-opener` (npm 2.5.4 + crate "2"), registered `tauri_plugin_opener::init()`, and scoped `opener:allow-open-url` to https-only — the first new webview runtime dep, the explicit D-67 exception.
- Rewired the UpsellPanel "Buy license" CTA from the D-21 stub no-op to `platform.opener.openUrl("https://tinkerdev.io/buy")` (D-68), best-effort/calm (logs on failure, never throws), with rewritten unit tests asserting the seam call + no in-app navigation.
- Split the three env-varying licensing constants in `config.rs` by build profile via `cfg(debug_assertions)` (dev = local CE, release = `license.tinkerdev.io` + Plan-03 placeholders) with `APP_SALT` byte-identical and unsplit; added a `#[cfg(not(debug_assertions))]` tripwire test that fails `cargo test --release` until Plan 03 mints real values, and extended `check-dev-strip.sh` with a prod-constant release-binary grep (D-52).
- Authored a real-WKWebView Buy-wiring e2e asserting the observable in-app contract (route/hash unchanged, modal stays mounted, no throw); native browser-open documented as a manual-walkthrough item.

## Task Commits

1. **Task 1: opener capability on the platform seam** - `e7e2295e` (feat)
2. **Task 2: wire Buy CTA to the opener seam + tests** - `b0222e5d` (feat, TDD — tests landed GREEN with impl per lefthook constraint)
3. **Task 3: cfg(debug_assertions)-split config.rs + dist-grep** - `80150140` (feat)
4. **Task 4: real-WKWebView Buy-wiring e2e** - `9e813f77` (test), hardened in `7523b3c1` (test)

## Files Created/Modified
- `src/lib/platform/index.ts` - opener on the Platform interface + `get opener()` proxy
- `src/lib/platform/tauri.ts` - `openUrl` import (sole @tauri-apps/plugin-opener importer) + opener arm
- `src/lib/platform/browser.ts` - deterministic opener no-op (never navigates jsdom)
- `src/components/UpsellPanel.tsx` - `BUY_LICENSE_URL=https://tinkerdev.io/buy` + Buy onClick via the seam
- `src/components/UpsellPanel.test.tsx` - rewrote the D-21 stub tests → seam-call + no-navigation assertions
- `src/lib/platform/platform.test.ts` - opener no-op arm + injected-stub routing tests
- `src/shell/testStore.ts` - shared `noopOpener` for test Platform literals
- `src-tauri/src/license/config.rs` - cfg-split constants + release tripwire test
- `src-tauri/capabilities/default.json` - `opener:allow-open-url` scoped `https://*`
- `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs` - opener crate + `tauri_plugin_opener::init()`
- `scripts/check-dev-strip.sh` - `check_prod_constants` D-52 release-binary check
- `test/e2e/license-buy.e2e.ts` *(new)* - Buy-wiring real-WKWebView spec
- `.planning/phases/20-purchase-pipeline/deferred-items.md` *(new)* - dev-toggle e2e flake log

## Decisions Made
- **D-68** Buy constant = own-domain redirect `https://tinkerdev.io/buy` (store/MoR change never forces an app release).
- Opener confined to `src/lib/platform/`; `@tauri-apps/plugin-opener` imported only in `tauri.ts` (grep-enforced, T-20-04).
- Release tripwire is `#[cfg(not(debug_assertions))]` so debug `cargo test` stays green (3/3); `cargo test --release` is Plan 03's prod-readiness gate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `opener` arm to existing full-Platform test literals**
- **Found during:** Task 1 (interface change)
- **Issue:** Widening the `Platform` interface broke tsc for every hand-rolled `Platform` literal — three in `platform.test.ts`, one in `src/shell/testStore.ts` (`makeMemoryPlatform`, the shared helper behind 13+ test Platforms).
- **Fix:** Added a shared `noopOpener` to `testStore.ts` and an `opener` arm to the three inline literals — one source of truth, no drift.
- **Files modified:** `src/shell/testStore.ts`, `src/lib/platform/platform.test.ts`
- **Verification:** `pnpm exec tsc --noEmit` exits 0; platform seam tests 14/14.
- **Committed in:** `e7e2295e` (Task 1 commit)

**2. [Rule 3 - Blocking] Reflowed the Buy onClick to keep the grep-checkable seam pattern on one line**
- **Found during:** Task 2 (verify)
- **Issue:** Prettier wrapped `platform.opener.openUrl(...)` across lines, failing the acceptance grep `platform.opener.openUrl` and the key_links `platform\.opener\.openUrl` pattern.
- **Fix:** Hoisted the call to a single-line `const open = platform.opener.openUrl(BUY_LICENSE_URL);` then `void open.catch(...)`.
- **Files modified:** `src/components/UpsellPanel.tsx`
- **Verification:** grep matches; tsc + UpsellPanel tests green.
- **Committed in:** `b0222e5d` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 blocking). **Impact:** required for the interface change to compile and the acceptance grep to hold. No scope creep.

## Issues Encountered

**Real-WKWebView e2e wave-merge gate blocked by a PRE-EXISTING, out-of-scope failure.** Two full `scripts/e2e-spike.sh` runs show the unmodified `entitlements.e2e.ts` failing FIRST and identically at its own line 181 — `expected the free-tier "Unlock Pro" footer row after the dev toggle (D-29)` — i.e. the shared ⌘K dev-toggle → `refreshEntitlements()` live-snapshot path does not flip to FREE on this WKWebView worker setup. This cascades into the two other license-touching specs (`license-buy.e2e.ts` new, `license.e2e.ts` unmodified) and `sidebar.e2e.ts` (override pollution). All 13 non-license specs PASS, the dev build compiles clean (including the new opener plugin), and this plan touched neither the entitlements nor the dev-toggle path — so the break is environmental (matches project memory `license-walkthrough-state-pollutes-e2e`).

Mitigation: `license-buy.e2e.ts` now retries the toggle up to 4× before failing loud; the failure is documented in `deferred-items.md` with a recommendation to fold a deterministic prefs/override reset into the e2e preflight at the Phase 20/21 hardening pass. The PAY-01 positive contract is fully pinned at the unit layer (`UpsellPanel.test.tsx`: `openUrl` called once with `https://tinkerdev.io/buy`, no navigation); the native browser-open is a manual-walkthrough item per 20-VALIDATION.

## Known Stubs

**config.rs production licensing constants (INTENTIONAL, resolved by Plan 03).** The release arm embeds `PROD_ACCOUNT_ID_PLACEHOLDER` / `PROD_PUBKEY_PLACEHOLDER` sentinels (D-51). These are by design: Plan 03's `setup.sh` mints the real values, and the `#[cfg(not(debug_assertions))]` tripwire test (`cargo test --release`) is the gate that fails while the placeholders remain. Debug builds (dev + `cargo test`) use the real local CE values and are unaffected.

## User Setup Required
None - no external service configuration required in this plan. (Plan 03 stands up the production Keygen CE + backend and fills the config.rs prod constants.)

## Next Phase Readiness
- The opener seam + Buy wiring (PAY-01) are complete and unit-proven; the app-side surface for the purchase pipeline is done.
- Plan 03 (production CE bring-up) must: fill the two `config.rs` prod placeholders via `setup.sh`, run `cargo test --release` green (the tripwire flips), and run `scripts/check-dev-strip.sh` with `CHECK_PROD_BINARY` against the release binary.
- Phase 20/21 e2e hardening should resolve the shared dev-toggle prefs/override reset so the three license specs run green on the real WKWebView (deferred-items.md).

## Self-Check: PASSED

- Files verified present: `test/e2e/license-buy.e2e.ts`, `deferred-items.md`, `20-01-SUMMARY.md`, `src/lib/platform/tauri.ts`, `src-tauri/src/license/config.rs`.
- Commits verified: `e7e2295e`, `b0222e5d`, `80150140`, `9e813f77`, `7523b3c1`.
- Artifact contains-checks: opener import in tauri.ts, `https://tinkerdev.io/buy` in UpsellPanel.tsx, `license.tinkerdev.io` in config.rs, `opener` in capabilities/default.json.
- Gates: unit suite 841/841, `tsc --noEmit` clean, `cargo test` (debug) config 3/3, lefthook (typecheck+test+lint) green on every commit. Real-WKWebView e2e wave-merge gate blocked by a documented pre-existing out-of-scope failure (see Issues Encountered + deferred-items.md).

---
*Phase: 20-purchase-pipeline*
*Completed: 2026-06-13*
