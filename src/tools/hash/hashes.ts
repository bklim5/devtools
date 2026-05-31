// Pure digest functions for the Hash tool (HASH-01, D-01/D-12/D-14).
//
// MD5 = js-md5 (sync, vendored offline — Web Crypto deliberately omits MD5; D-01).
// SHA-1/256/384/512 = native Web Crypto crypto.subtle.digest (async; D-14).
// NO hand-rolled crypto primitives (Don't-Hand-Roll / T-04-11) — correctness pinned
// to known digest vectors in hashes.test.ts. Output is lowercase-canonical hex; the
// casing toggle (D-13) is applied by the caller on display (.toUpperCase()), never here.
// Hex formatting reuses bytes.ts bytesToHex — we never re-implement hex.
import { md5 } from "js-md5";
import { bytesToHex } from "@/lib/bytes";

/** All five digests, shown stacked at once (D-12) — MD5 first, then the SHA family. */
export const ALGORITHMS = ["MD5", "SHA-1", "SHA-256", "SHA-384", "SHA-512"] as const;

/** The SHA variants delegated to Web Crypto (everything in ALGORITHMS except MD5). */
export type ShaAlgorithm = "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";

/** MD5 of the given bytes → lowercase hex (js-md5 already returns lowercase hex). */
export function md5Hex(bytes: Uint8Array): string {
  return md5(bytes);
}

/**
 * SHA-1/256/384/512 of the given bytes → lowercase hex via Web Crypto.
 * subtle.digest requires a secure context (the tauri:// webview) — verified loudly
 * by the real-WKWebView e2e gate (A1), not assumed from jsdom/Node.
 */
export async function shaHex(algo: ShaAlgorithm, bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest(algo, bytes as unknown as BufferSource);
  return bytesToHex(new Uint8Array(buf));
}

/** One labelled digest row, lowercase-canonical. */
export interface DigestRow {
  algo: (typeof ALGORITHMS)[number];
  hex: string;
}

/**
 * Compute every digest for `bytes` (MD5 sync + the four SHA in parallel), returned in
 * ALGORITHMS order. Lowercase-canonical; the UI applies the casing toggle on display.
 */
export async function digestAll(bytes: Uint8Array): Promise<DigestRow[]> {
  const md5Row: DigestRow = { algo: "MD5", hex: md5Hex(bytes) };
  const shaAlgos: ShaAlgorithm[] = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"];
  const shaHexes = await Promise.all(shaAlgos.map((a) => shaHex(a, bytes)));
  const shaRows: DigestRow[] = shaAlgos.map((algo, i) => ({ algo, hex: shaHexes[i] }));
  return [md5Row, ...shaRows];
}
