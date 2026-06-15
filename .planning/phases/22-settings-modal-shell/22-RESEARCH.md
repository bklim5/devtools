# Phase 22: Settings Modal Shell, Entry Points & License Pane - Research

**Researched:** 2026-06-15
**Domain:** Tauri 2 native menu/tray wiring + the `platform/` event seam + a shell-level React modal store (the unknowns); the modal UI/a11y is locked by 22-UI-SPEC and 22-CONTEXT.
**Confidence:** HIGH (codebase patterns verified by direct read; Tauri 2 menu APIs cited from official docs + GitHub issues)

## Summary

Phase 22 is mostly a *re-application* of patterns already shipped in this codebase, not new technology. The shell-level modal (`settingsStore`/`useSettings` + a single `<SettingsModal>` mounted in `App.tsx`) is a near-verbatim clone of the Phase-21 `upsellStore`/`useUpsell`/`UpsellModal` triad — including the synchronous invoker-capture focus-return fix. The `LicenseSettings` component drops into the License pane unchanged. The four entry points reuse three already-proven channels: the ⌘K command (sibling to the existing "License" command), the sidebar footer row (sibling to the "Unlock Pro" row), and the native menu/tray → webview event seam (an exact mirror of the existing `menu://check-updates` tray-event channel).

The genuinely new / non-trivial work is the **macOS application menu**. The app today sets **NO** app menu — `src-tauri/src/lib.rs` builds only a *tray* menu; macOS shows the Tauri-auto-generated default menu bar. Adding `TinkerDev ▸ Settings… (⌘,)` requires building an explicit `Menu` and calling `app.set_menu()`, which **replaces the entire default menu** — so the standard macOS items (Copy/Paste/Undo/Quit/Hide/etc.) must be reconstructed via `PredefinedMenuItem`/`SubmenuBuilder`, or the menu must be modified in place via `window.menu()` + `insert()`. Getting this wrong silently strips Copy/Paste from a text-heavy paste-first app — the single highest-risk item in the phase.

**Primary recommendation:** Clone the upsell triad for the store/modal; add the four entry points by mirroring the existing License-command / Unlock-Pro-row / `menu://check-updates` patterns; for the app menu, build a full menu with reconstructed default submenus (App/Edit/Window) plus the Settings item bound to `CmdOrCtrl+,`, and emit a `menu://open-settings` event the platform seam maps to `openSettings()`. Treat the native menu/tray entries as **manual-walkthrough** verification (WebDriver cannot drive native chrome).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-S1..D-S11)
- **D-S1:** In-window **modal overlay**, mounted shell-level — mirror the Phase-21 upsell pattern: a new `openSettings()` store (`src/shell/settingsStore.ts` + `useSettings.ts`, modeled on `upsellStore.ts`/`useUpsell.ts`) and a single `<SettingsModal>` mounted once in `src/App.tsx` (like `UpsellModal`). NOT a separate Tauri window, no IPC.
- **D-S2:** Reuse `UpsellModal`'s hardened a11y mechanics verbatim — focus trap while open, **return focus to the invoker** (capture the invoker synchronously at `openSettings()` time, the Phase-21 fix), `aria-modal` + `aria-labelledby`.
- **D-S3:** **Left nav list** (Claude #9 style) — vertical pane list on the left, content pane on the right. Scales to 5 panes. In Phase 22 the list shows **only License**. Fully keyboard-navigable; active pane announced via `aria` (SET-05).
- **D-S4:** **Large centered modal over a dimmed backdrop** (Claude #9), not a full-window overlay.
- **D-S5:** Dismiss on **Esc AND backdrop click** (plus an explicit close control). Calm tone, neutral tokens.
- **D-S6:** The **modal supersedes** the Phase-21 in-window `#/settings/license` route — ONE surface, no duplication. Re-point D-88 (footer license affordance + ⌘K "License" command) to `openSettings('license')`. Keep `#/settings/license` as a **deep-link** that opens the modal on the License pane (HashRouter-friendly). `LicenseSettings.tsx` renders **inside** the modal's License pane **unchanged** (SET-06).
- **D-S7:** Native entries via the `src/lib/platform/` event seam (tools/components never import `@tauri-apps/*` directly): app menu `TinkerDev ▸ Settings…` bound to **⌘,**; tray `Settings…` item. Both Rust handlers **emit an event** a `platform`-seam listener turns into `openSettings()`. `tauri.ts` is the sole `@tauri-apps/*` importer; `browser.ts` is a deterministic no-op.
- **D-S8:** Webview entries: a **⌘K "Settings" command** (sibling to the D-88 "License" command in `CommandPalette.tsx`) and the sidebar **Settings row**.
- **D-S9:** Footer layout, top → bottom: (1) the existing **Unlock Pro / "License needs attention"** affordance (top); (2) a gear **⚙ Settings** row **anchored at the very bottom** (position-locked / sticky bottom — NOT Pro-gated).
- **D-S10:** The Settings row **opens for everyone, including unlicensed** (SET-04). The License pane shows the no-license + Unlock-Pro/activate state for unlicensed users.
- **D-S11:** The D-88 "License needs attention" affordance now **opens Settings on the License pane** (`openSettings('license')`), consistent with D-S6. The free-tier "Unlock Pro" row keeps opening the upsell modal.

### Claude's Discretion
- Exact `settingsStore` shape (mirror `upsellStore`); the modal's internal pane-registry data structure (extensible for Phases 23–25); precise keyboard model for left-list nav (arrow/Home/End + Tab) within the existing WCAG patterns; gear icon choice (lucide, consistent with existing icons); modal width/height within "large centered" (match the design system). *(22-UI-SPEC resolves most of these — see below.)*

### Deferred Ideas (OUT OF SCOPE)
- Appearance/Themes pane → Phase 23 (SET-07). Hotkeys pane → Phase 24 (SET-08). General pane → Phase 24 (SET-09). Updates pane → Phase 25 (SET-10).
- Separate native OS Preferences window — rejected in favor of the in-window modal.
- Ship-gate live cases + v1.6 sign-off (belongs to v1.6 closure, not Settings).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SET-01 | Open Settings from macOS app menu (`TinkerDev ▸ Settings…`, ⌘,) via the `platform/` event seam | NEW app menu in `lib.rs` (`app.set_menu` + reconstructed defaults), accelerator `CmdOrCtrl+,`, `on_menu_event` → `app.emit("menu://open-settings")`; seam channel mirrors the existing `menu://check-updates` (`platform.events`) |
| SET-02 | Open Settings from the tray `Settings…` item via the same seam | Add `Settings…` `MenuItem` to the existing tray `Menu::with_items` in `lib.rs`; new `on_menu_event` arm emits `menu://open-settings`; same seam listener |
| SET-03 | Open Settings from a sidebar "Settings" row + the ⌘K palette | Sidebar footer: new bottom-anchored row mirroring the "Unlock Pro" row (`Sidebar.tsx`). ⌘K: new production `CommandRow` sibling to `licenseCommand` (`CommandPalette.tsx`) |
| SET-04 | Full in-window modal, Esc-dismissible, WCAG-AA (focus trap + return-focus, `aria-modal`/`aria-labelledby`), reachable by everyone incl. unlicensed | Clone `UpsellModal` mechanics verbatim (`UpsellPanel.tsx` lines 363–454); `settingsStore` clones `upsellStore` invoker-capture; License pane unlicensed = `LicenseSettings` notActivated state |
| SET-05 | Paned layout (left nav, right content), keyboard-navigable (move between panes, active pane announced via `aria`) | Pane registry array `[{id,label,icon,render}]`; `aria-current="page"` on active item + `aria-live="polite"` announce; arrow/Home/End nav mirroring sidebar `resolveRovingTarget` (clamp, no wrap) |
| SET-06 | License pane reuses `LicenseSettings.tsx` unchanged (all 5 states) | Render `<LicenseSettings />` directly as the pane child (it owns `overflow-auto p-8 gap-12`); do NOT modify it. **Heading caveat — see Pitfall 4** |
</phase_requirements>

## Standard Stack

**Zero new dependencies.** This is a binding wedge constraint and Phase 22 honors it fully — Tauri 2 menu/tray APIs are already in the dependency tree (`tauri = { version = "2", features = ["tray-icon"] }`), and all webview work reuses `lucide-react` + Tailwind v4 tokens + existing store patterns.

### Core (all already present — versions verified from manifests)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `tauri` (Rust) | `2` (features `tray-icon`) | App menu + tray menu construction (`tauri::menu::*`) | [VERIFIED: src-tauri/Cargo.toml] Already used for the tray; menu APIs ship in the same crate |
| `@tauri-apps/api` | `^2` | `@tauri-apps/api/event` `listen` for the seam channel; `@tauri-apps/api/core` `invoke` (existing) | [VERIFIED: package.json] `listen` already imported in `tauri.ts` for `menu://check-updates` |
| `react` | (existing) | `useSyncExternalStore` for `settingsStore` | [VERIFIED: codebase] `upsellStore`/`useUpsell` pattern |
| `react-router-dom` | (existing) | HashRouter deep-link `#/settings/license` | [VERIFIED: src/router.tsx] `createHashRouter` |
| `lucide-react` | (existing) | `Settings` (gear) + `X` (close) icons | [VERIFIED: imported across Sidebar/CommandPalette] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Shell-level modal (`settingsStore`) | A `react-router` `#/settings` route element | Rejected by D-S1/D-S6 — a route keeps the sidebar visible (the exact confusion that killed the Phase-21 in-window route); the modal is the single surface |
| `app.set_menu()` (replace whole menu) | `window.menu()` + `menu.insert()` to modify the default menu in place | `insert()` avoids reconstructing Copy/Paste/Quit, BUT the default menu is auto-generated and its structure is version-dependent and harder to target deterministically. **See Pitfall 1 for the recommendation.** |

## Architecture Patterns

### Recommended file layout (mirrors the upsell triad)
```
src/shell/settingsStore.ts     # clone of upsellStore.ts — open flag + activePane + invoker capture
src/shell/useSettings.ts       # clone of useUpsell.ts — useSyncExternalStore hooks
src/components/SettingsModal.tsx  # clone of UpsellModal mechanics + paned layout + pane registry
src/components/settingsPanes.ts   # the extensible pane registry [{id,label,icon,render}]  [discretion]
src/lib/platform/index.ts      # add events.onOpenSettings(cb) to the Platform interface
src/lib/platform/tauri.ts      # listen("menu://open-settings", ...) — the ONLY @tauri-apps importer
src/lib/platform/browser.ts    # deterministic no-op onOpenSettings (never fires)
src-tauri/src/lib.rs           # NEW app menu (set_menu) + tray Settings… item + 2 emit arms
src/App.tsx                    # mount <SettingsModal/> once; subscribe platform.events.onOpenSettings
src/router.tsx                 # #/settings/license → deep-link element that calls openSettings('license')
```

### Pattern 1: Shell-level modal store with synchronous invoker capture (clone upsellStore)
**What:** A module singleton over `useSyncExternalStore`, exposing `openSettings(pane?, invokerEl?)` / `closeSettings()` / `getSettingsOpen()` / `getActivePane()` / `getSettingsInvoker()`.
**When to use:** The single source of truth for "is Settings open + which pane + where focus returns."
**Why the invoker capture matters:** `[VERIFIED: src/shell/upsellStore.ts lines 47–82]` The modal mounts a tick AFTER the opener's click handler runs; reading `document.activeElement` inside the modal's mount effect is fragile across that gap. Capture the focused element **synchronously at `openSettings()` time**. Transient openers (⌘K command, menu/tray event) MUST pass an explicit persistent return target because their own element detaches — exactly as the ⌘K License command passes `preOpenFocus` today `[VERIFIED: CommandPalette.tsx lines 144–148, 222–224]`.

```typescript
// Source: clone of src/shell/upsellStore.ts (VERIFIED), extended with pane state
let open = false;
let invoker: HTMLElement | null = null;
let activePane = "license"; // default + only pane this phase
const listeners = new Set<() => void>();
export function openSettings(pane = "license", invokerEl?: HTMLElement | null): void {
  if (open) return;                       // no-op if already open
  activePane = pane;
  invoker = invokerEl !== undefined ? invokerEl
    : (typeof HTMLElement !== "undefined" && document?.activeElement instanceof HTMLElement
        ? document.activeElement : null);
  open = true;
  for (const fn of listeners) fn();
}
```
Note the SSR/jsdom guards on `document`/`HTMLElement` — the store must stay importable in the node test env (the upsell store does the same).

### Pattern 2: Native menu/tray → webview event seam (mirror `menu://check-updates`)
**What:** Rust emits a global event; `tauri.ts` `listen()`s it and exposes an `onOpenSettings(cb)` subscription; `App.tsx` subscribes and calls `openSettings()`.
**Why this is low-risk:** The codebase already ships this exact shape for the tray "Check for Updates…" item. `[VERIFIED: lib.rs line 151 emits "menu://check-updates"; tauri.ts lines 113–116 listen()s it; App.tsx lines 86–97 subscribe via platform.events]`. The new channel is a copy-paste with a new event name.

```rust
// Rust side (lib.rs). App menu item handler AND tray item handler both emit:
"open_settings" => { let _ = app.emit("menu://open-settings", ()); }
```
```typescript
// tauri.ts — the ONLY @tauri-apps importer (listen already imported there):
events: {
  onMenuCheckUpdates: (h) => listen("menu://check-updates", () => h()),
  onOpenSettings:     (h) => listen("menu://open-settings",  () => h()),  // NEW
},
// browser.ts deterministic no-op:
events: { async onMenuCheckUpdates() { return () => {}; },
          async onOpenSettings()     { return () => {}; } },  // NEW
// App.tsx subscription (mirror the existing onMenuCheckUpdates effect, lines 86–97):
useEffect(() => {
  let unlisten: (() => void) | undefined; let alive = true;
  void platform.events.onOpenSettings(() => openSettings("license", document.body))
    .then((u) => { if (alive) unlisten = u; else u(); });
  return () => { alive = false; unlisten?.(); };
}, []);
```
**Focus-return for native openers:** the invoker is a native menu/tray item, not a DOM element. Pass an explicit persistent return target (e.g. `document.body` or the main content region) so the modal's close path lands focus on a connected element, never `<body>` becoming detached. `[CITED: upsellStore.ts openUpsell explicit-invoker contract]`

### Pattern 3: Pane registry (extensible for Phases 23–25)
**What:** `const PANES = [{ id: "license", label: "License", icon: Settings, render: () => <LicenseSettings /> }]`.
**When to use:** Drives the left nav list AND the right content. Phases 23–25 append their `{id,label,icon,render}` entry — no shell change. `[discretion per CONTEXT; 22-UI-SPEC State pattern row confirms array shape]`

### Pattern 4: Deep-link via a tiny router element (HashRouter-safe)
**What:** Keep the `#/settings/license` hash working by replacing the current route element (`<LicenseSettings />`) with a small element that, on mount, calls `openSettings('license')` then `<Navigate to="/" replace />` (or redirects to the resolved startup tool) so the modal is the single render — no duplicate in-window License surface.
**Why:** `[VERIFIED: router.tsx line 49]` the route currently renders `<LicenseSettings />` directly. D-S6 says the modal supersedes it. A redirect-after-open keeps any existing `#/settings/license` link/e2e hash navigation landing on the License pane while preserving HashRouter-only.

### Anti-Patterns to Avoid
- **Calling `app.set_menu()` with only the Settings item** — wipes Copy/Paste/Quit. See Pitfall 1.
- **Rendering a duplicate License surface** (route element + modal pane) — D-S6 mandates ONE surface.
- **Modifying `LicenseSettings.tsx`** — SET-06 is a byte-unchanged mandate; the heading reconciliation is handled by the *modal wrapper*, not by editing the component (see Pitfall 4).
- **Reading `document.activeElement` inside the modal mount effect for focus-return** — use the synchronous store capture (Pattern 1).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Focus trap + return-focus | A new trap implementation | The verbatim `UpsellModal` Tab-wrap handler (`UpsellPanel.tsx` 383–424) | Already WCAG-AA hardened (Phase 18 codex review); re-implementing risks the same aria-modal-without-trap failure |
| Open-state plumbing | New context/prop drilling | `useSyncExternalStore` module singleton (clone `upsellStore`) | Proven; decouples opener from modal mount (the focus-return fix depends on it) |
| Menu→webview comms | A custom Rust command + polling | `app.emit` + `@tauri-apps/api/event` `listen` (the `menu://check-updates` pattern) | Already shipped + tested in this codebase |
| macOS default menu items | Hand-writing Copy/Paste/Undo `MenuItem`s | `PredefinedMenuItem::{copy,paste,undo,redo,select_all,quit,hide,...}` + `SubmenuBuilder` | Predefined items get native behavior (actual edit actions, localized labels) for free |
| Accelerator string for ⌘, | Platform-`cfg` branching | `Some("CmdOrCtrl+,")` | [CITED: v2.tauri.app/learn/window-menu] Tauri translates CmdOrCtrl→Cmd on macOS automatically |

**Key insight:** Almost nothing here is new. The one place a custom solution is *required* is the app-menu construction — and even there the building blocks (`SubmenuBuilder`, `MenuBuilder`, `PredefinedMenuItem`) are framework-provided; the risk is *forgetting to reconstruct the defaults*, not building something novel.

## Common Pitfalls

### Pitfall 1: `app.set_menu()` replaces the ENTIRE default macOS menu (HIGHEST RISK)
**What goes wrong:** The app currently sets NO app menu `[VERIFIED: lib.rs has only a tray Menu, no app.set_menu/Builder.menu]`, so macOS auto-generates a full menu bar (App/Edit/Window with Copy/Paste/Undo/Quit/Hide/Minimize…). Calling `app.set_menu(menu)` with a menu that only contains the Settings item **removes all of those**. For a paste-first, text-heavy tool, losing the Edit menu's Copy/Paste (and their ⌘C/⌘V — though those mostly work via the webview, the menu items and standard shortcuts/services are user-visible chrome) is a serious regression.
**Why it happens:** `set_menu` is wholesale, not additive. `[VERIFIED: GitHub tauri#11422 "Setting the app menu in Tauri v2 on Mac OS" — custom menu leaves the bar missing default items]`
**How to avoid (recommended):** Build a COMPLETE menu: an App submenu (`PredefinedMenuItem::about`, separator, **the Settings item with `CmdOrCtrl+,`**, separator, `services`, `hide`/`hide_others`/`show_all`, separator, `quit`), an Edit submenu (`undo`/`redo`/`cut`/`copy`/`paste`/`select_all`), and a Window submenu (`minimize`/`fullscreen`/`close_window`). macOS convention: **Settings… lives under the App menu** (the first submenu), directly below About. `[CITED: macOS HIG + v2.tauri.app/learn/window-menu — "the first submenu becomes the application menu"]`
**Alternative (lower-surface):** `app.menu()`/`window.menu()` returns the existing default menu; `menu.get(EDIT_SUBMENU)` / `insert()` can add the Settings item to the App submenu in place without rebuilding everything. `[CITED: search result — v2 exposes menu().insert()]` This avoids reconstructing defaults but targeting the auto-generated submenu by id/index is less deterministic across Tauri patch versions. **Planner decision point:** pick ONE; the full-rebuild is more code but fully explicit and version-stable. Recommend the full rebuild, with a verification step that Copy/Paste/Quit are present.
**Warning signs:** After implementing, the menu bar shows only "Settings" or is missing the Edit menu — verify in the human walkthrough (WebDriver can't see native menus).

### Pitfall 2: Event timing — emit before the webview listener is registered
**What goes wrong:** Tauri has **no event buffering** — an event emitted before any listener is registered is silently discarded. `[VERIFIED: search — "Tauri's event system doesn't buffer events sent before listeners are registered"; GitHub tauri#7835/#10921]`
**Why it (does NOT) happen here:** This race bites *new-window* scenarios where you emit immediately after creating a window. For Phase 22 the event is **user-initiated** (the user clicks a menu/tray item) long after `App.tsx` mounted and registered the listener. The existing `menu://check-updates` channel proves this is safe in this codebase. **No buffering/replay is needed.**
**How to avoid:** Register the `onOpenSettings` subscription in `App.tsx` at mount (mirror the `onMenuCheckUpdates` effect). Do NOT emit `open-settings` from Rust `setup()` at startup. If a future "open settings on launch" requirement appears, that WOULD hit the race — out of scope here.
**Warning signs:** N/A this phase (no startup emit).

### Pitfall 3: macOS Option-key accelerator composition (the [[macos-option-key-composes-letters]] family)
**What goes wrong:** On macOS, `Option+letter` composes to a glyph (`Option+P` → "π"), which broke the sidebar's `e.key === "p"` check; the fix matched the physical `e.code === "KeyP"`. `[VERIFIED: STATE.md D-17; MEMORY macos-option-key-composes-letters]`
**Relevance to Phase 22:** The app-menu accelerator is **⌘, (Command+comma)**, NOT an Option chord — Tauri's native menu accelerator (`"CmdOrCtrl+,"`) is handled by the OS, not a webview `keydown`, so it is immune to the composition bug. The ⌘K palette already keys off `e.key.toLowerCase() === "k"` with `metaKey` `[VERIFIED: CommandPalette.tsx 172]` and is unaffected. **No new webview key handler is needed for either Settings entry** (the ⌘K "Settings" command is a row inside the already-open palette, reachable by typing, not a new global chord).
**How to avoid:** Use the native accelerator string for ⌘,; do not add a webview-level ⌘, handler. If the e2e ever dispatches a synthetic accelerator, match the composed shape (the existing e2e dispatches `key:'π'/code:'KeyP'` for Alt+P).
**Warning signs:** N/A unless a new Option-based chord is introduced (it isn't).

### Pitfall 4: The deep-link e2e reads the FIRST `<h2>` — a "Settings" dialog title breaks it
**What goes wrong:** `test/e2e/license-settings.e2e.ts` asserts `statusHeading()` (= `document.querySelector("h2").textContent`) equals `"Free"` / `"License needs attention"`. `[VERIFIED: license-settings.e2e.ts lines 50–55, 132, 157]`. If the Settings modal renders a visible `<h2 id="...">Settings</h2>` dialog title that appears in the DOM **before** the License pane's `<h2>` (the LicenseSettings status heading), `querySelector("h2")` returns "Settings" and every status-heading assertion fails.
**Why it happens:** The migration changes the DOM structure around `LicenseSettings`. The e2e was written against the standalone route where the status heading was the first `<h2>`.
**How to avoid:** Two coordinated moves — (a) the e2e MUST be migrated (it's an explicit phase task) to open the modal and scope its heading query *inside the License pane / dialog content region* rather than `document.querySelector("h2")`; (b) consider making the dialog title an `<h1>` or scoping with a stable selector (`[role="dialog"] [data-pane="license"] h2`). The 22-UI-SPEC heading-reconciliation note (keep `LicenseSettings`'s `sr-only` `<h1>License</h1>`; dialog title is `<h2 id={dialogTitleId}>Settings</h2>`) makes the duplicate-heading collision concrete. **Do NOT edit LicenseSettings to fix this** (SET-06) — fix it in the modal wrapper + the e2e probes.
**Warning signs:** `expected … "Free" … got "Settings"` in the license-settings e2e.

### Pitfall 5: `LicenseSettings` card is `max-w-[420px]`; the pane is wider
**What goes wrong:** `LicenseSettings` renders a `max-w-[420px]` card `[VERIFIED: LicenseSettings.tsx line 55 CARD_CLASS]` inside its own `overflow-auto p-8`. The right content pane is `w-[min(880px,92vw)]`-ish. The card will sit left-aligned in a wide pane (fine), but double-padding is a risk: the 22-UI-SPEC warns to render `LicenseSettings` **directly** as the pane child (it provides its own `p-8`/`gap-12`) — do NOT wrap it in another `p-8`.
**How to avoid:** Host `<LicenseSettings />` as the direct pane content; let its own `overflow-auto` be the scroll container. The pane wrapper provides `bg-pane flex-1` only, no extra padding. `[CITED: 22-UI-SPEC Layout Contract]`
**Warning signs:** Doubled inset / mismatched scroll behavior vs the standalone route.

### Pitfall 6: z-index collision with the upsell modal (License pane can open the upsell)
**What goes wrong:** From the License pane, an unlicensed user clicks "Activate a license" / "Reactivate", which calls `openUpsell()` — opening `UpsellModal` at `z-[60]`. The Settings modal is also `z-[60]` (per 22-UI-SPEC). Two `z-[60]` aria-modals stacked.
**Why it happens:** `LicenseSettings` Reactivate/Activate → `openUpsell()` is unchanged (D-S6/SET-06). So the upsell can open *on top of* the Settings modal.
**How to avoid:** This already works today (the upsell opens over routes/sidebar). Two stacked dialogs is acceptable IF the upsell is visually on top and traps focus — since both are `z-[60]` and the upsell mounts later in `App.tsx`'s render order (it's a sibling), DOM order decides stacking. **Verify the upsell renders after/over the Settings modal in `App.tsx`** (mount `<SettingsModal>` BEFORE `<UpsellModal>` in JSX so the upsell wins the tie), and that Esc closes the upsell first. Confirm in the human walkthrough. `[VERIFIED: App.tsx mounts UpsellModal at line 166; SettingsModal must mount before it]`
**Warning signs:** Activate-from-License-pane shows the upsell behind the Settings scrim, or Esc closes the wrong dialog.

### Pitfall 7: Single-instance / summon must not regress
**What goes wrong:** Adding an app menu changes `setup()`; a mistake could disturb the single-instance plugin (must stay FIRST plugin) or the tray summon order (unminimize→show→set_focus, D-03).
**How to avoid:** Add the app menu and the tray Settings item WITHOUT reordering plugins or the existing tray summon logic. The app menu is built inside `setup()` alongside the tray (or via `Builder.menu()` before `setup`); keep `tauri_plugin_single_instance::init` as the first `.plugin()`. `[VERIFIED: lib.rs lines 19–25 single-instance is first; summon order at 144–168]`
**Warning signs:** Second-launch no longer summons; tray click stops focusing.

## Code Examples

### Building the macOS app menu with Settings + reconstructed defaults
```rust
// Source: v2.tauri.app/learn/window-menu (CITED) + lib.rs existing patterns (VERIFIED)
use tauri::menu::{MenuBuilder, SubmenuBuilder, MenuItem, PredefinedMenuItem};
use tauri::{Emitter, Manager};

// inside setup(), or via Builder::default().menu(|handle| { ... }) before .setup:
let settings_i = MenuItem::with_id(app, "open_settings", "Settings…", true, Some("CmdOrCtrl+,"))?;

let app_menu = SubmenuBuilder::new(app, "TinkerDev")
    .item(&PredefinedMenuItem::about(app, Some("TinkerDev"), None)?)
    .separator()
    .item(&settings_i)                       // ⌘, — macOS convention: under the app menu
    .separator()
    .services(app)?                          // builder convenience methods exist for predefined items
    .separator()
    .hide(app, None)?
    .hide_others(app, None)?
    .show_all(app, None)?
    .separator()
    .quit(app, None)?
    .build()?;

let edit_menu = SubmenuBuilder::new(app, "Edit")
    .undo().redo().separator().cut().copy().paste().select_all().build()?;

let window_menu = SubmenuBuilder::new(app, "Window")
    .minimize().separator().close_window().build()?;

let menu = MenuBuilder::new(app)
    .items(&[&app_menu, &edit_menu, &window_menu])
    .build()?;
app.set_menu(menu)?;

app.on_menu_event(move |app, event| {
    if event.id().as_ref() == "open_settings" {
        let _ = app.emit("menu://open-settings", ());
    }
});
```
*(Method names like `.services()`/`.hide()`/`.copy()` are `SubmenuBuilder` convenience methods for `PredefinedMenuItem`s; verify exact signatures against the installed Tauri patch during planning — the `PredefinedMenuItem::about(app, name, metadata)` arity changed across 2.x. See Pitfall 1 / version verification.)*

### Tray Settings… item (extend the existing tray menu)
```rust
// Source: lib.rs lines 128–155 (VERIFIED existing tray) — add one item + one arm
let settings_i = MenuItem::with_id(app, "open_settings", "Settings…", true, None::<&str>)?;
let menu = Menu::with_items(app, &[&show_i, &settings_i, &check_updates_i, &quit_i])?;
// in on_menu_event:
"open_settings" => { let _ = app.emit("menu://open-settings", ()); }
```

### ⌘K "Settings" command (sibling to the License command)
```typescript
// Source: CommandPalette.tsx lines 212–233 (VERIFIED licenseCommand) — clone it
const settingsCommand: CommandRow = {
  kind: "command", id: "settings", name: "Settings", icon: Settings,
  // pass pre-palette focus as the explicit return target (the palette button unmounts)
  run: () => openSettings("license", preOpenFocus),
};
const commands = useMemo(() => [licenseCommand, settingsCommand, ...DEV_COMMANDS], [...]);
```

### Sidebar bottom-anchored Settings row (D-S9)
```typescript
// Source: Sidebar.tsx lines 640–649 (VERIFIED Unlock Pro row) — add BELOW it, not Pro-gated
<button type="button" onClick={() => openSettings("license")}
  className="flex min-h-6 items-center gap-2 rounded-[6px] px-[11px] py-1 text-left text-[13px] text-tx-2 outline-none transition-colors hover:text-tx focus-visible:ring-2 focus-visible:ring-accent">
  <Settings aria-hidden="true" className="h-3 w-3 flex-none" /> Settings
</button>
```
*(The existing Unlock-Pro row is conditionally rendered; the Settings row must be UNconditional and after it so it anchors at the bottom. The `nav` above is `flex-1`, so both footer rows sit at the bottom — Settings last.)*

## Runtime State Inventory

> This is a UI/wiring phase, not a rename/migration. Included for the native-state question (does adding a menu leave stale OS-registered state?).

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no datastore keys involve "settings"; prefs (`prefs.json`) gains no new keys this phase (panes that persist are 23–25). | None — verified by reading prefsStore usage; Phase 22 adds no persisted pref |
| Live service config | None — no external service references this UI. | None |
| OS-registered state | The macOS **app menu** is set at runtime via `app.set_menu()` each launch (not persisted by the OS); the **tray menu** likewise. No stale registration survives a rebuild. The global summon shortcut (`global-shortcut`) is unaffected. | None beyond building the menus in `setup()` |
| Secrets/env vars | None. | None |
| Build artifacts | None — no package rename; `decoder.ts` untouched. | None |

**The canonical question (after every file is updated, what runtime state carries the old behavior?):** Nothing persisted. The only "registered" state is the in-process menu rebuilt every launch — there is no stale-menu hazard across rebuilds.

## Validation Architecture

> `workflow.nyquist_validation: true` [VERIFIED: .planning/config.json] — section required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `vitest` 4.1.7 (unit/jsdom) + WebdriverIO 9.27 (`@wdio/*`) real-WKWebView e2e [VERIFIED: package.json] |
| Config file | `vitest.config.*` (node/jsdom); `wdio.conf.ts` (e2e, auto-discovers `test/e2e/*.e2e.ts`) |
| Quick run command | `pnpm test` (= `vitest run`) + `tsc --noEmit` + eslint (the lefthook unit gate) |
| Full suite command | unit gate above, then `bash scripts/e2e-spike.sh` (real WKWebView, `tauri dev --features webdriver`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SET-04 | Modal opens/closes; focus trap; return-focus; aria-modal/labelledby | unit (jsdom) | `pnpm test src/components/SettingsModal.test.tsx` | ❌ Wave 0 |
| SET-05 | Paned layout; arrow/Home/End pane nav; `aria-current` + aria-live announce | unit (jsdom) | same SettingsModal test | ❌ Wave 0 |
| SET-03 | ⌘K "Settings" command opens the modal; sidebar Settings row opens it | unit (jsdom) | `CommandPalette.test.tsx` (extend) + `Sidebar.test.tsx` (extend) | ⚠️ extend existing |
| SET-03 | Sidebar Settings row visible for everyone incl. free tier, anchored bottom | e2e | extend `test/e2e/sidebar.e2e.ts` OR new `settings.e2e.ts` | ❌ Wave 0 |
| SET-06 | License pane renders LicenseSettings 5 states unchanged; deep-link `#/settings/license` opens modal on License pane | e2e | **migrate** `test/e2e/license-settings.e2e.ts` | ✅ migrate (see Pitfall 4) |
| SET-04 | Real-WKWebView: modal mounts as `[role=dialog][aria-modal]`, Esc/backdrop dismiss, focus-return | e2e | new `test/e2e/settings.e2e.ts` (mirror license-settings focus-return spec) | ❌ Wave 0 |
| SET-01/02 | App-menu ⌘, + tray Settings… open the modal | **manual-walkthrough** | N/A — WebDriver cannot drive native menu/tray | manual (see below) |
| settingsStore | open/close/pane/invoker-capture purity | unit | `src/shell/settingsStore.test.ts` (mirror upsellStore test if present) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm test <touched spec>` + `tsc --noEmit` + eslint (lefthook blocks RED — land tests GREEN with impl, the [[tdd-red-commits-blocked-by-lefthook]] rule).
- **Per wave merge:** full `vitest run` + the real-WKWebView e2e (`scripts/e2e-spike.sh`).
- **Phase gate:** full suite green + `pnpm tauri build` + human walkthrough (native menu/tray) + `gsd-ui-review` WCAG-AA.

### Wave 0 Gaps
- [ ] `src/shell/settingsStore.test.ts` — store purity (open/close/pane/invoker), SSR-guard importability — covers settingsStore
- [ ] `src/components/SettingsModal.test.tsx` — focus trap, return-focus, aria-modal/labelledby, pane nav + aria-live — covers SET-04/SET-05
- [ ] `test/e2e/settings.e2e.ts` — real-WKWebView modal open (via sidebar row + ⌘K), Esc/backdrop dismiss, focus-return, deep-link `#/settings/license` opens License pane — covers SET-03/SET-04/SET-06
- [ ] **Migrate** `test/e2e/license-settings.e2e.ts` — re-scope `statusHeading()` probes inside the dialog/pane (Pitfall 4); open via the modal not the bare route
- [ ] **Manual-walkthrough doc** (`22-HUMAN-UAT.md`) — app-menu `TinkerDev ▸ Settings… (⌘,)` opens the modal; tray `Settings…` opens it; **Copy/Paste/Quit still present in the menu bar** (Pitfall 1 regression check); native opener focus-return
- [ ] Extend `CommandPalette.test.tsx` + `Sidebar.test.tsx` for the new entries

*(Existing infra covers a lot: `helpers.ts` has `upsellModalOpen`, `navigateToTool`, `saveScreenshot`, `dispatchKey`; the e2e-spike preflight resets prefs + machine.dev.lic.)*

## Security Domain

> `security_enforcement` not present in config → treat as enabled. This phase adds NO new attack surface of note (no network, no new capabilities, no secrets).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Licensing auth is Phase 19/21 (unchanged); Settings just hosts the existing pane |
| V3 Session Management | no | No sessions |
| V4 Access Control | partial | The Settings row opens for everyone incl. unlicensed (D-S10) — intentional; the License pane's own gating (entitlements) is unchanged |
| V5 Input Validation | minimal | The only input is the license key inside the unchanged `LicenseSettings`/`UpsellPanel` (trim-only client validation, Keygen is the validator — unchanged) |
| V6 Cryptography | no | No crypto in this phase (Ed25519 verify stays Rust-side, untouched) |

### Known Threat Patterns for {Tauri menu/event seam}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Untrusted event payload from `menu://open-settings` | Tampering | The event carries NO payload (`()`); the listener ignores any data and just calls `openSettings()` — mirror the `menu://check-updates` no-payload pattern |
| New Tauri capability needed for menu? | Elevation | **None** — app-defined menus/`emit`/`listen` need no capability entry (like the existing license commands and `menu://check-updates`). `capabilities/default.json` is unchanged. [VERIFIED: capabilities/default.json has no event/menu permission for the existing tray channel] |
| Webview reaching `@tauri-apps/*` directly | — (wedge violation) | The seam rule: only `tauri.ts` imports `@tauri-apps/api/event`; `onOpenSettings` is exposed on `platform.events`; `browser.ts` no-op. [VERIFIED: existing seam structure] |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| In-window `#/settings/license` route (Phase 21) | Shell-level modal, route becomes a deep-link that opens it | Phase 22 (D-S6) | The route keeping the sidebar visible was the confusion that motivated the modal; one surface now |
| Tauri 1 `Menu`/`MenuItem` builder API | Tauri 2 `tauri::menu::{MenuBuilder, SubmenuBuilder, MenuItem, PredefinedMenuItem}` + `app.set_menu()` | Tauri 2.0 | This codebase is on Tauri 2; use the v2 builder APIs. macOS requires all items under submenus (top-level items ignored) |

**Deprecated/outdated:**
- Tauri 1 menu APIs and any pre-2.0 `tauri::api::menu` references in training data — confirm against the installed `tauri@2` patch (`PredefinedMenuItem::about` arity in particular shifted across 2.x).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `SubmenuBuilder` convenience methods (`.copy()`, `.paste()`, `.services()`, `.hide()`, etc.) exist with the shown signatures in the installed Tauri 2 patch | Code Examples / Don't Hand-Roll | LOW — if a method is absent, fall back to `.item(&PredefinedMenuItem::copy(app, None)?)`; verify during planning via `cargo doc`/the installed crate source |
| A2 | `PredefinedMenuItem::about(app, name, metadata)` arity matches the example | Code Examples | LOW — arity changed across 2.x; planner must confirm against the pinned patch before writing the menu |
| A3 | Two stacked `z-[60]` aria-modals (Settings + upsell-from-License-pane) stack correctly by DOM order (mount SettingsModal before UpsellModal) | Pitfall 6 | MEDIUM — if stacking is wrong, the upsell appears behind the scrim; mitigated by explicit JSX order + a walkthrough check |
| A4 | The native menu/tray emit→listen channel has no race because the listener is registered at App mount before any user click | Pitfall 2 | LOW — proven by the shipped `menu://check-updates` channel |
| A5 | `app.set_menu()` replaces (not merges) the default menu, so defaults must be reconstructed | Pitfall 1 | LOW — corroborated by GitHub tauri#11422 + the "default menu" docs; the walkthrough Copy/Paste check is the backstop |
| A6 | WebDriver cannot drive the native macOS menu bar / tray, so SET-01/02 are manual-walkthrough | Validation | LOW — consistent with the codebase's established native-input manual-coverage rule ([[tauri-native-dragdrop-blocks-html5-dnd]], Buy-CTA precedent) |

## Open Questions

1. **App menu: full rebuild vs `menu().insert()` in place?**
   - What we know: `set_menu` replaces everything; `window.menu()`/`insert()` can modify the auto-default in place.
   - What's unclear: whether targeting the auto-generated App submenu by id/index is stable across Tauri 2 patches.
   - Recommendation: full rebuild (explicit, version-stable) with a walkthrough check that Copy/Paste/Quit survive. Decide in planning.

2. **Where does `app.set_menu` live — `Builder::menu()` (before windows) or inside `setup()`?**
   - What we know: both work; the tray is built inside `setup()` today.
   - Recommendation: build it inside `setup()` next to the tray for locality, OR `Builder::default().menu(|h| …)` if a pre-window menu avoids a first-paint menu flash. Low stakes; planner picks.

3. **Pane semantics: `aria-current` button-list vs `tablist/tab/tabpanel`?**
   - What we know: 22-UI-SPEC permits either but mandates picking ONE for Phases 23–25 to inherit; recommends `button` + `aria-current="page"` + aria-live.
   - Recommendation: follow the UI-SPEC's recommended `aria-current` list (simpler, matches the sidebar precedent). Lock it in the plan (the UI-SPEC reviewer flagged this explicitly).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Tauri 2 (Rust) menu APIs | SET-01/02 | ✓ | `2` (tray-icon feature) | — |
| `@tauri-apps/api` event `listen` | seam channel | ✓ | `^2` (already imported in tauri.ts) | — |
| WebdriverIO + tauri-plugin-webdriver | e2e gate | ✓ | wdio 9.27; debug-only plugin | — |
| macOS app for native menu/tray verify | SET-01/02 manual | ✓ (`pnpm tauri build` at phase gate) | — | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None — zero new deps; everything is in the tree.

## Sources

### Primary (HIGH confidence)
- Direct codebase read (VERIFIED): `src/shell/upsellStore.ts`, `src/shell/useUpsell.ts`, `src/App.tsx`, `src-tauri/src/lib.rs`, `src/lib/platform/{index,tauri,browser}.ts`, `src/router.tsx`, `src/components/{UpsellPanel,CommandPalette,Sidebar,LicenseSettings}.tsx`, `test/e2e/{license-settings.e2e.ts,helpers.ts}`, `src-tauri/capabilities/default.json`, `src-tauri/Cargo.toml`, `package.json`, `.planning/config.json`
- [v2.tauri.app/learn/window-menu](https://v2.tauri.app/learn/window-menu/) — SubmenuBuilder/MenuBuilder/set_menu, accelerator `CmdOrCtrl+,`, macOS "first submenu = app menu", predefined items
- [v2.tauri.app/develop/calling-frontend](https://v2.tauri.app/develop/calling-frontend/) — `app.emit` → `listen` event pattern

### Secondary (MEDIUM confidence)
- [GitHub tauri#11422 — Setting the app menu in Tauri v2 on Mac OS](https://github.com/tauri-apps/tauri/issues/11422) — confirms set_menu drops default items
- [GitHub tauri#7835 / #10921](https://github.com/tauri-apps/tauri/issues/7835) — no event buffering before listener registration
- [Tauri v2 custom menu items — ratulmaharaj.com](https://ratulmaharaj.com/posts/tauri-custom-menu/) — v2 menu item example

### Tertiary (LOW confidence — verify against installed patch)
- Exact `SubmenuBuilder`/`PredefinedMenuItem` method signatures (A1/A2) — confirm via `cargo doc` on the pinned `tauri@2` patch during planning

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new deps; all versions read from manifests
- Architecture (store/modal/seam): HIGH — verbatim clones of shipped, tested patterns
- App-menu construction: MEDIUM — API shape cited from official docs + issues, but exact method signatures vary across Tauri 2.x patches (A1/A2)
- Pitfalls: HIGH — Pitfall 1 (set_menu replaces) and Pitfall 4 (h2 e2e collision) are concrete and corroborated/verified
- Validation: HIGH — framework + existing specs read directly

**Research date:** 2026-06-15
**Valid until:** 2026-07-15 (stable codebase patterns); the Tauri menu API specifics — re-verify if the `tauri` crate is bumped
