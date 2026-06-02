// Pure, side-effect-free decision core for the bump-and-tag driver (REL-01,
// REL-10, REL-11; D-01..D-11). Everything in this module is testable without
// touching git / fs / the network: it parses the CLI grammar, builds the bump
// plan from a SINGLE computed version, diffs changed paths against the manifest
// allowlist, and renders the dry-run + recovery text as plain return-strings.
//
// PURITY CONTRACT (load-bearing — Plan 03's `.mjs` driver AND the tests both
// import this): no filesystem, no child-process, no reading of the raw argv
// global, and no console writes. The render* helpers RETURN strings; the caller
// prints them. The only side effects (file read/write, git, cargo, pnpm, push)
// live in the thin Plan 03 driver, never here.

import {
  bumpSemver,
  setCargoVersion,
  setPackageJsonVersion,
  setTauriConfVersion,
} from "./version";

export type BumpLevel = "patch" | "minor" | "major";

const LEVELS: readonly BumpLevel[] = ["patch", "minor", "major"];
const USAGE = "patch|minor|major [--dry-run]";

export interface BumpArgs {
  level: BumpLevel;
  dryRun: boolean;
}

/**
 * Parse the bump CLI grammar (D-01/D-02) from an argv slice (the caller slices
 * the process arguments and passes them in — this stays pure and never reads
 * the argv global itself).
 *
 * Accepts EXACTLY one level (`patch|minor|major`) plus the optional `--dry-run`
 * flag, order-independent. Rejects everything else — an explicit-version arg
 * (D-01), the rejected `--no-push`/`--skip-checks` escape hatches (D-02), a
 * second level, or any unknown token — by throwing an Error that names the
 * offending token and prints the accepted usage.
 */
export function parseBumpArgs(argv: string[]): BumpArgs {
  let level: BumpLevel | undefined;
  let dryRun = false;

  for (const token of argv) {
    if (token === "--dry-run") {
      dryRun = true;
      continue;
    }
    if ((LEVELS as readonly string[]).includes(token)) {
      if (level !== undefined) {
        throw new Error(
          `Duplicate bump level: ${JSON.stringify(token)} (already saw ${JSON.stringify(level)}). Usage: ${USAGE}`,
        );
      }
      level = token as BumpLevel;
      continue;
    }
    // Anything else — a version string, an unknown flag (incl. the rejected
    // --no-push / --skip-checks), or a typo'd level — is a usage error.
    throw new Error(`Unexpected argument: ${JSON.stringify(token)}. Usage: ${USAGE}`);
  }

  if (level === undefined) {
    throw new Error(`Missing bump level. Usage: ${USAGE}`);
  }

  return { level, dryRun };
}

/** One manifest edit: its repo-relative path + a content -> content transform. */
export interface ManifestEdit {
  path: string;
  /** Pure string->string editor (a Phase 9 setXVersion bound to nextVersion). */
  apply: (content: string) => string;
}

/** The complete, fully-derived plan for one bump — all fields from ONE version. */
export interface BumpPlan {
  currentVersion: string;
  nextVersion: string;
  tag: string;
  commitMessage: string;
  pushTarget: string;
  manifests: ManifestEdit[];
  /** Human-readable git commands, for the dry-run plan + recovery text. */
  gitCommands: string[];
}

/**
 * Build the bump plan from a SINGLE computed version (REL-01, load-bearing).
 *
 * `bumpSemver` is called EXACTLY ONCE; the resulting `nextVersion` const is the
 * sole source for: the three manifest edits (each `apply` closes over the SAME
 * string via the Phase 9 setXVersion editors), the `vX.Y.Z` tag, the
 * `chore(release): vX.Y.Z` commit message (D-03), and every git command. The
 * version is NEVER re-read or recomputed — the three manifests + tag can't drift.
 *
 * The manifest `apply` closures take file CONTENT and return new content; they
 * perform NO fs themselves (Plan 03's driver reads/writes the files), keeping
 * this function pure and unit-testable against string fixtures.
 *
 * @throws if `currentVersion` is malformed — `bumpSemver`'s throw propagates
 *         (fail loud; never try/catch-swallowed).
 */
export function buildBumpPlan(
  currentVersion: string,
  level: BumpLevel,
): BumpPlan {
  // The ONE computation. Everything below derives from this single string.
  const nextVersion = bumpSemver(currentVersion, level);
  const tag = `v${nextVersion}`;
  const commitMessage = `chore(release): ${tag}`;
  const pushTarget = "origin";

  const manifests: ManifestEdit[] = [
    {
      path: "package.json",
      apply: (content) => setPackageJsonVersion(content, nextVersion),
    },
    {
      path: "src-tauri/tauri.conf.json",
      apply: (content) => setTauriConfVersion(content, nextVersion),
    },
    {
      path: "src-tauri/Cargo.toml",
      apply: (content) => setCargoVersion(content, nextVersion),
    },
  ];

  // Stage manifests + lockfiles, commit, annotated tag, then push commit BEFORE
  // tag (Q6: a tag whose commit isn't yet on the remote is the failure to avoid).
  const stagePaths = [
    "package.json",
    "src-tauri/tauri.conf.json",
    "src-tauri/Cargo.toml",
    "src-tauri/Cargo.lock",
  ];
  const gitCommands = [
    `git add ${stagePaths.join(" ")}`,
    `git commit -m "${commitMessage}"`,
    `git tag -a ${tag} -m "${tag}"`,
    `git push ${pushTarget} master`,
    `git push ${pushTarget} ${tag}`,
  ];

  return {
    currentVersion,
    nextVersion,
    tag,
    commitMessage,
    pushTarget,
    manifests,
    gitCommands,
  };
}

/**
 * The confirm-default helper (D-05, RESEARCH §Q5): true ONLY for an explicit
 * `y`/`yes` (case-insensitive, trimmed). Empty input (bare Enter) and anything
 * else default to NO — the caller also returns false for the non-TTY case
 * before ever prompting, so a non-interactive run declines the push (D-10).
 */
export function isAffirmative(input: string): boolean {
  const normalized = input.trim().toLowerCase();
  return normalized === "y" || normalized === "yes";
}
