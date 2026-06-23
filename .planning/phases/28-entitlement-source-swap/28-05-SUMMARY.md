---
phase: 28-entitlement-source-swap
plan: 05
subsystem: build-variant-seam / appstore-compliance-gate
tags: [tree-shake, static-switch, grep-gate, compile-out, chunk-modules, freshness-link, human-gate]
status: AUTOMATED-COMPLETE — PAUSED at human sandbox checkpoint (Task 3)
requires: [28-01, 28-02, 28-03, 28-04, 27-01, 27-02]
provides:
  - "static IS_APPSTORE switches wiring Store* surfaces (settingsPanes / App / 3 upsell consumers); IapSpikeBlock removed"
  - "appstore-only generateBundle chunk-module fold-in guard + licenseui-inventory.json sentinel"
  - "verify-appstore-bundle.sh: dist/-layer D-03 copy grep + D-04 sentinel + FATAL freshness/linkage + binary-integrity checks"
affects: [scripts/verify-appstore-bundle.sh, vite.config.ts, scripts/licenseUiFoldInGuard.mjs, settingsPanes.tsx, App.tsx, LicenseSettings.tsx]
tech-stack:
  added: []
  patterns: ["Rollup generateBundle chunk.modules fold-in inventory", "dist/-layer content assertion + mtime freshness linkage (Tauri 2 brotli-embed)"]
key-files:
  created: [scripts/licenseUiFoldInGuard.mjs]
  modified: [scripts/verify-appstore-bundle.sh, vite.config.ts, src/components/settingsPanes.tsx, src/App.tsx, src/components/CommandPalette.tsx, src/components/AppearanceSettings.tsx, src/components/Sidebar.tsx, src/components/LicenseSettings.tsx]
decisions:
  - "Option A (Rule-4): assert D-03/D-04 CONTENT on the appstore-build dist/ (not $APP/Contents/Resources/) + a FATAL freshness/linkage check — the planner's dist/-under-Resources premise was FALSE for this Tauri 2 brotli-embed build"
metrics:
  duration: "continuation session (~1h)"
  completed: "2026-06-23 (automated layer); human sandbox gate PENDING"
---

# Phase 28 Plan 05: Convergence — static switches + appstore-compliance gate Summary

Wired the static `IS_APPSTORE` switches (Store* panes/upsell), removed the Phase-26 `IapSpikeBlock`, and built the D-03/D-04 appstore-compliance gate. **The convergence pivot (this continuation):** the bundle-content proof was relocated from the signed `.app`'s `Contents/Resources/` to the **appstore-build `dist/`**, because Tauri 2 brotli-embeds the frontend into the Rust binary — so `Resources/` ships only `icon.icns`, no frontend, no sentinel. A FATAL freshness/linkage check binds the inspected `dist/` to the signed binary so a stale clean `dist/` cannot mask a dirty/stale `.app`.

## What shipped (automated layer — DONE + committed)

Tasks 1 + 2 (static switches, IapSpikeBlock removal, the shared fold-in guard, the vite.config.ts appstore-only plugin, the original verify-script extension + selftests) were landed by the prior executor across commits `b0d7bb28`, `f42eae2c`, `8e9c2816`, `609bf13c`. This continuation reworked the verifier per the user's Option-A decision.

## The Rule-4 decision (Option A) — why the planner's premise was wrong

The planner's `<interfaces>` block assumed the appstore `.app` bundles `dist/` under `$APP/Contents/Resources/`, so the verifier (a) grepped Resources for the four D-03 copy markers and (b) read the `licenseui-inventory.json` sentinel from Resources. **This is FALSE for this Tauri 2 build:** Tauri brotli-EMBEDS the frontend into the Rust binary (`Contents/MacOS/devtools-app`), so `Contents/Resources/` holds ONLY `icon.icns` (verified empirically: `ls Contents/Resources/` → `icon.icns` only). Consequences of the original code:
- the D-04 sentinel read **FAILED** (sentinel not in Resources) even on a correct bundle, and
- the four-copy-marker grep **passed VACUOUSLY** (it grepped a Resources dir with no frontend — zero real assurance; the asset bytes are brotli-compressed inside the Mach-O, invisible to `strings`/`grep`).

The robust, inspectable bytes are the appstore-build `dist/` — the pre-compression input Tauri compresses verbatim into the binary in the SAME `tauri build` invocation (`beforeBuildCommand: "pnpm build"` emits `dist/`, then Tauri embeds it). **Option A** (user-chosen) relocates both content checks there and adds a freshness/linkage guard so the `dist/` we grep is provably the one that produced the signed binary.

## Verifier rework (commit `71f14a01`)

- `assert_no_keygen_strings <dist>` / `assert_no_license_ui_module <dist>` — now take a `dist/` dir (was the `.app`). The four D-03 copy markers + the exact-root sentinel read are unchanged in substance; only the inspected location moved.
- **`assert_dist_freshness <app> <dist>` (NEW, FATAL):** (1) the signed binary's mtime is NEWER than the last source commit (no stale `.app` — harness rule); (2) `dist/` exists, is non-empty, and carries the EXACT-root `licenseui-inventory.json` sentinel (missing/empty/sentinel-less → FAIL, never SKIP, never vacuous); (3a) `dist/`'s newest asset is NEWER than the last source commit (fresh, not a stale clean dist); (3b) `dist/` is NOT newer than the signed binary (Tauri builds `dist/` FIRST then embeds → `binary_mtime >= dist_mtime`; a `dist/` newer than the binary means it was rebuilt after signing, so the binary embeds older bytes than the grep sees → FAIL).
- **`assert_binary_integrity <app> ` (NEW):** keeps the binary-level checks the decision listed — universal archs (`lipo` x86_64+arm64), embedded provisionprofile, valid deep signature (`codesign --verify --deep --strict`). (Entitlements + 13.0 floor + plugin-absence already had their own asserts.)
- Driver: `--dist` flag (default `dist/`); freshness + binary-integrity wired FATAL into the bundle-present branch; SKIP path updated.
- `--selftest` gains a **non-vacuous freshness block** (`selftest_dist_freshness`): a fresh+consistent dist/binary PASSES; a stale `dist/` (older than last commit) FAILS; a `dist/` newer than the binary FAILS; a stale binary FAILS; missing/empty/sentinel-less `dist/` all FAIL. Drives mtimes with `touch -t` on a synthetic `.app` skeleton + `dist/`.

## Verification (all green on the freshly-built signed bundle)

**FULL appstore build re-run LAST** (`pnpm tauri:build:appstore`, exit 0), so `dist/` + the signed `.app` came from the SAME fresh invocation. `verify-appstore-bundle.sh --require-bundle` exited 0 with all OK lines:

```
OK: updater + autostart + process ABSENT from the appstore dependency graph
OK: app-sandbox + network.client PRESENT on the signed bundle
OK: appstore artifact LSMinimumSystemVersion == 13.0
OK: signed binary is universal (lipo -archs: x86_64 arm64)
OK: embedded.provisionprofile present
OK: deep signature valid + consistent (codesign --verify --deep --strict)
OK: freshness/linkage — binary 1782223590 > commit 1782223527; dist/ newest 1782223556 > commit AND <= binary; sentinel present at dist/ root
OK: no Keygen COPY markers (host / buy URL / $9 price / activation+key-field copy) in the appstore-build dist/
OK: src/lib/license/licenseUi ABSENT from every store chunk (D-04, sentinel)
verify-appstore-bundle: OK
```

Facts:
- **dist/ sentinel:** `{ "licenseUiInChunks": false, "hits": [] }` (read at the EXACT root `dist/licenseui-inventory.json`).
- **`Contents/Resources/` contents:** `icon.icns` only — empirical proof the planner's Resources premise was false.
- **Bundle binary mtime:** `2026-06-23 15:06:30` (epoch 1782223590) — NEWER than the last source commit `71f14a01` (`15:05:27`). Not stale.
- **`--selftest`:** exit 0 — each of the 4 copy markers trips; benign `Activate` PASSES (no false-RED); clean sentinel PASSES; fold-in sentinel trips; missing sentinel trips; AND all 7 freshness fixtures behave (fresh PASSES, stale-dist/dist-newer/stale-binary/missing/empty/sentinel-less all FAIL).
- **`--selftest-realbuild`:** exit 0 — a real fold-in fixture FAILS the appstore build (production guard caught `chunk.modules` fold-in); a clean fixture PASSES with `licenseUiInChunks:false` (imports the SAME shared `scripts/licenseUiFoldInGuard.mjs`).
- **Suite:** vitest 1260/1260, tsc clean, lefthook green on `71f14a01` (only pre-existing out-of-scope react-refresh warnings).
- **decoder.ts + 19 tests:** untouched (last touched Phase 01).

## Deviations from Plan

**1. [Rule 4 — Architectural, user-decided] Relocate D-03/D-04 content checks from `$APP/Contents/Resources/` to the appstore-build `dist/` + add a FATAL freshness/linkage check.**
- **Found during:** Task 3 build (prior executor) — the signed `.app` has no `dist/` under Resources; Tauri 2 brotli-embeds the frontend into the binary.
- **Decision:** Option A (user-chosen). Content checks read `dist/`; `assert_dist_freshness` binds `dist/` to the signed binary; binary-level checks stay on the `.app`.
- **Files modified:** `scripts/verify-appstore-bundle.sh`.
- **Commit:** `71f14a01`.

## Threat-model note (premise correction)

The threat register's T-28-25/T-28-26/T-28-27 mitigations described the sentinel/grep as living under `$APP/Contents/Resources/`. That location was false for this Tauri 2 build. **Option A restores non-vacuous assurance** by asserting on the appstore-build `dist/` (the verbatim pre-compression embed input) with a FATAL freshness/linkage guard — a stale clean `dist/`, a `dist/` newer than the binary, a stale binary, or a missing/empty/sentinel-less `dist/` all FAIL (proven by the new `--selftest` freshness fixtures). The D-04 source of truth remains the Rollup `chunk.modules` fold-in inventory (sentinel), never the Vite manifest / IPC literals / raw identifiers.

## Human sandbox gate — PENDING (Task 3 checkpoint, WebDriver-impossible)

The automated layer is complete and green. The live StoreKit purchase/refund flip (MAS-IAP-02 / MAS-IAP-05) CANNOT be driven by WebDriver and requires a human with a Sandbox tester account. The signed `.app` is handed off; awaiting the human walkthrough (purchase → Pro live; refund → Pro drops live; boot prompt-free; upsell = StoreKit). The plan is NOT marked complete until that approval — STATE/ROADMAP record the checkpoint, not closure.

**Signed bundle:** `src-tauri/target/universal-apple-darwin/release/bundle/macos/TinkerDev.app`

## Self-Check: PASSED

- FOUND: `.planning/phases/28-entitlement-source-swap/28-05-SUMMARY.md`
- FOUND: `scripts/verify-appstore-bundle.sh`, `scripts/licenseUiFoldInGuard.mjs`
- FOUND commit: `71f14a01`
- FOUND: signed `.app` at `src-tauri/target/universal-apple-darwin/release/bundle/macos/TinkerDev.app`
