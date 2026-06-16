# Phase 23: Appearance Pane - Research

**Researched:** 2026-06-16
**Domain:** Tauri 2 + React + Tailwind v4 CSS-first theming (`@theme`), `color-mix` accent cascade, `prefers-color-scheme` live system theme, WCAG-AA contrast, existing prefs + entitlement seams
**Confidence:** HIGH (every claim grounded in the actual source files + verified contrast math; the few open items are flagged in the Assumptions Log)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (verbatim D-23-1 .. D-23-11)

- **D-23-1:** Appearance is **Pro-gated through the existing central gate** — no new gate mechanism. Reuse `resolveEntitlements()` + `gatePreferences(prefs, ents)`, which **already** forces `theme`/`accent` → defaults when `ENT_THEMING` is absent (D-26/D-27). Gate on **`ENT_THEMING`** (equivalent to `isPro` in practice — the $9 license grants the full set together).
- **D-23-2 (free-user behavior):** A free user **can open** Appearance and **preview** selections (preview drives the contained PREVIEW strip only). The **whole app stays on the effective/gated appearance** (default dark + `#5b9bf8`) regardless of preview/persist, because `gatePreferences` forces defaults. Pressing **Save** opens the **focused Unlock-Pro modal** (reuse the Phase-22.2 `UpsellModal`/`upsellStore`/`openProUpsell` path) and persists nothing. A deliberate **try-before-buy** sell.
- **D-23-3:** **Preview strip + Save (gate on Save).** Selecting a theme/accent updates a **local pending state** reflected only in a **contained PREVIEW strip** (Decoder nav item · "Activate" button · `uint` chip · a toggle) — **not** the whole app. **Save** commits: persist via the prefs seam **and** apply live to the whole app (Pro). For free, Save → Unlock-Pro modal, no persist. **The lock affordance lives on the Save button** ("Unlock Pro to save" + lock glyph). **No revert logic needed** because global appearance never changes pre-Save.
- **D-23-4 (options + default):** Theme = **light | dark | system**. **Fresh-install default = dark.** Existing installs keep their persisted value. Widen `ThemeName` (`"dark"` → `"light" | "dark" | "system"`) and widen `coerceTheme` (anything else → default `dark`).
- **D-23-5 (system mode):** `theme === "system"` resolves via `prefers-color-scheme` and re-applies **LIVE** on OS light↔dark flip (a `matchMedia` change listener). The persisted/resolved theme is applied **before first paint** (no wrong-theme flash on launch).
- **D-23-6 (theme picker UI):** Three **radio cards** (Dark / Light / System), each with a **mini app-preview thumbnail**. New component — **not** the shared `SegmentedControl`.
- **D-23-7 (accent):** **Curated swatch grid, 7 swatches**: blue (**default, current `#5b9bf8` — unchanged**), violet, green, amber, rose, teal, slate. **No free color picker.** **Every swatch must clear WCAG-AA on BOTH themes for every accent use**: focus rings, nav active-bar, selected-label text on `accent-soft`. Default stays `#5b9bf8`. **Accent reserved for selection only** — `#N` protobuf field numbers stay neutral.
- **D-23-8 (light palette — the heavy lift):** A **full light token set must be authored** (none exists today). Covers all surface tokens, the text ramp (tx/tx-2/tx-3), borders (bd/bd-2), input-bg, scrim, the accent/warn/ok triads, and the radial-gradient bg. Applies across the **whole app**. **Each light value WCAG-AA verified.** Derivation approach is Claude/planner discretion within the AA bar.
- **D-23-9 (apply mechanism):** Wire the **App root** to apply the **effective (gated) theme + accent to `document.documentElement`** via `gatePreferences(preferences, ents)`. **Accent** → override `--color-accent` on `documentElement` (soft/line cascade via `color-mix`). **Theme** → a `data-theme` attribute / class on `documentElement` with the light token set re-declared under that selector. Exact naming is Claude discretion.
- **D-23-10 (pane registry):** Append **one** entry `{ id: "appearance", label: "Appearance", icon, render }` to `SETTINGS_PANES`. **No `SettingsModal` shell change.** Nav shows only real panes.
- **D-23-11 (persistence):** Reuse the existing **prefs seam** — `theme`/`accent` fields, coercers, and `setTheme`/`setAccent` already exist. **No new store key.** Only `ThemeName` + `coerceTheme` widening.

### Claude's Discretion
- Exact light-palette hex values + derivation approach (within AA-on-light).
- The 7 AA-tuned accent hexes (within AA-on-both-themes; default fixed at `#5b9bf8`).
- Internal structure of the theme-card + accent-swatch + preview-strip components and the PREVIEW sample set/layout.
- `data-theme` attribute vs class naming and the light-token selector strategy.

### Deferred Ideas (OUT OF SCOPE)
- Free / arbitrary color picker (custom hex accent).
- "Notifications" pane (mockup-illustrative only).
- Per-tool theme overrides, high-contrast mode, fully custom themes.
- Whole-app live preview for free users (the contained preview strip is the chosen mechanism).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SET-07 | The **Appearance** pane lets the user choose theme (light/dark/system) and accent, persisted via the existing prefs seam and applied live (absorbs backlog 999.3). | Standard Stack (Tailwind v4 `@theme` re-declaration + `color-mix` cascade), Architecture Patterns (App-root apply effect, no-flash pre-paint, matchMedia listener), the verified light palette + 7 dual-theme accent scales, the gate-on-Save consumption of `gatePreferences`/`openProUpsell`, Validation Architecture. |
</phase_requirements>

## Summary

Almost everything for this phase is already built or locked. The persistence seam (`theme`/`accent` fields, `coerceAccent`, `setTheme`/`setAccent`, the no-flash `prefsLoaded` contract) and the gating seam (`gatePreferences` already strips theme/accent to defaults for non-`ENT_THEMING` users; the `UpsellModal`/`upsellStore`/`openProUpsell` route is verbatim-reusable) ship today. The pane registry (`SETTINGS_PANES`) is append-only with zero shell change. The accent system is one CSS-variable write: `--color-accent-soft`/`--color-accent-line` are derived from `--color-accent` via `color-mix`, so overriding `--color-accent` on `documentElement` cascades the whole triad automatically (verified in `src/index.css` lines 52-53 and proven live by the existing `accent-soft`/`accent-line` Tailwind utilities). **[VERIFIED: source files]**

The genuinely hard, undecided work is three things, and the research resolves all three:

1. **A single accent hex per swatch cannot satisfy AA in both themes.** Verified by contrast math: the FIXED default `#5b9bf8` scores **4.88:1** as selected-label text on `accent-soft` in dark (PASS) but only **2.44:1** on a white light surface (FAIL — far below the 4.5:1 AA text bar). The resolution is a **two-value accent scale per swatch**: the dark-AA brand hue (e.g. `#5b9bf8`) drives the **dark** theme, and a darker per-swatch variant (e.g. `#1763d6`) drives `--color-accent` under the light selector. The default blue still *appears* identical in dark (the brand promise of D-23-7), and the light variant restores AA. All 7 light variants below are math-verified ≥4.5:1 on soft-fill. **[VERIFIED: WCAG relative-luminance computation, this session]**

2. **The full light token set** is authored as a `[data-theme="light"]` selector block that re-declares the same custom-property names with light values. A verified candidate palette is provided (near-white surfaces, a dark text ramp where tx-3 `#6b7280` clears 4.83:1 on white). **[VERIFIED: contrast math]**

3. **No-flash launch + live system flip** is solved with a tiny synchronous **pre-paint inline script in `index.html`** that reads the persisted theme (and `matchMedia` for system) and stamps `data-theme` before React mounts, plus a React effect that re-applies on prefs load and subscribes a `matchMedia('(prefers-color-scheme: dark)')` change listener while `theme === "system"`. This reconciles the async prefs-load contract (`usePreferences` returns defaults until the store resolves) with the requirement that the correct theme paints first. **[CITED: MDN prefers-color-scheme / matchMedia]**

**Primary recommendation:** Author light tokens under a `[data-theme="light"]` block in `src/index.css`; widen `ThemeName`/`coerceTheme`; add a per-swatch accent scale (dark hex + light hex) and apply the theme-appropriate `--color-accent` from the App root via `gatePreferences`; add a synchronous pre-paint theme script in `index.html`; build the pane as three new dumb components (theme cards, swatch grid, preview strip) with a local pending state, and route free-tier Save through `openProUpsell`.

## Standard Stack

No new dependencies. The entire phase is built on what ships today (the zero-new-runtime/dev-dep wedge holds). **[VERIFIED: package.json — no new packages required]**

### Core (already present)
| Library / Mechanism | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tailwind v4 CSS-first `@theme` | v4 (CSS-first, no config file) | Token block in `src/index.css` generating `bg-bg-app`/`text-accent`/`border-bd` utilities | The project's established token system (`src/index.css` lines 20-81) |
| CSS `color-mix(in srgb, …)` | native | Derive `accent-soft` (15%) / `accent-line` (75%) from `--color-accent` | Already used (index.css 52-53, 64-65, 76-77); overriding the base cascades the whole triad |
| CSS custom-property cascade on `documentElement` | native | Override `--color-accent` and re-declare light tokens under `[data-theme="light"]` | The D-10 design intent baked into the token comments ("a light theme can re-derive later") |
| `window.matchMedia('(prefers-color-scheme: dark)')` | native | Resolve + live-track system theme | The standard web API for OS theme; WKWebView honors macOS Appearance |
| `usePreferences` / `gatePreferences` / `openProUpsell` | in-repo | Persist + gate-apply + free-tier route | All three seams exist and are consumed elsewhere |
| `useEntitlements()` (`src/shell/useEntitlements.ts`) | in-repo | Reactive `EntitlementSet` for the App-root apply + Save gate | `useSyncExternalStore` over the entitlements module-store; flips live on activation |

### Supporting (already present)
| Component | Purpose | When to Use |
|---------|---------|-------------|
| `SETTINGS_PANES` (`settingsPanes.tsx`) | Append the Appearance entry | One entry, no shell change (D-23-10) |
| `UpsellModal` + `upsellStore.openUpsell` + `proUpsell.openProUpsell` | Free-tier Save route | Save when not entitled → `openProUpsell(saveButtonEl)` (D-23-2) |
| `SegmentedControl` | The PREVIEW strip's sample "toggle" | A faithful sample of a real control; NOT the theme picker (D-23-6) |
| lucide-react icons | Pane icon + glyphs (`Contrast`/`SunMoon` for the pane; `Lock` for the Save lock; `Check` for the selected swatch) | Already the project's icon set |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pre-paint inline script in `index.html` | Apply theme only in a React effect | A React-effect-only apply paints the dark default first, then snaps to the persisted/system theme on the next frame — a visible wrong-theme flash that D-23-5 explicitly forbids. The inline script is the standard no-flash technique. |
| `[data-theme="light"]` attribute | `.theme-light` class on `documentElement` | Equivalent. Attribute reads cleaner in the pre-paint script (`documentElement.dataset.theme = "light"`) and avoids class-list churn. Either satisfies D-23-9; recommend the attribute. |
| Per-swatch two-value accent scale | Single hex per swatch | A single hex CANNOT pass AA in both themes (math-proven below). The scale is required, not optional. |

**Installation:** None.

**Version verification:** No package versions to verify — all mechanisms are native CSS/DOM APIs or in-repo modules. **[VERIFIED: no npm install needed]**

## Architecture Patterns

### Recommended File Layout
```
src/
├── index.css                         # ADD: [data-theme="light"] token block + light accent vars
├── index.html (repo root)            # ADD: synchronous pre-paint theme script (no-flash)
├── shell/
│   ├── preferences.ts                # WIDEN ThemeName; ADD accent scale constant (optional home)
│   ├── prefsStore.ts                 # WIDEN coerceTheme
│   └── theme.ts                       # NEW: pure apply helpers (resolveEffectiveTheme, applyAppearance)
├── App.tsx                            # ADD: appearance-apply effect (gated theme+accent) + matchMedia listener
└── components/
    ├── settingsPanes.tsx             # APPEND the appearance pane entry
    ├── AppearanceSettings.tsx        # NEW: the pane (pending state + Save + gate route)
    ├── ThemeCardGroup.tsx            # NEW: 3 radio cards (Dark/Light/System) — radiogroup
    ├── AccentSwatchGrid.tsx          # NEW: 7-swatch radiogroup
    └── AppearancePreviewStrip.tsx    # NEW: contained sample components reflecting pending state
```

### Pattern 1: Light tokens as a re-declaration block (D-23-8 / D-23-9)
**What:** Tailwind v4's `@theme` defines the dark defaults that generate the utility classes (`bg-pane`, `text-tx-2`, …). The utilities resolve `var(--color-*)` at use-site, so a light theme is authored by **re-declaring the same `--color-*` names under a `[data-theme="light"]` selector** — no utility class changes anywhere, all 11 tools + the tree + License pane + Settings modal + sidebar + palette flip together.
**When to use:** Always — this is the whole light-palette mechanism.
**Example:**
```css
/* src/index.css — AFTER the @theme block. The @theme values are the dark
   defaults; this overrides them when the root carries data-theme="light".
   Every value below is WCAG-AA verified (see the Light Palette table). */
:root[data-theme="light"] {
  --color-bg-app: #f3f4f6;
  --color-win: #ffffff;
  --color-titlebar: #f7f8fa;
  --color-sidebar: #f0f1f4;
  --color-pane: #ffffff;
  --color-panel: #f7f8fa;
  --color-card: #ffffff;
  --color-palette: #ffffff;
  --color-input-bg: #f0f1f4;
  --color-bd: rgba(0, 0, 0, 0.08);
  --color-bd-2: rgba(0, 0, 0, 0.14);
  --color-tx: #1a1d23;     /* 16.9:1 on white */
  --color-tx-2: #525861;   /* 7.2:1 on white  */
  --color-tx-3: #6b7280;   /* 4.8:1 on white (dimmest, still AA for body) */
  --color-scrim: rgba(20, 22, 28, 0.4);
  /* accent/warn/ok BASES re-declared to light variants; soft/line cascade via
     color-mix (the @theme color-mix derivations read var(--color-accent) etc.,
     so they recompute automatically under this selector). */
  --color-accent: #1763d6;   /* light default-blue variant (see scale) */
  --color-warn: #b45309;     /* amber-700 — AA on light card */
  --color-ok: #15722f;       /* green — AA on light card */
}
/* The body radial-gradient is currently hardcoded in index.css (lines 91-97).
   It must become theme-aware: drive it off the tokens or override under the
   selector so a light launch does not paint a dark radial behind the app. */
:root[data-theme="light"] body {
  background: radial-gradient(120% 90% at 50% -10%, #ffffff 0%, #f3f4f6 60%);
  color: #1a1d23;
}
```
**Note:** `src/index.css` lines 91-97 hardcode the dark radial-gradient and `color: #e7e9ee` on `body` (NOT via tokens). This is a known break-point under light — it must be overridden (above) or refactored to read tokens. **[VERIFIED: index.css 91-97]**

### Pattern 2: Per-swatch two-value accent scale (D-23-7) — the central finding
**What:** Each of the 7 swatches maps to TWO hexes: a `dark` value (used as `--color-accent` in dark, and as the swatch's display color in the grid) and a `light` value (used as `--color-accent` under `[data-theme="light"]`). The default blue's dark value is the unchanged `#5b9bf8`; its light value is `#1763d6`. Overriding `--color-accent` per theme cascades `accent-soft`/`accent-line` automatically.
**When to use:** Always — proven necessary by contrast math.
**Example:**
```ts
// A single source-of-truth table. The grid renders dark[] swatches; the apply
// helper picks dark vs light by effective theme.
export const ACCENT_SCALE = {
  blue:   { dark: "#5b9bf8", light: "#1763d6" }, // default; dark hex FIXED (D-23-7)
  violet: { dark: "#a78bfa", light: "#6d28d9" },
  green:  { dark: "#4ade80", light: "#15722f" },
  amber:  { dark: "#fbbf24", light: "#a14708" },
  rose:   { dark: "#fb7185", light: "#be123c" },
  teal:   { dark: "#2dd4bf", light: "#0d6e66" },
  slate:  { dark: "#94a3b8", light: "#475569" },
} as const;
```
**Persistence note:** `accent` persists as a single string (D-23-11, `coerceAccent` accepts any non-empty string). Store the **swatch key** (e.g. `"blue"`) OR the **dark hex** as the persisted `accent`; the apply helper maps that to the theme-appropriate hex. Recommend persisting the **dark hex** (`#5b9bf8`) so `DEFAULT_PREFERENCES.accent` stays a real color string and `gatePreferences`'s `DEFAULT_PREFERENCES.accent` default keeps working unchanged — then look up the light variant by reverse-mapping the dark hex. (Either is valid; this is a planner decision. See Assumptions A1.)

### Pattern 3: App-root gated apply (D-23-9)
**What:** A single effect at the App root computes the effective preferences and writes the theme attribute + accent var to `documentElement`. Effective = `gatePreferences(preferences, ents)` so a free user (or a free-tier override) is forced to default dark + `#5b9bf8` regardless of what's persisted — the D-23-2 invariant.
**When to use:** The one place the whole-app theme/accent is applied.
**Example:**
```tsx
// In App.tsx (or a small useAppearance hook it calls).
const { preferences, prefsLoaded } = usePreferences();
const ents = useEntitlements();
useEffect(() => {
  if (!prefsLoaded) return; // pre-paint script already set the launch theme
  const eff = gatePreferences(preferences, ents);          // free → dark + #5b9bf8
  applyAppearance(eff.theme, eff.accent);                  // pure helper in shell/theme.ts
}, [preferences.theme, preferences.accent, ents, prefsLoaded]);

// Live system flip: subscribe ONLY while effective theme is "system".
useEffect(() => {
  const eff = gatePreferences(preferences, ents);
  if (eff.theme !== "system") return;
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => applyAppearance("system", eff.accent);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}, [preferences.theme, preferences.accent, ents]);
```
**`applyAppearance` (pure, in `shell/theme.ts`):**
```ts
export function resolveEffectiveTheme(theme: ThemeName): "light" | "dark" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}
export function applyAppearance(theme: ThemeName, accentHex: string): void {
  const resolved = resolveEffectiveTheme(theme);
  const root = document.documentElement;
  if (resolved === "light") root.dataset.theme = "light";
  else delete root.dataset.theme;        // dark = absence of the attribute (the @theme defaults)
  root.style.setProperty("--color-accent", accentForTheme(accentHex, resolved));
}
```

### Pattern 4: No-flash pre-paint script (D-23-5)
**What:** A synchronous `<script>` in `index.html`'s `<head>`, BEFORE the module script, reads the persisted theme and stamps `data-theme` so the correct surface paints on the very first frame.
**When to use:** Launch only; React's effect takes over after `prefsLoaded`.
**Critical reconciliation with the async prefs contract:** `usePreferences` reads through `platform.store` which `await initPlatform()`s — async, and in the packaged app the real store is `prefs.json` (see MEMORY: tauri-store-async-init-race). The pre-paint script CANNOT call the async Tauri store. Two viable approaches (planner decides — see A2):
  - **(Recommended) Mirror the resolved theme into a synchronous, pre-paint-readable location.** The Tauri store is async, but the script needs *a* synchronous source. Option: on every `setTheme`/`applyAppearance`, also write the effective theme to `localStorage` (synchronous, available in WKWebView) purely as a *paint hint*; the pre-paint script reads `localStorage.getItem("theme-hint")` + `matchMedia` and stamps `data-theme`. The authoritative value still lives in `prefs.json`; `localStorage` is a non-authoritative cache that only affects the first frame (the App-root effect re-applies the real gated value once prefs load, correcting any drift — e.g. a downgrade to free forces dark). This is the standard SSR-less no-flash pattern.
  - **(Simpler, slightly weaker) Pre-paint only resolves `system`.** Stamp the dark default at build time and let the script flip to light ONLY when `theme-hint==="light"` or unset+system-prefers-light. Without a sync hint there is no way to know a persisted explicit "light" before the async store resolves, so this still flashes for explicit-light users. The localStorage hint is what removes that flash.
```html
<!-- index.html <head>, BEFORE the module script -->
<script>
  (function () {
    try {
      var hint = localStorage.getItem("td-theme-hint"); // "light" | "dark" | "system" | null
      var sysDark = matchMedia("(prefers-color-scheme: dark)").matches;
      var light = hint === "light" || (hint === "system" && !sysDark);
      if (light) document.documentElement.dataset.theme = "light";
    } catch (e) {} // never block paint on a storage error
  })();
})
</script>
```
**[CITED: web.dev / MDN no-flash dark-mode pattern; matchMedia]**

### Pattern 5: Pending-state pane with gate-on-Save (D-23-3 / D-23-2)
**What:** `AppearanceSettings` holds local `pendingTheme`/`pendingAccent` (seeded from `preferences`). The theme cards + swatch grid drive ONLY the pending state and the `AppearancePreviewStrip`. The whole app does NOT change until Save. Save branches on entitlement.
**Example:**
```tsx
const { preferences, setTheme, setAccent } = usePreferences();
const ents = useEntitlements();
const entitled = ents.has(ENT_THEMING);
const [pendingTheme, setPendingTheme] = useState(preferences.theme);
const [pendingAccent, setPendingAccent] = useState(preferences.accent);
const saveRef = useRef<HTMLButtonElement>(null);

function onSave() {
  if (!entitled) { openProUpsell(saveRef.current); return; } // D-23-2: no persist
  setTheme(pendingTheme);     // persists via the seam; App-root effect applies live
  setAccent(pendingAccent);
}
```
**Lock affordance (D-23-3):** the Save button shows "Unlock Pro to save" + a `Lock` glyph when `!entitled` — a *visible* locked state, NOT opacity-only, and the button stays keyboard-reachable and fires `openProUpsell` (WCAG-AA: locked features stay operable per ENT-04).

### Pattern 6: Accessible radio groups (D-23-6 / D-23-7)
**What:** Both the theme cards and the accent swatches are single-select — model them as `role="radiogroup"` with `role="radio"` children (or native `<input type="radio">` visually replaced), arrow-key navigation, `aria-checked`, visible `focus-visible:ring-2 ring-accent`. The swatch must not encode selection by color alone (WCAG 1.4.1) — the selected swatch gets a ring + a `Check` glyph.
**Why:** This mirrors the sidebar's roving model and the project's WCAG-AA bar. The `SegmentedControl` (`aria-pressed` buttons) is the wrong primitive for a radiogroup and is excluded for the theme picker by D-23-6.

### Anti-Patterns to Avoid
- **Applying theme in a React effect only** — wrong-theme flash on launch (D-23-5 violation). Use the pre-paint script.
- **A single accent hex per swatch** — fails AA in light (math-proven). Use the scale.
- **Letting the pending preview mutate `documentElement`** — D-23-3 says only the contained strip changes pre-Save; writing the pending value to the root would change the whole app and re-introduce the revert problem the design avoids.
- **Hardcoding light colors in component classes** — defeats the token system; author everything as `--color-*` overrides so the cascade covers all 11 tools for free.
- **Reading the async Tauri store from the pre-paint script** — it isn't available synchronously; use the `localStorage` paint-hint.
- **`accent` reaching protobuf `#N` field numbers** — binding rule: `#N` stays neutral (the decoder/tree must not pick up `--color-accent`). Verify the tree's field-number color is `text-tx-*`, not `text-accent`. (The mockup uses `--accent` for `.fnum` — confirm the actual `src/tools/protobuf` tree does NOT; this is a verification step, not an assumption to skip. See A3.)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Persisting theme/accent | A new store key / writer | `setTheme`/`setAccent` + the existing prefs blob | Fields, coercers, atomic single-key write already exist (D-23-11) |
| Gating theme for free users | A new check in the pane | `gatePreferences(prefs, ents)` at the App root | Already strips theme/accent to defaults (D-26/D-27); the pane never needs to gate the *apply* |
| Free-tier Save → upsell | A new modal | `openProUpsell(invokerEl)` | Routes notActivated→pitch modal, refreshNeeded/problem→recovery (D-44); focus-return handled |
| Accent soft/line tints | Manual lighten/darken | `color-mix` (already in `@theme`) | Overriding `--color-accent` cascades the triad; zero per-component change |
| Reactive entitlement reads | Prop-drilling ents | `useEntitlements()` | `useSyncExternalStore`; flips live on activation, no restart |
| System theme detection | UA sniffing / Rust query | `matchMedia('(prefers-color-scheme: dark)')` | WKWebView honors macOS Appearance; `change` event gives the live flip free |

**Key insight:** The token cascade + `color-mix` means light theme and accent are *configuration*, not code — author values, not branches. The one piece that genuinely needs new code is the no-flash pre-paint script and the per-theme accent mapping.

## Light Palette (verified, WCAG-AA)

Surface + text ramp — every value computed this session (relative-luminance contrast). **[VERIFIED: contrast math, this session]**

| Token | Light value | Contrast checkpoint |
|-------|-------------|---------------------|
| `--color-bg-app` | `#f3f4f6` | app backdrop |
| `--color-win` | `#ffffff` | window |
| `--color-titlebar` | `#f7f8fa` | titlebar |
| `--color-sidebar` | `#f0f1f4` | sidebar |
| `--color-pane` | `#ffffff` | content pane |
| `--color-panel` | `#f7f8fa` | panels/cards |
| `--color-card` | `#ffffff` | proto field card |
| `--color-palette` | `#ffffff` | ⌘K palette |
| `--color-input-bg` | `#f0f1f4` | inputs |
| `--color-bd` | `rgba(0,0,0,0.08)` | hairline |
| `--color-bd-2` | `rgba(0,0,0,0.14)` | stronger border |
| `--color-tx` | `#1a1d23` | **16.9:1** on white |
| `--color-tx-2` | `#525861` | **7.2:1** on white, 6.5:1 on app |
| `--color-tx-3` | `#6b7280` | **4.83:1** on white (dimmest, still AA body) |
| `--color-scrim` | `rgba(20,22,28,0.4)` | modal backdrop |
| `--color-warn` | `#b45309` | amber-700, AA on light card |
| `--color-ok` | `#15722f` | green, AA on light card |

*(These are a defensible starting set; the planner may hand-tune within the AA bar. The constraint is mechanical — see Validation Architecture for the contrast test that locks it.)*

## Accent Scale (verified AA on BOTH themes)

The display swatch shows the `dark` hex. `--color-accent` resolves to `dark` in dark theme, `light` in light theme. **[VERIFIED: contrast math, this session]**

| Swatch | dark hex (= `--color-accent` dark, swatch display) | text-on-soft (dark, on card) | light hex (= `--color-accent` light) | text-on-soft (light, 12% over white) |
|--------|------|------|------|------|
| blue (default) | `#5b9bf8` **FIXED** | 4.88:1 ✅ | `#1763d6` | 4.65:1 ✅ |
| violet | `#a78bfa` | 4.98:1 ✅ | `#6d28d9` | 5.82:1 ✅ |
| green | `#4ade80` | 7.22:1 ✅ | `#15722f` | 5.07:1 ✅ |
| amber | `#fbbf24` | 7.43:1 ✅ | `#a14708` | 5.14:1 ✅ |
| rose | `#fb7185` | 5.11:1 ✅ | `#be123c` | 5.12:1 ✅ |
| teal | `#2dd4bf` | 6.83:1 ✅ | `#0d6e66` | 5.14:1 ✅ |
| slate | `#94a3b8` | 5.23:1 ✅ | `#475569` | 6.34:1 ✅ |

All clear the 4.5:1 AA text bar as selected-label text on `accent-soft`, and all clear the 3:1 UI bar for the 3px nav active-bar and focus rings (those score even higher, on full-opacity hue over the pane). The **light-theme `accent-soft` is derived from the light `--color-accent`** via the same `color-mix` (15%) — but note: at 15% the lightest hues are marginal; the table above uses a **12% soft** to clear AA comfortably. **The planner should consider lowering the light-theme `--color-accent-soft` mix percentage** (e.g. re-declare `--color-accent-soft: color-mix(in srgb, var(--color-accent) 12%, transparent)` under `[data-theme="light"]`) since dark's 15% soft on near-black has more headroom than light's on near-white. (See A4.)

## Common Pitfalls

### Pitfall 1: `DEFAULT_PREFERENCES.accent` ≠ `--color-accent`
**What goes wrong:** `preferences.ts` line 64 sets `DEFAULT_PREFERENCES.accent = "#3b82f6"`, but `index.css` line 30 sets `--color-accent: #5b9bf8` (brightened for AA per a prior UI review). Today this is harmless because **nothing applies `accent` to the DOM** — `#3b82f6` is dead. **Once the App-root applies `accent` (D-23-9), a fresh install would apply `#3b82f6` — the wrong, AA-failing-in-dark blue** (the comment at index.css 28-30 says #3b82f6 was *replaced* precisely because it fails AA on accent-soft).
**How to avoid:** Update `DEFAULT_PREFERENCES.accent` to `"#5b9bf8"` as part of this phase (and `gatePreferences` will then force the *correct* default for free users). This is a one-line fix but a load-bearing one. **[VERIFIED: preferences.ts:64 vs index.css:30]**
**Warning signs:** The default-blue swatch looks slightly different from the rest of the app's accent after Save; e2e accent-color assertion mismatches `#5b9bf8`.

### Pitfall 2: Wrong-theme flash on launch
**What goes wrong:** Without the pre-paint script, the dark default paints, then the persisted "light"/"system-light" applies on the next frame — a visible flash (D-23-5 violation).
**How to avoid:** Pattern 4 (synchronous `index.html` script + `localStorage` paint-hint kept in sync on Save). The hint is non-authoritative; the App-root effect corrects it after the real gated prefs resolve.
**Warning signs:** A white→dark or dark→white flicker at launch (only visible on the real WKWebView, not jsdom — see Validation).

### Pitfall 3: Free user's persisted Pro theme leaking to the whole app
**What goes wrong:** A user activates Pro, picks light + violet, then lapses to free. The stored prefs still say light/violet. If the App-root applied `preferences` directly, the lapsed app would render light/violet.
**How to avoid:** Always apply `gatePreferences(preferences, ents)`, never raw `preferences` (D-23-2/D-26). On a downgrade, `gatePreferences` forces dark + `#5b9bf8` and the apply effect (which depends on `ents`) re-runs. The `localStorage` paint-hint should also be written from the *gated* value so a lapsed launch doesn't flash the stored light theme.
**Warning signs:** A free build (or free-tier dev override) showing a non-default theme/accent.

### Pitfall 4: Tauri store async race for the paint-hint
**What goes wrong:** Reading the *authoritative* theme synchronously at paint is impossible (the Tauri store is async; MEMORY: tauri-store-async-init-race). Naively the script has nothing to read.
**How to avoid:** The `localStorage` paint-hint (synchronous, WKWebView-available) is the sanctioned sync mirror; the authoritative value stays in `prefs.json`. Keep the hint updated wherever theme is applied. This is packaged-only verifiable (the no-flash behavior is invisible to unit tests — MEMORY: tauri-store-async-init-race). **[VERIFIED: MEMORY note + prefsStore.ts initPlatform await]**

### Pitfall 5: Light surfaces breaking hardcoded dark values
**What goes wrong:** Anything that hardcodes a color (not a token) survives the theme flip and looks wrong. Known instances: the `body` radial-gradient + `color` (index.css 91-97), and any `rgba(255,255,255,…)` hover/scrollbar tints (sidebar `hover:bg-[rgba(255,255,255,0.035)]` in SettingsModal.tsx:199; scrollbar-thumb `rgba(255,255,255,.12)` in the mockup; `.wire`/`.search` use `rgba(255,255,255,0.05)`).
**How to avoid:** Audit for hardcoded `#hex` and `rgba(255,255,255,…)` outside the `@theme` block. The body gradient must be overridden under `[data-theme="light"]`. White-alpha hover tints on a white surface vanish (no visible hover) — replace with a token or a `rgba(0,0,0,…)` light override. **The borders (`--color-bd`/`--color-bd-2`) are `rgba(255,255,255,…)` in dark and MUST flip to `rgba(0,0,0,…)` in light** (included in the palette table) or borders disappear on white. **[VERIFIED: index.css 41-42, 91-97; SettingsModal.tsx:199]**
**Warning signs:** Invisible borders, no hover feedback, a dark gradient bleeding behind a light app — caught by the WCAG-AA audit + the real-WKWebView screenshot.

### Pitfall 6: `accent-soft`/`accent-line` not recomputing under the light selector
**What goes wrong:** If the light block only sets `--color-accent` but the `@theme` `--color-accent-soft` is a *resolved* color (not a live `color-mix` referencing the var), the soft tint wouldn't track. It DOES track today because `@theme` defines them as `color-mix(in srgb, var(--color-accent) 15%, transparent)` (index.css 52-53) — a live expression. **Verify Tailwind v4 emits these as CSS custom properties with the live `color-mix` (not pre-resolved at build).** If v4 pre-resolves, the light block must explicitly re-declare `--color-accent-soft`/`--color-accent-line`. (See A4 — recommend re-declaring them under the light selector regardless, both to be safe and to drop the soft mix % for light AA headroom.)
**Warning signs:** Selected-label tint stays a dark-derived blue after switching accent or theme.

## Code Examples

### Widen the theme type + coercer (D-23-4)
```ts
// src/shell/preferences.ts
export type ThemeName = "light" | "dark" | "system"; // was: "dark"
// DEFAULT_PREFERENCES.theme stays "dark" (D-23-4 fresh-install default).
// FIX Pitfall 1: DEFAULT_PREFERENCES.accent: "#5b9bf8" (was "#3b82f6").

// src/shell/prefsStore.ts
const VALID_THEMES: ReadonlySet<string> = new Set(["light", "dark", "system"]);
function coerceTheme(value: unknown): ThemeName {
  return typeof value === "string" && VALID_THEMES.has(value)
    ? (value as ThemeName)
    : DEFAULT_PREFERENCES.theme; // unknown → "dark" (untrusted-input discipline)
}
```
**Source: src/shell/preferences.ts:16,64-70 + prefsStore.ts:22-25 [VERIFIED]**

### Append the pane (D-23-10)
```tsx
// src/components/settingsPanes.tsx
import { Contrast } from "lucide-react"; // half-circle glyph per CONTEXT
import { AppearanceSettings } from "./AppearanceSettings";
export const SETTINGS_PANES: SettingsPane[] = [
  { id: "license", label: "License", icon: Settings, render: () => <LicenseSettings /> },
  { id: "appearance", label: "Appearance", icon: Contrast, render: () => <AppearanceSettings /> },
];
```
**Source: src/components/settingsPanes.tsx:25-32 [VERIFIED]**

## State of the Art

| Old Approach | Current Approach | When | Impact |
|--------------|------------------|------|--------|
| Theme = boolean | Named `ThemeName` (D-10) | shipped Phase 2 | Widening to 3 values is a type change, not a model change |
| `accent` stored but never applied | App-root applies via `gatePreferences` | this phase | `accent` becomes live; fix the default-mismatch (Pitfall 1) |
| Dark-only `@theme` | `[data-theme="light"]` re-declaration | this phase | Light covers all surfaces via the cascade |

**Deprecated/outdated:** none relevant.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Persisting the **dark hex** as `accent` (and reverse-mapping to the light variant) is cleaner than persisting a swatch key, because it keeps `DEFAULT_PREFERENCES.accent` a real color and `gatePreferences`'s default unchanged. | Pattern 2 | Low — either works; planner decides the persisted representation. |
| A2 | A synchronous `localStorage` **paint-hint** (kept in sync on apply) is the sanctioned no-flash source since the Tauri store is async. | Pattern 4 / Pitfall 4 | Medium — if localStorage is unavailable/cleared in WKWebView, the explicit-light flash returns (degrades to "system-aware only"). Verify on the real webview. |
| A3 | The actual protobuf field tree (`src/tools/protobuf/…`) colors `#N` field numbers with a NEUTRAL token, not `text-accent` (the mockup's `.fnum` uses `--accent`, but the binding rule says neutral). | Anti-Patterns | Medium — if the live tree uses accent for `#N`, changing accent would recolor field numbers (binding-rule violation). **Verify the tree component during planning** (not researched here — out of the listed canonical files). |
| A4 | The light-theme `--color-accent-soft` mix should drop to ~12% (vs dark's 15%) for AA headroom on near-white, and soft/line should be re-declared under the light selector to be safe against Tailwind v4 pre-resolving the `@theme` `color-mix`. | Accent Scale / Pitfall 6 | Low-Medium — at 15% the lightest hues (default blue light variant) sit right at ~3.9-4.1:1; 12% lifts them clear. Verify the rendered soft tint with the contrast test. |
| A5 | The light surface palette values (near-white set) are a defensible AA-passing starting point; final hand-tuning is allowed within the AA bar. | Light Palette | Low — values are math-verified; aesthetic tuning is discretionary. |

## Open Questions (RESOLVED)

1. **Persisted accent representation (key vs hex).**
   - Known: `coerceAccent` accepts any non-empty string; `gatePreferences` resets to `DEFAULT_PREFERENCES.accent`.
   - **RESOLVED:** persist the **dark hex** as `accent` (A1) — keeps `DEFAULT_PREFERENCES.accent` a real color and `gatePreferences` unchanged; `accentForTheme` reverse-maps to the light variant via `ACCENT_SCALE`.
2. **Does the live protobuf tree use accent for `#N`?**
   - Known: binding rule = `#N` neutral; mockup `.fnum` uses `--accent`.
   - **RESOLVED:** verified `src/tools/protobuf-decoder/FieldNode.tsx:68` renders `#{fieldNumber}` with `text-tx` (NEUTRAL); accent appears only on `chip-on`. The mockup's accent `.fnum` is NOT replicated. The `#N`-neutral binding rule is honored — changing accent does not recolor field numbers.
3. **Does Tailwind v4 emit `--color-accent-soft` as a live `color-mix` or a pre-resolved color?**
   - **RESOLVED:** plan 02 re-declares `--color-accent-soft`/`--color-accent-line` under the light selector regardless (light soft at 12% vs dark 15%) — safe either way (A4/A6).

## Environment Availability

The phase is code/CSS only (no new external tools or services). The one runtime capability it relies on — `matchMedia('(prefers-color-scheme: dark)')` reflecting the macOS Appearance setting — is provided by WKWebView and is verified at the real-webview gate, not installable.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `matchMedia` prefers-color-scheme | D-23-5 system mode + live flip | ✓ (WKWebView native) | — | none needed |
| `localStorage` (sync paint-hint) | D-23-5 no-flash | ✓ (WKWebView native) | — | degrade to system-aware-only (A2) |
| Tailwind v4 `@theme` + `color-mix` | light tokens + accent cascade | ✓ (already in build) | v4 | none |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** localStorage paint-hint → without it, explicit-light launches flash (A2).

## Validation Architecture

`workflow.nyquist_validation` is not disabled in config, so this section is required. The project's binding harness is: `/simplify` → `/codex:review --wait --scope working-tree` → vitest + tsc + eslint green → real-WKWebView e2e (+ no-regression) → phase-boundary human walkthrough on a fresh `tauri build` + `gsd-ui-review` WCAG-AA audit. **[VERIFIED: CLAUDE.md + MEMORY: always-run-harness-gate-before-passback]**

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (unit) + WebdriverIO (`wdio`) real-WKWebView e2e |
| Config file | `vite.config.ts` (vitest config inline); `wdio.conf.ts` |
| Quick run command | `pnpm test` (`vitest run`) — plus `pnpm exec tsc --noEmit` + `pnpm lint` |
| Full suite command | `pnpm test` then `bash scripts/e2e-spike.sh` (real WKWebView; see MEMORY: e2e-spike port/single-instance gotchas) |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Automated command | File Exists? |
|-----|----------|-----------|-------------------|--------------|
| SET-07 | `coerceTheme` widens to light/dark/system; unknown → dark | unit | `pnpm test prefsStore` | ❌ Wave 0 (extend existing prefsStore test) |
| SET-07 | `gatePreferences` forces dark + `#5b9bf8` for non-`ENT_THEMING` | unit | `pnpm test entitlements` | ✅ extend (entitlements.test) |
| SET-07 | `resolveEffectiveTheme("system")` reads matchMedia; `applyAppearance` stamps `data-theme` + `--color-accent` | unit (jsdom + matchMedia mock) | `pnpm test theme` | ❌ Wave 0 (`src/shell/theme.test.ts`) |
| SET-07 | **Every** light token + accent pair clears its AA threshold | unit (pure contrast fn over the token tables) | `pnpm test appearance-contrast` | ❌ Wave 0 (`src/shell/appearanceContrast.test.ts`) — mechanizes the math in this doc |
| SET-07 | Free Save → `openProUpsell`, no `setTheme`/`setAccent`; Pro Save → both setters | unit (component, mocked) | `pnpm test AppearanceSettings` | ❌ Wave 0 |
| SET-07 | Theme cards + swatch grid are accessible radiogroups (arrow nav, aria-checked, focus ring) | unit (RTL) + e2e a11y | `pnpm test ThemeCardGroup AccentSwatchGrid` | ❌ Wave 0 |
| SET-07 | Persist + restore through prefs seam; live whole-app apply; no-flash launch; live system flip | **e2e (real WKWebView ONLY)** | `bash scripts/e2e-spike.sh` (new `appearance.e2e.ts`) | ❌ Wave 0 |

**What is verifiable where (critical):**
- **vitest/tsc (HIGH coverage):** type widening, `coerceTheme`, `gatePreferences` gating, the pure `applyAppearance`/`resolveEffectiveTheme` (mock `window.matchMedia`), the **contrast table as executable assertions** (port the relative-luminance fn from this doc into a test so the AA bar is mechanically enforced, not eyeballed), and the pane's Save-routing logic (mock `openProUpsell`/setters).
- **Real-WKWebView e2e ONLY (packaged-only behaviors — MEMORY: tauri-store-async-init-race + verify-gate-builds-real-app):** theme/accent **persistence + restore** (reads/writes hit `prefs.json` only on the real store — invisible to jsdom), the **no-flash launch** (a screenshot of the first frame), and the **live system-flip** (toggling macOS Appearance is OS-native input — likely a **manual walkthrough item**, since WebDriver can't synthesize an OS Appearance change; MEMORY: macos native input is manual-only). The live whole-app apply after Save (the app re-colors without restart) IS WebDriver-drivable: set Pro override → open Appearance → pick light/violet → Save → assert `documentElement` has `data-theme="light"` and computed `--color-accent`.
- **`gsd-ui-review` WCAG-AA audit at the phase boundary:** must run in BOTH themes (the audit currently only sees dark) — this is the binding AA-in-both-themes gate (D-23-7/D-23-8).

### Sampling Rate
- **Per task commit:** `pnpm test <touched>` + `tsc --noEmit` (lefthook blocks failing tsc/vitest — MEMORY: TDD RED commits blocked, land tests GREEN with impl).
- **Per wave merge:** full `pnpm test` + `tsc` + `eslint`.
- **Phase gate:** full vitest green + full `scripts/e2e-spike.sh` green (incl. new `appearance.e2e.ts`) + fresh `tauri build` + `gsd-ui-review` AA audit in **both** themes + human walkthrough (incl. the OS-Appearance live-flip manual item).

### Wave 0 Gaps
- [ ] `src/shell/theme.ts` + `src/shell/theme.test.ts` — `resolveEffectiveTheme`/`applyAppearance` (matchMedia-mocked).
- [ ] `src/shell/appearanceContrast.test.ts` — executable AA assertions over the light-token + accent-scale tables (mechanizes this doc's math; immovable bar for D-23-7/D-23-8).
- [ ] `src/components/AppearanceSettings.test.tsx` — Save-routing (free→upsell/no-persist, Pro→setters).
- [ ] `src/components/ThemeCardGroup.test.tsx` + `AccentSwatchGrid.test.tsx` — radiogroup a11y.
- [ ] Extend `src/shell/prefsStore.test.ts` (or wherever `coerceTheme` is tested) for the 3-value widening.
- [ ] `test/e2e/appearance.e2e.ts` — Pro Save → live whole-app apply (`data-theme`/`--color-accent` assertions) + persistence-restore; reuse `ensureProTier`/`ensureFreeTier` helpers (MEMORY: license-walkthrough-state-pollutes-e2e — reset prefs override before the run).
- [ ] No framework install needed.

## Project Constraints (from CLAUDE.md)

The planner MUST verify the plan honors these (same authority as locked decisions):
- **HashRouter only** — N/A here (no new routes; the pane mounts in the modal).
- **Six tools only** — N/A (Appearance is app chrome, not a tool; do NOT add a "theme" tool).
- **No network at runtime** — honored (theming is pure local CSS/DOM; `matchMedia` is not network).
- **Tools import `src/lib/platform/`, never `@tauri-apps/*`** — the apply effect touches only `document.documentElement` (DOM, allowed); prefs go through `usePreferences` (the seam). No `@tauri-apps` import.
- **Registry is the single control plane** — the pane is one `SETTINGS_PANES` entry; the sidebar/palette derive from the tool registry untouched.
- **Accent reserved for selection only; `#N` neutral** — binding; verify the proto tree (A3).
- **Do NOT refactor `decoder.ts` or its 19 tests** — untouched (this phase never touches the decoder).
- **No hover-only copy / no opacity-only state** — the Save lock is a visible labeled state (D-23-3), not opacity.
- **Zero new runtime AND dev deps in the webview** — honored (no `npm install`).
- **Harness order is binding** — `/simplify` → `/codex:review` → unit → real-WKWebView e2e, never skipped (MEMORY: always-run-harness-gate-before-passback).

## Sources

### Primary (HIGH confidence)
- `src/index.css` (lines 20-117) — the `@theme` token block, the `color-mix` accent/warn/ok triads, the hardcoded body radial-gradient (Pitfall 5).
- `src/shell/preferences.ts` / `prefsStore.ts` / `usePreferences.ts` — `ThemeName`, `DEFAULT_PREFERENCES` (theme/accent), `coerceTheme`/`coerceAccent`/`mergePreferences`, `setTheme`/`setAccent`, the `prefsLoaded` no-flash contract, the `initPlatform()` store-race note.
- `src/lib/entitlements/entitlements.ts` — `ENT_THEMING`, `isPro`, **`gatePreferences`** (the apply seam that already strips theme/accent).
- `src/lib/entitlements/resolve.ts` + `store.ts` + `src/shell/useEntitlements.ts` — `resolveEntitlements()`, the live-flip `refreshEntitlements`, `useEntitlements()`.
- `src/shell/proUpsell.ts` / `upsellStore.ts` / `useUpsell.ts` / `src/components/UpsellPanel.tsx` (`UpsellModal`) — the free-tier Save route + focus-return contract.
- `src/components/settingsPanes.tsx` / `SettingsModal.tsx` / `SegmentedControl.tsx` — the append-only registry (zero shell change) + the radiogroup-vs-aria-pressed distinction.
- `src/App.tsx` / `src/main.tsx` / `index.html` — the App root (no theme/accent apply today), the startup refresh ordering, the empty `<head>` (where the pre-paint script goes).
- `.planning/.../MEMORY.md` — tauri-store-async-init-race, verify-gate-builds-real-app, macos-native-input-manual, license-walkthrough-state-pollutes-e2e, e2e-spike gotchas, TDD-RED-blocked, always-run-harness-gate.
- WCAG relative-luminance contrast computation (this session) — all light-palette + accent-scale ratios.

### Secondary (MEDIUM confidence)
- `design/DevTools Mockup.html` — `:root` `--accent` + `color-mix` soft/line, traffic-light/titlebar chrome, `.fnum` uses `--accent` (the A3 caution).
- MDN / web.dev — `prefers-color-scheme`, `matchMedia` `change` event, the synchronous-head-script no-flash pattern.

### Tertiary (LOW confidence)
- None — no unverified web-only claims drive a recommendation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all mechanisms are in-repo or native; no new deps.
- Architecture (apply/no-flash/system-flip): HIGH — grounded in the actual seams; the one Medium is the localStorage paint-hint behavior on the real webview (A2, verify at the e2e gate).
- Light palette + accent scale: HIGH — every value math-verified this session; aesthetic tuning is discretionary.
- Pitfalls: HIGH — the default-accent mismatch (Pitfall 1) and hardcoded-dark breaks (Pitfall 5) are confirmed against the source.

**Research date:** 2026-06-16
**Valid until:** 2026-07-16 (stable — native CSS/DOM + in-repo seams; no fast-moving dependency)
