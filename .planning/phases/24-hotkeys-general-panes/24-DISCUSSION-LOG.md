# Phase 24: Hotkeys & General Panes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 24-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-18
**Phase:** 24-hotkeys-general-panes
**Areas discussed:** Rebind capture UX, General toggle set, Default-tool semantics, Chord validation & reset

---

## Rebind capture UX

### Capture mechanism
| Option | Description | Selected |
|--------|-------------|----------|
| Live key-capture field | Click → record mode → press chord; captured from physical e.code; Escape cancels | ✓ |
| Curated dropdown | Pick from a fixed vetted list | |
| Typed accelerator string | User types `CmdOrCtrl+Shift+D` literally | |

**User's choice:** Live key-capture field.

### Conflict / rejection
| Option | Description | Selected |
|--------|-------------|----------|
| Reject inline, keep prior binding | Calm inline message, prior binding stays, persist nothing | ✓ |
| Warn but allow override | Persist anyway with a warning | |
| Block at capture time | Validate against reserved list during capture | |

**User's choice:** Reject inline, keep prior binding.
**Notes:** Matches roadmap success criterion 1. Reserved-list blocking still applied at validation (see Validation area) — but the OS register-result is the final gate.

---

## General toggle set

| Option | Description | Selected |
|--------|-------------|----------|
| Launch at login | Autostart plugin (scoped new-dep exception) | ✓ |
| Start in tray | Launch hidden to menu-bar tray | ✓ |
| Default tool on open | Which tool the app opens to | ✓ |
| Show license status in sidebar | Pure-webview visibility toggle | ✓ |

**User's choice:** All four ship.

---

## Default-tool semantics

### Relation to opens-to-last
| Option | Description | Selected |
|--------|-------------|----------|
| "Last used" + specific picks | Dropdown: "Last used" (default) + individual tools; backward-compatible | ✓ |
| Replace with a fixed tool | Setting picks one fixed tool; remove opens-to-last | |
| Always-ask / blank start | Add a palette-first/no-tool option | |

**User's choice:** "Last used" + specific picks.

### Launch-at-login + start-in-tray combined
| Option | Description | Selected |
|--------|-------------|----------|
| Silent background, summon to show | Login → hidden to tray; summon/tray-click reveals | ✓ |
| Independent, no special-casing | Each toggle acts alone | |

**User's choice:** Silent background launch, summon/tray to reveal.

---

## Chord validation & reset

### Validation strictness
| Option | Description | Selected |
|--------|-------------|----------|
| Require modifier + block OS-reserved | Require non-shift modifier; block Cmd+Space/Q/Tab/screenshots; OS register-result final gate | ✓ |
| Minimal — require a modifier only | Just require a modifier; OS rejects the rest | |
| Let OS decide everything | No client reserved list | |

**User's choice:** Require modifier + block OS-reserved.

### Reset affordance
| Option | Description | Selected |
|--------|-------------|----------|
| Per-hotkey reset to default | Small Reset control restores shipped default | ✓ |
| No reset control | Manual re-capture only | |

**User's choice:** Per-hotkey reset to default.

## Claude's Discretion

- Exact OS-reserved chord blocklist.
- Autostart plugin choice + its scoped-dep exception write-up in PLAN.md.
- Per-toggle default values + the accelerator ↔ capture normalization helper.
- Internal component structure (capture field, toggle rows, default-tool dropdown); pane glyphs.
- Whether summon + palette share one reusable HotkeyCaptureField.

## Deferred Ideas

- Curated-dropdown / typed-string chord entry (rejected for live capture).
- "Warn but allow override" on taken chord (rejected).
- "Blank / palette-first / always-ask" startup state.
- Deep-link summon (validated path exists, not wired in v1).
- Multi-hotkey / per-tool global shortcuts.
