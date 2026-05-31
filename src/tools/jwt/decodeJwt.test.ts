// decodeJwt (JWT-01, D-07/D-08/D-09): split→base64url-decode header+payload→JSON,
// signature shown raw, alg lifted from the header — with a field-scoped error taxonomy
// (token / header / payload) and NEVER a throw past the boundary (T-04-07). Fixtures
// are built by base64url-encoding known JSON via the same bytes.ts primitive the impl
// consumes (no hand-rolled base64 here either), so the round-trip is honest.
import { describe, expect, it } from "vitest";
import { bytesToBase64, utf8ToBytes } from "@/lib/bytes";
import { decodeJwt } from "./decodeJwt";

/** base64url-encode an arbitrary string segment. */
function seg(s: string): string {
  return bytesToBase64(utf8ToBytes(s), "base64url");
}

/** Build a 3-segment token from raw header/payload JSON strings + a raw signature. */
function token(headerJson: string, payloadJson: string, signature = "sig"): string {
  return `${seg(headerJson)}.${seg(payloadJson)}.${signature}`;
}

const HEADER = '{"alg":"HS256","typ":"JWT"}';
const PAYLOAD = '{"sub":"1234567890","name":"John Doe","iat":1516239022}';

describe("decodeJwt", () => {
  it("decodes a valid 3-segment token to parsed header + payload + raw signature + alg", () => {
    const result = decodeJwt(token(HEADER, PAYLOAD, "abc123sig"));
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.header).toEqual({ alg: "HS256", typ: "JWT" });
    expect(result.payload).toEqual({
      sub: "1234567890",
      name: "John Doe",
      iat: 1516239022,
    });
    // Signature is shown RAW — never decoded (D-07).
    expect(result.signature).toBe("abc123sig");
    expect(result.alg).toBe("HS256");
  });

  it("treats empty / whitespace-only input as a neutral empty state, NOT an error", () => {
    expect(decodeJwt("")).toEqual({ kind: "empty" });
    expect(decodeJwt("   ")).toEqual({ kind: "empty" });
  });

  it("reports a TOKEN-scope error when there are not exactly 3 segments", () => {
    const result = decodeJwt("a.b");
    expect(result.kind).toBe("error");
    if (result.kind !== "error") return;
    expect(result.scope).toBe("token");
    // The message names the segment count requirement.
    expect(result.message).toMatch(/3/);
  });

  it("reports a HEADER-scope error when the header segment is not valid base64url", () => {
    const t = `!!!notbase64url!!!.${seg(PAYLOAD)}.sig`;
    const result = decodeJwt(t);
    expect(result.kind).toBe("error");
    if (result.kind !== "error") return;
    expect(result.scope).toBe("header");
  });

  it("reports a PAYLOAD-scope error when the payload segment decodes to non-JSON", () => {
    const t = `${seg(HEADER)}.${seg("not json")}.sig`;
    const result = decodeJwt(t);
    expect(result.kind).toBe("error");
    if (result.kind !== "error") return;
    expect(result.scope).toBe("payload");
    expect(result.message).toMatch(/JSON/i);
  });

  it("never throws past the boundary on adversarial input (returns an error object)", () => {
    const adversarial = [
      "...",
      "a.b.c.d.e",
      "\0.\0.\0",
      "%%%.%%%.%%%",
      ".".repeat(1000),
    ];
    for (const input of adversarial) {
      expect(() => decodeJwt(input)).not.toThrow();
      const result = decodeJwt(input);
      expect(["empty", "error", "ok"]).toContain(result.kind);
    }
  });

  it("omits alg when the header has no string alg", () => {
    const result = decodeJwt(token('{"typ":"JWT"}', PAYLOAD));
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.alg).toBeUndefined();
  });
});
