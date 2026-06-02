# Project Research Summary

**Project:** DevTools — milestone v1.2 "Release Tooling"
**Domain:** Local release-automation helper scripts for an existing Tauri 2 macOS desktop app (dev-tooling, not a runtime feature)
**Researched:** 2026-06-02
**Confidence:** HIGH

## Executive Summary

This milestone automates an *already-proven* manual release runbook (`docs/RELEASE.md`, which shipped a real `0.2.0 → 0.2.1` signed auto-update round-trip) into two local helper scripts: `bump-and-tag` (`pnpm release [patch|minor|major]`) and `build-and-publish`. CI is explicitly parked. All four researchers converged hard on one headline: **this needs ZERO new dependencies — not even devDeps.** Node 22 built-ins (`node:fs`/`child_process`/`util.parseArgs`), the already-present `tsx`, the installed Tauri CLI 2.11.2, `gh` 2.93.0 (authed as `bklim5`, `repo` scope), and `rustup`/`cargo` cover the entire surface. The only prerequisite *action* is `rustup target add x86_64-apple-darwin` (an SDK target, not a package) so the universal-binary build can `lipo` both arches.

The recommended architecture follows this project's existing **functional-core / imperative-shell** ethos (the same seam that governs `decoder.ts` and `src/lib/format/`): pure, deterministic logic — semver bump math, per-manifest content edits, `latest.json` assembly — lives in a new `src/lib/release/`, where the existing `tsc include:["src"]` + `vitest` gate covers it for free with no new wiring. The side-effecting orchestration — spawning `tauri build`, reading the fresh `.sig` off disk, `gh release create`, `git tag/push` — lives in thin `scripts/*.mjs` drivers that `import` the pure functions. This keeps the only logic that can *silently corrupt a release* (wrong version, wrong platform key, mis-scoped Cargo edit, stale signature) under unit test, and keeps the I/O out of the test net.

The risks are concentrated and well-understood because they are documented pitfalls from the manual runbook — but a script is more dangerous than a human because it does the wrong thing *silently* and then auto-installs onto every user. The load-bearing mitigations: (1) the universal artifact must be listed under **BOTH** `darwin-aarch64` and `darwin-x86_64` keys (there is no `darwin-universal` key — inventing one silently breaks updates for everyone); (2) `latest.json` must embed THIS build's fresh `.sig` via a single-match glob that fails on 0 or >1 matches (never a stale/cached signature); (3) the universal build output path moves to `target/universal-apple-darwin/release/bundle/...`, so a stale arm64-only artifact at the old path must not be picked up; (4) a `--dry-run` first-class flag plus a clean separation of "build" from "publish" backstops the irreversible blast radius of a bad release. One latent bug surfaces here: `Cargo.toml` has drifted to `0.1.0` (the manual runbook only bumped the two JSON files) and must be re-synced as a one-time fix before the first lockstep bump.

## Key Findings

### Recommended Stack

**Zero new libraries, not even devDeps** — this is the deliberate, unanimous recommendation (see `STACK.md`). Everything required is already installed or in the repo. Tempting additions (`semver`, `@iarna/toml`, `release-it`, `tauri-version`, `@octokit/rest`) are each explicitly rejected: the bump is ~10 lines of integer math, the Cargo edit is a single anchored regex on the `[package]` `version` line, and `gh` already handles cross-repo publish without a PAT for local runs. Heavy release frameworks would still need a custom hook to touch `Cargo.toml`/`tauri.conf.json` — you write the hard part anyway.

**Core technologies:**
- **Node 22 built-ins** (`node:fs`/`child_process`/`util.parseArgs`) — script runtime; file edits + JSON are line-level, subprocess calls run tauri/gh/git. No dependency.
- **tsx 4.22.3 (already a devDep)** — lets the `.mjs`/`.ts` drivers `import` the pure `src/lib/release/` functions directly, sharing one source of truth with vitest. Plain `.mjs` under `node` also works with zero transpile.
- **Tauri CLI 2.11.2** — `tauri build --target universal-apple-darwin` (officially supported); `createUpdaterArtifacts: true` already emits the `.app.tar.gz` + `.sig`.
- **`gh` 2.93.0 (authed, `repo` scope)** — `gh release create --repo bklim5/devtools-releases` writes the Release cross-repo from the private checkout. `repo` scope authorizes cross-repo release writes for a repo you own.
- **rustup / cargo** — universal build needs BOTH `aarch64-apple-darwin` (present) and `x86_64-apple-darwin` (**MISSING — `rustup target add` required**, a hard blocker otherwise).

### Expected Features

The maintainer expects the script to do *automatically and reliably* what the runbook does by hand — every table-stakes item is the script form of a proven manual step (see `FEATURES.md`).

**Must have (table stakes):**
- **Semver `patch`/`minor`/`major` bump** computed from `package.json` (the app version, NOT the GSD `v1.x` tag).
- **Lockstep write across all three manifests** (`package.json` + `tauri.conf.json` + `Cargo.toml [package].version`) + regenerate `pnpm-lock.yaml`/`Cargo.lock`; reconcile the Cargo `0.1.0` drift on first run.
- **Preflights** — clean tree, on `master`, tag absent (local + remote), signing key/password present (fail fast before a multi-minute build), `vitest`+`tsc` green.
- **`tauri build --target universal-apple-darwin`** — closes the arm64-only gap; one fat `.app.tar.gz` covering both arches.
- **Generate `latest.json` from the FRESH `.sig`** — read THIS build's `.sig` *contents* (not a path), inline as `signature` under both macOS keys.
- **Split-repo publish** — `gh release create --repo bklim5/devtools-releases` uploads DMG + `.app.tar.gz` + `latest.json`.
- **Publish confirmation** — `curl -L` the live endpoint, assert served `version` matches.
- **Stop committing `latest.json`** — generate-only (note: already gitignored + already untracked, so this is largely a verify, not a task — see Gaps).
- **`APPLE_*` passthrough** — notarisation-ready; honor if present, never require (ad-hoc `signingIdentity: "-"` stays default, D-02).

**Should have (competitive / solo-maintainer safety):**
- **`--dry-run` on both scripts** — the highest-leverage safety net for a solo maintainer with no reviewer; print the full plan, no side effects.
- **Fail-fast ordering** — cheap git/env checks before the slow tests, both before `tauri build`.
- **Post-run summary + human-gate reminder** — closes the loop to the still-manual DST-02 round-trip proof.

**Defer (only if pain shows):**
- **DMG-mount flake auto-recovery** (`hdiutil detach` + retry) — a clear error pointing at the runbook fix suffices until the flake keeps biting (MEMORY: `tauri-dmg-bundle-flake`).
- **Thin changelog stub** (`git log since last tag → notes`) — keep dumb; no framework.

**Parked (separate CI milestone, 999.2 — flag any pull-in as scope creep):** GitHub Actions release workflow, CI checks on push/PR, cross-repo PAT, minisign secrets in Actions, real-WKWebView e2e in CI, per-arch matrix publishes, Windows/Linux, rollback/un-publish automation, key-rotation tooling.

### Architecture Approach

Split along the project's existing pure-logic-in-`src/lib/` seam (see `ARCHITECTURE.md`). Pure, deterministic transforms go in a new `src/lib/release/` (auto-covered by the existing `tsc`+`vitest` gate, zero new config); impure orchestration goes in thin `scripts/*.mjs` drivers that `import` the pure functions — one source of truth shared by drivers and tests. Release tooling lives entirely outside the Vite entry graph → zero runtime deps, zero bundle bytes. The `lefthook.yml` pre-commit gate needs no edits; it automatically picks up the new `src/lib/release/*.test.ts`.

**Major components:**
1. **`src/lib/release/version.ts`** (pure) — `bumpSemver(v, kind)` + `setPkg/Tauri/CargoVersion(text, v)` returning new file contents; the Cargo edit targets ONLY the `[package]` `version` line.
2. **`src/lib/release/manifest.ts`** (pure) — `buildLatestJson({version, signature, url, notes, pubDate, platforms})` + `platformKey(target)`; constructs the dual-key universal manifest.
3. **`scripts/bump-and-tag.mjs`** (impure) — read 3 files, call pure fns, write back, `git add/commit/tag/push --follow-tags` to private `origin`.
4. **`scripts/build-and-publish.mjs`** (impure) — spawn universal `tauri build`, glob the fresh `.sig`, call `buildLatestJson`, `gh release create/upload --repo`, `curl`-verify the endpoint.
5. **`package.json` scripts** — composable `release:bump` / `release:publish` / `release` umbrella, so the publish half is re-runnable after a DMG flake without re-bumping/re-tagging.

### Critical Pitfalls

(Top 5 of 10 from `PITFALLS.md`; auto-update blast-radius pitfalls ordered first because a broken release auto-installs onto every user.)

1. **Universal artifact has no `darwin-universal` key (silent no-update for an arch)** — the updater matches `platforms.<os-arch>` against the *client's* OS-ARCH; a single invented `darwin-universal` key matches no machine. **Avoid:** emit BOTH `darwin-aarch64` + `darwin-x86_64`, same `url`, same `signature`, from the one fresh `.sig`.
2. **Stale / wrong signature in `latest.json` (updater rejects every download)** — the mandatory minisign verify (DST-02) fails for all users if the `.sig` doesn't match the uploaded payload. **Avoid:** clean the bundle dir before build; glob the single fresh `.sig` post-build (fail on 0 or >1); read its *contents* into the JSON; verify against the *committed* `pubkey` (not the local pubkey file — also catches Pitfall 8 keypair mismatch).
3. **Irreversible broken publish — blast radius** — `releases/latest/download/latest.json` is a stable redirect; the moment a broken release is newest, every polling app picks it up, unrecallable. **Avoid:** `--dry-run` first-class; separate "build" from "publish"; upload assets *then* `latest.json` (manifest promotes last); post-publish `curl` smoke check; idempotent re-runs (`--clobber`, never silent double-create).
4. **Universal output path moves** — artifacts move to `target/universal-apple-darwin/release/bundle/...`; an old hardcoded path can silently sign/publish a stale arm64-only artifact. **Avoid:** one `BUNDLE` variable keyed off the target; assert each artifact exists at the universal path; `lipo -archs` shows `x86_64 arm64`; clean before build.
5. **Version lockstep drift (incl. the latent `Cargo.toml` = 0.1.0 bug)** — the updater compares `latest.json.version` to the running app's `tauri.conf.json` version; any drift means installs never detect the release. **Avoid:** one bump fn writes all three from a single computed version; one-time `0.1.0 → current` Cargo reconciliation; derive the tag from the written version; regenerate + commit lockfiles so the tag points at a clean, reproducible tree.

## Implications for Roadmap

All four researchers independently converged on the **same three-phase shape**, ordered by dependency (pure core first so drivers can import + be trusted; lockstep before publish because a tag must exist before a release):

### Phase A: Pure release core + housekeeping
**Rationale:** Zero I/O, fully unit-testable, de-risks the only logic that can silently corrupt a release; auto-covered by the existing lefthook gate with no new wiring. No drivers depend on anything yet.
**Delivers:** `src/lib/release/version.ts` + `version.test.ts` (semver bump; `setPkg/Tauri/CargoVersion`; the `[package]`-scoping test proving dep versions are untouched), `src/lib/release/manifest.ts` + `manifest.test.ts` (`buildLatestJson` shape, sig passthrough, dual-key `platformKey`). One-time housekeeping: re-sync `Cargo.toml` `0.1.0 → 0.2.1`; verify/`git rm --cached latest.json` (already untracked — confirm, don't assume).
**Addresses:** lockstep write + semver bump (table stakes); the Cargo drift reconciliation.
**Avoids:** Pitfall 5 (lockstep drift), the untestable-scripts architecture anti-pattern, the "edit every `version =`" anti-pattern.
**Gate:** standard `tsc` + `vitest` + `/codex:review` (no new wiring).

### Phase B: `bump-and-tag` driver + `pnpm release:bump`
**Rationale:** Smallest, lowest-risk side effects (local file edits + git); produces the tag Phase C's publish needs. Testable via `--dry-run` on a throwaway branch.
**Delivers:** `scripts/bump-and-tag.mjs` importing Phase A; preflights (clean tree, on `master`, tag absent local + remote); lockfile regeneration (`pnpm install --lockfile-only` + `cargo generate-lockfile`) staged in the bump commit; `git tag vX.Y.Z` + `git push --follow-tags` to private `origin`; `--dry-run`; wire `release:bump`.
**Uses:** Node `node:fs`/`child_process` (`execFileSync` with arg arrays, no shell injection), the pure Phase A fns.
**Avoids:** Pitfall 4 (stale lockfiles / dirty tree at tag time).
**Gate:** review → unit (Phase A green) → manual `--dry-run`.

### Phase C: `build-and-publish` driver + universal binary + `pnpm release` umbrella + preflight/verify rails
**Rationale:** Depends on Phase A (manifest) + a tag from Phase B; heaviest side effects (network publish to the public repo) and the universal platform-key decision; needs the real DST-02 round-trip verify (the phase-boundary human sign-off).
**Delivers:** `scripts/build-and-publish.mjs` — `rustup` both-targets preflight, `gh` auth/push-permission preflight on the releases repo, signing-key presence check, `tauri build --target universal-apple-darwin`, fresh-`.sig` single-match discovery, `buildLatestJson` (dual `darwin-aarch64`+`darwin-x86_64` keys → same universal URL/sig), `gh release create/upload --repo bklim5/devtools-releases` with DMG + `.app.tar.gz` + `latest.json`, post-publish `curl` endpoint verify, `APPLE_*` passthrough, DMG-flake handling; the preflight/`--dry-run`/draft-promote safety rails wrapping both scripts; wire `release:publish` + `release` umbrella.
**Uses:** Tauri CLI universal target, `gh` cross-repo, the pure manifest assembly.
**Avoids:** Pitfalls 1, 2, 3, 6, 7, 8, 9, 10 (signature/universal-key/blast-radius/cross-repo/secret-leak cluster).
**Gate:** review → unit → real round-trip (older install → detect → minisign verify → relaunch into new version), per runbook §7. **Human phase-boundary sign-off.**

### Phase Ordering Rationale
- **Pure core first** because the drivers `import` it and the only silently-corrupting logic must be unit-tested before anything calls it.
- **Bump before publish** because a tag/version must exist before a build can be labeled and a release cut; splitting them (two scripts, decision #4) makes the version bump reviewable and the publish half independently re-runnable after a DMG flake.
- **Safety rails land with Phase C** because that is where the irreversible actions (`git push`, `gh release create`) live — the `--dry-run`/separate-build-from-publish/draft-promote guards backstop every other pitfall and are the highest-priority controls.

### Research Flags

Phases likely needing deeper validation during planning/execution:
- **Phase C:** the universal-binary updater platform-key behavior is the one rough edge that must be **proven by a real round-trip**, not just unit-asserted — Intel (`darwin-x86_64`) and Apple Silicon installs must both detect + verify + relaunch. The output-path move and `lipo -archs` check should be confirmed against the first actual universal build. This is the load-bearing DST-02 proof.

Phases with standard patterns (skip `/gsd-research-phase`):
- **Phase A:** pure string/JSON transforms with full unit coverage — well-defined, no external unknowns.
- **Phase B:** local file edits + git over `execFileSync` — established, dry-run-testable.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified by direct tool probes on this machine (versions, `gh` auth/scope, rustup targets, Cargo `0.1.0`) + official Tauri/`gh` docs. Zero-dep claim is grounded in installed reality. |
| Features | HIGH | Every feature is the script form of a proven step in `docs/RELEASE.md` (real `0.2.0 → 0.2.1` round-trip shipped) + confirmed milestone scope in PROJECT.md / backlog 999.2. |
| Architecture | HIGH | Grounded in this repo's actual files (`tsconfig include:["src"]`, `lefthook.yml`, `vite.config.ts`, `scripts/e2e-spike.sh`); mirrors the existing `decoder.ts` / `src/lib/format/` ethos. |
| Pitfalls | HIGH | First-party runbook + repo state are the sources; the universal-key + bundle-path specifics verified against current Tauri 2 docs and community discussions. |

**Overall confidence:** HIGH

### Gaps to Address
- **Universal platform-key round-trip is unproven on real hardware.** The dual-key approach is correct per docs, but only a live update test on both an Intel and an Apple-Silicon install confirms it. Handle: make this the explicit Phase C human-gate acceptance criterion; if a second machine/arch isn't available, document the residual risk.
- **`latest.json` cleanup may be a no-op.** STACK.md verified the root `latest.json` is *already gitignored AND already untracked* (`git ls-files latest.json` empty), while PITFALLS/ARCHITECTURE describe it as still-tracked. Handle: Phase A *verifies* the actual `git ls-files` state and only `git rm --cached`s if tracked — don't assume; reconcile the two readings at execution time.
- **`pnpm-lock.yaml` root-version coupling.** Whether the lockfile pins the workspace root `version` (and thus needs refresh on bump) is flagged but not confirmed. Handle: Phase B checks empirically and only regenerates if it drifts the tree.
- **DMG-mount flake recovery depth.** Whether to auto-`hdiutil detach`+retry or just surface a clear error is left to "add after validation." Handle: ship the clear-error minimum in Phase C; add the retry loop only if the flake recurs.

## Sources

### Primary (HIGH confidence)
- `docs/RELEASE.md` (this repo) — the proven manual runbook being automated.
- `.planning/PROJECT.md` + `.planning/ROADMAP.md` backlog 999.2 — confirmed v1.2 scope/constraints, CI parked.
- Repo state + installed-tool probes (this machine, 2026-06-02) — `tauri-cli 2.11.2`, `gh 2.93.0` (auth `bklim5`, scope `repo`), `rustc 1.96.0`, `node v22.21.1`, rustup = `aarch64-apple-darwin` only, `Cargo.toml` = `0.1.0`, `latest.json` gitignored + untracked.
- `package.json` / `tsconfig.json` / `vite.config.ts` / `lefthook.yml` / `.gitignore` / `scripts/e2e-spike.sh`.
- [Tauri v2 CLI reference](https://v2.tauri.app/reference/cli/), [Tauri v2 Updater plugin docs](https://v2.tauri.app/plugin/updater/).
- tauri-apps/tauri #8265, #8664, discussion #9419; cli/cli release docs.
- MEMORY: `tauri-dmg-bundle-flake`, `verify-gate-builds-real-app`, `tauri-store-async-init-race`.

### Secondary (MEDIUM confidence)
- [tauri-action behavior](https://dev.to/tomtomdu73/ship-your-tauri-v2-app-like-a-pro-github-actions-and-release-automation-part-22-2ef7).
- [thatgurjot.com Tauri auto-updater TIL](https://thatgurjot.com/til/tauri-auto-updater/), [Ratul's Tauri v2 updater notes](https://ratulmaharaj.com/posts/tauri-automatic-updates/).
- [prerelease-checks (npm)](https://www.npmjs.com/package/prerelease-checks).

### Tertiary (LOW confidence)
- None — all findings trace to first-party repo state, direct tool probes, or official docs.

---
*Research completed: 2026-06-02*
*Ready for roadmap: yes*
