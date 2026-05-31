// Hex-vs-base64 input classifier for the Protobuf decoder (D-02).
//
// This is a PURE classifier: it only decides which converter the orchestrator
// should call (hexToBytes vs base64ToBytes). It deliberately imports nothing
// from `@/lib/bytes` — it never parses bytes, it only inspects the shape of the
// raw string. The actual conversion (and its own error handling) lives in the
// orchestrator (useDecode.ts).
//
// Rule: strip a leading `0x` and the same separators hexToBytes strips
// (`[\s:_-]`); if what remains is non-empty, all hex digits, and an even number
// of nibbles, it is "hex". Everything else — including the empty string — is
// "base64" (the empty case is treated as a neutral default, not an error).

export type InputEncoding = "hex" | "base64";

export function detectEncoding(raw: string): InputEncoding {
  const trimmed = raw.trim().replace(/^0x/i, "");
  const hexBody = trimmed.replace(/[\s:_-]/g, "");
  const looksHex =
    hexBody.length > 0 && /^[0-9a-fA-F]+$/.test(hexBody) && hexBody.length % 2 === 0;
  return looksHex ? "hex" : "base64";
}
