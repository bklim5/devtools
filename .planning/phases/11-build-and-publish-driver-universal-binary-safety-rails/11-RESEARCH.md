# Phase 11: build-and-publish driver + universal binary + safety rails - Research

**Researched:** 2026-06-02
**Domain:** Node ESM maintainer script (thin I/O caller) orchestrating a universal `tauri build`, fresh-`.sig` dual-key `latest.json` assembly, cross-repo `gh` publish, and a post-publish endpoint verify — over the pure Phase 9 `manifest.ts` core
**Confidence:** HIGH (every gray-area command verified in THIS repo on THIS toolchain; the one un-runnable item — the full universal build — is grounded in the official Tauri CLI help text + the existing arm64 bundle layout on disk)

<user_constraints>
## User Constraints

> No `11-CONTEXT.md` exists yet (this phase has not been through `/gsd-discuss-phase`). The constraints below are lifted from the **ROADMAP Phase 11 success criteria + REQUIREMENTS REL-05/06/07/09/12 + the additional_context in the research brief**, and from the conventions the sibling Phase 10 driver locked (D-01..D-11). Treat these as the binding scope the planner must honor; the discuss-phase step (if run) may refine them into formal D-numbers.

### Locked scope (from ROADMAP success criteria + brief)
- **Universal build only** — `tauri build --target universal-apple-darwin`; resolve artifacts at `target/universal-apple-darwin/release/bundle/...` (NOT the arm64-only `target/release/bundle/...`). Assert `lipo -archs` lists both `x86_64 arm64`. A `rustup target add x86_64-apple-darwin` preflight guards the missing target.
- **Fresh-`.sig` dual-key `latest.json`** — single-match glob of THIS build's `*.app.tar.gz.sig` (fail loudly on 0 or >1); list the ONE universal artifact under BOTH `darwin-aarch64` and `darwin-x86_64` (same URL + same signature). **No invented `darwin-universal` key.** This is delivered by the pure `buildLatestJson` (Phase 9) — the driver only wires the I/O.
- **Cross-repo publish** — `gh release create --repo bklim5/devtools-releases` (NEVER `origin` / the private source). Upload DMG + `.app.tar.gz` + `latest.json`, **assets first, manifest last**. Post-publish `curl -L releases/latest/download/latest.json` must show the served `version` == the version just cut.
- **`APPLE_*` honored-if-present, never required** — ad-hoc signing (`signingIdentity: "-"`) stays the default. No secret is ever echoed or passed as a CLI arg.
- **`--dry-run`** — prints the full publish plan with zero side effects (mirror Phase 10 D-05a).
- **Build/publish-half of REL-10/REL-11** — `--dry-run` + preflights: rustup both-targets present, signing key/password present, `gh` auth + push permission on the releases repo, tag exists on the public repo? + vitest/tsc/eslint green.
- **Human-gate** — a real updater round-trip on real hardware is the milestone's load-bearing acceptance (DST-02); universal dual-key behavior confirmed live, not just unit-asserted.

### Claude's discretion (planner decides)
- Where the `--dry-run` boundary sits (recommendation below: dry-run runs read-only preflights + prints the plan, and does NOT build — see §Q6).
- Internal helper decomposition of the `.mjs`; what NEW pure logic to extract into a testable `publishPlan.ts` (recommendation in §Validation Architecture).
- Exact wording of the plan/recovery/abort surfaces (mirror Phase 10's pure render-string pattern).
- Whether the driver also bumps version (NO — Phase 10 owns the bump+tag; this phase consumes the already-pushed tag).

### Deferred / out of scope (do not research/plan)
- CI publishing, cross-repo PAT, Actions secrets → ROADMAP backlog 999.2.
- Apple notarisation **activation** → deferred until Apple Developer enrolment (D-02). Scripts stay notarisation-READY only.
- Rollback / un-publish / key-rotation automation → out of scope (revert-by-republish suffices).
- Windows / Linux pipeline → platform deferred.
- Any change to `manifest.ts` or its tests, or to the decoder → forbidden.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REL-05 | Produce a **universal** macOS binary via `tauri build --target universal-apple-darwin`, resolving artifacts at the universal output path | §Q1 (verified output paths from the on-disk arm64 bundle + Tauri CLI help) + §Q2 (`lipo -archs` assert). **Blocking gap: `x86_64-apple-darwin` target is NOT installed** — the build will fail without the rustup preflight (§Q5 / §Environment) |
| REL-06 | `latest.json` from THIS build's fresh `*.app.tar.gz.sig` (single-match glob, fail on 0/>1), dual `darwin-aarch64` + `darwin-x86_64` keys (same url+sig) | Pure `buildLatestJson`/`platformKey` already authored + tested (Phase 9) — driver globs the sig (§Q3), reads its content verbatim, stamps `pubDate=now`, computes the URL, calls the pure fn, writes the file |
| REL-07 | Publish to public `bklim5/devtools-releases` via `gh release create --repo`, uploading DMG + `.app.tar.gz` + `latest.json` | §Q4 (`gh release create` ordering, tag-exists detection, ADMIN perm verified on the public repo) |
| REL-09 | `APPLE_*` honored if present, never required; ad-hoc stays default; no secret echoed/CLI-passed | §Q7 (env passthrough via `execFileSync` env option; presence-check only; never log values) |
| REL-12 | Post-publish, verify the live endpoint and assert served `version` == version just cut | §Q4 (`curl -L releases/latest/download/latest.json` → parse `version`; GitHub `latest` redirect verified) |

**Cross-phase (build/publish-half, counted under Phase 10 in traceability but DELIVERED here):**
- REL-10 `--dry-run` (publish half) — §Q6
- REL-11 preflights (publish half) — rustup both-targets (§Q5), signing-key/password present (§Q7), `gh` push permission (§Q4), tests-green gate (§Validation)
</phase_requirements>

## Summary

Like Phase 10, this is a **thin I/O caller** — no library to choose, no architecture to invent. It composes Node builtins (`fs`, `child_process`/`execFileSync`, `node:fs` `globSync`) + the `tauri`/`lipo`/`gh`/`curl` CLIs already on the machine + the **pure, already-tested** `buildLatestJson`/`platformKey` from Phase 9. The driver's only original code is: orchestration ordering, the fresh-`.sig` glob, the `lipo` arch assertion, the `latest.json` write, the `gh` publish sequence, the `curl` verify, and the safety-rail preflights/`--dry-run`/recovery surfaces.

**Three findings materially shape the plan and protect the success-criterion checks:**

1. **The `x86_64-apple-darwin` rustup target is NOT installed** (only `aarch64-apple-darwin` is) [VERIFIED: `rustup target list --installed`]. The Tauri CLI help states verbatim that `universal-apple-darwin` *"requires both `aarch64-apple-darwin` and `x86_64-apple-darwin` targets to be installed."* So **the universal build will fail today** until `rustup target add x86_64-apple-darwin` runs. This is exactly criterion #1's preflight — it is not optional polish, it is the thing that makes the first run work at all.

2. **The universal build emits to a DIFFERENT, currently-nonexistent path** — `target/universal-apple-darwin/release/bundle/macos/*.app.tar.gz{,.sig}` and `.../dmg/*.dmg` — NOT the arm64 `target/release/bundle/...` path the old runbook and the existing on-disk bundle use [VERIFIED: arm64 bundle exists at `target/release/bundle/`; universal dir absent]. **The fresh-`.sig` glob MUST be scoped to the universal dir**, and there is a real glob-pollution hazard: the arm64 `target/release/bundle/macos/` already holds a **stale** `devtools-app.app.tar.gz.sig` (from a prior 0.2.1 build) and a stray temp DMG (`rw.86630.devtools-app_0.1.0_aarch64.dmg`). Globbing the wrong dir, or a non-clean dir, is the single biggest "stale signature ships" risk (Pitfall P1).

3. **The `.sig` file content is a single base64 blob to be read verbatim into the `signature` field.** [VERIFIED: read the on-disk `.sig` — it is the exact string the existing `latest.json` `signature` carries]. The driver reads the globbed file, `.trim()`s, and passes it straight to `buildLatestJson({ signature })`. No parsing, no transformation. The pure function then duplicates it into both arch keys by construction (Phase 9 guarantees the two keys cannot diverge).

**Primary recommendation:** `scripts/build-and-publish.mjs`, run via `pnpm release:publish` (+ a `release` umbrella that chains bump then publish, if desired), importing `../src/lib/release/manifest.ts` through `tsx`. Extract a NEW pure `src/lib/release/publishPlan.ts` (arg parse, arch-token parse, single-match glob assertion, URL builder, plan/recovery render-strings) so the testable logic stays out of the I/O driver — exactly mirroring the Phase 10 `bumpPlan.ts` ↔ `bump-and-tag.mjs` split. Order: read-only preflights (incl. tests-green + rustup + gh-perm) → `--dry-run` short-circuit (no build) → `rustup target add` (idempotent) → universal build → `lipo` assert → fresh-`.sig` glob → write `latest.json` → `gh release create` (assets first) → `gh release upload latest.json` (last) → `curl` verify → print "now do the manual round-trip" gate.

## Standard Stack

This phase adds **zero dependencies** (runtime or dev). It composes builtins + already-present CLIs + the Phase 9 pure core.

### Core
| Tool | Version (verified) | Purpose | Why standard here |
|------|--------------------|---------|-------------------|
| Node builtins | v22.21.1 | `node:fs` (`readFileSync`/`writeFileSync`/`globSync`), `node:child_process` `execFileSync` (run tauri/lipo/gh/curl/rustup), `node:process` (env, argv, exit) | Zero-dep ethos (CLAUDE.md); `fs.globSync` is stable in Node 22 (§Q3) [VERIFIED: `node --version`] |
| `tsx` | 4.22.3 | Run the `.mjs` + import the Phase 9 `.ts` core with no build step | Already a devDep; proven in Phase 10 |
| Tauri CLI | 2.11.2 | `tauri build --target universal-apple-darwin` | Project bundler; `--target universal-apple-darwin` documented in `tauri build --help` [VERIFIED] |
| `lipo` | Apple cctools (`/usr/bin/lipo`) | `-archs` assertion on the Mach-O inside the `.app` | Native macOS; `lipo -archs <bin>` prints space-separated arch tokens [VERIFIED: `lipo -archs /bin/ls` → `x86_64 arm64e`] |
| `gh` CLI | 2.93.0 | `release create/upload --repo`, `auth status`, `repo view` | Already installed; ADMIN on the public releases repo [VERIFIED] |
| `curl` | 8.7.1 | Post-publish endpoint verify (`-L` follows the GitHub `latest` redirect) | Native; the runbook already uses it (RELEASE.md §6) |
| `rustup` | 1.29.0 | `target add x86_64-apple-darwin` (idempotent preflight) | Native to the Rust toolchain |

### Phase 9 core consumed (no changes to it)
| Symbol | Source | Use in driver |
|--------|--------|---------------|
| `buildLatestJson({ version, pubDate, url, signature, notes? })` | `src/lib/release/manifest.ts` | Assemble the full `latest.json` object from the globbed sig + computed url + `pubDate=now` |
| `platformKey(entry)` | same | (called internally by `buildLatestJson`; the dual-key guarantee) |
| Types `LatestJson` / `BuildLatestJsonInput` | same | Typed inputs for the driver's call (under tsx) |

`buildLatestJson` is **pure and already proven** to emit both arch keys from one `{url,signature}` (no `darwin-universal`, no divergence possible by construction) [VERIFIED: read `manifest.ts` + STATE.md Phase 9 record, 8 tests]. The driver must NOT modify it — it injects the three I/O-derived values (`pubDate`, `url`, `signature`) and the version, and writes `JSON.stringify(obj, null, 2)`.

### Alternatives Considered
| Instead of | Could Use | Why rejected |
|------------|-----------|--------------|
| `fs.globSync` | a `glob`/`fast-glob` dep | Zero-new-deps line; the builtin covers a single-dir `*.app.tar.gz.sig` match (§Q3) |
| `execFileSync(..., {env})` for `APPLE_*` | exporting via shell / interpolating | Never put a secret on a CLI arg or in a shell string; pass through the inherited env, presence-check only (§Q7) |
| `gh release create` with all assets in one call | per-asset `gh release upload` | Either works, BUT **manifest must land LAST** so the `latest` redirect never resolves to a `latest.json` whose referenced assets aren't uploaded yet (§Q4). Recommend: create the release with DMG + `.app.tar.gz` (assets), then `gh release upload latest.json` as a separate final step. |
| `curl` for the verify | `gh release view --json` | `curl -L releases/latest/download/latest.json` tests the **actual updater endpoint** (the redirect + the served bytes), which is what REL-12 asserts — `gh` API would test a different path |
| whole-graph parse of the `.app` for the binary | direct path to `Contents/MacOS/<productName>` | The Mach-O is at a known path inside the bundle (§Q2); no need to walk |

**Installation:** none. Wire `package.json` scripts:
```jsonc
"release:publish": "tsx scripts/build-and-publish.mjs",
"release": "..."  // optional umbrella: bump then publish — planner's call
```

**Version verification:** No npm packages added. Toolchain versions above are all `--version` / `--help` outputs captured this session (2026-06-02).

## Architecture Patterns

### Recommended file layout
```
scripts/
├── bump-and-tag.mjs        # Phase 10 — the driver pattern to MIRROR
└── build-and-publish.mjs   # NEW — this phase (thin I/O caller)
src/lib/release/
├── manifest.ts             # Phase 9 — imported, NOT modified
├── manifest.test.ts        # Phase 9 — immovable contract
├── publishPlan.ts          # NEW (recommended) — pure: arg/arch parse, glob assert, url builder, render-strings
└── publishPlan.test.ts     # NEW — Wave 0 harness for the pure half
```

### Pattern 1: Mirror the Phase 10 pure-core ↔ thin-driver split (load-bearing)
**What:** Put every decision/string-building/assertion that does NOT touch I/O into a pure `publishPlan.ts` (unit-tested); keep `build-and-publish.mjs` as the thin shell that does fs/subprocess/network and calls the pure helpers + `buildLatestJson`.
**Why:** This is the exact ethos the whole milestone is built on (pure logic in `src/lib/`, I/O in thin callers). Phase 10's `bumpPlan.ts`/`bump-and-tag.mjs` is the proven template — match its structure, helper naming style (`parse*`, `assert*`, `render*`, `build*`), and its `execFileSync`-argv-array safety invariant.
```js
// build-and-publish.mjs imports the pure core (under tsx):
import { buildLatestJson } from "../src/lib/release/manifest.ts";
import {
  parsePublishArgs, assertSingleSig, parseLipoArchs,
  buildAssetUrl, renderPublishPlan, renderPublishRecovery,
} from "../src/lib/release/publishPlan.ts";
```

### Pattern 2: Ordered pipeline with a single effectively-irreversible gate (the publish)
**What:** `parse args → read version (from package.json/tauri.conf) → read-only preflights → [--dry-run prints plan + exits, NO build] → rustup target add (idempotent) → universal build → lipo assert → glob fresh sig → write latest.json → gh release create (assets) → gh release upload latest.json (last) → curl verify → print manual-round-trip gate`.
**Why:** Everything up to `gh release create` is local + reversible. The publish is the irreversible step (mirrors Phase 10's push). Order matters for `--dry-run` and fail-fast.

### Pattern 3: `--dry-run` short-circuits BEFORE the slow build
**What:** In `--dry-run`, run the read-only preflights and PRINT the full publish plan (version, target repo, expected artifact paths, the dual-key it WILL emit, the `gh`/`curl` commands), then exit 0 — **do NOT run `tauri build`** (it's slow and writes target/), do NOT `gh`/`curl`/write `latest.json`.
**Why:** REL-10 criterion #4 "zero side effects." A dry-run that builds would write hundreds of MB to `target/` and take minutes — not "zero side effects." (Contrast Phase 10, where dry-run is cheap; here the build is the expensive side effect to skip.)
**Note for the planner:** This is a genuine discretion point flagged in the brief. Recommendation: **dry-run does NOT build.** If a "build but don't publish" mode is later wanted, that is a *separate* flag (`--no-publish`), not `--dry-run` — but per the brief, keep flags minimal (mirror Phase 10 D-02: only `--dry-run`).

### Anti-Patterns to Avoid
- **Globbing the arm64 `target/release/bundle/` dir** (stale `.sig` + stray temp DMG live there) — glob ONLY `target/universal-apple-darwin/release/bundle/macos/` (Pitfall P1).
- **Reusing a stale `.sig`** — the entire reason `manifest.ts` exists (RELEASE.md §5). Glob THIS build's dir, assert exactly one match (Pitfall P1/P2).
- **Publishing `latest.json` before the assets** — the updater could fetch a manifest whose `.app.tar.gz` 404s (Pitfall P3).
- **Publishing to `origin` / the private source repo** — the endpoint is the PUBLIC `devtools-releases` repo; private repos don't serve `releases/latest/download` to unauthenticated updater clients (Pitfall P5). Always pass `--repo bklim5/devtools-releases`.
- **Echoing or CLI-passing `TAURI_SIGNING_*` / `APPLE_*`** — presence-check only; pass through `env`, never log values (Pitfall P6 / Security).
- **`execSync` with interpolated strings** — use `execFileSync` argv arrays (mirror Phase 10's T-10-04).
- **Committing `latest.json`** — it is generate-only + gitignored (`/latest.json`, Phase 9 REL-08). The driver writes it to disk and uploads it; it never `git add`s it.
- **Asserting only the host arch in `lipo`** — must assert BOTH `x86_64` AND `arm64` present (criterion #1), regardless of token order or an `arm64e` suffix (§Q2).

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| `latest.json` assembly + dual-key | object-literal in the driver | Phase 9 `buildLatestJson` | Pure, tested, the two arch keys cannot diverge by construction |
| Universal binary | a per-arch build matrix + manual `lipo -create` | `tauri build --target universal-apple-darwin` | Tauri does the dual-arch compile + `lipo -create` + bundles in one step [CITED: `tauri build --help`] |
| `.sig` → signature transform | base64 decode/re-encode | read the file verbatim + `.trim()` | The `.sig` file content IS the `signature` field string (§Q3) [VERIFIED] |
| GitHub release + asset upload | GitHub REST API calls | `gh release create/upload --repo` | Handles auth, multipart upload, the `latest` redirect; already installed |
| Endpoint verify | hand-rolled HTTP | `curl -L` + `node` JSON.parse | `-L` follows the GitHub `latest` → release redirect; trivial |
| arch-token / arg / url parsing | inline in the `.mjs` | a pure `publishPlan.ts` | Keeps it unit-testable (mirrors `bumpPlan.ts`) |
| Single-match glob assertion | ad-hoc array length check buried in I/O | pure `assertSingleSig(matches)` | Testable fail-on-0/>1 logic out of the I/O path |

**Key insight:** identical to Phase 10 — this phase's value is that it does NOT hand-roll. It orchestrates the already-tested pure core + standard CLIs. The only original code is orchestration, I/O, and the human-facing surfaces.

---

## Code Examples / Targeted Findings (the gray areas — VERIFIED in-repo unless noted)

### Q1. What `tauri build --target universal-apple-darwin` emits, and where
**Command (signing env exported first — §Q7):**
```bash
pnpm tauri build --target universal-apple-darwin
```
**Output paths** — under `src-tauri/target/universal-apple-darwin/release/bundle/` (the universal target dir, NOT `target/release/bundle/`):

| Artifact | Path (relative to `src-tauri/`) | Purpose |
|----------|----------------------------------|---------|
| DMG | `target/universal-apple-darwin/release/bundle/dmg/devtools-app_<version>_universal.dmg` | first-install asset |
| Updater payload | `target/universal-apple-darwin/release/bundle/macos/devtools-app.app.tar.gz` | what the updater downloads |
| Payload signature | `target/universal-apple-darwin/release/bundle/macos/devtools-app.app.tar.gz.sig` | the fresh `.sig` to glob |
| `.app` | `target/universal-apple-darwin/release/bundle/macos/devtools-app.app` | the bundle (Mach-O inside, for `lipo`) |

- The **arm64 build already on disk** has the analogous layout at `target/release/bundle/` (`macos/devtools-app.app.tar.gz{,.sig}`, `dmg/devtools-app_0.2.1_aarch64.dmg`) [VERIFIED: `ls`]. The universal layout mirrors it under the universal target dir; the DMG name carries `universal` rather than `aarch64` [CITED: Tauri target-dir convention; the precise DMG filename is confirmable at execution by `ls` after the first build — glob it rather than hard-coding].
- `createUpdaterArtifacts: true` is already set [VERIFIED: `tauri.conf.json`], so the `.app.tar.gz` + `.sig` are produced automatically when the signing env is present. **Without `TAURI_SIGNING_PRIVATE_KEY` (+ password), the `.sig` is NOT produced and the build fails** ("A public key has been found, but no private key" / cannot decrypt) — that is the gate working (§Q7).
- **Plan implication:** resolve ALL artifacts by globbing the universal bundle dir (`dmg/*.dmg`, `macos/*.app.tar.gz`, `macos/*.app.tar.gz.sig`). Do NOT hard-code the DMG filename (it embeds the version). Glob each, assert single-match.

### Q2. `lipo` arch assertion — exact command + path to the Mach-O
**The Mach-O binary lives inside the `.app`** at:
```
target/universal-apple-darwin/release/bundle/macos/devtools-app.app/Contents/MacOS/devtools-app
```
(`Contents/MacOS/<productName>`; `productName` is `devtools-app` [VERIFIED: `tauri.conf.json`].)
**Command + parse:**
```bash
lipo -archs "<.app>/Contents/MacOS/devtools-app"
# universal binary prints e.g.: "x86_64 arm64"  (space-separated tokens)
```
- `lipo -archs <bin>` prints space-separated arch tokens [VERIFIED: `lipo -archs /bin/ls` → `x86_64 arm64e`].
- **Assertion (pure `parseLipoArchs`):** split on whitespace; require the set to contain BOTH `x86_64` AND `arm64`. **Caveat:** Apple sometimes reports `arm64e` (a variant) for system binaries — but a Tauri/Rust app binary is `arm64`, not `arm64e`. Recommend: assert `archs.includes("x86_64")` AND (`archs.includes("arm64")` || `archs.includes("arm64e")`) to be robust, OR strictly require `arm64` and treat `arm64e` as a fail (cleaner). **Recommend strict `x86_64` + `arm64`** for a Rust-compiled universal binary; document that `arm64e` would indicate something unexpected. Either way the parse is a pure, unit-testable function (feed it fixture strings).
- Run this against the **built universal `.app`** (criterion #1) — it is the proof the binary is genuinely fat, independent of the build command claiming success.

### Q3. Fresh-`.sig` glob — single-match, THIS build's
**Command (Node builtin glob, scoped to the UNIVERSAL macos bundle dir):**
```js
import { globSync, readFileSync } from "node:fs";
const sigDir = "src-tauri/target/universal-apple-darwin/release/bundle/macos";
const sigs = globSync(`${sigDir}/*.app.tar.gz.sig`);
assertSingleSig(sigs);                 // pure: throw on 0 ("build produced no .sig — signing env?") or >1 ("ambiguous")
const signature = readFileSync(sigs[0], "utf8").trim();   // verbatim into latest.json
```
- `node:fs` `globSync` is stable in Node 22 [VERIFIED: `node --version` → v22.21.1]. (If the planner prefers maximum portability, `readdirSync(sigDir).filter(f => f.endsWith(".app.tar.gz.sig"))` is an equivalent zero-risk fallback.)
- **The `.sig` content is read verbatim** — it is a single base64 line that drops straight into the `signature` field [VERIFIED: read the on-disk `.sig`; its bytes equal the `signature` the live `latest.json` carries].
- **"THIS build's fresh sig" guarantee** — three layers, in order of strength:
  1. **Scope to the universal dir** (the arm64 `target/release/bundle/macos/` holds a stale `.sig` from a prior 0.2.1 build — globbing the universal dir avoids it entirely) [VERIFIED: stale `.sig` present in the arm64 dir].
  2. **Single-match assertion** — fail loudly on >1 (an old universal `.sig` left from a prior universal build of a different version would trip this; the maintainer cleans the dir). The 0-match case means the signing env was absent / build didn't sign — fail with that hint.
  3. **(Optional, strongest) build-from-clean** — `rm -rf target/universal-apple-darwin/release/bundle` (or a `cargo clean`-scoped equivalent) before the build so the dir contains ONLY this run's output. Recommend at minimum deleting the prior universal bundle's `macos/*.app.tar.gz.sig` before building, so the single-match assertion is meaningful across repeated same-version builds. **Planner decision** — the cheapest robust option is "remove the universal bundle macos dir's prior `.sig` before build, then assert exactly one after."
- **mtime is NOT a reliable freshness signal** across reruns; prefer the clean-dir + single-match approach over mtime comparison.

### Q4. `gh release` publish semantics + the post-publish verify
**Auth + permission preflight (REL-11):**
```bash
gh auth status                                  # logged in?  [VERIFIED: bklim5, scopes incl. 'repo']
gh repo view bklim5/devtools-releases --json viewerPermission   # "ADMIN" (write OK)  [VERIFIED]
```
- `gh` is authed as `bklim5` with `repo` scope; `viewerPermission` on `bklim5/devtools-releases` is `ADMIN` [VERIFIED]. Both are sufficient to create releases + upload assets. The preflight should assert `viewerPermission` ∈ {`ADMIN`,`WRITE`,`MAINTAIN`} and abort otherwise.

**Tag-already-released detection (REL-07 idempotency):**
```bash
gh release view "v<version>" --repo bklim5/devtools-releases   # exit 0 == release EXISTS == abort
```
- Existing public releases: `v0.2.0`, `v0.2.1` [VERIFIED: `gh release list`]. **`v0.2.2` is NOT yet released** on the public repo (the tag was pushed to the private `origin` in Phase 10, but never published here) — so `v0.2.2` is the next real publish candidate. The preflight aborts if `gh release view v<version>` succeeds (already published) rather than clobbering.

**Publish sequence — assets first, manifest LAST (Pitfall P3):**
```bash
# 1) create the release with the binary assets (NO latest.json yet):
gh release create "v<version>" \
  --repo bklim5/devtools-releases \
  "<universal-dir>/dmg/"*.dmg \
  "<universal-dir>/macos/"*.app.tar.gz \
  --title "v<version>" --notes "<notes>"
# 2) THEN upload the manifest as the final asset:
gh release upload "v<version>" latest.json --repo bklim5/devtools-releases
```
- **Why order matters:** `releases/latest/download/latest.json` is GitHub's stable redirect to the newest release. The moment a release is published, it can become "latest." If `latest.json` is uploaded *before* the `.app.tar.gz`, a polling updater could fetch a manifest whose referenced download 404s → broken auto-update for everyone. Uploading the manifest **last** ensures that whenever the updater can see `latest.json`, the asset it points at already exists. (Also why the `url` in `latest.json` must use the `releases/download/v<version>/...` form — the per-tag asset URL — which is exactly what Phase 9's `buildAssetUrl`-fed `buildLatestJson` produces.)

**Post-publish verify (REL-12):**
```bash
curl -L https://github.com/bklim5/devtools-releases/releases/latest/download/latest.json
```
- `-L` follows the `latest` → newest-release redirect [the runbook already uses this, RELEASE.md §6]. Parse the JSON (`JSON.parse` in the `.mjs`), assert `served.version === "<version just cut>"`. A mismatch means either the redirect hasn't propagated or a wrong release is latest — fail loudly with both values printed.
- **URL builder (`buildAssetUrl`, pure):** `https://github.com/bklim5/devtools-releases/releases/download/v<version>/<assetBasename>` — used for the `url` field passed into `buildLatestJson`. Unit-test it against fixture versions/basenames.

### Q5. `rustup` both-targets preflight (the criterion-#1 guard)
```bash
rustup target list --installed        # must contain BOTH aarch64-apple-darwin AND x86_64-apple-darwin
rustup target add x86_64-apple-darwin # idempotent: no-op if already added
```
- **VERIFIED GAP:** today only `aarch64-apple-darwin` is installed; `x86_64-apple-darwin` is **absent** [VERIFIED: `rustup target list --installed`]. The Tauri CLI help confirms the universal build *"requires both ... targets to be installed"* [VERIFIED: `tauri build --help`]. So this is a **blocking** preflight, not a nicety.
- **Recommendation:** the preflight parses `rustup target list --installed`; if `x86_64-apple-darwin` is missing, either (a) abort with the exact `rustup target add x86_64-apple-darwin` command for the maintainer, OR (b) run `rustup target add x86_64-apple-darwin` itself (idempotent, needs network on a cold cache). The brief's criterion #1 says *"a `rustup target add x86_64-apple-darwin` preflight guards the missing target"* — reads as the script **running** the add. Recommend: **run `rustup target add` idempotently** as part of the build prep (it's safe + idempotent), but still verify-after so a failed add (offline) aborts before the slow build. In `--dry-run`, only *report* the missing target, don't add it.

### Q6. `--dry-run` design (the boundary)
- **Recommendation: dry-run runs the read-only preflights and PRINTS the full publish plan, then exits 0 WITHOUT building.** Rationale: the `tauri build` is the expensive, target/-writing side effect; "zero side effects" (REL-10 #4) is only honest if the build is skipped. The plan it prints (a pure `renderPublishPlan` string): computed version, target repo, the exact artifact globs it WILL resolve, the dual-key it WILL emit (both arch keys, same url+sig), and the `gh`/`curl` command lines.
- This **differs from Phase 10's dry-run** (which is cheap and runs everything-but-writes). Here the build is too costly to run in a preview — flag this difference for the planner; it is the one place the two drivers' dry-run semantics legitimately diverge.
- Dry-run MUST NOT: run `tauri build`, `rustup target add`, write `latest.json`, call `gh`, or `curl`. It MAY run the read-only preflights (`rustup target list`, `gh auth status`, `gh repo view`, the tests gate is the planner's call — see note) so the plan reflects real state.
  - **Sub-decision:** should `--dry-run` run the slow-ish `vitest+tsc+eslint` gate? Recommend **yes for the real run, optional/skippable mention in dry-run** — but to keep flags minimal, simplest is: dry-run runs the *fast read-only git/gh/rustup* preflights + prints the plan, and notes "the test gate runs on the real publish." Planner's call.

### Q7. `APPLE_*` + signing env — honored-if-present, never required, never echoed
**Signing key (mandatory for a signed `.sig`; this is the minisign/updater key, NOT Apple):**
```js
// presence-check ONLY — never log the value:
const hasSigningKey =
  !!process.env.TAURI_SIGNING_PRIVATE_KEY || !!process.env.TAURI_SIGNING_PRIVATE_KEY_PATH;
const hasSigningPw = !!process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD;
if (!hasSigningKey || !hasSigningPw) abort("signing env missing (TAURI_SIGNING_PRIVATE_KEY[_PATH] + _PASSWORD). The .sig cannot be produced.");
```
- These two env vars are **required** (the `.sig` cannot exist without them — RELEASE.md §2). The preflight checks presence (REL-11). They are passed to `tauri build` **via the inherited process env** (`execFileSync("pnpm", ["tauri","build",...], { env: process.env })` — the default), NEVER as CLI args, NEVER logged [VERIFIED: RELEASE.md §2 lists exactly these var names].

**Apple notarisation env (OPTIONAL — honored if present, never required — REL-09):**
```js
const APPLE_VARS = ["APPLE_API_KEY","APPLE_API_ISSUER","APPLE_API_KEY_PATH","APPLE_SIGNING_IDENTITY","APPLE_ID","APPLE_PASSWORD","APPLE_TEAM_ID"];
const notarising = APPLE_VARS.some((v) => process.env[v]);  // boolean only
// log ONLY the boolean: `log(notarising ? "Apple notarisation env detected — notarising." : "Ad-hoc signing (no APPLE_* env) — default.")`
```
- **Tauri notarises automatically when the `APPLE_*` env is present** [CITED: RELEASE.md §"Post-enrolment notarisation flip" step 3]. The driver does nothing special — it just inherits the env into the `tauri build` call. With NO `APPLE_*` set, ad-hoc signing (`signingIdentity: "-"`) is the default [VERIFIED: `tauri.conf.json`]. So REL-09 is satisfied simply by **passing through `process.env` and never requiring the Apple vars** — the only driver-side logic is a boolean presence-check for the human-readable log line. **Never echo any value.**
- The exact Apple var names vary by auth method (API-key: `APPLE_API_KEY`/`APPLE_API_ISSUER`/`APPLE_API_KEY_PATH`; Apple-ID: `APPLE_ID`/`APPLE_PASSWORD`/`APPLE_TEAM_ID`). The brief names `APPLE_ID`/`APPLE_PASSWORD`/`APPLE_TEAM_ID`; RELEASE.md uses the API-key set. The driver should presence-check the **union** (any present → "notarising") and otherwise pass through — it does not need to validate *which* set; Tauri handles that [ASSUMED: the union check is sufficient — see Assumptions A1].

## Runtime State Inventory

> Script-authoring phase (new `.mjs` + new pure `.ts` + package.json scripts). Most categories N/A; the build-output + endpoint items materially affect the criterion checks.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no datastore touched. | None. |
| Live service config | **The updater endpoint** `https://github.com/bklim5/devtools-releases/releases/latest/download/latest.json` is pinned in `tauri.conf.json` and lives on the PUBLIC `bklim5/devtools-releases` repo (ADMIN access verified). Existing public releases: `v0.2.0`, `v0.2.1`; `v0.2.2` tag pushed to private origin but NOT yet published here [VERIFIED]. | The publish must target this repo (`--repo`), never `origin`. Post-publish `curl` of this exact endpoint verifies the round-trip (REL-12). |
| OS-registered state | None. | None. |
| Secrets/env vars | `TAURI_SIGNING_PRIVATE_KEY[_PATH]` + `_PASSWORD` (REQUIRED for the `.sig`; presence-checked, never echoed). `APPLE_*` (OPTIONAL; presence → notarise, never echoed). Key lives at `~/.tauri/devtools.key`, gitignored (`*.key`); public half is in `tauri.conf.json` `pubkey` [VERIFIED: gitignore + RELEASE.md]. | Presence-check only; pass through inherited env; never log values, never CLI-pass. |
| Build artifacts | **Stale arm64 bundle on disk** at `target/release/bundle/macos/devtools-app.app.tar.gz.sig` (from a prior 0.2.1 build) + a stray temp DMG `rw.86630.devtools-app_0.1.0_aarch64.dmg` [VERIFIED]. The **universal** dir `target/universal-apple-darwin/...` does NOT exist yet. `target/` is gitignored. | Glob the UNIVERSAL dir only; consider clearing the universal bundle's prior `.sig` before build so the single-match assertion stays meaningful (§Q3 / P1). |

## Common Pitfalls

### P1: Globbing the wrong dir / a stale `.sig` ships (HIGHEST RISK)
**What goes wrong:** Globbing `target/release/bundle/macos/*.app.tar.gz.sig` (the arm64 dir, which holds a stale 0.2.1 `.sig`), or a universal dir polluted by a prior build's `.sig`, drops a **wrong signature** into `latest.json`. The updater then downloads the new payload, the signature doesn't match → `InvalidSignature` → **every install refuses to update** (or, worse, a coincidentally-valid stale pair installs the wrong bytes).
**Avoid:** Glob ONLY `target/universal-apple-darwin/release/bundle/macos/*.app.tar.gz.sig`; assert exactly one match (`assertSingleSig`); clear the universal bundle dir's prior `.sig` before building (§Q3). The post-publish `curl` + the mandatory manual round-trip (criterion #5) are the backstops.
**Warning sign:** >1 `.sig` match; or the updater's `InvalidSignature` on the round-trip.

### P2: 0-match glob (signing env absent) silently produces no manifest
**What goes wrong:** If `TAURI_SIGNING_*` env is missing, `createUpdaterArtifacts` can't sign → no `.sig` → glob matches 0. If not asserted, the driver builds a `latest.json` with an empty/garbage signature.
**Avoid:** Presence-check the signing env in preflight (§Q7) AND `assertSingleSig` (fail on 0 with the hint "build produced no .sig — was the signing env exported?").
**Warning sign:** "0 matches" abort; or a build that never printed "Signing..." 

### P3: Manifest published before the assets → broken auto-update window
**What goes wrong:** Uploading `latest.json` first means the `latest` redirect can serve a manifest whose `.app.tar.gz` isn't uploaded yet → updater gets a 404 on download.
**Avoid:** `gh release create` with the DMG + `.app.tar.gz` FIRST, then `gh release upload latest.json` LAST (§Q4).
**Warning sign:** updater "failed to download" right after a publish.

### P4: Per-arch `latest.json` key mismatch / templating
**What goes wrong:** Emitting only the host arch (`darwin-aarch64`) leaves Intel users unserved; OR adding a `{{target}}` template / a `darwin-universal` key the updater doesn't query → silent no-update.
**Avoid:** `buildLatestJson` already emits BOTH `darwin-aarch64` + `darwin-x86_64` from one `{url,signature}` (Phase 9, structurally enforced). The driver must NOT post-process the keys.
**Warning sign:** Intel install never sees the update; or a stray platform key.

### P5: Publishing to the private source repo instead of the public releases repo
**What goes wrong:** `gh release create` without `--repo` targets the current checkout's repo (`bklim5/devtools`, private) → unauthenticated updater clients can't fetch → updates silently fail for everyone.
**Avoid:** ALWAYS `--repo bklim5/devtools-releases`. Preflight `gh repo view bklim5/devtools-releases` to confirm reachability + write perm (§Q4).
**Warning sign:** a release appears on the private repo; updater gets 404/auth errors.

### P6: A secret leaks into a log / CLI arg / shell history
**What goes wrong:** Echoing `$TAURI_SIGNING_PRIVATE_KEY` or passing `APPLE_PASSWORD` as a `gh`/`tauri` CLI arg puts it in process listings + logs.
**Avoid:** Presence-check booleans only; pass via inherited `env`; `execFileSync` argv arrays (no shell). Never `log()` an env value (§Q7 / Security).
**Warning sign:** any secret-looking string in the script's stdout.

### P7: Universal build fails because `x86_64-apple-darwin` isn't installed (TODAY's state)
**What goes wrong:** `tauri build --target universal-apple-darwin` errors on the missing Intel std target — the build dies before producing anything.
**Avoid:** `rustup target add x86_64-apple-darwin` preflight (idempotent), verified-after (§Q5). This is criterion #1's explicit guard.
**Warning sign:** "can't find crate for `std`" / "target may not be installed" from the Intel arch step.

### P8: `--dry-run` accidentally runs the slow build (writes target/)
**What goes wrong:** A dry-run that builds violates "zero side effects" and burns minutes.
**Avoid:** Short-circuit BEFORE `tauri build` in dry-run (§Q6).
**Warning sign:** dry-run takes minutes / leaves a fresh `target/universal-apple-darwin/`.

## State of the Art

| Old approach (RELEASE.md manual dance) | Current approach (this driver) | Why |
|----------------------------------------|--------------------------------|-----|
| `pnpm tauri build` (arm64-only) | `tauri build --target universal-apple-darwin` | Closes the Intel gap (REL-05); one artifact serves both arches |
| Hand-paste `cat *.app.tar.gz.sig` into `latest.json` (RELEASE.md §5, "NEVER reuse a stale .sig") | Glob THIS build's universal `.sig`, single-match assert, feed pure `buildLatestJson` | Removes the fragile manual paste — the exact failure §5 warns about |
| Single `darwin-aarch64` key on a local build | Dual `darwin-aarch64` + `darwin-x86_64` (same url+sig) | Serves Intel users from the universal artifact (REL-06) |
| Eyeball the published release | Post-publish `curl -L latest.json` + assert `version` (REL-12) + mandatory round-trip | Catches a broken/stale publish before it auto-installs onto users |

**Deprecated/outdated for THIS repo:**
- RELEASE.md §3's arm64-only build + §5's single-key, hand-pasted `latest.json` are exactly what this driver replaces. The §"Per-arch caveat" gap is closed by the universal build.

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | Presence-checking the UNION of Apple var names ("any present → notarising, else ad-hoc") is sufficient; Tauri validates which set is complete | §Q7 | If a partial/incompatible `APPLE_*` set is present, `tauri build` fails — but that's a loud, correct failure, not a silent wrong release. Low risk; REL-09 only requires "honored if present, never required." |
| A2 | The universal DMG filename embeds `universal` (e.g. `devtools-app_<v>_universal.dmg`) rather than an arch; the driver should glob `dmg/*.dmg` not hard-code it | §Q1 | If the name differs, a hard-coded path would miss it — mitigated by recommending a glob + single-match (so the exact name is irrelevant). Verify by `ls` after the first real build. |
| A3 | `node:fs` `globSync` is acceptable; if the planner wants belt-and-suspenders, `readdirSync().filter()` is the zero-risk fallback | §Q3 | None material — both are builtins; fallback documented. |
| A4 | Asserting strict `arm64` (not `arm64e`) in `lipo` is correct for a Rust universal binary | §Q2 | If Tauri ever emitted `arm64e`, a strict check would false-fail; documented the lenient alternative. Very low — Rust/macOS app binaries are `arm64`. |
| A5 | The universal bundle layout mirrors the verified arm64 layout (`macos/*.app.tar.gz{,.sig}`, `dmg/*.dmg`) one dir up under the universal target | §Q1 | The full build wasn't run this session (slow + writes target/). Grounded in the on-disk arm64 layout + Tauri's documented per-target dir convention. Confirm by `ls` on the first real build. |

**Everything else was VERIFIED by executing the command in-repo this session.** The only un-run item is the multi-minute universal `tauri build` itself (A2/A5) — its inputs (target dir convention, signing env, `createUpdaterArtifacts`) and the arm64 analog are all verified.

## Open Questions

1. **Does the script run `rustup target add` itself, or just abort with the command?** (§Q5)
   - Known: `x86_64-apple-darwin` is absent today; the universal build needs it.
   - Recommendation: run it (idempotent), verify-after, abort if the add fails (offline cold cache). In `--dry-run`, only report.

2. **Clean-dir strategy before the build for a meaningful single-match glob.** (§Q3)
   - Recommendation: at minimum delete the universal bundle's prior `macos/*.app.tar.gz.sig` before building; assert exactly one after. Full `cargo clean` is heavier and unnecessary.

3. **Does `--dry-run` run the test gate?** (§Q6)
   - Recommendation: real run yes; dry-run runs only the fast read-only git/gh/rustup preflights + prints the plan. Planner's call.

4. **`notes` / release-body content.** `buildLatestJson` defaults `notes` to `""`; `gh release create --notes` needs *something*. Recommendation: a minimal default (e.g. the tag) or a `--notes`-passthrough; auto-changelog is explicitly deferred (REL-F1). Planner's call.

5. **Does this phase add a `release` umbrella script** (bump then publish), or stay `release:publish`-only? Brief mentions wiring `pnpm release:publish` + a `release` umbrella. Recommendation: ship `release:publish`; the umbrella is optional polish.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| node | run the script | ✓ | v22.21.1 | — |
| tsx | import the `.ts` core | ✓ (devDep) | 4.22.3 | — |
| Tauri CLI | universal build | ✓ | 2.11.2 | — |
| `aarch64-apple-darwin` rust target | universal build (arm half) | ✓ | installed | — |
| **`x86_64-apple-darwin` rust target** | **universal build (Intel half)** | **✗ MISSING** | — | **`rustup target add x86_64-apple-darwin` (the criterion-#1 preflight) — BLOCKING until added** |
| lipo | arch assertion | ✓ | /usr/bin/lipo | — |
| gh | cross-repo publish + verify | ✓ (auth: bklim5, ADMIN on releases repo, `repo` scope) | 2.93.0 | — |
| curl | endpoint verify | ✓ | 8.7.1 | — |
| jq | (optional) JSON parse | ✓ | present | use Node `JSON.parse` (preferred; no jq dep) |
| `TAURI_SIGNING_PRIVATE_KEY` + `_PASSWORD` | signing the `.sig` | env-dependent (maintainer exports at run time) | — | none — REQUIRED; preflight aborts if absent |
| `bklim5/devtools-releases` (network) | publish + verify | ✓ reachable, PUBLIC, ADMIN | — | abort if unreachable/no-perm |

**Missing dependencies with no fallback (BLOCKING):**
- `x86_64-apple-darwin` rust target — **the universal build fails today without it.** The `rustup target add` preflight is the fix and is part of criterion #1.

**Missing dependencies with fallback:**
- jq → Node `JSON.parse` (preferred, no dep).

## Validation Architecture

> `workflow.nyquist_validation: true` (treated enabled). Phases 9–11 touch NO app UI, so the real-WKWebView per-task gate is N/A. **This phase's load-bearing validation is the real updater round-trip on real hardware (DST-02, criterion #5)** — a mandatory MANUAL human gate. The strategy: push every testable decision into a pure `publishPlan.ts` (unit-tested), keep the irreversible build/publish/round-trip behind the manual gate.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.7 [VERIFIED: package.json] |
| Config file | vitest auto-discovers `src/**/*.test.ts` (Phase 9/10 release tests already run) |
| Quick run command | `pnpm test` (= `vitest run`, non-watch) |
| Full suite command | `pnpm test && pnpm exec tsc --noEmit && pnpm lint` |

### Phase Requirements → Test Map
| Req | Behavior | Test type | Automated command | File exists? |
|-----|----------|-----------|-------------------|--------------|
| REL-06 | dual-key `latest.json` from one url+sig | unit (pure `manifest.ts`) | `pnpm test` (existing manifest.test.ts) | ✅ (Phase 9) |
| REL-06 wiring | glob → single-match → verbatim sig → assembled manifest | unit (pure `assertSingleSig` + `buildAssetUrl`) over fixtures | `pnpm test` (NEW publishPlan.test.ts) | ❌ Wave 0 |
| REL-05 | `lipo` shows both arches | unit (pure `parseLipoArchs` over fixture strings) + **manual** (real build) | `pnpm test` for the parser; real build for the binary | ❌ Wave 0 (parser) / manual (build) |
| REL-07 | publish to public repo, assets-first | **manual** (irreversible publish) — preflight/ordering logic unit-testable in isolation | `--dry-run` shows the plan; real publish is the gate | ❌ manual-only |
| REL-09 | `APPLE_*` honored/not-required, no echo | unit (pure presence-check helper) + grep-audit "no secret logged" | `pnpm test` + a negative grep | ❌ Wave 0 |
| REL-12 | served `version` == cut version | unit (pure version-compare helper) + **manual** (live curl) | parser unit; live curl on the real publish | ❌ Wave 0 (parser) / manual (curl) |
| REL-10 | `--dry-run` zero side effects (no build/publish) | integration | run `--dry-run`, assert no `target/universal-...` created, no `latest.json` written, no release made | ❌ Wave 0 |
| REL-11 | preflights abort before build | integration | force missing target / missing signing env / wrong perm → assert non-zero exit, no build | ❌ Wave 0 |
| DST-02 | older install → detect → minisign verify → relaunch | **MANUAL human gate (load-bearing)** | real round-trip on real hardware, both arches if possible | ❌ manual-only |

### Sampling Rate
- **Per task commit:** `pnpm test` (the immovable 19 decoder tests + release-core tests stay green).
- **Per wave merge / before the real publish:** `pnpm test && pnpm exec tsc --noEmit && pnpm lint` (the gate the script also runs as a preflight).
- **Phase gate:** full gate green + a `--dry-run` proving zero side effects + **the manual updater round-trip** (criterion #5).

### Wave 0 Gaps
- [ ] `src/lib/release/publishPlan.test.ts` — covers the NEW pure helpers (arg parse, `assertSingleSig` fail-on-0/>1, `parseLipoArchs` both-arch assertion, `buildAssetUrl`, version-compare for the curl verify, `APPLE_*` presence-check, `renderPublishPlan`/`renderPublishRecovery`). Mirrors `bumpPlan.test.ts`.
- [ ] Decide how the driver's I/O behavior is exercised without a real publish — extract ALL decision/string/assert logic into `publishPlan.ts`; keep `tauri build` / `gh` / `curl` / the round-trip behind the manual gate. (Same ethos as Phase 10's Wave 0.)
- [ ] A negative grep proving no env-secret value is ever passed to `log()`/CLI args (Security).
- No framework install needed (vitest present).

**Pure logic to EXTRACT into `publishPlan.ts` (unit-testable) vs. MUST be manual:**
- **Unit-testable (extract):** arg parsing; `assertSingleSig(matches[])`; `parseLipoArchs(stdout)` → both-arch boolean; `buildAssetUrl(owner/repo, version, basename)`; `extractServedVersion(json)` + `assertVersionMatches`; `APPLE_*`/signing presence helpers; `renderPublishPlan`/`renderPublishRecovery`.
- **MUST be manual / real-hardware:** the universal `tauri build` itself; `lipo` against the real built binary; the `gh` publish; the `curl` against the live endpoint; and — load-bearing — the **older-install → detect → minisign-verify → relaunch** round-trip (DST-02, criterion #5), ideally exercised on BOTH an arm64 and an x86_64 install to prove the dual-key behavior live.

## Security Domain

> `security_enforcement` not set → treated as enabled. Local maintainer script; the sensitive surface is **secret handling** (signing key + Apple creds) and **publishing the correct, signed artifact to the correct public repo**.

### Applicable ASVS Categories
| ASVS | Applies | Control |
|------|---------|---------|
| V5 Input Validation | yes (narrow) | CLI arg is `--dry-run` only (+ no level here); reject unknown tokens (pure `parsePublishArgs`). Don't pass arbitrary strings to tauri/gh/curl. |
| V6 Cryptography | yes | The minisign signature is the DST-02 backstop. **Never hand-roll** — the `.sig` is produced by Tauri's signer; the driver only copies its bytes verbatim. The pubkey in `tauri.conf.json` is the committed trust anchor; the round-trip verifies against it. |
| V7 / V14 Secret management | yes | `TAURI_SIGNING_*` + `APPLE_*` are env-only, gitignored (`*.key`, `*.p8`, `.env*`), presence-checked, **never echoed or CLI-passed**. |
| V2/V3/V4 Auth/Session/Access | no (delegated) | Publish auth is `gh`'s existing token (the maintainer's); the script asserts permission, doesn't manage auth. |

### Known Threat Patterns for {macOS Tauri release publish}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stale / wrong `.sig` shipped → updater serves wrong-or-unverifiable bytes | Tampering | Glob the universal dir only, single-match assert, fresh build; the mandatory round-trip verifies against the committed pubkey (P1/P2) |
| Publish to the wrong (private) repo → updater can't fetch, OR a manifest published before assets | DoS / Tampering | `--repo bklim5/devtools-releases` always; assets-first/manifest-last ordering; post-publish `curl` verify (P3/P5) |
| Signing key / Apple password leaked via log or CLI arg | Information disclosure | Presence-check booleans only; inherited `env`; `execFileSync` argv arrays; never `log()` a value; negative-grep audit (P6) |
| Shell injection via an interpolated arg | Tampering | `execFileSync` with argv arrays (never `execSync` strings) — mirror Phase 10 T-10-04 |
| Wrong version in `latest.json` vs. the built binary | Tampering | Single computed version sourced from the manifest the build used; post-publish `curl` asserts served `version` == cut version (REL-12) |
| Missing Intel arch → silent no-update for x86_64 users | DoS | Dual-key `latest.json` (Phase 9) + `lipo` both-arch assert + (ideally) a real x86_64 round-trip in the manual gate (P4/P7) |

## Sources

### Primary (HIGH — executed/observed this session)
- `node --version` → v22.21.1; `pnpm --version` → 11.5.0; `cargo --version` → 1.96.0; `rustc -vV` host → aarch64-apple-darwin; `rustup --version` → 1.29.0; `pnpm exec tauri --version` → tauri-cli 2.11.2; `gh --version` → 2.93.0; `curl --version` → 8.7.1
- `rustup target list --installed` → ONLY `aarch64-apple-darwin` (x86_64 MISSING — the blocking gap)
- `tauri build --help` → `--target universal-apple-darwin` requires BOTH aarch64 + x86_64 targets installed
- `lipo -archs /bin/ls` → `x86_64 arm64e` (space-separated token format)
- `gh auth status` → bklim5, scopes incl. `repo`; `gh repo view bklim5/devtools-releases` → PUBLIC, viewerPermission ADMIN; `gh release list` → v0.2.0, v0.2.1 exist (v0.2.2 not yet published)
- `ls target/release/bundle/{macos,dmg}` → verified arm64 bundle layout + the stale `.sig` + stray temp DMG; universal dir absent
- `cat target/release/bundle/macos/*.app.tar.gz.sig` + on-disk `latest.json` → confirmed `.sig` content is the verbatim `signature` string
- Read in full: `manifest.ts`, `bumpPlan.ts`, `bump-and-tag.mjs`, `tauri.conf.json`, `package.json`, `docs/RELEASE.md`, REQUIREMENTS, ROADMAP, STATE, Phase 9/10 CONTEXT, Phase 10 RESEARCH, `.gitignore`

### Secondary (MEDIUM)
- Tauri's per-target output-dir convention (`target/<triple>/release/bundle/...`) — documented behavior + the verified arm64 analog; the exact universal DMG filename confirmable on the first real build (A2/A5)
- Tauri auto-notarises when `APPLE_*` env present — RELEASE.md §"Post-enrolment notarisation flip" step 3

### Tertiary (LOW)
- None — no claim rests on unverified web search.

## Metadata

**Confidence breakdown:**
- Universal build paths + signing (Q1/Q7): **HIGH** for the path convention + signing-env requirement (verified arm64 analog + CLI help + `tauri.conf.json`); **MEDIUM** only for the exact universal DMG filename (A2 — glob it).
- rustup gap + lipo assert (Q5/Q2): **HIGH** — directly observed (the missing x86_64 target is the load-bearing finding).
- gh publish + curl verify (Q4): **HIGH** — auth/perm/existing-releases all observed; ordering rationale is the documented GitHub `latest`-redirect behavior.
- glob/fresh-sig (Q3): **HIGH** — `.sig` content + stale-dir hazard directly observed.
- dry-run boundary (Q6): **HIGH** (recommendation) — grounded in "the build is the expensive side effect."

**Research date:** 2026-06-02
**Valid until:** ~2026-07-02 (stable toolchain). Re-confirm: the `x86_64-apple-darwin` target install state, the universal DMG filename on the first real build, and that no new public release pre-empts the next version.
