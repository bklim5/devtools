// resolveStartupTool precedence (SHL-06, D-12/13/14 + SET-09 default tool) —
// validated against the live registry (protobuf-decoder/base64/unix-time are
// enabled per Plan 01, so the hero resolves and disabled/unknown ids fall through).
// Signature: (target, defaultToolId, lastUsedId).
import { describe, expect, it } from "vitest";
import { resolveStartupTool, HERO_TOOL_ID } from "./resolveStartupTool";
import { getToolById } from "@/lib/tools/registry";

describe("resolveStartupTool", () => {
  it("HERO_TOOL_ID is the enabled protobuf-decoder hero (D-12)", () => {
    expect(HERO_TOOL_ID).toBe("protobuf-decoder");
    expect(getToolById(HERO_TOOL_ID)).toBeDefined();
  });

  it("explicit valid target wins over default-tool AND last-used (D-14)", () => {
    expect(resolveStartupTool("base64", "uuid-ulid", "unix-time")).toBe("base64");
  });

  it("no target + valid defaultToolId wins over last-used (SET-09)", () => {
    expect(resolveStartupTool(undefined, "uuid-ulid", "unix-time")).toBe("uuid-ulid");
  });

  it("null defaultToolId (\"Last used\") falls through to last-used (backward-compat)", () => {
    expect(resolveStartupTool(undefined, null, "unix-time")).toBe("unix-time");
  });

  it("undefined defaultToolId falls through to last-used (backward-compat)", () => {
    expect(resolveStartupTool(undefined, undefined, "unix-time")).toBe("unix-time");
  });

  it("unknown/removed defaultToolId is ignored, falling through to last-used (T-24-02)", () => {
    expect(resolveStartupTool(undefined, "does-not-exist", "base64")).toBe("base64");
  });

  it("no target + valid last-used → last-used (D-13 happy path)", () => {
    expect(resolveStartupTool(undefined, null, "unix-time")).toBe("unix-time");
  });

  it("disabled/removed/unknown last-used → hero fallback (D-13 fallback)", () => {
    expect(resolveStartupTool(undefined, null, "does-not-exist")).toBe(HERO_TOOL_ID);
  });

  it("all absent (first run) → hero (D-12)", () => {
    expect(resolveStartupTool(undefined, null, null)).toBe(HERO_TOOL_ID);
    expect(resolveStartupTool(undefined, undefined, undefined)).toBe(HERO_TOOL_ID);
  });

  it("unknown/invalid target is ignored, falling through to last-used (V5/T-02-07)", () => {
    // `#/tools/evil` must NOT be navigated to — it falls through.
    expect(resolveStartupTool("evil", null, "base64")).toBe("base64");
  });

  it("unknown target AND unknown default AND unknown last-used → hero (never an unvalidated id)", () => {
    expect(resolveStartupTool("evil", "also-bad", "still-bad")).toBe(HERO_TOOL_ID);
  });

  it("empty-string target is treated as absent", () => {
    expect(resolveStartupTool("", null, "base64")).toBe("base64");
  });
});
