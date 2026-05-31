---
phase: 05-native-polish
plan: 01
subsystem: native-rust
tags: [tauri, single-instance, tray, window-state, global-shortcut, capabilities]
requires:
  - "src-tauri/src/lib.rs builder (clipboard + store + webdriver double-gate)"
  - "src-tauri/icons/ (default_window_icon for the tray)"
provides:
  - "single-instance plugin (FIRST) — second launch focuses the existing window"
  - "tray icon + Show/Quit menu wired to summon the main window"
  - "tauri-plugin-window-state registered — geometry persists across relaunch"
  - "tauri-plugin-global-shortcut registered + capability grants (JS register lands in Plan 02)"
  - "window visible:false for flash-free geometry restore"
affects:
  - "Plan 02 (JS seam: window summon + nativeShortcut.register through src/lib/platform/)"
  - "Plan 03 (shell wiring: register the summon chord on startup)"
tech-stack:
  added:
    - "tauri-plugin-single-instance 2.4.2 (Rust, cfg-targeted)"
    - "tauri-plugin-global-shortcut 2.3.2 (Rust, cfg-targeted)"
    - "tauri-plugin-window-state 2.4.1 (Rust, cfg-targeted)"
    - "tauri crate tray-icon feature"
  patterns:
    - "single-instance registered FIRST in the builder (official docs / Pitfall 4)"
    - "summon order unminimize -> show -> set_focus everywhere (D-03, issue #12834)"
    - "least-privilege capability grants (no wildcard window/shortcut perms)"
    - "cfg(any(target_os=...)) target-scoped deps (supported idiom vs unsupported cfg(debug_assertions))"
key-files:
  created: []
  modified:
    - "src-tauri/Cargo.toml"
    - "src-tauri/src/lib.rs"
    - "src-tauri/capabilities/default.json"
    - "src-tauri/tauri.conf.json"
decisions:
  - "D-02 adopted: regular dock app + tray (no ActivationPolicy::Accessory)"
  - "D-03 adopted: minimize()/unminimize() over hide(); summon = unminimize -> show -> set_focus"
  - "Tray left-click summons (show_menu_on_left_click(false) so left-click raises the window, menu stays on right-click)"
metrics:
  duration: "~3 min (logic; cargo release build dominates wall time)"
  completed: "2026-05-31"
  tasks: 2
  files: 4
requirements: [NAT-02]
---

# Phase 05 Plan 01: Native Rust Foundation Summary

Registered the three official Tauri 2 native plugins (single-instance FIRST, then global-shortcut and window-state), built the macOS tray icon + Show/Quit menu in `setup()`, granted the new capabilities least-privilege, and set the window `visible: false` for flash-free geometry restore — the Rust half of NAT-02 plus the SHL-05/D-11 window-geometry clause. The webdriver release-exclusion double-gate is preserved verbatim and re-verified (`cargo tree --release | grep -c webdriver` = 0). `tauri build` produces a runnable `.app` + `.dmg`.

## What Was Built

- **Task 1 — Cargo.toml** (`da963c26`): enabled the `tray-icon` feature on the `tauri` crate and added the three plugin deps (`tauri-plugin-single-instance = "2.4.2"`, `tauri-plugin-global-shortcut = "2.3.2"`, `tauri-plugin-window-state = "2.4.1"`) in a `[target.'cfg(any(target_os = "macos", windows, target_os = "linux"))'.dependencies]` block — the supported target-scoping idiom (distinct from the unsupported `cfg(debug_assertions)` selector). The `tauri-plugin-webdriver` optional dep and its `[features] webdriver` block are untouched. `cargo check` clean.

- **Task 2 — lib.rs + capabilities + conf** (`55cff023`):
  - **lib.rs**: `tauri_plugin_single_instance::init` is now the FIRST `.plugin()` call (line 17, before global-shortcut/window-state/clipboard/store). Its callback ignores `_argv`/`_cwd` (T-05-02) and summons the `main` window via `unminimize -> show -> set_focus`. Added global-shortcut + window-state plugin registration. Built the tray in `setup()`: a `Menu` with `show` ("Show DevTools") + `quit` ("Quit"), `on_menu_event` summons (show) or `app.exit(0)` (quit), `on_tray_icon_event` left-click-Up summons. Added `use tauri::{menu::..., tray::..., Manager}` imports. The `#[cfg(all(debug_assertions, feature = "webdriver"))]` rebind stays verbatim immediately after the chain.
  - **capabilities/default.json**: appended `global-shortcut:allow-register`, `global-shortcut:allow-unregister`, `global-shortcut:allow-is-registered`, `window-state:default` (least-privilege, no wildcard).
  - **tauri.conf.json**: added `"visible": false` to `app.windows[0]`; `theme: "Dark"`, sizes, and `security.csp` unchanged.

## Verification

- `cargo check` exit 0; full `pnpm tauri build` produced `devtools-app.app` + `devtools-app_0.1.0_aarch64.dmg` (exit 0).
- `cargo tree --release | grep -c webdriver` = **0** (T-01-10/11 intact).
- `grep -n '.plugin(' src/lib.rs`: single_instance first, then global_shortcut, window_state, clipboard_manager, store.
- All three summon sites use `get_webview_window("main")` with `unminimize -> show -> set_focus` order (no focus-before-show).
- lefthook pre-commit green on both commits: **269/269 vitest** (decoder 19 untouched), tsc clean.
- Capability grant + `visible: false` + CSP-unchanged greps all pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Tray left-click summons via `show_menu_on_left_click(false)`**
- **Found during:** Task 2
- **Issue:** In `tray-icon` 0.23 / Tauri 2.11, a tray with a `.menu(...)` set shows the menu on BOTH left- and right-click by default, so the `on_tray_icon_event` left-click handler the plan specifies (summon the window) would never fire — the menu would pop instead, defeating the requested left-click-to-summon behavior.
- **Fix:** Added `.show_menu_on_left_click(false)` so left-click raises the window (via `on_tray_icon_event`) and the menu stays on right-click. This realizes the plan's explicit "on a left-click `Up`, summon the `main` window" instruction.
- **Files modified:** src-tauri/src/lib.rs
- **Commit:** 55cff023

## Manual Verification Required (deferred — human packaged-build sign-off)

The CORE behaviors of this plan are NOT automatable by the WKWebView e2e gate (they are OS/process-level, outside the webview). They are batched into the Phase 5 human sign-off (Plan 04 Task 2), alongside the deferred Phase 4 UAT:
- Second launch of the packaged `.app` focuses the existing window (single-instance).
- Tray icon present in the menu bar; Show raises the window; Quit exits.
- Window position/size persist across quit + relaunch.
- No restore-flash on launch (visible:false path works).

Packaged artifacts to verify: `src-tauri/target/release/bundle/macos/devtools-app.app` (+ `.../dmg/devtools-app_0.1.0_aarch64.dmg`).

## Known Stubs

None — this plan is Rust + config only; no UI surface, no placeholder data. The JS seam (`nativeShortcut`/`window` impls) and shell wiring are deliberately Plan 02/03 scope, not stubs.

## Self-Check: PASSED

- src-tauri/Cargo.toml — FOUND (3 pins + tray-icon present)
- src-tauri/src/lib.rs — FOUND (single_instance first, tray in setup)
- src-tauri/capabilities/default.json — FOUND (4 grants)
- src-tauri/tauri.conf.json — FOUND (visible:false)
- Commit da963c26 — FOUND
- Commit 55cff023 — FOUND
