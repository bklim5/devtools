---
phase: 30-pkg-build-asc-submission
plan: 03
subsystem: release-tooling
tags: [appstore, packaging, productbuild, codesign, ship-gate]

# Dependency graph
requires:
  - phase: 30-01
    provides: version 1.0.0 (all three sources) + PrivacyInfo.xcprivacy (injected by this plan's script)
  - phase: 30-02
    provides: SUBMISSION-RUNBOOK.md / Notes-for-Review.md / screenshots spec + cross-repo /support + /privacy (the human's ship-gate reference material)
  - phase: 26-29
    provides: the App-Sandboxed appstore build (StoreKit bridge, variant seam, entitlement swap, sandbox-safe native) — all source landed BEFORE this terminal build
provides:
  - scripts/build-appstore-pkg.sh — Apple Distribution app-sign → productbuild → Mac Installer Distribution-signed .pkg + local pre-ITMS gates
  - package.json tauri:build:appstore:pkg canonical command
  - (pending human checkpoint) a locally-verified signed .pkg + an ASC submission
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dedicated distribution script reusing the dev-signed bundle machinery via three swaps (Apple Distribution / MAS profile / Mac Installer Distribution) + productbuild — NOT a mode flag on the dev script (keeps the local-launch path untouched)"
    - "inject-then-seal: cp the profile + PrivacyInfo into the bundle, chmod 644, THEN deep re-sign so the seal covers them (a post-sign resource invalidates the signature)"
    - "STRONG embedded-profile gate decodes the profile (security cms -D | PlistBuddy/plutil) and FATAL-asserts team + app id + unexpired + get-task-allow != true + no ProvisionedDevices — a stale/wrong/expired profile fails LOCALLY, not at Transporter"
    - "Local pre-ITMS gate set (no altool): per-Mach-O app-sandbox (ITMS-90296), chmod a+rX + no-root-only payload (Pitfall 4), pkgutil installer-chain, lipo two-arch, verify-appstore-bundle.sh --require-bundle; spctl info-only (a MAS pkg legitimately rejects under Gatekeeper)"

key-files:
  created:
    - "scripts/build-appstore-pkg.sh — the one net-new piece of infrastructure (369 lines)"
  modified:
    - "package.json — added tauri:build:appstore:pkg"

key-decisions:
  - "PlistBuddy key path is ':Entitlements:com.apple.application-identifier' (the com.apple.* prefixed key), NOT bare 'application-identifier' — the real profile uses the prefixed form; a bare key MISSES (would false-RED a valid profile). ExpirationDate read via plutil as ISO8601 'Z' (trivially parseable with date -j -u -f). Verified against the real on-disk profile (team/appid/expiry/get-task-allow/ProvisionedDevices all read correctly; gate passes a valid distribution profile + fails a synthetic dev profile on all three dev signals)."
  - "BOTH the Apple Distribution app-signing cert AND the Mac Installer Distribution (3rd Party Mac Developer Installer) cert are ALREADY PRESENT in this machine's keychain, and src-tauri/embedded.provisionprofile (the MAS distribution profile, no ProvisionedDevices, expires 2027-06-22) is on disk — so the plan's BLOCKING 'create the installer cert' prerequisite is likely already satisfied. --check-prereqs exits 0. (RESEARCH stated the installer cert was absent; it is now present.)"
  - "HYBRID-guard pairing: kept the whole `pnpm tauri build --features appstore … -- --no-default-features` on ONE physical line so the appstore feature can never drift from --no-default-features (the bare-feature silent-hybrid trap)."

patterns-established:
  - "A distribution .pkg pipeline that fails closed on every signing prerequisite + a strong profile-validity gate, stopping at a locally-verified artifact handed to a human for the irreversible Apple submission"

requirements-completed: []   # MAS-SHIP-01/02/03 complete only after the human checkpoint (signed .pkg built + uploaded + Submit clicked)

metrics:
  duration: ~30 min (Task 1 automated)
  completed: 2026-06-25 (Task 1); Task 2 PENDING human ship-gate
---

# Phase 30 Plan 03: `.pkg` Build Script + Terminal Human Ship-Gate Summary

The one net-new piece of Phase-30 infrastructure: a dedicated `scripts/build-appstore-pkg.sh` that re-signs the App-Sandboxed bundle with **Apple Distribution**, embeds the **MAS distribution** profile + **PrivacyInfo.xcprivacy** before the seal, `productbuild`s a **Mac Installer Distribution**-signed `.pkg`, and runs the full local pre-ITMS gate set — then hands the `.pkg` to the human for the irreversible Transporter upload + Submit for Review.

## Status

**Task 1 COMPLETE + committed (`67990d64`).** **Task 2 (`checkpoint:human-verify`, gate=blocking) PAUSED — awaiting the human ship-gate.** Auto-advance is OFF; this plan is non-autonomous by design (the terminal Apple submission is 100% human, D-04). The automatable work (the script + package.json) landed and is verified; the build + walkthrough + upload + Submit need human-held actions and cannot be machine-driven.

## What Was Built

### Task 1 — `scripts/build-appstore-pkg.sh` + package.json (commit `67990d64`)

A NEW dedicated script (369 lines; the dev-signed `build-appstore-bundle.sh` left byte-untouched per D-Discretion). Exactly the swap/addition contract from the plan's `<interfaces>`:

- **SWAP 1 — Apple Distribution app-sign** (`security find-identity -p codesigning -v | grep 'Apple Distribution'`); fail-closed → ASC-SETUP §7.
- **SWAP 2 — MAS distribution profile** `src-tauri/embedded.provisionprofile`; fail-closed → ASC-SETUP §7.
- **SWAP 3 — Mac Installer Distribution** pkg-sign (`security find-identity -v -p basic`, grepping BOTH "Mac Installer Distribution" and the legacy "3rd Party Mac Developer Installer" labels — A4); fail-closed with the exact Pitfall-6 message → ASC-SETUP §7.
- **Notary env scrub** (`unset APPLE_ID APPLE_PASSWORD APPLE_API_KEY …`) + `export APPLE_SIGNING_IDENTITY` → no notarisation (ITMS-90238 guard).
- **Build** the universal appstore bundle with the committed overlay + the freshness marker; `--features appstore … -- --no-default-features` on one line (HYBRID guard).
- **Inject-then-seal** (Pattern 2): `cp` the profile + `PrivacyInfo.xcprivacy` into `Contents/embedded.provisionprofile` + `Contents/Resources/PrivacyInfo.xcprivacy`, `chmod 644`, BEFORE `codesign --force --deep … --entitlements entitlements.appstore.plist`; then FATAL `codesign --verify --deep --strict`.
- **STRONG embedded-profile gate** (Finding 3 / T-30-16): `security cms -D` → PlistBuddy/plutil FATAL-asserts TeamIdentifier `FK4HQK83WX` + app id `FK4HQK83WX.com.tinkerdev.app` + ExpirationDate-in-future + `get-task-allow`≠true + NO `ProvisionedDevices`.
- **Local pre-ITMS gates** (D-02, no altool): per-Mach-O `app-sandbox` assert (ITMS-90296, only over real Mach-O files via `file … | grep Mach-O`); `chmod -R a+rX`; `xcrun productbuild --component "$APP" /Applications --sign "$INSTALLER_ID"`; `pkgutil --expand` no-root-only-payload assert (Pitfall 4); `pkgutil --check-signature` installer-chain; `lipo -archs` x86_64+arm64; tail-call `verify-appstore-bundle.sh --require-bundle` (compliance + Build-LAST freshness).
- **spctl info-only** — printed, never `|| exit` (a MAS pkg legitimately rejects under Gatekeeper, Pitfall 2).
- **`--check-prereqs`** runs ONLY the cert/profile preflights (no build) — proves fail-closed behavior cheaply.
- **`package.json`**: `"tauri:build:appstore:pkg": "VITE_CHANNEL=appstore bash scripts/build-appstore-pkg.sh"`; script `chmod +x`.

## Verification Evidence (Task 1)

- `bash -n` clean; all plan `<verify>` greps pass (`productbuild --component`, `PrivacyInfo.xcprivacy`, `app-sandbox`, `ASC-SETUP`, `verify-appstore-bundle.sh`, `tauri:build:appstore:pkg` in package.json, `no-default-features`, `security cms -D`, `TeamIdentifier|application-identifier`, `ExpirationDate`, `get-task-allow`).
- Both cert identities grepped; PrivacyInfo `cp` line (245) BEFORE the `codesign --force --deep` line (257) — inject-then-seal proven.
- HYBRID guard: `grep -nE 'features appstore' | grep -v 'no-default-features'` finds NOTHING (no bare feature flag).
- Notary scrub present; spctl NOT gated (no `|| exit` on spctl).
- **Fail-closed proof:** with a PATH-shimmed `security` returning no installer cert, `--check-prereqs` exits 1 with the ASC-SETUP §7 pointer and runs NO build.
- **Strong-profile gate proven non-vacuous:** passes the REAL on-disk distribution profile (team `FK4HQK83WX`, appid `FK4HQK83WX.com.tinkerdev.app`, expires `2027-06-22T21:54:10Z`, get-task-allow absent, no ProvisionedDevices); a synthetic dev-style plist trips all three dev signals (get-task-allow=true, ProvisionedDevices present, expired).
- Real-keychain `--check-prereqs` exits 0 (both certs + profile present).
- lefthook GREEN on the commit: **vitest 1276/1276**, tsc clean, 4 pre-existing eslint warnings (SidebarResetMenu/settingsPanes) out of scope.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected the embedded-profile field extraction key paths (planner under-specified)**
- **Found during:** Task 1 (validating the strong-profile gate against the real on-disk profile).
- **Issue:** The plan's `<interfaces>` named the entitlement key as `application-identifier`. The real MAS profile uses the **`com.apple.application-identifier`** key; `PlistBuddy -c 'Print :Entitlements:application-identifier'` returns empty, which would FATAL a VALID profile (false-RED, breaking every real build). The plan's example date format string (`%a %b %d %T %Z %Y`) also did not match what is robustly extractable.
- **Fix:** Use `:Entitlements:com.apple.application-identifier` (PlistBuddy splits the path on `:` only, so the dotted key resolves); read `ExpirationDate` via `plutil -extract … raw` (clean ISO8601 `Z`) parsed with `date -j -u -f '%Y-%m-%dT%H:%M:%SZ'`; capture PlistBuddy stderr for the ProvisionedDevices "Does Not Exist" probe. Verified against the real profile (passes) and a synthetic dev profile (fails on all three signals).
- **Files modified:** `scripts/build-appstore-pkg.sh`
- **Commit:** `67990d64`

**2. [Rule 3 - Blocking] Transient pnpm workspace-state JSON corruption on the first commit attempt**
- **Found during:** Task 1 commit.
- **Issue:** The first `git commit` failed in lefthook's `test` step with `Unexpected end of JSON input` from pnpm's `loadWorkspaceState` (the deps-status precheck read `node_modules/.pnpm-workspace-state-v1.json` mid-write — a race, NOT a test failure; typecheck + lint had already passed).
- **Fix:** Confirmed the file was valid afterward (the corruption was transient) and re-ran the commit, which passed all hooks (vitest 1276/1276). No code change.
- **Files modified:** none.
- **Commit:** `67990d64` (the successful retry).

No other deviations — the script implements the `<interfaces>` contract exactly.

## Notable Finding for the Human Checkpoint

**The "blocking" Mac Installer Distribution cert prerequisite is likely ALREADY satisfied.** RESEARCH/the plan stated the installer cert was absent (a blocking human prerequisite). On this machine, `security find-identity -v -p basic` shows BOTH `Apple Distribution: Boon Khai Lim (FK4HQK83WX)` AND `3rd Party Mac Developer Installer: Boon Khai Lim (FK4HQK83WX)`, and `src-tauri/embedded.provisionprofile` (MAS distribution, expires 2027-06-22) is on disk. `pnpm tauri:build:appstore:pkg --check-prereqs` exits 0. The human can likely skip the cert-creation step and go straight to the build + walkthrough.

## Authentication / Human Gates

- **Task 2 is a BLOCKING `checkpoint:human-verify`.** It needs: (optionally) creating the Mac Installer Distribution cert (likely already present — see above); running `pnpm tauri:build:appstore:pkg` to produce + locally-verify the signed `.pkg`; the ship-gate walkthrough on the DEV-signed `.app` (`pnpm tauri:build:appstore`, NOT the distribution `.pkg`'s app — AMFI -413): real Sandbox purchase → Pro live, Restore on a fresh container, refund → Pro drops; capturing screenshots; deploying the tinkerdev-io `/support` + `/privacy` pages live (verify 200); uploading the `.pkg` via Transporter; finalizing ASC; and clicking **Submit for Review** (irreversible, 100% human — D-04). Full sequence in `docs/appstore/SUBMISSION-RUNBOOK.md`.

## Commits

- `67990d64` feat(30-03): add build-appstore-pkg.sh — Apple Distribution app → productbuild → signed .pkg + local pre-ITMS gates

## Self-Check: PASSED

- FOUND: scripts/build-appstore-pkg.sh (369 lines, mode 100755)
- FOUND: package.json `tauri:build:appstore:pkg` script
- FOUND commit 67990d64
- Strong-profile gate verified non-vacuous against the real profile + a synthetic dev profile
- Fail-closed proven (installer-cert-absent → exit 1 → ASC-SETUP §7, no build)
