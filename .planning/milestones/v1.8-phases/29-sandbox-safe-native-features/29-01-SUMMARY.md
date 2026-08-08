---
phase: 29-sandbox-safe-native-features
plan: 01
subsystem: infra
tags: [appstore, sandbox, cargo-feature, keychain, keyring, compile-out, tray-updater, tauri]

# Dependency graph
requires:
  - phase: 27-build-variant-seam
    provides: the default-enabled `direct` umbrella Cargo feature + the `--no-default-features --features appstore` compile-out idiom; the gated-rebind pattern (#[cfg(feature = "direct")] let builder = ...)
  - phase: 28-entitlement-source-swap
    provides: baseFromStoreKit — the store build's Pro state comes ONLY from StoreKit, so the Keygen Rust surface is dead weight in the appstore binary
provides:
  - keyring is an optional crate carried ONLY by the `direct` feature (absent from the appstore cargo tree / Mach-O)
  - the entire `license` Rust module + its LicenseState/refresh-task setup + its command registration are #[cfg(feature = "direct")]
  - the two appstore invoke_handler arms register ONLY the four iap_* commands (zero license commands)
  - the tray "Check for Updates…" item, its slot in the menu slice, and its menu-event arm are #[cfg(feature = "direct")] — the store tray is exactly Show / Settings… / Quit
affects: [29-02 boot-path no-license-IPC assertion, 29-03 signed-bundle entitlement audit + cargo-tree keyring assertion, 30-pkg-submission]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Conditional menu-item slice: build a Vec<&dyn tauri::menu::IsMenuItem<_>> and #[cfg]-push a direct-only item so Menu::with_items is valid under both feature sets (avoids the unused-binding / undefined-binding compile trap)"
    - "cfg'd block expression inside a .setup(|app| { ... }) closure body to compile OUT a contiguous group of statements (not items) for one feature"

key-files:
  created: []
  modified:
    - "src-tauri/Cargo.toml — keyring made optional = true + added to the direct feature list"
    - "src-tauri/src/lib.rs — direct-gated mod license, the setup() license block, the appstore invoke_handler arms, and the tray updater item + its menu-event arm"

key-decisions:
  - "One contiguous #[cfg(feature = \"direct\")] block over the whole setup() license wiring (fingerprint + LicenseManager + manage + refresh task) — lowest churn vs per-statement gating (D-01 discretion)"
  - "Tray item list built as a Vec<&dyn IsMenuItem<_>> with a conditional push (not a #[cfg]-paired pair of Menu::with_items calls) — fewest lines, slice valid under both features"

patterns-established:
  - "Cargo additive-feature compile-out: a sandbox-incompatible dep (keyring) is optional + listed only under `direct`; the store build drops it via --no-default-features --features appstore (no `appstore`-side remove feature)"

requirements-completed: [MAS-NATIVE-03, MAS-NATIVE-02]

# Metrics
duration: 5min
completed: 2026-06-24
---

# Phase 29 Plan 01: Compile the Keygen/keyring license surface + tray updater item OUT of the App Store build Summary

**The entire Keygen license Rust surface (module + keyring dep + LicenseState/refresh wiring + the 4 commands) and the tray "Check for Updates…" item are now `#[cfg(feature = "direct")]`, so the sandboxed App Store binary links no keyring, registers no license command, and ships a Show / Settings… / Quit tray that never drives the compiled-out updater.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-24T09:10:09Z
- **Completed:** 2026-06-24T09:14:36Z
- **Tasks:** 3
- **Files modified:** 2 (`src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`)

## Accomplishments
- `keyring` is now an optional crate under the `direct` feature only — `cargo tree --no-default-features --features appstore | grep keyring` is empty; the direct tree retains it. The store binary links no Keychain FFI and needs no `keychain-access-groups` entitlement (MAS-NATIVE-03).
- The whole `license` module is `direct`-gated and the appstore build compiles with NO `mod license`. Its setup wiring (machine fingerprint, `LicenseManager::new` with `MacKeychain`, the managed `LicenseState`, and the background `refresh_if_needed` tokio task) is wrapped in a `#[cfg(feature = "direct")]` block expression inside the `.setup()` closure. The two appstore `invoke_handler` arms register ONLY the four `iap_*` commands — zero license commands.
- The tray "Check for Updates…" item, its slot in the menu slice, and its `on_menu_event` arm are `direct`-gated — the store tray is exactly Show / Settings… / Quit and never emits `menu://check-updates` (which the frontend would drive into `platform.updater.check()` against the compiled-out updater command = a runtime error on a kept surface). Direct tray byte-behaviourally unchanged; no unused-binding warning.
- Both `cargo build` (direct) and `cargo build --no-default-features --features appstore` exit 0; `cargo build --features webdriver` (the e2e debug build) also exits 0.

## Task Commits

Each task was committed atomically:

1. **Task 1: Make keyring optional under the direct feature (Cargo.toml)** — `41156773` (chore)
2. **Task 2: direct-gate the license module, its setup wiring, and command registration (lib.rs)** — `b64bdc9a` (feat)
3. **Task 3: direct-gate the tray "Check for Updates…" item + its menu-event arm (lib.rs)** — `ba3ea57d` (feat)

## Files Created/Modified
- `src-tauri/Cargo.toml` — `keyring` set `optional = true`; `dep:keyring` added to the `direct` feature list; doc-comments updated (the dep + the `direct` umbrella now note keyring as a direct-only Keychain store, Phase 29 D-02).
- `src-tauri/src/lib.rs` — `#[cfg(feature = "direct")]` over `mod license`; the setup() license block wrapped in a direct-gated block expression; the two appstore `invoke_handler` arms stripped of all `license::commands::*` (iap_* only); the `check_updates_i` binding + its `Vec`-push slot + its `on_menu_event` arm all direct-gated; the 2×2-matrix doc-comment updated.

## Decisions Made
- **One contiguous cfg block over the setup() license wiring** (vs per-statement gating) — lowest churn, mirrors the plan's D-01 discretion note. `.setup()` is a closure body so a cfg'd block expression (not an item attribute) is the correct shape.
- **Tray item list as `Vec<&dyn tauri::menu::IsMenuItem<_>>` with a conditional push** — confirmed `Menu::with_items` takes `&[&dyn IsMenuItem<R>]` against tauri-2.11.2 source; the Vec+push shape is fewer lines than a `#[cfg]`-paired pair of `Menu::with_items` calls and keeps the slice valid (and the `check_updates_i` binding consumed, no unused-variable warning) under both feature sets.

## Deviations from Plan

None - plan executed exactly as written. No Rule 1-4 deviations; all three tasks' acceptance criteria and the overall verification block passed on the first build.

## Issues Encountered
- A grep using `awk` to isolate the appstore arms produced a false-positive `license::` count because the matrix doc-comment prose contains the literal `feature = "appstore"`. Re-checked by inspecting the actual `invoke_handler` blocks directly (`grep -A6 'cfg(all(.*feature = "appstore"))]'`) — both arms register only the four `iap::commands::*`. No code issue; verification artefact only.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- **Source-level MAS-NATIVE-03 (Rust compile-out) + MAS-NATIVE-02 (kept tray works cleanly) are satisfied.** The SIGNED-bundle runtime audit is Plan 29-03's human gate: `codesign -d --entitlements` shows NO `keychain-access-groups`, plus a FATAL `cargo tree --no-default-features --features appstore | grep keyring` assertion folded into `verify-appstore-bundle.sh`.
- **For Plan 29-02:** this plan removed the Rust-side license command registration + the tray event emit; 29-02 handles the frontend boot-path no-license-IPC assertion and gating the `menu://check-updates` listener.
- **No blockers.** Decoder + its 19 tests byte-for-byte untouched (`git diff --stat src/lib/protobuf/` empty); this plan touched only `src-tauri/`.

## Self-Check: PASSED

- `src-tauri/Cargo.toml` — FOUND (keyring `optional = true`, `dep:keyring` in `direct`)
- `src-tauri/src/lib.rs` — FOUND (`#[cfg(feature = "direct")]` over `mod license`, the setup block, the appstore arms, and the tray updater item)
- Commit `41156773` — FOUND
- Commit `b64bdc9a` — FOUND
- Commit `ba3ea57d` — FOUND
- appstore build exit 0 · direct build exit 0 · webdriver build exit 0 · appstore cargo-tree keyring empty · direct cargo-tree keyring present

---
*Phase: 29-sandbox-safe-native-features*
*Completed: 2026-06-24*
