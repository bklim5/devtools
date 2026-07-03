---
phase: 34-js-ts-prettifier-tool
plan: 03
subsystem: formatter-shell
tags: [formatter-view, toggles, prettier, shared-helper, a11y]
requires:
  - "src/components/FormatterView.tsx (existing shared shell)"
  - "src/tools/html-formatter/HtmlFormatterTool.tsx (inline conciseError source)"
provides:
  - "FormatterControls.semi/onSemi + singleQuote/onSingleQuote (Prettify-gated toggles)"
  - "Toggle primitive ariaLabel prop (short label ≠ accessible name, D-07)"
  - "src/lib/format/conciseError.ts shared pure helper"
affects:
  - "34-04 JS/TS tool (consumes both the new toggles + conciseError)"
tech-stack:
  added: []
  patterns:
    - "Additive optional handler-gated toolbar controls (mode-conditional render, D-06)"
    - "Extract-not-copy shared pure helper (single implementation, byte-identical behavior)"
key-files:
  created:
    - src/lib/format/conciseError.ts
    - src/lib/format/conciseError.test.ts
  modified:
    - src/components/FormatterView.tsx
    - src/components/FormatterView.test.tsx
    - src/tools/html-formatter/HtmlFormatterTool.tsx
decisions:
  - "Semi/Single-quotes toggles render ONLY when handler supplied AND mode==='prettify' (D-06 hide-in-Minify)"
  - "Short visible labels (Semi / Single quotes) + full aria-labels (semicolons / single quotes) via new Toggle.ariaLabel (D-07)"
  - "conciseError extracted VERBATIM (same regexes) into a shared module rather than copied — one implementation for HTML + JS/TS"
metrics:
  duration: ~3m
  tasks: 2
  files: 5
  completed: 2026-07-03
---

# Phase 34 Plan 03: Formatter Shell Prep (Prettify Toggles + Shared conciseError) Summary

Added the two Prettify-only JS/TS toolbar toggles (Semi, Single quotes) to the shared `FormatterView` additively, and extracted `conciseError` out of `HtmlFormatterTool` into a shared pure module so the HTML tool and the incoming 34-04 JS/TS tool use ONE implementation.

## What Was Built

**Task 1 — Semi + Single-quotes toggles (`c176acf9`, feat):**
- `FormatterControls` widened additively with `semi?`/`onSemi?` + `singleQuote?`/`onSingleQuote?` (sortKeys untouched).
- The `Toggle` primitive gained an optional `ariaLabel` prop (`aria-label={ariaLabel ?? label}`) so the short visible label ("Semi") differs from the accessible name ("semicolons") per D-07; the existing sort-keys Toggle passes no `ariaLabel` → accessible name unchanged.
- Both new toggles render in the toolbar (after sort-keys) ONLY when their handler is supplied AND `controls.mode === "prettify"` — hidden in Minify (D-06), like indent/printWidth. Default `pressed` matches the engine defaults (semi ON via `?? true`, singleQuote OFF via `?? false`).
- 6 new tests: render-in-Prettify by aria-label, short-label ≠ aria-label, aria-pressed reflection, hidden-in-Minify, absent-without-handlers, negated-value callbacks. The test `renderView` helper extended to pass the four new props (presence-gated like `onPrintWidth`/`onSortKeys`).

**Task 2 — shared conciseError (`781928ec`, refactor):**
- New `src/lib/format/conciseError.ts` exports the helper VERBATIM (identical regexes: boilerplate split on `. It may happen`/`For more info(rmation) see`, trailing `(line:col)` strip, trim), doc-comment adapted tool-agnostic.
- `HtmlFormatterTool.tsx` now `import { conciseError } from "@/lib/format/conciseError"`; the inline definition (and its comment block) deleted. The two call sites are unchanged — behavior byte-identical, all 9 existing HTML-tool tests green.
- New `conciseError.test.ts` (7 tests): Prettier "It may happen" / "For more info see" / "For more information see" variants → head only, trailing "(1:14)" removal, boilerplate+locus combined, esbuild-style passthrough aside from paren-locus, trim.

## Deviations from Plan

None - plan executed exactly as written (no Rule 1–4 deviations). One in-task note: Task 2 replaced the inline `conciseError` comment block with a shorter comment that references the helper by name but contains no `function conciseError` token, so the plan's `! grep -q "function conciseError"` scope guard passes.

## Verification

- `npx vitest run src/components/FormatterView.test.tsx src/lib/format/conciseError.test.ts src/tools/html-formatter/HtmlFormatterTool.test.tsx` — 38/38 green (FormatterView 21, conciseError 7, HtmlFormatterTool 9 unchanged; +1 pre-existing).
- Full lefthook suite (both commits): `tsc --noEmit` exit 0, **vitest 1405/1405**, eslint 0 errors (4 pre-existing react-refresh warnings in SidebarResetMenu/settingsPanes — out of scope).
- JSON/XML tools byte-unchanged (`git diff --quiet HEAD -- src/tools/json-formatter/ src/tools/xml-formatter/`).
- decoder + 19 tests byte-for-byte untouched (`git diff --quiet HEAD -- src/lib/protobuf/`).
- Acceptance greps all pass: `onSemi`/`onSingleQuote`, `label="Semi"`/`label="Single quotes"`, `ariaLabel="semicolons"`, prettify guard present; `export function conciseError`, HTML tool import present, inline def gone.

## Notes for Downstream

- **34-04 (JS/TS tool)** wires `onSemi`/`onSingleQuote`/`semi`/`singleQuote` into its `FormatterControls` and imports `conciseError` for its error mapping. The toggles' DOM-visible surface is exercised end-to-end via the 34-04 tool unit tests + the 34-05 e2e.
- **Binding harness NOT auto-run here** (run at the Phase-34 boundary in Plan 34-05 per project harness): `/simplify` → `/code-review xhigh` → `/codex:adversarial-review` → real-WKWebView UI verification. This plan changes the shared shell + a pure helper with no independently mounted tool surface.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: src/lib/format/conciseError.ts
- FOUND: src/lib/format/conciseError.test.ts
- FOUND (modified): src/components/FormatterView.tsx, src/components/FormatterView.test.tsx, src/tools/html-formatter/HtmlFormatterTool.tsx
- FOUND commit: c176acf9 (feat, Task 1)
- FOUND commit: 781928ec (refactor, Task 2)
