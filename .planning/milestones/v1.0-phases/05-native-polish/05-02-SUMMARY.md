---
phase: 05-native-polish
plan: 02
subsystem: infra
tags: [tauri, platform-seam, global-shortcut, window-control, typescript]

# Dependency graph
requires:
  - phase: 01-scaffold-harness-proof
    provides: src/lib/platform/ env-safe capability seam (clipboard/store), tauri.ts as sole @tauri-apps importer, setPlatformForTest test seam
  - phase: 05-native-polish (05-01)
    provides: Rust-side native foundation — global-shortcut + window-state plugins registered, capabilities granted (global-shortcut:allow-register/unregister/is-registered), summon order unminimize→show→set_focus
provides:
  - "platform.window — JS-reachable window summon/focus control (show/setFocus/unminimize/minimize/isVisible)"
  - "platform.nativeShortcut — OS-level global hotkey register/unregister/isRegistered behind the seam"
  - "browser/jsdom no-op fallback for both caps (never throws under vite preview / tests)"
  - "shared noopWindow/noopNativeShortcut test stubs in src/shell/testStore.ts"
affects: [05-03 shell wiring (register summon chord on startup), 05-04 phase boundary]

# Tech tracking
tech-stack:
  added: ["@tauri-apps/plugin-global-shortcut@2.3.2 (JS binding)"]
  patterns:
    - "Every JS-reachable native capability extends the seam identically: interface field (index.ts) → real impl (tauri.ts) → no-op (browser.ts) → accessor getter (index.ts). Getters mean adding a cap flows through automatically."
    - "global-shortcut handler filtered on e.state === 'Pressed' so it fires once per chord, not on key-up."

key-files:
  created: []
  modified:
    - src/lib/platform/index.ts
    - src/lib/platform/tauri.ts
    - src/lib/platform/browser.ts
    - src/lib/platform/platform.test.ts
    - src/shell/testStore.ts
    - package.json

key-decisions:
  - "Reused @tauri-apps/api/window getCurrentWindow for window control (no new dep); only added the global-shortcut JS plugin."
  - "Did NOT add @tauri-apps/plugin-window-state JS — window-state is fully automatic on the Rust side (Plan 01); a JS binding would be dead weight."
  - "register filters on e.state === 'Pressed' (RESEARCH Pitfall 2) so the summon handler fires once per chord."
  - "browser fallback: isVisible→true (no hidden window to summon outside Tauri), isRegistered→false (no OS shortcut ever registered)."

patterns-established:
  - "Per-capability accessor getter on the `platform` const so the interface and active impl can never drift."
  - "Shared no-op native-cap stubs (noopWindow/noopNativeShortcut) in testStore.ts — a single source of truth for widening Platform test literals."

requirements-completed: [NAT-01]

# Metrics
duration: 5min
completed: 2026-05-31
---

# Phase 5 Plan 02: JS Platform Seam (window + nativeShortcut) Summary

**Extended `src/lib/platform/` with `window` (summon/focus) and `nativeShortcut` (OS global hotkey) capabilities — real impls in tauri.ts via @tauri-apps/api/window + plugin-global-shortcut, harmless browser no-ops, 8/8 seam unit tests — so Plan 03's shell can summon/register without ever importing @tauri-apps.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-31T15:08:47Z
- **Completed:** 2026-05-31T15:13:14Z
- **Tasks:** 4
- **Files modified:** 12 (4 seam files + package.json + 7 test files for stub-widening)

## Accomplishments
- `Platform` interface gains `window` (show/setFocus/unminimize/minimize/isVisible) and `nativeShortcut` (register/unregister/isRegistered), each with a per-capability accessor getter delegating to the active impl.
- Real implementations live ONLY in `tauri.ts` (the sole `@tauri-apps/*` importer): window via `getCurrentWindow()`, shortcuts via `@tauri-apps/plugin-global-shortcut` with the handler filtered to `e.state === "Pressed"`.
- `browser.ts` degrades to harmless no-ops (register resolves, `isRegistered`→false, `isVisible`→true) so jsdom tests and `vite preview` never throw.
- `@tauri-apps/plugin-global-shortcut@2.3.2` installed (pinned); no `plugin-window-state` JS dep (Rust-auto).
- Grep audit clean: the only `@tauri-apps` import statements in `src/` are `tauri.ts` (real) + `index.ts` (dynamic `import("./tauri")`); all other matches are comments (T-05-04 holds).
- Gate green: **273/273 vitest** (+4 new seam tests; decoder 19 untouched), `tsc --noEmit` clean, eslint 0.

## Task Commits

1. **Task 1: Install the JS global-shortcut plugin** — `81019eb5` (chore)
2. **Tasks 2-4: Extend interface + tauri impls + browser no-ops + tests** — `e85df138` (feat)

_Note: Tasks 2-4 were committed together at the first green tree point. The interface widening (Task 2) makes `tsc` red until tauri.ts conforms (Task 3) AND every `Platform` test stub is widened (Task 4 + the Rule-3 fan-out below); the project's binding lefthook gate forbids committing a red tree (no `--no-verify`), so the type-coherent change landed as one atomic green commit. Per-task structure is preserved in the commit body._

## Files Created/Modified
- `package.json` - added `@tauri-apps/plugin-global-shortcut@2.3.2`
- `src/lib/platform/index.ts` - `Platform` interface + `get window()`/`get nativeShortcut()` accessor getters
- `src/lib/platform/tauri.ts` - real window control + global-shortcut register (Pressed-filtered); still the sole @tauri-apps importer
- `src/lib/platform/browser.ts` - no-op window + nativeShortcut fallback
- `src/lib/platform/platform.test.ts` - +4 tests (fallback no-ops + accessor delegation), widened the inline stub literal
- `src/shell/testStore.ts` - exported shared `noopWindow`/`noopNativeShortcut`; widened `makeMemoryPlatform`
- `src/router.test.tsx`, `src/tools/{base64,hash,jwt,protobuf-decoder,unix-time,uuid-ulid}/*.test.tsx` - widened inline `Platform` stub literals via the shared no-op caps

## Decisions Made
- Window control reuses the already-present `@tauri-apps/api`; only the global-shortcut JS plugin was added.
- No `@tauri-apps/plugin-window-state` JS binding (window-state is Rust-auto in Plan 01).
- `register` filters on `e.state === "Pressed"` so the summon handler fires once per chord (RESEARCH Pitfall 2).
- Browser no-op semantics: `isVisible`→true (nothing to summon outside Tauri), `isRegistered`→false (nothing registered).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Widened ALL `Platform` test stub literals, not just platform.test.ts**
- **Found during:** Task 2 (interface widening)
- **Issue:** Adding `window`/`nativeShortcut` to the `Platform` interface broke `tsc` on every inline `Platform` stub literal across the suite — `src/router.test.tsx`, `src/shell/testStore.ts`, and six tool tests (base64/hash/jwt/protobuf-decoder/unix-time/uuid-ulid) — not just `platform.test.ts` as the plan's Task 4 anticipated. The binding lefthook gate (tsc + vitest) blocks any red commit.
- **Fix:** Added a single source of truth — `noopWindow`/`noopNativeShortcut` exported from `src/shell/testStore.ts` — and referenced it in every inline literal (rather than hand-rolling the no-op shape 8×, which would re-drift on future cap growth). Also widened `makeMemoryPlatform`.
- **Files modified:** src/shell/testStore.ts, src/router.test.tsx, src/tools/{base64,hash,jwt,protobuf-decoder,unix-time,uuid-ulid}/*.test.tsx
- **Verification:** `npx tsc --noEmit` clean; `pnpm vitest run` 273/273.
- **Committed in:** `e85df138`

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking)
**Impact on plan:** The fan-out was a direct, unavoidable consequence of widening a shared interface; the shared-stub approach keeps it DRY and prevents future drift. No scope creep — no production behavior changed, only test stubs widened to satisfy the widened type.

## Issues Encountered
- The plan's automated grep-audit command (`grep -rln '@tauri-apps' ... | grep -v '//'`) flags files that merely *mention* `@tauri-apps` in comments (e.g. "must NOT import @tauri-apps") because `grep -v "//"` does not strip `*`-prefixed JSDoc lines. Verified substantively with `grep -rn 'from "@tauri-apps"'` — **zero** real import statements outside `tauri.ts` + `index.ts`. Seam discipline (T-05-04) holds.

## Threat Model Coverage
- **T-05-04 (Tampering — stray @tauri-apps import):** mitigated. Grep audit confirms only `tauri.ts` (real) + `index.ts` (dynamic import) reach `@tauri-apps`.
- **T-05-05 (DoS — seam throws outside Tauri):** mitigated. browser.ts no-ops resolve harmlessly; `platform.test.ts` asserts the degrade (register resolves, isRegistered→false, isVisible→true).
- **T-05-06 (Spoofing — spurious key events):** accepted per plan. tauri.ts invokes the handler only on `e.state === "Pressed"`; local OS keyboard, no remote surface.
- No new security-relevant surface introduced beyond the plan's threat model.

## Real-WKWebView Verification Note
This plan ships NO UI surface — it is a pure seam + unit-test change. The seam's fallback behavior is fully covered by `platform.test.ts` (jsdom). The REAL native behaviors (actual global-shortcut registration, window summon/focus) require the Tauri runtime and OS-level events that the WKWebView e2e harness cannot drive; they are exercised by Plan 03's shell wiring and batched into the Phase-5 packaged-build human sign-off (05-04) alongside the deferred Phase-4 UAT.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- NAT-01 seam delivered: Plan 03 can call `platform.nativeShortcut.register(accelerator, handler)` to register the summon chord on startup and `platform.window.unminimize/show/setFocus` for the summon flow — all without importing `@tauri-apps/*`.
- Decoder + its 19 tests untouched; no `@tauri-apps` import added outside `tauri.ts`.
- No blockers.

## Self-Check: PASSED

- All 5 modified seam/test files + SUMMARY.md exist on disk.
- Both task commits (`81019eb5`, `e85df138`) present in git log.
- `get nativeShortcut` accessor present in index.ts; `@tauri-apps/plugin-global-shortcut` import present in tauri.ts.

---
*Phase: 05-native-polish*
*Completed: 2026-05-31*
