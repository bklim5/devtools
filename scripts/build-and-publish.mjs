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
//   -> notarise+staple the DMG (when APPLE_* present) -> spctl assert
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
import { basename, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import process, { stdout, stderr } from "node:process";

import { buildLatestJson } from "../src/lib/release/manifest.ts";
import { resolveReleaseNotes } from "./lib/releaseNotes.mjs";
import { REVIEW_PROMPT_SENTINEL } from "./reviewPromptFoldInGuard.mjs";
// Pure decision core — import the publishPlan helpers (mirrors bumpPlan.ts split):
import {
  parsePublishArgs,
  assertSingleSig,
  parseLipoArchs,
  buildAssetUrl,
  extractServedVersion,
  assertVersionMatches,
  hasSigningEnv,
  hasNotaryApiKeyEnv,
  someNotaryApiKeyEnv,
  hasAppleIdNotaryEnv,
  notarizeNeedsSigningIdentity,
  shouldMaterializeSigningKey,
  notarizeDmgArgs,
  buildPublishPlanView,
  universalMachoPath,
  renderPublishPlan,
  renderPublishRecovery,
} from "../src/lib/release/publishPlan.ts";

const RELEASES_REPO = "bklim5/devtools-releases";
// Per-channel target dir for the DIRECT channel. A SET CARGO_TARGET_DIR must be ABSOLUTE —
// Tauri runs cargo with CWD=src-tauri/ so a relative value resolves to a DIFFERENT tree for
// cargo vs this driver (CWD=ROOT), splitting the build from where the lipo/sig/dmg globs look.
if (process.env.CARGO_TARGET_DIR && !process.env.CARGO_TARGET_DIR.startsWith("/")) {
  throw new Error(
    `CARGO_TARGET_DIR must be an ABSOLUTE path, got '${process.env.CARGO_TARGET_DIR}'.`,
  );
}
// Default to the direct channel's canonical tree and SET it on the env so the `tauri build`
// subprocess (which inherits process.env via runGate) writes there too. This makes
// release:publish + release:build-only land in the SAME src-tauri/target/direct tree as
// scripts/build.sh direct — one direct/ tree, never a duplicate at the bare universal path.
// scripts/build.sh still pre-exports the same absolute dir; this is the standalone fallback.
if (!process.env.CARGO_TARGET_DIR) {
  process.env.CARGO_TARGET_DIR = resolve("src-tauri/target/direct");
}
const TARGET_DIR = process.env.CARGO_TARGET_DIR;
const UNIVERSAL_MACOS_DIR = `${TARGET_DIR}/universal-apple-darwin/release/bundle/macos`;
const UNIVERSAL_DMG_DIR = `${TARGET_DIR}/universal-apple-darwin/release/bundle/dmg`;
/**
 * Both naming inputs are DERIVED, never hardcoded (the TinkerDev-rename bug:
 * a hardcoded `devtools-app.app/...` lipo path kept "verifying" the stale
 * old-name bundle, then failed outright once the leftovers were cleaned):
 *  - `.app` bundle name follows `productName` in tauri.conf.json
 *  - inner binary name follows the Cargo binary/crate name (NOT productName)
 */
function readProductName() {
  return JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"))
    .productName;
}

function readMainBinaryName() {
  const conf = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
  if (conf.mainBinaryName) return conf.mainBinaryName;
  const cargo = readFileSync("src-tauri/Cargo.toml", "utf8");
  const m = cargo.match(/^name\s*=\s*"([^"]+)"/m);
  if (!m) {
    abort("Could not derive the binary name from src-tauri/Cargo.toml");
  }
  return m[1];
}
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

  // 2. The DMG-notarise step (step 6.5) supports ONLY the App Store Connect
  //    API-key notary set. If notarisation is signalled ANY other recognised way —
  //    a PARTIAL API-key set (typo/half-export), OR the COMPLETE Apple-ID auth set
  //    that Tauri honours to notarise the `.app` — we cannot notarise the DMG, so
  //    FAIL CLOSED here (before the ~15-min build) rather than silently publish a
  //    Gatekeeper-rejected DMG (.app notarised, DMG not). A bare APPLE_SIGNING_IDENTITY
  //    (Developer-ID-sign WITHOUT notarising) is legitimate and does NOT trip this.
  if (
    !hasNotaryApiKeyEnv(process.env) &&
    (someNotaryApiKeyEnv(process.env) || hasAppleIdNotaryEnv(process.env))
  ) {
    abort(
      "Apple notarisation is configured but the DMG-notarise step needs the COMPLETE App Store Connect API-key set (APPLE_API_KEY_PATH + APPLE_API_KEY + APPLE_API_ISSUER). The Apple-ID auth set (APPLE_ID/APPLE_PASSWORD/APPLE_TEAM_ID) is NOT supported for the DMG. Use the API-key set, or unset the Apple notary env for a sign-only/ad-hoc build.",
    );
  }

  // 2c. Notarising REQUIRES a Developer ID signing identity. If the API-key notary
  //     set is present but neither APPLE_SIGNING_IDENTITY nor tauri.conf
  //     bundle.macOS.signingIdentity names a real cert (it ships ad-hoc "-"), the
  //     build signs the binary ad-hoc and notarisation REJECTS it ~15 min in ("not
  //     signed with a valid Developer ID certificate" + "no secure timestamp"). Fail
  //     closed BEFORE the build (never echo the identity — boolean check only).
  const confSigningIdentity = JSON.parse(
    readFileSync("src-tauri/tauri.conf.json", "utf8"),
  )?.bundle?.macOS?.signingIdentity;
  if (notarizeNeedsSigningIdentity(process.env, confSigningIdentity)) {
    abort(
      "Apple notarisation is configured (API-key set present) but no Developer ID " +
        "signing identity is set — the build would sign ad-hoc and FAIL notarisation. " +
        'Export APPLE_SIGNING_IDENTITY (e.g. "Developer ID Application: <Name> (TEAMID)") ' +
        "and re-run, or unset the Apple notary env for a sign-only/ad-hoc build.",
    );
  }

  // 2b. Log what will ACTUALLY happen — keyed off the API-key set the DMG step
  //     uses, so it can never claim 'notarising' when the DMG gate will be skipped
  //     (log only; NEVER a secret value — T-11-10).
  log(
    hasNotaryApiKeyEnv(process.env)
      ? "  - API-key notary env detected — notarising the .app + DMG."
      : "  - No notary key — sign-only / ad-hoc build (no notarisation).",
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
function publish(view, version, { x86Present, buildOnly }) {
  // 0. Materialize the signing key for `tauri build`: it reads ONLY
  //    TAURI_SIGNING_PRIVATE_KEY (the key CONTENT), never *_PATH. The preflight
  //    accepts either form, so a maintainer who exported only the PATH form would
  //    otherwise pass preflight, run the full ~15-min build, then die at the very
  //    last `.sig` step ("a public key has been found, but no private key"). Read
  //    the file into the content var here so the PATH form actually works.
  const signingKeyPath = shouldMaterializeSigningKey(process.env);
  if (signingKeyPath) {
    try {
      process.env.TAURI_SIGNING_PRIVATE_KEY = readFileSync(
        signingKeyPath,
        "utf8",
      ).trim();
    } catch (err) {
      abort(
        `could not read TAURI_SIGNING_PRIVATE_KEY_PATH (${signingKeyPath}): ${err?.message ?? err}`,
      );
    }
    log("  - materialized TAURI_SIGNING_PRIVATE_KEY from the key path (content var)");
  }

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
  //    `--config src-tauri/tauri.direct.conf.json` (Phase 27-02, Finding 1) re-grants
  //    the direct-only updater:default / process:allow-restart / autostart:* capability
  //    permissions that Plan 27-01 stripped out of the globbed static default.json (to
  //    keep the appstore capability codegen green). WITHOUT this the SHIPPED direct
  //    release would link the updater + autostart plugins but the webview would lack
  //    permission to call them — a silent direct-channel regression. This is the same
  //    overlay the `tauri:build:direct` package.json script passes.
  // Pin the frontend channel to `direct` so an ambient VITE_CHANNEL=appstore in the
  // operator's shell cannot compile the App-Store frontend (IS_APPSTORE=true) into the
  // direct release — a half-variant (appstore upsell/pane wording shipped on the DMG).
  // The native side is already pinned via --config tauri.direct.conf.json + default
  // features; this binds the frontend half in the SAME command (MAS-BUILD-01 / D-08).
  process.env.VITE_CHANNEL = "direct";
  log("\nBuilding the universal binary (this is slow):");
  runGate("tauri build (universal)", "pnpm", [
    "tauri",
    "build",
    "--target",
    "universal-apple-darwin",
    "--config",
    "src-tauri/tauri.direct.conf.json",
  ]);

  // 3.5. UP5-03 direct-absence sentinel. The DIRECT build registers
  //      reviewPromptFoldInGuard, which writes dist/reviewprompt-inventory.json on
  //      EVERY outcome — so a MISSING file means the guard did not run for this
  //      build (i.e. this dist/ is not a guarded direct build) and is as fatal as a
  //      dirty one. Same posture verify-appstore-bundle.sh takes with
  //      licenseui-inventory.json, applied to the channel this guard actually runs
  //      on: without it the guard is only ever exercised by a developer's local
  //      build, and the shipped DMG could carry the App-Store review prompt with
  //      nothing in the release path noticing. `dist/` is the authoritative
  //      pre-compression frontend Tauri brotli-embeds into the binary in the SAME
  //      invocation above, so reading it here binds the sentinel to what shipped.
  const reviewSentinelPath = `dist/${REVIEW_PROMPT_SENTINEL}`;
  if (!existsSync(reviewSentinelPath)) {
    abort(
      `${reviewSentinelPath} is missing after the direct build — the UP5-03 fold-in guard did not run, so the App-Store review prompt's absence from this release is UNPROVEN. Refusing to publish.`,
    );
  }
  let reviewSentinel;
  try {
    reviewSentinel = JSON.parse(readFileSync(reviewSentinelPath, "utf8"));
  } catch (err) {
    abort(`could not parse ${reviewSentinelPath}: ${err?.message ?? err}`);
  }
  if (reviewSentinel.reviewPromptInChunks !== false) {
    abort(
      `[UP5-03] ${reviewSentinelPath} reports the appstore-only review prompt was folded into the DIRECT bundle: ${JSON.stringify(reviewSentinel.hits)}. Refusing to publish.`,
    );
  }
  log("\nUP5-03 sentinel: reviewPromptInChunks=false (review prompt absent from the direct bundle)");

  // 4. lipo both-arch assert (REL-05, T-11-12) — path derived, never hardcoded.
  const machoPath = universalMachoPath(
    readProductName(),
    readMainBinaryName(),
    UNIVERSAL_MACOS_DIR,
  );
  const archs = run("lipo", ["-archs", machoPath]).stdout;
  if (!parseLipoArchs(archs)) {
    abort(
      `lipo -archs reported ${JSON.stringify(archs)} — the binary is NOT universal (need both x86_64 + arm64). Refusing to publish a single-arch build.`,
    );
  }
  log(`\nlipo both-arch verified: ${archs}`);

  // 5. Fresh-.sig single-match glob (REL-06, T-11-07) — product-pinned via the
  //    view (stale old-name sigs can never be the match; step 2 still clears
  //    ALL *.app.tar.gz.sig so leftovers don't linger either way).
  const sigs = globSync(view.sigGlob);
  const sigPath = assertSingleSig(sigs);
  const signature = readFileSync(sigPath, "utf8").trim();
  log(`Fresh signature: ${sigPath}`);

  // 6. Resolve the assets (single-match each).
  const tarball = assertSingleSig(globSync(`${UNIVERSAL_MACOS_DIR}/*.app.tar.gz`));
  const tarballBasename = basename(tarball);
  const dmg = assertSingleSig(globSync(`${UNIVERSAL_DMG_DIR}/*.dmg`));
  log(`Updater payload: ${tarball}`);
  log(`First-install DMG: ${dmg}`);

  // 6.5. Notarise + staple the DMG (when Apple env present). `tauri build`
  //      notarises only the `.app` inside the bundle, leaving the DMG
  //      Developer-ID-signed but UNNOTARISED → Gatekeeper rejects a *downloaded*
  //      DMG ("Apple cannot check it for malicious software"). Submit the DMG,
  //      staple the ticket, and assert `spctl` accepts — all BEFORE any publish, so
  //      a Gatekeeper-rejected DMG can never reach the releases repo. notarytool
  //      needs the API-key path/key-id/issuer on its argv (the `.p8` CONTENT stays
  //      a file); use run() (not runGate()) so those identifiers are never logged
  //      (T-11-10). A notarytool/staple failure throws → caught by main() before
  //      publish (fail-closed). Keyed off the API-key notary set (preflight 2b
  //      already rejected a partial set); skipped on a sign-only/ad-hoc build.
  if (hasNotaryApiKeyEnv(process.env)) {
    log("\nNotarising the DMG (the .app is notarised in-build; the DMG needs its own ticket):");
    run("xcrun", notarizeDmgArgs(process.env, dmg));
    log("  - notarytool submit --wait: accepted");
    run("xcrun", ["stapler", "staple", dmg]);
    log("  - stapler staple: ticket attached");
    const verdict = run(
      "spctl",
      ["-a", "-t", "open", "--context", "context:primary-signature", dmg],
      { allowFailure: true },
    );
    if (verdict.status !== 0) {
      abort(
        "the DMG is still not Gatekeeper-clean after notarise+staple (spctl rejected it). Refusing to publish.",
      );
    }
    log("  - spctl: accepted (Gatekeeper-clean DMG)");
  } else {
    log("\nSkipping DMG notarisation (no API-key notary env — sign-only/ad-hoc build).");
  }

  // 6.9. --build-only early-return: the real build + sign + notarise + staple +
  //      spctl-accept have ALL run above (so this proves the direct DMG channel
  //      still builds/signs/notarises — the MAS-SHIP-05 load-bearing proof the
  //      --dry-run path can never reach, since it short-circuits before `tauri
  //      build`). RETURN here BEFORE any publish WRITE — no latest.json, no `gh
  //      release create`, no `gh release upload`, no tag — so the proof is
  //      publish-safe by construction. (The read-only preflight `gh` probes ran
  //      earlier in main()/preflights and are intentionally NOT gated — only the
  //      publish writes must be unreachable. T-30-04b.)
  if (buildOnly) {
    log(
      "\nbuild-only: artifacts verified (built + signed + notarised + stapled + spctl-accepted) — stopping before publish (no latest.json, no gh release, no tag).",
    );
    return;
  }

  // 7. Build latest.json via the PURE fn (generate-only; never `git add` — REL-08).
  //    Real CHANGELOG notes for this version, falling back to the tag (resilient).
  const notes = resolveReleaseNotes(
    version,
    view.tag,
    "shipping the tag as notes",
    log,
  );
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
  const { dryRun, buildOnly } = args;

  // 2. Read the current version and build the plan view from it (productName
  //    derived from tauri.conf.json — rename-proof).
  const version = readCurrentVersion();
  const view = buildPublishPlanView(
    version,
    readProductName(),
    UNIVERSAL_MACOS_DIR,
  );

  // 3. Read-only preflights (ALL before any irreversible action — REL-11).
  const { x86Present } = preflights(view);

  // 4. --dry-run: print the full plan and exit 0 with ZERO side effects (REL-10).
  //    Do NOT run `rustup target add`, `tauri build`, write latest.json, gh, or curl.
  if (dryRun) {
    log("\n--- DRY RUN (no build, no publish, no files written) ---\n");
    log(renderPublishPlan(view));
    process.exit(0);
  }

  // Task 2: build + publish pipeline. --build-only threads INTO publish() (it
  //  runs the REAL build) and returns BEFORE any publish write — it does NOT
  //  short-circuit in main() like --dry-run does.
  publish(view, version, { x86Present, buildOnly });
}

try {
  main();
} catch (err) {
  // buildLatestJson / assertSingleSig / parseLipoArchs throws land here: fail
  // loud, never swallow.
  logErr(`\npublish failed: ${err?.message ?? err}`);
  process.exit(1);
}
