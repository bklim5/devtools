# Phase 999.6: Drag-and-drop reorder the tool list - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-04
**Phase:** 999.6-add-the-capability-to-drag-and-drop-to-reorder-the-tool-list
**Areas discussed:** Keyboard reorder mechanism, Drag affordance, Reorder scope, New-tool placement & reset

---

## Keyboard reorder mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Alt+↑/↓ on focused item | Tab to a tool, Alt+↑/↓ moves one slot; aria-live announces the move; no new nav mode, no conflict with plain arrows | ✓ |
| Reorder-mode toggle, then ↑/↓ | Explicit toggle puts the list in a mode where plain ↑/↓ move the focused item; Esc/Enter exits | |
| Move up / down buttons | Two small per-row buttons (on hover+focus); most discoverable but most clutter | |

**User's choice:** Alt+↑/↓ on focused item
**Notes:** Preserves the existing D-03 "Tab focus only" sidebar model — plain arrows stay unbound; only Alt+arrow is consumed. Move announced via aria-live.

---

## Drag affordance

| Option | Description | Selected |
|--------|-------------|----------|
| Grip handle on hover+focus | Grip icon appears on the row; drag starts only from the handle; plain click still navigates | ✓ |
| Grab anywhere on the row | Press-and-drag anywhere; simpler but risks accidental drags vs click-to-navigate | |

**User's choice:** Grip handle on hover+focus
**Notes:** Chosen to protect the click-to-switch-tool interaction from accidental drags.

---

## Reorder scope

| Option | Description | Selected |
|--------|-------------|----------|
| All tools freely, flat list | Any of the 11 tools move anywhere; default order still hero-first | ✓ |
| Protobuf hero pinned to top | Hero locked at top, other 10 reorder beneath | |

**User's choice:** All tools freely movable (flat list)
**Notes:** User explicitly added that **pinning is a good idea but should be a separate feature by itself** → recorded as a Deferred Idea, not folded into this phase.

---

## New-tool placement & reset

| Option | Description | Selected |
|--------|-------------|----------|
| Append to the bottom | Custom order respected; unknown (newly-shipped) tool IDs land at the end | ✓ |
| Insert at registry position | New tool interleaved at its registry index; more canonical but can bury it | |
| Append to the top | New tools surface at top; most visible but disrupts a curated order | |

**User's choice:** Append to the bottom
**Notes:** Reset-to-default order offered via a right-click context menu on the sidebar (exact placement refined at plan time).

---

## Claude's Discretion

- Exact drop-indicator visual, drag-ghost styling, reset-control placement/label.

## Deferred Ideas

- Pinning tools (lock hero to top / pin favourites) — its own feature/phase, per user.
- A dedicated settings surface to host the reset control / future appearance settings — none exists today.
