# DevTools — Release Runbook (direct channel, macOS)

> Verified against the live tree on **2026-08-08**.

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
happened to `v1.0.1` and `v1.0.2` (see §7).

`[Unreleased]`'s empty state is the literal bullet `- _Nothing yet._`
(`UNRELEASED_PLACEHOLDER`). That string is **load-bearing, not decoration**:
`appendUnreleasedEntry` replaces it with the first real entry only when it is the section's
*sole* body, and `promoteUnreleased` re-emits it into the fresh section. Leave a paragraph
of prose there instead and the next `release:changelog` entry is *appended after it* — so
the prose ships as the release notes.

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

### Verify the key pairing BEFORE you build

The signing env being *present* proves nothing about it being the *right* key. If
`~/.tauri/devtools.key` is not the private half of the `plugins.updater.pubkey` compiled
into the build, `release:publish` still succeeds end to end — and every installed updater
rejects the result. Nothing in the pipeline catches that; the §4 round-trip gate catches it
only *after* a full universal build, notarisation and a published release.

So prove the pairing first. It costs seconds:

```bash
set -a; . ./.env; set +a                  # exports the signing env; never printed
echo pairing-check > /tmp/devtools-pairing.txt
rm -f /tmp/devtools-pairing.txt.sig
pnpm tauri signer sign /tmp/devtools-pairing.txt   # key + passphrase come from the env

node -e '
  const fs = require("fs");
  const conf = require("./src-tauri/tauri.conf.json");
  const b64 = s => Buffer.from(s, "base64");
  // Both the .pub and the .sig are minisign text files that tauri stores base64d
  // AGAIN (the conf value, the .sig on disk). Inside, the payload lines are
  // <2-byte alg><8-byte key id><rest>. Line 0 is the untrusted comment; the .pub
  // payload is line 1, and so is the .sig signature (line 2/3 are the trusted
  // comment and its global signature).
  const payload = (text, i) => b64(text.trim().split("\n")[i].trim());
  const pubId = payload(b64(conf.plugins.updater.pubkey).toString("utf8"), 1).subarray(2, 10);
  const sigId = payload(b64(fs.readFileSync("/tmp/devtools-pairing.txt.sig", "utf8")).toString("utf8"), 1).subarray(2, 10);
  const ok = pubId.equals(sigId);
  console.log("compiled-in pubkey key id:", pubId.toString("hex"));
  console.log("scratch signature key id :", sigId.toString("hex"));
  console.log(ok ? "PAIRED" : "MISMATCH — DO NOT RELEASE");
  process.exit(ok ? 0 : 1);
'
rm -f /tmp/devtools-pairing.txt /tmp/devtools-pairing.txt.sig
```

Key IDs are public (the committed pubkey's own comment line carries it), so this prints
nothing secret. A **MISMATCH means stop** — see `docs/KEYS.md` § 4 before touching
anything, because the fix is never "regenerate and commit the new pubkey".

**Per-channel build trees.** Each channel builds into its own tree so the three artifacts
coexist (the per-channel values are a row in `docs/CHANNELS.md`'s matrix). The rule that
belongs here: a **set** `CARGO_TARGET_DIR` **must be absolute**. Both drivers throw on a
relative path, because Tauri runs cargo with `CWD=src-tauri/` — a relative value would
resolve to a different tree for cargo than for the lipo/sig/dmg globs.

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

### The `v1.0.1` / `v1.0.2` empty-notes incident (2026-08-07)

Both tags shipped with the bare `- _Nothing yet._` placeholder as their annotated-tag
message *and* as their published GitHub release body — 284 commits of work (all of
milestones v1.6–v1.9, including the licensing system, the Settings modal and two new tools)
went out to direct-channel users described as nothing.

Cause: `[Unreleased]` was never filled before `release:bump` promoted it, and
`resolveReleaseNotes` falls back to the bare tag rather than failing (§1). The fallback is
deliberate — a release must not be blocked by a missing section — so the only real control
is the maintainer writing the notes first.

The tags and the published release bodies are **history and are deliberately not
rewritten**: republishing them would change what existing installs have already recorded,
for no user benefit. The `[1.0.1]` / `[1.0.2]` CHANGELOG sections were backfilled from the
milestone roadmaps on 2026-08-08 and are the corrected record. `CHANGELOG.md` itself carries
no commentary about this — it is a changelog, not a post-mortem.

---

## 8. Anything key-related — read `docs/KEYS.md`

This file used to carry its own key-regeneration advice ("re-paste the new
`devtools.key.pub` into `pubkey` and commit"). It was wrong, it would have stranded the
installed base, and it is deleted.

`docs/KEYS.md` is the **single owner** of rotation procedures, loss consequences and the
certificate expiry calendar — including why the minisign keypair cannot be rotated without
a transitional release (§ 4). Nothing about keys is restated here, deliberately: a second
copy is how the dangerous version survived for a year.

---

## 9. Recovery appendix — the manual flow

> **Only when `scripts/build-and-publish.mjs` is unusable.** This path has none of the
> driver's safety rails: no lipo both-arch assert, no single-fresh-`.sig` check, no
> already-published guard, no served-version verification, no asset-ordering guarantee. If
> you use it, you are the gate.

1. **Build.** With the signing env exported, run the driver's *exact* build command —
   `build-and-publish.mjs` pins **both** halves of the channel and dropping either one
   silently ships a wrong binary:

   ```bash
   VITE_CHANNEL=direct pnpm tauri build \
     --target universal-apple-darwin \
     --config src-tauri/tauri.direct.conf.json
   ```

   - `--config src-tauri/tauri.direct.conf.json` re-grants the direct-only
     `updater:default`, `process:allow-restart` and `autostart:*` capability
     permissions. Omit it and the release **links** the updater and autostart plugins
     while the webview lacks permission to call them — it builds, signs, notarises and
     publishes, and Check for Updates is simply dead. See the silent-drop trap in
     `docs/CHANNELS.md`.
   - `VITE_CHANNEL=direct` pins the *frontend* half. An ambient `VITE_CHANNEL=appstore`
     left over from a store build compiles `IS_APPSTORE=true` into the DMG — App Store
     upsell copy, no updater pane — on an otherwise correct native binary.

   Artifacts land under `$CARGO_TARGET_DIR/universal-apple-darwin/release/bundle/` —
   `dmg/*.dmg`, `macos/*.app.tar.gz`, `macos/*.app.tar.gz.sig`.
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
