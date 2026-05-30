# Phase 2: Shell - Context

**Gathered:** 2026-05-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the **registry-driven application shell**: a compact sidebar, a ⌘K command palette, and preferences persistence — all deriving from the single tool registry (`src/lib/tools/registry.ts`), so adding a tool (one file + one registry entry) makes it appear in sidebar, palette, and route with no other wiring. The app opens straight to the last-used (or explicitly targeted) tool with no "pick a tool" step.

**In scope:** SHL-01..06 — registry-driven compact sidebar, ⌘K fuzzy palette with recents, per-tool HashRouter routes, registry-as-single-source-of-truth, preferences persistence (theme/accent + last-tool + recents) via the platform Store seam, opens-to-last/summoned tool.

**Out of scope:** The six tools' real UIs (Phase 3 builds Protobuf + Base64/Hex/Bytes; Phase 4 the rest) — in Phase 2 the registered tools render simple placeholders. **Window-geometry persistence is deferred to Phase 5** (Native Polish) per the user — it is the lowest priority and sits naturally with the native window work. The actual global summon shortcut, tray/menu, single-instance (Phase 5). Code signing/distribution (Phase 6). The Protobuf tree-style preference *value* is owned/written by Phase 3 (its tool doesn't exist yet); Phase 2 only keeps the store schema extensible for it.
</domain>

<decisions>
## Implementation Decisions

### Sidebar & disabled tools (SHL-01)
- **D-01:** **Enable the three registered stubs** (`unix-time`, `base64`, `protobuf-decoder`) by flipping `enabled` to true; each renders a simple "coming in Phase 3" **placeholder** component until its real UI lands. Rationale: today all three are `enabled:false`, so `ENABLED_TOOLS` is empty and a registry-driven sidebar/palette/router would render nothing — the shell would be unverifiable. Placeholders make sidebar, palette, routing, and persistence fully exercisable now; Phase 3/4 simply swap the placeholder for the real `component`. **Do not** alter `decoder.ts`/`bytes.ts`/`types.ts` (port-unchanged bar); only the per-tool `enabled` flag + a shared placeholder component change.
- **D-02:** **Fixed compact density** (icon + name), exactly per SHL-01. No full/icons-only modes and no density toggle in v1 (the mockup's other modes are deferred). Active-state styling follows the design: left accent bar + `--accent-soft` background tint, active icon in `--accent` (`design/DevTools Mockup.html`).
- **D-03:** **The ⌘K palette is the dedicated no-mouse path.** The sidebar is mouse + standard Tab focus only — no parallel arrow-key/j-k navigation and no ⌘1..⌘6 number shortcuts. Avoids two competing keyboard-focus systems; SHL-02 already delivers no-mouse switching.

### ⌘K command palette (SHL-02, SHL-03)
- **D-04:** **Palette searches tools only** in v1 (fuzzy over name + keywords + description, Enter switches). No global app-actions registry and no recent-inputs/value entries yet.
- **D-05:** **Empty query shows recents first, then the rest** — the last ~5 used tools at the top, then remaining tools in registry order; typing filters across all tools. Satisfies SHL-03.
- **D-06:** **In-house, zero-dependency fuzzy matcher** — a lightweight subsequence/fuzzy ranker (~30 lines) ranking by match quality. No `cmdk`, no `fuse.js`. Fits the offline/no-runtime-dependency ethos and is ample for 6 tools. (The existing `searchTools()` substring filter can be upgraded to this ranker.)
- **D-07:** **⌘K-only trigger; never auto-opens.** The palette opens on ⌘K (and a click affordance); it does **not** auto-open on launch — the app goes straight to a tool (no "pick a tool" step, per SHL-06). No-match renders a quiet "No tools match" state (not an error).

### Preferences & storage (SHL-05, SHL-06)
<!-- User refinements: window geometry deferred to Phase 5 (lowest priority); theme dark-only now but structured to extend to light later; first-run tool hardcoded to hero now but resolution made configurable later. -->
- **D-08:** **Persist:** last-used tool, the recent-tools list (powers D-05), and theme/accent (see D-10). These survive an app restart. **Window geometry is NOT persisted in Phase 2 — deferred to Phase 5** (D-11).
- **D-09:** **Storage = `@tauri-apps/plugin-store` for the desktop app, with a `localStorage` fallback for browser dev**, both behind the **existing `Store` interface** in `src/lib/platform/` (`get`/`set`). This realizes the Phase-1 stub (D-11 from Phase 1) without tools ever importing `@tauri-apps/*` directly. The store schema must stay extensible so Phase 3 can add the Protobuf tree-style key.
- **D-10:** **Theme = dark-only for v1, with a persisted accent color** (the mockup exposes an accent tweak). No light theme / light-dark toggle in this phase. **But structure it for future extensibility:** store the theme as a named value (e.g. `"dark"`) rather than a boolean, and drive colors through the design's CSS-variable system, so a light theme can be added later without reworking the persistence model or the components.
- **D-11:** **Window geometry persistence is DEFERRED to Phase 5** (Native Polish) per the user — explicitly the lowest priority, and it sits naturally with the native window/tray work. Phase 2 persists only app-state prefs (D-08). This splits SHL-05's window-geometry clause forward; flag for the planner so SHL-05 isn't marked fully complete at the Phase 2 boundary.

### First-run & opens-to-last (SHL-06)
- **D-12:** **First launch (no saved state) opens the Protobuf decoder (the hero)** — it's what the user reaches for most, and the strongest first impression. **Make the default-tool selection configurable in the future** (e.g. a preference choosing among: last-used, first-in-list, or a pinned tool); v1 hardcodes the hero but the resolution logic should be a single seam that a future preference can feed, not scattered conditionals.
- **D-13:** **If the last-used tool was since disabled/removed, silently fall back to the hero default** (Protobuf). Predictable and matches first-run behavior; never surfaces a picker.
- **D-14:** **An explicit launch target overrides last-used** — a `#/tools/<id>` deep-link (or a future global-shortcut summon-to-tool) wins; otherwise restore last-used. This sets the data model now; Phase 5 wires the actual global shortcut.

### Claude's Discretion
- Exact placeholder component markup/copy (D-01), recents list length (≈5, D-05), fuzzy-ranker scoring details (D-06), palette Esc/typeahead-reset micro-behaviors, store key names/namespacing, reset-to-defaults handling, and `lucide-react` icon choices per tool. Adding `lucide-react` as a dependency is expected (registry's `icon` field is a lucide component; not yet in `package.json`).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (researcher, planner, executor) MUST read these before planning or implementing.**

### Product spec & harness
- `docs/design-and-plan.md` — full spec; §5 architecture (registry-as-control-plane), §9 cross-cutting UX constraints, §11 milestone order
- `docs/harness-and-decisions.md` — build+verify harness (two-loop, three-gate) + platform seam (§2). Authoritative where it differs from the handoff. Per-task DoD: simplify → /codex:review → vitest+tsc → real-webview UI.
- `.planning/phases/01-scaffold-harness-proof/01-CONTEXT.md` — Phase 1 decisions; esp. D-11 (platform seam: real store lands here in Phase 2) and the macOS UI-gate driver chosen for verification.

### Visual system (sidebar + palette)
- `design/DevTools Mockup.html` — sidebar (268px full / 66px icons-only / compact = icon+name; active = left `--accent` bar + `--accent-soft` bg), command palette (560px overlay, list with category labels, footer shortcuts), CSS tokens (`--bg-app #0a0b0d`, `--sidebar #101216`, `--accent #3b82f6`, `--accent-soft`, `--tx`/`--tx-2`/`--tx-3`, `--bd`). Self-host fonts (the mockup's CDN font links must NOT be used).

### Code to build on (this phase wires the shell to these — do NOT modify the port-unchanged files)
- `src/lib/tools/registry.ts` — `TOOLS` / `ENABLED_TOOLS` / `getToolById` / `searchTools`. Single control plane; D-01 flips the `enabled` flags and D-06 may upgrade `searchTools` to the fuzzy ranker.
- `src/lib/tools/types.ts` — `ToolDefinition` (id, name, description, category, keywords, icon: lucide ComponentType, component, enabled?, status?, premium?, shortcuts?). Port-unchanged contract.
- `src/router.tsx` — HashRouter; routes derive from `ENABLED_TOOLS`; `firstTool` guard + index/catch-all fallback (currently renders null when empty — D-01 removes the empty case; D-12/D-13/D-14 refine the index redirect).
- `src/App.tsx` — bare shell (`<Outlet/>`) today; this phase adds the registry-driven sidebar + palette chrome around the outlet. Tool components stay layout-agnostic; layout chrome lives in the shell.
- `src/lib/platform/` — `Platform` seam: `clipboard` (real) + `store` (stub today). `index.ts` (env detection, lazy Tauri import on `__TAURI_INTERNALS__`), `tauri.ts`, `browser.ts`, `stub.ts`, `platform.test.ts`. D-09 makes `store` real here.

### Reference only (rebuild visuals against `design/`)
- `scaffold/src/components/Sidebar.tsx` — structure reference for the registry-driven sidebar (NavLink per tool, `searchTools`, ⌘/ focus). Visuals must be rebuilt against the mockup.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Registry** (`registry.ts`): `ENABLED_TOOLS`, `getToolById`, `searchTools` already exist — sidebar, palette, and router consume them directly (single control plane is already the established pattern).
- **Router** (`router.tsx`): HashRouter + `firstTool`/empty-state guard already in place; the index redirect is the natural home for the opens-to-last logic (D-12/13/14).
- **Platform `Store` seam** (`src/lib/platform/`): `Store` interface (`get`/`set`) + env-detected impl selection already built for clipboard — the persistence work (D-08/09) is "fill in the real store impl behind the same seam," not new architecture.
- **Design tokens**: full CSS-variable system + sidebar/palette layouts already specified in `design/DevTools Mockup.html`.

### Established Patterns
- **Registry-as-control-plane** and **HashRouter-only** are locked from Phase 1 — extend, don't reinvent.
- **No direct `@tauri-apps/*` in tools/shell logic** — everything routes through `src/lib/platform/` (FND-04). The store plugin (D-09) is imported only inside `platform/tauri.ts`.
- **No network at runtime** — self-host fonts; no CDN; the in-house fuzzy matcher (D-06) keeps deps minimal.

### Integration Points
- `App.tsx` is where sidebar + palette chrome wrap the routed `<Outlet/>`.
- `platform/tauri.ts` + `platform/browser.ts` are where the real store vs localStorage fallback land (behind `Store`).
- `router.tsx` index route is where opens-to-last / first-run / deep-link precedence resolve.
- `package.json` gains `lucide-react` and `@tauri-apps/plugin-store` (the latter only used inside the platform seam).

### Constraints from existing architecture
- All three tools are `enabled:false` today → `ENABLED_TOOLS` is empty. D-01 (enable as placeholders) is the unblock; planner must add a shared placeholder component and must NOT touch `decoder.ts`/`bytes.ts`/`types.ts`.
- `ToolDefinition.icon` is a lucide component but `lucide-react` is not yet a dependency — adding it is in scope.
</code_context>

<specifics>
## Specific Ideas

- Active sidebar item must use the design's **left `--accent` bar + `--accent-soft` background** (accent reserved for selected/active state — consistent with the project-wide "accent = selected only" rule).
- Palette empty-query layout: **recents section first** (~5), then all tools; **quiet** no-match state, never an error.
- First impression: app boots **directly into the Protobuf hero** on first run — the product's core-value surface is what the user sees first.
</specifics>

<deferred>
## Deferred Ideas

- **Sidebar density toggle** (full / icons-only) and persisting it — mockup supports it; deferred from v1 (D-02).
- **Palette global app-actions** ("Toggle theme", "Copy output") and **recent-inputs** entries — deferred (D-04); revisit if a command surface is wanted later.
- **Light theme / light-dark toggle** — deferred (D-10); v1 is dark-only with a persisted accent, but the theme value + CSS-variable model are structured to allow adding it later without rework.
- **Window-geometry persistence** — deferred to **Phase 5** (D-11) per the user; lowest priority, belongs with native window work. SHL-05's window-geometry clause therefore lands in Phase 5, not Phase 2.
- **Configurable default/startup tool** — v1 hardcodes the Protobuf hero (D-12); a future preference could let the user pick last-used / first-in-list / a pinned tool. The startup-resolution seam is built to accept it.
- **Global summon shortcut, tray/menu, single-instance** — Phase 5 (Native Polish); Phase 2 only sets the data model for summon-to-tool precedence (D-14).
- **Protobuf tree-style preference value** — schema reserved here, but written by Phase 3 which owns the Protobuf tool.

None of the above were scope creep — they surfaced as natural phase boundaries while scoping the shell.
</deferred>

---

*Phase: 02-shell*
*Context gathered: 2026-05-30*
