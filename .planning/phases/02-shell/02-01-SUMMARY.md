---
phase: 02-shell
plan: 01
subsystem: infra
tags: [tauri-plugin-store, lucide-react, localStorage, platform-seam, tailwind-v4, registry]

# Dependency graph
requires:
  - phase: 01-scaffold-harness-proof
    provides: "platform capability seam (clipboard real, store in-memory stub), tool registry + ToolDefinition, HashRouter, ported decoder (19 tests)"
provides:
  - "Real persistent Store behind the unchanged Store interface — @tauri-apps/plugin-store on disk (prefs.json) in Tauri, localStorage in the browser, in-memory stub fallback"
  - "store:default Tauri capability granted + tauri_plugin_store registered unconditionally in lib.rs"
  - "Three enabled tools (unix-time, base64, protobuf-decoder) rendering a shared placeholder — ENABLED_TOOLS is now populated (was empty)"
  - "makePlaceholder(name) factory for enabled-but-unbuilt tools"
  - "Shell CSS tokens (card/bd/bd-2/tx/tx-2/tx-3/input-bg/accent-soft/accent-line) exposed as Tailwind v4 @theme utilities"
  - "lucide-react@1.17.0 dependency (registry icon field now backed by real icons)"
affects: [02-02 fuzzy ranker, 02-03 prefs/recents/startup-resolution, 02-04 Sidebar + palette + App shell, phase-3 real tool UIs]

# Tech tracking
tech-stack:
  added: ["lucide-react@1.17.0", "@tauri-apps/plugin-store@2.4.3 (JS)", "tauri-plugin-store@2.4.3 (Rust)"]
  patterns:
    - "Real Store impls swapped behind the existing get/set Store interface (no widening) — tauri.ts (plugin-store) + browser.ts (localStorage), stub.ts kept as test/regression seam"
    - "Persisted values treated as untrusted input: corrupt/non-JSON get() degrades to undefined (threat T-02-02)"
    - "Derived design tokens via color-mix (accent-soft/accent-line from --color-accent) so accent changes cascade (D-10)"
    - "Enabled-but-unbuilt tools render a shared makePlaceholder(name) component until their real UI lands (D-01)"

key-files:
  created:
    - "src/tools/_placeholder/ToolPlaceholder.tsx — makePlaceholder factory"
    - "src/lib/platform/store.test.ts — jsdom localStorage Store tests"
  modified:
    - "src/lib/platform/tauri.ts — createTauriStore via plugin-store load('prefs.json')"
    - "src/lib/platform/browser.ts — createLocalStorageStore (JSON, namespaced, untrusted-safe)"
    - "src/lib/platform/stub.ts — comment refresh (kept createStoreStub + Store interface)"
    - "src/index.css — shell @theme tokens"
    - "src/tools/{unix-time,base64,protobuf-decoder}/index.ts — enabled:true + lucide icon + placeholder + real description"
    - "src-tauri/src/lib.rs — register tauri_plugin_store"
    - "src-tauri/capabilities/default.json — store:default grant"
    - "src/router.test.tsx — retire stale empty-registry assertion (Rule 1)"

key-decisions:
  - "load('prefs.json', { defaults: {}, autoSave: true }) — defaults:{} required by plugin-store@2.4.3 StoreOptions (RESEARCH example omitted it); autoSave debounces disk writes"
  - "localStorage keys namespaced under 'devtools:' prefix to avoid origin collisions under vite preview"
  - "lucide icons: Clock (unix-time), Binary (base64), Boxes (protobuf-decoder)"
  - "store.test.ts opts into jsdom via // @vitest-environment jsdom (default env is node, no localStorage)"

patterns-established:
  - "Store seam: only tauri.ts imports @tauri-apps/*; verified by grep returning a single file"
  - "Tool placeholder: makePlaceholder(name) no-prop factory bound to a ComponentType registry field"

requirements-completed: [SHL-04, SHL-05]

# Metrics
duration: 6min
completed: 2026-05-30
---

# Phase 2 Plan 01: Shell Foundation Summary

**Real on-disk preference persistence behind the unchanged `Store` seam (Tauri plugin-store + localStorage fallback), the `store:default` capability wired, shell `@theme` CSS tokens, and the three tools enabled as a shared `makePlaceholder` — unblocking the registry-driven sidebar/palette/router for the rest of Phase 2.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-30T19:35:49Z
- **Completed:** 2026-05-30T19:41:27Z
- **Tasks:** 3
- **Files modified:** 16 (2 created)

## Accomplishments
- `platform.store` is now a real persistent store: `@tauri-apps/plugin-store` writing `prefs.json` on disk in Tauri, `localStorage` (JSON-serialised, `devtools:`-namespaced) in the browser, falling back to the in-memory stub when localStorage is absent — all behind the unchanged `get`/`set` `Store` interface (no widening).
- Persisted values are treated as untrusted: a corrupt/non-JSON entry degrades to `undefined` rather than throwing (threat T-02-02), covered by a test.
- Tauri store plugin registered unconditionally in `lib.rs` (debug + release) and scoped by the single `store:default` capability grant (threat T-02-01) — nothing broader added.
- `ENABLED_TOOLS` is no longer empty: unix-time, base64, and protobuf-decoder are `enabled: true`, each rendering a shared `makePlaceholder(name)` placeholder with a real lucide icon and a real description.
- Shell CSS tokens added to the Tailwind v4 `@theme` block, with `accent-soft`/`accent-line` derived from `--color-accent` via `color-mix` (D-10).
- Decoder's 19 tests remain green; full suite 31/31, tsc clean, lint 0 errors.

## Task Commits

Each task was committed atomically:

1. **Task 1: Install deps, register store plugin, scope capability** - `5d7812d` (chore)
2. **Task 2: Make the Store seam real (TDD)** - `e5c18e8` (feat) — RED was verified locally via `vitest run` before GREEN; the lefthook gate (correctly) blocks committing a red suite, so the failing test landed together with its impl in the GREEN commit.
3. **Task 3: Shell CSS tokens + enable 3 tools as placeholder** - `ae7fb78` (feat)

**Plan metadata:** _(this commit)_ (docs: complete plan)

## Files Created/Modified
- `src/tools/_placeholder/ToolPlaceholder.tsx` (created) - `makePlaceholder(name)` factory; layout-agnostic, h1 19px/600 + quiet "Coming in Phase 3" in `--color-tx-3`.
- `src/lib/platform/store.test.ts` (created) - jsdom localStorage tests: round-trip, unset→undefined, corrupt→undefined, stub regression guard.
- `src/lib/platform/tauri.ts` - `createTauriStore()` via `load('prefs.json', { defaults:{}, autoSave:true })`; only file importing `@tauri-apps/*`.
- `src/lib/platform/browser.ts` - `createLocalStorageStore()` JSON-serialised, `devtools:`-namespaced, corrupt→undefined, in-memory fallback.
- `src/lib/platform/stub.ts` - comment refresh; `Store` interface + `createStoreStub` kept unchanged.
- `src/index.css` - shell `@theme` tokens (card/bd/bd-2/tx/tx-2/tx-3/input-bg/accent-soft/accent-line).
- `src/tools/{unix-time,base64,protobuf-decoder}/index.ts` - `enabled:true`, lucide icons (Clock/Binary/Boxes), `makePlaceholder`, real descriptions.
- `src-tauri/src/lib.rs` - register `tauri_plugin_store::Builder` unconditionally.
- `src-tauri/capabilities/default.json` - add `store:default`.
- `src/router.test.tsx` - retire stale empty-registry assertion; assert populated registry + placeholder render.
- `package.json` / `pnpm-lock.yaml` / `src-tauri/Cargo.toml` / `src-tauri/Cargo.lock` - dependency additions.

## Decisions Made
- **`defaults: {}` in `load()`** — `@tauri-apps/plugin-store@2.4.3`'s `StoreOptions` makes `defaults` required; the RESEARCH code example omitted it (would not compile). Empty map = no seeded keys (unset reads → `undefined`, matching the contract).
- **`devtools:` localStorage namespace** — avoids collisions with anything sharing the origin under `vite preview`.
- **lucide icons** — Clock (unix-time), Binary (base64), Boxes (protobuf-decoder), per Claude's discretion (D-01).
- **store.test.ts uses `// @vitest-environment jsdom`** — the repo default test env is `node` (no `localStorage`); existing tests opt into jsdom per-file the same way.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `StoreOptions.defaults` required by installed plugin-store version**
- **Found during:** Task 2 (Make the Store seam real)
- **Issue:** RESEARCH's `load("prefs.json", { autoSave: true })` example failed tsc — `@tauri-apps/plugin-store@2.4.3` requires `defaults` in `StoreOptions`.
- **Fix:** Pass `{ defaults: {}, autoSave: true }`.
- **Files modified:** src/lib/platform/tauri.ts
- **Verification:** `pnpm exec tsc --noEmit` exits 0.
- **Committed in:** e5c18e8 (Task 2 commit)

**2. [Rule 1 - Bug/Stale] Updated `src/router.test.tsx` after enabling the three tools**
- **Found during:** Task 3 (enable the three tools)
- **Issue:** `router.test.tsx` asserted the Phase-1 interim state `ENABLED_TOOLS.length === 0`. Enabling the tools (the plan's explicit goal) made that assertion fail.
- **Fix:** Retired the empty-registry assertion; now asserts the three tools are enabled and the shared placeholder renders at the first tool's route. `router.tsx` itself was NOT modified (its empty-case guard remains valid).
- **Files modified:** src/router.test.tsx
- **Verification:** `pnpm test` 31/31 pass.
- **Committed in:** ae7fb78 (Task 3 commit)

**3. [Rule 1 - Bug] Fixed `store.test.ts` env + a brittle redirect assertion**
- **Found during:** Task 2 / Task 3
- **Issue:** (a) store.test.ts ran under node where `localStorage` is undefined; (b) a draft router assertion expected `router.navigate()` to reflect a `<Navigate>` render-time redirect synchronously.
- **Fix:** Added `// @vitest-environment jsdom` to store.test.ts; replaced the brittle redirect assertion with a placeholder-render assertion via `findByText`.
- **Files modified:** src/lib/platform/store.test.ts, src/router.test.tsx
- **Verification:** Both files green.
- **Committed in:** e5c18e8, ae7fb78

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 bug/stale-test).
**Impact on plan:** All necessary for correctness/compilation. No scope creep — no port-unchanged file (`registry.ts`/`types.ts`/`decoder.ts`/`bytes.ts`) was touched, and the `Store` interface was not widened.

## Issues Encountered
- The lefthook pre-commit gate (correctly) blocks committing a red test suite, so the TDD RED step could not land as its own commit. RED was instead verified locally via an explicit `pnpm exec vitest run` (3 localStorage tests failed as expected), then the test + impl landed together in the GREEN commit. The gate having teeth is by design (documented in STATE.md).

## Known Stubs
- The three tools render a shared "Coming in Phase 3" placeholder via `makePlaceholder` — this is **intentional** (D-01). Phase 3 swaps each tool's `component` for the real UI. Documented in the plan; not a blocking stub.

## Deferred Items
- One pre-existing eslint warning in `test/e2e/skeleton.e2e.ts:56` (unused eslint-disable) is unrelated to this plan and out of scope. Logged in `.planning/phases/02-shell/deferred-items.md`. Lint reports 0 errors.

## Harness Note
- Per-task DoD gates that map to interactive slash-commands (`/simplify`, `/codex:review`) are not invocable from a non-interactive subagent. The mechanical, minimal nature of these changes (dep install, seam fill-in, token append, flag flips) was kept simplify-clean by hand; the automated gates — `vitest` (31/31, decoder 19 green), `tsc --noEmit` clean, `pnpm lint` 0 errors, and the lefthook pre-commit gate on every commit — all passed. Real-webview UI verification of the placeholders/tokens folds into Plan 04's checkpoint, since no shell chrome renders them yet (per the plan's verification note).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `ENABLED_TOOLS` is populated and the platform `Store` is real — both blockers for the registry-driven shell are removed.
- 02-02 (fuzzy ranker) and 02-03 (prefs/recents/startup-resolution via the Store seam) and 02-04 (Sidebar + ⌘K palette + App shell, consuming the shell tokens) can now proceed.
- SHL-05 is **PARTIAL** by design: theme/accent + last-used + recents persistence are unblocked here; window-geometry persistence remains deferred to Phase 5 (D-11). Do not mark SHL-05 fully complete at the Phase 2 boundary.

## Self-Check: PASSED

All created/modified files verified present on disk; all three task commits (`5d7812d`, `e5c18e8`, `ae7fb78`) verified in git history.

---
*Phase: 02-shell*
*Completed: 2026-05-30*
