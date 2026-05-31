// decodeId (UID-01, D-17/D-08) — auto-detect UUID vs ULID + full breakdown.
// TDD against the FIXED known-good vectors (RESEARCH §"UUID v7" / §"ULID"), never a
// self-referential generate→decode roundtrip (a shared encode/decode bug would hide).
// The boundary contract (T-04-14): every malformed input returns an explicit
// `kind:"error"` result — decodeId NEVER throws.
import { describe, expect, it } from "vitest";
import { decodeId } from "./decodeId";

// RFC 9562 v7 example.
const UUID_V7 = "017f22e2-79b0-7cc3-98c4-dc0c0c180cc3";
// Canonical ULID spec vector.
const ULID = "01ARZ3NDEKTSV4RRFFQ69G5FAV";

describe("decodeId", () => {
  it("decodes a UUID v7 with version, variant, and embedded timestamp", () => {
    const r = decodeId(UUID_V7);
    expect(r).toMatchObject({
      kind: "ok",
      type: "uuid",
      version: 7,
      variant: "10",
      tsMs: 1645557742000,
    });
  });

  it("decodes a UUID v4 (no embedded timestamp)", () => {
    const r = decodeId(crypto.randomUUID());
    expect(r.kind).toBe("ok");
    if (r.kind === "ok" && r.type === "uuid") {
      expect(r.version).toBe(4);
      expect(r.variant).toBe("10");
      expect(r.tsMs).toBeUndefined();
    } else {
      throw new Error("expected an ok uuid result");
    }
  });

  it("decodes a ULID with timestamp + 10 randomness bytes", () => {
    const r = decodeId(ULID);
    expect(r.kind).toBe("ok");
    if (r.kind === "ok" && r.type === "ulid") {
      expect(r.tsMs).toBe(1469922850259);
      expect(r.randomness).toBeInstanceOf(Uint8Array);
      expect(r.randomness.length).toBe(10);
    } else {
      throw new Error("expected an ok ulid result");
    }
  });

  it("treats empty / whitespace-only input as a neutral empty state (not an error)", () => {
    expect(decodeId("")).toEqual({ kind: "empty" });
    expect(decodeId("   ")).toEqual({ kind: "empty" });
  });

  it("trims surrounding whitespace before detecting", () => {
    const r = decodeId(`  ${ULID}  `);
    expect(r.kind).toBe("ok");
  });

  it("flags a non-id string as an explicit error (never throws)", () => {
    const r = decodeId("not-an-id");
    expect(r.kind).toBe("error");
    if (r.kind === "error") expect(r.message).toBeTruthy();
  });

  it("flags a 25-char near-ULID as an explicit error (never throws)", () => {
    // One char short of a 26-char ULID.
    const r = decodeId("01ARZ3NDEKTSV4RRFFQ69G5FA");
    expect(r.kind).toBe("error");
  });

  it("flags a UUID-shaped string with a bad hex nibble as an error", () => {
    const r = decodeId("017f22e2-79b0-7cc3-98c4-dc0c0c180ccZ");
    expect(r.kind).toBe("error");
  });

  it("flags a 26-char string with an out-of-alphabet char (I/L/O/U) as an error", () => {
    // 'I' is excluded from Crockford base32 → not a valid ULID char.
    const r = decodeId("01ARZ3NDEKTSV4RRFFQ69G5FAI");
    expect(r.kind).toBe("error");
  });

  it("accepts an uppercase UUID (case-insensitive shape)", () => {
    const r = decodeId(UUID_V7.toUpperCase());
    expect(r.kind).toBe("ok");
    if (r.kind === "ok" && r.type === "uuid") expect(r.version).toBe(7);
  });
});
