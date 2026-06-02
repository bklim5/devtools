import { describe, expect, it } from "vitest";
import {
  assertSingleSig,
  assertVersionMatches,
  buildAssetUrl,
  buildPublishPlanView,
  extractServedVersion,
  hasAppleEnv,
  hasSigningEnv,
  parseLipoArchs,
  parsePublishArgs,
  renderPublishPlan,
  renderPublishRecovery,
} from "./publishPlan";

describe("parsePublishArgs", () => {
  it("defaults dryRun to false for no args", () => {
    expect(parsePublishArgs([])).toEqual({ dryRun: false });
  });

  it("sets dryRun true for --dry-run", () => {
    expect(parsePublishArgs(["--dry-run"])).toEqual({ dryRun: true });
  });

  it("throws on an unknown token, naming the usage", () => {
    expect(() => parsePublishArgs(["bogus"])).toThrow(/\[--dry-run\]/);
    expect(() => parsePublishArgs(["bogus"])).toThrow(/bogus/);
  });

  it("rejects a bump level — this driver does NOT bump (Phase 10 owns bump)", () => {
    expect(() => parsePublishArgs(["patch"])).toThrow(/\[--dry-run\]/);
    expect(() => parsePublishArgs(["patch"])).toThrow(/patch/);
  });
});

describe("assertSingleSig", () => {
  it("returns the single path on exactly one match", () => {
    expect(assertSingleSig(["a.sig"])).toBe("a.sig");
  });

  it("throws on 0 matches, hinting the signing env", () => {
    expect(() => assertSingleSig([])).toThrow(/signing/i);
    expect(() => assertSingleSig([])).toThrow(/\b0\b|no\b/i);
  });

  it("throws on >1 matches, mentioning more-than-one and listing both", () => {
    expect(() => assertSingleSig(["a.sig", "b.sig"])).toThrow(
      /more than one|>1/i,
    );
    expect(() => assertSingleSig(["a.sig", "b.sig"])).toThrow(/a\.sig/);
    expect(() => assertSingleSig(["a.sig", "b.sig"])).toThrow(/b\.sig/);
  });
});

describe("parseLipoArchs", () => {
  it("is true when both x86_64 and arm64 are present", () => {
    expect(parseLipoArchs("x86_64 arm64")).toBe(true);
  });

  it("is order-independent", () => {
    expect(parseLipoArchs("arm64 x86_64")).toBe(true);
  });

  it("is false for arm64-only (Intel half missing)", () => {
    expect(parseLipoArchs("arm64")).toBe(false);
  });

  it("is false for x86_64-only (arm half missing)", () => {
    expect(parseLipoArchs("x86_64")).toBe(false);
  });

  it("is false for arm64e (strict arm64, not arm64e — RESEARCH §Q2)", () => {
    expect(parseLipoArchs("arm64e")).toBe(false);
    expect(parseLipoArchs("x86_64 arm64e")).toBe(false);
  });

  it("is false for an empty string", () => {
    expect(parseLipoArchs("")).toBe(false);
  });
});

describe("buildAssetUrl", () => {
  it("produces the full releases/download URL on the public releases repo", () => {
    expect(buildAssetUrl("0.2.2", "devtools-app.app.tar.gz")).toBe(
      "https://github.com/bklim5/devtools-releases/releases/download/v0.2.2/devtools-app.app.tar.gz",
    );
  });

  it("targets the public releases repo slug, never the private source", () => {
    const url = buildAssetUrl("0.2.2", "devtools-app.app.tar.gz");
    expect(url).toContain("bklim5/devtools-releases");
  });
});

describe("hasSigningEnv", () => {
  it("is true with the inline key + password", () => {
    expect(
      hasSigningEnv({
        TAURI_SIGNING_PRIVATE_KEY: "x",
        TAURI_SIGNING_PRIVATE_KEY_PASSWORD: "y",
      }),
    ).toBe(true);
  });

  it("is true with the key PATH variant + password", () => {
    expect(
      hasSigningEnv({
        TAURI_SIGNING_PRIVATE_KEY_PATH: "x",
        TAURI_SIGNING_PRIVATE_KEY_PASSWORD: "y",
      }),
    ).toBe(true);
  });

  it("is false with a key but no password", () => {
    expect(hasSigningEnv({ TAURI_SIGNING_PRIVATE_KEY: "x" })).toBe(false);
  });

  it("is false for an empty env", () => {
    expect(hasSigningEnv({})).toBe(false);
  });

  it("returns a boolean, never the secret string", () => {
    const result = hasSigningEnv({
      TAURI_SIGNING_PRIVATE_KEY: "super-secret",
      TAURI_SIGNING_PRIVATE_KEY_PASSWORD: "pw",
    });
    expect(typeof result).toBe("boolean");
    expect(result).not.toBe("super-secret");
  });
});

describe("hasAppleEnv", () => {
  it("is true when any Apple var is present", () => {
    expect(hasAppleEnv({ APPLE_API_KEY: "x" })).toBe(true);
    expect(hasAppleEnv({ APPLE_ID: "x" })).toBe(true);
  });

  it("is false for an empty env", () => {
    expect(hasAppleEnv({})).toBe(false);
  });

  it("returns a boolean only, never echoes the value", () => {
    const result = hasAppleEnv({ APPLE_PASSWORD: "hunter2" });
    expect(typeof result).toBe("boolean");
    expect(result).not.toBe("hunter2");
  });
});

describe("extractServedVersion", () => {
  it("reads the version field from a parsed latest.json", () => {
    expect(extractServedVersion({ version: "0.2.2", platforms: {} })).toBe(
      "0.2.2",
    );
  });

  it("throws when no version field is present", () => {
    expect(() => extractServedVersion({})).toThrow();
  });
});

describe("assertVersionMatches", () => {
  it("does not throw on a match", () => {
    expect(() => assertVersionMatches("0.2.2", "0.2.2")).not.toThrow();
  });

  it("throws on a mismatch, printing BOTH values", () => {
    expect(() => assertVersionMatches("0.2.1", "0.2.2")).toThrow(/0\.2\.1/);
    expect(() => assertVersionMatches("0.2.1", "0.2.2")).toThrow(/0\.2\.2/);
  });
});

describe("buildPublishPlanView", () => {
  it("derives every field from the single version", () => {
    const view = buildPublishPlanView("0.2.2");
    expect(view.version).toBe("0.2.2");
    expect(view.tag).toBe("v0.2.2");
    expect(view.releasesRepo).toBe("bklim5/devtools-releases");
    expect(view.universalBundleDir).toBe(
      "src-tauri/target/universal-apple-darwin/release/bundle/macos",
    );
    expect(view.sigGlob).toBe(
      "src-tauri/target/universal-apple-darwin/release/bundle/macos/*.app.tar.gz.sig",
    );
    expect(view.assetUrlExample).toBe(
      "https://github.com/bklim5/devtools-releases/releases/download/v0.2.2/devtools-app.app.tar.gz",
    );
  });
});

describe("renderPublishPlan", () => {
  it("contains the version, target repo, dual-key note, and assets-first/manifest-last intent", () => {
    const out = renderPublishPlan(buildPublishPlanView("0.2.2"));
    expect(out).toContain("0.2.2");
    expect(out).toContain("bklim5/devtools-releases");
    expect(out).toContain("darwin-aarch64");
    expect(out).toContain("darwin-x86_64");
    expect(out.toLowerCase()).toContain("assets first");
    expect(out.toLowerCase()).toContain("manifest last");
  });

  it("contains the universal bundle path", () => {
    const out = renderPublishPlan(buildPublishPlanView("0.2.2"));
    expect(out).toContain("target/universal-apple-darwin/release/bundle/macos");
  });

  it("explicitly notes that --dry-run does NOT build", () => {
    const out = renderPublishPlan(buildPublishPlanView("0.2.2")).toLowerCase();
    expect(out.includes("no build") || out.includes("does not build")).toBe(
      true,
    );
  });

  it("is a pure string builder — identical output across calls, no throw", () => {
    const view = buildPublishPlanView("0.2.2");
    expect(renderPublishPlan(view)).toBe(renderPublishPlan(view));
    expect(typeof renderPublishPlan(view)).toBe("string");
  });
});

describe("renderPublishRecovery", () => {
  it("returns a copy-pasteable next-steps string", () => {
    const out = renderPublishRecovery(buildPublishPlanView("0.2.2"));
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
  });

  it("never auto-rolls-back the remote release (revert-by-republish ethos)", () => {
    const out = renderPublishRecovery(buildPublishPlanView("0.2.2"));
    expect(out).not.toContain("git reset --hard");
  });
});
