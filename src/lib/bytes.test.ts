// Regression coverage for the native Uint8Array.prototype.toBase64 delegation.
// Node 22 has NO native toBase64, so the production code falls back to btoa (which
// already strips base64url padding). The REAL webview (WebKit) DOES have native
// toBase64, and that API keeps "=" padding unless omitPadding is set — so without
// these tests the native/fallback split is invisible to the suite. We stub the
// prototype to exercise the native branch the test runtime can't reach on its own.
import { afterEach, describe, expect, it, vi } from "vitest";
import { bytesToBase64, decimalToBytes } from "./bytes";

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

// decimalToBytes: the pre-decode parse layer for comma/space-separated decimal
// byte arrays (Phase 12, PRO-08/PRO-09; D-04 strict surface, D-05 no empty-token
// tolerance, D-06 0–255 integers, D-07 named-token errors). Pure node test, no DOM.
describe("decimalToBytes (D-04/05/06/07)", () => {
  it("parses the canonical comma+space list", () => {
    expect(decimalToBytes("10, 3, 80, 81, 82")).toEqual(
      new Uint8Array([10, 3, 80, 81, 82]),
    );
  });

  it("parses a space-only list (space IS a separator once routed to decimal, D-03)", () => {
    expect(decimalToBytes("10 3 80")).toEqual(new Uint8Array([10, 3, 80]));
  });

  it("parses a comma+space mix with irregular spacing", () => {
    expect(decimalToBytes("10,3, 80")).toEqual(new Uint8Array([10, 3, 80]));
  });

  it("parses the boundary tokens 0 and 255", () => {
    expect(decimalToBytes("0, 255")).toEqual(new Uint8Array([0, 255]));
  });

  it("throws naming an out-of-range token (>255)", () => {
    expect(() => decimalToBytes("1, 2, 999")).toThrow(/999/);
    expect(() => decimalToBytes("1, 2, 999")).toThrow(/out of range/i);
  });

  it("throws naming a negative token", () => {
    expect(() => decimalToBytes("-1")).toThrow(/-1/);
  });

  it("throws naming a non-integer token (3.5)", () => {
    expect(() => decimalToBytes("3.5")).toThrow(/3\.5/);
    expect(() => decimalToBytes("3.5")).toThrow(/integer/i);
  });

  it("throws on unparseable tokens (0x0a, abc)", () => {
    expect(() => decimalToBytes("0x0a")).toThrow(/0x0a/);
    expect(() => decimalToBytes("abc")).toThrow(/abc/);
  });

  it("throws on a trailing comma (empty token NOT dropped, D-05)", () => {
    expect(() => decimalToBytes("10, 3, 80,")).toThrow();
  });

  it("throws on a doubled comma (empty token NOT dropped, D-05)", () => {
    expect(() => decimalToBytes("10,,3")).toThrow();
  });

  it("throws on surrounding brackets (NO bracket stripping, D-04)", () => {
    expect(() => decimalToBytes("[10, 3]")).toThrow();
  });

  it("throws on a newline separator (newline is NOT a separator, D-04)", () => {
    expect(() => decimalToBytes("10\n3")).toThrow();
  });
});
