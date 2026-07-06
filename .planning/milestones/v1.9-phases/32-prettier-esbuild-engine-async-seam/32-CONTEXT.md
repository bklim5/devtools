# Phase 32: Prettier/esbuild Engine & Async Seam - Context

**Gathered:** 2026-07-01
**Status:** Ready for planning

<domain>
## Phase Boundary

The **foundation** both v1.9 Prettier tools (Phase 33 HTML, Phase 34 JS/TS) depend on — built as infra, not a user-facing tool:

- an **async Prettier wrapper** (`prettier/standalone` + named plugin subpaths, dynamic-imported),
- an **esbuild-wasm minify wrapper** (JS/TS/JSX/TSX + CSS; HTML via an offline HTML minifier),
- a **shared latest-wins async formatting hook** (debounce + reqId gate + pending state),
- an **additively-generalized `FormatterView`** (adds `printWidth`; replaces the coexisting `minify` toggle with a mutually-exclusive **Prettify | Minify** mode selector),
- the **parity/isolation guards**: a chunk-split guard (cloned from the existing licenseui-inventory guard) with a non-vacuous self-test, a golden parity test vs CLI `prettier --write`, and an offline (no-network) e2e.

No user-facing prettifier tool ships this phase. HTML (P33) and JS/TS (P34) consume this seam.

</domain>

<decisions>
## Implementation Decisions

### Async seam & pending UX (PRT-03, PRT-04)
- **D-01:** Formatting runs asynchronously. While a format is in-flight (including the one-time lazy-chunk load on first format), **keep the last-good output visible** and show a **subtle "Formatting…" hint in the StatusBar**. No dim/spinner overlay, no output-pane flicker or layout shift — calm aesthetic.
- **D-02:** Debounce keystroke input **~150–200ms** before invoking the engine (exact value = Claude's discretion, research proposes `useAsyncFormat`). The **latest-wins reqId guard** still protects ordering independently — a slow stale result never clobbers newer output.

### Prettify/Minify model — UNIFIED across all 4 tools (AMENDS PRT-11)
- **D-03:** Prettify vs Minify is a **mutually-exclusive segmented mode selector** (`[ Prettify | Minify ]`), **not** the current coexisting `minify` toggle. Output stays **live-derived** (updates as you type) — the paste-instant model is preserved; no action-button click required.
- **D-04:** When **Minify** mode is active, the **indent and printWidth controls are HIDDEN** (minified output has no spaces/wrapping, so those knobs are meaningless in that mode). Switching back to Prettify restores them.
- **D-05:** Apply this unified mode-selector model to **all four formatter tools in Phase 32** — JSON, XML, HTML, JS/TS — for one consistent model. This **amends PRT-11** (which currently says "NO change to existing JSON/XML formatter behaviour"): JSON/XML are **retrofitted this phase** and must be **re-verified**.
  - **Engines stay per-tool:** JSON/XML keep their existing **native/pure** minify (`JSON.stringify` compact / XML whitespace strip). **esbuild-wasm** powers minify only for **JS/TS/JSX/TSX + CSS**; **HTML** minifies via the offline HTML minifier. Only the **UI model** unifies, not the transform engines.
  - **⚠️ ACTION for planner:** update PRT-11 wording in `.planning/REQUIREMENTS.md` to permit the unified minify model + record the JSON/XML retrofit; the pure `src/lib/format/json.ts` + `xml.ts` transform logic (and their tests) are unchanged — only the FormatterView/tool-component control wiring changes.

### printWidth control (PRT-08, PRT-11)
- **D-06:** `printWidth` = **segmented `80 / 100 / 120`, default `80`** (mirrors the existing indent `2/4/tab` segment group). **Prettier-tools only** (rendered only in Prettify mode; JSON/XML never expose it — they have no line-wrap reflow). It is **independent of indent**: indent = width of one nesting level; printWidth = the max line length before Prettier wraps a long line.

### Error surface (PRT-04)
- **D-07:** Reuse the **single StatusBar footer** as the one error surface across all tools (already shows `line:col` + message for JSON/XML). **Upgrade its live region to `role=alert`** for parse/format/minify errors, surfacing `line:col` where the engine provides it. Never a crash, never a silent fallback. No second error surface / separate alert line.

### Locked upstream (carried into planning, not re-litigated)
- Prettier **3.8.3 standalone**, **moved devDep→dependency** (exact pin, no `^`) → output byte-identical to `prettier --write` by construction. Import `prettier/standalone` + named plugin subpaths only (never the full `prettier` Node build).
- Plugin sets (verified in STACK.md): **JS** `[babel, estree]`; **TS** `[typescript, estree]`; **HTML `--write` parity** `[html, babel, estree, postcss]`.
- **esbuild-wasm** = the minify engine (PRT-06), vendored/self-hosted offline, lazy-loaded/code-split.
- Both heavy engines + plugins load **only via dynamic `import()`**, never in the entry/initial chunk (PRT-02). No `manualChunks` needed — Rollup hoists shared chunks automatically.

### Claude's Discretion
- Exact debounce ms within 150–200 and the `useAsyncFormat` hook shape.
- Chunk-inventory guard clone mechanics + its non-vacuous self-test design.
- Golden parity test harness structure (fixtures, per-language, embedded-code fixture) — must go RED on any Prettier version/option drift.
- Offline (no-network) e2e mechanics.

### Reviewed Todos (not folded)
- **"Send feedback" affordance in sidebar footer (mailto:)** — matched on `tsx/json/test` keyword overlap only; unrelated to the engine seam. Not folded.
- **Gate command palette as Pro feature** — unrelated to this phase. Not folded.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v1.9 formatter research (2026-06-30, HIGH confidence — verified against installed prettier@3.8.3)
- `.planning/research/STACK.md` — dep-move (devDep→dep), exact import surface (`prettier/standalone` + plugin subpaths), verified plugin matrix per language, bundle costs, no `optimizeDeps`/`build.target` changes needed.
- `.planning/research/ARCHITECTURE.md` — registry/router auto-derive; the small FormatterView generalization; the shared `src/shell/useAsyncFormat.ts` (debounce + reqId gate + pending); the `src/lib/format/` contract (`FormatResult`, `FormatOptions`, `timed()`) both tools mirror.
- `.planning/research/FEATURES.md` — **⚠️ PARTIALLY SUPERSEDED:** its §"Minify-affordance decision" recommends **dropping** the Minify toggle. This is **OVERRIDDEN** by PRT-06 + D-03/D-05 — esbuild-wasm is brought in as the second scoped dep so Minify is real and honest. Use FEATURES.md for the FormatterView additive-props mechanics; ignore its "drop minify" conclusion.
- `.planning/research/PITFALLS.md` — dev(esbuild `optimizeDeps`) vs build(Rollup) split divergence; multiple plugin-subpath entrypoints; "works in dev ≠ code-split in prod" — directly relevant to the PRT-02 chunk guard.
- `.planning/research/SUMMARY.md` — synthesized overview.

### Requirements & harness
- `.planning/REQUIREMENTS.md` §PRT-01..PRT-06, PRT-11 — the phase's acceptance criteria. **PRT-11 to be amended** per D-05 (unified minify model + JSON/XML retrofit).
- `docs/harness-and-decisions.md` — locked decisions + build/verify harness (authoritative where it differs from the spec).
- `CLAUDE.md` / `.planning/PROJECT.md` — the two deliberate scoped runtime-dep exceptions (Prettier prettify + esbuild minify), both vendored/self-hosted offline + lazy-loaded; "no network at runtime" preserved.

### Existing code to reuse / clone / modify
- `src/components/FormatterView.tsx` — the shared 2-pane shell to generalize additively (replace the required `minify` toggle with the Prettify|Minify mode selector; add optional `printWidth`; `sortKeys` already shows the optional-prop idiom).
- `src/tools/json-formatter/JsonFormatterTool.tsx` — the thin tool-wiring pattern (owns option state, live-derives via `timed()`); the JS/TS + HTML tools mirror it, and JSON/XML get retrofitted to the mode selector here.
- `src/lib/format/{json,xml,types}.ts` (+ `.test.ts`) — the `FormatResult`/`IndentMode`/`timed()` contract; **pure transform logic + tests stay unchanged** (only UI wiring changes).
- `src/components/StatusBar.tsx` — currently `role="status"`; upgrade to `role="alert"` for the error line (D-07).
- `vite.config.ts` — the existing **licenseui-inventory** chunk guard/sentinel to CLONE for the PRT-02 heavy-engine chunk-isolation guard.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **FormatterView** — layout-agnostic 2-pane shell already handles indent segments, minify, copy, StatusBar; `sortKeys`/`onSortKeys` optional-prop pattern is the template for adding `printWidth` and the mode selector.
- **`src/lib/format/` contract** — `FormatResult`, `IndentMode`, `timed()` — new async wrappers return the same shape (async vs sync body is the only difference).
- **licenseui-inventory chunk guard** (`vite.config.ts`) — an existing, proven build-artifact inventory/sentinel guard to clone for chunk isolation (see also memory `keygen-compileout-d04-proof` — Tauri brotli-embeds dist INTO the binary; sentinel the build's `dist/`, not `.app` Resources).
- **StatusBar** — single existing error/status surface; upgrade live-region role only.

### Established Patterns
- Tools live in `src/tools/<tool>/`, register **registry-only** (`component: () => import(...)`) → sidebar/palette/HashRouter auto-derive. No manualChunks; Rollup auto-splits.
- Tool components own option state + live-derive output on change (JSON/XML today are **synchronous, no-debounce D-07**); Phase 32 introduces the async + debounced path via the shared hook.
- Tools import `src/lib/platform/` seam, never `@tauri-apps/*` directly.

### Integration Points
- New shared hook `src/shell/useAsyncFormat.ts` (debounce + reqId latest-wins + pending) — both P33/P34 tools + the retrofitted JSON/XML consume it.
- `FormatterView` generalization is the one genuinely shared component change; JSON/XML wiring updates ride along (D-05).

</code_context>

<specifics>
## Specific Ideas

- Mode selector renders as a segmented `[ Prettify | Minify ]` group; when Minify is active, the indent + printWidth segment groups disappear from the toolbar (mutually exclusive — see D-04 preview the user approved).
- printWidth vs indent are orthogonal knobs — indent = depth-per-level, printWidth = wrap threshold (user asked; confirmed segmented 80/100/120 default 80).

</specifics>

<deferred>
## Deferred Ideas

None new — discussion stayed within phase scope. (The JSON/XML minify-model change was deliberately folded INTO Phase 32 via the PRT-11 amendment, D-05, rather than deferred.)

</deferred>

---

*Phase: 32-prettier-esbuild-engine-async-seam*
*Context gathered: 2026-07-01*
