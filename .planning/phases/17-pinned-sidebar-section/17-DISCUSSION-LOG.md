# Phase 17: Pinned Sidebar Section - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-05
**Phase:** 17-pinned-sidebar-section
**Areas discussed:** Pin shortcut chord, Pin icon vs grip, Section header style, "Unpin all" placement

> Context note: this phase was largely locked at milestone definition
> (`/gsd-new-milestone`, 2026-06-05) — 8 key decisions + confirmed defaults already
> in `v1.5-ROADMAP.md`. Discussion targeted only the four specifics the milestone
> left open.

---

## Pin shortcut chord

| Option | Description | Selected |
|--------|-------------|----------|
| Alt+P | Same Alt-modifier family as v1.4 Alt+↑/↓ reorder, mnemonic, no conflict with ⌘K / Shift+F10 | ✓ |
| Alt+Shift+P | Avoids any Alt+P browser/OS mnemonic quirk; heavier three-key chord | |
| Plain P | Single keypress; breaks the project's "no single-key sidebar shortcut" model | |

**User's choice:** Alt+P
**Notes:** Fires while a sidebar row/handle is focused; announced via the existing `aria-live` region ("Pinned {tool}" / "Unpinned {tool}").

---

## Pin icon vs grip

| Option | Description | Selected |
|--------|-------------|----------|
| Left of grip + persistent on pinned | Pin icon left of grip; pinned rows show an always-visible filled pin; unpinned rows show outline pin on hover/focus only | ✓ |
| Left of grip, hover/focus only | Pin behaves like the grip (hidden until hover/focus) on all rows; pinned-ness signalled by section location only | |
| Pin icon rightmost, grip left | Swaps the established v1.4 grip position | |

**User's choice:** Left of grip + persistent on pinned
**Notes:** Grip stays outermost; NavLink right padding widens for two controls; neutral tokens (accent stays selected-only). Persistent filled pin doubles as the unpin click target, honoring the no-hover-only-action ethos.

---

## Section header style

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle "PINNED" label + divider | Muted uppercase micro-label doubling as the accessible group name | |
| Bare divider, no label | Neutral divider only; section identity from position; SR group named via aria-label | ✓ |

**User's choice:** Bare divider, no label
**Notes:** Preserves compact density; divider + group shown only when ≥1 tool pinned; group named for screen readers via `aria-label`.

---

## "Unpin all" placement

| Option | Description | Selected |
|--------|-------------|----------|
| Join the right-click menu | Second item beside "Reset order"; reuses the wired Shift+F10 keyboard entry | ✓ |
| Separate visible control | Always-visible footer button; more discoverable, adds permanent chrome | |

**User's choice:** Join the right-click menu
**Notes:** Shown only when ≥1 tool pinned; calls `setPinnedToolIds([])`.

---

## Claude's Discretion

- Exact pin glyph, filled/outline rendering, divider styling, aria-label wording + grouping element/role.
- Focus management after pin/unpin re-render (mirror v1.4 handle-refocus).
- Partition implementation detail (composing `pinnedToolIds` order with the unpinned `reconcileToolOrder` result), as long as output is a full registry partition reusing v1.4 helpers.
- Exact NavLink right-padding adjustment.

## Deferred Ideas

None new. Standing milestone deferrals: settings surface; auto-pin/lock-hero; cross-device sync.
