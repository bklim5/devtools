# Phase 7: Formatters - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-02
**Phase:** 7-Formatters
**Areas discussed:** Pane layout, Output pane behavior, Size readout, Toolbar placement

> Context: Phase 7 has an approved, detailed design spec
> (`docs/superpowers/specs/2026-06-02-json-xml-formatters-design.md`). Most decisions were already
> locked by the spec and prior phases. Only the HOW choices the spec deliberately left open were
> discussed. All four areas were presented in a single batch.

---

## Pane layout

| Option | Description | Selected |
|--------|-------------|----------|
| Side-by-side (L→R) | Classic formatter layout; responsive-stack on narrow widths | |
| Stacked (top→bottom) | Matches existing Base64 tool; full-width | |
| Side-by-side, resizable | L→R split with draggable divider, reusing protobuf `ResizableSplit` | ✓ |

**User's choice:** Side-by-side, resizable
**Notes:** Reuse the protobuf decoder's `ResizableSplit`; promote it to a shared location since a
second feature now consumes it. Must stay responsive/layout-agnostic.

---

## Output pane behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Read-only text region | Non-editable styled region; visible copy; no syntax highlighting (zero-dep) | ✓ |
| Editable textarea | Visually like Base64 panes but edits don't round-trip | |

**User's choice:** Read-only text region
**Notes:** Plain mono text, derived-only, with the visible focusable copy control (FMT-08).

---

## Size readout

| Option | Description | Selected |
|--------|-------------|----------|
| Delta: input → output | Show e.g. `1,240 → 890 bytes`; needs a small StatusBar tweak | ✓ |
| Output bytes only | Pass outputBytes as single byteCount; no StatusBar change | |

**User's choice:** Delta: input → output
**Notes:** Requires an additive StatusBar API touch; coordinate with Phase 8's opt-in byteCount
change so existing single-byteCount callers (Base64/Protobuf) don't regress.

---

## Toolbar placement

| Option | Description | Selected |
|--------|-------------|----------|
| Shared top toolbar | One row above both panes; tools pass which controls to show | ✓ |
| Output pane header | Controls in the output header next to copy | |

**User's choice:** Shared top toolbar
**Notes:** Keeps FormatterView presentational and JSON/XML-agnostic; JSON shows sort-keys, XML
doesn't.

## Claude's Discretion

- Exact shared path for `ResizableSplit` and import rewiring.
- Additive `StatusBar` prop shape for the byte delta.
- Default split ratio / min pane widths.
- `FormatResult` typing details and location.

## Deferred Ideas

- Syntax highlighting (needs a dep — violates zero-dep).
- JSON5/JSONC; XML XSD validation; SQL formatter (backlog 999.1).
- Broad opt-in StatusBar byteCount cleanup → Phase 8 (UIX-01).
