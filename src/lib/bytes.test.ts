// Regression coverage for the native Uint8Array.prototype.toBase64 delegation.
// Node 22 has NO native toBase64, so the production code falls back to btoa (which
// already strips base64url padding). The REAL webview (WebKit) DOES have native
// toBase64, and that API keeps "=" padding unless omitPadding is set — so without
// these tests the native/fallback split is invisible to the suite. We stub the
// prototype to exercise the native branch the test runtime can't reach on its own.
import { afterEach, describe, expect, it, vi } from "vitest";
import { bytesToBase64 } from "./bytes";

type NativeToBase64 = (opts?: {
  alphabet?: string;
  omitPadding?: boolean;
}) => string;

afterEach(() => {
  delete (Uint8Array.prototype as { toBase64?: NativeToBase64 }).toBase64;
});

// Install a fake native toBase64 that mirrors the spec: padding is kept unless
// omitPadding is requested. Returns the spy so tests can assert the passed opts.
function stubNativeToBase64() {
  const spy = vi.fn(function (this: Uint8Array, opts) {
    return opts?.omitPadding ? "aGVsbG8" : "aGVsbG8=";
  });
  (Uint8Array.prototype as { toBase64?: NativeToBase64 }).toBase64 = spy;
  return spy;
}

const HELLO = new Uint8Array([104, 101, 108, 108, 111]);

describe("bytesToBase64 native delegation", () => {
  it("asks native toBase64 to omit padding for base64url", () => {
    const spy = stubNativeToBase64();
    const out = bytesToBase64(HELLO, "base64url");
    expect(spy).toHaveBeenCalledWith({ alphabet: "base64url", omitPadding: true });
    expect(out).toBe("aGVsbG8");
  });

  it("keeps native padding for standard base64", () => {
    const spy = stubNativeToBase64();
    const out = bytesToBase64(HELLO, "base64");
    expect(spy).toHaveBeenCalledWith({ alphabet: "base64", omitPadding: false });
    expect(out).toBe("aGVsbG8=");
  });
});

// Sanity: the btoa FALLBACK (the path Node actually runs) must also drop base64url
// padding — this is what the unit suite has been silently exercising all along.
describe("bytesToBase64 fallback (no native API)", () => {
  it("drops base64url padding via the btoa fallback", () => {
    expect(bytesToBase64(HELLO, "base64url")).toBe("aGVsbG8");
  });

  it("keeps standard base64 padding via the btoa fallback", () => {
    expect(bytesToBase64(HELLO, "base64")).toBe("aGVsbG8=");
  });
});
