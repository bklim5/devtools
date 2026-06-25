---
phase: 29-sandbox-safe-native-features
verified: 2026-06-25T00:00:00Z
status: passed
score: 13/13 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 29: Sandbox-Safe Native Features Verification Report

**Phase Goal:** Sandbox-Safe Native Features — global summon (RegisterEventHotKey, sandbox-safe) + tray kept under sandbox; keyring/Keychain gated OUT of the store build (no MissingEntitlement, no unjustified keychain-access-groups entitlement); launch-at-login hidden/absent in the store build (SMAppService deferred to v2).
**Verified:** 2026-06-25
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
| -- | ----- | ------ | -------- |
| 1  | Store binary links no keyring crate | ✓ VERIFIED | `cargo tree --no-default-features --features appstore` — no keyring/autostart/updater; direct tree keyring=1. Cargo.toml:62 `keyring … optional = true`; :126 `direct = [… "dep:keyring"]` |
| 2  | Store binary registers no license_* commands / no LicenseState setup | ✓ VERIFIED | lib.rs:26-27 `#[cfg(feature="direct")] mod license`; :130 setup license block direct-gated; :463-476 both appstore invoke_handler arms register ONLY 4 iap commands (zero `license::commands::`) |
| 3  | Store tray menu is EXACTLY Show / Settings… / Quit | ✓ VERIFIED | lib.rs:290-292 `check_updates_i` direct-gated; :297-299 Vec slice with `#[cfg(direct)] items.push(&check_updates_i)`; :322-323 menu-event arm direct-gated. Human gate (29-03) confirmed on signed .app |
| 4  | Direct build keeps keyring + 4 license commands + tray Updates item unchanged | ✓ VERIFIED | direct cargo tree keyring=1; lib.rs:444-462 direct arms carry full license surface; tray item present under direct cfg |
| 5  | Both cargo build (direct) and `--no-default-features --features appstore` compile clean | ✓ VERIFIED | 29-01/29-03 SUMMARYs (exit 0 all variants); compile_error! guard lib.rs:11 enforces mutual-exclusion (4efe3ef4); bundle built from this source |
| 6  | Store General pane renders NO launch-at-login toggle/label/helper/live-region; Open-to + Start-in-tray remain | ✓ VERIFIED | GeneralSettings.tsx:110 `{!IS_APPSTORE && <SettingToggle label="Launch at login"…>}`; :159 live-region `!IS_APPSTORE`-gated; :55 reconcile effect `if(IS_APPSTORE) return`. Human gate confirmed |
| 7  | Autostart seam no-ops under IS_APPSTORE | ✓ VERIFIED | tauri.ts:174-176 enable/disable→Promise.resolve(), isEnabled→Promise.resolve(false) under IS_APPSTORE; tauri.test.ts present |
| 8  | Whole updater overlay extracted to UpdaterOverlay.tsx, IS_APPSTORE lazy-gated → tree-shakes out | ✓ VERIFIED | UpdaterOverlay.tsx exists (useUpdater/UpdateBanner/setUpdateInfoForTest count=8); App.tsx:47-49 `IS_APPSTORE ? null : lazy(()=>import("./components/UpdaterOverlay"))`; App.tsx has 0 updater imports |
| 9  | Store renders NO opt-in prompt / NO UpdateBanner; updater.check 0×, onMenuCheckUpdates 0 listeners | ✓ VERIFIED | App.test.tsx store-build cases (per 29-02 SUMMARY, null+true autoUpdateCheck); guard tree-shakes UI subtree; human gate confirmed no banner/opt-in on signed .app |
| 10 | Store boot path invokes NO platform.license.* IPC (explicit assertion) | ✓ VERIFIED | main.test.tsx D-03 assertion (license_status/updater check spies ×0, iap.currentEntitlements ≥1) — grep count 8 |
| 11 | Direct build's General/autostart/full updater overlay byte-behaviourally unchanged (real WKWebView) | ✓ VERIFIED | update.e2e.ts waitUntil(__injectUpdate) deterministic; 29-02 SUMMARY: update.e2e.ts PASSED on real WKWebView (banner renders + keyboard-dismisses) |
| 12 | verify-appstore-bundle.sh FATALs on keyring/autostart in appstore tree, keychain-access-groups entitlement, updaterInChunks:true | ✓ VERIFIED | `--selftest` rc=0 (incl. updater true-trips/clean-false/missing-field); `--selftest-realbuild` rc=0 (real Vite fold-in FAILS, StoreUpdatesSettings NOT false-matched); greps keyring=11/keychain=7/updaterInChunks=20 |
| 13 | Chunk-module guard inventories updater UI modules (NOT plugin-updater package) | ✓ VERIFIED | licenseUiFoldInGuard.mjs UPDATER_MODULES = 5 UI regexes; structural node check: no plugin-updater in array (rc 0); emits updaterInChunks into sentinel |

**Score:** 13/13 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src-tauri/Cargo.toml` | keyring optional under direct | ✓ VERIFIED | :62 `optional = true`; :126 `dep:keyring` in direct |
| `src-tauri/src/lib.rs` | license module + tray updater item direct-gated | ✓ VERIFIED | :26,130,290,322 direct gates; appstore arms iap-only; compile_error guard :11 |
| `src/components/UpdaterOverlay.tsx` | direct-only updater surface | ✓ VERIFIED | Created; useUpdater/UpdateBanner/setUpdateInfoForTest=8 |
| `src/App.tsx` | IS_APPSTORE lazy switch; no updater imports | ✓ VERIFIED | :47-49 lazy switch; 0 updater imports; menu://open-settings stays |
| `src/components/GeneralSettings.tsx` | launch-at-login IS_APPSTORE-gated | ✓ VERIFIED | :55,110,159 gated; Open-to + Start-in-tray ungated |
| `src/lib/platform/tauri.ts` | autostart no-op under IS_APPSTORE | ✓ VERIFIED | :174-176 |
| `src/main.test.tsx` | boot-path no-license-IPC assertion | ✓ VERIFIED | license_status/check/currentEntitlements grep=8 |
| `test/e2e/update.e2e.ts` | deterministic __injectUpdate wait | ✓ VERIFIED | waitUntil=1 |
| `scripts/licenseUiFoldInGuard.mjs` | updater UI module inventory | ✓ VERIFIED | UPDATER_MODULES 5 regexes, no plugin-updater |
| `scripts/verify-appstore-bundle.sh` | keyring/keychain/updater FATAL gates | ✓ VERIFIED | both self-tests rc=0 |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| Cargo.toml direct | keyring crate | `dep:keyring` in direct list | ✓ WIRED | :126; appstore tree clean |
| lib.rs mod license | Keygen Rust surface | `#[cfg(direct)]` over mod + setup + commands | ✓ WIRED | :26,130; appstore arms iap-only |
| lib.rs tray check_updates_i | updater plugin | `#[cfg(direct)]` over item+slot+event arm | ✓ WIRED | :290,297-299,322 |
| GeneralSettings | launch toggle + reconcile | IS_APPSTORE guard | ✓ WIRED | :55,110,159 |
| tauri.ts autostart | plugin enable/disable/isEnabled | IS_APPSTORE early-return | ✓ WIRED | :174-176 |
| App.tsx UpdaterOverlay switch | updater UI subtree | `IS_APPSTORE ? null : lazy(import)` | ✓ WIRED | :47-49 |
| verify script | appstore cargo tree | grep keyring over `cargo tree --features appstore` | ✓ WIRED | self-test rc=0; tree clean |
| verify script | signed entitlements | codesign asserts no keychain-access-groups | ✓ WIRED | bundle audit confirms |
| guard + verify script | updater UI modules in dist chunks | chunk.modules sentinel `updaterInChunks:false` | ✓ WIRED | realbuild self-test catches fold-in |

### Data-Flow Trace (Level 4)

Store Pro state flows from StoreKit (`iap.currentEntitlements`), not Keygen — confirmed by main.test.tsx D-03 assertion (iap reached ≥1, license/updater 0). The updater overlay's dynamic data is direct-build only and proven live via update.e2e.ts on the real WKWebView (banner renders after deterministic __injectUpdate). No HOLLOW/DISCONNECTED artifacts.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| appstore tree drops keyring/autostart/updater | `cargo tree --no-default-features --features appstore` | clean | ✓ PASS |
| direct tree keeps keyring | `cargo tree \| grep -c 'keyring v'` | 1 | ✓ PASS |
| verify script pure-shell self-test | `verify-appstore-bundle.sh --selftest` | rc=0 (incl. updater cases) | ✓ PASS |
| verify script real-Vite self-test | `--selftest-realbuild` | rc=0 (fold-in FAILS, StoreUpdatesSettings not false-matched) | ✓ PASS |
| UPDATER_MODULES excludes plugin-updater | node structural check | rc 0 | ✓ PASS |
| signed bundle entitlements | `codesign -d --entitlements` | app-sandbox+network.client+app-id+team-id only, NO keychain-access-groups | ✓ PASS |
| bundle freshness | bin mtime 1782295623 > last src commit 1782295535 | not stale | ✓ PASS |
| decoder untouched | `git diff --stat src/lib/protobuf/` (across phase) | empty | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| MAS-NATIVE-01 | 29-03 | Global summon works in sandboxed store build | ✓ SATISFIED | Runtime/WebDriver-impossible; human gate (29-03 Task 2) APPROVED — summon revealed+focused over real OS chord on dev-signed sandboxed .app |
| MAS-NATIVE-02 | 29-01, 29-02, 29-03 | Tray/menu works in sandboxed store build | ✓ SATISFIED | Tray item direct-gated (lib.rs); 0 menu://check-updates listeners + overlay tree-shaken (29-02); human gate confirmed tray EXACTLY Show/Settings…/Quit, no opt-in/banner, no Console error |
| MAS-NATIVE-03 | 29-01, 29-02, 29-03 | Keychain gated OUT (no MissingEntitlement, no unjustified keychain-access-groups) | ✓ SATISFIED | keyring optional+direct-gated, appstore tree=0; D-03 runtime no-invoke; signed bundle codesign clean (no keychain-access-groups); human gate no runtime MissingEntitlement on Pro exercise |
| MAS-NATIVE-04 | 29-02, 29-03 | Launch-at-login hidden/absent in store General pane | ✓ SATISFIED | IS_APPSTORE-gated control+wiring; autostart seam no-op; human gate — no toggle in Settings▸General; cargo tree appstore clean of autostart |

All four phase requirement IDs accounted for and SATISFIED. No orphaned requirements (REQUIREMENTS.md maps exactly MAS-NATIVE-01..04 to Phase 29; all four declared across plan frontmatter).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | — | — | — | No blocking anti-patterns. `onToggleLaunchAtLogin`/`announcement` remain defined in GeneralSettings (dead in store build) — intentional per plan to keep direct diff minimal; tree-shake-irrelevant. lib.rs TODO(21-04) at the refresh task is pre-existing (direct-only), out of phase scope. |

### Human Verification Required

None outstanding. The runtime-only / WebDriver-impossible checks (MAS-NATIVE-01 summon, MAS-NATIVE-02/03 runtime halves) were proven by the 29-03 Task 2 BLOCKING human signed-build walkthrough, APPROVED 2026-06-24 (all four D-09 checks passed on the dev-signed sandboxed .app, against a fresh non-stale bundle). Per gate policy these are human-verified PASS, not open items.

### Gaps Summary

No gaps. All 13 must-have truths verified against the actual codebase: the Cargo feature gating, lib.rs cfg gates (license module, setup wiring, 2×2 invoke_handler matrix, tray updater item, compile_error mutual-exclusion guard), the frontend IS_APPSTORE gates (GeneralSettings launch-at-login, autostart seam no-op, UpdaterOverlay lazy tree-shake), the D-03 runtime no-invoke assertion, and the extended fold-in guard + verify-script FATAL gates all exist, are substantive, are wired, and pass their automated self-tests. The signed bundle is fresh (binary mtime newer than the last source-touching commit) and its codesign entitlement audit is clean. All four MAS-NATIVE requirements are satisfied, the decoder + its 19 tests are byte-untouched, and the full vitest suite (1274/1274) + tsc are green per the SUMMARYs (consistent with no non-planning working-tree changes). The human signed-build gate covered every runtime-only surface.

---

_Verified: 2026-06-25_
_Verifier: Claude (gsd-verifier)_
