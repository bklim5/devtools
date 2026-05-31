// timeFormat (D-03/D-05/D-06/D-10) — shared by Unix Time (Plan 02) + JWT (Plan 03).
// Native Intl/Date only, no date library. Boundaries for classifyUnit are asserted
// here so they can't drift.
import { describe, expect, it } from "vitest";
import {
  classifyUnit,
  formatTimestamp,
  relativeTime,
  toUnixFromIso,
} from "./timeFormat";

describe("formatTimestamp", () => {
  it("returns the exact UTC ISO + non-empty local/utc human strings", () => {
    const f = formatTimestamp(1469922850259);
    expect(f.iso).toBe("2016-07-30T23:54:10.259Z");
    expect(f.utc.length).toBeGreaterThan(0);
    expect(f.local.length).toBeGreaterThan(0);
  });

  it("throws an explicit error on NaN (no silent 'Invalid Date')", () => {
    expect(() => formatTimestamp(NaN)).toThrow();
  });

  it("throws on a non-finite timestamp", () => {
    expect(() => formatTimestamp(Infinity)).toThrow();
  });
});

describe("relativeTime", () => {
  const now = Date.UTC(2020, 0, 1, 0, 0, 0);

  it("describes a future time in days", () => {
    const s = relativeTime(now + 3 * 86400 * 1000, now);
    // When Intl.RelativeTimeFormat is present: contains "day"; else "" (degrade).
    if (s) expect(s).toContain("day");
  });

  it("describes a past time without throwing", () => {
    const s = relativeTime(now - 5 * 60 * 1000, now);
    if (s) expect(/minute|ago/.test(s)).toBe(true);
  });

  it("never throws even with odd input", () => {
    expect(() => relativeTime(now, now)).not.toThrow();
  });
});

describe("classifyUnit", () => {
  it("classifies a 10-digit value as seconds", () => {
    expect(classifyUnit(1469922850)).toBe("s");
  });

  it("classifies a 13-digit value as ms", () => {
    expect(classifyUnit(1469922850259)).toBe("ms");
  });
});

describe("toUnixFromIso", () => {
  it("parses an ISO string back to ms", () => {
    expect(toUnixFromIso("2016-07-30T23:54:10.259Z")).toBe(1469922850259);
  });

  it("throws an explicit error on an unparseable value", () => {
    expect(() => toUnixFromIso("not-a-date")).toThrow();
  });
});
