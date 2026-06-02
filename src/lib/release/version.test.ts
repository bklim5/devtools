import { describe, expect, it } from "vitest";
import {
  bumpSemver,
  setCargoVersion,
  setPackageJsonVersion,
  setTauriConfVersion,
} from "./version";

describe("bumpSemver", () => {
  it("bumps patch (0.2.1 -> 0.2.2)", () => {
    expect(bumpSemver("0.2.1", "patch")).toBe("0.2.2");
  });

  it("bumps minor and resets patch (0.2.1 -> 0.3.0)", () => {
    expect(bumpSemver("0.2.1", "minor")).toBe("0.3.0");
  });

  it("bumps major and resets minor + patch (0.2.1 -> 1.0.0)", () => {
    expect(bumpSemver("0.2.1", "major")).toBe("1.0.0");
  });

  it("carries minor correctly (1.9.9 minor -> 1.10.0)", () => {
    expect(bumpSemver("1.9.9", "minor")).toBe("1.10.0");
  });

  it("carries major correctly (1.9.9 major -> 2.0.0)", () => {
    expect(bumpSemver("1.9.9", "major")).toBe("2.0.0");
  });

  it("bumps patch without resetting (1.9.9 patch -> 1.9.10)", () => {
    expect(bumpSemver("1.9.9", "patch")).toBe("1.9.10");
  });

  describe("throws on malformed input", () => {
    it.each(["1.2", "1.2.3.4", "v1.2.3", "1.2.x", "", "1.2.3-rc.1", "1.2.3+build"])(
      "rejects %j",
      (bad) => {
        expect(() => bumpSemver(bad, "patch")).toThrow(/Invalid semver/);
      },
    );

    // WR-01: leading zeros are not valid semver and would be silently
    // normalized away (e.g. "01.2.3" -> "1.2.4"). Reject them loudly.
    it.each(["01.2.3", "1.02.3", "1.2.03", "00.0.0"])("rejects leading zero %j", (bad) => {
      expect(() => bumpSemver(bad, "patch")).toThrow(/Invalid semver/);
    });

    // WR-01: a component beyond Number.MAX_SAFE_INTEGER would round-trip
    // through Number() into a corrupt string (e.g. "1e+21.0.0"). Fail loud.
    it("rejects an out-of-safe-range component", () => {
      expect(() => bumpSemver("999999999999999999999.0.0", "major")).toThrow(/Invalid semver/);
    });
  });

  it("throws on an unknown bump level", () => {
    expect(() => bumpSemver("1.2.3", "build" as never)).toThrow(/Unknown bump level/);
  });
});

describe("setPackageJsonVersion", () => {
  const fixture = [
    "{",
    '  "name": "devtools-app",',
    '  "private": true,',
    '  "version": "0.2.1",',
    '  "type": "module",',
    '  "dependencies": {',
    '    "js-md5": "0.8.3"',
    "  }",
    "}",
    "",
  ].join("\n");

  it("rewrites only the first top-level version value", () => {
    const out = setPackageJsonVersion(fixture, "0.3.0");
    expect(out).toBe(fixture.replace('"version": "0.2.1"', '"version": "0.3.0"'));
    expect(out).toContain('"version": "0.3.0"');
  });

  it("leaves a non-version line byte-identical", () => {
    const out = setPackageJsonVersion(fixture, "9.9.9");
    expect(out).toContain('  "name": "devtools-app",');
    // The js-md5 dependency pin must be untouched.
    expect(out).toContain('"js-md5": "0.8.3"');
  });

  it("throws when there is no version key", () => {
    expect(() => setPackageJsonVersion('{\n  "name": "x"\n}\n', "1.0.0")).toThrow(
      /package\.json/,
    );
  });
});

describe("setTauriConfVersion", () => {
  const fixture = [
    "{",
    '  "$schema": "https://schema.tauri.app/config/2",',
    '  "productName": "DevTools",',
    '  "version": "0.2.1",',
    '  "identifier": "com.devtools.app"',
    "}",
    "",
  ].join("\n");

  it("rewrites only the first top-level version value", () => {
    const out = setTauriConfVersion(fixture, "1.2.3");
    expect(out).toBe(fixture.replace('"version": "0.2.1"', '"version": "1.2.3"'));
  });

  it("leaves the productName line byte-identical", () => {
    const out = setTauriConfVersion(fixture, "1.2.3");
    expect(out).toContain('  "productName": "DevTools",');
  });

  it("throws when there is no version key", () => {
    expect(() => setTauriConfVersion('{\n  "productName": "x"\n}\n', "1.0.0")).toThrow(
      /tauri\.conf\.json/,
    );
  });
});

describe("setCargoVersion", () => {
  // Realistic fixture: a [package] version line AND dependency `version = "..."`
  // pins in OTHER sections that MUST stay byte-identical (success criterion #1).
  const fixture = [
    "[package]",
    'name = "devtools-app"',
    'version = "0.1.0"',
    'edition = "2021"',
    "",
    "[build-dependencies]",
    'tauri-build = { version = "2", features = [] }',
    "",
    "[dependencies]",
    'serde_json = "1"',
    'tauri-plugin-store = "2.4.3"',
    "",
  ].join("\n");

  it("rewrites the [package] version to the new value", () => {
    const out = setCargoVersion(fixture, "0.2.1");
    expect(out).toContain('version = "0.2.1"');
    expect(out).not.toContain('version = "0.1.0"');
  });

  it("leaves dependency version pins byte-identical (the load-bearing proof)", () => {
    const out = setCargoVersion(fixture, "0.2.1");
    // [package] version updated...
    expect(out).toContain('[package]\nname = "devtools-app"\nversion = "0.2.1"');
    // ...but every dependency pin is untouched.
    expect(out).toContain('tauri-build = { version = "2", features = [] }');
    expect(out).toContain('serde_json = "1"');
    expect(out).toContain('tauri-plugin-store = "2.4.3"');
  });

  it("changes ONLY the [package] version line (rest byte-identical)", () => {
    const out = setCargoVersion(fixture, "0.2.1");
    expect(out).toBe(
      fixture.replace('version = "0.1.0"', 'version = "0.2.1"'),
    );
  });

  it("throws when the [package] section has no version line", () => {
    const noVersion = [
      "[package]",
      'name = "devtools-app"',
      "",
      "[dependencies]",
      'serde_json = "1"',
      "",
    ].join("\n");
    expect(() => setCargoVersion(noVersion, "0.2.1")).toThrow(/Cargo\.toml/);
  });

  it("throws when there is no [package] section at all", () => {
    const noPackage = '[dependencies]\nserde_json = "1"\n';
    expect(() => setCargoVersion(noPackage, "0.2.1")).toThrow(/\[package\]/);
  });
});
