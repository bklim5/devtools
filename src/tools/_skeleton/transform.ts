// PHASE 1 THROWAWAY — delete before Phase 2. Does NOT use the real protobuf/base64 lib.
//
// This is the trivial transform driving the walking-skeleton "byte inspector"
// (D-04/D-05). It deliberately does NOT import @/lib/bytes or @/lib/protobuf —
// the real Base64/Protobuf tools are Phase 3's job. All logic here is inline,
// trivial string work so the skeleton stays genuinely throwaway.

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
  const bytes = new TextEncoder().encode(input);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return {
    byteLength: bytes.length,
    upper: input.toUpperCase(),
    hex,
    parseState: bytes.length === 0 ? "empty" : "ok",
  };
}
