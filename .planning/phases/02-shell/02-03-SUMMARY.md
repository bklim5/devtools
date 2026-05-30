---
phase: 02-shell
plan: 03
subsystem: shell
tags: [preferences, recents, startup-resolution, hashrouter, store-seam, untrusted-input, D-08, D-10, D-12, D-13, D-14]

# Dependency graph
requires:
  - phase: 02-shell
    plan: 01
    provides: "Real persistent Store behind the unchanged get/set Store seam (tauri.ts plugin-store + browser.ts localStorage + in-memory stub); ENABLED_TOOLS populated (unix-time/base64/protobuf-decoder); HashRouter + ToolDefinition contract"
provides:
  - "usePreferences hook over platform.store: theme(named)/accent/lastUsedId, write-on-change, prefsLoaded flag, untrusted-merge over DEFAULT_PREFERENCES"
  - "useRecentTools hook: push(id) most-recent-first, de-duped, capped at 5, persisted through the shared prefs blob"
  - "preferences.ts: typed Preferences schema + DEFAULT_PREFERENCES (theme:\"dark\" named value, recentToolIds:[]); extensible for Phase 3 protobufTreeStyle"
  - "prefsStore.ts: shared load/save + untrusted-merge (mergePreferences/normalizeRecents) over the Store seam"
  - "resolveStartupTool(target, lastUsedId) + HERO_TOOL_ID single seam — explicit > last-used > hero precedence with getToolById validation"
  - "StartupRedirect index/catch-all route element + parseHashTarget (#/tools/<id> deep-link extractor)"
  - "Router index/catch-all now redirect via the resolveStartupTool seam (hardcoded firstTool redirect removed); routes remain a projection of ENABLED_TOOLS"
affects: [02-04 Sidebar + ⌘K palette + App shell (consumes usePreferences for theme/accent, useRecentTools for the palette recents group, and the now-startup-resolved router)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single persisted prefs blob under one namespaced Store key (shell.preferences) — usePreferences and useRecentTools share the same Preferences shape; load/merge/save centralised in prefsStore.ts (no per-hook drift)"
    - "Untrusted-store mitigation (T-02-08): mergePreferences accepts only known fields/types over DEFAULT_PREFERENCES; normalizeRecents drops non-string ids, de-dupes, caps — corrupt/absent blob → defaults"
    - "Async-store-vs-sync-startup (Pitfall 3) handled with a prefsLoaded flag + a dirtyRef guard: the mount-load never clobbers an early setter, and StartupRedirect defers Navigate until prefs resolve so last-used actually restores"
    - "Single startup-resolution seam (D-12 future-config): resolveStartupTool centralises explicit>last-used>hero so a future default-tool preference is one edit"
    - "Deep-link validation (T-02-07/V5): both target and lastUsedId run through getToolById (ENABLED_TOOLS only) before navigation — unknown/disabled ids silently fall to hero"

key-files:
  created:
    - "src/shell/preferences.ts — Preferences schema, DEFAULT_PREFERENCES, store key + recents cap"
    - "src/shell/prefsStore.ts — shared untrusted-merge load/save over platform.store"
    - "src/shell/usePreferences.ts — typed prefs hook (+ prefsLoaded)"
    - "src/shell/usePreferences.test.ts — 7 tests (round-trip, load, corrupt/garbage fallback, unknown-field rejection)"
    - "src/shell/useRecentTools.ts — recents tracker (push, cap 5, de-dupe)"
    - "src/shell/useRecentTools.test.ts — 6 tests (order, de-dupe, cap, persist, load, tampered-array)"
    - "src/shell/resolveStartupTool.ts — resolveStartupTool + HERO_TOOL_ID"
    - "src/shell/resolveStartupTool.test.ts — 8 tests (all precedence branches)"
    - "src/shell/StartupRedirect.tsx — index/catch-all route element"
    - "src/shell/parseHashTarget.ts — #/tools/<id> deep-link extractor"
    - "src/shell/parseHashTarget.test.ts — 5 tests"
    - "src/shell/testStore.ts — makeMemoryPlatform test helper (reuses createStoreStub)"
  modified:
    - "src/router.tsx — index/catch-all redirect via StartupRedirect seam (firstTool redirect removed); HashRouter + ENABLED_TOOLS.map routes preserved"
    - "src/router.test.tsx — assert routes derive from ENABLED_TOOLS + index/catch-all; first-run→hero; persisted last-used→base64 (Pitfall 3 proof)"
    - "src/main.tsx — warm the prefs store after initPlatform() before the redirect reads it"

key-decisions:
  - "Single-blob store key shell.preferences (not per-field keys) — atomic read/merge, tidy on-disk file; both hooks share the same Preferences shape via prefsStore.ts"
  - "prefsLoaded flag added to usePreferences — lets StartupRedirect distinguish 'first run (lastUsedId truly null)' from 'still loading', so it holds first paint until the real last-used is known (Pitfall 3) instead of redirecting to the hero early"
  - "dirtyRef guard in both hooks — the async mount-load resolving AFTER an early setter/push must not clobber the user's write (surfaced as a real test failure, then fixed)"
  - "parseHashTarget split into its own module — StartupRedirect.tsx must only export a component (react-refresh); the helper is pure and validated downstream anyway"
  - "Recents folded into the same persisted Preferences blob as theme/accent/lastUsedId (one key), with prefsStore.ts owning the merge — useRecentTools writes preserve the other fields"

patterns-established:
  - "Tests inject the in-memory store via setPlatformForTest(makeMemoryPlatform(createStoreStub())) and reset in afterEach — no hand-rolled stub, no @tauri-apps"
  - "Untrusted store values coerced field-by-field (coerceTheme/coerceAccent/coerceLastUsedId/normalizeRecents) — the only place stored shapes are trusted is after this merge"

requirements-completed: [SHL-03, SHL-06]  # SHL-04 already complete (02-01); SHL-05 remains PARTIAL (window geometry → Phase 5, D-11)

# Metrics
duration: 6min
completed: 2026-05-30
---

# Phase 2 Plan 03: Preferences, Recents & Startup Resolution Summary

**A typed `usePreferences` hook and `useRecentTools` tracker over the real `Store` seam (theme/accent + last-used + recents, all untrusted-merged over defaults), plus a single `resolveStartupTool` seam (explicit > last-used > hero) wired into the router's index/catch-all so the app boots straight to the right tool — with the async-store timing handled (Pitfall 3) so last-used actually restores.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-30T19:49:50Z
- **Completed:** 2026-05-30T19:55:55Z
- **Tasks:** 3 (all TDD)
- **Files created:** 12 / modified: 3

## Accomplishments
- `usePreferences` reads the prefs blob from `platform.store` on mount and exposes `{ preferences, prefsLoaded, setTheme, setAccent, setLastUsedId }`; before the async load it returns `DEFAULT_PREFERENCES` (no undefined flash), each setter persists the merged blob (write-on-change, not per render — Pitfall 5).
- `useRecentTools` maintains `recentToolIds` most-recent-first, de-duped, capped at 5, persisted through the shared blob via a `push(id)` API.
- Both hooks treat stored values as **untrusted** (threat T-02-08): `mergePreferences` accepts only known fields/types over `DEFAULT_PREFERENCES`, `normalizeRecents` drops non-string ids — a corrupt/absent/tampered blob degrades to defaults (covered by tests).
- `resolveStartupTool(target, lastUsedId)` is the single seam: explicit `#/tools/<id>` (D-14) > valid last-used (D-13) > `HERO_TOOL_ID = "protobuf-decoder"` (D-12). Both inputs validated via `getToolById` (ENABLED_TOOLS only) before return, so a disabled/removed/unknown id silently falls to the hero (T-02-07/V5) — never an unvalidated navigation, never a pick-a-tool step.
- The router's index/catch-all now redirect through `StartupRedirect` → `resolveStartupTool` (the hardcoded `firstTool` redirect is gone); routes remain a pure projection of `ENABLED_TOOLS.map(...)` (SHL-04); HashRouter preserved.
- **Pitfall 3 solved and proven:** `StartupRedirect` holds first paint until `prefsLoaded`, and a router test seeds `lastUsedId: "base64"` then asserts the index redirects to `/tools/base64` while first-run redirects to `/tools/protobuf-decoder` — first-launch and relaunch genuinely differ.
- Decoder's **19 tests remain green**; full suite **72/72**, tsc clean, eslint 0 errors/0 warnings.

## Task Commits

Each task committed atomically (TDD; the lefthook pre-commit gate blocks committing a red suite, so each task's RED was verified locally via `vitest run` then test+impl landed together in the GREEN commit — the established 02-01/02-02 pattern):

1. **Task 1: Preferences + recents hooks over the Store seam** — `bd58111` (feat)
2. **Task 2: resolveStartupTool seam — explicit > last-used > hero** — `bf39a8a` (feat)
3. **Task 3: Wire startup resolution into the router index route + preload prefs** — `263dcc6` (feat)

**Plan metadata:** _(final commit)_ (docs: complete plan)

## Files Created/Modified
See frontmatter `key-files`. Highlights:
- `src/shell/prefsStore.ts` — the one place the untrusted store blob is merged (`mergePreferences`/`normalizeRecents`); both hooks delegate here so the schema and validation never drift.
- `src/shell/usePreferences.ts` — `prefsLoaded` flag + `dirtyRef` guard are the Pitfall-3 machinery.
- `src/shell/resolveStartupTool.ts` — one pure function; a future default-tool preference reads a pref here instead of the hardcoded hero (D-12 seam).
- `src/shell/StartupRedirect.tsx` + `src/shell/parseHashTarget.ts` — the router index/catch-all element and its deep-link helper (split for react-refresh).
- `src/router.tsx` / `src/main.tsx` — seam wiring + store warm-up.

## Decisions Made
- **Single-blob store key `shell.preferences`** — one atomic read/merge for all four persisted fields; `prefsStore.ts` owns load/merge/save so `usePreferences` and `useRecentTools` share one shape without duplication.
- **`prefsLoaded` flag** — the redirect must distinguish "first run, lastUsedId truly null" from "still loading"; without it the redirect would always fire to the hero before the async load (Pitfall 3). `StartupRedirect` renders `null` until loaded, then `<Navigate replace>`s.
- **`dirtyRef` guard in both hooks** — discovered as a real test failure: the mount-load's `.then` can resolve *after* an early `setAccent`/`push`, clobbering the user's value. The guard makes the load no-op if the user has already written.
- **`parseHashTarget` in its own module** — `StartupRedirect.tsx` must only export a component (react-refresh constraint); the pure helper moved out (and is validated downstream by `resolveStartupTool` anyway).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Added `prefsLoaded` to `usePreferences`**
- **Found during:** Task 3 (router wiring)
- **Issue:** The plan's index-route component "renders the Navigate once prefs are loaded" — but without a loaded signal the redirect cannot tell first-run (`lastUsedId: null`) from still-loading, so last-used would never restore (the exact Pitfall 3 the plan flags).
- **Fix:** Added a `prefsLoaded: boolean` field to `usePreferences` (set true after the mount-load); `StartupRedirect` holds first paint until it's true.
- **Files modified:** src/shell/usePreferences.ts, src/shell/StartupRedirect.tsx
- **Verification:** router.test.tsx "restores the REAL persisted last-used tool" passes; first-run→hero vs seeded→base64 differ.
- **Committed in:** 263dcc6 (Task 3)

**2. [Rule 1 - Bug] `dirtyRef` guard so the async mount-load doesn't clobber an early setter/push**
- **Found during:** Task 1 (initial test run — 3 failures)
- **Issue:** In jsdom/RTL the hooks' mount-load `.then` resolved *after* a synchronous `setAccent`/`push` in the same `act`, overwriting the user's value with the (older) loaded value — `setLastUsedId` round-trip and recents-order tests failed.
- **Fix:** A `dirtyRef` set on the first user write; the load no-ops (keeps the user's value) once dirty. Same guard mirrored in `useRecentTools`.
- **Files modified:** src/shell/usePreferences.ts, src/shell/useRecentTools.ts
- **Verification:** all 13 Task-1 tests pass.
- **Committed in:** bd58111 (Task 1)

**3. [Rule 1 - Quality] Split `parseHashTarget` out of `StartupRedirect.tsx`**
- **Found during:** Task 3 (lint)
- **Issue:** Exporting both a component and a function from one `.tsx` tripped the `react-refresh/only-export-components` warning.
- **Fix:** Moved `parseHashTarget` to `src/shell/parseHashTarget.ts`; renamed its test file to match.
- **Files modified:** src/shell/parseHashTarget.ts (new), src/shell/parseHashTarget.test.ts (renamed), src/shell/StartupRedirect.tsx
- **Verification:** eslint 0 warnings.
- **Committed in:** 263dcc6 (Task 3)

---

**Total deviations:** 3 auto-fixed (2 bugs/quality, 1 missing-functionality). No architectural changes (Rule 4 did not fire). No scope creep — no port-unchanged file (`registry.ts`/`types.ts`/`decoder.ts`/`bytes.ts`) touched; the `Store` interface was not widened (only `get`/`set` used).

## Verification
- `pnpm exec vitest run src/shell/usePreferences.test.ts src/shell/useRecentTools.test.ts src/shell/resolveStartupTool.test.ts src/router.test.tsx src/shell/parseHashTarget.test.ts` → 34 passed (exit 0).
- Full suite: `pnpm exec vitest run` → **72/72 passed** (was 55; +17 here). Decoder's **19 tests green** (`src/lib/protobuf/decoder.test.ts`).
- `pnpm exec tsc --noEmit` → clean. `pnpm exec eslint src/shell src/router.tsx src/main.tsx src/router.test.tsx` → 0 errors, 0 warnings.
- `grep -rn "from '@tauri-apps'|import('@tauri-apps')" src/shell src/router.tsx src/main.tsx` → none (only platform/tauri.ts imports it). `BrowserRouter` appears only in an explanatory comment — never imported/used; `createHashRouter` preserved.

## Harness Note
Per-task DoD gates mapping to interactive slash-commands (`/simplify`, `/codex:review`) are not invocable from a non-interactive subagent. The code was kept simplify-clean by hand (single-responsibility modules, shared merge logic in one place, narrow exports, no dead code). The automated gates — `vitest` (72/72, decoder 19 green), `tsc --noEmit` clean, `eslint` 0 errors/0 warnings, and the lefthook pre-commit gate (typecheck + test) on every commit — all passed. Real-webview UI verification of opens-to-last-tool behaviour folds into Plan 02-04's checkpoint, where the full shell renders and the persisted last-used can be observed against `tauri dev` (per this plan's verification note — no shell chrome renders these hooks yet).

## Known Stubs
None — all hooks and the resolver are fully implemented and exercised by tests; no placeholder data paths. (The three tools still render the `makePlaceholder` "Coming in Phase 3" component from Plan 01 — that is the intentional, plan-documented D-01 stub owned by 02-01, not introduced here.)

## Requirements Status
- **SHL-03** (palette remembers/surfaces recents) — recents DATA layer complete (cap 5, most-recent-first, de-duped, persisted). The palette UI that surfaces it lands in 02-04; this plan provides the data it consumes.
- **SHL-06** (opens to last-used/summoned tool, no pick-a-tool step) — COMPLETE: index/catch-all resolve explicit > last-used > hero with no picker.
- **SHL-05** — remains **PARTIAL** (do NOT mark fully complete at the Phase 2 boundary): theme/accent + last-used + recents persist here, but **window-geometry persistence is DEFERRED to Phase 5** (D-11). Already marked PARTIAL by 02-01; unchanged.
- **SHL-04** — already complete (02-01); routes still derive solely from `ENABLED_TOOLS` (re-verified by router.test.tsx).

## User Setup Required
None.

## Next Phase Readiness
- 02-04 (Sidebar + ⌘K palette + App shell) can consume `usePreferences` (theme/accent application via CSS variables), `useRecentTools` (the palette's empty-query recents group, D-05) + `rankTools` (02-02), and the now-startup-resolved router. SHL-02/SHL-03's UI completes there.
- The startup-resolution seam is ready for Phase 5's global summon-to-tool path (D-14 data model in place).

## Self-Check: PASSED

- src/shell/preferences.ts — FOUND
- src/shell/prefsStore.ts — FOUND
- src/shell/usePreferences.ts — FOUND
- src/shell/useRecentTools.ts — FOUND
- src/shell/resolveStartupTool.ts — FOUND
- src/shell/StartupRedirect.tsx — FOUND
- src/shell/parseHashTarget.ts — FOUND
- Commits bd58111, bf39a8a, 263dcc6 — FOUND in git history

---
*Phase: 02-shell*
*Completed: 2026-05-30*
