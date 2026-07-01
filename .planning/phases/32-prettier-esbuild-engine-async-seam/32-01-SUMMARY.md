---
phase: 32-prettier-esbuild-engine-async-seam
plan: 01
subsystem: formatters
tags: [prettier, formatter, async, parity, standalone, golden-test]

# Dependency graph
requires:
  - phase: 31-doc-process-correction
    provides: "living docs record Prettier as a scoped heavy-dep exception (PRT-13)"
provides:
  - "src/lib/format/prettier.ts — async formatScript(input, lang, opts) + formatHtml(input, opts) → Promise<FormatResult>, lazy memoized plugin loads via dynamic import()"
  - "PrettierFormatOptions (FormatOptions + optional printWidth) — the option surface P33/P34 consume"
  - "Golden parity lock (prettier.parity.test.ts) byte-equalling wrapper output to CLI prettier --write, plus a separate regen-integrity check + single-version pin guard"
  - "prettier 3.8.3 as a single-pinned production dependency"
affects: [33-html-tool, 34-js-ts-tool, 32-02-async-hook, 32-05-offline-build-proof]

# Tech tracking
tech-stack:
  added: ["prettier 3.8.3 (devDep → dependency; standalone runtime engine)"]
  patterns:
    - "Dynamic-import() memoized lazy engine loader (p ??= import(...)) — heavy chunk loads on first format, never at mount"
    - "Error-as-value wrapper returning the shared FormatResult (never throws past the seam)"
    - "Two-part golden parity: wrapper↔committed-golden byte-equality (no regen) + separate generator-integrity (regen + git diff --exit-code)"

key-files:
  created:
    - "src/lib/format/prettier.ts"
    - "src/lib/format/prettier.test.ts"
    - "src/lib/format/prettier.parity.test.ts"
    - "scripts/gen-prettier-golden.mjs"
    - "test/fixtures/prettier/{messy.js,messy.ts,embedded.html}(+.golden)"
  modified:
    - "package.json (prettier devDep → dependency)"
    - "eslint.config.js (ignore test/fixtures)"

key-decisions:
  - "Prettier loc.start.column is already 1-based in 3.8.3 — surfaced as-is (the plan's +1 assumed 0-based and would over-count)"
  - "Pasted-code defaults = Prettier's OWN defaults (printWidth 80), NOT the repo .prettierrc printWidth 100"
  - "Goldens authored by the real CLI binary (execFileSync node_modules/.bin/prettier), independent of the standalone wrapper path"
  - "HTML parity plugin matrix [html, babel, estree, postcss] — html alone leaves embedded <script>/<style> raw"

patterns-established:
  - "Lazy memoized Prettier plugin loaders keyed per language (estree shared)"
  - "Golden parity split into two never-in-the-same-breath checks so regeneration can't mask drift"

requirements-completed: [PRT-01, PRT-05]

# Metrics
duration: ~35min
completed: 2026-07-01
---

# Phase 32 Plan 01: Async Prettier Engine Wrapper + Golden Parity Lock Summary

**An async, lazy, error-as-value `prettier/standalone` wrapper (formatScript/formatHtml) that prettifies JS/TS/HTML incl. embedded `<script>`/`<style>`, byte-identical to `prettier --write`, locked by a golden parity test plus a separate regen-integrity check — with prettier promoted to a single-pinned production dependency.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-01T13:27Z
- **Completed:** 2026-07-01T13:37Z
- **Tasks:** 2
- **Files modified/created:** 10

## Accomplishments
- `src/lib/format/prettier.ts`: `formatScript`/`formatHtml` returning `Promise<FormatResult>`, engine + plugins loaded ONLY via memoized dynamic `import()` (no static prettier import), empty-input short-circuit before any import, malformed input → typed error value with 1-based line:col (never throws).
- Embedded-code parity: HTML formats embedded `<script>` JS AND `<style>` CSS (plugin matrix `[html, babel, estree, postcss]`), proven by both a unit test and the embedded.html golden.
- Golden parity lock: wrapper output byte-equals the COMMITTED CLI-generated goldens (JS, TS, embedded HTML) WITHOUT regenerating; a SEPARATE `gen-prettier-golden.mjs` + `git diff --exit-code` integrity check RED-s on stale goldens; a pin-guard RED-s on any `^`/`~`/range float.
- prettier 3.8.3 moved devDep → dependency (exact pin, single resolved version — `pnpm why prettier` = 1).

## Task Commits

1. **Task 1: Async Prettier wrapper + dep move (RED→GREEN)** — `5824424e` (feat)
2. **Task 2: Golden parity test vs CLI prettier --write** — `8cf3acee` (test)

_TDD landed GREEN with impl (lefthook rejects RED-only commits — memory `tdd-red-commits-blocked-by-lefthook`)._

## Files Created/Modified
- `src/lib/format/prettier.ts` — the async lazy wrapper (formatScript/formatHtml, option mapping, error-as-value).
- `src/lib/format/prettier.test.ts` — 12 unit cases (JS/TS/HTML, embedded script+style, indent 2/4/tab, printWidth override, empty short-circuit, malformed error-as-value).
- `src/lib/format/prettier.parity.test.ts` — byte-equality vs committed goldens (reads off disk via Vite `?raw`, no regen) + embedded-body assertion + single-version pin guard.
- `scripts/gen-prettier-golden.mjs` — authors `.golden` from the pinned CLI binary with explicit options mirroring the wrapper defaults.
- `test/fixtures/prettier/*` — messy JS/TS + embedded-script/style HTML inputs and their CLI goldens.
- `package.json` — prettier devDep → dependency.
- `eslint.config.js` — ignore `test/fixtures` (deliberately-messy inputs).

## Decisions Made
- Surfaced Prettier's `loc.start.column` directly (it is 1-based in 3.8.3, matching the "(line:column)" message and the JSON tool) — see Deviation 1.
- Goldens produced by the actual CLI binary (not the Node API, not the standalone wrapper) for maximum independence from the code path under test.
- Explicit per-fixture parser map in the generator (no extension inference) so the golden source-of-truth parser is unambiguous.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Prettier column is already 1-based — dropped the plan's +1**
- **Found during:** Task 1 (wrapper error mapping)
- **Issue:** The plan's action said to map `err.loc.start.column` "(0-based → +1 to 1-based)". Empirically prettier 3.8.3's `loc.start.column` is ALREADY 1-based (e.g. `const a = {` → `loc.start = {line:1, column:12}`, matching the message "(1:12)"). Adding +1 would over-count by one and NOT match the JSON tool's 1-based col.
- **Fix:** Surface `loc.start.column` as-is; documented at the `toError` seam.
- **Files modified:** src/lib/format/prettier.ts
- **Verification:** Unit test asserts `line === 1` and a numeric `col >= 1`; probed the raw error shape across babel + typescript parsers.
- **Committed in:** `5824424e`

**2. [Rule 3 - Blocking] eslint linted the messy fixtures + generator `console`**
- **Found during:** Task 2 (first commit attempt — lefthook lint gate)
- **Issue:** `eslint .` flagged the deliberately-broken fixtures (`no-unused-vars`, `no-undef`) and the generator's bare `console` global (the repo has no node globals in eslint; existing scripts import `stdout` from `node:process`).
- **Fix:** Added `test/fixtures` to eslint `ignores`; switched the generator to `import { stdout } from "node:process"` + `stdout.write` (repo convention).
- **Files modified:** eslint.config.js, scripts/gen-prettier-golden.mjs
- **Verification:** `eslint .` → 0 errors (4 pre-existing warnings out of scope); commit lefthook GREEN.
- **Committed in:** `8cf3acee`

**3. [Rule 1 - Bug] HTML parser is lenient — reframed the malformed-HTML unit test**
- **Found during:** Task 1 (first unit run)
- **Issue:** A test assumed `formatHtml("<script>const a = {</script>")` returns `ok:false`; prettier's `html` parser is deliberately lenient and does not reject a half-typed embedded script, so it returns `ok:true`.
- **Fix:** Reframed the test to lock the real contract — the wrapper always resolves a well-formed `FormatResult` and never throws — rather than asserting an error the parser doesn't raise. (formatScript malformed→error is still asserted separately.)
- **Files modified:** src/lib/format/prettier.test.ts
- **Verification:** Test passes; the `formatScript("const a = {")` error-as-value case remains RED-on-throw.
- **Committed in:** `5824424e`

---

**Total deviations:** 3 auto-fixed (2 Rule 1 bug, 1 Rule 3 blocking)
**Impact on plan:** All necessary for correctness (column base, lenient parser) and to pass the binding lint gate. No scope creep; the two-check parity design and dynamic-import discipline shipped exactly as specified.

## Issues Encountered
- The pin-drift negative test (`^3.8.3`) caused a stray `pnpm exec` to rewrite the lockfile specifier to `^3.8.3`; restored via `git checkout -- pnpm-lock.yaml` (committed lockfile has `specifier: 3.8.3`). Working tree clean.

## Threat Register Outcome
- **T-32-01 (DoS on malformed/huge paste):** mitigated — every format wrapped in try/catch → typed error value, never an unhandled rejection.
- **T-32-02 (version skew):** mitigated — exact pin `3.8.3`, `pnpm why prettier` = 1, parity RED on wrapper drift + integrity RED on stale goldens (both proven negatively).
- **T-32-03 (network egress):** mitigated — npm subpath dynamic imports only; grep-clean of `unpkg`/`cdn`/`https://` in wrapper + fixtures. (Full offline build-artifact proof deferred to 32-05.)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The PRETTIFY seam is ready for the async latest-wins hook (32-02) and the HTML (P33) / JS-TS (P34) tools.
- No native/UI verification in this plan (pure engine wrapper + tests); the real-WKWebView + offline build-artifact proof lands in the tool phases + 32-05.
- Decoder + its 19 tests byte-for-byte untouched.

---
*Phase: 32-prettier-esbuild-engine-async-seam*
*Completed: 2026-07-01*

## Self-Check: PASSED
All 5 key created files present on disk; both task commits (`5824424e`, `8cf3acee`) present in git history.
