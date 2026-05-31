// Tests for the hex-vs-base64 input classifier (D-02).
//
// The heuristic only PICKS which converter (hexToBytes vs base64ToBytes) the
// orchestrator should use — it never parses bytes itself. The rule: after
// stripping a leading 0x and the separators hexToBytes itself strips
// ([\s:_-]), a string that is non-empty, all hex digits, and an even number of
// nibbles is "hex"; everything else (including empty) is "base64". Pure node
// test — explicit imports, default node env (no DOM).
import { describe, expect, it } from "vitest";
import { detectEncoding } from "./detectEncoding";

describe("detectEncoding (D-02)", () => {
  it("classifies even-length hex digits as hex", () => {
    expect(detectEncoding("089601")).toBe("hex");
    expect(detectEncoding("8960")).toBe("hex");
  });

  it("strips a 0x prefix and whitespace separators before judging hex", () => {
    expect(detectEncoding("0x08 96 01")).toBe("hex");
  });

  it("strips colon separators before judging hex", () => {
    expect(detectEncoding("08:96:01")).toBe("hex");
  });

  it("classifies strings with non-hex characters as base64", () => {
    expect(detectEncoding("aGVsbG8=")).toBe("base64");
  });

  it("treats an odd nibble count as base64, not hex", () => {
    expect(detectEncoding("0896011")).toBe("base64");
  });

  it("returns a stable value for the empty string (base64), never throwing", () => {
    expect(detectEncoding("")).toBe("base64");
    expect(detectEncoding("   ")).toBe("base64");
  });

  it("classifies mixed-case base64 with g-z letters as base64", () => {
    expect(detectEncoding("EiAKB")).toBe("base64");
  });
});
