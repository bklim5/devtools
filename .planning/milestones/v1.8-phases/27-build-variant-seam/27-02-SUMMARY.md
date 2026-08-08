---
phase: 27-build-variant-seam
plan: 02
subsystem: build-variant-seam
tags: [build-variant, mac-app-store, config-overlay, vite-channel, tree-shaking, package-scripts, capability-overlay, mas-build-01, mas-build-05]
requires:
  - "27-01: tauri.direct.conf.json (the direct-only capability overlay this plan's direct + publish scripts pass) + the appstore/direct Cargo features"
  - "26-xx: entitlements.appstore.plist + scripts/build-appstore-spike.sh (the inline --config this plan materializes as a committed file)"
provides:
  - "src-tauri/tauri.appstore.conf.json: the committed --config overlay carrying ONLY the appstore deltas (13.0, sandbox entitlements, no-dmg, no-updater)"
  - "src/lib/platform/channel.ts: IS_APPSTORE build-time tree-shakeable constant (the single Phase-28 import point for pane/upsell gating)"
  - "VITE_CHANNEL typing (src/vite-env.d.ts ImportMetaEnv augmentation)"
  - "package.json tauri:build:direct + tauri:build:appstore canonical variant commands (half-variant impossible — VITE_CHANNEL bound with the cargo flags in ONE place)"
  - "build-and-publish.mjs: the SHIPPED direct release now carries the 27-01 capability overlay (no updater/autostart permission regression)"
affects:
  - "Plan 27-04 (creates scripts/build-appstore-bundle.sh — the script tauri:build:appstore calls)"
  - "Phase 28 (imports IS_APPSTORE to gate the StoreLicenseSettings pane + route upsell to StoreKit Buy/Restore)"
  - "Phase 30 (.pkg submission consumes the appstore overlay's app-only no-updater bundle)"
tech-stack:
  added: []
  patterns:
    - "Tauri --config overlay deep-merged over the base config carries ONLY a variant's deltas (the 13.0 / sandbox-entitlements / no-dmg never leak onto the base)"
    - "IS_APPSTORE mirrors the import.meta.env.DEV static-tree-shaking idiom (resolve.ts): Vite inlines import.meta.env.VITE_CHANNEL so the direct bundle shakes out every if(IS_APPSTORE) branch"
    - "one canonical package.json script per variant binds VITE_CHANNEL + the cargo flags together so a half-variant (frontend says direct, native says appstore) cannot ship (D-08)"
    - "the direct-only capability overlay (--config) is passed by BOTH the local direct command AND the publish flow so the shipped direct release re-acquires the permissions stripped from the globbed default.json"
key-files:
  created:
    - "src-tauri/tauri.appstore.conf.json (appstore --config delta overlay)"
    - "src/lib/platform/channel.ts (IS_APPSTORE constant)"
    - "src/lib/platform/channel.test.ts (3 channel cases)"
  modified:
    - "src/vite-env.d.ts (VITE_CHANNEL typed via ImportMetaEnv augmentation)"
    - "package.json (tauri:build:direct + tauri:build:appstore scripts)"
    - "scripts/build-and-publish.mjs (--config src-tauri/tauri.direct.conf.json on the universal tauri build)"
decisions:
  - "IS_APPSTORE lives in src/lib/platform/ (the only allowed Tauri-boundary module) as the single import point, never as scattered inline import.meta.env.VITE_CHANNEL checks (D-07)"
  - "The appstore overlay carries NO app.security.capabilities block — the appstore build's plugins are compiled out (27-01), so it must never reference the direct-only updater/autostart/process perms; the static default.json already grants everything the appstore build needs post-27-01 strip"
  - "The publish flow (build-and-publish.mjs) gets the SAME --config tauri.direct.conf.json as the local direct script (Finding 1) — otherwise the SHIPPED direct release would link the updater/autostart plugins but lack permission to call them (a silent runtime regression invisible to unit + WebDriver gates)"
  - "signingIdentity is NOT in the committed appstore overlay — it is machine-specific (per-developer keychain) and injected at build time by scripts/build-appstore-bundle.sh (Plan 04)"
metrics:
  duration: ~6 min
  completed: 2026-06-23
  tasks: 3
  files: 6
---

# Phase 27 Plan 02: The Build-Variant Seam (Layers 2 + 3 — appstore overlay + IS_APPSTORE + variant scripts) Summary

Layers 2 and 3 of the build-variant seam landed: a committed `tauri.appstore.conf.json` `--config` overlay carrying ONLY the appstore deltas (13.0 min-version, sandbox entitlements, no-dmg, no-updater) so the base config stays byte-unchanged at 10.15; an `IS_APPSTORE` build-time channel constant in `src/lib/platform/channel.ts` that tree-shakes statically (mirroring `import.meta.env.DEV`); and the two canonical `package.json` variant scripts that bind `VITE_CHANNEL` to the cargo flags in ONE place so a half-variant cannot ship — with the direct script (and the publish flow, per Finding 1) passing the 27-01 `tauri.direct.conf.json` overlay to re-acquire the updater/autostart/process capability permissions that 27-01 stripped from the globbed `default.json`.

## What Was Built

- **Task 1 — appstore overlay (`tauri.appstore.conf.json`, commit `d00a3602`):** a Tauri `--config` overlay carrying exactly the appstore deltas and nothing else — `bundle.targets: ["app"]` (no dmg), `createUpdaterArtifacts: false`, `macOS.entitlements: "entitlements.appstore.plist"`, `macOS.hardenedRuntime: false`, `macOS.minimumSystemVersion: "13.0"`, and `plugins.updater: null`. No `app.security.capabilities` block (the appstore build's plugins are compiled out — 27-01 — so it must never reference the direct-only perms; the static `default.json` already grants everything it needs post-strip). No `signingIdentity` (machine-specific, injected by Plan 04's build script). The base `tauri.conf.json` is byte-unchanged at 10.15 (D-05/D-06); `grep '13.0' tauri.conf.json` == 0 (no leak — MAS-BUILD-05).
- **Task 2 — `IS_APPSTORE` + VITE_CHANNEL typing (`channel.ts`/`vite-env.d.ts`/`channel.test.ts`, commit `de5dcb36`, TDD):** `IS_APPSTORE = import.meta.env.VITE_CHANNEL === "appstore"` — a build-time const that Vite inlines, so the direct bundle (`VITE_CHANNEL` unset → `false`) tree-shakes every `if (IS_APPSTORE)` branch and the appstore bundle bakes it in (D-07, the single Phase-28 gate import point). `VITE_CHANNEL` typed `"appstore" | "direct"` via an `ImportMetaEnv` augmentation (declaration-merged over `vite/client`, which still provides `DEV`/`PROD`/`VITE_APP_VERSION`). 3 tests pin false-default / appstore-true / direct-false via `vi.stubEnv` + `vi.resetModules` (`vi.stubEnv` flows into `import.meta.env` for the dynamic import in vitest 4.x — verified).
- **Task 3 — canonical variant scripts + publish-flow overlay (`package.json`/`build-and-publish.mjs`, commit `6aae34a0`):** `tauri:build:direct = "tauri build --config src-tauri/tauri.direct.conf.json"` (default cargo features → updater + autostart present; the `--config` re-grants the five direct-only perms 27-01 stripped from `default.json`). `tauri:build:appstore = "VITE_CHANNEL=appstore bash scripts/build-appstore-bundle.sh"` (binds the frontend channel + the native flags in ONE command; no direct overlay). Per Finding 1, the `release:publish` flow (`build-and-publish.mjs`, which shells `pnpm tauri build` via `execFileSync` with an argv array) got `--config src-tauri/tauri.direct.conf.json` appended to its universal build so the SHIPPED direct release retains its updater/autostart permissions — without it, the published direct app would link the plugins but the webview would lack permission to call them.

## Verification Evidence

- **Task 1:** the automated node check passed (`minimumSystemVersion === "13.0"`, `plugins.updater === null`, `targets === ["app"]`); acceptance greps: minVer13=1, entitlements.appstore.plist=1, updater null=1, createUpdaterArtifacts false=1, `capabilities`=0, `13.0` in base=0; `git diff --stat src-tauri/tauri.conf.json` empty (base byte-unchanged).
- **Task 2:** `pnpm vitest run src/lib/platform/channel.test.ts` 3/3 pass; `pnpm tsc --noEmit` exits 0; `VITE_CHANNEL` present in both `channel.ts` (code line) and `vite-env.d.ts` (typed).
- **Task 3:** the automated node check passed (both scripts present, appstore binds `VITE_CHANNEL=appstore`, direct includes `tauri.direct.conf.json`); appstore script does NOT contain `tauri.direct.conf.json` (does not reference direct-only perms); `package.json` is valid JSON; `build-and-publish.mjs` carries `--config src-tauri/tauri.direct.conf.json` on the universal build (line 354).
- **No regression:** full lefthook gate (typecheck + vitest + eslint) green on all three commits — vitest **1214/1214** (+3 channel cases), tsc clean, eslint 2 pre-existing SidebarResetMenu warnings (out of scope). decoder.ts + its 19 tests byte-for-byte untouched across `d00a3602^..HEAD` (this plan never touched `src/lib/protobuf/`). `tauri.direct.conf.json` not edited (only referenced).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corrupt pnpm workspace-state cache broke the pre-commit test driver**
- **Found during:** Task 3 commit.
- **Issue:** The lefthook `test` step failed with `pnpm: Unexpected end of JSON input` from pnpm's own internal `loadWorkspaceState` / `checkDepsStatus` (it ran BEFORE invoking vitest — typecheck and lint passed, the suite never ran). The cause was a truncated/corrupt `node_modules/.pnpm-workspace-state-v1.json` (1350 bytes, malformed), a pnpm dependency-status cache — NOT anything in this plan's changes. `pnpm vitest run …` invoked directly was 3/3 green, confirming the suite itself was healthy.
- **Fix:** removed the corrupt cache file (`rm -f node_modules/.pnpm-workspace-state-v1.json`); pnpm regenerated it on the next run. `pnpm test` then passed 1214/1214 and the Task 3 commit's lefthook gate ran fully green.
- **Files modified:** none (transient environment cache only; no source delta).
- **Commit:** Task 3 (`6aae34a0`) committed cleanly on retry.

### Acceptance-criterion note (no code change)

- Task 2's acceptance criterion `grep -c 'VITE_CHANNEL' src/lib/platform/channel.ts returns 1` actually returns **4** because the doc-comment block (mandated by the plan's `<action>`) mentions `VITE_CHANNEL` three additional times. The *code* references it exactly once (`import.meta.env.VITE_CHANNEL === "appstore"`); the behavior — and the tree-shaking semantics the criterion was guarding — is exactly as specified. No code change made; flagged here for transparency. The substantive criteria (exports `IS_APPSTORE`, `VITE_CHANNEL` typed, 3 tests pass, tsc 0) all hold.

## Self-Check: PASSED

- FOUND: src-tauri/tauri.appstore.conf.json
- FOUND: src/lib/platform/channel.ts
- FOUND: src/lib/platform/channel.test.ts
- FOUND: src/vite-env.d.ts (modified — VITE_CHANNEL typed)
- FOUND: package.json (modified — two variant scripts)
- FOUND: scripts/build-and-publish.mjs (modified — direct overlay on universal build)
- FOUND commit: d00a3602 (Task 1)
- FOUND commit: de5dcb36 (Task 2)
- FOUND commit: 6aae34a0 (Task 3)
