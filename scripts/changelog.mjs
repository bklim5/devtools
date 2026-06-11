// release:changelog driver — the EDIT half of the CHANGELOG workflow.
//
// A thin I/O shell over the pure cores in src/lib/release/changelog.ts
// (`parseChangelogArgs` grammar + `appendUnreleasedEntry` edit): it reads
// CHANGELOG.md, appends `- <entry>` to the `## [Unreleased]` section, and writes
// the file back. The DEFAULT mode never touches git and runs no subprocess — the
// maintainer logs changes as they work, and the `pnpm release:bump` command is the
// single moment that "cuts" the version (promoting Unreleased into a dated section
// that rides the bump commit + the tag message). The documented opt-in EXCEPTION is
// `--commit`: after the append, the script makes its OWN pathspec commit of
// CHANGELOG.md alone, so a following `release:bump` clean-tree preflight passes.
//
// Modes:
//   * a non-empty `<entry>` arg -> append it (creating a minimal CHANGELOG.md first
//     if the file is missing), then print a one-line confirmation;
//   * `<entry>` + `--commit` (flag at any position) -> append as above, then
//     `git commit -m "docs(changelog): <entry>" -- CHANGELOG.md`;
//   * no/empty arg (a QUERY, not an error) -> print a usage line + the CURRENT
//     Unreleased bullets and exit 0.
//
// Mirrors the other drivers' conventions: `node:fs` + argv-ARRAY `execFileSync`
// only, `log()`/`logErr()` helpers, a top-level `main().catch(...)` that surfaces a
// thrown Error to stderr + a non-zero exit.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import process, { stdout, stderr } from "node:process";

import {
  appendUnreleasedEntry,
  changelogCommitMessage,
  CHANGELOG_USAGE,
  isUnreleasedHeading,
  parseChangelogArgs,
  UNRELEASED_PLACEHOLDER,
} from "../src/lib/release/changelog.ts";

const CHANGELOG_PATH = "CHANGELOG.md";

// A minimal Keep-a-Changelog preamble, mirroring the real file's header shape, for
// the rare case the file does not exist yet when the first entry is logged.
const MINIMAL_CHANGELOG = [
  "# Changelog",
  "",
  "All notable changes to DevTools are documented here. The format follows",
  "[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims to",
  "adhere to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).",
  "",
  "## [Unreleased]",
  "",
  UNRELEASED_PLACEHOLDER,
  "",
].join("\n");

/** Print to stdout (the confirmation + usage/query surface). */
function log(message = "") {
  stdout.write(`${message}\n`);
}

/** Print to stderr (errors). */
function logErr(message = "") {
  stderr.write(`${message}\n`);
}

/**
 * Run a CLI with an argv ARRAY (mirrors bump-and-tag's `run`): `execFileSync`
 * (never `execSync` with a string) keeps the entry text off the shell, so there is
 * no quoting/injection surface even though it only lands in `git commit -m`.
 */
function run(file, args) {
  return execFileSync(file, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/**
 * Slice the `## [Unreleased]` block (heading through the line before the next
 * `## ` heading) out of raw changelog text, for the no-arg query display. Dumb
 * display-only logic — Unreleased is NOT a version, so it is NOT routed through
 * `extractChangelogSection`.
 */
function sliceUnreleasedBlock(text) {
  const lines = text.split("\n").map((line) => line.replace(/\r$/, ""));
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (isUnreleasedHeading(lines[i])) {
      start = i;
      break;
    }
  }
  if (start === -1) return "(no Unreleased section)";
  const block = [lines[start]];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i].trim().startsWith("## ")) break;
    block.push(lines[i]);
  }
  return block.join("\n").trimEnd();
}

async function main() {
  // Parse the grammar in the pure core; a bad token (unknown --flag, entry-less
  // --commit) throws with usage — mirror the bump driver's abort-on-parse idiom.
  let parsed;
  try {
    parsed = parseChangelogArgs(process.argv.slice(2));
  } catch (err) {
    logErr(err?.message ?? String(err));
    process.exit(1);
  }

  // No/empty arg: a QUERY, not an error. Print usage + the current Unreleased
  // bullets and exit 0.
  if (parsed.mode === "query") {
    log(CHANGELOG_USAGE);
    log("");
    if (existsSync(CHANGELOG_PATH)) {
      log(sliceUnreleasedBlock(readFileSync(CHANGELOG_PATH, "utf8")));
    } else {
      log("(no CHANGELOG.md yet)");
    }
    process.exit(0);
  }

  // Non-empty entry: create a minimal file if missing, then append.
  const before = existsSync(CHANGELOG_PATH)
    ? readFileSync(CHANGELOG_PATH, "utf8")
    : MINIMAL_CHANGELOG;
  const after = appendUnreleasedEntry(before, parsed.entry);
  writeFileSync(CHANGELOG_PATH, after);
  log(`Logged to ${CHANGELOG_PATH} [Unreleased]: - ${parsed.entry.replace(/^-\s?/, "").trim()}`);

  // Opt-in `--commit`: commit CHANGELOG.md ALONE. The `-- CHANGELOG.md` pathspec
  // is the load-bearing decision — it commits only CHANGELOG.md's working-tree
  // state even if the user had OTHER files already staged; those stay
  // staged/dirty untouched, and bump's own preflight still guards them.
  if (parsed.commit) {
    const message = changelogCommitMessage(parsed.entry);
    try {
      // `git add` first: a pathspec commit errors on an UNTRACKED path, which is
      // exactly the first-ever bootstrap case where CHANGELOG.md was just created.
      run("git", ["add", "--", CHANGELOG_PATH]);
      run("git", ["commit", "-m", message, "--", CHANGELOG_PATH]);
    } catch (err) {
      // Not a repo / identity unset / hook rejection: the edit is ALREADY safely
      // on disk — report, point at manual recovery, and exit non-zero. Never
      // retry, never reset.
      const detail = (err?.stderr ?? "").toString().trim() || (err?.message ?? String(err));
      logErr(`git commit failed: ${detail}`);
      logErr(`The ${CHANGELOG_PATH} edit is kept on disk — commit it manually when ready.`);
      process.exit(1);
    }
    log(`Committed: ${message}`);
  }
}

main().catch((err) => {
  logErr(`\nrelease:changelog failed: ${err?.message ?? err}`);
  process.exit(1);
});
