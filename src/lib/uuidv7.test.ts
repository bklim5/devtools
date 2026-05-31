// UUIDv7 (D-15, RFC 9562 §5.7). The build vector is the canonical RFC example;
// decode is asserted on that same fixed string + a native crypto.randomUUID (v4)
// + malformed input. Not self-referential — the build vector is a fixed literal.
import { describe, expect, it } from "vitest";
import { buildUuidV7, decodeUuid } from "./uuidv7";

describe("buildUuidV7", () => {
  it("produces the RFC 9562 canonical example", () => {
    const rand = Uint8Array.of(
      0x0c, 0xc3, 0x18, 0xc4, 0xdc, 0x0c, 0x0c, 0x18, 0x0c, 0xc3,
    );
    expect(buildUuidV7(1645557742000, rand)).toBe(
      "017f22e2-79b0-7cc3-98c4-dc0c0c180cc3",
    );
  });
});

describe("decodeUuid", () => {
  it("decodes the v7 vector to version 7, variant 10, ts 1645557742000", () => {
    const d = decodeUuid("017f22e2-79b0-7cc3-98c4-dc0c0c180cc3");
    expect(d.version).toBe(7);
    expect(d.variant).toBe("10");
    expect(d.tsMs).toBe(1645557742000);
    // 2022-02-22T19:22:22.000Z
    expect(new Date(d.tsMs!).toISOString()).toBe("2022-02-22T19:22:22.000Z");
  });

  it("decodes a native crypto.randomUUID as version 4, variant 10", () => {
    const d = decodeUuid(crypto.randomUUID());
    expect(d.version).toBe(4);
    expect(d.variant).toBe("10");
    expect(d.tsMs).toBeUndefined();
  });

  it("throws on a wrong-length value", () => {
    expect(() => decodeUuid("017f22e2-79b0-7cc3-98c4")).toThrow();
  });

  it("throws on a bad-hex value", () => {
    expect(() => decodeUuid("017f22e2-79b0-7cc3-98c4-dc0c0c180czz")).toThrow();
  });
});
