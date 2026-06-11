import { describe, expect, it } from "vitest";
import {
  appendUnreleasedEntry,
  changelogCommitMessage,
  extractChangelogSection,
  parseChangelogArgs,
  promoteUnreleased,
} from "./changelog";

// A representative multi-section Keep-a-Changelog file used across cases.
const CHANGELOG = [
  "# Changelog",
  "",
  "## [Unreleased]",
  "",
  "- Nothing yet.",
  "",
  "## [0.3.0] - 2026-06-08",
  "",
  "- Added the URL, Regex, and Cron tools.",
  "- Reorderable + pinnable sidebar.",
  "",
  "## [0.2.0] - 2026-06-01",
  "",
  "- First signed, self-updating macOS build.",
  "",
].join("\n");

const V030_BODY =
  "- Added the URL, Regex, and Cron tools.\n- Reorderable + pinnable sidebar.";

describe("extractChangelogSection", () => {
  it("returns the trimmed body of the matched version, stopping at the next ## heading", () => {
    expect(extractChangelogSection(CHANGELOG, "0.3.0")).toBe(V030_BODY);
  });

  it("matches a bracketed, unbracketed, and date-suffixed heading to the SAME body", () => {
    const bracketed = "## [0.3.0]\n\n- one\n- two\n";
    const unbracketed = "## 0.3.0\n\n- one\n- two\n";
    const dated = "## [0.3.0] - 2026-06-08\n\n- one\n- two\n";
    const expected = "- one\n- two";
    expect(extractChangelogSection(bracketed, "0.3.0")).toBe(expected);
    expect(extractChangelogSection(unbracketed, "0.3.0")).toBe(expected);
    expect(extractChangelogSection(dated, "0.3.0")).toBe(expected);
  });

  it("stops the body at the next ## heading (does not bleed into later sections)", () => {
    expect(extractChangelogSection(CHANGELOG, "0.3.0")).not.toContain(
      "First signed",
    );
  });

  it("returns the trailing body for the last section in the file (EOF boundary)", () => {
    expect(extractChangelogSection(CHANGELOG, "0.2.0")).toBe(
      "- First signed, self-updating macOS build.",
    );
  });

  it("returns \"\" for a version with no section", () => {
    expect(extractChangelogSection(CHANGELOG, "9.9.9")).toBe("");
  });

  it("returns \"\" for a present heading with an empty/whitespace-only body", () => {
    const empty = "## [0.3.0]\n\n   \n\n## [0.2.0]\n\n- prior\n";
    expect(extractChangelogSection(empty, "0.3.0")).toBe("");
  });

  it("does not match on a numeric prefix (0.3.0 != 0.3.10)", () => {
    const file = "## [0.3.10]\n\n- the ten release\n";
    expect(extractChangelogSection(file, "0.3.0")).toBe("");
  });

  it("does not match on a numeric prefix the other way (0.3.0 != 10.3.0)", () => {
    const file = "## [10.3.0]\n\n- the ten-major release\n";
    expect(extractChangelogSection(file, "0.3.0")).toBe("");
  });

  it("does not match a GLUED unbracketed suffix (0.3.0 != 0.3.0-rc.1)", () => {
    const file = "## 0.3.0-rc.1\n\n- the prerelease\n";
    expect(extractChangelogSection(file, "0.3.0")).toBe("");
  });

  it("matches an unbracketed date-suffixed heading (whitespace-separated)", () => {
    const file = "## 0.3.0 - 2026-06-08\n\n- body\n";
    expect(extractChangelogSection(file, "0.3.0")).toBe("- body");
  });

  it("tolerates CRLF line endings (still matches + extracts)", () => {
    const crlf = "## [0.3.0]\r\n\r\n- one\r\n- two\r\n\r\n## [0.2.0]\r\n";
    expect(extractChangelogSection(crlf, "0.3.0")).toBe("- one\n- two");
  });

  it("is pure — identical input yields the same output on repeated calls", () => {
    expect(extractChangelogSection(CHANGELOG, "0.3.0")).toBe(
      extractChangelogSection(CHANGELOG, "0.3.0"),
    );
  });
});

// Unreleased holds ONLY the placeholder (the freshly-cut state after a bump).
const PLACEHOLDER_ONLY = [
  "# Changelog",
  "",
  "## [Unreleased]",
  "",
  "- _Nothing yet._",
  "",
  "## [0.3.0] - 2026-06-08",
  "",
  "- A prior release.",
  "",
].join("\n");

// Unreleased already has a real bullet (the maintainer logged one entry).
const MULTI_BULLET = [
  "# Changelog",
  "",
  "## [Unreleased]",
  "",
  "- First logged change.",
  "",
  "## [0.3.0] - 2026-06-08",
  "",
  "- A prior release.",
  "",
].join("\n");

describe("appendUnreleasedEntry", () => {
  it("appends a trailing bullet after the last existing Unreleased bullet", () => {
    const out = appendUnreleasedEntry(MULTI_BULLET, "Added X");
    expect(extractChangelogSection(promoteUnreleased(out, "9.9.9", "2026-06-09"), "9.9.9")).toBe(
      "- First logged change.\n- Added X",
    );
  });

  it("normalizes a leading \"- \" so the file never gets \"- - Added X\"", () => {
    const out = appendUnreleasedEntry(MULTI_BULLET, "- Added X");
    expect(out).toContain("- Added X");
    expect(out).not.toContain("- - Added X");
  });

  it("normalizes a glued leading \"-Added X\" to \"- Added X\"", () => {
    const out = appendUnreleasedEntry(MULTI_BULLET, "-Added X");
    expect(out).toContain("- Added X");
    expect(out).not.toContain("- -Added X");
  });

  it("replaces the \"- _Nothing yet._\" placeholder on the first real entry", () => {
    const out = appendUnreleasedEntry(PLACEHOLDER_ONLY, "Added X");
    expect(out).not.toContain("_Nothing yet._");
    expect(out).toContain("- Added X");
  });

  it("two successive appends produce two bullets in call order", () => {
    const once = appendUnreleasedEntry(PLACEHOLDER_ONLY, "First");
    const twice = appendUnreleasedEntry(once, "Second");
    const promoted = promoteUnreleased(twice, "9.9.9", "2026-06-09");
    expect(extractChangelogSection(promoted, "9.9.9")).toBe("- First\n- Second");
  });

  it("does not bleed the entry into the following version section", () => {
    const out = appendUnreleasedEntry(MULTI_BULLET, "Added X");
    expect(extractChangelogSection(out, "0.3.0")).toBe("- A prior release.");
  });

  it("creates a new Unreleased section above the newest version section when absent", () => {
    const noUnreleased = [
      "# Changelog",
      "",
      "## [0.3.0] - 2026-06-08",
      "",
      "- A prior release.",
      "",
    ].join("\n");
    const out = appendUnreleasedEntry(noUnreleased, "Added X");
    expect(out.indexOf("## [Unreleased]")).toBeGreaterThanOrEqual(0);
    expect(out.indexOf("## [Unreleased]")).toBeLessThan(out.indexOf("## [0.3.0]"));
    const promoted = promoteUnreleased(out, "9.9.9", "2026-06-09");
    expect(extractChangelogSection(promoted, "9.9.9")).toBe("- Added X");
  });

  it("creates an Unreleased section at EOF when there is no version section", () => {
    const preambleOnly = "# Changelog\n\nSome intro text.\n";
    const out = appendUnreleasedEntry(preambleOnly, "Added X");
    expect(out).toContain("## [Unreleased]");
    expect(out).toContain("- Added X");
    const promoted = promoteUnreleased(out, "9.9.9", "2026-06-09");
    expect(extractChangelogSection(promoted, "9.9.9")).toBe("- Added X");
  });

  it("throws on an empty entry", () => {
    expect(() => appendUnreleasedEntry(MULTI_BULLET, "")).toThrow(/empty/);
  });

  it("throws on a whitespace-only entry", () => {
    expect(() => appendUnreleasedEntry(MULTI_BULLET, "   ")).toThrow(/empty/);
  });

  it("throws on a dash-only entry (normalizes to empty)", () => {
    expect(() => appendUnreleasedEntry(MULTI_BULLET, "- ")).toThrow(/empty/);
  });

  it("tolerates CRLF input (still parses + appends)", () => {
    const crlf = MULTI_BULLET.replace(/\n/g, "\r\n");
    const out = appendUnreleasedEntry(crlf, "Added X");
    expect(out).toContain("- Added X");
    // The appended bullet rides the file's CRLF style.
    expect(out).toContain("- First logged change.\r\n- Added X");
  });
});

describe("promoteUnreleased", () => {
  it("renames Unreleased to a dated, versioned heading", () => {
    const out = promoteUnreleased(MULTI_BULLET, "0.4.0", "2026-06-09");
    expect(out).toContain("## [0.4.0] - 2026-06-09");
  });

  it("inserts a fresh empty Unreleased section above the now-versioned one", () => {
    const out = promoteUnreleased(MULTI_BULLET, "0.4.0", "2026-06-09");
    expect(out).toContain("## [Unreleased]");
    expect(out).toContain("- _Nothing yet._");
    expect(out.indexOf("## [Unreleased]")).toBeLessThan(out.indexOf("## [0.4.0]"));
  });

  it("round-trips: the promoted section carries the former Unreleased body", () => {
    const out = promoteUnreleased(MULTI_BULLET, "0.4.0", "2026-06-09");
    expect(extractChangelogSection(out, "0.4.0")).toBe("- First logged change.");
  });

  it("still promotes when Unreleased held only the placeholder", () => {
    const out = promoteUnreleased(PLACEHOLDER_ONLY, "0.4.0", "2026-06-09");
    expect(out).not.toBe(PLACEHOLDER_ONLY);
    expect(out).toContain("## [0.4.0] - 2026-06-09");
    expect(extractChangelogSection(out, "0.4.0")).toBe("- _Nothing yet._");
  });

  it("is a NO-OP (returns input unchanged) when there is no Unreleased section", () => {
    const noUnreleased = "# Changelog\n\n## [0.3.0] - 2026-06-08\n\n- A prior release.\n";
    expect(promoteUnreleased(noUnreleased, "0.4.0", "2026-06-09")).toBe(noUnreleased);
  });

  it("tolerates CRLF input (still renames + inserts)", () => {
    const crlf = MULTI_BULLET.replace(/\n/g, "\r\n");
    const out = promoteUnreleased(crlf, "0.4.0", "2026-06-09");
    expect(out).toContain("## [0.4.0] - 2026-06-09");
    expect(extractChangelogSection(out, "0.4.0")).toBe("- First logged change.");
  });

  it("is pure — date is injected, identical output across calls", () => {
    expect(promoteUnreleased(MULTI_BULLET, "0.4.0", "2026-06-09")).toBe(
      promoteUnreleased(MULTI_BULLET, "0.4.0", "2026-06-09"),
    );
  });
});

describe("parseChangelogArgs", () => {
  it("parses an entry with a trailing --commit", () => {
    expect(parseChangelogArgs(["fix x", "--commit"])).toEqual({
      mode: "append",
      entry: "fix x",
      commit: true,
    });
  });

  it("parses an entry with a leading --commit (flag accepted at any position)", () => {
    expect(parseChangelogArgs(["--commit", "fix x"])).toEqual({
      mode: "append",
      entry: "fix x",
      commit: true,
    });
  });

  it("joins multiple unquoted tokens with single spaces, commit false", () => {
    expect(parseChangelogArgs(["fix", "x"])).toEqual({
      mode: "append",
      entry: "fix x",
      commit: false,
    });
  });

  it("returns query mode for an empty argv", () => {
    expect(parseChangelogArgs([])).toEqual({ mode: "query" });
  });

  it("returns query mode for whitespace-only tokens (matches the old trim-to-empty path)", () => {
    expect(parseChangelogArgs(["   "])).toEqual({ mode: "query" });
  });

  it("throws with usage when --commit has no entry (commit needs an entry)", () => {
    expect(() => parseChangelogArgs(["--commit"])).toThrow(/Usage:/);
  });

  it("throws with usage when --commit has only a whitespace entry", () => {
    expect(() => parseChangelogArgs(["--commit", "   "])).toThrow(/Usage:/);
  });

  it("throws on a typo'd flag instead of logging it as changelog text", () => {
    expect(() => parseChangelogArgs(["--comit", "fix x"])).toThrow(/Usage:/);
  });

  it("throws on any unknown --flag (e.g. --dry-run)", () => {
    expect(() => parseChangelogArgs(["fix x", "--dry-run"])).toThrow(/Usage:/);
  });

  it("allows an entry token CONTAINING -- (only ---leading tokens are flags)", () => {
    expect(parseChangelogArgs(["add --dry-run flag"])).toEqual({
      mode: "append",
      entry: "add --dry-run flag",
      commit: false,
    });
  });

  it("tolerates a duplicate --commit", () => {
    expect(parseChangelogArgs(["--commit", "--commit", "fix"])).toEqual({
      mode: "append",
      entry: "fix",
      commit: true,
    });
  });
});

describe("changelogCommitMessage", () => {
  it("prefixes a plain entry with docs(changelog):", () => {
    expect(changelogCommitMessage("Added X")).toBe("docs(changelog): Added X");
  });

  it("strips ONE leading \"- \" so the subject matches the bullet text", () => {
    expect(changelogCommitMessage("- Added X")).toBe("docs(changelog): Added X");
  });

  it("trims whitespace padding", () => {
    expect(changelogCommitMessage("  Added X  ")).toBe("docs(changelog): Added X");
  });

  it("throws on an empty entry", () => {
    expect(() => changelogCommitMessage("")).toThrow(/empty/);
  });

  it("throws on a whitespace-only entry", () => {
    expect(() => changelogCommitMessage("   ")).toThrow(/empty/);
  });
});
