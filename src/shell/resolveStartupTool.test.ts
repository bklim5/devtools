// resolveStartupTool precedence (SHL-06, D-12/13/14) — validated against the
// live registry (protobuf-decoder/base64/unix-time are enabled per Plan 01, so
// the hero resolves and disabled/unknown ids fall through).
import { describe, expect, it } from "vitest";
import { resolveStartupTool, HERO_TOOL_ID } from "./resolveStartupTool";
import { getToolById } from "@/lib/tools/registry";

describe("resolveStartupTool", () => {
  it("HERO_TOOL_ID is the enabled protobuf-decoder hero (D-12)", () => {
    expect(HERO_TOOL_ID).toBe("protobuf-decoder");
    expect(getToolById(HERO_TOOL_ID)).toBeDefined();
  });

  it("explicit valid target wins over last-used (D-14)", () => {
    expect(resolveStartupTool("base64", "unix-time")).toBe("base64");
  });

  it("no target + valid last-used → last-used (D-13 happy path)", () => {
    expect(resolveStartupTool(undefined, "unix-time")).toBe("unix-time");
  });

  it("disabled/removed/unknown last-used → hero fallback (D-13 fallback)", () => {
    expect(resolveStartupTool(undefined, "does-not-exist")).toBe(HERO_TOOL_ID);
  });

  it("both absent (first run) → hero (D-12)", () => {
    expect(resolveStartupTool(undefined, null)).toBe(HERO_TOOL_ID);
    expect(resolveStartupTool(undefined, undefined)).toBe(HERO_TOOL_ID);
  });

  it("unknown/invalid target is ignored, falling through to last-used (V5/T-02-07)", () => {
    // `#/tools/evil` must NOT be navigated to — it falls through to last-used.
    expect(resolveStartupTool("evil", "base64")).toBe("base64");
  });

  it("unknown target AND unknown last-used → hero (never returns an unvalidated id)", () => {
    expect(resolveStartupTool("evil", "also-bad")).toBe(HERO_TOOL_ID);
  });

  it("empty-string target is treated as absent", () => {
    expect(resolveStartupTool("", "base64")).toBe("base64");
  });
});
