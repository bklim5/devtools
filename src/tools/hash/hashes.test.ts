// hashes.ts (HASH-01, D-12/D-14) — correctness pinned to known-good digest vectors
// (T-04-11: never self-referential, never hand-rolled). MD5 via js-md5, SHA via Web
// Crypto crypto.subtle.digest (present in the Node test env — Node 22 has subtle).
// All output is lowercase-canonical hex; casing is the caller's concern (D-13).
import { describe, expect, it } from "vitest";
import { utf8ToBytes } from "@/lib/bytes";
import { ALGORITHMS, digestAll, md5Hex, shaHex } from "./hashes";

describe("md5Hex", () => {
  it("md5('') matches the canonical empty-string vector (lowercase)", () => {
    expect(md5Hex(utf8ToBytes(""))).toBe("d41d8cd98f00b204e9800998ecf8427e");
  });

  it("md5('abc') matches the canonical vector", () => {
    expect(md5Hex(utf8ToBytes("abc"))).toBe("900150983cd24fb0d6963f7d28e17f72");
  });
});

describe("shaHex", () => {
  it("SHA-1('abc') matches the canonical vector", async () => {
    expect(await shaHex("SHA-1", utf8ToBytes("abc"))).toBe(
      "a9993e364706816aba3e25717850c26c9cd0d89d",
    );
  });

  it("SHA-256('') matches the canonical empty-string vector", async () => {
    expect(await shaHex("SHA-256", utf8ToBytes(""))).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("SHA-256('abc') starts with the canonical prefix", async () => {
    expect(await shaHex("SHA-256", utf8ToBytes("abc"))).toMatch(/^ba7816bf8f01cfea/);
  });

  it("SHA-384('abc') starts with the canonical prefix", async () => {
    expect(await shaHex("SHA-384", utf8ToBytes("abc"))).toMatch(/^cb00753f45a35e8b/);
  });

  it("SHA-512('abc') starts with the canonical prefix", async () => {
    expect(await shaHex("SHA-512", utf8ToBytes("abc"))).toMatch(/^ddaf35a193617aba/);
  });

  it("output is lowercase hex by default", async () => {
    const hex = await shaHex("SHA-256", utf8ToBytes("ABC"));
    expect(hex).toBe(hex.toLowerCase());
  });
});

describe("digestAll", () => {
  it("returns all five digests in ALGORITHMS order", async () => {
    const rows = await digestAll(utf8ToBytes("abc"));
    expect(rows.map((r) => r.algo)).toEqual([...ALGORITHMS]);
    expect(rows[0]).toEqual({ algo: "MD5", hex: "900150983cd24fb0d6963f7d28e17f72" });
    expect(rows[2].hex).toMatch(/^ba7816bf8f01cfea/); // SHA-256
  });

  it("all rows are lowercase-canonical", async () => {
    const rows = await digestAll(utf8ToBytes("Hello, World!"));
    for (const r of rows) expect(r.hex).toBe(r.hex.toLowerCase());
  });
});
