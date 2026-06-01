---
phase: 06-distribution
verified: 2026-06-01T23:40:00Z
status: passed
score: 7/7 must-haves verified (4/4 roadmap SCs; SC1 Gatekeeper-clause carried forward per D-02)
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
deferred:
  - truth: "DMG installs and launches on a clean machine WITHOUT Gatekeeper warnings (notarised + Developer-ID signed)"
    addressed_in: "Post-Apple-Developer-Program enrolment (D-02 carry-forward; future CI/notarisation phase)"
    evidence: "06-CONTEXT D-01/D-02: not enrolled yet; strategy = wire everything, gate notarisation on the cert; Gatekeeper-clean re-verified post-enrolment, explicitly NOT a phase blocker. Config is wired-but-gated: hardenedRuntime + entitlements.plist committed, signingIdentity '-' ad-hoc now → credentials-only flip. RELEASE.md documents the post-enrolment notarisation flip."
---

# Phase 6: Distribution Verification Report

**Phase Goal:** Ship DevTools as a distributable, self-updating macOS desktop app — a signed DMG (release-ready; Developer-ID notarisation deferred to post-enrolment per D-02) and a working, signature-verified auto-updater (DST-02).
**Verified:** 2026-06-01T23:40:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                                   | Status      | Evidence |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------- |
| 1   | `pnpm tauri build` emits a DMG AND a `.app.tar.gz` + `.app.tar.gz.sig` (signed, release-ready) — DST-01 release-ready                                  | ✓ VERIFIED  | `tauri.conf.json` `bundle.createUpdaterArtifacts: true`; human UAT A1–A3 produced `devtools-app_0.2.0_aarch64.dmg` + `.app.tar.gz` + `.sig` with the password-protected minisign key (confirmed this session) |
| 2   | macOS bundle is ad-hoc signed now with hardenedRuntime + entitlements wired so Developer-ID/notarisation is a credentials-only flip                    | ✓ VERIFIED  | `tauri.conf.json` `bundle.macOS.signingIdentity:"-"`, `hardenedRuntime:true`, `entitlements:"entitlements.plist"`, `minimumSystemVersion:"10.15"`; `entitlements.plist` valid with 3 JIT keys, no network entitlement |
| 3   | Auto-updater is wired through the `src/lib/platform/` seam and verifies the minisign signature before applying — DST-02                                | ✓ VERIFIED  | `tauri.ts` updater impl (`@tauri-apps/plugin-updater` + `plugin-process`), `downloadAndInstall` verifies + `relaunch()`; real round-trip (0.2.0→0.2.1) human-confirmed: signature VERIFIED → installed → RELAUNCHED |
| 4   | First-run opt-in (null→ask once, true→silent launch check, false→no automatic network call); choice persists                                           | ✓ VERIFIED  | `update.ts` `shouldAutoCheck`/`needsOptInPrompt`; `App.tsx` launch effect gated on `prefsLoaded && shouldAutoCheck`; `UpdateOptIn` persists via `setAutoUpdateCheck`; `autoUpdateCheck` coerced true/false/null in `prefsStore.ts`; UAT B5 persisted across relaunch |
| 5   | Manual "Check for Updates…" always available via the tray event regardless of the toggle                                                               | ✓ VERIFIED  | `lib.rs` MenuItem `check_updates` emits `menu://check-updates`; `tauri.ts` `events.onMenuCheckUpdates` (listen behind seam); `App.tsx` subscribes → `runCheck(true)`; UAT B6 passed |
| 6   | A re-appearing, dismissible, WCAG-AA, layout-agnostic update banner; Install verifies then relaunches                                                  | ✓ VERIFIED  | `UpdateBanner.tsx` controlled (parent-owned visibility), `w-full max-w-md` no fixed px, `aria-label="Dismiss update notification"`, `focus-visible:ring-accent`, non-opacity installing state; gsd-ui-review 23/24 WCAG-AA PASS; UAT B7 passed |
| 7   | Secret material is un-committable; app version is bumped in lockstep across both manifests                                                             | ✓ VERIFIED  | `.gitignore` ignores `.env`/`.envrc`/`*.key`/`*.p8`/`/latest.json`; `package.json` + `tauri.conf.json` both `"version": "0.2.1"` (lockstep; bumped past 0.1.0 → 0.2.0 → 0.2.1 for the round-trip) |

**Score:** 7/7 truths verified

### Deferred Items

Items not yet met but explicitly addressed in a later (post-enrolment) phase per locked decision D-02.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | DMG installs/launches on a clean machine WITHOUT Gatekeeper warnings (notarised + Developer-ID) | Post-Apple-Developer-Program enrolment (D-02; future CI/notarisation phase) | D-01/D-02: not enrolled; "wire everything, gate notarisation on the cert"; ad-hoc Gatekeeper friction EXPECTED + acceptable this milestone; config is wired-but-gated (entitlements + hardenedRuntime committed); RELEASE.md "Post-enrolment notarisation flip" documents the credentials-only activation |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `.gitignore` | Secret ignore rules | ✓ VERIFIED | `.env`/`.envrc`/`*.key`/`*.p8`/`/latest.json` present |
| `package.json` / `src-tauri/tauri.conf.json` | Lockstep version | ✓ VERIFIED | Both `0.2.1`; no `0.1.0`/divergence |
| `src/lib/platform/index.ts` | `updater` + `events` getters + `UpdateInfo` | ✓ VERIFIED | `get updater()`, `get events()`, `UpdateInfo` interface present |
| `src/lib/platform/browser.ts` | updater/events no-op (no @tauri-apps) | ✓ VERIFIED | `updater.check→null`, `events.onMenuCheckUpdates` no-op; no native import |
| `src/lib/platform/tauri.ts` | real updater impl | ✓ VERIFIED | plugin-updater + plugin-process + event listen; the ONLY native importer |
| `src/shell/update.ts` | seam-only orchestration | ✓ VERIFIED | `platform.updater`, error-as-value, no `@tauri-apps` import |
| `src/components/UpdateBanner.tsx` | WCAG-AA dismissible banner | ✓ VERIFIED | controlled, layout-agnostic, AA tokens, named dismiss, focus rings |
| `src/App.tsx` | banner mount + opt-in + tray-check wiring | ✓ VERIFIED | `UpdateBanner` + `UpdateOptIn` + `menu://check-updates` listener; no native import |
| `src-tauri/Cargo.toml` | updater + process Rust plugins | ✓ VERIFIED | `tauri-plugin-updater = "2.10.1"`, `tauri-plugin-process = "2.3.1"` |
| `src-tauri/src/lib.rs` | plugins registered + tray item | ✓ VERIFIED | `tauri_plugin_process::init()`, `tauri_plugin_updater::Builder`, `check_updates`→`menu://check-updates`; webdriver gate intact |
| `src-tauri/capabilities/default.json` | least-privilege perms | ✓ VERIFIED | `updater:default` + `process:allow-restart`; no `process:default`/wildcard |
| `src-tauri/tauri.conf.json` | updater block + createUpdaterArtifacts + macOS signing + scoped CSP | ✓ VERIFIED | all present; CSP widens only `connect-src` to github.com + objects.githubusercontent.com |
| `src-tauri/entitlements.plist` | hardened-runtime, no network | ✓ VERIFIED | 3 JIT keys, no `com.apple.security.network` |
| `test/e2e/update.e2e.ts` | real-WKWebView banner/dismiss spec | ✓ VERIFIED | `describe("Updater UX banner...")`, `__injectUpdate`, `#update-banner`/`#update-dismiss` keyboard-dismiss |
| `docs/RELEASE.md` | manual release runbook | ✓ VERIFIED | 277 lines; split-repo flow, hdiutil detach, darwin-aarch64 caveat, providerShortName notarisation flip, fresh-`.sig`, round-trip |
| `.planning/phases/06-distribution/06-HUMAN-UAT.md` | human sign-off | ✓ VERIFIED | A–D all PASS; Gatekeeper-clean DEFERRED; DST-01/DST-02 marked Complete |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `tauri.conf.json` updater.endpoints | GitHub Release latest.json | `releases/latest/download/latest.json` | ✓ WIRED | Points at the public `bklim5/devtools-releases` (split-repo; human-confirmed) — resolved in the live round-trip |
| `tauri.conf.json` updater.pubkey | minisign keypair at build | committed pubkey verifies `.sig` | ✓ WIRED | base64 minisign pubkey present; round-trip verified the signature against it |
| `lib.rs` tray `check_updates` | JS shell manual-check | `menu://check-updates` event | ✓ WIRED | Emitted in Rust; `tauri.ts` listens; `App.tsx` `runCheck(true)` |
| `App.tsx` launch chain | `platform.updater.check()` | gated on `shouldAutoCheck(autoUpdateCheck)` | ✓ WIRED | No call when pref false/null (offline-by-design; unit-asserted) |
| `UpdateBanner` Install | `platform.updater.downloadAndInstall` | `handleInstall`→`installUpdate` | ✓ WIRED | verifies sig + relaunches; error caught as toast, no crash |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full unit suite green (decoder 19 immovable bar) | `pnpm test` | 303/303 pass (37 files); decoder.test.ts = 19/19 | ✓ PASS |
| Type-check clean | `pnpm exec tsc --noEmit` | exit 0, no output | ✓ PASS |
| Lint clean | `pnpm lint` | exit 0, no findings | ✓ PASS |
| Seam audit (no native import outside tauri.ts) | grep `import ... @tauri-apps` | only `src/lib/platform/tauri.ts` matches | ✓ PASS |
| Real-WKWebView e2e (incl. update.e2e.ts) | confirmed this session | 8/8 specs green | ✓ PASS (session-confirmed) |
| Packaged build + signature-verified round-trip | confirmed this session | 0.2.0→0.2.1 verified + relaunched | ✓ PASS (human-confirmed) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| DST-01 | 06-01, 06-03, 06-05 | macOS build code-signed + notarised, packaged as a DMG | ✓ SATISFIED (release-ready, pending cert) | Signed (ad-hoc) DMG + updater artifacts built + human-verified; notarisation/Gatekeeper-clean DEFERRED post-enrolment (D-02), wired-but-gated config in place |
| DST-02 | 06-02, 06-03, 06-04, 06-05 | Auto-updater wired and verifies updates | ✓ SATISFIED | Real signature-verified round-trip (0.2.0→0.2.1, minisign verified + relaunched) human-confirmed; seam-pure UX (opt-in/tray/banner) |

No orphaned requirements: REQUIREMENTS.md maps only DST-01, DST-02 to Phase 6, both claimed across the plans' `requirements` frontmatter and both marked Complete.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | — | — | — | No blockers, warnings, or stubs. SUMMARY "Known Stubs: None" confirmed against code. The `window.__injectUpdate` hook in `App.tsx` is `import.meta.env.DEV`-guarded (stripped from production) and is the documented e2e injection path, not a stub. |

### Human Verification Required

None outstanding. The phase-boundary human items (packaged build, signature-verified updater round-trip, gsd-ui-review WCAG-AA) were all performed and confirmed this session (06-HUMAN-UAT.md A–D all PASS; "round-trip works"). The only open clause — Gatekeeper-clean on a clean machine — is a documented carry-forward gated on Apple Developer Program enrolment (D-02), not a verification blocker for this phase.

### Gaps Summary

No gaps. All 7 must-have truths verified against the codebase: the Tauri config emits signed DMG + updater artifacts with wired-but-gated Developer-ID; the updater is seam-pure (only `tauri.ts` imports `@tauri-apps`), least-privilege-capable, and its check→opt-in→verify→install→relaunch flow is proven by a real human-confirmed round-trip. The decoder's immovable 19 tests remain green within 303/303; tsc/eslint clean; e2e 8/8; gsd-ui-review 23/24 WCAG-AA PASS. The single Gatekeeper-clean clause of DST-01 is an explicit D-02 carry-forward (config is staged for a credentials-only flip), correctly classified as deferred rather than failed.

---

_Verified: 2026-06-01T23:40:00Z_
_Verifier: Claude (gsd-verifier)_
