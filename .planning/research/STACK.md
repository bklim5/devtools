# Stack Research

**Domain:** Offline desktop dev-utility tools (Tauri 2 + Vite + React + TS, macOS WKWebView) — v1.3 "More Tools": Cron, URL, Regex tester, Protobuf decimal-byte-array input
**Researched:** 2026-06-03
**Confidence:** HIGH

## Bottom Line

**ZERO new runtime dependencies. ZERO new devDependencies.** All four features are fully achievable with native Web/JS APIs (`URL`, `URLSearchParams`, `encodeURIComponent`/`decodeURIComponent`, `RegExp`/`String.prototype.matchAll`/`replaceAll`, `Date` + `Intl.DateTimeFormat`) plus hand-rolled pure TypeScript in `src/lib/`. This is not aspirational — it is the same playbook the app already shipped for JSON/XML formatters (v1.1: native `JSON`/`DOMParser`/`XMLSerializer`) and the Unix Time tool (native `Intl.DateTimeFormat` in `src/lib/timeFormat.ts`). The existing test stack (`vitest` + `tsc --noEmit` + `eslint`) covers the new pure modules with no additions.

The only genuinely non-trivial piece is **cron next-run computation**, and it is confirmed feasible hand-rolled (see Cron section). It is consistent with the project's hand-rolled-decoder ethos and avoids the single most tempting dependency for this milestone (`cron-parser`/`croner`).

The current runtime-dep surface is unchanged: `js-md5` remains the only third-party *logic* library; everything else in `dependencies` is the framework (React/react-router), Tauri plugins, fonts, and icons — none of which the four new features touch.

## Per-Feature Native API Verification

### 1. Cron tool — HAND-ROLLED, native `Date` + `Intl.DateTimeFormat`

| Need | Native API | Confidence | Notes |
|------|-----------|------------|-------|
| Parse 5-field / 6-field (seconds) / macro (`@daily`, `@hourly`, `@weekly`, `@monthly`, `@yearly`/`@annually`, `@reboot`) | Hand-rolled string split + field-range expansion (pure TS) | HIGH | No parser library. Field grammar (`*`, `,`, `-`, `/`, named months/days) is a few hundred lines of pure TS — the decoder is ~295 lines for harder work. |
| Compute next N run times | Hand-rolled "tick-forward / field-match" loop over `Date` | HIGH | Standard algorithm: from `now`, advance the local wall-clock candidate, test each field against the expanded sets, collect N matches. Bounded and fast (<2s wedge easily met — worst case a few thousand iterations). |
| Show next-runs in LOCAL time | `Date` local getters (`getFullYear/getMonth/getDate/getHours/getMinutes/getSeconds/getDay`) for matching; `Intl.DateTimeFormat(undefined, {...})` for display | HIGH | Mirrors the shipped Unix Time tool (`src/lib/timeFormat.ts` already uses `new Intl.DateTimeFormat(undefined, {...})` for local rendering). Reuse that pattern. |

**Hand-rolled feasibility — CONFIRMED.** The correct, simplest design matches cron fields against **local wall-clock components** read from a `Date`, then advances by constructing the next candidate via the local `Date` constructor (`new Date(y, mo, d, h, mi, s)`), which interprets its args in the host's local zone. This is the same local-time model the Unix Time tool already trusts.

**The one real gotcha — DST (and how to handle it without a library):**
- A cron expression like `30 2 * * *` ("2:30 every day") refers to a wall-clock time that **does not exist** on the spring-forward day and occurs **twice** on the fall-back day. Native `Date` does NOT resolve this for you automatically.
- **Recommended approach (no Temporal, no library):** advance the candidate by **wall-clock fields**, not by fixed millisecond deltas. Build each candidate with `new Date(y, mo, d, h, mi, s)` and then **read the components back** (`getHours()` etc.). If the constructed `Date` normalized to a different wall-clock time than intended (the spring-forward gap), detect the mismatch and skip/advance. This keeps DST correctness inside ~10 lines and needs no `Temporal`/Luxon.
- **Do NOT use `+60_000`-style millisecond-delta iteration as the primitive** — that is exactly the path that silently double-fires or skips across DST boundaries.
- **`Temporal` is NOT needed and should NOT be used.** `Temporal.ZonedDateTime` would give DST-aware arithmetic for free, but (a) it is not yet in the macOS WKWebView / JavaScriptCore baseline as of mid-2026 (Chrome 144 shipped Jan 2026, Firefox 139 May 2025; Safari/JSC has not), and (b) adopting `@js-temporal/polyfill` is a new runtime dependency — forbidden. The field-iteration approach above needs neither.

**Tempting deps to refuse:** `cron-parser`, `croner`, `cronstrue` (human-readable description). All avoidable. The human-readable description ("At 2:30 AM, only on Monday") is a pure string-builder over the parsed field sets — hand-roll it alongside the parser.

### 2. URL tool — native `URL`, `URLSearchParams`, `encodeURIComponent`/`decodeURIComponent`

| Need | Native API | Confidence |
|------|-----------|------------|
| Split scheme/host/port/path/query/fragment | `new URL(input)` → `.protocol` `.hostname` `.port` `.pathname` `.search` `.hash` (+ `.username`/`.password` when present) | HIGH |
| Query-string → key→value table | `new URLSearchParams(url.search)` → iterate `.entries()` (handles repeated keys, `+`→space, percent-decoding) | HIGH |
| Component encode / decode | `encodeURIComponent` / `decodeURIComponent` | HIGH |
| Full-string encode / decode | `encodeURI` / `decodeURI` (whole URL) plus `encodeURIComponent`/`decodeURIComponent` (single component) — expose both | HIGH |

**Gotchas:**
- `new URL()` **throws** on relative or malformed input. Wrap in try/catch and surface a clear parse error (the app's established pattern — JSON/XML formatters already surface parse errors with position). The 2-arg `new URL(input, base)` form can resolve relative URLs if desired, but error-on-malformed is the honest default for a dev tool.
- `URLSearchParams` already percent-decodes values and converts `+` to space — do not double-decode.
- `decodeURIComponent` throws `URIError` on malformed `%` sequences — catch and report.

**Tempting deps to refuse:** `query-string`, `qs`. Native `URLSearchParams` fully covers parse/stringify/repeated-keys for this tool's scope.

### 3. Regex tester — native `RegExp`, `String.prototype.matchAll`, `String.prototype.replace`/`replaceAll`

| Need | Native API | Confidence |
|------|-----------|------------|
| Compile pattern + flags | `new RegExp(pattern, flags)` (try/catch for invalid pattern/flags → surface error) | HIGH |
| All matches + offsets for highlighting | `str.matchAll(/.../g)` → iterator of match arrays carrying `.index`, full match, and capture groups | HIGH |
| Capture-group breakdown | Indexed groups from each match array; named groups via `match.groups` | HIGH |
| Flag toggles g / i / m / s / u | All natively supported in the WKWebView baseline (`s` dotAll = ES2018, `u` = ES2015; both in Safari 11.1+; the app's WebKit is far newer — it already uses `Uint8Array.toBase64`) | HIGH |
| Live replace / substitution preview with `$1` refs | `str.replace(re, replacement)` / `str.replaceAll` — `$1`, `$&`, `$<name>` substitutions are native replacement-string semantics | HIGH |
| Common-pattern library (email, URL, IPv4) | Plain string constants in the module — zero dep | HIGH |

**Gotchas:**
- `matchAll` **requires the `g` flag** or it throws `TypeError`. For the "all matches" view, internally ensure `g` is set (or guard and use `re.exec` in a loop).
- A global `RegExp` is **stateful** (`lastIndex`); prefer `matchAll` (stateless per call) or construct a fresh `RegExp` per evaluation to avoid stale-`lastIndex` bugs.
- Zero-length matches (e.g. `/a*/g`) can infinite-loop a naive `exec` loop; `matchAll` advances correctly, but if hand-looping, bump `lastIndex` on an empty match.
- ReDoS: a pathological user pattern on a large input could hang the UI thread. Native `RegExp` (ES2020+ engines) is more ReDoS-resistant but not immune. Optional mitigation: cap input size / debounce evaluation — not a dependency.
- Match-indices (`d` flag, Safari 16.4+) give per-capture-group offsets; only needed for per-group highlight ranges. Whole-match highlighting needs only `.index` + match length (no `d` flag).

**Tempting deps to refuse:** none seriously — and resist any regex AST/visualizer library. Native `RegExp` IS the engine the tool exists to expose.

### 4. Protobuf decimal-byte-array input — hand-rolled pre-decode parse layer

| Need | Native API | Confidence |
|------|-----------|------------|
| Parse `"10, 3, 80, 81, 82"` (comma/space separated) → `Uint8Array` | `input.split(/[\s,]+/)` → `Number()`/`parseInt` per token → range-check 0–255 → `Uint8Array.from(...)` | HIGH |
| Auto-detect vs hex/base64 | Pure heuristic in a new detection function: comma/space-separated, all tokens decimal integers 0–255 → byte-array mode | HIGH |

**Design constraint — CONFIRMED satisfiable:** This is a **new pre-decode parse function** that produces a `Uint8Array`, then hands it to the *existing untouched* `decoder.ts`. `decoder.ts` and its 19 tests stay byte-for-byte unchanged — the byte-array parser sits beside the existing hex/base64 parsing in `src/lib/bytes.ts` (which already centralizes hex/base64 via feature-detected `Uint8Array.fromHex`/`fromBase64`) or a sibling module, and feeds the same `Uint8Array` entry point. Extend the input-mode detection there.

**Gotchas:**
- Validate each token is an integer in 0–255; reject `256`, negatives, `0x`-prefixed (that's hex mode), and floats. Surface a precise per-token error.
- Detection ordering matters: a bare `255 255` could ambiguously read as hex too — disambiguate via the comma/space-separated-decimal signature and require all tokens ≤ 255 decimal. Make the detected mode **visible and overridable** (the app already shows current encoding in the status bar).

## Recommended Stack

### Core Technologies (ALL ALREADY PRESENT — no change)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| TypeScript | ~5.8.3 | All four tools' pure logic in `src/lib/` | Existing; tools are pure TS modules |
| React | ^19.1 | Thin tool UIs | Existing shell pattern |
| Native `URL` / `URLSearchParams` | Web standard | URL tool parse/encode/decode | In WKWebView; zero dep |
| Native `RegExp` / `matchAll` / `replace` | ES2018+ | Regex tester engine | In WKWebView; zero dep |
| Native `Date` + `Intl.DateTimeFormat` | ES standard | Cron field-matching + local-time display | Already used by Unix Time tool (`timeFormat.ts`) |
| Native `Uint8Array` | Web standard | Protobuf byte-array parse target | Already used by `bytes.ts` |

### Supporting Libraries

**None.** No new runtime libraries for any of the four features.

### Development Tools (ALL ALREADY PRESENT — no change)

| Tool | Purpose | Notes |
|------|---------|-------|
| vitest 4.1.7 | Unit tests for the new pure modules (cron parse/next-run, URL parse, regex eval, byte-array parse) | TDD; pure modules are trivially unit-testable. No additions. |
| typescript ~5.8.3 (`tsc --noEmit`) | Type gate | No additions. |
| eslint 10.4.1 + typescript-eslint | Lint gate | No additions. |
| jsdom 29.1.1 | DOM for component tests | Already present; not even required for the pure-logic cores. |
| Real-WKWebView e2e (wdio + `scripts/e2e-spike.sh`) | UI verification gate | Existing harness covers new tool views; no additions. |

## Installation

```bash
# Nothing to install. Zero new runtime deps, zero new devDeps.
# New code lives in src/lib/{cron,url,regex}/ + extends src/lib/bytes.ts.
```

## Alternatives Considered

| Recommended | Alternative | When the alternative would make sense (it doesn't here) |
|-------------|-------------|----------------------------------------------------------|
| Hand-rolled cron parser + next-run | `cron-parser`, `croner` | If we needed arbitrary IANA-timezone scheduling, sub-second precision, or DST-overlap "run-once" semantics for an actual scheduler. We only describe + preview local next-runs — hand-rolled covers it and preserves zero-dep. |
| Field-iteration DST handling | `Temporal` / `@js-temporal/polyfill` / Luxon / date-fns-tz | Temporal would simplify DST math, but it's a new dep AND not in the WKWebView baseline. Luxon/date-fns are runtime deps — forbidden. |
| Native `URLSearchParams` | `query-string`, `qs` | If we needed nested/bracket array params (`a[]=1`) or custom delimiters. Out of scope. |
| Native `RegExp` | regex AST / visualizer libs | Never — `RegExp` is the engine the user is testing against; a wrapper would lie about behavior. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `cron-parser` / `croner` / `cronstrue` | New runtime dep; violates the zero-dep wedge. Our scope (parse + describe + local next-runs) is hand-rollable. | Pure TS field parser + field-iteration next-run + string-builder description |
| `date-fns` / `date-fns-tz` / `luxon` / `moment` | Runtime deps; the app already does local-time via native `Intl.DateTimeFormat` (`timeFormat.ts`). | `Date` local getters + `Intl.DateTimeFormat` |
| `@js-temporal/polyfill` / relying on native `Temporal` | Polyfill = new runtime dep; native `Temporal` not in the macOS WKWebView baseline (mid-2026). | Wall-clock field-iteration with `new Date(y,mo,d,h,mi,s)` + component read-back for DST gaps |
| `query-string` / `qs` | New dep; native covers the scope. | `URL` + `URLSearchParams` |
| `+ms`-delta arithmetic as the cron iteration primitive | Silently breaks across DST transitions (double-fire / skip) | Iterate on local wall-clock fields, verify via component read-back |
| Any regex helper/visualizer lib | New dep; obscures the native engine semantics the tool exists to expose | `new RegExp` + `matchAll` + `replace` |

## Stack Patterns by Variant

**Cron — if a future milestone needs arbitrary-timezone or true scheduling:**
- Revisit `Temporal.ZonedDateTime` *once it lands in the WKWebView baseline* (native, no dep).
- Until then, local-time-only is the correct, dependency-free scope for v1.3.

**Regex — if per-capture-group highlight ranges are wanted:**
- Use the `d` (hasIndices) flag (Safari 16.4+) for group offsets — native, no dep. Otherwise whole-match `.index` + length suffices.

## Version Compatibility

| Concern | Status | Notes |
|---------|--------|-------|
| RegExp `s`/`u`/`d` flags in WKWebView | Compatible | `s`/`u` since Safari 11.1; `d` since 16.4. App's WebKit already exposes `Uint8Array.toBase64` (very recent) → all present. |
| `Temporal` in WKWebView | NOT available (mid-2026) | Reason to hand-roll cron, not adopt Temporal. |
| `URL` / `URLSearchParams` / `matchAll` / `replaceAll` | Compatible | Long-stable in WebKit. |
| vitest / tsc / eslint cover new pure modules | Yes, no additions | Pure functions; same harness used for `timeFormat.test.ts`, `bytes.test.ts`, `ulid.test.ts`. |

## Sources

- `.planning/PROJECT.md` — zero-dep constraint, existing tool stack, `src/lib/timeFormat.ts` local-time precedent, `bytes.ts` byte-parsing precedent (HIGH — authoritative project state)
- `package.json` (repo) — confirmed sole logic dep is `js-md5`; existing devDeps (vitest/tsc/eslint) cover pure modules (HIGH)
- `src/lib/timeFormat.ts`, `src/lib/bytes.ts` (repo) — verified existing native `Intl.DateTimeFormat` + feature-detected `Uint8Array` patterns to reuse (HIGH)
- [MDN RegExp.prototype.dotAll](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/dotAll) + [MDN RegExp](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp) — `s`/`u`/`d`/`matchAll` semantics + browser support (HIGH)
- [V8 regexp v flag](https://v8.dev/features/regexp-v-flag), [Mathias Bynens — ES RegExp proposals](https://mathiasbynens.be/notes/es-regexp-proposals) — flag history/support (MEDIUM, corroborating MDN)
- [croner (npm)](https://www.npmjs.com/package/croner) + [cron-parser (npm)](https://www.npmjs.com/package/cron-parser) — reviewed to confirm what we deliberately do NOT add and the DST semantics replicated hand-rolled (HIGH for "what to avoid")
- [DEV: JavaScript DST date confusion](https://dev.to/urin/say-goodbye-to-javascripts-dst-date-confusion-24mj), [Groundy: Temporal API status](https://groundy.com/articles/javascript-s-date-problem-finally-fixed-temporal-api-after/) — confirmed native `Date` DST gotcha + `Temporal` availability (Chrome 144 Jan 2026 / Firefox 139 May 2025; Safari/JSC not yet) → justifies hand-rolled field-iteration over Temporal (MEDIUM-HIGH)

---
*Stack research for: DevTools v1.3 "More Tools" — Cron / URL / Regex / Protobuf decimal-byte-array*
*Researched: 2026-06-03*
