---
phase: 06-distribution
plan: 04
subsystem: updater-ux + platform-seam
tags: [updater, banner, opt-in, platform-seam, tray-event, wcag-aa, tdd, distribution]

# Dependency graph
requires:
  - phase: 06-02
    provides: "platform.updater seam (check/downloadAndInstall) + autoUpdateCheck pref + noopUpdater stub"
  - phase: 06-03
    provides: "tray 'Check for Updates…' item emitting menu://check-updates; updater+process Rust plugins registered"
provides:
  - "src/shell/update.ts — seam-only check→install orchestration (error-as-value checkForUpdate, propagating installUpdate, shouldAutoCheck/needsOptInPrompt predicates)"
  - "src/components/UpdateBanner.tsx — controlled, layout-agnostic, WCAG-AA dismissible banner (D-11c/D-13)"
  - "usePreferences.setAutoUpdateCheck setter (D-09 opt-in persistence)"
  - "platform.events.onMenuCheckUpdates seam accessor (listen lives ONLY in tauri.ts, D-12) + noopEvents stub"
  - "App.tsx updater UX: first-run opt-in prompt + launch silent-check (opted-in only) + manual tray-check + banner mount + install/error/up-to-date states"
  - "test/e2e/update.e2e.ts — real-WKWebView non-blank-launch + keyboard-dismissible banner gate"
affects: [06-05, distribution, release, updater-round-trip]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Updater orchestration mirrors decodeInput error discipline: checkForUpdate returns a typed error VALUE (never throws, T-06-13); installUpdate is the one path allowed to propagate (verify-before-apply surfaces signature mismatch, T-06-12)"
    - "Tray-event→JS via the seam: platform.events.onMenuCheckUpdates wraps @tauri-apps/api/event listen in tauri.ts ONLY; App.tsx subscribes through platform.events, never imports a native package (D-12)"
    - "Launch auto-check co-located in App's mount effect (gated prefsLoaded + shouldAutoCheck), microtask-dispatched (Promise.resolve().then) to satisfy the React Compiler set-state-in-effect lint and never block first paint"
    - "Controlled banner: parent owns visibility (re-mounts with new info on each detection, D-11c); component keeps NO internal 'dismissed forever' state"
    - "Dev-only e2e injector (import.meta.env.DEV-gated window.__injectUpdate) renders the banner deterministically for the WKWebView gate; stripped from production bundles"

key-files:
  created:
    - "src/shell/update.ts"
    - "src/shell/update.test.ts"
    - "src/components/UpdateBanner.tsx"
    - "src/components/UpdateBanner.test.tsx"
    - "test/e2e/update.e2e.ts"
  modified:
    - "src/App.tsx"
    - "src/main.tsx"
    - "src/shell/usePreferences.ts"
    - "src/shell/usePreferences.test.ts"
    - "src/lib/platform/index.ts"
    - "src/lib/platform/tauri.ts"
    - "src/lib/platform/browser.ts"
    - "src/lib/platform/platform.test.ts"
    - "src/shell/testStore.ts"
    - "src/router.test.tsx"
    - "src/tools/base64/Base64Tool.test.tsx"
    - "src/tools/hash/HashTool.test.tsx"
    - "src/tools/jwt/JwtTool.test.tsx"
    - "src/tools/protobuf-decoder/ProtobufDecoder.test.tsx"
    - "src/tools/unix-time/UnixTimeTool.test.tsx"
    - "src/tools/uuid-ulid/UuidUlidTool.test.tsx"

key-decisions:
  - "Launch auto-check lives in App.tsx's mount effect (not main.tsx) — co-locates with the banner/opt-in state it drives and avoids a cross-module event just for launch; main.tsx keeps its single .catch warm-up and documents the slot."
  - "Added a platform.events.onMenuCheckUpdates seam accessor (rather than letting update.ts own the listen) so the @tauri-apps/api/event `listen` stays in tauri.ts ONLY (D-12) and App.tsx is seam-pure."
  - "UpdateBanner's ✕ button gets an explicit Enter/Space onKeyDown handler in addition to the native button activation — the embedded WKWebView WebDriver does not synthesize implicit button activation from a synthetic keypress, so this makes the keyboard-dismiss e2e deterministic while staying correct/harmless for real users."

patterns-established:
  - "Seam-pure shell modules (update.ts) + seam-pure shell components (App.tsx) reach native surfaces ONLY through src/lib/platform — grep-audited free of native-package imports."
  - "Capability seam widening (events) follows the verified 05-02/06-02 idiom: interface + getter in index.ts, real impl in tauri.ts, no-op in browser.ts, shared noop* stub in testStore.ts, propagate to every inline Platform literal."

requirements-completed: [DST-02]

# Metrics
duration: ~12min
completed: 2026-06-01
---

# Phase 6 Plan 04: Updater UX Over the Seam Summary

**Shipped DST-02's user-facing flow — first-run opt-in (persisted), silent launch check ONLY when opted in, always-available manual tray-check via `menu://check-updates`, and a re-appearing dismissible WCAG-AA `UpdateBanner` whose Install verifies-then-relaunches — all routed through `src/lib/platform` (no `@tauri-apps` in the shell). Orchestration (`update.ts`) is error-as-value (never crashes the shell); install is the one path that propagates so a forged update surfaces an error instead of silently installing.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-01T22:05:00Z
- **Completed:** 2026-06-01T22:18:00Z
- **Tasks:** 3 (2 TDD)
- **Files changed:** 21 (5 created, 16 modified)

## Accomplishments

- **Orchestration state machine (`update.ts`)** — seam-only `checkForUpdate()` (returns `{update|current|error}`, never throws past the boundary, T-06-13), `installUpdate()` (lets a signature-mismatch propagate for verify-before-apply, T-06-12), and the `shouldAutoCheck`/`needsOptInPrompt` opt-in predicates (D-09). Zero native-package import (grep-clean, D-12).
- **`autoUpdateCheck` setter** — `usePreferences.setAutoUpdateCheck` mirrors `setTreeStyle`, persisting the opt-in true/false through the prefs seam (round-trip tested).
- **Dismissible WCAG-AA banner (`UpdateBanner.tsx`, D-13)** — controlled, layout-agnostic (no fixed widths, UX-05); `v{version} available` + notes; Install + Later + ✕ dismiss, every control a keyboard-reachable `<button>` with `focus-visible:ring-accent`; installing state via `aria-disabled` + label/progress (not opacity-only); re-appears on each detection (parent owns visibility, D-11c).
- **Tray-event seam** — `platform.events.onMenuCheckUpdates` wraps `@tauri-apps/api/event` `listen("menu://check-updates")` in `tauri.ts` ONLY; browser no-op; shared `noopEvents` stub.
- **Shell wiring (`App.tsx`)** — first-run opt-in prompt (renders when `autoUpdateCheck === null`), launch silent-check (mount effect gated on `prefsLoaded` + `shouldAutoCheck` — NO network call when false/null, T-06-11), manual tray-check listener, banner mount, and install/error/“up to date” transient states.
- **Real-WKWebView e2e** — `test/e2e/update.e2e.ts` asserts non-blank launch with the updater plugins + a keyboard-dismissible banner; `scripts/e2e-spike.sh` → **8 passing on webkit** (exit 0).

## Task Commits

Each task was committed atomically:

1. **Task 1: Update orchestration state machine + autoUpdateCheck setter** - `344f90d1` (feat, TDD)
2. **Task 2: Dismissible WCAG-AA UpdateBanner component** - `7300aded` (feat, TDD)
3. **Task 3: Wire launch opt-in + silent check + manual tray-check + banner mount + e2e** - `bf38c73e` (feat)

_TDD RED→GREEN landed together per task — the lefthook pre-commit gate (tsc + vitest) forbids committing a red tree and `--no-verify` is disallowed in sequential mode._

## Files Created/Modified

- `src/shell/update.ts` (NEW) — seam-only orchestration: checkForUpdate / installUpdate / shouldAutoCheck / needsOptInPrompt
- `src/shell/update.test.ts` (NEW) — update/current/error checks, install + progress + propagation, opt-in branches incl. false/null make NO seam call
- `src/components/UpdateBanner.tsx` (NEW) — controlled WCAG-AA banner; explicit Enter/Space dismiss handler
- `src/components/UpdateBanner.test.tsx` (NEW) — render / install / dismiss / keyboard-dismiss / focus-ring / non-opacity-disabled / controlled
- `test/e2e/update.e2e.ts` (NEW) — real-WKWebView non-blank launch + keyboard-dismissible banner
- `src/App.tsx` — updater UX overlay (opt-in prompt, banner, manual listener, launch check, status toast); dev-only `__injectUpdate` e2e hook
- `src/main.tsx` — documents the updater launch-check now occupying the post-init slot
- `src/shell/usePreferences.ts` / `.test.ts` — setAutoUpdateCheck setter + tests
- `src/lib/platform/index.ts` — `events` capability on Platform + getter accessor
- `src/lib/platform/tauri.ts` — `events.onMenuCheckUpdates` via `listen` (the only new native import)
- `src/lib/platform/browser.ts` — `events` no-op
- `src/lib/platform/platform.test.ts` + `src/shell/testStore.ts` — `noopEvents` + stub widening
- `src/router.test.tsx` + 6 tool tests — `events: noopEvents` added to each inline Platform literal

## Decisions Made

- **Launch auto-check in App.tsx (not main.tsx)** — co-locates with the banner/opt-in state and avoids a cross-module event just for launch (the plan offered this as the cleaner option). main.tsx keeps the single `.catch` warm-up; its comment now describes the slot.
- **`platform.events.onMenuCheckUpdates` seam accessor** — keeps `@tauri-apps/api/event` `listen` in `tauri.ts` ONLY (D-12), so App.tsx subscribes seam-pure.
- **Explicit Enter/Space onKeyDown on the ✕ button** — the embedded WKWebView WebDriver does not synthesize a button's implicit activation from a synthetic keypress, so the keyboard-dismiss e2e was non-deterministic with native activation alone; the explicit handler makes it deterministic and is correct/harmless for real users.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Microtask-dispatched the launch check to satisfy the set-state-in-effect lint**
- **Found during:** Task 3 (App.tsx launch-check effect)
- **Issue:** Calling `runCheck(false)` directly in the mount effect tripped the React Compiler `react-hooks/set-state-in-effect` lint (the analyzer traces runCheck → setState), which the binding lefthook lint gate blocks.
- **Fix:** Dispatched the check on a microtask (`void Promise.resolve().then(() => runCheck(false))`) so its setState never runs synchronously in the effect body — also reinforcing "first paint never blocked". The manual-listener effect was already lint-clean (its setState is inside the listen callback).
- **Files modified:** src/App.tsx
- **Verification:** `pnpm lint` exits 0.
- **Committed in:** `bf38c73e` (Task 3 commit)

**2. [Rule 3 - Blocking] Added an explicit Enter/Space dismiss handler to UpdateBanner for the WKWebView gate**
- **Found during:** Task 3 (update.e2e.ts keyboard-dismiss assertion)
- **Issue:** The first e2e run injected + rendered the banner correctly, the dismiss button accepted focus (keyboard-reachable proven), but neither `browser.keys("Enter")` nor Space removed it — the embedded WKWebView WebDriver does not synthesize the native button's implicit click-on-keypress activation.
- **Fix:** Added an `onKeyDown` handler firing `onDismiss` on Enter/Space to the ✕ button (in addition to the native activation). Added an RTL test for the keyboard-dismiss path. Real users keep native behavior; the e2e becomes deterministic.
- **Files modified:** src/components/UpdateBanner.tsx, src/components/UpdateBanner.test.tsx, test/e2e/update.e2e.ts
- **Verification:** `scripts/e2e-spike.sh` → 8 passing on webkit (exit 0); UpdateBanner.test.tsx 7/7.
- **Committed in:** `bf38c73e` (Task 3 commit)

**3. [Rule 2 - Missing Critical] Widened all inline Platform literals for the `events` capability**
- **Found during:** Task 3 (tsc gate after adding `events` to the Platform interface)
- **Issue:** The interface widening makes `tsc` require `events` on EVERY inline `Platform` literal (platform.test.ts ×3, router.test + 6 tool tests) — the documented 05-02/06-02 lesson.
- **Fix:** Exported `noopEvents` from `testStore.ts` (single source of truth), spread it through `makeMemoryPlatform`, and added `events: noopEvents` / a `vi.fn()` events stub to each inline literal — DRY, no production behavior changed.
- **Files modified:** the 9 test files listed in key-files.
- **Verification:** `pnpm exec tsc --noEmit` exits 0; full suite 303/303.
- **Committed in:** `bf38c73e` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 missing-critical). All necessary to clear the binding lint/tsc/e2e gates; no scope creep — every change is a correctness/gate requirement anticipated by the plan's `<interfaces>` callouts.
**Impact on plan:** None — the planned tasks shipped exactly; the deviations are gate-clearing mechanics.

## Issues Encountered

- **E2E orphan-process / port contention (env-only, non-code):** a leftover debug `devtools-app` held the single-instance lock and a stray vite held :1420, failing the first `tauri dev` launches ("Port 1420 already in use"). Killed the orphans + freed :1420/:4445 and re-ran clean (the documented DMG/orphan flake class — Tauri-dev lifecycle, not this plan's code).

## Known Stubs

None that block DST-02. The `browser.ts` updater + events are *intentional* no-ops (offline-by-design fallback, D-12) — the contract, not placeholders. The dev-only `window.__injectUpdate` hook is `import.meta.env.DEV`-gated and stripped from production; it exists solely so the WKWebView gate can render the banner deterministically (the real download/verify/relaunch round-trip is Manual-Only, Plan 05).

## Threat Flags

None beyond the plan's registered `<threat_model>`. The one new surface — `platform.events.onMenuCheckUpdates` (tray IPC → JS) — is exactly the registered tray-IPC boundary; the listen lives behind the seam in tauri.ts (T-06-14), the event only triggers a user-initiated check, and offline-by-design holds (launch check fires only when `shouldAutoCheck` is true, T-06-11).

## User Setup Required

None — no external service configuration in this plan. (Signed updater builds + the real round-trip are Plan 05 / RELEASE.md per 06-03's User Setup.)

## Next Phase Readiness

- **Plan 05 (RELEASE.md + phase-boundary sign-off + real updater round-trip):** the updater UX is complete and seam-pure. The Manual-Only items for the human sign-off: the real download → minisign verify → relaunch round-trip, plus the passwordless-key follow-up and the `bklim5/devtools` public-repo + `latest.json` confirmation from 06-03.
- **No blockers.** Full suite 303/303 (decoder 19 untouched), tsc clean, eslint 0, e2e 8/8 on webkit; seam grep-audit clean (no `@tauri-apps` outside tauri.ts/index.ts).

## Self-Check: PASSED

All 5 created files exist on disk; all three task commits (`344f90d1`, `7300aded`, `bf38c73e`) are in git history. Full suite 303/303, decoder 19/19, tsc + eslint clean, e2e 8/8 on webkit, seam audit clean.

---
*Phase: 06-distribution*
*Completed: 2026-06-01*
