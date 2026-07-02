# Phase 34: JS/TS Prettifier Tool - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-02
**Phase:** 34-js-ts-prettifier-tool
**Areas discussed:** Parser/loader strategy, Toggle defaults/behavior, Tool identity, JSX/TSX golden coverage

---

## Parser/loader strategy

| Option | Description | Selected |
|--------|-------------|----------|
| typescript → babel fallback | Try typescript parser; on parse error retry babel once | ✓ |
| typescript only | Single parser, simplest; rare valid-JS edge syntax errors | |
| You decide | Claude picks during planning | |

| Option | Description | Selected |
|--------|-------------|----------|
| tsx → ts fallback | Try tsx loader; on error retry ts (recovers `<T>value` casts) | ✓ |
| Fixed tsx | One loader, no retry | |
| You decide | Claude picks during planning | |

| Option | Description | Selected |
|--------|-------------|----------|
| First attempt's error | typescript/tsx error shown — deterministic | ✓ |
| Last attempt's error | Fallback's error shown | |
| You decide | Claude picks | |

**Notes:** All three recommended options accepted. No language picker at all (not even an escape hatch).

---

## Toggle defaults/behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Prettier defaults | Semi ON, single-quote OFF — matches CLI + existing goldens | ✓ |
| Semi ON + single-quote ON | Diverges from vanilla prettier | |
| You decide | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Hidden in Minify | D-04 pattern like indent/printWidth (needs explicit Prettify-only gating — sort-keys precedent renders in both modes) | ✓ |
| Always visible (disabled) | Avoids layout shift; WCAG disabled-state concerns | |
| You decide | | |

| Option | Description | Selected |
|--------|-------------|----------|
| "Semi" + "Single quotes" | Short toolbar labels, full aria-labels underneath | ✓ |
| "Semicolons" + "Quotes" | "Quotes" alone ambiguous | |
| You decide | | |

---

## Tool identity

| Option | Description | Selected |
|--------|-------------|----------|
| "JS/TS" | Precise combined scope, short like siblings | ✓ |
| "JavaScript" | Under-sells TS/JSX/TSX | |
| "JS" | Hides the TS half | |

| Option | Description | Selected |
|--------|-------------|----------|
| js-formatter | Matches json-/xml-/html-formatter convention | ✓ |
| js-ts-formatter | More literal, breaks rhythm | |
| You decide | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Braces | { } glyph, distinct from FileCode/CodeXml | ✓ |
| FileCode2 | Too close to XML's FileCode | |
| SquareCode | More generic | |
| You decide | | |

---

## JSX/TSX golden coverage

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, add .jsx + .tsx goldens | Golden-lock all four dialects RED-on-drift | ✓ |
| JS/TS goldens sufficient | Smaller surface, no JSX/TSX drift lock | |

---

## Claude's Discretion

- FormatterView extension shape (prop pairs vs toggles list)
- Toggle-path test fixture strategy (defaults already golden-locked)
- Placeholder/empty-state copy, keyword list
- Fallback-chain implementation location (engine wrapper vs tool runner), default path byte-identical

## Deferred Ideas

- Todo `2026-06-11-gate-command-palette-as-pro-feature.md` — reviewed, not folded (unrelated; keyword false-positive)
- Todo `2026-06-13-send-feedback-affordance.md` — reviewed, not folded (unrelated; keyword false-positive)
