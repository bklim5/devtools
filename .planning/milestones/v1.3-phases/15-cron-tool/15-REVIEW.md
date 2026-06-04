---
phase: 15-cron-tool
reviewed: 2026-06-04T00:00:00Z
depth: deep
files_reviewed: 4
files_reviewed_list:
  - src/lib/cron/cron.ts
  - src/tools/cron/CronTool.tsx
  - src/tools/cron/index.ts
  - src/lib/tools/registry.ts
findings:
  critical: 0
  high: 0
  medium: 2
  low: 4
  total: 6
status: clean
---

# Phase 15: Cron Tool — Code Review Report

**Reviewed:** 2026-06-04
**Depth:** deep (cross-file: view → core → registry; tests read for coverage context)
**Files reviewed:** 4 source files (`cron.ts`, `CronTool.tsx`, `cron/index.ts`, `registry.ts`)
**Status:** clean (no critical/high findings)

## Summary

The Cron tool is a well-built, disciplined implementation. The pure core (`cron.ts`)
is genuinely total and error-as-value — every parse path returns a discriminated
result rather than throwing, the only regexes are fixed non-backtracking literals
(`/^\d+$/`), and there is **no** `eval` / `Function` / user-built `RegExp` anywhere
(ReDoS-safe per the threat model). The next-run engine reads wall-clock components
back through `Intl.formatToParts` rather than doing millisecond-delta stepping, the
iteration is hard-capped at `CANDIDATE_DAY_CAP` (no unbounded `while`), and DST
skip/fall-back is handled by `wallClockToInstant` returning `null` + the de-dupe on
`lastEmittedMs`. The view renders all core output as escaped React children with no
`dangerouslySetInnerHTML`, copies through the `platform.clipboard` seam (never
`@tauri-apps/*`), and is layout-agnostic. 24-hour discipline is enforced via explicit
`hourCycle:"h23"` on every formatter.

**Project-constraint verification (all PASS):**
- `decoder.ts` byte-for-byte untouched (`git diff --quiet` clean).
- Zero new runtime/dev deps; no `package.json` / lockfile change.
- Registry single control plane: one import + one array entry; sidebar/palette/router auto-derive `#/tools/cron`. No HashRouter violation.
- No `eval` / `Function` / user-built `RegExp` on cron input; per-token validation only.
- No `dangerouslySetInnerHTML`; no `@tauri-apps/*` import in the tool.
- 24-hour everywhere via `hourCycle:"h23"`; next-run via component read-back; bounded cap present.

No critical or high-severity issues found. The findings below are correctness edge
cases worth a glance and cosmetic/robustness polish — none block the phase.

## Medium

### MD-01: `nextRuns` intra-day inner loop iterates seconds×minutes×hours unconditionally for whole-day expressions

**File:** `src/lib/cron/cron.ts:565-583`
**Issue:** For an expression like `* * * * *` (or worse, a 6-field `* * * * * *`),
the inner `hours × minutes × seconds` loop runs up to 24×60×60 = 86,400
`wallClockToInstant` calls **per candidate day**, each constructing two
`Intl.DateTimeFormat` round-trips. It returns after the first 5 matches strictly
after `now`, so in practice it exits within the first minute of the start day — but
the worst case (e.g. `now` at 23:59:59 with a sparse-second expression that forces a
roll to the next day) still does meaningful work, and `* * * * * *` allocates a `Date`
+ two `formatToParts` per second walked. This is correctness-safe (bounded, returns
quickly in the common case) and v1-out-of-scope for pure performance, but it is a
latent hot path on the paste-instant main-thread `useMemo`.
**Fix:** Optional. Since the description-shortcut path already detects full-range
minute/hour, you could short-circuit the labeller for the `Every minute` shape, or
precompute the first matching `(h,mi,s)` >= the start-of-day cursor instead of
scanning from 0. Not required for v1; flag for the WKWebView gate timing check the
threat model (T-15-10) already calls for.

### MD-02: `relativeTime` caption uses a live `Date.now()` while run instants are frozen at last keystroke

**File:** `src/tools/cron/CronTool.tsx:59-62,166-167`
**Issue:** `result` (and the `run.date` instants) is memoized on `[expr, zone]`, so
the runs are computed against the `new Date()` captured when `expr` last changed.
`relativeTime(run.date.getTime())` inside the render, however, calls
`Date.now()` *live on every render*. These two clocks can drift: if the component
re-renders for an unrelated reason minutes later, the relative caption shifts while
the absolute run labels stay frozen, and a run can read "in 0 seconds" / "1 minute
ago" while still listed as upcoming. Cosmetic, not a crash, but the absolute and
relative times can momentarily disagree.
**Fix:** Pass the same `now` into `relativeTime` that fed `analyzeCron`. Capture it
in the memo and thread it through, e.g.:
```tsx
const { result, now } = useMemo(() => {
  const n = new Date();
  return { result: analyzeCron(expr, n, zone), now: n.getTime() };
}, [expr, zone]);
// ...
{relativeTime(run.date.getTime(), now)}
```
This keeps the absolute and relative captions consistent.

## Low

### LO-01: "3-th-from-last" / "21-th-from-last" ungrammatical ordinal in the L-n description

**File:** `src/lib/cron/cron.ts:725`
**Issue:** `domPhrase` emits `` `the ${dom.lastOffset}-th-from-last day of the month` ``,
producing user-facing copy like "the 3-th-from-last day of the month". The test at
`cron.test.ts:509` even asserts this literal (`"3-th-from-last"`), so it is locked-in
but reads as a bug to anyone seeing it in the UI.
**Fix:** Add a tiny ordinal helper (1→"1st", 2→"2nd", 3→"3rd", n→"nth") and render
"the 3rd-from-last day of the month". Update the one test assertion accordingly.

### LO-02: `timeOfDayPhrase` mislabels the hour noun for a single hour with a minute list

**File:** `src/lib/cron/cron.ts:707-712`
**Issue:** When the minute field is a set and the hour is single (e.g. `0,30 9 * * *`),
the code computes `hourWord = hourSingle ? "hour" : "hours"` and emits
"At minute 0 and 30 past hour 09". "past hour 09" is slightly awkward and the
inverted common case (single minute, multiple hours, e.g. `0 9,17 * * *`) reads
"At minute 0 past hours 09 and 17" — serviceable but not as natural as a per-hour
phrasing. No correctness impact; 24-hour discipline is preserved.
**Fix:** Optional copy polish — consider "At 09:00 and 09:30" for the small
single-hour/multi-minute case, or drop the literal word "hour". Low priority.

### LO-03: Run-label formatter uses the system locale, so digit script/ordering is locale-dependent

**File:** `src/lib/cron/cron.ts:544-549`
**Issue:** The `nextRuns` labeller passes `undefined` as the locale
(`new Intl.DateTimeFormat(undefined, { dateStyle, timeStyle, hourCycle:"h23" })`).
`hourCycle:"h23"` correctly forces 24-hour and suppresses AM/PM, but under a non-Latin
locale (e.g. `ar`, `fa`) the labeller can render non-Latin digits and RTL date
ordering. The internal `zonedParts` formatter correctly pins `"en-US"` for its numeric
read-back, so computation is unaffected — only the displayed `run.label` varies. This
is arguably correct (localized display), but the e2e/unit tests assert the literal
`09:00`, which only holds under Latin-digit locales. Worth a conscious decision.
**Fix:** If a stable Latin display is desired, pin the labeller locale (e.g. `"en-GB"`
or `"en-US"` with `hourCycle:"h23"`). If localized display is intended, leave as-is and
note that the `09:00` assertions assume the test runner's locale.

### LO-04: `addOneDay`/`asc`/`zonedParts` recompute every iteration; `month.has(mo)` checked before cheap day-skip

**File:** `src/lib/cron/cron.ts:565-582`
**Issue:** Minor: the candidate-day walk advances one calendar day at a time even when
the `month` field excludes whole months (e.g. `0 0 * 6 *` walks every day of every
non-June month inside the 5×366 cap until it lands in June). The cap guarantees
termination so this is correctness-safe, but it does up to ~1830 `addOneDay`
`Date.UTC` allocations for a sparse month. Out of v1 perf scope; noting for
completeness.
**Fix:** None required. If revisited, skip to the 1st of the next allowed month when
`!f.month.has(mo)`.

---

**Cross-file checks (deep):** `analyzeCron`'s `CronResult` union exactly matches the
kinds the view switches on (`empty`/`error`/`scheduled`/`never`/`reboot`); every kind
is handled and there is no unhandled `default`-fall-through. `CopyButton` consumes
`run.label` and `result.description` — both plain strings from the core. The registry
import/type (`ToolDefinition`) is consistent with the other 11 tools. No circular
imports introduced (`cron.ts` imports nothing project-local; `CronTool.tsx` imports
`@/lib/cron/cron`, `@/lib/timeFormat`, `@/lib/platform`, `@/shell/useCopyFeedback`).

---

_Reviewed: 2026-06-04_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
