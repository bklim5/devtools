# Phase 3: Hero (Protobuf) + Encoding + UX Constraints - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-31
**Phase:** 3-hero-protobuf-encoding-ux-constraints
**Areas discussed:** Protobuf input handling, Ambiguity defaults + tree expansion, Copy & JSON export, Base64/Hex/Bytes UX

---

## Protobuf input handling

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-detect + override | Heuristic picks hex vs base64 on paste; status bar shows which; toggle to force the other | ✓ |
| Explicit toggle only | User sets hex/base64 themselves; no guessing | |
| Try hex then base64 | Silently attempt hex, fall back to base64, no visible control | |

**User's choice:** Auto-detect + override
**Notes:** → D-01/D-02/D-03. Detection heuristic + example payload chips folded in as recommended secondary defaults (accepted).

---

## Ambiguity defaults + tree expansion

| Option | Description | Selected |
|--------|-------------|----------|
| Smart default + expand | Prefer message > string > packed > bytes; nested sub-messages auto-expanded | ✓ |
| Smart default, collapsed | Same heuristic, only top-level expanded; deep nodes collapsed | |
| Always raw bytes | Every LEN defaults to bytes/hex; user clicks to interpret; flat | |

**User's choice:** Smart default + expand
**Notes:** → D-04/D-05/D-06. Chips driven directly from `LenInterpretation`; VARINT shows zigzag+signed+unsigned+bool.

---

## Copy & JSON export

| Option | Description | Selected |
|--------|-------------|----------|
| Per-node + copy-as-JSON | Per-field copy button (selected interpretation) + output-pane "copy all as JSON" | ✓ |
| Per-node copy only | Copy individual values; no whole-tree export | |
| Add full JSON view mode | Tree/JSON view switch on top of cards/rows | |

**User's choice:** Per-node + copy-as-JSON
**Notes:** → D-10/D-11. Full JSON view-mode deferred (keeps PRO-06 scope to cards/rows). No hover-only copy.

---

## Base64/Hex/Bytes UX

| Option | Description | Selected |
|--------|-------------|----------|
| Flag field, keep last-good | Error on bad field + status bar; other two keep last valid value | ✓ |
| Clear the other two | Blank derived fields while input invalid | |
| Error state in all three | Propagate error indicator across all fields | |

**User's choice:** Flag field, keep last-good
**Notes:** → D-12/D-13/D-14. Three stacked panes over a single internal Uint8Array (reuses `bytes.ts`); base64/base64url toggle on the base64 pane.

---

## Secondary defaults (Claude's discretion, accepted by user)

- Ship one-click example payload chips (canonical `{1:150}`, nested message, packed varints, UTF-8 string) — D-03.
- Hex detection heuristic: all hex chars + even nibble count → hex, else base64 — D-02.
- Protobuf layout: input │ resizable divider │ output, cards default, mockup tokens with spec overrides (neutral `#N`, no hover-only copy) — D-08/D-09.
- Base64/Hex/Bytes: three stacked full-width panes, each with focusable copy; alphabet toggle on base64 pane, session-local — D-12/D-14.
- Copy-as-JSON: pretty-printed, field numbers as keys, selected interpretation per node — D-11.

## Claude's Discretion

Detection edge tuning, example payload contents, node component structure, copy button placement, JSON serialization of non-message interpretations, Base64 pane ordering / alphabet-persistence, status-bar formatting, wire-type icons.

## Deferred Ideas

Full tree/JSON view-mode switch; tool-scoped action palette (V2-01); schema-aware `.proto`; persisting the base64 alphabet; window-geometry persistence (Phase 5).
