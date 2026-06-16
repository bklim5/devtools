# Phase 23: Appearance Pane - Context

**Gathered:** 2026-06-16
**Status:** Ready for planning

<domain>
## Phase Boundary

A user changes **theme (light / dark / system)** and **accent** from **Settings ▸ Appearance** (a new pane appended to the existing Settings modal). Both selections apply **live (no restart)** across the whole app, **persist** via the existing prefs seam, and **restore** on next launch. WCAG-AA mandatory in **both** themes (visible focus, AA contrast, no opacity-only state). Theming is a **Pro** customization, gated through the existing central entitlement seam.

**Out of scope (own phases / deferred):** Hotkeys + General toggles (Phase 24), Updates pane (Phase 25), a free arbitrary color picker, per-tool theme overrides, high-contrast/custom themes, and the mockup's illustrative "Notifications"/"Keyboard" nav entries.
</domain>

<decisions>
## Implementation Decisions

### Free-tier gating
- **D-23-1:** Appearance is **Pro-gated through the existing central gate** — no new gate mechanism. Reuse `resolveEntitlements()` + the existing `gatePreferences(prefs, ents)` apply seam, which **already** forces `theme`/`accent` to defaults when `ENT_THEMING` is absent (stored values never touched; unlocking restores instantly — D-26/D-27). Gate semantically on **`ENT_THEMING`** (mirrors ordering using `ENT_ORDERING`); equivalent to `isPro` in practice since the $9 license grants the full set together.
- **D-23-2 (free-user behavior):** A free user **can open** Appearance and **preview** selections (preview drives the contained PREVIEW strip only — see D-23-3). The **whole app stays on the effective/gated appearance** (default dark + `#5b9bf8`) regardless of what they preview/persist, because `gatePreferences` forces defaults when not entitled. Pressing **Save** opens the **focused Unlock-Pro modal** (reuse the Phase-22.2 `UpsellModal` / `upsellStore` / `openProUpsell` path) and persists nothing. This is a deliberate **try-before-buy** sell — diverges from 22.2's "click locked control → immediate upsell" *intentionally* for the appearance surface.

### Interaction model (apply / save)
- **D-23-3:** **Preview strip + Save (gate on Save).** Selecting a theme/accent updates a **local pending state** reflected only in a **contained PREVIEW strip** (sample components per the approved mockup: Decoder nav item · "Activate" button · `uint` chip · a toggle) — **not** the whole app. **Save** commits: persist via the prefs seam **and** apply live to the whole app (Pro). For free, Save → Unlock-Pro modal, no persist. **The lock affordance lives on the Save button** ("Unlock Pro to save" + lock glyph) — visible locked state, not opacity-only. **No revert logic needed** because global app appearance never changes pre-Save (only the contained strip does).

### Theme
- **D-23-4 (options + default):** Theme = **light | dark | system**. **Fresh-install default = dark** (the product's visual system is dark-first; preserves brand identity + every screenshot). Existing installs keep their persisted value. Widen `ThemeName` (`"dark"` → `"light" | "dark" | "system"`) and widen `coerceTheme` to accept the three values (anything else → default `dark`).
- **D-23-5 (system mode):** `theme === "system"` resolves via `prefers-color-scheme` and re-applies **LIVE** on OS light↔dark flip (a `matchMedia` change listener). The persisted/resolved theme is applied **before first paint** so there is **no wrong-theme flash on launch**.
- **D-23-6 (theme picker UI):** Three **radio cards** (Dark / Light / System), each with a **mini app-preview thumbnail**, per the approved mockup. New component — **not** the shared `SegmentedControl`.

### Accent
- **D-23-7:** **Curated swatch grid**, **7 swatches**: blue (**default, current `#5b9bf8` — unchanged**), violet, green, amber, rose, teal, slate. **No free color picker** (a free hue can fail AA for focus rings / selected-label text). **Every swatch must clear WCAG-AA on BOTH themes for every accent use**: focus rings, the nav active-bar, and selected-label text on `accent-soft`. Default stays `#5b9bf8` so existing installs look identical. **Accent reserved for selection only** — `#N` protobuf field numbers stay neutral (binding visual rule).

### Light palette (the heavy lift)
- **D-23-8:** A **full light token set must be authored** — **none exists today** (all ~25 `@theme` tokens are dark-only; every token comment says "a light theme can re-derive later"). Covers: all surface tokens (bg-app/win/titlebar/sidebar/pane/panel/card/palette), the text ramp (tx/tx-2/tx-3), borders (bd/bd-2), input-bg, scrim, the **accent / warn / ok triads** (soft+line via `color-mix`), and the radial-gradient window background. Must apply across the **whole app**: all 11 tools, the protobuf field tree, License pane, the Settings modal, sidebar + ⌘K palette. **Each light value WCAG-AA verified.** Derivation approach (systematic re-derivation vs hand-tune) is Claude/planner discretion within the AA bar.

### Apply mechanism
- **D-23-9:** Wire the **App root** to apply the **effective (gated) theme + accent to the DOM** via `gatePreferences(preferences, ents)`. Today **nothing applies accent** (`--color-accent` is hardcoded in `@theme`) and **theme is dark-only** — this phase makes both live. **Accent** → override `--color-accent` on `document.documentElement` (the `accent-soft`/`accent-line` derivations cascade automatically via the existing `color-mix`; no per-component change). **Theme** → a `data-theme` attribute / class on `document.documentElement` with the light token set re-declared under that selector. Exact attribute-vs-class naming is Claude discretion.

### Pane registry + persistence
- **D-23-10:** Append **one** entry `{ id: "appearance", label: "Appearance", icon: <contrast/half-circle glyph>, render }` to `SETTINGS_PANES` (`src/components/settingsPanes.tsx`). **No `SettingsModal` shell change** — its left nav and right content both derive 1:1 from the array. Nav shows only the **real** panes (License + Appearance now; Hotkeys/General/Updates in 24/25). The mockup's "Notifications"/"Keyboard" labels are illustrative — **not scope**.
- **D-23-11:** Reuse the existing **prefs seam** — `theme`/`accent` fields are already in `Preferences`; the accent coercer already accepts any non-empty string; `setTheme`/`setAccent` already exist on `usePreferences`. **No new store key.** Only the `ThemeName` widening (D-23-4) and `coerceTheme` widening are needed on the persistence side.

### Claude's Discretion
- Exact light-palette hex values + derivation approach (within AA-on-light).
- The 7 AA-tuned accent hexes (within AA-on-both-themes; default fixed at `#5b9bf8`).
- Internal structure of the new theme-card + accent-swatch + preview-strip components, and the exact PREVIEW sample set/layout.
- `data-theme` attribute vs class naming and the light-token selector strategy.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements / roadmap
- `.planning/REQUIREMENTS.md` — **SET-07** (the Appearance requirement) + the v1.7 "Architecture (locked)" preamble.
- `.planning/ROADMAP.md` §"Phase 23: Appearance Pane" — goal + 4 success criteria.

### Visual system + tokens (the light-palette + accent work)
- `design/DevTools Mockup.html` — canonical visual system; `:root` accent vars (`--accent` + `color-mix` soft/line), traffic-light/titlebar chrome.
- `src/index.css` — the `@theme` token block (all ~25 dark tokens + accent/warn/ok triads + radial-gradient bg). The light palette is authored here.

### Persistence seam (theme/accent)
- `src/shell/preferences.ts` — `Preferences`, `ThemeName` (widen), `DEFAULT_PREFERENCES` (theme `"dark"`, accent `#5b9bf8`).
- `src/shell/prefsStore.ts` — `coerceTheme` (widen), `coerceAccent`, `mergePreferences`.
- `src/shell/usePreferences.ts` — `setTheme`/`setAccent` setters; the async-load / no-flash contract.
- `src/App.tsx` — the root that must apply effective theme/accent to the DOM (currently does not).

### Entitlement gate (Pro-gating)
- `src/lib/entitlements/entitlements.ts` — `ENT_THEMING`, `isPro`, **`gatePreferences`** (the prefs-APPLY seam, already strips theme/accent when not entitled — D-26/D-27).
- `src/lib/entitlements/resolve.ts` — `resolveEntitlements()` + the `entitlementsOverride` ("free"/"full") dev path.

### Settings modal + upsell (host + free-tier route)
- `src/components/settingsPanes.tsx` — the append-only `SETTINGS_PANES` registry (add the Appearance entry here).
- `src/components/SettingsModal.tsx` — the modal shell hosting the panes (no change expected).
- `src/shell/upsellStore.ts` · `src/shell/useUpsell.ts` · `src/shell/proUpsell.ts` (`openProUpsell`) · `src/components/UpsellModal.tsx` — the Phase-22.2 focused Unlock-Pro modal path the Save button routes free users into.
- `src/components/SegmentedControl.tsx` — shared control (reuse considered, NOT used for the theme picker per D-23-6; may be reused elsewhere).

### Prior context (patterns + locked decisions)
- `.planning/phases/22-settings-modal-shell/22-CONTEXT.md` + `22-UI-SPEC.md` — the modal shell + pane-registry pattern (D-S3).
- `.planning/phases/22.2-cmdk-pro-upsell-modal/22.2-CONTEXT.md` — the focused Unlock-Pro modal + `isPro` gate pattern (D-44 routing of lapsed customers to recovery, not the pitch — relevant if Save ever fires for an attention-state license).
- `docs/harness-and-decisions.md` — locked harness + decisions (authoritative on conflicts).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`gatePreferences(prefs, ents)`** (`entitlements.ts`): render-time apply seam — already forces theme/accent → defaults when `ENT_THEMING` absent. The whole gating model for this pane is **already built**; Phase 23 just consumes it at the App root.
- **prefs seam** (`preferences.ts`/`prefsStore.ts`/`usePreferences.ts`): `theme`/`accent` fields, coercers, and `setTheme`/`setAccent` setters already exist. Only the `ThemeName`/`coerceTheme` widening is new.
- **`SETTINGS_PANES`** (`settingsPanes.tsx`): append-only pane registry — the Appearance pane is one entry, zero shell change.
- **Unlock-Pro modal path** (`upsellStore`/`useUpsell`/`proUpsell.openProUpsell`/`UpsellModal`): reuse verbatim for the free-tier Save route.
- **`color-mix`-derived accent triad** (`index.css`): overriding `--color-accent` cascades `accent-soft`/`accent-line` automatically — accent application is one CSS-var write.

### Established Patterns
- **Registry is the single control plane** — Settings nav/content derive from `SETTINGS_PANES`; tools never read `@tauri-apps` or `platform.store` directly (go through `usePreferences`).
- **Untrusted-prefs coercion** — every stored field is merged field-by-field over defaults; widening `coerceTheme` must keep that discipline (unknown → `dark`).
- **No-flash async load** — `usePreferences` returns defaults until the store resolves; theme apply must wait on / pre-apply to avoid a wrong-theme flash (D-23-5).

### Integration Points
- `src/App.tsx` root `<div>` — where effective (gated) theme attribute + accent var get applied to `document.documentElement`.
- `src/index.css` `@theme` — where the light token set is declared (under the theme selector).
- `src/components/settingsPanes.tsx` — where the pane entry is appended.
</code_context>

<specifics>
## Specific Ideas

- **Approved mockup** (user-attached, 2026-06-16): Settings ▸ Appearance with a "Theme" section of three radio **cards** (Dark / Light / System, each a mini app-preview thumbnail), an "Accent color" **swatch grid** (7 round swatches, selected = ringed), and a contained **PREVIEW** section showing a Decoder nav item · "Activate" button · `uint` chip · a toggle — all reflecting the pending selection.
- Pane subtitle copy direction: "Personalize how TinkerDev looks on this device." / accent helper "Used for the active tool, selections, and focus."
- The default accent **must remain `#5b9bf8`** — do not adopt the mockup's violet-as-default; violet is just one of the 7 options.
</specifics>

<deferred>
## Deferred Ideas

- **Free / arbitrary color picker (custom hex accent)** — rejected for v1: a freely chosen hue can fail AA for focus rings / selected-label text on `accent-soft`. Could revisit later with live contrast guarding/clamping.
- **"Notifications" pane** (appears in the mockup nav) — not in the v1.7 roadmap; not a real pane. No scope.
- **Per-tool theme overrides, high-contrast mode, fully custom themes** — out of scope for the Appearance pane.
- **Whole-app live preview for free users** (preview the entire app, not just the strip) — considered and rejected (revert-on-exit + e2e complexity); the contained preview strip is the chosen mechanism.

</deferred>

---

*Phase: 23-appearance-pane*
*Context gathered: 2026-06-16*
