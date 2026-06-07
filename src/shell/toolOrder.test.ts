// Pure coverage for the reorder backbone (REORD-05/06/07, D-11). savedOrder is
// UNTRUSTED (hand-edited prefs.json) so reconcileToolOrder must drop non-strings,
// de-dupe, drop unknown ids, append new registry ids at the bottom, and always
// return a permutation of the registry. moveToolInOrder is the clamped relocate
// shared by drag-drop and the Alt+arrow keyboard path.
import { describe, expect, it } from "vitest";
import {
  moveToolInOrder,
  partitionTools,
  reconcileToolOrder,
  resolveRovingTarget,
} from "./toolOrder";

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

// partitionTools (PIN-07/08) splits the live registry into an ordered pinned
// group + an ordered unpinned remainder. Both pinnedToolIds and toolOrder are
// UNTRUSTED (hand-edited prefs.json — threats T-17-01/02/03). The immovable bar:
// every registry id appears in EXACTLY ONE group, unknown ids dropped, dupes
// collapsed, non-array → [], no crash. pinned order = pinnedToolIds order;
// unpinned = reconcileToolOrder over the registry-minus-pinned remainder.
describe("partitionTools (PIN-08 immovable bar)", () => {
  // Shared invariant: union is exactly the registry, disjoint, no duplicate.
  const assertFullPartition = (
    pinned: string[],
    unpinned: string[],
    registry: string[],
  ) => {
    const union = [...pinned, ...unpinned];
    expect([...union].sort()).toEqual([...registry].sort());
    expect(new Set(union).size).toBe(registry.length);
    // Disjoint: no id in both groups.
    const pinnedSet = new Set(pinned);
    expect(unpinned.some((id) => pinnedSet.has(id))).toBe(false);
  };

  it("Case 1: nothing pinned → all in unpinned (registry order)", () => {
    const { pinned, unpinned } = partitionTools([], [], ["a", "b", "c"]);
    expect(pinned).toEqual([]);
    expect(unpinned).toEqual(["a", "b", "c"]);
    assertFullPartition(pinned, unpinned, ["a", "b", "c"]);
  });

  it("Case 2: one pinned → that id pinned, the rest unpinned", () => {
    const { pinned, unpinned } = partitionTools(["b"], [], ["a", "b", "c"]);
    expect(pinned).toEqual(["b"]);
    expect(unpinned).toEqual(["a", "c"]);
    assertFullPartition(pinned, unpinned, ["a", "b", "c"]);
  });

  it("Case 3: pinned order honored (pinnedToolIds order, not registry order)", () => {
    const { pinned, unpinned } = partitionTools(["c", "a"], [], ["a", "b", "c"]);
    expect(pinned).toEqual(["c", "a"]);
    assertFullPartition(pinned, unpinned, ["a", "b", "c"]);
  });

  it("Case 4: unknown pinned id dropped (registry-gated)", () => {
    const { pinned, unpinned } = partitionTools(["ghost", "a"], [], ["a", "b"]);
    expect(pinned).toEqual(["a"]);
    assertFullPartition(pinned, unpinned, ["a", "b"]);
  });

  it("Case 5: duplicate pinned id collapsed", () => {
    const { pinned, unpinned } = partitionTools(["a", "a"], [], ["a", "b"]);
    expect(pinned).toEqual(["a"]);
    assertFullPartition(pinned, unpinned, ["a", "b"]);
  });

  it("Case 6: non-string junk in pinned dropped (untrusted blob)", () => {
    const { pinned, unpinned } = partitionTools(
      [1 as unknown as string, "a", null as unknown as string],
      [],
      ["a", "b"],
    );
    expect(pinned).toEqual(["a"]);
    assertFullPartition(pinned, unpinned, ["a", "b"]);
  });

  it("Case 7: non-array pinned → pinned [], unpinned = registry", () => {
    const reg = ["a", "b", "c"];
    const fromString = partitionTools("nope" as unknown as string[], [], reg);
    expect(fromString.pinned).toEqual([]);
    expect(fromString.unpinned).toEqual(reg);
    const fromNull = partitionTools(null as unknown as string[], [], reg);
    expect(fromNull.pinned).toEqual([]);
    expect(fromNull.unpinned).toEqual(reg);
  });

  it("Case 8: a pinned id also present in toolOrder does NOT appear in unpinned (union-once)", () => {
    const { pinned, unpinned } = partitionTools(
      ["a"],
      ["a", "b"], // stale pinned id "a" lingering in toolOrder is inert
      ["a", "b", "c"],
    );
    expect(pinned).toEqual(["a"]);
    expect(unpinned).not.toContain("a");
    expect(unpinned).toEqual(["b", "c"]);
    assertFullPartition(pinned, unpinned, ["a", "b", "c"]);
  });

  it("Case 9: a new registry tool absent from both prefs appears once in unpinned (appended)", () => {
    const { pinned, unpinned } = partitionTools(
      ["a"],
      ["b"], // "c" is a newly-shipped registry tool in neither pref
      ["a", "b", "c"],
    );
    expect(pinned).toEqual(["a"]);
    expect(unpinned).toEqual(["b", "c"]);
    assertFullPartition(pinned, unpinned, ["a", "b", "c"]);
  });

  it("Case 10 (property): arbitrary junk inputs still yield a full registry partition", () => {
    const registry = ["a", "b", "c", "d", "e"];
    const junkPinned = [
      "ghost",
      "a",
      "a", // dup
      9 as unknown as string, // non-string
      "e",
      null as unknown as string,
    ];
    const junkOrder = ["x", "d", "d", 7 as unknown as string, "b"];
    const { pinned, unpinned } = partitionTools(junkPinned, junkOrder, registry);
    // Pinned is registry-gated + de-duped, honoring pinnedToolIds order.
    expect(pinned).toEqual(["a", "e"]);
    // The bar: union === registry, disjoint, no duplicate.
    assertFullPartition(pinned, unpinned, registry);
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

describe("resolveRovingTarget (plain ↑/↓/Home/End roving nav)", () => {
  // The flat visible order traverses pinned THEN unpinned as one continuous
  // sequence — ↑/↓ cross the divider; Home/End jump to the very ends.
  const visible = ["pin-a", "pin-b", "u-x", "u-y", "u-z"];

  it("moves focus down one row", () => {
    expect(resolveRovingTarget(visible, "u-x", "down")).toBe("u-y");
  });

  it("moves focus up one row", () => {
    expect(resolveRovingTarget(visible, "u-y", "up")).toBe("u-x");
  });

  it("crosses the pinned↔unpinned divider on ↓ (last pinned → first unpinned)", () => {
    expect(resolveRovingTarget(visible, "pin-b", "down")).toBe("u-x");
  });

  it("crosses the divider on ↑ (first unpinned → last pinned)", () => {
    expect(resolveRovingTarget(visible, "u-x", "up")).toBe("pin-b");
  });

  it("clamps at the first row (↑ at index 0 → null, no wrap)", () => {
    expect(resolveRovingTarget(visible, "pin-a", "up")).toBeNull();
  });

  it("clamps at the last row (↓ at the end → null, no wrap)", () => {
    expect(resolveRovingTarget(visible, "u-z", "down")).toBeNull();
  });

  it("Home → first visible row, End → last visible row", () => {
    expect(resolveRovingTarget(visible, "u-y", "home")).toBe("pin-a");
    expect(resolveRovingTarget(visible, "u-y", "end")).toBe("u-z");
  });

  it("unknown current id → null (nowhere to move from)", () => {
    expect(resolveRovingTarget(visible, "ghost", "down")).toBeNull();
  });

  it("empty list → null for every direction", () => {
    expect(resolveRovingTarget([], "anything", "down")).toBeNull();
    expect(resolveRovingTarget([], "anything", "home")).toBeNull();
  });
});
