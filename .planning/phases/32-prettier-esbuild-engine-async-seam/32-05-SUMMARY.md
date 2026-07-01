---
phase: 32-prettier-esbuild-engine-async-seam
plan: 05
subsystem: build-guard
tags: [chunk-guard, code-split, offline, no-network, isolation, prt-02, prt-04]

# Dependency graph
requires:
  - phase: 32-prettier-esbuild-engine-async-seam
    plan: 01
    provides: "the async prettier wrapper (formatScript/formatHtml) the no-network test drives + the dynamic-import() discipline the guard enforces"
  - phase: 32-prettier-esbuild-engine-async-seam
    plan: 04
    provides: "the async esbuild-wasm minify wrapper (minifyScript) + __setEsbuildInitForTest hook the no-network test drives"
provides:
  - "scripts/prettierChunkGuard.mjs — generateBundle guard computing the INITIALLY-REACHABLE chunk set (entry + transitive static .imports) and throwing if any prettier/esbuild-wasm module is initially reachable; emits prettier-chunk-inventory.json sentinel"
  - "scripts/prettierChunkGuard.selftest.mjs — non-vacuous real-Vite self-test covering BOTH engines + the non-entry-static-chunk trap"
  - "verify-appstore-bundle.sh assert_no_heavy_engine_in_entry() — FATAL on heavyEngineInitiallyReachable:true, bound by assert_dist_freshness"
  - "src/lib/format/offline.integration.test.ts — engine-level no-network proof (fetch/XHR/WebSocket forbidden, 0 calls)"
affects: [33-html-tool, 34-js-ts-tool]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Initial-reachability build-artifact guard: seed with isEntry chunks, traverse STATIC .imports (NOT .dynamicImports) to a fixpoint; a heavy engine is a violation ONLY when it lands in that set — allows the engine in a dynamic-import-only chunk (unlike the licenseUi never-ship guard)"
    - "Real-Vite self-test consuming the REAL npm engines (fixtures inside the repo tree so bare imports resolve); manualChunks forces the non-entry-static hoist trap to prove .imports traversal, not isEntry"
    - "Engine-level no-network proof: swap globalThis.fetch/XMLHttpRequest/WebSocket for recording+throwing stand-ins, drive the real wrappers, assert 0 calls"

key-files:
  created:
    - "scripts/prettierChunkGuard.mjs"
    - "scripts/prettierChunkGuard.selftest.mjs"
    - "src/lib/format/offline.integration.test.ts"
  modified:
    - "vite.config.ts (prettierChunkGuard() wired UNGATED)"
    - "scripts/verify-appstore-bundle.sh (assert_no_heavy_engine_in_entry + main-block call + doc-comment gate (j))"
    - ".planning/ROADMAP.md (Phase 33 blocking offline-e2e carry-forward)"

key-decisions:
  - "Guard predicate is INITIAL-REACHABILITY (entry + transitive static .imports), not isEntry-membership — a heavy engine hoisted into a non-entry shared chunk that the entry statically imports is still a cold-start regression; the self-test's manualChunks case proves the traversal"
  - "Guard wired UNGATED (both channels ship prettier + esbuild), unlike the appstore-only licenseUi guard"
  - "No-network integration test runs in node env, NOT the plan's jsdom — jsdom's cross-realm TextEncoder trips esbuild-wasm's startup invariant (the same Rule-3 blocker Plan 32-04 hit); network stand-ins install on globalThis regardless of env"
  - "Self-test fixtures placed inside the repo tree (temp dir under repo root) so the REAL prettier/esbuild-wasm bare imports resolve against the repo node_modules; a temp dir outside the repo would not resolve them"

patterns-established:
  - "prettier-chunk-inventory.json sentinel {heavyEngineInitiallyReachable, initialHits, asyncOnlyChunkFiles}, verified by assert_no_heavy_engine_in_entry with the exact-root read + duplicate-rejection + missing/malformed FAIL discipline mirrored from the licenseUi guard"

requirements-completed: [PRT-02, PRT-04]

# Metrics
duration: ~9min
completed: 2026-07-01
---

# Phase 32 Plan 05: Heavy-Engine Chunk-Isolation Guard + No-Network Proof Summary

**An ungated Vite `generateBundle` guard that FAILS any build where a prettier or esbuild-wasm module becomes INITIALLY-REACHABLE from an entry chunk (entry + transitive static `.imports`, not just `isEntry`), proven non-vacuous by a real-Vite self-test covering BOTH engines plus the non-entry-static hoist trap, with its `prettier-chunk-inventory.json` sentinel FATAL-checked by `verify-appstore-bundle.sh` and an engine-level no-network integration test proving the real prettier + esbuild wrappers format/minify with zero outbound requests.**

## Performance
- **Duration:** ~9 min
- **Started:** 2026-07-01T13:24Z
- **Completed:** 2026-07-01T13:33Z
- **Tasks:** 3
- **Files created/modified:** 6

## Accomplishments
- `scripts/prettierChunkGuard.mjs`: a `generateBundle` plugin that builds the initially-reachable chunk set (seed = `isEntry` chunks; traverse STATIC `.imports` to a fixpoint), classifies every chunk folding a `HEAVY_ENGINE_MODULES` id (`/node_modules\/prettier\//`, `/node_modules\/esbuild-wasm\//`) as either an `initialHit` (violation) or an `asyncOnlyChunkFile` (allowed dynamic-only home), emits `prettier-chunk-inventory.json` REGARDLESS, and throws on `heavyEngineInitiallyReachable`. Wired UNGATED in `vite.config.ts` (both channels ship the engines).
- `scripts/prettierChunkGuard.selftest.mjs`: imports the SAME production guard and runs 5 REAL Vite builds against fixtures consuming the REAL prettier + esbuild-wasm packages — prettier static fold-in RED, esbuild static fold-in RED (esbuild matcher non-vacuous), prettier hoisted into a non-entry static chunk via `manualChunks` RED (proves `.imports` traversal, not `isEntry`), and BOTH dynamic-import-only builds GREEN with `heavyEngineInitiallyReachable:false` + non-empty `asyncOnlyChunkFiles`. Neutering the guard's `throw` makes it exit non-zero (non-vacuousness verified in a scratch edit, reverted).
- `verify-appstore-bundle.sh` `assert_no_heavy_engine_in_entry()`: exact-root sentinel read, duplicate rejection (`find … wc -l > 1` → FAIL), missing/malformed FAIL, FATAL on `heavyEngineInitiallyReachable:true` — mirroring `assert_no_license_ui_module` and bound by the same `assert_dist_freshness`; top doc-comment records the new PRT-02 gate (j).
- `src/lib/format/offline.integration.test.ts`: replaces `globalThis.fetch`/`XMLHttpRequest`/`WebSocket` with recording+throwing stand-ins, drives the real `formatScript` (JS), `formatHtml` (embedded script), and `minifyScript` (JS) wrappers, asserts every result `ok:true` AND `networkCalls === 0`, restores globals in teardown.
- `.planning/ROADMAP.md`: one blocking Success-Criteria bullet on the Phase 33 entry — the first mounted consumer inherits the P32 offline-e2e obligation (real-WKWebView Wi-Fi-off paste proof) [PRT-04, carried from Phase 32].

## OFFLINE-PROOF BOUNDARY (P32 vs P33)
P32's offline proof **IS**: the engine-level no-network integration test (fetch/XHR/WebSocket forbidden while driving the real prettier + esbuild wrappers) + the post-build bundle grep for no-CDN + the `prettier-chunk-inventory.json` chunk sentinel. It is **NOT** a mounted-tool interactive WKWebView paste flow — no tool consumes the engines until Phase 33/34, so the Wi-Fi-off real-webview paste proof cannot run this phase. That interactive proof is a **BLOCKING carry-forward onto Phase 33** (recorded in this plan's `must_haves.carry_forward` AND as a blocking Success-Criteria bullet on the Phase 33 ROADMAP entry). Not silently deferred.

## Task Commits
1. **Task 1: chunk-isolation guard (initial-reachability) + both-engines self-test + ungated vite wiring** — `3136126e` (feat)
2. **Task 2: sentinel wired into verify-appstore-bundle.sh + no-network engine integration test** — `b81a461b` (feat)
3. **Task 3: Phase 33 ROADMAP blocking offline-e2e carry-forward** — `74988256` (docs)

## Files Created/Modified
- `scripts/prettierChunkGuard.mjs` — the initial-reachability guard + sentinel emit.
- `scripts/prettierChunkGuard.selftest.mjs` — 5-case non-vacuous real-Vite self-test (both engines + non-entry-static trap).
- `src/lib/format/offline.integration.test.ts` — engine-level no-network proof (4 cases; node env).
- `vite.config.ts` — `prettierChunkGuard()` imported + added to `plugins` OUTSIDE the `isAppstoreBuild` branch.
- `scripts/verify-appstore-bundle.sh` — `assert_no_heavy_engine_in_entry()` + main-block call + doc-comment gate (j).
- `.planning/ROADMAP.md` — Phase 33 blocking carry-forward criterion.

## Decisions Made
- Initial-reachability (not `isEntry`) predicate — the load-bearing difference vs the licenseUi guard; proven by the `manualChunks` non-entry-static self-test case.
- Guard UNGATED (both channels), vs the appstore-only licenseUi guard.
- No-network test in node env (Deviation 1) — jsdom breaks esbuild.
- Self-test fixtures inside the repo tree so the real engine bare-imports resolve.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] No-network integration test runs in `node` env, not the plan's jsdom**
- **Found during:** Task 2 (integration test design)
- **Issue:** The plan specified `// @vitest-environment jsdom`. Empirically (established in Plan 32-04) jsdom's `TextEncoder` returns a cross-realm `Uint8Array` that trips esbuild-wasm's own startup invariant ("your JavaScript environment is broken"), so `minifyScript` would return `ok:false` under jsdom and the test's `ok:true` assertion would fail.
- **Fix:** Run in the default `node` env (real `Uint8Array`; the wrappers need no DOM) and inject the empty esbuild init provider (`__setEsbuildInitForTest(async () => ({}))`) so the node build self-loads the vendored on-disk service. The network stand-ins install on `globalThis` regardless of env, so the no-network proof is unaffected.
- **Files modified:** src/lib/format/offline.integration.test.ts
- **Verification:** 4/4 green; `networkCalls === 0`.
- **Committed in:** `b81a461b`

**2. [Rule 3 - Blocking] `process` global is not allowed by eslint — use `node:process` import**
- **Found during:** Task 1 (first commit — lefthook lint gate)
- **Issue:** `process.exit(rc)` in the self-test tripped `no-undef` (the repo defines no node globals in eslint; existing scripts import from `node:process`).
- **Fix:** `import { stdout, exit } from "node:process"` and call `exit(rc)` (repo convention, matching the 32-01 generator fix).
- **Files modified:** scripts/prettierChunkGuard.selftest.mjs
- **Verification:** `eslint` 0 errors on both new mjs files; lefthook GREEN.
- **Committed in:** `3136126e`

**3. [Rule 3 - Blocking] Loose global cast for the network stand-ins (tsc)**
- **Found during:** Task 2 (tsc gate)
- **Issue:** Assigning the stand-ins to `globalThis.fetch`/`XMLHttpRequest`/`WebSocket` through a `typeof globalThis & {…}` intersection kept the strict lib.dom types (the stand-ins lack `UNSENT`/`OPEN`/… statics) → TS2739/TS2322.
- **Fix:** View the global as `globalThis as unknown as Record<string, unknown>` for the swap (the stand-ins exist only to be counted, never used as real transports).
- **Files modified:** src/lib/format/offline.integration.test.ts
- **Verification:** `tsc --noEmit` clean.
- **Committed in:** `b81a461b`

---

**Total deviations:** 3 auto-fixed (all Rule 3 blocking — test-env / lint / type mechanics; the guard, sentinel, verifier wiring, and offline proof shipped exactly as specified).
**Impact on plan:** None on the deliverable contract. The initial-reachability predicate, both-engines non-vacuous self-test, sentinel + verifier FATAL, no-network proof, and Phase-33 carry-forward all landed as designed.

## Threat Register Outcome
- **T-32-11 (a static import making an engine initially-reachable):** mitigated — the guard computes the initial-reachability set over real `chunk.modules` and throws; sentinel + verifier FATAL; the non-vacuous self-test fires for BOTH engines AND the non-entry-static-chunk trap.
- **T-32-12 (runtime network egress / CDN import):** mitigated at the engine layer — no-network integration test (fetch/XHR/WS forbidden, 0 calls) + post-build `grep -RnE 'unpkg|cdn|https?://' dist/assets | grep -i 'prettier|esbuild'` clean. The interactive real-WKWebView offline paste proof is a BLOCKING carry-forward onto Phase 33.
- **T-32-13 (stale clean dist/ masking a dirty build):** mitigated — `assert_no_heavy_engine_in_entry` runs bound by `assert_dist_freshness` (binary newer than source; dist fresh + not newer than binary), reusing the licenseUi precedent.

## Verification
- `node scripts/prettierChunkGuard.selftest.mjs` → OK (5/5); neutered-throw scratch edit → exit 1 (non-vacuous), reverted.
- `pnpm build` → exit 0; `dist/prettier-chunk-inventory.json` = `heavyEngineInitiallyReachable:false`, empty hits/asyncOnlyChunkFiles (no consumer yet — expected in P32).
- `pnpm exec vitest run src/lib/format/offline.integration.test.ts` → 4/4, `networkCalls === 0`.
- `bash -n scripts/verify-appstore-bundle.sh` clean; `--selftest` exit 0 (existing gates un-regressed); `grep heavyEngineInitiallyReachable` present; function tested against clean/true/missing sentinels (PASS/FAIL/FAIL).
- `grep -c 'inherits the P32 offline' .planning/ROADMAP.md` = 1, under Phase 33.
- No-CDN engine audit clean; `tsc --noEmit` clean; full suite **vitest 1339/1339** (+4 vs 1335); decoder + 19 tests byte-for-byte untouched (`git diff --quiet 3136126e^ HEAD -- src/lib/protobuf/` clean).

## Not Auto-Run by the Executor
Per the binding harness (run at the Phase-32 boundary, NOT by this executor): `/simplify` → `/code-review xhigh` → `/codex:adversarial-review` → real-WKWebView UI verification. This plan is build-guard + test infrastructure with no UI/native surface of its own; the shipped-app positive proof (engine in a dynamic-only chunk of the REAL bundle) activates at Phase 33's first consumer, and the interactive offline paste e2e is the P33 blocking carry-forward.

## User Setup Required
None — no external service configuration required.

---
*Phase: 32-prettier-esbuild-engine-async-seam*
*Completed: 2026-07-01*

## Self-Check: PASSED
All 4 created files present on disk (prettierChunkGuard.mjs, prettierChunkGuard.selftest.mjs, offline.integration.test.ts, 32-05-SUMMARY.md); all 3 task commits (`3136126e`, `b81a461b`, `74988256`) present in git history.
