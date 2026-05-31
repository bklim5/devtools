// Pure JWT decode (D-07/D-08, JWT-01) — DISPLAY-ONLY (D-09): it splits a token on
// `.`, base64url-decodes the header + payload via the shared bytes.ts primitive
// (NO hand-rolled base64), JSON.parses each, and surfaces the signature segment
// RAW. It does NOT validate the signature and accepts NO key — the pasted token
// never leaves the device (T-04-08), and the function NEVER throws past its boundary
// (T-04-07): every base64url-decode and JSON.parse is wrapped, so adversarial input
// becomes a bounded, field-scoped error object, not a crash.
import { base64ToBytes, bytesToUtf8 } from "@/lib/bytes";

/** Which segment an error is scoped to (D-08 field-scoped errors). */
export type JwtErrorScope = "token" | "header" | "payload";

export type DecodedJwt =
  | { kind: "empty" }
  | { kind: "error"; scope: JwtErrorScope; message: string }
  | {
      kind: "ok";
      /** Parsed header JSON (unknown — the caller decides how to render it). */
      header: unknown;
      /** Parsed payload JSON. */
      payload: unknown;
      /** The third segment, shown RAW — never decoded (D-07). */
      signature: string;
      /** `alg` lifted from the header when it is a string (D-07). */
      alg?: string;
    };

/**
 * Decode a JWT into header / payload / raw signature + alg.
 *
 * - empty / whitespace-only input → `{ kind: "empty" }` (a neutral state, not an error)
 * - not exactly 3 dot-separated segments → token-scope error
 * - a header/payload segment that is not valid base64url → that segment's scope error
 * - a header/payload segment that does not JSON.parse → that segment's scope error
 *
 * The signature segment is returned verbatim (no decode). Never throws.
 */
export function decodeJwt(token: string): DecodedJwt {
  const trimmed = token.trim();
  if (trimmed === "") return { kind: "empty" };

  const parts = trimmed.split(".");
  if (parts.length !== 3) {
    return {
      kind: "error",
      scope: "token",
      message: `Expected 3 dot-separated segments, got ${parts.length}`,
    };
  }

  const header = decodeSegment(parts[0], "header");
  if ("error" in header) return header.error;

  const payload = decodeSegment(parts[1], "payload");
  if ("error" in payload) return payload.error;

  const alg =
    isRecord(header.value) && typeof header.value.alg === "string"
      ? header.value.alg
      : undefined;

  return {
    kind: "ok",
    header: header.value,
    payload: payload.value,
    signature: parts[2],
    alg,
  };
}

/** Base64url-decode + JSON.parse one segment, mapping any throw to a scoped error. */
function decodeSegment(
  segment: string,
  scope: Extract<JwtErrorScope, "header" | "payload">,
): { value: unknown } | { error: Extract<DecodedJwt, { kind: "error" }> } {
  let json: string;
  try {
    json = bytesToUtf8(base64ToBytes(segment, "base64url"));
  } catch {
    return {
      error: { kind: "error", scope, message: "Segment is not valid base64url" },
    };
  }
  try {
    return { value: JSON.parse(json) };
  } catch {
    return {
      error: { kind: "error", scope, message: "Segment is not valid JSON" },
    };
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
