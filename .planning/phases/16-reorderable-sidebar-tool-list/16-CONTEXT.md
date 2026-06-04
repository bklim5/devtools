# Phase 16: Reorderable Sidebar Tool List - Context

**Gathered:** 2026-06-04 (as backlog item 999.6; promoted into milestone v1.4 as Phase 16 on 2026-06-04)
**Status:** Ready for planning
**Requirements:** REORD-01..07

<domain>
## Phase Boundary

Let the user reorder the sidebar's tool list and have that order persist across launches, so frequently-used tools can sit at the top instead of the fixed registry order. Scope is the **sidebar render order only** — the ⌘K palette and router stay order-agnostic. This phase clarifies HOW reordering behaves (drag affordance, keyboard path, persistence, new-tool handling); adjacent capabilities (pinning, a settings surface) are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Drag interaction
- **D-01:** Drag starts **only from an explicit grip/handle** that appears on row hover **and** keyboard focus — NOT grab-anywhere. A plain click still navigates via the existing `NavLink`, so switching tools can never trigger an accidental drag. The handle is the focusable reorder control.
- **D-02:** Native drag implementation (HTML5 drag events or a small pure pointer handler) — **zero new runtime deps, no dnd library** (carried-forward project constraint).
- **D-03 (drop feedback):** Show an **insertion-line** indicator between rows during a drag. Exact styling is Claude's discretion, but it must respect the project's **accent = selected-only** rule — use a neutral/subtle indicator, not the active-accent color.

### Keyboard reorder (WCAG-AA — mandatory, not optional)
- **D-04:** Keyboard users reorder with **Alt+↑ / Alt+↓** while a tool (its handle/row) is focused — one slot per press. Chosen over a reorder-mode toggle and over per-row move up/down buttons (less clutter in the compact sidebar, no stateful mode).
- **D-05:** Do **NOT** introduce a roving arrow-key navigation system — plain ↑/↓ stay unbound in the sidebar, preserving the existing **D-03 "pointer + Tab focus only"** model from Phase 2 (`Sidebar.tsx`). Only **Alt+arrow** is consumed.
- **D-06:** Each move is announced through an **`aria-live="polite"`** region, e.g. "Moved Cron to position 3 of 11", so reordering is perceivable without sight; visible focus stays on the moved item.

### Reorder scope
- **D-07:** **All 11 tools are freely movable in a single flat list** — no special-casing, no pinned items. The default (unconfigured) order still ships **hero-first** (Protobuf), matching today's registry order.
- **D-08:** **Pinning** (locking the Protobuf hero to the top, or pinning favourites) is **explicitly OUT OF SCOPE** — the user wants it as its own separate feature. See Deferred Ideas.

### Persistence & new-tool handling
- **D-09:** Order persists as a new **`toolOrder: string[]`** (array of tool IDs) field on `Preferences`, written through the existing `usePreferences` / `platform.store` seam — the **same mechanism as `recentToolIds`** and a single schema edit (the preferences schema is explicitly designed for this kind of additive field). No new dep, fully offline.
- **D-10:** Ordering is a **presentation overlay** applied over `ENABLED_TOOLS` at sidebar render time — the **registry array stays the canonical source of truth** (registry = single control plane). The ⌘K palette and router remain unchanged/order-agnostic.
- **D-11 (reconciliation on load):** Reconcile the saved `toolOrder` against the live registry every load:
  - registry IDs present in `toolOrder` → render in saved order;
  - registry IDs **absent** from `toolOrder` (tools shipped in a later app version) → **appended to the bottom** in registry order;
  - IDs in `toolOrder` no longer in the registry → ignored.
  This makes a custom order survive app updates while new tools appear at the end (present, non-disruptive).
- **D-12 (reset):** A **"Reset order"** affordance restores the default registry order (clears/repopulates `toolOrder`). Recommended placement: a **right-click context menu on the sidebar**; exact placement/label refined at plan time (could later live in a settings surface if one is built).

### Claude's Discretion
- Exact drop-indicator visual, drag-ghost styling, and the precise reset-control placement/label/interaction.
- Whether the grip handle is a dedicated element or the row itself becomes draggable from a handle hit-area — as long as plain-click navigation is preserved (D-01).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs or ADRs — requirements are fully captured in the decisions above. The authoritative *code* references are listed under "Existing Code Insights" below (they are the integration contract, not external docs).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/shell/preferences.ts`** — the `Preferences` interface + `DEFAULT_PREFERENCES`. Add `toolOrder: string[]` here (default `[]`); the schema header explicitly anticipates additive fields. `recentToolIds: string[]` is the exact precedent for a string-array-of-tool-IDs field.
- **`src/shell/usePreferences.ts`** — typed hook over the store seam with write-on-change persistence; add a `setToolOrder` setter mirroring `setLastUsedId` (one `update({ toolOrder })` line). Honors `prefsLoaded` so the sidebar can avoid a flash before the saved order resolves.
- **`src/lib/platform/`** — the `platform.store` seam (tauri.ts / browser.ts / stub.ts). Persistence routes through here; tools never import `@tauri-apps/*` directly.
- **`src/components/Sidebar.tsx`** — currently a pure `ENABLED_TOOLS.map(...)` projection; this is where the ordered overlay (D-10) and the grip handle / `aria-live` region get added.
- **`src/lib/tools/registry.ts`** — `TOOLS` / `ENABLED_TOOLS` / `getToolById`; the canonical order and source of truth that the overlay is layered over.

### Established Patterns
- **Registry-as-projection:** sidebar, palette, router all derive from `ENABLED_TOOLS` — the new order is a render-time overlay, never a mutation of the registry array.
- **Write-on-change persistence** through one namespaced prefs blob (`PREFERENCES_STORE_KEY`), merged field-by-field — adding `toolOrder` is atomic with the rest.
- **Accent = selected-only**, compact density, visible `focus-visible:ring-accent` Tab focus — the reorder UI must honor these.
- **D-03 keyboard model:** sidebar is pointer + Tab focus only (no arrow/j-k nav, no ⌘1..n); the Alt+arrow reorder (D-04/D-05) is deliberately additive and non-conflicting.

### Integration Points
- `Sidebar.tsx` render maps over an **ordered** projection of `ENABLED_TOOLS` (apply `toolOrder` + D-11 reconciliation), adds a per-row grip handle and an `aria-live` status region.
- `usePreferences` gains `setToolOrder`; `preferences.ts` gains the field + default.
- A reset action (D-12) wired to clear `toolOrder` back to default.

</code_context>

<specifics>
## Specific Ideas

- Keyboard reorder explicitly modelled as **Alt+↑/↓** (not a mode, not buttons) with a spoken position announcement ("Moved {tool} to position N of M").
- Drag is **handle-initiated** specifically to protect the click-to-navigate interaction.

</specifics>

<deferred>
## Deferred Ideas

- **Pinning tools** (lock the Protobuf hero to the top, or pin favourites above the reorderable list) — the user explicitly wants this as **its own separate feature/phase**, not folded into reorder. Capture as a future backlog item if pursued.
- **A dedicated settings/preferences surface** — there isn't one today (prefs are per-tool/implicit); if the reset control or future appearance settings want a home, that surface is its own effort.

</deferred>

---

*Phase: 999.6-add-the-capability-to-drag-and-drop-to-reorder-the-tool-list*
*Context gathered: 2026-06-04*
