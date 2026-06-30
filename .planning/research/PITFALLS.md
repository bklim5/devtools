# Pitfalls Research

**Domain:** Adding Prettier standalone (HTML + JS/TS prettifier tools) to an offline Vite 7 / Tauri 2 / React 19 desktop app
**Researched:** 2026-06-30
**Confidence:** HIGH (Prettier official browser docs + 3.0 ESM release notes + tracked issues; cross-checked against this repo's existing chunk-guard + verify-bundle precedent)

> Scope note: these are pitfalls **specific to wiring Prettier standalone into THIS app** under its hard constraints (no-network-at-runtime, lazy/code-split, output must match dev-time `prettier --write` 3.8.3, `decoder.ts`+19 tests untouched, WCAG-AA, paste-instant). Generic "how to use Prettier" is omitted. Proposed milestone v1.9 starts at **Phase 31**; phase names below are proposals for the roadmapper (the engine/seam infra phase, the HTML-tool phase, the JS/TS-tool phase, and a doc/process plan).

---

## Critical Pitfalls

### Pitfall 1: Missing `estree` plugin (and wrong plugin set per language)

**What goes wrong:**
`prettier.format(code, { parser: "babel", plugins: [babel] })` throws **`Couldn't find plugin for AST format "estree"`** at runtime. The `babel`/`typescript`/`flow`/`json` parser plugins only *parse* — `estree` is the *printer* and must be in the `plugins` array for every JS/TS/JSON format. The standalone `format()` does **not** auto-resolve plugins the way the CLI/Node API does (it loads nothing implicitly), so a forgotten plugin is a hard throw, not a silent fallback.

Per-language minimum plugin sets (standalone):
- **JS/TS tool:** `babel` **+** `estree` (JS) and `typescript` **+** `estree` (TS). `estree` is shared; load it once.
- **HTML tool:** `html` — **plus `babel` + `estree` + `postcss`** if you want embedded `<script>` and `<style>` reformatted (see Pitfall 2).

**Why it happens:**
The CLI hides this — devs assume "parser: typescript" is enough. The plugin/printer split is a standalone-only surprise; training-data snippets often omit `estree`.

**How to avoid:**
Centralise plugin wiring in ONE module (`src/lib/format/prettier.ts`) that owns the `plugins:[...]` array per language; tools never pass plugins themselves. Add a unit test per language that actually formats a fixture (a throw fails the test). Treat `estree` as mandatory for the JS/TS tool.

**Warning signs:**
Runtime error string `Couldn't find plugin for AST format "estree"`; a TS format that works but a JS format that throws (or vice-versa) → mismatched plugin set.

**Phase to address:** Engine/seam infra phase (the prettier wrapper module + its per-language plugin tables), validated again in each tool phase.

---

### Pitfall 2: HTML tool silently leaves embedded `<script>`/`<style>` unformatted

**What goes wrong:**
The `html` plugin reformats markup, but to reformat code **inside** `<script>` and `<style>` it delegates to `babel`+`estree` (JS) and `postcss` (CSS). In standalone, if those plugins are not also passed, embedded blocks are left **as-is** — and this is a **silent quality regression, not a throw**. Output then diverges from dev-time `prettier --write` (which has all parsers), so the "matches Prettier" promise quietly breaks for any HTML containing scripts/styles.

**Why it happens:**
HTML "works" in a quick test with plain markup, so the missing embedded-formatter plugins go unnoticed until real-world HTML (which almost always has a `<script>`/`<style>`) is pasted.

**How to avoid:**
The HTML tool's plugin array = `[html, babel, estree, postcss]`. Add a golden fixture that is HTML **containing both a messy `<script>` and a messy `<style>`** and assert the output byte-equals `prettier --write` on the same fixture (Pitfall 8). This single test catches the silent-skip.

**Warning signs:**
HTML markup gets indented but the JS/CSS inside stays ugly; diff vs CLI Prettier shows only embedded blocks differing.

**Phase to address:** HTML-tool phase.

---

### Pitfall 3: A stray static import drags the heavy Prettier chunk into the initial bundle

**What goes wrong:**
The whole point is lazy load: Prettier standalone + babel + typescript + estree + html + postcss is **hundreds of KB to a few MB**. If *any* module on the initial load path does `import { format } from "prettier/standalone"` (or statically imports the wrapper that does), Rollup pulls it into the entry/main chunk and the app's cold-start regresses for all 11 existing tools — defeating the lazy `import()`. The registry already lazifies tool routes (proven in Phase 18: "fully lazified registry, locked chunks never load"), so the trap is a *non-route* static import: a barrel file, a type import that isn't `import type`, the shared `FormatterView`, or an eager `optimizeDeps`/preload.

**Why it happens:**
Easy to add `import` at the top of the wrapper and reference it from a shared module "just for a type" or a constant; Vite happily folds it into the entry chunk and nothing visibly breaks in dev.

**How to avoid:**
- The prettier wrapper is reached ONLY via dynamic `import()` inside the tool component (or inside the wrapper's own lazy boundary). No top-level `import` of `prettier/*` anywhere on the boot path.
- Use `import type` for any Prettier types so they erase.
- Mirror the existing registry code-split: the HTML/JS-TS tool modules are lazy registry entries; the prettier engine sits behind a further `import()` so it loads on first *format*, not merely on tool open if you want to defer even more.

**Warning signs:**
`dist/` entry chunk grows by hundreds of KB after adding the tools; `pnpm build` "(!) Some chunks are larger than 500 kB" on the **entry** chunk; cold start of the Protobuf hero slows.

**Phase to address:** Engine/seam infra phase — and **proven by Pitfall 7's build-artifact guard**, not by eyeballing.

---

### Pitfall 4: Vite `optimizeDeps` pre-bundles Prettier eager in dev (masks the real split)

**What goes wrong:**
In `tauri dev`, Vite's dep pre-bundling (esbuild `optimizeDeps`) can eagerly pre-bundle `prettier` and its plugin subpaths, so dev "feels" fine and you never notice an accidental eager path — but the **production** `vite build` (Rollup) splits differently. Worse, the multiple plugin subpath entrypoints (`prettier/plugins/babel`, `.../typescript`, `.../estree`, `.../html`, `.../postcss`) can trip "Missing/!optimized dependency" warnings or a full-reload churn.

**Why it happens:**
Dev (esbuild) and build (Rollup) are different bundlers with different defaults; "works in dev" is not "code-split in prod."

**How to avoid:**
Do **not** rely on dev behaviour for the split decision. If pre-bundle warnings appear, either `optimizeDeps.exclude: ["prettier"]` or `optimizeDeps.include` the exact subpaths to stabilise — but the source of truth is always the **production build-artifact check** (Pitfall 7). Always run the chunk guard against `vite build` output, never dev.

**Warning signs:**
Dev console "new dependencies optimized: prettier/plugins/…" + full reload on first tool open; behaviour differs between `dev` and `build`.

**Phase to address:** Engine/seam infra phase.

---

### Pitfall 5: Two copies of Prettier (runtime standalone vs the dev-tool `prettier`) → version skew

**What goes wrong:**
`prettier@3.8.3` is currently a **devDependency** used by the `prettier --write .` CLI / lefthook / `format:check`. The new tools import `prettier/standalone` + `prettier/plugins/*` **at runtime**. If these resolve to a *different* installed version (e.g. someone adds `"prettier": "^3.8.3"` in `dependencies`, or a separate `@prettier/...` package, or a caret allows a float to 3.9.x), the app's output drifts from what `prettier --write` produces locally → confusing "why does the app format differently than my pre-commit hook" diffs. This is a *real bug*, not cosmetic, because "match dev-time Prettier" is the milestone's correctness bar.

**Why it happens:**
Caret ranges, dual entries, or adding `prettier-standalone`-style shims; pnpm can hoist two versions if specs differ.

**How to avoid:**
- **ONE** Prettier package, **exact pin** (the repo already pins `3.8.3` with no caret — keep it exact). The runtime `import("prettier/standalone")` and the CLI `prettier --write` must resolve the **same** node_modules entry.
- It now legitimately serves runtime code, so it may move to (or be duplicated-spec-free in) `dependencies`; the rule is **single spec, single resolved version**. Verify with `pnpm why prettier` (expect exactly one version) in CI/preflight.
- Bump policy: change the pin in ONE place; never let dependabot/renovate float it.

**Warning signs:**
`pnpm why prettier` shows >1 version; CLI-formatted fixture ≠ app output; lockfile diff bumps prettier under a caret.

**Phase to address:** Engine/seam infra phase; **enforced by the parity golden test (Pitfall 8)** and a single-version assertion.

---

### Pitfall 6: `format()` is async — stale in-flight results race on fast typing/paste

**What goes wrong:**
Since Prettier 3.0 `prettier.format()` returns a **Promise** (and the plugins are dynamically imported, so first call also awaits a chunk download). The existing JSON/XML formatters are **pure & sync** (`JSON.stringify`/`DOMParser`), so the app's `FormatterView` idiom is "paste → instant sync transform." Naively `await`-ing per keystroke creates races: a slow format of an earlier input resolves **after** a faster later one and overwrites the pane with stale output. Also: first-format latency (chunk fetch + parse) with no loading state looks frozen; a huge paste can block the main thread inside `format()`.

**Why it happens:**
Dropping an async call into a sync-shaped view without sequencing; assuming `format()` is instant like `JSON.stringify`.

**How to avoid:**
- **Sequence/guard:** tag each format request (monotonic counter or `AbortController`-style latest-wins); apply a result only if it's still the latest input. This repo already has the exact pattern — Phase 28's `refreshEntitlements` "monotonic-sequenced so overlapping callers can't resurrect stale state." Reuse that discipline.
- **Loading state:** a calm "Formatting…" status (StatusBar already carries parse-state/timing) while the first chunk loads + format runs; keep it WCAG-AA (no opacity-only).
- **Debounce** the format trigger; paste fires one format, not one-per-char.
- **Big-input / freeze:** for very large pastes consider running Prettier in a **Web Worker** (the repo already ships the regex tool off-thread in a same-origin module Worker with a watchdog — same idiom) so the window never freezes; at minimum cap/measure and keep < 2s.

**Warning signs:**
Output flickers or shows a previous input on fast typing; spinner-less pause on first open; window unresponsive on a multi-MB paste.

**Phase to address:** Engine/seam infra phase (the async/sequenced wrapper + loading state); re-verified in both tool phases' real-WKWebView UI gate.

---

### Pitfall 7: No build-artifact PROOF that the Prettier chunk is split out of initial load

**What goes wrong:**
"It's lazy because I used `import()`" is an assumption. A future refactor (Pitfall 3) can silently re-fold Prettier into the entry chunk and only a human noticing a slow start would catch it. Without an automated guard this regresses invisibly — exactly the class of bug the app already guards for its license/updater chunks.

**Why it happens:**
The Vite asset/chunk *manifest* keys by entry module, not by what Rollup *folded in* — a static import folded into `main` leaves the manifest looking innocent (this is the precise false-GREEN the repo's `licenseUiFoldInGuard.mjs` was built to defeat).

**How to avoid (concrete — clone the existing precedent):**
Add a Vite `generateBundle` plugin — call it `prettierChunkGuard.mjs`, modeled byte-for-byte on `scripts/licenseUiFoldInGuard.mjs` — that inspects the real per-chunk `chunk.modules` inventory and asserts:
1. **No** module id matching `/node_modules\/prettier\// ` (standalone or any `prettier/plugins/*`) appears in the **entry** chunk (`file.isEntry === true`). Throw the build if it does.
2. At least one **non-entry** (async) chunk **does** contain Prettier (proves it's bundled-but-split, not accidentally externalised/missing → which would break offline).
3. Emit a load-bearing sentinel asset `prettier-chunk-inventory.json` = `{ prettierInEntryChunk: false, prettierChunkFiles: [...] }`.

Then extend `scripts/verify-appstore-bundle.sh` (or a sibling `verify` for the direct channel) to read that sentinel and FATAL on `prettierInEntryChunk:true` — same shape as the existing `licenseUiInChunks:false` / `updaterInChunks:false` assertions, with the same freshness/linkage binding so a stale clean `dist/` can't mask it. Add a `--selftest` (deliberately fold Prettier into entry → guard must RED) so the guard is proven load-bearing, exactly like the existing guard's self-test.

**Warning signs:**
Guard never fails (suspect a vacuous match — run its self-test); entry chunk size jumps; `prettierChunkFiles` empty (externalised → offline break).

**Phase to address:** Engine/seam infra phase (guard authored with the wrapper); runs in every subsequent `vite build` / phase-boundary gate.

---

### Pitfall 8: Runtime output drifts from dev-time `prettier --write` (no parity lock)

**What goes wrong:**
Even with one pinned version, default options can differ (the CLI reads `.prettierrc`/`.editorconfig`; standalone reads **nothing** — you pass options explicitly). If the tools hardcode different defaults than the repo's `prettier --write` uses, "canonical output matching dev-time Prettier" fails. Version bumps later silently change formatting too.

**Why it happens:**
Standalone has no config resolution; devs guess defaults; nobody re-checks after a Prettier bump.

**How to avoid (concrete parity lock):**
A **golden-output parity test**: keep fixtures (messy HTML-with-embedded-script/style, messy JS, messy TS) and, in a vitest case, format them with the **same** installed `prettier` via the standalone path the app uses, and assert byte-equality against the output of the **CLI** `prettier --write` on those fixtures (snapshot generated by the CLI, checked in). If the app's option set or the package version drifts, the test RED-s. Pair with a single-version assertion (`pnpm why prettier` → exactly one). This makes version-skew (Pitfall 5) and option-drift impossible to ship silently. (Decide deliberately whether the tools honour the repo `.prettierrc` defaults or expose their own option surface — mirror the JSON/XML option surface — but whatever you pick, the golden test pins it.)

**Warning signs:**
Snapshot test diff after a dependency update; user reports "app formats differently than my editor/pre-commit."

**Phase to address:** Engine/seam infra phase (parity harness); fixtures extended per tool phase.

---

### Pitfall 9: Prettier throws on partial/invalid input — must be error-as-value, never a crash or silent fallback

**What goes wrong:**
Prettier throws a `SyntaxError` (with `loc.start.line/column` for many parsers) on invalid/half-typed input. If unhandled it bubbles as an unhandled promise rejection (React error boundary / blank pane), or — worse, repeating a historical project anti-pattern — a **silent fallback** (the Protobuf tool's "never a base64 fallback or crash" rule; the URL/Cron tools' "error-as-value, never throws"). The milestone REQ explicitly says errors must surface as a calm `role=alert` value with line:col where available.

**Why it happens:**
`await format()` without try/catch; assuming pasted code is always valid; reusing a sync-formatter mental model where errors were rare.

**How to avoid:**
Wrap every `format()` in the wrapper and return a `FormatResult` discriminated union (`{ok, output}` | `{error, line?, col?}`) — same error-as-value shape as JSON (line:col) / URL / Cron. Surface `error.loc` line:col in a `role=alert`. Never substitute fallback output. Total function: invalid input → typed error, never throw past the wrapper.

**Warning signs:**
Blank output pane + console unhandled rejection on a `{` paste; no `role=alert`; output silently echoes input on bad syntax.

**Phase to address:** Engine/seam infra phase (the `FormatResult` wrapper); verified per tool.

---

### Pitfall 10: Offline / CSP — a runtime fetch of a parser, or Tauri CSP / eval blocking

**What goes wrong:**
Every Prettier browser example imports plugins from **`unpkg.com`/CDN**. Shipping any such URL violates the app's no-network-at-runtime constraint and **fails outright offline / under Tauri CSP** (the app self-hosts even fonts). Separately: some bundlers/parsers historically used `eval`/`new Function`; a strict Tauri `Content-Security-Policy` (no `unsafe-eval`) could block execution, and source-map references could 404.

**Why it happens:**
Copy-pasting the docs' `import "https://unpkg.com/prettier@.../standalone.mjs"`; not testing the actual offline `.app`.

**How to avoid:**
- Import from the **npm package only** (`prettier/standalone`, `prettier/plugins/babel`, etc.) so Vite bundles/vendors them into the app chunk — **no URL imports, ever**. This satisfies "vendored/self-hosted."
- Verify on the **real offline WKWebView** (harness step 5): open each tool with the network disabled (and/or DevTools Network tab) and confirm **zero** outbound requests during format. Add this to the e2e.
- Confirm Prettier 3.x standalone runs under the app's CSP (modern Prettier avoids `eval`; verify no `unsafe-eval` is needed). Disable/omit plugin source maps in the prod build so no `.map` 404s.

**Warning signs:**
Any `https://`/`unpkg`/`cdn` string in the bundle (grep the chunk like the existing keygen-string grep); a Network request fired on format; CSP violation in the WKWebView console; works online, breaks with Wi-Fi off.

**Phase to address:** Engine/seam infra phase (import discipline + a no-network e2e assertion); re-checked at phase-boundary on the built `.app`.

---

### Pitfall 11: ESM vs default-export interop of plugin modules under Vite (incl. a TS-types trap)

**What goes wrong:**
Prettier 3 plugins are ESM; correct usage is **namespace import** (`import * as babel from "prettier/plugins/babel"`) passed into `plugins:[...]`. A dynamic `import("prettier/plugins/estree")` yields a **module namespace object**, and `prettier`'s own TS types can flag it (`Type '{ default: ... }' is not assignable to 'string | Plugin'`, tracked issues #16501/#15136). Grabbing `.default` vs the namespace inconsistently, or default-importing a namespace-only plugin, yields "plugin not found"/parse failures at runtime — and a `tsc` error (the harness gate).

**Why it happens:**
ESM/CJS interop confusion; mixing `import x from` and `import * as x`; Prettier's types not perfectly matching dynamic-import shapes.

**How to avoid:**
Standardise on **`import * as`** (or `(await import(...))` used as the namespace) for every plugin, in the one wrapper module. If `tsc` complains on the estree dynamic import, apply the documented narrow cast at that single seam (don't scatter `any`). A passing format unit test + clean `tsc --noEmit` (gate 4) proves the interop.

**Warning signs:**
`tsc` error on the estree/typescript plugin import; runtime "Couldn't find plugin"/undefined plugin; `format` ignoring a plugin you thought you passed.

**Phase to address:** Engine/seam infra phase.

---

### Pitfall 12 (Process/Doc): stale `CLAUDE.md` "Six tools only" + the zero-dep wedge wording

**What goes wrong:**
`CLAUDE.md` still says **"Six tools only — nothing from the deferred list, no matter how easy"** (line 38, and again in the embedded Project block line 59) and **"Zero new runtime dependencies … the only runtime dep is `js-md5`. Hold this line."** Both are already false (11 tools shipped; v1.9 deliberately adds Prettier). If not corrected, future agents will either (a) refuse to add the tools citing the doc, or (b) treat the now-broken zero-dep line as license to add *any* dep (grab-bag). The doc must record the **single, scoped, deliberate** exception without opening the floodgates.

**Why it happens:**
The slim entry-point doc wasn't updated as v1.1/v1.3 grew the tool count; the milestone explicitly flags this as in-scope cleanup.

**How to avoid (exact edits):**
1. **`CLAUDE.md` line 38** ("Six tools only…") → replace with the wedge-gated wording, e.g.: *"Curated, wedge-gated tool set — growth is mechanical (registry is a plain array) but every new tool must clear the product wedge (offline, paste-instant, keyboard-driven, registry-driven, WCAG-AA). No grab-bag additions."* (Mirror PROJECT.md's already-correct Constraints wording.)
2. **`CLAUDE.md` line 3** ("Six tools, not a catalogue.") → "A curated set of high-frequency tools, not a catalogue."
3. **Embedded GSD Project block (lines 51, 59)** — these are generated from PROJECT.md; update PROJECT.md's project-start block source if it still says "six," else edit in place to match.
4. **Zero-dep wedge line (PROJECT.md "Zero new runtime dependencies"/CLAUDE.md):** keep the spirit, record the exception explicitly: *"Runtime deps are held to near-zero on purpose. Two deliberate, scoped exceptions exist: `js-md5` (Hash) and **Prettier standalone** (the HTML + JS/TS formatters, v1.9 — accepted for canonical output parity, lazy-loaded + vendored). These are explicit, reviewed exceptions — NOT a precedent for grab-bag deps; any further runtime dep needs the same deliberate sign-off."*
5. Note the prettifiers are **distinct** from the parked "HTML entity encode/decode" backlog item (PROJECT.md already says this — keep consistent).

**Warning signs:**
A future plan cites "six tools only" to block work; or cites the broken zero-dep line to justify an unrelated dep; doc count ≠ actual tool count.

**Phase to address:** A dedicated **doc/process plan** within v1.9 (cheap, do it early so downstream plans aren't blocked by the stale constraint; pairs naturally with the milestone-scoping commit).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Format on the main thread (no Worker) | Less plumbing | Huge paste freezes the window; < 2s bar at risk | OK for v1.9 launch IF inputs measured small + sequenced/debounced; revisit if freeze observed (regex-tool Worker idiom is the upgrade path) |
| Skip the golden parity test, eyeball output | Faster to ship | Silent drift vs `prettier --write` on next bump → "matches Prettier" promise breaks | Never — parity is the milestone's correctness bar |
| Reuse `FormatResult`/`FormatterView` but make wrapper sync-looking | Matches JSON/XML shape | Hides the async race (Pitfall 6) | Never — must be visibly async + sequenced |
| Caret-range or second Prettier package | Easy install | Two versions → skew (Pitfall 5) | Never — single exact pin |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Prettier standalone `format()` | Omitting `estree`; relying on auto plugin resolution | Explicit `plugins:[...]` per language, `estree` always for JS/TS/JSON |
| HTML embedded code | Loading only `html` | `[html, babel, estree, postcss]` for embedded `<script>`/`<style>` |
| Plugin imports under Vite | `import x from "prettier/plugins/estree"` (default) | `import * as x` (namespace); single cast if `tsc` flags it |
| Vendoring | `import "https://unpkg.com/..."` | npm package subpaths only; bundle vendors them offline |
| Dev vs prod split | Trusting `tauri dev` behaviour | Verify on `vite build` artifact via chunk guard |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Prettier folded into entry chunk | Cold start of all 11 tools slows; entry chunk +100s KB | chunk-guard (Pitfall 7) | The moment any boot-path module statically imports the wrapper |
| First-format latency unmasked | Tool open then a frozen-looking pause | Lazy + loading state + debounce | First open per session (chunk fetch + parse) |
| Sync format of multi-MB paste | Window unresponsive, > 2s | Off-thread Worker (regex idiom) + size measure | Large minified blobs pasted |
| Stale-result race | Output flickers to a previous input | Monotonic latest-wins sequencing | Fast typing / rapid re-paste |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| CDN/URL plugin import | Offline break + runtime network egress (constraint violation) | npm subpaths only; no-network e2e assert |
| Needing `unsafe-eval` in CSP | Weakens Tauri CSP / blocked execution | Confirm Prettier 3.x runs under strict CSP; no eval-based parser |
| Shipping plugin source maps | `.map` 404s + source leak | Omit/disable plugin source maps in prod |
| `dangerouslySetInnerHTML` for formatted HTML preview | XSS on pasted HTML | Render output as text in a code pane, escaped (regex tool already does escaped React nodes) |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No loading state on first format | Looks frozen / broken | "Formatting…" status (StatusBar carries it), WCAG-AA |
| Throw on partial input | Blank pane / crash while typing | error-as-value `role=alert` with line:col |
| Silent fallback to unformatted/echoed input | User thinks it worked; ships ugly code | Explicit typed error, never a silent fallback |
| Opacity-only disabled "Copy" during format | Fails AA | Visible focusable copy, no opacity-only (existing rule) |

## "Looks Done But Isn't" Checklist

- [ ] **JS/TS tool:** formats JS *and* TS — verify both parsers wired with shared `estree` (not just one).
- [ ] **HTML tool:** embedded `<script>` AND `<style>` reformatted — verify with a script+style fixture vs CLI, not bare markup.
- [ ] **Lazy load:** entry chunk unchanged — verify `prettier-chunk-inventory.json` sentinel `prettierInEntryChunk:false` on the `vite build` artifact, with the guard's self-test proving it's load-bearing.
- [ ] **Version parity:** golden test byte-equals `prettier --write`; `pnpm why prettier` shows exactly one version.
- [ ] **Offline:** zero network requests on format on the real `.app` with Wi-Fi off; no CDN string in the bundle.
- [ ] **Async safety:** rapid typing never shows a stale result (sequencing test); multi-MB paste doesn't freeze.
- [ ] **Errors:** `{`-only paste → calm `role=alert` line:col, no crash, no fallback.
- [ ] **Docs:** `CLAUDE.md` "six tools" + zero-dep lines corrected; Prettier recorded as the one scoped exception.
- [ ] **Immovable bar:** `decoder.ts` + its 19 tests byte-for-byte untouched; `tsc`/vitest green; both build channels (direct + appstore) build + the prettier chunk splits in both.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Prettier leaked into entry chunk | LOW (if guard exists) | Guard RED-s the build → find the static import (grep `from "prettier`), convert to `import()`/`import type`, rebuild |
| Version skew shipped | MEDIUM | Re-pin single exact version, regen lockfile, regenerate golden snapshots from CLI, re-run parity test |
| Embedded HTML left unformatted in prod | MEDIUM | Add `babel+estree+postcss` to HTML plugin set, add script+style golden fixture, rebuild |
| CDN import shipped | HIGH (offline users broken) | Replace URL imports with npm subpaths, add no-network e2e, re-verify on offline `.app` |
| Async race shipped | MEDIUM | Add monotonic sequencing (reuse refreshEntitlements idiom), add fast-typing e2e |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase (proposed) | Verification |
|---------|------------------|--------------|
| 1 Missing `estree` / wrong plugin set | Engine/seam infra | Per-language format unit test (throw fails) |
| 2 HTML embedded unformatted | HTML-tool phase | script+style golden fixture == CLI |
| 3 Static import → entry chunk | Engine/seam infra | chunk guard `prettierInEntryChunk:false` |
| 4 optimizeDeps eager in dev | Engine/seam infra | Decision made on `vite build`, not dev |
| 5 Two Prettier copies / skew | Engine/seam infra | `pnpm why prettier` == 1; golden parity |
| 6 Async stale-result race | Engine/seam infra | Fast-typing e2e; loading state on real WKWebView |
| 7 No code-split proof | Engine/seam infra | New `prettierChunkGuard.mjs` + self-test + verify-bundle assert |
| 8 Runtime ≠ dev-time output | Engine/seam infra | Golden snapshot vs `prettier --write` |
| 9 Throw on invalid input | Engine/seam infra | `role=alert` line:col; no-crash e2e |
| 10 Offline/CSP/CDN | Engine/seam infra | No-network e2e on offline `.app`; bundle grep clean |
| 11 ESM/default-export interop | Engine/seam infra | clean `tsc --noEmit` + format test |
| 12 Stale docs / wedge wording | Doc/process plan (early) | Doc reflects 13 tools + one scoped Prettier exception |

## Sources

- [Browser · Prettier](https://prettier.io/docs/browser) — standalone API, explicit `plugins:[...]` (no auto-resolution), per-language plugin/parser list, `estree` requirement, embedded-code plugin requirement, ESM vs UMD import paths (HIGH)
- [Prettier 3.0: Hello, ECMAScript Modules!](https://prettier.io/blog/2023/07/05/3.0.0.html) — `format()` is async, plugins load via dynamic `import()`, ESM plugins (HIGH)
- [Issue #15078 — Couldn't find plugin for AST format "estree"](https://github.com/prettier/prettier/issues/15078) — the canonical missing-estree error (HIGH)
- [Discussion #16778 — formatting script tags / embedded code](https://github.com/prettier/prettier/discussions/16778) — embedded `<script>` left unformatted without the related plugins (HIGH)
- [Issue #16501](https://github.com/prettier/prettier/issues/16501) / [#15136](https://github.com/prettier/prettier/issues/15136) — dynamic-import estree default-export TS interop trap (MEDIUM)
- Repo precedent: `scripts/licenseUiFoldInGuard.mjs` + `scripts/verify-appstore-bundle.sh` (chunk.modules inventory + sentinel + self-test) — the exact pattern to clone for the Prettier code-split proof (HIGH)
- Repo context: `.planning/PROJECT.md` (constraints, zero-dep wedge, async sequencing precedent in Phase 28 `refreshEntitlements`, regex-tool Worker idiom), `CLAUDE.md` (stale "six tools" + zero-dep lines), `package.json` (`prettier 3.8.3` exact, vite 7) (HIGH)

---
*Pitfalls research for: adding Prettier standalone (HTML + JS/TS formatters) to an offline Vite/Tauri/React desktop app*
*Researched: 2026-06-30*
