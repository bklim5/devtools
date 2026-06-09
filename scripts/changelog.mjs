// release:changelog driver — the EDIT-ONLY half of the CHANGELOG workflow.
//
// A thin I/O shell over the pure `appendUnreleasedEntry` core (src/lib/release/
// changelog.ts): it reads CHANGELOG.md, appends `- <entry>` to the `## [Unreleased]`
// section, and writes the file back. It NEVER touches git, runs no subprocess, and
// commits nothing — the maintainer logs changes as they work, and the `pnpm
// release:bump` command is the single moment that "cuts" the version (promoting
// Unreleased into a dated section that rides the bump commit + the tag message).
//
// Two modes:
//   * a non-empty `<entry>` arg -> append it (creating a minimal CHANGELOG.md first
//     if the file is missing), then print a one-line confirmation;
//   * no/empty arg (a QUERY, not an error) -> print a usage line + the CURRENT
//     Unreleased bullets and exit 0.
//
// Mirrors the other drivers' conventions: `node:fs` only, `log()`/`logErr()`
// helpers, a top-level `main().catch(...)` that surfaces a thrown empty-entry Error
// to stderr + a non-zero exit.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import process, { stdout, stderr } from "node:process";

import {
  appendUnreleasedEntry,
  isUnreleasedHeading,
} from "../src/lib/release/changelog.ts";

const CHANGELOG_PATH = "CHANGELOG.md";
const USAGE = 'Usage: pnpm release:changelog "<entry>"';

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
  "- _Nothing yet._",
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
  const entry = process.argv.slice(2).join(" ").trim();

  // No/empty arg: a QUERY, not an error. Print usage + the current Unreleased
  // bullets and exit 0.
  if (entry === "") {
    log(USAGE);
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
  // appendUnreleasedEntry throws on a whitespace-only quoted arg (the empty-arg
  // path above already handles a bare/missing arg); the top-level catch surfaces it.
  const after = appendUnreleasedEntry(before, entry);
  writeFileSync(CHANGELOG_PATH, after);
  log(`Logged to ${CHANGELOG_PATH} [Unreleased]: - ${entry.replace(/^-\s?/, "").trim()}`);
}

main().catch((err) => {
  logErr(`\nrelease:changelog failed: ${err?.message ?? err}`);
  process.exit(1);
});
