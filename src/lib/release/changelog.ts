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
// - appendUnreleasedEntry (the `release:changelog` write half): appends `- <entry>`
//   to the END of the `## [Unreleased]` bullet list. ONE leading `- `/`-` on the
//   raw entry is stripped + the entry trimmed (never produces `- - X`); an empty
//   entry throws. The sole `- _Nothing yet._` placeholder is REPLACED by the first
//   real entry (not stacked above). If there is no `## [Unreleased]` section it is
//   CREATED above the newest `## [x.y.z]` version section (or at EOF if none).
// - promoteUnreleased (the bump's `## [Unreleased]` -> `## [<version>] - <date>`
//   cut): renames the Unreleased heading to the dated/versioned one AND inserts a
//   fresh empty `## [Unreleased]` (placeholder) above it, so the bump commit carries
//   the notes and the tag message extracts them. A NO-OP (returns the input
//   UNCHANGED) when there is no `## [Unreleased]` section. The `date` is INJECTED
//   (still pure — no clock); the driver reads the wall clock and passes it in.

/**
 * The empty-Unreleased placeholder bullet. ONE source of truth: `promoteUnreleased`
 * EMITS it into a fresh section, `appendUnreleasedEntry` DETECTS it to replace it on
 * the first real entry, and the `release:changelog` driver's bootstrap CHANGELOG uses
 * it. If emission and detection drifted, the placeholder-replace would silently break
 * (a real bullet would stack under a stale placeholder), so they share this constant.
 */
export const UNRELEASED_PLACEHOLDER = "- _Nothing yet._";

/** True if `line` (already `\r`-stripped) is ANY level-2 `## ` heading. */
function isAnyHeading(line: string): boolean {
  return line.trim().startsWith("## ");
}

/**
 * True if `line` (already `\r`-stripped) is the `## [Unreleased]` heading. The
 * literal "Unreleased" token is bracket-tolerant (`## [Unreleased]` or
 * `## Unreleased`) in the same spirit as `isVersionHeading`, but Unreleased is NOT
 * a version, so it is matched as a literal token — never routed through
 * `isVersionHeading`.
 */
export function isUnreleasedHeading(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith("## ")) return false;
  let rest = trimmed.slice(3).trim();
  if (rest.startsWith("[")) rest = rest.slice(1);
  if (rest.endsWith("]")) rest = rest.slice(0, -1);
  return rest.trim() === "Unreleased";
}

/**
 * True if `line` (already `\r`-stripped) is a `## [x.y.z]` version heading — ANY
 * level-2 heading whose text after `## ` starts with `[` then a digit. Used only
 * to find the newest (first) version section as an insertion point; the exact
 * version value is irrelevant here (unlike `isVersionHeading`).
 */
function isVersionSectionHeading(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith("## ")) return false;
  const rest = trimmed.slice(3).trim();
  return /^\[\d/.test(rest);
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

/** Strip a single leading `- `/`-` and trim; the canonical bullet text. */
function normalizeEntry(entry: string): string {
  return entry.replace(/^-\s?/, "").trim();
}

/**
 * Append `- <entry>` to the END of the `## [Unreleased]` bullet list, returning
 * the new changelog text. Pure — no fs, no clock, no deps.
 *
 * Rules (mirrors `extractChangelogSection`'s line-array / `\r`-strip approach):
 * - The entry is normalized: ONE leading `- `/`-` is stripped + trimmed, so a
 *   user-typed `- Added X` or `-Added X` both become exactly `- Added X` (never
 *   `- - Added X`). An empty/whitespace-only entry throws.
 * - When Unreleased holds ONLY the `- _Nothing yet._` placeholder, the first real
 *   entry REPLACES it (placeholder gone). Otherwise the entry lands after the last
 *   existing bullet, before the section's trailing blank line / next `## ` heading.
 * - No `## [Unreleased]` section -> one is CREATED (with the entry) above the
 *   newest (first) `## [x.y.z]` version section; with no version section either,
 *   it is appended at EOF.
 */
export function appendUnreleasedEntry(
  changelog: string,
  entry: string,
): string {
  const text = normalizeEntry(entry);
  if (text === "") throw new Error("changelog entry is empty");
  const bullet = `- ${text}`;

  // Detect CRLF so a reconstructed/created section matches the file's style.
  const eol = changelog.includes("\r\n") ? "\r\n" : "\n";
  const lines = changelog.split("\n").map((line) => line.replace(/\r$/, ""));

  // Find the Unreleased heading.
  let head = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (isUnreleasedHeading(lines[i])) {
      head = i;
      break;
    }
  }

  if (head === -1) {
    // No Unreleased section: build one and insert it above the newest version
    // section (or at EOF if there is none).
    const section = ["## [Unreleased]", "", bullet, ""];
    let insertAt = lines.length;
    for (let i = 0; i < lines.length; i += 1) {
      if (isVersionSectionHeading(lines[i])) {
        insertAt = i;
        break;
      }
    }
    if (insertAt === lines.length) {
      // EOF: ensure a blank line separates prior content from the new section.
      const out = [...lines];
      while (out.length > 0 && out[out.length - 1].trim() === "") out.pop();
      if (out.length > 0) out.push("");
      out.push(...section);
      return out.join(eol);
    }
    const out = [...lines.slice(0, insertAt), ...section, ...lines.slice(insertAt)];
    return out.join(eol);
  }

  // Find the end of the Unreleased section (next `## ` heading, or EOF).
  let end = lines.length;
  for (let i = head + 1; i < lines.length; i += 1) {
    if (isAnyHeading(lines[i])) {
      end = i;
      break;
    }
  }

  // Body = the lines between the heading and the section end. Locate the last
  // non-blank bullet line; if the only content is the placeholder, replace it.
  let lastContent = -1;
  let onlyPlaceholder = true;
  for (let i = head + 1; i < end; i += 1) {
    if (lines[i].trim() === "") continue;
    lastContent = i;
    if (lines[i].trim() !== UNRELEASED_PLACEHOLDER) onlyPlaceholder = false;
  }

  if (lastContent !== -1 && onlyPlaceholder) {
    // Replace the placeholder line in place.
    const out = [...lines];
    out[lastContent] = bullet;
    return out.join(eol);
  }

  if (lastContent === -1) {
    // Empty Unreleased body: drop the entry right after the heading's blank line.
    const insertAt = head + 1 < end && lines[head + 1].trim() === "" ? head + 2 : head + 1;
    const out = [...lines.slice(0, insertAt), bullet, ...lines.slice(insertAt)];
    return out.join(eol);
  }

  // Append after the last existing bullet.
  const out = [...lines.slice(0, lastContent + 1), bullet, ...lines.slice(lastContent + 1)];
  return out.join(eol);
}

/**
 * Promote `## [Unreleased]` to `## [<version>] - <date>` and insert a fresh empty
 * `## [Unreleased]` (with the `- _Nothing yet._` placeholder) above it, returning
 * the new changelog text. Pure — `date` is INJECTED (no clock), no fs, no deps.
 *
 * - Always a real diff when an Unreleased section exists (heading rename + fresh
 *   section), even when it held only the placeholder.
 * - NO-OP returning the input UNCHANGED when there is no `## [Unreleased]` section.
 * - Round-trips with `extractChangelogSection`: after promotion, the version's
 *   section body is what had been under Unreleased.
 */
export function promoteUnreleased(
  changelog: string,
  version: string,
  date: string,
): string {
  const eol = changelog.includes("\r\n") ? "\r\n" : "\n";
  const lines = changelog.split("\n").map((line) => line.replace(/\r$/, ""));

  let head = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (isUnreleasedHeading(lines[i])) {
      head = i;
      break;
    }
  }
  if (head === -1) return changelog; // no-op, unchanged

  const freshSection = ["## [Unreleased]", "", UNRELEASED_PLACEHOLDER, ""];
  const out = [
    ...lines.slice(0, head),
    ...freshSection,
    `## [${version}] - ${date}`,
    ...lines.slice(head + 1),
  ];
  return out.join(eol);
}
