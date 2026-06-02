# Stack Research

**Domain:** Local release-automation helper scripts for a Tauri 2 macOS desktop app (dev-tooling, not a runtime feature)
**Researched:** 2026-06-02
**Confidence:** HIGH

> **Headline:** This milestone needs **zero new libraries** — not even devDependencies. Everything is achievable with tools already installed and already in the repo: **Node 22 built-ins** (the script runtime, `tsx` is already a devDep), the **Tauri CLI 2.11.2** (already a devDep, `@tauri-apps/cli@^2`), the **`gh` CLI 2.93.0** (already authenticated, `repo` scope present), **`rustup`/`cargo`** (toolchain), and **git**. The only *prerequisite action* is `rustup target add x86_64-apple-darwin` (an SDK target, not an npm dependency). The zero-runtime-dep constraint is trivially satisfied (these are build-time/dev-time tools), and even the zero-new-devDep bar is met.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Node.js built-ins** (`node:fs`, `node:child_process`, `node:util`) | v22.21.1 (installed) | Script runtime for `bump-and-tag` + `build-and-publish` | Already the project's runtime. The three version files are simple line edits / JSON; reading + regex-replacing them needs no library. `child_process.execFileSync` runs `tauri`/`gh`/`git`. **No new dependency.** |
| **tsx** | `^4.22.3` (already a devDep) | Run the scripts as `.ts` (typed, consistent with the codebase) | Already in `devDependencies` for the e2e/wdio config. Lets scripts be TypeScript with no build step (`tsx scripts/release.ts`). Alternatively write plain `.mjs` and need nothing at all. |
| **Tauri CLI** | **2.11.2** (installed; pinned `@tauri-apps/cli@^2`) | `tauri build --target universal-apple-darwin` → app + dmg + updater artifacts + `.sig` | Already the build tool. `--target universal-apple-darwin` is officially supported (verified in the v2 CLI reference). `createUpdaterArtifacts: true` is already set, so the `.app.tar.gz` + `.sig` are emitted. **No new dependency.** |
| **GitHub CLI (`gh`)** | **2.93.0** (installed, authed as `bklim5`) | Create the Release on the public repo + upload assets | Already authenticated with `repo` scope (verified — sufficient for cross-repo release writes). `gh release create --repo bklim5/devtools-releases` targets the public repo from the private checkout. **No new dependency.** |
| **rustup / cargo** | rustc 1.96.0 (installed) | Cross-compile both arches for the universal `lipo` step | Toolchain, not a package. Universal build needs **both** `aarch64-apple-darwin` (installed) **and** `x86_64-apple-darwin` (**MISSING — must add**) targets. |

### Supporting Libraries

**None required.** This is the deliberate recommendation. Below are the libraries you might be tempted to add, and why each is unnecessary here:

| Library | Verdict | Reasoning |
|---------|---------|-----------|
| `@iarna/toml` / `smol-toml` (TOML parse/write for Cargo.toml) | **Skip** | `Cargo.toml`'s `[package].version` is a single well-known line (`version = "0.1.0"`). A scoped regex replace on the first `version =` under `[package]` is safe and dependency-free. A full TOML round-trip risks reformatting the whole manifest. |
| `semver` | **Skip** | Bumping patch/minor/major on a clean `X.Y.Z` is ~6 lines of integer math. No pre-release/range logic is in scope. |
| `release-it` / `changesets` / `standard-version` | **Skip** | Heavy, opinionated, npm-publish-centric, and none of them natively bump `Cargo.toml` **or** `tauri.conf.json`. They would still need a custom hook to do the Tauri/Cargo files — i.e. you write the hard part anyway. Over-tooling for two scripts. |
| `tauri-version` (community npm) | **Skip** | Bumps `package.json` + `tauri.conf.json` but **not** `Cargo.toml`, and adds a dependency + a trust surface for logic you can inline. Tauri has **no** first-party three-file sync (tracked, unresolved, in tauri-apps/tauri#8265). |
| `tauri-latest-json` (crates.io) | **Skip** | A Rust crate to assemble `latest.json`. The manifest is ~15 lines of JSON; `JSON.stringify` from Node is simpler and stays in the JS toolchain. |
| `@octokit/rest` (GitHub REST API client) | **Skip** | `gh` is already installed and authenticated. The REST API + a PAT only becomes necessary in the **CI** phase (parked). For local scripts, `gh` is strictly simpler. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `git` | tag + push (the push is what a future CI release would key off) | `bump-and-tag` runs `git commit` → `git tag vX.Y.Z` → `git push --follow-tags` against the **private source** `origin`. |
| `hdiutil` | DMG flake recovery (Pitfall 5) | The build-and-publish script should detect a DMG-step failure and surface the `hdiutil detach` remediation (see MEMORY `tauri-dmg-bundle-flake`). Consider unmounting stray DMGs pre-build. |
| `lipo` (Xcode) | Invoked **by Tauri**, not by you | Tauri runs the `lipo` merge during `--target universal-apple-darwin`. Requires Xcode CLT (already present for any prior macOS build). |

---

## The Four Questions — Concrete Answers

### (1) Version-bump tooling: hand-rolled Node script (NOT a library)

**Recommendation: hand-rolled.** Verified that Tauri ships **no** first-party mechanism to sync all three files (tauri-apps/tauri#8265 is open/unresolved). `tauri.conf.json`'s `version` *can* be set to a path to `package.json` to inherit it — **but** (a) this repo hard-codes `"version": "0.2.1"` in `tauri.conf.json`, and (b) there is **no** equivalent for `Cargo.toml`. So a script is unavoidable regardless of library choice; adding a library just wraps the same edits.

**Three files, single source of truth = `package.json`:**

| File | Field | Current | How to edit |
|------|-------|---------|-------------|
| `package.json` | `"version"` | `0.2.1` | `JSON.parse` → bump → `JSON.stringify` (preserve 2-space indent + trailing newline). |
| `src-tauri/tauri.conf.json` | `"version"` | `0.2.1` | Same JSON read/write (top-level key). |
| `src-tauri/Cargo.toml` | `[package] version` | **`0.1.0` (out of sync!)** | Regex replace the **first** `version = "..."` (it sits under `[package]`, lines 1–6, before `[build-dependencies]`). Do NOT touch dependency `version` lines. |

**Decision to surface for the roadmapper:** backlog 999.2 noted Cargo.toml was "NOT part of" the D-16 lockstep and 0.1.0. The confirmed milestone scope now **includes** Cargo.toml. First run must **resync** it `0.1.0 → <new>` (a one-time jump, not a clean increment). The bump script should set all three to the *computed target version* (from `package.json` base), not assume they already match — i.e. derive next version from `package.json`, then **write** all three, which self-heals the Cargo drift.

**Bump math (`patch|minor|major`):** read `package.json` version `X.Y.Z` → patch `Z+1` / minor `Y+1, Z=0` / major `X+1, Y=0, Z=0`. ~10 lines, no `semver` dep.

**Sequence:** validate clean working tree → compute version → write 3 files → `pnpm install --lockfile-only` (refresh `pnpm-lock.yaml` if it pins the root version; check whether it does) → `git add` the 3 files (+ lockfile) → `git commit -m "release: vX.Y.Z"` → `git tag vX.Y.Z` → `git push --follow-tags`. Wire as `pnpm release` via a `package.json` script (e.g. `"release": "tsx scripts/release.ts"`).

### (2) Universal macOS binary with Tauri 2

**Command (verified, official):**
```bash
pnpm tauri build --target universal-apple-darwin
```
`universal-apple-darwin` is explicitly accepted by `tauri build --target` (Tauri v2 CLI reference: *"...or `universal-apple-darwin` for an universal macOS application"*). Tauri performs the `lipo` merge of the two arch binaries into one fat `.app`.

**Prerequisite (BLOCKER until done):** both Rust targets must be installed. Verified the host has **only** `aarch64-apple-darwin`:
```bash
rustup target add x86_64-apple-darwin   # MISSING — add this (aarch64 already present)
```
Omitting `x86_64-apple-darwin` produces a hard build error (tauri-apps/tauri#8664). This is an SDK target, **not** an npm/cargo dependency — no `Cargo.toml`/`package.json` change.

**Output path CHANGES (critical — RELEASE.md paths break):** a targeted build nests under the target triple:
```
src-tauri/target/universal-apple-darwin/release/bundle/dmg/*.dmg
src-tauri/target/universal-apple-darwin/release/bundle/macos/*.app.tar.gz
src-tauri/target/universal-apple-darwin/release/bundle/macos/*.app.tar.gz.sig
```
vs. the current arm64 default `src-tauri/target/release/bundle/...`. **Every hardcoded `target/release/bundle/...` glob in `docs/RELEASE.md` and the scripts must become `target/universal-apple-darwin/release/bundle/...`.** Glob the actual files (don't hardcode product names) so a `productName`/version change can't silently miss assets.

**Signing env unchanged:** the same `TAURI_SIGNING_PRIVATE_KEY` (or `_PATH`) + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` exports from RELEASE.md §2 apply; `createUpdaterArtifacts: true` still emits one `.app.tar.gz` + one `.sig` for the universal app.

**Notarisation-ready:** honor `APPLE_*` env if present (RELEASE.md "post-enrolment flip"). Tauri auto-notarises when `APPLE_API_KEY`/`APPLE_API_ISSUER`/`APPLE_API_KEY_PATH`/`APPLE_SIGNING_IDENTITY` are set. Scripts must **not require** them (ad-hoc `signingIdentity: "-"` stays the default this milestone, D-02).

### (3) Generating `latest.json` from the FRESH `.sig`

**Schema (verified against Tauri v2 updater docs):** required = `version` + per-platform `url` + `signature`; optional = `notes`, `pub_date` (RFC 3339). `signature` is the **literal contents** of the `.sig` file (docs: *"A path or URL does not work!"*).

**Universal-binary platform keys — the rough edge RELEASE.md flags (Pitfall 7):** the updater plugin matches `platforms.<os-arch>` by the *running app's* arch and has **no** `darwin-universal` key. So a universal asset must be listed under **BOTH** macOS keys, pointing at the **same** URL and the **same** signature:

```json
{
  "version": "X.Y.Z",
  "notes": "What changed in this release.",
  "pub_date": "2026-06-02T12:00:00Z",
  "platforms": {
    "darwin-aarch64": {
      "signature": "<contents of THIS build's *.app.tar.gz.sig>",
      "url": "https://github.com/bklim5/devtools-releases/releases/download/vX.Y.Z/<name>.app.tar.gz"
    },
    "darwin-x86_64": {
      "signature": "<SAME contents of THIS build's *.app.tar.gz.sig>",
      "url": "https://github.com/bklim5/devtools-releases/releases/download/vX.Y.Z/<name>.app.tar.gz"
    }
  }
}
```
This closes the arm64-only gap from the current docs: Intel users (`darwin-x86_64`) are now served, and because the asset is a fat universal binary, the same `.app.tar.gz` + `.sig` satisfy both keys.

**Generation (Node, in `build-and-publish`):**
1. Glob the single `*.app.tar.gz.sig` under `…/universal-apple-darwin/release/bundle/macos/` — **fail loudly if zero or >1 match** (stale-artifact guard; never reuse an old `.sig` — RELEASE.md Pitfall 2).
2. `fs.readFileSync(sigPath, 'utf8').trim()` → embed as `signature` in both platform entries.
3. Derive `version` from `package.json` (single source of truth); set `pub_date` = `new Date().toISOString()`; `notes` from a flag/arg or the tag annotation.
4. Construct each `url` from the known release base + the actual `.app.tar.gz` filename → `JSON.stringify(manifest, null, 2)` → write `latest.json`.

**Stop committing `latest.json`:** verified the root `latest.json` (0.2.1) is **already gitignored** (`.gitignore:11 /latest.json`) and **already untracked** (`git ls-files latest.json` returns nothing). So "stop committing it" is effectively **already done** — the script just regenerates the local file each run; nothing to gitignore or `git rm`. (Roadmapper: treat this as a no-op verification, not a task.)

### (4) GitHub Release on a DIFFERENT (public) repo from a local machine

**Recommendation: `gh release create --repo`** (not the raw REST API). `gh` is installed (2.93.0) and authenticated as `bklim5` with `repo` scope (verified) — which is exactly the scope that authorizes writing releases to *another* repo you own. The REST API + `@octokit` + a PAT is only worth it in CI (where `GITHUB_TOKEN` is repo-scoped to the source and can't cross repos — parked).

```bash
gh release create vX.Y.Z \
  --repo bklim5/devtools-releases \
  --title "vX.Y.Z" \
  --notes "What changed in this release." \
  "$DMG" "$APP_TARGZ" latest.json
```

**Cross-repo tag nuance (must handle):** the `vX.Y.Z` tag created by `bump-and-tag` lives in the **private source** repo, not in `devtools-releases`. Verified behavior: if the tag is absent in the **target** repo, `gh release create` **auto-creates** it from the target repo's **default-branch HEAD**. `bklim5/devtools-releases` holds only artifacts (likely an empty/near-empty default branch) — so the auto-created tag is cosmetic and harmless (the updater only reads `latest.json`'s `version`/`url`, never the tag's tree). This is fine, but the script should:
- Pass all three assets in the **same** `gh release create` call (atomic), OR `gh release create` then `gh release upload vX.Y.Z latest.json --repo …` (matches current RELEASE.md §6).
- Be **idempotent**: if the release already exists (re-run), prefer `gh release upload --clobber` over a second `create` (which errors). Detect via `gh release view vX.Y.Z --repo … >/dev/null 2>&1`.

**Auth:** no new auth needed for local runs (existing `gh` login suffices). A **cross-repo PAT** is a **CI-only** concern (parked) — do not add it now.

**Post-publish verification (keep from RELEASE.md §6–7):**
```bash
curl -L https://github.com/bklim5/devtools-releases/releases/latest/download/latest.json
```
confirms the pinned updater endpoint resolves to the new manifest before trusting the round-trip.

---

## Installation

```bash
# NO npm/pnpm install needed — no new packages.

# One-time toolchain prerequisite (SDK target, not a package dependency):
rustup target add x86_64-apple-darwin      # aarch64-apple-darwin already installed

# Verify the tools the scripts shell out to (all already present):
pnpm tauri --version      # tauri-cli 2.11.2
gh --version              # 2.93.0
gh auth status            # logged in as bklim5, scope: repo
rustup target list --installed   # must show BOTH apple-darwin targets after the add
```

Add scripts to `package.json` (devtooling only, no deps):
```jsonc
"scripts": {
  "release": "tsx scripts/release.ts",          // bump-and-tag
  "release:publish": "tsx scripts/publish.ts"   // build-and-publish
}
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Hand-rolled Node bump of 3 files | `tauri-version` npm | Never for this repo — it omits `Cargo.toml`, the exact file that's currently drifted. |
| Hand-rolled bump | `release-it` + custom hooks | A larger project wanting changelog generation, npm publish, and GitHub release in one orchestrator — overkill for two local scripts; still needs custom Tauri/Cargo hooks. |
| Regex-edit `Cargo.toml` `[package].version` | TOML parser (`smol-toml`) | If Cargo.toml grows multiple `[package]`-like sections or you later need to read other Cargo fields programmatically. Not now (single known line). |
| `gh release create --repo` | `@octokit/rest` + PAT | The **CI** phase (parked): Actions `GITHUB_TOKEN` can't write cross-repo, so CI needs a fine-grained PAT, at which point Octokit or `gh` with `GH_TOKEN=$PAT` both work. |
| `gh release create --repo` | GitHub REST `POST /releases` via `curl` | Only if `gh` were unavailable; more boilerplate (asset upload is a separate multipart call), no benefit locally. |
| Both arches via `universal-apple-darwin` | Two separate `darwin-x86_64` + `darwin-aarch64` builds + assets | If you ever want smaller per-arch downloads instead of a fat binary. Trade-off: two builds, two assets, two real signatures — more complexity. Universal is simpler for one dev machine. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Any **new runtime dependency** | Hard constraint — the wedge is zero-runtime-dep (only `js-md5` exists). Release tooling is build-time only; nothing it touches ships in the app. | Node built-ins + already-installed CLIs. |
| `{{target}}` / `{{arch}}` templating in the updater endpoint or `latest.json` `url` | With a **static** `latest.json` this 404s (RELEASE.md Pitfall 4); the plugin selects `platforms.<key>` itself. | Two literal platform keys (`darwin-aarch64`, `darwin-x86_64`) → same universal URL. |
| Reusing a previous build's `.sig` | Per-payload signature; mismatch → updater (correctly) refuses with `InvalidSignature` (RELEASE.md Pitfall 2). | Glob THIS build's `.sig`; fail if 0 or >1 match. |
| Hardcoding `target/release/bundle/...` paths | Universal builds emit under `target/universal-apple-darwin/release/bundle/...`; old paths silently miss assets. | Path off the target triple; glob actual filenames. |
| `darwin-universal` platform key | Not a key the plugin matches; updater keys are strictly `os-arch`. | List the universal asset under both `darwin-aarch64` and `darwin-x86_64`. |
| A cross-repo PAT in the local scripts | Unneeded — local `gh` is already authed; introduces a secret to manage prematurely. | Existing `gh` login (CI-phase concern only). |
| `git push` to the **releases** repo | The source must stay private; `devtools-releases` holds only Release assets, no source/tags-from-source. | `gh release create --repo` (API-level, no git push); auto-tag in target is harmless. |
| Full TOML re-serialization of `Cargo.toml` | Reformats/reorders the whole manifest, noisy diffs, risk to dependency lines. | Scoped regex on the single `[package].version` line. |

---

## Stack Patterns by Variant

**If staying local-only (this milestone):**
- `gh` CLI + existing login; no PAT, no Actions secrets.
- Universal build on the dev machine (`x86_64` target added once).
- `latest.json` generated locally, uploaded as a Release asset.

**If/when CI is unparked (future milestone — explicitly out of scope now):**
- Cross-repo **fine-grained PAT** (the default Actions `GITHUB_TOKEN` cannot write releases to `devtools-releases`).
- minisign **private key + password** → GitHub Actions **secrets** (mandatory for DST-02 verify-before-apply).
- **macOS runner** required for `tauri build` (and the universal `lipo`); private-repo minutes are billed.
- The two local scripts should be authored **CI-callable** (read env, no interactive prompts, deterministic paths) so CI wraps them rather than reimplements.

---

## Version Compatibility

| Component | Version / State | Notes |
|-----------|-----------------|-------|
| `@tauri-apps/cli` | 2.11.2 installed (`^2`) | `--target universal-apple-darwin` supported; `createUpdaterArtifacts` already on. |
| `@tauri-apps/plugin-updater` | 2.10.1 | Static `latest.json` consumer; matches `platforms.<os-arch>` by running arch — drives the dual-key universal pattern. |
| `gh` | 2.93.0 | `--repo`, `--clobber`, auto-tag-on-create all present. Token scope `repo` = cross-repo release write OK. |
| rustup targets | `aarch64-apple-darwin` ✓, `x86_64-apple-darwin` ✗ | **Add x86_64 before first universal build** — hard blocker otherwise. |
| Node | 22.21.1 | `node:fs`/`child_process`/`util.parseArgs` all stable; no polyfills. |
| `tsx` | 4.22.3 (devDep) | Runs the `.ts` scripts directly; already present. |
| `pnpm` | 11.5.0 | `pnpm-lock.yaml` — check whether it pins the root `version`; if so, refresh it in `bump-and-tag` to avoid a dirty tree on next install. |

---

## Sources

- Tauri v2 CLI reference (`https://v2.tauri.app/reference/cli/`) — confirmed `tauri build --target universal-apple-darwin` is accepted; `-t/--target`, `-b/--bundles` flags. **HIGH** (official docs).
- Tauri v2 Updater plugin (`https://v2.tauri.app/plugin/updater/`) — `latest.json` schema: required `version` + per-platform `url`/`signature`; `signature` = literal `.sig` contents ("A path or URL does not work!"); `os-arch` platform keys. **HIGH** (official docs).
- tauri-apps/tauri discussion #9419 + issue #8664 — universal build needs BOTH `aarch64`+`x86_64` rustup targets; output at `target/universal-apple-darwin/release/bundle/macos/`; missing target = build error. **HIGH** (official repo).
- tauri-apps/tauri issue #8265 — no first-party sync of version across `package.json`/`Cargo.toml`/`tauri.conf.json` (confirms hand-rolled script is necessary). **HIGH** (official repo).
- `gh release create` manual + cli/cli issues (#5855, #4357) — `--repo` cross-repo, auto-tag from default branch HEAD when tag absent, `--verify-tag`. **HIGH** (official CLI docs).
- Installed-tool probes (this machine, 2026-06-02): `tauri-cli 2.11.2`, `gh 2.93.0` (auth `bklim5`, scope `repo`), `rustc 1.96.0`, `node v22.21.1`, rustup targets = `aarch64-apple-darwin` only, `Cargo.toml` version `0.1.0`, `latest.json` gitignored + untracked. **HIGH** (direct verification).
- thatgurjot.com Tauri auto-updater TIL — example `latest.json` with separate macOS arch entries (corroborates dual-key pattern). **MEDIUM** (community, corroborated by official schema).

---
*Stack research for: local Tauri 2 release-automation helper scripts (macOS)*
*Researched: 2026-06-02*
