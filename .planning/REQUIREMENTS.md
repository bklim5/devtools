# Requirements: DevTools — Milestone v1.3 "More Tools"

**Defined:** 2026-06-03
**Core Value:** Paste an unknown blob → get a usable, explorable interpretation in under 2 seconds, entirely offline, without touching the mouse.

Three new tools (Cron, URL, Regex) plus a decimal-byte-array input mode for the Protobuf hero. Eight tools today → eleven after this milestone. Backlog 999.1 promoted.

**Binding cross-cutting constraints (inherited by every requirement below — validated since Phase 3, not re-stated per tool):** offline / no-network at runtime; paste-transforms-instantly (<2s, no decode button for the common case); copy-result-instantly via a visible, focusable affordance (no hover-only); status bar where byte-oriented; WCAG-AA; registry-driven (single control plane); HashRouter only; layout-agnostic components; **zero new runtime dependencies** (native `URL`/`URLSearchParams`/`encodeURIComponent`, native `RegExp`/`matchAll`, `Intl.DateTimeFormat`, hand-rolled cron); **`src/lib/protobuf/decoder.ts` + its 19 tests stay byte-for-byte untouched.**

## v1 Requirements

### Protobuf decimal-byte-array input (extends the hero)

- [ ] **PRO-08**: User can paste a comma/space-separated decimal byte array (e.g. `10, 3, 80, 81, 82`) and the Protobuf decoder decodes it as a third input mode, auto-detected alongside hex/base64 (rule: a comma anywhere ⇒ decimal list; all tokens integers 0–255), with a visible, overridable detected-mode indicator.
- [ ] **PRO-09**: Invalid decimal input (token >255, negative, non-integer, or unparseable) surfaces a clear inline error without crashing the tool; `decoder.ts` and its 19 tests remain byte-for-byte unmodified (a new pre-decode `decimalToBytes` parser in `src/lib/bytes.ts`, not a decoder change).

### Cron tool

- [ ] **CRON-01**: User can paste a standard 5-field cron expression and see a human-readable description (24-hour time), paste-instant.
- [ ] **CRON-02**: User can paste a 6-field (with-seconds) cron expression and it is parsed and described correctly (5-vs-6-field disambiguated by field count).
- [ ] **CRON-03**: User can use macros (`@yearly`/`@annually`, `@monthly`, `@weekly`, `@daily`/`@midnight`, `@hourly`, `@reboot`) and they are described and (where applicable) scheduled correctly.
- [ ] **CRON-04**: User can use full field syntax — wildcards (`*`), ranges (`1-5`), steps (`*/15`, `0-30/10`), lists (`1,3,5`), and day/month names (`MON`, `JAN`) — across all fields.
- [ ] **CRON-05**: User sees the next 5 run times in local time, each with an IANA timezone label.
- [ ] **CRON-06**: Next-run computation honors cron's day-of-month / day-of-week **OR-union** semantics (when both are restricted, a run matches *either*) and treats both `0` and `7` as Sunday.
- [ ] **CRON-07**: Next-run computation is DST-correct — it iterates wall-clock fields (not millisecond deltas), so spring-forward (skipped) and fall-back (repeated) hours are handled without duplicate or missing runs.
- [ ] **CRON-08**: An impossible / never-firing expression (e.g. `0 0 30 2 *` — Feb 30) terminates gracefully with a clear "no upcoming runs" message via a bounded iteration cap — it never freezes the window.
- [ ] **CRON-09**: `@reboot` is described as run-at-startup with no scheduled next-run (no clock computation attempted).
- [ ] **CRON-10**: User can use last-day / last-weekday syntax (`L`, `nL`, `L-n`) and see correct next-run times — leap-year and month-length aware (isolated high-risk slice with explicit edge-case fixtures).
- [ ] **CRON-11**: An invalid cron expression (wrong field count, out-of-range value, unparseable token) surfaces a clear inline error without throwing.

### URL tool

- [ ] **URL-01**: User can encode and decode a string at the component level (`encodeURIComponent`/`decodeURIComponent`), both directions, paste-instant.
- [ ] **URL-02**: User can encode and decode at the full-string level (`encodeURI`/`decodeURI`), distinct from component encoding, with the difference made clear in the UI.
- [ ] **URL-03**: User can paste a URL and see it split into scheme / host / port / path / query / fragment via native `URL`.
- [ ] **URL-04**: User sees the query string broken into a key→value table, including repeated keys (`getAll`) and empty values, with each value decoded.
- [ ] **URL-05**: A malformed/relative URL or a bad percent-sequence surfaces a clear inline error without throwing (error-as-value).

### Regex tester

- [ ] **RGX-01**: User can test a regex against sample text and see highlighted matches, paste-instant.
- [ ] **RGX-02**: User sees a per-match capture-group breakdown, including numbered and named groups.
- [ ] **RGX-03**: User can toggle flags `g`, `i`, `m`, `s`, `u` and matching updates live.
- [ ] **RGX-04**: User sees a live replace/substitution preview supporting `$1`, `$<name>`, and `$&` references.
- [ ] **RGX-05**: User can insert from a small common-pattern library (email, URL, IPv4).
- [ ] **RGX-06**: A catastrophic-backtracking pattern cannot freeze the window — matching runs in a Web Worker with a timeout watchdog; on timeout the user sees a clear "pattern timed out" message and the UI stays responsive.
- [ ] **RGX-07**: An invalid regex surfaces a clear inline error without throwing; match highlighting renders escaped text safely (span overlay, never `dangerouslySetInnerHTML`).

## Future Requirements (deferred)

### Regex
- **RGX-F1**: Multi-line / file-sized input streaming and match pagination.
- **RGX-F2**: Save/name custom patterns into the library (persisted).

### Cron
- **CRON-F1**: `W` (nearest-weekday) and `#` (nth-weekday) next-run computation (parse-tolerant in v1.3 if encountered, but not scheduled).

### URL
- **URL-F1**: Base64-in-URL and data-URI inspection.

## Out of Scope

| Feature | Reason |
|---------|--------|
| `cron-parser` / `date-fns` / any cron or date library | Zero-new-runtime-deps wedge; cron is hand-rolled (decoder precedent), local time via `Intl.DateTimeFormat`. |
| `Temporal` API / its polyfill | Not in the WKWebView baseline (mid-2026); the polyfill would be a new runtime dep. Field-iteration over `Date` needs neither. |
| Regex `W`/`#` cron compute, regex pattern persistence, URL data-URI tools | Deferred to Future Requirements — keep v1.3 focused on the agreed scope. |
| Schema-aware Protobuf / non-decimal new input formats | Out of milestone; v1.3 protobuf change is decimal input only. |
| New runtime dependency of any kind | Violates the product wedge; every feature is provably native-API + hand-rolled. |
| Modifying `decoder.ts` or its 19 tests | Hard constraint — the hero spec is frozen; decimal input is a pre-decode parse layer. |

## Traceability

Populated during roadmap creation (each requirement maps to exactly one phase).

| Requirement | Phase | Status |
|-------------|-------|--------|
| PRO-08 | TBD | Pending |
| PRO-09 | TBD | Pending |
| CRON-01..11 | TBD | Pending |
| URL-01..05 | TBD | Pending |
| RGX-01..07 | TBD | Pending |

**Coverage:**
- v1 requirements: 25 total (PRO 2 · CRON 11 · URL 5 · RGX 7)
- Mapped to phases: 0 (roadmap pending)
- Unmapped: 25 ⚠️ (filled by roadmapper)

---
*Requirements defined: 2026-06-03*
*Last updated: 2026-06-03 after milestone v1.3 definition*
