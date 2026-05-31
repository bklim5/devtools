// UUIDv7 — pure module (D-15, RFC 9562 §5.7). Builds a time-ordered UUID from a
// 48-bit BE ms timestamp + 80 random bits, and decodes any UUID's version/variant
// (+ embedded ms timestamp for time-based versions 1/6/7). Randomness comes from
// crypto.getRandomValues (a CSPRNG — never a non-crypto PRNG, threat T-04-03). decodeUuid
// validates 32 hex nibbles BEFORE parsing and throws a bounded explicit Error on
// malformed input (T-04-01). v4 generation is native crypto.randomUUID elsewhere;
// this module only hand-rolls v7 (the part native APIs don't provide).

/**
 * Build a UUIDv7 from a Unix ms timestamp + at least 10 random bytes.
 * Bytes 0-5 = 48-bit BE ms; byte 6 high nibble = version 7; byte 8 top 2 bits =
 * variant 0b10; the rest is randomness. Lowercase dashed 8-4-4-4-12.
 */
export function buildUuidV7(unixMs: number, rand: Uint8Array /* >=10 bytes */): string {
  if (rand.length < 10) throw new Error("UUIDv7 needs 10 random bytes");
  const b = new Uint8Array(16);
  const ms = BigInt(Math.floor(unixMs));
  for (let i = 0; i < 6; i++) b[5 - i] = Number((ms >> BigInt(8 * i)) & 0xffn); // 48-bit BE ms
  for (let i = 0; i < 10; i++) b[6 + i] = rand[i];
  b[6] = (b[6] & 0x0f) | 0x70; // version 7 in high nibble of byte 6
  b[8] = (b[8] & 0x3f) | 0x80; // variant 0b10 in top 2 bits of byte 8
  return bytesToUuid(b);
}

/** Generate a UUIDv7 with the current time + fresh CSPRNG randomness. */
export function generateUuidV7(
  nowMs: number = Date.now(),
  rand: Uint8Array = crypto.getRandomValues(new Uint8Array(10)),
): string {
  return buildUuidV7(nowMs, rand);
}

export interface DecodedUuid {
  version: number;
  /** Top bits of byte 8 rendered as a 2-bit string ("10" = the RFC variant). */
  variant: string;
  /** Embedded 48-bit BE ms timestamp for time-based versions (1, 6, 7). */
  tsMs?: number;
}

/** Decode a UUID's version + variant (+ embedded ms for time-based versions). */
export function decodeUuid(uuid: string): DecodedUuid {
  const hex = uuid.replace(/-/g, "");
  if (hex.length !== 32 || !/^[0-9a-fA-F]{32}$/.test(hex)) {
    throw new Error("UUID must be 32 hex digits");
  }
  const b = new Uint8Array(16);
  for (let i = 0; i < 16; i++) b[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);

  const version = b[6] >> 4;
  // Variant = the top 2 bits of byte 8 ("10" = RFC 4122/9562 variant).
  const variant = (b[8] >> 6).toString(2).padStart(2, "0");

  const decoded: DecodedUuid = { version, variant };
  // Only v7 stores a 48-bit BE Unix-ms timestamp in bytes 0-5. v1/v6 use a
  // 60-bit 100ns count since 1582 (and v6 reorders it) — decoding those bytes as
  // Unix ms would emit a wrong date, so we leave tsMs undefined for them here.
  if (version === 7) {
    let ms = 0n;
    for (let i = 0; i < 6; i++) ms = (ms << 8n) | BigInt(b[i]);
    decoded.tsMs = Number(ms);
  }
  return decoded;
}

function bytesToUuid(b: Uint8Array): string {
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
