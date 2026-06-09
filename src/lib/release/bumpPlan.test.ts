import { describe, expect, it } from "vitest";
import {
  ALLOWED_PATHS,
  assertOnlyExpectedPaths,
  buildBumpPlan,
  isAffirmative,
  parseBumpArgs,
  renderDryRunPlan,
  renderRecovery,
} from "./bumpPlan";

const MANIFESTS = [
  "package.json",
  "src-tauri/tauri.conf.json",
  "src-tauri/Cargo.toml",
];

// Realistic manifest fixtures (their version lines all at 0.2.1) used to prove
// the SAME computed nextVersion lands in all three after applying the plan.
const PKG_JSON = [
  "{",
  '  "name": "devtools-app",',
  '  "version": "0.2.1",',
  '  "type": "module"',
  "}",
  "",
].join("\n");

const TAURI_CONF = [
  "{",
  '  "productName": "DevTools",',
  '  "version": "0.2.1",',
  '  "identifier": "com.devtools.app"',
  "}",
  "",
].join("\n");

const CARGO_TOML = [
  "[package]",
  'name = "devtools-app"',
  'version = "0.2.1"',
  'edition = "2021"',
  "",
  "[dependencies]",
  'serde_json = "1"',
  "",
].join("\n");

const FIXTURES: Record<string, string> = {
  "package.json": PKG_JSON,
  "src-tauri/tauri.conf.json": TAURI_CONF,
  "src-tauri/Cargo.toml": CARGO_TOML,
};

describe("parseBumpArgs", () => {
  it("accepts a bare level (patch -> { level: patch, dryRun: false })", () => {
    expect(parseBumpArgs(["patch"])).toEqual({ level: "patch", dryRun: false });
  });

  it("accepts level + --dry-run", () => {
    expect(parseBumpArgs(["minor", "--dry-run"])).toEqual({
      level: "minor",
      dryRun: true,
    });
  });

  it("is order-independent for the flag (--dry-run before level)", () => {
    expect(parseBumpArgs(["--dry-run", "major"])).toEqual({
      level: "major",
      dryRun: true,
    });
  });

  it("throws when no level is given (usage error)", () => {
    expect(() => parseBumpArgs([])).toThrow(/level/);
    expect(() => parseBumpArgs(["--dry-run"])).toThrow(/level/);
  });

  it("rejects an explicit-version argument (D-01)", () => {
    expect(() => parseBumpArgs(["0.3.0"])).toThrow(/0\.3\.0/);
  });

  it("rejects --no-push (D-02 — no escape hatches)", () => {
    expect(() => parseBumpArgs(["patch", "--no-push"])).toThrow(/--no-push/);
  });

  it("rejects --skip-checks (D-02 — no escape hatches)", () => {
    expect(() => parseBumpArgs(["patch", "--skip-checks"])).toThrow(
      /--skip-checks/,
    );
  });

  it("rejects an unknown level", () => {
    expect(() => parseBumpArgs(["foo"])).toThrow(/foo/);
  });

  it("rejects a second level (duplicate)", () => {
    expect(() => parseBumpArgs(["patch", "minor"])).toThrow();
  });

  it("usage message names the accepted grammar", () => {
    expect(() => parseBumpArgs(["foo"])).toThrow(/patch\|minor\|major/);
  });
});

describe("buildBumpPlan", () => {
  it.each([
    ["patch", "0.2.2"],
    ["minor", "0.3.0"],
    ["major", "1.0.0"],
  ] as const)("computes the next %s version from 0.2.1 -> %s", (level, expected) => {
    expect(buildBumpPlan("0.2.1", level).nextVersion).toBe(expected);
  });

  it("carries the current version through unchanged", () => {
    expect(buildBumpPlan("0.2.1", "patch").currentVersion).toBe("0.2.1");
  });

  it("derives the tag as v + nextVersion", () => {
    expect(buildBumpPlan("0.2.1", "patch").tag).toBe("v0.2.2");
  });

  it("derives the commit message chore(release): vX.Y.Z (D-03)", () => {
    expect(buildBumpPlan("0.2.1", "patch").commitMessage).toBe(
      "chore(release): v0.2.2",
    );
  });

  it("sets the push target to origin", () => {
    expect(buildBumpPlan("0.2.1", "patch").pushTarget).toBe("origin");
  });

  it("has exactly the 3 manifests in canonical order", () => {
    const plan = buildBumpPlan("0.2.1", "patch");
    expect(plan.manifests.map((m) => m.path)).toEqual([
      "package.json",
      "src-tauri/tauri.conf.json",
      "src-tauri/Cargo.toml",
    ]);
  });

  // LOAD-BEARING (REL-01): the version is computed ONCE and threaded everywhere.
  // Applying each manifest.apply to its fixture must land the IDENTICAL
  // nextVersion, and tag + commitMessage must carry that same string.
  it("threads ONE computed version into all 3 manifests + tag + commit message", () => {
    const plan = buildBumpPlan("0.2.1", "minor");
    const next = plan.nextVersion; // "0.3.0"

    // Every applied manifest output must carry the IDENTICAL nextVersion string.
    for (const manifest of plan.manifests) {
      expect(manifest.apply(FIXTURES[manifest.path])).toContain(next);
    }

    // package.json + tauri.conf.json carry "version": "0.3.0"
    expect(plan.manifests[0].apply(PKG_JSON)).toContain('"version": "0.3.0"');
    expect(plan.manifests[1].apply(TAURI_CONF)).toContain('"version": "0.3.0"');
    // Cargo.toml carries version = "0.3.0" (and ONLY the [package] line)
    expect(plan.manifests[2].apply(CARGO_TOML)).toContain('version = "0.3.0"');

    // tag + commit message carry the SAME string
    expect(plan.tag).toBe(`v${next}`);
    expect(plan.commitMessage).toBe(`chore(release): v${next}`);
  });

  it("includes the annotated tag git command (D-04)", () => {
    const plan = buildBumpPlan("0.2.1", "patch");
    expect(plan.gitCommands).toContain('git tag -a v0.2.2 -m "v0.2.2"');
  });

  it("pushes the commit before the tag (RESEARCH §Q6 ordering)", () => {
    const plan = buildBumpPlan("0.2.1", "patch");
    const pushCommit = plan.gitCommands.indexOf("git push origin master");
    const pushTag = plan.gitCommands.indexOf("git push origin v0.2.2");
    expect(pushCommit).toBeGreaterThanOrEqual(0);
    expect(pushTag).toBeGreaterThanOrEqual(0);
    expect(pushCommit).toBeLessThan(pushTag);
  });

  it("propagates bumpSemver's throw on a malformed current version", () => {
    expect(() => buildBumpPlan("bad", "patch")).toThrow(/Invalid semver/);
  });
});

describe("ALLOWED_PATHS", () => {
  it("is exactly the 3 manifests + 2 lockfiles + the optional CHANGELOG.md", () => {
    expect([...ALLOWED_PATHS].sort()).toEqual(
      [
        "package.json",
        "src-tauri/tauri.conf.json",
        "src-tauri/Cargo.toml",
        "pnpm-lock.yaml",
        "src-tauri/Cargo.lock",
        "CHANGELOG.md",
      ].sort(),
    );
  });
});

describe("assertOnlyExpectedPaths", () => {
  it("accepts all 5 allowlisted paths", () => {
    expect(() =>
      assertOnlyExpectedPaths([
        ...MANIFESTS,
        "pnpm-lock.yaml",
        "src-tauri/Cargo.lock",
      ]),
    ).not.toThrow();
  });

  it("accepts the pnpm-lock no-op case (4 paths, only Cargo.lock changed)", () => {
    // RESEARCH §Q1/§P2: pnpm-lock does not record the root version, so a bump
    // leaves it byte-identical and it never appears in the changed set. Fewer
    // than 5 is valid as long as the 3 manifests are present.
    expect(() =>
      assertOnlyExpectedPaths([...MANIFESTS, "src-tauri/Cargo.lock"]),
    ).not.toThrow();
  });

  it("accepts the 3 manifests with neither lockfile changed", () => {
    expect(() => assertOnlyExpectedPaths([...MANIFESTS])).not.toThrow();
  });

  it("accepts the 3 manifests + a promoted CHANGELOG.md (CHANGELOG is allowed)", () => {
    expect(() =>
      assertOnlyExpectedPaths([...MANIFESTS, "CHANGELOG.md"]),
    ).not.toThrow();
  });

  it("accepts the 3 manifests with NO CHANGELOG.md (CHANGELOG is not required)", () => {
    // A changelog-less repo or a no-op promotion leaves CHANGELOG.md out of the
    // changed set; that must still pass (CHANGELOG is allowed, never required).
    expect(() => assertOnlyExpectedPaths([...MANIFESTS])).not.toThrow();
  });

  it("throws naming a stray path outside the allowlist", () => {
    expect(() =>
      assertOnlyExpectedPaths([...MANIFESTS, "src/App.tsx"]),
    ).toThrow(/src\/App\.tsx/);
    expect(() =>
      assertOnlyExpectedPaths([...MANIFESTS, "src/App.tsx"]),
    ).toThrow(/unexpected/i);
  });

  it("throws when a required manifest is missing (a bump must edit all 3)", () => {
    expect(() =>
      assertOnlyExpectedPaths(["package.json", "src-tauri/Cargo.toml"]),
    ).toThrow(/tauri\.conf\.json/);
  });

  it("throws on an empty changed set (nothing changed)", () => {
    expect(() => assertOnlyExpectedPaths([])).toThrow();
  });
});

describe("renderDryRunPlan", () => {
  it("contains the version, all 3 manifest paths, lockfile regen, git cmds, push target", () => {
    const plan = buildBumpPlan("0.2.1", "minor");
    const out = renderDryRunPlan(plan);
    expect(out).toContain("0.3.0");
    for (const path of MANIFESTS) expect(out).toContain(path);
    expect(out.toLowerCase()).toContain("lock");
    for (const cmd of plan.gitCommands) expect(out).toContain(cmd);
    expect(out).toContain("origin");
  });

  it("is a pure string builder — identical output across calls, no throw", () => {
    const plan = buildBumpPlan("0.2.1", "patch");
    expect(renderDryRunPlan(plan)).toBe(renderDryRunPlan(plan));
    expect(typeof renderDryRunPlan(plan)).toBe("string");
  });
});

describe("renderRecovery", () => {
  it("contains the literal retry-push and undo commands (D-09/D-10)", () => {
    const plan = buildBumpPlan("0.2.1", "patch"); // tag v0.2.2
    const out = renderRecovery(plan);
    expect(out).toContain(
      "git push origin master && git push origin v0.2.2",
    );
    expect(out).toContain("git tag -d v0.2.2");
    expect(out).toContain("git reset --hard HEAD~1");
    expect(out).toContain("git reset --soft HEAD~1");
  });

  it("is pure — identical output across calls", () => {
    const plan = buildBumpPlan("0.2.1", "patch");
    expect(renderRecovery(plan)).toBe(renderRecovery(plan));
  });
});

describe("isAffirmative", () => {
  it.each(["y", "yes", "Y", "YES", " y ", "Yes"])(
    "returns true for %j",
    (input) => {
      expect(isAffirmative(input)).toBe(true);
    },
  );

  it.each(["", "n", "no", "N", "maybe", "yep", "yeah", "ok"])(
    "returns false for %j",
    (input) => {
      expect(isAffirmative(input)).toBe(false);
    },
  );
});
