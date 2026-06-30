# Stack Research

**Domain:** Offline Prettier-powered formatter tools (HTML + JS/TS) inside an existing Tauri 2 + Vite 7 + React 19 desktop app
**Researched:** 2026-06-30
**Confidence:** HIGH (every claim below verified by executing the installed `prettier@3.8.3` from this repo's `node_modules`, not from training data)

## TL;DR for the roadmapper

- **No new package install.** `prettier@3.8.3` is already in the lockfile. The ONLY manifest change is **moving `"prettier": "3.8.3"` from `devDependencies` to `dependencies`** (keep the exact pin, no `^`). Engine = the bytes already on disk → output is byte-identical to `prettier --write` by construction.
- **Import surface = `prettier/standalone` + named plugin subpaths** (all resolve to ESM `.mjs`). Never import the full `prettier` package (that's the Node build with `fs`/CLI).
- **Plugin sets (verified by execution):**
  - **JS** → `babel` + `estree`
  - **TS** → `typescript` + `estree`
  - **Combined JS/TS tool** → `babel` + `typescript` + `estree` (estree shared)
  - **HTML, structure only** → `html`
  - **HTML matching `prettier --write`** (formats embedded `<script>` JS + `<style>` CSS) → `html` + `babel` + `estree` + `postcss`. **CONFIRMED: `html` does NOT auto-pull these — without them, embedded code is left raw/unformatted.**
- **Lazy-load: already solved by the registry.** Tool components are loaded via `component: () => import("./XxxTool")` (code-split). Put the Prettier call behind a dynamic `import("prettier/standalone")` inside the format wrapper so the heavy chunk loads on first format, fully self-hosted (Vite bundles it, no CDN).
- **Bundle cost (gzipped, measured):** JS/TS tool ≈ **387 KB**, HTML tool ≈ **271 KB**; with shared-chunk hoisting the union of both tools is ≈ **483 KB gzipped**. The `typescript` plugin alone is **212 KB gz** — the single biggest cost.
- **Do NOT add** any other plugin (no `flow`, `acorn`, `meriyah`, `angular`, `markdown`, `yaml`, `graphql`, `glimmer`), no CDN/`unpkg`, no `@prettier/*` extras.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `prettier/standalone` | 3.8.3 (already installed) | Browser/no-`fs` Prettier engine (`format()` / `formatWithCursor()`) | The standalone entry has zero Node deps and no plugin auto-loading — plugins must be passed explicitly. Same package the repo's `prettier --write` runs, so identical algorithm + version → identical output. |
| `prettier/plugins/estree` | 3.8.3 | The **printer** for all JS/TS ASTs (and embedded JS in HTML) | Shared by `babel`, `typescript`, and HTML's embedded-JS path. Omitting it throws `Couldn't find plugin for AST format "estree"` (verified). |
| `prettier/plugins/babel` | 3.8.3 | JS/JSX **parser** (`parser: "babel"`) | Prettier's default JS parser; pairs with `estree`. Also the embedded-JS parser inside HTML `<script>`. |
| `prettier/plugins/typescript` | 3.8.3 | TS **parser** (`parser: "typescript"`) | Required for the TS half of the combined tool; pairs with `estree`. Largest single chunk (212 KB gz). |
| `prettier/plugins/html` | 3.8.3 | HTML **parser+printer** (`parser: "html"`) | The HTML tool's core. Reindents structure on its own; needs companion plugins to format embedded code. |
| `prettier/plugins/postcss` | 3.8.3 | CSS **parser** for embedded `<style>` (and inline `style=`) in HTML | Without it, `<style>` blocks are left raw. Needed only by the HTML tool, for `prettier --write` parity. |

### Exact plugin matrix (verified by running the installed 3.8.3)

| Tool / `parser` | Plugins to pass | Result without the companion plugins |
|---|---|---|
| JS — `parser: "babel"` | `[babel, estree]` | `babel` alone **throws** (no estree printer) |
| TS — `parser: "typescript"` | `[typescript, estree]` | `typescript` alone **throws** (no estree printer) |
| Combined JS/TS tool | `[babel, typescript, estree]` (choose `parser` per toggle/detect) | — |
| HTML structure only — `parser: "html"` | `[html]` | Works, but **embedded `<script>`/`<style>` stay unformatted** (just reindented as opaque text) |
| HTML matching `prettier --write` | `[html, babel, estree, postcss]` | Verified: this set formats embedded JS **and** CSS to canonical output |

Reproduction (run from repo root, `node`): formatting `<style>body{color:red}</style>` + `<script>const a=1;function f(){return a+2}</script>` with `[html]` only leaves both bodies raw; with `[html, babel, estree, postcss]` the CSS becomes multi-line declarations and the JS becomes `const a = 1;\nfunction f() {\n  return a + 2;\n}`. This is `embeddedLanguageFormatting: "auto"` (Prettier's default) doing its job — but only when the embedded-language plugins are present in the standalone bundle.

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | — | — | No additional runtime libs. The two tools mirror the existing `src/lib/format/` contract (`FormatResult`, `FormatOptions`, `timed()`) and the shared `FormatterView`; only the transform body changes from sync-native to async-Prettier. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `prettier` (now a runtime dep) | Still drives `pnpm format` / `format:check` over the repo | Same install satisfies both the CLI and the runtime `import`. **Bump CLI and runtime together forever** — they are the same line in `package.json` now. |
| Vite 7 code-splitting (built-in) | Auto-creates the lazy Prettier chunk(s) | No `manualChunks` needed; Rollup hoists `standalone`+`estree`+`babel` shared between the two tools into a common chunk automatically. |

## Installation

```bash
# NOTHING to install — prettier@3.8.3 is already in the lockfile.
# Manifest change only: move the existing pin from devDependencies to dependencies.
#   devDependencies: { ... "prettier": "3.8.3" ... }   ← remove
#   dependencies:    { ... "prettier": "3.8.3" ... }   ← add (exact pin, no caret)
pnpm install   # relinks; lockfile content unchanged, prettier just reclassified
```

Why move rather than duplicate: pnpm resolves one `prettier@3.8.3`. Listing it only under `dependencies` keeps the CLI working (`pnpm format` still finds it) AND makes the runtime `import` an honest, declared production dependency. Keeping it ONLY in `devDependencies` while importing it at runtime would be a lie that breaks production-only installs. Do not list it in both.

## Import surface (copy-paste exact paths)

```ts
// In the format wrapper (src/lib/format/prettier-js.ts etc.) — dynamic so the
// chunk loads on first format, never at tool mount, never in the main bundle.
const [{ format }, estree, babel, typescript] = await Promise.all([
  import("prettier/standalone"),
  import("prettier/plugins/estree"),
  import("prettier/plugins/babel"),
  import("prettier/plugins/typescript"),
]);
const out = await format(src, {
  parser: isTs ? "typescript" : "babel",
  plugins: [estree.default, babel.default, typescript.default],
  // explicit options — see parity note below
});
```

```ts
// HTML wrapper — html + the embedded-code plugins for prettier --write parity.
const [{ format }, html, babel, estree, postcss] = await Promise.all([
  import("prettier/standalone"),
  import("prettier/plugins/html"),
  import("prettier/plugins/babel"),
  import("prettier/plugins/estree"),
  import("prettier/plugins/postcss"),
]);
const out = await format(src, {
  parser: "html",
  plugins: [html.default, babel.default, estree.default, postcss.default],
});
```

Notes verified on disk:
- `prettier`'s `exports` map sends `"prettier/standalone"` → `standalone.mjs` under the `import`/`browser`/`default` conditions (ESM). Plugin subpaths → `plugins/*.mjs` (ESM). Vite picks the `import`/`browser` condition automatically.
- Plugin modules export the plugin as the **default export** (`estree.default`). With `esModuleInterop`/Vite, `import estree from "prettier/plugins/estree"` also works.
- `tsconfig` uses `"moduleResolution": "bundler"` (confirmed) → subpath-exports **types** (`plugins/*.d.ts`) resolve for `tsc --noEmit`. No `paths` shim needed.

## Output-parity (the 3.8.3 requirement) — how it's guaranteed and the one caveat

**Guaranteed:** the runtime `import "prettier/standalone"` and the CLI `prettier --write` resolve the **same `prettier@3.8.3` install**. Same version = same formatting algorithm = byte-identical output **for the same input and the same options**.

**The caveat (must be handled in the tool, not the stack):** `prettier/standalone` has no filesystem, so it **does not read `.prettierrc.json`**. The repo's config is:

```json
{ "semi": true, "singleQuote": false, "trailingComma": "all", "printWidth": 100, "tabWidth": 2 }
```

So "matches dev-time Prettier" is true only if the tool passes options explicitly. Decision for plan-phase:
- **For arbitrary pasted code** (the tool's real job), default to **Prettier's own built-in defaults** (`printWidth: 80`, `tabWidth: 2`, `semi: true`, `singleQuote: false`, `trailingComma: "all"`) and expose the option surface (mirror JSON/XML's `FormatOptions` — at least `tabWidth`/indent). This is "canonical Prettier output."
- Do **not** silently bake in `printWidth: 100`; that's a repo-specific choice, not what a user pasting a random snippet expects. Surface it as a default-80 option instead.

## Lazy-load + self-host integration (Vite 7)

The registry already lazy-loads every tool: `component: () => import("./CronTool")`. The two new tools' `index.ts` follow the identical pattern, so the tool component is **already a separate chunk**. To also keep the heavy Prettier payload out of the tool's mount path, the format wrapper does the dynamic `import("prettier/...")` (shown above), so:
- **Main bundle:** unaffected (no static prettier import anywhere — verified `grep` finds zero `from "prettier"` in `src/` today).
- **Tool chunk:** small (UI + the wrapper's dynamic-import call sites).
- **Prettier chunk(s):** fetched from the **local bundled asset** on first format. Vite/Rollup emit these into `dist/assets/` and Tauri serves them from the app bundle over `tauri://localhost` — **no network, no CDN**, satisfying the hard offline constraint.
- **Shared chunk:** `standalone`+`estree`+`babel` are imported by both tools → Rollup auto-hoists them into one shared chunk; the TS-only and HTML-only/postcss parts split off. No `manualChunks` config required.

## Bundle-size reality (gzipped, measured on the installed 3.8.3 `.mjs` files)

| Module | Raw | **Gzipped** |
|--------|-----|-------------|
| `standalone.mjs` | 95 KB | **32 KB** |
| `plugins/estree.mjs` | 206 KB | **59 KB** |
| `plugins/babel.mjs` | 320 KB | **84 KB** |
| `plugins/typescript.mjs` | 895 KB | **212 KB** |
| `plugins/postcss.mjs` | 154 KB | **45 KB** |
| `plugins/html.mjs` | 171 KB | **51 KB** |

| Per-tool chunk (first-format download) | Plugins | **Gzipped total** |
|---|---|---|
| Combined JS/TS tool | standalone+estree+babel+typescript | **≈ 387 KB** |
| HTML tool (with embedded JS+CSS parity) | standalone+html+babel+estree+postcss | **≈ 271 KB** |
| Both tools opened (union, shared-hoisted) | all six unique modules | **≈ 483 KB** |

Context: this is loaded **once, lazily, from local disk** (not over a network), and Tauri brotli-embeds the dist into the binary — so the perceived cost is a one-time decode on first open of these tools, not a per-launch or per-paste hit. The `< 2s` paste-to-result budget is comfortable: parse+print of typical snippets is single-digit ms; the only latency is the first-time chunk load/eval (local, sub-second). The `typescript` plugin (212 KB gz) dominates — accept it; it is the price of real TS formatting.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `prettier/standalone` (this exact version) | A lighter formatter (`js-beautify`, `@biomejs` wasm) | Never here — the locked goal is **output identical to the repo's Prettier**; only Prettier 3.8.3 gives that. |
| `babel` parser for JS | `acorn`/`meriyah` (espree) | Don't. Prettier's canonical JS parser is `babel`; the others change nothing for parity and add weight. |
| `typescript` parser for TS | `babel` with `parser: "babel-ts"` | `babel-ts` can parse some TS but is **not** the canonical path and can diverge from `prettier --write` on `.ts`. Use the real `typescript` plugin for parity. |
| Bundling all six plugins lazily | Single eager "format" chunk shared by both tools | Only if profiling shows the double-load is a problem; default Rollup splitting already shares the common parts. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| The full `prettier` package import (`import prettier from "prettier"`) | Pulls the Node build (`fs`, CLI, config-resolution) — won't tree-shake clean in a browser/Tauri webview | `prettier/standalone` + explicit plugins |
| CDN / `unpkg` / `https://unpkg.com/prettier@.../standalone.mjs` | Hard violation of the no-network-at-runtime constraint | Local bundled chunk via Vite dynamic `import()` |
| Extra plugins: `flow`, `acorn`, `meriyah`, `angular`, `markdown`, `yaml`, `graphql`, `glimmer` | Not needed for HTML/JS/TS; `flow` alone is 693 KB raw | Only the six listed (`standalone, estree, babel, typescript, html, postcss`) |
| A `^` / range pin on prettier | Output drift vs the CLI the instant either side floats | Exact `"3.8.3"`; bump runtime + CLI in lockstep |
| Reading `.prettierrc.json` at runtime | Standalone has no `fs`; it silently won't apply | Pass options explicitly in the `format()` call |
| Static `import` of prettier anywhere reachable from `main` | Vite would fold it into the main bundle and warn "dynamic import will not move module into another chunk" | Dynamic `import()` only, inside the lazy tool's wrapper |

## Stack Patterns by Variant

**HTML tool — full `prettier --write` fidelity:**
- Load `[html, babel, estree, postcss]`.
- Because embedded `<script>`/`<style>` are formatted only when those plugins are present, and the milestone goal is "matches dev-time Prettier."

**HTML tool — if the team decides embedded-code formatting is out of scope:**
- Load `[html]` only (saves ~188 KB gz: babel+estree+postcss).
- Trade-off: structure is canonical but `<script>`/`<style>` bodies are left as-is — **this would NOT match `prettier --write`**, so flag it explicitly as a scope cut, not a default.

**Combined JS/TS tool — language selection:**
- Auto-detect or a toggle picks `parser: "typescript"` vs `"babel"`; both share the `estree` printer. `typescript` parses plain JS too, but keep `babel` for canonical-JS parity and JSX.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `prettier@3.8.3` standalone+plugins | Vite `^7.0.4`, esbuild/Rollup | All `.mjs`, ESM, **no top-level `await`** (scanned — clean), no `require()`/`process.env` in `standalone.mjs`. No `optimizeDeps`/`build.target`/`rollupOptions` changes required. |
| `prettier@3.8.3` types | `tsconfig` `moduleResolution: "bundler"` (in use) | Subpath-export `.d.ts` resolve for `tsc`. If a future tsconfig switched to `node16`, subpath types still resolve via the `exports` map. |
| Tauri webview (WKWebView, macOS 13+) | ES2020 build target (tsconfig) | Prettier 3.8.3 standalone runs in modern WebKit; nothing here needs a newer target than the app already ships. |

## Vite 7 gotchas (verified, low-surprise)

1. **No top-level await** in any of the six modules (scanned) → no `build.target: "esnext"` bump, no TLA chunk-format issues.
2. **`standalone.mjs` has zero `require(` / `process.env`** → no Node-polyfill or `define` shims needed.
3. **Dev pre-bundling:** Vite's optimizer discovers the literal-string dynamic imports and pre-bundles the plugins on first dev use — expect a one-time "optimizing dependencies" pause in `tauri dev`, harmless. If it ever misbehaves, `optimizeDeps.exclude: ["prettier"]` is the escape hatch (not expected to be needed).
4. **Never also static-import prettier** in shipped code, or Vite warns it can't move it to a separate chunk and folds it into main. Today there are zero static imports (verified) — keep it that way.
5. **`type: "commonjs"` in prettier's `package.json` is a red herring** — the `exports` map routes the subpaths to the ESM `.mjs` builds under Vite's conditions. No interop config needed.

## Sources

- **Installed `prettier@3.8.3` in this repo's `node_modules`** — `package.json` `exports` map, plugin file inventory, gzipped sizes (`gzip -c | wc -c`), TLA/`require`/`process` scans — HIGH (authoritative: the exact bytes that will ship).
- **Live execution of `prettier/standalone` 3.8.3 from the repo** — confirmed the per-language plugin sets, the `estree`-missing throw, and that `html`-only leaves embedded `<script>`/`<style>` raw while `[html,babel,estree,postcss]` formats them — HIGH.
- **Repo `package.json` + `.prettierrc.json` + `tsconfig.json` + `vite.config.ts` + `src/lib/format/types.ts`** — confirmed existing devDep pin, prettier config for the parity caveat, `moduleResolution: bundler`, registry lazy-import pattern, and the `FormatResult`/`FormatOptions` contract the tools mirror — HIGH.

---
*Stack research for: Prettier-powered HTML + JS/TS formatter tools (v1.9), offline Tauri 2 + Vite 7 app*
*Researched: 2026-06-30*
