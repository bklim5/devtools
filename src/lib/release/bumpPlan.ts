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
 * The 6-path allowlist (RESEARCH §Q3): the only paths a bump may change — the
 * 3 manifests, the 2 lockfiles, plus the optional `CHANGELOG.md` the bump
 * promotes (`## [Unreleased]` -> `## [<version>] - <date>`). CHANGELOG.md is
 * ALLOWED but NOT required: a changelog-less repo (or a no-op promotion that
 * leaves the file byte-identical) must still pass `assertOnlyExpectedPaths`.
 * `assertOnlyExpectedPaths` diffs the actual changed set against this; Plan 03
 * also stages exactly these.
 */
export const ALLOWED_PATHS: readonly string[] = [
  "package.json",
  "src-tauri/tauri.conf.json",
  "src-tauri/Cargo.toml",
  "pnpm-lock.yaml",
  "src-tauri/Cargo.lock",
  "CHANGELOG.md",
];

// The 3 manifests a real bump ALWAYS edits (the lockfiles may be no-ops — Q1).
const REQUIRED_MANIFESTS: readonly string[] = [
  "package.json",
  "src-tauri/tauri.conf.json",
  "src-tauri/Cargo.toml",
];

/**
 * Assert the changed-path set is a valid bump diff (REL-11):
 * - every changed path is in the allowlist (a stray edit must not get tagged);
 * - all 3 manifests are present (a real bump edits all three);
 * - fewer than 5 paths is fine — the pnpm-lock (and even Cargo.lock) no-op case
 *   is valid (RESEARCH §Q1/§P2: pnpm-lock never records the root version).
 *
 * @throws naming every stray path, or every missing required manifest.
 */
export function assertOnlyExpectedPaths(changedPaths: string[]): void {
  const allowed = new Set(ALLOWED_PATHS);
  const stray = changedPaths.filter((p) => !allowed.has(p));
  if (stray.length > 0) {
    throw new Error(
      `Refusing to tag: unexpected changed paths outside the bump allowlist: ${stray.join(", ")}`,
    );
  }

  const changed = new Set(changedPaths);
  const missing = REQUIRED_MANIFESTS.filter((m) => !changed.has(m));
  if (missing.length > 0) {
    throw new Error(
      `Refusing to tag: a bump must edit all 3 manifests, but these did not change: ${missing.join(", ")}`,
    );
  }
}

/**
 * Render the full `--dry-run` plan (REL-10) as a pure return-string carrying the
 * single computed version, the three file edits, the lockfile regen, the git
 * commands, and the push target. ZERO side effects — the caller prints it.
 */
export function renderDryRunPlan(plan: BumpPlan): string {
  const lines: string[] = [
    `Bump plan: ${plan.currentVersion} -> ${plan.nextVersion} (tag ${plan.tag})`,
    "",
    "Manifest edits (version set to the one computed version):",
    ...plan.manifests.map((m) => `  - ${m.path} -> ${plan.nextVersion}`),
    "",
    "Lockfiles regenerated + staged (only if changed):",
    "  - pnpm-lock.yaml (pnpm install --lockfile-only --offline; usually a no-op)",
    "  - src-tauri/Cargo.lock (cargo update -p devtools-app --offline)",
    "",
    `Commit message: ${plan.commitMessage}`,
    "",
    "Git commands:",
    ...plan.gitCommands.map((c) => `  ${c}`),
    "",
    `Push target: ${plan.pushTarget} (commit then tag)`,
  ];
  return lines.join("\n");
}

/**
 * Render the literal, copy-pasteable recovery block (D-09/D-10) as a pure
 * return-string. Printed when the push fails OR the maintainer declines the
 * confirm — keep the local commit + tag, never auto-rollback. The retry reuses
 * the SAME push commands the dry-run/real-run print, so they stay identical.
 */
export function renderRecovery(plan: BumpPlan): string {
  return [
    "Local commit + tag are intact (nothing was pushed / discarded).",
    "",
    "To retry the push later:",
    `  git push ${plan.pushTarget} master && git push ${plan.pushTarget} ${plan.tag}`,
    "",
    "To undo the local tag + commit (discard this bump entirely):",
    `  git tag -d ${plan.tag}`,
    "  git reset --hard HEAD~1",
    "",
    "...or undo the commit but keep the edits staged:",
    "  git reset --soft HEAD~1",
  ].join("\n");
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
