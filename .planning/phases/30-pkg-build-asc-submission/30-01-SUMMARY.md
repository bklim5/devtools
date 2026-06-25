---
phase: 30-pkg-build-asc-submission
plan: 01
subsystem: release-tooling
tags: [appstore, packaging, privacy-manifest, release, version-bump, build-only]

# Dependency graph
requires:
  - phase: 28-entitlement-source-swap
    provides: the appstore build resolves Pro through StoreKit only — basis for the Data-Not-Collected privacy claim (no Keygen network)
  - phase: 29-sandbox-safe-native-features
    provides: keyring/updater/autostart compiled OUT of the store binary — so the PrivacyInfo.xcprivacy Data-Not-Collected / no-tracking assertion is genuinely true
provides:
  - all three direct-channel version sources at 1.0.0 (package.json + tauri.conf.json + Cargo.toml/Cargo.lock); both tauri overlays inherit (no version key)
  - src-tauri/PrivacyInfo.xcprivacy — Apple privacy manifest, Data Not Collected, no tracking, UserDefaults CA92.1 required-reason
  - a genuine --build-only no-publish mode in the direct release driver (parsePublishArgs { dryRun, buildOnly } mutually exclusive; build-and-publish.mjs early-return after spctl-accept, before any publish write); release:build-only script
  - *.pkg gitignored (MAS installer build output)
affects: [30-02, 30-03 (Plan 03 injects PrivacyInfo.xcprivacy + builds the .pkg; both depend on the 1.0.0 versions)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "build-only release mode: run the read-only preflights + the full real build/sign/notarise/staple/spctl, then RETURN exit 0 BEFORE any publish WRITE (latest.json / gh release create / gh release upload) — making the real-DMG un-regression proof executable AND publish-safe by construction"
    - "string-index placement guard in the verify step asserts idx(spctl-accept) < idx(if buildOnly) < idx(latest.json write) < idx(gh release create) so no publish write is reachable on the build-only path"

key-files:
  created:
    - "src-tauri/PrivacyInfo.xcprivacy — Apple privacy manifest (D-06)"
  modified:
    - "package.json — version 0.4.1 -> 1.0.0; added release:build-only script"
    - "src-tauri/tauri.conf.json — version 0.4.1 -> 1.0.0"
    - "src-tauri/Cargo.toml + Cargo.lock — crate version 0.4.1 -> 1.0.0"
    - ".gitignore — ignore *.pkg"
    - "src/lib/release/publishPlan.ts — PublishArgs gains buildOnly; parsePublishArgs accepts --build-only + mutual-exclusion guard; USAGE updated"
    - "src/lib/release/publishPlan.test.ts — buildOnly cases + mutual-exclusion + updated existing assertions"
    - "scripts/build-and-publish.mjs — buildOnly threaded into publish(); early-return after spctl, before publish writes"

key-decisions:
  - "Version-source list is all THREE consumers, not just one: package.json (build-and-publish.mjs readCurrentVersion), tauri.conf.json (.app embed), Cargo.toml (crate) — D-03 under-specified the file list; a half-bump skews the release tooling vs the .app (Finding 2)"
  - "build-only early-return placed AFTER the notarise/staple/spctl block and BEFORE latest.json/gh — runs the load-bearing real build, unreachable publish writes (T-30-04b)"
  - "Updated the existing throw-token tests from /\\[--dry-run\\]/ to /\\[--dry-run/ since USAGE is now '[--dry-run | --build-only]' (the literal ] no longer immediately follows --dry-run)"

patterns-established:
  - "A no-publish build mode is the publish-safe way to prove a release pipeline still builds/signs/notarises without cutting a real release or risking an accidental publish"

requirements-completed: []   # MAS-SHIP-04/05 only fully satisfied after the Task-5 human checkpoint (real DMG build)

metrics:
  duration: ~25 min (automated tasks 1-4)
  completed: 2026-06-25
---

# Phase 30 Plan 01: Version + Privacy-Manifest Foundations + Build-Only Driver Mode Summary

A plain multi-file bump of all three direct-channel version sources to 1.0.0, the mandatory Apple `PrivacyInfo.xcprivacy` (Data Not Collected), and a genuine `--build-only` no-publish mode for the direct release driver that makes the MAS-SHIP-05 real-DMG un-regression proof executable AND publish-safe — laying the prerequisites Plan 03's terminal `.pkg` build depends on.

## Status

**Tasks 1–4 COMPLETE (automated).** Task 5 is a BLOCKING human-verify checkpoint (real universal DMG build via `pnpm release:build-only`) that needs human-held Apple notary credentials + the direct signing key — neither is in the agent environment. **Plan is NOT complete until the human runs Task 5 and approves.**

## What Was Built

### Task 1 — Bump all three version sources to 1.0.0 + gitignore .pkg (commit `b50bcdbc`)
- `package.json` `0.4.1 -> 1.0.0` (the source `build-and-publish.mjs readCurrentVersion()` reads for the tag/glob/URL).
- `src-tauri/tauri.conf.json` `0.4.1 -> 1.0.0` (the version the built `.app` reports; both overlays inherit — confirmed appstore overlay has NO `version` key).
- `src-tauri/Cargo.toml` + `Cargo.lock` crate version `0.4.1 -> 1.0.0`.
- `.gitignore` ignores `*.pkg`.
- D-03 honored: plain multi-file edit, NO release cut, NO `vX.Y.Z` tag (`git tag --points-at HEAD` empty).

### Task 2 — PrivacyInfo.xcprivacy (commit `944301aa`)
- `src-tauri/PrivacyInfo.xcprivacy`: `NSPrivacyTracking false`, empty `NSPrivacyTrackingDomains`, empty `NSPrivacyCollectedDataTypes`, and one `NSPrivacyAccessedAPITypes` dict declaring `NSPrivacyAccessedAPICategoryUserDefaults` with reason `CA92.1` (the prefs blob persists via `@tauri-apps/plugin-store` -> NSUserDefaults; over-declaring is the safe default, A3).
- `plutil -lint` OK; all PlistBuddy key asserts pass. Plan 03 injects it into `Contents/Resources/` before the deep re-sign.

### Task 3 — `--build-only` no-publish driver mode (commit `2dbece65`)
- `publishPlan.ts`: `PublishArgs` gains `buildOnly`; `parsePublishArgs` accepts `--build-only`, throws (naming both flags + "mutually exclusive") if `--dry-run && --build-only`; `USAGE` -> `"[--dry-run | --build-only]"`.
- `publishPlan.test.ts`: new `--build-only`, mutual-exclusion (order-independent), and updated existing assertions; 61/61 in this file.
- `build-and-publish.mjs`: `main()` destructures `buildOnly` and threads it into `publish(view, version, { x86Present, buildOnly })` (no main short-circuit — it reaches the real build); `publish()` early-returns AFTER the notarise/staple/spctl block and BEFORE `latest.json`/`gh`. String-index guard confirmed: `spctl(18615) < if-buildOnly(19464) < latest.json(20144) < gh-release-create(20545)`.
- `package.json`: `release:build-only` script = `tsx scripts/build-and-publish.mjs --build-only` (exact string asserted).
- Full suite 1276/1276 (+2 vs 1274); `tsc --noEmit` clean.

### Task 4 — Cheap preflight + decoder byte-identity (HALF A — verification only)
- Decoder paths exist; `decoder.test.ts` 19/19 pass; `git diff --quiet HEAD -- decoder.ts decoder.test.ts` clean (byte-for-byte untouched).
- **Signing env is NOT in the agent environment** (`TAURI_SIGNING_PRIVATE_KEY[_PATH]` + `_PASSWORD` all absent — human-held secrets). Per the plan, running the dry-run without signing env yields the by-design preflight abort on missing `TAURI_SIGNING_*` (exit 1) — recorded as expected, NOT a regression. Confirmed:
  - `pnpm release:publish --dry-run` -> exit 1, "publish aborted: signing env missing …".
  - `pnpm release:build-only` -> reaches the preflight (does NOT short-circuit in main, proving the new flag threads correctly) -> same signing-env abort.
  - `pnpm exec tsx scripts/build-and-publish.mjs --build-only --dry-run` -> exit 1, mutual-exclusion abort naming both flags.
- The dry-run-exit-0 (with signing env present) is satisfied at the Task-5 human checkpoint, where the human exports the signing key.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated the existing throw-token test regexes for the new USAGE string**
- **Found during:** Task 3
- **Issue:** Two existing tests asserted `.toThrow(/\[--dry-run\]/)`. After updating `USAGE` to `"[--dry-run | --build-only]"`, the literal `]` no longer immediately follows `--dry-run`, so those assertions would fail.
- **Fix:** Relaxed both to `/\[--dry-run/` (still proves the usage string is printed, which is the test's intent).
- **Files modified:** `src/lib/release/publishPlan.test.ts`
- **Commit:** `2dbece65`

No other deviations — Tasks 1, 2, 4 executed exactly as written.

## Authentication / Human Gates

- **Task 4 dry-run** required the direct signing env (human-held), absent in the agent env -> by-design preflight abort recorded (not a regression).
- **Task 5** is a BLOCKING human-verify checkpoint: a real universal DMG build via `pnpm release:build-only` needs the direct signing key + the App Store Connect API-key notary set (`APPLE_API_KEY_PATH` + `APPLE_API_KEY` + `APPLE_API_ISSUER` + `APPLE_SIGNING_IDENTITY`). All human-held -> the agent cannot run it. STOPPED for the human.

## Verification Evidence

- Task 1: `node`/`grep` version assert — all three sources 1.0.0, appstore overlay inherits, `*.pkg` gitignored, no tag.
- Task 2: `plutil -lint` OK; `NSPrivacyTracking=false`; `NSPrivacyCollectedDataTypes` empty; `NSPrivacyAccessedAPIType=NSPrivacyAccessedAPICategoryUserDefaults`; reason `CA92.1`.
- Task 3: grep `build-only`/`buildOnly` OK; exact `release:build-only` script string OK; string-index placement guard OK; `publishPlan.test.ts` 61/61; `tsc --noEmit` clean; full suite 1276/1276.
- Task 4: decoder paths exist; 19/19; byte-clean against HEAD; dry-run + build-only + mutual-exclusion all behave per plan.

## Commits

- `b50bcdbc` chore(30-01): bump all three version sources to 1.0.0 + gitignore .pkg
- `944301aa` feat(30-01): add PrivacyInfo.xcprivacy (Data Not Collected, D-06)
- `2dbece65` feat(30-01): add --build-only no-publish mode to the direct release driver

## Self-Check: PASSED

- FOUND: src-tauri/PrivacyInfo.xcprivacy
- FOUND commit b50bcdbc
- FOUND commit 944301aa
- FOUND commit 2dbece65
- decoder.ts + 19 tests byte-for-byte untouched (git-clean against HEAD)
