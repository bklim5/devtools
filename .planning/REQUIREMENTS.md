# Requirements: DevTools — v1.9 "Prettier Formatters"

**Defined:** 2026-06-30
**Core Value:** Paste an unknown blob → get a usable, explorable interpretation in under 2 seconds, entirely offline, without touching the mouse. (v1.9 extends this to: paste messy code → get canonical, dev-time-matching formatted output — or minified output — offline.)

> **Scope note (overrides research recommendation):** the v1.9 research recommended DROPPING Minify (Prettier cannot minify). The user explicitly chose to KEEP a Minify button on both tools, matching the JSON/XML formatters. Minify is therefore powered by a SECOND heavy runtime dependency — **esbuild** (offline `esbuild-wasm`, lazy-loaded, vendored) for JS/TS/JSX/TSX + CSS, and an HTML minifier for HTML. v1.9 thus accepts **two** scoped heavy-dep exceptions to the zero-dep wedge: Prettier (prettify) + esbuild (minify).

## v1 Requirements

Requirements for milestone v1.9. Each maps to exactly one roadmap phase (31–34).

### Prettier Engine & Async Seam

- [ ] **PRT-01**: Prettier 3.8.3 standalone is the runtime PRETTIFY engine — vendored/self-hosted (no CDN), moved from devDependency to a single exact-pinned `dependency` — so prettified output is byte-identical to dev-time `prettier --write`.
- [ ] **PRT-02**: Both heavy engines (Prettier + esbuild) and their language plugins are lazy-loaded via dynamic `import()` and code-split — never present in the app's entry/initial chunk — proven by an automated build-artifact guard (cloned from the existing chunk-inventory guard) with a non-vacuous self-test.
- [ ] **PRT-03**: Formatting (prettify AND minify) runs asynchronously with a latest-wins guard (a slow stale format never clobbers newer output); a pending/loading state is shown; the paste-to-output experience stays within the <2s "instant" feel.
- [ ] **PRT-04**: Parse/format/minify errors surface as a calm `role=alert` value with line:col where the engine provides it — never a crash, never a silent fallback.
- [ ] **PRT-05**: A golden parity test locks prettified output byte-equal to CLI `prettier --write` (per language, including a fixture with embedded code), so a future Prettier bump or option drift fails the suite.

### Minify Engine (esbuild)

- [ ] **PRT-06**: esbuild is the runtime MINIFY engine — vendored/self-hosted offline (`esbuild-wasm`, no CDN), lazy-loaded/code-split — minifying JavaScript, TypeScript, JSX, TSX, and CSS safely (no ASI/regex-literal breakage); HTML is minified via an offline HTML minifier (collapsing whitespace + minifying embedded `<script>`/`<style>`). Minify output is valid and semantically equivalent to the input.

### HTML Prettifier Tool

- [ ] **PRT-07**: User can paste HTML and **Prettify** → canonical output that ALSO formats embedded `<script>` (JS) and `<style>` (CSS) blocks (full `prettier --write` parity: html + babel + estree + postcss), OR **Minify** → compact valid HTML with minified embedded code.
- [ ] **PRT-08**: The HTML tool exposes indent (2/4/tab), printWidth (80/100/120, default 80), and a Minify action (matching the JSON/XML toolbar shape); it is paste-instant, offers visible focusable copy via the platform seam, and shows the status bar in→out byte delta.

### JavaScript/TypeScript Prettifier Tool

- [ ] **PRT-09**: User can paste JavaScript, TypeScript, JSX, or TSX into ONE combined tool and **Prettify** → canonical output (typescript parser default, no language picker in the common case), OR **Minify** → compact valid output via esbuild.
- [ ] **PRT-10**: The JS/TS tool exposes indent (2/4/tab), printWidth, a semicolons toggle, a single-quote toggle, and a Minify action; it is paste-instant, offers visible focusable copy via the platform seam, and shows the status bar in→out byte delta.

### Shared Shell & Registry Integration

- [ ] **PRT-11**: The shared two-pane `FormatterView` is generalized additively — a `printWidth` control is added and the existing `minify` action is reused for the Prettier tools (wired to esbuild) — with NO change to the existing JSON/XML formatter behaviour.
- [ ] **PRT-12**: Both tools register registry-only (the registry stays the single control plane — sidebar, ⌘K palette, and HashRouter all auto-derive), ship on the free tier (no entitlement gate), and meet WCAG-AA (visible focus, AA contrast, no opacity-only disabled state).

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
| PRT-01 | Phase 32 | Pending |
| PRT-02 | Phase 32 | Pending |
| PRT-03 | Phase 32 | Pending |
| PRT-04 | Phase 32 | Pending |
| PRT-05 | Phase 32 | Pending |
| PRT-06 | Phase 32 | Pending |
| PRT-07 | Phase 33 | Pending |
| PRT-08 | Phase 33 | Pending |
| PRT-09 | Phase 34 | Pending |
| PRT-10 | Phase 34 | Pending |
| PRT-11 | Phase 32 | Pending |
| PRT-12 | Phase 33 | Pending |
| PRT-13 | Phase 31 | Complete |

**Coverage:**
- v1 requirements: 13 total
- Mapped to phases: 13 ✓ (Phase 31: 1 · Phase 32: 7 · Phase 33: 3 · Phase 34: 2)
- Unmapped: 0 ✓ (every requirement maps to exactly one phase; PRT-12 owned by Phase 33, its registry/free-tier/WCAG-AA pattern reused by Phase 34)

---
*Requirements defined: 2026-06-30*
*Last updated: 2026-06-30 after milestone v1.9 definition (Minify kept on both tools, powered by esbuild — overrides research's drop-minify recommendation)*
