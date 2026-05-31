// Tests for chip derivation + smart default selection (D-04 / D-06).
//
// Chips are derived STRICTLY from the real FieldValue / LenInterpretation keys
// present (decoder.ts), NOT from the mockup's invented keys. For LEN nodes a
// chip is emitted only when its interpretation key is actually present, in the
// locked precedence order message > string > packed-varints > packed-i32 >
// packed-i64 > bytes(hex); the default-selected chip is the first present per
// that precedence. Scalar nodes emit their full fixed chip set with the stated
// default. Pure node test — explicit imports, default node env.
import { describe, expect, it } from "vitest";
import { chipsForField, defaultChipId } from "./interpretationChips";
import type { DecodedField, LenInterpretation } from "@/lib/protobuf/decoder";

function varintField(): DecodedField {
  return {
    fieldNumber: 1,
    wireType: 0,
    value: {
      kind: "varint",
      asUnsigned: "150",
      asSigned: "150",
      asZigzag: "75",
      asBool: true,
    },
  };
}

function i64Field(): DecodedField {
  return {
    fieldNumber: 2,
    wireType: 1,
    value: {
      kind: "i64",
      hex: "0000000000000000",
      asUint64: "0",
      asInt64: "0",
      asDouble: 0,
    },
  };
}

function i32Field(): DecodedField {
  return {
    fieldNumber: 3,
    wireType: 5,
    value: {
      kind: "i32",
      hex: "00000000",
      asUint32: 0,
      asInt32: 0,
      asFloat: 0,
    },
  };
}

function lenField(interpretations: LenInterpretation): DecodedField {
  return {
    fieldNumber: 4,
    wireType: 2,
    value: { kind: "len", byteLength: interpretations.hex.length / 2, interpretations },
  };
}

const ids = (f: DecodedField) => chipsForField(f).map((c) => c.id);

describe("chipsForField — scalar nodes", () => {
  it("emits varint chips [uint64, int64, sint, bool] with values from the real fields, default uint64", () => {
    const f = varintField();
    const chips = chipsForField(f);
    expect(chips.map((c) => c.id)).toEqual(["uint64", "int64", "sint", "bool"]);
    expect(chips.map((c) => c.value)).toEqual(["150", "150", "75", "true"]);
    expect(defaultChipId(f)).toBe("uint64");
  });

  it("emits i64 chips [double, uint64, int64, hex], default double", () => {
    const f = i64Field();
    expect(ids(f)).toEqual(["double", "uint64", "int64", "hex"]);
    expect(defaultChipId(f)).toBe("double");
  });

  it("emits i32 chips [float, uint32, int32, hex], default float", () => {
    const f = i32Field();
    expect(ids(f)).toEqual(["float", "uint32", "int32", "hex"]);
    expect(defaultChipId(f)).toBe("float");
  });
});

describe("chipsForField — LEN nodes (precedence + presence-gated, D-04)", () => {
  it("emits only present keys in precedence order; {hex,string,message} -> [message, string, bytes], default message", () => {
    const f = lenField({
      hex: "0a02hi",
      string: "hi",
      message: [
        {
          fieldNumber: 1,
          wireType: 0,
          value: { kind: "varint", asUnsigned: "5", asSigned: "5", asZigzag: "-3", asBool: true },
        },
      ],
    });
    expect(ids(f)).toEqual(["message", "string", "bytes"]);
    expect(defaultChipId(f)).toBe("message");
  });

  it("emits [bytes] only when just hex is present (the always-present floor), default bytes", () => {
    const f = lenField({ hex: "ff00ff" });
    expect(ids(f)).toEqual(["bytes"]);
    expect(defaultChipId(f)).toBe("bytes");
  });

  it("emits [packed-varints, bytes] for {hex, packedVarints}, default packed-varints", () => {
    const f = lenField({
      hex: "089601",
      packedVarints: [
        { asUnsigned: "8", asSigned: "8", asZigzag: "4" },
        { asUnsigned: "150", asSigned: "150", asZigzag: "75" },
      ],
    });
    expect(ids(f)).toEqual(["packed-varints", "bytes"]);
    expect(defaultChipId(f)).toBe("packed-varints");
  });

  it("orders packed-i32 before packed-i64 before bytes when all present", () => {
    const f = lenField({
      hex: "00000000000000ff",
      packedFixed32: [
        { hex: "00000000", asUint32: 0, asInt32: 0, asFloat: 0 },
        { hex: "000000ff", asUint32: 4278190080, asInt32: -16777216, asFloat: -1.7014118e38 },
      ],
      packedFixed64: [
        { hex: "00000000000000ff", asUint64: "0", asInt64: "0", asDouble: 0 },
      ],
    });
    expect(ids(f)).toEqual(["packed-i32", "packed-i64", "bytes"]);
    expect(defaultChipId(f)).toBe("packed-i32");
  });

  it("never emits a chip for an absent interpretation key", () => {
    const f = lenField({ hex: "abcd", string: "«Í" });
    const chipIds = ids(f);
    expect(chipIds).not.toContain("message");
    expect(chipIds).not.toContain("packed-varints");
    expect(chipIds).toEqual(["string", "bytes"]);
  });
});
