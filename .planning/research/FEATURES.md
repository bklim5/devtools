# Feature Research

**Domain:** Local release-automation helper scripts for a single-maintainer Tauri 2 desktop app (macOS-first), automating the existing `docs/RELEASE.md` runbook. Dev-tooling, not a runtime feature.
**Researched:** 2026-06-02
**Confidence:** HIGH

> **Scope guard (do not relitigate):** This milestone (v1.2 "Release Tooling") ships TWO local scripts — `bump-and-tag` (`pnpm release [patch|minor|major]`) and `build-and-publish`. CI is explicitly parked. Lockstep bump covers `package.json` + `src-tauri/tauri.conf.json` + `Cargo.toml`. Universal macOS binary, `latest.json` from a FRESH `.sig`, split-repo publish (`bklim5/devtools` → `bklim5/devtools-releases`), notarisation-ready (`APPLE_*`) but notarisation deferred. Zero new RUNTIME deps (devDeps OK). The research below SUPPORTS that scope and draws the line against scope creep — it does not propose alternatives to the confirmed shape.

> **Baseline = `docs/RELEASE.md`.** Every "table stakes" item below is the script form of a manual step already documented and proven in that runbook (a working `0.2.0 → 0.2.1` round-trip). The scripts automate a *known-good* process; they are not designing one from scratch. Each feature notes which RELEASE.md section it replaces.

## Feature Landscape

### Table Stakes (Users Expect These)

The maintainer expects a release script to do, automatically and reliably, what the runbook does by hand. Missing any of these means the script is not trustworthy enough to replace the manual dance.

| Feature | Why Expected | Complexity | Notes / RELEASE.md dependency |
|---------|--------------|------------|-------------------------------|
| **Semver bump modes `patch` / `minor` / `major`** | The single ergonomic that makes `pnpm release minor` worth typing over editing files. Standard for every release tool (`npm version`, `standard-version`, `tauri-action` patterns). | LOW | Replaces RELEASE.md §1. Compute next version from the *current* `package.json` version (the app semver `0.2.x`, NOT the GSD `v1.x` tag — decision #3). |
| **Lockstep version write across all three manifests** | RELEASE.md §1 + the updater contract demand `package.json` and `tauri.conf.json` match; the milestone explicitly extends this to `Cargo.toml`. A drift here silently breaks update detection. | LOW–MEDIUM | Replaces the manual edit + `grep` sanity-check in §1. `Cargo.toml` is currently `0.1.0` and out of sync — the script must bring it into lockstep (resolves the open question in backlog 999.2 #2). Regenerate `Cargo.lock` so the lockfile reflects the bump. |
| **Surface the resolved version before acting** | The maintainer needs to see `0.2.1 → 0.2.2` and that all three files will move together, before a commit/tag/push is made. Prevents a wrong-mode mistake becoming a pushed tag. | LOW | Echo `old → new` + the three target files. This is the natural place for the dry-run affordance (see differentiators). |
| **Preflight: clean working tree** | Releasing with uncommitted changes produces an unreproducible build and a tag that doesn't match `HEAD`. Universal release-script convention. | LOW | Implicit in RELEASE.md (you build from a known checkout). `git status --porcelain` empty-check; abort otherwise. |
| **Preflight: on the expected branch** | A tag cut from a feature branch publishes the wrong tree. | LOW | Repo default is `master`. Check current branch == `master` (or an `--allow-branch` escape hatch); abort otherwise. |
| **Preflight: tag does not already exist** | `vX.Y.Z` collision either errors mid-flight or silently re-tags. RELEASE.md §4 assumes a fresh tag. | LOW | `git rev-parse -q --verify "refs/tags/vX.Y.Z"` and check the remote too (`git ls-remote --tags`), since the public release may exist even if the local tag doesn't. |
| **Preflight: signing key + password present** | RELEASE.md §2 — without `TAURI_SIGNING_PRIVATE_KEY` (+ `_PASSWORD`) the build produces no `.sig`, which is a *late*, expensive failure after a full `tauri build`. Fail fast at second 0. | LOW | Check the env vars (and/or `~/.tauri/devtools.key` exists) in `build-and-publish` before building. Do NOT read or print the key. |
| **Preflight: tests + typecheck green** | The binding harness already mandates `vitest` + `tsc` green; a release must not ship red. The decoder's 19 tests are the immovable bar. | LOW | Run `vitest run` + `tsc --noEmit` (and the existing lint) as a release gate. Reuses existing scripts — no new tooling. This is the *only* automatable slice of the harness; real-WKWebView UI verification stays a human gate (see anti-features). |
| **`tauri build --target universal-apple-darwin`** | Closes the Pitfall 7 / arm64-only gap that RELEASE.md §"Per-arch caveat" documents as a known hole. Confirmed milestone scope. | MEDIUM | Universal binary emits one `.app.tar.gz` covering both arches; resolves the `darwin-aarch64`-only limitation. Note: universal-binary updater platform-key matching is a known Tauri rough edge — verify the resulting `latest.json` `platforms` key(s) against a real round-trip. Build time roughly doubles vs single-arch. |
| **Generate `latest.json` from the FRESH `.sig`** | The single most error-prone manual step (RELEASE.md §5 warns in bold: NEVER reuse a stale `.sig`). Automating this is a core reason the milestone exists. | MEDIUM | Read the `*.app.tar.gz.sig` produced by *this* build, inline its contents as `signature`, set `version`/`pub_date`/`url`. The `signature` field is the file *contents*, not a path (verified against Tauri updater docs). Compute the `releases/download/vX.Y.Z/...` URL pointing at the `.app.tar.gz`, never the DMG (Pitfall 1). |
| **Publish to the split releases repo + upload all three assets** | RELEASE.md §4/§6 — `gh release create --repo bklim5/devtools-releases` with DMG + `.app.tar.gz` + `latest.json`. The updater endpoint resolves `releases/latest/download/latest.json` only on the public repo. | LOW–MEDIUM | `gh` run from the private checkout with `--repo` targeting the public repo. Requires the local `gh` auth to have write access to `bklim5/devtools-releases` (a local-PAT concern, NOT the cross-repo *Actions* PAT — that's parked CI). |
| **Confirm the publish succeeded** | A release isn't done when `gh` exits 0; it's done when the endpoint the app polls returns *this* version pointing at *this* `.sig`. RELEASE.md §6 ends with a `curl -L` of the live endpoint. | LOW–MEDIUM | After upload, `curl -L .../releases/latest/download/latest.json` and assert `version` == the just-released version. This is the cheap, high-value success check; full round-trip install stays a human gate. |
| **Stop committing `latest.json`; generate-only** | A stale root `latest.json` (pinned at `0.2.1`) is a footgun — the live manifest must come from the build, never a committed copy. Confirmed scope. | LOW | Gitignore the root copy, remove it from tracking. The script writes `latest.json` to a build/dist path, uploads it, and never commits it. |

### Differentiators (Competitive Advantage)

Worth building because they make a *single-maintainer local* script safe and pleasant. These are the affordances that distinguish a script you trust from one you babysit — but each must stay cheap.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **`--dry-run` flag** | Print every action (resolved version, files to edit, tag, build target, release URL) without writing/committing/pushing/publishing. The highest-leverage safety net for a solo maintainer with no reviewer. | LOW–MEDIUM | Should cover both scripts. For `bump-and-tag`, trivial. For `build-and-publish`, dry-run can still *build* (read-only locally) but skip the `gh release create`/upload — or skip the build too and just print the plan. Pick the cheaper one; printing the plan is enough. |
| **Notarisation-ready `APPLE_*` passthrough** | RELEASE.md "post-enrolment flip" — if `APPLE_*` env is present, `tauri build` notarises automatically; if absent, ad-hoc. Build the conditional now so the future flip is credentials-only. Confirmed scope. | LOW | Do NOT *require* `APPLE_*`; just don't strip/override it. Optionally detect presence and log "notarising" vs "ad-hoc" so the maintainer knows which path ran. No structural code — the hardened runtime + entitlements are already committed. |
| **Fail-fast ordering (cheap checks first)** | Run all preflights (tree/branch/tag/key/tests) *before* the multi-minute universal build. Turns a 10-minute late failure into a 5-second early one. | LOW | Pure ordering discipline. Tests/tsc are the slowest preflight — run them after the instant git/env checks but still before `tauri build`. |
| **DMG-mount flake auto-recovery** | RELEASE.md §3 + MEMORY (`tauri-dmg-bundle-flake`): the DMG step fails when other DMGs are mounted. A solo maintainer hits this repeatedly. | MEDIUM | Optional: detect the `hdiutil` failure, `hdiutil detach` strays, retry once. Lower priority than correctness features; a clear error message pointing at the runbook fix is an acceptable minimum. |
| **Clear post-run summary / next-steps** | After publish, print the release URL + the explicit reminder that the human round-trip verification (RELEASE.md §7) is still required this milestone. Keeps the human gate honest. | LOW | Closes the loop between the automated part and the still-manual DST-02 proof. |
| **Conventional-commit changelog stub** | Auto-collect commit subjects since the last tag into the release `notes` / `latest.json.notes`. Saves hand-writing notes. | MEDIUM | **Borderline — lean toward a thin version or defer.** A *full* changelog generator (`standard-version`/`changesets`) is over-engineering for a solo app and risks a new devDep. A 5-line "git log since last tag → notes body, edit before publish" is acceptable; anything heavier is scope creep. See anti-features. |

### Anti-Features (Commonly Requested, Often Problematic)

These are the gravity wells. Most are CI concerns that are **explicitly parked** (backlog 999.2) — pulling any of them into this local-script milestone is scope creep by definition.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **GitHub Actions / CI release workflow** | "Automate it fully." | Explicitly parked (999.2). Needs a macOS runner (billed minutes on a private repo), a **cross-repo PAT**, and minisign secrets in Actions — all deferred. Building it here is the textbook scope creep this research must flag. | Local scripts only this milestone; design them to be CI-callable later (thin, env-driven, no interactive prompts in the publish path) but do NOT wire any workflow. |
| **CI checks on push/PR (vitest+tsc+eslint in Actions)** | "Gate every push." | Parked (999.2 #1). It's a CI concern, separate from the local release path. | Keep the harness a local + human gate. The release script *runs* the same checks locally; that's the milestone's slice. |
| **Real-WKWebView e2e inside the release script / CI** | "Verify the build automatically." | macOS-runner + webview-automation cost; the project deliberately keeps real-WKWebView verification a **human phase-boundary gate**. Automating it is a parked stretch goal. | Script runs `vitest`+`tsc` only; print a reminder that the human UI verification + round-trip (RELEASE.md §7) is still required. |
| **Cross-arch matrix / per-arch separate publishes** | "Serve Intel and Apple Silicon separately." | The confirmed answer is a single **universal** binary — simpler, one asset, one `latest.json` entry. A per-arch matrix is a CI-shaped solution to a problem the universal build already closes. | `--target universal-apple-darwin`, one `.app.tar.gz`. |
| **Windows / Linux build + publish** | "Cross-platform releases." | Out of scope project-wide (macOS-only for now). No runners, no signing story. | macOS-only; Tauri keeps the door open for later, untouched. |
| **Heavy changelog/versioning frameworks** (`changesets`, full `standard-version`, semantic-release) | "Industry-standard release management." | Over-engineering for a one-person app with two numbering systems. Adds devDeps, config, and a conventional-commit contract the project hasn't adopted. Semantic-release also wants to *infer* the bump from commits — conflicts with the explicit `patch/minor/major` arg. | Explicit bump arg + (optional) thin `git log since last tag` notes stub. |
| **Auto-publish / no confirmation in the default path** | "One command, zero friction." | A solo maintainer has no reviewer; an accidental `major` push to a public release repo is hard to walk back. Pushing the tag is what fires the (future) release — irreversible-ish. | `--dry-run` first-class; a confirmation/echo before push+publish; an explicit flag to skip confirmation, not the default. |
| **Rollback / un-publish automation** | "Undo a bad release." | A published GitHub release + a consumed `latest.json` can't be cleanly "un-shipped" once a client has updated; building rollback tooling invites trusting it. The honest primitive is forward-only (cut a new patch). | Document manual recovery (delete the release/tag, publish a higher patch). Don't build automated rollback. The `--dry-run` + preflights are the real "rollback" — they prevent the bad release. |
| **Secret/keychain management, key rotation tooling** | "Manage signing keys in the script." | RELEASE.md §"Secrets reminder" — keys are local gitignored env only; the script must *read* them, never store/print/rotate them. Adding key management is both scope creep and a security footgun. | Script consumes `TAURI_SIGNING_*` / `APPLE_*` from env; presence-check only; never echo. |
| **GSD `v1.x` milestone tag coupling** | "Tag the release with the milestone." | App semver (`0.2.x`) is deliberately DECOUPLED from GSD milestone tags (decision #3). The updater compares the *app* version. Coupling them breaks update detection. | The release pipeline keys off the **app** version (`package.json`) only; `vX.Y.Z` tag derives from app semver, not GSD `v1.x`. |
| **`prerelease` / beta channel bump mode** | "Ship betas." | No beta channel exists; the updater has one stable endpoint. Adding `prerelease` mode implies channel routing in `latest.json` that doesn't exist. | Stick to `patch/minor/major`. Revisit only if a beta channel is ever a real requirement. |

## Feature Dependencies

```
bump-and-tag (pnpm release [patch|minor|major])
    ├──requires──> read current app version (package.json)
    ├──requires──> lockstep write (package.json + tauri.conf.json + Cargo.toml + Cargo.lock)
    ├──requires──> preflight: clean tree + on master + tag absent
    └──produces──> commit + vX.Y.Z tag + push   ──(push fires)──>  build-and-publish (manual this milestone; tag-triggered later=PARKED)

build-and-publish
    ├──requires──> preflight: signing key/password present (fail fast)
    ├──requires──> preflight: vitest + tsc green
    ├──requires──> tauri build --target universal-apple-darwin  ──produces──> DMG + .app.tar.gz + FRESH .sig
    ├──requires──> generate latest.json  <──reads── FRESH .sig (NEVER stale)
    ├──requires──> gh release create --repo bklim5/devtools-releases  (DMG + .app.tar.gz + latest.json)
    └──confirms──> curl live endpoint, assert version matches

--dry-run ──enhances──> both scripts (print plan, no writes/push/publish)
APPLE_* env ──enhances──> tauri build (notarise if present; ad-hoc if absent)
universal binary ──resolves──> Pitfall 7 (arm64-only gap)
generate-only latest.json ──conflicts──> committed root latest.json (gitignore + untrack the stale copy)

CI workflow / cross-repo PAT / Actions secrets / push-PR checks  ──PARKED (999.2, NOT this milestone)
```

### Dependency Notes

- **bump-and-tag precedes build-and-publish:** the tag/version must exist before a build can be labeled and a release cut. They are two scripts (decision #4) precisely so the version bump can be reviewed (and the push that "fires" the release is a deliberate, separable step).
- **Lockstep write requires the `Cargo.toml` decision resolved:** `Cargo.toml` is currently `0.1.0` and out of lockstep; the milestone confirms it joins the lockstep. The script must reconcile it on first run (one-time `0.1.0 → current` jump or a documented baseline).
- **latest.json generation requires the FRESH `.sig`:** this is the dependency the whole milestone is built to make unbreakable — the script reads the `.sig` from *this* build's output dir, never a committed/previous one.
- **Publish-confirm enhances but doesn't replace the human round-trip:** the `curl` endpoint check proves the manifest is live and correct; RELEASE.md §7's install-and-update proof stays a human gate (DST-02).
- **CI items conflict with this milestone by scope, not by code:** the scripts should be *shaped* to be CI-callable (no interactive-only paths in publish, env-driven secrets), but no workflow is built.

## MVP Definition

### Launch With (v1.2)

The minimum that lets the maintainer retire the manual runbook with confidence.

- [ ] **`pnpm release [patch|minor|major]`** — resolve next app version, lockstep-write the three manifests + regenerate `Cargo.lock`, echo `old → new`, commit, tag `vX.Y.Z`, push. *(table stakes core)*
- [ ] **Preflights in bump-and-tag** — clean tree, on `master`, tag absent (local + remote). *(fail fast, cheap)*
- [ ] **`build-and-publish`** — preflight (key present, vitest+tsc green) → `tauri build --target universal-apple-darwin` → generate `latest.json` from the FRESH `.sig` → `gh release create --repo bklim5/devtools-releases` with DMG + `.app.tar.gz` + `latest.json`. *(table stakes core)*
- [ ] **Publish confirmation** — `curl` the live `latest.json` endpoint, assert version matches. *(cheap, high-value success check)*
- [ ] **`--dry-run` on both scripts** — print the plan, no side effects. *(the solo-maintainer safety net)*
- [ ] **Stop committing `latest.json`** — gitignore + untrack the stale root copy; generate-only. *(footgun removal)*
- [ ] **`APPLE_*` passthrough (notarisation-ready, not required)** — don't override; ad-hoc when absent. *(confirmed scope, near-zero cost)*

### Add After Validation (later, only if pain shows)

- [ ] **DMG-mount flake auto-recovery** — add the `hdiutil detach`+retry loop *if* the flake keeps biting; until then a clear error pointing at the runbook fix suffices.
- [ ] **Thin changelog stub** — `git log since last tag → notes` *if* hand-writing notes becomes annoying. Keep it dumb; no framework.

### Future Consideration (PARKED — separate CI milestone, 999.2)

- [ ] **CI checks on push/PR** (vitest+tsc+eslint in Actions) — parked.
- [ ] **Tag-triggered CI release** (macOS runner, cross-repo PAT, minisign secrets in Actions) — parked.
- [ ] **Real-WKWebView e2e in CI** — parked stretch goal.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Semver bump modes (patch/minor/major) | HIGH | LOW | P1 |
| Lockstep write (3 manifests + Cargo.lock) | HIGH | LOW–MEDIUM | P1 |
| Preflights (tree/branch/tag/key/tests) | HIGH | LOW | P1 |
| Universal binary build | HIGH | MEDIUM | P1 |
| latest.json from FRESH .sig | HIGH | MEDIUM | P1 |
| Split-repo publish + asset upload | HIGH | LOW–MEDIUM | P1 |
| Publish confirmation (curl endpoint) | HIGH | LOW | P1 |
| Stop committing latest.json | MEDIUM | LOW | P1 |
| `--dry-run` | HIGH | LOW–MEDIUM | P1 |
| `APPLE_*` passthrough | MEDIUM | LOW | P1 (cheap, confirmed scope) |
| Post-run summary + human-gate reminder | MEDIUM | LOW | P2 |
| DMG-mount flake auto-recovery | MEDIUM | MEDIUM | P2 |
| Changelog stub (thin) | LOW–MEDIUM | MEDIUM | P3 |
| CI of any kind | (deferred) | HIGH | PARKED |

**Priority key:** P1 = must have for v1.2; P2 = add when convenient; P3 = nice to have; PARKED = explicitly out of this milestone (999.2 CI).

## Competitor Feature Analysis

How comparable local release scripts in the Tauri/Electron-class, single-maintainer space handle each capability, and the chosen approach here.

| Feature | `npm version` / `standard-version` | `tauri-action` (CI) | Our Approach (local) |
|---------|-----------------------------------|---------------------|----------------------|
| Bump mode | explicit arg (`npm version`) or inferred from commits (`standard-version`) | n/a (CI consumes a tag) | **explicit `patch/minor/major` arg** — no inference |
| Multi-manifest lockstep | single `package.json` only | bumps package.json/tauri.conf.json/Cargo.toml + Cargo.lock | **all three + Cargo.lock**, matching the CI tool's behavior, run locally |
| latest.json + signature | n/a | auto-generates `latest.json`; `signature` = `.sig` *contents* | **same: contents inlined, from the FRESH build's .sig** |
| Publish | n/a | drafts GitHub release, uploads assets | **`gh release create --repo` to the public split repo** |
| Preflight | git-clean check (npm version refuses dirty tree) | CI runner is clean by construction | **explicit tree/branch/tag/key/tests gate**, fail-fast before build |
| Dry-run | `--dry-run` (npm version) | n/a | **first-class `--dry-run` on both scripts** |
| Notarisation | n/a | `APPLE_*` secrets in Actions | **`APPLE_*` passthrough from local env; deferred but ready** |
| Cross-arch | n/a | matrix of runners | **single universal binary** (simpler than a matrix locally) |

## Sources

- DevTools `docs/RELEASE.md` — the manual runbook being automated (the authoritative feature baseline; proven `0.2.0 → 0.2.1` round-trip). **HIGH confidence.**
- DevTools `.planning/PROJECT.md` + `.planning/ROADMAP.md` backlog 999.2 — confirmed milestone scope and pre-discussion decisions. **HIGH confidence.**
- DevTools `MEMORY` — `tauri-dmg-bundle-flake`, `verify-gate-builds-real-app`, `tauri-store-async-init-race`. **HIGH confidence (repo-specific learned facts).**
- [Tauri Updater plugin docs](https://v2.tauri.app/plugin/updater/) — `latest.json` schema; `signature` is the `.sig` file *contents* (verifies RELEASE.md §5). **HIGH confidence.**
- [tauri-action (GitHub Actions) docs/behavior](https://dev.to/tomtomdu73/ship-your-tauri-v2-app-like-a-pro-github-actions-and-release-automation-part-22-2ef7) — standard bump-all-manifests + generate-latest.json + draft-release pattern this milestone mirrors locally. **MEDIUM confidence (community/blog, consistent with official docs).**
- [Tauri v2 auto-updater walkthrough](https://thatgurjot.com/til/tauri-auto-updater/) and [Ratul's Tauri v2 updater notes](https://ratulmaharaj.com/posts/tauri-automatic-updates/) — corroborate latest.json/signature handling. **MEDIUM confidence.**
- [prerelease-checks (npm)](https://www.npmjs.com/package/prerelease-checks) — common release preflight set (clean tree, tests, tag absence); informs the table-stakes preflight list. **MEDIUM confidence.**

---
*Feature research for: local release-automation helper scripts (Tauri 2, macOS, single-maintainer)*
*Researched: 2026-06-02*
