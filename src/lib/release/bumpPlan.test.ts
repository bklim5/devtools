import { describe, expect, it } from "vitest";
import { isAffirmative, parseBumpArgs } from "./bumpPlan";

describe("parseBumpArgs", () => {
  it("accepts a bare level (patch -> { level: patch, dryRun: false })", () => {
    expect(parseBumpArgs(["patch"])).toEqual({ level: "patch", dryRun: false });
  });

  it("accepts level + --dry-run", () => {
    expect(parseBumpArgs(["minor", "--dry-run"])).toEqual({
      level: "minor",
      dryRun: true,
    });
  });

  it("is order-independent for the flag (--dry-run before level)", () => {
    expect(parseBumpArgs(["--dry-run", "major"])).toEqual({
      level: "major",
      dryRun: true,
    });
  });

  it("throws when no level is given (usage error)", () => {
    expect(() => parseBumpArgs([])).toThrow(/level/);
    expect(() => parseBumpArgs(["--dry-run"])).toThrow(/level/);
  });

  it("rejects an explicit-version argument (D-01)", () => {
    expect(() => parseBumpArgs(["0.3.0"])).toThrow(/0\.3\.0/);
  });

  it("rejects --no-push (D-02 — no escape hatches)", () => {
    expect(() => parseBumpArgs(["patch", "--no-push"])).toThrow(/--no-push/);
  });

  it("rejects --skip-checks (D-02 — no escape hatches)", () => {
    expect(() => parseBumpArgs(["patch", "--skip-checks"])).toThrow(
      /--skip-checks/,
    );
  });

  it("rejects an unknown level", () => {
    expect(() => parseBumpArgs(["foo"])).toThrow(/foo/);
  });

  it("rejects a second level (duplicate)", () => {
    expect(() => parseBumpArgs(["patch", "minor"])).toThrow();
  });

  it("usage message names the accepted grammar", () => {
    expect(() => parseBumpArgs(["foo"])).toThrow(/patch\|minor\|major/);
  });
});

describe("isAffirmative", () => {
  it.each(["y", "yes", "Y", "YES", " y ", "Yes"])(
    "returns true for %j",
    (input) => {
      expect(isAffirmative(input)).toBe(true);
    },
  );

  it.each(["", "n", "no", "N", "maybe", "yep", "yeah", "ok"])(
    "returns false for %j",
    (input) => {
      expect(isAffirmative(input)).toBe(false);
    },
  );
});
