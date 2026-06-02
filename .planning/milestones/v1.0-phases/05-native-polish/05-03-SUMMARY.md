---
phase: 05-native-polish
plan: 03
subsystem: shell
tags: [tauri, global-shortcut, platform-seam, hashrouter, summon, typescript]

# Dependency graph
requires:
  - phase: 05-native-polish (05-02)
    provides: platform.nativeShortcut (register/unregister/isRegistered) + platform.window (show/setFocus/unminimize/minimize/isVisible) behind the seam; setPlatformForTest stub seam; shared noopWindow/noopNativeShortcut test stubs
  - phase: 05-native-polish (05-01)
    provides: Rust global-shortcut + window-state plugins registered, capabilities granted, window visible:false for flash-free geometry restore
  - phase: 02-shell
    provides: resolveStartupTool/getToolById (ENABLED_TOOLS-only validated deep-link path), HashRouter, initPlatform preload in main.tsx
provides:
  - "src/shell/summon.ts — SUMMON_CHORD single-constant chord + registerSummon() that wires the global hotkey through the seam and summons unminimize→show→setFocus"
  - "guarded deepLink(id) helper validated through ENABLED_TOOLS (HashRouter only) — present for a future deep-linking summon, not called by v1"
  - "startup wiring: registerSummon() chained onto initPlatform() in main.tsx (registered once, non-blocking)"
  - "test/e2e/summon.e2e.ts — real-WKWebView proof the app launches non-blank with the new plugins + the HashRouter deep-link path works"
affects: [05-04 phase boundary + human sign-off (OS-level hotkey summon/focus confirmation)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Native shell behavior lives in a single seam-only module (summon.ts) — zero @tauri-apps imports; all OS reach via platform.nativeShortcut/platform.window (FND-04, T-05-04)."
    - "Global-shortcut registration is non-fatal: try/catch + console.warn so a taken chord can never crash startup; the chord is one named constant away from a fix."
    - "OS-global behavior that WebDriver cannot drive (the hotkey itself) is verified at the human sign-off; the e2e gate pins only the webview-observable surface (non-blank launch + HashRouter deep-link)."

key-files:
  created:
    - src/shell/summon.ts
    - src/shell/summon.test.ts
    - test/e2e/summon.e2e.ts
  modified:
    - src/main.tsx

key-decisions:
  - "SUMMON_CHORD = CommandOrControl+Shift+D as a single named constant (D-01) — Cmd on macOS, avoids Spotlight/screenshot chords; change one line to adjust."
  - "Summon handler returns the summon() promise (instead of void summon()) so it is awaitable in unit tests while staying assignable to the seam's () => void signature."
  - "deepLink(id) EXPORTED (not a private helper as the plan worded it) to satisfy tsc noUnusedLocals while keeping the validated path present for a future deep-link (Rule 3 deviation)."

patterns-established:
  - "Seam-only native shell module: summon.ts reaches the OS exclusively via the platform seam, grep-asserted to zero @tauri-apps imports."
  - "registerSummon chains onto the existing initPlatform() preload in main.tsx — single .catch covers both init and summon; runs once, never blocks paint."

requirements-completed: [NAT-01]

# Metrics
duration: 3min
completed: 2026-05-31
---

# Phase 5 Plan 03: Summon Wiring (NAT-01) Summary

**A single seam-only `summon.ts` owns the named `CommandOrControl+Shift+D` chord and a `registerSummon()` that registers the global hotkey via `platform.nativeShortcut` and — on fire — summons the window `unminimize→show→setFocus` (macOS-safe order); wired once into startup, with a real-WKWebView e2e proving the app launches non-blank and the HashRouter deep-link path works.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-31T15:16:34Z
- **Completed:** 2026-05-31T15:19:57Z
- **Tasks:** 2
- **Files modified:** 4 (3 created + main.tsx)

## Accomplishments
- `src/shell/summon.ts`: `SUMMON_CHORD` single-source-of-truth constant (D-01) + `async registerSummon()` that `await initPlatform()` then registers the chord through `platform.nativeShortcut.register`; the handler summons the window in the macOS-safe order `unminimize → show → setFocus` (D-03 / RESEARCH Pitfall 1, issue #12834). Registration failure (chord taken, Pitfall 2 / T-05-07) is caught + `console.warn`'d, NEVER rethrown — startup cannot crash.
- Guarded `deepLink(id)` helper validates any id through `getToolById` (ENABLED_TOOLS only) before touching `window.location.hash` — HashRouter only, never BrowserRouter/path navigation (T-05-08). Not called by the v1 summon; present for a future deep-link to reuse the validated path.
- Zero `@tauri-apps` imports in `summon.ts` (grep-asserted `= 0`) — seam discipline holds (T-05-04).
- `main.tsx` chains `registerSummon()` onto the existing `initPlatform()` preload: registered exactly once, after the real impl is installed, never blocking first paint, inside a single `.catch`.
- `test/e2e/summon.e2e.ts` (real WKWebView): asserts the webview-observable surface the OS-global hotkey cannot — (1) the app launches NON-BLANK to the hero tool despite window-state `visible:false` + the new Rust plugins + the startup summon registration (Pitfall 6 / Assumption A5), and (2) the HashRouter deep-link path works (`#/tools/base64` renders). The OS hotkey itself is confirmed at the 05-04 human sign-off (Manual-Only per VALIDATION).
- 4 new unit tests (chord constant exact, seam register called, summon call-order unminimize→show→setFocus via `mock.invocationCallOrder`, graceful degrade on reject).
- Full gate green: **277/277 vitest** (decoder 19 untouched, +4 new), `tsc --noEmit` clean, `eslint .` 0, `scripts/e2e-spike.sh` → **7 passing on webkit** (exit 0, incl. the new summon spec).

## Task Commits

Each task was committed atomically:

1. **Task 1: summon.ts — chord constant + registerSummon() over the seam (TDD)** — `271c92ba` (feat; RED+GREEN together — lefthook forbids a red tree, no `--no-verify`)
2. **Task 2: wire registerSummon at startup + real-WKWebView e2e** — `75651651` (feat)

_Note: Task 1 is the TDD pair landed in one green commit (the binding lefthook gate blocks committing a failing suite; established Phase 2–5 precedent)._

## Files Created/Modified
- `src/shell/summon.ts` - `SUMMON_CHORD` constant + `registerSummon()` (seam-only) + guarded `deepLink()`; the macOS-safe summon order; non-fatal register failure
- `src/shell/summon.test.ts` - 4 unit tests over the seam via `setPlatformForTest` + vi.fn() spies (chord/seam/order/degrade)
- `src/main.tsx` - chains `registerSummon()` onto `initPlatform()` (once, non-blocking, single `.catch`)
- `test/e2e/summon.e2e.ts` - real-WKWebView spec: non-blank launch to the hero tool + HashRouter deep-link path

## Decisions Made
- **Chord = `CommandOrControl+Shift+D` as one named constant** (D-01): Cmd on macOS, avoids Spotlight `Cmd+Space` + screenshot `Cmd+Shift+3/4`. Single line to change.
- **Summon handler returns `summon()` (not `void summon()`):** keeps the async chain awaitable in the unit test (to assert call order) while a `() => Promise<void>` stays assignable to the seam's `() => void` (the OS caller ignores the return).
- **e2e asserts only the webview-observable surface:** the OS-global chord lives outside the webview and cannot be fired from WebDriver (VALIDATION Manual-Only) — the real summon/focus is the 05-04 human sign-off; the spec instead pins non-blank-launch + the deep-link path.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Exported `deepLink` instead of keeping it a private helper**
- **Found during:** Task 1 (summon.ts implementation)
- **Issue:** The plan worded `deepLink(id)` as a "guarded **private** helper … NOT called by the v1 summon". A truly private, uncalled function trips `tsc` `noUnusedLocals` (TS6133), which the binding lefthook typecheck gate blocks — so the file could not compile/commit. An `eslint-disable` comment does not suppress tsc's own check.
- **Fix:** Changed `deepLink` to an `export function`. It stays fully guarded (validates via `getToolById` against ENABLED_TOOLS, HashRouter-only) and present for a future deep-linking summon; v1's summon still does NOT call it. Exporting is the minimal honest fix that keeps the validated path alive (T-05-08) without faking a usage.
- **Files modified:** src/shell/summon.ts
- **Verification:** `npx tsc --noEmit` clean; `pnpm eslint .` 0; `grep -c '@tauri-apps' src/shell/summon.ts` = 0; 4/4 summon unit tests pass.
- **Committed in:** `271c92ba` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** No behavior change and no scope creep — the validated deep-link path the plan asked to preserve is preserved; only its visibility changed (private → exported) to satisfy the project's binding typecheck gate. All acceptance criteria met as written (chord exact, seam-only, order, graceful degrade, e2e two-route, full gate green).

## Issues Encountered
- The first unit run failed the summon-order assertion because the handler used `void summon()` (fire-and-forget) — awaiting the captured handler didn't flush the inner async chain. Resolved by returning `summon()` from the handler (decision above); the seam signature stays satisfied.

## Threat Model Coverage
- **T-05-07 (DoS — chord-collision silently disables summon):** mitigated. `registerSummon` try/catch logs a non-fatal `console.warn` on register failure; the chord is a single named constant; OS-level collision confirmed at the 05-04 human sign-off.
- **T-05-08 (Tampering/Spoofing — deep-link target on summon):** mitigated. `deepLink` validates any id through `getToolById` (ENABLED_TOOLS only) before setting `window.location.hash`; HashRouter only; v1 summon does not deep-link.
- **T-05-04 (Tampering — stray @tauri-apps import):** mitigated. `grep -c '@tauri-apps' src/shell/summon.ts` = 0; all native reach via the platform seam.
- No new security-relevant surface introduced beyond the plan's threat model.

## Real-WKWebView Verification Note
The OS-GLOBAL summon chord cannot be fired from WebDriver (it is an OS keyboard registration outside the webview — VALIDATION "Manual-Only Verifications"), so the real "hotkey from another app raises + focuses the window" is batched into the Phase-5 packaged-build human sign-off (05-04) alongside the deferred Phase-4 UAT. The e2e gate here proves the webview-observable consequences of the wiring: the app launches non-blank (window-state `visible:false` + the new Rust plugins + the startup summon do not regress startup) and the HashRouter deep-link path the summon would reuse works. `scripts/e2e-spike.sh` → 7 passing on webkit (exit 0).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- **NAT-01 wired end-to-end through the seam:** the global chord registers on startup and the summon flow (unminimize→show→setFocus) is in place; the only remaining NAT-01 confirmation is the OS-level hotkey summon/focus at the 05-04 packaged-build human sign-off.
- Decoder + its 19 tests untouched; no `@tauri-apps` import added outside `tauri.ts`.
- **Next: 05-04** — phase boundary: human sign-off on a fresh `tauri build` + a passing `gsd-ui-review` WCAG-AA audit, confirming D-01..D-04 (chord, regular-dock app, minimize/unminimize summon order, JS-seam handler) and the OS-level summon/single-instance/tray behaviors batched with the deferred Phase-4 UAT.
- No blockers.

## Self-Check: PASSED

- All 4 files (`src/shell/summon.ts`, `src/shell/summon.test.ts`, `src/main.tsx`, `test/e2e/summon.e2e.ts`) exist on disk.
- Both task commits (`271c92ba`, `75651651`) present in git log.
- `SUMMON_CHORD === "CommandOrControl+Shift+D"`, `registerSummon` present, `grep -c '@tauri-apps' src/shell/summon.ts` = 0, `main.tsx` references `registerSummon`.

---
*Phase: 05-native-polish*
*Completed: 2026-05-31*
