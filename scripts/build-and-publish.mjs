// build-and-publish driver (REL-05/REL-06/REL-07/REL-09/REL-12; build/publish-half of REL-10/REL-11).
//
// The THIN I/O caller that turns the pure Plan 01 core (src/lib/release/
// publishPlan.ts) + the Phase 9 pure `buildLatestJson` (src/lib/release/
// manifest.ts) into the real `pnpm release:publish` maintainer command. ALL the
// decision logic — arg grammar, the single-fresh-`.sig` assertion, the lipo
// both-arch parse, the public asset URL, the served-version match, the signing/
// Apple env presence checks, and the dry-run plan / recovery text — lives in the
// pure cores and is unit-tested. This file only does the side effects those
// cores deliberately refuse to touch: fs globs/reads/writes, the tauri/lipo/gh/
// curl/rustup subprocesses, the network, and the human-facing prints.
//
// Ordered pipeline (RESEARCH Pattern 2):
//   parse args -> read version -> build plan view -> read-only preflights
//   (signing env present, Apple env presence note, rustup both-targets, gh auth
//   + WRITE/ADMIN perm on the PUBLIC releases repo, release-not-already-published)
//   -> [--dry-run short-circuits here, NO build, ZERO writes]
//   -> rustup target add (idempotent) -> clear stale .sig -> universal tauri build
//   -> lipo both-arch assert -> fresh-.sig single-match glob -> resolve assets
//   -> write latest.json (generate-only, never git add — REL-08)
//   -> gh release create (assets FIRST) -> gh release upload latest.json (LAST)
//   -> curl verify served version -> print the manual round-trip gate.
//
// CRITICAL --dry-run divergence from Phase 10: --dry-run here short-circuits
// BEFORE the slow `tauri build` (which writes hundreds of MB to target/). It
// prints the plan and exits 0 with ZERO side effects (REL-10) — no build dir, no
// latest.json, no gh/curl call.
//
// Safety invariants (threat model T-11-06..12):
//   * every CLI call uses execFileSync with an argv ARRAY (never a shell string
//     via exec) — no shell-injection surface (T-11-06);
//   * signing/Apple secrets are passed via INHERITED `{ env: process.env }` only —
//     never interpolated into an argv, never log()-ed a value (T-11-10);
//   * the fresh `.sig` is globbed ONLY from the universal bundle dir; a stale .sig
//     is cleared pre-build; assertSingleSig fails on 0/>1 (T-11-07);
//   * assets land before the manifest (gh release create, then upload — T-11-08);
//   * every gh call targets the PUBLIC bklim5/devtools-releases (T-11-09);
//   * the script NEVER auto-un-publishes — on failure it PRINTS the recovery the
//     core renders (revert-by-republish).

import {
  globSync,
  readFileSync,
  writeFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { basename } from "node:path";
import { execFileSync } from "node:child_process";
import process, { stdout, stderr } from "node:process";

import { buildLatestJson } from "../src/lib/release/manifest.ts";
import { extractChangelogSection } from "../src/lib/release/changelog.ts";
// Pure decision core — import the publishPlan helpers (mirrors bumpPlan.ts split):
import {
  parsePublishArgs,
  assertSingleSig,
  parseLipoArchs,
  buildAssetUrl,
  extractServedVersion,
  assertVersionMatches,
  hasSigningEnv,
  hasAppleEnv,
  buildPublishPlanView,
  renderPublishPlan,
  renderPublishRecovery,
} from "../src/lib/release/publishPlan.ts";

const RELEASES_REPO = "bklim5/devtools-releases";
const UNIVERSAL_MACOS_DIR =
  "src-tauri/target/universal-apple-darwin/release/bundle/macos";
const UNIVERSAL_DMG_DIR =
  "src-tauri/target/universal-apple-darwin/release/bundle/dmg";
const UNIVERSAL_MACHO =
  "src-tauri/target/universal-apple-darwin/release/bundle/macos/devtools-app.app/Contents/MacOS/devtools-app";
const LATEST_JSON_ENDPOINT =
  "https://github.com/bklim5/devtools-releases/releases/latest/download/latest.json";

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
 * a shell-interpreted string command) keeps every value off the shell, so there
 * is no quoting/injection surface (T-11-06). `allowFailure` lets the caller treat a
 * non-zero exit as data (e.g. the release-exists probe) instead of throw. The
 * signing/Apple secrets reach child processes ONLY through the inherited
 * `{ env: process.env }` here — never as an argv element (T-11-10).
 */
function run(file, args, options = {}) {
  const { allowFailure = false, cwd, raw = false } = options;
  try {
    const out = execFileSync(file, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      cwd,
      env: process.env, // inherit signing/Apple env into children; never on argv
    });
    return { ok: true, stdout: raw ? (out ?? "") : (out ?? "").trim(), status: 0 };
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

/** Run a gate/build command, streaming its output, and abort the publish if it fails. */
function runGate(label, file, args) {
  log(`  - ${label} (${file} ${args.join(" ")})`);
  try {
    execFileSync(file, args, {
      stdio: ["ignore", "inherit", "inherit"],
      env: process.env, // signing/Apple env inherits into `tauri build`; never on argv
    });
  } catch {
    abort(`gate failed: ${label}. Fix it and re-run; nothing was published.`);
  }
}

/** Abort: print the reason to stderr, set a non-zero exit code, and stop. */
function abort(reason) {
  logErr(`\npublish aborted: ${reason}`);
  process.exit(1);
}

/**
 * Read the current `version` string out of package.json — the single source the
 * build will embed, so the plan/glob/URL all key off it.
 */
function readCurrentVersion() {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  if (typeof pkg.version !== "string") {
    abort('package.json has no string "version" field.');
  }
  return pkg.version;
}

/**
 * Resolve the release notes for `version`: the matching `CHANGELOG.md` section's
 * body, or the bare `tag` when the file is missing OR the section is empty/absent.
 * A missing file never throws (guarded by `existsSync`), and the fall-back emits a
 * non-fatal `log(...)` warning so the maintainer notices they shipped the tag. The
 * notes are NEVER interpolated into a shell string — callers pass them as a single
 * `execFileSync` argv element.
 */
function resolveReleaseNotes(version, tag) {
  let notes = "";
  if (existsSync("CHANGELOG.md")) {
    notes = extractChangelogSection(readFileSync("CHANGELOG.md", "utf8"), version);
  }
  if (!notes) {
    log(`note: no CHANGELOG.md section for ${version} — shipping the tag as notes.`);
    return tag;
  }
  return notes;
}

/**
 * All read-only preflights, ALL before any irreversible action (REL-11 publish
 * half). Any failure aborts non-zero with nothing built/published. Returns
 * `{ x86Present }` so the caller can skip the rustup add when already installed.
 */
function preflights(view) {
  log("Preflights (read-only — nothing is built or published until these pass):");

  // 1. Signing env present — the .sig (and thus latest.json) cannot exist without it.
  if (!hasSigningEnv(process.env)) {
    abort(
      "signing env missing (TAURI_SIGNING_PRIVATE_KEY[_PATH] + TAURI_SIGNING_PRIVATE_KEY_PASSWORD). The .sig cannot be produced.",
    );
  }
  log("  - signing env present");

  // 2. Apple notarisation: log ONLY the boolean branch, NEVER a value (T-11-10).
  log(
    hasAppleEnv(process.env)
      ? "  - Apple notarisation env detected — notarising."
      : "  - Ad-hoc signing (no APPLE_* env) — default.",
  );

  // 3. rustup both-targets present? Only REPORT here (the add happens post-dry-run).
  const installed = run("rustup", ["target", "list", "--installed"]).stdout;
  const x86Present = installed.split(/\s+/).includes("x86_64-apple-darwin");
  log(
    x86Present
      ? "  - rustup x86_64-apple-darwin present"
      : "  - rustup x86_64-apple-darwin MISSING (will `rustup target add` before the build)",
  );

  // 4. gh auth + WRITE/ADMIN permission on the PUBLIC releases repo (T-11-09).
  const auth = run("gh", ["auth", "status"], { allowFailure: true });
  if (!auth.ok) {
    abort("gh is not authenticated. Run `gh auth login` and re-run.");
  }
  log("  - gh authenticated");

  const permJson = run("gh", [
    "repo",
    "view",
    RELEASES_REPO,
    "--json",
    "viewerPermission",
  ]).stdout;
  let viewerPermission;
  try {
    viewerPermission = JSON.parse(permJson).viewerPermission;
  } catch {
    abort(`could not parse gh repo view JSON for ${RELEASES_REPO}.`);
  }
  if (!["ADMIN", "WRITE", "MAINTAIN"].includes(viewerPermission)) {
    abort(
      `insufficient permission on ${RELEASES_REPO} (viewerPermission=${JSON.stringify(viewerPermission)}; need ADMIN/WRITE/MAINTAIN).`,
    );
  }
  log(`  - gh permission on ${RELEASES_REPO}: ${viewerPermission}`);

  // 5. The release must not already exist (publishing over it is irreversible).
  const existing = run(
    "gh",
    ["release", "view", view.tag, "--repo", RELEASES_REPO],
    { allowFailure: true },
  );
  if (existing.status === 0) {
    abort(`${view.tag} already published on ${RELEASES_REPO}. Bump first, or delete the release.`);
  }
  log(`  - ${view.tag} not yet published on ${RELEASES_REPO}`);

  return { x86Present };
}

/**
 * The irreversible build -> sign -> latest.json -> cross-repo publish -> verify
 * pipeline. Runs ONLY after the read-only preflights pass and only when NOT
 * --dry-run. Steps 8-10 (the publish + verify + gate print) print
 * renderPublishRecovery on any failure before exiting non-zero — NEVER an auto
 * un-publish (revert-by-republish ethos).
 */
function publish(view, version, { x86Present }) {
  // 1. rustup add (idempotent), then re-verify present (offline cold cache).
  if (!x86Present) {
    log("\nInstalling the missing universal target:");
    run("rustup", ["target", "add", "x86_64-apple-darwin"]);
    log("  - rustup target add x86_64-apple-darwin");
  }
  const installed = run("rustup", ["target", "list", "--installed"]).stdout;
  if (!installed.split(/\s+/).includes("x86_64-apple-darwin")) {
    abort(
      "x86_64-apple-darwin still missing after `rustup target add` (offline cold cache?). The universal build cannot proceed.",
    );
  }

  // 2. Clear any prior universal .sig so the single-match glob is meaningful (T-11-07).
  if (existsSync(UNIVERSAL_MACOS_DIR)) {
    const staleSigs = globSync(`${UNIVERSAL_MACOS_DIR}/*.app.tar.gz.sig`);
    for (const stale of staleSigs) {
      rmSync(stale);
      log(`  - cleared stale signature: ${stale}`);
    }
  }

  // 3. Universal build — the .sig is produced only because the signing env is
  //    present (inherited via runGate's { env: process.env }, never on argv).
  log("\nBuilding the universal binary (this is slow):");
  runGate("tauri build (universal)", "pnpm", [
    "tauri",
    "build",
    "--target",
    "universal-apple-darwin",
  ]);

  // 4. lipo both-arch assert (REL-05, T-11-12).
  const archs = run("lipo", ["-archs", UNIVERSAL_MACHO]).stdout;
  if (!parseLipoArchs(archs)) {
    abort(
      `lipo -archs reported ${JSON.stringify(archs)} — the binary is NOT universal (need both x86_64 + arm64). Refusing to publish a single-arch build.`,
    );
  }
  log(`\nlipo both-arch verified: ${archs}`);

  // 5. Fresh-.sig single-match glob (REL-06, T-11-07).
  const sigs = globSync(`${UNIVERSAL_MACOS_DIR}/*.app.tar.gz.sig`);
  const sigPath = assertSingleSig(sigs);
  const signature = readFileSync(sigPath, "utf8").trim();
  log(`Fresh signature: ${sigPath}`);

  // 6. Resolve the assets (single-match each).
  const tarball = assertSingleSig(globSync(`${UNIVERSAL_MACOS_DIR}/*.app.tar.gz`));
  const tarballBasename = basename(tarball);
  const dmg = assertSingleSig(globSync(`${UNIVERSAL_DMG_DIR}/*.dmg`));
  log(`Updater payload: ${tarball}`);
  log(`First-install DMG: ${dmg}`);

  // 7. Build latest.json via the PURE fn (generate-only; never `git add` — REL-08).
  //    Real CHANGELOG notes for this version, falling back to the tag (resilient).
  const notes = resolveReleaseNotes(version, view.tag);
  const url = buildAssetUrl(version, tarballBasename);
  const latest = buildLatestJson({
    version,
    pubDate: new Date().toISOString(),
    url,
    signature,
    notes,
  });
  writeFileSync("latest.json", JSON.stringify(latest, null, 2));
  log("Wrote latest.json (generated-only, NOT committed).");

  // 8-10. The publish + verify — wrap so any failure prints recovery (no auto-undo).
  try {
    // 8. gh publish — ASSETS FIRST (REL-07, T-11-08), every call --repo (T-11-09).
    log(`\nPublishing to ${RELEASES_REPO} (assets first, manifest last):`);
    run("gh", [
      "release",
      "create",
      view.tag,
      "--repo",
      RELEASES_REPO,
      dmg,
      tarball,
      "--title",
      view.tag,
      "--notes",
      notes,
    ]);
    log("  - gh release create (DMG + .app.tar.gz uploaded)");

    run("gh", [
      "release",
      "upload",
      view.tag,
      "latest.json",
      "--repo",
      RELEASES_REPO,
    ]);
    log("  - gh release upload latest.json (manifest LAST)");

    // 9. Post-publish curl verify (REL-12, T-11-11).
    log("\nVerifying the served updater endpoint:");
    const served = run("curl", ["-L", LATEST_JSON_ENDPOINT]).stdout;
    assertVersionMatches(extractServedVersion(JSON.parse(served)), version);
    log(`  - served latest.json version == ${version}`);
  } catch (err) {
    logErr(`\npublish step failed: ${err?.message ?? err}`);
    logErr(`\n${renderPublishRecovery(view)}`);
    process.exit(1);
  }

  // 10. The manual round-trip gate (DST-02 — handed off to Plan 03 / the maintainer).
  log(`\nPublished ${view.tag} to ${RELEASES_REPO}.`);
  log("\n--- MANUAL ROUND-TRIP GATE (DST-02 — the milestone's load-bearing human sign-off) ---");
  log("Prove the universal dual-key auto-update on real hardware:");
  log("  1. Install/run an OLDER build (a prior version) of DevTools.");
  log("  2. Let it detect this release (or trigger the updater check).");
  log("  3. Confirm minisign verifies the .sig against the committed public key.");
  log("  4. Confirm it relaunches into the new version.");
  log("Do this on BOTH an Apple Silicon and (if available) an Intel machine to prove");
  log("the dual-key (darwin-aarch64 + darwin-x86_64) universal artifact serves both.");
}

function main() {
  // 1. Parse args (the throw prints usage; we surface it + exit non-zero).
  let args;
  try {
    args = parsePublishArgs(process.argv.slice(2));
  } catch (err) {
    abort(err.message ?? String(err));
    return;
  }
  const { dryRun } = args;

  // 2. Read the current version and build the plan view from it.
  const version = readCurrentVersion();
  const view = buildPublishPlanView(version);

  // 3. Read-only preflights (ALL before any irreversible action — REL-11).
  const { x86Present } = preflights(view);

  // 4. --dry-run: print the full plan and exit 0 with ZERO side effects (REL-10).
  //    Do NOT run `rustup target add`, `tauri build`, write latest.json, gh, or curl.
  if (dryRun) {
    log("\n--- DRY RUN (no build, no publish, no files written) ---\n");
    log(renderPublishPlan(view));
    process.exit(0);
  }

  // Task 2: build + publish pipeline
  publish(view, version, { x86Present });
}

try {
  main();
} catch (err) {
  // buildLatestJson / assertSingleSig / parseLipoArchs throws land here: fail
  // loud, never swallow.
  logErr(`\npublish failed: ${err?.message ?? err}`);
  process.exit(1);
}
