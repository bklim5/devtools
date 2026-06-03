// Decode orchestration: the single boundary between the untrusted pasted string
// and the schema-less decoder (PRO-01 / PRO-02, D-01/D-02).
//
// decodeInput picks the encoding (or honours a manual override per D-01),
// converts to bytes, runs decodeMessage, and times the decode. CRUCIALLY, it
// wraps BOTH the bytes conversion AND decodeMessage in one try/catch, so every
// thrown error — bad hex/base64, groups (wire type 3/4), truncation, oversize
// (MAX_PAYLOAD_BYTES) — becomes a status STRING and never crashes the UI
// (threat T-03-03; Pitfall 3). Empty / whitespace-only input is a NEUTRAL empty
// state, not an error (D-02).
//
// This module ships the pure `decodeInput` function only; the React state/hook
// wrapper that consumes it lives in plan 03-04.
import { base64ToBytes, decimalToBytes, hexToBytes } from "@/lib/bytes";
import { decodeMessage, type DecodedField } from "@/lib/protobuf/decoder";
import { detectEncoding, type InputEncoding } from "./detectEncoding";

export type { InputEncoding } from "./detectEncoding";

export interface DecodeResult {
  encoding: InputEncoding;
  byteCount: number;
  fields: DecodedField[] | null;
  error: string | null;
  timingMs: number;
}

export function decodeInput(raw: string, override?: InputEncoding): DecodeResult {
  const encoding = override ?? detectEncoding(raw);

  // Neutral empty state — paste nothing, get nothing, NOT an error (D-02).
  if (raw.trim() === "") {
    return { encoding, byteCount: 0, fields: [], error: null, timingMs: 0 };
  }

  const t0 = performance.now();
  try {
    const bytes =
      encoding === "hex"
        ? hexToBytes(raw)
        : encoding === "decimal"
          ? decimalToBytes(raw)
          : base64ToBytes(raw);
    const fields = decodeMessage(bytes);
    return {
      encoding,
      byteCount: bytes.length,
      fields,
      error: null,
      timingMs: performance.now() - t0,
    };
  } catch (e) {
    return {
      encoding,
      byteCount: 0,
      fields: null,
      error: e instanceof Error ? e.message : String(e),
      timingMs: performance.now() - t0,
    };
  }
}
