// Pure, side-effect-free decision core for the build-and-publish driver (REL-05,
// REL-06, REL-09, REL-12). Everything here is testable without touching fs / the
// subprocess CLIs (tauri/lipo/gh/curl) / the network: it parses the CLI grammar,
// asserts the single fresh `.sig`, parses the `lipo -archs` tokens, builds the
// public asset URL, checks served-version match, and presence-checks the signing
// + Apple env (BOOLEANS only — a secret value can never flow back out).
//
// PURITY CONTRACT (load-bearing — Plan 02's `.mjs` driver AND the tests both
// import this; mirrors bumpPlan.ts): no filesystem, no child-process, no reading
// of the raw argv/env globals, and no console writes. The render* helpers RETURN
// strings; the caller prints them. The only side effects (glob, tauri build, gh,
// curl, latest.json write) live in the thin Plan 02 driver, never here.

/**
 * The PUBLIC releases repo — every updater URL points here. NEVER the private
 * source slug `bklim5/devtools` (unauthenticated updater clients can't fetch a
 * private repo's `releases/latest/download`). T-11-03.
 */
const RELEASES_REPO = "bklim5/devtools-releases";

const USAGE = "[--dry-run]";

/**
 * A read-only environment map (the shape of `process.env`, declared locally so
 * this pure module needs no `@types/node` `NodeJS` namespace in the frontend
 * tsconfig). The `.mjs` driver passes `process.env`, which is assignable.
 */
export type ProcessEnv = Record<string, string | undefined>;

export interface PublishArgs {
  dryRun: boolean;
}

/**
 * Parse the publish CLI grammar from an argv slice (the caller slices the process
 * arguments and passes them in — this stays pure and never reads the argv global
 * itself).
 *
 * Accepts ONLY the optional `--dry-run` flag. This driver does NOT take a bump
 * level — Phase 10 owns the bump+tag; this phase consumes the already-pushed tag.
 * Anything else (a level like "patch", an unknown flag, a typo) throws an Error
 * naming the offending token and printing the accepted usage.
 */
export function parsePublishArgs(argv: string[]): PublishArgs {
  let dryRun = false;

  for (const token of argv) {
    if (token === "--dry-run") {
      dryRun = true;
      continue;
    }
    throw new Error(
      `Unexpected argument: ${JSON.stringify(token)}. This driver does not bump (Phase 10 owns that). Usage: release:publish ${USAGE}`,
    );
  }

  return { dryRun };
}

/**
 * Assert exactly one fresh `*.app.tar.gz.sig` was globbed from THIS build's
 * universal bundle dir (REL-06, T-11-01) — the single most security-critical
 * link, since the signature every install trusts is derived from this glob.
 *
 * @throws on 0 matches (hints the signing env was likely absent so no `.sig` was
 *         produced) or on >1 matches (ambiguous — a stale `.sig` polluted the dir;
 *         lists every match). Returns the single path on exactly one.
 */
export function assertSingleSig(matches: string[]): string {
  if (matches.length === 0) {
    throw new Error(
      "Found 0 *.app.tar.gz.sig files in the universal bundle dir. The build produced no signature — was the signing env (TAURI_SIGNING_PRIVATE_KEY[_PATH] + _PASSWORD) exported?",
    );
  }
  if (matches.length > 1) {
    throw new Error(
      `Found more than one (>1) *.app.tar.gz.sig file — ambiguous, refusing to pick. Clean the universal bundle dir and rebuild. Matches: ${matches.join(", ")}`,
    );
  }
  return matches[0];
}

/**
 * Parse the space-separated `lipo -archs <binary>` output (REL-05, T-11-02).
 * Returns true ONLY when BOTH `x86_64` AND `arm64` are present — proving the
 * artifact is a genuine universal (fat) binary, not a single-arch build
 * mislabeled. `arm64e` is a distinct variant and does NOT satisfy the arm half
 * (a Rust/Tauri app binary is `arm64`, not `arm64e` — RESEARCH §Q2, strict).
 */
export function parseLipoArchs(stdout: string): boolean {
  const set = new Set(stdout.trim().split(/\s+/).filter(Boolean));
  return set.has("x86_64") && set.has("arm64");
}

/**
 * Build the public download URL for a release asset (the `url` field fed into
 * the Phase 9 `buildLatestJson`). Always targets the PUBLIC releases repo via the
 * `releases/download/v<version>/<basename>` per-tag asset form — never the private
 * source slug (T-11-03).
 */
export function buildAssetUrl(version: string, basename: string): string {
  return `https://github.com/${RELEASES_REPO}/releases/download/v${version}/${basename}`;
}

/**
 * Read the `version` field from a parsed `latest.json` (the post-publish `curl`
 * verify, REL-12). @throws if the field is missing/non-string — a malformed
 * served manifest must not silently pass the version check.
 */
export function extractServedVersion(json: {
  version?: string;
  [key: string]: unknown;
}): string {
  if (typeof json.version !== "string") {
    throw new Error(
      "Served latest.json has no string `version` field — cannot verify the publish.",
    );
  }
  return json.version;
}

/**
 * Assert the served version equals the version just cut (REL-12, T-11-05). A
 * mismatch means the redirect hasn't propagated or a wrong release is latest —
 * @throws printing BOTH versions.
 */
export function assertVersionMatches(served: string, expected: string): void {
  if (served !== expected) {
    throw new Error(
      `Post-publish version mismatch: served latest.json has version ${JSON.stringify(served)} but the published version is ${JSON.stringify(expected)}.`,
    );
  }
}

/**
 * Presence-check the minisign signing env (REL-09/REL-11, T-11-04). Requires a
 * key (inline OR path) AND a password — the `.sig` cannot be produced otherwise.
 * Returns a BOOLEAN ONLY — the secret value can never flow back out of this fn.
 */
export function hasSigningEnv(env: ProcessEnv): boolean {
  return (
    (!!env.TAURI_SIGNING_PRIVATE_KEY || !!env.TAURI_SIGNING_PRIVATE_KEY_PATH) &&
    !!env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD
  );
}

/** The union of Apple notarisation env var names (API-key set + Apple-ID set). */
const APPLE_VARS: readonly string[] = [
  "APPLE_API_KEY",
  "APPLE_API_ISSUER",
  "APPLE_API_KEY_PATH",
  "APPLE_SIGNING_IDENTITY",
  "APPLE_ID",
  "APPLE_PASSWORD",
  "APPLE_TEAM_ID",
];

/**
 * Presence-check the optional Apple notarisation env (REL-09, T-11-04). Honored
 * if present, never required — any one Apple var present → notarising. Returns a
 * BOOLEAN ONLY, so no value is ever echoed through the pure core.
 */
export function hasAppleEnv(env: ProcessEnv): boolean {
  return APPLE_VARS.some((v) => !!env[v]);
}

/** The macos sub-dir of the UNIVERSAL bundle output — NOT the arm64 `target/release/...`. */
const UNIVERSAL_BUNDLE_MACOS_DIR =
  "src-tauri/target/universal-apple-darwin/release/bundle/macos";

/**
 * The universal Mach-O binary path for the lipo both-arch assert. Pure — the
 * driver derives `productName` from tauri.conf.json (the `.app` bundle name
 * follows it) and `mainBinaryName` from the Cargo binary name (the inner binary
 * keeps the crate name regardless of productName), so a product rename can't
 * silently point the check at a stale bundle again (the TinkerDev-rename bug:
 * a hardcoded `devtools-app.app/...` path "verified" a stale old-name bundle).
 */
export function universalMachoPath(
  productName: string,
  mainBinaryName: string,
): string {
  return `${UNIVERSAL_BUNDLE_MACOS_DIR}/${productName}.app/Contents/MacOS/${mainBinaryName}`;
}

/**
 * The fully-derived view of one publish — every field flows from the single
 * `version` + `productName`, so the dry-run plan, the glob, and the URL can't
 * drift (mirrors the Phase 10 BumpPlan shape).
 */
export interface PublishPlanView {
  version: string;
  tag: string;
  releasesRepo: string;
  universalBundleDir: string;
  sigGlob: string;
  assetUrlExample: string;
}

/**
 * Build the publish-plan view from the single `version` (the version the build
 * used, read from the manifests by the driver) + `productName` (read from
 * tauri.conf.json by the driver — never hardcoded here, so a rename can't
 * stale-drift the glob/URL). The sig glob is product-pinned (not `*`) so a
 * stale old-name `.sig` can never be the single match. Pure — no I/O, no clock.
 */
export function buildPublishPlanView(
  version: string,
  productName: string,
): PublishPlanView {
  return {
    version,
    tag: `v${version}`,
    releasesRepo: RELEASES_REPO,
    universalBundleDir: UNIVERSAL_BUNDLE_MACOS_DIR,
    sigGlob: `${UNIVERSAL_BUNDLE_MACOS_DIR}/${productName}.app.tar.gz.sig`,
    assetUrlExample: buildAssetUrl(version, `${productName}.app.tar.gz`),
  };
}

/**
 * Render the full `--dry-run` publish plan (REL-10) as a pure return-string. It
 * carries the single version, the public target repo, the universal artifact
 * paths, the dual-key it WILL emit (both `darwin-aarch64` + `darwin-x86_64` from
 * one url+sig), the assets-first/manifest-last ordering, and the explicit note
 * that `--dry-run` does NOT run the build. ZERO side effects — the caller prints.
 */
export function renderPublishPlan(view: PublishPlanView): string {
  const lines: string[] = [
    `Publish plan: ${view.version} (tag ${view.tag})`,
    `Target repo: ${view.releasesRepo} (PUBLIC — never the private source)`,
    "",
    "Universal build output (NOT the arm64 target/release dir):",
    `  - ${view.universalBundleDir}/*.app.tar.gz       (updater payload)`,
    `  - ${view.sigGlob}   (fresh signature — single-match)`,
    `  - ${view.universalBundleDir.replace("/macos", "/dmg")}/*.dmg          (first-install asset)`,
    "",
    "latest.json (dual-key from ONE url+sig — Phase 9 buildLatestJson):",
    `  - darwin-aarch64 -> ${view.assetUrlExample}`,
    `  - darwin-x86_64  -> ${view.assetUrlExample}`,
    "",
    "Publish ordering — assets first, manifest last:",
    `  1. gh release create ${view.tag} --repo ${view.releasesRepo} <dmg> <app.tar.gz>`,
    `  2. gh release upload ${view.tag} latest.json --repo ${view.releasesRepo}`,
    `  3. curl -L .../releases/latest/download/latest.json  (verify served version == ${view.version})`,
    "",
    "--dry-run does NOT build (no build, no publish, no curl — zero side effects).",
  ];
  return lines.join("\n");
}

/**
 * Render the copy-pasteable recovery / next-steps string for a failed publish
 * step. Revert-by-republish ethos: NEVER an auto-rollback of the remote release
 * (no `git reset --hard`) — guide the maintainer to fix-forward and re-run.
 */
export function renderPublishRecovery(view: PublishPlanView): string {
  return [
    `A publish step for ${view.tag} did not complete.`,
    "",
    "Nothing is auto-rolled-back (revert-by-republish ethos).",
    "",
    "Inspect what landed, then fix-forward:",
    `  gh release view ${view.tag} --repo ${view.releasesRepo}`,
    `  gh release list --repo ${view.releasesRepo}`,
    "",
    "Re-run after fixing (the script is idempotent up to the publish; it aborts",
    `if the release already exists). To replace bad assets, delete + re-upload:`,
    `  gh release delete-asset ${view.tag} <asset> --repo ${view.releasesRepo}`,
    `  pnpm release:publish`,
  ].join("\n");
}
