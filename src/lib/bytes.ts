// Conversions between Uint8Array and base64 / base64url / hex.
//
// Prefers the modern Uint8Array.prototype.toBase64 / Uint8Array.fromBase64
// (and toHex/fromHex) when the webview provides them, with btoa/atob fallbacks.
// Webview support varies (WKWebView tracks macOS Safari; WebView2 tracks Edge),
// so we always feature-detect rather than assume.

export type Base64Alphabet = "base64" | "base64url";

// Minimal structural types for the proposal APIs we feature-detect.
type ToBase64 = (opts?: { alphabet?: Base64Alphabet; omitPadding?: boolean }) => string;
type FromBase64 = (s: string, opts?: { alphabet?: Base64Alphabet }) => Uint8Array;

export function bytesToBase64(bytes: Uint8Array, alphabet: Base64Alphabet = "base64"): string {
  const native = (bytes as unknown as { toBase64?: ToBase64 }).toBase64;
  if (typeof native === "function") {
    // The native API keeps "=" padding unless omitPadding is set. base64url is
    // conventionally unpadded, so we must ask for it explicitly — otherwise the
    // real webview (which has native toBase64) keeps padding while the btoa
    // fallback below strips it, an observable native/fallback split.
    return native.call(bytes, { alphabet, omitPadding: alphabet === "base64url" });
  }
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = btoa(bin);
  return alphabet === "base64url"
    ? b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
    : b64;
}

export function base64ToBytes(input: string, alphabet: Base64Alphabet = "base64"): Uint8Array {
  const native = (Uint8Array as unknown as { fromBase64?: FromBase64 }).fromBase64;
  if (typeof native === "function") {
    return native(input.trim(), { alphabet });
  }
  let s = input.trim();
  if (alphabet === "base64url") {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4 !== 0) s += "=";
  }
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToHex(
  bytes: Uint8Array,
  opts: { upper?: boolean; sep?: string } = {},
): string {
  const { upper = false, sep = "" } = opts;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    const h = bytes[i].toString(16).padStart(2, "0");
    parts.push(upper ? h.toUpperCase() : h);
  }
  return parts.join(sep);
}

export function hexToBytes(input: string): Uint8Array {
  const clean = input.trim().replace(/^0x/i, "").replace(/[\s:_-]/g, "");
  if (clean.length % 2 !== 0) {
    throw new Error("Hex must have an even number of digits");
  }
  if (clean.length > 0 && !/^[0-9a-fA-F]+$/.test(clean)) {
    throw new Error("Invalid hex characters");
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

// Parse a comma/space-separated decimal byte array (e.g. "10, 3, 80, 81, 82")
// into a Uint8Array. The pre-decode parse layer for the Protobuf decoder's
// decimal input mode (Phase 12, PRO-08/PRO-09). Mirrors hexToBytes: trim,
// validate, throw a plain Error (named token) on bad input — decodeInput's
// try/catch turns that into result.error, never a crash (T-12-01).
//
// STRICT surface (D-04/05/06): separators are ONLY commas and spaces. No bracket
// stripping; newlines and other whitespace are NOT separators (a token holding
// one is unparseable → error). A comma-delimited segment that is empty after
// trimming — i.e. a leading/trailing/doubled comma — is an error, NOT dropped
// (D-05). Each token is a base-10 integer in 0–255 (D-06). Per-token validation
// uses a bounded, anchored /^\d+$/ — no global backtracking pattern over the
// whole input (T-12-02 ReDoS); the split work is linear in input length.
//
// We split on commas FIRST (each comma-segment must be non-empty → catches
// doubled/trailing commas), then on spaces WITHIN each segment (so the comma-less
// "10 3 80" shape still parses, while ", " stays one valid separator).
export function decimalToBytes(input: string): Uint8Array {
  const out: number[] = [];
  for (const segment of input.trim().split(",")) {
    const trimmed = segment.trim();
    if (trimmed === "") {
      throw new Error("Decimal byte list has an empty token");
    }
    for (const tok of trimmed.split(" ")) {
      if (tok === "") continue; // collapse runs of spaces WITHIN a segment
      if (!/^\d+$/.test(tok)) {
        throw new Error(`Decimal byte '${tok}' is not an integer`);
      }
      const n = Number(tok);
      if (n > 255) {
        throw new Error(`Decimal byte ${n} is out of range (0–255)`);
      }
      out.push(n);
    }
  }
  return Uint8Array.from(out);
}

export function utf8ToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

export function bytesToUtf8(bytes: Uint8Array, fatal = false): string {
  return new TextDecoder("utf-8", { fatal }).decode(bytes);
}
