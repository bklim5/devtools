# Phase 5: Native Polish - Research

**Researched:** 2026-05-31
**Domain:** Tauri 2 macOS native integration (global shortcut, single-instance, tray/menu, window-geometry persistence) behind the `src/lib/platform/` seam
**Confidence:** HIGH (versions + plugin APIs verified against crates.io/npm + official Tauri v2 docs; macOS focus pitfall MEDIUM — community-sourced, cross-checked against multiple open issues)

## Summary

Phase 5 adds four macOS-native capabilities — a global summon shortcut (NAT-01), single-instance behavior, tray/menu presence (NAT-02), and window-geometry persistence (SHL-05's deferred clause, D-11) — all of which must be routed through the existing `src/lib/platform/` seam so tools/shell never import `@tauri-apps/*` directly. The codebase already has a clean, proven seam pattern: `index.ts` exposes a synchronous `platform` accessor backed by a browser fallback, lazily swaps in the real Tauri impl (`tauri.ts`, the ONLY file allowed to import `@tauri-apps/*`) on `initPlatform()` when `__TAURI_INTERNALS__` is present, and provides `setPlatformForTest`/`resetPlatformForTest` for jsdom tests. The new native surface (`window` summon/focus + `nativeShortcut` register/unregister + `windowState` persistence) extends `Platform` exactly as `clipboard`/`store` did — real impl in `tauri.ts`, graceful no-ops in `browser.ts`/`stub.ts`.

The split between Rust and JS matters. **Single-instance and the tray icon/menu are Rust-only** (configured in `src-tauri/src/lib.rs`; the tray has no JS API and single-instance has no JS API / no capability). The **global shortcut** and **window-geometry** plugins have JS APIs that route through the seam, plus Rust registration + capability grants. Single-instance MUST be the first plugin registered in the builder (Tauri docs). Window-geometry should use the official `tauri-plugin-window-state` plugin rather than hand-rolling through the prefs seam — it auto-saves position+size and handles macOS edge cases, and a hand-rolled approach would require Rust-side window event listeners the prefs seam can't reach.

The dominant risk is the **macOS show-from-hidden + set_focus** behavior: there is a documented regression (Tauri 2.3+) and several open issues where `set_focus` after `window.hide()` does not raise/activate the app. The summon flow must call `show()` → `unminimize()` → `set_focus()` (and likely a Rust-side `app.set_activation_policy(Regular)` / `NSApp activate`), and this is the one behavior the automated WKWebView e2e gate CANNOT fully verify (global hotkeys fire at the OS level, outside the webview) — it requires the phase-boundary human packaged-build sign-off.

**Primary recommendation:** Add native window/shortcut/window-state capabilities to the `Platform` interface (real impl in `tauri.ts`, no-ops in `browser.ts`/`stub.ts`); register `tauri-plugin-single-instance` FIRST in `lib.rs`, then global-shortcut, store, clipboard, window-state; build the tray + menu in Rust `setup()`; use `tauri-plugin-window-state` for geometry (NOT the prefs seam); and treat all show/focus/raise behavior as human-sign-off-verified, not e2e-verified.

## Standard Stack

All versions verified 2026-05-31. Pin to the Tauri **2.x** line; the repo's `Cargo.lock` pins `tauri 2.11.2`. Plugin minor versions float within `2` per the existing Cargo convention (`tauri = { version = "2" }`), but the table records the current published version for the planner.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `tauri-plugin-single-instance` (Rust) | 2.4.2 | Second launch focuses existing window instead of opening a new one | Official Tauri plugin; the canonical single-instance solution. No JS counterpart. [VERIFIED: crates.io 2026-05-31] |
| `tauri-plugin-global-shortcut` (Rust) | 2.3.2 | Register the global summon hotkey at the OS level | Official Tauri plugin; the documented "right way" for system-wide shortcuts. [VERIFIED: crates.io 2026-05-31] |
| `@tauri-apps/plugin-global-shortcut` (JS) | 2.3.2 | JS `register`/`unregister`/`isRegistered` called from the platform seam | Official JS binding for the above. [VERIFIED: npm 2026-05-31] |
| `tauri-plugin-window-state` (Rust) | 2.4.1 | Persist + restore window position/size across restarts (SHL-05/D-11) | Official Tauri plugin; auto-saves geometry and handles macOS restore-flash. [VERIFIED: crates.io 2026-05-31] |
| `@tauri-apps/plugin-window-state` (JS) | 2.4.1 | Optional JS `saveWindowState`/`restoreStateCurrent` (manual control) | Official JS binding; mostly auto, JS used only if manual save needed. [VERIFIED: npm 2026-05-31] |
| `tauri` crate `tray-icon` feature | (within 2.11.2) | System tray icon + menu | Built into the `tauri` crate — enable the `tray-icon` Cargo feature; no separate plugin. [CITED: v2.tauri.app/learn/system-tray] |
| `@tauri-apps/api` (`window`, `app`) | ^2 (already a dep) | `getCurrentWindow().show()/setFocus()/unminimize()` for the seam's summon impl | Core API, already installed. [VERIFIED: package.json] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tauri-apps/api/window` | ^2 | `Window`/`getCurrentWindow` for show/focus/visibility checks from JS | When the summon flow is driven from JS rather than purely Rust |
| `@tauri-apps/api/event` | ^2 | Listen for a Rust-emitted "summon" event to deep-link via hash route | If the global-shortcut handler lives in Rust and JS needs to react (e.g. focus a tool) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `tauri-plugin-window-state` | Hand-rolled geometry persistence via the existing prefs seam (`Preferences` + `usePreferences`) | Hand-rolling needs Rust-side `WindowEvent::Moved`/`Resized` listeners (debounced) to capture geometry, plus restore-on-startup before show — the prefs `Store` seam (a `get`/`set` blob) cannot observe window events. The official plugin does all this and handles the macOS restore-flash (`visible:false` → plugin shows). Hand-rolling is strictly more code + more macOS edge cases for no benefit. **Recommend the plugin.** [CITED: v2.tauri.app/plugin/window-state] |
| Global shortcut registered in **Rust** | Global shortcut registered in **JS** via the seam | JS registration keeps the chord/handler logic near the UI and routes cleanly through `src/lib/platform/` (matches the seam discipline). Rust registration avoids a JS→Rust round-trip on summon but means the summon/focus logic lives in Rust and JS only reacts to an event. **Recommend JS registration through the seam** for NAT-01 unless the macOS focus pitfall forces the show/focus into Rust (see Pitfalls). |
| Tray built in Rust `setup()` | Tray configured in `tauri.conf.json` | Tauri 2 tray is **Rust-only** — there is no `tauri.conf.json` tray config and the menu/event handlers must be Rust closures. No real alternative. [CITED: v2.tauri.app/learn/system-tray] |

**Installation:**
```bash
# Rust (run in src-tauri/, or hand-edit Cargo.toml + capabilities)
cargo add tauri-plugin-single-instance --target 'cfg(any(target_os = "macos", windows, target_os = "linux"))'
cargo add tauri-plugin-global-shortcut --target 'cfg(any(target_os = "macos", windows, target_os = "linux"))'
cargo add tauri-plugin-window-state --target 'cfg(any(target_os = "macos", windows, target_os = "linux"))'
# Enable the tray-icon feature on the tauri crate (Cargo.toml):
#   tauri = { version = "2", features = ["tray-icon"] }

# JS
pnpm add @tauri-apps/plugin-global-shortcut@2 @tauri-apps/plugin-window-state@2
```

> Note: `cargo add ... --target 'cfg(...)'` writes a `[target.'cfg(...)'.dependencies]` block. Per the existing repo note in `Cargo.toml`, `cfg(debug_assertions)` is NOT supported for dependency selection, but `cfg(any(target_os = ...))` IS the documented, supported idiom for these plugins. [VERIFIED: codebase Cargo.toml note + CITED: v2.tauri.app plugin install commands]

**Version verification (run before locking the plan):**
```bash
# Rust
curl -s "https://crates.io/api/v1/crates/tauri-plugin-global-shortcut/versions" -H "User-Agent: x"  # → 2.3.2
curl -s "https://crates.io/api/v1/crates/tauri-plugin-single-instance/versions" -H "User-Agent: x"   # → 2.4.2
curl -s "https://crates.io/api/v1/crates/tauri-plugin-window-state/versions" -H "User-Agent: x"       # → 2.4.1
# JS
npm view @tauri-apps/plugin-global-shortcut version   # → 2.3.2
npm view @tauri-apps/plugin-window-state version       # → 2.4.1
```

## Architecture Patterns

### Recommended Project Structure (extends existing seam)
```
src/lib/platform/
├── index.ts        # Platform interface + sync accessor + initPlatform (EXTEND: add window/nativeShortcut/windowState)
├── tauri.ts        # ONLY file importing @tauri-apps/* — add real impls here
├── browser.ts      # browser fallback — add NO-OP impls (summon = no-op, register = no-op resolving false)
├── stub.ts         # in-memory Store stub + Store type (test seam)
└── platform.test.ts / store.test.ts  # seam tests (EXTEND: assert new caps are no-ops in browser, present in shape)

src-tauri/src/lib.rs       # EXTEND: single-instance FIRST, then global-shortcut, window-state, store, clipboard; tray in setup()
src-tauri/capabilities/default.json  # EXTEND: add global-shortcut:allow-* and window-state:default
src-tauri/Cargo.toml       # EXTEND: 3 plugins (cfg-targeted) + tray-icon feature on tauri
```

### Pattern 1: Extend the `Platform` interface (the seam discipline)
**What:** Add the native capabilities to the `Platform` interface so the synchronous `platform` accessor exposes them via getters, exactly like `clipboard`/`store` today.
**When to use:** For every native capability tools/shell will touch.
**Example:**
```typescript
// Source: extends src/lib/platform/index.ts (existing repo pattern)
export interface Platform {
  clipboard: { writeText(t: string): Promise<void>; readText(): Promise<string> };
  store: Store;
  /** Window control for the summon/focus flow (NAT-01). No-op in browser. */
  window: {
    show(): Promise<void>;
    setFocus(): Promise<void>;
    unminimize(): Promise<void>;
    isVisible(): Promise<boolean>;
    hide(): Promise<void>;
  };
  /** Global (OS-level) shortcut registration (NAT-01). No-op/false in browser. */
  nativeShortcut: {
    register(accelerator: string, handler: () => void): Promise<void>;
    unregister(accelerator: string): Promise<void>;
    isRegistered(accelerator: string): Promise<boolean>;
  };
}
// platform accessor adds: get window() { return active.window } etc. (getter-per-capability,
// so adding a capability flows through automatically — same note already in index.ts).
```

### Pattern 2: Real impl in `tauri.ts` (the only `@tauri-apps/*` importer)
**What:** Implement the new capabilities against `@tauri-apps/api/window` and `@tauri-apps/plugin-global-shortcut` in `tauri.ts` only.
**When to use:** Always — never import these plugins anywhere else.
**Example:**
```typescript
// Source: extends src/lib/platform/tauri.ts (the ONLY @tauri-apps importer)
import { getCurrentWindow } from "@tauri-apps/api/window";
import { register, unregister, isRegistered } from "@tauri-apps/plugin-global-shortcut";

const win = () => getCurrentWindow();
export const tauriPlatform: Platform = {
  // ...clipboard, store...
  window: {
    // macOS pitfall: order matters — unminimize + show BEFORE setFocus. See Pitfalls.
    async show() { await win().show(); },
    async unminimize() { await win().unminimize(); },
    async setFocus() { await win().setFocus(); },
    async isVisible() { return win().isVisible(); },
    async hide() { await win().hide(); },
  },
  nativeShortcut: {
    register: (acc, h) => register(acc, (e) => { if (e.state === "Pressed") h(); }),
    unregister: (acc) => unregister(acc),
    isRegistered: (acc) => isRegistered(acc),
  },
};
```

### Pattern 3: Graceful no-op in `browser.ts` / `stub.ts`
**What:** Browser fallback implements the same shape as harmless no-ops so `vite preview`, jsdom tests, and the chrome-devtools preview never throw.
**When to use:** Always — the seam must degrade, not crash, outside Tauri.
**Example:**
```typescript
// Source: extends src/lib/platform/browser.ts
window: {
  async show() {}, async setFocus() {}, async unminimize() {},
  async isVisible() { return true; }, async hide() {},
},
nativeShortcut: {
  async register() {}, async unregister() {}, async isRegistered() { return false; },
},
```

### Pattern 4: Single-instance registered FIRST in Rust
**What:** `tauri-plugin-single-instance` must be the FIRST `.plugin()` call in the builder, with a callback that shows + unminimizes + focuses the existing main window.
**When to use:** Always for single-instance.
**Example:**
```rust
// Source: v2.tauri.app/plugin/single-instance/ (adapted with macOS focus order)
tauri::Builder::default()
    .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
        if let Some(w) = app.get_webview_window("main") {
            let _ = w.unminimize();
            let _ = w.show();
            let _ = w.set_focus();
        }
    }))
    // THEN the other plugins:
    .plugin(tauri_plugin_global_shortcut::Builder::new().build())
    .plugin(tauri_plugin_window_state::Builder::default().build())
    .plugin(tauri_plugin_store::Builder::new().build())
    .plugin(tauri_plugin_clipboard_manager::init())
    .setup(|app| { /* build tray here */ Ok(()) })
```
[CITED: v2.tauri.app/plugin/single-instance — "must be the first one to be registered"]

### Pattern 5: Tray icon + menu in Rust `setup()`
**What:** Build a `TrayIconBuilder` with a `Menu` (Show/Hide + Quit) and click handler in `setup()`.
**Example:**
```rust
// Source: v2.tauri.app/learn/system-tray/
use tauri::{menu::{Menu, MenuItem}, tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState}};
let show_i = MenuItem::with_id(app, "show", "Show DevTools", true, None::<&str>)?;
let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
let menu = Menu::with_items(app, &[&show_i, &quit_i])?;
TrayIconBuilder::new()
    .icon(app.default_window_icon().unwrap().clone())
    .menu(&menu)
    .on_menu_event(|app, event| match event.id.as_ref() {
        "show" => { if let Some(w) = app.get_webview_window("main") { let _=w.show(); let _=w.set_focus(); } }
        "quit" => app.exit(0),
        _ => {}
    })
    .on_tray_icon_event(|tray, event| {
        if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
            if let Some(w) = tray.app_handle().get_webview_window("main") { let _=w.show(); let _=w.set_focus(); }
        }
    })
    .build(app)?;
```
Requires `tauri = { version = "2", features = ["tray-icon"] }`. [CITED: v2.tauri.app/learn/system-tray]

### Anti-Patterns to Avoid
- **Importing `@tauri-apps/plugin-global-shortcut` or `@tauri-apps/api/window` outside `tauri.ts`:** violates the seam (FND-04, CLAUDE.md). The grep audit (`grep -rn "@tauri-apps" src/`) must still show imports ONLY in `tauri.ts`.
- **Hand-rolling window-geometry persistence through the `Store` prefs seam:** the prefs blob can't observe window move/resize events; use `tauri-plugin-window-state`. Do NOT widen `Preferences`/`Store` for geometry.
- **Registering single-instance after other plugins:** it must be first or it can fail to suppress the second instance. [CITED: official docs]
- **Calling `set_focus()` before `show()`/`unminimize()` on macOS:** focus on a hidden/minimized window is a no-op and the documented regression bites here (see Pitfall 1).
- **Relying on the e2e gate to verify the global hotkey:** the WebDriver gate drives the WKWebView DOM; an OS-level global hotkey and app activation happen outside it. Verify via human sign-off.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Window position/size persistence | Custom geometry capture + restore via prefs `Store` | `tauri-plugin-window-state` | Needs Rust window-event listeners + debounce + restore-before-show + macOS flash handling; the plugin does all of it. [CITED] |
| Single-instance detection | Custom lockfile / port-bind in Rust | `tauri-plugin-single-instance` | Cross-process IPC + argv forwarding + platform quirks already solved. [CITED] |
| OS-level global hotkey | OS keyboard hook / native API | `tauri-plugin-global-shortcut` | Native registration, conflict detection ("if taken by another app, handler won't fire"), Pressed/Released states. [CITED] |
| Tray icon + menu | Native NSStatusItem code | `tauri` `tray-icon` feature (`TrayIconBuilder`) | First-class Tauri API, menu + events handled. [CITED] |

**Key insight:** Every native capability in this phase has an official, maintained Tauri 2 plugin or core feature. The only bespoke code is (a) the thin seam wiring in `src/lib/platform/`, (b) the summon/focus orchestration (with the macOS ordering workaround), and (c) the menu item set + the deep-link-to-hash-route glue.

## Common Pitfalls

### Pitfall 1: macOS `set_focus` / show-from-hidden does not raise the app
**What goes wrong:** After `window.hide()`, a later `show()` + `set_focus()` (from the global hotkey or single-instance callback) may not bring the app to the foreground / give it keyboard focus on macOS. Documented regression from Tauri 2.0→2.3, with multiple open issues. [VERIFIED: GitHub issues #12834, #12936, #7540, plugins-workspace #1613]
**Why it happens:** macOS app activation policy + AppKit window ordering: a hidden window isn't a key window candidate, and `set_focus` alone doesn't re-activate the NSApplication. `hide()` (vs `minimize()`) is specifically implicated — community reports note `minimize()` works where `hide()` doesn't.
**How to avoid:**
- Order the calls: `unminimize()` → `show()` → `set_focus()` (never focus-first).
- If JS-side show/focus proves flaky on the packaged build, move the show/focus into the **Rust** global-shortcut handler and consider `app.set_activation_policy(tauri::ActivationPolicy::Regular)` and/or a native `NSApp activateIgnoringOtherApps` on summon. Keep the JS seam method but have it `invoke` a Rust command, OR register the shortcut entirely in Rust and emit a JS event for deep-linking.
- Decide early whether the window is **hidden** (tray-app style, `hide()`) or just **unfocused/minimized** when not summoned — `minimize()` is more reliable to restore than `hide()`. This is a planner decision worth surfacing in CONTEXT/discuss.
**Warning signs:** Hotkey "fires" (handler logs) but the window stays behind other apps, or appears but without keyboard focus. This is exactly what the human packaged-build sign-off must check.

### Pitfall 2: Global shortcut conflicts / chord already taken
**What goes wrong:** If the chosen chord is already registered by another app or the OS, the handler silently never fires. [CITED: v2.tauri.app/plugin/global-shortcut]
**Why it happens:** OS-level registration is exclusive; first registrant wins.
**How to avoid:** Pick a sensible, low-collision macOS default (a chord NOT used by Spotlight/`Cmd+Space`, screenshots `Cmd+Shift+3/4`, etc.). Use `isRegistered()` to detect, and surface a non-fatal status if registration fails. The default chord is a planner/discuss decision — research suggests something like `CommandOrControl+Shift+...` (`CommandOrControl` maps to Cmd on macOS). Avoid reserved system chords.
**Warning signs:** Hotkey does nothing from another app; `isRegistered` returns false after `register`.

### Pitfall 3: Missing capability permissions → register call rejected
**What goes wrong:** The JS `register`/`unregister`/`isRegistered` calls are denied at runtime if the capability isn't granted (the same class as the `store:default` gate already in the repo). [CITED: v2.tauri.app/plugin/global-shortcut]
**Why it happens:** Tauri 2's permission system gates every plugin command via `capabilities/*.json`.
**How to avoid:** Add to `capabilities/default.json`: `global-shortcut:allow-register`, `global-shortcut:allow-unregister`, `global-shortcut:allow-is-registered`, and `window-state:default`. Window control APIs (`show`/`setFocus`/etc. via `@tauri-apps/api/window`) are core and covered by `core:default` already present — but verify `core:window:allow-*` if a specific call is denied. Single-instance + tray need NO capability (no JS API).
**Warning signs:** Promise rejection mentioning permission/`not allowed`.

### Pitfall 4: Single-instance NOT registered first
**What goes wrong:** Second launch opens a new window / the focus callback never runs.
**Why it happens:** The plugin must intercept before other plugins initialize. [CITED: official docs]
**How to avoid:** Make `tauri_plugin_single_instance::init(...)` the very first `.plugin()` in the builder (before global-shortcut, store, clipboard, window-state).
**Warning signs:** Two windows appear on double-launch.

### Pitfall 5: single-instance callback doesn't fire when window is hidden
**What goes wrong:** On macOS, the single-instance callback may not run if the app was hidden via `window.hide()`. [VERIFIED: plugins-workspace issue #1613, tauri issue #12936]
**Why it happens:** Same hide-vs-minimize macOS quirk as Pitfall 1.
**How to avoid:** Same mitigation — prefer `minimize()` over `hide()` for the "not summoned" state, or ensure the callback path re-activates the app. Confirm on the packaged build.
**Warning signs:** Second launch does nothing while the app is hidden in the tray.

### Pitfall 6: window-state restore flash + interaction with the dark window
**What goes wrong:** Window appears at default geometry, then jumps to the restored geometry (flash).
**Why it happens:** The window shows before the plugin restores state.
**How to avoid:** Per the plugin docs, set `visible: false` on the window in `tauri.conf.json` (the plugin shows it after restoring). **Caveat:** the app currently has `theme: "Dark"` and opens to the hero tool — verify this doesn't conflict with the startup-redirect flow (`StartupRedirect`/`resolveStartupTool`). Test that the restored window still opens to last-used tool. [CITED: v2.tauri.app/plugin/window-state]
**Warning signs:** Visible geometry jump on launch; or window stays hidden if the plugin's show path fails.

### Pitfall 7: webdriver double-gate must remain intact
**What goes wrong:** Adding plugins to `lib.rs` could disturb the carefully-ordered `#[cfg(all(debug_assertions, feature = "webdriver"))]` builder rebinding.
**Why it happens:** The builder is rebound (`let builder = builder.plugin(...)`) for the webdriver gate; inserting plugins in the wrong place breaks the release-exclusion guarantee (threat T-01-10/11).
**How to avoid:** Add the new always-on plugins to the FIRST builder chain (single-instance first), keep the webdriver gate exactly as-is, and re-verify `cargo tree --release | grep webdriver` = 0 after the change.
**Warning signs:** webdriver crate leaks into release tree.

## Code Examples

### Capability grant (extends capabilities/default.json)
```json
// Source: v2.tauri.app/plugin/global-shortcut + plugin/window-state
{
  "identifier": "default",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "clipboard-manager:allow-read-text",
    "clipboard-manager:allow-write-text",
    "store:default",
    "global-shortcut:allow-register",
    "global-shortcut:allow-unregister",
    "global-shortcut:allow-is-registered",
    "window-state:default"
  ]
}
```

### JS register through the seam + deep-link via hash route
```typescript
// Source: shell wiring on top of the platform seam (NAT-01)
// Register once on startup (after initPlatform). On summon: show+focus, then
// optionally navigate the HashRouter to a tool (deep-link).
await initPlatform();
await platform.nativeShortcut.register("CommandOrControl+Shift+D", async () => {
  await platform.window.unminimize();
  await platform.window.show();
  await platform.window.setFocus();
  // deep-link example (HashRouter only — never location.assign to a path):
  // window.location.hash = "#/tools/protobuf-decoder";
});
// Unregister on teardown to avoid orphaned OS registration across dev reloads.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tauri v1 `globalShortcut` API + `systemTray` in `tauri.conf.json` | v2: `tauri-plugin-global-shortcut` + Rust `TrayIconBuilder` (no conf-based tray) | Tauri 2.0 (2024) | Tray is Rust-only now; shortcut is a plugin with a capability gate |
| `set_focus` reliably raises on macOS (2.0) | Regression 2.3+ requires show/unminimize ordering + possible activation-policy workaround | Tauri 2.3 (2025) | The summon flow needs the documented ordering; verify on the packaged build |

**Deprecated/outdated:**
- v1 `globalShortcut` from `@tauri-apps/api` — replaced by the `@tauri-apps/plugin-global-shortcut` package.
- `tauri.conf.json` `systemTray` block — does not exist in v2; tray is built in Rust.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The macOS `set_focus`-after-`hide` regression still affects Tauri 2.11.2 and isn't already fixed | Pitfall 1 | If already fixed, the Rust activation-policy workaround is unnecessary (less code) — verify on the packaged build first |
| A2 | Window control (`show`/`setFocus`/`unminimize`) via `@tauri-apps/api/window` is covered by the existing `core:default` capability (no extra grant) | Pitfall 3 | If a specific window command is denied, add `core:window:allow-*` to capabilities |
| A3 | `CommandOrControl+Shift+D` (or similar) is a reasonable default chord with low macOS collision | Pitfall 2 | If it collides, summon silently fails; the actual default is a discuss/CONTEXT decision, not locked here |
| A4 | The app should remain a **regular** dock app (not a menu-bar-only accessory) given it has a tray AND a main window | Tray / Pitfall 1 | If the product wants a pure menu-bar accessory (`ActivationPolicy::Accessory`), the show/focus/dock behavior changes — surface in discuss |
| A5 | `tauri-plugin-window-state` `visible:false` startup interacts cleanly with the existing `StartupRedirect`/last-used-tool flow | Pitfall 6 | Could cause a blank/hidden window or a tool-redirect race; verify on first packaged run |
| A6 | Whether the "not summoned" state is `hide()` (tray app) vs `minimize()` is undecided | Pitfalls 1/5 | Drives reliability of both summon and single-instance focus; this is a key planner/discuss decision |

**These assumptions should be confirmed in `/gsd-discuss-phase 5` before locking the plan** — especially A4 (accessory vs regular app) and A6 (hide vs minimize), which shape the whole summon UX.

## Open Questions (RESOLVED)

> Resolved during Phase-5 planning (no discuss session — user AFK). Each maps to an **ADOPTED DEFAULT** (D-01..D-04) in the plans, routed to the human checkpoint **05-04 Task 2** for confirmation/adjustment at sign-off.

1. **Default summon chord** → **RESOLVED: D-01 = `CommandOrControl+Shift+D`** (single named constant in the shell; collision-checked; a shortcut pref is out of scope for v1). ADOPTED DEFAULT, confirm at sign-off (05-04/T2).
   - What we know: `CommandOrControl+Shift+<key>` is the safe syntax (`CommandOrControl`→Cmd on macOS); collisions silently disable the handler. Space is taken by Spotlight.

2. **Accessory (menu-bar-only) vs regular (dock) app** → **RESOLVED: D-02 = regular dock app + tray** (not accessory). ADOPTED DEFAULT, confirm at sign-off (05-04/T2).
   - What we know: tray + main window suggests a regular app; an accessory app hides the dock icon and changes activation.

3. **Hidden vs minimized when not summoned** → **RESOLVED: D-03 = `minimize()`/`unminimize()`** (not `hide()`); summon order = unminimize→show→setFocus (issue #12834). ADOPTED DEFAULT, confirm at sign-off (05-04/T2).
   - What we know: `hide()` triggers the macOS focus/callback quirks (Pitfalls 1, 5); `minimize()` is more reliable.

4. **Where the global-shortcut handler lives (JS seam vs Rust)** → **RESOLVED: D-04 = JS-through-the-seam handler first**, isolated Rust fallback if packaged-build focus proves flaky. ADOPTED DEFAULT, confirm at sign-off (05-04/T2).
   - What we know: JS keeps it in the seam (cleaner); Rust is more reliable for macOS activation.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Tauri CLI / toolchain | All native work | ✓ | tauri 2.11.2 (Cargo.lock) | — |
| Rust + cargo | Plugin compilation | ✓ (prior `tauri build` succeeded) | — | — |
| macOS (build + verify) | All NAT requirements | ✓ | darwin 25.3.0 | — (Windows/Linux deferred to V2) |
| `tauri-plugin-*` crates | New native caps | ⬇ (to add) | gs 2.3.2 / si 2.4.2 / ws 2.4.1 | — (official, on crates.io) |
| App icon assets | Tray icon | ✓ | `src-tauri/icons/` has icon.icns/png/32/128 | reuse `default_window_icon()` |

**Missing dependencies with no fallback:** None blocking — all three plugins are published and the toolchain/build already work.

**Note on tray icon:** macOS menu-bar tray icons render best as **template images** (monochrome, alpha-only) so they adapt to light/dark menu bar. The existing color `icon.png` will work via `default_window_icon()` but may look wrong in the menu bar; a dedicated monochrome template tray icon is a nice-to-have (flag for discuss / UI review). [CITED: macOS HIG / Tauri tray docs general guidance — MEDIUM]

## Validation Architecture

> nyquist_validation is enabled (config.json `workflow.nyquist_validation: true`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.7 (unit, jsdom) + WebdriverIO 9.27.2 (real-WKWebView e2e) |
| Config file | vitest via `vite`/`package.json`; e2e `wdio.conf` (globs `test/e2e/*.e2e.ts`) |
| Quick run command | `pnpm vitest run` (+ `pnpm tsc --noEmit`) |
| Full suite command | `pnpm vitest run && pnpm tsc --noEmit && bash scripts/e2e-spike.sh` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NAT-01 | Seam exposes `nativeShortcut.register/unregister/isRegistered` + `window.show/setFocus/...`; browser fallback is a harmless no-op; `register` routes through the seam (not `@tauri-apps` directly) | unit (seam) | `pnpm vitest run src/lib/platform/platform.test.ts` | ❌ Wave 0 (extend) |
| NAT-01 | Global hotkey actually summons + focuses the app from another macOS app | **manual** (human sign-off) | N/A — OS-level, outside the webview | ✅ human UAT |
| NAT-02 | Tray menu present; click/Show shows+focuses; Quit exits | **manual** (human sign-off) | N/A — tray is native, no DOM | ✅ human UAT |
| NAT-02 | Second launch focuses existing window (single-instance) | **manual** (human sign-off) | N/A — requires two real processes | ✅ human UAT |
| SHL-05/D-11 | Window position/size persist across restart | **manual** (human sign-off) | N/A — needs real window manager + relaunch | ✅ human UAT |
| Seam discipline | No `@tauri-apps/*` import outside `tauri.ts` | unit/lint (grep) | `grep -rn "@tauri-apps" src/ \| grep -v test \| grep -v "// "` → only tauri.ts | ✅ existing guard |
| Regression | Decoder 19 + all prior tests stay green | unit | `pnpm vitest run` | ✅ existing |

### Sampling Rate
- **Per task commit:** `pnpm vitest run && pnpm tsc --noEmit` (seam unit tests + types).
- **Per wave merge:** full vitest + `bash scripts/e2e-spike.sh` (the e2e gate still drives the webview to prove the app launches with the new plugins and the existing tools still work — even though it can't fire the global hotkey).
- **Phase gate:** full suite green + fresh `tauri build` + **human packaged-build UAT** covering the four manual behaviors above + `gsd-ui-review` WCAG-AA.

### Wave 0 Gaps
- [ ] Extend `src/lib/platform/platform.test.ts` — assert `window` + `nativeShortcut` exist on the seam and are no-ops in the browser fallback (NAT-01 unit coverage).
- [ ] Possibly add `src/shell/summon.ts` (or wherever the chord constant + register-on-startup lives) with a unit test that it calls the seam (mock seam via `setPlatformForTest`), not `@tauri-apps`.
- [ ] No new test framework needed — vitest + wdio already cover what's automatable.

**Critical validation note:** The CORE of this phase (global hotkey from another app, tray click, single-instance second launch, geometry restore) is **not automatable** by the existing harness — global/OS behavior happens outside the WKWebView the WebDriver gate drives. This phase leans more heavily than any prior phase on the **human packaged-build sign-off**. The Phase 4 human UAT is already deferred (user AFK); the planner should expect Phase 5's human sign-off to be batched with Phase 4's per STATE.md, and write the UAT checklist accordingly.

## Security Domain

> `security_enforcement` is not set to `false` in config.json → included.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface (offline, no accounts) |
| V3 Session Management | no | No sessions |
| V4 Access Control | yes (capability model) | Tauri capability allowlist — grant only the specific `global-shortcut:allow-*` + `window-state:default` permissions; least privilege |
| V5 Input Validation | yes (low) | Single-instance `args`/`cwd` are untrusted input — do NOT interpret argv as a route/path without validation (mirrors the existing `parseHashTarget`/`resolveStartupTool` validation discipline) |
| V6 Cryptography | no | No crypto in this phase |
| V10 Malicious Code / Supply chain | yes | Pin official `tauri-apps` plugins to the 2.x line; no third-party native plugins |

### Known Threat Patterns for Tauri 2 + macOS native
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Over-broad capability grant (e.g. `global-shortcut:default` granting more than needed, or `core:window` blanket) | Elevation of Privilege | Grant only the three explicit `global-shortcut:allow-*` perms + `window-state:default`; avoid wildcard window perms |
| Single-instance `argv`/`cwd` injection (a second launch passes attacker-controlled args) | Tampering / Spoofing | Treat callback args as untrusted; if used for deep-linking, validate the hash target through the existing `getToolById`/`resolveStartupTool` path (only ENABLED_TOOLS); never execute or filesystem-resolve raw argv |
| Network egress regression (a new plugin opening a connection) | Information Disclosure | Offline-by-design holds — none of these three plugins make network calls; CSP `connect-src 'self' ipc:` unchanged; re-verify no new `connect-src` needed |
| webdriver server leaking into release (existing T-01-10/11) | EoP | Keep the `#[cfg(all(debug_assertions, feature="webdriver"))]` double-gate intact when editing `lib.rs`; re-run `cargo tree --release \| grep webdriver` = 0 |

## Project Constraints (from CLAUDE.md)

The planner MUST verify the plan honors these (same authority as locked decisions):
- **Platform seam only** — tools/shell import `src/lib/platform/`, NEVER `@tauri-apps/*`. New native caps go in the seam; `tauri.ts` stays the sole `@tauri-apps` importer (grep-verified).
- **HashRouter only** — deep-linking on summon uses `window.location.hash` / router navigation, NEVER `BrowserRouter` or path navigation.
- **No network at runtime** — none of the new plugins make network calls; CSP unchanged; re-verify.
- **Six tools only** — this phase adds no tools; registry untouched.
- **Do NOT refactor `decoder.ts` or its 19 tests** — untouched; 19 tests stay green.
- **Per-task DoD (in order):** `/simplify` → `/codex:review` → vitest+tsc green → real-WKWebView UI verification. Phase boundary: human sign-off on fresh `tauri build` + `gsd-ui-review` WCAG-AA.
- **Self-host fonts / no CDN** — unaffected.
- **Plans may parallelize but never skip gates.**

## Sources

### Primary (HIGH confidence)
- Context7/official: `v2.tauri.app/plugin/global-shortcut/` — install, Rust init, JS register/unregister/isRegistered, capability ids, `CommandOrControl` syntax, macOS support.
- `v2.tauri.app/plugin/single-instance/` — must-register-first, init callback `(app, args, cwd)`, focus example, no capability needed, macOS support.
- `v2.tauri.app/plugin/window-state/` — install, Rust registration, persists pos/size, `visible:false` flash fix, StateFlags, `window-state:default` capability.
- `v2.tauri.app/learn/system-tray/` — `TrayIconBuilder`, `Menu`/`MenuItem`, `on_menu_event`, `on_tray_icon_event`, Rust-only, `tray-icon` feature.
- crates.io / npm registry (2026-05-31) — version pins: global-shortcut 2.3.2, single-instance 2.4.2, window-state 2.4.1 (Rust); plugin-global-shortcut 2.3.2, plugin-window-state 2.4.1 (JS).
- Codebase: `src/lib/platform/{index,tauri,browser,stub}.ts`, `src-tauri/{Cargo.toml,src/lib.rs,tauri.conf.json,capabilities/default.json}`, `src/shell/{preferences,prefsStore}.ts`, `Cargo.lock` (tauri 2.11.2), `package.json`.

### Secondary (MEDIUM confidence)
- GitHub issues #12834, #12936, #7540, plugins-workspace #1613 — macOS `set_focus`/hide regression + single-instance-when-hidden quirk (cross-referenced, multiple reports).
- dev.to "Global Keyboard Shortcuts in Tauri v2 — Right Way/Wrong Way" — use the plugin for system-wide shortcuts.

### Tertiary (LOW confidence)
- macOS template-image tray-icon guidance (general HIG knowledge, not Tauri-doc-confirmed) — flagged as nice-to-have.

## Metadata

**Confidence breakdown:**
- Standard stack / versions: HIGH — verified against crates.io + npm on research date.
- Plugin APIs + registration order + capabilities: HIGH — official Tauri v2 docs.
- macOS show/focus pitfall + hide-vs-minimize: MEDIUM — community issues, not a single official "do this" doc; the workaround set is sound but the exact fix needs packaged-build verification (A1).
- Tray template-icon detail: LOW — general macOS knowledge.

**Research date:** 2026-05-31
**Valid until:** ~2026-06-30 (Tauri plugins are fast-moving on patch versions; re-verify versions at plan time, ~7-14 days for the macOS focus pitfall which may be fixed in a newer patch).
