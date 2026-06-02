// Pure release version core (REL-01 bump math, REL-02 Cargo reconcile; D-01,
// D-01a, D-02, D-02a). The hand-rolled semver bump plus three SURGICAL
// string->string manifest version editors — native string ops only, ZERO
// runtime AND dev dependencies (no `semver` / `toml` / `json5`; no JSON.parse
// round-trips). No React / DOM / platform / fs imports: plain text in, plain
// text out, so the existing vitest/tsc gate covers the only logic that can
// silently corrupt a release. Phase 10's bump-and-tag driver imports these to
// do the lockstep 3-file write.
//
// Design notes:
// - The editors rewrite ONLY the version line and preserve every other byte
//   (surrounding formatting, key order, indentation) so the eventual bump
//   commit diff is single lines and Cargo dependency `version = "..."` pins
//   stay untouched (D-01).
// - Every match anchors precisely and THROWS on 0 or >1 matches (D-01a, T-09-01)
//   so a malformed / unexpected manifest fails loudly instead of silently
//   editing the wrong line or no-op'ing.

// A strict `MAJOR.MINOR.PATCH` semver — no prerelease / build metadata (D-02a,
// YAGNI). Each component is `0` or a leading-zero-free digit run, so
// non-canonical forms like `01.2.3` are rejected instead of silently normalized
// (WR-01). Magnitude is still bounded separately via Number.isSafeInteger.
const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/**
 * Compute the next version from a single computed source of truth (D-02).
 * Standard rollover: `patch` bumps PATCH; `minor` bumps MINOR and resets PATCH;
 * `major` bumps MAJOR and resets MINOR + PATCH.
 *
 * @throws if `version` is not strict `MAJOR.MINOR.PATCH`, or `level` is unknown (D-02a, T-09-02).
 */
export function bumpSemver(
  version: string,
  level: "major" | "minor" | "patch",
): string {
  const match = SEMVER_RE.exec(version);
  if (!match) {
    throw new Error(`Invalid semver: ${JSON.stringify(version)} (expected MAJOR.MINOR.PATCH)`);
  }
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  // A component larger than 2^53-1 would round-trip through Number() into a
  // corrupt string (e.g. "1e+21.0.0"), defeating the fail-loud intent (WR-01).
  if (![major, minor, patch].every(Number.isSafeInteger)) {
    throw new Error(`Invalid semver: ${JSON.stringify(version)} (component out of safe integer range)`);
  }

  switch (level) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(`Unknown bump level: ${JSON.stringify(level)} (expected major | minor | patch)`);
  }
}

/**
 * Replace captured group #2 of the single match of `re` in `content` with
 * `newVersion`, asserting EXACTLY one match (D-01a). Pattern shape:
 * `(<prefix>)<old version>(<suffix>)` — prefix + suffix are preserved verbatim.
 *
 * @throws if the number of matches is not exactly 1, using `label` for a clear
 *         file-named message so a malformed manifest fails loudly (T-09-01).
 */
function replaceSingleVersion(
  content: string,
  re: RegExp,
  newVersion: string,
  label: string,
): string {
  // Count actual occurrences with a global clone. (A non-global `.match` would
  // return [fullMatch, group1, group2] — a length of 3 that has nothing to do
  // with how many lines matched.)
  const globalRe = new RegExp(re.source, `${re.flags.replace("g", "")}g`);
  const count = (content.match(globalRe) ?? []).length;
  if (count !== 1) {
    throw new Error(`${label}: expected exactly one version match, found ${count}`);
  }
  return content.replace(re, `$1${newVersion}$2`);
}

/**
 * Rewrite the FIRST top-level `"version"` value in a `package.json` body (D-01a).
 * Anchors to a top-level (any-indent) `"version": "..."` key; throws on 0 or >1.
 */
export function setPackageJsonVersion(content: string, newVersion: string): string {
  return replaceSingleVersion(
    content,
    /^(\s*"version"\s*:\s*")[^"]*(")/m,
    newVersion,
    "package.json",
  );
}

/**
 * Rewrite the FIRST top-level `"version"` value in a `tauri.conf.json` body
 * (D-01a). Same anchoring as `setPackageJsonVersion`; throws on 0 or >1.
 */
export function setTauriConfVersion(content: string, newVersion: string): string {
  return replaceSingleVersion(
    content,
    /^(\s*"version"\s*:\s*")[^"]*(")/m,
    newVersion,
    "tauri.conf.json",
  );
}

/**
 * Rewrite the `version` line under the `[package]` section of a `Cargo.toml`
 * body ONLY (D-01a) — NEVER a dependency-section `version = "..."` pin. Isolates
 * the `[package]` section (from its header up to the next `[` section header),
 * then replaces the single bare `version = "..."` line within it.
 *
 * Dependency pins (`serde_json = "1"`, `tauri-build = { version = "2", ... }`)
 * live in OTHER sections and are left byte-identical.
 *
 * @throws if the `[package]` section is missing, or it contains 0 or >1
 *         `version = "..."` lines (T-09-01).
 */
export function setCargoVersion(content: string, newVersion: string): string {
  // Match the whole [package] section: its header, then everything up to (but
  // not including) the next "[" section header (or end of file).
  const sectionRe = /^\[package\][^[]*/m;
  const sectionMatch = sectionRe.exec(content);
  if (!sectionMatch) {
    throw new Error("Cargo.toml: [package] section not found");
  }
  const section = sectionMatch[0];

  // Within the [package] section, the bare `version = "..."` line (not nested in
  // a `{ ... }` inline table — those are dependency pins in other sections).
  const versionRe = /^(version\s*=\s*")[^"]*(")/m;
  const updatedSection = replaceSingleVersion(
    section,
    versionRe,
    newVersion,
    "Cargo.toml [package]",
  );

  return (
    content.slice(0, sectionMatch.index) +
    updatedSection +
    content.slice(sectionMatch.index + section.length)
  );
}
