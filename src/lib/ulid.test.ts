// ULID (D-02): Crockford base32 of a 48-bit ms timestamp + 80-bit randomness.
// Vectors are asserted against FIXED known-good strings (not self-referential
// generate→decode round-trips on random data — Pitfall: a wrong encoder+decoder
// can agree). The one round-trip below injects a FIXED clock + FIXED random bytes
// so the recovered ms + 10 bytes are deterministic.
import { describe, expect, it } from "vitest";
import { decodeTime, decodeUlid, encodeTime, generateUlid } from "./ulid";

describe("encodeTime / decodeTime", () => {
  it("decodes the canonical vector to 1469922850259", () => {
    expect(decodeTime("01ARZ3NDEKTSV4RRFFQ69G5FAV")).toBe(1469922850259);
  });

  it("encodes 1469922850259 to the vector's 10-char time prefix", () => {
    expect(encodeTime(1469922850259).slice(0, 10)).toBe("01ARZ3NDEK");
  });

  it("encodes 0 to ten zero chars", () => {
    expect(encodeTime(0)).toBe("0000000000");
  });

  it("encodes the 2^48-1 max to 7ZZZZZZZZZ", () => {
    expect(encodeTime(281474976710655)).toBe("7ZZZZZZZZZ");
  });

  it("throws on overflow past 2^48-1", () => {
    expect(() => encodeTime(281474976710656)).toThrow();
  });

  it("throws on a negative timestamp", () => {
    expect(() => encodeTime(-1)).toThrow();
  });
});

describe("generateUlid / decodeUlid", () => {
  it("round-trips an injected clock + fixed random bytes exactly", () => {
    const ms = 1469922850259;
    const rand = Uint8Array.of(0, 1, 2, 3, 4, 5, 6, 7, 8, 9);
    const ulid = generateUlid(ms, rand);
    expect(ulid).toHaveLength(26);
    const decoded = decodeUlid(ulid);
    expect(decoded.tsMs).toBe(ms);
    expect([...decoded.randomness]).toEqual([...rand]);
  });

  it("throws on a wrong-length string", () => {
    expect(() => decodeUlid("01ARZ3NDEKTSV4RRFFQ69G5FA")).toThrow(); // 25 chars
  });

  it("throws on a non-alphabet character (I/L/O/U excluded)", () => {
    expect(() => decodeUlid("01ARZ3NDEKTSV4RRFFQ69G5FAI")).toThrow();
  });
});
