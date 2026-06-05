// Pure coverage for the reorder backbone (REORD-05/06/07, D-11). savedOrder is
// UNTRUSTED (hand-edited prefs.json) so reconcileToolOrder must drop non-strings,
// de-dupe, drop unknown ids, append new registry ids at the bottom, and always
// return a permutation of the registry. moveToolInOrder is the clamped relocate
// shared by drag-drop and the Alt+arrow keyboard path.
import { describe, expect, it } from "vitest";
import { moveToolInOrder, reconcileToolOrder } from "./toolOrder";

describe("reconcileToolOrder (D-11)", () => {
  it("empty saved → pure registry order (default)", () => {
    expect(reconcileToolOrder([], ["a", "b", "c"])).toEqual(["a", "b", "c"]);
  });

  it("full custom order → honored as saved", () => {
    expect(reconcileToolOrder(["c", "a", "b"], ["a", "b", "c"])).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("appends a new (registry-only) tool at the bottom in registry order [REORD-06]", () => {
    expect(reconcileToolOrder(["b", "a"], ["a", "b", "c"])).toEqual([
      "b",
      "a",
      "c",
    ]);
  });

  it("drops an unknown/removed id no longer in the registry [REORD-06]", () => {
    expect(reconcileToolOrder(["a", "ghost", "b"], ["a", "b"])).toEqual([
      "a",
      "b",
    ]);
  });

  it("de-dupes a duplicate saved id (no tool appears twice)", () => {
    expect(reconcileToolOrder(["a", "a", "b"], ["a", "b", "c"])).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("drops non-string junk in saved (untrusted hand-edited prefs.json)", () => {
    expect(
      reconcileToolOrder(
        [1 as unknown as string, "a", null as unknown as string],
        ["a", "b"],
      ),
    ).toEqual(["a", "b"]);
  });

  it("result is always a permutation of the registry (same set, same length)", () => {
    const registry = ["a", "b", "c", "d"];
    const saved = ["d", "x", "d", 9 as unknown as string, "b"]; // junk + dup + unknown
    const out = reconcileToolOrder(saved, registry);
    expect(out).toHaveLength(registry.length);
    expect([...out].sort()).toEqual([...registry].sort());
    // No duplicates.
    expect(new Set(out).size).toBe(out.length);
  });
});

describe("moveToolInOrder (drag + Alt+arrow)", () => {
  it("moves down one slot", () => {
    expect(moveToolInOrder(["a", "b", "c"], "a", 1)).toEqual(["b", "a", "c"]);
  });

  it("moves up one slot", () => {
    expect(moveToolInOrder(["a", "b", "c"], "c", 1)).toEqual(["a", "c", "b"]);
  });

  it("clamps a negative toIndex to 0", () => {
    expect(moveToolInOrder(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
  });

  it("clamps a too-large toIndex to the last slot", () => {
    expect(moveToolInOrder(["a", "b", "c"], "a", 99)).toEqual(["b", "c", "a"]);
  });

  it("unknown id → input order unchanged", () => {
    expect(moveToolInOrder(["a", "b", "c"], "ghost", 0)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("returns a NEW array with the same membership (never mutates input)", () => {
    const input = ["a", "b", "c"];
    const out = moveToolInOrder(input, "a", 2);
    expect(out).not.toBe(input);
    expect(input).toEqual(["a", "b", "c"]); // input untouched
    expect([...out].sort()).toEqual([...input].sort());
  });
});
