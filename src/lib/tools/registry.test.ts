// Hero-first invariant lock — the schema-less Protobuf decoder is the product's
// hero feature, so it must lead the registry's DEFAULT order (the order the
// sidebar, command palette, and startup routing derive from before any Pro
// pin/reorder overlay). A reorder that drops it from the head RED-flags here.
import { describe, expect, it } from "vitest";
import { TOOLS, ENABLED_TOOLS } from "./registry";

describe("tool registry ordering", () => {
  it("Protobuf Decoder leads the registry (hero-first default order)", () => {
    expect(TOOLS[0].id).toBe("protobuf-decoder");
    expect(ENABLED_TOOLS[0].id).toBe("protobuf-decoder");
  });

  it("no tool dropped or duplicated by a reorder", () => {
    // The set is wedge-gated but GROWING (13 in v1.9) — floor, not exact count.
    expect(TOOLS.length).toBeGreaterThanOrEqual(13);
    expect(new Set(TOOLS.map((t) => t.id)).size).toBe(TOOLS.length);
  });
});
