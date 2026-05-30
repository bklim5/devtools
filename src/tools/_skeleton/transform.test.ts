// TDD unit tests for the throwaway skeleton transform (node env — pure string
// work, no DOM). PHASE 1 THROWAWAY — deleted with the skeleton before Phase 2.
import { describe, expect, it } from "vitest";
import { inspect } from "./transform";

describe("skeleton inspect()", () => {
  it("reports byteLength, uppercase, and hex for ascii", () => {
    const r = inspect("abc");
    expect(r.byteLength).toBe(3);
    expect(r.upper).toBe("ABC");
    expect(r.hex).toBe("616263");
    expect(r.parseState).toBe("ok");
  });

  it("treats empty input as parseState 'empty' with byteLength 0", () => {
    const r = inspect("");
    expect(r.byteLength).toBe(0);
    expect(r.hex).toBe("");
    expect(r.parseState).toBe("empty");
  });

  it("counts UTF-8 bytes (not char length) for multibyte/unicode input", () => {
    // "é" is 2 UTF-8 bytes (0xc3 0xa9) but 1 JS char.
    const r = inspect("é");
    expect(r.byteLength).toBe(2);
    expect(r.hex).toBe("c3a9");

    // "😀" is 4 UTF-8 bytes (0xf0 0x9f 0x98 0x80) but 2 UTF-16 code units.
    const emoji = inspect("😀");
    expect(emoji.byteLength).toBe(4);
    expect(emoji.hex).toBe("f09f9880");
  });
});
