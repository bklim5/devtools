---
phase: 01-scaffold-harness-proof
plan: 02
subsystem: ui
tags: [react-router, hashrouter, tauri, clipboard, platform-seam, vitest, jsdom, testing-library, tdd, walking-skeleton]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Tauri+Vite+React+TS scaffold, @/ alias, ported src/lib (19 decoder tests), enabled:false Phase-3 tool stubs, registered clipboard plugin + capability, all npm deps installed"
provides:
  - "Environment-safe src/lib/platform seam (FND-04): runtime __TAURI_INTERNALS__ detection, lazy import('./tauri'), navigator.clipboard browser fallback, setPlatformForTest/createPlatform/initPlatform"
  - "HashRouter wired verbatim from scaffold (FND-02): createHashRouter, index+wildcard Navigate to first tool, no BrowserRouter"
  - "Skeleton registered as first enabled:true tool in registry.ts so ENABLED_TOOLS[0] resolves (Warning-2 fix)"
  - "Runtime router proof (HIGH-3): jsdom router.test.tsx renders RouterProvider, asserts no-throw mount + unknown-route -> /tools/_skeleton redirect"
  - "Throwaway byte-inspector skeleton (HRN-01): instant paste transform, always-visible focusable copy through the seam, status bar, e2e data-testids"
affects: [01-03 (lefthook gate runs tsc+vitest over these tests), 01-04 (wdio e2e drives the skeleton via its data-testids), 02 (registry-driven shell replaces App.tsx, skeleton + entry removed)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Env-safe platform seam: no top-level @tauri-apps import; runtime detection + dynamic import code-splits Tauri impl into its own chunk; browser fallback default; setPlatformForTest injection point"
    - "Registry-as-control-plane: skeleton added enabled:true makes ENABLED_TOOLS non-empty so the verbatim router boots"
    - "Runtime render proof over build-only claim: jsdom RouterProvider smoke test exercises module-load firstTool.id + wildcard redirect"
    - "Throwaway code marked // PHASE 1 THROWAWAY for clean Phase-2 deletion (skeleton dir + registry entry)"

key-files:
  created:
    - src/lib/platform/index.ts
    - src/lib/platform/tauri.ts
    - src/lib/platform/browser.ts
    - src/lib/platform/stub.ts
    - src/lib/platform/platform.test.ts
    - src/tools/_skeleton/index.tsx
    - src/tools/_skeleton/transform.ts
    - src/tools/_skeleton/transform.test.ts
    - src/tools/_skeleton/ByteInspector.test.tsx
    - src/router.tsx
    - src/router.test.tsx
  modified:
    - src/main.tsx
    - src/App.tsx
    - src/lib/tools/registry.ts

key-decisions:
  - "Platform seam exports a synchronous `platform` backed by the browser fallback, swapped to Tauri after `initPlatform()` lazy-resolves — keeps the skeleton copy button synchronous"
  - "Skeleton registered IN the registry (enabled:true, first entry) rather than out-of-registry, so the verbatim router's firstTool=ENABLED_TOOLS[0] resolves and the registry->router wiring is exercised"
  - "Router runtime proof navigates via router.navigate() and asserts the settled pathname is /tools/_skeleton (singleton router state), rather than relying on initial window.location.hash"
  - "React-19 JSX type-compat shim in router.tsx narrows ComponentType|LazyComponent to ComponentType at the render site (all Phase-1 enabled tools are eager); Phase 2 uses route-level lazy"

patterns-established:
  - "Tools reach OS capabilities ONLY through @/lib/platform; @tauri-apps/* import lives solely in platform/tauri.ts behind a dynamic import"
  - "Component tests use plain DOM assertions (no @testing-library/jest-dom, which is not installed)"
  - "UX-constraint surface (instant paste, visible+focusable copy, status bar) is asserted in jsdom component tests"

requirements-completed: [FND-02, FND-04, HRN-01]

# Metrics
duration: 39min
completed: 2026-05-30
---

# Phase 1 Plan 02: HashRouter + Environment-Safe Platform Seam + Walking Skeleton Summary

**Environment-safe `src/lib/platform` clipboard seam (runtime Tauri detection + lazy import + navigator.clipboard fallback + injectable test seam), the verbatim HashRouter booted via an enabled:true skeleton registration, a jsdom RUNTIME proof that RouterProvider mounts and unknown routes redirect to `/tools/_skeleton`, and a throwaway byte-inspector skeleton (instant paste, visible+focusable copy through the seam, status bar) — all TDD-covered with the 19 decoder tests still green.**

## Performance

- **Duration:** ~39 min
- **Started:** 2026-05-30T12:23:07Z
- **Completed:** 2026-05-30T13:02:56Z
- **Tasks:** 3
- **Files created/modified:** 14

## Accomplishments
- **Environment-safe platform seam (FND-04, HIGH-4):** `index.ts` has NO top-level `@tauri-apps` import; it detects `__TAURI_INTERNALS__` at runtime and lazily `import("./tauri")` only inside the WKWebView, defaulting to a `navigator.clipboard` browser fallback (`browser.ts`) for `vite preview`. The Tauri clipboard impl is the ONLY file importing `@tauri-apps/plugin-clipboard-manager`, and `vite build` confirmed it code-splits into its own `tauri-*.js` chunk (out of the main bundle). `setPlatformForTest`/`resetPlatformForTest` let jsdom tests inject a stub — the platform test passes WITHOUT mocking Tauri.
- **HashRouter wired verbatim (FND-02):** `router.tsx` uses `createHashRouter` with index + wildcard `Navigate` to the first tool; no `BrowserRouter` anywhere in `src`.
- **Skeleton registration (Warning-2 fix):** `skeletonTool` is the first `enabled:true` entry in `registry.ts`, so `ENABLED_TOOLS === [skeletonTool]`, `firstTool = ENABLED_TOOLS[0]` resolves at module load, and the app boots.
- **Runtime router proof (HIGH-3):** `src/router.test.tsx` (jsdom) RENDERS `<RouterProvider router={router}/>`, asserts it mounts without throwing, and asserts navigation to `/tools/does-not-exist` settles at `/tools/_skeleton` with the skeleton mounted — runtime proof, not a build-only claim.
- **Throwaway byte-inspector skeleton (HRN-01):** trivial UTF-8 byteLength + uppercase + hex transform (NOT the real lib), instant paste transform (no decode button), an always-visible keyboard-focusable copy button routed through `platform.clipboard.writeText`, a status bar (parse state · byte count · timing), and stable `data-testid` selectors for Plan 04's e2e spike.
- **Gates green:** `tsc --noEmit` clean, full vitest suite 32 passing (incl. the immovable 19 decoder tests), eslint exit 0, `vite build` exit 0. No `package.json`/lockfile changes.

## Task Commits

Each task was committed atomically:

1. **Task 1: Environment-safe platform capability seam** - `8470447` (feat)
2. **Task 2: Throwaway byte-inspector walking skeleton (TDD)** - `43a2567` (feat)
3. **Task 3: Register skeleton, wire HashRouter verbatim, runtime router proof** - `39d9de1` (feat)

**Plan metadata:** final docs commit (see below)

_Task 2 was TDD: transform tests + impl, then jsdom component tests — landed in a single feat commit since the trivial throwaway transform passed first run._

## Files Created/Modified

**Platform seam (FND-04)**
- `src/lib/platform/index.ts` - Platform interface + env-safe impl picker (runtime detection, lazy Tauri import, browser default, setPlatformForTest/createPlatform/initPlatform). NO top-level @tauri-apps import.
- `src/lib/platform/tauri.ts` - the ONLY file importing @tauri-apps/plugin-clipboard-manager; reached only via dynamic import.
- `src/lib/platform/browser.ts` - navigator.clipboard fallback for vite preview.
- `src/lib/platform/stub.ts` - in-memory store stub (Phase 2 SHL-05 swaps in plugin-store).
- `src/lib/platform/platform.test.ts` - 4 seam tests (delegation, store round-trip, no-Tauri-mock import safety, navigator.clipboard fallback).

**Skeleton (HRN-01)**
- `src/tools/_skeleton/transform.ts` - trivial throwaway UTF-8 byteLength + uppercase + hex (NOT the real lib).
- `src/tools/_skeleton/transform.test.ts` - 3 node transform tests (ascii, empty, multibyte/unicode byte count).
- `src/tools/_skeleton/index.tsx` - ByteInspector component + `skeletonTool` ToolDefinition (id `_skeleton`, enabled:true).
- `src/tools/_skeleton/ByteInspector.test.tsx` - 4 jsdom component tests (instant transform, focusable visible copy, seam copy, status bar).

**Router + entry (FND-02)**
- `src/router.tsx` - HashRouter ported verbatim + React-19 JSX type-compat shim.
- `src/router.test.tsx` - jsdom runtime proof (mount + unknown-route redirect).
- `src/main.tsx` - RouterProvider + ./index.css + void initPlatform().
- `src/App.tsx` - minimal layout shell with <Outlet/> (real shell is Phase 2).
- `src/lib/tools/registry.ts` - skeleton prepended as first enabled:true tool (control-plane edit, NOT byte-frozen).

## Decisions Made
- **Synchronous `platform` accessor backed by browser fallback, lazily swapped to Tauri:** keeps the skeleton's copy button synchronous while staying env-safe; `initPlatform()` (fired from main.tsx) resolves the real impl inside the WKWebView.
- **In-registry skeleton (enabled:true) over out-of-registry:** makes the verbatim router's `firstTool.id` resolve and exercises the real registry->router wiring (the intended Warning-2 fix from RESEARCH Q2).
- **router.navigate()-driven redirect proof:** the router is a module-load singleton; navigating it explicitly and waiting for the settled pathname is more robust than relying on initial `window.location.hash`.
- **`./index.css` confirmed resolving (Warning 1):** main.tsx's verbatim `import "./index.css"` points at Plan 01's real entry stylesheet; build embeds fonts, no orphaned import.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] React-19 JSX type-compat shim in router.tsx**
- **Found during:** Task 3 (porting router.tsx verbatim + running `tsc --noEmit`)
- **Issue:** The verbatim scaffold renders `<tool.component />`, but `ToolDefinition.component` is typed `ComponentType | LazyComponent`. Under React 19's stricter JSX types a `LazyComponent` (returns `Promise<{default}>`) is no longer a valid JSX element type, so `tsc` failed with TS2786. The scaffold is structure-reference only (no package.json/tsconfig) and was never type-checked against React 19; `tsc` is a hard gate here.
- **Fix:** Kept the router structure verbatim but added a tiny `renderTool(component: ComponentType)` helper and narrowed `tool.component as ComponentType` at the render site (every Phase-1 enabled tool is an eager component — the skeleton). Documented that Phase 2 wires code-split tools via React Router's route-level `lazy` option rather than rendering a LazyComponent inline.
- **Files modified:** `src/router.tsx`
- **Verification:** `pnpm tsc --noEmit` clean; `pnpm vitest run src/router.test.tsx` proves RouterProvider mounts and the skeleton renders at runtime.
- **Committed in:** `39d9de1` (Task 3 commit)

**2. [Rule 3 - Blocking] Component tests use plain DOM assertions instead of @testing-library/jest-dom**
- **Found during:** Task 2 (authoring ByteInspector.test.tsx)
- **Issue:** Initial draft used `toHaveAttribute`/`not.toHaveAttribute` matchers from `@testing-library/jest-dom`, which is NOT installed (and the plan forbids `pnpm add`). No vitest `setupFiles` registers those matchers.
- **Fix:** Rewrote the assertions with plain DOM checks (`(copy as HTMLButtonElement).disabled`, `getAttribute("tabindex")`, `document.activeElement`, `className` regex for hover-only). No new dependency.
- **Files modified:** `src/tools/_skeleton/ByteInspector.test.tsx`
- **Verification:** `pnpm vitest run src/tools/_skeleton` — 7 tests green; package.json/lockfile untouched.
- **Committed in:** `43a2567` (Task 2 commit)

**3. [Rule 2 - Missing Critical] `void initPlatform()` startup call in main.tsx**
- **Found during:** Task 3 (porting main.tsx verbatim)
- **Issue:** The verbatim scaffold main.tsx has no platform init. Without resolving the env-appropriate impl at startup, the app would silently stay on the browser fallback even inside the Tauri WKWebView, so the real native clipboard would never load (FND-04 capability inert at runtime).
- **Fix:** Added `void initPlatform()` before render (fire-and-forget; `platform` is usable synchronously via the browser fallback until it resolves). Everything else in main.tsx is verbatim (RouterProvider + `./index.css`).
- **Files modified:** `src/main.tsx`
- **Verification:** `pnpm tsc --noEmit` clean; `vite build` confirms the Tauri impl code-splits into its own lazy chunk (loaded only when `__TAURI_INTERNALS__` present).
- **Committed in:** `39d9de1` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 missing-critical)
**Impact on plan:** All three were necessary to satisfy the plan's own hard gates (tsc clean, tests without new deps, a runtime-functional Tauri seam). No scope creep; the no-`pnpm add` / no-package.json-edit invariant (HIGH-2 de-conflict with Plan 03) is preserved.

## Issues Encountered
- **Router singleton state in the redirect test:** the first draft set `window.location.hash` and read `router.state.location.pathname`, which reported the pre-redirect (`/tools/does-not-exist`) location because the `Navigate` redirect settles after render. Resolved by driving `router.navigate("/tools/does-not-exist")` and `waitFor`-ing the settled pathname `/tools/_skeleton`.
- **`grep -rn "BrowserRouter" src` matches a comment:** router.tsx's explanatory "(not BrowserRouter)" comment trips a naive grep. Confirmed no real `BrowserRouter` import/usage exists in code (FND-02 invariant intact); the comment is the verbatim scaffold rationale and was kept.
- **eslint `react-refresh/only-export-components` warning (not error):** `src/tools/_skeleton/index.tsx` exports both `ByteInspector` and `skeletonTool`. This is the registry-driven pattern (tool modules export their ToolDefinition alongside the component) and the rule is configured `warn`; `pnpm lint` exits 0. The throwaway skeleton is deleted before Phase 2 regardless.

## Known Stubs
- `src/lib/platform/stub.ts` (and the `store` field on both platform impls) is an in-memory Map stub. This is INTENTIONAL and documented: D-11 ships only clipboard as a real capability in Phase 1; full persistence/store lands in Phase 2 (SHL-05). The clipboard capability — the only one the skeleton exercises — is fully wired (real Tauri impl + browser fallback), so the plan's goal is achieved.
- `src/tools/{unix-time,base64,protobuf-decoder}/index.ts` remain Plan-01 `enabled:false` placeholders (Phase 3 owns the real tools). Not in this plan's scope.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- **For Plan 03 (lefthook gate):** all new tests (platform, skeleton, router) run under the existing vitest config; the lefthook `pre-commit: tsc --noEmit + vitest run` will exercise them. tsc is clean and the full suite (32 tests) is green.
- **For Plan 04 (e2e spike):** the skeleton exposes stable `data-testid` selectors (`skeleton-input`, `skeleton-copy`, `skeleton-output`, `skeleton-status`, `skeleton-bytecount`, `skeleton-timing`) for WebdriverIO/chrome-devtools-mcp to drive; the app boots to `/tools/_skeleton` by default.
- **For Phase 2:** delete `src/tools/_skeleton/` and remove the two `// PHASE 1 THROWAWAY` markers in `registry.ts` (import + array entry); replace the minimal `App.tsx` shell with the registry-driven sidebar/palette shell; swap the platform `store` stub for the real `@tauri-apps/plugin-store` (SHL-05).
- **Manual gates still pending** (per the binding harness): `/codex:review`, and real-webview UI verification via `pnpm tauri dev` (paste transforms instantly, copy focusable+visible, status bar shows byte count + timing).

## Self-Check: PASSED

All 11 claimed created files exist on disk; all 3 task commits (`8470447`, `43a2567`, `39d9de1`) exist in git history.

---
*Phase: 01-scaffold-harness-proof*
*Completed: 2026-05-30*
