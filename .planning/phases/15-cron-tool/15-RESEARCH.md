# Phase 15: Cron tool - Research

**Researched:** 2026-06-03
**Domain:** Cron expression parsing, human-readable description, and DST-correct next-run computation — hand-rolled in pure frontend TypeScript, zero new runtime deps
**Confidence:** HIGH (algorithm, DOM/DOW semantics, L-syntax, Temporal-absence all verified against multiple authoritative sources; one MEDIUM gap on the exact `formatToParts` round-trip ergonomics — flagged below)

## Summary

This phase ships the 12th registry-driven tool. It has the highest *logic* novelty of the milestone and the most unit-test surface, but almost no UI or runtime-environment novelty: it slots into the exact three-layer pattern Phases 13 (URL) and 14 (Regex) just established — a pure, total, error-as-value core in `src/lib/cron/`, a thin layout-agnostic React view in `src/tools/cron/`, and one additive `ToolDefinition` appended to the `TOOLS` array. The hard part is entirely inside the pure core: parsing five field-grammars correctly and computing the next run by wall-clock field iteration.

The project has **deliberately and correctly chosen to hand-roll** both the next-run engine and the human-readable description. This is not the usual "don't hand-roll a date library" advice — the milestone's binding constraint is **zero new runtime dependencies**, and the two obvious libraries are both disqualified: `cron-parser` is a new runtime dep (and pulls `luxon`), and `cronstrue` is ~42 KB minified, also a new runtime dep `[VERIFIED: npmjs.com/package/cronstrue]`. The `Temporal` API — the SOTA way to do timezone-aware wall-clock arithmetic — is **not available in the WKWebView/Safari baseline as of mid-2026** `[VERIFIED: caniuse + Bryntum 2026 survey]`, and its polyfill (~20–56 KB) would itself be a new runtime dep. So the established project answer holds: hand-roll over native `Date` + `Intl.DateTimeFormat`, mirroring how `decoder.ts`, `url.ts`, `regex.ts`, and `timeFormat.ts` were all built native-only.

**Primary recommendation:** Build a pure `src/lib/cron/` core (TDD, error-as-value `CronResult` discriminated union mirroring `url.ts`/`regex.ts`). Parse into a normalized per-field allowed-set model. Compute next-run by the classic field-by-field "increment-and-carry / odometer" algorithm operating on **wall-clock components read back through `Intl.DateTimeFormat.formatToParts` in the target IANA zone** (never on `getTime()` millisecond deltas), with a hard iteration cap (a 4-year / ~5-year day-walk bound) so impossible expressions terminate. Hand-roll the description too (a small token→phrase generator). Isolate `L`/`nL`/`L-n` (CRON-10) as the final plan with its own leap-year/month-length fixtures.

## User Constraints

> No CONTEXT.md exists yet for Phase 15 (`/gsd-discuss-phase 15` has not run). These constraints are extracted from the **locked decisions already recorded in STATE.md, ROADMAP.md, and REQUIREMENTS.md** and carry the same authority. `/gsd-discuss-phase` may add more.

### Locked Decisions (from STATE.md / ROADMAP.md / REQUIREMENTS.md)

- **24-hour time** in all human-readable descriptions. `[CITED: STATE.md, ROADMAP.md Phase 15]`
- **Next 5 run times in LOCAL time**, each labeled with an IANA timezone label (mirrors the existing Unix Time tool's local/zone presentation). `[CITED: STATE.md CRON-05]`
- **Full `L` / `nL` / `L-n` support is in scope** (CRON-10), planned as an **explicitly isolated final plan** with dedicated leap-year/month-length edge-case fixtures, so the rest of cron ships even if `L`-syntax proves hard. `[CITED: STATE.md, ROADMAP.md Phase 15]`
- **Four correctness traps the iterator must handle:** (1) DOM/DOW OR-union semantics, (2) `0`/`7`=Sunday + 1-based months, (3) DST-correct wall-clock field iteration via component read-back (NOT millisecond deltas), (4) a hard iteration cap so impossible expressions (Feb-30) terminate gracefully. `[CITED: STATE.md, ROADMAP.md CRON-06/07/08]`
- **`@reboot`** is described as run-at-startup with **no scheduled next-run** — no clock computation attempted (CRON-09). `[CITED: REQUIREMENTS.md CRON-09]`

### Claude's Discretion

- Exact internal model for normalized fields, the iteration-cap constant, the description-generator structure, the view layout (single scrolling view vs. tabs), the IANA-zone selection UX (default to the system zone via `Intl.DateTimeFormat().resolvedOptions().timeZone`; whether a zone picker is offered is open). The discuss-phase will likely settle layout/zone-picker.

### Deferred Ideas (OUT OF SCOPE)

- **CRON-F1**: `W` (nearest-weekday) and `#` (nth-weekday) **next-run computation** is deferred. They may be **parse-tolerant** in v1.3 (recognized without throwing if encountered) but are **NOT scheduled**. `[CITED: REQUIREMENTS.md CRON-F1, "Out of Scope" table]`
- Any cron/date library (`cron-parser`, `croniter`, `date-fns`, `luxon`), `cronstrue`, the `Temporal` API or its polyfill — all violate zero-new-runtime-deps. `[CITED: REQUIREMENTS.md "Out of Scope"]`
- Modifying `src/lib/protobuf/decoder.ts` or its 19 tests (hard constraint). `[CITED: CLAUDE.md, REQUIREMENTS.md]`

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CRON-01 | Paste 5-field expr → 24h human-readable description, paste-instant | Description generator (hand-rolled) + parser §"Parsing/validation"; paste-instant via `useMemo` (mirror regex/url views) |
| CRON-02 | 6-field (with-seconds) parsed & described; 5-vs-6 disambiguated by field count | §"5 vs 6 field disambiguation" — count whitespace-split tokens after macro-expansion; field 0 = seconds |
| CRON-03 | Macros (`@yearly`/`@annually`, `@monthly`, `@weekly`, `@daily`/`@midnight`, `@hourly`, `@reboot`) | §"Macros" table — expand to canonical 5-field before parse; `@reboot` is a sentinel |
| CRON-04 | Full field syntax: `*`, ranges `1-5`, steps `*/15` & `0-30/10`, lists `1,3,5`, names `MON`/`JAN` | §"Field grammar" + name-maps; step-from-non-zero-base is Pitfall 2 |
| CRON-05 | Next 5 runs in local time + IANA TZ label | §"Next-run algorithm" + §"DST"; format each via `Intl.DateTimeFormat` |
| CRON-06 | DOM/DOW OR-union; `0` and `7` both = Sunday | §"DOM/DOW OR-union semantics" — the Vixie rule, verified |
| CRON-07 | DST-correct: iterate wall-clock fields, not ms deltas | §"DST correctness" — `formatToParts` read-back; spring-forward/fall-back handling |
| CRON-08 | Impossible expr terminates gracefully ("no upcoming runs") via bounded cap | §"Bounded iteration cap" — day-walk bound (~5 years) |
| CRON-09 | `@reboot` = run-at-startup, no next-run computed | Sentinel branch — describe only, return no schedule |
| CRON-10 | `L` / `nL` / `L-n` correct, leap-year & month-length aware (isolated slice) | §"L / nL / L-n" + canonical fixtures table |
| CRON-11 | Invalid expr → clear inline error, no throw | error-as-value `CronResult` (mirror `url.ts`) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **(none — hand-rolled)** | — | Cron parse + next-run + description | **Zero-new-runtime-deps is the product wedge** `[CITED: REQUIREMENTS.md]`. Every prior tool (`decoder.ts`, `url.ts`, `regex.ts`, `timeFormat.ts`) is native-only. |
| Native `Date` | ES2020 (built-in) | Calendar arithmetic substrate (UTC component constructors) | `[VERIFIED: tsconfig target ES2020, node 22]` |
| `Intl.DateTimeFormat` + `.formatToParts` | ECMA-402 (built-in) | Read wall-clock components in an arbitrary IANA zone; render local labels | DST-correct, IANA-zone-aware, already used by `timeFormat.ts` `[VERIFIED: src/lib/timeFormat.ts; MDN]` |
| `Intl.DateTimeFormat().resolvedOptions().timeZone` | ECMA-402 (built-in) | Detect the system IANA zone for the default label | `[CITED: MDN Intl.DateTimeFormat/resolvedOptions]` |

### Supporting (project primitives to reuse — NOT new deps)
| Module | Purpose | When to Use |
|--------|---------|-------------|
| `@/lib/platform` clipboard seam | Copy results | Every copyable readout (never `@tauri-apps/*` directly) `[VERIFIED: CLAUDE.md, RegexTool.tsx]` |
| `@/shell/useCopyFeedback` | Copy-confirm UX | Per the `CopyButton` pattern in `RegexTool.tsx` `[VERIFIED: src/tools/regex/RegexTool.tsx:82]` |
| `@/components/SegmentedControl` (+ `toggleClasses`) | Any mode/scope toggle | Extracted in Phase 13, reused by 14 `[VERIFIED: registry import]` |
| `ResizableSplit` / `StatusBar` / `CopyButton` | Layout chrome | Generic shell primitives (StatusBar is opt-in; cron is not byte-oriented → likely omit, like Regex) `[CITED: STATE.md architecture notes]` |
| `lucide-react` `Clock` glyph | Sidebar icon | `Clock` is present in the installed `lucide-react@1.17.0` `[VERIFIED: node_modules/lucide-react/dist/esm/icons]` (also `alarm-clock`, `calendar-clock`, `timer` available) |

### Alternatives Considered (and rejected)
| Instead of hand-roll | Could Use | Tradeoff — why rejected |
|------------|-----------|-------------------------|
| Hand-rolled next-run | `cron-parser` (npm) | New runtime dep + pulls `luxon`; violates the wedge `[CITED: REQUIREMENTS.md Out of Scope]` |
| Hand-rolled description | `cronstrue` (MIT) | ~42 KB minified, new runtime dep — disqualified despite being MIT & dependency-free & offline-safe `[VERIFIED: npmjs.com/package/cronstrue — "about 42k minified", MIT, 0 deps]` |
| `Intl.formatToParts` wall-clock | `Temporal.ZonedDateTime` | **Not in Safari/WebKit baseline (mid-2026)** — not even in Tech Preview without the `--use-temporal` flag `[VERIFIED: caniuse/temporal ~69% coverage, gap is Safari; Bryntum "JavaScript Temporal in 2026"]`; polyfill is 20–56 KB new dep `[VERIFIED: same]` |
| `Intl.formatToParts` wall-clock | `date-fns-tz` / `luxon` | New runtime deps; same wedge violation |

**Installation:** None. `npm install` adds nothing. The phase is verified by `git diff` showing **zero** `package.json`/lockfile changes (same gate every v1.3 phase passed).

## Architecture Patterns

### Recommended Project Structure (mirrors regex/url exactly)
```
src/lib/cron/
├── cron.ts          # pure, total core: parse → CronResult; describe(); nextRuns()
├── cron.test.ts     # TDD — the bulk of the phase (parse, describe, next-run, DOM/DOW, DST, impossible)
└── (optional) fields.ts  # field-grammar parser + range tables, if cron.ts gets large
src/tools/cron/
├── CronTool.tsx     # thin layout-agnostic view (paste-instant useMemo over the core)
├── CronTool.test.tsx# component tests (jsdom)
└── index.ts         # one ToolDefinition { id:"cron", icon:Clock, category:"converters", component }
```
Then **one import + one append** in `src/lib/tools/registry.ts` (the `TOOLS` array). No router/sidebar/palette edits — they auto-derive `#/tools/cron`. `[VERIFIED: registry.ts, url/index.ts, regex/index.ts]`

Category: `"converters"` is the right `ToolCategory` (the backlog lists "Cron Parser" under Converters `[CITED: ROADMAP.md backlog 999.1]`; `time` is also defensible — discuss-phase call).

### Pattern 1: Error-as-value discriminated result (the project's universal core shape)
**What:** The pure core never throws; it returns a tagged union the view renders without its own try/catch.
**When to use:** The entire `cron.ts` surface (CRON-11 demands no-throw).
**Example:**
```typescript
// Mirror of src/lib/url.ts ParseResult and src/lib/regex.ts RegexResult.
// Source: src/lib/url.ts:33, src/lib/regex/regex.ts:40 (VERIFIED in-repo)
export interface CronRun { date: Date; label: string; } // label = Intl-formatted local + IANA zone

export type CronResult =
  | { kind: "scheduled"; description: string; runs: CronRun[] }      // normal expr
  | { kind: "reboot"; description: string }                          // @reboot — no runs (CRON-09)
  | { kind: "never"; description: string }                           // impossible expr (CRON-08)
  | { kind: "empty" }                                                // neutral state
  | { kind: "error"; message: string };                             // invalid (CRON-11)

export function analyzeCron(input: string, now: Date, zone: string): CronResult { /* total, never throws */ }
```

### Pattern 2: Normalized field model (parse once, match many)
**What:** Parse each field into an explicit allowed-set (or a compact predicate) up front, so next-run matching is a pure membership test per component.
**When to use:** Between parse and next-run.
**Example:**
```typescript
// Each numeric field becomes a Set<number> (or sorted array) of allowed values,
// already expanded for *, ranges, steps, lists, and names. DOM/DOW also carry
// "isRestricted" (was it a wildcard?) for the OR-union rule, plus any L-markers.
interface CronFields {
  second: Set<number>;        // 0..59  (6-field only; defaults to {0} for 5-field)
  minute: Set<number>;        // 0..59
  hour: Set<number>;          // 0..23
  dom: { values: Set<number>; restricted: boolean; lastDay: boolean; lastOffset?: number }; // 1..31 + L/L-n
  month: Set<number>;         // 1..12
  dow: { values: Set<number>; restricted: boolean; lastWeekday?: number };  // 0..6 (7→0) + nL
}
```
Normalizing `7→0` for DOW and keeping months 1-based (matching cron) avoids the classic off-by-one. `restricted` = "the field was not `*`/`*/n`-over-full-range" — needed for the OR-union rule.

### Pattern 3: Next-run by wall-clock odometer (increment-and-carry)
**What:** The canonical algorithm used by croniter / cron-parser / Quartz: start from `now+1s` (or `+1min` for 5-field), then repeatedly find the smallest field that does not match and bump it to its next allowed value, carrying into the higher field and resetting all lower fields to their minimum allowed value. Iterate on **wall-clock components in the target zone**, not on a millisecond timeline.
**When to use:** `nextRuns()`.
**Example:** see §"Code Examples" below.

### Anti-Patterns to Avoid
- **Millisecond-delta stepping** (`t += 60_000` in a loop): breaks across DST — spring-forward skips an hour of wall-clock minutes, fall-back repeats them, producing missing or duplicate runs. Forbidden by CRON-07. Step **wall-clock fields**.
- **`dangerouslySetInnerHTML`** for the description/highlights: same absence-grep discipline as Regex/URL — render escaped React text only `[CITED: STATE.md, RegexTool.tsx]`.
- **Caching a `RegExp`/`Intl.DateTimeFormat` with mutable state across calls** — keep the core pure (the regex tool hit `lastIndex` corruption; the analog here is reusing a formatter is fine since it's stateless, but don't share parse state).
- **A `while(true)` next-run loop with no cap** — directly causes the CRON-08 freeze. Always bound.
- **Importing `@tauri-apps/*`** anywhere — go through `@/lib/platform` `[CITED: CLAUDE.md]`.

## Don't Hand-Roll

> **PHASE-SPECIFIC INVERSION:** For most domains this section says "use a library." For Phase 15 the project has **deliberately chosen to hand-roll the cron engine AND the description** because zero-new-runtime-deps is the product wedge. The table below therefore lists the *narrow* primitives to still delegate to native APIs (do NOT reimplement these), and the explicit hand-roll boundary.

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reading wall-clock Y/M/D/h/m/s in an arbitrary IANA zone | A hand-rolled UTC-offset/DST table | `Intl.DateTimeFormat(zone,…).formatToParts(date)` | The IANA/tzdata rules (historical DST, leap seconds, zone changes) are enormous and change yearly; the engine ships tzdata `[CITED: MDN formatToParts; ECMA-402]` |
| Formatting the local run-time label | A custom 24h formatter | `Intl.DateTimeFormat` with `hourCycle:"h23"` | Locale + zone correct, matches `timeFormat.ts` precedent `[VERIFIED: src/lib/timeFormat.ts]` |
| Default zone detection | Parsing OS env | `Intl.DateTimeFormat().resolvedOptions().timeZone` | Built-in, returns the IANA name `[CITED: MDN]` |
| Calendar math (days-in-month, leap years, weekday-of-date) | A leap-year `if` ladder | Native `Date` UTC constructors: `new Date(Date.UTC(y, m, 0)).getUTCDate()` gives days-in-month; `Date.UTC` normalizes overflow | Native `Date` already knows leap years; use it as the arithmetic substrate, then *interpret* via `Intl` for zone `[VERIFIED: standard JS idiom]` |

**HAND-ROLL boundary (the deliberate part):**
- **Hand-roll** the field grammar parser, the normalized model, the increment-and-carry next-run engine, the DOM/DOW OR-union logic, the `L`/`nL`/`L-n` resolution, and the human-readable description generator.
- **Do NOT hand-roll** the four native-API primitives above. They are *inside* the hand-rolled engine.

**Key insight:** Hand-rolling the *cron logic* is correct here; hand-rolling *timezone/DST math* would be a serious mistake. The seam between them is: cron logic decides "which wall-clock Y/M/D/h/m/s do I want next"; `Intl`/`Date` answer "what real instant is that wall-clock time in this zone, and is it valid." Keep that seam crisp.

## Common Pitfalls

### Pitfall 1: DOM/DOW confusion — the OR-union rule
**What goes wrong:** Treating day-of-month and day-of-week as a simple AND. `30 4 1 * 5` ("4:30 on the 1st AND on Fridays") naively fires only on a Friday-the-1st.
**Why it happens:** Vixie cron has a special-case: **if BOTH dom and dow are restricted (neither is `*`), a day matches if EITHER matches (OR/union). If exactly one is `*`, the other is ANDed normally.** `[VERIFIED: croniter docs "default POSIX cron behavior is to match when either field matches (OR)"; cronsim; multiple sources]`
**How to avoid:** Track `restricted` per field. Day matches when:
```
(dom.restricted && dow.restricted) ? (domMatch || dowMatch)
                                    : (domMatch && dowMatch)
```
Note `*/n` over the full range and a bare `*` both count as "not restricted"; an explicit list/range/single counts as restricted. (croniter exposes this as the `day_or` switch, default OR.)
**Warning signs:** A test with both fields set fires too rarely.

### Pitfall 2: Step from a non-zero base (`0-30/10` vs `*/10`)
**What goes wrong:** `0-30/10` should yield `{0,10,20,30}`; `*/10` yields `{0,10,20,30,40,50}`. Treating the `/10` as always "every 10th from field-min" drops the range's upper bound, or starting the step from the wrong base.
**Why it happens:** A step applies *within the range that precedes the slash*. `a-b/s` = every `s`-th value from `a` up to and including `b`. `*/s` = `min-max/s`. A bare `n/s` (some cron flavors) = `n-max/s`.
**How to avoid:** Parse `<range>/<step>` as: expand the base range first (`*`→full, `a-b`→[a..b], bare `a`→[a..max]), then keep every `s`-th element starting at the range's low end.
**Warning signs:** `0-30/10` produces a 40 or 50; off-by-one at range ends.

### Pitfall 3: 0-vs-7 Sunday and 1-based months / 0-based DOW
**What goes wrong:** `0` and `7` must both mean Sunday; months are 1–12 in cron but **0–11 in JS `Date`**; cron DOW is 0–6 (Sun–Sat) while JS `Date.getUTCDay()` is also 0–6 (Sun–Sat) — *that one happens to align*, but month does not.
**How to avoid:** Normalize `7→0` in the DOW set at parse time. Keep the cron month set 1-based internally and subtract 1 only when touching `Date`/`Date.UTC`. Add explicit fixtures for `* * * * 0`, `* * * * 7`, and `0 0 1 1 *` (Jan).
**Warning signs:** Sunday or January off by one; December wrapping wrong.

### Pitfall 4: 6-field shifts everything (seconds field)
**What goes wrong:** A 6-field expression's first field is **seconds**, so misreading field count shifts minute→hour→… by one.
**How to avoid:** After macro-expansion, split on whitespace and count: 5 tokens → `[min hour dom month dow]` with `second={0}`; 6 tokens → `[sec min hour dom month dow]`. Reject any other count with a clear error (CRON-11). `[CITED: standard cron-with-seconds convention]`
**Warning signs:** "every minute" expressions described as "every second".

### Pitfall 5: Impossible expression infinite loop (CRON-08)
**What goes wrong:** `0 0 30 2 *` (Feb 30) never matches; an uncapped odometer spins forever and freezes the single-threaded WKWebView.
**Why it happens:** No date ever satisfies the constraints, so the carry never terminates.
**How to avoid:** Bound the search. Because the longest legitimate gap between runs for any *satisfiable* standard expression is under ~1 year (worst realistic case: a specific month/day/dow combination), a cap of **iterating at most ~4–5 years of candidate days** guarantees termination and is safely above any real schedule. On hitting the cap, return `{ kind: "never" }` → "No upcoming runs" message. (croniter uses a configurable `max_years_between_matches`, default 50→ but for *finding 5 runs* a 4–5 year day-walk is the right bound here.) `[VERIFIED: croniter PyPI — CPU-cycle cap rationale]`
**Warning signs:** UI hangs on Feb-30 / impossible dow+dom combos.

### Pitfall 6: DST spring-forward (skipped hour) and fall-back (repeated hour)
**What goes wrong (spring-forward):** In `America/New_York`, 2:30 AM does not exist on the spring-forward day. A schedule `30 2 * * *` on that date must NOT silently double-fire or vanish incorrectly — common cron convention is to **run it once at the next valid wall-clock instant** (or skip, depending on flavor). At minimum: never crash, never duplicate.
**What goes wrong (fall-back):** 1:30 AM occurs twice. A daily `30 1 * * *` must fire **once**, not twice.
**Why it happens:** Wall-clock 2:30 maps to no instant (spring) or two instants (fall) in the zone.
**How to avoid:** Iterate wall-clock fields and construct the candidate instant via the zone-aware round-trip (see Code Examples). Detect the skipped-hour case (the constructed instant's read-back hour ≠ the requested hour) and advance; de-dupe fall-back by tracking the last emitted instant's epoch ms so the repeated wall-clock hour yields one run. Document the chosen convention in a fixture.
**Warning signs:** A test on the US spring-forward/fall-back dates yields 4 or 6 runs where 5 distinct instants are expected, or a duplicate timestamp in the list.

### Pitfall 7: Off-by-one on ranges (inclusive bounds)
**What goes wrong:** `MON-FRI` / `1-5` is inclusive of both ends (`{1,2,3,4,5}`). Treating it as exclusive drops Friday.
**How to avoid:** Range expansion is `[a..b]` inclusive. Validate `a<=b` (and handle wrap conventions if you choose to support `FRI-MON`; standard Vixie does NOT wrap — reject or document). Add `1-5`, `0-6`, `JAN-DEC` fixtures.

### Pitfall 8: `formatToParts` returns strings + locale quirks
**What goes wrong:** `formatToParts` values are **strings** ("01", "9"), may include non-numeric parts, and an explicit `en-US`-ish numeric locale must be forced or some locales emit non-Latin digits.
**How to avoid:** Construct the formatter with a fixed locale (e.g. `"en-US"`) and `hourCycle:"h23"`, map parts by `type` into a `{year,month,day,hour,minute,second}` numeric record via `Number(...)`. Use a 24h hour cycle so `hour:"24"` never appears (`h23` keeps 0–23). `[VERIFIED: MDN formatToParts]`
**Warning signs:** `NaN` components; midnight rendered as `24:00`.

## Code Examples

### Read wall-clock components of an instant IN a target IANA zone (DST-safe)
```typescript
// Source: MDN Intl.DateTimeFormat.formatToParts (CITED) + src/lib/timeFormat.ts precedent (VERIFIED)
function zonedParts(instant: Date, zone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { year: get("year"), month: get("month"), day: get("day"),
           hour: get("hour"), minute: get("minute"), second: get("second"),
           weekday: instant.getUTCDay() /* see note */ };
}
```
> NOTE: weekday must be derived from the *zoned* date, not `getUTCDay()` directly. Add `weekday:"short"` to the formatter (or compute the weekday of the zoned Y/M/D via a UTC `Date`). Compute it from the zoned year/month/day for correctness.

### Find the instant for a desired wall-clock time in a zone (the round-trip)
```typescript
// Build the UTC guess, read it back in-zone, correct the offset once (two-pass).
// This is the standard "wall-clock → instant in zone" idiom without Temporal.
function wallClockToInstant(y:number, mo:number, d:number, h:number, mi:number, s:number, zone:string): Date | null {
  // mo is 1-based cron month; Date.UTC wants 0-based.
  const guess = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  const back = zonedParts(guess, zone);
  // Offset between what we asked for and what the zone shows at this instant:
  const asked = Date.UTC(y, mo - 1, d, h, mi, s);
  const shown = Date.UTC(back.year, back.month - 1, back.day, back.hour, back.minute, back.second);
  const corrected = new Date(guess.getTime() + (asked - shown));
  // Verify: a skipped (spring-forward) wall-clock time won't round-trip cleanly.
  const verify = zonedParts(corrected, zone);
  const ok = verify.year===y && verify.month===mo && verify.day===d
          && verify.hour===h && verify.minute===mi && verify.second===s;
  return ok ? corrected : null; // null => this wall-clock time does not exist (spring-forward gap)
}
```
> Confidence MEDIUM on the exact two-pass form — the *approach* (offset-correct + verify round-trip) is the well-known Temporal-less technique; the planner should TDD it against real DST fixtures (below) rather than trust this sketch verbatim.

### Next-run odometer (increment-and-carry over wall-clock fields)
```typescript
// Pseudocode of the croniter/cron-parser/Quartz algorithm. Day-granular walk for
// dom/dow/month, then minute/hour (and second for 6-field) within the matched day.
function* nextRuns(f: CronFields, now: Date, zone: string, cap = 5*366): Generator<Date> {
  // Start at the next whole second/minute after now (in zone), walk DAYS:
  let { year, month, day } = startOfNextDay(now, zone); // or current day if intra-day candidates remain
  for (let i = 0; i < cap; i++, ({year,month,day} = addOneDay(year,month,day))) {
    if (!f.month.has(month)) continue;
    if (!dayMatches(f, year, month, day)) continue;      // OR-union + L-syntax here
    // Day matches → emit every (hour,minute[,second]) in ascending order that is >= now
    for (const h of sorted(f.hour))
      for (const mi of sorted(f.minute))
        for (const s of sorted(f.second)) {
          const inst = wallClockToInstant(year, month, day, h, mi, s, zone);
          if (inst && inst.getTime() > now.getTime()) yield inst; // skip spring-forward gaps (null)
        }
  }
  // Falls off the end after `cap` days with no (more) matches → caller treats as "never"/done.
}
```
> The DAY-granular outer walk is the simplest correct structure for DOM/DOW/L (it sidesteps month-length and leap-year carry math — `addOneDay` via `Date.UTC` normalizes overflow). The cap counts *candidate days* (~5 years), satisfying CRON-08.

### `dayMatches` — OR-union + L-syntax (CRON-06, CRON-10)
```typescript
function dayMatches(f: CronFields, y: number, mo: number, d: number): boolean {
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate(); // mo is 1-based → Date.UTC(y,mo,0)=last day
  const weekday = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();  // 0=Sun..6=Sat

  // DOM with L / L-n:
  const domMatch =
    (f.dom.lastDay && f.dom.lastOffset == null && d === daysInMonth) ||
    (f.dom.lastOffset != null && d === daysInMonth - f.dom.lastOffset) ||
    f.dom.values.has(d);

  // DOW with nL (last <weekday> of month, e.g. 5L = last Friday):
  const isLastWeekdayOfMonth = f.dow.lastWeekday != null
    && weekday === f.dow.lastWeekday && d + 7 > daysInMonth;
  const dowMatch = f.dow.values.has(weekday) || isLastWeekdayOfMonth;

  return (f.dom.restricted && f.dow.restricted) ? (domMatch || dowMatch)
                                                : (domMatch && dowMatch);
}
```
> `Date.UTC(y, mo, 0)` (note: `mo` 1-based, day `0`) returns the last day of month `mo` — leap-year-correct for free `[VERIFIED: standard JS idiom]`. This is the leap-year/month-length awareness CRON-10 requires.

## L / nL / L-n semantics (CRON-10 — the isolated high-risk slice)

Conventions (Quartz, the de-facto reference for `L`) `[VERIFIED: quartz-scheduler.org CronTrigger tutorial + crontap reference]`:

| Token | Field | Meaning |
|-------|-------|---------|
| `L` | day-of-month | **Last day of the month** (28/29/30/31, leap-aware). |
| `L-n` | day-of-month | **n days before the last day.** `L-3` = the 3rd-from-last day. `[VERIFIED: Quartz "L-N means N days before the last day"]` |
| `nL` (e.g. `5L`) | day-of-week | **Last <weekday-n> of the month.** `5L` = last Friday (Quartz: 1=Sun..7=Sat in DOW; **but standard cron uses 0–6 — confirm the mapping you adopt and fixture it**). |
| `LW` | day-of-month | Last weekday (Mon–Fri) of month. **DEFER unless trivial** — depends on `W`, which is CRON-F1 out-of-scope. Recommend: parse-tolerant or reject cleanly; do not schedule. |

> **DOW numbering caution for `nL`:** Quartz DOW is 1–7 (Sun=1); Unix/Vixie DOW is 0–6 (Sun=0). This phase uses **0–6 with 0/7=Sunday** (CRON-06). So `5L` in *this tool* must mean **last Friday** under the 0–6 mapping (5=Fri). Lock this in a fixture and a doc-comment; it is the single most likely source of an off-by-one.

### Canonical CRON-10 edge-case fixtures (give these to the planner)
| Expression (context now) | Expected | Why it's tricky |
|--------------------------|----------|-----------------|
| `0 0 L * *` | last day of each month: Jan 31, Feb 28/29, Apr 30 | month-length variance |
| `0 0 L 2 *` in 2024 | **Feb 29, 2024** | leap year |
| `0 0 L 2 *` in 2025 | **Feb 28, 2025** | non-leap year |
| `0 0 L-3 * *` | Jan 28, Feb 25 (2025) / 26 (2024), Apr 27 | offset interacts with month length + leap |
| `0 0 L-0 * *` | same as `L` | boundary: offset 0 |
| `0 0 5L * *` (5=Fri) | last Friday of month | `d + 7 > daysInMonth` test |
| `0 0 5L 2 *` in a year where last Friday is the 28th vs 27th | correct last-Friday | weekday+month-length interaction |
| `0 0 L 4 *` | Apr 30 (30-day month) | 30 vs 31 |
| `0 0 L-31 * *` | impossible most months → contributes to "never" if no field ever matches | over-large offset → no match (must NOT crash) |

## Macros (CRON-03)

| Macro | Expands to (5-field) | Notes |
|-------|----------------------|-------|
| `@yearly` / `@annually` | `0 0 1 1 *` | midnight Jan 1 |
| `@monthly` | `0 0 1 * *` | |
| `@weekly` | `0 0 * * 0` | Sunday |
| `@daily` / `@midnight` | `0 0 * * *` | |
| `@hourly` | `0 * * * *` | |
| `@reboot` | **sentinel — no expansion** | Describe "At startup (run once when the scheduler starts)"; return `{ kind: "reboot" }`, compute NO runs (CRON-09) |

`[VERIFIED: standard Vixie/crontab macro definitions, widely documented]`

## Field grammar & range tables (CRON-04, CRON-11)

| Field | Index (6-field) | Range | Names accepted |
|-------|-----------------|-------|----------------|
| second | 0 (6-field only) | 0–59 | — |
| minute | 0 / 1 | 0–59 | — |
| hour | 1 / 2 | 0–23 | — |
| day-of-month | 2 / 3 | 1–31 | — (+ `L`, `L-n`) |
| month | 3 / 4 | 1–12 | JAN..DEC (case-insensitive) |
| day-of-week | 4 / 5 | 0–7 (0&7=Sun) | SUN..SAT (case-insensitive); `nL` |

**Parse pipeline (per field):** split top-level on `,` (lists) → each item is `*` | `<n>` | `<a>-<b>` | `<base>/<step>` | name | L-form → expand to a value set → union the list → range-check every produced value (out-of-range → `{ kind:"error" }` with a specific message naming the bad token, mirroring `url.ts`/`bytes.ts` named errors). Unknown token / wrong field count → error. Never throw (CRON-11).

## Human-readable description (CRON-01/02/03) — HAND-ROLL

**Recommendation: hand-roll a small token→phrase generator.** `cronstrue` is the obvious library and is MIT + zero-dep + offline-safe, but at ~42 KB minified it is a **new runtime dependency**, which the milestone forbids `[VERIFIED: cronstrue npm; REQUIREMENTS.md]`. Hand-rolling a *good-enough, 24-hour* describer for the supported grammar is modest and TDD-able.

**Structure (sketch):**
```typescript
// Describe from the SAME normalized CronFields the scheduler uses (single source of truth).
// Compose per-field phrases; special-case common whole-expression shapes first for nicer output.
function describe(f: CronFields, sixField: boolean): string {
  // 1. Whole-expression shortcuts: all-* minute/hour → "Every minute"; */n minute → "Every n minutes"; etc.
  // 2. Otherwise compose: timeOfDayPhrase(f.second?,f.minute,f.hour)  // "at 14:30" / "every 15 minutes"
  //                     + dayPhrase(f.dom, f.dow)                     // honor OR-union wording
  //                     + monthPhrase(f.month)                        // "in January and June"
  // 24-hour clock throughout (locked). Plain, escaped React text in the view.
}
```
Keep it pragmatic: cover the supported grammar, describe `L`/`nL`/`L-n` in words ("on the last day of the month", "on the last Friday"), and describe `@reboot` as "At startup". Do not chase cronstrue's full locale/edge polish — a clear correct 24h sentence is the bar.

## State of the Art

| Old Approach | Current Approach (2026) | When Changed | Impact here |
|--------------|------------------------|--------------|-------------|
| `moment-timezone` / `Date` offset hacks | **`Temporal.ZonedDateTime`** for wall-clock-in-zone arithmetic | Firefox 139 (May 2025), Chrome 144 (Jan 2026) | SOTA — but **unavailable in Safari/WebKit/WKWebView** (our runtime), so we cannot use it `[VERIFIED: caniuse, Bryntum 2026]` |
| Hand-rolled offset tables | `Intl.DateTimeFormat.formatToParts` (tzdata in-engine) | Broadly available years | This is our DST-safe substrate |

**Deprecated/outdated to avoid:**
- Training-era instinct "use a cron library / use Temporal" — both are correct *in general* but **wrong for this project** (deps + Safari gap). Verified, not assumed.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The two-pass `wallClockToInstant` offset-correct-then-verify is the exact right form | Code Examples / DST | MEDIUM — approach is sound (standard Temporal-less idiom) but the precise arithmetic must be TDD'd against real DST fixtures; planner should treat the snippet as a starting point, not gospel |
| A2 | A ~5-year (5×366 day) candidate-day cap is sufficient for any satisfiable supported expression while guaranteeing termination | Pitfall 5 / odometer | LOW — comfortably above any real schedule's max gap; if a pathological-but-valid expr exists, the cap only affects *that* expr's "found fewer than 5 runs" tail, never correctness of found runs |
| A3 | `5L` should mean "last Friday" under this tool's 0–6 DOW mapping (5=Fri), NOT Quartz's 1–7 (5=Thu) | L/nL section | MEDIUM — must be locked in discuss-phase + a fixture; getting the numbering wrong is the most likely off-by-one. Recommend documenting the 0–6 choice explicitly. |
| A4 | DST spring-forward convention = "skip the non-existent wall-clock time" (return null, advance); fall-back = de-dupe to one run | Pitfall 6 | MEDIUM — cron flavors differ (some run skipped jobs at the next valid instant). Pick one, fixture it, note it in UI/description. Either is defensible; consistency + no-crash + no-duplicate is what CRON-07 actually requires. |

## Open Questions

1. **Zone selection UX** — Default to the system zone (`Intl…resolvedOptions().timeZone`) only, or offer an IANA zone picker? CRON-05 only requires a *label*; a picker is nice-to-have. Recommend: default-to-system for v1.3, picker deferred. (discuss-phase call)
2. **DST convention** (see A4) — which spring-forward behavior. Recommend "skip + advance to next valid"; lock with a fixture.
3. **`LW` and `W`/`#` parse-tolerance** — CRON-F1 says `W`/`#` are not scheduled but *may* be parse-tolerant. Decide: reject with a clear "not supported in v1.3" error (simplest, honest) vs. parse-and-describe-but-don't-schedule. Recommend: **reject cleanly** for v1.3 to avoid half-features; revisit in CRON-F1.
4. **5-field default seconds** — confirm 5-field expressions fire at second 0 (standard). Recommend yes.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `Intl.DateTimeFormat` + `formatToParts` + IANA zones | DST-correct next-run, local labels | ✓ | ES/ECMA-402 built-in; used by `timeFormat.ts` | — |
| `Intl…resolvedOptions().timeZone` | Default zone label | ✓ | built-in | hardcode "UTC" |
| Native `Date` (UTC constructors) | Calendar arithmetic | ✓ | ES2020 | — |
| `Temporal` | (would-be) wall-clock arithmetic | ✗ | not in WebKit/WKWebView mid-2026 | **Intl.formatToParts round-trip (chosen)** |
| `lucide-react` `Clock` glyph | Sidebar icon | ✓ | 1.17.0 (verified present) | `calendar-clock` / `timer` / `alarm-clock` also present |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** `Temporal` → use the `Intl.DateTimeFormat.formatToParts` round-trip (already the project's locked approach).

## Validation Architecture

> `workflow.nyquist_validation` not found in config to confirm; treated as enabled. Tooling is the project's existing vitest + tsc.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `vitest` + `@testing-library/react` (jsdom); `tsc --noEmit` |
| Config file | existing project vitest config (used by all prior phases) |
| Quick run command | `pnpm vitest run src/lib/cron src/tools/cron` |
| Full suite command | `pnpm vitest run && pnpm tsc --noEmit` (the immovable 19 decoder tests must stay green) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CRON-01/02/03/04 | parse + describe 5/6-field, macros, full grammar | unit | `pnpm vitest run src/lib/cron` | ❌ Wave 0 |
| CRON-05 | next 5 runs in local time + zone label | unit | `pnpm vitest run src/lib/cron` | ❌ Wave 0 |
| CRON-06 | DOM/DOW OR-union, 0/7=Sun | unit | `pnpm vitest run src/lib/cron` | ❌ Wave 0 |
| CRON-07 | DST spring-forward/fall-back fixtures | unit (fixed `now` + zone) | `pnpm vitest run src/lib/cron` | ❌ Wave 0 |
| CRON-08 | impossible expr → "never", no hang | unit (assert returns within cap) | `pnpm vitest run src/lib/cron` | ❌ Wave 0 |
| CRON-09 | `@reboot` → reboot kind, no runs | unit | `pnpm vitest run src/lib/cron` | ❌ Wave 0 |
| CRON-10 | L / nL / L-n leap-year/month-length fixtures | unit (isolated final plan) | `pnpm vitest run src/lib/cron` | ❌ Wave 0 |
| CRON-11 | invalid expr → error-as-value, no throw | unit | `pnpm vitest run src/lib/cron` | ❌ Wave 0 |
| CRON-01..11 | tool renders, paste-instant, copyable, a11y | component + real-WKWebView e2e | `CronTool.test.tsx` + `test/e2e/cron.e2e.ts` via `scripts/e2e-spike.sh` | ❌ Wave 0 |

> **TDD note (from MEMORY + STATE):** lefthook rejects failing commits — do **not** plan standalone RED-only test commits; land each test file GREEN with its implementation (the Phase-14 Rule-4 pattern). `[VERIFIED: MEMORY tdd-red-commits-blocked-by-lefthook; STATE.md Phase 14]`

### Sampling Rate
- **Per task commit:** `pnpm vitest run src/lib/cron src/tools/cron` + `tsc --noEmit`
- **Per wave merge:** full `pnpm vitest run` (all ~580+ tests incl. the 19 decoder tests)
- **Phase gate:** full suite green + real-WKWebView `scripts/e2e-spike.sh` exit 0 + `tauri build` + `gsd-ui-review` WCAG-AA PASS + human sign-off

### Wave 0 Gaps
- [ ] `src/lib/cron/cron.test.ts` — parse/describe/next-run/DOM-DOW/DST/impossible/error (CRON-01..09, 11)
- [ ] `src/lib/cron/cron.test.ts` (or a dedicated block) — L/nL/L-n fixtures (CRON-10, isolated final plan)
- [ ] `src/tools/cron/CronTool.test.tsx` — component: paste-instant, copyable runs, error state, empty state
- [ ] `test/e2e/cron.e2e.ts` — real-WKWebView spec (add to the e2e-spike spec list; mirror `url.e2e.ts`/`regex.e2e.ts`)
- [ ] No framework install needed (vitest already present)

## Security Domain

> `security_enforcement` config not located; cron is a pure offline string→string/date tool with no auth/session/network/crypto/PII. ASVS surface is minimal.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | error-as-value parser; bounded iteration cap (DoS-by-impossible-expr); no `eval`/`Function` on input |
| V6 Cryptography | no | — |

### Known Threat Patterns for {pure offline cron tool}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Impossible/pathological expression freezes the single-threaded UI (local DoS) | Denial of Service | Hard iteration cap → `{ kind:"never" }` (CRON-08); cron is fast/bounded so **no Web Worker needed** (unlike Regex's ReDoS) |
| Untrusted text rendered into the description/highlights | Tampering (XSS) | Escaped React text only; never `dangerouslySetInnerHTML` (project absence-grep discipline) |
| Input logged/persisted | Information disclosure | Pure core never logs input (mirror `url.ts`/`regex.ts` doc-comments) |

> **Worker decision:** Cron next-run is bounded and cheap (a few thousand iterations max), so — unlike Phase 14's regex — it runs **synchronously on the main thread**; the cap, not a Worker, is the freeze protection. Confirm at the real-WKWebView gate that a 5-run compute is sub-millisecond.

## Sources

### Primary (HIGH confidence)
- In-repo (VERIFIED): `src/lib/url.ts`, `src/lib/regex/regex.ts`, `src/lib/timeFormat.ts`, `src/lib/tools/registry.ts`, `src/lib/tools/types.ts`, `src/tools/url/index.ts`, `src/tools/regex/index.ts`, `src/tools/regex/RegexTool.tsx`, `tsconfig.json`, `node_modules/lucide-react@1.17.0` — established conventions, error-as-value pattern, Intl precedent, glyph availability
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md`, `CLAUDE.md`, `docs/harness-and-decisions.md` — locked decisions, constraints, harness
- MDN — `Intl.DateTimeFormat`, `formatToParts`, `resolvedOptions` (timezone parts, IANA zones)
- caniuse.com/temporal — Temporal ~69% coverage, Safari gap (VERIFIED Temporal absence)
- quartz-scheduler.org CronTrigger tutorial + tool.crontap.com/quartz-cron-expressions — `L`/`nL`/`L-n`/`W` semantics

### Secondary (MEDIUM confidence)
- Bryntum "JavaScript Temporal in 2026 — is it finally here?" — Firefox 139 / Chrome 144 ship, Safari not shipped (cross-confirms caniuse)
- croniter (pallets-eco GitHub + PyPI) — DOM/DOW OR-union default, CPU-cycle cap rationale
- cronsim, mtdowling/cron-expression — corroborating cron-semantics implementations
- npmjs.com/package/cronstrue — MIT, 0 deps, ~42 KB minified (bundle-size disqualifier)

### Tertiary (LOW confidence)
- General community articles on cron edge cases (used only to enumerate pitfalls, all cross-checked above)

## Metadata

**Confidence breakdown:**
- Standard stack (hand-roll + native Intl/Date): **HIGH** — zero-dep constraint + Temporal absence both verified; matches every prior tool
- Next-run algorithm (odometer / day-walk): **HIGH** — canonical, cross-referenced (croniter/cron-parser/Quartz)
- DOM/DOW OR-union + 0/7 Sunday: **HIGH** — verified against croniter + multiple sources
- L/nL/L-n semantics: **HIGH** on meaning (Quartz reference); **MEDIUM** on the 0–6-vs-1–7 DOW numbering for `nL` (flagged A3)
- DST round-trip ergonomics: **MEDIUM** — approach HIGH, exact arithmetic must be TDD'd (A1, A4)
- Description hand-roll: **HIGH** — cronstrue disqualified by bundle size, verified

**Research date:** 2026-06-03
**Valid until:** ~2026-09-03 (stable domain; only Temporal/Safari status could shift — re-check caniuse if Safari ships Temporal, which would *not* change the zero-dep recommendation anyway)
