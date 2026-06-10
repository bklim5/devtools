---
phase: 18-entitlements-seam-central-gate
plan: 02
subsystem: licensing
tags: [entitlements, lazy-loading, code-splitting, react-lazy, router, vite-chunks]

# Dependency graph
requires:
  - phase: 18-entitlements-seam-central-gate
    plan: 01
    provides: isToolLocked/useEntitlements/set+resetEntitlementsForTest seams + UpsellPanel (final layout)
provides:
  - "ToolDefinition.component narrowed to LazyComponent only — all 11 registry entries are `component: () => import(...)` loaders (ENT-05)"
  - "src/components/ToolRoute.tsx — element-level entitlement gate: locked → UpsellPanel WITHOUT invoking the loader; unlocked → module-cached React.lazy in Suspense fallback={null}"
  - "Router tool routes render <ToolRoute tool={tool}/> from ENABLED_TOOLS (registry stays the single control plane; route-level lazy deliberately NOT used)"
  - "Per-tool Vite chunks proven: 11 tool chunks emitted; decoder isolated to ProtobufDecoder-*.js only — the future free-build exclusion seam is real"
affects: [18-03 (sidebar/palette lock surfaces), 18-04 (phase gate + e2e re-proof), 21 (free-tier flip makes the locked branch live)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-level lazyCache Map keyed by tool.id — React.lazy created ONCE per tool, never per render (Pitfall 2 / T-18-08)"
    - "Element-level gate, not route-level `lazy`: the gate runs BEFORE lazy() invocation so locked chunks are never fetched and entitlement flips swap surfaces live (Pitfall 1)"
    - "Test fixtures build ToolDefinitions inline with vi.fn loaders — render assertion + never-invoked-when-locked spy from one fixture"

key-files:
  created:
    - src/components/ToolRoute.tsx
    - src/components/ToolRoute.test.tsx
  modified:
    - src/lib/tools/types.ts
    - src/router.tsx
    - src/tools/unix-time/index.ts
    - src/tools/base64/index.ts
    - src/tools/protobuf-decoder/index.ts
    - src/tools/jwt/index.ts
    - src/tools/hash/index.ts
    - src/tools/uuid-ulid/index.ts
    - src/tools/json-formatter/index.ts
    - src/tools/xml-formatter/index.ts
    - src/tools/url/index.ts
    - src/tools/regex/index.ts
    - src/tools/cron/index.ts
    - src/lib/entitlements/entitlements.test.ts
    - src/shell/fuzzy.test.ts

key-decisions:
  - "Tasks 1+2 landed in ONE commit (plan-sanctioned): narrowing component to LazyComponent breaks the old router cast until ToolRoute lands, and lefthook rejects a failing-tsc commit"
  - "react-hooks/static-components suppressed at the <Tool /> JSX site with justification — identity IS static (module cache per tool.id), the linter just can't see through the Map"
  - "No vite.config change needed: Vite emitted all 11 per-tool chunks from the dynamic imports alone (Task 3 expected outcome confirmed)"

patterns-established:
  - "lazyToolComponent(tool) is THE way to materialize a tool component — never call lazy(tool.component) elsewhere"
  - "Locked-route placement: flex flex-1 items-center justify-center p-8 wrapper centers UpsellPanel in <main> (layout-agnostic, no fixed sizes)"

requirements-completed: [ENT-05]
requirements-progressed: [ENT-01 (router surface now consumes the gate; sidebar/palette in 18-03)]

# Metrics
duration: 16min
completed: 2026-06-10
---

# Phase 18 Plan 02: Lazy Registry & Router Entitlement Gate Summary

**All 11 registry entries converted to `component: () => import(...)` lazy loaders (ENT-05) behind a new element-level `<ToolRoute>` gate — locked tools render the UpsellPanel without ever invoking the loader (no chunk fetch), unlocked tools render a module-cached `React.lazy`; build proves 11 per-tool Vite chunks with the decoder isolated to the protobuf chunk only.**

## Performance

- **Duration:** ~16 min
- **Started:** 2026-06-10T14:22:58Z
- **Completed:** 2026-06-10T14:38:13Z
- **Tasks:** 3 (Tasks 1+2 one commit — tsc-coupled per plan; Task 3 verification-only, no source change)
- **Files modified:** 17

## Accomplishments

- **ENT-05 lazy registry:** every `src/tools/*/index.ts` dropped its eager component import for `component: () => import("./XTool")` (all 11 verified default exports — assumption A3 held); `ToolDefinition.component` narrowed from `ComponentType | LazyComponent` to `LazyComponent` only, with a doc comment explaining the free-build exclusion seam.
- **Element-level gate (ENT-01/D-30):** `ToolRoute` checks `isToolLocked(tool, useEntitlements())` BEFORE touching the loader — locked → centered `UpsellPanel` (feature name + tool icon), unlocked → `lazy(tool.component)` cached in a module-level Map keyed by `tool.id` inside `<Suspense fallback={null}>`. Entitlement flips swap upsell↔tool live on a mounted route (proven by test).
- **Router rewire:** `renderTool` + the `as ComponentType` cast deleted; tool routes are `element: <ToolRoute tool={tool} />` mapped 1:1 from `ENABLED_TOOLS`; the stale Phase-2 "route-level `lazy`" comment replaced with the Pitfall-1 rationale for deliberately NOT using it.
- **Chunk-level proof (Task 3):** `pnpm build` emits 22 JS assets including all 11 tool chunks by name (`Base64Tool-2nNXEZjO.js` … `ProtobufDecoder-rpxZ2VaY.js`); the decoder-unique literal `"Unexpected end of buffer while reading varint"` greps to exactly ONE chunk — `ProtobufDecoder-rpxZ2VaY.js` — not the 322 kB entry chunk. No `manualChunks` tweak needed.
- **App behavior identical:** full suite 771/771 (5 new ToolRoute tests; zero existing tool tests modified), `tsc` + `eslint` clean, and the full real-WKWebView e2e suite **14/14 specs** green under `tauri dev` (protobuf-decoder, base64, cron + 11 more) — instant render, no perceptible blank from `fallback={null}`.
- `decoder.ts` + its 19 tests byte-for-byte untouched; zero new dependencies.

## Task Commits

1. **Tasks 1+2: lazy registry + ToolRoute gate + router rewire** - `2d776d0c` (feat) — single commit because narrowing `component` to `LazyComponent` breaks the old router cast until ToolRoute lands (plan-sanctioned; lefthook rejects failing-tsc commits)
2. **Task 3: build-level chunk verification** - no commit (verification only; evidence below, no source edits)

## Build Evidence (Task 3 — the exclusion seam is real)

```
dist/assets/*.js — 22 chunks (entry + 11 tool chunks + shared splits):
  Base64Tool-2nNXEZjO.js    CronTool-CRIrSWBM.js     HashTool-D7iuw83V.js
  JsonFormatterTool-*.js    JwtTool-C1r1FObL.js      ProtobufDecoder-rpxZ2VaY.js
  RegexTool-DYM9_n3J.js     UnixTimeTool-BYGzb4Rm.js UrlTool-DmtpZhca.js
  UuidUlidTool-C01zVLco.js  XmlFormatterTool-*.js
  + index (entry 322 kB), tauri, worker, FormatterView, StatusBar, CopyButton,
    ResizableSplit, bytes, copy, timeFormat, useCopyFeedback

grep -l "Unexpected end of buffer while reading varint" dist/assets/*.js
  → dist/assets/ProtobufDecoder-rpxZ2VaY.js   (ONLY match — decoder isolated)
```

## Files Created/Modified

- `src/components/ToolRoute.tsx` - Element-level gate + module-cached React.lazy per tool id
- `src/components/ToolRoute.test.tsx` - 5 tests: locked under FREE_SET + FULL_SET (loader 0 calls), unlocked render, reactive flip on mounted route, loader-once across re-renders
- `src/lib/tools/types.ts` - `component: LazyComponent` (union removed)
- `src/router.tsx` - `<ToolRoute tool={tool} />` children; renderTool/cast/stale comment gone
- `src/tools/*/index.ts` (11 files) - eager import → `() => import("./XTool")`
- `src/lib/entitlements/entitlements.test.ts`, `src/shell/fuzzy.test.ts` - fixture `component` updated to lazy shape (type-narrow fallout)

## Decisions Made

- Tasks 1+2 in one commit (tsc coupling, plan-sanctioned escape hatch).
- `react-hooks/static-components` disabled at the single `<Tool />` site with an inline justification — the rule's concern (per-render component identity churn) is exactly what `lazyCache` prevents; the linter can't see through the Map.
- ToolRoute tests use unique tool ids per fixture because `lazyCache` is module-level — documented in the test file.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test fixtures broken by the type narrow**
- **Found during:** Task 1 verification (`tsc --noEmit`)
- **Issue:** `entitlements.test.ts` and `fuzzy.test.ts` build inline ToolDefinition fixtures with eager `component:` values — type error once `component` became `LazyComponent`-only
- **Fix:** fixtures now use `component: () => Promise.resolve({ default: ... })` (neither test touches `component` behaviorally)
- **Files modified:** src/lib/entitlements/entitlements.test.ts, src/shell/fuzzy.test.ts
- **Verification:** tsc clean; both suites green unmodified otherwise
- **Committed in:** 2d776d0c

**2. [Rule 1 - Bug] eslint react-hooks/static-components error on ToolRoute**
- **Found during:** Task 2 plan-level verification (`pnpm lint`)
- **Issue:** the linter flags `<Tool />` as "component created during render" — it cannot see that `lazyToolComponent` returns a module-cached stable identity
- **Fix:** targeted `eslint-disable-next-line` at the JSX site with an inline justification comment
- **Files modified:** src/components/ToolRoute.tsx
- **Verification:** `pnpm lint` clean; the loader-once-across-re-renders test proves the identity really is stable
- **Committed in:** 2d776d0c

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 lint bug). No scope creep; no architectural changes.

## Harness Gates (per-task DoD)

- simplify: changes already minimal (plan-verbatim ToolRoute, surgical 2-line diffs per registry file)
- `codex review --uncommitted`: **"No actionable bugs were found"** (it independently re-ran tsc/lint/build/tests)
- Unit: **771/771** (`vitest`), `tsc --noEmit` clean, `pnpm lint` clean
- Real-WKWebView: full e2e suite **14/14 specs** via `scripts/e2e-spike.sh` (exceeds the plan's 3-tool spot-check; lazy-loaded tools render instantly on the real WKWebView)

## Known Stubs

None introduced by this plan. The locked branch of ToolRoute is **dormant by design** (D-18 — no shipped tool carries `requiredEntitlements`; Phase 21 flips the free tier live); it is fully wired and test-proven, not a stub. Plan 01's two intentional UpsellPanel stubs (BUY_LICENSE_URL CTA, license-key button) are unchanged and tracked in 18-01-SUMMARY.

## Threat Flags

None — no new network endpoints, auth paths, file access, or schema changes. All three plan threats mitigated with tests: T-18-06 (loader spy asserts 0 calls when locked), T-18-07 (deep-linking a locked route renders the upsell in the element — no navigation bypass exists), T-18-08 (loader-once-across-re-renders test).

## Issues Encountered

- An orphan release-bundle app instance + a leaked vite/dev-app pair around the e2e run (known harness gotcha) — reaped before/after; e2e ran clean first try.

## User Setup Required

None.

## Next Phase Readiness

- 18-03 (sidebar/palette lock surfaces) can ship lock badges against the same `isToolLocked`/`useEntitlements` pair; the route side of D-30 is done.
- 18-04 (phase gate) inherits a registry that is already fully lazy and a green 14/14 e2e baseline on the real WKWebView.
- Phase 21's free-build decoder exclusion now has a real seam: dropping the protobuf chunk from a free build removes the decoder entirely (proven isolated).

---
*Phase: 18-entitlements-seam-central-gate*
*Completed: 2026-06-10*

## Self-Check: PASSED

ToolRoute.tsx + ToolRoute.test.tsx + this SUMMARY exist on disk; commit 2d776d0c present; all 11 registry entries contain `component: () => import(`.
