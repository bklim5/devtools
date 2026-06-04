# Requirements: v1.4 Reorderable Tools

**Milestone goal:** Let users reorder the sidebar tool list — by drag-and-drop and by an accessible keyboard path — with the order persisted, so frequently-used tools sit at the top instead of the fixed registry order.

**Source:** Promoted from backlog 999.6; design decisions captured in `999.6-CONTEXT.md` (12 decisions, discussed 2026-06-04).

**Binding constraints (inherited wedge):** offline/no-network · keyboard-driven · registry is the single control plane · WCAG-AA · **zero new runtime dependencies** · `src/lib/protobuf/decoder.ts` + its 19 tests stay byte-for-byte untouched · macOS real-WKWebView UI gate applies (this is a UI feature).

---

## v1 Requirements

### Tool Reordering (REORD)

- [ ] **REORD-01**: User can drag a sidebar tool (via a grip handle shown on hover/focus) to a new position, with a clear drop indicator showing where it will land. Native drag (no dnd library).
- [ ] **REORD-02**: A plain click on a tool still navigates to that tool — dragging never triggers from a normal click (drag is handle-initiated).
- [ ] **REORD-03**: User can reorder a keyboard-focused tool with `Alt+↑` / `Alt+↓`, moving it one slot per press, without introducing a roving arrow-key navigation system (plain arrows stay unbound in the sidebar).
- [ ] **REORD-04**: Each reorder is announced to assistive technology via an `aria-live` region (e.g. "Moved Cron to position 3 of 11"), and the moved tool retains keyboard focus. (WCAG-AA.)
- [ ] **REORD-05**: The user's custom tool order persists across app restarts (stored as a `toolOrder` array of tool IDs via the existing preferences/store seam; the registry stays the canonical source).
- [ ] **REORD-06**: A tool shipped in a later app version appears at the bottom of an existing custom order; an order referencing an unknown or removed tool ID degrades gracefully (no crash, no missing or duplicated tools).
- [ ] **REORD-07**: User can reset the sidebar to the default (registry) order.

---

## Future Requirements (deferred)

- **Pinning** — locking the Protobuf hero to the top, or pinning favourite tools above the reorderable list. Explicitly split out as its own future feature (user decision, 2026-06-04).
- **Settings surface** — a dedicated preferences/appearance screen (would give the "Reset order" control and future appearance settings a home). None exists today; out of scope for this milestone.

---

## Out of Scope

- **Reordering the ⌘K command palette or affecting routing** — only the sidebar render order changes; palette and router stay order-agnostic.
- **Grouping/sections in the sidebar** — the list stays flat.
- **A dnd/animation library** — zero-new-runtime-deps holds; native drag events or a small pure handler only.
- **Cross-device order sync** — local-only, offline.

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| REORD-01 | TBD | Pending |
| REORD-02 | TBD | Pending |
| REORD-03 | TBD | Pending |
| REORD-04 | TBD | Pending |
| REORD-05 | TBD | Pending |
| REORD-06 | TBD | Pending |
| REORD-07 | TBD | Pending |

*(Phase column filled by the roadmapper.)*
