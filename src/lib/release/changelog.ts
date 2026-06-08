// Pure version-keyed CHANGELOG.md section reader (release-notes plumbing).
// Extracts the body of ONE version's Keep-a-Changelog section from raw changelog
// text — ZERO runtime AND dev dependencies; NO `fs`, NO clock, NO time/IO imports.
// Mirrors the `src/lib/release/manifest.ts` convention: pure string logic the
// `build-and-publish.mjs` / `bump-and-tag.mjs` drivers wire to real I/O (they
// read the file off disk and fall back to the bare tag when this returns "").
//
// Decisions:
// - PURE: the changelog text is INJECTED by the caller (the read happens in the
//   driver, not here), so the function is deterministic and unit-assertable with
//   zero fs mocks — exactly like buildLatestJson.
// - Heading-shape tolerance: a version's heading may be written `## [0.3.0] - 2026-06-08`,
//   `## [0.3.0]`, or `## 0.3.0`. We tolerate optional `[ ]` brackets, an optional
//   ` - <anything>` date/label suffix, and surrounding whitespace on the line.
// - Exact-version-only: matching is plain string comparison (no regex), so the
//   version's dots are inherently literal, and the version is anchored so nothing
//   version-like may follow it (only `]`, whitespace, a `-` suffix, or end-of-line).
//   So `0.3.0` matches `## [0.3.0]` but NEVER `## [0.3.10]` or `## [10.3.0]`.
// - Body rule: collect every line AFTER the matched heading up to (but excluding)
//   the next `## ` heading (any version) or EOF, then trim; an empty/whitespace-
//   only body — and a missing section — both return "".
// - CRLF tolerance: a trailing `\r` is stripped per line before matching/collecting
//   so Windows-authored changelogs (`\r\n`) still match and extract cleanly.

/** True if `line` (already `\r`-stripped) is ANY level-2 `## ` heading. */
function isAnyHeading(line: string): boolean {
  return line.trim().startsWith("## ");
}

/**
 * True if `line` is the level-2 heading for EXACTLY `version`. Tolerates optional
 * `[ ]` brackets, an optional ` - <date/label>` suffix, and surrounding
 * whitespace; rejects any version-like continuation (so `0.3.0` ≠ `0.3.10`).
 */
function isVersionHeading(line: string, version: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith("## ")) return false;
  // Everything after the "## " marker, with its own surrounding whitespace gone.
  let rest = trimmed.slice(3).trim();
  // Optional opening bracket.
  const bracketed = rest.startsWith("[");
  if (bracketed) rest = rest.slice(1);
  // The exact version must lead here — plain string match (no regex), so the dots
  // are inherently literal. A longer version (the "0.3.10" vs "0.3.0") fails this
  // prefix check outright; an equal prefix that continues (e.g. "0.3.0-rc.1") is
  // caught by the bracket-close / whitespace-separator checks below.
  if (!rest.startsWith(version)) return false;
  let after = rest.slice(version.length);
  // A bracketed heading must close the bracket immediately after the version.
  if (bracketed) {
    if (!after.startsWith("]")) return false;
    after = after.slice(1);
  }
  // Nothing follows the version (e.g. "## 0.3.0" / "## [0.3.0]") -> exact match.
  // (A bare unbracketed version may carry trailing whitespace; strip it first.)
  if (!bracketed) after = after.replace(/\s+$/, "");
  if (after.length === 0) return true;
  // Otherwise a date/label tail must be SEPARATED by whitespace (e.g. " - 2026-06-08").
  // Requiring that separator is what rejects a GLUED continuation — the "-rc.1" of
  // "## 0.3.0-rc.1" — as a DIFFERENT version, not a date suffix of 0.3.0.
  return /^\s/.test(after);
}

/**
 * Extract the trimmed body of `version`'s section from raw `changelog` text.
 * Returns the lines AFTER the matched heading up to the next `## ` heading or EOF,
 * trimmed. A missing section or an empty/whitespace-only body returns "".
 * Pure — same inputs always yield the same string.
 */
export function extractChangelogSection(
  changelog: string,
  version: string,
): string {
  const lines = changelog.split("\n").map((line) => line.replace(/\r$/, ""));

  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (isVersionHeading(lines[i], version)) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) return ""; // no section for this version

  const body: string[] = [];
  for (let i = start; i < lines.length; i += 1) {
    if (isAnyHeading(lines[i])) break; // next section starts here
    body.push(lines[i]);
  }

  return body.join("\n").trim();
}
