// PHASE 1 THROWAWAY — delete before Phase 2. Not the real Protobuf/Base64 tools.
//
// This is the trivial transform driving the walking-skeleton "byte inspector"
// (D-04/D-05). It reuses the low-level UTF-8/hex helpers from @/lib/bytes
// (a permanent, byte-frozen module) rather than re-implementing them — the
// real Base64/Protobuf *tools* are Phase 3's job, but their underlying byte
// helpers already exist and the skeleton should exercise the shared path.

import { utf8ToBytes, bytesToHex } from "@/lib/bytes";

export type ParseState = "empty" | "ok";

export interface Inspection {
  /** UTF-8 byte length of the input (NOT character/code-unit count). */
  byteLength: number;
  /** Uppercased form of the input. */
  upper: string;
  /** Lowercase hex of the UTF-8 bytes, e.g. "abc" -> "616263". */
  hex: string;
  /** "empty" for empty input, otherwise "ok". */
  parseState: ParseState;
}

/** Inspect a string: UTF-8 byte length + uppercase + hex. Trivial, throwaway. */
export function inspect(input: string): Inspection {
  const bytes = utf8ToBytes(input);
  return {
    byteLength: bytes.length,
    upper: input.toUpperCase(),
    hex: bytesToHex(bytes),
    parseState: bytes.length === 0 ? "empty" : "ok",
  };
}
