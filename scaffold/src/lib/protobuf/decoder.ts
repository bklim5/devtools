// Schema-less protobuf wire-format decoder.
//
// Walks the raw protobuf wire format with no .proto schema, producing a tree of
// fields. Because the wire format is ambiguous without a schema (a LEN payload
// could be a string, bytes, a sub-message, or packed repeated values of an
// unknown scalar type), every LEN field carries *all* viable interpretations
// and the UI lets the user choose.
//
// Hardening (review feedback):
//   - depth limit (MAX_DEPTH) prevents stack blow-up on hostile nested input
//   - size limit (MAX_PAYLOAD_BYTES) prevents DoS-by-paste on huge inputs
//   - packed-repeated values (varint / fixed32 / fixed64) surfaced explicitly
//     rather than being silently parsed as a coincidental sub-message
//
// Wire types (https://protobuf.dev/programming-guides/encoding/):
//   0 VARINT  int32/64, uint32/64, sint32/64, bool, enum
//   1 I64     fixed64, sfixed64, double
//   2 LEN     string, bytes, embedded message, packed repeated
//   5 I32     fixed32, sfixed32, float
//   3/4       deprecated groups (SGROUP/EGROUP) — surfaced as an error

export type WireType = 0 | 1 | 2 | 5;

/** Maximum nesting depth for recursive sub-message attempts. */
export const MAX_DEPTH = 64;
/** Maximum top-level payload size accepted by decodeMessage (16 MiB). */
export const MAX_PAYLOAD_BYTES = 16 * 1024 * 1024;

export interface PackedVarint {
  asUnsigned: string;
  asSigned: string;
  asZigzag: string;
}
export interface PackedFixed32 {
  hex: string;
  asUint32: number;
  asInt32: number;
  asFloat: number;
}
export interface PackedFixed64 {
  hex: string;
  asUint64: string;
  asInt64: string;
  asDouble: number;
}

export interface LenInterpretation {
  /** Always present: raw payload as lowercase hex. */
  hex: string;
  /** Present when the payload is valid UTF-8. */
  string?: string;
  /** Present when the payload parses cleanly as a nested message. */
  message?: DecodedField[];
  /** Present when the payload parses cleanly as a stream of varints. */
  packedVarints?: PackedVarint[];
  /** Present when the payload length is a positive multiple of 4. */
  packedFixed32?: PackedFixed32[];
  /** Present when the payload length is a positive multiple of 8. */
  packedFixed64?: PackedFixed64[];
}

export type FieldValue =
  | {
      kind: "varint";
      asUnsigned: string;
      asSigned: string;
      asZigzag: string;
      asBool: boolean;
    }
  | {
      kind: "i64";
      hex: string;
      asUint64: string;
      asInt64: string;
      asDouble: number;
    }
  | {
      kind: "i32";
      hex: string;
      asUint32: number;
      asInt32: number;
      asFloat: number;
    }
  | {
      kind: "len";
      byteLength: number;
      interpretations: LenInterpretation;
    };

export interface DecodedField {
  fieldNumber: number;
  wireType: WireType;
  value: FieldValue;
}

class Reader {
  pos = 0;
  constructor(private readonly buf: Uint8Array) {}

  get eof(): boolean {
    return this.pos >= this.buf.length;
  }

  readVarint(): bigint {
    let result = 0n;
    let shift = 0n;
    for (;;) {
      if (this.pos >= this.buf.length) {
        throw new Error("Unexpected end of buffer while reading varint");
      }
      const byte = this.buf[this.pos++];
      result |= BigInt(byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) return result;
      shift += 7n;
      if (shift > 63n) throw new Error("Varint exceeds 64 bits");
    }
  }

  readBytes(n: number): Uint8Array {
    if (n < 0) throw new Error("Negative length");
    if (this.pos + n > this.buf.length) throw new Error("Unexpected end of buffer");
    const out = this.buf.subarray(this.pos, this.pos + n);
    this.pos += n;
    return out;
  }
}

/**
 * Decode a buffer as a protobuf message.
 *
 * @param buf   the message bytes
 * @param depth recursion depth (internal; callers should omit)
 *
 * Throws on: oversize input (top level only), recursion past MAX_DEPTH, truncated
 * varints/payloads, unsupported wire types (groups), invalid field numbers.
 */
export function decodeMessage(buf: Uint8Array, depth = 0): DecodedField[] {
  if (depth === 0 && buf.length > MAX_PAYLOAD_BYTES) {
    throw new Error(`Payload exceeds maximum size (${MAX_PAYLOAD_BYTES} bytes)`);
  }
  if (depth > MAX_DEPTH) {
    throw new Error(`Maximum nesting depth (${MAX_DEPTH}) exceeded`);
  }

  const r = new Reader(buf);
  const fields: DecodedField[] = [];
  while (!r.eof) {
    const tag = r.readVarint();
    const fieldNumber = Number(tag >> 3n);
    const wireType = Number(tag & 0x7n);
    if (fieldNumber === 0) throw new Error("Invalid field number 0");

    switch (wireType) {
      case 0:
        fields.push({ fieldNumber, wireType: 0, value: decodeVarint(r.readVarint()) });
        break;
      case 1:
        fields.push({ fieldNumber, wireType: 1, value: decodeI64(r.readBytes(8)) });
        break;
      case 2: {
        const len = Number(r.readVarint());
        const bytes = r.readBytes(len);
        fields.push({ fieldNumber, wireType: 2, value: decodeLen(bytes, depth) });
        break;
      }
      case 5:
        fields.push({ fieldNumber, wireType: 5, value: decodeI32(r.readBytes(4)) });
        break;
      default:
        throw new Error(
          `Unsupported wire type ${wireType} (field ${fieldNumber}); groups are not supported`,
        );
    }
  }
  return fields;
}

function decodeVarint(raw: bigint): FieldValue {
  const asSigned = BigInt.asIntN(64, raw);
  const asZigzag = (raw >> 1n) ^ -(raw & 1n);
  return {
    kind: "varint",
    asUnsigned: raw.toString(),
    asSigned: asSigned.toString(),
    asZigzag: asZigzag.toString(),
    asBool: raw !== 0n,
  };
}

function decodeI64(bytes: Uint8Array): FieldValue {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    kind: "i64",
    hex: toHex(bytes),
    asUint64: dv.getBigUint64(0, true).toString(),
    asInt64: dv.getBigInt64(0, true).toString(),
    asDouble: dv.getFloat64(0, true),
  };
}

function decodeI32(bytes: Uint8Array): FieldValue {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    kind: "i32",
    hex: toHex(bytes),
    asUint32: dv.getUint32(0, true),
    asInt32: dv.getInt32(0, true),
    asFloat: dv.getFloat32(0, true),
  };
}

function decodeLen(bytes: Uint8Array, depth: number): FieldValue {
  const interpretations: LenInterpretation = { hex: toHex(bytes) };

  // Sub-message: only attempt if we have depth budget; failures (including
  // depth-exceeded) just mean no message interpretation is offered.
  if (bytes.length > 0 && depth < MAX_DEPTH) {
    try {
      const sub = decodeMessage(bytes, depth + 1);
      if (sub.length > 0) interpretations.message = sub;
    } catch {
      /* not a valid sub-message */
    }
  }

  // UTF-8 string (fatal mode rejects invalid sequences).
  try {
    interpretations.string = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    /* not valid UTF-8 */
  }

  // Packed varints: cleanly consume the buffer with at least one value.
  const pv = tryPackedVarints(bytes);
  if (pv) interpretations.packedVarints = pv;

  // Packed fixed-width: length is a positive multiple of the element size.
  if (bytes.length > 0 && bytes.length % 4 === 0) {
    interpretations.packedFixed32 = readPacked(bytes, 4, (slice) => {
      const dv = new DataView(slice.buffer, slice.byteOffset, slice.byteLength);
      return {
        hex: toHex(slice),
        asUint32: dv.getUint32(0, true),
        asInt32: dv.getInt32(0, true),
        asFloat: dv.getFloat32(0, true),
      };
    });
  }
  if (bytes.length > 0 && bytes.length % 8 === 0) {
    interpretations.packedFixed64 = readPacked(bytes, 8, (slice) => {
      const dv = new DataView(slice.buffer, slice.byteOffset, slice.byteLength);
      return {
        hex: toHex(slice),
        asUint64: dv.getBigUint64(0, true).toString(),
        asInt64: dv.getBigInt64(0, true).toString(),
        asDouble: dv.getFloat64(0, true),
      };
    });
  }

  return { kind: "len", byteLength: bytes.length, interpretations };
}

function tryPackedVarints(bytes: Uint8Array): PackedVarint[] | undefined {
  if (bytes.length === 0) return undefined;
  const r = new Reader(bytes);
  const out: PackedVarint[] = [];
  try {
    while (!r.eof) {
      const raw = r.readVarint();
      out.push({
        asUnsigned: raw.toString(),
        asSigned: BigInt.asIntN(64, raw).toString(),
        asZigzag: ((raw >> 1n) ^ -(raw & 1n)).toString(),
      });
    }
  } catch {
    return undefined;
  }
  return out.length > 0 ? out : undefined;
}

function readPacked<T>(bytes: Uint8Array, size: number, decode: (s: Uint8Array) => T): T[] {
  const out: T[] = [];
  for (let i = 0; i < bytes.length; i += size) {
    out.push(decode(bytes.subarray(i, i + size)));
  }
  return out;
}

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}
