// Hex-vs-base64 input classifier for the Protobuf decoder (D-02).
//
// This is a PURE classifier: it only decides which converter the orchestrator
// should call (hexToBytes vs base64ToBytes). It deliberately imports nothing
// from `@/lib/bytes` — it never parses bytes, it only inspects the shape of the
// raw string. The actual conversion (and its own error handling) lives in the
// orchestrator (useDecode.ts).
//
// Precedence (D-02): decimal (comma anywhere) → hex (existing rule) → base64
// (default). A comma ANYWHERE ⇒ "decimal", unconditionally (D-01) — the
// "tokens 0–255" check is decimalToBytes's job, applied AFTER routing, NOT a
// detection gate; so "1, 2, 999" routes to decimal and surfaces a clear decimal
// range error, never a base64 fallback. Space-only input (no comma) does NOT
// auto-detect decimal (D-03) — it falls through to the hex/base64 rule below.
//
// Hex rule: strip a leading `0x` and the same separators hexToBytes strips
// (`[\s:_-]`); if what remains is non-empty, all hex digits, and an even number
// of nibbles, it is "hex". Everything else — including the empty string — is
// "base64" (the empty case is treated as a neutral default, not an error).

export type InputEncoding = "hex" | "base64" | "decimal";

export function detectEncoding(raw: string): InputEncoding {
  // D-01/D-02: a comma anywhere routes to decimal, FIRST. Cheap .includes — no
  // regex, not a ReDoS surface. Validation (0–255, integer) is decimalToBytes's.
  if (raw.includes(",")) return "decimal";

  const trimmed = raw.trim().replace(/^0x/i, "");
  const hexBody = trimmed.replace(/[\s:_-]/g, "");
  const looksHex =
    hexBody.length > 0 && /^[0-9a-fA-F]+$/.test(hexBody) && hexBody.length % 2 === 0;
  return looksHex ? "hex" : "base64";
}
