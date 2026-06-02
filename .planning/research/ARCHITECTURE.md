# Architecture Research

**Domain:** Local release-automation helper scripts for a Tauri 2 desktop app (macOS-first), split-repo signed publish
**Researched:** 2026-06-02
**Confidence:** HIGH (grounded in this repo's actual files + the existing `docs/RELEASE.md` runbook; no speculative external tooling)

## Summary Verdict

Split the work along the project's existing **"pure logic in `src/lib/`, thin shell on top"** seam — the exact ethos that already governs `decoder.ts`, `src/lib/format/`, and the `platform/` capability seam. The version-bump math and the `latest.json` assembly are **pure, deterministic string/JSON transforms** → put them in **`src/lib/release/`** so the existing `tsc` + `vitest` gate covers them with zero new wiring. The **side-effecting orchestration** (spawning `tauri build`, reading the real `.sig` off disk, `gh release create`, `git tag/push`) is an **impure thin driver** → put it in **`scripts/`** as Node ESM (`.mjs`) invoked via `tsx`/`node`, mirroring how `scripts/e2e-spike.sh` is a thin driver over the real app.

This keeps the testable core inside the `tsc include: ["src"]` + `vitest` net, keeps the I/O out of unit tests, and adds **zero runtime deps** (everything is `node:` builtins + the already-present `@tauri-apps/cli` and `gh` CLI).

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  package.json scripts  (composable entry points — `pnpm release`)      │
│   release  →  release:bump  →  release:publish                         │
└───────────────┬───────────────────────────────┬──────────────────────┘
                │                                │
┌───────────────▼──────────────┐   ┌────────────▼─────────────────────┐
│  IMPURE DRIVERS  (scripts/)   │   │  IMPURE DRIVER  (scripts/)        │
│  bump-and-tag.mjs             │   │  build-and-publish.mjs            │
│  • read/write 3 manifest files│   │  • spawn `tauri build` (universal)│
│  • git add/commit/tag/push    │   │  • locate FRESH *.app.tar.gz(.sig)│
│  • reads secrets? NO          │   │  • read TAURI_SIGNING_* from env  │
│                               │   │  • gh release create --repo …     │
│                               │   │  • write + upload latest.json     │
└───────────────┬──────────────┘   └────────────┬─────────────────────┘
                │ calls (import)                 │ calls (import)
┌───────────────▼────────────────────────────────▼─────────────────────┐
│  PURE LOGIC  (src/lib/release/)  ── tsc + vitest covered, no I/O       │
│  ┌─────────────────────┐   ┌──────────────────────────────────────┐   │
│  │ version.ts          │   │ manifest.ts                          │   │
│  │ • bumpSemver(v,kind)│   │ • buildLatestJson({version, sig,     │   │
│  │ • setPkgVersion(str)│   │     url, notes, pubDate, platforms}) │   │
│  │ • setTauriVersion() │   │ • sigContents string → manifest      │   │
│  │ • setCargoVersion() │   │ • parse `tauri build` artifact names │   │
│  │   (string edits on  │   │ • platformKey(target) →              │   │
│  │    file CONTENTS)   │   │     darwin-aarch64 / -x86_64 /       │   │
│  │                     │   │     universal handling               │   │
│  └─────────────────────┘   └──────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────┘
        ▲                                              ▲
        │ pure fns take/return strings                 │ never touch fs/git/gh
        │ (drivers do the fs.readFile / writeFile)      │
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `src/lib/release/version.ts` | **Pure** semver bump + return new file *contents* for each of the 3 manifests given old contents + bump kind. No fs. | String/regex transforms; `bumpSemver("0.2.1","patch") → "0.2.2"`; `setCargoVersion(toml, v)` edits the `version = "…"` line under `[package]` only |
| `src/lib/release/manifest.ts` | **Pure** assembly of the `latest.json` object from inputs (version, signature string, asset url, notes, pubDate, platform key). | Object construction + `JSON.stringify`; `platformKey()` maps build target → updater key |
| `scripts/bump-and-tag.mjs` | **Impure** driver: read the 3 files, call pure fns, write back, `git add/commit`, `git tag vX.Y.Z`, `git push --follow-tags`. | Node ESM; `node:fs`, `node:child_process` (`execFileSync` git) |
| `scripts/build-and-publish.mjs` | **Impure** driver: spawn `tauri build --target universal-apple-darwin`, locate FRESH `.app.tar.gz` + `.sig`, read `.sig` contents, call `buildLatestJson`, `gh release create --repo bklim5/devtools-releases`, upload assets + `latest.json`, `curl`-verify endpoint. | Node ESM; `node:fs`, `node:child_process`, `gh` CLI |
| `package.json` scripts | Composable entry points so `pnpm release` runs both, but each half is independently runnable. | npm `&&` chaining or one orchestrator script |
| `lefthook.yml` pre-commit | **Unchanged.** Already runs `tsc --noEmit` + `vitest run`; automatically picks up the new `src/lib/release/*.test.ts`. | No edits needed |

## Recommended Project Structure

```
src/
└── lib/
    └── release/                 # NEW — pure, deterministic release logic (tsc + vitest covered)
        ├── version.ts           # bumpSemver + per-manifest content transforms
        ├── version.test.ts      # vitest: patch/minor/major, leading-zero, Cargo-line scoping
        ├── manifest.ts          # buildLatestJson + platformKey(target)
        └── manifest.test.ts     # vitest: schema shape, sig passthrough, url, platform key
scripts/
├── e2e-spike.sh                 # EXISTING (reference for thin-driver conventions)
├── bump-and-tag.mjs             # NEW — impure: edit 3 manifests, commit, tag, push
└── build-and-publish.mjs        # NEW — impure: build, find sig, publish, push latest.json
src-tauri/
├── tauri.conf.json              # MODIFIED ONLY BY bump-and-tag (version line); updater cfg untouched
└── Cargo.toml                   # MODIFIED ONLY BY bump-and-tag (version line) — see Pitfall below
package.json                     # MODIFIED: version line (by script) + new scripts entries
latest.json                      # DELETE from tracking (git rm --cached); already gitignored, generated-only
```

### Structure Rationale

- **`src/lib/release/`:** This is the load-bearing decision. `tsconfig.json` has `include: ["src"]` and `vitest` excludes only `node_modules/dist/scaffold` — so anything under `src/` is *automatically* type-checked and unit-tested by the existing lefthook gate with **no config change**. Putting the pure logic here mirrors `src/lib/format/` (pure transforms) and `src/lib/protobuf/` exactly. The functions take and return strings/objects — never touch `fs`, `git`, or `gh` — so a vitest can cover them with `environment: "node"` (already the default), no DOM, no mocks.
- **`scripts/*.mjs`:** The impure orchestration cannot be unit-tested meaningfully and must NOT pollute the `src/` test net (a test that shells out to `tauri build` is not a unit test). `.mjs` is chosen over `.sh` because (a) the logic is JSON/string manipulation that is painful in bash and trivial in JS, (b) `.mjs` can `import` the pure `src/lib/release/` functions directly, sharing one source of truth with the tests, and (c) `tsx` is already a devDep so a `.ts` variant is even possible — but plain `.mjs` run by `node` needs zero transpile and zero new dep. Keep `e2e-spike.sh` as bash (it is process-orchestration glue); use Node where the work is data transformation.
- **No `src/lib/platform/` involvement:** The platform seam is a *runtime* capability boundary for the shipping app. Release scripts are build-time tooling and must stay entirely out of the runtime bundle — they live outside the Vite entry graph, so they add zero bytes and zero runtime deps.

## Architectural Patterns

### Pattern 1: Pure-core / impure-shell (Functional Core, Imperative Shell)

**What:** All decision logic (what the next version is, what the manifest object looks like) is pure functions in `src/lib/release/`. All effects (disk, git, network, subprocess) live in `scripts/*.mjs` which call the pure functions.
**When to use:** Always here — it is the project's existing ethos (`decoder.ts`, formatters) and is the *only* way to make this logic vitest-coverable given `include: ["src"]`.
**Trade-offs:** Slight indirection (driver must read files and pass contents in), but buys full unit coverage of the only logic that can silently corrupt a release (wrong version, wrong platform key, stale sig wiring).

**Example:**
```typescript
// src/lib/release/version.ts  (PURE — no fs)
export type BumpKind = "patch" | "minor" | "major";
export function bumpSemver(current: string, kind: BumpKind): string { /* … */ }
export function setCargoVersion(tomlText: string, v: string): string {
  // edit ONLY the `version = "…"` line in the [package] table, not deps
}

// scripts/bump-and-tag.mjs  (IMPURE — does the I/O)
import { readFileSync, writeFileSync } from "node:fs";
import { bumpSemver, setCargoVersion } from "../src/lib/release/version.ts"; // via tsx, or compiled
const next = bumpSemver(JSON.parse(readFileSync("package.json")).version, kind);
writeFileSync("src-tauri/Cargo.toml", setCargoVersion(readFileSync("src-tauri/Cargo.toml","utf8"), next));
```

### Pattern 2: Composable npm scripts with a single `pnpm release` umbrella

**What:** Three script entries — `release:bump`, `release:publish`, and `release` (= both) — so a maintainer can run the whole thing or re-run just the publish half after fixing a DMG-mount flake without re-bumping/re-tagging.
**When to use:** Always; the runbook's steps are already two natural halves (version+tag vs build+publish) and the DMG flake (MEMORY: `tauri-dmg-bundle-flake`) makes a re-runnable publish half valuable.
**Trade-offs:** Two entry points to document, but matches the manual runbook's existing section boundaries (§1–§? bump; §3–§6 publish).

**Example:**
```jsonc
// package.json "scripts"
"release:bump":    "node scripts/bump-and-tag.mjs",        // arg: patch|minor|major
"release:publish": "node scripts/build-and-publish.mjs",
"release":         "pnpm release:bump && pnpm release:publish"
// (if importing .ts pure fns directly: "tsx scripts/bump-and-tag.mjs")
```
**Recommendation:** make them **composable, not monolithic.** `pnpm release patch` is the happy path; the split lets you recover from a failed build without re-tagging (re-tagging an existing tag is a footgun).

### Pattern 3: Fresh-artifact discovery by glob-at-publish-time (never trust a path constant)

**What:** `build-and-publish.mjs` discovers the `.app.tar.gz` and `.app.tar.gz.sig` by globbing `src-tauri/target/release/bundle/macos/*.app.tar.gz*` *after* the build it just ran, reads the `.sig` file contents fresh, and feeds that string into `buildLatestJson`. It must assert exactly one match and fail loud on zero/multiple.
**When to use:** Always — this directly defeats the #1 documented pitfall (stale `.sig` → `InvalidSignature`, Pitfall 2 in the runbook).
**Trade-offs:** Universal builds land under a different target path (`target/universal-apple-darwin/release/bundle/macos/…`) than the default arm64 path — the glob root must key off the chosen `--target`.

## Data Flow

### `latest.json` assembly + secrets flow

```
ENV (gitignored, never committed):
  TAURI_SIGNING_PRIVATE_KEY / _PATH        ┐
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD       ├─ read ONLY by `tauri build` subprocess
  APPLE_* (if present → notarise; else ad-hoc) ┘   (script passes env through; never logs/prints it)

`pnpm release:publish`
   │
   ├─► spawn: tauri build --target universal-apple-darwin   (inherits signing env)
   │        └─► emits: bundle/macos/<name>.app.tar.gz  +  .app.tar.gz.sig   (FRESH)
   │
   ├─► glob the macos/ dir → assert exactly one .app.tar.gz + matching .sig
   ├─► read .sig CONTENTS (utf8 string)  ◄── the freshness guarantee
   │
   ├─► buildLatestJson({                       (PURE — src/lib/release/manifest.ts)
   │     version, notes, pubDate: new Date().toISOString(),
   │     platforms: { [platformKey("universal-apple-darwin")]: { signature: sigStr, url } }
   │   })  →  write ./latest.json  (gitignored, throwaway)
   │
   ├─► gh release create vX.Y.Z --repo bklim5/devtools-releases  <dmg> <app.tar.gz>
   ├─► gh release upload  vX.Y.Z latest.json   --repo bklim5/devtools-releases
   └─► curl -L …/releases/latest/download/latest.json   (verify endpoint resolves)
```

**Secret sourcing decision — ENV, not interactive prompt.** The runbook (§2) already standardizes on exported `TAURI_SIGNING_PRIVATE_KEY[_PATH]` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. The script should **read these from the environment and pass them through** to the `tauri build` subprocess (via inherited `env`), and **fail fast with a clear message if the password var is unset** rather than prompting. Rationale: (a) it matches the documented flow and the future CI path (Actions secrets are env), (b) an interactive prompt cannot be used by CI later and would force a rewrite, (c) the script must NEVER echo these values. The signing key itself is consumed entirely inside `tauri build` — the JS never sees the private key, only the resulting `.sig` *output*.

### Version lockstep flow

```
`pnpm release:bump patch`
   │  read current version (package.json = source of truth, currently 0.2.1)
   ├─ bumpSemver("0.2.1","patch") → "0.2.2"        (PURE)
   ├─ setPkgVersion / setTauriVersion / setCargoVersion  (PURE → new file contents)
   ├─ write all 3 files
   ├─ git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
   ├─ git commit -m "chore(release): v0.2.2"
   ├─ git tag v0.2.2
   └─ git push --follow-tags
```

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| `@tauri-apps/cli` (`tauri build`) | Spawned subprocess with inherited signing env; `--target universal-apple-darwin` | Already a devDep. DMG step flakes when other DMGs are mounted (MEMORY: `tauri-dmg-bundle-flake`) — driver should detect the `hdiutil` failure and surface the `hdiutil detach` remedy, optionally auto-unmount-and-retry once |
| `gh` CLI | `gh release create/upload --repo bklim5/devtools-releases` from the private source checkout | `--repo` is mandatory (publish targets the PUBLIC releases repo, not `origin`). Assumes `gh auth` already done locally |
| `git` | `execFileSync` for add/commit/tag/push | Use `execFileSync` (arg array) not `exec` (string) to avoid shell-injection of version strings |
| minisign (via `tauri build`) | Indirect — signing happens inside `tauri build`; script only reads the emitted `.sig` | Script never invokes minisign directly; never handles the private key bytes |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `scripts/*.mjs` ↔ `src/lib/release/*` | Direct ESM `import` of pure fns | One source of truth shared by drivers AND vitest. If importing `.ts` from `.mjs`, run via `tsx` (already a devDep) or keep release lib emit-free and import the `.ts` directly under `tsx` |
| `scripts/` ↔ `tauri.conf.json` updater block | bump script edits ONLY the top-level `version` line | **Do NOT touch** `plugins.updater.pubkey` or `endpoints` — they are correct and load-bearing |
| Release tooling ↔ runtime bundle | **None by design** | Scripts live outside the Vite graph → zero runtime deps, zero bundle bytes (constraint: zero new runtime deps) |
| Release tooling ↔ lefthook | bump script's `git commit` triggers pre-commit (`tsc` + `vitest`) | This is *desirable*: the version-bump commit is gated by the same green-bar. Ensure the bump commit's working tree is clean enough to pass (it will be — only version lines changed) |

## Anti-Patterns

### Anti-Pattern 1: Putting bump/manifest logic in `scripts/` only (untestable)

**What people do:** Write all the semver + JSON-assembly logic inline in the `.mjs` driver under `scripts/`.
**Why it's wrong:** `scripts/` is outside `tsconfig include: ["src"]` and outside the vitest net — the only logic that can silently ship a broken release (wrong version, wrong platform key, mis-scoped Cargo edit) would have **zero test coverage**, violating the project's pure-logic-is-tested ethos.
**Do this instead:** Pure logic in `src/lib/release/` (auto-covered), driver imports it.

### Anti-Pattern 2: Editing every `version = "…"` in `Cargo.toml`

**What people do:** Regex-replace all `version = "…"` lines in `Cargo.toml`.
**Why it's wrong:** `Cargo.toml` has `version = "2"` on `tauri-build`, `tauri`, `serde`, etc. (dependency versions). A blanket replace corrupts dependency pins. **Also note a real, latent bug:** `Cargo.toml` is currently `0.1.0` while `package.json`/`tauri.conf.json` are `0.2.1` — it has drifted because the manual runbook (§1) only bumps the two JSON files. The new `setCargoVersion` must (a) scope to the `[package]` `version` line only, and (b) the milestone should **re-sync Cargo to 0.2.1** as a one-time fix so the first lockstep bump starts aligned.
**Do this instead:** A `setCargoVersion(toml, v)` that targets only the `version` key in the `[package]` table (parse-aware or anchored regex), covered by a vitest that asserts dep versions are untouched.

### Anti-Pattern 3: Committing or reusing `latest.json`

**What people do:** Keep `latest.json` in git and hand-edit it (the current root copy is committed and stale at 0.2.1).
**Why it's wrong:** It is generated per-release from the fresh `.sig`; a committed copy invites stale-signature mismatches. `.gitignore` already ignores `/latest.json` but the file is still *tracked*.
**Do this instead:** `git rm --cached latest.json` once (a milestone task), generate it only in `build-and-publish.mjs`, upload, discard.

### Anti-Pattern 4: Templated `{{arch}}` URL with a static `latest.json`

**What people do:** Put `{{target}}`/`{{arch}}` placeholders in the endpoint or asset URL.
**Why it's wrong:** With a static manifest the plugin reads `platforms.<key>` itself; templating yields a 404 (runbook Pitfall 4).
**Do this instead:** Emit concrete `platforms` keys. For the universal binary, decide the key strategy explicitly (see Open Question) — list both `darwin-aarch64` and `darwin-x86_64` pointing at the same universal artifact, or the single key the plugin matches on a universal host.

## Suggested Phase Build Order

Ordered by dependency (pure core first so the drivers can import + be trusted; lockstep before publish because a tag must exist before a release):

1. **Phase A — Pure release core + housekeeping** (`src/lib/release/`)
   - `version.ts` + `version.test.ts` (semver bump; `setPkg/Tauri/CargoVersion`; Cargo `[package]`-scoping test).
   - `manifest.ts` + `manifest.test.ts` (`buildLatestJson` shape, sig passthrough, `platformKey`).
   - One-time fixes: `git rm --cached latest.json`; re-sync `Cargo.toml` 0.1.0 → 0.2.1.
   - **Why first:** zero I/O, fully unit-testable, de-risks the only silently-corrupting logic; auto-covered by existing lefthook gate. No drivers depend on anything yet.
   - **Gate:** standard tsc + vitest (no new wiring); `/codex:review`.

2. **Phase B — `bump-and-tag` driver + `pnpm release:bump`**
   - `scripts/bump-and-tag.mjs` importing Phase A; wire `release:bump` script.
   - **Why second:** smallest, lowest-risk side-effects (local file edits + git); produces the tag that Phase C's publish needs. Testable by dry-run on a throwaway branch.
   - **Gate:** review → unit (Phase A tests still green) → manual dry-run (`--dry-run` flag prints planned edits/commands without writing/pushing).

3. **Phase C — `build-and-publish` driver + universal binary + `pnpm release` umbrella**
   - `scripts/build-and-publish.mjs`: spawn universal `tauri build`, fresh-sig discovery, `buildLatestJson`, `gh release` create/upload, endpoint curl-verify; DMG-mount flake handling; `APPLE_*`-pass-through (notarise-if-present).
   - Wire `release:publish` + `release` umbrella.
   - **Why last:** depends on Phase A (manifest) + a tag from Phase B; has the heaviest side-effects (network publish to the public repo) and the universal-binary platform-key decision; needs a real round-trip verify (the load-bearing DST-02 proof).
   - **Gate:** review → unit → real round-trip (old version → update → verify minisign → relaunch), per the runbook §7. This is the phase-boundary human sign-off.

## Sources

- `docs/RELEASE.md` (this repo) — the manual runbook being automated; secret env vars, split-repo layout, fresh-sig rule, platform-key/Pitfall list [HIGH]
- `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `tsconfig.json`, `vite.config.ts`, `lefthook.yml`, `.gitignore`, `scripts/e2e-spike.sh` (this repo) — actual conventions, gate scope, and the latent Cargo version drift [HIGH]
- `.planning/PROJECT.md` — milestone scope, constraints (zero new runtime deps, no decoder touch, pure-logic-in-src ethos) [HIGH]
- MEMORY: `tauri-dmg-bundle-flake`, `tauri-store-async-init-race` — operational gotchas the publish driver must handle [HIGH]

---
*Architecture research for: local release-automation helper scripts (Tauri 2, split-repo signed publish)*
*Researched: 2026-06-02*
