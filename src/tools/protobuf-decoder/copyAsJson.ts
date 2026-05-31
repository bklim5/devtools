// Copy-as-JSON serialization (D-11).
//
// Serializes a decoded tree as pretty JSON with FIELD NUMBERS as keys and each
// node's CURRENTLY-SELECTED interpretation as the value, recursing nested
// messages. Selection is a Map keyed by node path: "<index>" at the top level,
// "<parentPath>.<index>" nested (the same scheme 03-04 drives the UI with).
// A missing selection entry falls back to the smart default
// (defaultChipId) so an untouched tree still copies sensibly.
//
// Repeated field numbers collect into an ARRAY under that key (the wire format
// allows the same field number many times). Scalar / string / bytes readings
// reuse chipsForField so the copied JSON can never disagree with the chip the
// user sees; packed-* selections emit an ARRAY of per-element readings (richer
// than the chip's comma-joined preview, but the same underlying numbers).
//
// This module returns a string only — it does NOT import @tauri-apps/* and does
// NOT touch the clipboard (threat T-03-05); the actual clipboard write happens
// through the platform seam in 03-04.
import type { DecodedField, FieldValue } from "@/lib/protobuf/decoder";
import { chipsForField, defaultChipId } from "./interpretationChips";

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

export function fieldsToJson(fields: DecodedField[], selection: Map<string, string>): string {
  return JSON.stringify(buildObject(fields, "", selection), null, 2);
}

function buildObject(
  fields: DecodedField[],
  parentPath: string,
  selection: Map<string, string>,
): { [k: string]: JsonValue } {
  const obj: { [k: string]: JsonValue } = {};
  fields.forEach((field, index) => {
    const path = parentPath === "" ? String(index) : `${parentPath}.${index}`;
    const key = String(field.fieldNumber);
    const value = serializeField(field, path, selection);

    if (key in obj) {
      // Repeated field number -> collect into an array under that key.
      const existing = obj[key];
      if (Array.isArray(existing)) existing.push(value);
      else obj[key] = [existing, value];
    } else {
      obj[key] = value;
    }
  });
  return obj;
}

function serializeField(
  field: DecodedField,
  path: string,
  selection: Map<string, string>,
): JsonValue {
  const selectedId = selection.get(path) ?? defaultChipId(field);
  const v = field.value;

  if (v.kind === "len") {
    return serializeLen(v, selectedId, path, selection);
  }

  // Scalar nodes: reuse the chip value for the selected reading.
  return chipValue(field, selectedId);
}

function serializeLen(
  v: Extract<FieldValue, { kind: "len" }>,
  selectedId: string,
  path: string,
  selection: Map<string, string>,
): JsonValue {
  const i = v.interpretations;
  switch (selectedId) {
    case "message":
      return i.message ? buildObject(i.message, path, selection) : i.hex;
    case "string":
      return i.string ?? i.hex;
    case "packed-varints":
      return (i.packedVarints ?? []).map((p) => p.asUnsigned);
    case "packed-i32":
      return (i.packedFixed32 ?? []).map((p) => p.asUint32);
    case "packed-i64":
      return (i.packedFixed64 ?? []).map((p) => p.asUint64);
    case "bytes":
    default:
      return i.hex;
  }
}

/** Look up the chip value for a scalar field by its selected chip id. */
function chipValue(field: DecodedField, selectedId: string): string {
  const chips = chipsForField(field);
  const chip = chips.find((c) => c.id === selectedId) ?? chips[0];
  return chip?.value ?? "";
}
