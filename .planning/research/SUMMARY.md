# Project Research Summary

**Project:** DevTools — milestone v1.3 "More Tools"
**Domain:** Offline, paste-instant developer utilities in a Tauri 2 + Vite + React + TS desktop app (macOS WKWebView)
**Researched:** 2026-06-03
**Confidence:** HIGH

## Executive Summary

v1.3 adds three new tools (Cron explainer, URL parser/encoder, Regex tester) plus a Protobuf decimal-byte-array input mode to the existing Protobuf decoder. The single most important cross-cutting finding, confirmed independently by all four research streams, is that **every feature ships with ZERO new runtime dependencies and ZERO new devDependencies.** Each maps cleanly onto a native Web/JS API already present in the WKWebView baseline: `URL`/`URLSearchParams`/`encodeURIComponent` for URL; `RegExp`/`matchAll`/`replace` for Regex; `Date` + `Intl.DateTimeFormat` for cron local-time display; and a hand-rolled `Uint8Array` parser for decimal bytes. This is the same playbook the app already shipped for the v1.1 formatters and the Unix Time tool. **`Temporal` is explicitly ruled out** — it would simplify cron DST math but it is not in the macOS WKWebView baseline (mid-2026) and a polyfill would be a forbidden new dependency.

Architecturally the work is low-friction. The app is a mature, registry-driven three-layer pattern (pure logic in `src/lib/<domain>/` → thin React tool in `src/tools/<tool>/` → one additive registry append). Registering a tool is two additive edits with no router/sidebar wiring. The four features are independent pure-logic islands and can be built in parallel. The one important architecture nuance: **`FormatterView` is NOT reusable** here — it is hard-shaped to the formatting domain (indent/minify/sort). The new tools need bespoke layouts built on the genuinely generic primitives (`ResizableSplit`, `StatusBar`, `CopyButton`, `useCopyFeedback`, the platform seam). Two deliberate extractions are recommended: promote `FormatterView`'s private `Toggle`/`toggleClasses` to a shared component (reused by all three new tools), and add `decimalToBytes` to `src/lib/bytes.ts` alongside the existing `hexToBytes`/`base64ToBytes` family.

Risk is highly concentrated. **URL and Protobuf-decimal are low-risk** (thin views over native APIs). **Regex is medium-risk**, dominated by one structural danger: a user-supplied pattern AND text run synchronously on the single JS thread, so a ReDoS pattern freezes the entire window — the recommended mitigation is a Web Worker + timeout watchdog (native, zero-dep). **Cron is the only high-complexity feature**, carrying four correctness traps: DOM/DOW OR-union semantics, 0/7=Sunday + 1-based-month numbering, DST-correct wall-clock next-run (NOT millisecond-delta iteration), and a hard iteration bound so impossible expressions (Feb-30) cannot hang the window. Within cron, `L`/`nL` (last-day / last-weekday) is the deepest slice and should be isolated as its own high-risk requirement.

## Key Findings

### Recommended Stack

No stack change. All four features are pure TypeScript over native APIs already in the WKWebView, unit-tested with the existing `vitest` + `tsc --noEmit` + `eslint` harness and verified on the real webview via the existing e2e gate. The sole third-party logic dependency (`js-md5`) is untouched; none of the new features add to `dependencies` or `devDependencies`. See `STACK.md`.

**Core technologies (all already present):**
- Native `URL` / `URLSearchParams` / `encodeURIComponent` — URL parse + component-vs-full encode/decode — zero dep, fully covers scope.
- Native `RegExp` / `matchAll` / `replace` — the regex engine the tool exists to expose — `matchAll` sidesteps the `lastIndex` footgun; flags `g/i/m/s/u` all in baseline.
- Native `Date` + `Intl.DateTimeFormat` — cron field-matching + local-time next-run display — mirrors the shipped Unix Time tool (`src/lib/timeFormat.ts`).
- Hand-rolled cron parser/iterator + `Uint8Array` decimal parser — consistent with the hand-rolled-decoder ethos; avoids `cron-parser`/`croner`/`Temporal`.

### Expected Features

The milestone scope IS the launch scope (the user chose fullest scope per tool). See `FEATURES.md`.

**Must have (table stakes):**
- Cron: 5-field parse, human-readable description, next-N runs in local time, `*`/ranges/lists/steps, 0/7=Sunday, per-field validation.
- URL: scheme/host/port/path/query/fragment split, query → key→value table (repeated keys preserved), component-vs-full encode/decode both ways, error-on-unparseable.
- Regex: live pattern + test-string matching, highlight all matches, flag toggles `g/i/m/s/u`, capture-group breakdown, invalid-pattern error, match count.
- Protobuf decimal: parse comma/space-separated decimals → `Uint8Array`, byte-range (0–255) validation, per-token errors, auto-detect alongside hex/base64.

**Should have (differentiators, all in chosen scope):**
- Cron: 6-field (seconds) auto-detected by token count, macros (`@daily`/`@hourly`/`@reboot`), day/month names, `?`, DOM/DOW OR semantics.
- URL: per-row decoded values, per-component / per-param copy, live update.
- Regex: named capture groups, live `$1`/`$<name>`/`$&` replace preview, minimal pattern library (email/URL/IPv4 only).

**Defer (post-v1.3 / hold the wedge):**
- Cron `W`/`#` (parse-tolerate, do NOT compute), year-field/7-field, generator UI, timezone selector.
- URL editable-recompose, shortener, IDN converter.
- Regex explainer, multi-flavor engines, permalinks; pattern library beyond the three named.
- Decimal: hex tokens, >255 multi-byte, signed bytes.

### Architecture Approach

All four slot into the existing registry-driven three-layer pattern with no changes to registry mechanics, the platform seam, or `decoder.ts`. Pure logic lives in new `src/lib/{cron,url,regex}/` folders (TDD); tools are thin React components; each tool is one additive `index.ts` + one `TOOLS` array append (Protobuf needs NO registry change — same tool). The four features share nothing and are parallelizable. See `ARCHITECTURE.md`.

**Major components:**
1. `src/lib/cron/` (`parse.ts` / `describe.ts` / `nextRuns.ts`) — hand-rolled; reuses `timeFormat.ts` for local-time display. The only non-trivial logic; most test surface.
2. `src/lib/url/` + `src/lib/regex/` — thin native-API wrappers; error-as-value, never throw to UI.
3. Protobuf decimal seam — tool-local: widen `detectEncoding.ts` union to add `"decimal"`, add `decimalToBytes` (recommended in `src/lib/bytes.ts`), one line in `useDecode.ts`, one new segment in `ProtobufDecoder.tsx`'s encoding toggle. `decoder.ts` + its 19 tests stay byte-for-byte untouched.
4. Shared primitives — reuse `ResizableSplit`/`StatusBar`/`CopyButton`/`useCopyFeedback`/platform seam everywhere; extract `Toggle`/`toggleClasses` out of `FormatterView` into a shared component. Do NOT reuse `FormatterView` itself.

### Critical Pitfalls

Top 5 (full list of 12 in `PITFALLS.md`). Two of these freeze the entire window in a single-threaded webview — ordered first.

1. **Cron next-run loop hangs on impossible/sparse expressions** (`0 0 30 2 *` = Feb-30) — use a hard iteration bound + field-jump (not minute-jump) algorithm; return "no upcoming run" on the bound.
2. **Regex ReDoS freezes the window** (user owns pattern AND text) — run matching in a Web Worker with a ~250–500ms timeout watchdog; surface "pattern too slow." Do not heuristically "detect ReDoS." This is structural and hard to bolt on late.
3. **Cron DOM/DOW AND-instead-of-OR** — when both day fields are restricted they UNION (`30 4 1,15 * 5` fires 1st + 15th + every Friday). Named, four-quadrant-tested `dayMatches`; description must reflect the OR.
4. **Cron DST + numbering** — match on local wall-clock components, re-read constructed-time components to defend against the silent spring-forward roll (NOT `+ms`-delta); months 1–12 vs JS 0–11; DOW 0/7=Sunday; `@reboot` has no next run.
5. **Regex `lastIndex` / zero-width loops + highlight XSS** — use `matchAll` (not `.exec()` loops); render highlights as React text nodes, never `dangerouslySetInnerHTML`. Wrap `new RegExp`/`new URL`/`decodeURIComponent` in try/catch (error-as-value).

## Implications for Roadmap

Phase numbering continues from v1.2's Phase 11. Order by **risk and shared-helper extraction**, not by hard dependency (there are none between features). Ship the easy wins first to bank momentum; concentrate verification budget on the two deep features (Regex UI, Cron logic) last.

### Phase 12: Protobuf decimal input
**Rationale:** Smallest change; de-risks the hardest constraint ("don't touch `decoder.ts`") first; forces the auto-detection precedence question to be answered early.
**Delivers:** Decimal-byte-array input mode auto-detected alongside hex/base64; `decimalToBytes` in `src/lib/bytes.ts`.
**Addresses:** Protobuf decimal table stakes (parse, 0–255 validation, per-token errors, auto-detect).
**Avoids:** Pitfall 11 (`decoder.ts` + 19 tests byte-for-byte untouched — verify via `git diff`); Pitfall 12 (detection precedence: "comma anywhere ⇒ decimal list, all tokens ≤255," with manual override; out-of-range tokens error, never wrap).

### Phase 13: URL tool
**Rationale:** Lowest-novelty pure logic; almost entirely a view over native `URL`/`URLSearchParams`; establishes the bespoke "parsed-components readout + key→value table" layout the other tools echo.
**Delivers:** Component split, query key→value table (repeated keys preserved), component-vs-full encode/decode both ways, per-component/per-row copy.
**Uses:** Native `URL`/`URLSearchParams`/`encodeURI(Component)`; shared `StatusBar`/`CopyButton`/platform seam; extracted `Toggle` for direction/mode.
**Avoids:** Pitfall 10 (error-as-value on `new URL`/`decodeURIComponent` throws; preserve repeated keys via `getAll`; label component-vs-full; `+`→space awareness).

### Phase 14: Regex tool
**Rationale:** Highest UI novelty — match-highlight overlay, capture-group breakdown, replace preview — plus the structural ReDoS risk. Allow extra UI-verification budget.
**Delivers:** Live matching with highlight, flag toggles `g/i/m/s/u`, capture + named groups, live `$1` replace preview, 3-pattern library.
**Uses:** Native `RegExp` + `matchAll` + `replace`; extracted `Toggle` for flags; React-node highlighting (escaped text, no raw HTML).
**Avoids:** Pitfall 6 (Web Worker + timeout — recommended), Pitfall 7 (`matchAll` over `.exec()`), Pitfall 8 (no `dangerouslySetInnerHTML`), Pitfall 9 (invalid ≠ no-match, error-as-value).

### Phase 15: Cron tool
**Rationale:** Highest logic novelty (hand-rolled next-run); most unit-test surface. Sequenced last so the easy wins land first; can also run as a parallel side-plan after Phase 12/13.
**Delivers:** 5/6-field parse, macros, day/month names, ranges/steps/lists, `?`, DOM/DOW OR, human description, next-5 runs in local time.
**Uses:** Hand-rolled `src/lib/cron/`; `timeFormat.ts` for local-time display; `Date` component matching.
**Avoids:** Pitfalls 1–5 (bounded field-jump iterator; OR `dayMatches`; DST component read-back; field-count/numbering/macro correctness; field-set expansion).

### Phase 15b (isolated slice): Cron `L` / `nL`
**Rationale:** Last-day / last-weekday math (month-length + leap-year + weekday) is the single highest-complexity item in the milestone. Isolate it as its own requirement with explicit fixtures so the rest of cron ships even if this is hard.
**Delivers:** `L` (last day of month) and `nL` (last weekday) in the next-run iterator.
**Avoids:** Deepening Pitfall 1's iterator risk; give it dedicated leap-day fixtures (last day of Feb leap vs non-leap; last Friday in 4- vs 5-Friday months).

### Phase Ordering Rationale
- No inter-feature dependencies exist — the only shared touchpoint is the mechanical registry append. Ordering is purely risk-driven.
- Phase 12 first proves the untouched-decoder promise and answers the detection-precedence design question before anything depends on it.
- The two deep features (Regex UI, Cron logic) come last so the two window-freeze risks (ReDoS, unbounded loop) get concentrated verification and the worker/bound decisions are made deliberately, not retrofitted.
- `Toggle` extraction in Phase 13 pays off across Phases 14 and 15.

### Research Flags

Phases likely needing `/gsd-research-phase` during planning:
- **Phase 14 (Regex):** the Web-Worker-vs-debounce execution-model decision and the highlight-overlay technique warrant a focused spike. ReDoS mitigation is structural.
- **Phase 15 (Cron):** DST wall-clock handling (component read-back, skipped/repeated-hour behavior) and the bounded field-jump algorithm benefit from deeper design before coding.
- **Phase 15b (Cron `L`/`nL`):** highest-risk math; dedicated fixture design.

Phases with standard patterns (skip research-phase):
- **Phase 12 (Protobuf decimal):** seam is precisely mapped; ~3 additive edits.
- **Phase 13 (URL):** thin view over well-documented native APIs.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero-dep confirmed against `package.json` + existing `timeFormat.ts`/`bytes.ts` precedents; native API support verified for the WKWebView baseline; `Temporal` absence confirmed. |
| Features | HIGH | Field syntax/semantics grounded in crontab.guru + man7 crontab.5; regex/URL behavior from MDN; scope decisions tied to PROJECT.md. |
| Architecture | HIGH | Every integration point read directly from the codebase; only lucide-react exact glyph names are MEDIUM (verify at build). |
| Pitfalls | HIGH | DOM/DOW union + 0/7-Sunday verified against man7; `lastIndex`/zero-width and ReDoS verified against MDN; decoder-untouched constraint from PROJECT.md. |

**Overall confidence:** HIGH

### Open UX Decisions for the Requirements Author

Research is conclusive on stack/architecture/pitfalls; these are product calls the requirements author must lock (recommendations given):
- **Cron time format:** 24h vs 12h — recommend **24h** (developer audience, matches Unix Time tool).
- **Cron next-N count:** recommend **5**.
- **Cron timezone label:** whether to surface the resolved IANA TZ label alongside local-time runs.
- **Regex execution model:** Web Worker + timeout (recommended) vs debounce + input-size cap (minimum bar).
- **Protobuf decimal precedence:** confirm "comma anywhere ⇒ decimal list, all tokens ≤255," with manual override; space-only-separated digits fall through to hex/base64.
- **Decimal home:** `decimalToBytes` in `src/lib/bytes.ts` (recommended for symmetry) vs tool-local.

### Gaps to Address
- **lucide-react glyph names** (`Regex`, `Link`, `Clock`): MEDIUM — verify availability against the installed version during phase work.
- **DST skipped/repeated-hour behavior:** must be a deliberate, documented choice with injectable "now" for testing — flag during Phase 15 planning.
- **Regex worker bundling under Vite:** confirm the worker bundles without a new dependency during Phase 14 planning.

## Sources

### Primary (HIGH confidence)
- DevTools `.planning/PROJECT.md` — zero-dep constraint, registry/platform-seam/FormatterView contracts, frozen `decoder.ts` + 19 tests, paste-instant/WCAG-AA, Unix Time local-time precedent.
- Codebase: `src/lib/tools/registry.ts`, `types.ts`, `src/tools/json-formatter/*`, `src/components/FormatterView.tsx`/`StatusBar.tsx`/`CopyButton.tsx`, `src/tools/protobuf-decoder/{detectEncoding,useDecode}.ts` + `ProtobufDecoder.tsx`, `src/lib/{timeFormat,bytes}.ts`, `src/lib/platform/index.ts` — every integration point read directly.
- man7.org crontab(5) — DOM/DOW union semantics, field ranges, 0/7=Sunday, `@reboot`.
- MDN — `RegExp`/`matchAll`/`replace`/`exec` (`lastIndex`, zero-width, named groups), `URL`/`URLSearchParams`/`encodeURI(Component)` semantics and throw behavior.
- crontab.guru + Healthchecks.io cron cheatsheet — field syntax, macros, deliberate omissions.

### Secondary (MEDIUM confidence)
- croner / cron-parser (npm) — reviewed to confirm what to deliberately NOT add and the DST semantics replicated hand-rolled.
- DEV / Groundy — native `Date` DST gotcha + `Temporal` availability timeline (Chrome 144 Jan 2026 / Firefox 139 May 2025; Safari/JSC not yet) justifying hand-rolled over Temporal.
- V8 / Mathias Bynens — regex flag history/support, corroborating MDN.

### Tertiary (LOW confidence)
- lucide-react exact glyph names — training data; verify at build.

---
*Research completed: 2026-06-03*
*Ready for roadmap: yes*
