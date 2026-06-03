// TDD coverage for the pure URL helpers (Phase 13, URL-01..05). Every helper is
// error-as-value (D-14): a thrown URIError becomes { error } — never a throw to
// the caller. Empty input is a neutral { value: "" }, never an error (D-15).
import { describe, expect, it } from "vitest";
import {
  encodeComponent,
  decodeComponent,
  encodeFull,
  decodeFull,
  parseUrl,
} from "./url";

describe("encodeComponent", () => {
  it("escapes reserved chars including / ? : @ & = #", () => {
    // encodeURIComponent escapes the URL-structural chars too.
    expect(encodeComponent("hello world/?")).toEqual({ value: "hello%20world%2F%3F" });
    expect(encodeComponent("a@b&c=d#e:f")).toEqual({
      value: "a%40b%26c%3Dd%23e%3Af",
    });
  });

  it("returns a neutral empty value for empty input (D-15)", () => {
    expect(encodeComponent("")).toEqual({ value: "" });
  });
});

describe("decodeComponent", () => {
  it("decodes a percent-encoded component", () => {
    expect(decodeComponent("hello%20world")).toEqual({ value: "hello world" });
  });

  it("returns an ERROR value for a bad percent-sequence, never a throw (D-14)", () => {
    const result = decodeComponent("%zz");
    expect(result).toHaveProperty("error");
    expect("value" in result).toBe(false);
  });

  it("returns a neutral empty value for empty input (D-15)", () => {
    expect(decodeComponent("")).toEqual({ value: "" });
  });
});

describe("encodeFull", () => {
  it("keeps URL structure (:// and /) intact, escapes only the space", () => {
    expect(encodeFull("https://x.com/a b")).toEqual({ value: "https://x.com/a%20b" });
  });

  it("returns a neutral empty value for empty input (D-15)", () => {
    expect(encodeFull("")).toEqual({ value: "" });
  });

  it("returns an ERROR value for a lone surrogate, never a throw (D-14)", () => {
    // encodeURI throws URIError on a lone surrogate.
    const result = encodeFull("\uD800");
    expect(result).toHaveProperty("error");
    expect("value" in result).toBe(false);
  });
});

describe("decodeFull", () => {
  it("decodes a full URL, keeping :// and / intact", () => {
    expect(decodeFull("https://x.com/a%20b")).toEqual({ value: "https://x.com/a b" });
  });

  it("returns an ERROR value for a bad percent-sequence, never a throw (D-14)", () => {
    const result = decodeFull("%zz");
    expect(result).toHaveProperty("error");
    expect("value" in result).toBe(false);
  });

  it("returns a neutral empty value for empty input (D-15)", () => {
    expect(decodeFull("")).toEqual({ value: "" });
  });
});

describe("parseUrl", () => {
  // The CONTEXT verification anchor exercising every part (D-08, D-10/11/12).
  const ANCHOR =
    "https://user:pass@api.example.com:8080/v1/users?tag=a&tag=b&q=hello%20world&empty=#section";

  it("maps all 8 fields from an absolute URL", () => {
    const result = parseUrl(ANCHOR);
    if (!("url" in result)) throw new Error("expected a parsed url");
    const u = result.url;
    expect(u.scheme).toBe("https"); // trailing ":" trimmed for display (D-08)
    expect(u.host).toBe("api.example.com");
    expect(u.port).toBe("8080");
    expect(u.path).toBe("/v1/users");
    expect(u.query).toBe("?tag=a&tag=b&q=hello%20world&empty=");
    expect(u.fragment).toBe("#section");
    expect(u.origin).toBe("https://api.example.com:8080");
    expect(u.username).toBe("user");
    expect(u.password).toBe("pass");
  });

  it("yields one decoded queryRow per occurrence in URL order (D-10/11)", () => {
    const result = parseUrl(ANCHOR);
    if (!("url" in result)) throw new Error("expected a parsed url");
    expect(result.url.queryRows).toEqual([
      { key: "tag", value: "a" },
      { key: "tag", value: "b" },
      { key: "q", value: "hello world" }, // decoded by URLSearchParams (D-11)
      { key: "empty", value: "" }, // empty value preserved (D-12)
    ]);
    expect(result.url.queryRows).toHaveLength(4);
  });

  it("returns an ERROR value for a relative / scheme-less URL (D-13)", () => {
    const result = parseUrl("/foo?x=1");
    expect(result).toHaveProperty("error");
    expect("url" in result).toBe(false);
    expect("empty" in result).toBe(false);
  });

  it("returns a neutral empty result for empty input, distinct from error (D-15)", () => {
    expect(parseUrl("")).toEqual({ empty: true });
    expect(parseUrl("   ")).toEqual({ empty: true });
  });
});
