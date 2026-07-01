---
phase: 32-prettier-esbuild-engine-async-seam
plan: 04
subsystem: formatters
tags: [esbuild, minify, wasm, offline, html]

# Dependency graph
requires:
  - phase: 32-prettier-esbuild-engine-async-seam
    plan: 01
    provides: "the PRETTIFY half of the seam (formatScript/formatHtml) this MINIFY half parallels; the FormatResult contract + lazy-memoized dynamic-import discipline"
provides:
  - "src/lib/format/minify.ts — minifyScript(input, loader) via lazily-loaded, memoized-init esbuild-wasm (js/ts/jsx/tsx/css) + minifyHtml(input) pure offline collapse; both → Promise<FormatResult>, error-as-value"
  - "esbuild-wasm 0.28.0 as a single exact-pinned production dependency (vendored/self-hosted offline, lazy-loaded via dynamic import + local esbuild.wasm ?url asset)"
  - "embedded <script>/<style> minification with D-07 no-silent-fallback: a failing block returns ok:false with block type + HTML-document line:col"
  - "__setEsbuildInitForTest hook — engine-loading swap so the wrapper is testable off the Vite asset pipeline"
affects: [33-html-tool, 34-js-ts-tool, 32-05-offline-build-proof]

# Tech tracking
tech-stack:
  added: ["esbuild-wasm 0.28.0 (second scoped heavy runtime-dep exception; minify engine for code languages)"]
  patterns:
    - "Dynamic-import() memoized-init engine loader (esbuildPromise ??= import(...); initPromise ??= initialize(...)) — esbuild.initialize (throws if called twice) fires once"
    - "Error-as-value wrapper returning the shared FormatResult (never throws past the seam); empty input short-circuits BEFORE any engine load/init"
    - "Bounded zero-dep HTML minifier: one segmenting regex (pre/textarea | script/style | comment) with the gaps whitespace-collapsed; embedded code delegated to minifyScript"

key-files:
  created:
    - "src/lib/format/minify.ts"
    - "src/lib/format/minify.test.ts"
  modified:
    - "package.json (esbuild-wasm 0.28.0 added to dependencies, exact pin)"
    - "pnpm-lock.yaml"

key-decisions:
  - "esbuild-wasm pinned to 0.28.0 to match the esbuild version Vite already resolves in the tree (no third esbuild version floated in)"
  - "HTML minifier is a pure bounded STRING transform (not DOMParser) — avoids the jsdom cross-realm TextEncoder invariant that breaks esbuild, and gives predictable pre/script/style/comment segmentation + error mapping"
  - "Whitespace collapse = /\\s+/→single space (exactly the browser's normal-flow rendering) — provably semantically equivalent, not lossy inter-element removal"
  - "vitest runs the esbuild-wasm NODE build (the app's browser build is Vite-only); its initialize() self-loads the vendored service and rejects wasmURL/wasmModule/worker, so the test init provider returns {} — real transform exercised, only engine-loading swapped"

patterns-established:
  - "Test-only engine-loading hook (__setEsbuildInitForTest) keeps the production offline ?url path CDN-free while making the wrapper unit-testable"
  - "Embedded-block failure → ok:false with best-effort document line:col (engine line/col offset by the block's start position)"

requirements-completed: [PRT-06]

# Metrics
duration: ~7min
completed: 2026-07-01
---

# Phase 32 Plan 04: esbuild-wasm Minify Engine + Offline HTML Minifier Summary

**A lazily-loaded, offline, memoized esbuild-wasm `minifyScript` (JS/TS/JSX/TSX + CSS, no ASI/regex-literal breakage) plus a pure zero-dep `minifyHtml` (whitespace collapse + comment strip + preserved pre/textarea + embedded code minified through esbuild) — both returning error-as-value `FormatResult`, with an embedded-block failure surfacing as `ok:false` (block type + line:col) instead of a silent skip.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-07-01T13:13Z
- **Completed:** 2026-07-01T13:20Z
- **Tasks:** 2
- **Files created/modified:** 4

## Accomplishments
- `src/lib/format/minify.ts` `minifyScript(input, loader)`: minifies via `esbuild.transform` (transform-only, NEVER `build` — no bundling), loaded ONLY via memoized dynamic `import("esbuild-wasm")` + a local `esbuild.wasm?url` asset (no remote fetch). Empty input short-circuits to the neutral ok value BEFORE any engine load/init; invalid input → `{ok:false, error:{message, line, col}}` (1-based col from esbuild's 0-based `.errors[0].location.column + 1`), never a throw. `esbuild.initialize` is memoized so it runs at most once across racing calls.
- `minifyHtml(input)`: a bounded, zero-dep offline string transform — one segmenting regex handles `<pre>`/`<textarea>` (verbatim), `<script>`/`<style>` (body → `minifyScript` js/css), and comments (non-conditional stripped, IE conditional preserved); the gaps between matches are whitespace-collapsed (`\s+`→single space = browser normal-flow rendering, semantically equivalent). Output trimmed.
- **D-07/PRT-04 no-silent-fallback:** a broken embedded `<script>`/`<style>` returns `{ok:false}` with `message: "<script> block: …"` and a best-effort HTML-document `line`/`col` (engine position offset by the block body's document start), NEVER `ok:true` shipping the raw block.
- esbuild-wasm `0.28.0` added as a single exact-pinned production dependency (no caret), vendored/self-hosted offline + lazy-loaded.
- 18 unit tests (9 minifyScript incl. explicit ASI + regex-literal + invalid→ok:false + init-once; 9 minifyHtml incl. whitespace collapse, comment strip, `<pre>` preserved, embedded script+style minified, and the broken-`<script>`→ok:false with line:col).

## Task Commits

1. **Task 1: esbuild-wasm minifyScript (JS/TS/JSX/TSX/CSS) + dep add (RED→GREEN)** — `8cdca8fe` (feat)
2. **Task 2: Offline pure HTML minifier (RED→GREEN)** — `cc96149a` (feat)

_TDD landed GREEN with impl per the project's lefthook-rejects-RED-only learning (tdd-red-commits-blocked-by-lefthook)._

## Files Created/Modified
- `src/lib/format/minify.ts` — the minify engine wrappers (minifyScript via esbuild-wasm + minifyHtml pure; error-as-value; test-only init hook).
- `src/lib/format/minify.test.ts` — 18 unit cases (node env; injects an empty init provider so esbuild's node build self-loads its vendored service).
- `package.json` — esbuild-wasm 0.28.0 (exact pin) added to dependencies.
- `pnpm-lock.yaml` — locked.

## Decisions Made
- **HTML minifier is a pure string transform, not DOMParser** (Deviation 1) — the plan offered DOM or string at discretion; jsdom's cross-realm TextEncoder trips esbuild's invariant, and a bounded segmenting regex gives cleaner pre/script/style/comment handling + error-position mapping.
- **esbuild-wasm pinned to 0.28.0** to line up with the esbuild version already in the tree via Vite (no third esbuild version).
- **Whitespace collapse to a single space** (not full inter-element removal) — the safe, semantically-equivalent minification (matches browser rendering).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] esbuild-wasm can't run under jsdom / doesn't take browser init flags in node → node env + empty init provider (not the planned wasm-file:// hook)**
- **Found during:** Task 1 (first test run)
- **Issue:** The plan suggested a `jsdom` test env with an injected wasm `file://` path. Two blockers surfaced empirically: (a) under jsdom, `new TextEncoder().encode("") instanceof Uint8Array` is `false` (cross-realm Uint8Array), which esbuild's own startup invariant rejects with "your JavaScript environment is broken"; (b) esbuild-wasm resolves to its **node** build under vitest (the `browser` package field is Vite-only), and that build's `initialize()` throws on the browser-only `wasmURL`/`wasmModule`/`worker` flags — it self-loads the vendored service from `bin/esbuild`.
- **Fix:** Run the spec in the default `node` env (real Uint8Array; the HTML minifier is pure-string so needs no DOM) and have the injected init provider return `{}` so the node build self-loads. The PRODUCTION browser path is unchanged and offline: `esbuild.initialize({ wasmURL: (await import("esbuild-wasm/esbuild.wasm?url")).default, worker: false })`. This still exercises the real esbuild transform end-to-end — only the engine-loading is swapped, exactly the plan's stated intent ("testable off the Vite asset pipeline; keep the browser path CDN-free").
- **Files modified:** src/lib/format/minify.test.ts (env + provider), src/lib/format/minify.ts (init hook shape accommodates both)
- **Verification:** minify.test.ts 18/18; `initCalls === 1` proves single init; empty-input test proves no init on short-circuit.
- **Committed in:** `8cdca8fe`

---

**Total deviations:** 1 auto-fixed (Rule 3 blocking — test-harness mechanics; production path shipped exactly as specified).
**Impact on plan:** None on the deliverable contract or the offline/lazy/error-as-value guarantees. The browser `?url` + `worker:false` init is byte-for-byte the plan's spec; only the vitest engine-loading differs (node build), which the plan explicitly left to discretion.

## Threat Register Outcome
- **T-32-08 (DoS on malformed/huge input):** mitigated — `transform()` is linear and wrapped in try/catch → error-as-value; an embedded-block failure surfaces as `ok:false` (D-07, never a silent skip / wrong "minified" result); a structural HTML failure returns error-as-value. Neither crashes nor hangs.
- **T-32-09 (runtime network egress from a CDN wasm fetch):** mitigated at source — esbuild-wasm loaded via a local Vite `?url` asset only; `grep -RnE 'unpkg|cdn|https?://' minify.ts` clean; no static `from "esbuild-wasm"`. Full offline build-artifact proof lands in 32-05.
- **T-32-10 (version float → minify drift):** mitigated — exact pin `0.28.0` (no caret), single resolved esbuild-wasm version.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- The MINIFY seam is ready for the HTML (P33) and JS/TS (P34) tools' Minify mode; JSON/XML keep their existing native/pure minify (esbuild powers only the code languages — D-05).
- The chunk-split guard + offline no-network build-artifact proof for BOTH heavy engines (prettier + esbuild) is 32-05's job; this plan is a pure engine wrapper with no UI/native surface.
- Not auto-run by the executor (run at the Phase-32 boundary per the binding harness): `/simplify` → `/code-review xhigh` → `/codex:adversarial-review` → real-WKWebView UI verification.
- Decoder + its 19 tests byte-for-byte untouched (`git diff --quiet HEAD -- src/lib/protobuf/` clean).

---
*Phase: 32-prettier-esbuild-engine-async-seam*
*Completed: 2026-07-01*

## Self-Check: PASSED
Both created files present on disk; both task commits (`8cdca8fe`, `cc96149a`) present in git history.
