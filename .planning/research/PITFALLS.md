# Pitfalls Research

**Domain:** Local release-automation helper scripts for a Tauri 2 macOS desktop app with a minisign-signed auto-updater, split-repo publish (private source → public releases), and a universal-binary target.
**Researched:** 2026-06-02
**Confidence:** HIGH (the manual `docs/RELEASE.md` runbook + repo state are first-party sources; the universal-binary platform-key and bundle-path details verified against current Tauri 2 docs)

> **Framing for the roadmapper/planner:** these are mistakes made when *automating an already-working manual process*. The manual runbook (`docs/RELEASE.md`) is proven (a real 0.2.0→0.2.1 round-trip shipped). The danger in v1.2 is that a script *silently* does the wrong thing where a human previously eyeballed it. Every prevention below should be a **concrete script guard or preflight that aborts non-zero before any irreversible action** (tag push, release publish). The auto-update blast-radius pitfalls (1, 6, 9) are ordered first — a broken release auto-installs onto every user.
>
> **Suggested phase shape** (referenced in the per-pitfall "Phase to address" and in the mapping table):
> - **Phase A — `bump-and-tag`** (version lockstep, lockfile refresh, tag/version agreement, push target).
> - **Phase B — `build-and-publish`** (universal build, fresh-`.sig` `latest.json` generation, cross-repo publish, secret hygiene).
> - **Phase C — Preflight / dry-run / verify harness** (the irreversibility guards that wrap both scripts; the post-publish round-trip verify).

---

## Critical Pitfalls

### Pitfall 1: Stale / wrong signature pasted into `latest.json` (updater rejects every download)

**What goes wrong:**
`latest.json`'s `platforms.<key>.signature` carries a `.sig` that does **not** match the `.app.tar.gz` actually uploaded for this release. The updater downloads the payload, runs the mandatory minisign verify (DST-02, cannot be disabled), the signature fails, and it refuses to install — for **every** user, on every check. The release looks published and correct; updating is 100% broken. RELEASE.md §5 calls this out in bold ("NEVER reuse a stale `.sig`") precisely because it is the easiest fatal mistake.

**Why it happens:**
The signature is per-payload — a fresh `tauri build` produces a *new* `.sig` every time (minisign signs the exact bytes). A script that (a) caches/hardcodes a signature, (b) reads a `.sig` from a previous build dir not cleaned between runs, (c) generates `latest.json` *before* the build, or (d) reads `*.app.tar.gz.sig` with a loose glob that matches an older file, will embed a mismatched signature. The manual paste was error-prone; an automated paste from the wrong file is *worse* because no human re-reads it.

**How to avoid (script guards — Phase B):**
- Generate `latest.json` **only after** the build, reading the `.sig` from the **exact** path of the artifact being uploaded (not a glob that could match siblings). Resolve a single concrete file; abort if zero or >1 match.
- **Clean the bundle output dir before each build** (`rm -rf src-tauri/target/universal-apple-darwin/release/bundle` or `cargo clean`-equivalent for the bundle) so a stale `.sig` from a prior version cannot be picked up.
- **Cross-check the signature locally before publishing**: run `minisign -V` (or the Tauri verify path) on the freshly-built `.app.tar.gz` against the *committed pubkey* from `tauri.conf.json` — not the local pubkey file. This catches both a stale `.sig` AND a pubkey/keypair mismatch (Pitfall 8) in one preflight.
- Assert `latest.json.version == built artifact version == tag` before upload (ties to Pitfall 3).
- Embed the `.sig` by reading the file at publish time into the JSON; never store the signature in a tracked file.

**Warning signs:**
Updater banner appears ("vX.Y.Z available") but Install fails / silently does nothing; logs show `InvalidSignature` / signature-verification error; the `.sig` file's mtime is older than the `.app.tar.gz` it supposedly signs.

**Phase to address:** Phase B (`build-and-publish`), with the verify step belonging to Phase C preflight.

---

### Pitfall 6: Publishing an irreversible broken release that users auto-update into (blast radius)

**What goes wrong:**
A script pushes a tag and/or creates a GitHub Release that is broken (bad signature, wrong URL, missing arch, wrong version). Because `releases/latest/download/latest.json` is a **stable redirect to the newest release**, the moment the release is the newest, every installed app that polls picks it up. Unlike a website you can hotfix, an update that *installs* onto users' machines (or *fails* for all of them) cannot be recalled — you can only ship a *newer* good release on top, and only to users whose updater still works.

**Why it happens:**
Scripts make destructive actions trivial and fast — `git push --tags` and `gh release create` are one line each, with no "are you sure". The manual runbook interleaved human judgement between steps; a script runs them in sequence with no gate. There is no staging environment for an auto-updater.

**How to avoid (Phase C — the load-bearing guards):**
- **Separate "build" from "publish".** Build + generate `latest.json` + locally verify the round-trip *first*; make publish a distinct, explicit step (or `--publish` flag) that runs **only after** preflight passes.
- **`--dry-run` by default** (or at minimum a first-class flag) that does everything except `git push`, `gh release create`, and `gh release upload` — printing exactly what *would* be pushed/uploaded and to which repo.
- **Order publish so the manifest goes last and atomically promotes:** upload assets (DMG, `.app.tar.gz`) and *then* `latest.json`. Until `latest.json` resolves to the new version, no client updates. Consider creating the release as a **draft**, uploading + verifying `curl -L .../latest/download/latest.json`, then publishing the draft — so a half-finished release never becomes "latest".
- **Post-publish smoke check in the script:** `curl -L` the live endpoint, assert the served `version` and `signature` match what was just built; if not, fail loudly (and ideally re-draft).
- **Idempotency / re-run safety:** detect an existing release for the tag and refuse to clobber silently.

**Warning signs:**
Release published but the local round-trip (Pitfall 1 verify) was skipped; `latest.json` uploaded before assets finished; no dry-run was run; the script has no path that stops between "build" and "the world updates".

**Phase to address:** Phase C (preflight + dry-run + draft-promote ordering). This is the highest-priority guard — it backstops every other pitfall.

---

### Pitfall 9: Universal artifact has no `darwin-universal` key — updater can't match it (silent no-update for an arch)

**What goes wrong:**
The team builds a universal binary to close the arm64-only gap, then writes `latest.json` with a single made-up key like `"darwin-universal"` (mirroring the `universal-apple-darwin` *build* target name). **There is no default `darwin-universal` platform key.** With the current default updater config, the *running app* looks itself up by the default `OS-ARCH` value — `darwin-aarch64` on Apple Silicon, `darwin-x86_64` on Intel. A `darwin-universal` entry matches neither, so **no machine finds an update** — the opposite of the intended fix, and silent.

**Why it happens:**
The universal *binary* is one file, so it feels like it should have one *key*. But the platform key is matched against the **client's** OS-ARCH, not the artifact's contents. Conflating the build-target name with the manifest key is the trap. RELEASE.md §5 already warns not to add `{{target}}`/`{{arch}}` templating to a static manifest; the universal case is the inverse failure.

**How to avoid (Phase B):**
- With the **default** updater config (this app's current state — no custom target set), emit **both** default keys pointing at the **same** universal artifact:
  ```json
  "platforms": {
    "darwin-aarch64":  { "signature": "<sig>", "url": ".../<name>.app.tar.gz" },
    "darwin-x86_64":   { "signature": "<sig>", "url": ".../<name>.app.tar.gz" }
  }
  ```
  Same `url`, same `signature` (one universal payload, one `.sig`). The script should write both entries from the single freshly-built `.sig`.
- *Alternative (only if you also change app config):* set a **custom updater target** (e.g. `"macos-universal"`) via the plugin/updater builder, then the manifest key must be that exact custom string. Do **not** do this without changing the Rust-side config — the key and the configured target must agree. For v1.2, the two-default-keys approach is lower-risk (no app-config change, no new round-trip to re-prove).
- **Build prerequisite guard:** assert `rustup target list --installed` contains **both** `x86_64-apple-darwin` and `aarch64-apple-darwin`; otherwise `tauri build --target universal-apple-darwin` fails (or worse, the missing-target error is mistaken for a transient flake). Offer to run `rustup target add x86_64-apple-darwin`.

**Warning signs:**
`latest.json` contains a `darwin-universal` (or any non-OS-ARCH) key under default config; Intel users still report "no update available" after the universal release; `tauri build` errors with a missing-target / linker message.

**Phase to address:** Phase B (`build-and-publish`); the `rustup target` precondition is a Phase B preflight.

---

### Pitfall 2: Universal-binary output path moves — scripts read the wrong (stale) bundle

**What goes wrong:**
Switching from a plain `tauri build` to `tauri build --target universal-apple-darwin` **changes the output path**: artifacts move from `src-tauri/target/release/bundle/...` to `src-tauri/target/universal-apple-darwin/release/bundle/...`. A script with the old hardcoded path either (a) errors "no such file" (best case — loud), or (b) **silently finds a stale artifact** from a previous non-universal build still sitting in `target/release/bundle/`, then signs/publishes *that* — shipping an arm64-only binary labeled as universal, with a `.sig` that doesn't even match the uploaded file.

**Why it happens:**
The path change is documented but easy to miss; the manual runbook (RELEASE.md §3) still references `src-tauri/target/release/bundle/` because the proven release was non-universal. Anyone copying those paths into a script inherits the wrong location. A leftover `target/release/bundle/` makes the wrong path "work".

**How to avoid (Phase B):**
- Centralize the bundle dir in **one variable** derived from the target: `BUNDLE=src-tauri/target/universal-apple-darwin/release/bundle`. No path literals scattered through the script.
- After build, **assert each expected artifact exists at the universal path** (`$BUNDLE/dmg/*.dmg`, `$BUNDLE/macos/*.app.tar.gz`, `$BUNDLE/macos/*.app.tar.gz.sig`); fail if any is missing or if the glob is ambiguous (>1 match).
- **Clean before build** (Pitfall 1's clean step doubles here) so no stale `target/release/bundle/` can be mistaken for the universal output. Optionally assert the *old* `target/release/bundle/macos/*.app.tar.gz` is absent to catch accidental non-universal builds.
- Verify the binary is actually universal: `lipo -archs "$BUNDLE/macos/<App>.app/Contents/MacOS/<bin>"` should list both `x86_64 arm64`.

**Warning signs:**
"file not found" on publish; `.app.tar.gz` size unchanged from the previous arm64-only build (universal should be noticeably larger); `lipo -archs` shows only `arm64`.

**Phase to address:** Phase B (`build-and-publish`).

---

### Pitfall 3: Version lockstep drift across `package.json` / `tauri.conf.json` / `Cargo.toml` and the tag

**What goes wrong:**
The release version must be identical in `package.json`, `src-tauri/tauri.conf.json`, the git tag `vX.Y.Z`, *and* `latest.json.version`. Today they are **already drifted**: `package.json` = `0.2.1`, `tauri.conf.json` = `0.2.1`, but **`Cargo.toml` = `0.1.0`**. The updater compares `latest.json.version` against the *running app's `tauri.conf.json` version*, so a `tauri.conf.json` left un-bumped means existing installs **never detect** the new release (no update offered). A tag that disagrees with the artifact version produces a release whose URL path (`/download/vX.Y.Z/`) and manifest version don't line up.

**Why it happens:**
Three files in two languages, no single source of truth. `Cargo.toml` was never in the manual lockstep (RELEASE.md §1 bumps only two files), so it silently rotted to `0.1.0`. A bump script that updates two of three, or computes "next version" from a different file than it writes, drifts again. The confirmed v1.2 scope **adds `Cargo.toml` to the lockstep** — but the script must also *reconcile* the existing 0.1.0→current drift on first run.

**How to avoid (Phase A — `bump-and-tag`):**
- **One bump function writes all three** (`package.json`, `tauri.conf.json`, `Cargo.toml` `[package].version`) from a single computed target version. Use a real TOML/JSON edit (not regex that could match a dependency's `version =`), targeting the `[package]` table specifically in `Cargo.toml`.
- **Preflight equality assert:** before bumping, optionally assert the three are already equal (after the one-time 0.1.0 reconciliation); after bumping, assert all three == the new version == the tag about to be created. Abort non-zero on any mismatch.
- **Derive the tag from the written version**, never type it twice: `TAG="v$(read version from package.json)"`. The `latest.json.version` in Phase B must be read from the same source.
- Keep app semver (`0.2.x`) decoupled from GSD milestone tags (`v1.x`) — the script keys off the **app** version only (per PROJECT.md scope note). Don't let the script reach for the GSD `v1.1` tag.

**Warning signs:**
`grep '"version"'` / `grep '^version' Cargo.toml` disagree; new release published but old installs show "up to date"; release URL `vX.Y.Z` path 404s because the tag differs from the manifest version.

**Phase to address:** Phase A (`bump-and-tag`); the one-time `Cargo.toml` 0.1.0 reconciliation is a Phase A task.

---

### Pitfall 4: `pnpm-lock.yaml` (and/or `Cargo.lock`) goes stale after a bump → dirty tree / failed commit

**What goes wrong:**
Bumping `package.json`'s `version` can leave `pnpm-lock.yaml` out of sync (lockfiles record the workspace package version), and bumping `Cargo.toml` leaves `Cargo.lock` stale. The bump script commits `package.json` + `tauri.conf.json` + `Cargo.toml`, pushes the tag — but the lockfiles are now dirty/uncommitted, so (a) the lefthook pre-commit gate or a `--frozen-lockfile` CI install later fails, (b) the working tree is dirty at tag time so the tag captures an inconsistent state, or (c) a follow-up commit "fix lockfile" lands *after* the tag, meaning the tag doesn't point at a buildable, lockfile-consistent commit.

**Why it happens:**
Lockfiles are derived artifacts that humans forget and scripts often don't regenerate. The manual runbook never mentions them. `pnpm install --frozen-lockfile` (common in verify gates) then explodes far from the bump.

**How to avoid (Phase A):**
- After writing the three version files, **regenerate lockfiles deterministically**: `pnpm install --lockfile-only` (refreshes `pnpm-lock.yaml` without touching node_modules) and `cargo update -p <crate> --precise <ver>` *or* a plain `cargo build`/`cargo generate-lockfile` so `Cargo.lock` reflects the new `[package].version`.
- **Stage the regenerated lockfiles in the same commit** as the version bump, so the `vX.Y.Z` tag points at a clean, consistent tree.
- **Assert a clean working tree** (`git status --porcelain` empty) *immediately after* the bump commit and *before* `git tag` — abort if anything is unstaged. This is the single best guard that the tagged commit is reproducible.
- Run the existing lefthook gate's checks (or `pnpm install --frozen-lockfile`) in the preflight to prove the lockfile is honored.

**Warning signs:**
`git status` dirty after the bump commit; later `pnpm install --frozen-lockfile` fails with a lockfile-mismatch; a "fix lockfile" commit sits after the tag.

**Phase to address:** Phase A (`bump-and-tag`).

---

### Pitfall 5: Cross-repo publish — pushing the tag / release to the wrong repo, or `gh` auth/scope wrong

**What goes wrong:**
The split-repo layout means: **source commits + tag go to the private `bklim5/devtools` (`origin`)**, but the **GitHub Release + assets + `latest.json` go to the public `bklim5/devtools-releases`**. Easy failures: (a) `gh release create` without `--repo` targets `origin` (private) — the updater (unauthenticated) then 404s on the asset, breaking updates; (b) the tag gets pushed to the wrong remote, or the release is created against a tag that exists only in the private repo; (c) `gh auth` lacks write scope on the *public releases* repo (different repo, possibly needs explicit auth / PAT); (d) the `tauri.conf.json` `endpoints` URL drifts from the repo the release was actually published to.

**Why it happens:**
Two repos, one local checkout. `gh` defaults to the repo of the current directory's `origin` — which is the *private* one here. The manual runbook always passes `--repo bklim5/devtools-releases`; a script that drops it silently publishes to the wrong place. Cross-repo writes are an auth/scope footgun (the local-script milestone uses your personal `gh` auth; the CI cross-repo PAT is parked).

**How to avoid (Phase B):**
- **Hardcode the releases repo in one constant** `RELEASES_REPO=bklim5/devtools-releases` and pass `--repo "$RELEASES_REPO"` on **every** `gh release` call. Never rely on `origin`.
- **Preflight auth + scope assert:** `gh auth status` and `gh repo view "$RELEASES_REPO"` (or `gh api repos/$RELEASES_REPO --jq .permissions.push`) must succeed and show push permission *before* building — fail early, not after a 20-minute universal build.
- **Assert the source push target:** the tag/commit push goes to the private `origin`; assert `git remote get-url origin` matches the expected private URL.
- **Pin-consistency assert:** read `plugins.updater.endpoints[0]` from `tauri.conf.json` and assert it references `$RELEASES_REPO` and `releases/latest/download/latest.json`. If someone moves the endpoint, the script catches the drift (RELEASE.md §0.3: update *both* the endpoint and every manifest `url`).
- **Verify the public endpoint resolves** post-publish (`curl -L`) — confirms the asset is actually reachable unauthenticated.

**Warning signs:**
Release appears in the private repo's Releases tab; `curl -L .../devtools-releases/.../latest.json` 404s; `gh` errors with `HTTP 403`/`Resource not accessible`; the manifest `url` host doesn't match the configured endpoint host.

**Phase to address:** Phase B (`build-and-publish`); endpoint-consistency assert is a shared Phase C preflight.

---

### Pitfall 7: Leaking the minisign password / private key (in logs, process args, shell history, or commits)

**What goes wrong:**
Signed builds need `TAURI_SIGNING_PRIVATE_KEY` (or `_PATH`) **and** `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. A script can leak these by: (a) `set -x` / verbose tracing echoing the env into logs; (b) passing the password as a **command-line argument** (visible in `ps`/process table to any local process); (c) `echo`-ing the key into a file inside the repo; (d) committing the key or a `.env`; (e) printing the env on error. The private key is password-protected, so a leaked key *alone* can't forge an update — but leaking the **password too** removes that safety, and a forged update is signature-valid and auto-installs (catastrophic, see Pitfall 6).

**Why it happens:**
`set -x` for debugging is the classic culprit — it dumps every expanded variable. Convenience (inlining secrets as args) and habit (`echo $VAR` to debug) leak silently. Scripts run unattended, so a leak into a CI log or a committed file persists.

**How to avoid (Phase B + repo hygiene):**
- **Pass secrets only via environment**, never as CLI args (env is not in `ps`). Read the key from `~/.tauri/devtools.key` (outside the repo) at runtime; never copy it in.
- **Disable tracing around secret handling** — never `set -x` globally in the release script; if tracing is needed, scope it and `set +x` before touching `TAURI_SIGNING_*`.
- **Never echo secrets**; for presence checks, test `[ -n "$TAURI_SIGNING_PRIVATE_KEY_PASSWORD" ]` and print only "set"/"unset", never the value.
- **Preflight gitignore assert:** confirm `.gitignore` still blocks `*.key`, `*.p8`, `.env*`, `.envrc` (already in place per RELEASE.md §2) and that no key/`.env` is staged (`git diff --cached --name-only` contains none).
- **Confirm the password-protection invariant:** a missing/wrong password makes `tauri build` *fail to produce the `.sig`* — that's the gate working, not a bug (RELEASE.md §2). The script should surface that as a clear "signing failed: check `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`", not retry blindly.
- **Notarisation-ready secret handling:** apply the same no-echo/env-only rule to `APPLE_*` vars (`.p8`, key-id, issuer) for the deferred notarisation flip.

**Warning signs:**
`set -x` present in the release script; password appears in a CLI invocation; a `.key`/`.env` shows in `git status`; secrets visible in any captured log.

**Phase to address:** Phase B (`build-and-publish`) for runtime handling; a Phase C preflight asserts the gitignore + no-staged-secret invariants.

---

### Pitfall 8: Pubkey / keypair mismatch — the committed `pubkey` doesn't match the signing key

**What goes wrong:**
The updater verifies the payload signature against `plugins.updater.pubkey` **baked into the shipped app** (in `tauri.conf.json`). If the local private key (`~/.tauri/devtools.key`) is ever regenerated/rotated without re-pasting the new public half into `tauri.conf.json` *and shipping a build with it*, every signature verify fails — and you can't fix already-installed apps (they carry the old pubkey). This is a variant of Pitfall 1 that survives even a perfectly fresh `.sig`.

**Why it happens:**
The pubkey is committed once and forgotten; key rotation is rare so the coupling is easy to overlook. The signing succeeds (the private key is valid) and the `.sig` is fresh — only the *client's* baked-in pubkey disagrees, so it can't be caught by building/signing alone.

**How to avoid (Phase B / C preflight):**
- **Local verify against the committed pubkey, not the local pubkey file:** in the same preflight as Pitfall 1, extract `plugins.updater.pubkey` from `tauri.conf.json` and verify the fresh `.app.tar.gz` + `.sig` against *that* exact key. If it fails, the keypair and the shipped pubkey have diverged — stop before publishing.
- Treat any pubkey change as a coordinated event: rotating the key requires shipping a new build (carrying the new pubkey) *before* old installs can verify anything signed by the new key — and old installs may be strandable. Document this in the script's header.

**Warning signs:**
`InvalidSignature` even with a verified-fresh `.sig`; `tauri.conf.json` `pubkey` recently changed; `~/.tauri/devtools.key.pub` contents differ from the committed `pubkey` (base64-decode and compare).

**Phase to address:** Phase C (preflight verify); rotation policy documented in Phase B script.

---

### Pitfall 10: Committed/stale root `latest.json` shipped instead of the generated one

**What goes wrong:**
A `latest.json` sits at the repo root (currently pinned at `0.2.1`). Although `/latest.json` is **already in `.gitignore`**, the file still exists on disk (tracked from before it was ignored, or just untracked-but-present). A publish script that uploads `./latest.json` instead of the freshly generated one re-ships a stale manifest (old version, old signature) → updater offers nothing new or fails verify. The gitignore entry can also mask a *tracked* copy that git still version-controls (gitignore doesn't untrack already-tracked files).

**Why it happens:**
The historical workflow committed `latest.json`; v1.2 scope explicitly switches to **generated-only**. Until the tracked copy is `git rm --cached`'d and the on-disk file removed/regenerated, ambiguity remains about which `latest.json` is authoritative.

**How to avoid (Phase B):**
- **`git rm --cached latest.json`** if still tracked; confirm `git ls-files latest.json` returns nothing. Keep `/latest.json` in `.gitignore`.
- **Generate `latest.json` to a build/output dir** (e.g. alongside the bundle, or a `dist-release/` temp), not the repo root, and upload *that explicit path* — never `./latest.json`.
- **Assert freshness before upload:** the generated manifest's `version` must equal this build's version; refuse to upload a manifest whose version != the tag.

**Warning signs:**
`git ls-files latest.json` returns the path (still tracked); published manifest shows an old version; the script references `./latest.json`.

**Phase to address:** Phase B (`build-and-publish`); the `git rm --cached` cleanup is a one-time Phase A/B task.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip the local round-trip verify, trust the build | Faster release | A broken update auto-installs/fails for all users; unrecallable (Pitfall 6) | **Never** — this is the load-bearing check |
| Hardcode `target/release/bundle` paths (copy from RELEASE.md) | Less code | Silently ships stale/arm64-only artifacts under universal target (Pitfall 2) | Never for universal builds |
| Ship arm64-only `latest.json` (defer universal) | No `rustup target add`, faster build | Intel users get no updates (existing gap) — acceptable *only* if explicitly documented as the prior state | Only as the pre-v1.2 status quo, not as the v1.2 deliverable |
| One script does bump+build+publish with no dry-run | One command | No gate before irreversible publish (Pitfall 6) | Never — split build from publish |
| Regex-edit `Cargo.toml` version | Trivial | Can match a dependency's `version =`; bumps the wrong field (Pitfall 3) | Only with a `[package]`-scoped TOML edit |
| Leave `Cargo.lock`/`pnpm-lock.yaml` un-regenerated | Skips an install step | Tag points at a non-reproducible/dirty tree (Pitfall 4) | Never |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| GitHub Releases (`gh`) cross-repo | Omitting `--repo`; defaults to private `origin` | Always `--repo bklim5/devtools-releases`; preflight `gh auth`+push-permission check |
| Updater endpoint (`releases/latest/download`) | Adding `{{target}}`/`{{arch}}` templating to a static manifest URL → 404 | Static `latest.json` with explicit `platforms` keys; no templating in the endpoint |
| Universal binary ↔ `latest.json` keys | Inventing a `darwin-universal` key under default config | List both `darwin-aarch64` + `darwin-x86_64` → same universal `url`/`signature` (Pitfall 9) |
| minisign signature | Reusing/caching a `.sig`, or reading via loose glob | Read the exact fresh `.sig` post-build; verify against the committed pubkey (Pitfalls 1, 8) |
| `rustup` toolchain | Building universal without `x86_64-apple-darwin` installed | Preflight `rustup target list --installed`; offer `rustup target add x86_64-apple-darwin` |
| Tauri signing env | Passing key/password as CLI args; `set -x` | Env-only; no global tracing; presence-check without echoing (Pitfall 7) |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| `set -x` / verbose logs expose `TAURI_SIGNING_*` | Password leak → forged auto-installing updates | No global `set -x`; scope+`set +x` around secret handling |
| Password as command-line argument | Visible in `ps` to any local process | Pass via environment only |
| Committing `*.key` / `.env` / `.p8` | Permanent key exposure in git history | Preflight: assert gitignore covers them + nothing secret is staged |
| Publishing to a private repo by accident | Updater 404s (unauthenticated) → no updates | Force `--repo` to the public releases repo; verify endpoint resolves |
| Rotating the keypair without re-shipping pubkey | All signature verifies fail; installs strandable | Verify fresh `.sig` against the *committed* pubkey before publish (Pitfall 8) |

## "Looks Done But Isn't" Checklist

- [ ] **Version bump:** `package.json`, `tauri.conf.json`, AND `Cargo.toml` `[package].version` all equal the tag — verify all three (Cargo.toml is currently drifted at 0.1.0).
- [ ] **Lockfiles:** `pnpm-lock.yaml` + `Cargo.lock` regenerated and committed *with* the bump — verify `git status --porcelain` is empty before tagging.
- [ ] **Fresh signature:** `latest.json.signature` came from *this* build's `.sig` — verify the fresh `.app.tar.gz` + `.sig` against the committed `pubkey` locally.
- [ ] **Universal coverage:** `lipo -archs` shows `x86_64 arm64`; `latest.json` has both `darwin-aarch64` + `darwin-x86_64` keys → same URL.
- [ ] **Right repo:** release + assets + `latest.json` on `bklim5/devtools-releases` (public); tag on private `origin` — verify `curl -L .../latest/download/latest.json` resolves and matches the built version.
- [ ] **No stale manifest:** `git ls-files latest.json` is empty; the uploaded manifest is the generated one, not `./latest.json`.
- [ ] **Round-trip:** an *older* install actually detects → verifies → relaunches into the new version (the DST-02 proof) — not just "release exists".
- [ ] **Notarisation-ready:** script honors `APPLE_*` env if present but doesn't require it (ad-hoc signing path is the default this milestone).

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Stale/wrong `.sig` in `latest.json` (1, 8) | MEDIUM | Rebuild, regenerate manifest from the fresh `.sig`, re-upload `latest.json` (and asset if it changed); no version bump needed if the artifact is the same build, but safest is a new patch release |
| Published broken release as "latest" (6) | HIGH | Cut a new *good* patch release on top so `latest/download` redirects to it; users with a working updater recover, but those who already hit the bad one may need a manual DMG reinstall — unrecallable |
| Universal key missing / wrong (9) | LOW–MEDIUM | Edit `latest.json` (add both default keys → universal URL), re-upload; no rebuild if the universal artifact is already published |
| Tag pushed to wrong repo / wrong tag (5, 3) | MEDIUM | Delete the bad tag/release (private repo, before anyone consumes it); re-tag from the corrected, lockfile-clean commit; never delete a tag the public updater already serves |
| Leaked private key + password (7) | HIGH | Rotate the keypair, ship a new build carrying the new pubkey, deprecate old installs — strands users who can't reach the new build; treat as a security incident |
| Dirty tree / stale lockfile at tag (4) | LOW | Regenerate lockfiles, amend or add a clean commit, move the tag to the clean commit *before* publishing |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Stale/wrong signature | Phase B (gen) + Phase C (verify) | Local verify of fresh `.app.tar.gz`+`.sig` vs committed pubkey passes; post-publish `curl` matches |
| 6. Irreversible broken publish (blast radius) | Phase C | `--dry-run` shows intended actions; draft-promote ordering; post-publish endpoint smoke check |
| 9. Universal key mismatch | Phase B | `latest.json` has both default OS-ARCH keys → universal URL; Intel install updates |
| 2. Universal output path moved | Phase B | Artifacts asserted at `target/universal-apple-darwin/...`; `lipo -archs` shows both arches |
| 3. Version lockstep drift (incl. Cargo.toml) | Phase A | All three files + tag equal; one-time 0.1.0 reconciliation done |
| 4. Stale lockfiles / dirty tree | Phase A | `git status --porcelain` empty after bump commit; `--frozen-lockfile` install passes |
| 5. Cross-repo publish / auth | Phase B (+ Phase C preflight) | `gh` push permission on releases repo asserted; release lands on public repo; endpoint resolves |
| 7. Secret leakage | Phase B (+ Phase C preflight) | No `set -x` near secrets; no secret in args/logs; no staged `.key`/`.env` |
| 8. Pubkey/keypair mismatch | Phase C preflight | Fresh `.sig` verifies against the *committed* `pubkey`, not the local pubkey file |
| 10. Stale root `latest.json` | Phase A/B | `git ls-files latest.json` empty; generated manifest (not `./latest.json`) uploaded |

## Sources

- `docs/RELEASE.md` (first-party manual runbook — §0 split-repo/pubkey, §1 lockstep, §2 secrets, §3 build/DMG-flake, §4 cross-repo `gh`, §5 fresh-`.sig`/platform-key/no-templating, §6 endpoint resolve, §7 round-trip, Pitfall-7 arm64-only callout). HIGH.
- `.planning/ROADMAP.md` Phase 999.2 backlog (captured: arm64-only gap, stale committed `latest.json`, signing secrets, cross-repo PAT, Cargo.toml 0.1.0). HIGH.
- `src-tauri/tauri.conf.json` (default updater config — no custom target; endpoint pinned to public releases repo; ad-hoc `signingIdentity: "-"`; `createUpdaterArtifacts: true`). HIGH.
- Repo state verified 2026-06-02: `Cargo.toml` = `0.1.0`, `package.json`/`tauri.conf.json` = `0.2.1`; `/latest.json` gitignored but present on disk at `0.2.1`. HIGH.
- [Tauri 2 Updater plugin docs](https://v2.tauri.app/plugin/updater/) — static-JSON platform-key matching; custom target vs default OS-ARCH; no default `darwin-universal` key. HIGH.
- [Tauri 2 macOS Application Bundle docs](https://v2.tauri.app/distribute/macos-application-bundle/) and [Building universal binary discussion #9419](https://github.com/orgs/tauri-apps/discussions/9419) — `--target universal-apple-darwin` output path `src-tauri/target/universal-apple-darwin/release/bundle/...`; both arch targets required. MEDIUM–HIGH (output path corroborated across docs + community).
- MEMORY: `tauri-dmg-bundle-flake` (DMG step fails when other DMGs mounted — `hdiutil detach` + retry). HIGH (project experience).

---
*Pitfalls research for: local release-automation scripts (Tauri 2 macOS, signed updater, split-repo, universal binary)*
*Researched: 2026-06-02*
