---
phase: 29-sandbox-safe-native-features
plan: 02
subsystem: appstore-sandbox-frontend
tags: [appstore, sandbox, launch-at-login, autostart, tree-shake, boot-path, updater-surface, MAS-NATIVE]
requires:
  - "Phase 27: IS_APPSTORE channel const + appstore build variant (updater/autostart compiled OUT)"
  - "Phase 28-01/02: baseFromStoreKit resolution arm + the D-04 main.tsx boot gate"
  - "Phase 29-01: license module + tray-updater item Rust compile-out (#[cfg(feature = \"direct\")])"
provides:
  - "store-build General pane with launch-at-login fully ABSENT (no toggle/helper/live-region/reconcile)"
  - "autostart platform seam that no-ops under IS_APPSTORE (enable/disable resolve, isEnabled→false)"
  - "src/components/UpdaterOverlay.tsx — the direct-only updater surface, lazy-gated out of the store bundle"
  - "the D-03 runtime no-invoke proof: store boot invokes 0 license/updater IPC, reaches iap.currentEntitlements"
  - "a deterministic update.e2e.ts (waits for __injectUpdate across the lazy mount)"
affects:
  - "src/App.tsx (updater surface removed, UpdaterOverlay lazy switch added)"
  - "src/components/GeneralSettings.tsx (launch-at-login IS_APPSTORE-gated)"
  - "src/lib/platform/tauri.ts (autostart arm IS_APPSTORE no-op)"
tech-stack:
  added: []
  patterns:
    - "build-time IS_APPSTORE ? null : lazy(() => import(...)) static-switch-over-dynamic-import tree-shake (the UpsellSurface idiom)"
    - "runtime no-invoke assertion as the compile-out safety proof (keygen-compileout-d04-proof), not a string/package grep"
    - "browser.waitUntil(window.__injectUpdate) to make a DEV e2e injector deterministic across an async lazy-chunk mount"
key-files:
  created:
    - "src/components/UpdaterOverlay.tsx"
    - "src/lib/platform/tauri.test.ts"
  modified:
    - "src/App.tsx"
    - "src/App.test.tsx"
    - "src/components/GeneralSettings.tsx"
    - "src/components/GeneralSettings.test.tsx"
    - "src/lib/platform/tauri.ts"
    - "src/main.test.tsx"
    - "test/e2e/update.e2e.ts"
decisions:
  - "Extract the WHOLE updater overlay (not per-effect gating) so the store bundle contains NO updater UI subtree by construction — supersedes the prior incoherent per-effect gating that left the opt-in prompt + UpdateBanner + useUpdater shipping"
  - "The inert @tauri-apps/plugin-updater plugin JS still rides along via the shared tauri.ts seam (D-05, like plugin-autostart) — its safety is the runtime 0-call assertion, NOT bundle exclusion"
  - "Keep onToggleLaunchAtLogin/announcement defined (dead in store) to keep the direct diff minimal; only the toggle that calls them is gated out"
metrics:
  duration_min: 19
  tasks: 2
  files_changed: 9
  completed: "2026-06-24"
requirements: [MAS-NATIVE-04, MAS-NATIVE-03, MAS-NATIVE-02]
---

# Phase 29 Plan 02: Sandbox-Safe Frontend (launch-at-login absent + updater overlay extracted) Summary

Made launch-at-login FULLY ABSENT from the store build's General pane (D-04), no-op'd the autostart platform seam under `IS_APPSTORE` (D-05), added the load-bearing D-03 runtime proof (the store boot path invokes zero `platform.license.*`/`platform.updater.check` IPC), and — the iteration-2 revision — REMOVED the entire App-shell updater surface from the store build by extracting it into a new direct-only `UpdaterOverlay.tsx` gated behind a build-time `IS_APPSTORE` lazy-import switch.

## What shipped

**Task 1 — launch-at-login hidden in the store build (D-04 / MAS-NATIVE-04)** (`fad08368`)
- `GeneralSettings.tsx`: the launch-at-login `SettingToggle` + helper + the polite live-region are wrapped in `{!IS_APPSTORE && ...}`; the OS-truth reconcile `useEffect` body early-returns under `IS_APPSTORE` (hook still called unconditionally — only its body is gated), so the store bundle drops the `platform.autostart.isEnabled()` call.
- The "Start in the menu bar" toggle + the "Open to" default-tool selector stay UNGATED (pane not empty).
- Tests: store build (no toggle, no `isEnabled`) + direct build (toggle + one `isEnabled`) via a `vi.hoisted` channel-mock flip.

**Task 2 — extract the whole updater overlay + gate it out of the store build (MAS-NATIVE-02/03)** (`216869aa`)
- **New `src/components/UpdaterOverlay.tsx`** (default export) owns the ENTIRE updater surface moved verbatim from App.tsx: `useUpdater()`, the launch auto-check effect (+ `launchChecked` ref), the `menu://check-updates` listener effect, the status auto-clear timer, the DEV `__injectUpdate` injector, the `showOptIn` computation, the bottom-right overlay JSX (opt-in + `UpdateBanner` + status toast), and the inline `UpdateOptIn` component. `setAutoUpdateCheck` migrated here with it.
- **`App.tsx`** deletes every moved piece + its imports and adds `const UpdaterOverlay = IS_APPSTORE ? null : lazy(() => import("./components/UpdaterOverlay"))`, rendered `{!IS_APPSTORE && UpdaterOverlay ? <Suspense fallback={null}><UpdaterOverlay /></Suspense> : null}`. The `menu://open-settings` listener + settings/upsell wiring STAYED in App.tsx (needed in both builds). `lazy`/`Suspense`/`useEffect` retained; `useRef`, `prefsLoaded`, `setAutoUpdateCheck` dropped from App.tsx.
- **`tauri.ts`** autostart arm no-ops under `IS_APPSTORE`: `enable`/`disable` → `Promise.resolve()`, `isEnabled` → `Promise.resolve(false)` (belt-and-suspenders so a stray call never reaches the compiled-out plugin — T-29-05).
- **`main.test.tsx`** D-03 assertion: with `IS_APPSTORE` true + a Tauri env, drives the real store-boot resolution against a spied platform and asserts `license_status`/`license_status_detail`/`activate_license`/`refresh_license`/`deactivate_machine` + the updater `check` spies are each called 0 times while `iap.currentEntitlements` is reached ≥1.
- **`App.test.tsx`** store-build cases: mount App with `IS_APPSTORE` true → no `#update-optin`, no `#update-banner`, `onMenuCheckUpdates` 0 calls, `updater.check` 0 calls — tested with `autoUpdateCheck` both null (opt-in trigger) AND true (auto-check trigger). The 3 existing direct D-25-3 cases stay green (the lazy overlay mounts; `waitFor` lets the effects fire).
- **`tauri.test.ts`** (new): autostart seam no-op (store, 0 plugin calls) vs delegate (direct, ≥1 each).
- **`update.e2e.ts`**: `browser.waitUntil(() => typeof window.__injectUpdate === "function")` before the injector call — deterministic across the lazy overlay's async-chunk mount.

## Verification

- `pnpm test` full suite **1274/1274** green (+8 vs the 1266 baseline: 1 direct GeneralSettings + 2 store GeneralSettings + 2 store App + 1 D-03 main + 2 tauri-seam).
- `pnpm exec tsc --noEmit` clean.
- All acceptance greps pass: `UpdaterOverlay.tsx` `useUpdater|UpdateBanner|setUpdateInfoForTest`=8 (≥3); App.tsx import grep for the moved symbols = 0 (matches remain only in explanatory comments); `IS_APPSTORE`=6 in GeneralSettings + 5 in tauri.ts; `menu://open-settings`/`onOpenSettings` still in App.tsx; `waitUntil`=1 in update.e2e.ts.
- `git diff --stat src/lib/protobuf/` empty (decoder + 19 tests byte-for-byte untouched).
- **Real-WKWebView e2e (`scripts/e2e-spike.sh`): `update.e2e.ts` PASSED** — the extracted overlay's `__injectUpdate` injector fires after the deterministic wait, the `UpdateBanner` renders + keyboard-dismisses on the real WKWebView (the load-bearing 29-02 proof; vitest cannot cover the async-chunk timing).
- Per-task gate (`/simplify` → `/code-review xhigh` → `/codex:adversarial-review` → `gsd-ui-review`) NOT auto-run by the executor — run at the Phase-29 boundary per the binding harness.

## Deviations from Plan

None — both tasks executed exactly as written (no Rule 1-4 fixes). The autostart-seam-unused-symbol concern was avoided by leaving `onToggleLaunchAtLogin`/`announcement` defined per the plan (they stay referenced in the direct build).

## Deferred Issues (environmental, NOT regressions — logged in `deferred-items.md`)

- **`settings.e2e.ts` "Updates pane … Check button (SET-10)"** fails in the current environment with `got "Update check failed"` instead of `"up to date"`. **Proven NOT caused by this plan:** the SAME spec fails identically on the clean baseline with all 29-02 source changes stashed (App.tsx reverted to its original inline overlay) — the dev-build `@tauri-apps/plugin-updater` `check()` cannot reach the GitHub `latest.json` endpoint from inside the WKWebView right now (shell `curl` to the same URL returns HTTP 200; the app's network path differs). The `runUpdateCheck` flow itself executes correctly end-to-end. Re-run at the Phase-29 human-verify boundary.
- **`iap-spike.e2e.ts`** fails because the IapSpikeBlock removal is Phase 28-05 work that is not landed (28-05 is paused at its human sandbox checkpoint). Out of scope for 29-02.
- **`license-settings`/`license-states`/`ship-gate`** failed only in the first e2e run due to leftover license-state pollution from a killed orphan release app; all PASS from clean state (`license-walkthrough-state-pollutes-e2e`).

## Threat surface

No new trust boundaries. The plan's `<threat_model>` mitigations are satisfied: T-29-05 (autostart no-op), T-29-06 (D-03 no-license-IPC), T-29-07 (launch-at-login removed), T-29-13 (updater overlay tree-shaken out of the store build + runtime 0-call proof).

## Self-Check: PASSED

- Files created exist: `src/components/UpdaterOverlay.tsx`, `src/lib/platform/tauri.test.ts` — FOUND.
- Commits exist: `fad08368` (Task 1), `216869aa` (Task 2) — FOUND in `git log`.
- Decoder + 19 tests untouched: `git diff --stat src/lib/protobuf/` empty — CONFIRMED.
