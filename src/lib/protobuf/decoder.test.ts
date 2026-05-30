import { describe, expect, it } from "vitest";
import { decodeMessage, MAX_DEPTH, MAX_PAYLOAD_BYTES } from "./decoder";

const bytes = (...b: number[]) => Uint8Array.from(b);

/** Build a varint-encoded value, big enough to test multi-byte cases. */
function varint(n: number | bigint): number[] {
  let v = BigInt(n);
  const out: number[] = [];
  while (v > 0x7fn) {
    out.push(Number(v & 0x7fn) | 0x80);
    v >>= 7n;
  }
  out.push(Number(v));
  return out;
}

describe("happy-path wire formats", () => {
  it("decodes the canonical {1: 150} varint example", () => {
    const f = decodeMessage(bytes(0x08, 0x96, 0x01));
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ fieldNumber: 1, wireType: 0 });
    expect(f[0].value).toMatchObject({ kind: "varint", asUnsigned: "150" });
  });

  it("decodes a string LEN payload as a string (not a sub-message)", () => {
    const f = decodeMessage(bytes(0x12, 0x07, 0x74, 0x65, 0x73, 0x74, 0x69, 0x6e, 0x67));
    expect(f[0].value.kind).toBe("len");
    if (f[0].value.kind === "len") {
      expect(f[0].value.interpretations.string).toBe("testing");
      expect(f[0].value.interpretations.message).toBeUndefined();
    }
  });

  it("recursively decodes nested messages: {3: {1: 150}}", () => {
    const f = decodeMessage(bytes(0x1a, 0x03, 0x08, 0x96, 0x01));
    if (f[0].value.kind === "len") {
      const inner = f[0].value.interpretations.message;
      expect(inner?.[0]).toMatchObject({ fieldNumber: 1 });
      expect(inner?.[0].value).toMatchObject({ asUnsigned: "150" });
    }
  });

  it("computes zigzag: varint 1 reads as sint -1", () => {
    const f = decodeMessage(bytes(0x08, 0x01));
    expect(f[0].value).toMatchObject({ asUnsigned: "1", asZigzag: "-1" });
  });

  it("decodes I32 float 1.0f", () => {
    const f = decodeMessage(bytes(0x0d, 0x00, 0x00, 0x80, 0x3f));
    if (f[0].value.kind === "i32") expect(f[0].value.asFloat).toBeCloseTo(1.0);
  });

  it("decodes I64 double 1.0d", () => {
    const f = decodeMessage(bytes(0x09, 0, 0, 0, 0, 0, 0, 0xf0, 0x3f));
    if (f[0].value.kind === "i64") expect(f[0].value.asDouble).toBeCloseTo(1.0);
  });

  it("preserves 64-bit precision for very large uint64 varints (BigInt path)", () => {
    // 2^53 + 1 — exceeds Number.MAX_SAFE_INTEGER. {1: 9007199254740993}
    const value = (1n << 53n) + 1n;
    const f = decodeMessage(Uint8Array.from([0x08, ...varint(value)]));
    expect(f[0].value).toMatchObject({ asUnsigned: "9007199254740993" });
  });
});

describe("error handling", () => {
  it("throws on a truncated varint", () => {
    expect(() => decodeMessage(bytes(0x08))).toThrow();
  });

  it("throws on an unsupported (group) wire type", () => {
    expect(() => decodeMessage(bytes(0x0b))).toThrow(/wire type/);
  });

  it("throws on field number 0", () => {
    expect(() => decodeMessage(bytes(0x00, 0x00))).toThrow(/field number 0/);
  });

  it("throws on a varint with more than 10 continuation bytes", () => {
    // 11 bytes all with the continuation bit set
    expect(() => decodeMessage(Uint8Array.from(Array(11).fill(0xff)))).toThrow();
  });
});

describe("hardening: depth & size limits", () => {
  it("rejects payloads above MAX_PAYLOAD_BYTES", () => {
    const huge = new Uint8Array(MAX_PAYLOAD_BYTES + 1);
    expect(() => decodeMessage(huge)).toThrow(/maximum size/i);
  });

  it("bails out of deep recursive submessage attempts without crashing", () => {
    // Build a chain of N nested single-field messages: {1: {1: {1: ... {1: 0}}}}.
    // Each level adds: tag(0x0a) + length-varint + inner.
    // The decoder must complete (top-level parse succeeds) and silently drop
    // message interpretations past MAX_DEPTH.
    let inner = Uint8Array.from([0x08, 0x00]); // {1: 0}
    const LEVELS = MAX_DEPTH + 20;
    for (let i = 0; i < LEVELS; i++) {
      const lenBytes = varint(inner.length);
      const next = new Uint8Array(1 + lenBytes.length + inner.length);
      next[0] = 0x0a; // field 1, wire 2
      next.set(lenBytes, 1);
      next.set(inner, 1 + lenBytes.length);
      inner = next;
    }
    // No throw, no infinite loop.
    const result = decodeMessage(inner);
    expect(Array.isArray(result)).toBe(true);

    // Walk down and confirm the message interpretation eventually disappears.
    let node = result[0];
    let depthSeen = 0;
    while (node?.value.kind === "len" && node.value.interpretations.message) {
      depthSeen++;
      node = node.value.interpretations.message[0];
    }
    expect(depthSeen).toBeLessThanOrEqual(MAX_DEPTH);
  });
});

describe("hardening: packed-repeated interpretations", () => {
  it("surfaces packed varints when the payload is a clean varint stream", () => {
    // field 1, LEN, payload = varints [3, 270, 86942]
    // 0x03, 0x8e 0x02, 0x9e 0xa7 0x05
    const payload = Uint8Array.from([0x03, 0x8e, 0x02, 0x9e, 0xa7, 0x05]);
    const msg = Uint8Array.from([0x0a, payload.length, ...payload]);
    const f = decodeMessage(msg);
    if (f[0].value.kind === "len") {
      const pv = f[0].value.interpretations.packedVarints;
      expect(pv).toBeDefined();
      expect(pv!.map((v) => v.asUnsigned)).toEqual(["3", "270", "86942"]);
    }
  });

  it("surfaces packed fixed32 when length is a multiple of 4", () => {
    // 8 bytes = two fixed32 values; 1.0f then 2.0f
    const payload = Uint8Array.from([0x00, 0x00, 0x80, 0x3f, 0x00, 0x00, 0x00, 0x40]);
    const msg = Uint8Array.from([0x0a, payload.length, ...payload]);
    const f = decodeMessage(msg);
    if (f[0].value.kind === "len") {
      const p32 = f[0].value.interpretations.packedFixed32;
      expect(p32).toHaveLength(2);
      expect(p32![0].asFloat).toBeCloseTo(1.0);
      expect(p32![1].asFloat).toBeCloseTo(2.0);
    }
  });

  it("does not surface packed fixed32 when length is not a multiple of 4", () => {
    const payload = Uint8Array.from([0x01, 0x02, 0x03, 0x04, 0x05]);
    const msg = Uint8Array.from([0x0a, payload.length, ...payload]);
    const f = decodeMessage(msg);
    if (f[0].value.kind === "len") {
      expect(f[0].value.interpretations.packedFixed32).toBeUndefined();
    }
  });
});

describe("hardening: fuzz (no crash on hostile / random bytes)", () => {
  // Seeded PRNG for reproducibility (mulberry32).
  function rng(seed: number) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  it("never crashes on random byte sequences across many iterations", () => {
    const r = rng(0xc0ffee);
    let parsed = 0;
    let errored = 0;
    for (let i = 0; i < 3000; i++) {
      const len = Math.floor(r() * 96);
      const buf = new Uint8Array(len);
      for (let j = 0; j < len; j++) buf[j] = Math.floor(r() * 256);
      try {
        decodeMessage(buf);
        parsed++;
      } catch (e) {
        // Must be an Error instance, not a freak crash type.
        expect(e).toBeInstanceOf(Error);
        errored++;
      }
    }
    // Sanity: in 3000 random buffers we expect both outcomes to occur.
    expect(parsed + errored).toBe(3000);
    expect(parsed).toBeGreaterThan(0);
    expect(errored).toBeGreaterThan(0);
  });
});

describe("golden: hand-verified composite messages", () => {
  it("decodes a mixed-wire-type message: {1: 150, 2: 'hi', 4: 3.14d}", () => {
    // field 1 varint 150 -> 08 96 01
    // field 2 LEN "hi"   -> 12 02 68 69
    // field 4 I64 3.14d  -> 21 1f 85 eb 51 b8 1e 09 40
    const f = decodeMessage(
      bytes(
        0x08, 0x96, 0x01,
        0x12, 0x02, 0x68, 0x69,
        0x21, 0x1f, 0x85, 0xeb, 0x51, 0xb8, 0x1e, 0x09, 0x40,
      ),
    );
    expect(f.map((x) => x.fieldNumber)).toEqual([1, 2, 4]);
    expect(f[0].value).toMatchObject({ kind: "varint", asUnsigned: "150" });
    if (f[1].value.kind === "len") expect(f[1].value.interpretations.string).toBe("hi");
    if (f[2].value.kind === "i64") expect(f[2].value.asDouble).toBeCloseTo(3.14);
  });

  it("decodes a Person-shaped message: {name='John', id=123, email='j@x'}", () => {
    // Person { name="John" (1, LEN), id=123 (2, VARINT), email="j@x" (3, LEN) }
    // 0a 04 4a 6f 68 6e | 10 7b | 1a 03 6a 40 78
    const f = decodeMessage(
      bytes(0x0a, 0x04, 0x4a, 0x6f, 0x68, 0x6e, 0x10, 0x7b, 0x1a, 0x03, 0x6a, 0x40, 0x78),
    );
    expect(f).toHaveLength(3);
    if (f[0].value.kind === "len") expect(f[0].value.interpretations.string).toBe("John");
    expect(f[1].value).toMatchObject({ asUnsigned: "123" });
    if (f[2].value.kind === "len") expect(f[2].value.interpretations.string).toBe("j@x");
  });
});
