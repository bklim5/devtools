---
phase: 06-distribution
plan: 03
subsystem: infra
tags: [tauri, updater, minisign, code-signing, notarisation, entitlements, csp, distribution]

# Dependency graph
requires:
  - phase: 06-01
    provides: "version 0.2.0 lockstep (package.json + tauri.conf.json); .gitignore hardened (*.key/.env un-committable)"
  - phase: 06-02
    provides: "platform.updater seam (check/downloadAndInstall) + autoUpdateCheck pref that this Tauri config powers"
provides:
  - "tauri-plugin-updater 2.10.1 (Rust, cfg block) + tauri-plugin-process 2.3.1 (Rust, main deps) registered"
  - "updater plugin registered in setup() (#[cfg(desktop)]); process plugin in the builder chain"
  - "Check for Updates… tray item emitting menu://check-updates for the JS shell (Plan 04)"
  - "least-privilege capabilities: updater:default + process:allow-restart (no wildcards)"
  - "tauri.conf.json plugins.updater block (committed minisign pubkey + bklim5/devtools latest.json endpoint)"
  - "bundle.createUpdaterArtifacts: true (emits .app.tar.gz + .sig)"
  - "wired-but-gated bundle.macOS (ad-hoc signingIdentity '-', hardenedRuntime, entitlements.plist, minSysVer 10.15)"
  - "entitlements.plist (offline hardened-runtime JIT baseline, no network entitlement)"
  - "GitHub-scoped connect-src CSP widening (github.com + objects.githubusercontent.com only)"
affects: [06-04, 06-05, distribution, release, updater-ux]

# Tech tracking
tech-stack:
  added:
    - "tauri-plugin-updater 2.10.1 (Rust, exact-pinned, cfg(any(...)) target block)"
    - "tauri-plugin-process 2.3.1 (Rust, exact-pinned, main [dependencies])"
  patterns:
    - "Rust plugin placement mirrors Phase-5 idiom: target-gated updater in cfg(any(...)), desktop-wide process in main deps; one-line comment in the file's existing commented style"
    - "Updater plugin registered in setup() via app.handle().plugin(...) (official Tauri 2 pattern), not the builder chain — needs the AppHandle"
    - "Tray menu event emits an event (menu://check-updates) for the JS seam to handle; the actual check() runs in JS (D-12), never in Rust"
    - "Wire-but-gate macOS signing: ad-hoc '-' + hardenedRuntime + entitlements committed now so Developer-ID/notarisation is a credentials-only env flip at enrolment"
    - "CSP widened ONLY on connect-src and ONLY to the two GitHub hosts; all other directives stay 'self' (offline-by-design holds)"

key-files:
  created:
    - "src-tauri/entitlements.plist"
    - ".planning/phases/06-distribution/06-03-SUMMARY.md"
  modified:
    - "src-tauri/Cargo.toml"
    - "src-tauri/Cargo.lock"
    - "src-tauri/src/lib.rs"
    - "src-tauri/capabilities/default.json"
    - "src-tauri/tauri.conf.json"

key-decisions:
  - "Used the REAL repo bklim5/devtools for the updater endpoint (not the plan's boonkhailim/devtools placeholder) — git remote origin is already set to git@github.com:bklim5/devtools.git and SSH-verified; this removes the placeholder-to-confirm step from Plan 05's pre-release blockers."
  - "Committed the user-provided minisign public key into plugins.updater.pubkey verbatim (single-line base64). The private key lives at ~/.tauri/devtools.key OUTSIDE the repo and is never committed."
  - "The keypair is PASSWORDLESS (generated with --ci -p \"\" out-of-band at the Task 1 checkpoint); signed builds use an empty TAURI_SIGNING_PRIVATE_KEY_PASSWORD. RECOMMENDED FOLLOW-UP: regenerate with a password before public distribution."

patterns-established:
  - "Updater Rust plugin registers in setup() with #[cfg(desktop)] app.handle().plugin(...), not the builder chain (needs AppHandle)."
  - "Tray-to-JS bridge: Rust tray menu emits a namespaced event (menu://check-updates); the JS shell listens and drives the seam — keeps the actual updater logic behind src/lib/platform/ (D-12)."

requirements-completed: [DST-01, DST-02]

# Metrics
duration: ~6min
completed: 2026-06-01
---

# Phase 6 Plan 03: Tauri Distribution Config Wiring Summary

**Registered the updater + process Rust plugins, added a Check for Updates… tray item with least-privilege capabilities, and configured tauri.conf.json with the updater block (committed minisign pubkey + bklim5/devtools endpoint), createUpdaterArtifacts, a wired-but-gated bundle.macOS (ad-hoc + hardened runtime + offline entitlements), and a GitHub-scoped CSP — turning the app into a buildable, updater-emitting, ad-hoc-signed bundle whose Developer-ID activation is a credentials-only flip.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-06-01T22:00:00Z (continuation after the Task 1 human-action checkpoint)
- **Completed:** 2026-06-01T22:02:00Z
- **Tasks:** 4 executed (Tasks 2–5; Task 1 done out-of-band at the checkpoint)
- **Files modified:** 5 (1 created)

## Accomplishments

- **Task 1 (out-of-band, checkpoint):** minisign keypair generated at `~/.tauri/devtools.key` (private, outside repo) + `~/.tauri/devtools.key.pub` (public). Public key supplied for Task 5; private key never enters the tree.
- **Updater + process plugins registered (Rust):** `tauri-plugin-updater = "2.10.1"` in the existing `cfg(any(...))` target block, `tauri-plugin-process = "2.3.1"` in main `[dependencies]`; `tauri_plugin_process::init()` in the builder chain; the updater plugin registered `#[cfg(desktop)]` at the top of `setup()`. `cargo check` green; webdriver release-exclusion intact (`cargo tree --release | grep -c webdriver` = 0).
- **Check for Updates… tray item:** new `MenuItem::with_id("check_updates", …)` between Show and Quit, with an `on_menu_event` arm emitting `menu://check-updates` (via the newly-imported `Emitter` trait) for the JS shell (Plan 04). Least-privilege capabilities granted: `updater:default` + `process:allow-restart` (no `process:default`, no wildcards).
- **Hardened-runtime entitlements.plist:** offline JIT baseline (`allow-jit`, `allow-unsigned-executable-memory`, `disable-library-validation`); no network entitlement; `plutil -lint` OK.
- **tauri.conf.json fully wired:** `plugins.updater` (committed real pubkey + `bklim5/devtools` `latest.json` endpoint), `bundle.createUpdaterArtifacts: true`, `bundle.macOS` (ad-hoc `signingIdentity "-"` + `hardenedRuntime` + `entitlements.plist` + `minimumSystemVersion 10.15`), and `connect-src` widened ONLY to `https://github.com` + `https://objects.githubusercontent.com`.

## Task Commits

Each task was committed atomically:

1. **Task 2: Register updater + process Rust plugins** - `72cbb449` (feat)
2. **Task 3: Check for Updates… tray item + least-privilege capabilities** - `35163c35` (feat)
3. **Task 4: Hardened-runtime entitlements.plist** - `cf7ec7ba` (feat)
4. **Task 5: tauri.conf.json updater block + bundle.macOS + scoped CSP** - `591d3f57` (feat)

_Task 1 (minisign keypair) was completed out-of-band at the human-action checkpoint — no repo commit (the key lives outside the tree)._

## Files Created/Modified

- `src-tauri/Cargo.toml` - Added tauri-plugin-updater (cfg block) + tauri-plugin-process (main deps), each with a one-line comment in the file's idiom
- `src-tauri/Cargo.lock` - Resolved by `cargo add` (committed alongside Cargo.toml)
- `src-tauri/src/lib.rs` - process plugin in builder chain; updater plugin in setup(); Check for Updates… tray item emitting menu://check-updates; Emitter import
- `src-tauri/capabilities/default.json` - Appended updater:default + process:allow-restart
- `src-tauri/entitlements.plist` - NEW; offline hardened-runtime JIT baseline (no network entitlement)
- `src-tauri/tauri.conf.json` - plugins.updater (real pubkey + bklim5/devtools endpoint), createUpdaterArtifacts, bundle.macOS (ad-hoc + hardened + entitlements), GitHub-scoped connect-src

## Decisions Made

- **Real repo `bklim5/devtools` used instead of the plan's `boonkhailim/devtools` placeholder.** The git remote `origin` is already `git@github.com:bklim5/devtools.git` (SSH-verified), so the endpoint is concrete now — this removes the "confirm/create the real public repo" blocking step that Plan 05's RELEASE.md would otherwise have to gate on (it becomes a confirmation, not a placeholder swap).
- **Passwordless minisign key (out-of-band Task 1).** The keypair was generated with `--ci -p ""`, so signed builds use an empty `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. **RECOMMENDED FOLLOW-UP:** regenerate the keypair WITH a password (and re-paste the new pubkey) before public distribution, so a leaked private key file alone is not sufficient to sign updates. Tracked here for Plan 05's RELEASE.md.
- Updater plugin registered in `setup()` (not the builder chain) per the official Tauri 2 pattern — it needs the `AppHandle`.
- Tray emits `menu://check-updates` rather than invoking a Rust command, keeping the actual `check()` behind the JS platform seam (D-12).

## Deviations from Plan

**1. [Rule 1 - Correctness] Used the real repo `bklim5/devtools` instead of the plan-pinned `boonkhailim/devtools` placeholder**
- **Found during:** Task 5 (tauri.conf.json endpoint)
- **Issue:** The plan pinned `boonkhailim/devtools` as an explicit placeholder-to-confirm (derived from the bundle identifier when no git remote existed). The continuation context provides the now-existing real remote `git@github.com:bklim5/devtools.git`. Shipping the placeholder would point the updater endpoint at a non-existent repo.
- **Fix:** Used `https://github.com/bklim5/devtools/releases/latest/download/latest.json` for the endpoint. Note: the bundle identifier (`com.boonkhailim.devtools-app`) was left UNCHANGED — it is an app identity string, not a URL, and changing it is out of this plan's scope (and would be an architectural/identity change).
- **Files modified:** src-tauri/tauri.conf.json
- **Verification:** node check asserts the endpoint contains `bklim5/devtools` and does NOT contain `boonkhailim`.
- **Committed in:** `591d3f57` (Task 5 commit)

---

**Total deviations:** 1 (correctness — directed by the continuation context's user-provided values).
**Impact on plan:** No scope creep. The change makes the updater endpoint concrete and removes a Plan-05 pre-release blocker.

## Issues Encountered

None. `cargo add` resolved `tauri-plugin-process` to 2.3.1 (confirming Assumption A1: ~2.3.x) and `tauri-plugin-updater` to 2.10.1 as specified. `cargo check` green at every task; lefthook (tsc + 285/285 vitest) green on all four commits.

## Known Stubs

None in this plan's surface. The tray's `menu://check-updates` event is intentionally consumed in Plan 04 (the JS updater UX/orchestration), not here — the plan's scope is Tauri-side config only. This is the documented seam between Plans 03 and 04, not a stub.

## Threat Flags

None beyond the plan's registered `<threat_model>`. All five registered threats are addressed by this config:
- **T-06-06 / T-06-09** (forged/MITM payload) — committed `plugins.updater.pubkey` drives the plugin's mandatory minisign verify over an HTTPS-only endpoint.
- **T-06-07** (over-broad egress) — `connect-src` widened ONLY to the two GitHub hosts; no wildcard; node check asserts no `connect-src *` / `'self' https:`.
- **T-06-08** (leaked private key) — private key generated/held in `~/.tauri/` OUTSIDE the repo; only the public key committed. (Caveat: passwordless key — see follow-up above.)
- **T-06-10** (over-broad capability) — only `updater:default` + `process:allow-restart`; node + grep assert no `process:default`.

## User Setup Required

For signed updater builds (Plan 05 / RELEASE.md), export the gitignored env vars before `pnpm tauri build`:
- `TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/devtools.key)"` (or the file path)
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""` (the key is currently passwordless — see the recommended follow-up to add one before public distribution)

Apple Developer-ID signing + notarisation remain GATED (D-01/D-02): at enrolment, export `APPLE_API_KEY`/`APPLE_API_ISSUER`/`APPLE_API_KEY_PATH` + `APPLE_SIGNING_IDENTITY` and add `providerShortName` — no structural change needed (hardenedRuntime + entitlements already committed).

## Next Phase Readiness

- **Plan 04 (updater UX):** can now wire the `menu://check-updates` tray event + the `platform.updater` seam (06-02) + the `autoUpdateCheck` pref (06-02) into the banner/opt-in/orchestration. The Tauri side is fully configured.
- **Plan 05 (RELEASE.md + phase-boundary build/sign-off):** the build will emit DMG + `.app.tar.gz` + `.sig` (createUpdaterArtifacts on). RELEASE.md should record (1) the passwordless-key follow-up, (2) the now-concrete `bklim5/devtools` endpoint (confirm the repo is public + a Release with `latest.json` exists), and (3) the DMG-mount-flake mitigation. The real updater round-trip is the Plan-05 human sign-off.
- **No blockers.** `cargo check` green, all JSON valid, plist lint OK, decoder 19 untouched, 285/285 vitest, tsc clean.

## Self-Check: PASSED

All 6 created/modified files exist on disk; all four task commits (`72cbb449`, `35163c35`, `cf7ec7ba`, `591d3f57`) are in git history. `cargo check` green, tauri.conf.json + capabilities/default.json valid JSON, entitlements.plist passes `plutil -lint`, webdriver release-exclusion intact (count 0), 285/285 vitest, tsc clean.

---
*Phase: 06-distribution*
*Completed: 2026-06-01*
