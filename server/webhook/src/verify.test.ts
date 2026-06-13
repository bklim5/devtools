import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyLemonSqueezySignature } from "./verify.ts";

const SECRET = "test-webhook-secret";

function sign(body: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

describe("verifyLemonSqueezySignature", () => {
  const rawBody = JSON.stringify({ meta: { event_name: "order_created" }, data: { id: "42" } });

  it("accepts a body signed with the correct secret over the RAW string", () => {
    expect(verifyLemonSqueezySignature(rawBody, sign(rawBody), SECRET)).toBe(true);
  });

  it("rejects a tampered body (signature no longer matches)", () => {
    const sig = sign(rawBody);
    const tampered = rawBody.replace('"42"', '"99"');
    expect(verifyLemonSqueezySignature(tampered, sig, SECRET)).toBe(false);
  });

  it("rejects a signature made with the wrong secret", () => {
    expect(verifyLemonSqueezySignature(rawBody, sign(rawBody, "other"), SECRET)).toBe(false);
  });

  it("rejects a missing X-Signature header without throwing", () => {
    expect(verifyLemonSqueezySignature(rawBody, undefined, SECRET)).toBe(false);
  });

  it("rejects an empty X-Signature header without throwing", () => {
    expect(verifyLemonSqueezySignature(rawBody, "", SECRET)).toBe(false);
  });

  it("does not throw on a length-mismatched header (returns false)", () => {
    // A short header would make crypto.timingSafeEqual throw if not length-guarded.
    expect(() => verifyLemonSqueezySignature(rawBody, "abc", SECRET)).not.toThrow();
    expect(verifyLemonSqueezySignature(rawBody, "abc", SECRET)).toBe(false);
  });

  it("verifies over the raw string, NOT a re-serialized JSON (whitespace matters)", () => {
    // Two JSON encodings of the same object differ by whitespace; the signature
    // is over the exact bytes, so a re-serialized body must fail.
    const exact = '{"a":1, "b":2}';
    const reserialized = JSON.stringify(JSON.parse(exact)); // '{"a":1,"b":2}'
    expect(verifyLemonSqueezySignature(reserialized, sign(exact), SECRET)).toBe(false);
    expect(verifyLemonSqueezySignature(exact, sign(exact), SECRET)).toBe(true);
  });
});
