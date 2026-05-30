# Phase 2: Shell - Research

**Researched:** 2026-05-30
**Domain:** React 19 SPA shell architecture (registry-driven sidebar + ⌘K palette + preference persistence) inside a Tauri 2 macOS webview
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Sidebar & disabled tools (SHL-01)**
- **D-01:** Enable the three registered stubs (`unix-time`, `base64`, `protobuf-decoder`) by flipping `enabled` to true; each renders a simple "coming in Phase 3" placeholder component until its real UI lands. Today all three are `enabled:false`, so `ENABLED_TOOLS` is empty and a registry-driven sidebar/palette/router would render nothing. Placeholders make sidebar, palette, routing, and persistence fully exercisable now; Phase 3/4 swap the placeholder for the real `component`. **Do NOT** alter `decoder.ts`/`bytes.ts`/`types.ts` (port-unchanged bar); only the per-tool `enabled` flag + a shared placeholder component change.
- **D-02:** Fixed compact density (icon + name), exactly per SHL-01. No full/icons-only modes and no density toggle in v1. Active-state styling follows the design: left accent bar + `--accent-soft` background tint, active icon in `--accent`.
- **D-03:** The ⌘K palette is the dedicated no-mouse path. The sidebar is mouse + standard Tab focus only — no parallel arrow-key/j-k navigation and no ⌘1..⌘6 number shortcuts.

**⌘K command palette (SHL-02, SHL-03)**
- **D-04:** Palette searches tools only in v1 (fuzzy over name + keywords + description, Enter switches). No global app-actions registry and no recent-inputs/value entries yet.
- **D-05:** Empty query shows recents first, then the rest — the last ~5 used tools at top, then remaining tools in registry order; typing filters across all tools.
- **D-06:** In-house, zero-dependency fuzzy matcher (~30 lines) ranking by match quality. No `cmdk`, no `fuse.js`. (The existing `searchTools()` substring filter can be upgraded to this ranker.)
- **D-07:** ⌘K-only trigger; never auto-opens. Opens on ⌘K (and a click affordance); does NOT auto-open on launch. No-match renders a quiet "No tools match" state (not an error).

**Preferences & storage (SHL-05, SHL-06)**
- **D-08:** Persist: last-used tool, the recent-tools list (powers D-05), and theme/accent. These survive an app restart. **Window geometry is NOT persisted in Phase 2 — deferred to Phase 5** (D-11).
- **D-09:** Storage = `@tauri-apps/plugin-store` for the desktop app, with a `localStorage` fallback for browser dev, both behind the existing `Store` interface in `src/lib/platform/` (`get`/`set`). Realizes the Phase-1 stub without tools importing `@tauri-apps/*` directly. The store schema must stay extensible so Phase 3 can add the Protobuf tree-style key.
- **D-10:** Theme = dark-only for v1, with a persisted accent color. No light theme / toggle in this phase. **Structure for future extensibility:** store theme as a named value (e.g. `"dark"`) not a boolean, drive colors through the design's CSS-variable system, so a light theme can be added later without reworking persistence or components.
- **D-11:** Window geometry persistence DEFERRED to Phase 5. Phase 2 persists only app-state prefs (D-08). This splits SHL-05's window-geometry clause forward; **flag for the planner so SHL-05 isn't marked fully complete at the Phase 2 boundary.**

**First-run & opens-to-last (SHL-06)**
- **D-12:** First launch (no saved state) opens the Protobuf decoder (the hero). **Make default-tool selection configurable in the future**; v1 hardcodes the hero but the resolution logic should be a single seam a future preference can feed, not scattered conditionals.
- **D-13:** If the last-used tool was since disabled/removed, silently fall back to the hero default (Protobuf). Never surfaces a picker.
- **D-14:** An explicit launch target overrides last-used — a `#/tools/<id>` deep-link (or future global-shortcut summon) wins; otherwise restore last-used. Sets the data model now; Phase 5 wires the actual global shortcut.

### Claude's Discretion
Exact placeholder component markup/copy (D-01), recents list length (≈5, D-05), fuzzy-ranker scoring details (D-06), palette Esc/typeahead-reset micro-behaviors, store key names/namespacing, reset-to-defaults handling, and `lucide-react` icon choices per tool. Adding `lucide-react` as a dependency is expected (registry's `icon` field is a lucide component; not yet in `package.json`).

### Deferred Ideas (OUT OF SCOPE)
- Sidebar density toggle (full / icons-only) and persisting it (D-02).
- Palette global app-actions ("Toggle theme", "Copy output") and recent-inputs entries (D-04).
- Light theme / light-dark toggle (D-10) — v1 dark-only with persisted accent, structured to allow it later.
- Window-geometry persistence — deferred to Phase 5 (D-11). SHL-05's window-geometry clause lands in Phase 5.
- Configurable default/startup tool (D-12) — v1 hardcodes Protobuf hero; seam built to accept it.
- Global summon shortcut, tray/menu, single-instance — Phase 5; Phase 2 only sets the summon-to-tool precedence data model (D-14).
- Protobuf tree-style preference value — schema reserved here, written by Phase 3.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SHL-01 | Sidebar (compact: icon + name) renders, generated from the tool registry | `ENABLED_TOOLS.map(...)` → `NavLink`; mockup `.sidebar.mode-compact` + `.navitem.on` styling (left accent bar + `--accent-soft`); D-01 enables stubs |
| SHL-02 | ⌘K palette opens, fuzzy-matches name+keywords+description, Enter switches (no mouse) | Global `keydown` (`metaKey && key==="k"`), in-house fuzzy ranker (D-06), `useNavigate()` on Enter; mockup `.palette-scrim`/`.palette` markup |
| SHL-03 | Palette remembers and surfaces recently-used tools | Persisted `recentToolIds` array (capped ~5); empty-query layout = recents group then all tools (D-05) |
| SHL-04 | Registry is single source of truth — file + one entry → sidebar/palette/route appear | Already the established pattern; sidebar, `searchTools`/ranker, and `router.tsx` all derive from `ENABLED_TOOLS`. Verification: add a throwaway tool, confirm it appears in all three, then remove |
| SHL-05 | Prefs persist across restarts: theme, last-used tool, **window geometry**, Protobuf tree style | Real `Store` via `@tauri-apps/plugin-store` behind the seam (D-09). **PARTIAL in Phase 2:** theme/accent + last-used + recents persist; window geometry → Phase 5 (D-11); Protobuf tree-style key → schema reserved, value written by Phase 3 |
| SHL-06 | App opens to last-used or summoned tool, no "pick a tool" step | Index-route resolver: explicit target (D-14) > last-used (D-13 fallback to hero if gone) > first-run hero (D-12) |
</phase_requirements>

## Summary

Phase 2 is pure frontend React/TypeScript work plus one Tauri plugin wired strictly behind the existing `src/lib/platform/` seam. Nothing here is novel architecture — every piece extends a pattern Phase 1 already locked: the registry is the single control plane, the router is HashRouter, and the platform seam is the only place `@tauri-apps/*` is touched. The job is to (1) build the compact sidebar and ⌘K palette as registry consumers, (2) make the Phase-1 in-memory store stub a real persistent store, and (3) add a startup-resolution seam that picks the opening tool.

Two dependencies get added: `lucide-react` (the registry's `icon` field is already typed as a lucide component) and `@tauri-apps/plugin-store` (used **only** inside `platform/tauri.ts`). Both have verified-current versions and React-19 / Tauri-2 compatibility. The fuzzy matcher is in-house (~30 lines) per D-06 — no `cmdk`/`fuse.js`, consistent with the no-runtime-dependency ethos.

**Primary recommendation:** Build the sidebar and palette as thin presentational consumers of `ENABLED_TOOLS` + a small `usePreferences` hook backed by the `Store` seam; centralize all "which tool opens" logic in a single `resolveStartupTool()` function fed by the router's index route. Add the real store impl behind the existing `Store` interface — do not widen the seam's surface beyond `get`/`set`. Flag SHL-05 as **partially** satisfied (window-geometry deferred to Phase 5).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `lucide-react` | `1.17.0` | Sidebar/palette tool icons | `ToolDefinition.icon` is already typed `ComponentType<{className?:string}>` — lucide's exact signature. Tree-shakeable, no runtime network. [VERIFIED: npm view lucide-react version → 1.17.0, published 2026-05-28; peerDeps include `^19.0.0`] |
| `@tauri-apps/plugin-store` (JS) | `2.4.3` | Persistent key/value store on disk | Official Tauri 2 plugin; matches the already-pinned `@tauri-apps/plugin-clipboard-manager@2.3.2` pattern. [VERIFIED: npm view @tauri-apps/plugin-store version → 2.4.3] |
| `tauri-plugin-store` (Rust crate) | `2.4.3` | Rust side of the store plugin | Registered once in `src-tauri/src/lib.rs`. [VERIFIED: crates.io API → max_stable_version 2.4.3] |
| React | `^19.1.0` (in repo) | UI | Already installed |
| `react-router-dom` | `7.16.0` (in repo) | HashRouter routing | Already installed; `useNavigate`/`NavLink`/`useLocation` are the Phase 2 hooks |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tauri-apps/api` | `^2` (in repo) | Already present | No new use needed in Phase 2 |
| `@fontsource/*` | `5.2.8` (in repo) | Self-hosted fonts | Already vendored (FND-05); no change |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-house fuzzy ranker (D-06) | `cmdk` / `fuse.js` | **Rejected by D-06.** Adds a runtime dependency for what is ~30 lines over 6 items; `cmdk` also brings its own DOM/focus model that fights the design's bespoke palette markup |
| `@tauri-apps/plugin-store` | `localStorage` only | localStorage works in the webview but is the *browser-dev fallback* (D-09); the desktop app wants a real on-disk JSON store that survives reinstalls/clears and is OS-native. Both live behind the same `Store` seam |
| Manual JSON file via Rust `fs` | plugin-store | plugin-store handles atomic writes, autosave debouncing, and path resolution — do not hand-roll (see Don't Hand-Roll) |

**Installation:**
```bash
pnpm add lucide-react@1.17.0 @tauri-apps/plugin-store@2.4.3
# Rust side (run in src-tauri/):
cargo add tauri-plugin-store@2.4.3
```

**Version verification (run before locking the plan):**
```bash
npm view lucide-react version            # expect 1.17.0 (or newer 1.x)
npm view @tauri-apps/plugin-store version # expect 2.4.x
```
Note: `lucide-react` reached 1.0 in early 2026 (long history of `0.4xx`). The repo's training-era assumption of a `0.x` version would be **stale** — confirm 1.x. [VERIFIED: npm versions list shows 1.0.0 → 1.17.0 in 2026]

## Architecture Patterns

### Recommended Project Structure
```
src/
├── App.tsx                  # shell chrome: titlebar + <Sidebar/> + <main><Outlet/></main> + <Palette/>
├── router.tsx               # HashRouter; index route calls resolveStartupTool()
├── components/
│   ├── Sidebar.tsx          # registry-driven compact sidebar (NavLink per ENABLED_TOOL)
│   └── CommandPalette.tsx   # ⌘K overlay; consumes ranker + recents
├── shell/
│   ├── usePreferences.ts    # hook: read/write prefs via platform.store (typed schema)
│   ├── useRecentTools.ts    # tracks last-used + recents list (or fold into usePreferences)
│   ├── resolveStartupTool.ts# single seam: explicit target > last-used > hero (D-12/13/14)
│   └── fuzzy.ts             # in-house ranker (D-06); upgrades searchTools usage
├── tools/
│   ├── _placeholder/        # shared "coming in Phase 3" component (D-01)
│   ├── base64/index.ts      # flip enabled:true, point component at placeholder
│   ├── protobuf-decoder/index.ts
│   └── unix-time/index.ts
└── lib/
    ├── tools/{registry.ts,types.ts}   # PORT-UNCHANGED contract — do not edit types.ts
    └── platform/{index.ts,tauri.ts,browser.ts,stub.ts}  # store impl lands in tauri.ts + browser.ts
```

### Pattern 1: Registry-driven sidebar (SHL-01, SHL-04)
**What:** Sidebar renders one `NavLink` per `ENABLED_TOOLS` entry; active state from `NavLink`'s `isActive`.
**When to use:** The sidebar — it is purely derived, holds no tool list of its own.
**Example (structure from `scaffold/src/components/Sidebar.tsx`, visuals rebuilt against mockup `.navitem`/`.navitem.on`):**
```tsx
// Compact mode (D-02): icon + name, no description row.
// Active = left --accent bar + --accent-soft bg + icon in --accent (mockup .navitem.on).
{ENABLED_TOOLS.map((tool) => {
  const Icon = tool.icon;
  return (
    <NavLink key={tool.id} to={`/tools/${tool.id}`}
      className={({ isActive }) => /* navitem + (isActive ? " on" : "") */}>
      <span className="navbar-accent" />     {/* left accent bar, scaleY 0→1 on active */}
      <Icon className="navicon" />
      <span className="navname">{tool.name}</span>
    </NavLink>
  );
})}
```
[CITED: design/DevTools Mockup.html lines 94-116 `.navlist`/`.navitem`/`.navbar-accent`; design/devtools-ui.jsx lines 207-238 Sidebar]

### Pattern 2: ⌘K command palette (SHL-02, SHL-03)
**What:** A full-screen scrim + centered 560px panel; global `keydown` listener toggles open on `(metaKey||ctrlKey) && key.toLowerCase()==="k"`, Esc closes. Input fuzzy-filters; ↑/↓ move a highlighted index; Enter `navigate()`s to the highlighted tool and closes.
**When to use:** The dedicated no-mouse switch path (D-03). It is the *only* keyboard tool-switcher.
**Example (key handler shape, verified against the mockup's own handler):**
```tsx
// Toggle handler — mirrors design/devtools-ui.jsx App() lines 321-328
useEffect(() => {
  const h = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault(); setOpen((o) => !o);
    }
    if (e.key === "Escape") setOpen(false);
  };
  window.addEventListener("keydown", h);
  return () => window.removeEventListener("keydown", h);
}, []);
```
Empty query → recents group (≈5, D-05) then all tools in registry order; non-empty → ranked across all tools. No match → quiet "No tools match" row, never an error (D-07).
[CITED: design/devtools-ui.jsx lines 250-280 Palette markup (`.palette-scrim`/`.palette-search`/`.palette-list`/`.pglabel`/`.pitem`/`.palette-foot`); mockup lines 252-274 palette CSS]

### Pattern 3: Preferences behind the existing `Store` seam (SHL-05/06, D-08/09)
**What:** A typed `usePreferences` hook reads/writes a single namespaced schema through `platform.store.get/set`. The store impl is swapped in `tauri.ts` (real plugin) and `browser.ts` (localStorage); the `Store` interface (`get`/`set`) is unchanged.
**When to use:** All persistence. Tools/components never touch `platform.store` directly for prefs — they go through the hook so the schema stays in one place and extensible (Phase 3 adds the tree-style key).
**Example (real store impl inside `tauri.ts` — the ONLY place plugin-store is imported):**
```ts
// src/lib/platform/tauri.ts — replaces createStoreStub()
import { load, type Store as TauriStore } from "@tauri-apps/plugin-store";
// load() is async; the seam's Store is get/set Promises, so lazily resolve the
// LazyStore once and delegate. Keep autoSave on (debounced) or save() on set.
```
[CITED: v2.tauri.app/plugin/store — `import { load } from '@tauri-apps/plugin-store'; const store = await load('store.json', { autoSave:false }); await store.set(k,v); await store.get(k); await store.save();`]

### Pattern 4: Startup resolution seam (SHL-06, D-12/13/14)
**What:** A single `resolveStartupTool({ explicitTarget, lastUsedId }): toolId` function with strict precedence: explicit `#/tools/<id>` target (if valid & enabled) → last-used (if still in `ENABLED_TOOLS`, else hero) → hero default (first run). The router's index route uses it to `<Navigate replace>`.
**When to use:** The index route and (Phase 5) the summon-to-tool path. Keep it ONE function so a future "default tool" preference (D-12) is a single edit, not scattered conditionals.
```ts
// HERO_TOOL_ID = "protobuf-decoder" (D-12). Future: read a pref here instead.
function resolveStartupTool(target: string | undefined, lastUsedId: string | undefined): string {
  if (target && getToolById(target)) return target;          // D-14
  if (lastUsedId && getToolById(lastUsedId)) return lastUsedId; // D-13 (getToolById already filters to ENABLED)
  return HERO_TOOL_ID;                                        // D-12
}
```
Note: `getToolById` already searches `ENABLED_TOOLS` only, so a disabled/removed last-used tool naturally falls through to hero (D-13).

### Anti-Patterns to Avoid
- **Importing `@tauri-apps/plugin-store` outside `platform/tauri.ts`:** breaks the env-safe seam (would pull Tauri into jsdom tests and the vite-preview fallback). The seam's whole design (lazy dynamic import gated on `__TAURI_INTERNALS__`) depends on this. [CITED: src/lib/platform/index.ts comments; docs/harness-and-decisions.md §2]
- **Widening the `Store` interface:** keep it `get`/`set`. The seam delegates per-capability via getters; adding methods means touching every impl + the test stub for no benefit.
- **A second keyboard-focus system on the sidebar:** D-03 forbids arrow/j-k sidebar nav and ⌘1..⌘6. The palette is the no-mouse path.
- **Reading prefs synchronously at module load:** `Store` is async (`Promise`). Resolve prefs in an effect / loader and guard first paint, or the startup tool resolves with stale/empty data.
- **`BrowserRouter`:** forbidden project-wide (static files 404 on reload). HashRouter only.
- **Editing `decoder.ts`/`bytes.ts`/`types.ts`:** port-unchanged bar; the 19 decoder tests are immovable (D-01).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| On-disk persistence | Custom JSON file via Rust `fs` + serialize | `@tauri-apps/plugin-store` | Atomic writes, autosave debouncing, OS-correct app-data path, reload — all solved [CITED: v2.tauri.app/plugin/store] |
| Tool icons | Hand-drawn SVGs per tool | `lucide-react` | `ToolDefinition.icon` is already typed for lucide; consistent stroke/size, tree-shakeable |
| Fuzzy matching | (allowed — D-06) | In-house ~30-line ranker | **Intentional exception:** D-06 says build it, NOT pull `cmdk`/`fuse.js`. 6 items, offline ethos |
| Env detection (Tauri vs browser) | New detection code | Existing `isTauri()` / `createPlatform()` in `platform/index.ts` | Already built and tested (FND-04) |
| Route-to-first-tool fallback | New guard | Existing `router.tsx` index/catch-all (refine, don't replace) | D-12/13/14 refine the existing redirect |

**Key insight:** Phase 2 adds almost no new infrastructure — the registry, router guard, and platform seam already exist. The risk is *re-inventing* them (a parallel store wrapper, a second tool list, a new env check) rather than filling in the one stub (`createStoreStub` → real impl) and consuming what's there.

## Common Pitfalls

### Pitfall 1: lucide-react version assumption
**What goes wrong:** Planning for `lucide-react@^0.4xx` (the version range present through most of 2024-2025) — the install resolves to 1.x with a different (compatible) API but the pinned version in the plan is wrong/stale.
**Why it happens:** Training data predates the 1.0 release; lucide-react sat at `0.x` for years.
**How to avoid:** Pin `1.17.0` (or current 1.x). Icon import names are unchanged (`import { Clock } from "lucide-react"`). [VERIFIED: npm — 1.0.0 shipped early 2026, latest 1.17.0]
**Warning signs:** `pnpm` resolves a major version different from the plan's pin.

### Pitfall 2: Tauri store permission missing → silent runtime failure
**What goes wrong:** plugin-store calls reject at runtime because `src-tauri/capabilities/default.json` lacks store permissions, even though JS/Rust compile fine. Current capabilities only grant `clipboard-manager:*`.
**Why it happens:** Tauri 2 gates every plugin command behind a capability; the build succeeds without it.
**How to avoid:** Add `"store:default"` to `default.json` permissions (alongside the existing clipboard entries), and register `tauri_plugin_store::Builder::new().build()` in `src-tauri/src/lib.rs`. [CITED: v2.tauri.app/plugin/store — required permissions list incl. `store:default`]
**Warning signs:** Prefs work in `vite preview` (localStorage fallback) but not in `tauri dev`/built app — a classic seam-divergence symptom.

### Pitfall 3: Async store vs synchronous startup resolution
**What goes wrong:** The index route resolves the startup tool before prefs have loaded, so it always falls back to the hero (last-used never restores).
**Why it happens:** `Store.get` is a `Promise`; the router renders synchronously.
**How to avoid:** Load prefs in `main.tsx` (after `initPlatform()`) or a route loader, and render the redirect only once `lastUsedId` is known (or accept hero-first paint then redirect). Keep it inside `resolveStartupTool` so the timing logic is in one place.
**Warning signs:** First launch and relaunch behave identically (always hero) even after using another tool.

### Pitfall 4: Self-hosted-only constraint vs lucide
**What goes wrong:** N/A risk, but worth confirming — lucide-react ships SVGs as React components bundled at build time, **no runtime network**. Safe under the no-CDN constraint. The mockup's Google-Fonts `<link>` tags must NOT be carried over (already handled in `index.css`).
**How to avoid:** Use `lucide-react` component imports (bundled), never the lucide CDN/icon-font.

### Pitfall 5: Tracking "recents" without bloating the hot path
**What goes wrong:** Writing to the on-disk store on every navigation/keystroke causes excess disk writes.
**How to avoid:** Update last-used + recents on tool *switch* only (not per render). Use plugin-store `autoSave` (debounced) or a single `set` per switch. Cap recents at ~5 (D-05), de-dupe, most-recent-first.

## Code Examples

### Real store impl behind the `Store` seam (Pattern 3 detail)
```ts
// src/lib/platform/tauri.ts — the ONLY file allowed to import @tauri-apps/*
// Source: v2.tauri.app/plugin/store
import { load } from "@tauri-apps/plugin-store";
import type { Platform } from "./index";

// load() returns a LazyStore lazily; resolve once, then delegate get/set.
function createTauriStore() {
  const ready = load("prefs.json", { autoSave: true }); // debounced autosave
  return {
    async get(key: string) { return (await ready).get(key); },
    async set(key: string, value: unknown) { await (await ready).set(key, value); },
  };
}
```

### Rust registration
```rust
// src-tauri/src/lib.rs — add alongside the clipboard plugin
tauri::Builder::default()
    .plugin(tauri_plugin_clipboard_manager::init())
    .plugin(tauri_plugin_store::Builder::new().build())  // NEW
    // ...
```
[CITED: v2.tauri.app/plugin/store]

### Capability permission
```json
// src-tauri/capabilities/default.json — add to "permissions"
"store:default"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `lucide-react@0.4xx` | `lucide-react@1.x` (1.17.0) | 1.0.0 early 2026 | Pin 1.x; import API unchanged [VERIFIED: npm] |
| Tauri v1 `tauri-plugin-store` `0.x` | Tauri v2 `@tauri-apps/plugin-store` `2.4.3` + `load()` API | Tauri 2 GA | Use `load()`, `store:default` capability [CITED: v2.tauri.app] |
| `cmdk`/`fuse.js` for palettes | In-house ranker (this project, D-06) | Project decision | No runtime dep |

**Deprecated/outdated:**
- Tauri v1 store APIs (`new Store(...)` constructor-only patterns) — v2 uses `load()`.
- The mockup's `https://fonts.googleapis.com` `<link>` and `unpkg.com` React CDN scripts — never carry these over (no runtime network).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `load('prefs.json', {autoSave:true})` debounce is acceptable for prefs persistence (vs explicit `save()` per write) | Code Examples / Pitfall 5 | Low — if autoSave timing loses a write on abrupt quit, switch to explicit `save()` after each `set`. Both are supported |
| A2 | The `Store` seam's `get(key):Promise<unknown>` is sufficient for all Phase-2 prefs (no need for `keys()`/`delete()`) | Architecture Pattern 3 | Low — reset-to-defaults (Claude's discretion) could want `delete`; can `set` to defaults instead, keeping the interface narrow |
| A3 | A debounced/per-switch write to disk has no perceptible UI cost in the WKWebview | Pitfall 5 | Low — plugin-store writes are async/off the paint path |

**Note:** All library versions and the Tauri store API are VERIFIED/CITED, not assumed. The assumptions above are implementation-timing choices the planner can lock or defer to Claude's discretion.

## Open Questions

1. **Prefs load timing at startup (sync redirect vs loaded prefs).**
   - What we know: `Store` is async; the router index route must redirect to the resolved startup tool (SHL-06).
   - What's unclear: whether to block first paint until prefs load, or render hero then redirect on load.
   - Recommendation: load prefs in `main.tsx` after `initPlatform()` and pass a resolved `lastUsedId` into the router setup, OR use a React Router loader on the index route. Keep timing inside `resolveStartupTool`'s caller. Planner to pick; either satisfies "no pick-a-tool step."

2. **Recents list length and tie-breaking.**
   - What we know: D-05 says ≈5, most-recent-first, then registry order. Claude's discretion on exact count.
   - Recommendation: cap 5, de-dupe by id, most-recent-first; if fewer than 5 used, show what exists.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pnpm | install lucide-react + plugin-store | ✓ | `pnpm@11.5.0` (packageManager) | — |
| Rust/cargo | `tauri-plugin-store` crate | ✓ (Phase 1 built tauri bundle) | per Phase 1 | — |
| `@tauri-apps/plugin-store` (npm) | desktop persistence | ✗ (not yet installed) | install `2.4.3` | localStorage fallback already in `browser.ts` for dev |
| `lucide-react` (npm) | sidebar/palette icons | ✗ (not yet installed) | install `1.17.0` | — (registry typed for it) |
| macOS WebDriver UI gate | per-task UI verification | ✓ | proven Phase 1 (`scripts/e2e-spike.sh`) | `screencapture` + `chrome-devtools-mcp` (HRN-02) |

**Missing dependencies with no fallback:** None — both missing npm packages are simply installed in-phase (expected per D-09 and Claude's Discretion).
**Missing dependencies with fallback:** plugin-store has the existing `localStorage` browser fallback for dev (D-09).

## Validation Architecture

> nyquist_validation is enabled (config.json workflow.nyquist_validation: true).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `vitest@4.1.7` + `@testing-library/react@16.3.2` + jsdom (`jsdom@29.1.1`) |
| Config file | Vite (`vitest` reads vite config); no separate vitest.config detected — confirm in repo |
| Quick run command | `pnpm test` (`vitest run`) — single file: `pnpm exec vitest run src/shell/fuzzy.test.ts` |
| Full suite command | `pnpm test && pnpm exec tsc --noEmit` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHL-01 | Sidebar renders one item per ENABLED_TOOL, active item gets `.on`/accent | unit (RTL) | `pnpm exec vitest run src/components/Sidebar.test.tsx` | ❌ Wave 0 |
| SHL-02 | ⌘K opens palette; fuzzy filter matches name+keywords+desc; Enter navigates | unit (RTL) | `pnpm exec vitest run src/components/CommandPalette.test.tsx` | ❌ Wave 0 |
| SHL-02 | Fuzzy ranker scores subsequence matches, ranks by quality | unit | `pnpm exec vitest run src/shell/fuzzy.test.ts` | ❌ Wave 0 |
| SHL-03 | Empty query shows recents (≤5) first, then rest; recents update on switch | unit | `pnpm exec vitest run src/shell/useRecentTools.test.ts` | ❌ Wave 0 |
| SHL-04 | Adding a registry entry surfaces it in sidebar+palette+route | unit | `pnpm exec vitest run src/router.test.tsx` (assert routes derive from ENABLED_TOOLS) | ❌ Wave 0 |
| SHL-05 | Prefs round-trip through the Store seam (set→get persists value) | unit | `pnpm exec vitest run src/shell/usePreferences.test.ts` (use `setPlatformForTest` stub) | ❌ Wave 0 |
| SHL-06 | `resolveStartupTool`: explicit > last-used(valid) > hero; disabled last-used → hero | unit | `pnpm exec vitest run src/shell/resolveStartupTool.test.ts` | ❌ Wave 0 |
| SHL-01/02 | Real-webview: sidebar visible, ⌘K opens, Enter switches (no mouse) | manual/UI gate | `bash scripts/e2e-spike.sh` against `tauri dev` + screenshot vs `design/` | existing driver |

### Sampling Rate
- **Per task commit:** `pnpm test` (or the single relevant `vitest run <file>`) + `tsc --noEmit`. The decoder's 19 tests must stay green (immovable bar).
- **Per wave merge:** full `pnpm test && pnpm exec tsc --noEmit`.
- **Phase gate:** full suite green + `gsd-ui-review` WCAG-AA audit + human sign-off on a fresh `tauri build`.

### Wave 0 Gaps
- [ ] `src/shell/fuzzy.test.ts` — covers SHL-02 ranker
- [ ] `src/components/Sidebar.test.tsx` — covers SHL-01
- [ ] `src/components/CommandPalette.test.tsx` — covers SHL-02/03
- [ ] `src/shell/usePreferences.test.ts` — covers SHL-05 (uses `setPlatformForTest`)
- [ ] `src/shell/useRecentTools.test.ts` — covers SHL-03
- [ ] `src/shell/resolveStartupTool.test.ts` — covers SHL-06
- [ ] `src/router.test.tsx` — covers SHL-04 (routes derive from registry)
- [ ] Shared test helper: a stub `Platform` with an in-memory store (the existing `browserPlatform` / `setPlatformForTest` already provide this — reuse, don't rebuild)

*(Framework is already installed; no framework-install task needed. Existing pattern: `src/lib/platform/platform.test.ts` shows the `setPlatformForTest`/`resetPlatformForTest` seam to copy for store-backed tests.)*

## Security Domain

> security_enforcement not present in config.json → treat as enabled. This phase is a local, offline, no-network, no-auth desktop shell, so most categories do not apply.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No accounts/auth (offline by design) |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | Single-user local app |
| V5 Input Validation | yes (light) | Validate the `#/tools/<id>` deep-link target against `getToolById` before navigating (D-14) — reject/fallback unknown ids rather than rendering arbitrary routes |
| V6 Cryptography | no | No crypto in this phase (HASH tool is Phase 4) |
| V10 Malicious Code / Supply chain | yes | Two new deps; pin exact versions, no postinstall surprises. Both are mainstream (lucide, official Tauri plugin) |

### Known Threat Patterns for a Tauri/React offline shell
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tauri capability over-grant (granting more than store needs) | Elevation of Privilege | Use `store:default` (scoped to store commands) in `default.json`; don't add unrelated permissions |
| Unvalidated deep-link route → render unknown component | Tampering | `resolveStartupTool`/router validate id via `getToolById` (D-14) before `<Navigate>` |
| Persisted prefs tampering (user edits prefs.json) | Tampering | Treat store values as untrusted: validate `lastUsedId` against the registry (already covered by D-13 fallback); never `eval`/trust stored shapes |
| Dependency supply-chain | Tampering | Pin exact versions; both deps are widely used official/mainstream packages |

No secrets, tokens, or PII are handled in Phase 2.

## Sources

### Primary (HIGH confidence)
- npm registry — `lucide-react` (1.17.0, peerDeps React `^19.0.0`, published 2026-05-28), `@tauri-apps/plugin-store` (2.4.3) [VERIFIED via `npm view`]
- crates.io API — `tauri-plugin-store` max_stable_version 2.4.3 [VERIFIED]
- v2.tauri.app/plugin/store — install/registration/JS API/permissions [CITED]
- Repo source (read this session): `src/lib/tools/registry.ts`, `types.ts`, `src/router.tsx`, `src/App.tsx`, `src/main.tsx`, `src/lib/platform/*`, `src/tools/*/index.ts`, `src/index.css`, `package.json`, `src-tauri/Cargo.toml`, `src-tauri/capabilities/default.json`
- Design source: `design/DevTools Mockup.html` (tokens + sidebar/palette CSS), `design/devtools-ui.jsx` (Sidebar/Palette component structure + ⌘K handler)
- `scaffold/src/components/Sidebar.tsx` (structure reference)
- Project docs: `docs/harness-and-decisions.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `02-CONTEXT.md`

### Secondary (MEDIUM confidence)
- None — all claims traced to primary sources above.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified against npm/crates.io; both deps compatible (React 19, Tauri 2)
- Architecture: HIGH — extends Phase-1 patterns already present and tested in the repo (registry, router guard, platform seam)
- Pitfalls: HIGH — lucide version, Tauri permission, async-store timing all grounded in verified facts or repo evidence

**Research date:** 2026-05-30
**Valid until:** 2026-06-29 (30 days; stable stack. Re-verify `lucide-react` and `@tauri-apps/plugin-store` versions if planning slips past this.)
