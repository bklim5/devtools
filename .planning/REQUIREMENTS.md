# Requirements: v1.5 Pinned Tools

**Milestone goal:** Let users pin favourite tools to a distinct, reorderable "Pinned" section at the top of the sidebar — so the tools they reach for most sit above the rest, independent of the v1.4 custom order.

**Source:** Promoted from the v1.4 carry-forward "Pinning" future requirement (split out 2026-06-04). Design confirmed via `/gsd-new-milestone` questioning, 2026-06-05.

**Binding constraints (inherited wedge):** offline/no-network · keyboard-driven · **registry is the single control plane** (pinning is a render-time presentation overlay; ⌘K palette + router stay pin-agnostic) · WCAG-AA (keyboard path + `aria-live` mandatory) · **zero new runtime AND dev dependencies** · `src/lib/protobuf/decoder.ts` + its 19 tests stay byte-for-byte untouched · macOS real-WKWebView UI gate. **Native-OS drag is manual-walkthrough coverage** — WebDriver can't synthesize it (see v1.4 post-ship fix; `dragDropEnabled:false` already set).

**Builds on v1.4:** reuses the `toolOrder`/`recentToolIds` prefs seam, `reconcileToolOrder`/`moveToolInOrder` ordering helpers, the grip-handle drag + Alt+↑/↓ keyboard reorder, and the `aria-live` announcement pattern.

---

## v1 Requirements

### Pinning (PIN)

- [ ] **PIN-01**: User can pin a tool, moving it into a distinct "Pinned" section at the top of the sidebar.
- [ ] **PIN-02**: User can unpin a pinned tool, returning it to the main (unpinned) list.
- [ ] **PIN-03**: The "Pinned" section is shown only when at least one tool is pinned, with a clear divider separating it from the rest of the list.
- [ ] **PIN-04**: User can pin/unpin a tool via a pin icon on its sidebar row, visible on hover and when the row is keyboard-focused (mirroring the v1.4 grip handle).
- [ ] **PIN-05**: User can pin/unpin the keyboard-focused tool via a dedicated shortcut, with the action announced via an `aria-live` region (e.g. "Pinned Hash" / "Unpinned Hash"). (WCAG-AA.)
- [ ] **PIN-06**: User can reorder tools within the pinned section and within the unpinned list independently (drag + Alt+↑/↓ from v1.4); a tool changes membership only by pinning/unpinning, never by dragging across the pinned↔unpinned boundary.
- [ ] **PIN-07**: The user's pinned set persists across app restarts (stored as a `pinnedToolIds` array of tool IDs via the existing preferences/store seam; the registry stays the canonical source).
- [ ] **PIN-08**: A pinned set referencing an unknown or removed tool ID degrades gracefully on load — unknown IDs dropped, duplicates collapsed (no crash, no missing or duplicated tools).
- [ ] **PIN-09**: User can unpin all tools at once via a keyboard-reachable "Unpin all" control (alongside the existing "Reset order").

---

## Future Requirements (deferred — carried forward, not promised)

- **Settings surface** — a dedicated preferences/appearance screen that would give "Reset order", "Unpin all", theme, and accent a single home. None exists today; explicitly deferred (user decision, 2026-06-05) — pinning ships first.
- **Auto-pin / lock the hero** — automatically pinning (or locking) the Protobuf hero to the top by default. Not in this milestone (default is no tool pinned).

---

## Out of Scope (held)

- **Pinning affecting the ⌘K command palette or routing** — only the sidebar render order changes; palette and router stay pin-/order-agnostic.
- **Dragging tools across the pinned↔unpinned boundary** — membership changes via pin/unpin only; the boundary is fixed during drag.
- **A dnd/animation library** — zero-new-runtime-deps held; native drag events only (as in v1.4).
- **Cross-device pin sync** — local-only, offline.
- **A dedicated settings surface** — deferred (see Future Requirements).

> **Note — deliberate evolution of a v1.4 out-of-scope line:** v1.4 held "no grouping/sections in the sidebar (list stays flat)". v1.5 intentionally introduces exactly one section (the "Pinned" group above the rest). This is the scoped exception, not a general grouping/folders feature.

---

## Traceability

| Requirement | Phase | Plan | Status |
|-------------|-------|------|--------|
| PIN-01 | Phase 17 | 17-02 | ⬜ Pending |
| PIN-02 | Phase 17 | 17-02 | ⬜ Pending |
| PIN-03 | Phase 17 | 17-02 | ⬜ Pending |
| PIN-04 | Phase 17 | 17-02 | ⬜ Pending |
| PIN-05 | Phase 17 | 17-02 | ⬜ Pending |
| PIN-06 | Phase 17 | 17-02 | ⬜ Pending |
| PIN-07 | Phase 17 | 17-01 | ⬜ Pending |
| PIN-08 | Phase 17 | 17-01 | ⬜ Pending |
| PIN-09 | Phase 17 | 17-02 | ⬜ Pending |

*Phase/plan columns filled by the roadmapper.*
