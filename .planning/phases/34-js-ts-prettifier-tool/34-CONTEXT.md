# Phase 34: JS/TS Prettifier Tool - Context

**Gathered:** 2026-07-02
**Status:** Ready for planning

<domain>
## Phase Boundary

ONE combined JavaScript/TypeScript/JSX/TSX formatter tool (the 13th tool, last v1.9 phase, PRT-09/10 + the PRT-12 JS/TS half): paste any of the four dialects → **Prettify** (Prettier, typescript parser default, NO language picker) or **Minify** (esbuild), with a toolbar of indent (2/4/tab) + printWidth (80/100/120) + a **semicolons toggle** + a **single-quote toggle** + the mode selector. Registry-only, free tier, WCAG-AA, on the proven Phase-32 async seam with the Phase-33 tool pattern. Paste-instant, offline, in→out byte delta, focusable copy.

</domain>

<decisions>
## Implementation Decisions

### Parser / loader strategy (the no-language-picker problem)
- **D-01: Prettify = typescript → babel fallback chain.** Try the `typescript` parser first (ROADMAP default); if it throws a parse error, retry ONCE with `babel` before surfacing an error. Both plugin sets are already locked/vendored from P32 (TS `[estree, typescript]`, JS `[estree, babel]`); the babel plugins lazy-load only on the fallback path.
- **D-02: Minify = tsx → ts fallback chain.** Try esbuild loader `tsx` first (handles TS + JSX + plain JS — the modern common case); on error retry `ts` (recovers rare angle-bracket type-casts `<T>value` that the tsx loader mis-reads as JSX).
- **D-03: Error attribution = FIRST attempt's error.** When a whole chain fails (genuinely malformed input), show the typescript-parser / tsx-loader error — deterministic, most-accurate for the common case. P33's concise-error treatment applies (strip Prettier boilerplate + spec URL; `line:col message` when both present).
- **D-04: No language picker at all** — not even an advanced escape hatch. The fallback chains ARE the coverage mechanism.

### Toggle defaults & behavior
- **D-05: Defaults = Prettier defaults.** Semicolons ON (`semi: true`), single-quote OFF (`singleQuote: false` = double quotes). Default output stays byte-identical to `prettier --write` AND to the already-committed `messy.js`/`messy.ts` goldens.
- **D-06: Toggles hidden in Minify mode** (semicolons/quotes only affect Prettier output; esbuild ignores them) — the same D-04-P32 pattern as indent/printWidth. NOTE: JSON's sort-keys toggle currently renders in both modes, so this needs explicit Prettify-only gating in FormatterView (additive).
- **D-07: Labels = "Semi" + "Single quotes"** — short toolbar labels in the existing SORT-KEYS visual rhythm; full aria-labels ("semicolons", "single quotes") underneath.

### Tool identity
- **D-08: Name "JS/TS" · id `js-formatter` · icon `Braces` (lucide).** Sits after `htmlFormatterTool` in the formatting group; category `formatting`; free (no `requiredEntitlements`); keywords should cover javascript/typescript/jsx/tsx/prettier/es6 etc.

### Test coverage
- **D-09: Add `.jsx` + `.tsx` prettify golden fixtures** (gen-prettier-golden.mjs entries + parity locks) so ALL FOUR dialects are RED-on-drift — the combined-tool promise is golden-locked, and the fixtures should exercise the fallback-relevant syntax (JSX elements; TS angle-bracket edge in the minify tests).
- **D-10: Engine options extension is in-scope:** `semi`/`singleQuote` are currently HARDCODED in `prettier.ts optionsFrom()` (`semi: true`, `singleQuote: false`, prettier.ts:71-81) — plumb both through `PrettierFormatOptions` with the hardcoded values as defaults so existing callers (HTML tool, goldens) are byte-unchanged.

### Claude's Discretion
- Exact FormatterView extension shape (two optional prop pairs vs a generalized toggles list) — planner picks; the `Toggle` primitive is reusable as-is.
- Whether toggle-path outputs get their own mini-fixtures or inline assertions (the four toggle combinations don't all need CLI goldens; defaults are golden-locked already).
- Placeholder text, empty-state copy, keyword list details.
- Fallback-chain implementation shape (where the retry lives: engine wrapper vs tool runner) — but the DEFAULT-path behavior must stay byte-identical for existing callers.

### Carried forward (locked upstream — do NOT revisit)
- `[ Prettify | Minify ]` mode selector; indent/printWidth hidden in Minify (P32 D-03/D-04); printWidth 80/100/120 default 80, Prettify-only (P32 D-06).
- Async seam: 180ms debounce, latest-wins reqId, "Formatting…" pending hint, last-good output visible (P32 D-01/D-02).
- Single StatusBar `role=alert` error surface with `line:col` (P32 D-07) + concise-error stripping (P33).
- 2 MB large-paste guard inherited FREE from `useAsyncFormat` (P33 D-01..04 — omit the 4th arg; read `inputBytes` + `isEmpty` from the hook, NEVER re-encode or re-trim raw input at the tool seam — see P33 harness remediation).
- Prettier 3.8.3 exact pin; esbuild-wasm; both heavy engines dynamic-`import()` only (PRT-02 chunk sentinel enforces).
- Offline paste e2e + interactive `role=alert` line:col e2e are per-tool BLOCKING obligations (P33 D-10/D-11); packaged CSP already carries `wasm-unsafe-eval` (fixed in P33).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior phase contracts (locked decisions this phase builds on)
- `.planning/phases/32-prettier-esbuild-engine-async-seam/32-CONTEXT.md` — mode selector, printWidth, debounce, error-surface decisions (D-01..D-07)
- `.planning/phases/33-html-prettifier-tool/33-CONTEXT.md` — size guard, tool-identity conventions, e2e obligations (D-01..D-11)
- `.planning/phases/33-html-prettifier-tool/33-HARNESS-REMEDIATION.md` — the 5-round Codex + human-gate fixes; the no-re-trim/no-re-encode tool-seam rules and packaged-CSP gotcha Phase 34 must not regress

### Code to clone / extend
- `src/tools/html-formatter/HtmlFormatterTool.tsx` + `index.ts` — THE pattern to clone (module-level runner, memo'd opts, hook-supplied byteCount/isEmpty, conciseError)
- `src/lib/format/prettier.ts` — `formatScript(input, lang, opts)` exists; `optionsFrom()` hardcodes semi/singleQuote (the D-10 extension point)
- `src/lib/format/minify.ts` — `minifyScript(input, loader)` accepts js/ts/jsx/tsx already
- `src/components/FormatterView.tsx` — `FormatterControls` + the reusable `Toggle` primitive (sort-keys precedent)
- `scripts/gen-prettier-golden.mjs` + `src/lib/format/prettier.parity.test.ts` — golden generation/lock pattern (messy.js/messy.ts already locked)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `formatScript` (prettier.ts:141) — JS/TS format function EXISTS; needs only the semi/singleQuote plumb-through (D-10) + the fallback chain (D-01)
- `minifyScript` (minify.ts:98) — all four loaders accepted; needs only the tsx→ts chain (D-02)
- `useAsyncFormat` — guard + inputBytes + isEmpty, inherited free
- `Toggle` primitive (FormatterView.tsx:159-174) — hosts the two new toggles
- `conciseError` (HtmlFormatterTool.tsx:50-55) — likely extract to a shared helper rather than copy (both tools want it)
- Existing goldens: `messy.js`/`messy.ts` + parity test lock the default path

### Established Patterns
- Tool = thin component owning input/option state; module-level mode-dispatching runner; memo'd opts; stable `#js-input`/`#js-output`-style ids
- Registry append after `htmlFormatterTool`; sidebar/⌘K/HashRouter auto-derive
- Golden fixtures via gen-prettier-golden.mjs (pinned CLI as source of truth)

### Integration Points
- `src/lib/tools/registry.ts` TOOLS array (single control plane)
- `FormatterControls` interface (additive extension for the two toggles, Prettify-gated)
- `PrettierFormatOptions` (additive `semi?`/`singleQuote?`)

</code_context>

<specifics>
## Specific Ideas

- Default output must stay byte-identical to vanilla `prettier --write` — the toggles are deviations FROM that baseline, not a new baseline.
- The user explicitly wants the four-dialect promise golden-locked (D-09) — JSX/TSX are not second-class.

</specifics>

<deferred>
## Deferred Ideas

### Reviewed Todos (not folded)
- `2026-06-11-gate-command-palette-as-pro-feature.md` — keyword false-positive (generic ui/tsx terms); entitlement/palette work unrelated to a JS/TS formatter. Stays in backlog.
- `2026-06-13-send-feedback-affordance.md` — keyword false-positive; sidebar-footer chrome unrelated to this tool. Stays in backlog.

</deferred>

---

*Phase: 34-js-ts-prettifier-tool*
*Context gathered: 2026-07-02*
