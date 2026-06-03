---
phase: 11-build-and-publish-driver-universal-binary-safety-rails
plan: 01
subsystem: infra
tags: [release, publish, tauri, universal-binary, lipo, minisign, github-release, tdd]

# Dependency graph
requires:
  - phase: 09-pure-release-core
    provides: "buildLatestJson + dual-key platformKey (the manifest contract this driver's buildAssetUrl feeds)"
  - phase: 10-bump-and-tag-driver
    provides: "bumpPlan.ts ↔ bump-and-tag.mjs pure-core/thin-driver split mirrored here; the already-pushed vX.Y.Z tag this phase consumes"
provides:
  - "src/lib/release/publishPlan.ts — pure publish-driver decision core (arg parse, single-sig assert, lipo both-arch parse, public asset URL, served-version match, signing/Apple env presence, dry-run plan + recovery render strings)"
  - "Unit coverage for every pure helper incl. fail-on-0/>1 sig, both-arch lipo, version mismatch (33 cases)"
affects: [11-02 build-and-publish.mjs driver, build-and-publish, REL-05, REL-06, REL-09, REL-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-core ↔ thin-driver split (mirrors Phase 10 bumpPlan.ts): every decision/assertion/URL/render-string lives in publishPlan.ts (unit-tested, zero I/O); the Plan 02 .mjs stays a thin fs/subprocess/network shell"
    - "Secret env handling returns BOOLEANS only — the pure core has no path to leak a key/password value back out (T-11-04)"

key-files:
  created:
    - src/lib/release/publishPlan.ts
    - src/lib/release/publishPlan.test.ts
  modified: []

key-decisions:
  - "Strict arm64 (not arm64e) in parseLipoArchs — a Rust/Tauri universal binary is arm64; arm64e returns false (RESEARCH §Q2)"
  - "Hard-coded RELEASES_REPO = 'bklim5/devtools-releases'; test asserts the private 'bklim5/devtools' slug never appears (T-11-03)"
  - "Local ProcessEnv type alias (Record<string,string|undefined>) instead of NodeJS.ProcessEnv — the frontend tsconfig has no @types/node NodeJS namespace; keeps the module pure + buildable under tsc --noEmit"
  - "renderPublishRecovery is fix-forward only (revert-by-republish) — never emits 'git reset --hard' for a remote release"

patterns-established:
  - "Pattern: pure publish decision core consumed by a thin I/O .mjs driver (Plan 02)"
  - "Pattern: presence-check env helpers return booleans, never the secret"

requirements-completed: [REL-05, REL-06, REL-09, REL-12]

# Metrics
duration: ~12min
completed: 2026-06-02
---

# Phase 11 Plan 01: Pure publish-driver decision core Summary

**Side-effect-free `publishPlan.ts` — `--dry-run` arg parse, single-fresh-`.sig` assertion (fail on 0/>1), strict both-arch `lipo` parse, public-repo asset URL, served-version match, boolean-only signing/Apple env checks, and dry-run plan/recovery render strings — fully TDD'd (33 cases), mirroring the Phase 10 `bumpPlan.ts` split.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-02T23:40:00Z
- **Completed:** 2026-06-02T23:44:00Z
- **Tasks:** 3
- **Files modified:** 2 (both created)

## Accomplishments
- 11 exported pure helpers covering REL-05 (lipo both-arch), REL-06 (single-sig assert + asset URL), REL-09 (env presence), REL-12 (served-version match), plus the dry-run plan + recovery render strings.
- The security-critical `.sig` link is fenced: `assertSingleSig` throws on 0 (signing-env hint) AND >1 (lists every match), so a stale/wrong signature can never silently flow into `latest.json`.
- `parseLipoArchs` requires BOTH `x86_64` and `arm64` (arm64-only / x86_64-only / arm64e all false), proving the universal artifact is genuinely fat.
- `buildAssetUrl` / `RELEASES_REPO` hard-target the PUBLIC `bklim5/devtools-releases`; a test asserts the private `bklim5/devtools` slug never appears.
- Signing + Apple env helpers return booleans only — no secret value can leave the pure core.
- Module is provably pure (grep: no `node:fs` / `node:child_process` / `process.argv` / `console.`); decoder 19 tests + `manifest.ts` untouched; zero new deps.

## Task Commits

1. **Task 1: failing tests (TDD RED)** — demonstrated RED via `pnpm vitest run` (module-not-found) before any implementation. Per the binding pre-commit UNIT gate (lefthook runs `vitest run` + `tsc` on every commit), a RED-only commit is blocked by design, so the RED tests were committed together with the Task 2 GREEN implementation.
2. **Task 2: arg/sig/arch/url/env/version helpers (GREEN)** — `6f65b1bc` (feat) — RED tests + the 8 helpers implemented to green (27 cases).
3. **Task 3: render helpers + full-suite purity audit** — `61411877` (feat) — `buildPublishPlanView` + `renderPublishPlan` + `renderPublishRecovery` (33 cases total); full gate green.

_TDD note: RED was run and observed (Cannot find module './publishPlan') but, because the repo's pre-commit hook enforces a green `vitest`+`tsc` gate on every commit, the RED test file could not be committed in isolation — it was committed atomically with its GREEN implementation in `6f65b1bc`._

## Files Created/Modified
- `src/lib/release/publishPlan.ts` (254 lines) — pure publish-driver decision core; 11 exports: `parsePublishArgs`, `assertSingleSig`, `parseLipoArchs`, `buildAssetUrl`, `extractServedVersion`, `assertVersionMatches`, `hasSigningEnv`, `hasAppleEnv`, `buildPublishPlanView`, `renderPublishPlan`, `renderPublishRecovery` (+ exported `ProcessEnv` / `PublishArgs` / `PublishPlanView` types).
- `src/lib/release/publishPlan.test.ts` (231 lines, 33 cases) — covers every helper incl. fail-on-0/>1 sig, both-arch/arm64e lipo, version mismatch, boolean-only env returns, and the render-string content assertions.

## Decisions Made
- **Strict `arm64`** (reject `arm64e`) in `parseLipoArchs` — the cleaner of the two RESEARCH §Q2 options; correct for a Rust universal binary.
- **`RELEASES_REPO` const + test guard** so the updater URL can never point at the private source repo.
- **Local `ProcessEnv` type alias** (see Deviations Rule 3) — the only adjustment vs. the plan's literal `NodeJS.ProcessEnv` signature.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced `NodeJS.ProcessEnv` with a local `ProcessEnv` alias**
- **Found during:** Task 2 (env helpers), surfaced by `tsc --noEmit`.
- **Issue:** The plan's `hasSigningEnv(env: NodeJS.ProcessEnv)` / `hasAppleEnv(env: NodeJS.ProcessEnv)` signatures fail to compile — the frontend tsconfig has no `@types/node`, so the `NodeJS` namespace is undefined (`error TS2503: Cannot find namespace 'NodeJS'`). Importing `@types/node` into the app tsconfig to satisfy a pure string-map check would be wrong (and risks pulling Node globals into the frontend type space).
- **Fix:** Added `export type ProcessEnv = Record<string, string | undefined>` (the structural shape of `process.env`) and typed both helpers against it. `process.env` is assignable to it, so the Plan 02 `.mjs` driver calls them unchanged. Same behavior, same purity, frontend-tsconfig-safe.
- **Files modified:** `src/lib/release/publishPlan.ts`
- **Verification:** `tsc --noEmit` clean; both env tests green; `process.env` remains a valid argument.
- **Committed in:** `6f65b1bc` (Task 2 commit)

**2. [Rule 3 - Blocking] Widened `extractServedVersion` param to allow extra fields**
- **Found during:** Task 2, surfaced by `tsc --noEmit`.
- **Issue:** The test fixture `{ version: "0.2.2", platforms: {} }` (a realistic parsed `latest.json`) tripped `TS2353` against the plan's exact `{ version?: string }` param — excess-property checking rejected `platforms`.
- **Fix:** Param typed as `{ version?: string; [key: string]: unknown }` — still requires a string `version` (throws otherwise), but tolerates the other `latest.json` fields a real served manifest carries.
- **Files modified:** `src/lib/release/publishPlan.ts`
- **Verification:** `tsc --noEmit` clean; both `extractServedVersion` tests green.
- **Committed in:** `6f65b1bc` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking, type-level only).
**Impact on plan:** Both are minimal type-signature adjustments required to compile under the frontend tsconfig; behavior, exports, and purity are exactly as the plan specified. No scope creep.

## Issues Encountered
- **Pre-commit hook vs. TDD RED commit:** the repo's lefthook `pre-commit` runs the full `vitest run` + `tsc --noEmit`, so a TDD RED-only commit (intentionally-failing tests, no implementation) is rejected. RED was demonstrated by running the suite (module-not-found) and recorded; the tests were then committed atomically with their GREEN implementation. This matches the Phase 10 `bumpPlan` precedent (test+impl committed together).

## User Setup Required
None — no external service configuration required. This plan is pure TS + tests; the I/O driver (real `tauri build` / `gh` publish / signing env / the load-bearing updater round-trip) is Plan 11-02 and the phase human-gate.

## Next Phase Readiness
- **Plan 11-02 ready:** the thin `scripts/build-and-publish.mjs` driver can now import all decision/assertion/render logic from `publishPlan.ts` (under `tsx`) and `buildLatestJson` from `manifest.ts`, keeping itself a pure fs/subprocess/network shell — exactly the Phase 10 pattern.
- No blockers. Standing constraints honored: zero new deps, decoder + its 19 tests byte-for-byte untouched, `manifest.ts` untouched. The universal-build/`x86_64-apple-darwin` rustup preflight + the real updater round-trip remain the Plan 02 / phase-boundary work.

## Self-Check: PASSED

- FOUND: `src/lib/release/publishPlan.ts`
- FOUND: `src/lib/release/publishPlan.test.ts`
- FOUND: `.planning/phases/11-build-and-publish-driver-universal-binary-safety-rails/11-01-SUMMARY.md`
- FOUND commit: `6f65b1bc` (Task 2 — RED tests + GREEN helpers)
- FOUND commit: `61411877` (Task 3 — render helpers + full gate)

---
*Phase: 11-build-and-publish-driver-universal-binary-safety-rails*
*Completed: 2026-06-02*
