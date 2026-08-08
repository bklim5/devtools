# Phase 22: Settings Modal Shell, Entry Points & License Pane - Context

**Gathered:** 2026-06-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a real Settings surface for TinkerDev: an accessible **in-window modal** with a **paned layout**, openable from every conventional entry point (app menu ⌘, · tray · sidebar row · ⌘K), whose **first and only pane this phase is the existing License surface unchanged**. The Appearance / Hotkeys / General / Updates panes are LATER phases (23–25) — Phase 22 builds the shell + entry points + License pane only. No new OS window (modal, not multi-window).
</domain>

<decisions>
## Implementation Decisions

### Surface architecture (locked at milestone + here)
- **D-S1:** In-window **modal overlay**, mounted shell-level — mirror the Phase-21 upsell pattern: a new `openSettings()` store (`src/shell/settingsStore.ts` + `useSettings.ts`, modeled on `upsellStore.ts`/`useUpsell.ts`) and a single `<SettingsModal>` mounted once in `src/App.tsx` (like `UpsellModal`). NOT a separate Tauri window, no IPC.
- **D-S2:** Reuse `UpsellModal`'s hardened a11y mechanics verbatim — focus trap while open, **return focus to the invoker** (capture the invoker synchronously at `openSettings()` time, the Phase-21 fix), `aria-modal` + `aria-labelledby`.

### Layout (gray area: Pane nav layout)
- **D-S3:** **Left nav list** (Claude #9 style) — vertical pane list on the left, content pane on the right. Scales to 5 panes. In Phase 22 the list shows **only License** (later phases append their pane to the list). Fully keyboard-navigable: move between panes via keyboard, active pane announced via `aria` (SET-05).

### Modal style & dismissal (gray area: Modal size & dismissal)
- **D-S4:** **Large centered modal over a dimmed backdrop** (Claude #9), not a full-window overlay.
- **D-S5:** Dismiss on **Esc AND backdrop click** (plus an explicit close control). Calm tone, neutral tokens.

### Route migration (gray area: Route migration)
- **D-S6:** The **modal supersedes** the Phase-21 in-window `#/settings/license` route — ONE surface, no duplication.
  - Re-point D-88: the footer license affordance and the ⌘K "License" command call `openSettings('license')` (open the modal directly on the License pane) instead of `navigate('/settings/license')`.
  - Keep `#/settings/license` as a **deep-link** that opens the Settings modal on the License pane (HashRouter-friendly; preserves any existing links/e2e hash navigation).
  - `LicenseSettings.tsx` renders **inside** the modal's License pane, **unchanged** (SET-06) — all 5 states; activate/upsell for unlicensed; the Phase-21 Reactivate/Activate→`openUpsell` and Refresh/Deactivate behavior intact.

### Entry points (SET-01/02/03)
- **D-S7:** Native entries via the `src/lib/platform/` event seam (tools/components never import `@tauri-apps/*` directly):
  - **App menu:** add `TinkerDev ▸ Settings…` bound to **⌘,** (the app menu currently has no Settings item).
  - **Tray:** add a `Settings…` item (tray currently = Show TinkerDev / Check for Updates / Quit).
  - Both Rust menu/tray handlers **emit an event** that a `platform`-seam listener turns into `openSettings()`. `tauri.ts` is the sole `@tauri-apps/*` importer; `browser.ts` is a deterministic no-op for jsdom/vite-preview.
- **D-S8:** Webview entries: a **⌘K "Settings" command** (sibling to the D-88 "License" command in `CommandPalette.tsx`) and the sidebar **Settings row** (below).

### Sidebar footer ordering (gray area: Sidebar entry + footer)
- **D-S9:** Footer layout, top → bottom:
  1. the existing **Unlock Pro / "License needs attention"** affordance (top)
  2. a gear **⚙ Settings** row **anchored at the very bottom** (position-locked / sticky bottom — NOT Pro-gated).
- **D-S10:** The Settings row **opens for everyone, including unlicensed** (SET-04). The License pane shows the no-license + Unlock-Pro/activate state for unlicensed users.
- **D-S11:** The D-88 "License needs attention" affordance now **opens Settings on the License pane** (`openSettings('license')`), consistent with D-S6. The free-tier "Unlock Pro" row keeps opening the upsell modal.

### Claude's Discretion
- Exact `settingsStore` shape (mirror `upsellStore`); the modal's internal pane-registry data structure (must be extensible so Phases 23–25 register panes cleanly); precise keyboard model for left-list nav (arrow/Home/End + Tab) within the existing WCAG patterns; gear icon choice (lucide, consistent with existing icons); modal width/height within "large centered" (match the design system).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` § "### Phase 22" — goal + 5 success criteria
- `.planning/REQUIREMENTS.md` § "v1.7 Requirements — Settings & Preferences (SET)" — SET-01..06 (this phase), SET-07..10 (later)
- `docs/seeds/settings-preferences-window/README.md` + the 5 reference screenshots (DevUtils Preferences window, Claude settings modal, app menu, tray, sidebar entry)

### Reuse targets (the patterns this phase mirrors)
- `src/shell/upsellStore.ts`, `src/shell/useUpsell.ts` — the shell-level modal open-state store pattern to mirror for `openSettings()` (incl. synchronous invoker capture for focus-return)
- `src/App.tsx` — where `UpsellModal` is mounted shell-level; `SettingsModal` mounts the same way
- `src/components/UpsellPanel.tsx` (`UpsellModal`) — focus-trap + `aria-modal`/`aria-labelledby` + invoker-return mechanics to reuse
- `src/components/LicenseSettings.tsx` — the License pane, rendered unchanged inside the modal (SET-06)
- `src/components/Sidebar.tsx` — footer affordances (`openLicenseSurface`, `hasManageableLicense`, the "Unlock Pro" row) + where the Settings row + D-88 re-point land
- `src/components/CommandPalette.tsx` — the D-88 "License" command (re-point) + where the "Settings" command lands
- `src/lib/platform/index.ts` / `tauri.ts` / `browser.ts` — the seam; add the menu/tray→webview Settings event channel here
- `src-tauri/src/lib.rs` — app menu + tray construction (add Settings… items + ⌘, accelerator + event emit)
- `src/shell/preferences.ts` / `prefsStore.ts` — prefs seam (not strictly needed for Phase 22, but the surface later panes persist through)

### Test/gate refs
- `docs/HARNESS.md` — the real-WKWebView e2e gate runbook
- `test/e2e/license-settings.e2e.ts` — existing route e2e that must be migrated to the modal (the `#/settings/license` deep-link still works) + `test/e2e/helpers.ts`
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `upsellStore.ts`/`useUpsell.ts` + `App.tsx` shell mount + `UpsellModal` — a complete, WCAG-hardened shell-modal blueprint (Phase 21). `SettingsModal`/`settingsStore` should clone this shape.
- `LicenseSettings.tsx` — drops into the License pane unchanged.
- The `platform/` seam already carries license + opener channels; add a Settings-open event channel the same way.

### Established Patterns
- Shell-level modal mounted once in `App.tsx`, driven by a `useSyncExternalStore` store with an invoker-capture for focus-return.
- D-88 state-dependent routing lives in `Sidebar.tsx` + `CommandPalette.tsx` — both get re-pointed to `openSettings('license')`.
- Native menu/tray live in `src-tauri/src/lib.rs`; webview reaches them only through `src/lib/platform/`.

### Integration Points
- Re-point D-88 (footer + ⌘K "License") → `openSettings('license')`.
- Add Settings row to the Sidebar footer (anchored bottom) + a "Settings" ⌘K command.
- Add app-menu `Settings…` (⌘,) + tray `Settings…` in Rust, emitting an event the platform seam maps to `openSettings()`.
- Migrate `test/e2e/license-settings.e2e.ts` to the modal (keep `#/settings/license` deep-link working).
</code_context>

<specifics>
## Specific Ideas

- Reference look: **Claude desktop settings** (`docs/seeds/settings-preferences-window/05-claude-settings-window.png`) — left nav list, large centered modal, dimmed backdrop.
- App-menu + tray entries are a hard requirement (user-emphasized), not optional — they reach the modal via the `platform/` event seam.
- Settings row sits at the very bottom of the sidebar, anchored, below the Unlock-Pro/attention button.
</specifics>

<deferred>
## Deferred Ideas

- **Appearance/Themes pane** → Phase 23 (SET-07; absorbs backlog 999.3).
- **Hotkeys pane** (rebind global summon + ⌘K palette chord) → Phase 24 (SET-08).
- **General pane** (launch-at-login [autostart dep exception], start-in-tray, default tool, show-license-in-sidebar) → Phase 24 (SET-09).
- **Updates pane** → Phase 25 (SET-10).
- **Separate native OS Preferences window** — rejected in favor of the in-window modal (lower risk; revisit only if the modal proves limiting).

### Reviewed Todos (not folded)
- **Ship-gate live cases 1/2/7/8 + v1.6 sign-off** (STATE Pending Todo) — belongs to v1.6 closure, not Settings; not folded.
- **e2e dev-toggle flake** — already RESOLVED in Phase 21; not applicable.
</deferred>

---

*Phase: 22-settings-modal-shell*
*Context gathered: 2026-06-15*
