// TDD coverage for the pure cron core (Phase 15, CRON-01..11). Task 1 asserts the
// parse pipeline: 5-vs-6-field disambiguation, full field grammar (*, ranges, steps
// from a base, lists, names), macro expansion, 0/7-Sunday normalization, restricted
// flags, the @reboot sentinel, the empty state, and every named error — all
// error-as-value, never a throw. (Description assertions live in the Task 2 block.)
import { describe as group, expect, it } from "vitest";
import { analyzeCron, parseExpression, type CronFields } from "./cron";

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

  it("returns kind:scheduled (runs:[] this plan) for a valid expression", () => {
    const r = analyzeCron("0 9 * * 1-5", NOW, ZONE);
    expect(r.kind).toBe("scheduled");
    if (r.kind === "scheduled") expect(r.runs).toEqual([]);
  });

  it("returns kind:error for an invalid expression, never throwing", () => {
    expect(() => analyzeCron("0 99 * * *", NOW, ZONE)).not.toThrow();
    const r = analyzeCron("0 99 * * *", NOW, ZONE);
    expect(r.kind).toBe("error");
  });
});
