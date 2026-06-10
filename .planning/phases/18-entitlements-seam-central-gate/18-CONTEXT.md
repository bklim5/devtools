# Phase 18: Entitlements Seam & Central Gate - Context

**Gathered:** 2026-06-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Pure-frontend entitlement gating as ONE central, testable seam: `requiredEntitlements?: string[]` on `ToolDefinition` + an app-level entitlement map (theming, ordering/pinning), resolved through a single gate React consumes (Rust command inside Tauri; deterministic free-tier default in browser/jsdom). Lock badges + a shared upsell panel; all registry entries converted to lazy `component` loaders. The in-Tauri default resolves to **everything unlocked** until Phase 21 flips it — shipped behavior unchanged this phase. `decoder.ts` + its 19 tests byte-for-byte untouched.

</domain>

<decisions>
## Implementation Decisions

### ⚠️ D-18 FREE-TIER SCOPE PIVOT (supersedes ENT-04 as written)

**All 11 tools — including the Protobuf hero — stay free.** Pro locks **customization only**: theming + tool ordering/pinning, and Pro is the declared home for **future power features** (schema-aware Protobuf `.proto` support, DevTools CLI — both already "future paid candidates" in PROJECT.md/backlog).

- **Revises:** REQUIREMENTS.md ENT-04 ("free tier locks the Protobuf decoder…"), ROADMAP Phase 18 success criterion 1 and Phase 21 criterion 5, PROJECT.md free-tier lines, `docs/licensing-research.md` "Free tier locks" row. **Where those docs say the decoder is locked, this CONTEXT.md wins.** Update them before/during planning.
- **Tool-gating mechanism still ships in full** (ENT-01: `requiredEntitlements`, lock badge, upsell-panel-in-place-of-tool-UI) — proven via tests + the dev toggle, **dormant in production**: no shipped tool carries `requiredEntitlements` in the registry. How to exercise it (test-fixture tool entry vs dev-only set variant) is Claude's discretion.
- Rationale: the hero is the marketing wedge — locking it kills the free pitch; customization-as-Pro is low-resentment; future power features give the Pro tier real weight.

### Upsell panel
- **D-19:** ONE shared upsell panel component, parameterized by locked feature name/icon — used in place of any locked tool UI and by app-level lock surfaces. One WCAG-AA surface; Phases 19/20 wire into it.
- **D-20:** Content = short pitch: feature name + lock state, 1–2 lines on what a license unlocks, **no pricing** (pricing lives on the MoR page).
- **D-21:** "Buy license" CTA renders from Phase 18 behind a single URL constant, stubbed; Phase 20 swaps in the real MoR link.
- **D-22:** Secondary "I have a license key" affordance slot reserved (stub/no-op); Phase 19 wires activation. Panel layout is final from Phase 18.

### Lock badge
- **D-23:** Sidebar: small lucide `Lock` glyph at the row end (status-badge slot family); tool icon + name untouched. Same glyph in ⌘K palette result rows; selecting a locked tool still navigates (route shows the upsell panel).
- **D-24:** Badge color **neutral `tx-2`** — accent stays selection-only per app-wide discipline. Never amber/accent.
- **D-25:** SR: "locked" appended to the accessible name (e.g. "Protobuf Decoder — locked"); lock icon `aria-hidden`; no live-region announcements for static lock state.

### Locked-feature semantics (theming + ordering/pinning)
- **D-26:** Locked ordering/pinning → sidebar renders **registry-default order, pinned section hidden**; stored `toolOrder`/`pinnedToolIds` stay on disk untouched; unlocking restores the arrangement instantly. Never delete prefs on lock.
- **D-27:** Theming gates at the **prefs-apply seam**: locked → default theme/accent forced, stored values kept. (No theming UI exists today — `setTheme`/`setAccent` have zero call sites; the gate is real + testable now and the future 999.3 settings UI inherits it.)
- **D-28:** Locked reorder/pin affordances stay **visible with the neutral lock treatment**; invoking them (pointer or Alt+↑/↓ / Alt+P / Shift+F10 reset) opens the shared upsell panel. This is the primary Pro discovery path post-Phase-21.
- **D-29:** Standing **"Unlock Pro" entry: small, quiet, keyboard-reachable row at the sidebar footer**, shown in free tier only; opens the shared upsell panel. Natural future home for Phase 19's key entry + Phase 21's status UI.
- **D-30:** Locked-tool route behavior (dormant mechanism): startup resolution unchanged; opening a locked tool shows the upsell panel in place of the tool UI — never redirect away, never hide.

### Dev/test toggle
- **D-31:** **Downgrade-only** prefs override key (e.g. `entitlementsOverride: "free"`) read by the central gate, honored in all builds — it can only lock, never unlock (no new attack surface; gating is UX-gating, not DRM). Unit tests inject it; e2e sets the store; two-state only: free / full (the shipped free-tier set).
- **D-32:** Hidden ⌘K palette command ("Toggle free tier (dev)") registered **only under `import.meta.env.DEV`** → tree-shaken from production bundles; verified absent via a dist-grep build check. Locked UX is proven on dev/e2e; the packaged phase-boundary walkthrough proves the unchanged everything-unlocked default (criteria 3/4). Packaged free-tier proof lands at Phase 21's flip.

### Claude's Discretion
- Entitlement string vocabulary (e.g. `pro.theming`, `pro.ordering`) — one vocabulary across tool + app-level gates, embedded later in the Keygen license per research doc.
- Disposition of the reserved `premium?: boolean` field at `src/lib/tools/types.ts:52` (research: `requiredEntitlements` supplements/replaces it).
- How the dormant tool-gating path is exercised in tests (fixture tool entry vs dev set variant).
- Gate API shape (e.g. `useEntitlements()`), lazy-loader conversion mechanics (router comment already points at route-level `lazy`), loading-state UX during lazy chunk fetch.
- Exact upsell panel copy.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture (locked — do not re-litigate)
- `docs/licensing-research.md` — full v1.6 architecture: Keygen, Ed25519 `machine.lic`, Rust command surface, entitlements design (§Entitlements design names the exact seam this phase builds). NOTE: its "Free tier locks" row is superseded by D-18.
- `.planning/REQUIREMENTS.md` — ENT-01..05 (ENT-04 free-tier set superseded by D-18; mechanism requirement stands).
- `.planning/ROADMAP.md` — Phase 18 detail + success criteria (criterion 1's "Protobuf… lock badge" now demonstrates the dormant mechanism under the dev toggle, not shipped free-tier behavior).

### Code seams this phase touches
- `src/lib/tools/types.ts` — `LazyComponent` union at :42 (currently unused), reserved `premium?` at :52.
- `src/lib/tools/registry.ts` — 11 eager tool imports to convert to lazy loaders; `ENABLED_TOOLS` single control plane.
- `src/router.tsx` — renders `component as ComponentType`; comment anticipates React Router route-level `lazy`.
- `src/shell/preferences.ts` / `src/shell/usePreferences.ts` / `src/shell/prefsStore.ts` — prefs seam (theme/accent defaults at preferences.ts:50–51; `toolOrder`/`pinnedToolIds` overlays; where D-26/D-27 enforcement lands).
- `src/components/Sidebar.tsx` — rows with pin icon + grip + reorder affordances (D-23/D-28/D-29 surfaces).
- `src/components/CommandPalette.tsx` — palette rows (D-23) + DEV-only toggle command (D-32).
- `src/lib/platform/index.ts` — platform capability seam; pattern for the Tauri-vs-browser entitlement resolution split (ENT-03).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `LazyComponent` type already in the union — lazification is wiring, not type design.
- `premium?: boolean` reserved seam — explicitly placed for this milestone.
- Platform seam (`src/lib/platform/`) — established Tauri-vs-browser detection + lazy-import pattern to copy for the entitlement resolver (in-Tauri Rust command later; browser/jsdom deterministic free-tier default).
- Neutral-token + accent-is-selection-only visual discipline; status-badge slot in sidebar rows; existing `aria-live` + keyboard patterns (D-17 model) — lock UI composes with these, doesn't fight them.
- Prefs coercers (`coerceToolOrder`, `coercePinnedToolIds`, `normalizeRecents`) — pattern for coercing the `entitlementsOverride` key from untrusted store data.

### Established Patterns
- Registry = single control plane (sidebar/palette/router derive) — entitlement gating must derive from it too, no scattered checks (ENT-01).
- Render-time overlays for personalization (`toolOrder`, `pinnedToolIds`) — D-26's "revert render, keep prefs" is the same shape: entitlements are a render-time filter, never a prefs mutation.
- Tauri store async-init race (see memory): entitlement resolution via command invocation (not the JS store) sidesteps it — but the D-31 override key lives in prefs, so verify its read path on the real WKWebView.

### Integration Points
- Router children generation (`ENABLED_TOOLS.map`) — lazy route conversion + locked-route upsell rendering.
- Sidebar row render + Shift+F10 menu — lock treatment + invoke-upsell hooks (D-28) + footer "Unlock Pro" row (D-29).
- Palette command list — lock glyph + accessible name suffix + DEV toggle command.
- `usePreferences` apply path — theming/order/pin enforcement point (D-26/D-27).

</code_context>

<specifics>
## Specific Ideas

- Free-tier pivot rationale in the user's words: "releasing all the tools for free, the licensing will be mainly for other configuration/customization (eg: theming and reordering)".
- User asked explicitly that the dev toggle command be verifiably absent from the final app bundle (D-32 dist-grep check).
- Pro/license entry should also appear in the future settings UI (next milestone — see Deferred).

</specifics>

<deferred>
## Deferred Ideas

- **Settings UI hosting the Pro/license entry** — user: the "Unlock Pro"/license surface should also live in a settings UI in the **next milestone** (pairs with theme settings backlog 999.3 and the long-deferred settings surface).
- **Future Pro power features** — schema-aware Protobuf (backlog 999.5) and DevTools CLI (999.4) as paid features under the D-18 model; promote via backlog review, not this milestone.

</deferred>

---

*Phase: 18-entitlements-seam-central-gate*
*Context gathered: 2026-06-10*
