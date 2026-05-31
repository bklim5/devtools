// ULID — pure module (D-02), zero React/DOM/Tauri imports. Crockford base32 of a
// 48-bit ms timestamp (10 chars) + 80-bit randomness (16 chars) = 26 chars.
// Randomness comes from crypto.getRandomValues (a CSPRNG — never a non-crypto
// PRNG, threat T-04-03). generate*/decode accept injected clock/entropy so tests assert
// fixed vectors; production callers omit them. Decode paths validate
// length + charset BEFORE parsing and throw bounded explicit Errors (T-04-01).

// Crockford base32 — 32 chars, excludes I, L, O, U. 5 bits per char.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

// Reverse lookup: char → 5-bit value. Built once.
const REVERSE: Record<string, number> = {};
for (let i = 0; i < ALPHABET.length; i++) REVERSE[ALPHABET[i]] = i;

// Max 48-bit ms timestamp = 2^48 - 1.
const MAX_TIME = 281474976710655;

/** Encode a 48-bit ms timestamp as 10 Crockford-base32 chars, MSB-first. */
export function encodeTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0 || ms > MAX_TIME) {
    throw new Error("ULID timestamp overflow");
  }
  let n = Math.floor(ms);
  let out = "";
  // 10 chars = 50 bits; emit least-significant 5 bits then prepend → MSB-first.
  for (let i = 0; i < 10; i++) {
    out = ALPHABET[n % 32] + out;
    n = Math.floor(n / 32);
  }
  return out;
}

/** Decode the first 10 chars of a ULID back to a 48-bit ms integer. */
export function decodeTime(ulid: string): number {
  const time = ulid.slice(0, 10);
  let n = 0;
  for (const ch of time) {
    const v = REVERSE[ch];
    if (v === undefined) throw new Error(`Invalid ULID time character: ${ch}`);
    n = n * 32 + v;
  }
  return n;
}

/** Encode 10 bytes (80 bits) as 16 Crockford-base32 chars. */
function encodeRandomness(rand: Uint8Array): string {
  if (rand.length < 10) throw new Error("ULID randomness needs 10 bytes");
  // Treat the 80 bits as one big integer and emit 16 base32 chars MSB-first.
  let n = 0n;
  for (let i = 0; i < 10; i++) n = (n << 8n) | BigInt(rand[i]);
  let out = "";
  for (let i = 0; i < 16; i++) {
    out = ALPHABET[Number(n & 31n)] + out;
    n >>= 5n;
  }
  return out;
}

/** Decode 16 base32 chars back to the 10 random bytes (80 bits). */
function decodeRandomness(chars: string): Uint8Array {
  let n = 0n;
  for (const ch of chars) {
    const v = REVERSE[ch];
    if (v === undefined)
      throw new Error(`Invalid ULID randomness character: ${ch}`);
    n = (n << 5n) | BigInt(v);
  }
  const out = new Uint8Array(10);
  for (let i = 9; i >= 0; i--) {
    out[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return out;
}

/**
 * Generate a 26-char ULID. Injects nowMs + 10 random bytes so tests are
 * deterministic; production calls pass neither and get Date.now() +
 * crypto.getRandomValues.
 */
export function generateUlid(
  nowMs: number = Date.now(),
  rand: Uint8Array = crypto.getRandomValues(new Uint8Array(10)),
): string {
  return encodeTime(nowMs) + encodeRandomness(rand);
}

/** Decode a ULID into its timestamp + 10 randomness bytes. */
export function decodeUlid(ulid: string): { tsMs: number; randomness: Uint8Array } {
  if (typeof ulid !== "string" || ulid.length !== 26) {
    throw new Error("ULID must be 26 characters");
  }
  for (const ch of ulid) {
    if (REVERSE[ch] === undefined) {
      throw new Error(`Invalid ULID character: ${ch}`);
    }
  }
  return {
    tsMs: decodeTime(ulid.slice(0, 10)),
    randomness: decodeRandomness(ulid.slice(10)),
  };
}
