# DevTools — Release Runbook (direct channel, macOS)

> **Rewritten 2026-08-08** (quick/260808-kfs) to close architecture-review findings
> **F3 / F4 / F8 / KG-3**. The previous version of this file documented a hand-authored
> `latest.json` flow that the `release:publish` driver replaced, claimed both manifests were
> "currently 0.2.0", and advised regenerating the minisign keypair and committing the new
> public key — advice that would have **permanently stranded every installed app**. All of
> that is gone. Everything below was verified against the live tree on 2026-08-08.

**This runbook covers the DIRECT channel only** — the notarised DMG published to the public
`bklim5/devtools-releases` repo, with the self-updater. For the Mac App Store path see
`docs/CHANNELS.md` and `docs/appstore/`. For anything key-related — rotation, loss,
expiry — see **`docs/KEYS.md`**; this file never restates it.

---

## 1. TL;DR — the whole release in three commands

```bash
# 1. Write the notes FIRST. They become the tag message, the GitHub release body,
#    and the in-app updater banner.
$EDITOR CHANGELOG.md                    # fill the [Unreleased] section
#    ...or append one line non-interactively:
pnpm release:changelog "Fix the thing"  # add --commit to commit CHANGELOG.md alone

# 2. Bump + tag + push.
pnpm release:bump patch                 # patch | minor | major  [--dry-run]

# 3. Build, notarise, publish.
pnpm release:publish
```

That is the procedure. **The manual `gh release create` / hand-written `latest.json` flow in
§9 is a RECOVERY APPENDIX**, only for when `build-and-publish.mjs` is unusable. Using it
routinely skips every safety rail the driver exists to enforce.

**Order matters.** `release:bump` renames `## [Unreleased]` to `## [<version>] - <date>` and
inserts a fresh empty `[Unreleased]` above it (`promoteUnreleased` in
`src/lib/release/changelog.ts`). The tag message and the GitHub release body come from
`resolveReleaseNotes`, which **falls back to the bare tag when the section is empty**. So an
unfilled `[Unreleased]` silently ships a release with no notes — which is exactly what
happened to `v1.0.1` and `v1.0.2` (see §8).

### What you produce per release

| Artifact | Purpose |
|---|---|
| `*.dmg` | first install (new users) |
| `*.app.tar.gz` | the updater payload — the updater consumes **this**, never the DMG |
| `*.app.tar.gz.sig` | its minisign signature; its contents go into `latest.json` |
| `latest.json` | the manifest the app polls; uploaded **last** |

### Two independent signatures — do not conflate them

- **minisign** signs the *update payload*. Mandatory, cannot be disabled. This is the DST-02
  "verify before apply" backstop. The public half is compiled into every shipped build
  (`src-tauri/tauri.conf.json:52`).
- **Apple Developer ID + notarisation** signs the *app identity* for Gatekeeper (DST-01).
  Live since 2026-06-21; Team `FK4HQK83WX` (`tauri.conf.json:44`). Release builds are
  Developer-ID-signed, notarised and stapled when the `APPLE_*` env is present. Dev builds
  keep `signingIdentity: "-"` (ad-hoc, fast, Gatekeeper friction expected).

### Why a split repo

The updater downloads **unauthenticated**, so the artifacts must be public — but the source
is not. `origin` is the private source repo `git@github.com:bklim5/devtools.git`; releases
go to the **public** `bklim5/devtools-releases`, which is **not a git remote** at all
(`git remote -v` shows only `origin`). Every `gh` call in the driver passes `--repo`
(`scripts/build-and-publish.mjs:76`).

---

## 2. What each command actually does

Both drivers are thin I/O shells over unit-tested pure cores in `src/lib/release/`
(`bumpPlan.ts`, `publishPlan.ts`, `manifest.ts`, `changelog.ts`). The authoritative
description of each pipeline is the header comment of its script — read it before changing
anything.

### `pnpm release:bump <patch|minor|major> [--dry-run]`

→ `tsx scripts/bump-and-tag.mjs`. Arg grammar is exactly `patch|minor|major [--dry-run]`
(`parseBumpArgs`); a version string, a duplicate level, or any other flag is a usage error.

Ordered pipeline (`scripts/bump-and-tag.mjs:11-24`):

1. parse args → read current version → build the plan (one computed version, used everywhere)
2. **read-only preflights**: clean tree, branch is `master`, the tag is absent both locally
   and on the remote, and the `vitest` + `tsc` + `eslint` gate passes
3. `--dry-run` **short-circuits here — zero writes**
4. write the 3 manifests (`package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`)
5. regenerate + stage the lockfiles (`pnpm-lock.yaml`, `src-tauri/Cargo.lock`)
6. **allowlist diff** — refuses to tag if anything outside `ALLOWED_PATHS` changed, and
   refuses if any of the 3 required manifests did *not* change (`bumpPlan.ts:167-205`)
7. commit → annotated tag, **message = the CHANGELOG section**
8. assert the tree is clean → print the push plan → **y/N** → push the commit, then the tag

Safety invariants worth knowing: every subprocess call uses `execFileSync` with an argv
array (no shell-injection surface); the script **never** runs `git reset` or `git tag -d` —
on decline or failure it only *prints* the recovery commands; a non-TTY run declines the
push (default NO) and keeps the local work.

### `pnpm release:publish [--dry-run | --build-only]`

→ `tsx scripts/build-and-publish.mjs`. The two flags are mutually exclusive.
`pnpm release:build-only` is the same driver with `--build-only` (build, no publish) — that
is what `scripts/build.sh direct` calls.

Ordered pipeline (`scripts/build-and-publish.mjs:13-29`):

1. parse args → read version → build the plan view
2. **read-only preflights**: signing env present, Apple notary env presence, `rustup` has
   both targets, `gh` is authenticated **with write/admin on the public releases repo**, and
   the release is not already published
3. `--dry-run` **short-circuits here — no build, no writes, no network mutation**
4. `rustup target add` (idempotent) → clear any stale `.sig` → **universal** `tauri build`
5. `lipo` assert: the binary carries **both** `x86_64` and `arm64`
6. glob exactly **one fresh** `.sig` (0 or >1 is a hard failure)
7. notarise + staple the DMG, then `spctl` assert
8. write `latest.json` (generated, never `git add`-ed)
9. `gh release create` with the **assets first**
10. `gh release upload latest.json` **last**
11. `curl` the served endpoint and verify the version it reports
12. print the manual round-trip gate (§4)

The assets-before-manifest ordering in 9/10 is deliberate: if the run dies between them, the
old `latest.json` is still the newest one users see, so nobody is offered a manifest whose
assets do not exist.

### `pnpm release:changelog "<entry>" [--commit]`

→ `tsx scripts/changelog.mjs`. Appends one bullet to `[Unreleased]`. Default is edit-only;
`--commit` commits `CHANGELOG.md` **alone** (pathspec-scoped) so the bump's clean-tree
preflight still passes.

---

## 3. Environment and preflight expectations

**Secrets are never typed by hand.** `scripts/build.sh` sources the gitignored root `.env`
into its own shell (`set -a; . ./.env; set +a`) and never prints it
(`scripts/build.sh:44-52`). A **standalone** `pnpm release:publish` does *not* do that — it
reads `process.env`, so either run it through `scripts/build.sh direct` (build-only) or
export the same env yourself first. A bare `pnpm release:publish --dry-run` in a fresh shell
aborts at the first preflight with:

```
publish aborted: signing env missing (TAURI_SIGNING_PRIVATE_KEY[_PATH] +
TAURI_SIGNING_PRIVATE_KEY_PASSWORD). The .sig cannot be produced.
```

That is the gate working (verified 2026-08-08), not a bug.

The six `.env` keys, **by name only** (see the committed, value-free `.env.example`):
`TAURI_SIGNING_PRIVATE_KEY` (or `TAURI_SIGNING_PRIVATE_KEY_PATH`),
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, `APPLE_API_KEY_PATH`, `APPLE_API_KEY`,
`APPLE_API_ISSUER`, `APPLE_SIGNING_IDENTITY`. Where the values live, and what happens if
they are lost: `docs/KEYS.md`.

**Per-channel build trees.** Each channel builds into its own absolute `CARGO_TARGET_DIR`
(`src-tauri/target/{direct,appstore,appstore-pkg}`) so the three artifacts coexist. A **set**
`CARGO_TARGET_DIR` **must be absolute** — both drivers throw on a relative path, because
Tauri runs cargo with `CWD=src-tauri/`, which would split the build output from where the
lipo/sig/dmg globs look.

**Git hooks are part of the pipeline.** `lefthook.yml` runs `tsc` (root + `server/webhook`),
`vitest`, `eslint` and the planning-archive guard on **pre-commit**, and
`cargo test --manifest-path src-tauri/Cargo.toml` on **pre-push**. So `release:bump`'s push
step pays a cargo build — budget for it; it is not a hang.

**DMG flake mitigation** (still real — project memory `tauri-dmg-bundle-flake`): the
`bundle_dmg.sh` `hdiutil`/AppleScript step fails when other DMGs are mounted.

```bash
hdiutil info                 # list mounted images
hdiutil detach /dev/diskN    # unmount each stray volume
```

Then re-run.

---

## 4. The manual round-trip gate (DST-02)

`release:publish` prints this at the end, and it is the load-bearing human proof:

1. Install and run an **older** build.
2. Let it detect this release, or trigger **Check for Updates** explicitly.
3. Confirm minisign verifies the `.sig` against the compiled-in public key.
4. Confirm it downloads, applies, and **relaunches into the new version**.
5. If possible, repeat on both an Apple Silicon and an Intel machine — that is what proves
   the universal artifact serves both `darwin-aarch64` and `darwin-x86_64`.

**A signature mismatch MUST refuse to install.** That refusal is DST-02 working.

This gate is also, today, the only end-to-end check that the direct channel's capability
overlay is intact — see the silent-drop trap in `docs/CHANNELS.md`. Run it after any change
to `src-tauri/tauri.direct.conf.json`.

*CSP note:* the updater's download runs Rust-side and may bypass the webview CSP entirely.
`https://github.com` and `https://objects.githubusercontent.com` are in `connect-src`
defensively (`tauri.conf.json:27`) so the round-trip is covered either way. This gate is the
authoritative confirmation.

---

## 5. Rollback — revert by republishing

**Never delete or re-point a published release.** Installed apps poll
`releases/latest/download/latest.json`; deleting the newest release silently changes what
"latest" means for everyone, and an app that already downloaded the payload is unaffected
anyway. There is no rollback in the update protocol — only rolling *forward*.

To undo a bad release:

1. Revert the offending code on `master`.
2. `pnpm release:bump patch` — a **new, higher** version.
3. `pnpm release:publish`.

Users on the bad version update forward to the fix. Users who have not updated yet skip the
bad version entirely.

**If a run dies partway** (this is what the driver prints as recovery, from
`renderPublishRecovery`):

```bash
gh release view <tag> --repo bklim5/devtools-releases
gh release list --repo bklim5/devtools-releases
# to replace bad assets:
gh release delete-asset <tag> <asset> --repo bklim5/devtools-releases
pnpm release:publish
```

Nothing is auto-rolled-back. The script is idempotent up to the publish step and aborts if
the release already exists.

**Assets landed but `latest.json` did not** — the safe failure, by construction (§2 step
9/10). No user is offered the new version, because the manifest they poll still describes
the previous release. Re-run `release:publish`, or upload just the manifest:
`gh release upload <tag> latest.json --repo bklim5/devtools-releases`.

**`latest.json` landed but points at a broken payload** — the dangerous case. Fix forward
immediately with a new version; do not attempt to "unpublish".

---

## 6. Moving the update host

The updater endpoint is **compiled into every shipped binary**
(`src-tauri/tauri.conf.json:53-55`). An installed app polls the URL that was baked in when
*it* was built. Changing the URL in the repo therefore does **nothing** for existing
installs.

Moving the host is the same shape as a minisign key migration — a **transitional release**:

1. Publish version *N* **through the OLD endpoint**, with `plugins.updater.endpoints`
   already pointing at the NEW host. Existing installs fetch it from the old host, apply it,
   and are now pointed at the new host.
2. **Keep the old host serving** until the installed base has adopted *N*. Weeks, not hours.
   There is no telemetry; adoption is inferred from asset download counts.
3. Only then retire the old host.

Anyone who skips version *N* is stranded on a dead endpoint and must reinstall by hand.

Both the `endpoints` URL **and** every `url` inside `latest.json` change (the manifest URLs
are built from the releases repo by `buildAssetUrl`). Cross-reference `docs/KEYS.md` § 4 —
the minisign migration has the same constraint and, if you need both, they should be the
same transitional release.

---

## 7. Version and tag schemes (two of them, and they collide)

| Scheme | Shape | Created by | Pushed? |
|---|---|---|---|
| **Release tags** | `vX.Y.Z` (three-part) | `pnpm release:bump`; tag message = the CHANGELOG section | **Yes**, to `origin` |
| **Milestone tags** | `vX.Y` (two-part) | hand-made at milestone close | **No — local only** (project memory `milestone-tags-local-only`) |

Verified on 2026-08-08 with `git tag` and `git ls-remote --tags origin`:

- Release tags, all present on `origin`: `v0.2.2 v0.3.0 v0.3.1 v0.3.3 v0.4.0 v0.4.1 v1.0.1
  v1.0.2`. (`v0.3.2` exists **locally only** — it was never pushed.)
- Milestone tags, all local only: `v1.0 v1.1 v1.2 v1.3 v1.4 v1.5 v1.6 v1.7 v1.8 v1.9`.
- **There is no `v1.0.0` release tag.** `package.json` and `src-tauri/tauri.conf.json` are
  both at `1.0.2`; the jump to 1.0.0 was made for the App Store submission and the first
  direct release at that major was `v1.0.1`.
- Direct-channel users therefore went **0.4.1 → 1.0.1**, across 284 commits (all of
  milestones v1.6–v1.9).

**Recommendation:** prefix future milestone tags — `milestone/v2.0` — so `git tag | sort -V`
stops interleaving two unrelated schemes and a `vX.Y` can never be mistaken for a shippable
release. Do not rename the existing ones; `v1.0`–`v1.9` are local and harmless.

---

## 8. Key regeneration — read `docs/KEYS.md`, do not improvise

The advice that used to live here — "if the keypair is ever regenerated, re-paste the new
`devtools.key.pub` into `pubkey` and commit" — was **wrong and dangerous**, and is deleted.

**Regenerating the minisign keypair strands every existing install, permanently.** The public
key is compiled into the binary on each user's disk; their updater will reject every future
release, and no server-side change can fix it. It is not a recovery path. The only safe
migration is a transitional release signed with the OLD key that carries the NEW public key,
followed by a multi-week adoption wait.

The full procedure, the loss consequences of every other anchor, and the certificate expiry
calendar live in **`docs/KEYS.md`**. Nothing about keys should ever be restated here.

---

## 9. Recovery appendix — the manual flow

> **Only when `scripts/build-and-publish.mjs` is unusable.** This path has none of the
> driver's safety rails: no lipo both-arch assert, no single-fresh-`.sig` check, no
> already-published guard, no served-version verification, no asset-ordering guarantee. If
> you use it, you are the gate.

1. **Build.** `pnpm tauri build --target universal-apple-darwin` (with the signing env
   exported). Artifacts land under
   `$CARGO_TARGET_DIR/universal-apple-darwin/release/bundle/` — `dmg/*.dmg`,
   `macos/*.app.tar.gz`, `macos/*.app.tar.gz.sig`.
2. **Create the release, assets first.**
   ```bash
   gh release create vX.Y.Z \
     --repo bklim5/devtools-releases \
     "<path>/dmg/"*.dmg \
     "<path>/macos/"*.app.tar.gz \
     --title "vX.Y.Z" --notes "<the CHANGELOG section for X.Y.Z>"
   ```
3. **Write `latest.json` by hand.**
   ```json
   {
     "version": "X.Y.Z",
     "notes": "...",
     "pub_date": "2026-01-01T12:00:00Z",
     "platforms": {
       "darwin-aarch64": {
         "signature": "<contents of the FRESH .app.tar.gz.sig from THIS build>",
         "url": "https://github.com/bklim5/devtools-releases/releases/download/vX.Y.Z/<name>.app.tar.gz"
       },
       "darwin-x86_64": { "signature": "<same>", "url": "<same>" }
     }
   }
   ```
   - **NEVER reuse a stale `.sig`.** The signature is per-payload; a mismatch makes the
     updater correctly refuse to install. Copy the `.sig` produced by *this* build.
   - The `url` must point at the **`.app.tar.gz`**, never the DMG.
   - A universal build serves both platform keys from the same artifact. Do **not** put
     `{{target}}` / `{{arch}}` templating in the endpoint URL with a static manifest — it
     404s.
4. **Upload the manifest LAST**, then verify what the endpoint actually serves:
   ```bash
   gh release upload vX.Y.Z latest.json --repo bklim5/devtools-releases
   curl -L https://github.com/bklim5/devtools-releases/releases/latest/download/latest.json
   ```
5. Run the §4 round-trip gate. It is not optional on this path.

---

## 10. Channel note, and what is deferred

This runbook is the **direct** channel. The Mac App Store build is a different binary with
different features, entitlements, capabilities and Pro-entitlement source — see
`docs/CHANNELS.md` for the full matrix and `docs/appstore/SUBMISSION-RUNBOOK.md` for the
submission path.

CI release automation is backlog **999.2**. Before it starts, the key-custody decision in
`docs/KEYS.md` § 7 must be made: a CI runner needs the minisign private key and its
passphrase, and a leaked one cannot be revoked without a multi-week transitional release.
`docs/RELEASE-MACHINE.md` documents everything the current single-laptop pipeline depends on.
