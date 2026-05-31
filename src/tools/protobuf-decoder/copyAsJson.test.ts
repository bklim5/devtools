// Tests for copy-as-JSON serialization (D-11).
//
// fieldsToJson serializes a decoded tree as pretty JSON with FIELD NUMBERS as
// the keys and each node's CURRENTLY-SELECTED interpretation as the value,
// recursing into nested messages. Selection is a Map keyed by node path
// ("<index>" at top level, "<parentPath>.<index>" nested); a missing entry
// falls back to the smart default (interpretationChips.defaultChipId). Repeated
// field numbers collect into an array under that key. Readings are reused from
// chipsForField — never re-derived here. Pure node test — explicit imports.
import { describe, expect, it } from "vitest";
import { fieldsToJson } from "./copyAsJson";
import type { DecodedField } from "@/lib/protobuf/decoder";

function varint(fieldNumber: number, asUnsigned: string, asSigned = asUnsigned): DecodedField {
  return {
    fieldNumber,
    wireType: 0,
    value: { kind: "varint", asUnsigned, asSigned, asZigzag: "0", asBool: asUnsigned !== "0" },
  };
}

describe("fieldsToJson (D-11)", () => {
  it("serializes a varint field with field number as key, default uint64 reading", () => {
    const fields = [varint(1, "150")];
    const json = JSON.parse(fieldsToJson(fields, new Map()));
    expect(json).toEqual({ "1": "150" });
  });

  it("recurses a nested message selected as 'message'", () => {
    const fields: DecodedField[] = [
      {
        fieldNumber: 2,
        wireType: 2,
        value: {
          kind: "len",
          byteLength: 3,
          interpretations: {
            hex: "089601",
            message: [varint(1, "150")],
          },
        },
      },
    ];
    // message is first per precedence -> default selected, no override needed.
    const json = JSON.parse(fieldsToJson(fields, new Map()));
    expect(json).toEqual({ "2": { "1": "150" } });
  });

  it("honours an explicit 'string' selection on a LEN node", () => {
    const fields: DecodedField[] = [
      {
        fieldNumber: 3,
        wireType: 2,
        value: {
          kind: "len",
          byteLength: 2,
          interpretations: { hex: "6869", string: "hi" },
        },
      },
    ];
    const sel = new Map<string, string>([["0", "string"]]);
    expect(JSON.parse(fieldsToJson(fields, sel))).toEqual({ "3": "hi" });
  });

  it("honours an explicit 'bytes' selection on a LEN node (hex string)", () => {
    const fields: DecodedField[] = [
      {
        fieldNumber: 3,
        wireType: 2,
        value: {
          kind: "len",
          byteLength: 2,
          interpretations: { hex: "6869", string: "hi" },
        },
      },
    ];
    const sel = new Map<string, string>([["0", "bytes"]]);
    expect(JSON.parse(fieldsToJson(fields, sel))).toEqual({ "3": "6869" });
  });

  it("serializes a 'packed-varints' selection as an array of readings", () => {
    const fields: DecodedField[] = [
      {
        fieldNumber: 4,
        wireType: 2,
        value: {
          kind: "len",
          byteLength: 3,
          interpretations: {
            hex: "089601",
            packedVarints: [
              { asUnsigned: "8", asSigned: "8", asZigzag: "4" },
              { asUnsigned: "150", asSigned: "150", asZigzag: "75" },
            ],
          },
        },
      },
    ];
    const sel = new Map<string, string>([["0", "packed-varints"]]);
    expect(JSON.parse(fieldsToJson(fields, sel))).toEqual({ "4": ["8", "150"] });
  });

  it("collects repeated field numbers into an array under that key", () => {
    const fields = [varint(5, "1"), varint(5, "2"), varint(5, "3")];
    expect(JSON.parse(fieldsToJson(fields, new Map()))).toEqual({ "5": ["1", "2", "3"] });
  });

  it("emits pretty (2-space) JSON", () => {
    const out = fieldsToJson([varint(1, "150")], new Map());
    expect(out).toBe('{\n  "1": "150"\n}');
  });
});
