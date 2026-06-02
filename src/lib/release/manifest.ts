// Pure Tauri-updater `latest.json` assembly (REL-06, D-03/D-04/D-04a/D-05).
// Assembles the full `latest.json` object from caller-injected values only —
// ZERO runtime AND dev dependencies; NO clock reads, NO `fs`, NO time/IO imports.
// Mirrors the `src/lib/release/version.ts` + `src/lib/format/` convention: pure
// string/object logic the Phase 11 `build-and-publish.mjs` driver wires to real
// I/O (it globs the fresh `.sig`, stamps `pub_date = now`, computes the URL).
//
// Decisions:
// - D-03 PURE: every time/I-O input is injected by the caller. `pub_date` comes
//   ONLY from the passed `pubDate` arg (the clock is read in the caller, not
//   here), so the function is deterministic and unit-assertable with zero mocks.
// - D-04 options object: a single `BuildLatestJsonInput` so the two adjacent
//   `url`/`signature` strings can't be swapped positionally at the call site.
// - D-04a notes default: `notes` is optional and defaults to "".
// - D-05 dual-key: ONE universal `.app.tar.gz` artifact serves both Apple Silicon
//   and Intel, so `platformKey` emits BOTH the aarch64 and x86_64 macOS keys from
//   the SAME `{ url, signature }` — the two keys cannot diverge. No combined
//   single-key variant is emitted (the updater queries the per-arch keys; a stray
//   key it ignores would risk a silent no-update — T-09-07).

/** A single Tauri-updater platform entry: the minisign signature + download URL. */
export interface PlatformEntry {
  signature: string;
  url: string;
}

/** The two macOS arch keys the Tauri updater queries (both served by one universal artifact). */
export interface LatestJsonPlatforms {
  "darwin-aarch64": PlatformEntry;
  "darwin-x86_64": PlatformEntry;
}

/** The full `latest.json` shape, matching the on-disk file exactly (snake_case `pub_date`). */
export interface LatestJson {
  version: string;
  notes: string;
  pub_date: string;
  platforms: LatestJsonPlatforms;
}

/** Inputs for {@link buildLatestJson} — a single options object (D-04). */
export interface BuildLatestJsonInput {
  /** App semver, e.g. "0.2.1". */
  version: string;
  /** RFC3339 timestamp, INJECTED by the caller (D-03 — the clock is read upstream, not here). */
  pubDate: string;
  /** Download URL for the universal `.app.tar.gz`. */
  url: string;
  /** Minisign signature string for THIS build's fresh `.sig`. */
  signature: string;
  /** Optional release notes; defaults to "" (D-04a). */
  notes?: string;
}

/**
 * Build the `platforms` map (D-05): BOTH `darwin-aarch64` and `darwin-x86_64`
 * carry the IDENTICAL `{ signature, url }` — one universal artifact serves both
 * arches, so the two keys can never diverge or carry a swapped signature. No
 * combined single-key variant is emitted.
 */
export function platformKey(entry: PlatformEntry): LatestJsonPlatforms {
  return {
    "darwin-aarch64": { signature: entry.signature, url: entry.url },
    "darwin-x86_64": { signature: entry.signature, url: entry.url },
  };
}

/**
 * Assemble the full `latest.json` object from caller-injected values (D-03).
 * `pub_date` is sourced ONLY from `input.pubDate`; `notes` defaults to "" when
 * omitted (D-04a). Pure — calling twice with identical input returns deep-equal
 * objects.
 */
export function buildLatestJson(input: BuildLatestJsonInput): LatestJson {
  return {
    version: input.version,
    notes: input.notes ?? "",
    pub_date: input.pubDate,
    platforms: platformKey({ url: input.url, signature: input.signature }),
  };
}
