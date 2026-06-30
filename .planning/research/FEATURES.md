# Feature Research

**Domain:** Paste-instant code prettifier tools (HTML + JS/TS) wrapping Prettier standalone, inside an offline keyboard-driven desktop devtool
**Researched:** 2026-06-30
**Confidence:** HIGH (Prettier 3.8.3 behaviour probed empirically against the installed package; existing FormatterView/JSON/XML surface read directly)

## Context: what we are mirroring vs changing

The two new tools (`HTML`, combined `JS/TS`) must reuse the proven shape but Prettier is a fundamentally different engine from the native JSON/XML transforms:

| Aspect | JSON/XML (existing) | HTML & JS/TS (new) | Implication |
|--------|---------------------|--------------------|-------------|
| Engine | native `JSON` / `DOMParser` (sync, pure, zero-dep) | `prettier/standalone` + plugins (**async**, heavy, lazy-loaded) | `formatX` returns `Promise<FormatResult>`; the tool's `useMemo`-sync-derive becomes an async effect with a request-token guard |
| Indent | `IndentMode` `2`/`4`/`tab` → `JSON.stringify` space arg | same `2`/`4`/`tab` → Prettier `tabWidth`/`useTabs` | **reuse the existing indent group verbatim** — `2`→tabWidth 2, `4`→tabWidth 4, `tab`→useTabs true |
| Minify | real second transform (`JSON.stringify(v)` / strip XML whitespace) | **Prettier cannot minify** (verified — it only prettifies) | drop the Minify toggle; replace the second-action slot (see §Minify decision) |
| Result shape | `FormatResult` (`{ok,output,inputBytes,outputBytes}` \| `{ok:false,error{message,line?,col?}}`) | identical shape | keep `FormatResult` unchanged; Prettier's `.loc.start` populates line/col |
| Error source | `JSON.parse`/parsererror string scraping | Prettier `SyntaxError` with structured `.loc` | **cleaner** — line:col comes from `.loc.start`, no message-regex heuristics needed |

Verified Prettier-standalone facts (against installed 3.8.3):
- All public APIs async: `await prettier.format(code, { parser, plugins })`.
- Standalone loads **no** plugins automatically — `plugins` is required. JS/TS = `[estree, babel]` or `[estree, typescript]`; HTML = `[html]`.
- `typescript` parser formats plain JS, TS syntax, JSX/TSX, and the `<T,>` generic-arrow case — one parser covers the whole combined tool.
- Invalid input throws `SyntaxError` with `.loc = {start:{line,column}}` and a codeframe in `.message`; first line is e.g. `Unexpected token (1:12)`.
- HTML default collapses insignificant whitespace (`htmlWhitespaceSensitivity:"css"`).

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Paste-instant prettify, both tools | The whole app's contract; every sibling tool does it | MEDIUM | Async now — debounce-free is fine (Prettier of a paste is <50ms) but needs a request-token guard so a slow format can't overwrite newer input |
| Indent 2/4/tab (reuse existing group) | JSON/XML already expose exactly this; users expect parity | LOW | Maps to `tabWidth`/`useTabs`; **zero new UI** |
| `printWidth` control | THE defining Prettier knob — nothing changes output more; absent = tool feels not-really-Prettier | LOW–MEDIUM | Segmented `80 / 100 / 120` (default **80**). This is the natural occupant of the now-vacant second-action slot |
| Calm `role=alert` error w/ line:col | App-wide pattern; Prettier hands us `.loc.start` directly | LOW | `line ${loc.start.line}:${loc.start.column} ${firstMessageLine}`; strip the codeframe block from `.message` |
| Visible focusable copy | Binding constraint (no hover-only) | LOW | FormatterView already provides it |
| Status bar (in→out byte delta, timing, parse state) | Every formatter has it | LOW | Reuse; timing now measured around the awaited call |
| Empty input = "empty", not error | JSON/XML behaviour (D-08) | LOW | Short-circuit before calling Prettier |
| JS/TS: `semi` + `singleQuote` toggles | The two style knobs devs actually flip; a JS formatter without them feels stiff | LOW | Two small toggles, exactly like the optional `Sort keys` toggle pattern. Defaults match Prettier: semi **on**, singleQuote **off** |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Defaults = the repo's own `prettier@3.8.3` config | Output is byte-identical to what CI/`prettier --write` produces — "canonical, not just pretty" (the stated milestone goal) | LOW | Pin defaults to Prettier 3.x defaults (= project config, which is bare defaults). Lock with a fixture test so a Prettier bump can't silently drift output |
| Fully offline, code never leaves the machine | Every web prettier (prettier.io playground, online beautifiers) uploads/keeps code in a browser tab; this is a privacy + air-gap win for proprietary source | LOW | Inherent to vendored/self-hosted standalone (already a milestone constraint) |
| Active-options always visible | Online tools hide config; surfacing the exact knobs makes output reproducible/explainable | LOW | The toolbar IS the disclosure — keep it small but present |
| Combined JS/TS, parser auto-handles TS+JSX+TSX | One tool, paste anything JS-family, it just works (verified `typescript` parser covers all four) | LOW | Least-surprising: no language picker needed for the common case |
| Instant local re-format on option change | Flip semicolons/quotes/width and see canonical output re-flow with no network | LOW | Already how JSON/XML re-derive on option change |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| A "Minify" button on these tools | JSON/XML have one; symmetry | **Prettier cannot minify** — a Minify toggle that doesn't minify is a lie; HTML/JS minifiers (terser/html-minifier) are whole new heavy deps that break the wedge | Drop it; put `printWidth` in that slot (§Minify decision) |
| Full Prettier option matrix in the UI (quoteProps, arrowParens, bracketSpacing, jsxSingleQuote, proseWrap, endOfLine, bracketSameLine, embeddedLanguageFormatting…) | "Expose everything" | 15+ controls overload a paste-instant tool, bury the 3 knobs that matter, and most never get touched | Expose only the table-stakes knobs; ship the rest at Prettier defaults |
| Separate JS / JSX / TS / TSX language picker | Mirrors file extensions | The `typescript` parser handles all four transparently (verified incl. `<T,>`); a 4-way picker is noise | Single combined tool; at most one optional JS\|TS escape toggle (see §Language) |
| Config-file loading (`.prettierrc`) / plugin marketplace | "Use my project's config" | Explicitly out of the wedge; filesystem/plugin-resolution + network surface | Hardcode to Prettier defaults = the project's own config anyway |
| Syntax-highlighted output pane | "Looks nicer" | Output is a read-only monospace `<textarea>` by design (D-03 / threat T-07-05: no raw-HTML injection) | Keep plain monospace, as JSON/XML do |
| `embeddedLanguageFormatting` toggle surfaced | "Format my CSS-in-JS / `<script>` in HTML" | It's `auto` by default and already formats embedded blocks; a toggle invites confusion | Leave at `auto`, no UI |

## Minify-affordance decision (explicit)

**Drop the Minify toggle on both Prettier tools. Replace the second-action slot with a `printWidth` segmented control (`80 / 100 / 120`, default 80).**

Why:
- Prettier is a prettifier only — verified, it has no minify mode, and the HTML/`estree` plugins don't either. Adding real minification means terser + html-minifier (heavy new runtime deps) — a direct wedge violation just after the milestone already spent its one deliberate dep (Prettier).
- A toggle labelled "Minify" that merely collapses to a high `printWidth` would mislead (it still emits readable multi-line code with spaces) — worse than absent.
- `printWidth` is the single highest-value Prettier knob and naturally fills the toolbar's second slot, keeping the familiar "indent group + one or two controls" shape.

Mechanics: make `minify`/`onMinify` **optional** in `FormatterControls` (the interface already does this for `sortKeys`/`onSortKeys` — same pattern), and add an optional `printWidth`/`onPrintWidth` control group rendered only when provided. JSON/XML keep Minify; the two Prettier tools omit it and pass printWidth instead. No fork of FormatterView — just two more optional control props.

## Recommended exposed-option set per tool (with defaults)

All defaults = Prettier 3.8.3 defaults (= the project's own `prettier --write` config), so output is canonical.

### JS/TS tool
| Control | UI | Prettier option | Default | Tier |
|---------|----|--------|---------|------|
| Indent | reuse `2/4/tab` group | `tabWidth` / `useTabs` | `2` (tabWidth 2) | table stakes |
| Print width | segmented `80/100/120` | `printWidth` | `80` | table stakes |
| Semicolons | toggle | `semi` | on (`true`) | table stakes |
| Single quotes | toggle | `singleQuote` | off (`false`) | table stakes |
| Trailing commas | segmented `none/es5/all` | `trailingComma` | `all` | nice-to-have (P2; default is fine, add only if cheap) |
| Language | optional `JS \| TS` (see §Language) | `parser` | TS/auto | nice-to-have (P2) |

Fixed at default (no UI): `quoteProps:"as-needed"`, `jsxSingleQuote:false`, `bracketSpacing:true`, `bracketSameLine:false`, `arrowParens:"always"`, `endOfLine:"lf"`, `embeddedLanguageFormatting:"auto"`.

### HTML tool
| Control | UI | Prettier option | Default | Tier |
|---------|----|--------|---------|------|
| Indent | reuse `2/4/tab` group | `tabWidth` / `useTabs` | `2` | table stakes |
| Print width | segmented `80/100/120` | `printWidth` | `80` | table stakes |
| Whitespace sensitivity | optional segmented `css/strict/ignore` | `htmlWhitespaceSensitivity` | `css` | nice-to-have (P2) — HTML-specific and materially changes output, but `css` is a safe canonical default; ship minimal first |

Fixed at default (no UI): `bracketSameLine:false`, `singleAttributePerLine:false`, `embeddedLanguageFormatting:"auto"`.

Rationale for keeping HTML minimal: most "messy HTML" pastes just want canonical re-indentation; the only HTML-specific knob worth a toggle is whitespace-sensitivity, and even that can be P2.

## JS-vs-TS language selection (concrete recommendation)

**Default: one combined tool that always uses the `typescript` parser — no language picker in the common case.**

Verified: the `typescript` parser formats plain JS (`const x=1` → `const x = 1;`), TS type syntax, and JSX/TSX including the `<T,>` generic-arrow disambiguation. Since TypeScript is a JS superset and Prettier's TS parser accepts JS, a single parser covers paste-anything behaviour with the least surprise. There is **no need** for a JSX/TSX toggle — JSX is handled inline.

**Optional escape hatch (P2): a small `JS | TS` segmented toggle defaulting to `TS`.** A narrow set of valid plain-JS constructs the TS grammar misreads (e.g. legacy `<Foo>bar` type-assertion-looking expressions, some Flow-ish syntax) can be force-parsed as pure JS via the `babel` parser. Treat this as a safety valve, not table stakes; default `TS` (superset) so a fresh paste formats with zero clicks.

- `TS`/auto → `parser:"typescript"`, plugins `[estree, typescript]`
- `JS` → `parser:"babel"`, plugins `[estree, babel]`

Anti-pattern to avoid: a 4-way JS/JSX/TS/TSX picker — it surfaces a distinction the parser already erases.

## Error / diagnostic behaviour (matching `role=alert`)

Prettier throws a `SyntaxError` on invalid input, carrying structured `.loc.start.{line,column}` plus a codeframe embedded in `.message`. Surface it as the existing calm error-as-value:

- Wrap `await prettier.format(...)` in try/catch; on throw return `{ok:false, error:{message: firstLineOf(e.message), line: e.loc?.start?.line, col: e.loc?.start?.column}}`.
- Take only the first line of `.message` (e.g. `Unexpected token (1:12)`); **strip the multi-line codeframe** so the status bar/`role=alert` stays one tidy line (matches JSON/XML).
- Output pane clears on error (D-08); parse state → `error`.
- This is strictly cleaner than the JSON path: no message-regex offset scraping — `.loc.start` is authoritative. Note `loc.start.column` is effectively 1-based in Prettier's message form; verify the off-by-one against the existing JSON line:col convention and pick one consistent base across all four formatters.

## Feature Dependencies

```
Async FormatResult (formatHtml/formatJsTs return Promise)
    └──requires──> lazy plugin loading (dynamic import of prettier/standalone + plugins)
                       └──requires──> registry code-split (already a milestone constraint)

FormatterView second-action slot
    └──requires──> make minify optional + add optional printWidth control props
                       (same optionality pattern as existing sortKeys)

JS/TS combined tool
    └──uses──> typescript parser (covers JS+TS+JSX+TSX) — no picker needed
    └──optional escape──> babel parser via JS|TS toggle

Canonical-output guarantee
    └──requires──> defaults pinned to Prettier 3.8.3 defaults + a fixture lock test
```

### Dependency Notes

- **Async derive vs the JSON/XML sync `useMemo`:** the proven tools derive output synchronously in `useMemo`. Prettier is async, so the new tools need an effect + request-token (or AbortController-style latest-wins) guard so a slow format from older input can't clobber newer output. This is the single biggest structural deviation from the mirror; flag it for the roadmap.
- **FormatterView extension is additive:** `minify`/`onMinify` already optional-capable pattern (`sortKeys`); add optional `printWidth`/`onPrintWidth` (and for JS/TS `semi`/`singleQuote`, for HTML `htmlWhitespaceSensitivity`). No JSON/XML behaviour change.
- **Lazy chunk:** the heavy Prettier + plugins must be dynamically imported on first format (or tool-open), not at module top, or the registry code-split is defeated.

## MVP Definition

### Launch With (v1.9 core)
- [ ] HTML tool: paste-instant prettify, indent 2/4/tab, printWidth 80/100/120, error-as-value, copy, status bar
- [ ] JS/TS tool: paste-instant prettify (typescript parser, auto JS+TS+JSX+TSX), indent group, printWidth, semicolons toggle, single-quote toggle, error-as-value, copy, status bar
- [ ] FormatterView: minify made optional (omitted for both), printWidth control added; JSON/XML unchanged
- [ ] Async-safe derive (latest-wins guard); lazy-loaded vendored Prettier chunk
- [ ] Defaults pinned to Prettier 3.8.3 defaults + fixture lock test
- [ ] `CLAUDE.md` "six tools only" line corrected

### Add After Validation (v1.x)
- [ ] JS/TS `trailingComma` segmented control — trigger: users asking for `es5`/`none`
- [ ] JS/TS `JS | TS` escape toggle — trigger: a real plain-JS paste the TS parser misformats
- [ ] HTML `htmlWhitespaceSensitivity` toggle — trigger: whitespace-significant HTML complaints

### Future Consideration (v2+)
- [ ] Other Prettier-covered languages already vendored as plugins (CSS/SCSS via postcss, GraphQL, Markdown, YAML) — only if they each independently clear the wedge; **not** in this milestone

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| HTML prettify + indent + printWidth | HIGH | LOW | P1 |
| JS/TS prettify (typescript parser) + indent + printWidth | HIGH | MEDIUM (async + lazy) | P1 |
| JS/TS semi + singleQuote toggles | HIGH | LOW | P1 |
| Error-as-value w/ Prettier `.loc` line:col | HIGH | LOW | P1 |
| FormatterView optional minify + printWidth props | HIGH | LOW | P1 |
| Async latest-wins guard | HIGH | MEDIUM | P1 |
| Defaults-match-dev-time fixture lock | MEDIUM | LOW | P1 |
| JS/TS trailingComma control | MEDIUM | LOW | P2 |
| HTML whitespace-sensitivity control | MEDIUM | LOW | P2 |
| JS \| TS escape toggle | LOW | LOW | P2 |
| Full Prettier option matrix | LOW | HIGH | P3 (anti-feature) |

**Priority key:** P1 must-have for the milestone · P2 add when cheap/validated · P3 avoid / future

## Competitor Feature Analysis

| Feature | prettier.io playground | Online "beautifiers" (beautifier.io etc.) | Our approach |
|---------|------------------------|-------------------------------------------|--------------|
| Engine | Prettier (latest) | js-beautify / custom (non-canonical) | Prettier 3.8.3, pinned = canonical/matches CI |
| Offline / privacy | Browser tab (online) | Online, code in third-party page | **Fully offline, vendored, code never leaves machine** |
| Option surface | Full matrix (overwhelming) | Many ad-hoc knobs | 3 table-stakes knobs/tool; rest at defaults |
| Minify | No (separate sites) | Some offer minify (different engine) | **Drop minify** — honest, wedge-preserving |
| Paste-instant + keyboard | Partial | No | Yes (app-wide contract) |
| JS/TS language pick | Parser dropdown | Separate pages | Single combined tool, parser auto-covers |

## Sources

- Installed `prettier@3.8.3` (`node_modules/prettier`) — empirically probed: async `format`, required `plugins`, `typescript`-parser-covers-JS/TS/JSX/TSX, `SyntaxError.loc.start`, HTML whitespace default — HIGH
- [Prettier — Browser API](https://prettier.io/docs/browser) — standalone, all-async, plugins required, estree for JS/TS/Flow/JSON — HIGH
- [Prettier 3.0 release notes](https://prettier.io/blog/2023/07/05/3.0.0.html) — async APIs, ESM plugins, `trailingComma:"all"` default — HIGH
- [Prettier — Options](https://prettier.io/docs/options) — option defaults (printWidth 80, tabWidth 2, semi true, singleQuote false, htmlWhitespaceSensitivity css, etc.) — HIGH
- Existing project surface: `src/components/FormatterView.tsx`, `src/lib/format/{types,json,xml}.ts`, `src/tools/{json,xml}-formatter/*` — read directly — HIGH

---
*Feature research for: HTML + JS/TS Prettier prettifier tools (v1.9)*
*Researched: 2026-06-30*
