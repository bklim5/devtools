# Phase 22: Settings Modal Shell, Entry Points & License Pane - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-15
**Phase:** 22-settings-modal-shell
**Areas discussed:** Pane nav layout, Modal size & dismissal, Route migration, Sidebar entry + footer

---

## Pane nav layout

| Option | Description | Selected |
|--------|-------------|----------|
| Left nav list (Claude #9) | Vertical pane list left, content right; scales to 5 panes | ✓ |
| Top tab bar (DevUtils #4) | Horizontal tabs across the top | |

**User's choice:** Left nav list. **Notes:** Phase 22 list shows only License; later phases append.

---

## Modal size & dismissal

| Option | Description | Selected |
|--------|-------------|----------|
| Centered + dimmed, Esc/backdrop | Large centered modal over dimmed backdrop; close on Esc + backdrop click | ✓ |
| Full-window overlay, Esc/backdrop | Near-full-window overlay | |
| Centered, Esc only | Centered, no backdrop-click close | |

**User's choice:** Centered + dimmed backdrop, close on Esc AND backdrop click.

---

## Route migration

| Option | Description | Selected |
|--------|-------------|----------|
| Modal supersedes | Modal is the single surface; re-point D-88; `#/settings/license` → deep-link opening the modal on the License pane | ✓ |
| Keep both | Standalone route + modal (duplicate surfaces) | |

**User's choice:** Modal supersedes; `LicenseSettings` rendered unchanged inside the modal pane.

---

## Sidebar entry + footer

| Option | Description | Selected |
|--------|-------------|----------|
| Settings row + attention→License pane | Gear Settings row; D-88 attention opens Settings on License pane | ✓ (refined) |
| Settings row only | Add Settings row; leave D-88 routing unchanged | |

**User's choice + refinement:** Settings row + attention→License pane, with footer ordering top→bottom = **[Unlock Pro / License-needs-attention]** then **[⚙ Settings]** anchored at the very bottom.

### Clarification — "locked"

| Option | Description | Selected |
|--------|-------------|----------|
| Anchored to bottom | Position-locked/sticky at the bottom; opens for everyone (consistent with SET-04) | ✓ |
| Pro-gated (lock badge) | Settings Pro-gated (would conflict with SET-04) | |

**User's choice:** Anchored to bottom; Settings opens for everyone incl. unlicensed.

## Claude's Discretion

- `settingsStore` shape (mirror `upsellStore`), pane-registry structure (extensible for Phases 23–25), left-list keyboard model details, gear icon choice, modal dimensions within "large centered".

## Deferred Ideas

- Appearance/Hotkeys/General/Updates panes → Phases 23–25; separate native OS window → rejected in favor of the modal.
