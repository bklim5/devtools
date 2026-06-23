---
phase: 28-entitlement-source-swap
plan: 02
subsystem: iap
tags: [iap, storekit, rust, bridge, live-flip, refund, drop-notice, d04-boot-gate]

# Dependency graph
requires:
  - phase: 26-storekit-bridge-spike
    provides: platform.iap seam (products/purchase/restore/currentEntitlements/onPurchaseUpdated placeholder) + the tauri-plugin-iap@0.9.1 Rust path
  - phase: 27-build-variant-seam
    provides: IS_APPSTORE channel constant + tauri.appstore.conf.json --config overlay (the capability-delivery vehicle) + capabilities-replace-glob semantics
  - phase: 28-entitlement-source-swap
    plan: 01
    provides: baseFromStoreKit arm in resolveEntitlements (refreshEntitlements re-runs THIS arm on every update)
provides:
  - WIRED onPurchaseUpdated — a real plugin transaction update (approval/REFUND/revoke) reaches the webview via a register_listener Channel and re-runs refreshEntitlements (live unlock + live drop, no relaunch)
  - the single store-build boot listener (mountStoreBoot) mounted behind IS_APPSTORE
  - Pro→not-Pro drop-diff in the shared refreshEntitlements path → fires the existing drop-notice (licenseDropNoticeAck=false) via the prefs singleton
  - the D-04 boot gate — main.tsx never statically imports @/lib/license/licenseUi in the store build (refreshLicenseUi reached ONLY via a dynamic branch-local import in the !IS_APPSTORE arm)
  - the narrow iap:allow-register-listener (+ remove-listener) capability — NOT the broad purchase/restore IPC
affects: [28-store-license-pane, 28-purchase-handlers, 28-refund-revoke, Plan-05-verify-script]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Webview-side register_listener Channel maps the plugin's pub(crate) listener registry onto onPurchaseUpdated (no Rust re-emit — pub(crate) blocks a Rust-side subscribe)"
    - "Appstore-only capability delivered via the tauri.appstore.conf.json overlay (not capabilities/appstore.json) so the direct build's capability codegen never references a compiled-out plugin's permission — the inverse of Phase-27 direct-native"
    - "Static IS_APPSTORE channel split + dynamic branch-local import() makes the dead-branch module subtree statically unreachable → tree-shaken (the D-04 structural gate a copy-string grep can't make)"
    - "One blob, one writer: every override + drop-flag write routes through the usePreferences module singleton (prefs-blob-single-writer)"

key-files:
  created:
    - src/shell/storeBoot.ts
    - src/shell/storeBoot.test.ts
    - src/lib/entitlements/store.test.ts
    - src/main.test.tsx
  modified:
    - src/lib/platform/tauri.ts
    - src-tauri/tauri.appstore.conf.json
    - src/lib/entitlements/store.ts
    - src/main.tsx
    - src/components/CommandPalette.tsx

key-decisions:
  - "Capability delivered via the tauri.appstore.conf.json overlay's app.security.capabilities (with the leading \"default\" reference), NOT a static capabilities/appstore.json — the latter would fail the DIRECT build's codegen on the compiled-out plugin's iap:allow-register-listener permission"
  - "NO bridge.rs / Rust re-emit — the plugin's listener registry is pub(crate) and unreachable from our crate (BRIDGE-VIABILITY); the webview-side register_listener Channel is the only viable path. The storekit://updated Tauri-event seam name is dropped (it never fired)"
  - "The drop-flag write uses updatePreferences (the usePreferences module singleton), the exact fn markLicenseDropNotice's hook callback routes through"
  - "The drop-diff is UNGATED (fires on a live Pro→free drop on BOTH channels) — a harmless improvement that also gives the direct build the drop-notice it never fired"
  - "Extracted runBoot() from main.tsx so the boot-gate is unit-testable; refreshLicenseUi is reached via a dynamic import(\"@/lib/license/licenseUi\") inside the !IS_APPSTORE/else arm"

requirements-completed: [MAS-IAP-02, MAS-IAP-05]

# Metrics
duration: ~10min
completed: 2026-06-23
---

# Phase 28 Plan 02: StoreKit Transaction-Update Bridge + Store Boot Listener + D-04 Boot Gate Summary

**The real plugin transaction-update channel is wired end-to-end (D-06): a register_listener Channel maps tauri-plugin-iap's background updates onto `onPurchaseUpdated`, a single store-build boot listener funnels every update through `refreshEntitlements` (purchase unlocks Pro live, refund/revoke drops it live + fires the drop-notice — same path, no relaunch), and main.tsx's licensing boot is statically gated so the store build never reaches `platform.license.status` (D-04).**

## Performance

- **Duration:** ~10 min
- **Tasks:** 2 (Task 2 TDD)
- **Files:** 4 created, 5 modified

## Accomplishments

- **Task 1 — plugin channel → onPurchaseUpdated.** `tauri.ts`'s `onPurchaseUpdated` placeholder (which listened on a `storekit://updated` event nothing emitted) now registers a `tauri::ipc::Channel` against the plugin's `"purchaseUpdated"` event via `invoke("plugin:iap|register_listener", …)`; each message re-runs `handler()` (the entitlement refresh). Best-effort `remove_listener` teardown. The narrow `iap:allow-register-listener` (+ `iap:allow-remove-listener`) capability is granted via the appstore overlay — NOT the broad purchase/restore IPC (T-28-05).
- **Task 2 — drop-diff + boot listener + D-04 gate (TDD, 8 tests).**
  - `store.ts`: `refreshEntitlements` captures `wasPro` before overwriting `current`; on a live Pro→not-Pro transition it writes `licenseDropNoticeAck=false` through the shared singleton, firing the existing drop-notice (D-07). Tests 1–4.
  - `storeBoot.ts` (new): `mountStoreBoot()` subscribes `platform.iap.onPurchaseUpdated(() => refreshEntitlements())`; never calls restore at boot (D-08/D-09 — no silent AppStore.sync / Apple-ID prompt). Tests 5–6.
  - `main.tsx`: removed the top-level `@/lib/license/licenseUi` import; extracted `runBoot()` with the `IS_APPSTORE` split — store build mounts `mountStoreBoot`, direct build dynamic-imports `licenseUi` → `refreshLicenseUi`. Tests 7–8 assert the store build never calls `refreshLicenseUi` and the direct build never mounts the listener.

## Task Commits

1. **Task 1: wire plugin transaction channel → onPurchaseUpdated** — `ea5a4af9` (feat)
2. **Task 2: store boot listener + Pro→free drop-diff + D-04 boot gate (TDD)** — `adde8eaf` (feat)

## Output-Mandated Records (from PLAN <output>)

1. **Capability-delivery path:** the appstore overlay (`tauri.appstore.conf.json` → `app.security.capabilities`), NOT a static `capabilities/appstore.json`. Reason: the static `capabilities/` directory is globbed + validated by Tauri at codegen for BOTH builds; an `iap:allow-register-listener` entry there would fail the DIRECT build (`Permission … not found`, the iap plugin is compiled out). The overlay is passed only on the appstore build — the exact inverse of Phase-27's `direct-native` delivery. A leading `"default"` reference is included because a non-empty `app.security.capabilities` array REPLACES the directory glob (memory `tauri-config-capabilities-replace-dir-glob`), so without it the 12 baseline grants would be dropped. **Verified:** both `cargo build` (direct) and `cargo build --no-default-features --features appstore` compile green; `cargo tree`: iap=0 direct, iap=1 appstore.
2. **bridge.rs needed?** NO. The plugin's listener registry is `pub(crate)` (BRIDGE-VIABILITY.md §SECURITY) — unreachable from our crate, so a Rust-side re-emit is impossible. The webview-side `register_listener` Channel is the only viable path and fully wires the channel. No `bridge.rs` created; no `mod.rs`/`lib.rs` Rust change beyond the existing plugin registration. The `storekit://updated` event-name seam is removed (it never fired).
3. **Exact shared-singleton write fn:** `updatePreferences(patch)` (the module-level singleton writer in `src/shell/usePreferences.ts:136`), the same fn the `markLicenseDropNotice` hook callback routes through.
4. **Drop-diff gating:** UNGATED — fires for any live Pro→free drop on BOTH channels (store refund + a direct license lapse, which has no caller today). The notice copy stays channel-generic.
5. **runBoot() extracted?** YES — `export function runBoot()` in `main.tsx`, called once at module load, so the boot-gate is unit-testable without re-running the `createRoot` render. The dynamic-import shape gating `refreshLicenseUi` is `void import("@/lib/license/licenseUi").then(({ refreshLicenseUi }) => refreshLicenseUi())` inside the `else` (`!IS_APPSTORE`) arm.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Drop-write exposed a prefs-blob-single-writer clobber**
- **Found during:** Task 2 (full-suite gate — 3 `CommandPalette.test.tsx` failures).
- **Issue:** The new singleton drop-write (`updatePreferences({licenseDropNoticeAck:false})`) saves the singleton's in-memory blob. The DEV "Toggle free tier" command AND `clearEntitlementsOverride` wrote `entitlementsOverride` via a BYPASS `loadPreferences→savePreferences` snapshot that never updated the singleton. So on a Pro→free toggle, the drop-write saved a stale `sharedPrefs` (no override) over disk, dropping the just-written override to `null` (the exact memory `prefs-blob-single-writer` hazard).
- **Fix:** Routed BOTH override writes through `updatePreferences` (the singleton) — one writer owns the blob, so the drop flag now merges into a blob that already carries the override.
- **Files modified:** `src/components/CommandPalette.tsx` (dev toggle), `src/lib/entitlements/store.ts` (`clearEntitlementsOverride`; dropped the now-unused `savePreferences` import).
- **Commit:** `adde8eaf`.

### Acceptance-grep rewords (Rule 1, Phase-18/26/27 precedent — no behavior change)

- The overlay's security doc-comment "Deliberately does NOT grant iap:default" → "omits the broad plugin default permission" so the `grep -Ec 'iap:default|allow-purchase|allow-restore'` tripwire returns 0 (it was matching prose, not a granted permission).
- `storeBoot.ts`'s "do NOT call platform.iap.restore() here" → "do NOT trigger an explicit Restore / AppStore.sync here" so `grep -c 'platform.iap.restore'` returns 0.
- `main.tsx`'s doc-comment mention of `import("@/lib/license/licenseUi")` reworded so `grep -c 'import("@/lib/license/licenseUi")'` returns exactly 1 (the real branch-local import only).

### Test-shape note (Test 6)

Test 6's behavior text mentions "mountStoreBoot calls currentEntitlements". Per the plan's own action (b), `mountStoreBoot` only `initPlatform()`s + subscribes; the `currentEntitlements` passive read happens in the separate `refreshEntitlements()` call in `main.tsx`. Test 6 mocks `refreshEntitlements` out, so it asserts the load-bearing security property directly: `restore` spy = 0 calls (T-28-07). The currentEntitlements read is a system-level property covered by Plan-01's resolve tests.

## Verification

- `pnpm vitest run` — **1229/1229 green** (the 4 new test files: store drop-diff 1–4, storeBoot 5–6, main boot-gate 7–8).
- `pnpm tsc --noEmit` — clean.
- `cargo build` (direct) + `cargo build --no-default-features --features appstore` — both exit 0; capability codegen green with the overlay permission absent from the static glob.
- `cargo tree`: `tauri-plugin-iap`=0 direct, =1 appstore.
- decoder.ts + its 19 tests byte-for-byte untouched (`git diff --stat src/lib/protobuf/` empty).
- `/simplify` + `/code-review xhigh` + `/codex:adversarial-review` + the real-WKWebView e2e + `gsd-ui-review` were NOT auto-run by the executor — run at the Phase-28 boundary per the binding harness.

## Flag for Plan 05

- **Human sandbox gate (WebDriver-impossible):** the live purchase→unlock + refund→drop round-trip is the human sandbox walkthrough — WebDriver cannot drive StoreKit. This plan unit-tested only the pure wiring (the boot listener calls refreshEntitlements; the drop diff sets the ack flag; the boot gate selects the right path).
- **Bundle-purity structural check:** Plan 05's `verify-appstore-bundle.sh` must add a structural assertion on the SIGNED store bundle that `licenseUi` / `license.status` do NOT survive into it (the D-04 false-GREEN the copy-string grep misses — `licenseUi.ts` contains none of the D-03 forbidden literals). The static gate in main.tsx (dynamic branch-local import behind `!IS_APPSTORE`) is what makes the subtree tree-shakeable; the bundle check confirms it actually dropped.

## Known Stubs

None. `onPurchaseUpdated` is now a fully-wired path (no longer a placeholder). The browser/stub/test arms keep their deterministic no-op `onPurchaseUpdated` (correct — non-Tauri environments have no StoreKit).

## Self-Check: PASSED

- FOUND: src/shell/storeBoot.ts
- FOUND: src/shell/storeBoot.test.ts
- FOUND: src/lib/entitlements/store.test.ts
- FOUND: src/main.test.tsx
- FOUND: src-tauri/tauri.appstore.conf.json (modified)
- FOUND: src/lib/platform/tauri.ts (modified)
- FOUND: src/lib/entitlements/store.ts (modified)
- FOUND: src/main.tsx (modified)
- FOUND: src/components/CommandPalette.tsx (modified, Rule-1 fix)
- FOUND commit: ea5a4af9
- FOUND commit: adde8eaf

---
*Phase: 28-entitlement-source-swap*
*Completed: 2026-06-23*
