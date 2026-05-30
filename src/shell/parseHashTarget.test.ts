// parseHashTarget extracts a `#/tools/<id>` deep-link id (D-14 data model). The
// resolved-navigation behavior itself is covered end-to-end in router.test.tsx.
import { describe, expect, it } from "vitest";
import { parseHashTarget } from "./parseHashTarget";

describe("parseHashTarget", () => {
  it("extracts the id from a tools deep-link", () => {
    expect(parseHashTarget("#/tools/base64")).toBe("base64");
  });

  it("returns undefined for the bare index hash", () => {
    expect(parseHashTarget("#/")).toBeUndefined();
    expect(parseHashTarget("")).toBeUndefined();
  });

  it("returns undefined for a non-tools hash", () => {
    expect(parseHashTarget("#/settings")).toBeUndefined();
  });

  it("stops at the next path/query segment", () => {
    expect(parseHashTarget("#/tools/base64/extra")).toBe("base64");
    expect(parseHashTarget("#/tools/base64?x=1")).toBe("base64");
  });

  it("decodes percent-encoded ids", () => {
    expect(parseHashTarget("#/tools/unix%2Dtime")).toBe("unix-time");
  });
});
