# Architecture Research — v1.9 Prettier Formatters

**Domain:** Integrating two async/lazy Prettier-backed formatter tools (HTML + combined JS/TS) into an existing registry-driven Tauri 2 + Vite + React 19 + TS desktop app
**Researched:** 2026-06-30
**Confidence:** HIGH (read against the real files; Prettier API verified against the installed `node_modules/prettier@3.8.3`)

---

## TL;DR (the five answers)

1. **Where the wrapper lives** — new async module `src/lib/format/prettier.ts` returning `Promise<FormatResult>` (same discriminated union, async signature). Reuse the existing `FormatResult`/`FormatOptions` types in `src/lib/format/types.ts` unchanged. The sync `useMemo(() => timed(formatJson(...)))` pattern is replaced by an **effect-driven, debounced, request-id-gated** async run — modeled on the **regex tool's** `useEffect` (`reqIdRef` stale-drop), minus the worker/`terminate`.
2. **Lazy-load boundary** — a **memoized dynamic `import()` inside `src/lib/format/prettier.ts`** (engine + per-language plugins), NOT the registry split alone and NOT `React.lazy`. The registry's existing per-tool `lazy()` keeps the tool *component* out of the initial bundle; the dynamic `import()` inside the wrapper keeps the **heavy Prettier engine out of even the tool chunk** until a format actually runs. Net: the main/sidebar/palette bundle is provably unchanged.
3. **Main thread vs Worker** — **MAIN THREAD.** The regex worker exists ONLY because catastrophic backtracking is *uninterruptible* (a liveness/freeze threat). Prettier parsing is ~linear with no hostile-input freeze class; KB-scale pastes format in tens of ms — comfortably inside the <2s feel. A worker would fragment the lazy chunk (worker has its own module graph → risks duplicating the Prettier engine) and add postMessage cost for zero common-case benefit.
4. **Sharing the engine across both tools** — module-level **memoized load promises** in `prettier.ts` (`loadStandalone()`, `loadHtmlPlugin()`, `loadScriptPlugins()`). The ES module cache + the memo guard mean both tools resolve the *same* engine chunk; per-language plugins load only for the language in use.
5. **Registry/sidebar/palette/router** — **nothing special.** Two new `ToolDefinition`s appended to `TOOLS` in `src/lib/tools/registry.ts`, each `component: () => import("./XxxTool")`. No `requiredEntitlements` (free tier). All shell surfaces auto-derive. The only net-new shared-component work is a small **FormatterView generalization** (make `minify` optional, add an optional language/extra-control slot).

---

## Standard Architecture (target integration)

```
┌──────────────────────────────────────────────────────────────────────┐
│  REGISTRY (single control plane) — src/lib/tools/registry.ts          │
│  TOOLS[] += htmlFormatterTool, jsTsFormatterTool                      │
│  → sidebar · ⌘K palette · HashRouter all auto-derive (unchanged code) │
└───────────────┬──────────────────────────────────────────────────────┘
                │ ToolRoute → React.lazy(tool.component)  [existing split]
                ▼
┌──────────────────────────────────────────────────────────────────────┐
│  TOOL COMPONENTS (lazy chunks, fetched on tool open)                  │
│  src/tools/html-formatter/HtmlFormatterTool.tsx                       │
│  src/tools/js-ts-formatter/JsTsFormatterTool.tsx                      │
│  - own input + option state                                          │
│  - useAsyncFormat() effect: debounce → call wrapper → id-gate result  │
│  - render <FormatterView> (shared shell)                             │
└───────────────┬───────────────────────────────┬──────────────────────┘
                │ import (static, in-chunk)      │ import (static, in-chunk)
                ▼                                 ▼
┌──────────────────────────────────────┐  ┌───────────────────────────┐
│  src/lib/format/prettier.ts          │  │  src/shell/useAsyncFormat  │
│  formatHtml(input, opts)             │  │  (shared async hook:       │
│  formatScript(input, lang, opts)     │  │   debounce + reqId gate +  │
│   → Promise<FormatResult>            │  │   pending flag)            │
│   memoized dynamic import():         │  └───────────────────────────┘
│     loadStandalone()  ── prettier/standalone   ◄── HEAVY, lazy
│     loadHtmlPlugin()  ── prettier/plugins/html      async chunks,
│     loadScriptPlugins()── babel+estree+typescript   shared via module
│   error → {line,col} mapping (reuse offsetToLineCol idiom)            │
└──────────────────────────────────────────────────────────────────────┘
                │ reuse, unchanged
                ▼
┌──────────────────────────────────────────────────────────────────────┐
│  src/lib/format/types.ts  (FormatResult, FormatOptions, IndentMode)   │
│  src/components/FormatterView.tsx  (shared 2-pane shell — minor edit)  │
│  src/lib/platform  (clipboard copy seam — unchanged)                  │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | New / Modified |
|-----------|----------------|----------------|
| `src/lib/format/prettier.ts` | Async Prettier wrapper: lazy engine+plugin load (memoized), `format()` call, error→FormatResult mapping | **NEW** |
| `src/lib/format/types.ts` | `FormatResult`/`FormatOptions`/`IndentMode` — reused verbatim; `timed()` stays (sync) but is not used by the async path | unchanged |
| `src/shell/useAsyncFormat.ts` (or inline) | Shared effect: debounce, request-id gate (drop stale resolves), pending flag, run-on-input/opts-change | **NEW** (recommended) — avoids duplicating regex-style cancellation in both tools |
| `src/tools/html-formatter/` | HTML tool component + `index.ts` (ToolDefinition) | **NEW** |
| `src/tools/js-ts-formatter/` | JS/TS tool component (language auto-detect/toggle) + `index.ts` | **NEW** |
| `src/components/FormatterView.tsx` | Shared 2-pane shell; make `minify` optional (mirror `sortKeys`), add optional language/extra-control slot | **MODIFIED (small)** |
| `src/components/StatusBar.tsx` | `ParseState` = `"ok"\|"error"\|"empty"` — add a pending affordance OR surface `pending` separately (see §Loading state) | **MODIFIED (tiny) or left as-is** |
| `src/lib/tools/registry.ts` | Append 2 entries to `TOOLS[]` | **MODIFIED (2 lines + 2 imports)** |
| `package.json` | `prettier` moves `devDependencies → dependencies` (first deliberate heavy runtime dep) | **MODIFIED** |

---

## (1) Where the wrapper lives + sync→async FormatResult reconciliation

### The contract stays identical, the signature goes async

The existing pure formatters (`src/lib/format/json.ts`, `xml.ts`) return `FormatResult` *synchronously*. Prettier 3's `format()` returns a `Promise<string>` (confirmed: `typeof prettier.format === "function"`, async since v3). So:

```ts
// src/lib/format/prettier.ts  (NEW)
import type { FormatOptions, FormatResult } from "./types";

export type ScriptLang = "babel" | "typescript"; // JS vs TS parser selection

export async function formatHtml(input: string, opts: FormatOptions): Promise<FormatResult> { … }
export async function formatScript(input: string, lang: ScriptLang, opts: FormatOptions): Promise<FormatResult> { … }
```

- **Same discriminated union** (`{ok:true,output,inputBytes,outputBytes}` | `{ok:false,error:{message,line?,col?}}`) — downstream `FormatterView`/`StatusBar` wiring is unchanged.
- **Empty/whitespace input** → `{ok:true, output:"", …0}` (same `"empty"` convention as JSON, D-08). Short-circuit **before** loading the engine so a blank tool never pulls the heavy chunk.
- **Parse error** → Prettier throws a `SyntaxError`-like with `err.loc.start.{line,column}`. Catch → `{ok:false, error:{message, line, col}}`. (Prettier already gives line/col directly — no need to port JSON's `offsetToLineCol` snippet-scraping; the column is typically 0-based, normalize to 1-based to match the JSON tool's display.)
- **Error-as-value, never throws** out of the wrapper — same invariant as the sync formatters.

### Why NOT the sync `useMemo(() => timed(formatX()))` pattern

`useMemo` must be synchronous; you cannot `await` in it. Two viable async patterns exist in the codebase — the cron/JSON sync `useMemo`, and the **regex async effect**. The Prettier tools must follow the **regex precedent** (`src/tools/regex/RegexTool.tsx`, lines 151–215):

```
on [input, opts] change:
  clear pending debounce timer
  if empty → bump reqId (drops any in-flight resolve), set empty state, return
  debounce(DEBOUNCE_MS):
    const id = ++reqIdRef.current
    setPending(true)
    formatX(input, opts).then(result => {
      if (id !== reqIdRef.current) return   // STALE — drop (cancellation)
      setPending(false); setResult(result)
    })
```

- **Stale-cancellation = request-id gating**, exactly as regex does it. Prettier offers no `AbortController` and a parse is short/uninterruptible anyway, so id-gating (ignore late resolves) is the correct and sufficient cancellation. **No `worker.terminate()` equivalent is needed** — there is no wedged thread to kill.
- **Debounce** (~80–120 ms, regex uses 80) coalesces fast typing; paste fires one run. Keep the *paste-instant* promise — sub-second on KB inputs even with the one-time engine load amortized by prefetch (below).
- **Cleanup on unmount**: clear timers, bump reqId. (No worker to terminate.)

### Loading state

`ParseState` is `"ok" | "error" | "empty"` (no pending member). Two options, plan's call:
- **(a) Minimal:** keep showing the *previous* good output while a new format resolves, plus a subtle `pending` indicator (e.g. status text "Formatting…") only if resolution exceeds ~150 ms. Avoids layout flashes (the app's stated anti-flash stance — `Suspense fallback={null}` everywhere).
- **(b) Add a `"formatting"` ParseState** member to `StatusBar`. Slightly more invasive (touches the shared StatusBar label map + its tests).
Recommend **(a)** — a separate `pending` boolean surfaced as a status hint; `ParseState` untouched. First-format engine-load latency is hidden by **prefetch** (below), so pending is rarely visible.

### Timing

The sync `timed()` helper wraps a sync thunk; for async, measure around the `await` of the format only (exclude the one-time engine import, or report it separately) so `timingMs` reflects format cost, not cold-load cost.

---

## (2) Lazy-load boundary — dynamic `import()` inside the wrapper (RECOMMENDED)

Three candidate boundaries were considered:

| Boundary | What loads when | Verdict |
|----------|-----------------|---------|
| **Registry `lazy()` only** (tool statically imports prettier) | Engine lands in the tool's chunk (or a shared chunk), fetched on **tool open** | Works, but loads the engine even if the user opens the tool and never pastes; and bloats the tool chunk |
| **`React.lazy` at the component** | Same as above — `React.lazy` is for *components*, not a data library; wrong primitive for the engine | Reject |
| **Dynamic `import()` inside `prettier.ts`** (memoized) | Engine loads on **first `format()` call** (first paste), in its own async chunk(s); tool open stays cheap | **RECOMMENDED** |

**Why the wrapper-level dynamic `import()` is cleanest:**
- The registry's `ToolRoute` already `React.lazy(tool.component)`-splits the tool component (`src/components/ToolRoute.tsx`) — the tool UI is out of the initial bundle. Adding a dynamic `import()` *inside* the wrapper pushes the **heavy engine one layer deeper**: out of the initial bundle AND out of the tool chunk, into dedicated `prettier-*` async chunks.
- **The rest of the app's bundle is provably unchanged** — Prettier appears only in chunks reachable via `import("prettier/standalone")` / `import("prettier/plugins/*")`, which are only referenced from `src/lib/format/prettier.ts`, which is only statically imported from the two lazy tool chunks. Nothing in the eager path (registry, sidebar, palette, App shell) touches it.
- This mirrors the project's existing **chunk-isolation discipline** (the appstore licenseUi fold-in guard in `vite.config.ts` + `licenseUiFoldInGuard.mjs`). Add a symmetric verification: assert `prettier` does NOT appear in the initial/main chunk module inventory. Cheap harness fit.

```ts
// src/lib/format/prettier.ts — memoized lazy loads (load-once, shared)
let standaloneP: Promise<typeof import("prettier/standalone")> | undefined;
const loadStandalone = () => (standaloneP ??= import("prettier/standalone"));

let htmlP: Promise<unknown> | undefined;
const loadHtmlPlugin = () => (htmlP ??= import("prettier/plugins/html"));

let scriptP: Promise<[unknown, unknown, unknown]> | undefined;
const loadScriptPlugins = () =>
  (scriptP ??= Promise.all([
    import("prettier/plugins/babel"),
    import("prettier/plugins/estree"),     // REQUIRED printer for babel + typescript parsers
    import("prettier/plugins/typescript"),
  ]));
```

**Plugin facts (verified against `node_modules/prettier@3.8.3/plugins/`):**
- HTML tool needs **`prettier/plugins/html`** only (`parser: "html"`).
- JS/TS tool needs **`prettier/plugins/babel`** (or `typescript`) **+ `prettier/plugins/estree`** (the estree *printer* is mandatory for both JS-via-babel and TS). Use `parser: "babel"` / `"babel-ts"` for JS, `parser: "typescript"` for TS.
- Loading per-language means **opening HTML does not pull the babel/typescript parsers** and vice-versa — finer-grained than a single shared "all plugins" chunk.

**Prefetch to hide first-paste latency (optional, recommended):** in the tool component's mount `useEffect`, fire `void loadStandalone()` (+ the language's plugins) so the engine warms while the user reads/pastes; the actual `format()` awaits the *same* memoized promise. Best of both: cheap tool-open, warm-by-paste.

---

## (3) Main thread vs Web Worker — MAIN THREAD (decided)

| Factor | Regex tool (worker) | Prettier tools (main thread) |
|--------|---------------------|------------------------------|
| Threat class | **Catastrophic backtracking** — synchronous, **uninterruptible**; `terminate()` is the only kill (would freeze the window) | None of that class. Parsing is ~linear; no pathological freeze. |
| Why off-thread | **Liveness safety**, not perf | N/A |
| Typical workload | n/a | KB-scale paste → tens of ms format |
| Lazy-chunk sharing | worker has its own graph (fine, regex.ts is tiny) | a worker would need its **own** `import("prettier/...")` → **risks duplicating the heavy engine chunk** across main + worker graphs |
| Decision | Worker (justified) | **Main thread** |

**Reasoning:** the <2s budget is for *typical* paste sizes; Prettier formats those in well under 100 ms on JSC/WKWebView. The async `format()` already yields a microtask boundary; with debounce + id-gating the UI stays responsive. A worker buys nothing for the common case and actively complicates the single biggest architectural goal (one shared, deduplicated lazy engine chunk). **Mitigation for pathological huge pastes** (if ever observed at the gate): an input-size soft cap or a "format" button above N bytes — *not* a worker. Keep it simple; revisit only if the real-WKWebView gate shows jank.

---

## (4) Sharing the engine load between the two tools

`src/lib/format/prettier.ts` is a **single module** holding the memoized load promises (above). Both `formatHtml` and `formatScript` call `loadStandalone()`; the `??=` memo + the ES module cache guarantee the `prettier/standalone` chunk is fetched/parsed **once**, shared by both tools (and across remounts). Per-language plugins (`loadHtmlPlugin` / `loadScriptPlugins`) load independently and once each. No duplicated import logic in the components; no duplicated chunk. The shared **async-format effect** (`useAsyncFormat`) further dedups the debounce/id-gate/pending machinery so each tool component stays as thin as `JsonFormatterTool.tsx` (~60 lines).

---

## (5) Registry / sidebar / palette / router additions

**Nothing special vs a normal tool.** Append two `ToolDefinition`s to `TOOLS[]` in `src/lib/tools/registry.ts` (mirror `jsonFormatterTool`):

```ts
// src/tools/html-formatter/index.ts
export const htmlFormatterTool: ToolDefinition = {
  id: "html-formatter",
  name: "HTML",
  description: "HTML prettify (Prettier)",
  category: "formatting",
  keywords: ["html", "format", "prettify", "prettier", "markup"],
  icon: Code,                                  // lucide-react
  component: () => import("./HtmlFormatterTool"),
  enabled: true,
};

// src/tools/js-ts-formatter/index.ts  → id "js-ts-formatter", name "JS / TS",
//   keywords ["javascript","typescript","js","ts","format","prettify","prettier"]
```

- Sidebar, ⌘K palette, HashRouter all auto-derive — no per-surface wiring (single control plane, confirmed by `registry.ts` + `ToolRoute.tsx`).
- **No `requiredEntitlements`** — PROJECT states the free tier keeps all tools; these ship unlocked/dormant like the others (D-18).
- The `LazyComponent` contract (`() => Promise<{default: ComponentType}>`) already supports this; the component's default export is the tool, exactly like `JsonFormatterTool`.
- **One genuinely shared change:** `FormatterView.tsx` currently makes `minify`/`onMinify` **required** and only `sortKeys` optional. Prettier doesn't minify HTML or JS/TS cleanly, so for these tools **make `minify` optional** (render the toggle only when `onMinify` is supplied — same idiom as `onSortKeys`), and add an **optional language SegmentedControl slot** for the JS/TS tool (JS | TS | Auto). The existing `SegmentedControl` component (`src/components/SegmentedControl.tsx`, already extracted in Phase 13) is the right primitive. Map options: `indent "2"/"4" → tabWidth`, `indent "tab" → useTabs:true`. Consider exposing `printWidth` later; not required for MVP.

---

## Patterns to follow

### Pattern: async error-as-value wrapper over a throwing library
Catch Prettier's throw at the wrapper boundary, map `err.loc` → `{line,col}`, return `{ok:false,error}`. Never let it escape. (Same discipline as `formatJson`'s `try/catch`.)

### Pattern: request-id gated async effect (the regex precedent)
`reqIdRef` monotonic counter; on resolve, `if (id !== reqIdRef.current) return`. This is the project's established stale-result cancellation — reuse it verbatim, drop the worker/terminate parts.

### Pattern: memoized dynamic import singleton
`let p; const load = () => (p ??= import(...))`. Load-once, shared, lazy. Matches the codebase's chunk-isolation ethos.

---

## Anti-patterns to avoid

| Anti-pattern | Why bad | Instead |
|--------------|---------|---------|
| Static `import "prettier/standalone"` anywhere in the eager path (registry/sidebar/App) | Folds the heavy engine into the initial bundle — defeats the whole lazy requirement | Dynamic `import()` only, from `prettier.ts`, reached only via lazy tool chunks |
| `await` inside `useMemo` / forcing the sync `timed()` path | Impossible (useMemo is sync); would mean a blocking call | Effect + debounce + id-gate (regex pattern) |
| Putting Prettier in a Web Worker | Duplicates the heavy chunk across graphs; solves a freeze problem that doesn't exist here | Main thread |
| Per-render `React.lazy` / per-render `import()` for the engine | Refetch/remount churn (see ToolRoute's `lazyCache` comment, lines 27–38) | Module-level memo singletons |
| Loading ALL plugins for both tools | HTML tool needlessly pulls babel/typescript parsers | Per-language plugin loaders |
| Flashing a Suspense/loading fallback on format | Against the app's anti-flash stance (`fallback={null}` everywhere) | Keep previous output; subtle `pending` only past a threshold |
| Forgetting `prettier/plugins/estree` | Babel/TS parsers fail without the estree printer | Always load estree with babel/typescript |

---

## Scalability / performance considerations

| Concern | Typical paste (≤ tens of KB) | Large paste (100s of KB) | Pathological (MBs) |
|---------|------------------------------|--------------------------|--------------------|
| Format latency | tens of ms, main thread, < 2s easily | sub-second; debounce coalesces | soft input cap / "Format" button if the gate shows jank — **not** a worker |
| Cold engine load | one-time `import()` (~hundreds of KB parse); hidden by mount prefetch | same, amortized | same |
| Bundle impact on rest of app | **zero** (isolated async chunks) | — | — |

---

## Suggested build order (dependency-respecting)

1. **Engine wrapper + contract foundation** — `src/lib/format/prettier.ts` (`formatHtml`, `formatScript`, memoized lazy loads, error→line:col mapping) **+ unit tests** (parse-error fixtures, empty-input short-circuit, indent/tab mapping). Move `prettier` `devDependencies → dependencies` in `package.json`. *Foundation — both tools depend on it.* Per the TDD-with-impl note in memory (lefthook rejects RED-only commits), land tests GREEN with the module.
2. **Shared async plumbing** — `src/shell/useAsyncFormat.ts` (debounce + reqId gate + pending, the regex pattern minus the worker) **and** the small `FormatterView` generalization (optional `minify`, optional language/extra-control slot). *Both tools depend on these; do before the tools.*
3. **HTML tool** — `src/tools/html-formatter/{HtmlFormatterTool.tsx,index.ts}` + register in `registry.ts`. Single parser → simpler; ship first. Depends on 1+2.
4. **JS/TS tool** — `src/tools/js-ts-formatter/{JsTsFormatterTool.tsx,index.ts}` + register. Adds the JS|TS|Auto language toggle + multi-plugin load (babel/estree/typescript). Depends on 1+2. (3 and 4 are independent chunks — parallelizable after 2, but the harness gates apply per plan.)
5. **Doc + isolation guard + harness** — correct the stale `CLAUDE.md` "six tools only" line; add a chunk-inventory assertion that `prettier` is absent from the initial/main chunk (mirror `licenseUiFoldInGuard`); full real-WKWebView UI pass on both build channels + `gsd-ui-review` WCAG-AA. Confirm `decoder.ts` + its 19 tests byte-for-byte untouched.

**Dependency summary:** `1 → 2 → {3, 4} → 5`. Engine wrapper first (everything needs it), shared hook/FormatterView second (both tools need them), tools next (independent), doc/guard/verify last.

---

## Open questions / gaps for plan-phase

- **Column base:** confirm Prettier's `err.loc.column` is 0- vs 1-based on JSC/WKWebView and normalize to match the JSON tool's display (verify at the unit layer with a real malformed-input fixture).
- **HTML embedded CSS/JS:** the `html` plugin formats embedded `<style>`/`<script>` only if the relevant sub-plugins (postcss/babel) are also loaded. Decide whether MVP loads only `html` (embedded blocks left as-is) or also pulls postcss/babel. Recommend **html-only for MVP** (smaller chunk; revisit if users expect embedded formatting).
- **`minify` semantics:** PROJECT says "minify is whatever Prettier supports cleanly per language" — Prettier supports none cleanly for HTML/JS/TS, so recommend **omitting the minify toggle** for these tools (hence the FormatterView optional-minify change). Confirm with the user at plan time.
- **Vendoring/self-host check:** Prettier's standalone + plugins are pure JS bundled by Vite into local chunks — no CDN, satisfies no-network-at-runtime by construction. Verify the built chunks contain no remote fetches (they don't, but assert at the gate).

---

## Sources

- Live codebase reads (HIGH): `src/lib/format/{types.ts,json.ts}`, `src/components/FormatterView.tsx`, `src/tools/json-formatter/{JsonFormatterTool.tsx,index.ts}`, `src/tools/regex/RegexTool.tsx` (async/id-gate precedent) + `src/lib/regex/worker.ts`, `src/lib/tools/{registry.ts,types.ts}`, `src/components/ToolRoute.tsx`, `src/components/StatusBar.tsx`, `vite.config.ts`, `src-tauri/tauri.conf.json` (CSP), `package.json`.
- Prettier API/plugins (HIGH — verified on installed `prettier@3.8.3`): `node_modules/prettier/standalone.js` exposes async `format`; `node_modules/prettier/plugins/{html,babel,estree,typescript}.{js,mjs}` present. Prettier 3 `format()` returns a Promise (async since v3).
- `.planning/PROJECT.md` — v1.9 milestone scope, constraints, resolved decisions.
