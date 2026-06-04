// Pure cron core for the Cron tool (Phase 15, CRON-01..11). Thin error-as-value
// parse + describe over native primitives — zero new runtime deps. This module is
// the interface-contract wave: Plans 02 (next-run engine) and 03 (L-syntax) import
// CronFields / CronResult / CronRun from here and extend analyzeCron.
//
// The whole surface is PURE and TOTAL — it never throws, never touches the DOM, and
// never logs the input expression (mirror src/lib/url.ts / src/lib/regex/regex.ts).
// The parser uses only fixed split + integer parse + range-check on the untrusted
// expression: NO eval / Function / user-built RegExp (T-15-01); the only regexes are
// fixed linear non-backtracking literals (T-15-02). Empty input is a neutral state,
// never an error (mirror url.ts D-15). This plan computes NO next-runs — it returns
// `runs: []` for valid non-reboot expressions; Plan 02 fills them.

/** One computed next run (Plan 02 fills these). label = Intl-formatted local + IANA zone. */
export interface CronRun {
  date: Date;
  label: string;
}

/**
 * Discriminated result the view renders without try/catch (mirror src/lib/url.ts).
 * `never` (impossible expression) is produced by Plan 02's iterator; this plan
 * returns `scheduled` (runs: []) / `reboot` / `empty` / `error`.
 */
export type CronResult =
  | { kind: "scheduled"; description: string; runs: CronRun[] } // normal expr
  | { kind: "reboot"; description: string } // @reboot — no runs (CRON-09)
  | { kind: "never"; description: string } // impossible expr (CRON-08, Plan 02)
  | { kind: "empty" } // neutral state
  | { kind: "error"; message: string }; // invalid (CRON-11)

/**
 * Normalized field model — parse once, match many. Each numeric field is the
 * explicit Set of allowed values, already expanded for *, ranges, steps, lists,
 * and names. DOM/DOW also carry `restricted` (was it NOT a wildcard?) for the
 * OR-union rule (CRON-06), plus the L-marker slots Plan 03 fills.
 */
export interface CronFields {
  second: Set<number>; // 0..59  (6-field only; defaults to {0} for 5-field)
  minute: Set<number>; // 0..59
  hour: Set<number>; // 0..23
  /** 1..31 + L / L-n (markers parsed in Plan 03; this plan leaves them false/unset). */
  dom: {
    values: Set<number>;
    restricted: boolean;
    lastDay: boolean;
    lastOffset?: number;
  };
  month: Set<number>; // 1..12
  /** 0..6 (7→0) + nL (Plan 03). */
  dow: { values: Set<number>; restricted: boolean; lastWeekday?: number };
}

// --- Named error constants (mirror url.ts: name the bad token AND the valid range). ---
const UNSUPPORTED_TOKEN =
  "`W`, `#` and `LW` aren't supported yet — try a standard field, range, step, list, or `L` / `nL` / `L-n`.";

// --- Macro table (CRON-03). Expand to a 5-field string, then continue parsing. ---
const MACROS: Record<string, string> = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
};

const MONTH_NAMES = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];
const DOW_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** Fixed, linear, non-backtracking literals (T-15-02). A bare non-negative integer. */
const INT_RE = /^\d+$/;

/**
 * Per-field spec for parseField: bounds + optional name map (lowercased → number).
 * `lastForm` enables the CRON-10 L-syntax for this field:
 *   - "dom": accept `L` (last day of month) and `L-n` (n days before the last).
 *   - "dow": accept `nL` (the last <weekday-n> of the month, 0–6 mapping).
 * Fields without `lastForm` reject any L-bearing token as unparseable (unchanged).
 */
interface FieldSpec {
  name: string;
  min: number;
  max: number;
  names?: Record<string, number>;
  lastForm?: "dom" | "dow";
}

const monthNameMap: Record<string, number> = Object.fromEntries(
  MONTH_NAMES.map((n, i) => [n, i + 1]),
);
const dowNameMap: Record<string, number> = Object.fromEntries(
  DOW_NAMES.map((n, i) => [n, i]),
);

/**
 * Result of parsing one field token: the value Set + whether it was restricted,
 * plus the optional CRON-10 L-markers (dom `L`/`L-n`, dow `nL`). The markers are
 * only ever populated for fields whose spec enables `lastForm`.
 */
type FieldParse =
  | {
      values: Set<number>;
      restricted: boolean;
      lastDay?: boolean;
      lastOffset?: number;
      lastWeekday?: number;
    }
  | { error: string };

/**
 * Parse ONE field token into its allowed-value Set (CRON-04). Pipeline:
 * split top-level on `,` (lists) → each item is `*` | `<n>` | `<a>-<b>` |
 * `<base>/<step>` | a name → expand → union → range-check every produced value.
 * `restricted` is true iff the field is NOT a bare `*` and NOT a full-range
 * step (needed for the OR-union rule, CRON-06). Never throws.
 */
function parseField(token: string, spec: FieldSpec): FieldParse {
  const { name, min, max, names, lastForm } = spec;
  const values = new Set<number>();
  let restricted = false;
  // CRON-10 L-markers, filled when a list item is an L-form (dom: L/L-n; dow: nL).
  let lastDay = false;
  let lastOffset: number | undefined;
  let lastWeekday: number | undefined;

  // Map a single name/number to its numeric value (names BEFORE numeric parse).
  const toNum = (raw: string): number | null => {
    const lower = raw.toLowerCase();
    if (names && lower in names) return names[lower];
    if (INT_RE.test(raw)) return Number(raw);
    return null;
  };

  const items = token.split(",");
  for (const item of items) {
    if (item === "") {
      return { error: `Unparseable token: "${item}" in ${name}.` };
    }

    // CRON-10 L-syntax (only where the spec enables it; `LW` was already rejected
    // before any field parsing, so a bare `L` reaching here is never `LW`).
    if (lastForm === "dom" && (item === "L" || item.startsWith("L-"))) {
      // `L` → last day of month; `L-n` → n days before the last (0..30 sane range).
      lastDay = true;
      restricted = true;
      if (item !== "L") {
        const offRaw = item.slice(2);
        if (!INT_RE.test(offRaw)) {
          return { error: `Unparseable token: "${item}" in ${name}.` };
        }
        // `L-0` is equivalent to bare `L` (offset 0); an over-large offset (e.g.
        // L-31) parses fine and simply never matches → contributes to kind:"never".
        const off = Number(offRaw);
        if (off > 0) lastOffset = off;
      }
      continue;
    }
    if (lastForm === "dow" && item.length >= 2 && item.endsWith("L")) {
      // `nL` → the last <weekday-n> of the month. LOCKED 0–6 mapping (Assumption A3,
      // CRON-06): `5L` = last Friday (5=Fri), NOT Quartz's 1–7 where 5=Thursday.
      // After 7→0 normalization `7L` → last Sunday. This 0–6 choice is the single
      // most likely off-by-one — it is fixtured and documented deliberately.
      const nRaw = item.slice(0, -1);
      const n = toNum(nRaw);
      if (n === null || n < min || n > max) {
        return n !== null
          ? { error: `Out of range: ${name} "${n}" must be ${min}–${max}.` }
          : { error: `Unparseable token: "${item}" in ${name}.` };
      }
      lastWeekday = n === 7 ? 0 : n; // 7→0 (Sunday), consistent with dow.values
      restricted = true;
      continue;
    }

    // Split off an optional /step suffix.
    const slash = item.indexOf("/");
    const basePart = slash === -1 ? item : item.slice(0, slash);
    const stepPart = slash === -1 ? null : item.slice(slash + 1);

    let step = 1;
    if (stepPart !== null) {
      if (!INT_RE.test(stepPart) || Number(stepPart) < 1) {
        return { error: `Unparseable token: "${item}" in ${name}.` };
      }
      step = Number(stepPart);
    }

    // Expand the base into an inclusive [lo..hi] range.
    let lo: number;
    let hi: number;
    let fullRangeBase = false;
    if (basePart === "*") {
      lo = min;
      hi = max;
      fullRangeBase = true;
    } else if (basePart.includes("-")) {
      const dash = basePart.indexOf("-");
      const aRaw = basePart.slice(0, dash);
      const bRaw = basePart.slice(dash + 1);
      const a = toNum(aRaw);
      const b = toNum(bRaw);
      if (a === null || b === null) {
        return { error: `Unparseable token: "${item}" in ${name}.` };
      }
      if (a > b) {
        return { error: `Invalid range "${basePart}": start must be ≤ end.` };
      }
      lo = a;
      hi = b;
    } else {
      const n = toNum(basePart);
      if (n === null) {
        return { error: `Unparseable token: "${item}" in ${name}.` };
      }
      if (stepPart !== null) {
        // bare `a/step` → a-max/step
        lo = n;
        hi = max;
      } else {
        lo = n;
        hi = n;
      }
    }

    // Range-check the produced bounds, naming the bad token + valid range.
    for (const bound of [lo, hi]) {
      if (bound < min || bound > max) {
        return {
          error: `Out of range: ${name} "${bound}" must be ${min}–${max}.`,
        };
      }
    }

    // Emit every step-th element from the range's low end (Pitfall 2).
    for (let v = lo; v <= hi; v += step) {
      values.add(v);
    }

    // Restricted iff this item is NOT a bare `*` and NOT `*/n` over the full range.
    const isFullRangeStar = fullRangeBase;
    if (!isFullRangeStar) restricted = true;
  }

  return { values, restricted, lastDay, lastOffset, lastWeekday };
}

/**
 * Parse a cron expression into a normalized CronFields, or return a parse error.
 * Used by analyzeCron after macro-expansion + unsupported-token rejection.
 */
function parseFields(
  tokens: string[],
  sixField: boolean,
):
  | { fields: CronFields }
  | { error: string } {
  // tokens length is already validated to 5 or 6 by the caller.
  const [secTok, minTok, hourTok, domTok, monthTok, dowTok] = sixField
    ? tokens
    : ["0", ...tokens];

  const second = parseField(secTok, { name: "second", min: 0, max: 59 });
  if ("error" in second) return { error: second.error };

  const minute = parseField(minTok, { name: "minute", min: 0, max: 59 });
  if ("error" in minute) return { error: minute.error };

  const hour = parseField(hourTok, { name: "hour", min: 0, max: 23 });
  if ("error" in hour) return { error: hour.error };

  const dom = parseField(domTok, {
    name: "day-of-month",
    min: 1,
    max: 31,
    lastForm: "dom",
  });
  if ("error" in dom) return { error: dom.error };

  const month = parseField(monthTok, {
    name: "month",
    min: 1,
    max: 12,
    names: monthNameMap,
  });
  if ("error" in month) return { error: month.error };

  // DOW parsed against 0–7, then 7→0 normalized (Pitfall 3, CRON-06).
  const dow = parseField(dowTok, {
    name: "day-of-week",
    min: 0,
    max: 7,
    names: dowNameMap,
    lastForm: "dow",
  });
  if ("error" in dow) return { error: dow.error };
  const dowValues = new Set<number>();
  for (const v of dow.values) dowValues.add(v === 7 ? 0 : v);

  return {
    fields: {
      second: second.values,
      minute: minute.values,
      hour: hour.values,
      dom: {
        values: dom.values,
        restricted: dom.restricted,
        lastDay: dom.lastDay ?? false,
        lastOffset: dom.lastOffset,
      },
      month: month.values,
      dow: {
        values: dowValues,
        restricted: dow.restricted,
        lastWeekday: dow.lastWeekday,
      },
    },
  };
}

/**
 * Parse an expression to its normalized CronFields (+ whether it was 6-field), or
 * a parse error / non-field kind. Exposed so the description generator and tests
 * can read the SAME normalized model analyzeCron uses (single source of truth).
 * Mirrors analyzeCron's front-half but returns the fields instead of a CronResult.
 */
export function parseExpression(
  input: string,
):
  | { fields: CronFields; sixField: boolean }
  | { reboot: true }
  | { empty: true }
  | { error: string } {
  const trimmed = input.trim();
  if (trimmed === "") return { empty: true };

  let expression = trimmed;
  if (trimmed.startsWith("@")) {
    const macro = trimmed.toLowerCase();
    if (macro === "@reboot") return { reboot: true };
    if (macro in MACROS) {
      expression = MACROS[macro];
    } else {
      return {
        error: `Unknown macro "${trimmed}" — try @yearly, @monthly, @weekly, @daily, @hourly, or @reboot.`,
      };
    }
  }

  const upper = expression.toUpperCase();
  if (upper.includes("LW") || upper.includes("W") || upper.includes("#")) {
    return { error: UNSUPPORTED_TOKEN };
  }

  const tokens = expression.split(/\s+/).filter((t) => t !== "");
  if (tokens.length !== 5 && tokens.length !== 6) {
    return {
      error: `Wrong field count: expected 5 or 6 fields, got ${tokens.length}.`,
    };
  }
  const sixField = tokens.length === 6;

  const parsed = parseFields(tokens, sixField);
  if ("error" in parsed) return { error: parsed.error };
  return { fields: parsed.fields, sixField };
}

// --- Next-run engine (Plan 02, CRON-05..08). Wall-clock odometer over native
// Intl/Date — NEVER millisecond-delta stepping (Pitfall 6, anti-pattern). The
// seam: cron logic decides which wall-clock Y/M/D/h/m/s to want next; Intl/Date
// answer what real instant that is in the zone and whether it exists. ---

/** Numeric wall-clock components of an instant, read IN a target IANA zone. */
interface ZonedParts {
  year: number;
  month: number; // 1-based
  day: number;
  hour: number; // 0..23 (h23)
  minute: number;
  second: number;
}

/**
 * Read an instant's wall-clock components in `zone` via Intl.formatToParts.
 * Fixed `en-US` locale + `hourCycle:"h23"` so midnight is `00` not `24` and
 * digits are Latin (Pitfall 8). The DST/tzdata rules live in the engine — we
 * never hand-roll an offset table (Don't-Hand-Roll boundary).
 */
function zonedParts(instant: Date, zone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (t: string): number => {
    const part = parts.find((p) => p.type === t);
    return part ? Number(part.value) : NaN;
  };
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/**
 * Find the real instant for a desired wall-clock time in `zone`, or `null` if
 * that wall-clock time does not exist (the spring-forward gap, CRON-07). Build a
 * UTC guess, read it back in-zone, correct by (asked − shown), then VERIFY the
 * corrected instant round-trips to the exact requested fields — a skipped
 * wall-clock time will not (Assumption A1: TDD'd against the DST fixtures).
 * `mo` is 1-based (cron) → `Date.UTC` wants `mo-1`.
 */
export function wallClockToInstant(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  s: number,
  zone: string,
): Date | null {
  const asked = Date.UTC(y, mo - 1, d, h, mi, s);
  const guess = new Date(asked);
  const back = zonedParts(guess, zone);
  const shown = Date.UTC(
    back.year,
    back.month - 1,
    back.day,
    back.hour,
    back.minute,
    back.second,
  );
  const corrected = new Date(guess.getTime() + (asked - shown));
  const verify = zonedParts(corrected, zone);
  const ok =
    verify.year === y &&
    verify.month === mo &&
    verify.day === d &&
    verify.hour === h &&
    verify.minute === mi &&
    verify.second === s;
  return ok ? corrected : null;
}

/**
 * Does the calendar day y/mo/d match the DOM/DOW fields? The Vixie OR-union rule
 * (Pitfall 1, CRON-06): when BOTH dom and dow are restricted a day matches if
 * EITHER matches; when one is `*` (not restricted) the other is ANDed. `mo` is
 * 1-based → `Date.UTC` wants `mo-1`; `getUTCDay()` is 0=Sun..6=Sat, and Plan 01
 * already normalized 7→0 into `dow.values`, so 0 and 7 both match Sunday.
 * (L-syntax markers are added in Plan 03; here only the value Sets are read.)
 */
export function dayMatches(
  f: CronFields,
  y: number,
  mo: number,
  d: number,
): boolean {
  const weekday = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
  const domMatch = f.dom.values.has(d);
  const dowMatch = f.dow.values.has(weekday);
  return f.dom.restricted && f.dow.restricted
    ? domMatch || dowMatch
    : domMatch && dowMatch;
}

/**
 * Hard cap on candidate DAYS the odometer walks (~5 years; Assumption A2). This
 * is the CRON-08 freeze protection — the loop is `for (i < cap)`, NEVER an
 * uncapped `while(true)`. An impossible expression (Feb 30) walks the whole cap
 * without a match and falls off → `nextRuns` returns `[]` → `kind:"never"`. Cron
 * compute is bounded/cheap, so it runs synchronously on the main thread (the cap,
 * not a Worker, is the protection — RESEARCH §Worker decision, T-15-04).
 */
const CANDIDATE_DAY_CAP = 5 * 366;

/** Advance a 1-based y/mo/d by one calendar day, normalizing month/year overflow. */
function addOneDay(y: number, mo: number, d: number): [number, number, number] {
  const next = new Date(Date.UTC(y, mo - 1, d + 1));
  return [next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate()];
}

/** Ascending-sorted values of a numeric field Set. */
function asc(s: Set<number>): number[] {
  return [...s].sort((a, b) => a - b);
}

/**
 * Compute the next `want` runs strictly after `now`, as instants in `zone`, by a
 * day-granular wall-clock odometer (RESEARCH §Next-run odometer, CRON-05). The
 * outer walk is DAY-granular (sidesteps month-length/leap carry math — Date.UTC
 * normalizes overflow); within each matching day, iterate hour×minute×second
 * ascending. DST is handled by the helpers: `wallClockToInstant` returns null on
 * the spring-forward gap (skip), and we de-dupe consecutive equal instants so a
 * repeated fall-back wall-clock hour yields ONE run (CRON-07, Pitfall 6). The cap
 * guarantees termination for impossible expressions (CRON-08).
 */
export function nextRuns(
  f: CronFields,
  now: Date,
  zone: string,
  want = 5,
): CronRun[] {
  const labeller = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    hourCycle: "h23",
    timeZone: zone,
  });

  const hours = asc(f.hour);
  const minutes = asc(f.minute);
  const seconds = asc(f.second);
  const nowMs = now.getTime();

  const runs: CronRun[] = [];
  let lastEmittedMs = -1; // fall-back de-dupe: skip an instant equal to the prior one

  // Start from the zoned calendar day of `now` (intra-day candidates may remain).
  const start = zonedParts(now, zone);
  let y = start.year;
  let mo = start.month;
  let d = start.day;

  for (let i = 0; i < CANDIDATE_DAY_CAP; i++) {
    if (f.month.has(mo) && dayMatches(f, y, mo, d)) {
      for (const h of hours) {
        for (const mi of minutes) {
          for (const s of seconds) {
            const inst = wallClockToInstant(y, mo, d, h, mi, s, zone);
            if (inst === null) continue; // spring-forward gap — skip
            const ms = inst.getTime();
            if (ms <= nowMs) continue; // strictly after now
            if (ms === lastEmittedMs) continue; // fall-back duplicate hour → one run
            lastEmittedMs = ms;
            runs.push({ date: inst, label: labeller.format(inst) });
            if (runs.length >= want) return runs;
          }
        }
      }
    }
    [y, mo, d] = addOneDay(y, mo, d);
  }

  return runs; // fell off the cap → caller treats an empty list as kind:"never"
}

/**
 * The pure, total cron front-half: empty → macro → unsupported-token reject →
 * field-count disambiguation → per-field parse → describe → next-runs. Computes
 * the next 5 runs in `zone` local time; an expression that parses but never fires
 * within the cap returns `kind:"never"` (the description still renders, CRON-08).
 * The system zone is supplied by the caller (the view passes
 * `Intl.DateTimeFormat().resolvedOptions().timeZone`) — kept injectable so the
 * core stays pure and fixture-testable.
 */
export function analyzeCron(
  input: string,
  now: Date,
  zone: string,
): CronResult {
  const parsed = parseExpression(input);

  if ("empty" in parsed) return { kind: "empty" };
  if ("reboot" in parsed) {
    return {
      kind: "reboot",
      description: "At startup — runs once when the scheduler starts.",
    };
  }
  if ("error" in parsed) return { kind: "error", message: parsed.error };

  const description = describe(parsed.fields, parsed.sixField);
  const runs = nextRuns(parsed.fields, now, zone, 5);
  if (runs.length === 0) return { kind: "never", description };
  return { kind: "scheduled", description, runs };
}

// --- Description helpers (hand-rolled, 24-hour; cronstrue is a forbidden dep). ---

const WEEKDAY_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTH_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const pad2 = (n: number) => String(n).padStart(2, "0");

/** True iff the set is exactly the full inclusive [min..max] range. */
function isFullRange(s: Set<number>, min: number, max: number): boolean {
  if (s.size !== max - min + 1) return false;
  for (let v = min; v <= max; v++) if (!s.has(v)) return false;
  return true;
}

/**
 * If the set is a uniform step from `min` (e.g. {0,15,30,45} over 0..59), return
 * that step (>1); else null. Used for "Every n minutes/hours" shortcuts.
 */
function uniformStepFromMin(s: Set<number>, min: number, max: number): number | null {
  const vals = [...s].sort((a, b) => a - b);
  if (vals.length < 2 || vals[0] !== min) return null;
  const step = vals[1] - vals[0];
  if (step < 2) return null;
  for (let i = 0; i < vals.length; i++) {
    if (vals[i] !== min + i * step) return null;
  }
  // Must reach the top of the range within one step (a true full-range step).
  if (vals[vals.length - 1] + step <= max) return null;
  return step;
}

/** Join a list of names with commas + "and" (Oxford-free): "a, b and c". */
function joinNames(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Render a weekday Set as either a contiguous "X through Y" or a name list. */
function weekdayPhrase(values: Set<number>): string {
  const vals = [...values].sort((a, b) => a - b);
  // Contiguous run of ≥3 with no gaps → "Monday through Friday".
  const contiguous =
    vals.length >= 3 && vals.every((v, i) => i === 0 || v === vals[i - 1] + 1);
  if (contiguous) {
    return `${WEEKDAY_FULL[vals[0]]} through ${WEEKDAY_FULL[vals[vals.length - 1]]}`;
  }
  return joinNames(vals.map((v) => WEEKDAY_FULL[v]));
}

/** The "At HH:MM[:SS]" / "at minutes … past …" / "every n …" time-of-day phrase. */
function timeOfDayPhrase(f: CronFields, sixField: boolean): string {
  const minuteSingle = f.minute.size === 1;
  const hourSingle = f.hour.size === 1;
  const onlyMinute = [...f.minute][0];
  const onlyHour = [...f.hour][0];

  if (minuteSingle && hourSingle) {
    let t = `At ${pad2(onlyHour)}:${pad2(onlyMinute)}`;
    if (sixField && f.second.size === 1) {
      t += `:${pad2([...f.second][0])}`;
    }
    return t;
  }

  // Minute is a set but hour is single → "At minute 0 and 30 past 09:00"-ish;
  // keep it readable with the hour list.
  const minuteList = joinNames([...f.minute].sort((a, b) => a - b).map(String));
  const hourList = hourSingle
    ? pad2(onlyHour)
    : joinNames([...f.hour].sort((a, b) => a - b).map(pad2));
  const hourWord = hourSingle ? "hour" : "hours";
  return `At minute ${minuteList} past ${hourWord} ${hourList}`;
}

/** The day-of-month / day-of-week phrase, honoring the OR-union WORDING (CRON-06). */
function dayPhrase(
  dom: CronFields["dom"],
  dow: CronFields["dow"],
): string | null {
  const domList = joinNames(
    [...dom.values].sort((a, b) => a - b).map(String),
  );
  if (dom.restricted && dow.restricted) {
    return `on day-of-month ${domList} or ${weekdayPhrase(dow.values)}`;
  }
  if (dow.restricted) {
    return `on ${weekdayPhrase(dow.values)}`;
  }
  if (dom.restricted) {
    return `on day-of-month ${domList}`;
  }
  return null;
}

/** The "in <months>" phrase when month is restricted; else null. */
function monthPhrase(month: Set<number>): string | null {
  if (isFullRange(month, 1, 12)) return null;
  const names = [...month].sort((a, b) => a - b).map((m) => MONTH_FULL[m - 1]);
  return `in ${joinNames(names)}`;
}

/**
 * Hand-rolled 24-hour human-readable description (CRON-01), read from the SAME
 * normalized CronFields the scheduler uses (single source of truth). Composes
 * `<timeOfDay>[, <day>][ <month>].` — always 24-hour, never AM/PM. cronstrue is
 * a forbidden new dependency; this is the deliberate hand-roll.
 */
export function describe(f: CronFields, sixField: boolean): string {
  const minuteFull = isFullRange(f.minute, 0, 59);
  const hourFull = isFullRange(f.hour, 0, 23);
  const secondTrivial = !sixField || (f.second.size === 1 && f.second.has(0));
  const dayUnrestricted = !f.dom.restricted && !f.dow.restricted;
  const monthUnrestricted = isFullRange(f.month, 1, 12);

  // 1. Whole-expression shortcuts (nicer output for the common shapes).
  if (secondTrivial && dayUnrestricted && monthUnrestricted) {
    if (minuteFull && hourFull) return "Every minute.";
    const minStep = uniformStepFromMin(f.minute, 0, 59);
    if (minStep && hourFull) return `Every ${minStep} minutes.`;
    if (f.minute.size === 1 && f.minute.has(0)) {
      const hourStep = uniformStepFromMin(f.hour, 0, 23);
      if (hourStep) return `Every ${hourStep} hours.`;
    }
  }

  // 2. Otherwise compose the three phrases.
  const parts: string[] = [timeOfDayPhrase(f, sixField)];
  const day = dayPhrase(f.dom, f.dow);
  const month = monthPhrase(f.month);

  let sentence = parts[0];
  if (day) sentence += `, ${day}`;
  if (month) sentence += ` ${month}`;
  return `${sentence}.`;
}
