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
