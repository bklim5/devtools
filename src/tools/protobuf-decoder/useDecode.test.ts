// Tests for the decode orchestration (PRO-01 / PRO-02, D-01/D-02).
//
// decodeInput is the single boundary between the untrusted pasted string and
// the decoder: it picks the encoding (or honours a manual override), converts
// to bytes, runs decodeMessage, and turns EVERY thrown error (bad bytes,
// groups, truncation, oversize) into a status STRING — it must never throw past
// this boundary. Empty input is a NEUTRAL empty state, not an error. Pure node
// test — explicit imports, default node env.
import { describe, expect, it } from "vitest";
import { decodeInput } from "./useDecode";

describe("decodeInput — happy path", () => {
  it("decodes canonical {1:150} from hex", () => {
    const r = decodeInput("089601");
    expect(r.encoding).toBe("hex");
    expect(r.byteCount).toBe(3);
    expect(r.error).toBeNull();
    expect(r.fields).not.toBeNull();
    expect(r.fields).toHaveLength(1);
    expect(r.fields?.[0].fieldNumber).toBe(1);
    expect(typeof r.timingMs).toBe("number");
  });
});

describe("decodeInput — neutral empty state (D-02)", () => {
  it("returns fields:[] and error:null for an empty string (not an error)", () => {
    const r = decodeInput("");
    expect(r.error).toBeNull();
    expect(r.fields).toEqual([]);
    expect(r.byteCount).toBe(0);
  });

  it("treats whitespace-only input as neutral empty", () => {
    const r = decodeInput("   ");
    expect(r.error).toBeNull();
    expect(r.fields).toEqual([]);
    expect(r.byteCount).toBe(0);
  });
});

describe("decodeInput — errors surface as strings, never thrown (PRO-02)", () => {
  it("turns a group wire-type into an error string without throwing", () => {
    let r!: ReturnType<typeof decodeInput>;
    expect(() => {
      r = decodeInput("1c"); // tag 0x1c -> field 3, wire type 4 (EGROUP)
    }).not.toThrow();
    expect(r.fields).toBeNull();
    expect(r.error).toBeTruthy();
    expect(r.error?.toLowerCase()).toContain("group");
  });

  it("turns a truncated varint into an error string without throwing", () => {
    let r!: ReturnType<typeof decodeInput>;
    expect(() => {
      r = decodeInput("08"); // field 1 varint tag with no value byte
    }).not.toThrow();
    expect(r.fields).toBeNull();
    expect(r.error?.toLowerCase()).toMatch(/buffer|end/);
  });

  it("turns bad bytes input into an error string without throwing", () => {
    // "zz" -> detectEncoding picks base64; base64ToBytes throws on invalid input.
    let r!: ReturnType<typeof decodeInput>;
    expect(() => {
      r = decodeInput("!!not-bytes!!", "hex"); // forced hex, invalid hex chars
    }).not.toThrow();
    expect(r.fields).toBeNull();
    expect(r.error).toBeTruthy();
  });
});

describe("decodeInput — manual encoding override (D-01)", () => {
  it("forces base64 even when the raw looks like hex", () => {
    // "0896" is valid even-nibble hex, but forced as base64 it is decoded via
    // base64ToBytes -> different (or failing) bytes. Either way encoding is base64.
    const r = decodeInput("0896", "base64");
    expect(r.encoding).toBe("base64");
  });

  it("forces hex even when the raw looks like base64", () => {
    const r = decodeInput("089601", "hex");
    expect(r.encoding).toBe("hex");
  });
});
