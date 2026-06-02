---
phase: 11-build-and-publish-driver-universal-binary-safety-rails
verified: 2026-06-03T00:18:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
---

# Phase 11: build-and-publish driver + universal binary + safety rails Verification Report

**Phase Goal:** A maintainer can build a signed universal (Intel + Apple Silicon) macOS binary and publish it to the public releases repo with a `latest.json` generated from this build's fresh signature, such that an older install on either architecture detects, signature-verifies, and relaunches into the new version — guarded by `--dry-run`, build-time preflights, and a post-publish endpoint check so a broken release can never silently auto-install onto every user.
**Verified:** 2026-06-03T00:18:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP Success Criterion) | Status | Evidence |
|---|-----------------------------------|--------|----------|
| 1 | Universal binary via `tauri build --target universal-apple-darwin`, artifacts at universal output path, `lipo -archs` asserts both `x86_64 arm64` (rustup preflight) | ✓ VERIFIED | Driver runs `runGate("tauri build (universal)", "pnpm", ["tauri","build","--target","universal-apple-darwin"])` (build-and-publish.mjs:256-261); `lipo -archs` on the real universal Mach-O fed into `parseLipoArchs` with abort-on-fail (264-269); rustup `x86_64-apple-darwin` preflight + idempotent `target add` + re-verify (174-180, 232-242); `parseLipoArchs` strictly requires both x86_64 AND arm64 (publishPlan.ts:90-93). Live: 11-03-SUMMARY records `lipo -archs` → `x86_64 arm64`; published DMG asset is `devtools-app_0.2.2_universal.dmg`. |
| 2 | `latest.json` from single-match glob of THIS build's fresh `*.app.tar.gz.sig` (fail on 0 or >1), dual-key darwin-aarch64 + darwin-x86_64 same url+signature | ✓ VERIFIED | `assertSingleSig` throws on 0 (signing-env hint) and >1 (lists matches), returns the single path (publishPlan.ts:69-81; tests green); stale `.sig` cleared pre-build then glob'd from the universal macos dir (build-and-publish.mjs:244-275); fed into pure `buildLatestJson` (287-294). **Live served manifest** (curl of `releases/latest/download/latest.json`): both `darwin-aarch64` and `darwin-x86_64` present with byte-identical signature + identical URL, no `darwin-universal` key. |
| 3 | Published to public `bklim5/devtools-releases` via `gh release create --repo` (never origin), DMG + .app.tar.gz + latest.json (assets first, manifest last), post-publish `curl -L` confirms served == cut version | ✓ VERIFIED | `gh release create` (line 303, assets) precedes `gh release upload latest.json` (line 318, manifest last); every gh call passes `--repo bklim5/devtools-releases` (slug appears 3×, private `bklim5/devtools` slug absent); post-publish `curl -L` → `assertVersionMatches(extractServedVersion(...), version)` (328-330). **Live:** `gh release view v0.2.2 --repo bklim5/devtools-releases` lists all three assets (`devtools-app.app.tar.gz`, `devtools-app_0.2.2_universal.dmg`, `latest.json`); served version == 0.2.2. |
| 4 | `APPLE_*` honored if present but never required (ad-hoc default; no secret echoed/CLI-arg); `--dry-run` prints full plan, zero side effects | ✓ VERIFIED | `hasSigningEnv`/`hasAppleEnv` return booleans only (publishPlan.ts:140-165); driver logs only the boolean branch, never a value (build-and-publish.mjs:166-171); secrets reach children only via inherited `{ env: process.env }` (103, 124), never an argv element (`grep` for logged secret value: none). `--dry-run` short-circuits BEFORE the build, printing `renderPublishPlan` and exiting 0 (369-373). 11-03: APPLE_* unset → ad-hoc signing default. |
| 5 | Human-gate: real updater round-trip proven live — older install detects, passes minisign verify against committed pubkey, relaunches into new version (DST-02) | ✓ VERIFIED (human-gated, confirmed during execution) | 11-03-SUMMARY records the live DST-02 round-trip on Apple Silicon: older install detected v0.2.2, passed minisign verify against the pinned `tauri.conf.json` pubkey (no `InvalidSignature`), relaunched into 0.2.2. Intel covered-by-construction (one universal artifact, byte-identical signature served under both keys — independently confirmed in the live served manifest above). Seam wiring intact: `tauri.ts` updater `downloadAndInstall` → `relaunch()` with the mandatory verify in the plugin. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/release/publishPlan.ts` | Pure decision core, 11 helpers, provably pure | ✓ VERIFIED | 14 exports incl. all 11 required helpers; purity grep (`node:fs`/`node:child_process`/`process.argv`/`console.`) returns nothing; public slug only, private slug absent. 254 lines. |
| `src/lib/release/publishPlan.test.ts` | Unit coverage incl. fail-on-0/>1 sig, both-arch lipo, version mismatch | ✓ VERIFIED | Present; suite green (covers all helpers). |
| `scripts/build-and-publish.mjs` | Thin I/O driver, preflights → dry-run short-circuit → build → lipo → sig glob → latest.json → gh publish → curl verify | ✓ VERIFIED | 387 lines; `node --check` passes; imports `buildLatestJson` (manifest.ts) + 11 publishPlan helpers; execFileSync only (0 bare execSync); slug 3×. |
| `package.json` | `release:publish` wired to tsx driver | ✓ VERIFIED | `"release:publish": "tsx scripts/build-and-publish.mjs"` present (line 15). |
| `src/lib/update/downloadProgress.ts` | Pure download-progress reducer (8000% bugfix) | ✓ VERIFIED | `reduceDownloadProgress` accumulates bytes/total, clamps ≤100, undefined when total unknown; test file present + green. |
| `.planning/.../11-03-SUMMARY.md` | Live publish + DST-02 round-trip evidence | ✓ VERIFIED | Records published v0.2.2, lipo both-arch, served-version match, dual-key, arm64 round-trip, ad-hoc posture, two bugfixes. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| build-and-publish.mjs | manifest.ts `buildLatestJson` | import under tsx | ✓ WIRED | Imported (line 52) and called with fresh signature (287-294). |
| build-and-publish.mjs | publishPlan.ts helpers | import | ✓ WIRED | All 11 helpers imported (54-66) and used throughout. |
| build-and-publish.mjs | `gh release create --repo bklim5/devtools-releases` | execFileSync argv | ✓ WIRED | Create (303) + upload (318) both `--repo` the public slug; create precedes upload. |
| lipo stdout | `parseLipoArchs` | abort-on-fail | ✓ WIRED | `run("lipo",["-archs",machO]).stdout` → `parseLipoArchs` → abort (264-269). |
| fresh `.sig` glob | `assertSingleSig` → `buildLatestJson` signature | readFileSync | ✓ WIRED | Globbed, single-asserted, read fresh, fed into latest.json (273-294). |
| older install updater | served latest.json | minisign verify vs pinned pubkey | ✓ WIRED (live) | tauri.ts seam → plugin `downloadAndInstall` (mandatory verify) → `relaunch`; round-trip passed live on arm64 (11-03). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| Served `latest.json` (public repo) | `version`, dual-key `signature`+`url` | Live `gh release` published by the driver | Yes — curl returns version 0.2.2, both arch keys, byte-identical real signature | ✓ FLOWING |
| `latest.json` generation | `signature` | `readFileSync(sigPath)` from fresh build glob, not hardcoded | Yes — fresh `.sig` from THIS build | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| publishPlan + downloadProgress unit suites | `pnpm vitest run …publishPlan.test.ts …downloadProgress.test.ts` | 40/40 passed | ✓ PASS |
| Full test gate | `pnpm vitest run` | 503/503 across 49 files | ✓ PASS |
| Decoder immovable bar | `pnpm vitest run …protobuf/decoder.test.ts` | 19/19 passed (untouched) | ✓ PASS |
| Type check | `pnpm exec tsc --noEmit` | clean | ✓ PASS |
| Lint | `pnpm lint` | clean | ✓ PASS |
| Driver syntax | `node --check scripts/build-and-publish.mjs` | SYNTAX_OK | ✓ PASS |
| Served manifest live | `curl -L releases/latest/download/latest.json` | version 0.2.2, dual-key, identical sig+url, no darwin-universal | ✓ PASS |
| Public-repo assets | `gh release view v0.2.2 --repo bklim5/devtools-releases` | DMG + .app.tar.gz + latest.json, tag v0.2.2 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| REL-05 | 11-01/02/03 | Universal macOS binary, universal output path, lipo both-arch | ✓ SATISFIED | universal build target + lipo gate + rustup preflight; live fat binary + universal DMG |
| REL-06 | 11-01/02 | latest.json from fresh single-match `.sig` glob, dual-key same url+sig | ✓ SATISFIED | assertSingleSig fail-on-0/>1; live served manifest byte-identical dual-key |
| REL-07 | 11-02/03 | Publish to public repo via `gh release create --repo`, assets-first/manifest-last | ✓ SATISFIED | ordered gh calls, `--repo` slug; live v0.2.2 with all 3 assets |
| REL-09 | 11-01/02/03 | APPLE_* honored if present, ad-hoc default, no secret echoed/CLI-arg | ✓ SATISFIED | boolean-only env checks, inherited env, no secret logged; ad-hoc used live |
| REL-12 | 11-01/02/03 | Post-publish curl confirms served version == cut version | ✓ SATISFIED | curl → assertVersionMatches; live served 0.2.2 == cut 0.2.2 |

No orphaned requirements: REQUIREMENTS.md maps exactly REL-05/06/07/09/12 to Phase 11; all five accounted for. (REL-10/REL-11 build/publish-half delivered here but counted under Phase 10 to avoid double-mapping — preflights + `--dry-run` short-circuit verified present.)

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None found | — | Driver uses execFileSync-only (0 bare execSync); pure core is I/O-free; no secret logged; no TODO/FIXME/placeholder in phase files; no auto-rollback (revert-by-republish). |

### Human Verification Required

None outstanding. Success Criterion 5 (DST-02 live round-trip) is a human-gated checkpoint that was performed and confirmed by the maintainer during Plan 11-03 execution (arm64 detect → minisign verify → relaunch into 0.2.2; Intel covered-by-construction via the byte-identical dual-key signature, independently confirmed in the live served manifest). The durable artifacts of that live run (served manifest, public-repo assets, version match) were independently re-confirmed during this verification. Per phase instructions, the live publish was not re-run.

### Gaps Summary

No gaps. All five ROADMAP success criteria are verified — three (build/publish pipeline, dual-key manifest, cross-repo publish + version match) by a combination of static code wiring and the durable artifacts of the live v0.2.2 publish independently re-confirmed here (curl + gh); the safety rails (dry-run, preflights, secret handling) by code inspection and the green gate; and the load-bearing DST-02 updater round-trip by the human-gated live acceptance recorded in 11-03-SUMMARY. Two real bugs found during the live run (`main().catch()` crash `899a7036`, 8000% progress `d8c413d5`) are both fixed and committed, with the progress fix backed by a pure TDD'd reducer + regression test. Full gate green: vitest 503/503 (49 files), tsc clean, eslint clean, decoder's 19 tests untouched. manifest.ts and decoder.ts byte-untouched; latest.json untracked (REL-08 preserved).

---

_Verified: 2026-06-03T00:18:00Z_
_Verifier: Claude (gsd-verifier)_
