# Project Research Summary

**Project:** DevTools — v1.9 "Prettier Formatters"
**Domain:** Offline, paste-instant code prettifier tools (HTML + combined JS/TS) wrapping Prettier standalone inside an existing registry-driven Tauri 2 + Vite 7 + React 19 + TS desktop app
**Researched:** 2026-06-30
**Confidence:** HIGH

## Executive Summary

v1.9 adds two formatter tools — an **HTML prettifier** and a combined **JS/TS prettifier** — powered by **Prettier 3.8.3 standalone**, the project's FIRST deliberate *heavy* runtime dependency (an explicitly scoped, user-accepted exception to the zero-dep wedge, justified by the milestone's correctness bar: output byte-identical to dev-time `prettier --write`). All four researchers verified their core claims by executing the `prettier@3.8.3` already installed in this repo's `node_modules` — so confidence is HIGH and grounded in the exact bytes that will ship, not training data. The strongest finding: **no package needs installing**. The engine is already on disk as a devDependency; the only manifest change is moving the existing exact pin `"prettier": "3.8.3"` from `devDependencies` → `dependencies` (one copy, no caret). This makes output parity true *by construction* — the runtime `import("prettier/standalone")` and the CLI resolve the same install.

The recommended approach mirrors the proven JSON/XML formatter shape (`FormatResult` discriminated union, the shared two-pane paste-instant `FormatterView`, visible focusable copy via the platform seam) but wraps Prettier behind a **new async module `src/lib/format/prettier.ts`** returning `Promise<FormatResult>`. The heavy engine is kept out of even the tool chunk via a **memoized dynamic `import()` inside that wrapper** (deeper than the registry's existing component-level code-split), and the async result is reconciled into the sync-shaped view via a **latest-wins request-token guard** modeled on the existing regex tool's `useEffect` — on the **main thread** (Prettier parsing is ~linear; a size cap, not a worker, handles pathological pastes). Standalone loads no plugins implicitly, so each language passes an **explicit `plugins:[...]` set**: JS/TS = `babel + typescript + estree` (the `estree` printer is mandatory and the classic landmine), HTML = `html + babel + estree + postcss` (the last three required for embedded `<script>`/`<style>` to match `prettier --write` — without them embedded code is silently left raw).

The key risks are all about *silent* drift, each closed by an automated guard with an in-repo precedent: (1) a **golden parity test** formats checked-in fixtures via the standalone path and asserts byte-equality vs CLI `prettier --write`, so a future version bump or option drift goes RED; (2) a **prettier chunk guard** cloned from `scripts/licenseUiFoldInGuard.mjs` proves the engine never folds into the entry chunk (with a self-test proving it is load-bearing); (3) a **no-network offline e2e** on the real `.app` confirms zero outbound requests and no CDN strings. Two product decisions fall out cleanly: **drop Minify** (Prettier cannot minify — a Minify toggle that doesn't minify is a lie) and **replace it with a `printWidth` segmented control** (80/100/120, default 80); ship **one combined JS/TS tool** using the `typescript` parser (transparently handles JS+TS+JSX+TSX), no language picker. Finally, the stale `CLAUDE.md` "six tools only" + "zero new runtime dependencies" lines must be corrected to record this single scoped exception without opening a grab-bag floodgate.

## Key Findings

### Recommended Stack

No new install. `prettier@3.8.3` is already in the lockfile; the only manifest change is reclassifying the exact pin from `devDependencies` to `dependencies` (one copy, no `^`). Import surface is `prettier/standalone` + named plugin subpaths (all ESM `.mjs`, bundled by Vite into local chunks — no CDN). Never import the full `prettier` package (the Node/`fs`/CLI build). Bundle cost is real but loaded once, lazily, from local disk: JS/TS tool ≈ 387 KB gz, HTML tool ≈ 271 KB gz (`typescript` plugin alone is 212 KB gz — the dominant cost, accepted as the price of real TS parity). Tauri brotli-embeds the dist, so cost is a one-time first-open decode, inside the < 2s budget.

**Core technologies:**
- `prettier/standalone` 3.8.3 (already installed, moved to `dependencies`) — browser/no-`fs` engine; same install as the CLI → byte-identical output by construction.
- `prettier/plugins/estree` — shared **printer** for all JS/TS ASTs (and embedded JS in HTML); omitting it throws `Couldn't find plugin for AST format "estree"`. The single biggest gotcha.
- `prettier/plugins/babel` + `prettier/plugins/typescript` — JS and TS **parsers** (typescript covers JS+TS+JSX+TSX); both pair with `estree`.
- `prettier/plugins/html` + `prettier/plugins/postcss` — HTML parser/printer + CSS parser; HTML needs `[html, babel, estree, postcss]` for `prettier --write` parity on embedded `<script>`/`<style>`.

### Expected Features

**Must have (table stakes):**
- HTML tool: paste-instant prettify, indent 2/4/tab, `printWidth` 80/100/120, error-as-value (`role=alert` line:col), copy, status bar.
- JS/TS tool: paste-instant prettify (typescript parser, auto JS+TS+JSX+TSX), indent group, `printWidth`, **semicolons** + **single-quote** toggles, error-as-value, copy, status bar.
- FormatterView: make `minify` optional (omitted for both Prettier tools), add optional `printWidth` control; JSON/XML behaviour unchanged.
- Async-safe derive (latest-wins request-token guard); lazy-loaded vendored Prettier chunk.
- Defaults pinned to Prettier 3.8.3 defaults + a golden fixture lock test.

**Should have (competitive):**
- Defaults = canonical Prettier output, locked so a bump can't silently drift — "canonical, not just pretty."
- Fully offline / code never leaves the machine — privacy + air-gap win over every web playground.
- One combined JS/TS tool, parser auto-covers all four dialects (least-surprise, no picker).

**Defer (v2+):**
- JS/TS `trailingComma` segmented control (default `all` is fine) — add when asked.
- JS/TS `JS | TS` escape toggle — add only for a real plain-JS paste the TS parser misformats.
- HTML `htmlWhitespaceSensitivity` toggle — `css` default is safe; add on complaint.
- Other vendored-plugin languages (CSS/GraphQL/Markdown/YAML) — only if each independently clears the wedge; NOT this milestone.

**Anti-features (rejected):** a "Minify" button (Prettier can't minify), the full 15+ option matrix, a 4-way JS/JSX/TS/TSX picker, `.prettierrc` config loading, syntax-highlighted output pane (XSS/anti-flash), an `embeddedLanguageFormatting` toggle.

### Architecture Approach

Two new lazy registry tools (`html-formatter`, `js-ts-formatter`) append to `TOOLS[]` — sidebar, ⌘K palette, and HashRouter all auto-derive, no per-surface wiring, no `requiredEntitlements` (free tier). The new work is the async seam: a single wrapper module owns the engine, a shared async hook owns the sequencing, so each tool component stays as thin as `JsonFormatterTool`. Main thread, not a worker — a worker would fragment the lazy chunk and risk duplicating the heavy engine across module graphs, to solve a freeze class (catastrophic backtracking) Prettier doesn't have.

**Major components:**
1. `src/lib/format/prettier.ts` (NEW) — async `formatHtml`/`formatScript` returning `Promise<FormatResult>`; module-level **memoized dynamic-import** singletons (`loadStandalone`, `loadHtmlPlugin`, `loadScriptPlugins`) shared across both tools; per-language plugin tables; Prettier-throw → `{line,col}` error-as-value mapping.
2. `src/shell/useAsyncFormat.ts` (NEW, recommended) — shared effect: debounce (~80–120ms) + monotonic request-id gate (drop stale resolves) + `pending` flag; the regex precedent minus the worker/`terminate`.
3. Two tool components + `index.ts` registry entries; `FormatterView.tsx` small generalization (optional `minify`, add `printWidth` / JS-TS toggle slots via the existing `SegmentedControl`); `package.json` devDep→dep move.

### Critical Pitfalls

1. **Missing `estree` / wrong plugin set per language** — standalone auto-resolves nothing; a forgotten plugin is a hard throw. Centralise `plugins:[...]` in the one wrapper; add a per-language format unit test (a throw fails it).
2. **HTML silently leaves embedded `<script>`/`<style>` unformatted** — a quality regression, not a throw, that quietly breaks "matches Prettier." Use `[html, babel, estree, postcss]`; lock with a script+style golden fixture vs CLI.
3. **A stray static import drags the heavy chunk into the entry bundle** — defeats the lazy requirement for all existing tools. Dynamic `import()` only; `import type` for types; prove with `prettierChunkGuard.mjs` (cloned from `licenseUiFoldInGuard.mjs`) asserting `prettierInEntryChunk:false` on the `vite build` artifact, with a self-test.
4. **Version skew / output drift** — two copies or a caret float diverges runtime output from `prettier --write`. ONE exact pin, `pnpm why prettier` == 1, and a **golden parity test** byte-equal vs CLI that RED-s on any drift.
5. **Async stale-result race + error handling** — `format()` is async; a slow older format can overwrite newer output, and invalid input throws. Monotonic latest-wins sequencing; wrap every call → error-as-value `role=alert` with line:col, never a crash or silent fallback.

(Also: offline/CSP — npm subpaths only, no `unpkg`/CDN, no-network e2e on the real `.app`; ESM `import * as` namespace plugin interop with a single cast at the estree seam if `tsc` flags it.)

## Implications for Roadmap

Combined research converged on `1 → 2 → {3, 4}` plus an early cheap doc plan. v1.9 starts at **Phase 31**.

### Phase 31: Doc/Process Correction (cheap, do first)
**Rationale:** The stale `CLAUDE.md` "six tools only" + "zero new runtime dependencies" lines are already false (11 tools shipped) and will either block downstream plans or be misread as license for grab-bag deps. Correct early; pairs with the milestone-scoping commit.
**Delivers:** Wedge-gated tool-set wording; Prettier recorded as the ONE scoped, reviewed runtime-dep exception (alongside `js-md5`), explicitly not a precedent.
**Avoids:** Pitfall 12 (stale docs / wedge wording).

### Phase 32: Engine / Seam Infra (foundation — everything depends on it)
**Rationale:** Both tools depend on the async wrapper, the shared plumbing, and the parity/isolation guards. Highest pitfall density — build the guards with the wrapper, not after.
**Delivers:** `src/lib/format/prettier.ts` (memoized lazy loads, per-language plugin tables, error→line:col mapping); `src/shell/useAsyncFormat.ts` (debounce + reqId gate + pending); `FormatterView` generalization (optional `minify` + `printWidth`); `package.json` devDep→dep move; cloned `prettierChunkGuard.mjs` + verify-bundle assert + self-test; the **golden parity harness** vs CLI `prettier --write`; the no-network offline e2e.
**Uses:** `prettier/standalone` + plugins; the regex async/id-gate precedent; the `licenseUiFoldInGuard.mjs` chunk-guard precedent.
**Avoids:** Pitfalls 1, 3, 4, 5, 6, 7, 8, 9, 10, 11 (the whole critical set).

### Phase 33: HTML Tool
**Rationale:** Single parser → simpler; ship first to exercise the seam end-to-end.
**Delivers:** `src/tools/html-formatter/{HtmlFormatterTool.tsx,index.ts}` + registry entry; indent 2/4/tab, printWidth, error-as-value, copy, status bar.
**Addresses:** HTML table-stakes; the `[html, babel, estree, postcss]` embedded-parity decision.
**Avoids:** Pitfall 2 — locked by a script+style golden fixture vs CLI.

### Phase 34: JS/TS Tool
**Rationale:** Adds the multi-plugin (`babel`+`estree`+`typescript`) load + semi/single-quote toggles + optional language toggle. Independent chunk from HTML — parallelizable after Phase 32, but each plan still passes every harness gate.
**Delivers:** `src/tools/js-ts-formatter/{JsTsFormatterTool.tsx,index.ts}` + registry entry; typescript parser default (JS+TS+JSX+TSX), indent, printWidth, semicolons + single-quote toggles, error-as-value, copy, status bar.
**Addresses:** JS/TS table-stakes; the combined-tool / no-picker decision.
**Avoids:** Pitfall 1 (both parsers wired with shared `estree`, verified by a JS *and* a TS format test).

### Phase Ordering Rationale
- **Dependency-driven:** the engine wrapper + shared hook + FormatterView change are a hard prerequisite for both tools (`1 → 2 → {3,4}`); the doc plan is independent and cheap, so it goes first to unblock the "six tools" constraint.
- **Architecture grouping:** all async/lazy/parity/isolation risk concentrates in the infra phase, so guards are authored once with the wrapper and re-run in each tool phase's `vite build` gate.
- **Pitfall avoidance:** HTML before JS/TS because HTML's single-parser path is simpler to land and its embedded-code golden fixture is the sharpest test of the seam; JS/TS then adds the multi-plugin set on a proven foundation.

### Research Flags

Needs deeper `/gsd-research-phase` during planning:
- **Phase 32 (Engine/Seam Infra):** the chunk-guard + golden-parity-vs-CLI harness wiring is novel-to-this-milestone (clones existing precedents, but prettier-specific chunk inventory + CLI snapshot generation needs concrete plan-phase detail). Open: column 0- vs 1-based normalization on JSC/WKWebView; `optimizeDeps` behaviour if dev pre-bundle warns.

Standard patterns (skip research-phase):
- **Phase 31 (Doc):** mechanical edits, exact wording drafted in PITFALLS.md.
- **Phase 33 / 34 (tools):** mirror the proven JSON/XML/regex tool shape on the Phase-32 seam.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified by executing installed `prettier@3.8.3` (exports map, plugin sets, gzip sizes, TLA/eval scans) — the exact bytes that ship. |
| Features | HIGH | Prettier behaviour probed empirically (async API, required plugins, typescript-covers-all, `SyntaxError.loc`); existing FormatterView/JSON/XML surface read directly. |
| Architecture | HIGH | Read against real files; async/id-gate + chunk-isolation patterns already exist in-repo (regex tool, licenseUiFoldInGuard). |
| Pitfalls | HIGH | Prettier official browser docs + 3.0 ESM notes + tracked issues, cross-checked against the repo's chunk-guard / verify-bundle precedent. |

**Overall confidence:** HIGH

### Gaps to Address
- **Column base (0- vs 1-based):** confirm Prettier's `err.loc.column` on JSC/WKWebView and normalize to the JSON tool's display — verify at the unit layer with a real malformed-input fixture (Phase 32).
- **HTML embedded-code scope:** STACK/FEATURES recommend full `[html, babel, estree, postcss]` parity (matches the milestone goal); ARCHITECTURE floated an html-only MVP. Decision: ship the parity set so "matches `prettier --write`" holds — confirm with user at plan time, lock with the script+style golden fixture.
- **CSP / source maps:** confirm Prettier 3.x standalone runs under the strict Tauri CSP with no `unsafe-eval`, and disable plugin source maps in prod — assert at the phase-boundary gate on the real `.app`.
- **Pathological large pastes:** main-thread is the call; if the real-WKWebView gate shows jank, add an input-size soft cap / explicit "Format" button (NOT a worker).

## Sources

### Primary (HIGH confidence)
- Installed `prettier@3.8.3` in `node_modules` — live execution: per-language plugin sets, the `estree`-missing throw, `html`-only leaves embedded code raw vs `[html,babel,estree,postcss]` formats it, async `format`, `SyntaxError.loc.start`, gzip sizes, exports map, TLA/`require`/`process` scans.
- Repo files — `package.json`, `.prettierrc.json`, `tsconfig.json`, `vite.config.ts`, `src/lib/format/{types,json,xml}.ts`, `src/components/FormatterView.tsx`, `src/tools/{json,regex}/*`, `src/lib/tools/registry.ts`, `src/components/ToolRoute.tsx`, `scripts/licenseUiFoldInGuard.mjs`, `scripts/verify-appstore-bundle.sh`.
- [Prettier — Browser API](https://prettier.io/docs/browser); [Prettier 3.0 release notes](https://prettier.io/blog/2023/07/05/3.0.0.html); [Prettier — Options](https://prettier.io/docs/options).
- [Issue #15078](https://github.com/prettier/prettier/issues/15078) — missing-estree error; [Discussion #16778](https://github.com/prettier/prettier/discussions/16778) — embedded `<script>` unformatted without related plugins.

### Secondary (MEDIUM confidence)
- [Issue #16501](https://github.com/prettier/prettier/issues/16501) / [#15136](https://github.com/prettier/prettier/issues/15136) — dynamic-import estree default-export TS interop trap.

---
*Research completed: 2026-06-30*
*Ready for roadmap: yes*
