# Phase 17: Pinned Sidebar Section - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning
**Requirements:** PIN-01..09

<domain>
## Phase Boundary

Let a user pin favourite tools into a distinct, independently-reorderable "Pinned"
group at the top of the sidebar — via a row pin icon or a keyboard shortcut — and
have that pinned set persist across restarts. Pinning is a **render-time
presentation overlay** (a `pinnedToolIds: string[]` field) reconciled against the
live registry on load; the registry stays the single control plane (the ⌘K palette
and router stay pin-agnostic). Scope is the **sidebar render only**.

This discussion clarifies HOW the four open specifics behave (the pin shortcut
chord, the pin-icon affordance, the section divider, and the "Unpin all"
placement). Everything else was locked at milestone definition (`/gsd-new-milestone`,
2026-06-05) and is restated below as carried-forward, not re-litigated. Out of
scope (deferred): a settings surface, auto-pin/lock-hero, cross-device sync,
dragging across the pinned↔unpinned boundary, any dnd/animation library.

</domain>

<decisions>
## Implementation Decisions

### Carried forward from milestone definition (LOCKED — do not re-litigate)
- **Render-time overlay, full partition:** pinning is an overlay over `ENABLED_TOOLS`,
  never a registry mutation. The reconciled tool list is partitioned into a pinned
  group + an unpinned remainder; **every registry tool renders in exactly one group**
  (extends v1.4 D-10/D-11). Unknown/removed pinned IDs drop, duplicates collapse —
  the list can never crash, drop, or duplicate a tool (PIN-08).
- **Persistence:** additive `pinnedToolIds: string[]` on `Preferences`, written
  through the existing `usePreferences`/`platform.store` seam beside `toolOrder`,
  write-on-change. A dedicated `coercePinnedToolIds` (string-only, de-dupe,
  non-array → `[]`, **no length cap**) mirrors `coerceToolOrder` for the untrusted,
  hand-editable prefs blob (PIN-07).
- **Pin affordance mirrors the v1.4 grip handle:** hover + `focus-visible` reveal,
  neutral tokens — accent stays selected-only; a plain `NavLink` click still
  navigates (PIN-04).
- **Membership changes via pin/unpin only:** the v1.4 drag + Alt+↑/↓ reorder runs
  **independently within each group**; a tool never crosses the pinned↔unpinned
  boundary by dragging (PIN-06).
- **No tool pinned by default** — empty pinned set ⇒ no divider, no group; the hero
  is NOT auto-pinned. Pinning **appends to the bottom** of the pinned group.
- **Pinned group order** is carried by the `pinnedToolIds` array order itself
  (append-on-pin); the unpinned remainder keeps the v1.4 per-group order via
  `reconcileToolOrder`/`moveToolInOrder`. (Implementation detail of the partition —
  exact wiring is planner/Claude discretion, but no second persisted order array is
  introduced unless the planner finds it necessary.)

### Pin/unpin keyboard shortcut
- **D-13:** The dedicated pin/unpin shortcut is **Alt+P**, fired while a sidebar
  row / its handle is focused. Chosen for being in the same Alt-modifier family as
  the v1.4 Alt+↑/↓ reorder keys, mnemonic ("Pin"), and free of conflict with ⌘K
  (palette), Shift+F10 / ContextMenu (reset menu), and Escape. **Plain single-key
  ('P') was rejected** — it breaks the project's established "no single-key sidebar
  shortcut" model (D-03/D-05 from Phase 2/16). Every pin/unpin (icon or Alt+P) is
  announced through the existing visually-hidden `aria-live="polite"` region using
  the registry-controlled `tool.name` — "Pinned {tool}" / "Unpinned {tool}" (PIN-05).

### Pin-icon affordance
- **D-14:** The pin icon sits **to the left of the existing grip handle** on the
  row's right edge (grip stays outermost, preserving its v1.4 position).
  - **Pinned rows show a persistent, always-visible *filled* pin** — it signals
    pinned state and is the click target to unpin (no hover-hunting; respects the
    project's "no hover-only copy/affordance" ethos for the primary unpin path).
  - **Unpinned rows show an *outline* pin on hover + `focus-visible` only**,
    mirroring the grip handle's reveal.
  - Neutral tokens throughout — accent stays selected-only. The `NavLink` right
    padding widens to clear **two** stacked controls (pin + grip).

### "Pinned" section presentation
- **D-15:** The pinned group is marked off by a **bare neutral divider line only —
  no visible "PINNED" text label**. Section identity comes from position + divider,
  keeping the compact/minimal density. The group is named for screen readers via an
  **`aria-label`** on a grouping element (e.g. a labelled `role="group"` / nav
  region, "Pinned tools") with no visible text. Divider + group appear **only when
  ≥1 tool is pinned** and disappear entirely when the last tool is unpinned (PIN-03).

### "Unpin all" placement
- **D-16:** **"Unpin all" joins the existing right-click "Reset order" context
  menu** as a second menu item, reusing the already-wired Shift+F10 / ContextMenu
  keyboard entry point (keyboard-reachable per PIN-09 — no new always-visible
  chrome). Shown only when ≥1 tool is pinned; calls `setPinnedToolIds([])`,
  collapsing the section back to the flat list.

### Claude's Discretion
- Exact pin glyph (e.g. lucide `Pin` / `PinOff`), filled-vs-outline rendering,
  divider styling, and exact `aria-label` wording / grouping element + role.
- Precise focus management after a pin/unpin re-render (mirror the v1.4
  `focusAfterMove`/handle-refocus approach).
- The partition implementation detail (how `pinnedToolIds` order and the unpinned
  `reconcileToolOrder` result compose into the two render groups), as long as the
  output is always a full registry partition (every tool once) and reuses the v1.4
  helpers rather than re-implementing reconciliation.
- Exact `NavLink` right-padding adjustment to clear the two controls.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs or ADRs — requirements are fully captured in the decisions above
and in the milestone docs. The authoritative requirement + design docs and the
*code* integration contract are:

### Requirements & milestone design
- `.planning/REQUIREMENTS.md` — PIN-01..09, binding constraints, out-of-scope list.
- `.planning/milestones/v1.5-ROADMAP.md` — Phase 17 goal, 2-plan split (17-01
  backbone / 17-02 UI), success criteria, verification notes, key decisions.
- `.planning/milestones/v1.4-phases/16-reorderable-sidebar-tool-list/16-CONTEXT.md`
  — the v1.4 design (D-01..D-12) this milestone extends.

### Code integration contract (the reuse surface)
- `src/components/Sidebar.tsx` — the v1.4 reorderable sidebar; pin group, pin icon,
  Alt+P handler, divider, and the "Unpin all" menu item all land here. Holds the
  existing grip handle, `aria-live` region, and right-click reset menu to extend.
- `src/shell/toolOrder.ts` — `reconcileToolOrder` / `moveToolInOrder` (pure, tested);
  reused for the per-group order and as the pattern for `coercePinnedToolIds` +
  the pure partition backbone (Plan 17-01).
- `src/shell/preferences.ts` — `Preferences` + `DEFAULT_PREFERENCES`; add
  `pinnedToolIds: string[]` (default `[]`). `toolOrder` is the exact precedent.
- `src/shell/usePreferences.ts` — add `setPinnedToolIds` + `togglePinned`, mirroring
  `setToolOrder`.
- `src/lib/tools/registry.ts` — `ENABLED_TOOLS` / `getToolById`; the canonical
  source the partition is layered over.
- `src/lib/platform/` — the `platform.store` seam (persistence routes through here;
  never import `@tauri-apps/*` directly).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`reconcileToolOrder` / `moveToolInOrder`** (`src/shell/toolOrder.ts`) — pure,
  untrusted-safe ordering helpers reused directly for per-group order; `coerceToolOrder`
  is the template for `coercePinnedToolIds`.
- **`Sidebar.tsx` machinery** — grip handle (hover + `focus-visible`), the
  `announce`/`aria-live="polite"` region, the keyboard-reachable right-click
  reset-menu (Shift+F10 entry, focus-restore, click-away/Escape dismiss), and the
  `focusAfterMoveRef` re-focus pattern all extend to pinning with no new deps.
- **`usePreferences`** — write-on-change setters (`setToolOrder` precedent);
  `prefsLoaded` gate avoids a pre-load flash.

### Established Patterns
- **Registry-as-projection:** sidebar/palette/router derive from `ENABLED_TOOLS`;
  pinning is a render overlay, registry untouched (single control plane).
- **Accent = selected-only; neutral tokens for affordances; no hover-only primary
  action** — the persistent filled pin on pinned rows (D-14) honors this.
- **Sidebar keyboard model:** pointer + Tab focus only, modifier chords for
  actions (Alt+arrow, Shift+F10) — Alt+P (D-13) is consistent and non-conflicting.

### Integration Points
- `Sidebar.tsx` renders two projected groups (pinned + unpinned remainder) from the
  Plan 17-01 partition; adds the pin icon per row, the Alt+P handler, the divider +
  SR-labelled group, and the "Unpin all" menu item beside "Reset order".
- `preferences.ts` gains `pinnedToolIds`; `usePreferences` gains
  `setPinnedToolIds` + `togglePinned`.

</code_context>

<specifics>
## Specific Ideas

- Pin shortcut modelled explicitly as **Alt+P** (same family as Alt+↑/↓), announced
  "Pinned {tool}" / "Unpinned {tool}" via the existing `aria-live` region.
- Pinned rows carry a **persistent filled pin** as both state indicator and unpin
  target — deliberately not hover-only, matching the project's no-hover-only ethos.
- The section is intentionally **label-less** (divider only) to preserve the compact
  density, with SR identity supplied by `aria-label`.

</specifics>

<deferred>
## Deferred Ideas

None new surfaced during discussion. Standing deferrals (from milestone): a
dedicated settings/preferences surface; auto-pin / lock-the-hero; cross-device pin
sync. All explicitly out of scope for v1.5.

</deferred>

---

*Phase: 17-pinned-sidebar-section*
*Context gathered: 2026-06-05*
