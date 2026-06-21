import { describe, expect, it } from "vitest";
import {
  assertSingleSig,
  assertVersionMatches,
  buildAssetUrl,
  buildPublishPlanView,
  extractServedVersion,
  hasAppleEnv,
  hasAppleIdNotaryEnv,
  hasNotaryApiKeyEnv,
  hasSigningEnv,
  notarizeDmgArgs,
  parseLipoArchs,
  parsePublishArgs,
  renderPublishPlan,
  renderPublishRecovery,
  shouldMaterializeSigningKey,
  someNotaryApiKeyEnv,
  universalMachoPath,
} from "./publishPlan";

describe("universalMachoPath", () => {
  it("derives bundle name from productName and inner binary from the cargo binary name", () => {
    expect(universalMachoPath("TinkerDev", "devtools-app")).toBe(
      "src-tauri/target/universal-apple-darwin/release/bundle/macos/TinkerDev.app/Contents/MacOS/devtools-app",
    );
  });

  it("a product rename moves ONLY the .app segment (rename-proof regression guard)", () => {
    expect(universalMachoPath("Renamed", "devtools-app")).toBe(
      "src-tauri/target/universal-apple-darwin/release/bundle/macos/Renamed.app/Contents/MacOS/devtools-app",
    );
  });
});

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
    const view = buildPublishPlanView("0.2.2", "TinkerDev");
    expect(view.version).toBe("0.2.2");
    expect(view.tag).toBe("v0.2.2");
    expect(view.releasesRepo).toBe("bklim5/devtools-releases");
    expect(view.universalBundleDir).toBe(
      "src-tauri/target/universal-apple-darwin/release/bundle/macos",
    );
    expect(view.sigGlob).toBe(
      "src-tauri/target/universal-apple-darwin/release/bundle/macos/TinkerDev.app.tar.gz.sig",
    );
    expect(view.assetUrlExample).toBe(
      "https://github.com/bklim5/devtools-releases/releases/download/v0.2.2/TinkerDev.app.tar.gz",
    );
  });
});

describe("renderPublishPlan", () => {
  it("contains the version, target repo, dual-key note, and assets-first/manifest-last intent", () => {
    const out = renderPublishPlan(buildPublishPlanView("0.2.2", "TinkerDev"));
    expect(out).toContain("0.2.2");
    expect(out).toContain("bklim5/devtools-releases");
    expect(out).toContain("darwin-aarch64");
    expect(out).toContain("darwin-x86_64");
    expect(out.toLowerCase()).toContain("assets first");
    expect(out.toLowerCase()).toContain("manifest last");
  });

  it("contains the universal bundle path", () => {
    const out = renderPublishPlan(buildPublishPlanView("0.2.2", "TinkerDev"));
    expect(out).toContain("target/universal-apple-darwin/release/bundle/macos");
  });

  it("explicitly notes that --dry-run does NOT build", () => {
    const out = renderPublishPlan(buildPublishPlanView("0.2.2", "TinkerDev")).toLowerCase();
    expect(out.includes("no build") || out.includes("does not build")).toBe(
      true,
    );
  });

  it("is a pure string builder — identical output across calls, no throw", () => {
    const view = buildPublishPlanView("0.2.2", "TinkerDev");
    expect(renderPublishPlan(view)).toBe(renderPublishPlan(view));
    expect(typeof renderPublishPlan(view)).toBe("string");
  });

  it("documents the DMG notarisation + staple step", () => {
    const out = renderPublishPlan(
      buildPublishPlanView("0.2.2", "TinkerDev"),
    ).toLowerCase();
    expect(out).toContain("notarytool");
    expect(out).toContain("staple");
  });
});

describe("shouldMaterializeSigningKey", () => {
  it("returns the path when only the PATH form is set (the doomed-build case)", () => {
    expect(
      shouldMaterializeSigningKey({
        TAURI_SIGNING_PRIVATE_KEY_PATH: "/home/me/.tauri/app.key",
        TAURI_SIGNING_PRIVATE_KEY_PASSWORD: "pw",
      }),
    ).toBe("/home/me/.tauri/app.key");
  });

  it("returns null when the content form is already set (no materialization needed)", () => {
    expect(
      shouldMaterializeSigningKey({
        TAURI_SIGNING_PRIVATE_KEY: "inline-content",
        TAURI_SIGNING_PRIVATE_KEY_PATH: "/home/me/.tauri/app.key",
      }),
    ).toBeNull();
  });

  it("returns null when neither form is set", () => {
    expect(shouldMaterializeSigningKey({})).toBeNull();
  });
});

describe("hasNotaryApiKeyEnv", () => {
  it("is true only when all three API-key vars are present", () => {
    expect(
      hasNotaryApiKeyEnv({
        APPLE_API_KEY_PATH: "/p/AuthKey.p8",
        APPLE_API_KEY: "ABC123",
        APPLE_API_ISSUER: "issuer-uuid",
      }),
    ).toBe(true);
  });

  it("is false when any one is missing (so preflight can fail fast, not the build)", () => {
    expect(
      hasNotaryApiKeyEnv({ APPLE_API_KEY: "ABC123", APPLE_API_ISSUER: "x" }),
    ).toBe(false);
  });

  it("is false for the Apple-ID auth set (not supported for the DMG step)", () => {
    expect(
      hasNotaryApiKeyEnv({
        APPLE_ID: "me@example.com",
        APPLE_PASSWORD: "app-specific",
        APPLE_TEAM_ID: "TEAM",
      }),
    ).toBe(false);
  });
});

describe("someNotaryApiKeyEnv", () => {
  it("is true when ANY API-key var is set (catches a partial/typo'd set)", () => {
    expect(someNotaryApiKeyEnv({ APPLE_API_KEY: "ABC123" })).toBe(true);
  });

  it("does NOT trip on a bare APPLE_SIGNING_IDENTITY (sign-only build stays valid)", () => {
    expect(
      someNotaryApiKeyEnv({
        APPLE_SIGNING_IDENTITY: "Developer ID Application: Me (TEAM)",
      }),
    ).toBe(false);
  });

  it("is false for an empty env", () => {
    expect(someNotaryApiKeyEnv({})).toBe(false);
  });

  it("pairs with hasNotaryApiKeyEnv to detect a partial set (some but not all)", () => {
    const partial = { APPLE_API_KEY: "ABC123", APPLE_API_ISSUER: "x" };
    expect(someNotaryApiKeyEnv(partial)).toBe(true);
    expect(hasNotaryApiKeyEnv(partial)).toBe(false);
  });
});

describe("hasAppleIdNotaryEnv", () => {
  it("is true only with the complete Apple-ID auth set", () => {
    expect(
      hasAppleIdNotaryEnv({
        APPLE_ID: "me@example.com",
        APPLE_PASSWORD: "app-specific",
        APPLE_TEAM_ID: "TEAM",
      }),
    ).toBe(true);
  });

  it("is false when any Apple-ID var is missing", () => {
    expect(
      hasAppleIdNotaryEnv({ APPLE_ID: "me@example.com", APPLE_TEAM_ID: "TEAM" }),
    ).toBe(false);
  });

  it("is false for a bare APPLE_SIGNING_IDENTITY (sign-only build)", () => {
    expect(
      hasAppleIdNotaryEnv({ APPLE_SIGNING_IDENTITY: "Developer ID..." }),
    ).toBe(false);
  });
});

describe("notarizeDmgArgs", () => {
  const apiEnv = {
    APPLE_API_KEY_PATH: "/home/me/.appstoreconnect/AuthKey_ABC.p8",
    APPLE_API_KEY: "ABC123",
    APPLE_API_ISSUER: "issuer-uuid",
  };

  it("builds the notarytool submit argv from the API-key env (path stays a file arg)", () => {
    expect(notarizeDmgArgs(apiEnv, "/out/App.dmg")).toEqual([
      "notarytool",
      "submit",
      "/out/App.dmg",
      "--key",
      "/home/me/.appstoreconnect/AuthKey_ABC.p8",
      "--key-id",
      "ABC123",
      "--issuer",
      "issuer-uuid",
      "--wait",
    ]);
  });

  it.each([
    ["APPLE_API_KEY_PATH", { ...apiEnv, APPLE_API_KEY_PATH: undefined }],
    ["APPLE_API_KEY", { ...apiEnv, APPLE_API_KEY: undefined }],
    ["APPLE_API_ISSUER", { ...apiEnv, APPLE_API_ISSUER: undefined }],
  ])("throws a clear error when %s is missing", (_missing, env) => {
    expect(() => notarizeDmgArgs(env, "/out/App.dmg")).toThrow(
      /App Store Connect API-key env/,
    );
  });
});

describe("renderPublishRecovery", () => {
  it("returns a copy-pasteable next-steps string", () => {
    const out = renderPublishRecovery(buildPublishPlanView("0.2.2", "TinkerDev"));
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
  });

  it("never auto-rolls-back the remote release (revert-by-republish ethos)", () => {
    const out = renderPublishRecovery(buildPublishPlanView("0.2.2", "TinkerDev"));
    expect(out).not.toContain("git reset --hard");
  });
});
