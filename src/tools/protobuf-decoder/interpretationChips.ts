// Chip derivation + smart default selection (D-04 / D-06).
//
// Every chip a node offers is derived STRICTLY from the real FieldValue /
// LenInterpretation keys produced by the decoder (decoder.ts) — never from the
// mockup's invented keys (uint/u32/message/float…). Importing only the TYPES
// keeps this module pure (no decoder logic copied).
//
// Scalar nodes (varint/i64/i32) always carry their full reading set, so they
// emit a fixed chip list with a sensible default. LEN nodes are ambiguous: a
// chip is emitted ONLY when its interpretation key is actually present, in the
// locked precedence order
//   message > string > packed-varints > packed-i32 > packed-i64 > bytes(hex)
// and the default-selected chip is the first present per that precedence (D-04).
// `hex` is always present (the bytes floor), so every LEN node has at least the
// "bytes" chip.
//
// For LEN packed-* chips the displayed `value` is a compact, comma-joined list
// of each element's UNSIGNED reading (asUnsigned for varints/fixed64,
// asUint32 for fixed32) — the most neutral per-element reading. copyAsJson
// reuses these same readings so the chip and the copied JSON never disagree.
import type {
  DecodedField,
  LenInterpretation,
  PackedFixed32,
  PackedFixed64,
  PackedVarint,
} from "@/lib/protobuf/decoder";

export interface Chip {
  id: string;
  label: string;
  /** The display / copy string for this reading. */
  value: string;
}

/** Locked precedence over the real LenInterpretation keys (D-04). */
const LEN_PRECEDENCE: ReadonlyArray<{ key: keyof LenInterpretation; id: string; label: string }> = [
  { key: "message", id: "message", label: "message" },
  { key: "string", id: "string", label: "string" },
  { key: "packedVarints", id: "packed-varints", label: "packed varints" },
  { key: "packedFixed32", id: "packed-i32", label: "packed i32" },
  { key: "packedFixed64", id: "packed-i64", label: "packed i64" },
  { key: "hex", id: "bytes", label: "bytes" },
];

function packedVarintsValue(items: PackedVarint[]): string {
  return items.map((v) => v.asUnsigned).join(", ");
}
function packedFixed32Value(items: PackedFixed32[]): string {
  return items.map((v) => String(v.asUint32)).join(", ");
}
function packedFixed64Value(items: PackedFixed64[]): string {
  return items.map((v) => v.asUint64).join(", ");
}

function lenChips(interpretations: LenInterpretation): Chip[] {
  const chips: Chip[] = [];
  for (const { key, id, label } of LEN_PRECEDENCE) {
    const present = interpretations[key];
    if (present === undefined) continue;
    let value: string;
    switch (key) {
      case "string":
        value = interpretations.string ?? "";
        break;
      case "message":
        // The message reading renders as a nested tree, not a flat string; the
        // chip value is informational only (copyAsJson recurses directly).
        value = `message (${interpretations.message?.length ?? 0} fields)`;
        break;
      case "packedVarints":
        value = packedVarintsValue(interpretations.packedVarints ?? []);
        break;
      case "packedFixed32":
        value = packedFixed32Value(interpretations.packedFixed32 ?? []);
        break;
      case "packedFixed64":
        value = packedFixed64Value(interpretations.packedFixed64 ?? []);
        break;
      case "hex":
      default:
        value = interpretations.hex;
        break;
    }
    chips.push({ id, label, value });
  }
  return chips;
}

export function chipsForField(field: DecodedField): Chip[] {
  const v = field.value;
  switch (v.kind) {
    case "varint":
      return [
        { id: "uint64", label: "uint64", value: v.asUnsigned },
        { id: "int64", label: "int64", value: v.asSigned },
        { id: "sint", label: "sint", value: v.asZigzag },
        { id: "bool", label: "bool", value: String(v.asBool) },
      ];
    case "i64":
      return [
        { id: "double", label: "double", value: String(v.asDouble) },
        { id: "uint64", label: "uint64", value: v.asUint64 },
        { id: "int64", label: "int64", value: v.asInt64 },
        { id: "hex", label: "hex", value: v.hex },
      ];
    case "i32":
      return [
        { id: "float", label: "float", value: String(v.asFloat) },
        { id: "uint32", label: "uint32", value: String(v.asUint32) },
        { id: "int32", label: "int32", value: String(v.asInt32) },
        { id: "hex", label: "hex", value: v.hex },
      ];
    case "len":
      return lenChips(v.interpretations);
  }
}

/** The smart default-selected chip id for a node (first chip per precedence). */
export function defaultChipId(field: DecodedField): string {
  const chips = chipsForField(field);
  // Every node yields at least one chip (scalars are fixed; LEN always has hex).
  return chips[0]?.id ?? "";
}
