import { describe, expect, it } from "vitest";
import {
  buildLatestJson,
  platformKey,
  type BuildLatestJsonInput,
} from "./manifest";

const SAMPLE: BuildLatestJsonInput = {
  version: "0.2.1",
  pubDate: "2026-06-01T22:27:10Z",
  url: "https://github.com/bklim5/devtools-releases/releases/download/v0.2.1/devtools-app.app.tar.gz",
  signature: "SIG_FROM_FRESH_DOT_SIG",
};

describe("buildLatestJson", () => {
  it("returns the exact latest.json shape with BOTH arch keys (deep equal)", () => {
    const result = buildLatestJson(SAMPLE);
    expect(result).toEqual({
      version: "0.2.1",
      notes: "",
      pub_date: "2026-06-01T22:27:10Z",
      platforms: {
        "darwin-aarch64": { signature: SAMPLE.signature, url: SAMPLE.url },
        "darwin-x86_64": { signature: SAMPLE.signature, url: SAMPLE.url },
      },
    });
  });

  it("emits exactly the two real arch keys — no combined single-key variant", () => {
    const result = buildLatestJson(SAMPLE);
    expect(Object.keys(result.platforms)).toEqual([
      "darwin-aarch64",
      "darwin-x86_64",
    ]);
    expect(result.platforms).not.toHaveProperty("darwin-universal");
  });

  it("gives both arch entries the SAME url AND SAME signature (cannot diverge)", () => {
    const result = buildLatestJson(SAMPLE);
    expect(result.platforms["darwin-aarch64"]).toEqual(
      result.platforms["darwin-x86_64"],
    );
    expect(result.platforms["darwin-aarch64"].signature).toBe(SAMPLE.signature);
    expect(result.platforms["darwin-aarch64"].url).toBe(SAMPLE.url);
    expect(result.platforms["darwin-x86_64"].signature).toBe(SAMPLE.signature);
    expect(result.platforms["darwin-x86_64"].url).toBe(SAMPLE.url);
  });

  it("sources pub_date ONLY from the injected pubDate (snake_case key; no pubDate key)", () => {
    const result = buildLatestJson(SAMPLE);
    expect(result.pub_date).toBe(SAMPLE.pubDate);
    expect(result).not.toHaveProperty("pubDate");
  });

  it("defaults notes to \"\" when omitted", () => {
    const result = buildLatestJson(SAMPLE);
    expect(result.notes).toBe("");
  });

  it("passes provided notes through verbatim", () => {
    const result = buildLatestJson({ ...SAMPLE, notes: "Round-trip test build" });
    expect(result.notes).toBe("Round-trip test build");
  });

  it("is pure — identical input yields deep-equal output on repeated calls", () => {
    expect(buildLatestJson(SAMPLE)).toEqual(buildLatestJson(SAMPLE));
  });
});

describe("platformKey", () => {
  it("emits both arch keys from one {url,signature}, identical entries, no extra key", () => {
    const platforms = platformKey({ url: SAMPLE.url, signature: SAMPLE.signature });
    expect(Object.keys(platforms)).toEqual(["darwin-aarch64", "darwin-x86_64"]);
    expect(platforms["darwin-aarch64"]).toEqual(platforms["darwin-x86_64"]);
    expect(platforms).not.toHaveProperty("darwin-universal");
  });
});
