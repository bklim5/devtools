# Phase 18: Entitlements Seam & Central Gate - Research

**Researched:** 2026-06-10
**Domain:** Pure-frontend feature gating (entitlement resolution seam, lazy registry loaders, lock/upsell UX) in an existing Tauri 2 + React 19 + react-router 7 app
**Confidence:** HIGH (nearly all findings verified against the local codebase and installed package types)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### ⚠️ D-18 FREE-TIER SCOPE PIVOT (supersedes ENT-04 as written)

**All 11 tools — including the Protobuf hero — stay free.** Pro locks **customization only**: theming + tool ordering/pinning, and Pro is the declared home for **future power features** (schema-aware Protobuf `.proto` support, DevTools CLI — both already "future paid candidates" in PROJECT.md/backlog).

- **Revises:** REQUIREMENTS.md ENT-04 ("free tier locks the Protobuf decoder…"), ROADMAP Phase 18 success criterion 1 and Phase 21 criterion 5, PROJECT.md free-tier lines, `docs/licensing-research.md` "Free tier locks" row. **Where those docs say the decoder is locked, this CONTEXT.md wins.** Update them before/during planning.
- **Tool-gating mechanism still ships in full** (ENT-01: `requiredEntitlements`, lock badge, upsell-panel-in-place-of-tool-UI) — proven via tests + the dev toggle, **dormant in production**: no shipped tool carries `requiredEntitlements` in the registry. How to exercise it (test-fixture tool entry vs dev-only set variant) is Claude's discretion.
- Rationale: the hero is the marketing wedge — locking it kills the free pitch; customization-as-Pro is low-resentment; future power features give the Pro tier real weight.

#### Upsell panel
- **D-19:** ONE shared upsell panel component, parameterized by locked feature name/icon — used in place of any locked tool UI and by app-level lock surfaces. One WCAG-AA surface; Phases 19/20 wire into it.
- **D-20:** Content = short pitch: feature name + lock state, 1–2 lines on what a license unlocks, **no pricing** (pricing lives on the MoR page).
- **D-21:** "Buy license" CTA renders from Phase 18 behind a single URL constant, stubbed; Phase 20 swaps in the real MoR link.
- **D-22:** Secondary "I have a license key" affordance slot reserved (stub/no-op); Phase 19 wires activation. Panel layout is final from Phase 18.

#### Lock badge
- **D-23:** Sidebar: small lucide `Lock` glyph at the row end (status-badge slot family); tool icon + name untouched. Same glyph in ⌘K palette result rows; selecting a locked tool still navigates (route shows the upsell panel).
- **D-24:** Badge color **neutral `tx-2`** — accent stays selection-only per app-wide discipline. Never amber/accent.
- **D-25:** SR: "locked" appended to the accessible name (e.g. "Protobuf Decoder — locked"); lock icon `aria-hidden`; no live-region announcements for static lock state.

#### Locked-feature semantics (theming + ordering/pinning)
- **D-26:** Locked ordering/pinning → sidebar renders **registry-default order, pinned section hidden**; stored `toolOrder`/`pinnedToolIds` stay on disk untouched; unlocking restores the arrangement instantly. Never delete prefs on lock.
- **D-27:** Theming gates at the **prefs-apply seam**: locked → default theme/accent forced, stored values kept. (No theming UI exists today — `setTheme`/`setAccent` have zero call sites; the gate is real + testable now and the future 999.3 settings UI inherits it.)
- **D-28:** Locked reorder/pin affordances stay **visible with the neutral lock treatment**; invoking them (pointer or Alt+↑/↓ / Alt+P / Shift+F10 reset) opens the shared upsell panel. This is the primary Pro discovery path post-Phase-21.
- **D-29:** Standing **"Unlock Pro" entry: small, quiet, keyboard-reachable row at the sidebar footer**, shown in free tier only; opens the shared upsell panel. Natural future home for Phase 19's key entry + Phase 21's status UI.
- **D-30:** Locked-tool route behavior (dormant mechanism): startup resolution unchanged; opening a locked tool shows the upsell panel in place of the tool UI — never redirect away, never hide.

#### Dev/test toggle
- **D-31:** **Downgrade-only** prefs override key (e.g. `entitlementsOverride: "free"`) read by the central gate, honored in all builds — it can only lock, never unlock (no new attack surface; gating is UX-gating, not DRM). Unit tests inject it; e2e sets the store; two-state only: free / full (the shipped free-tier set).
- **D-32:** Hidden ⌘K palette command ("Toggle free tier (dev)") registered **only under `import.meta.env.DEV`** → tree-shaken from production bundles; verified absent via a dist-grep build check. Locked UX is proven on dev/e2e; the packaged phase-boundary walkthrough proves the unchanged everything-unlocked default (criteria 3/4). Packaged free-tier proof lands at Phase 21's flip.

### Claude's Discretion
- Entitlement string vocabulary (e.g. `pro.theming`, `pro.ordering`) — one vocabulary across tool + app-level gates, embedded later in the Keygen license per research doc.
- Disposition of the reserved `premium?: boolean` field at `src/lib/tools/types.ts:52` (research: `requiredEntitlements` supplements/replaces it).
- How the dormant tool-gating path is exercised in tests (fixture tool entry vs dev set variant).
- Gate API shape (e.g. `useEntitlements()`), lazy-loader conversion mechanics (router comment already points at route-level `lazy`), loading-state UX during lazy chunk fetch.
- Exact upsell panel copy.

### Deferred Ideas (OUT OF SCOPE)
- **Settings UI hosting the Pro/license entry** — user: the "Unlock Pro"/license surface should also live in a settings UI in the **next milestone** (pairs with theme settings backlog 999.3 and the long-deferred settings surface).
- **Future Pro power features** — schema-aware Protobuf (backlog 999.5) and DevTools CLI (999.4) as paid features under the D-18 model; promote via backlog review, not this milestone.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENT-01 | `ToolDefinition.requiredEntitlements?: string[]`; tool gating derives from the registry (sidebar/palette/router stay the single control plane) | Verified seams: `types.ts` reserved `premium?` slot + `LazyComponent` union; registry → router children generation at `src/router.tsx:41`; sidebar/palette both iterate `ENABLED_TOOLS`. Pattern: one `isToolLocked(tool, ents)` helper consumed by all three surfaces — no per-feature checks (see Architecture Pattern 2/3). D-18: mechanism dormant — no shipped tool carries the field; exercised via test fixture (recommended, see Pattern 6). |
| ENT-02 | App-level entitlement map gates theming + ordering/pinning | Verified: theme/accent are persisted but currently NEVER applied to the DOM (`--color-accent` is a static CSS var in `index.css:30`; `setTheme`/`setAccent` have zero non-test call sites) — D-27's "prefs-apply seam" must be CREATED as a pure `gatePreferences(prefs, ents)` view (Pattern 4). Ordering/pinning gate = feed `[]` overlays into the existing `partitionTools` when locked (D-26 = same render-overlay shape as v1.4/v1.5). |
| ENT-03 | One central gate; React receives only a resolved set (Rust command inside Tauri later; deterministic free default in browser/jsdom; in-Tauri default = everything unlocked pre-licensing) | Verified pattern to copy: `src/lib/platform/index.ts` — `isTauri()` via `__TAURI_INTERNALS__`, memoised async init, `setXForTest` seam guarded by `MODE === "test" || DEV`. Resolution: module-level snapshot store + `useSyncExternalStore` hook so a dev-toggle flip propagates to ALL consumers (usePreferences instances do NOT sync across components — verified pitfall #3). |
| ENT-04 | (As amended by D-18) Locked features stay visible with lock badge + shared upsell panel in place of UI; WCAG-AA; no opacity-only state | Verified surfaces: sidebar row status-badge slot family (`Sidebar.tsx` pin/grip at `right-8`/`right-1`, `pr-14`), palette rows (`CommandPalette.tsx:193`), `aria-live` + neutral-token discipline already established. lucide `Lock` exists in the pinned lucide-react build (verified in node_modules). |
| ENT-05 | All registry entries load via lazy `component` loaders; behavior identical; `decoder.ts` + 19 tests byte-for-byte untouched | Verified: `LazyComponent = () => Promise<{ default: ComponentType }>` (types.ts:24) exactly matches `React.lazy`'s load signature (verified in local @types/react 1611-1613). All 11 tool `index.ts` files default-import their component today → mechanical conversion to `component: () => import("./XTool")`. Recommended mechanics: element-level gate + module-cached `React.lazy` (NOT route-level `lazy` — memoization pitfall #1). |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Harness (binding, per task, in order):** `/simplify` → `/codex:review --wait --scope working-tree` → unit green (`vitest` + `tsc --noEmit`; the decoder's 19 tests are the immovable bar) → real-WKWebView UI verification vs `design/`.
- **Phase boundary:** agent auto-runs `pnpm tauri build`; human sign-off requires the built-app walkthrough + passing `gsd-ui-review` WCAG-AA audit.
- **HashRouter only**; **six-tools constraint** (registry already at 11 by approved milestones — no NEW tools); **do not refactor `decoder.ts` or its 19 tests**; **no network at runtime** (this phase adds none); tools import `src/lib/platform/`, never `@tauri-apps/*`; registry is the single control plane; tool components layout-agnostic; no hover-only copy; accent = selection-only.
- **Zero new runtime AND dev dependencies in the webview** (STATE.md inherited wedge) — everything in this phase must use existing deps.
- **GSD workflow enforcement** — work lands via `/gsd-execute-phase`.
- **Lefthook pre-commit** runs `tsc --noEmit` + `vitest run` — no RED-only test commits; land tests GREEN with impl (memory: TDD RED commits blocked).

## Summary

Phase 18 is pure wiring over seams the codebase deliberately reserved: the unused `LazyComponent` union member, the reserved `premium?` field, the platform seam's Tauri-vs-browser detection pattern, and the render-overlay personalization pattern (`toolOrder`/`pinnedToolIds`). No new dependencies are needed or allowed. The phase builds (1) a small `src/lib/entitlements/` module — vocabulary constants, a pure resolver, a module-level snapshot store with a `useEntitlements()` hook — (2) a shared `UpsellPanel` + lock-badge treatment across sidebar/palette/routes, (3) gating of ordering/pinning/theming as render-time views over untouched prefs, and (4) conversion of all 11 registry entries to lazy loaders with per-tool code-split chunks.

Two findings materially shape the plan. First, **theme/accent prefs are persisted but never applied anywhere** — `--color-accent` is hardcoded in `index.css` and `setTheme`/`setAccent` have zero call sites — so D-27's "prefs-apply seam" does not exist yet and must be created as a pure function this phase (which is fine: it makes the gate trivially testable). Second, **react-router 7.16's route-level `lazy` is the wrong mechanism for gated tools**: the router memoizes `lazy()` results once per route, so an entitlement flip (dev toggle) could not swap the rendered component, and the chunk would download even when locked — defeating the future free-build exclusion seam. The right mechanism is an element-level `<ToolRoute>` gate that renders the upsell panel when locked and a module-cached `React.lazy` component when unlocked (the `LazyComponent` type is byte-identical to `React.lazy`'s load signature — verified against installed @types/react).

The riskiest integration detail is state propagation: `usePreferences()` creates isolated per-component instances that do not sync (verified — Sidebar, App, and the palette each hold independent copies), so the dev toggle must flow through a dedicated entitlements store (`useSyncExternalStore`) that re-resolves and notifies all subscribers, not through a prefs setter alone.

**Primary recommendation:** Build `src/lib/entitlements/` mirroring the platform-seam pattern (resolver + snapshot store + test seam), gate at exactly three consumption points (router element, sidebar render-overlay inputs, prefs-apply view), and lazify via module-cached `React.lazy` inside a gate element — never route-level `lazy`.

## Standard Stack

### Core (all already installed — zero new deps, per binding constraint)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react / react-dom | 19.2.6 (installed; ^19.1.0 pinned) | `React.lazy` + `<Suspense>` for tool chunk loading | `LazyComponent` type matches `React.lazy(load)` exactly `[VERIFIED: node_modules @types/react index.d.ts:1611]` |
| react-router-dom | 7.16.0 | Existing `createHashRouter`; route children stay generated from `ENABLED_TOOLS` | Route-level `lazy` exists (`LazyRouteDefinition` = function or object form) but is NOT recommended here — see Pitfall 1 `[VERIFIED: node_modules react-router dist types data-D4xhSy90.d.ts:709–724,773]` |
| lucide-react | 1.17.0 (pinned) | `Lock` glyph for badges (D-23) | `Lock` export present in the installed build `[VERIFIED: node_modules lucide-react d.ts grep]` |
| vitest | 4.1.7 | Unit gate; node env default, jsdom per-file via `// @vitest-environment jsdom` | Existing harness `[VERIFIED: package.json + vite.config.ts test block]` |
| @wdio/* + scripts/e2e-spike.sh | installed | Real-WKWebView e2e (`test/e2e/*.e2e.ts`) | Existing UI gate `[VERIFIED: test/e2e/ listing]` |

### Supporting (existing in-repo assets to reuse)

| Asset | Location | Purpose | When to Use |
|-------|----------|---------|-------------|
| Platform seam pattern | `src/lib/platform/index.ts` | `isTauri()`, memoised init, `setXForTest`/`resetXForTest` guarded by `MODE==="test" \|\| DEV` | Copy structurally for the entitlements resolver/store |
| Prefs coercers | `src/shell/prefsStore.ts` | Untrusted-store field coercion (`coerceTreeStyle` is the exact shape for a two-state string) | `coerceEntitlementsOverride(value): "free" \| null` |
| `partitionTools` / `reconcileToolOrder` | `src/shell/toolOrder.ts` | Pure render-overlay partition | D-26 gating = pass `[]` overlays when `pro.ordering` absent — zero changes to these functions |
| `__injectUpdate` DEV hook precedent | `src/App.tsx:105–113` | `import.meta.env.DEV`-guarded code stripped from prod | Model for the D-32 DEV palette command + any e2e injection hook |
| aria-live announce pattern | `src/components/Sidebar.tsx` `announce()` | Polite SR announcements with same-message re-fire | Reuse for "opened upsell"-adjacent announcements if needed (D-25 says NO live region for static lock state — only reuse for action feedback if planner chooses) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Element-level gate + module-cached `React.lazy` | react-router route-level `lazy` (function or 7.5+ object form) | Route `lazy()` is executed ONCE and memoized by the router — an entitlement flip cannot swap upsell↔tool without recreating the router; the chunk also loads even when locked. Rejected for gated tool routes. `[VERIFIED: react-router types show lazy as one-shot route-prop loader; memoization is documented router behavior]` `[ASSUMED: memoization specifics from training — see Assumptions A1]` |
| Module-level snapshot store + `useSyncExternalStore` | React Context provider in `App` | Context also works (all consumers — Sidebar, palette, route elements — sit under `App`), but a module store additionally serves non-component code (e.g. future Phase 21 refresh) and mirrors the platform-seam test-injection ergonomics. Either is acceptable; store recommended. |
| `entitlementsOverride` in the existing prefs blob (D-31, locked) | Separate store key | Locked by D-31 — lives in prefs; reuse `mergePreferences` coercion. |

**Installation:** none — `pnpm install` already satisfies everything (zero-new-deps constraint).

## Architecture Patterns

### Recommended Project Structure

```
src/lib/entitlements/
├── entitlements.ts      # vocabulary constants, EntitlementSet type, isEntitled(), isToolLocked()
├── resolve.ts           # resolveEntitlements(): env split + downgrade-only override
└── store.ts             # snapshot + subscribe (useSyncExternalStore backing),
                         # refreshEntitlements(), setEntitlementsForTest()/reset
src/shell/
├── useEntitlements.ts   # hook: useSyncExternalStore over store.ts
└── preferences.ts       # + entitlementsOverride: "free" | null (D-31)
src/components/
├── UpsellPanel.tsx      # D-19..D-22 shared panel (feature name/icon param, CTA stub, key slot)
└── LockBadge.tsx        # optional tiny shared glyph wrapper (D-23/D-24/D-25)
src/tools/*/index.ts     # component: () => import("./XTool")  (11 files)
src/router.tsx           # ToolRoute gate element + module-level React.lazy cache
```

### Pattern 1: Entitlement vocabulary + resolved set (Claude's discretion area — recommendation)

**What:** Two app-level entitlement strings this phase: `pro.theming` and `pro.ordering` (ordering covers reorder + pin + reset — D-26/D-28 treat them as one arrangement feature). Tool entitlements are opaque strings carried in `requiredEntitlements` (none shipped — D-18). Resolved set = `ReadonlySet<string>`.

```typescript
// src/lib/entitlements/entitlements.ts (new)
export const ENT_THEMING = "pro.theming";
export const ENT_ORDERING = "pro.ordering";

/** Every entitlement the FULL tier resolves to (Phase 21: comes from machine.lic). */
export const ALL_ENTITLEMENTS: readonly string[] = [ENT_THEMING, ENT_ORDERING];

export type EntitlementSet = ReadonlySet<string>;
export const FULL_SET: EntitlementSet = new Set(ALL_ENTITLEMENTS);
export const FREE_SET: EntitlementSet = new Set(); // free = no pro entitlements

export function isEntitled(set: EntitlementSet, required: readonly string[]): boolean {
  return required.every((e) => set.has(e));
}

/** ENT-01: ONE predicate all three surfaces (sidebar, palette, router) consume. */
export function isToolLocked(tool: ToolDefinition, set: EntitlementSet): boolean {
  return !!tool.requiredEntitlements?.length && !isEntitled(set, tool.requiredEntitlements);
}
```

**Why this shape:** strings are opaque data later embedded in the Keygen license (`docs/licensing-research.md` §Entitlements design `[CITED: docs/licensing-research.md:71–76]`); a fixture tool in tests can require `"test.locked"` without that string existing in `ALL_ENTITLEMENTS` — locked under FULL_SET too, which is exactly what a dormant-mechanism test wants.

### Pattern 2: Central resolution (ENT-03) — copy the platform-seam shape

```typescript
// src/lib/entitlements/resolve.ts (new) — mirrors src/lib/platform/index.ts isTauri()
import { loadPreferences } from "@/shell/prefsStore";
import { FREE_SET, FULL_SET, type EntitlementSet } from "./entitlements";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Phase 18: in-Tauri default = everything unlocked; browser/jsdom/vite-preview =
 *  deterministic free tier (criterion 3). Phase 21 swaps the Tauri arm for the
 *  license_status command — THIS function is the single flip point. The D-31
 *  override is DOWNGRADE-ONLY: it can force free, never add entitlements. */
export async function resolveEntitlements(): Promise<EntitlementSet> {
  const base = isTauri() ? FULL_SET : FREE_SET;
  const prefs = await loadPreferences(); // awaits initPlatform() internally — store-race safe
  return prefs.entitlementsOverride === "free" ? FREE_SET : base;
}
```

**When to use:** resolution runs once at startup (kick off in `main.tsx` beside `initPlatform()` or in the store's first subscribe) and re-runs on demand (`refreshEntitlements()` after the dev toggle writes the override; Phase 21 calls it after activation).

### Pattern 3: Snapshot store + `useEntitlements()` (cross-component propagation)

**What:** Module-level current snapshot + listener set, exposed via `useSyncExternalStore`. Default snapshot before first resolution: `FULL_SET` in Tauri, `FREE_SET` otherwise — same value resolution will return when no override exists, so there is no lock-flash at startup (override="free" is a dev/test state where a brief flash is acceptable; flag for the planner).

```typescript
// src/lib/entitlements/store.ts (new — pattern from platform/index.ts test seam)
let current: EntitlementSet = defaultSnapshot();
const listeners = new Set<() => void>();

export function getEntitlementsSnapshot(): EntitlementSet { return current; }
export function subscribeEntitlements(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export async function refreshEntitlements(): Promise<void> {
  const next = await resolveEntitlements();
  if (!setsEqual(next, current)) { current = next; listeners.forEach((l) => l()); }
}
/** Guarded like setPlatformForTest (MODE==="test" || DEV only). */
export function setEntitlementsForTest(set: EntitlementSet): void { /* guard + assign + notify */ }

// src/shell/useEntitlements.ts (new)
export function useEntitlements(): EntitlementSet {
  return useSyncExternalStore(subscribeEntitlements, getEntitlementsSnapshot);
}
```

### Pattern 4: Prefs-apply gate (D-26/D-27) — a pure view, never a mutation

**What:** A pure function producing the EFFECTIVE preferences for rendering; stored values never touched. This CREATES the prefs-apply seam D-27 names (it does not exist today — theme/accent are persisted but applied nowhere `[VERIFIED: grep — setTheme/setAccent call sites only in usePreferences itself + its test; --color-accent static in index.css]`).

```typescript
// src/lib/entitlements/entitlements.ts or src/shell/preferences.ts (planner's call)
export function gatePreferences(prefs: Preferences, ents: EntitlementSet): Preferences {
  return {
    ...prefs,
    ...(ents.has(ENT_THEMING) ? {} : { theme: DEFAULT_PREFERENCES.theme, accent: DEFAULT_PREFERENCES.accent }),
    ...(ents.has(ENT_ORDERING) ? {} : { toolOrder: [], pinnedToolIds: [] }),
  };
}
```

**Consumption:** `Sidebar` feeds `gatePreferences(preferences, ents)` (or just the two gated fields) into `partitionTools` — locked ⇒ `[]` overlays ⇒ registry-default order + hidden pinned section (D-26), with prefs on disk untouched; unlocking re-renders the stored arrangement instantly. The same function is what a future 999.3 theming applier inherits (D-27). `partitionTools`/`reconcileToolOrder` need ZERO changes `[VERIFIED: src/shell/toolOrder.ts — pure, input-driven]`.

**Locked affordances (D-28):** the pin button / Alt+↑↓ / Alt+P / Shift+F10-reset handlers in `Sidebar.tsx` branch FIRST on `ents.has(ENT_ORDERING)`; when locked they open the shared upsell panel instead of invoking setters (so no writes happen while locked — prefs preservation is structural). Affordances stay visible with the neutral lock treatment; never `opacity`-only, never hidden.

### Pattern 5: Lazy registry + gated routes (ENT-05 + D-30)

**What:** Convert all 11 `src/tools/*/index.ts` to `component: () => import("./XTool")` (every tool component is the module's default export — verified for base64 + protobuf-decoder; the eager `import X from "./XTool"` form used everywhere only works with default exports `[VERIFIED: src/tools/base64/index.ts, src/tools/protobuf-decoder/index.ts]`). Narrow `ToolDefinition.component` to `LazyComponent` only (drop the eager arm of the union): the router is the ONLY consumer of `tool.component` `[VERIFIED: grep — router.tsx is the sole read site]`, and a runtime eager-vs-lazy discrimination is impossible (both are functions).

```tsx
// src/router.tsx (rework of renderTool)
import { lazy, Suspense } from "react";

// React.lazy components must be created ONCE per tool, not per render (Pitfall 2).
const lazyCache = new Map<string, ComponentType>();
function lazyToolComponent(tool: ToolDefinition): ComponentType {
  let C = lazyCache.get(tool.id);
  if (!C) { C = lazy(tool.component); lazyCache.set(tool.id, C); }
  return C;
}

function ToolRoute({ tool }: { tool: ToolDefinition }) {
  const ents = useEntitlements();
  if (isToolLocked(tool, ents)) return <UpsellPanel feature={tool.name} icon={tool.icon} />; // D-30
  const Tool = lazyToolComponent(tool);
  return (
    <Suspense fallback={null}>
      <Tool />
    </Suspense>
  );
}

// children: ...ENABLED_TOOLS.map((tool) => ({ path: `tools/${tool.id}`, element: <ToolRoute tool={tool} /> }))
```

**Why element-level, not route-level `lazy`:** (a) the router memoizes `lazy()` once per route — a dev-toggle flip couldn't swap upsell↔tool; (b) a locked tool's chunk must NOT download (the future free-build exclusion seam means the chunk may not exist); (c) reactivity via `useEntitlements()` keeps the registry the single control plane. The router.tsx comment anticipating route-level `lazy` should be updated. Vite code-splits each `() => import(...)` into its own chunk automatically; `decoder.ts` is imported only by the protobuf tool, so it lands in that tool's chunk — the exclusion seam becomes real `[VERIFIED: import graph — src/lib/protobuf imported from src/tools/protobuf-decoder only]` `[ASSUMED: exact chunk layout — confirm via `pnpm build` output during execution]`.

**Suspense fallback:** `null` (or a minimal neutral placeholder). Chunks come off local disk in the packaged app — a spinner would flash. Verify no perceptible blank on the real WKWebView during the UI gate; paste-instant (<2s) is measured at the phase walkthrough.

### Pattern 6: Dormant tool-gating proof (Claude's discretion — recommendation)

Use a **test-fixture ToolDefinition** (e.g. `requiredEntitlements: ["test.locked"]`, trivial lazy component) injected into unit tests of `isToolLocked`, `ToolRoute`, sidebar row, and palette row — NOT a dev-only registry variant. Rationale: the production registry stays byte-identical to shipped behavior (D-18 dormancy is verifiable by reading `registry.ts`), and fixtures keep the proof in jsdom where it is cheap. The e2e/dev-toggle path proves the free-tier APP-LEVEL locks (ordering/pinning + footer row + upsell panel) on the real WKWebView — tool-route lock UX is additionally demonstrable in dev by the toggle only if a dev fixture exists, so prefer asserting tool-lock UX in jsdom and app-level lock UX in e2e.

### Pattern 7: DEV palette command (D-32)

The palette currently models ONLY tools (`PaletteGroup.tools: ToolDefinition[]`) — there is no command concept `[VERIFIED: src/components/CommandPalette.tsx]`. Smallest change: extend the row model with a discriminated union (`{ kind: "tool", tool } | { kind: "command", id, name, icon, run }`) and append the dev command to `buildGroups` results only when `import.meta.env.DEV` — same guard as App.tsx's `__injectUpdate` (stripped from prod by Vite's static define + rollup DCE). The command flips `entitlementsOverride` (write via prefs) then `await refreshEntitlements()`. Dist-grep check (script or documented step): after `pnpm build`, `grep -R "Toggle free tier" dist/assets/` must return nothing.

### Pattern 8: Upsell panel + lock badges (D-19..D-25, D-29)

- `UpsellPanel({ feature, icon })`: one component; heading = feature name + locked state; 1–2 lines of unlock copy (no pricing); primary "Buy license" button reading a single exported `BUY_LICENSE_URL` constant (stub — D-21; opening behavior can be a no-op/disabled-style stub this phase since the URL is fake); secondary "I have a license key" slot rendered but inert (D-22). Layout final this phase. WCAG-AA: real heading hierarchy, visible focus, ≥4.5:1 text on `bg-pane`, keyboard-reachable buttons. Rendered (a) in place of tool UI by `ToolRoute`, (b) as the surface the locked sidebar affordances and the footer row open — planner decides modal-vs-route presentation for (b); a centered in-`<main>` panel via existing overlay patterns is consistent with the palette's dialog styling.
- Lock badge: lucide `Lock`, `text-tx-2`, `aria-hidden`, placed in the sidebar row's status-badge slot family (the `right-8`/`right-1` control zone is taken by pin/grip — the badge belongs inline after the name or in a third slot; `pr-14` reserve may need a small widen if slotted right — planner verifies against `design/DevTools Mockup.html`). Accessible name suffix: append visually-hidden `— locked` text inside the NavLink / palette button so the row reads "Protobuf Decoder — locked" (D-25); no `aria-live` for static state.
- Footer "Unlock Pro" row (D-29): quiet row after the `<nav>` inside the `<aside>` (the nav is `flex-1`, so a footer row naturally bottom-anchors); shown only when `!ents.has(ENT_ORDERING) || !ents.has(ENT_THEMING)` (i.e., free tier); a `<button>` (not NavLink) opening the upsell panel; Tab-reachable, `focus-visible` ring per house style.

### Anti-Patterns to Avoid

- **Scattered per-feature checks:** every gate decision flows through `isToolLocked()` / `ents.has(...)` over the ONE resolved set. No component re-derives tier from prefs or platform.
- **Mutating prefs on lock:** D-26 forbids it — gating is a render-time view (`gatePreferences`), identical in shape to the existing `toolOrder`/`pinnedToolIds` overlays.
- **Hiding locked features / opacity-only lock:** ENT-04 explicitly forbids both; locked = visible + badge + upsell on open.
- **`React.lazy(...)` inside render without caching:** creates a new lazy component every render → remount + refetch loop.
- **Upgrade path through the override:** D-31 is downgrade-only; the coercer accepts exactly `"free"`, everything else → `null`.
- **Accent-colored lock UI:** D-24 — neutral `tx-2` only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Code-split component loading | Custom dynamic-import state machine (loading/error flags per tool) | `React.lazy` + `<Suspense>` | `LazyComponent` type already matches `React.lazy` exactly; React handles pending/StrictMode/concurrent edge cases `[VERIFIED: @types/react]` |
| Cross-component gate propagation | Window events / prop drilling / duplicated `usePreferences` reads | `useSyncExternalStore` over a module store | usePreferences instances are isolated (verified); uSES is the React-19-sanctioned external-store primitive, zero deps |
| Untrusted override coercion | Ad-hoc `as` casts on the stored blob | Extend `mergePreferences` with a `coerceEntitlementsOverride` mirroring `coerceTreeStyle` | The untrusted-prefs threat model (T-02-08 family) and pattern already exist `[VERIFIED: src/shell/prefsStore.ts]` |
| Order/pin lock semantics | New "locked partition" logic | Existing `partitionTools` with `[]` inputs | Pure function already bounds output to the registry; locked = default inputs `[VERIFIED: src/shell/toolOrder.ts]` |
| DEV-only stripping | Runtime env sniffing / build flags | `import.meta.env.DEV` guard (App.tsx precedent) | Vite statically replaces it in prod → rollup eliminates the branch `[VERIFIED: precedent at src/App.tsx:105–113]` |

**Key insight:** this phase's entire surface is composition of five already-proven in-repo patterns (platform seam, prefs coercion, render overlays, DEV guards, registry projection) — any new abstraction beyond `src/lib/entitlements/` + `UpsellPanel` is over-engineering.

## Common Pitfalls

### Pitfall 1: Route-level `lazy` memoization defeats reactive gating
**What goes wrong:** Implementing ENT-05 via `route.lazy` (as the old router.tsx comment suggests) — the router calls `lazy()` once and caches the result for the route's lifetime; flipping the dev toggle cannot swap upsell↔tool, and the chunk downloads even when locked.
**Why it happens:** RR's `lazy` is a route-definition loader, not a render-time decision point `[VERIFIED: react-router 7.16 types — lazy is a one-shot `LazyRouteDefinition` on the route object]`.
**How to avoid:** Element-level `<ToolRoute>` gate + module-cached `React.lazy` (Pattern 5). Update the stale router.tsx comment.
**Warning signs:** dev toggle flips the sidebar but the open tool route doesn't change; network/chunk fetch for a locked tool.

### Pitfall 2: `React.lazy` created per render
**What goes wrong:** `lazy(tool.component)` inside the component body → new identity each render → React unmounts/remounts the tool and refetches the chunk; tool state (pasted input) lost on every parent re-render.
**How to avoid:** Module-level `Map<toolId, LazyExoticComponent>` (Pattern 5).
**Warning signs:** tool inputs clearing when entitlements/preferences re-render the shell; repeated chunk requests in dev network panel.

### Pitfall 3: usePreferences instances don't sync — the dev toggle silently fails to propagate
**What goes wrong:** Palette command writes `entitlementsOverride` via its own prefs path; Sidebar's separate `usePreferences()` instance (and the gate, if it reads prefs lazily) never re-reads → UI doesn't flip until reload.
**Why it happens:** Each `usePreferences()` call holds independent `useState`; there is no shared prefs store/context `[VERIFIED: src/shell/usePreferences.ts + grep — no createContext/useSyncExternalStore anywhere in src]`.
**How to avoid:** The toggle writes the override AND calls `refreshEntitlements()`; ALL gate consumers read via `useEntitlements()` (the store notifies). Never gate off a local prefs copy.
**Warning signs:** toggle works only after app restart; Sidebar and route disagree about lock state.

### Pitfall 4: Tauri store async-init race on the override read path
**What goes wrong:** Resolution reads the override before `initPlatform()` resolves → browser-localStorage fallback instead of prefs.json in the packaged app (split-brain; project memory: tauri-store-async-init-race).
**How to avoid:** `resolveEntitlements()` reads via `loadPreferences()`, which already `await initPlatform()` internally `[VERIFIED: src/shell/prefsStore.ts:130–138]`. Verify override persistence on the real WKWebView during the UI gate (memory says packaged-only bug, invisible to unit tests).
**Warning signs:** override set in dev sticks, but a packaged `tauri build` app ignores it.

### Pitfall 5: Criterion-3 browser/jsdom free default breaks existing assumptions
**What goes wrong:** With the deterministic FREE default outside Tauri, jsdom renders the sidebar with ordering/pinning locked + the footer "Unlock Pro" row — existing tests that exercise pin/reorder behaviors (and any that count rows/links) can break; `vite preview`/browser dev shows locked customization.
**Why it happens:** Criterion 3 (locked) mandates the free default outside Tauri; D-18 means free still shows all 11 tools, but `pro.ordering`/`pro.theming` are absent.
**How to avoid:** Audit the small affected set — `Sidebar.test.tsx` is only 6 projection tests (links/names/hrefs/aria-current — likely unaffected unless the footer is a link; make it a `<button>`); interaction-level reorder/pin coverage lives in `sidebar.e2e.ts`, which runs inside Tauri (FULL default) and stays green `[VERIFIED: test file inventory + e2e runs under tauri dev]`. Any jsdom test needing unlocked behavior calls `setEntitlementsForTest(FULL_SET)` in setup; lock-UX tests inject `FREE_SET` explicitly. Add `resetEntitlementsForTest()` to shared afterEach patterns.
**Warning signs:** previously-green Sidebar/CommandPalette jsdom tests failing on row counts or on affordances now routed to the upsell panel.

### Pitfall 6: e2e runs under `tauri dev` (DEV build) — packaged behavior differs by design
**What goes wrong:** Concluding from e2e that production has the toggle, or that packaged free-tier UX is proven. D-32 scopes it: e2e/dev prove locked UX; the packaged walkthrough proves the unchanged everything-unlocked default; packaged free-tier proof is Phase 21's.
**How to avoid:** e2e spec uses the DEV palette command (available because `tauri dev` serves a DEV bundle) or seeds the store override; the phase-boundary build adds the dist-grep check ("Toggle free tier" absent from `dist/assets/`). Remember e2e harness gotchas: run via `scripts/e2e-spike.sh`, port 4445/1420 conflicts, reap orphan processes (project memory).
**Warning signs:** asserting lock badges in a packaged-app walkthrough this phase (they shouldn't appear — everything unlocked).

### Pitfall 7: Lock badge collides with the pin/grip control zone in sidebar rows
**What goes wrong:** Dropping the Lock glyph at the row end overlaps the absolutely-positioned pin (`right-8`) and grip (`right-1`) controls; `pr-14` reserves space for exactly two controls `[VERIFIED: Sidebar.tsx renderRow]`.
**How to avoid:** Place the badge inline immediately after the tool name (within the truncating span's flex row) — D-23 says "row end (status-badge slot family)", and the `status?: "experimental"` badge family renders inline. Note: dormant mechanism means NO shipped sidebar row shows a tool lock badge — this surface is exercised by fixture tests; the visible-in-product lock treatments are the pin/reorder affordances + footer row.
**Warning signs:** truncated tool names; badge invisible under hover-revealed pin button.

### Pitfall 8: Startup lock-flash / Suspense flash
**What goes wrong:** (a) Gate snapshot defaults to FREE inside Tauri before async resolution → one frame of locked UI in the everything-unlocked shipped app, violating "shipped behavior unchanged". (b) A visible spinner fallback flashes on every tool switch.
**How to avoid:** (a) Default snapshot = `isTauri() ? FULL_SET : FREE_SET` (sync check, no await) so pre-resolution and post-resolution agree whenever no override exists; only an override-set dev session sees a brief downgrade after resolution. (b) `fallback={null}`; verify perceived instantness on the real WKWebView.
**Warning signs:** lock badges blinking at launch in `tauri dev`; visible blank/spinner between sidebar click and tool paint.

### Pitfall 9: Alt-chord lock handling must keep macOS `e.code` discipline
**What goes wrong:** Adding the D-28 locked-branch to Alt+P using `e.key === "p"` — dead on real macOS (Option+P composes to "π"; project memory + Sidebar.tsx comment).
**How to avoid:** Branch on lock BEFORE the existing chord handlers fire their setters, inside the same handlers that already match `e.code === "KeyP"` etc.; e2e dispatches the composed key shape (`key:'π'/code:'KeyP'`) as the existing regression spec does.
**Warning signs:** locked Alt+P opens the panel in jsdom but does nothing on the real WKWebView.

## Code Examples

Verified patterns from the codebase (sources inline):

### Registry entry conversion (per tool, 11 files)
```typescript
// src/tools/base64/index.ts — BEFORE [VERIFIED: current file]
import Base64Tool from "./Base64Tool";
//   component: Base64Tool,

// AFTER (ENT-05): default export shape matches LazyComponent + React.lazy exactly
//   component: () => import("./Base64Tool"),
// and delete the eager import. ToolDefinition.component narrows to LazyComponent
// (router.tsx is the only consumer — verified by grep).
```

### ToolDefinition extension (ENT-01 + premium disposition)
```typescript
// src/lib/tools/types.ts
export interface ToolDefinition {
  // ...existing fields...
  /** Entitlement strings required to USE this tool (ENT-01). Absent/empty = free.
   *  Locked tools stay visible (badge) and route to the upsell panel (D-30).
   *  REPLACES the reserved `premium?: boolean` (zero call sites — verified). */
  requiredEntitlements?: string[];
  component: LazyComponent; // eager arm removed — all 11 entries are lazy (ENT-05)
}
```
**Recommendation (discretion area):** delete `premium?: boolean` — the research doc says `requiredEntitlements` "supplements/replaces" it, it has zero call sites, and keeping two paid-flags invites drift `[VERIFIED: grep — no usage outside types.ts]`.

### Override coercion (D-31) — mirror of coerceTreeStyle
```typescript
// src/shell/prefsStore.ts pattern [VERIFIED: coerceTreeStyle at prefsStore.ts:29]
/** Untrusted + DOWNGRADE-ONLY (D-31): accept exactly "free"; anything else → null. */
function coerceEntitlementsOverride(value: unknown): "free" | null {
  return value === "free" ? "free" : null;
}
// + add `entitlementsOverride: "free" | null` to Preferences, DEFAULT_PREFERENCES (null),
//   and the mergePreferences field list.
```

### Dist-grep build check (D-32)
```bash
# after pnpm build (vite output in dist/) — fails the phase gate if the DEV command leaks
if grep -R --include='*.js' -l "Toggle free tier" dist/assets/; then
  echo "FAIL: dev-only palette command present in production bundle" && exit 1
fi
```
`[VERIFIED precedent: import.meta.env.DEV guard at src/App.tsx:107 is the established stripped-in-prod mechanism]`

### Gated sidebar inputs (D-26)
```tsx
// src/components/Sidebar.tsx — partition inputs become entitlement-gated views
const ents = useEntitlements();
const orderingUnlocked = ents.has(ENT_ORDERING);
const { pinned, unpinned } = partitionTools(
  orderingUnlocked ? preferences.pinnedToolIds : [], // locked → pinned section hidden
  orderingUnlocked ? preferences.toolOrder : [],     // locked → registry-default order
  registryIds,
); // stored prefs untouched; unlock restores instantly [partitionTools VERIFIED pure]
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `premium?: boolean` reserved flag (v1.0) | `requiredEntitlements?: string[]` (data-driven, license-embeddable) | This phase (per licensing research) | Delete the boolean; one vocabulary across tool + app gates |
| Eager tool imports in registry | `LazyComponent` loaders + per-tool Vite chunks | This phase (ENT-05) | Future free-build decoder exclusion becomes a chunk-level decision |
| router.tsx comment: "Phase 2 wires code-split tools through React Router's route-level `lazy`" | Element-level gate + module-cached `React.lazy` | This phase | Comment is stale guidance — route-level lazy conflicts with reactive gating (Pitfall 1); update it |
| Theme/accent persisted, never applied | `gatePreferences` effective-view seam (D-27) | This phase | The gate exists before any theming UI does; 999.3 inherits it |

**Deprecated/outdated:** nothing external — all on pinned, current installed versions (react-router 7.16.0, React 19.2.6 resolved, vitest 4.1.7).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | react-router memoizes a route's `lazy()` result for the route lifetime (basis for rejecting route-level lazy) | Alternatives / Pitfall 1 | LOW risk to the plan either way: the element-level approach is independently justified by chunk-avoidance-when-locked; if RR re-ran lazy, route-level would still load locked chunks. Type evidence verified; runtime memoization from training knowledge. |
| A2 | Vite emits one chunk per `() => import(...)` tool and `decoder.ts` lands only in the protobuf chunk | Pattern 5 | If chunking differs (e.g. shared-module hoisting), ENT-05's seam still holds (loaders exist) but the exclusion story needs a `manualChunks` tweak; confirm via `pnpm build` chunk listing during execution. |
| A3 | All 11 tool components are default exports (verified for 2 of 11; the eager `import X from` form implies it for the rest) | Code Examples | A named-export tool would need `() => import("./X").then(m => ({ default: m.X }))` — trivial per-file fix at conversion time. |
| A4 | `Suspense fallback={null}` produces no perceptible blank on local-disk chunk loads in the packaged app | Pattern 5 / Pitfall 8 | If a blank is perceptible on the real WKWebView, add a minimal neutral skeleton — UI-gate verification catches it. |

## Open Questions

1. **Upsell-panel presentation for app-level locks (sidebar affordances / footer row)** — route content replacement is defined (D-30) but the panel's surface when opened FROM the sidebar (modal overlay vs navigating `<main>` to a panel view) is unspecified.
   - What we know: D-19 demands ONE shared component; the palette's dialog styling is the only existing overlay pattern.
   - What's unclear: modal vs in-main placement; focus-return behavior.
   - Recommendation: planner picks one (modal `role="dialog"` reusing palette scrim/dismiss patterns is lowest-risk for WCAG focus management) and bakes it into the plan; layout is final this phase (D-22) so decide once.
2. **"Buy license" CTA click behavior while stubbed (D-21)** — constant URL exists but Phase 20 owns the real link; opening external URLs from Tauri needs an opener path not yet in the platform seam.
   - What we know: CTA must render this phase; URL behind one constant.
   - Recommendation: render the button, no-op (or copy-URL) handler with the constant in place; defer browser-open plumbing to Phase 20 (which owns PAY-01's "opens in default browser").
3. **Browser/`vite preview` dev ergonomics under the free default** — criterion 3 makes plain-browser dev show locked ordering/pinning.
   - What we know: criterion is locked; primary dev loop is `tauri dev` (FULL default), so impact is limited to browser-only sessions.
   - Recommendation: accept as-specified; the DEV palette command can't upgrade (downgrade-only), so document that unlocked-UX work happens under `tauri dev` or via `setEntitlementsForTest` in jsdom.

## Environment Availability

Pure-frontend phase; all dependencies are already-installed workspace tooling (verified by the passing existing suite/build).

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pnpm + node toolchain | everything | ✓ | workspace-pinned | — |
| vitest | unit gate | ✓ | 4.1.7 | — |
| tsc | type gate | ✓ | ~5.8.3 | — |
| tauri CLI / WKWebView e2e harness (`scripts/e2e-spike.sh`, wdio) | UI gate + phase build | ✓ | existing, proven in v1.5 | — |

**Missing dependencies with no fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.7 (node env default; jsdom per-file via `// @vitest-environment jsdom`) + wdio real-WKWebView e2e |
| Config file | `vite.config.ts` (test block), `wdio.conf.ts` |
| Quick run command | `pnpm vitest run <file>` (verified: single-file run ~100ms) |
| Full suite command | `pnpm vitest run && pnpm tsc --noEmit` (lefthook pre-commit enforces both); e2e: `scripts/e2e-spike.sh` per memory |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENT-01 | `isToolLocked` predicate; locked fixture tool shows badge in sidebar/palette + upsell on route | unit (jsdom for components) | `pnpm vitest run src/lib/entitlements/entitlements.test.ts src/components/Sidebar.test.tsx src/components/CommandPalette.test.tsx` | ❌ Wave 0 (entitlements.test.ts new; component tests extended) |
| ENT-02 | `gatePreferences` forces defaults when `pro.theming`/`pro.ordering` absent; prefs untouched; sidebar renders default order + hidden pinned section under FREE_SET | unit | `pnpm vitest run src/lib/entitlements/entitlements.test.ts src/components/Sidebar.test.tsx` | ❌ Wave 0 |
| ENT-03 | `resolveEntitlements`: Tauri→FULL, browser→FREE, override "free" downgrades, never upgrades; coercer rejects junk; store notifies subscribers on refresh | unit | `pnpm vitest run src/lib/entitlements/resolve.test.ts src/shell/prefsStore.test.ts` | ❌ Wave 0 (resolve.test.ts new; prefsStore.test.ts extended) |
| ENT-04 | Locked tool visible + "— locked" accessible name; upsell panel renders heading/CTA/key-slot; locked affordances open panel (incl. Alt-chords); footer row free-tier-only | unit (jsdom) + e2e | jsdom files above + `test/e2e/entitlements.e2e.ts` (new) via `scripts/e2e-spike.sh` | ❌ Wave 0 |
| ENT-05 | All 11 entries are `LazyComponent`; every tool route still renders its tool; decoder bytes unchanged | unit + existing e2e + build | `pnpm vitest run` (registry/router tests) + existing `test/e2e/*.e2e.ts` full pass + `git diff --stat src/lib/protobuf/decoder.ts` empty + dist-grep check after `pnpm build` | ✅ existing e2e suite re-proves identical behavior; ❌ router/registry lazy assertions Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm vitest run <touched-area files>` + lefthook full `vitest run` + `tsc --noEmit` (pre-commit, non-negotiable)
- **Per wave merge:** full `pnpm vitest run && pnpm tsc --noEmit && pnpm lint`; real-WKWebView spot e2e for UI tasks
- **Phase gate:** full unit suite + ALL existing e2e specs green (criterion 4: behaves identically) + new entitlements e2e + `pnpm tauri build` + dist-grep + gsd-ui-review WCAG-AA audit + human walkthrough (proves everything-unlocked packaged default)

### Wave 0 Gaps
- [ ] `src/lib/entitlements/entitlements.test.ts` — vocabulary, `isEntitled`, `isToolLocked`, `gatePreferences` (ENT-01/02)
- [ ] `src/lib/entitlements/resolve.test.ts` — env split, downgrade-only override, store subscribe/refresh, test-seam guards (ENT-03)
- [ ] `src/components/UpsellPanel.test.tsx` — content, CTA constant, a11y roles (ENT-04)
- [ ] `test/e2e/entitlements.e2e.ts` — DEV toggle → locked sidebar UX → upsell → toggle back, on the real WKWebView (ENT-04; per memory, write + RUN via `scripts/e2e-spike.sh`)
- [ ] Extensions to existing `Sidebar.test.tsx`, `CommandPalette.test.tsx`, `prefsStore.test.ts` (note lefthook: land each test GREEN with its impl — no standalone RED commits)
- Framework install: none needed.

## Security Domain

Per the locked architecture: webview gating is **UX-gating, not DRM** — a patched binary unlocking customization is accepted (REQUIREMENTS.md binding constraints; licensing-research §Piracy realism `[CITED: docs/licensing-research.md:78–80]`). No network, no crypto, no secrets this phase.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (no auth this phase; license auth is Phase 19, Rust-owned) |
| V3 Session Management | no | — |
| V4 Access Control | yes (client-side feature gating only) | Single central gate (`isToolLocked`/`ents.has`) — fail direction: D-31 override is downgrade-only, so the only client-tamperable state can LOCK, never UNLOCK beyond the resolved set; Phase 19+ moves real authority to Rust |
| V5 Input Validation | yes | `coerceEntitlementsOverride` over the untrusted hand-editable prefs.json, following the existing T-02-08 coercer pattern; registry-name (never stored-string) rendering discipline already established in Sidebar announcements |
| V6 Cryptography | no | — (Ed25519 verification is Phase 19, `ed25519-dalek` in Rust — never hand-rolled, never in the webview) |

### Known Threat Patterns for this change

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Hand-edited prefs.json injects junk into `entitlementsOverride` | Tampering | Coercer accepts exactly `"free"`; anything else → `null` (full default path) — no crash, no phantom states |
| DEV toggle command leaking into production bundle | Elevation of surface | `import.meta.env.DEV` static strip + dist-grep build check (D-32) |
| `setEntitlementsForTest` reachable in production | Tampering | Guard with the same `MODE==="test" \|\| DEV` check as `setPlatformForTest` `[VERIFIED: platform/index.ts:135–150]` |
| Upsell URL constant later swapped by a tamperer | Tampering | Accepted (UX-gating posture); real purchase integrity lives server-side (Phase 20) |

## Sources

### Primary (HIGH confidence — verified in this session)
- Local codebase reads: `src/lib/tools/types.ts`, `src/lib/tools/registry.ts`, `src/router.tsx`, `src/shell/{preferences,usePreferences,prefsStore,toolOrder}.ts`, `src/components/{Sidebar,CommandPalette}.tsx`, `src/lib/platform/index.ts`, `src/App.tsx`, `src/main.tsx`, `vite.config.ts`, `lefthook.yml`, `package.json`, test/e2e inventory
- Installed types: `react-router` 7.16.0 dist d.ts (`lazy?: LazyRouteDefinition`, `LazyRouteFunction`/`LazyRouteObject`), `@types/react` (`React.lazy` signature), lucide-react `Lock` export
- `docs/licensing-research.md` §Entitlements design, §Piracy realism (the phase's architecture authority, as amended by D-18)
- `.planning/phases/18-entitlements-seam-central-gate/18-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`
- Project memory: tauri-store-async-init-race, verify-gate-builds-real-app, e2e-spike port gotchas, macOS Option-key composition, TDD-RED-blocked-by-lefthook

### Secondary (MEDIUM confidence)
- react-router route-level `lazy` runtime memoization behavior (training knowledge consistent with verified types) — see Assumption A1
- Vite per-dynamic-import chunking + dead-code elimination of `import.meta.env.DEV` branches (standard documented Vite behavior; in-repo precedent verified) — see Assumption A2

### Tertiary (LOW confidence)
- none

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new deps; every library verified against the installed workspace
- Architecture: HIGH — every seam read directly; the two design-shaping findings (no theming apply-site; isolated usePreferences instances) verified by grep
- Pitfalls: HIGH for codebase-derived ones (1–9 mostly verified); MEDIUM where they rest on A1/A2 runtime behaviors

**Research date:** 2026-06-10
**Valid until:** ~2026-07-10 (stable pinned deps; re-verify only if react-router/React versions are bumped)
