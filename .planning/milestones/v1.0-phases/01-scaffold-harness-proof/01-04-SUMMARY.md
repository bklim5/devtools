---
phase: 01-scaffold-harness-proof
plan: 04
subsystem: testing
tags: [tauri, webdriver, webdriverio, e2e, wcag, macos, harness, ui-gate]

# Dependency graph
requires:
  - phase: 01-scaffold-harness-proof (plan 01)
    provides: webdriverio + "e2e" script, scaffold, ported lib (19 decoder tests)
  - phase: 01-scaffold-harness-proof (plan 02)
    provides: HashRouter, platform seam, throwaway skeleton with stable data-testids
  - phase: 01-scaffold-harness-proof (plan 03)
    provides: lefthook unit gate, first tauri build smoke
provides:
  - Proven macOS real-WKWebView automation path (tauri-plugin-webdriver, D-01 win)
  - Reproducible UI-gate driver script (scripts/e2e-spike.sh) for Phases 2-6
  - Security-correct webdriver gating (optional dep + double cfg-gate; absent from release)
  - Actually-run gsd-ui-review WCAG-AA audit (docs/phase-1-ui-review.md)
  - Authoritative post-WebDriver final tauri build with WebDriver-absent evidence
affects: [phase-2-shell, all-later-ui-gates, phase-6-distribution]

# Tech tracking
tech-stack:
  added: [tauri-plugin-webdriver 0.2.1 (optional, debug-only feature)]
  patterns:
    - "Per-task UI gate = bash scripts/e2e-spike.sh (tauri dev --features webdriver -> wait :4445 -> wdio -> trap-teardown)"
    - "Debug-only Rust dep = optional dependency + #[cfg(all(debug_assertions, feature = ...))] double gate"

key-files:
  created:
    - docs/phase-1-ui-review.md
  modified:
    - src-tauri/Cargo.toml
    - src-tauri/src/lib.rs
    - scripts/e2e-spike.sh
    - package.json
    - src/tools/_skeleton/index.tsx
    - docs/phase-0-notes.md
    - .gitignore

key-decisions:
  - "D-01 plugin spike WON over the D-02 fallback: the embedded W3C server drives the real WKWebView (find -> sendKeys -> screenshot, 1 passing)"
  - "webdriver gated as an optional Cargo dep behind a 'webdriver' feature, registered under #[cfg(all(debug_assertions, feature=\"webdriver\"))] — NOT [target.'cfg(debug_assertions)'.dependencies] (Cargo rejects that) and NOT feature-only (would leak via --all-features)"
  - "Skeleton muted text bumped text-white/40 -> /60 for WCAG-AA normal-text contrast (audit finding F1)"

patterns-established:
  - "UI-gate driver: scripts/e2e-spike.sh is the reproducible per-task UI verifier for all later phases (D-03)"
  - "Debug-only native surface: optional-dep + double cfg gate keeps remote-control plugins out of release artifacts"

requirements-completed: [HRN-01, HRN-02]

# Metrics
duration: ~45 min (this session; plan spanned multiple sessions)
completed: 2026-05-30
---

# Phase 1 Plan 04: macOS WebView Automation Spike + Full-Gate Proof Summary

**Proved the macOS real-WKWebView automation path end-to-end (tauri-plugin-webdriver drives our app: find -> sendKeys -> screenshot, 1 passing) via a reproducible UI-gate script, ran the WCAG-AA audit, and shipped an authoritative final build with the WebDriver server verified absent from release — after fixing a gating bug that was leaking the server into release builds.**

## Performance

- **Duration:** ~45 min (this finishing session; plan 04 itself spanned several sessions)
- **Completed:** 2026-05-30
- **Tasks:** 2 autonomous (Task 3 is the human-verify checkpoint — NOT yet approved)
- **Files modified:** 7 (1 created)

## Accomplishments

- **D-01 automation path PROVEN.** `bash scripts/e2e-spike.sh` launches `tauri dev --features webdriver`, waits for the embedded W3C server on `127.0.0.1:4445`, runs WebdriverIO against the real macOS WKWebView (finds `skeleton-input`, types `hello`, asserts the instant uppercase/hex transform + 5-byte count, asserts the copy button is displayed, screenshots the webview). Result: **1 passing, exit 0.** Screenshot artifact at `test/e2e/__screenshots__/skeleton-wkwebview.png`.
- **Gate has teeth.** Injecting a hover-only copy regression (`opacity-0 group-hover:opacity-100`) and re-running the spike FAILED (0 passing / 1 failing, exit 1) with the exact message `copy button is not visible — hover-only copy is forbidden`; reverting returned it to 1 passing.
- **gsd-ui-review WCAG-AA audit actually run** → `docs/phase-1-ui-review.md` (6 pillars + computed contrast ratios). One auto-fix actioned (muted text contrast).
- **Authoritative post-WebDriver final build** (`pnpm vitest run && pnpm tsc --noEmit && pnpm tauri build`) all green; the WebDriver server is verified ABSENT from the release artifact three ways.
- **HRN-02 + HRN-04 recorded** in `docs/phase-0-notes.md` as the per-task UI-gate playbook for Phases 2-6.

## Task Commits

1. **Task 1 (webdriver gating fix — feature):** `fb31b85` (fix)
2. **Task 1 (gitignore e2e artifacts + Cargo.lock):** `5c1036e` (chore)
3. **Task 2 (WCAG contrast fix):** `b25063b` (fix)
4. **Task 2 (ui-review audit doc):** `a51468a` (docs)
5. **Task 1/2 (double-gate + tauri:dev:e2e script):** see `git log` (fix)
6. **Task 2 (HRN-02 + HRN-04 notes):** see `git log` (docs)

_(Hashes are listed in `git log --oneline`; the final metadata commit follows this SUMMARY.)_

## Files Created/Modified

- `src-tauri/Cargo.toml` — webdriver made an OPTIONAL dep + `[features] webdriver` (was leaking into release).
- `src-tauri/src/lib.rs` — registration double-gated `#[cfg(all(debug_assertions, feature = "webdriver"))]`.
- `package.json` — added `tauri:dev:e2e` script (`tauri dev --features webdriver`).
- `scripts/e2e-spike.sh` — points at `pnpm tauri:dev:e2e` so `:4445` only binds during the gate.
- `src/tools/_skeleton/index.tsx` — muted `text-white/40` -> `/60` (WCAG-AA contrast).
- `docs/phase-1-ui-review.md` — NEW: the WCAG-AA 6-pillar audit + contrast table + gate-teeth demo.
- `docs/phase-0-notes.md` — HRN-02 (chosen path, reproducible command, security correction) + HRN-04 (authoritative build + absence evidence).
- `.gitignore` — ignore `test/e2e/__screenshots__/` and `test/e2e/__logs__/` (generated artifacts).

## Decisions Made

- **D-01 over D-02:** the plugin spike succeeded, so the cross-platform `tauri-plugin-webdriver` path is the per-task UI-gate driver going forward; the `screencapture` + `chrome-devtools-mcp` fallback is retained only as a documented backstop.
- **Gating idiom:** optional Cargo dependency + a `webdriver` feature, with registration double-gated on `all(debug_assertions, feature = "webdriver")`. This is the only form that is both valid (Cargo rejects `[target.'cfg(debug_assertions)'.dependencies]`) and leak-proof (a feature-only gate leaks via `--all-features`/`--features webdriver` in release).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] WebDriver plugin was shipping in release builds (security hole T-01-10)**
- **Found during:** Task 1 (cargo check)
- **Issue:** The plan/RESEARCH prescribed `[target.'cfg(debug_assertions)'.dependencies]` + `#[cfg(debug_assertions)]`. The committed Cargo.toml actually had the dep in plain `[dependencies]` (shipping in EVERY release). Moving it under `[target.'cfg(debug_assertions)'.dependencies]` produced a Cargo warning — that key is unsupported for dependency selection and the crate still leaked into `cargo tree --release`.
- **Fix:** Made `tauri-plugin-webdriver` an `optional = true` dependency behind a `[features] webdriver` flag; gated registration on `#[cfg(all(debug_assertions, feature = "webdriver"))]`; added the `tauri:dev:e2e` script (`tauri dev --features webdriver`) the spike uses.
- **Files modified:** src-tauri/Cargo.toml, src-tauri/src/lib.rs, package.json, scripts/e2e-spike.sh
- **Verification:** `cargo tree --release | grep -c webdriver` = 0 (default debug tree also 0; only `--features webdriver` includes it); no webdriver strings in the release binary; `:4445` unbound when only the release `.app` runs.
- **Committed in:** fb31b85 + the later double-gate commit

**2. [Rule 1 - Bug] Feature-only gate still leaked via --all-features (codex review)**
- **Found during:** Task 2 (/codex:review)
- **Issue:** `#[cfg(feature = "webdriver")]` alone would compile the W3C server into a release built with `--features webdriver` or `--all-features`.
- **Fix:** Double-gated to `#[cfg(all(debug_assertions, feature = "webdriver"))]`.
- **Verification:** codex review re-read; cargo check clean both ways; authoritative release build re-run with absence re-verified.
- **Committed in:** the double-gate commit

**3. [Rule 2 - Missing Critical] Missing `tauri:dev:e2e` script broke the spike**
- **Found during:** Task 1 (first spike run)
- **Issue:** The feature-gate fix referenced `pnpm tauri:dev:e2e`, but the script was never added to package.json (an earlier edit silently no-op'd), so the first spike failed with "Command tauri:dev:e2e not found" — the dev server never came up.
- **Fix:** Added the `tauri:dev:e2e` script; re-ran the spike to a genuine 1-passing result.
- **Files modified:** package.json
- **Committed in:** the double-gate commit

**4. [Rule 1 - Bug] Skeleton muted text below WCAG-AA normal-text contrast**
- **Found during:** Task 2 (gsd-ui-review WCAG-AA audit)
- **Issue:** `text-white/40` muted spans measured 3.4-3.8:1, below the AA-normal 4.5:1 threshold.
- **Fix:** Bumped 4 text-bearing spans to `text-white/60` (6.49-7.02:1).
- **Files modified:** src/tools/_skeleton/index.tsx
- **Committed in:** b25063b

---

**Total deviations:** 4 auto-fixed (3 bugs, 1 missing-critical). **Impact:** The first two are the whole security point of the plan (T-01-10): the harness as committed was leaking a remote-control server into shipped builds. Fixing it was mandatory, not scope creep. No architectural changes.

## Issues Encountered

- Inline bash output frequently garbled (wdio/lefthook ANSI + cursor control); worked around by extracting decisive facts to temp files and reading them, per project memory.
- The plan's prescribed `[target.'cfg(debug_assertions)'.dependencies]` pattern (from RESEARCH Pattern 3) is simply wrong for Cargo — documented in `docs/phase-0-notes.md` so later phases don't repeat it.

## Next Phase Readiness

- **Awaiting the Task-3 human-verify checkpoint** (NOT self-approved). After approval: phase verification (gsd-verifier) then `phase complete 1`.
- **Before Phase 2 begins:** the throwaway skeleton (`src/tools/_skeleton/`) and its `registry.ts` entry MUST be DELETED (D-05).
- The per-task UI-gate command for all later phases is `bash scripts/e2e-spike.sh` (recorded in docs/phase-0-notes.md, HRN-02).

---
*Phase: 01-scaffold-harness-proof*
*Completed: 2026-05-30 (autonomous tasks; human sign-off pending)*

## Self-Check: PASSED

- Created files verified on disk: docs/phase-1-ui-review.md, 01-04-SUMMARY.md, test/e2e/__screenshots__/skeleton-wkwebview.png
- Task commits verified in git log: fb31b85, 5c1036e, b25063b, a51468a (+ the double-gate and HRN-notes commits)
- NOTE: Task 3 (human-verify checkpoint) is NOT approved — phase is not complete.
