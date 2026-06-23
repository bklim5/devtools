---
phase: 27-build-variant-seam
plan: 04
subsystem: build-variant-seam
tags: [mac-app-store, build-command, codesign, provisioning-profile, app-sandbox, capability-codegen, fatal-verify, launch-gate, mas-build-01, mas-build-02]
requires:
  - "27-01: the `appstore` Cargo feature + `--no-default-features --features appstore` compile-out (the flags this command passes via the `--` cargo separator) + capabilities/default.json strip (what the real build's capability codegen exercises — Finding 1)"
  - "27-02: tauri.appstore.conf.json committed overlay (13.0 + sandbox entitlements + no-dmg + updater:null) + the tauri:build:appstore package.json script that invokes this command + VITE_CHANNEL=appstore binding"
  - "27-03: scripts/verify-appstore-bundle.sh --require-bundle (the FATAL compliance gate this command's tail invokes on the freshly-signed bundle — Findings 2+3)"
  - "26-xx: scripts/build-appstore-spike.sh (the proven flow promoted here) + entitlements.appstore.plist + dev.provisionprofile (machine-specific, gitignored)"
provides:
  - "scripts/build-appstore-bundle.sh: the canonical launch-ready appstore build command (build universal sandboxed bundle → embed Mac Development profile → deep re-sign → FATAL verify) invoked by pnpm tauri:build:appstore"
  - "Human-verified proof: the signed sandboxed .app LAUNCHES + renders the webview (no white-screen) + works offline under App Sandbox (MAS-BUILD-02)"
  - "End-to-end Finding-1 proof: the FULL real --features appstore -- --no-default-features build produces a bundle (capability codegen passes with updater/process/autostart absent — not a `Permission … not found`)"
  - "FATAL --require-bundle verify tail: the command cannot exit 0 after a forbidden-plugin / missing-entitlement / wrong-13.0-floor finding (Finding 2)"
  - "Stale-bundle freshness guard: a skipped/failed build cannot masquerade as a fresh signed bundle"
affects:
  - "Phase 28 (entitlement-source swap — builds the same sandboxed appstore .app this command produces)"
  - "Phase 29 (sandbox-safe native features — re-runs this command for its SIGNED-build entitlement audit)"
  - "Phase 30 (.pkg submission — the productbuild pipeline starts from the universal sandboxed bundle this command emits)"
tech-stack:
  added: []
  patterns:
    - "Tauri CLI flag-passing: --no-default-features is a CARGO flag (the CLI owns -f/--features/--target/--bundles/--config) and MUST be forwarded after the `--` runner-args separator — `tauri build -f appstore … -- --no-default-features`"
    - "pre-build mktemp marker + `-nt` binary-freshness assertion: a `|| true`'d build that errored leaves a stale .app; the freshness guard fails rather than re-sign/verify a bundle the real build never produced (false-GREEN guard for Finding 1)"
    - "FATAL self-verify tail: the canonical build command invokes the committed verify-appstore-bundle.sh --require-bundle on its own freshly-signed bundle and exits non-zero on any compliance failure (no warning-only tail)"
    - "promote-don't-rewrite (D-01): the proven spike flow becomes the canonical command with the AMFI-413 / dev-vs-distribution / env-scrub / deep-re-sign rationale preserved verbatim; the spike is banner-marked SUPERSEDED, not deleted"
key-files:
  created:
    - "scripts/build-appstore-bundle.sh (the canonical launch-ready appstore build command — promoted from the spike with --no-default-features via the cargo separator + a stale-bundle freshness guard + a FATAL --require-bundle verify tail)"
  modified:
    - "scripts/build-appstore-spike.sh (SUPERSEDED banner added under the shebang; retained for Phase-26 walkthrough doc references)"
key-decisions:
  - "--no-default-features is passed AFTER the `--` runner-args separator (a cargo flag, not a Tauri CLI flag) — without it the CLI errors `unexpected argument` and the `|| true`'d build silently re-signs a stale bundle (Rule-3 fix in c4ce827a)"
  - "A pre-build mktemp marker + `-nt` freshness assertion guards against a stale .app masquerading as a fresh signed bundle — the bundle-existence guard alone is insufficient when the build is `|| true`'d (Rule-2 guard in c4ce827a)"
  - "The verify tail is FATAL via verify-appstore-bundle.sh --require-bundle — the command cannot hand off a non-compliant bundle with exit 0 (Finding 2)"
  - "The dev signingIdentity stays injected via APPLE_SIGNING_IDENTITY=$SIGN_ID (machine-specific, never committed); the AMFI-413 / dev-vs-distribution rationale is preserved verbatim (memory mas-signing-dev-vs-distribution)"
patterns-established:
  - "Cargo-flag pass-through in a Tauri build command goes after the `--` separator"
  - "A `|| true`'d build step is paired with a pre-build freshness marker + post-build `-nt` assertion so a no-op build cannot produce a false-GREEN signed artifact"
requirements-completed: [MAS-BUILD-01, MAS-BUILD-02]

duration: ~20min
completed: 2026-06-23
---

# Phase 27 Plan 04: The Build-Variant Seam (canonical appstore build command + human launch gate) Summary

**`scripts/build-appstore-bundle.sh` is now the canonical launch-ready appstore command (promoted from the Phase-26 spike): one step builds the universal `--no-default-features --features appstore` sandboxed bundle, embeds the Mac Development profile, deep re-signs, and FATAL-verifies — and the resulting signed `.app` was human-verified to LAUNCH, render the webview (no white-screen), and work offline under App Sandbox (MAS-BUILD-01 + MAS-BUILD-02).**

## Performance

- **Duration:** ~20 min (incl. the full real appstore build + the human launch walkthrough)
- **Completed:** 2026-06-23
- **Tasks:** 2 (Task 1 auto + Task 2 blocking human-verify gate)
- **Files modified:** 2 (1 created, 1 banner-marked)

## Accomplishments

- **Canonical launch-ready command (Task 1, `4fa30fdd`):** promoted the proven `build-appstore-spike.sh` into `scripts/build-appstore-bundle.sh` — build universal appstore bundle → embed `Contents/embedded.provisionprofile` → `codesign --force --deep` re-sign with the appstore entitlements → FATAL `verify-appstore-bundle.sh --require-bundle` tail. Wires the COMMITTED overlay (`--config src-tauri/tauri.appstore.conf.json`) instead of the spike's inline JSON, adds `--no-default-features --features appstore` (so the updater/autostart/process compile-out from 27-01 actually takes effect), and preserves the AMFI-413 / dev-vs-distribution / env-scrub / deep-re-sign rationale verbatim. Spike banner-marked SUPERSEDED, retained for the Phase-26 walkthrough doc.
- **Gate-time correctness fixes (Task 2 prep, `c4ce827a`):** running the real `pnpm tauri:build:appstore` at the gate surfaced two issues that would have produced a false-GREEN — fixed before handoff (details below).
- **Human launch gate PASSED (Task 2, MAS-BUILD-02):** the signed sandboxed `.app` launched (no AMFI -413), the webview rendered the app UI (sidebar + tool view, NOT a white/blank screen — the network.client failure mode this gate exists to catch), and offline tool use worked under App Sandbox. **User approved.**
- **Finding-1 proof end-to-end:** the FULL real `pnpm tauri build --features appstore … -- --no-default-features --config tauri.appstore.conf.json` build produced a bundle — `tauri-plugin-iap` compiles while updater/autostart/process are absent, so Tauri's capability codegen passed (no `Permission updater:default not found`).

## Task Commits

1. **Task 1: Promote spike → canonical build-appstore-bundle.sh (FATAL self-verify)** — `4fa30fdd` (chore)
2. **Task 1-fix (at the launch gate): cargo-separator flag-passing + stale-bundle freshness guard** — `c4ce827a` (fix)
3. **Task 2: Human launch gate — signed sandboxed .app launches + renders** — no source commit (blocking human-verify checkpoint; the build artifact is gitignored build output; approval is recorded here + in STATE.md)

**Plan metadata:** _(this docs/metadata commit)_

## Files Created/Modified

- `scripts/build-appstore-bundle.sh` (created) — the canonical launch-ready appstore build command: preflight (cert + profile present) → build universal `--features appstore -- --no-default-features` bundle (signed dev identity, env-scrubbed, no notarization) → pre-build freshness marker → bundle-existence + binary-freshness guards → embed Mac Development profile → `codesign --force --deep` re-sign → FATAL `verify-appstore-bundle.sh --require-bundle` tail.
- `scripts/build-appstore-spike.sh` (modified) — `# SUPERSEDED by scripts/build-appstore-bundle.sh (Phase 27 D-01 promotion). Kept for Phase-26 doc references.` banner added under the shebang; otherwise unchanged.

## Verification Evidence

- **Task 1 acceptance greps (on `4fa30fdd`):** `bash -n` clean, executable bit set; `no-default-features … features appstore`, `tauri.appstore.conf.json`, `AMFI`, `codesign --force --deep`, `embedded.provisionprofile`, `verify-appstore-bundle.sh`, `require-bundle` all present; no warning-only verify tail; spike `SUPERSEDED` banner present (file not deleted).
- **Real appstore build (Finding 1, at the gate):** the full `pnpm tauri:build:appstore` ran the real `--features appstore -- --no-default-features --config tauri.appstore.conf.json` universal build — it produced a bundle (capability codegen passed; updater/autostart/process absent, `tauri-plugin-iap` present).
- **Fresh signed artifact (no stale `.app`):** `…/universal-apple-darwin/release/bundle/macos/TinkerDev.app` mtime `Jun 23 08:42` (binary `08:42:09`) — NEWER than the last source commit `4fa30fdd` (`08:37`). The pre-build marker + `-nt` freshness guard passed (the build re-emitted the binary).
- **Compliance asserted on the REAL signed bundle (the FATAL `--require-bundle` tail printed all three OK lines, exit 0):**
  - `lipo -archs …/devtools-app` → `x86_64 arm64` (universal).
  - `codesign -d --entitlements - --xml <app>` → `app-sandbox` + `network.client` both PRESENT.
  - `/usr/libexec/PlistBuddy -c 'Print :LSMinimumSystemVersion' <app>/Contents/Info.plist` → `13.0` (Finding 3 — proven on the artifact).
  - `Contents/embedded.provisionprofile` present.
- **Human launch gate (WebDriver cannot drive the App Sandbox):** the user double-clicked the handed-off `.app` → it LAUNCHED (no AMFI -413), the webview RENDERED the app UI (not blank), and offline tool use worked under sandbox. **Approved.**
- **No regression:** decoder.ts + its 19 tests byte-for-byte untouched (this plan touched only `scripts/`); the direct channel un-regressed (base `tauri.conf.json` + `tauri.direct.conf.json` + default Cargo features unchanged — `pnpm tauri:build:direct` still builds the 10.15 Developer-ID DMG with updater + autostart via its `--config` overlay).

## Decisions Made

- **`--no-default-features` after the `--` separator:** it is a cargo flag, not a Tauri CLI flag — see Deviation 1.
- **Stale-bundle freshness guard:** a `|| true`'d build that errors leaves a stale `.app`; the bundle-existence guard alone would re-sign/verify it (false-GREEN defeating Finding 1) — see Deviation 2.
- **Committed overlay over inline JSON:** the canonical command passes `--config src-tauri/tauri.appstore.conf.json` (Plan 27-02), not the spike's inline `--config '{…}'` string — the single source of truth for the appstore deltas.
- **Dev signing identity stays env-injected:** `APPLE_SIGNING_IDENTITY="$SIGN_ID"` (machine-specific keychain identity, never committed); the AMFI-413 / dev-vs-distribution rationale is preserved verbatim (memory `mas-signing-dev-vs-distribution`).

## Deviations from Plan

Both deviations were discovered running the REAL `pnpm tauri:build:appstore` at the launch gate (Task 2 prep) and committed in `c4ce827a` BEFORE the handoff — without them the gate would have handed off a false-GREEN bundle.

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `--no-default-features` must be passed after the `--` cargo runner-args separator**
- **Found during:** Task 2 (running the real `pnpm tauri:build:appstore` at the launch gate).
- **Issue:** The Tauri CLI owns `-f/--features`, `--target`, `--bundles`, `--config`, but it has NO `--no-default-features` flag — that is a CARGO flag. Passing it directly to `tauri build` errored `unexpected argument '--no-default-features'`, and because the build line is `|| true`'d, the real appstore build never ran (the command would have proceeded to re-sign whatever was at `$APP_OUT`). The promotion in `4fa30fdd` inherited the spike's flat flag list, which never exercised this path.
- **Fix:** moved `--no-default-features` to after the `--` runner-args separator (the CLI forwards everything after `--` to cargo): `tauri build -f appstore --target … --bundles app --config … -- --no-default-features`. Added a verbatim FLAG-PASSING comment block documenting why. The full real build then ran (capability codegen passed — Finding 1).
- **Files modified:** `scripts/build-appstore-bundle.sh`.
- **Verification:** the full `--features appstore -- --no-default-features` build produced a fresh bundle; the FATAL verify tail printed all three OK lines, exit 0.
- **Committed in:** `c4ce827a`.

**2. [Rule 2 - Missing critical guard] Stale-bundle freshness assertion (false-GREEN guard for Finding 1)**
- **Found during:** Task 2 (same gate run, exposed by Deviation 1 — the failed build left a stale `.app`).
- **Issue:** A stale `.app` from an earlier run can sit at `$APP_OUT`. With the build `|| true`'d (harness rule — the absent updater-signing key can make the exit non-zero), the bundle-existence guard alone would happily embed the profile, deep re-sign, and "verify" a bundle the REAL appstore build never produced — a false GREEN that directly defeats the Finding-1 proof (the whole point of the gate is that the real `--no-default-features --features appstore` build produces a bundle).
- **Fix:** added a pre-build `mktemp` marker (with an EXIT trap to clean it up) and a post-build `-nt` assertion that `$APP_OUT/Contents/MacOS/devtools-app` is NEWER than the marker — so a skipped/failed/no-op build can never masquerade as a fresh signed bundle. Fails loudly pointing at the build log (CLI flag-parse error / capability-codegen failure).
- **Files modified:** `scripts/build-appstore-bundle.sh`.
- **Verification:** the freshness guard passed on the real run (binary mtime `08:42:09` > the pre-build marker); the produced bundle is genuinely fresh (> last source commit).
- **Committed in:** `c4ce827a`.

---

**Total deviations:** 2 auto-fixed (1 Rule-3 blocking, 1 Rule-2 missing-critical-guard).
**Impact on plan:** Both were necessary for the gate to be honest — the first made the real appstore build actually run (Finding 1), the second prevents a stale `.app` from passing as a fresh signed bundle (false-GREEN guard). No scope creep; both confined to the build script. The `4fa30fdd` promotion landed exactly as planned; the fixes are gate-discovered correctness hardening of the same script.

## Issues Encountered

None beyond the two gate-discovered deviations above (both fixed + committed in `c4ce827a` before handoff).

## User Setup Required

The build command needs machine-specific signing assets the agent cannot supply (the human confirmed they exist at the gate):
1. An "Apple Development" signing identity in the keychain (`security find-identity -p codesigning -v`).
2. A Mac Development provisioning profile for `com.tinkerdev.app` incl. THIS Mac at `src-tauri/dev.provisionprofile` (gitignored, produced in Phase 26).

A distribution profile here would fail launch with AMFI -413 — dev signing is required for a LOCAL sandbox launch (memory `mas-signing-dev-vs-distribution`). No NEW committed secret is introduced.

## Next Phase Readiness

- **MAS-BUILD-01 + MAS-BUILD-02 satisfied + human-verified** on the real signed bundle — the build-variant seam (Phase 27) is complete: `appstore` cargo feature + committed overlay + `VITE_CHANNEL` bound in ONE launch-ready command, the sandboxed `.app` launches + renders (no white-screen), the updater/autostart compiled OUT, the 13.0 floor proven on the artifact, the committed `verify-appstore-bundle.sh` is the FATAL gate.
- **Ready for Phase 28** (entitlement-source swap + store license pane) and **Phase 29** (sandbox-safe native features) — both build on this variant seam and re-run this command. They are parallel-capable once 27 lands.
- **Harness note:** the four phase-checkpoint quality gates (`/simplify` → `/code-review xhigh` → `/codex:adversarial-review` → real-WKWebView e2e) were NOT auto-run by the executor — recommend running them at the Phase-27 boundary per the binding harness before advancing.

## Self-Check: PASSED

- FOUND: scripts/build-appstore-bundle.sh (created, executable)
- FOUND: scripts/build-appstore-spike.sh (modified — SUPERSEDED banner)
- FOUND commit: 4fa30fdd (Task 1 — promote spike → canonical command)
- FOUND commit: c4ce827a (Task 1-fix — cargo separator + freshness guard)
- VERIFIED: fresh signed universal .app (x86_64 arm64, app-sandbox + network.client, LSMinimumSystemVersion 13.0, embedded profile) — mtime newer than last source commit; NO rebuild performed this session
- decoder.ts + its 19 tests byte-for-byte untouched (this plan touched only scripts/)

---
*Phase: 27-build-variant-seam*
*Completed: 2026-06-23*
