// Lemon Squeezy webhook signature verification (D-60).
//
// LS signs the RAW request body with HMAC-SHA256 under the store webhook secret
// and sends the hex digest in the `X-Signature` header. We MUST verify over the
// exact bytes received — never a re-serialized JSON (Pitfall 5 / T-20-10) — using
// a constant-time compare (T-20-09) so the check leaks no timing signal.

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * True iff `signatureHeader` is the valid HMAC-SHA256 (hex) of `rawBody` under
 * `secret`. Never throws: a missing/empty/length-mismatched header returns false.
 */
export function verifyLemonSqueezySignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const actualBuf = Buffer.from(signatureHeader, "utf8");

  // timingSafeEqual throws on differing lengths — guard first (still constant
  // time for equal-length inputs, which is the only case an attacker controls
  // once they know the digest length).
  if (expectedBuf.length !== actualBuf.length) return false;

  return timingSafeEqual(expectedBuf, actualBuf);
}
