# Phase 8: StatusBar Size-Readout Cleanup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-02
**Phase:** 8-StatusBar Size-Readout Cleanup
**Areas discussed:** Hash keep/drop, Drop-tool status-left look, Opt-in API shape, Test granularity

---

## Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Hash keep/drop confirm | Hash is the only drop-tool with a real count today; confirm or revisit | ✓ |
| Drop-tool status-left look | Bare ParseState label vs quieter on empty | ✓ |
| Opt-in API shape | Optional byteCount vs type-enforced pairing | ✓ |
| Test granularity | Unit + per-tool vs StatusBar unit only | ✓ |

**User's choice:** All four areas.

---

## Hash keep/drop

| Option | Description | Selected |
|--------|-------------|----------|
| Drop it (follow roadmap) | Remove the readout from Hash like the other three; status text only | ✓ |
| Keep it on Hash | Hash stays in keep set (input size meaningful for hashing); revise roadmap | |

**User's choice:** Drop it (follow roadmap).
**Notes:** Hash uniquely passes a real `byteCount={byteCount}` today, but consistency across the
drop set wins. Roadmap keep/drop split stands unchanged — no ROADMAP/REQUIREMENTS edits needed.

---

## Drop-tool status-left look

| Option | Description | Selected |
|--------|-------------|----------|
| Keep state label as-is | Left side keeps OK/Empty/Error, only size text removed; no other behavior change | ✓ |
| Quieter on empty | Suppress state label when empty — broader StatusBar change | |

**User's choice:** Keep state label as-is.
**Notes:** Aligns with success criterion #1 ("no other StatusBar behavior changed").

---

## Opt-in API shape

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal: optional byteCount | Make byteCount optional; gate the size span on it being a number | ✓ |
| Type-enforce the pairing | Discriminated/conditional type so outputBytes can't be passed without byteCount | |

**User's choice:** Minimal: optional byteCount.
**Notes:** outputBytes-without-byteCount renders nothing (delta needs both). Keep the
presentational component simple — no extra type machinery.

---

## Test granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Unit test + per-tool assertions | StatusBar optional-branch test + present/absent per affected tool | ✓ |
| StatusBar unit test only | Cover only the StatusBar branch; rely on existing tool tests | |

**User's choice:** Unit test + per-tool assertions.
**Notes:** Query the existing `aria-label="byte count"` span for present/absent. Satisfies
success criterion #4 ("affected tools' tests assert present/absent").

## Claude's Discretion

- JSDoc wording for the optional `byteCount`; where per-tool assertions live; minor render-guard
  refactor (keep keep-caller output byte-identical).

## Deferred Ideas

- Richer status-left text for drop tools (declined — conflicts with criterion #1).
- Compile-time enforcement of the outputBytes/byteCount pairing (declined — minimal change wins).
