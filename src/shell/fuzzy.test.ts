// Tests for the in-house, zero-dependency fuzzy ranker (D-06, SHL-02).
//
// The ranker scores a subsequence match of the query against each tool's
// name + keywords + description and returns the matching subset best-first.
// These tests assert the ORDERING CONTRACT (the exact scoring formula is
// Claude's discretion per D-06). Fixtures are inline ToolDefinitions — these
// tests must NOT depend on the live registry, so the ranker stays
// independently testable and the contract is stated in one place.
import { describe, expect, it } from "vitest";
import type { ComponentType } from "react";
import { rankTools, subsequenceScore } from "./fuzzy";
import type { ToolDefinition } from "@/lib/tools/types";

// A throwaway icon stand-in; the ranker never touches `icon`/`component`.
const Icon: ComponentType<{ className?: string }> = () => null;

function tool(partial: Partial<ToolDefinition> & { id: string; name: string }): ToolDefinition {
  return {
    description: "",
    category: "encoding",
    keywords: [],
    icon: Icon,
    component: Icon,
    enabled: true,
    ...partial,
  };
}

// A small fixture catalogue in a fixed input order.
const base64 = tool({
  id: "base64",
  name: "Base64",
  description: "Base64 / hex / bytes converter",
  keywords: ["base64", "hex", "bytes", "encode", "decode"],
});
const protobuf = tool({
  id: "protobuf-decoder",
  name: "Protobuf Decoder",
  description: "Schema-less wire-format inspector",
  keywords: ["protobuf", "proto", "wire", "decode"],
});
const unixTime = tool({
  id: "unix-time",
  name: "Unix Time",
  description: "Epoch timestamp converter",
  keywords: ["unix", "time", "epoch", "timestamp"],
});
const fixtures = [base64, protobuf, unixTime];

describe("subsequenceScore", () => {
  it("returns null when the needle is not a subsequence of the haystack", () => {
    expect(subsequenceScore("zzz", "protobuf")).toBeNull();
  });

  it("returns a number when the needle is a subsequence", () => {
    expect(subsequenceScore("pto", "protobuf")).not.toBeNull();
    expect(typeof subsequenceScore("pto", "protobuf")).toBe("number");
  });

  it("scores a contiguous match higher than a scattered one of equal length", () => {
    const contiguous = subsequenceScore("prot", "protobuf")!;
    const scattered = subsequenceScore("prot", "p_r_o_t_obuf")!;
    expect(contiguous).toBeGreaterThan(scattered);
  });
});

describe("rankTools", () => {
  it("returns all tools in input order for an empty query", () => {
    expect(rankTools("", fixtures)).toEqual(fixtures);
  });

  it("returns all tools in input order for a whitespace-only query", () => {
    expect(rankTools("   ", fixtures)).toEqual(fixtures);
  });

  it("matches a subsequence across fields and excludes non-matching tools", () => {
    // "b64" is a subsequence of the base64 keyword/name (b -> 6 -> 4) and matches
    // nothing in the unix-time tool.
    const result = rankTools("b64", [base64, unixTime]);
    expect(result).toContain(base64);
    expect(result).not.toContain(unixTime);
  });

  it("ranks a NAME match above a tool where the query only matches the DESCRIPTION", () => {
    const nameMatch = tool({ id: "epoch-tool", name: "Epoch", description: "no relevant terms" });
    const descMatch = tool({ id: "other", name: "Other", description: "epoch lives only here" });
    // Input order puts descMatch first to prove ordering is by score, not position.
    const result = rankTools("epoch", [descMatch, nameMatch]);
    expect(result[0]).toBe(nameMatch);
    expect(result[1]).toBe(descMatch);
  });

  it("ranks a contiguous match above a scattered subsequence match", () => {
    const contiguous = tool({ id: "proto", name: "Proto", description: "" });
    const scattered = tool({ id: "scatter", name: "P r o t o type", description: "" });
    const result = rankTools("proto", [scattered, contiguous]);
    expect(result[0]).toBe(contiguous);
  });

  it("returns an empty array when nothing matches", () => {
    expect(rankTools("zzzzz", fixtures)).toEqual([]);
  });

  it("is case-insensitive", () => {
    const upper = rankTools("PROTO", fixtures);
    const lower = rankTools("proto", fixtures);
    expect(upper).toEqual(lower);
    expect(upper).toContain(protobuf);
  });

  it("breaks score ties by registry (input) order — stable sort", () => {
    // Two tools that match "x" identically (same field, same position).
    const a = tool({ id: "ax", name: "X", description: "" });
    const b = tool({ id: "bx", name: "X", description: "" });
    expect(rankTools("x", [a, b])).toEqual([a, b]);
    expect(rankTools("x", [b, a])).toEqual([b, a]);
  });
});
