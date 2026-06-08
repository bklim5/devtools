import { describe, expect, it } from "vitest";
import { extractChangelogSection } from "./changelog";

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
