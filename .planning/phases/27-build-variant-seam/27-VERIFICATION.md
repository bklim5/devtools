---
phase: 27-build-variant-seam
verified: 2026-06-23T00:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  note: initial verification
---

# Phase 27: The Build-Variant Seam Verification Report

**Phase Goal:** The repo builds two variants from one codebase — direct (DMG/updater) and appstore (sandboxed StoreKit) — from single canonical build commands, and the appstore variant produces a signed sandboxed `.app` that launches without a white-screen, with the auto-updater compiled OUT and a committed script that asserts bundle compliance.
**Verified:** 2026-06-23
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | Each variant builds from a single canonical command; half-variant cannot ship | VERIFIED | `package.json` has exactly two scripts: `tauri:build:direct = "tauri build --config src-tauri/tauri.direct.conf.json"`, `tauri:build:appstore = "VITE_CHANNEL=appstore bash scripts/build-appstore-bundle.sh"` — VITE_CHANNEL bound with the cargo flags in one place; appstore script does NOT reference `tauri.direct.conf.json` |
| 2 | Signed App Store `.app` launches + renders (not blank) under App Sandbox; app-sandbox + network.client present | VERIFIED | Real bundle `codesign -d --entitlements` shows BOTH `com.apple.security.app-sandbox` + `com.apple.security.network.client`; human launch+render gate APPROVED 2026-06-23 (webview rendered, offline tool use works) |
| 3 | Auto-updater (Rust plugin + endpoints) ABSENT from store build | VERIFIED | `cargo tree --no-default-features --features appstore \| grep -E 'tauri-plugin-(updater\|autostart\|process)'` → empty (exit 1); default `cargo tree` → all three present; lib.rs registrations gated `#[cfg(feature="direct")]` / `#[cfg(all(desktop, feature="direct"))]`; appstore binary `strings` carry 0 `updater:default` / 0 `direct-native` |
| 4 | Store variant builds at 13.0 while direct stays 10.15; 13.0 never leaks onto base | VERIFIED | Overlay `minimumSystemVersion: 13.0`; base `tauri.conf.json` `grep 13.0` → 0, still `10.15` (line 45); built bundle `Info.plist` LSMinimumSystemVersion = `13.0` |
| 5 | Committed `scripts/verify-appstore-bundle.sh` asserts entitlements present + forbidden plugins absent | VERIFIED | Script exists, executable, syntax-clean; run live on the real bundle with `--require-bundle` → all three OK lines + `verify-appstore-bundle: OK`, exit 0 |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src-tauri/Cargo.toml` | `default=["direct"]` + `direct` umbrella feature; 3 optional deps | VERIFIED | line 110 `default = ["direct"]`, line 120 `direct = [...]`; updater/autostart/process all `optional = true` |
| `src-tauri/src/lib.rs` | cfg-gated updater/autostart/process registrations | VERIFIED | updater `#[cfg(all(desktop, feature="direct"))]` (L82); process + autostart `#[cfg(feature="direct")]` rebinds (L297, L310); autostart::init count = 1 (only gated rebind) |
| `src-tauri/capabilities/default.json` | 5 direct-only perms removed; core:default + opener kept | VERIFIED | updater:default=0, process:allow-restart=0, autostart:allow-*=0; core:default=1, opener:allow-open-url=1; valid JSON |
| `src-tauri/tauri.direct.conf.json` | inline direct-native capability, windows:["main"], 5 perms, no platforms | VERIFIED | identifier `direct-native`, windows `["main"]`, 5 perms, no `platforms` key |
| `src-tauri/tauri.appstore.conf.json` | 13.0 + appstore entitlements + no-dmg + updater:null, NO capabilities | VERIFIED | minVer 13.0, targets ["app"], updater null, ent entitlements.appstore.plist, hardened false, createUpdaterArtifacts false, no capabilities block |
| `src/lib/platform/channel.ts` | exports IS_APPSTORE from VITE_CHANNEL | VERIFIED | `export const IS_APPSTORE: boolean = import.meta.env.VITE_CHANNEL === "appstore"` |
| `src/vite-env.d.ts` | VITE_CHANNEL typed | VERIFIED | VITE_CHANNEL present in ImportMetaEnv augmentation |
| `package.json` | two canonical variant scripts | VERIFIED | tauri:build:direct + tauri:build:appstore present |
| `scripts/verify-appstore-bundle.sh` | bundle-compliance gate | VERIFIED | executable; app-sandbox=1, network.client=1, LSMinimumSystemVersion=4, PlistBuddy=1, require-bundle=6, appstore-flags=3; license.tinkerdev.io=0 (Phase-28 deferral honored) |
| `scripts/build-appstore-bundle.sh` | promoted canonical command | VERIFIED | executable; no-default-features=6, tauri.appstore.conf.json=3, codesign --force --deep=1, embedded.provisionprofile=5, AMFI present, verify+require-bundle tail present |
| `scripts/build-appstore-spike.sh` | SUPERSEDED banner, retained | VERIFIED | SUPERSEDED=1 |
| `scripts/build-and-publish.mjs` | publish flow carries direct overlay | VERIFIED | tauri.direct.conf.json=2 (universal direct release re-acquires perms) |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| Cargo `[features].direct` | updater/autostart/process deps | `dep:*` optional | WIRED | cargo tree appstore empty; default has all three |
| lib.rs registrations | updater/autostart/process plugins | `#[cfg(feature="direct")]` gates | WIRED | 3 gated call sites confirmed in source |
| `tauri.direct.conf.json` | direct build effective ACL | inline `direct-native` capability merged at codegen | WIRED | per Plan-01 deviation, ACL embeds into binary; appstore binary `strings` shows 0 `direct-native` (negative control proven) |
| package.json appstore script | VITE_CHANNEL + build-appstore-bundle.sh | env var bound in same script | WIRED | `VITE_CHANNEL=appstore bash scripts/build-appstore-bundle.sh` |
| package.json direct script | tauri.direct.conf.json | `--config` | WIRED | direct script passes overlay; appstore does not |
| channel.ts | import.meta.env.VITE_CHANNEL | build-time constant | WIRED | tree-shakeable const; 3 tests pin behavior (per 27-02 SUMMARY, vitest 1214/1214) |
| build-appstore-bundle.sh | verify-appstore-bundle.sh --require-bundle | FATAL tail call | WIRED | `if ! bash ...verify... --require-bundle; then exit 1` |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| updater/autostart/process absent from appstore tree | `cargo tree --no-default-features --features appstore \| grep -E 'tauri-plugin-(updater\|autostart\|process)'` | empty (exit 1) | PASS |
| all three present in default tree | `cargo tree \| grep -E ...` | autostart 2.5.1, process 2.3.1, updater 2.10.1 | PASS |
| signed bundle universal | `lipo -archs .../devtools-app` | `x86_64 arm64` | PASS |
| entitlements present | `codesign -d --entitlements -` | app-sandbox + network.client | PASS |
| 13.0 floor on artifact | PlistBuddy LSMinimumSystemVersion | `13.0` | PASS |
| verify script live on real bundle | `verify-appstore-bundle.sh <app> --require-bundle` | 3 OK lines, exit 0 | PASS |
| appstore binary ACL clean (negative control) | `strings devtools-app \| grep -c direct-native/updater:default/autostart` | 0 / 0 / 0 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| MAS-BUILD-01 | 27-02, 27-04 | Two variants, single canonical command each, no half-variant | SATISFIED | Truth 1 + two package.json scripts binding VITE_CHANNEL+cargo flags |
| MAS-BUILD-02 | 27-04 | Store build under App Sandbox, launches without white-screen | SATISFIED | Truth 2 + human-approved launch/render gate 2026-06-23 |
| MAS-BUILD-03 | 27-01 | Updater compiled OUT, verifiable on bundle | SATISFIED | Truth 3 + cargo tree empty + bundle ACL clean |
| MAS-BUILD-05 | 27-02 | Store 13.0 / direct 10.15, no base leak | SATISFIED | Truth 4 + overlay 13.0, base 10.15, artifact 13.0 |
| MAS-BUILD-06 | 27-03 | Committed verify script asserts compliance | SATISFIED | Truth 5 + live GREEN run |

All 5 plan-declared requirement IDs map to Phase 27 in REQUIREMENTS.md. No orphaned requirements.

Note: REQUIREMENTS.md rows for MAS-BUILD-03/05/06 still read "Pending" (lines 87-89) while 01/02 read "Complete". This is a tracking-table lag, not a goal gap — the underlying criteria are all verified above. Recommend updating those three rows to Complete (this project's custom REQUIREMENTS format is hand-maintained per memory `gsd-tools-custom-state-format`).

### Anti-Patterns Found

None blocking. No TODO/FIXME/placeholder stubs introduced; all artifacts are substantive config/code/scripts, not placeholders. The `|| true` on the build line in build-appstore-bundle.sh is intentional (absent updater-signing key) and is guarded by a pre-build mktemp freshness marker + `-nt` assertion (per 27-04 SUMMARY) so a no-op build cannot false-GREEN.

### Process Note (non-blocking)

The four binding-harness quality gates (`/simplify`, `/code-review xhigh`, `/codex:adversarial-review`, `gsd-ui-review`) were NOT auto-run by the executors and are flagged pending at the phase boundary (27-04 SUMMARY §141). Per the verification context this does not block goal achievement: this phase has essentially no visual UI surface (channel.ts is a build-time constant; everything else is Cargo/JSON/bash build plumbing). Surfaced here for developer awareness, not as a gap.

### Gaps Summary

No gaps. All 5 ROADMAP success criteria are verified against the actual codebase and the real signed bundle:
- Both variants build from single canonical commands; the half-variant binding holds (VITE_CHANNEL + cargo flags in one script).
- The updater + autostart + process are compiled OUT of the appstore tree (cargo tree empty; binary ACL clean) and present in the direct tree.
- The 13.0 floor lives only in the overlay and reaches the artifact; the base stays 10.15.
- The committed verify script runs GREEN on the real bundle (entitlements present, plugins absent, 13.0 floor) and is FATAL-when-present.
- The signed sandboxed `.app` launches and renders under App Sandbox — human-verified.

decoder.ts + its 19 tests are byte-for-byte untouched across the phase.

---

## Post-Verification Hardening (Adversarial Review, 2026-06-23)

After this report passed, the binding-harness quality gates ran at the phase boundary. `/gsd-code-review` (standard) found 0 critical / 3 warning / 4 info; the independent `/codex:adversarial-review` found **1 CRITICAL** + 2 high + 2 medium. The CRITICAL was a real ship-blocking defect in the **direct** channel that goal-verification missed (it checked the 5 direct-only grants attached, not that the baseline survived). All confirmed findings were fixed and re-verified; the phase goal still holds. Commits: `4c8c9708` (code-review WR-01/WR-02), `7f1b8f71` (adversarial CRITICAL + highs). Final hardened `pnpm tauri:build:appstore` re-ran fully GREEN end-to-end (universal build → embed profile → deep re-sign → FATAL deep-verify consistent → `verify-appstore-bundle --require-bundle` 3/3 OK, exit 0).

| Sev | Finding | Resolution | Evidence |
| --- | ------- | ---------- | -------- |
| CRITICAL | `tauri.direct.conf.json` set a non-empty `app.security.capabilities` (only the inline `direct-native`). Tauri `get_capabilities()` (`tauri-utils acl/mod.rs`) uses the `capabilities/` dir glob ONLY when that array is empty — so the 12 baseline `default.json` grants (core:window, clipboard, store, global-shortcut, window-state, opener) were DROPPED from the direct build. `pnpm tauri:build:direct` would launch but deny core IPC. | Added a leading `"default"` `CapabilityEntry::Reference` so both capabilities resolve. | Real direct build (host arch) embedded-ACL now carries store/global-shortcut/window-state/clipboard/opener command grants AND updater/autostart/process — previously only direct-native. |
| HIGH | `VITE_CHANNEL` not bound to the native build — an ambient `VITE_CHANNEL=appstore` would compile the App-Store frontend into the direct release (half-variant). | Pinned `VITE_CHANNEL=direct` in the `package.json` direct script and `build-and-publish.mjs`. | Truth #1 binding now airtight in BOTH directions. |
| HIGH | Deep codesign verify in `build-appstore-bundle.sh` was informational — an inconsistent nested signature exited 0. | Made `--verify --deep --strict` FATAL; assert embedded profile present. | Final build: `[deep verify] whole bundle signature valid + consistent ✓`. |
| MEDIUM | Provisioning-profile `cp` unchecked. | Remove stale profile first; FATAL on copy failure. | Final build embedded + sealed the profile. |
| MEDIUM | `verify-appstore-bundle.sh` did not assert `tauri-plugin-process` absent (WR-01). | Extended the cargo-tree grep to all three direct-only plugins. | `OK: updater + autostart + process ABSENT`. |

The CRITICAL/HIGH-2 fixes touch only the **direct** channel + scripts; the appstore bundle (Truth #2 human-approved launch) is unaffected — the appstore build never passes `tauri.direct.conf.json` and its frontend was already built with `VITE_CHANNEL=appstore`.

---

_Verified: 2026-06-23_
_Verifier: Claude (gsd-verifier) + adversarial hardening pass_
