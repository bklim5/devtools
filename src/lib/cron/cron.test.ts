// TDD coverage for the pure cron core (Phase 15, CRON-01..11). Task 1 asserts the
// parse pipeline: 5-vs-6-field disambiguation, full field grammar (*, ranges, steps
// from a base, lists, names), macro expansion, 0/7-Sunday normalization, restricted
// flags, the @reboot sentinel, the empty state, and every named error — all
// error-as-value, never a throw. (Description assertions live in the Task 2 block.)
import { describe as group, expect, it } from "vitest";
import {
  analyzeCron,
  dayMatches,
  describe as describeCron,
  nextRuns,
  parseExpression,
  wallClockToInstant,
  type CronFields,
} from "./cron";

const NOW = new Date("2026-06-04T00:00:00Z");
const ZONE = "UTC";

/** Parse helper: returns the normalized fields or throws the test if it didn't parse. */
function fieldsOf(expr: string): { fields: CronFields; sixField: boolean } {
  const r = parseExpression(expr);
  if (!("fields" in r)) {
    throw new Error(`expected ${expr} to parse, got ${JSON.stringify(r)}`);
  }
  return r;
}

const sorted = (s: Set<number>) => [...s].sort((a, b) => a - b);

group("parseExpression — field grammar", () => {
  it("parses a 5-field expression, defaulting second to {0}", () => {
    const { fields, sixField } = fieldsOf("0 9 * * 1-5");
    expect(sixField).toBe(false);
    expect(sorted(fields.second)).toEqual([0]);
    expect(sorted(fields.minute)).toEqual([0]);
    expect(sorted(fields.hour)).toEqual([9]);
    expect(sorted(fields.dow.values)).toEqual([1, 2, 3, 4, 5]);
    expect(fields.dow.restricted).toBe(true);
    expect(fields.dom.restricted).toBe(false);
  });

  it("parses a 6-field expression with the leading field as seconds", () => {
    const { fields, sixField } = fieldsOf("30 0 9 * * *");
    expect(sixField).toBe(true);
    expect(sorted(fields.second)).toEqual([30]);
    expect(sorted(fields.minute)).toEqual([0]);
    expect(sorted(fields.hour)).toEqual([9]);
  });

  it("expands */15 as a full-range step (not restricted)", () => {
    const { fields } = fieldsOf("*/15 * * * *");
    expect(sorted(fields.minute)).toEqual([0, 15, 30, 45]);
  });

  it("expands a step from a non-zero base 0-30/10 → {0,10,20,30} (Pitfall 2)", () => {
    const { fields } = fieldsOf("0-30/10 * * * *");
    expect(sorted(fields.minute)).toEqual([0, 10, 20, 30]);
  });

  it("maps month names (JAN) case-insensitively, 1-based", () => {
    const { fields } = fieldsOf("0 0 1 JAN *");
    expect(sorted(fields.month)).toEqual([1]);
    expect(sorted(fields.dom.values)).toEqual([1]);
  });

  it("normalizes both 0 and 7 to Sunday (Pitfall 3, CRON-06)", () => {
    expect(sorted(fieldsOf("* * * * 0").fields.dow.values)).toEqual([0]);
    expect(sorted(fieldsOf("* * * * 7").fields.dow.values)).toEqual([0]);
  });

  it("treats a bare * as not restricted, an explicit list as restricted", () => {
    expect(fieldsOf("* * * * *").fields.dom.restricted).toBe(false);
    expect(fieldsOf("0 0 1,15 * *").fields.dom.restricted).toBe(true);
  });

  it("expands an inclusive range and a comma list", () => {
    expect(sorted(fieldsOf("0 0 * * 1,3,5").fields.dow.values)).toEqual([1, 3, 5]);
    expect(sorted(fieldsOf("0-2 0 * * *").fields.minute)).toEqual([0, 1, 2]);
  });
});

group("parseExpression — macros (CRON-03)", () => {
  it("expands @hourly to 0 * * * *", () => {
    const { fields } = fieldsOf("@hourly");
    expect(sorted(fields.minute)).toEqual([0]);
    expect(sorted(fields.hour)).toEqual([...Array(24).keys()]);
  });

  it("expands @yearly to midnight Jan 1", () => {
    const { fields } = fieldsOf("@YEARLY"); // case-insensitive
    expect(sorted(fields.minute)).toEqual([0]);
    expect(sorted(fields.hour)).toEqual([0]);
    expect(sorted(fields.dom.values)).toEqual([1]);
    expect(sorted(fields.month)).toEqual([1]);
  });

  it("rejects an unknown macro by name", () => {
    const r = parseExpression("@bogus");
    expect(r).toHaveProperty("error");
    if ("error" in r) expect(r.error).toContain('Unknown macro "@bogus"');
  });
});

group("parseExpression — errors (CRON-11) never throw", () => {
  it("rejects the wrong field count", () => {
    const r = parseExpression("0 0 * *"); // 4 fields
    expect(r).toEqual({ error: "Wrong field count: expected 5 or 6 fields, got 4." });
  });

  it("rejects an out-of-range value, naming token + range", () => {
    const r = parseExpression("0 99 * * *");
    expect(r).toEqual({ error: 'Out of range: hour "99" must be 0–23.' });
  });

  it("rejects an unparseable name token", () => {
    const r = parseExpression("0 0 * * MONDAY");
    expect(r).toHaveProperty("error");
    if ("error" in r) expect(r.error).toContain("day-of-week");
  });

  it("rejects W / # / LW cleanly (CRON-F1)", () => {
    for (const expr of ["0 0 * * 1W", "0 0 1#1 * *", "0 0 LW * *"]) {
      const r = parseExpression(expr);
      expect(r).toHaveProperty("error");
      if ("error" in r) expect(r.error).toContain("aren't supported yet");
    }
  });

  it("rejects an inverted range", () => {
    const r = parseExpression("0 0 5-1 * *");
    expect(r).toHaveProperty("error");
    if ("error" in r) expect(r.error).toContain("start must be ≤ end");
  });
});

group("analyzeCron — kinds", () => {
  it("returns kind:empty for empty / whitespace input", () => {
    expect(analyzeCron("", NOW, ZONE)).toEqual({ kind: "empty" });
    expect(analyzeCron("   ", NOW, ZONE)).toEqual({ kind: "empty" });
  });

  it("returns kind:reboot for @reboot with no runs (CRON-09)", () => {
    const r = analyzeCron("@reboot", NOW, ZONE);
    expect(r.kind).toBe("reboot");
    if (r.kind === "reboot") expect(r.description).toContain("startup");
  });

  it("returns kind:scheduled with computed runs for a valid expression", () => {
    const r = analyzeCron("0 9 * * 1-5", NOW, ZONE);
    expect(r.kind).toBe("scheduled");
    if (r.kind === "scheduled") expect(r.runs).toHaveLength(5);
  });

  it("returns kind:error for an invalid expression, never throwing", () => {
    expect(() => analyzeCron("0 99 * * *", NOW, ZONE)).not.toThrow();
    const r = analyzeCron("0 99 * * *", NOW, ZONE);
    expect(r.kind).toBe("error");
  });
});

// --- Task 2: hand-rolled 24-hour description generator (CRON-01/03). ---

/** describe() over a parsed expression (single source of truth — the SAME fields). */
function descOf(expr: string): string {
  const { fields, sixField } = fieldsOf(expr);
  return describeCron(fields, sixField);
}

group("describe — 24-hour descriptions (CRON-01)", () => {
  it("describes a single time + weekday range without AM/PM", () => {
    const d = descOf("0 9 * * 1-5");
    expect(d).toContain("09:00");
    expect(d).toContain("Monday through Friday");
    expect(d).not.toContain("9 AM");
    expect(d).not.toMatch(/AM|PM/);
  });

  it("uses the Every-n-minutes shortcut for */15", () => {
    expect(descOf("*/15 * * * *")).toBe("Every 15 minutes.");
  });

  it("uses Every minute for all-* minute/hour", () => {
    expect(descOf("* * * * *")).toBe("Every minute.");
  });

  it("uses the Every-n-hours shortcut", () => {
    expect(descOf("0 */6 * * *")).toBe("Every 6 hours.");
  });

  it("describes a yearly midnight with month + day-of-month", () => {
    const d = descOf("0 0 1 1 *");
    expect(d).toContain("00:00");
    expect(d).toContain("January");
    expect(d).toContain("day-of-month 1");
  });

  it("zero-pads single-digit hours and minutes (24-hour discipline)", () => {
    expect(descOf("5 8 * * *")).toContain("08:05");
  });

  it("includes seconds for a 6-field single time", () => {
    expect(descOf("30 0 9 * * *")).toContain("09:00:30");
  });

  it("honors OR-union wording when BOTH dom and dow are restricted (CRON-06)", () => {
    const d = descOf("30 4 1 * 5");
    expect(d).toContain("day-of-month 1");
    expect(d).toContain("Friday");
    expect(d).toContain("or");
  });

  it("never emits AM/PM for any supported shape (24-hour discipline)", () => {
    for (const expr of [
      "0 9 * * 1-5",
      "*/15 * * * *",
      "0 0 1 1 *",
      "30 0 9 * * *",
      "0 13 * * *",
      "0 0 1,15 * *",
    ]) {
      expect(descOf(expr)).not.toMatch(/AM|PM/);
    }
  });
});

// --- Plan 02 Task 1: zone round-trip + DOM/DOW OR-union day-matcher. ---

/** Field helper for the day-matcher tests. */
const fOf = (expr: string): CronFields => fieldsOf(expr).fields;

group("dayMatches — DOM/DOW OR-union (CRON-06)", () => {
  it("OR-unions when BOTH dom and dow are restricted (Pitfall 1)", () => {
    // `30 4 1 * 5` = 4:30 on the 1st OR on Fridays.
    const f = fOf("30 4 1 * 5");
    // 2026-05-01 is a Friday — but pick a 1st that is NOT a Friday:
    // 2026-06-01 is a Monday → matches via day-of-month.
    expect(dayMatches(f, 2026, 6, 1)).toBe(true); // the 1st, not a Friday
    // 2026-06-05 is a Friday, not the 1st → matches via day-of-week.
    expect(dayMatches(f, 2026, 6, 5)).toBe(true); // a Friday, not the 1st
    // 2026-06-03 is a Wednesday, not the 1st → matches NEITHER.
    expect(dayMatches(f, 2026, 6, 3)).toBe(false);
  });

  it("ANDs when dow is unrestricted (only the 1st)", () => {
    // `30 4 1 * *` = only the 1st (dow is *).
    const f = fOf("30 4 1 * *");
    expect(dayMatches(f, 2026, 6, 1)).toBe(true);
    expect(dayMatches(f, 2026, 6, 5)).toBe(false); // a Friday but not the 1st
  });

  it("matches a Sunday for both `* * * * 0` and `* * * * 7` (0/7 Sunday)", () => {
    // 2026-06-07 is a Sunday.
    expect(dayMatches(fOf("* * * * 0"), 2026, 6, 7)).toBe(true);
    expect(dayMatches(fOf("* * * * 7"), 2026, 6, 7)).toBe(true);
    expect(dayMatches(fOf("* * * * 0"), 2026, 6, 8)).toBe(false); // a Monday
  });
});

group("wallClockToInstant — DST round-trip (CRON-07)", () => {
  const NY = "America/New_York";

  it("returns null for 2:30 on the spring-forward date (the gap does not exist)", () => {
    // 2026-03-08: clocks jump 02:00 → 03:00, so 02:30 has no instant.
    expect(wallClockToInstant(2026, 3, 8, 2, 30, 0, NY)).toBeNull();
  });

  it("returns a valid instant for 1:30 on the fall-back date", () => {
    // 2026-11-01: 01:30 occurs twice; here we only assert a real instant exists.
    const inst = wallClockToInstant(2026, 11, 1, 1, 30, 0, NY);
    expect(inst).not.toBeNull();
    // The instant reads back as 01:30 local in NY.
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: NY,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(inst!);
    expect(parts.find((p) => p.type === "hour")!.value).toBe("01");
    expect(parts.find((p) => p.type === "minute")!.value).toBe("30");
  });

  it("round-trips an ordinary wall-clock time in a non-UTC zone", () => {
    // 09:00 in Asia/Singapore (no DST) → 01:00 UTC.
    const inst = wallClockToInstant(2026, 6, 4, 9, 0, 0, "Asia/Singapore");
    expect(inst).not.toBeNull();
    expect(inst!.toISOString()).toBe("2026-06-04T01:00:00.000Z");
  });
});

// --- Plan 02 Task 2: bounded next-run odometer + kind:"never". ---

const FIXED_NOW = new Date("2026-06-04T00:00:00Z");

/** The 24-hour-clock local time (HH:MM) the labeller renders for an instant. */
function localHM(inst: Date, zone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(inst);
  const h = parts.find((p) => p.type === "hour")!.value;
  const m = parts.find((p) => p.type === "minute")!.value;
  return `${h}:${m}`;
}

group("nextRuns / analyzeCron — next 5 runs (CRON-05)", () => {
  it("returns exactly 5 ascending runs, all strictly after now, at 09:00 local", () => {
    const r = analyzeCron("0 9 * * *", FIXED_NOW, "Asia/Singapore");
    expect(r.kind).toBe("scheduled");
    if (r.kind !== "scheduled") return;
    expect(r.runs).toHaveLength(5);
    let prev = FIXED_NOW.getTime();
    for (const run of r.runs) {
      expect(run.date.getTime()).toBeGreaterThan(prev);
      prev = run.date.getTime();
      expect(localHM(run.date, "Asia/Singapore")).toBe("09:00");
      expect(run.label).not.toMatch(/AM|PM/); // 24-hour discipline
    }
  });

  it("steps minute fields in wall-clock order (every 30 min → 5 runs 30 min apart)", () => {
    const runs = nextRuns(fOf("*/30 * * * *"), FIXED_NOW, "UTC", 5);
    expect(runs).toHaveLength(5);
    for (let i = 1; i < runs.length; i++) {
      const delta = runs[i].date.getTime() - runs[i - 1].date.getTime();
      expect(delta).toBe(30 * 60_000);
    }
  });

  it("de-dupes the repeated fall-back hour to distinct instants (CRON-07)", () => {
    // `30 1 * * *` daily across the 2026-11-01 NY fall-back (01:30 occurs twice).
    const justBefore = new Date("2026-10-30T12:00:00Z");
    const runs = nextRuns(fOf("30 1 * * *"), justBefore, "America/New_York", 5);
    expect(runs).toHaveLength(5);
    const stamps = runs.map((r) => r.date.getTime());
    expect(new Set(stamps).size).toBe(5); // no duplicate timestamp
  });
});

// --- Plan 03 Task 1: L / L-n / nL parse markers (CRON-10). ---

group("parseExpression — L / L-n / nL markers (CRON-10)", () => {
  it("parses bare `L` (day-of-month) → lastDay, no offset, restricted", () => {
    const { fields } = fieldsOf("0 0 L * *");
    expect(fields.dom.lastDay).toBe(true);
    expect(fields.dom.lastOffset).toBeUndefined();
    expect(fields.dom.restricted).toBe(true);
  });

  it("parses `L-3` → lastDay + lastOffset 3", () => {
    const { fields } = fieldsOf("0 0 L-3 * *");
    expect(fields.dom.lastDay).toBe(true);
    expect(fields.dom.lastOffset).toBe(3);
    expect(fields.dom.restricted).toBe(true);
  });

  it("treats `L-0` as equivalent to bare `L` (offset 0 → undefined)", () => {
    const { fields } = fieldsOf("0 0 L-0 * *");
    expect(fields.dom.lastDay).toBe(true);
    expect(fields.dom.lastOffset).toBeUndefined();
  });

  it("parses `5L` (day-of-week) → lastWeekday 5 (last Friday, 0–6 mapping)", () => {
    const { fields } = fieldsOf("0 0 * 2 5L");
    expect(fields.dow.lastWeekday).toBe(5);
    expect(fields.dow.restricted).toBe(true);
  });

  it("normalizes `7L` → lastWeekday 0 (last Sunday, 7→0)", () => {
    expect(fieldsOf("0 0 * * 7L").fields.dow.lastWeekday).toBe(0);
    expect(fieldsOf("0 0 * * 0L").fields.dow.lastWeekday).toBe(0);
  });

  it("keeps numeric DOM values alongside an L marker in a list (`1,L`)", () => {
    const { fields } = fieldsOf("0 0 1,L * *");
    expect(sorted(fields.dom.values)).toEqual([1]);
    expect(fields.dom.lastDay).toBe(true);
  });

  it("still rejects `LW` cleanly (W unsupported, before the bare-L branch)", () => {
    const r = parseExpression("0 0 LW * *");
    expect(r).toHaveProperty("error");
    if ("error" in r) expect(r.error).toContain("aren't supported yet");
  });

  it("rejects a malformed L-form (`L-abc`) as unparseable, never throwing", () => {
    expect(() => parseExpression("0 0 L-abc * *")).not.toThrow();
    const r = parseExpression("0 0 L-abc * *");
    expect(r).toHaveProperty("error");
    if ("error" in r) expect(r.error).toContain("Unparseable token");
  });

  it("rejects an out-of-range `nL` weekday (`9L`)", () => {
    const r = parseExpression("0 0 * * 9L");
    expect(r).toHaveProperty("error");
    if ("error" in r) expect(r.error).toContain("day-of-week");
  });

  it("parses an over-large offset `L-31` without throwing (never matches)", () => {
    expect(() => parseExpression("0 0 L-31 * *")).not.toThrow();
    const { fields } = fieldsOf("0 0 L-31 * *");
    expect(fields.dom.lastOffset).toBe(31);
  });
});

// --- Plan 03 Task 2: dayMatches L-syntax + canonical leap-year fixtures. ---

/** The zoned Y/M/D an instant renders to in `zone` (UTC throughout these fixtures). */
function ymd(inst: Date, zone = "UTC"): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hourCycle: "h23",
  }).formatToParts(inst);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

/** First scheduled run of `expr` with `now`, or throw if it isn't `scheduled`. */
function firstRun(expr: string, now: Date): Date {
  const r = analyzeCron(expr, now, "UTC");
  if (r.kind !== "scheduled") {
    throw new Error(`expected ${expr} scheduled, got ${JSON.stringify(r)}`);
  }
  return r.runs[0].date;
}

group("dayMatches / analyzeCron — L last-day (CRON-10)", () => {
  it("`0 0 L * *` fires on the last day of each month (Jan 31, Apr 30)", () => {
    // now just before end of Jan 2025 → first run is Jan 31.
    expect(ymd(firstRun("0 0 L * *", new Date("2025-01-15T00:00:00Z")))).toEqual({
      y: 2025,
      m: 1,
      d: 31,
    });
    // now in mid-April → last day is Apr 30 (30-day month, not 31).
    expect(ymd(firstRun("0 0 L * *", new Date("2025-04-10T00:00:00Z")))).toEqual({
      y: 2025,
      m: 4,
      d: 30,
    });
  });

  it("`0 0 L 2 *` → Feb 29 in a leap year (2024), Feb 28 in a non-leap year (2025)", () => {
    expect(ymd(firstRun("0 0 L 2 *", new Date("2024-01-15T00:00:00Z")))).toEqual({
      y: 2024,
      m: 2,
      d: 29,
    });
    expect(ymd(firstRun("0 0 L 2 *", new Date("2025-01-15T00:00:00Z")))).toEqual({
      y: 2025,
      m: 2,
      d: 28,
    });
  });

  it("`0 0 L 4 *` → Apr 30 (30-day month, not 31)", () => {
    expect(ymd(firstRun("0 0 L 4 *", new Date("2025-01-01T00:00:00Z")))).toEqual({
      y: 2025,
      m: 4,
      d: 30,
    });
  });

  it("`0 0 L-3 * *` → 3rd-from-last day (Jan 28; Feb 25 in 2025, Feb 26 in 2024)", () => {
    expect(ymd(firstRun("0 0 L-3 * *", new Date("2025-01-10T00:00:00Z")))).toEqual({
      y: 2025,
      m: 1,
      d: 28,
    });
    expect(
      ymd(firstRun("0 0 L-3 2 *", new Date("2025-01-10T00:00:00Z"))),
    ).toEqual({ y: 2025, m: 2, d: 25 });
    expect(
      ymd(firstRun("0 0 L-3 2 *", new Date("2024-01-10T00:00:00Z"))),
    ).toEqual({ y: 2024, m: 2, d: 26 });
  });

  it("`0 0 L-0 * *` behaves identically to bare `L`", () => {
    const now = new Date("2025-01-15T00:00:00Z");
    expect(ymd(firstRun("0 0 L-0 * *", now))).toEqual(ymd(firstRun("0 0 L * *", now)));
  });

  it("`0 0 * * 5L` fires on the last Friday of the month", () => {
    const inst = firstRun("0 0 * * 5L", new Date("2025-01-01T00:00:00Z"));
    // It must be a Friday and the LAST Friday (no later Friday this month).
    expect(inst.getUTCDay()).toBe(5); // Friday
    const { y, m, d } = ymd(inst);
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    expect(d + 7).toBeGreaterThan(daysInMonth); // no later same-weekday this month
  });

  it("`0 0 L-31 * *` over-large offset never matches → kind:never (no hang)", () => {
    const r = analyzeCron("0 0 L-31 * *", new Date("2025-01-01T00:00:00Z"), "UTC");
    // Completing at all proves the bounded cap terminated (no infinite loop).
    expect(r.kind).toBe("never");
  });
});

group("describe — L-form phrasing (CRON-10)", () => {
  it("describes bare `L` as the last day of the month", () => {
    expect(descOf("0 0 L * *")).toContain("the last day of the month");
  });

  it("describes `L-3` as the 3rd-from-last day of the month", () => {
    expect(descOf("0 0 L-3 * *")).toContain("3rd-from-last day of the month");
  });

  it("renders grammatical ordinals for the L-n offset (1st/2nd/11th/21st)", () => {
    expect(descOf("0 0 L-1 * *")).toContain("1st-from-last day of the month");
    expect(descOf("0 0 L-2 * *")).toContain("2nd-from-last day of the month");
    // The teens are the classic ordinal trap: 11/12/13 stay "th".
    expect(descOf("0 0 L-11 * *")).toContain("11th-from-last day of the month");
    // …but 21/22/23 take st/nd/rd again.
    expect(descOf("0 0 L-21 * *")).toContain("21st-from-last day of the month");
  });

  it("describes `5L` as the last Friday of the month", () => {
    expect(descOf("0 0 * * 5L")).toContain("the last Friday of the month");
  });
});

group("analyzeCron — impossible expression (CRON-08)", () => {
  it("returns kind:never for Feb 30 within the cap, and terminates", () => {
    const r = analyzeCron("0 0 30 2 *", FIXED_NOW, "UTC");
    // The test completing at all proves termination (the bounded cap, not a hang).
    expect(r.kind).toBe("never");
    if (r.kind === "never") expect(r.description).toContain("30");
  });

  it("nextRuns returns [] for an impossible expression (bounded, no hang)", () => {
    expect(nextRuns(fOf("0 0 30 2 *"), FIXED_NOW, "UTC", 5)).toEqual([]);
  });
});
