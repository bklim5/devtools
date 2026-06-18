# Phase 24: Hotkeys & General Panes (native-touching) - Research

**Researched:** 2026-06-18
**Domain:** Tauri 2 native seams (global-shortcut re-register, autostart, tray/start-hidden) + in-webview chord capture/match + prefs-seam additive fields + append-only Settings panes
**Confidence:** HIGH (every seam read from source; autostart version verified against registry + Tauri 2.11.2 tree)

## Summary

This phase appends two panes to the existing Settings modal (Hotkeys, General) and is almost entirely **wiring over already-built seams**. The native primitives the phase needs — `platform.nativeShortcut.register/unregister/isRegistered`, `platform.window.{show,setFocus,unminimize,minimize,isVisible}`, the single-writer prefs blob, the append-only `SETTINGS_PANES` registry, and the `resolveStartupTool` precedence seam — all exist, are unit-tested, and have no-op browser/jsdom fallbacks. The ONLY new dependency in all of v1.7 is `tauri-plugin-autostart` (Rust crate + `@tauri-apps/plugin-autostart` JS binding), the explicit scoped exception for launch-at-login (D-24-7).

The two hard technical questions are: (1) **conflict signaling** — `register()` on a taken chord rejects (the plugin propagates the OS error), so the existing non-fatal `try/catch` in `registerSummon()` is the same signal that drives the D-24-2 inline rejection for user rebinds; and (2) **chord capture/persist/match agreement** — capture must read physical `e.code` + modifier flags (NOT `e.key`, which composes glyphs on macOS Option+letter — confirmed in project memory), normalize to a Tauri accelerator string for `nativeShortcut.register`, and the SAME normalization must drive the in-webview palette matcher so the configured ⌘K chord and its capture agree.

**Primary recommendation:** Add `tauri-plugin-autostart@2.5.1` (crate, target-scoped) + `@tauri-apps/plugin-autostart@2.5.1` (npm), wrap it as a new `platform.autostart` capability behind the `src/lib/platform/` seam (mirroring the Phase-20 `opener` precedent exactly), make `SUMMON_CHORD` a prefs default fed into a prefs-driven `registerSummon()`, build ONE shared `HotkeyCaptureField` + a pure `keyEventToAccelerator()` / `matchesChord()` helper pair, add six additive coerced prefs fields, and append two `SETTINGS_PANES` entries with zero `SettingsModal` change. start-in-tray rides the existing `app.windows[0].visible: false` config (the window already launches hidden — see Pitfall 1).

## User Constraints (from CONTEXT.md)

### Locked Decisions (D-24-1 … D-24-12, verbatim intent)

- **D-24-1 (capture):** Live key-capture field. Click → "recording"; press chord → captured + shown as resolved accelerator. **Escape cancels** (no change). Capture reads **physical `e.code` + modifier flags**, NOT `e.key` (macOS Option+letter composes a glyph). Persisted form = Tauri accelerator string (`CommandOrControl+Shift+D`), `CommandOrControl` → Cmd on macOS.
- **D-24-2 (conflict):** Reject inline, keep prior binding. Invalid chord or OS register-reject → **calm inline message** ("That shortcut is already in use — try another"), keep the **previous working binding active**, **persist nothing**. No toast, no modal.
- **D-24-3 (validation):** Require a non-shift modifier (Cmd/Ctrl/Alt) + block OS-reserved chords. Reject bare keys / shift-only. Block a known OS-reserved list (≥ Cmd+Space, Cmd+Q, Cmd+Tab, Cmd+Shift+3/4). Anything passing client validation is **attempted**; the **OS register-result is the final gate**.
- **D-24-4 (reset):** Per-hotkey "reset to default." summon = `CommandOrControl+Shift+D`; palette = `CommandOrControl+K`. Small, keyboard-reachable.
- **D-24-5 (summon re-register):** Only through `platform.nativeShortcut` (`unregister` old → `register` new), never `@tauri-apps/*` directly. `SUMMON_CHORD` becomes prefs-driven; rebind unregisters prior accelerator before registering new. Registration failure non-fatal (caught + logged), feeds D-24-2 when user-initiated.
- **D-24-6 (palette re-bind):** ⌘K handler keyed off the configured chord from prefs; in-webview match compares against the captured chord shape consistently with D-24-1 (physical key + modifier flags). Pure-webview, no native register.
- **D-24-7 (launch-at-login):** Ships via the **autostart plugin** routed through `platform/` seam. The explicit scoped zero-new-dep exception — named + recorded in PLAN.md.
- **D-24-8 (start-in-tray):** Ships. Launches hidden to the menu-bar tray instead of opening a window.
- **D-24-9 (combined):** Both on → silent background launch hidden to tray (no focus steal); summon chord OR tray click reveals. No flash of a window that then hides.
- **D-24-10 (default tool):** Dropdown, first option "Last used" (current SHL-06, stays default), then individual tools. `lastUsedId`/`resolveStartupTool` consulted ONLY when "Last used"; else open the fixed picked tool. No blank/palette-first state.
- **D-24-11 (show-license-in-sidebar):** Pure-webview toggle controlling visibility of the license/upgrade affordance in the sidebar. Lowest risk.
- **D-24-12 (persistence):** All settings through the existing prefs seam with field-by-field coercion over defaults (invalid chord → shipped default). Single-writer (`updatePreferences`). Defaults preserve today's behavior.

### Claude's / Planner's Discretion
- Exact OS-reserved chord blocklist (within D-24-3 intent — see "OS-Reserved Chord Blocklist" below for the recommended set).
- The autostart plugin choice + its scoped-dep exception write-up in PLAN.md.
- Per-toggle default values (on/off) and the exact accelerator-string ↔ capture normalization helper.
- Internal component structure of the capture field, toggle rows, default-tool dropdown (layout-agnostic, responsive Tailwind).
- Pane glyphs/icons for the two new entries.
- Whether summon + palette capture share one reusable `HotkeyCaptureField` (recommended, not mandated).

### Deferred Ideas (OUT OF SCOPE)
- Curated-dropdown / typed-string chord entry (rejected for live key-capture).
- "Warn but allow override" on a taken chord (rejected).
- "Blank / palette-first / always-ask" startup state.
- Deep-link summon (the validated `deepLink` path exists in `summon.ts` but v1 summon does NOT call it).
- Multi-hotkey / per-tool global shortcuts — only summon + palette in scope.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SET-08 | Hotkeys pane: view + rebind global summon (native re-register + conflict handling) and ⌘K palette chord (in-webview), both persisted | Summon Re-Register (§2) + Chord Capture/Match (§4) + Palette Matcher (§4) + prefs-seam fields (§7) |
| SET-09 | General pane: app-behavior toggles (launch-at-login, start-in-tray, default tool, show-license-in-sidebar), each persists + takes effect | Autostart Seam (§1) + Start-in-Tray (§5) + Default-Tool (§6) + Sidebar toggle (§7) + prefs-seam fields (§7) |

## Project Constraints (from CLAUDE.md)

The planner MUST verify compliance with all of these (same authority as locked decisions):

- **HashRouter only** — `BrowserRouter` forbidden. The default-tool dropdown must NOT introduce any `location.assign`/path write; `StartupRedirect` already uses `<Navigate>` (HashRouter-safe).
- **Tools import `src/lib/platform/`, never `@tauri-apps/*` directly** (FND-04). The new autostart capability MUST land in `tauri.ts` only; `summon.ts` / panes reach it via `platform.autostart`.
- **Registry is the single control plane** — sidebar/palette/router derive from it. Default-tool dropdown enumerates `ENABLED_TOOLS`; validate selections against `getToolById`.
- **Do not refactor `decoder.ts` or its 19 tests** — this phase does not touch them; the 19-test bar must stay byte-for-byte untouched.
- **No network at runtime** — autostart makes no network calls (LaunchAgent registration is local). Offline-by-design holds.
- **Six tools** constraint is legacy; the app ships 11 enabled tools (registry is the truth). Default-tool dropdown enumerates the live `ENABLED_TOOLS`.
- **WCAG-AA** — both panes keyboard-reachable; capture field needs an accessible affordance, no mouse-only path; visible focus; no opacity-only state; `aria-live` for capture/reset feedback.
- **Zero new webview runtime AND dev deps** — EXCEPT the single autostart exception (the only dep in v1.7). The planner's PLAN.md must explicitly record this exception (D-24-7).
- **Build+verify harness (binding):** per task `/simplify` → `/codex:review --wait --scope working-tree` → `vitest` + `tsc --noEmit` green → real-WKWebView e2e. Per phase boundary: auto `pnpm tauri build` (confirm bundle by `.app`/`.dmg` presence, not exit code; verify bundle mtime newer than last source commit) + human walkthrough + `gsd-ui-review` WCAG-AA.

## Standard Stack

### New Dependency (the single scoped v1.7 exception — D-24-7)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `tauri-plugin-autostart` (crate) | **2.5.1** | Launch-at-login (LaunchAgent registration on macOS) | [VERIFIED: crates.io 2.5.1, published 2025-10-27] The official Tauri plugins-workspace autostart plugin; same generation as the 2.x plugins already in the tree (Tauri core 2.11.2 [VERIFIED: Cargo.lock]). Wraps the `auto-launch` crate. |
| `@tauri-apps/plugin-autostart` (npm) | **2.5.1** | JS binding (`enable`/`disable`/`isEnabled`) | [VERIFIED: npm 2.5.1, published 2025-10-27] The matching JS API. Imported ONLY in `src-tauri/.../tauri.ts` behind the platform seam. |

**This is confirmed the ONLY new dependency** [VERIFIED: REQUIREMENTS.md v1.7 "Architecture (locked)" names autostart as "a NEW dep → explicit scoped exception" and ROADMAP Phase 24 success criterion 4 calls it "the only dep added in v1.7"]. Every other field of this phase rides existing seams.

### Existing Seams Reused (no new deps)

| Seam | Location | Used By This Phase |
|------|----------|--------------------|
| `platform.nativeShortcut` (register/unregister/isRegistered) | `index.ts` + `tauri.ts` + `browser.ts` | Summon rebind (D-24-5). Already filters `event.state === "Pressed"` so the handler fires once per chord. |
| `platform.window` (show/setFocus/unminimize/minimize/isVisible) | same | Start-in-tray reveal + silent-launch reveal-on-summon (D-24-8/9). |
| prefs single-writer (`updatePreferences` / `getSharedPreferences` / coercers in `prefsStore.ts`) | `usePreferences.ts` + `prefsStore.ts` + `preferences.ts` | All six new persisted fields (D-24-12). |
| `SETTINGS_PANES` append-only registry | `settingsPanes.tsx` | Two new panes (D-23-10 precedent). |
| `resolveStartupTool` precedence seam + `HERO_TOOL_ID` | `resolveStartupTool.ts` | Default-tool layering (D-24-10). |
| `ENABLED_TOOLS` / `getToolById` | `registry.ts` | Default-tool dropdown options + validation. |

### Installation

```bash
# Rust crate — target-scoped exactly like the other native plugins in Cargo.toml
# (matches the existing `cfg(any(target_os = "macos", windows, target_os = "linux"))` block)
cargo add tauri-plugin-autostart --target 'cfg(any(target_os = "macos", windows, target_os = "linux"))'

# JS binding (pin exact, matching the repo's pinned-version convention)
pnpm add @tauri-apps/plugin-autostart@2.5.1
```

[CITED: v2.tauri.app/plugin/autostart — install commands] Pin both to `2.5.1` (the repo pins exact native-plugin versions: `tauri-plugin-store = "2.4.3"`, `@tauri-apps/plugin-store: "2.4.3"`, etc.).

## Architecture Patterns

### Pattern 1: New platform capability — copy the Phase-20 `opener` precedent exactly

The `opener` capability (Phase 20) is the template for adding `autostart`. Mirror it field-for-field:

1. **`index.ts`** — add an `autostart` capability to the `Platform` interface + a `get autostart()` proxy:
```typescript
// Source: src/lib/platform/index.ts (mirror the `opener` block, lines 145-151)
/** Launch-at-login control (SET-09 / D-24-7). The ONE new webview dep of v1.7,
 *  reached ONLY through this seam. No-op-ish in the browser fallback (isEnabled→false). */
autostart: {
  enable(): Promise<void>;
  disable(): Promise<void>;
  isEnabled(): Promise<boolean>;
};
```
Then in the `platform` proxy object: `get autostart() { return active.autostart; }`.

2. **`tauri.ts`** — the SOLE importer of `@tauri-apps/plugin-autostart`:
```typescript
// Source: pattern from src/lib/platform/tauri.ts opener block (lines 152-154)
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
// ...
autostart: {
  enable: () => enable(),
  disable: () => disable(),
  isEnabled: () => isEnabled(),
},
```

3. **`browser.ts`** + **`stub.ts`** — deterministic no-op arms so jsdom/vite-preview never touch the OS:
```typescript
// browser.ts (mirror opener no-op, lines 109-111)
autostart: {
  async enable() {},
  async disable() {},
  async isEnabled() { return false; },
},
```
The General pane reads `platform.autostart.isEnabled()` to seed the toggle and calls enable/disable on flip — but persists the user's *intent* in prefs too (D-24-12) so the UI is correct before the async OS read resolves.

4. **`src-tauri/src/lib.rs`** — register the plugin in the builder chain (NOT in `setup()`; it's a builder plugin like the others):
```rust
// Source: v2.tauri.app/plugin/autostart — Rust registration
// Place alongside the other .plugin(...) calls in the builder chain (lines 19-52).
.plugin(tauri_plugin_autostart::init(
    tauri_plugin_autostart::MacosLauncher::LaunchAgent,
    None::<Vec<&str>>, // no extra launch args
))
```
[CITED: v2.tauri.app/plugin/autostart] `MacosLauncher::LaunchAgent` is the standard macOS mechanism (writes a `~/Library/LaunchAgents/<bundle-id>.plist`). The args vec is optional — pass `None` (no special launch flags needed; start-in-tray is decided in the webview from prefs, not a launch arg — see Pitfall 1).

5. **`src-tauri/capabilities/default.json`** — add the three autostart permissions:
```json
"autostart:allow-enable",
"autostart:allow-disable",
"autostart:allow-is-enabled"
```
[CITED: v2.tauri.app/plugin/autostart — required capabilities]

### Pattern 2: Prefs-driven summon chord (D-24-5)

`SUMMON_CHORD` today is a single exported constant read once by `registerSummon()`. Make it a **default** and feed the persisted chord in:

```typescript
// Source: src/shell/summon.ts (current registerSummon, lines 61-76)
// Keep SUMMON_CHORD as the DEFAULT_PREFERENCES.summonChord value (D-24-4 reset target).
// registerSummon reads the persisted chord; on rebind: unregister(old) → register(new).
export async function registerSummon(chord: string): Promise<void> {
  try {
    await initPlatform();
    await platform.nativeShortcut.register(chord, () => summon());
  } catch (err) {
    console.warn(`[summon] failed to register global chord "${chord}":`, err);
    throw err; // RE-THROW for user-initiated rebinds (D-24-2) — see Pattern 3
  }
}
```

**Critical ordering for rebind (D-24-5):** `unregister(oldChord)` → `register(newChord)`. If `register(newChord)` rejects (taken), **re-register the OLD chord** so the user keeps a working summon, and surface the inline rejection. The startup call stays non-fatal (catch + log, no re-throw at startup); only the user-rebind path observes the rejection.

### Pattern 3: Conflict detection — the register rejection IS the signal

`platform.nativeShortcut.register` → `@tauri-apps/plugin-global-shortcut` `register()`. On an already-registered/OS-reserved chord the underlying plugin **rejects the promise** (the existing `registerSummon` wraps it in `try/catch` precisely because "a taken chord… is caught and logged"). So:

- **Startup:** keep the existing catch-and-log (non-fatal) — a collision disables summon but never crashes.
- **User rebind:** await `register(newChord)`; a rejection → run the D-24-2 inline-reject flow (restore old binding, persist nothing, show calm message). `isRegistered(chord)` can be a pre-check but is NOT authoritative for *cross-process* conflicts — the **register attempt is the final gate** (D-24-3). Do a defensive `unregister` of the new chord first (idempotent) only if you pre-registered nothing; the clean sequence is unregister-old → register-new → on-failure re-register-old.

### Pattern 4: Append-only Settings pane (D-23-10 precedent)

```typescript
// Source: src/components/settingsPanes.tsx (current SETTINGS_PANES, lines 26-39)
// Append two entries; SettingsModal.tsx stays byte-unchanged (nav + content derive 1:1).
export const SETTINGS_PANES: SettingsPane[] = [
  { id: "appearance", label: "Appearance", icon: Contrast, render: () => <AppearanceSettings /> },
  { id: "hotkeys", label: "Hotkeys", icon: /* discretion: Keyboard */ Keyboard, render: () => <HotkeysSettings /> },
  { id: "general", label: "General", icon: /* discretion: SlidersHorizontal */ SlidersHorizontal, render: () => <GeneralSettings /> },
  { id: "license", label: "License", icon: Settings, render: () => <LicenseSettings /> },
];
```
The mockup's nav label is "Keyboard" but the shipped pane is **"Hotkeys"** (D-24 / ROADMAP naming). Each pane wrapper should match the Appearance/License wrapper conventions (`flex flex-col gap-6 overflow-auto p-8`, `h3` header one level under the dialog `h2` — preserves the Phase-22.1 heading order h2→h3→h4).

### Anti-Patterns to Avoid
- **Capturing with `e.key`** — on macOS Option+letter composes a glyph (Option+P → "π"), corrupting the chord. Use `e.code` + modifier flags (D-24-1; project memory `macos-option-key-composes-letters`).
- **A second prefs writer** — never add a hook that holds a mount-era full-blob snapshot. Route every write through `updatePreferences` (memory `prefs-blob-single-writer`; this exact bug shipped a data-loss regression in Phase 23).
- **Reading prefs before the async load resolves** — gate on `prefsLoaded` / `ensurePreferencesLoaded` before acting on persisted chords/toggles (memory `tauri-store-async-init-race`).
- **Importing `@tauri-apps/plugin-autostart` outside `tauri.ts`** — breaks FND-04 + the jsdom/vite-preview fallback.
- **Setting `data-theme` or any global DOM state from the panes** — the capture field is a contained control; no global side effects.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Launch-at-login | A hand-written LaunchAgent plist writer / `osascript` login-items shell-out | `tauri-plugin-autostart` (`MacosLauncher::LaunchAgent`) | Plist path, bundle-id, enable/disable idempotency, and cross-OS parity are all handled; hand-rolling re-implements `auto-launch` poorly and breaks the seam discipline. |
| Global hotkey register/conflict | Direct `@tauri-apps/plugin-global-shortcut` calls | Existing `platform.nativeShortcut` seam | Already wraps register/unregister/isRegistered, filters Pressed-state, and has no-op fallbacks + unit tests. |
| Chord capture → accelerator string | Ad-hoc `e.key` concatenation | A pure `keyEventToAccelerator(e)` helper (physical `e.code`) | `e.key` is glyph-composed on macOS; `e.code` is layout-stable. One helper keeps capture/persist/match in agreement (D-24-1/6). |
| Window summon ordering | New show/focus logic | Existing `summon()` (unminimize → show → setFocus) | macOS focus regression (tauri #12834) requires this exact order; already encoded. |
| Prefs persistence + coercion | A new store key or writer | `updatePreferences` + field coercers in `prefsStore.ts` | Single-writer + untrusted-input coercion already enforced; a second writer is a known data-loss bug. |
| Default-tool precedence | Scattered router conditionals | `resolveStartupTool` (extend the seam) | Centralised precedence; HashRouter-safe `<Navigate>`. |

**Key insight:** This phase is plumbing. The only genuinely new surface is the autostart plugin; everything else is an additive edit to a seam built to be extended.

## Detailed Findings (the 9 planner questions)

### §1 Autostart plugin (D-24-7) — VERIFIED
- Crate **2.5.1** [VERIFIED: crates.io / docs.rs], npm **2.5.1** [VERIFIED: npm], both published 2025-10-27. Compatible with Tauri core **2.11.2** [VERIFIED: Cargo.lock] — same plugins-workspace 2.x line as `tauri-plugin-store 2.4.3`, `tauri-plugin-global-shortcut 2.3.2`, etc. already in the tree.
- Rust: `.plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None::<Vec<&str>>))` in the builder chain [CITED: v2.tauri.app/plugin/autostart].
- JS: `enable()`, `disable()`, `isEnabled()` from `@tauri-apps/plugin-autostart` [CITED: same].
- Capabilities: `autostart:allow-enable`, `autostart:allow-disable`, `autostart:allow-is-enabled` [CITED: same].
- macOS mechanism: `MacosLauncher::LaunchAgent` writes a per-user LaunchAgent plist (`~/Library/LaunchAgents/`); the alternative is AppleScript login-items, but LaunchAgent is the documented/standard choice and the only one to use here [CITED: same].
- **Wire through `platform.autostart` (new capability), never imported directly** (FND-04). Confirmed the ONLY new dep (REQUIREMENTS/ROADMAP).

### §2 Summon re-register conflict (D-24-2/5) — VERIFIED from source
- `registerSummon()` (summon.ts:61-76) already wraps `platform.nativeShortcut.register(SUMMON_CHORD, …)` in `try/catch` with a comment: *"Registration failure (chord already taken… T-05-07) is NON-FATAL: it is caught and logged, never rethrown."* So **register rejects on a taken chord** — that rejection is the reliable D-24-2 signal.
- `tauri.ts` (85-94): `register` forwards to the plugin, filtering `event.state === "Pressed"`. `unregister`/`isRegistered` pass through.
- **Reliable signal:** the `register(newChord)` promise rejection. `isRegistered` only reports *this app's* registrations — not authoritative for OS-reserved/other-app conflicts, so it can pre-filter but the **register result is the final gate** (matches D-24-3 exactly).
- **Ordering contract:** unregister(old) → register(new); on reject, re-register(old) to preserve a working summon, persist nothing, surface the inline message. Startup stays non-fatal (no re-throw); user-rebind re-throws so the pane can catch.

### §3 OS-Reserved Chord Blocklist (D-24-3) — recommended set [ASSUMED + CITED partial]
The OS register-result is the final gate, but a client-side blocklist gives the calm-message path before attempting. Recommended macOS set to encode (accelerator-string form, `CommandOrControl` = Cmd):

| Chord | Reserved for | Source |
|-------|-------------|--------|
| `CommandOrControl+Space` | Spotlight | [CITED: existing summon.ts comment cites avoiding Cmd+Space] |
| `CommandOrControl+Q` | Quit | macOS HIG [ASSUMED] |
| `CommandOrControl+Tab` | App switcher | macOS HIG [ASSUMED] |
| `CommandOrControl+Shift+3` | Screenshot (full) | [CITED: summon.ts comment] |
| `CommandOrControl+Shift+4` | Screenshot (selection) | [CITED: summon.ts comment] |
| `CommandOrControl+Shift+5` | Screenshot toolbar | [ASSUMED] |
| `CommandOrControl+W` | Close window | macOS HIG [ASSUMED] |
| `CommandOrControl+M` | Minimize | macOS HIG [ASSUMED] |
| `CommandOrControl+H` | Hide app | macOS HIG [ASSUMED] |
| `CommandOrControl+,` | Settings (this app's own — SET-01) | [VERIFIED: lib.rs:143 binds CmdOrCtrl+,] |
| `CommandOrControl+C/V/X/Z/A` | Edit menu (this app reconstructs them) | [VERIFIED: lib.rs:172-180 Edit submenu] |

Note `CommandOrControl+K` (palette) and `CommandOrControl+Shift+D` (summon) are this app's OWN defaults — exclude them from the blocklist (they are valid targets); but the planner should prevent binding summon and palette to the *same* chord. The exact set is planner discretion within this intent; the table above is the recommended encoding.

### §4 Chord capture / persist / match (D-24-1/6) — confirmed approach
Capture from `KeyboardEvent`:
- **Modifiers** from boolean flags: `e.metaKey` (→ `CommandOrControl` on macOS), `e.ctrlKey`, `e.altKey`, `e.shiftKey`.
- **Main key** from `e.code` (physical), NOT `e.key`. e.g. `e.code === "KeyD"` → `"D"`; `e.code === "Digit3"` → `"3"`; arrows/function keys map by a small table.

Recommended **pure helper pair** (one source of truth so capture/persist/match agree):
```typescript
// keyEventToAccelerator(e): KeyboardEvent -> "CommandOrControl+Shift+D" | null
//   - returns null if no non-shift modifier (D-24-3 client validation) or no main key
//   - normalize e.code: strip "Key"/"Digit" prefixes; map "Comma"->",", arrows, F-keys
//   - modifier order canonical: CommandOrControl, Alt, Shift, <key>
// matchesChord(e, accelerator): KeyboardEvent -> boolean
//   - parse the accelerator, compare the SAME way (meta/ctrl via CommandOrControl, alt, shift, e.code)
```
The palette handler (CommandPalette.tsx:185-217) currently hardcodes `(e.metaKey||e.ctrlKey) && e.key.toLowerCase()==="k"`. Replace with `matchesChord(e, configuredPaletteChord)` reading the prefs chord — so the configured palette chord and its capture use the identical comparison. **Preserve the existing Phase-22.2 Pro-gating branch** (`openProUpsell` for free users, DEV `⌘⇧K` escape) — only swap the *detection* of the chord, not the gating logic.

**e2e note:** the WebDriver e2e must dispatch the **composed key shape** — a synthetic KeyboardEvent with the right `code` AND `key` (and modifier flags). Matching project memory `macos-option-key-composes-letters`: tests for Option-composed chords must dispatch the glyph `key` with the physical `code`. Helpers already exist (`test/e2e/helpers.ts` has `dispatchKey`/`dispatchAltP`).

### §5 start-in-tray / launch-hidden (D-24-8/9) — VERIFIED window already launches hidden
- `tauri.conf.json` already sets `app.windows[0].visible: false` [VERIFIED: tauri.conf.json:21] — with a comment in lib.rs that this *"avoids the restore-flash"* (window-state plugin restores geometry before show). **So the window ALREADY launches hidden and is shown by the webview.** There is no native flash to fix; the question is *who calls show*.
- Today something must reveal the window on normal launch. The General pane's start-in-tray toggle changes that: when start-in-tray is ON, **do NOT auto-reveal** — leave the window hidden; reveal only via `summon()` (the global chord) or the tray left-click / "Show" item (both already call unminimize→show→setFocus in lib.rs:234-263).
- **Implementation seam:** the decision to reveal-on-launch is a webview concern reading prefs. The window starts `visible:false`; the app's startup code calls `platform.window.show()` UNLESS `startInTray` is true. This keeps "no flash" for free (the window is never shown then hidden — it's just never shown). `platform.window.isVisible()` lets the reveal path be idempotent.
- **Combined (D-24-9):** launch-at-login (autostart) + start-in-tray → the app launches at login, window stays hidden, summon/tray reveals. No focus steal because the window is never shown. The planner must confirm the current launch path's `show()` call is gated on `!startInTray` (read the App-root startup wiring — likely where `registerSummon` is called).
- **Risk:** if there is NO existing explicit `show()` (i.e. the window currently relies on something else to become visible), the planner must trace the actual reveal path. Read the App-root / main.tsx startup to confirm where `show()` happens today before gating it. (Not found in the files read here — flagged as Open Question 1.)

### §6 default-tool dropdown (D-24-10) — VERIFIED seam
- `resolveStartupTool(target, lastUsedId)` (resolveStartupTool.ts:23-30): precedence explicit `target` → `lastUsedId` → `HERO_TOOL_ID`, each validated via `getToolById` (ENABLED_TOOLS only).
- `StartupRedirect.tsx` (29): calls `resolveStartupTool(target, preferences.lastUsedId)` after `prefsLoaded`.
- **Layering "Last used | <tool>":** add a `defaultToolId: string | null` pref (`null`/`"last-used"` sentinel = today's behavior). Extend `resolveStartupTool` to take the default-tool selection: when a specific tool is chosen AND no explicit deep-link target, return that tool (validated via `getToolById`); when "Last used", fall through to the current `lastUsedId → HERO_TOOL_ID` chain. **Backward-compatible:** absent/`"last-used"` → identical to today. The explicit deep-link `target` still wins over the default-tool (preserves D-14).
- Dropdown options: first literal **"Last used"**, then `ENABLED_TOOLS.map(t => ({id, name}))` [VERIFIED: registry.ts:36]. Validate any persisted `defaultToolId` against `getToolById` (untrusted-prefs coercion → fall back to "Last used" if unknown).

### §7 Prefs seam additive fields (D-24-12) — exact recipe
Add to `Preferences` (preferences.ts) + `DEFAULT_PREFERENCES` + a coercer each in `prefsStore.ts` + (where user-set) a setter in `usePreferences.ts`. All writes via `updatePreferences` (single writer). Six fields:

| Field | Type | Default | Coercer rule (invalid → default) |
|-------|------|---------|----------------------------------|
| `summonChord` | `string` | `"CommandOrControl+Shift+D"` (= current `SUMMON_CHORD`) | accept only a string that parses as a valid accelerator (non-shift modifier + known key); else default |
| `paletteChord` | `string` | `"CommandOrControl+K"` | same accelerator validation; else default |
| `launchAtLogin` | `boolean` | `false` (planner per-toggle discretion) | honor only true/false; else false |
| `startInTray` | `boolean` | `false` | honor only true/false; else false |
| `defaultToolId` | `string \| null` | `null` ("Last used") | accept only an id in `ENABLED_TOOLS` (validate via `getToolById`) OR `null`; else null |
| `showLicenseInSidebar` | `boolean` | `true` (preserve today's visible affordance) | honor only true/false; else true |

Notes:
- Mirror the existing coercer style (`coerceTheme`, `coerceAutoUpdateCheck`, etc. in prefsStore.ts) — every field gets a named `coerceX` + a line in `mergePreferences`.
- The chord coercers should reuse the SAME validation as `keyEventToAccelerator`'s output check, so an invalid hand-edited chord coerces to the shipped default (D-24-12 "invalid chord → shipped default").
- `launchAtLogin` is BOTH a pref AND an OS state. On the pane, seed the toggle from `platform.autostart.isEnabled()` but also persist the pref; on flip, call enable/disable AND persist. (The OS state is the truth for whether it actually launches; the pref makes the UI correct pre-async-read and survives reinstall reconciliation.)

### §8 Settings pane append (D-23-10) — VERIFIED zero shell change
- `SETTINGS_PANES` (settingsPanes.tsx:26-39) is the append-only registry; `SettingsModal.tsx` derives nav + content 1:1. Phase 23 appended "appearance" with zero shell change [VERIFIED: STATE.md Phase-23 plan 04: *"SettingsModal.tsx byte-unchanged… ONE appended entry"*]. The two new entries (Hotkeys, General) are pure appends. Icons are discretion (Keyboard / SlidersHorizontal from lucide-react are sensible; lucide-react 1.17.0 is in package.json).
- Wrapper conventions (from AppearanceSettings precedent): `h3` header one level under dialog `h2`, helper sub-text, keyboard-navigable, WCAG-AA both themes.

### §9 Validation Architecture — see dedicated section below.

## Runtime State Inventory

> This is an additive-feature phase, NOT a rename/refactor. Included because launch-at-login registers OS state.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | The six new prefs fields land in the existing `prefs.json` blob (`shell.preferences` key). No collection/key rename. | Code edit only (additive coercers). |
| Live service config | **None** — no external services. Autostart writes a per-user LaunchAgent plist, managed entirely by the plugin's enable/disable (not stored in git). | Plugin owns it; nothing to migrate. |
| OS-registered state | **LaunchAgent plist** (`~/Library/LaunchAgents/<bundle-id>.plist`) created on first `enable()`. The global summon chord re-registers via `nativeShortcut` (process-scoped, not persisted by the OS). | Verify enable→disable round-trips on the real app (e2e can't assert the plist; human walkthrough). |
| Secrets/env vars | **None** — no secret/env names touched. | None. |
| Build artifacts / installed packages | The new `@tauri-apps/plugin-autostart` npm dep + crate enter the lockfiles; `pnpm install` + `cargo build` materialize them. | Run installs; verify `pnpm-lock.yaml` + `Cargo.lock` updated; verify the plugin is absent from no-network claims (it makes no network calls). |

**Canonical question — after every file is updated, what runtime state persists?** The LaunchAgent plist (managed by the plugin) and the user's prefs.json. Both are reconciled by reading `platform.autostart.isEnabled()` at pane mount (OS is the source of truth for actual launch behavior).

## Common Pitfalls

### Pitfall 1: Window-show timing for start-in-tray (no flash)
**What goes wrong:** Showing the window then hiding it when start-in-tray is on → a visible flash.
**Why it happens:** Assuming you must show-then-hide. The window already launches `visible:false` [VERIFIED: tauri.conf.json:21].
**How to avoid:** Gate the existing reveal `show()` on `!startInTray`. The window is *never shown*, not shown-then-hidden — zero flash by construction. Reveal only via summon/tray.
**Warning signs:** Any `hide()` call in the start-in-tray path is a smell.

### Pitfall 2: Chord captured with `e.key` corrupts on Option+letter
**What goes wrong:** Option+P captures "π"; the persisted accelerator is garbage and never matches/registers.
**Why it happens:** macOS composes Option+letter to a glyph in `e.key`.
**How to avoid:** Capture from `e.code` + modifier flags (D-24-1). Single `keyEventToAccelerator` helper. [VERIFIED: project memory `macos-option-key-composes-letters` — Alt+P already keys off physical `KeyP` in Phase 17].
**Warning signs:** e2e for an Option-chord must dispatch the composed `key` with the physical `code`.

### Pitfall 3: Second prefs writer clobbers theme/pins (data-loss)
**What goes wrong:** A new hook holding a stale mount-era full-blob snapshot overwrites concurrent theme/pin/chord changes.
**Why it happens:** Whole-blob persistence with >1 writer (the exact Phase-23 data-loss bug).
**How to avoid:** Route every write through `updatePreferences` (merges against live `sharedPrefs`). Never `loadPreferences→savePreferences` for user-visible fields. [VERIFIED: memory `prefs-blob-single-writer` + usePreferences.ts:99-103].
**Warning signs:** A new `useX` hook that calls `savePreferences` directly.

### Pitfall 4: Acting on persisted chords/toggles before async load resolves
**What goes wrong:** Registering the default chord (or revealing the window) before prefs load, then a second register with the real chord — double-register / wrong behavior; or panes seeded with defaults.
**Why it happens:** Tauri store async-init race; reads before `initPlatform` resolves hit the fallback. [VERIFIED: memory `tauri-store-async-init-race`].
**How to avoid:** Gate startup registration + reveal + pane seeds on `prefsLoaded` / `ensurePreferencesLoaded`. `StartupRedirect` already gates on `prefsLoaded`.
**Warning signs:** `registerSummon` called with a default before the load resolves.

### Pitfall 5: Register rejection swallowed at the rebind path
**What goes wrong:** The startup `try/catch` swallows the rejection, so a user rebind to a taken chord silently no-ops and the UI thinks it succeeded.
**Why it happens:** Reusing the non-fatal startup contract for the user-initiated path.
**How to avoid:** The rebind entry point must re-throw / surface the rejection (D-24-2 inline reject); only the startup call swallows it. Restore the old binding on failure.
**Warning signs:** No inline error appears when binding to Cmd+Space.

### Pitfall 6: Native menu + tray are NOT WebDriver-drivable
**What goes wrong:** Trying to e2e-assert the tray reveal or LaunchAgent registration.
**Why it happens:** WebDriver can't touch native chrome (documented in the harness §3.3 + STATE.md menu walkthroughs).
**How to avoid:** Native register-failure, launch-at-login, start-in-tray reveal, and autostart enable are **human-walkthrough** items (Validation Architecture below). Unit-test the pure helpers + the prefs coercion + the in-webview palette matcher.

## Code Examples

### Capture field recording state (sketch — discretion on structure)
```tsx
// Source: pattern; integrates keyEventToAccelerator (this RESEARCH §4)
// Recording: window keydown -> keyEventToAccelerator(e). Escape cancels.
function onKeyDown(e: KeyboardEvent) {
  e.preventDefault();
  if (e.code === "Escape") { cancelCapture(); return; }
  const accel = keyEventToAccelerator(e); // null if no non-shift modifier / no main key
  if (!accel) return;                       // keep recording until a valid chord
  if (isReserved(accel)) { showInline("That shortcut is reserved — try another"); return; }
  attemptRebind(accel);                     // unregister-old -> register-new -> on-reject restore + inline msg
}
```

### Palette matcher swap (CommandPalette.tsx ~187)
```typescript
// BEFORE: if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { ... }
// AFTER:  if (matchesChord(e, paletteChord)) { ... }   // paletteChord from prefs
// Preserve the Phase-22.2 Pro-gating + DEV ⌘⇧K escape branch unchanged.
```

## State of the Art

| Old Approach | Current Approach | When | Impact |
|--------------|------------------|------|--------|
| `tauri-plugin-autostart` v1 (Tauri 1) | v2 line (2.x), `MacosLauncher::LaunchAgent` API | Tauri 2 GA (2024-10) | Use 2.5.1; the v1 README API differs. [VERIFIED: crates.io versions] |
| Hardcoded ⌘K / single `SUMMON_CHORD` constant | Prefs-driven chords with capture/match helpers | This phase | Both become configurable + persisted. |

**Deprecated/outdated:** autostart v1.x (Tauri 1 only) — do not use.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The OS-reserved blocklist beyond Spotlight/screenshots (Cmd+Q/Tab/W/M/H/5) is the right set | §3 / OS-Reserved Blocklist | Low — the OS register-result is the final gate (D-24-3); the blocklist is a UX nicety. A missing entry just means the OS rejects it and the same inline message fires. |
| A2 | The App-root startup currently calls `platform.window.show()` (or equivalent) as the reveal path to gate on `!startInTray` | §5 / Pitfall 1 | Medium — if the reveal happens elsewhere (e.g. window-state plugin auto-show, or a Rust-side show), the gating point differs. Planner MUST trace the actual reveal path (Open Question 1). |
| A3 | Per-toggle defaults: launchAtLogin=false, startInTray=false, showLicenseInSidebar=true | §7 | Low — explicitly planner discretion (D-24-12); these preserve today's behavior. |

## Open Questions

1. **Where does the window become visible on a normal launch today?**
   - What we know: `tauri.conf.json` sets `visible:false`; tray/summon/single-instance all call `unminimize→show→setFocus`. The window-state plugin restores geometry before show.
   - What's unclear: the App-root (main.tsx / App.tsx startup) reveal path was not in the files read here. The start-in-tray gate (D-24-8/9) attaches to whatever currently calls `show()` on first launch.
   - Recommendation: planner reads `src/main.tsx` + `src/App.tsx` (and any startup module that calls `registerSummon`) to locate the reveal `show()` and gate it on `!startInTray`. If the reveal is implicit, add an explicit `prefsLoaded`-gated `show()` that respects start-in-tray.

2. **Does `summonChord` rebind need to also keep the global chord working when the app is backgrounded/hidden?**
   - What we know: global-shortcut is OS-level and works regardless of window visibility (that's the point of summon).
   - Recommendation: no special handling — re-register replaces the OS binding; verify on the real app that the new chord summons from a hidden/tray state (human walkthrough).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `tauri-plugin-autostart` crate | launch-at-login | ✓ (registry) | 2.5.1 | none — required for SET-09 launch-at-login |
| `@tauri-apps/plugin-autostart` npm | launch-at-login JS | ✓ (registry) | 2.5.1 | none |
| Tauri core | host | ✓ | 2.11.2 | — |
| `@tauri-apps/plugin-global-shortcut` | summon re-register | ✓ (in tree) | 2.3.2 | — |
| macOS WebDriver e2e (`tauri-plugin-webdriver`) | UI gate | ✓ (feature-gated) | 0.2 | `screencapture` + chrome-devtools-mcp fallback (harness §3.3) |

**Missing dependencies with no fallback:** none — autostart 2.5.1 is published and compatible.

## Validation Architecture

> nyquist_validation = true (config.json). Section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.7 (unit, jsdom) + WebdriverIO 9.27.2 (real-WKWebView e2e via `tauri-plugin-webdriver`) |
| Config file | `vite.config.ts` (vitest) · `wdio.conf.ts` (e2e) |
| Quick run command | `pnpm test` (`vitest run`) |
| Full suite command | `pnpm test && pnpm exec tsc --noEmit && pnpm lint` then real-WKWebView e2e via `scripts/e2e-spike.sh` |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| SET-08 | `keyEventToAccelerator` / `matchesChord` pure helpers (capture↔persist↔match agree, `e.code`-based) | unit | `vitest run src/shell/hotkeyAccelerator.test.ts` | ❌ Wave 0 |
| SET-08 | Chord coercion: invalid hand-edited chord → shipped default | unit | `vitest run src/shell/prefsStore.test.ts` (extend) | ⚠️ extend existing |
| SET-08 | Palette opens on the configured chord (in-webview) + Pro-gating preserved | e2e | `cmdk-pro.e2e` / new `hotkeys.e2e.ts` (real WKWebView) | ❌ Wave 0 |
| SET-08 | Summon rebind: unregister-old→register-new→restore-on-reject ordering | unit | `vitest run src/shell/summon.test.ts` (extend, stub `nativeShortcut`) | ⚠️ extend existing |
| SET-08 | **Native summon re-register against a real OS-taken chord** | manual | human walkthrough on built app | n/a (WebDriver can't drive native register) |
| SET-09 | Default-tool precedence (Last used \| specific tool, backward-compatible) | unit | `vitest run src/shell/resolveStartupTool.test.ts` (extend) | ⚠️ extend existing |
| SET-09 | Six new prefs fields coerce + persist via single writer | unit | `vitest run src/shell/usePreferences.test.ts` (extend) | ⚠️ extend existing |
| SET-09 | show-license-in-sidebar toggle hides/shows the affordance | unit/e2e | Sidebar unit test + `hotkeys.e2e.ts` | ⚠️/❌ |
| SET-09 | **launch-at-login enable/disable round-trip (LaunchAgent plist)** | manual | human walkthrough | n/a (autostart isn't WebDriver-drivable) |
| SET-09 | **start-in-tray: launch hidden, reveal via summon/tray, NO flash** | manual | human walkthrough on built app | n/a |
| SET-08/09 | Both panes keyboard-reachable, WCAG-AA, capture has accessible affordance | manual + audit | `gsd-ui-review` WCAG-AA + human keyboard walkthrough | n/a |

### Sampling Rate
- **Per task commit:** `pnpm test` (quick) + `tsc --noEmit` + `eslint` (lefthook pre-push gate already enforces tsc+vitest+lint).
- **Per wave merge:** full suite + real-WKWebView e2e via `scripts/e2e-spike.sh` (the verify-gate — memory `verify-gate-builds-real-app`).
- **Phase gate:** full suite green + `pnpm tauri build` (confirm by `.app`/`.dmg`, mtime newer than last source commit) + human walkthrough of the manual rows above + `gsd-ui-review`. The decoder's **19 tests stay byte-for-byte untouched** (immovable bar).

### What CANNOT be unit-tested (must be verified on the real app — harness §3.3, Pitfall 6)
- Native global-shortcut **register failure** on a genuinely OS-taken chord (e.g. binding Cmd+Space) — WebDriver can't assert native register results; stub-tested for the ordering contract, human-verified for the real reject.
- **launch-at-login** actually launching the app at login (LaunchAgent plist) — manual.
- **start-in-tray** launch-hidden + reveal-via-summon/tray + no-flash — native window/tray, manual.
- **autostart enable/disable** round-trip — `platform.autostart.isEnabled()` reflects the OS, not WebDriver-assertable; manual.

### Wave 0 Gaps
- [ ] `src/shell/hotkeyAccelerator.ts` + `hotkeyAccelerator.test.ts` — `keyEventToAccelerator` / `matchesChord` / `isReservedChord` pure helpers (covers SET-08 capture/match).
- [ ] `test/e2e/hotkeys.e2e.ts` — palette-on-configured-chord + show-license-in-sidebar toggle on real WKWebView (covers SET-08b / SET-09 webview-testable parts).
- [ ] Extend `prefsStore.test.ts`, `usePreferences.test.ts`, `resolveStartupTool.test.ts`, `summon.test.ts` for the new fields/precedence/ordering.
- [ ] No framework install needed (vitest + wdio already present); the ONE new dep is the autostart plugin (not a test dep).

## Security Domain

> security_enforcement not explicitly false in config — section included.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (no auth surface added) |
| V3 Session Management | no | — |
| V4 Access Control | yes (capability scoping) | Tauri capability permissions: add ONLY `autostart:allow-enable/disable/is-enabled`; do not widen global-shortcut perms (already scoped). |
| V5 Input Validation | yes | Untrusted prefs (hand-edited prefs.json): every new field coerced over defaults (invalid chord/tool-id → safe default). Captured chord validated by `keyEventToAccelerator` (rejects bare/shift-only). |
| V6 Cryptography | no | — |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Hand-edited prefs.json injects a bogus chord / tool-id | Tampering | Field-by-field coercion in `prefsStore.ts` (existing discipline T-02-08); invalid → shipped default. |
| `defaultToolId` used as an unvalidated navigation target | Tampering / injection | Validate via `getToolById` (ENABLED_TOOLS only) before navigating — same guard `resolveStartupTool` already applies (T-02-07/08). |
| Autostart plugin scope creep (extra launch args) | Elevation | Pass `None` launch args; capability scoped to the three autostart perms only. No shell-injection surface. |
| Global-shortcut binding to an OS-reserved/other-app chord | DoS (dead summon) | OS register-result is the final gate (D-24-3); reject inline + keep prior binding (D-24-2) — never persist a dead chord. |

## Sources

### Primary (HIGH confidence)
- Codebase source (read in full this session): `src/shell/summon.ts`, `src/lib/platform/{index,tauri,browser,stub}.ts`, `src/shell/{preferences,prefsStore,usePreferences,useRecentTools,resolveStartupTool,useTrackActiveTool,StartupRedirect}.ts`, `src/lib/tools/registry.ts`, `src/components/{settingsPanes.tsx}`, `src/components/CommandPalette.tsx` (keydown handler), `src/components/Sidebar.tsx` (license affordance), `src-tauri/src/lib.rs`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`, `package.json`, `Cargo.lock` (tauri 2.11.2).
- `.planning/phases/24-hotkeys-general-panes/24-CONTEXT.md` (locked decisions), `.planning/REQUIREMENTS.md` (SET-08/09 + v1.7 architecture), `.planning/ROADMAP.md` (Phase 24 criteria), `.planning/STATE.md` (Phase 22/23 precedents), `docs/harness-and-decisions.md`, `CLAUDE.md`.
- Project memory: `macos-option-key-composes-letters`, `prefs-blob-single-writer`, `tauri-store-async-init-race`, `verify-gate-builds-real-app`, `auto-build-at-phase-boundary`.
- `npm view @tauri-apps/plugin-autostart` → 2.5.1 (2025-10-27); `Cargo.lock` tauri 2.11.2.

### Secondary (MEDIUM confidence)
- [CITED: v2.tauri.app/plugin/autostart] — Rust registration, JS API, install commands, capability identifiers, MacosLauncher::LaunchAgent.
- [VERIFIED: crates.io/crates/tauri-plugin-autostart] — version 2.5.1, version history.

### Tertiary (LOW confidence)
- macOS HIG reserved-chord set beyond Spotlight/screenshots (A1) — general knowledge; the OS register-result is the authoritative gate regardless.

## Metadata

**Confidence breakdown:**
- Standard stack (autostart version + seam reuse): HIGH — version registry-verified, every seam read from source.
- Architecture (capability pattern, prefs fields, pane append): HIGH — direct precedents (opener capability, Phase-23 pane append) read in source.
- Conflict signaling + chord capture: HIGH — register-rejection contract confirmed in `registerSummon` comments + `e.code` discipline confirmed in project memory.
- start-in-tray reveal point: MEDIUM — window-launches-hidden VERIFIED, but the exact App-root reveal `show()` call wasn't in the files read (Open Question 1).
- OS-reserved blocklist exact set: LOW (A1) — UX-only, OS gate is authoritative.

**Research date:** 2026-06-18
**Valid until:** 2026-07-18 (stable; autostart 2.5.x is a mature plugin line)
