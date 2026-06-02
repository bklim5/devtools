// bump-and-tag driver (REL-01/REL-03/REL-04/REL-10/REL-11; D-01..D-11).
//
// The THIN I/O caller that turns the pure Plan 02 core (src/lib/release/
// bumpPlan.ts) into the real `pnpm release:bump` maintainer command. ALL the
// decision logic — arg grammar, the single-computed-version plan, the allowlist
// diff, the dry-run/recovery text, the confirm default — lives in the pure core
// and is unit-tested. This file only does the side effects the core deliberately
// refuses to touch: fs reads/writes, git/pnpm/cargo subprocesses, the TTY y/N
// prompt, and the two human-facing prints.
//
// Ordered pipeline (RESEARCH Pattern 2):
//   parse args -> read version -> build plan -> read-only preflights (clean
//   tree, branch==master, tag absent local+remote, vitest+tsc+eslint gate)
//   -> [--dry-run short-circuits here, ZERO writes] -> write 3 manifests
//   -> regen+stage lockfiles -> allowlist diff -> commit -> annotated tag
//   -> assert clean tree -> print push plan -> y/N -> push commit then tag.
//
// Safety invariants (threat model T-10-04/07/08/10):
//   * every CLI call uses execFileSync with an argv ARRAY (never execSync with
//     an interpolated string) — no shell-injection surface;
//   * the script NEVER runs `git reset` / `git tag -d` — on decline/failure it
//     only PRINTS the recovery commands the core renders (D-09/D-10);
//   * all preflights run BEFORE the first write (D-08); a non-TTY run declines
//     the push (default NO) and keeps local work.

import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import process, { stdin, stdout, stderr } from "node:process";

import {
  parseBumpArgs,
  buildBumpPlan,
  assertOnlyExpectedPaths,
  renderDryRunPlan,
  renderRecovery,
  isAffirmative,
  ALLOWED_PATHS,
} from "../src/lib/release/bumpPlan.ts";

const ALLOWED = new Set(ALLOWED_PATHS);

/** Print to stdout (the plan + progress surface). */
function log(message = "") {
  stdout.write(`${message}\n`);
}

/** Print to stderr (errors + abort reasons). */
function logErr(message = "") {
  stderr.write(`${message}\n`);
}

/**
 * Run a CLI with an argv ARRAY, returning trimmed stdout. `execFileSync` (never
 * `execSync` with a string) keeps the version/tag string off the shell, so there
 * is no quoting/injection surface (T-10-04). `allowFailure` lets the caller treat
 * a non-zero exit as data (e.g. the tag-exists rev-parse probe) instead of throw.
 */
function run(file, args, options = {}) {
  const { allowFailure = false, cwd } = options;
  try {
    const out = execFileSync(file, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      cwd,
    });
    return { ok: true, stdout: (out ?? "").trim(), status: 0 };
  } catch (err) {
    if (allowFailure) {
      return {
        ok: false,
        stdout: (err.stdout ?? "").toString().trim(),
        stderr: (err.stderr ?? "").toString().trim(),
        status: typeof err.status === "number" ? err.status : 1,
      };
    }
    throw err;
  }
}

/** Run a gate command, streaming its output, and abort the bump if it fails. */
function runGate(label, file, args) {
  log(`  - ${label} (${file} ${args.join(" ")})`);
  try {
    execFileSync(file, args, { stdio: ["ignore", "inherit", "inherit"] });
  } catch {
    abort(`gate failed: ${label}. Fix it and re-run; nothing was written.`);
  }
}

/** Abort: print the reason to stderr, set a non-zero exit code, and stop. */
function abort(reason) {
  logErr(`\nbump aborted: ${reason}`);
  process.exit(1);
}

/** Read the current `version` string out of package.json (the bumpSemver input). */
function readCurrentVersion() {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  if (typeof pkg.version !== "string") {
    abort("package.json has no string \"version\" field.");
  }
  return pkg.version;
}

/** The changed-path set from `git status --porcelain` (porcelain line = "XY path"). */
function changedPaths() {
  const { stdout: out } = run("git", ["status", "--porcelain"]);
  return out.split("\n").filter(Boolean).map((line) => line.slice(3));
}

/**
 * All read-only preflights, ALL before the first write (D-06/D-07/D-08). Any
 * failure aborts non-zero with nothing written.
 */
function preflights(plan) {
  log("Preflights (read-only — nothing is written until these pass):");

  // 1. Clean working tree.
  if (changedPaths().length > 0) {
    abort("working tree is dirty. Commit or stash first, then re-run.");
  }
  log("  - working tree clean");

  // 2. On master.
  const { stdout: branch } = run("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (branch !== "master") {
    abort(`branch is ${JSON.stringify(branch)}, not "master". Switch to master and re-run.`);
  }
  log("  - on branch master");

  // 3. Target tag absent locally (exit 0 == it EXISTS == abort).
  const localTag = run("git", ["rev-parse", "-q", "--verify", `refs/tags/${plan.tag}`], {
    allowFailure: true,
  });
  if (localTag.status === 0) {
    abort(`tag ${plan.tag} already exists locally. Use a different level, or delete the local tag first.`);
  }
  log(`  - tag ${plan.tag} absent locally`);

  // 4. Target tag absent on origin. ls-remote needs network; if origin is
  //    unreachable we ABORT (RESEARCH Q6 / A3 safe default) rather than risk a
  //    duplicate remote tag.
  const remoteTag = run("git", ["ls-remote", "--tags", "origin", plan.tag], {
    allowFailure: true,
  });
  if (!remoteTag.ok) {
    abort(`could not reach origin to check for tag ${plan.tag}. Refusing to proceed (a duplicate remote tag is irreversible). Re-run when origin is reachable.`);
  }
  if (remoteTag.stdout.length > 0) {
    abort(`tag ${plan.tag} already exists on origin. This version was already released.`);
  }
  log(`  - tag ${plan.tag} absent on origin`);

  // 5. The full gate (D-07): vitest + tsc + eslint, one-shot (never watch).
  log("Gate (vitest + tsc + eslint):");
  runGate("vitest", "pnpm", ["test"]);
  runGate("tsc", "pnpm", ["exec", "tsc", "--noEmit"]);
  runGate("eslint", "pnpm", ["lint"]);
  log("  - gate green");
}

/** Apply the 3 manifest edits to disk (reversible, local). */
function writeManifests(plan) {
  log("\nWriting the lockstep version edits:");
  for (const manifest of plan.manifests) {
    const before = readFileSync(manifest.path, "utf8");
    const after = manifest.apply(before); // setXVersion throws loudly on 0/>1 matches
    writeFileSync(manifest.path, after);
    log(`  - ${manifest.path} -> ${plan.nextVersion}`);
  }
}

/**
 * Regenerate the lockfiles (D-11). pnpm is expected to be a no-op (the lockfile
 * does not store the root version — RESEARCH Q1), so it is staged only if it
 * actually changed. cargo is the surgical 1-package relock (`cargo update -p`,
 * NOT the whole-graph relock which pulls unrelated churn — RESEARCH §Q2/P3).
 */
function regenLockfiles() {
  log("\nRegenerating lockfiles:");
  run("pnpm", ["install", "--lockfile-only", "--offline"]);
  log("  - pnpm install --lockfile-only --offline (usually a no-op)");
  run("cargo", ["update", "-p", "devtools-app", "--offline"], { cwd: "src-tauri" });
  log("  - cargo update -p devtools-app --offline");
}

/**
 * Stage exactly the changed paths that are in the allowlist, commit, and create
 * the annotated tag. Runs `assertOnlyExpectedPaths` (from the core) BEFORE the
 * commit so a stray edit can never be tagged (D-11 / T-10-10).
 */
function commitAndTag(plan) {
  const changed = changedPaths();
  assertOnlyExpectedPaths(changed); // throws (we let it surface) on stray / missing manifest

  const toStage = changed.filter((p) => ALLOWED.has(p));
  log("\nStaging:");
  for (const path of toStage) log(`  - ${path}`);
  run("git", ["add", ...toStage]);

  run("git", ["commit", "-m", plan.commitMessage]);
  log(`Committed: ${plan.commitMessage}`);

  run("git", ["tag", "-a", plan.tag, "-m", plan.tag]); // annotated (D-04)
  log(`Created annotated tag: ${plan.tag}`);

  // Criterion #2: the tagged tree must be clean before any push.
  if (changedPaths().length > 0) {
    abort("working tree is not clean after commit — refusing to push. Inspect `git status`.");
  }
  log("Working tree clean after commit.");
}

/** TTY-guarded y/N (RESEARCH Q5): non-interactive -> NO; otherwise isAffirmative. */
async function confirmPush() {
  if (!stdin.isTTY) {
    log("\n(stdin is not a TTY — declining the push by default. Local commit + tag are kept.)");
    return false;
  }
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question("\nPush this commit + tag to origin now? [y/N] ");
    return isAffirmative(answer);
  } finally {
    rl.close();
  }
}

/** Push commit FIRST, then the tag (Q6). On any failure, print recovery + exit non-zero. */
function push(plan) {
  log("\nPushing to origin (commit, then tag):");
  try {
    run("git", ["push", "origin", "master"], { allowFailure: false });
    log("  - pushed commit (origin master)");
    run("git", ["push", "origin", plan.tag], { allowFailure: false });
    log(`  - pushed tag (${plan.tag})`);
  } catch (err) {
    logErr(`\npush failed: ${err.message ?? err}`);
    logErr(`\n${renderRecovery(plan)}`);
    process.exit(1);
  }
  log(`\nReleased ${plan.tag} to origin.`);
}

async function main() {
  // 1. Parse args (the throw prints usage; we surface it + exit non-zero).
  let args;
  try {
    args = parseBumpArgs(process.argv.slice(2));
  } catch (err) {
    abort(err.message ?? String(err));
    return;
  }
  const { level, dryRun } = args;

  // 2. Read the current version and build the plan from ONE computed version.
  const current = readCurrentVersion();
  const plan = buildBumpPlan(current, level);

  // 3. Read-only preflights (ALL before any write — D-08).
  preflights(plan);

  // 4. --dry-run: print the full plan and exit 0 with ZERO side effects (D-05a).
  //    Do NOT call regenLockfiles (cargo update would write) or any fs/git write.
  if (dryRun) {
    log("\n--- DRY RUN (no files written, no git/network actions) ---\n");
    log(renderDryRunPlan(plan));
    process.exit(0);
  }

  // 5-9. Local, reversible work.
  writeManifests(plan);
  regenLockfiles();
  commitAndTag(plan);

  // 10. Print the push plan + confirm (D-05).
  log("\nAbout to push:");
  log(`  commit ${plan.commitMessage}`);
  log(`  tag    ${plan.tag}`);
  log(`  to     ${plan.pushTarget} (master, then the tag)`);

  const approved = await confirmPush();

  // 11. Declined -> keep local work, print recovery, exit non-zero (D-10).
  if (!approved) {
    log("\nPush declined. Local commit + tag are intact.");
    log(`\n${renderRecovery(plan)}`);
    process.exit(1);
  }

  // 12. Approved -> push (push() handles failure recovery, D-09).
  push(plan);
}

main().catch((err) => {
  // setXVersion / buildBumpPlan throws (malformed manifest, etc.) land here:
  // fail loud, never swallow.
  logErr(`\nbump failed: ${err?.message ?? err}`);
  process.exit(1);
});
