// Shared thin I/O shell for resolving release notes from CHANGELOG.md.
// The PURE extraction lives in `src/lib/release/changelog.ts`; this module does
// the (release-time, once-per-run) side effects the pure core refuses to touch:
// the guarded file read and the fall-back-to-tag warning. It is imported by BOTH
// release drivers (`build-and-publish.mjs` and `bump-and-tag.mjs`) so the read +
// fallback logic lives in exactly ONE place — only the per-driver warning phrasing
// differs, and that is injected as a parameter.
//
// Safety: the returned notes string is a PLAIN value — callers pass it as a single
// `execFileSync` argv element (`gh release create --notes <notes>` / `git tag -a -m
// <notes>`), NEVER interpolated into a shell string.

import { existsSync, readFileSync } from "node:fs";

import { extractChangelogSection } from "../../src/lib/release/changelog.ts";

/**
 * Resolve the release notes for `version`: the matching `CHANGELOG.md` section's
 * body, or the bare `tag` when the file is missing OR the section is empty/absent.
 * A missing file never throws (guarded by `existsSync`). On fall-back, calls
 * `warn` with a non-fatal note ending in `action` (e.g. "shipping the tag as
 * notes") so the maintainer notices they shipped the bare tag.
 */
export function resolveReleaseNotes(version, tag, action, warn) {
  const notes = existsSync("CHANGELOG.md")
    ? extractChangelogSection(readFileSync("CHANGELOG.md", "utf8"), version)
    : "";
  if (!notes) {
    warn(`note: no CHANGELOG.md section for ${version} — ${action}.`);
    return tag;
  }
  return notes;
}
