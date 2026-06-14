// Entitlement vocabulary + predicates (ENT-01/ENT-02). Pure functions — node env.
//
// The fixture tool below is the ONLY tool carrying requiredEntitlements: the
// mechanism is dormant in v1.6 production (D-18 — no shipped registry entry
// uses it), so tests exercise it via a literal, never a real tool import.
import { describe, expect, it } from "vitest";
import type { ComponentType } from "react";
import type { ToolDefinition } from "@/lib/tools/types";
import { DEFAULT_PREFERENCES, type Preferences } from "@/shell/preferences";
import {
  ALL_ENTITLEMENTS,
  ENT_ORDERING,
  ENT_THEMING,
  FREE_SET,
  FULL_SET,
  gatePreferences,
  isEntitled,
  isToolLocked,
} from "./entitlements";

const NullComponent = (() => null) as unknown as ComponentType;

function makeTool(overrides: Partial<ToolDefinition> = {}): ToolDefinition {
  return {
    id: "fixture",
    name: "Fixture",
    description: "test fixture",
    category: "encoding",
    keywords: [],
    icon: NullComponent as ComponentType<{ className?: string }>,
    // ToolDefinition.component is lazy-only since ENT-05 lazified the registry.
    component: () => Promise.resolve({ default: NullComponent }),
    ...overrides,
  };
}

describe("entitlement vocabulary", () => {
  it("FULL_SET contains every entitlement; FREE_SET is empty", () => {
    expect(ENT_THEMING).toBe("pro.theming");
    expect(ENT_ORDERING).toBe("pro.ordering");
    expect([...FULL_SET].sort()).toEqual([...ALL_ENTITLEMENTS].sort());
    expect(FREE_SET.size).toBe(0);
  });
});

describe("isEntitled", () => {
  it("FULL_SET satisfies a required entitlement", () => {
    expect(isEntitled(FULL_SET, [ENT_THEMING])).toBe(true);
  });

  it("FREE_SET does not satisfy a required entitlement", () => {
    expect(isEntitled(FREE_SET, [ENT_THEMING])).toBe(false);
  });

  it("an empty requirement list is satisfied by ANY set", () => {
    expect(isEntitled(FREE_SET, [])).toBe(true);
    expect(isEntitled(FULL_SET, [])).toBe(true);
  });

  it("requires EVERY listed entitlement (all-of, not any-of)", () => {
    const partial: ReadonlySet<string> = new Set([ENT_THEMING]);
    expect(isEntitled(partial, [ENT_THEMING, ENT_ORDERING])).toBe(false);
    expect(isEntitled(partial, [ENT_THEMING])).toBe(true);
  });
});

describe("isToolLocked (ENT-01 — the ONE tool predicate)", () => {
  it("a tool with no requiredEntitlements never locks (free tools stay free)", () => {
    expect(isToolLocked(makeTool(), FREE_SET)).toBe(false);
    expect(isToolLocked(makeTool({ requiredEntitlements: [] }), FREE_SET)).toBe(
      false,
    );
  });

  it("an unknown entitlement stays locked even under FULL (dormant-mechanism proof, D-18)", () => {
    const fixture = makeTool({
      id: "fixture-locked",
      requiredEntitlements: ["test.locked"],
    });
    expect(isToolLocked(fixture, FULL_SET)).toBe(true);
    expect(isToolLocked(fixture, FREE_SET)).toBe(true);
  });

  it("unlocks when the set grants the requirement", () => {
    const fixture = makeTool({ requiredEntitlements: [ENT_THEMING] });
    expect(isToolLocked(fixture, FULL_SET)).toBe(false);
    expect(isToolLocked(fixture, FREE_SET)).toBe(true);
  });
});

describe("gatePreferences (D-26/D-27 — render-time view, never a prefs mutation)", () => {
  const customized: Preferences = {
    ...DEFAULT_PREFERENCES,
    theme: "dark",
    accent: "#ff0000",
    toolOrder: ["b", "a"],
    pinnedToolIds: ["a"],
    lastUsedId: "base64",
  };

  it("FULL_SET passes every value through unchanged", () => {
    expect(gatePreferences(customized, FULL_SET)).toEqual(customized);
  });

  it("FREE_SET forces default theme/accent and empty toolOrder/pinnedToolIds", () => {
    const gated = gatePreferences(customized, FREE_SET);
    expect(gated.theme).toBe(DEFAULT_PREFERENCES.theme);
    expect(gated.accent).toBe(DEFAULT_PREFERENCES.accent);
    expect(gated.toolOrder).toEqual([]);
    expect(gated.pinnedToolIds).toEqual([]);
    // Non-gated fields pass through untouched.
    expect(gated.lastUsedId).toBe("base64");
  });

  it("NEVER mutates the input prefs object (D-26: never delete prefs on lock)", () => {
    const input: Preferences = {
      ...DEFAULT_PREFERENCES,
      accent: "#ff0000",
      toolOrder: ["b", "a"],
      pinnedToolIds: ["a"],
    };
    const snapshot = structuredClone(input);
    gatePreferences(input, FREE_SET);
    expect(input).toEqual(snapshot);
  });

  it("gates each entitlement independently (theming-only set keeps theme, locks ordering)", () => {
    const themingOnly: ReadonlySet<string> = new Set([ENT_THEMING]);
    const gated = gatePreferences(customized, themingOnly);
    expect(gated.accent).toBe("#ff0000");
    expect(gated.toolOrder).toEqual([]);
    expect(gated.pinnedToolIds).toEqual([]);
  });

  it("D-86: a lock→unlock cycle leaves the STORED prefs byte-unchanged (dormant restore under the live flip)", () => {
    // The live D-85 flip can drop entitlements to FREE_SET at any time; D-86
    // requires the user's saved customization to survive dormant — gatePreferences
    // is a render-time VIEW, never a mutation, so the SAME stored object round-trips
    // identically and unlock restores the exact setup instantly.
    const stored: Preferences = {
      ...DEFAULT_PREFERENCES,
      accent: "#abcdef",
      toolOrder: ["jwt", "base64", "hash"],
      pinnedToolIds: ["hash", "jwt"],
    };
    const before = structuredClone(stored);

    // Lock (free flip): the render view reverts to defaults…
    const locked = gatePreferences(stored, FREE_SET);
    expect(locked.accent).toBe(DEFAULT_PREFERENCES.accent);
    expect(locked.toolOrder).toEqual([]);
    expect(locked.pinnedToolIds).toEqual([]);
    // …but the STORED object is untouched (never wiped on lock).
    expect(stored).toEqual(before);

    // Unlock (activate/refresh): the exact saved arrangement comes right back.
    const unlocked = gatePreferences(stored, FULL_SET);
    expect(unlocked.accent).toBe("#abcdef");
    expect(unlocked.toolOrder).toEqual(["jwt", "base64", "hash"]);
    expect(unlocked.pinnedToolIds).toEqual(["hash", "jwt"]);
    // The stored object is STILL byte-identical after the whole cycle.
    expect(stored).toEqual(before);
  });
});
