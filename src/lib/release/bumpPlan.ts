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
