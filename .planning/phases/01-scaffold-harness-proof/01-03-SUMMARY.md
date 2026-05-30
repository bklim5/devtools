---
phase: 01-scaffold-harness-proof
plan: 03
subsystem: infra
tags: [lefthook, pre-commit, gate, tsc, vitest, tauri-build, macos, bundle, unsigned, gatekeeper]

# Dependency graph
requires:
  - phase: 01-01
    provides: "lefthook@2.1.9 + prepare:lefthook install in package.json; Tauri+Vite+React+TS scaffold; tsc/vitest configured; clipboard-enabled Rust core; Rust 1.96.0"
  - phase: 01-02
    provides: "Full green tree (tsc clean, 32 vitest tests) for the gate + build to pass over"
provides:
  - "lefthook.yml: pre-commit unit gate (pnpm tsc --noEmit + pnpm vitest run, parallel) registered in .git/hooks/pre-commit — HRN-03 mechanical enforcement"
  - "Non-destructive proof the gate BLOCKS a type error (via pnpm lefthook run pre-commit on a staged probe) then passes clean — no real bad commit"
  - "D-08 boundary documented in lefthook.yml + phase-0-notes.md: UI gate + /codex:review stay manual per-task steps"
  - "docs/phase-0-notes.md: HRN-04 first-smoke build findings (paths, sizes, duration, toolchain, unsigned/Gatekeeper, webdriver-absent) + HRN-02 and final-build placeholders for Plan 04"
  - "Runnable unsigned (adhoc) macOS bundle: devtools-app.app (9.7M) + devtools-app_0.1.0_aarch64.dmg (4.1M) — HRN-04 first smoke, launch confirmed"
affects: [01-04 (fills HRN-02 + authoritative final build placeholders), all later phases (every commit now gated by lefthook)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "lefthook pre-commit = the MECHANICAL unit gate ONLY (tsc + vitest); UI + /codex:review stay manual (D-08)"
    - "Prove a git gate non-destructively via `pnpm lefthook run pre-commit` on a STAGED temp probe — never a real bad commit"
    - "Phase deliverables (HRN-02/HRN-04) accumulate in a single docs/phase-0-notes.md with explicit per-plan placeholders"
    - "First/smoke tauri build runs in Phase 1 to surface toolchain/signing surprises early; authoritative final build deferred to post-WebDriver plan"

key-files:
  created:
    - docs/phase-0-notes.md
    - .planning/phases/01-scaffold-harness-proof/deferred-items.md
  modified:
    - lefthook.yml

key-decisions:
  - "Staged-probe proof: lefthook v2 evaluates pre-commit commands against the STAGED file set, so the type-error probe was git add-ed (mirrors a real commit) then deleted — proven block+pass with zero worktree contamination"
  - "Bundle is named devtools-app.* (tauri.conf.json productName=devtools-app; window title=DevTools) — recorded; aligning productName to DevTools is a later-phase cosmetic"
  - "dist/ + node_modules/ + .claude/ + src-tauri/target/ untracked-not-ignored left untouched (pre-existing/out of scope); logged to deferred-items.md"
  - "No rustup update needed — Rust 1.96.0 (bumped in Plan 01-01) built the release cleanly; RESEARCH A6 MSRV surprise budget unused"

patterns-established:
  - "Every commit from here on is gated by lefthook pre-commit (tsc --noEmit + vitest run) — the green bar is now mechanical, not just discipline"
  - "Non-destructive gate verification via `pnpm lefthook run pre-commit` + staged temp probe"

requirements-completed: [HRN-03, HRN-04]

# Metrics
duration: 18min
completed: 2026-05-30
---

# Phase 1 Plan 03: Lefthook Unit Gate + First Tauri Smoke Build Summary

**Installed the mechanical pre-commit unit gate (lefthook running `tsc --noEmit` + `vitest run`, parallel) and PROVED non-destructively that it blocks a deliberate type error then passes clean — via `pnpm lefthook run pre-commit` on a staged temp probe, no real bad commit — then ran the first `pnpm tauri build` to produce a runnable unsigned (adhoc) macOS `devtools-app.app` (9.7M) + `.dmg` (4.1M), launch-confirmed, with all findings + the gate-boundary + Plan-04 hand-off in `docs/phase-0-notes.md`. `package.json`/lockfile/`src` untouched (HIGH-2).**

## Performance

- **Duration:** ~18 min (active executor time; the ~69s release build ran in the background; some time lost to intermittent harness output drops)
- **Started:** 2026-05-30T15:18:25Z
- **Completed:** 2026-05-30T~16:42Z
- **Tasks:** 2
- **Files created/modified:** 3 (lefthook.yml, docs/phase-0-notes.md, deferred-items.md)

## Accomplishments
- **HRN-03 mechanical unit gate (D-07):** wrote the real `lefthook.yml` (`pre-commit`, `parallel: true`, `typecheck: pnpm tsc --noEmit` + `test: pnpm vitest run`) and registered it into `.git/hooks/pre-commit` via `pnpm lefthook install`. The gate is now LIVE — it ran and passed on every one of this plan's own commits (✔️ typecheck, ✔️ test 32/32).
- **Non-destructive block proof:** with a staged `src/__lefthook_probe__.ts` (`const x: number = "oops";`), `pnpm lefthook run pre-commit` exited **non-zero**: `typecheck ❯ src/__lefthook_probe__.ts(3,7): error TS2322: Type 'string' is not assignable to type 'number'. exit status 2`. After deleting the probe, the same command exited **zero**. No real bad commit; the probe does not remain (disk + index clean).
- **D-08 boundary documented** in both `lefthook.yml` comments and `phase-0-notes.md`: lefthook covers the unit gate ONLY; `/codex:review` (disable-model-invocation) and real-webview UI verification stay manual per-task DoD steps.
- **HRN-04 first smoke build:** `pnpm tauri build` succeeded (exit 0) → runnable unsigned (`Signature=adhoc`) `devtools-app.app` (9.7M) + `devtools-app_0.1.0_aarch64.dmg` (4.1M / 4,255,267 bytes); release binary 9.4M. **Launch confirmed** after `xattr -dr com.apple.quarantine` (live process `…/devtools-app`, PID 21742, then killed). No signing/notarisation attempted.
- **WebDriver surface verified absent** from the smoke artifact (it predates the plugin): `grep -c webdriver src-tauri/Cargo.toml` → 0; `strings …/devtools-app | grep -ci webdriver` → 0; `… | grep -c 4445` → 0.
- **phase-0-notes.md created** with HRN-04 first-smoke findings (paths, sizes, ~69s wall / 42.27s cargo, toolchain table, unsigned/Gatekeeper behavior) plus clearly-marked HRN-02 and "FINAL release build (post-WebDriver)" placeholders for Plan 04, and an explicit note that Plan 04 owns the authoritative build verifying the WebDriver server is absent.
- **HIGH-2 de-conflict held:** this plan's tracked diff is only `lefthook.yml` + `docs/phase-0-notes.md` (+ planning docs). `package.json`/`pnpm-lock.yaml`/`src` untouched.

## Task Commits

1. **Task 1: lefthook pre-commit unit gate (tsc + vitest), proven non-destructively** - `79a7826` (chore)
2. **Task 2: first tauri build smoke + gate-enforcement / build notes** - committed as `7634741` (docs), then `git commit --amend`-ed to correct artifact names/sizes/duration after the build completed (the original draft had pre-build estimates; the amended commit carries the verified `devtools-app.*` 9.7M/4.1M, ~69s, correct rustc/tauri versions, and the corrected "icon nesting is fine" note). See final git log for the amended hash.

**Plan metadata:** final docs commit (see below)

## Files Created/Modified

- `lefthook.yml` - replaced the auto-generated example with the real `pre-commit` unit gate (parallel `tsc --noEmit` + `vitest run`) + a D-08 comment marking `/codex:review` and the UI check as manual.
- `docs/phase-0-notes.md` (created) - HRN-03 gate-enforcement record, HRN-04 first-smoke build findings, HRN-02 placeholder, HRN-04 final-build placeholder (Plan 04 hand-offs).
- `.planning/phases/01-scaffold-harness-proof/deferred-items.md` (created) - out-of-scope discoveries (productName=devtools-app naming; untracked-not-ignored `dist/`/`node_modules/`/`.claude/`/`src-tauri/target/`).
- `.git/hooks/pre-commit` (generated by `pnpm lefthook install`; not a tracked repo file).

## Decisions Made
- **Staged-probe proof method:** lefthook v2's `pre-commit` commands evaluate the STAGED file set (an unstaged probe is reported `(skip) no matching staged files`). The probe was therefore `git add`-ed — which faithfully mirrors a real `git commit` — run (blocked, exit 1), then deleted (disk + index) and re-run (clean, exit 0). This proves the gate has teeth with zero worktree contamination and no real bad commit.
- **Bundle naming left as `devtools-app`:** `tauri.conf.json` `productName` is `devtools-app` (identifier `com.boonkhailim.devtools-app`), so the artifacts are `devtools-app.app` / `devtools-app_0.1.0_aarch64.dmg`. The user-facing window title is `DevTools`. Aligning productName to `DevTools` is a cosmetic later-phase change, out of this plan's scope.
- **No `rustup update`:** Rust 1.96.0 (ac68faa20 2026-05-25) (from Plan 01-01) built the release cleanly; the RESEARCH A6 MSRV-surprise contingency was not needed.

## Deviations from Plan

### Auto-fixed Issues

None that altered code/config behavior. Procedural clarifications worth recording:

**1. [Process clarification] Probe had to be STAGED for the gate to evaluate it**
- **Found during:** Task 1 (first `pnpm lefthook run pre-commit` with an unstaged probe)
- **Observation:** lefthook v2.1.9 reported `typecheck (skip) no matching staged files` / `test (skip)` when the probe was only on disk. The plan said to run the gate against a temp file but did not specify staging.
- **Resolution:** `git add src/__lefthook_probe__.ts`, then `pnpm lefthook run pre-commit` → blocked (exit 1, TS2322). Deleted the probe and re-ran → exit 0. Mirrors a real commit; keeps the proof non-destructive. No code change; not a bug.

**2. [Doc correction via commit --amend] Task 2 notes initially carried pre-build estimates**
- **Found during:** Task 2 (the first phase-0-notes draft + commit `7634741` was made with placeholder artifact names/sizes/duration before the background build's true output was confirmed).
- **Issue:** The draft assumed `devtools.app` @ 12M / `.dmg` 5.1M / ~4m51s and wrongly flagged a `bundle.icon` nesting bug. The actual build produced `devtools-app.app` @ 9.7M / `.dmg` 4.1M / ~69s (warm cache), and the icon key is correctly nested.
- **Fix:** Corrected `docs/phase-0-notes.md` (and `deferred-items.md`) with verified values and `git commit --amend`-ed the Task 2 docs commit. The gate re-ran green on the amend.
- **Files modified:** `docs/phase-0-notes.md`, `.planning/.../deferred-items.md`
- **Verification:** values cross-checked against `du -sh`, `codesign -dv`, the build log, and `strings`/`grep` for webdriver absence.

**3. [Rule scope boundary] Out-of-scope discoveries logged, not fixed**
- `dist/`/`node_modules/`/`.claude/`/`src-tauri/target/` untracked-but-not-gitignored (pre-existing / build output). All outside this plan's lefthook-only/docs-only scope → logged to `deferred-items.md`, never staged, left for a follow-up. No auto-fix attempted (correct per the scope boundary).

---

**Total deviations:** 0 behavior-altering. 1 doc correction (amend) + 2 procedural notes.
**Impact on plan:** None on outcomes — all success criteria met. The Wave-2 zero-`package.json`-overlap invariant (HIGH-2) is intact.

## Issues Encountered
- **Harness output dropped intermittently** (many `Bash`/`Read` calls returned empty across the session, especially after the long build). Mitigated by re-issuing reads against on-disk log/marker files; the background build completed cleanly (exit 0) and all commits landed (the pre-commit hook output confirmed each). The amended Task 2 hash is recorded in the final git log rather than re-quoted here due to the dropped output.
- **Updater warning during bundling (benign):** `failed to bundle updater: updater configuration not found` — expected; the auto-updater is Phase 6 (DST-02), not configured yet.

## Known Stubs
None introduced by this plan. (Pre-existing platform `store` stub and `enabled:false` tool placeholders are owned by Plans 01-01/01-02 and unchanged here.)

## Threat Flags
None. This plan adds no new network/auth/file-access surface. It strengthens an existing control (T-01-07: lefthook blocks broken/untyped code) and confirms the smoke build has no WebDriver surface (T-01-08 hand-off to Plan 04 recorded; greps = 0). The unsigned bundle (T-01-09) is the accepted-by-design Phase-1 posture.

## Next Phase Readiness
- **Every commit is now gated** by lefthook (`tsc --noEmit` + `vitest run`) — keep the tree green or commits will be blocked (proven behavior).
- **For Plan 04:** fill the HRN-02 (automation path) + HRN-04 (authoritative final build) placeholders in `docs/phase-0-notes.md`; the final build MUST verify the WebDriver `:4445` surface is absent from the release artifact (T-01-08). Consider gitignoring build/dep dirs (deferred-items.md).
- **Manual gates still pending** per the binding harness: `/codex:review` and real-webview UI verification (`tauri dev`).

## Self-Check: PASSED

- `docs/phase-0-notes.md` — FOUND (verified values: devtools-app.app 9.7M, .dmg 4.1M, ~69s, adhoc)
- `.planning/phases/01-scaffold-harness-proof/deferred-items.md` — FOUND
- `lefthook.yml` (modified) — FOUND, contains `pnpm vitest run` + `tsc --noEmit` + D-08 comment
- `.git/hooks/pre-commit` — FOUND (lefthook-installed)
- Commit `79a7826` (Task 1) — FOUND in git history
- Task 2 docs commit (`7634741`, then amended) — FOUND in git history (amended hash in final log)
- `src/__lefthook_probe__.ts` — ABSENT (correctly removed)
- This plan's tracked diff = `lefthook.yml` + `docs/phase-0-notes.md` only; `package.json`/`pnpm-lock.yaml`/`src` UNCHANGED (HIGH-2 held)

---
*Phase: 01-scaffold-harness-proof*
*Completed: 2026-05-30*
