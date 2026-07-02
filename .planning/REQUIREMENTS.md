# Requirements: DevTools — v1.9 "Prettier Formatters"

**Defined:** 2026-06-30
**Core Value:** Paste an unknown blob → get a usable, explorable interpretation in under 2 seconds, entirely offline, without touching the mouse. (v1.9 extends this to: paste messy code → get canonical, dev-time-matching formatted output — or minified output — offline.)

> **Scope note (overrides research recommendation):** the v1.9 research recommended DROPPING Minify (Prettier cannot minify). The user explicitly chose to KEEP a Minify button on both tools, matching the JSON/XML formatters. Minify is therefore powered by a SECOND heavy runtime dependency — **esbuild** (offline `esbuild-wasm`, lazy-loaded, vendored) for JS/TS/JSX/TSX + CSS, and an HTML minifier for HTML. v1.9 thus accepts **two** scoped heavy-dep exceptions to the zero-dep wedge: Prettier (prettify) + esbuild (minify).

## v1 Requirements

Requirements for milestone v1.9. Each maps to exactly one roadmap phase (31–34).

### Prettier Engine & Async Seam

- [x] **PRT-01**: Prettier 3.8.3 standalone is the runtime PRETTIFY engine — vendored/self-hosted (no CDN), moved from devDependency to a single exact-pinned `dependency` — so prettified output is byte-identical to dev-time `prettier --write`. *(Phase 32-01 — done 2026-07-01)*
- [x] **PRT-02**: Both heavy engines (Prettier + esbuild) and their language plugins are lazy-loaded via dynamic `import()` and code-split — never present in the app's entry/initial chunk — proven by an automated build-artifact guard (cloned from the existing chunk-inventory guard) with a non-vacuous self-test. *(Phase 32-05 — done 2026-07-01: `scripts/prettierChunkGuard.mjs` initial-reachability guard (entry + transitive static `.imports`), UNGATED in vite.config.ts, emitting `prettier-chunk-inventory.json`; non-vacuous real-Vite self-test covers BOTH engines + the non-entry-static hoist trap; `verify-appstore-bundle.sh` FATALs on `heavyEngineInitiallyReachable:true`)*
- [ ] **PRT-03**: Formatting (prettify AND minify) runs asynchronously with a latest-wins guard (a slow stale format never clobbers newer output); a pending/loading state is shown; the paste-to-output experience stays within the <2s "instant" feel.
- [x] **PRT-04**: Parse/format/minify errors surface as a calm `role=alert` value with line:col where the engine provides it — never a crash, never a silent fallback. *(Error-surface half: 32-03 (StatusBar `role=alert`) + engine error-as-value (32-01/32-04). Offline half: 32-05 engine-level no-network integration test + no-CDN bundle grep + chunk sentinel. Large-paste DoS-guard half: 33-01 shared `useAsyncFormat` 2 MB cap + bounded `utf8LenBounded` (pair-guarded surrogates, no full encode); over-cap all-whitespace also guarded (33-04 Codex R1/R2). Interactive mounted-tool + real-WKWebView Wi-Fi-off offline paste half: 33-03/33-04 — done 2026-07-02, human APPROVED. Both D-11 error categories (esbuild embedded-code + Prettier html-structure) render calm `role=alert` line:col, now CONCISE (boilerplate/URL stripped) and non-truncating; recovery proven (never a crash). The shared seam (useAsyncFormat + StatusBar) is reused by the Phase-34 JS/TS tool.)*
- [x] **PRT-05**: A golden parity test locks prettified output byte-equal to CLI `prettier --write` (per language, including a fixture with embedded code), so a future Prettier bump or option drift fails the suite. *(Phase 32-01 — done 2026-07-01)*

### Minify Engine (esbuild)

- [x] **PRT-06**: esbuild is the runtime MINIFY engine — vendored/self-hosted offline (`esbuild-wasm`, no CDN), lazy-loaded/code-split — minifying JavaScript, TypeScript, JSX, TSX, and CSS safely (no ASI/regex-literal breakage); HTML is minified via an offline HTML minifier (collapsing whitespace + minifying embedded `<script>`/`<style>`). Minify output is valid and semantically equivalent to the input. *(Phase 32-04 — engine landed 2026-07-01: `minifyScript` via lazily-loaded/memoized esbuild-wasm 0.28.0 + offline pure `minifyHtml`, error-as-value, ASI/regex-literal safe. Phase 32-05 — 2026-07-01: the remaining lazy/code-split isolation + no-network offline build-artifact proof landed (prettierChunkGuard initial-reachability guard + sentinel + no-network engine integration test), so the checkbox is now complete)*

### HTML Prettifier Tool

- [x] **PRT-07**: User can paste HTML and **Prettify** → canonical output that ALSO formats embedded `<script>` (JS) and `<style>` (CSS) blocks (full `prettier --write` parity: html + babel + estree + postcss), OR **Minify** → compact valid HTML with minified embedded code. *(Done 2026-07-02, Phase 33: SC1/SC2 goldens 33-02 + mounted tool 33-03 + real-WKWebView e2e 33-04. Minify made packaged-safe via CSP `wasm-unsafe-eval` + attribute-integrity fixes.)*
- [x] **PRT-08**: The HTML tool exposes indent (2/4/tab), printWidth (80/100/120, default 80), and a Minify action (matching the JSON/XML toolbar shape); it is paste-instant, offers visible focusable copy via the platform seam, and shows the status bar in→out byte delta. *(Done 2026-07-02, Phase 33: 33-03 toolbar + 33-04 real-WKWebView paste-instant proof; human APPROVED.)*

### JavaScript/TypeScript Prettifier Tool

- [ ] **PRT-09**: User can paste JavaScript, TypeScript, JSX, or TSX into ONE combined tool and **Prettify** → canonical output (typescript parser default, no language picker in the common case), OR **Minify** → compact valid output via esbuild.
- [ ] **PRT-10**: The JS/TS tool exposes indent (2/4/tab), printWidth, a semicolons toggle, a single-quote toggle, and a Minify action; it is paste-instant, offers visible focusable copy via the platform seam, and shows the status bar in→out byte delta.

### Shared Shell & Registry Integration

- [ ] **PRT-11**: The shared two-pane `FormatterView` is generalized additively — an OPTIONAL `printWidth` control is added and the standalone `minify` toggle is replaced by a mutually-exclusive `[ Prettify | Minify ]` mode selector reused across all four formatter tools (JSON, XML, HTML, JS/TS), with `esbuild` wired as the Minify engine for the Prettier tools only (D-05). **Amended by D-05 (Phase 32):** the earlier "NO change to existing JSON/XML formatter behaviour" is superseded — JSON and XML were **retrofitted to the unified mode selector in Phase 32 (plan 32-03) and re-verified**, while their pure `src/lib/format/json.ts` / `xml.ts` transform logic (native `JSON.stringify` compact / XML whitespace-strip) and tests are **unchanged** (only the UI/control wiring changed — engines stay per-tool). `printWidth` (80/100/120, default 80) renders only in Prettify mode for tools that supply it; JSON/XML never expose it (D-06). Indent + printWidth are hidden in Minify mode (D-04).
- [ ] **PRT-12**: Both tools register registry-only (the registry stays the single control plane — sidebar, ⌘K palette, and HashRouter all auto-derive), ship on the free tier (no entitlement gate), and meet WCAG-AA (visible focus, AA contrast, no opacity-only disabled state). *(HTML half DONE 2026-07-02, Phase 33: `htmlFormatterTool` registry-only, no `requiredEntitlements` (free), WCAG-AA covered by human sign-off; StatusBar overlap fixed. UNCHECKED — spans BOTH tools; the JS/TS half lands in Phase 34, reusing this registry/free-tier/WCAG-AA pattern.)*

### Documentation & Wedge Integrity

- [x] **PRT-13**: The stale `CLAUDE.md` "six tools only" + "zero new runtime dependencies" wording is corrected to record Prettier (prettify) + esbuild (minify) as TWO deliberate, scoped, reviewed runtime-dependency exceptions (not a precedent for grab-bag deps); `decoder.ts` + its 19 tests stay byte-for-byte untouched.

## v2 Requirements

Deferred P2 options (acknowledged, NOT in the v1.9 roadmap — ship the safe defaults instead). Promote on user request.

### Prettier / Minify Options (P2)

- **PRT-P2-01**: JS/TS `trailingComma` segmented control (defaults to `all` in v1.9 with no UI knob).
- **PRT-P2-02**: JS/TS manual `JS | TS` parser toggle for the rare valid-JS the TypeScript parser misformats (v1.9 always uses the typescript parser, which covers JS+TS+JSX+TSX).
- **PRT-P2-03**: HTML `htmlWhitespaceSensitivity` toggle (css/strict/ignore) — v1.9 ships the safe `css` default with no UI knob.
- **PRT-P2-04**: Additional vendored Prettier/esbuild languages (SCSS, GraphQL, Markdown, YAML) — each must independently clear the product wedge before shipping.
- **PRT-P2-05**: Minify tuning options (keep-names, target, drop-console) — v1.9 ships safe defaults.

## Out of Scope

Explicitly excluded for v1.9. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Naive whitespace-strip "minify" | Unsafe for JS/TS (ASI / regex-literal breakage); v1.9 uses esbuild for real, valid minification instead. |
| `.prettierrc` / config-file loading | Standalone has no `fs`; pasted arbitrary code should format against explicit, visible defaults, not a hidden project config. |
| Syntax-highlighted output pane | Would require `dangerouslySetInnerHTML` (XSS surface) and a heavier render; the app's tools show plain escaped output. |
| `embeddedLanguageFormatting` toggle | Embedded formatting is on by default (the parity goal); a toggle adds UI for no real demand. |
| A Web Worker for formatting | Prettier/esbuild are ~linear (no catastrophic-backtracking freeze class the regex tool guards against); a worker would fragment the lazy chunks / risk duplicating the heavy engines. A size cap handles pathological pastes. |
| Bundler/transpile features of esbuild (imports, JSX runtime, tree-shaking) | v1.9 uses esbuild ONLY as an in-memory single-file minifier (`transform`, not `build`); full bundling is not a tool. |
| Schema-aware / other deferred tools | Out of the v1.9 slice; the wedge gates additions. |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PRT-01 | Phase 32 | Complete (32-01) |
| PRT-02 | Phase 32 | Complete (32-05) |
| PRT-03 | Phase 32 | In progress (32-02: latest-wins hook + pending flag; UI display/minify pending) |
| PRT-04 | Phase 32 | Complete (error-surface 32-03 + offline 32-05 + DoS guard 33-01 incl. whitespace 33-04; interactive + WKWebView offline paste proven 33-03/33-04, human APPROVED 2026-07-02; shared seam reused by P34) |
| PRT-05 | Phase 32 | Complete (32-01) |
| PRT-06 | Phase 32 | Complete (engine 32-04; lazy/code-split + offline proof 32-05) |
| PRT-07 | Phase 33 | Complete (engine SC1/SC2 locks 33-02 + mounted prettify/minify tool 33-03 + real-WKWebView e2e 33-04; packaged Minify fixed via CSP wasm-unsafe-eval + attribute integrity; human APPROVED 2026-07-02) |
| PRT-08 | Phase 33 | Complete (toolbar indent + printWidth 80/100/120 default 80 + Minify + in→out byte delta + focusable copy 33-03; paste-instant real-WKWebView proof 33-04; human APPROVED 2026-07-02) |
| PRT-09 | Phase 34 | Pending |
| PRT-10 | Phase 34 | Pending |
| PRT-11 | Phase 32 | Pending |
| PRT-12 | Phase 33 | In progress (HTML half DONE 2026-07-02: registry-only sidebar/⌘K/HashRouter derive + free/no-entitlement + WCAG-AA via human sign-off, 33-03/33-04; JS/TS half pending Phase 34 — "both tools") |
| PRT-13 | Phase 31 | Complete |

**Coverage:**
- v1 requirements: 13 total
- Mapped to phases: 13 ✓ (Phase 31: 1 · Phase 32: 7 · Phase 33: 3 · Phase 34: 2)
- Unmapped: 0 ✓ (every requirement maps to exactly one phase; PRT-12 owned by Phase 33, its registry/free-tier/WCAG-AA pattern reused by Phase 34)

---
*Requirements defined: 2026-06-30*
*Last updated: 2026-06-30 after milestone v1.9 definition (Minify kept on both tools, powered by esbuild — overrides research's drop-minify recommendation)*
