# RELEASE-MACHINE.md — rebuild the release laptop

> Written 2026-08-08 (quick/260808-kfs) to close architecture-review finding **F2**: the
> entire release + support pipeline runs on one macOS machine with no CI. This is the
> checklist for reconstituting that machine — after a loss, a replacement, or simply to
> know how much of it is recoverable.
>
> Everything below was verified against the live tree on 2026-08-08.
> **Expiry dates live in `docs/KEYS.md` § 5 and are not restated here.**

## 0. What "the release machine" has to be able to do

| Capability | Command |
|---|---|
| Cut + push a version bump and tag | `pnpm release:bump <patch\|minor\|major>` |
| Build, notarise and publish the direct DMG | `pnpm release:publish` |
| Build all three signed channels locally | `scripts/build.sh --all` |
| Support ops on the licence box | `ssh tinkerdev-box` (see `infra/keygen/RUNBOOK.md`) |

If the rebuilt machine can do those four, it is done.

## 1. Toolchain

- [ ] **Xcode Command Line Tools** — `xcode-select --install`. Required for `codesign`,
      `notarytool`, `lipo`, `productbuild`, `spctl`.
- [ ] **Node** (a version that supports the repo's `tsx`-run `.mjs` drivers) and
      **pnpm 11.5.0** — pinned as `packageManager: "pnpm@11.5.0"` in `package.json`; install
      via corepack so the pin is honoured.
- [ ] `pnpm install` at the repo root.
- [ ] `pnpm lefthook install` — the `prepare` script does this automatically on install; run
      it explicitly if hooks are missing. Without it the pre-commit unit gate and the
      pre-push `cargo test` gate are silently absent.
- [ ] **rustup**, plus **both** macOS targets — `rustup target add aarch64-apple-darwin
      x86_64-apple-darwin`. `scripts/build-and-publish.mjs` preflights these and adds them
      idempotently, but a cold machine should have them before the first release.

## 2. Files that must be restored by hand

None of these are in the repository. All but the last are in the password manager.

- [ ] `~/.tauri/devtools.key` (and `devtools.key.pub`) — the updater minisign keypair
      (`docs/KEYS.md` A1). **Losing this strands the installed base; read KEYS.md § 4
      before touching it.**
- [ ] `~/.appstoreconnect/AuthKey_5SC6V2WGQ5.p8` — the App Store Connect API key used for
      notarisation (`docs/KEYS.md` A7).
- [ ] Root **`.env`** — copy `.env.example` and fill the six keys it lists by name:
      `TAURI_SIGNING_PRIVATE_KEY` (or `TAURI_SIGNING_PRIVATE_KEY_PATH`),
      `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, `APPLE_API_KEY_PATH`, `APPLE_API_KEY`,
      `APPLE_API_ISSUER`, `APPLE_SIGNING_IDENTITY`. It is gitignored;
      `scripts/build.sh` sources it itself (`scripts/build.sh:44-52`) and never prints it.
      Only the **direct** channel needs these — `appstore` and `appstore-pkg` sign from
      keychain certificates and need no `.env` secrets.
- [ ] **`src-tauri/embedded.provisionprofile`** — the Mac App Store distribution
      provisioning profile, read by `scripts/build-appstore-pkg.sh:64`.
      **This is a gap: it is gitignored and in NO backup** (`docs/KEYS.md` A9). It is
      regenerable from the Apple developer portal, but that is a portal round-trip in the
      middle of a submission. Put a copy in the password manager.

## 3. Login keychain — the four signing identities

Import each from its password-manager `.p12`, then confirm with `security find-identity -v`
(expect four valid identities):

- [ ] `Developer ID Application: Boon Khai Lim (FK4HQK83WX)` — direct DMG signing + notarisation
- [ ] `Apple Distribution: Boon Khai Lim (FK4HQK83WX)` — the store `.app` inside the `.pkg`
- [ ] `3rd Party Mac Developer Installer: Boon Khai Lim (FK4HQK83WX)` — signs the `.pkg` itself
- [ ] `Apple Development: Boon Khai Lim (9HGDC8C599)` — the dev-signed store build used for
      the local sandbox / StoreKit walkthrough

`scripts/build-appstore-bundle.sh:45` and `scripts/build-appstore-pkg.sh:93,104`
auto-detect these by name, so the certificate common names matter.

## 4. Auth sessions and remote access

- [ ] **`gh auth login`** with **write/admin** permission on the PUBLIC releases repo
      `bklim5/devtools-releases` (`scripts/build-and-publish.mjs:76`). Note that this repo
      is **not a git remote** — `git remote -v` shows only `origin`
      (`git@github.com:bklim5/devtools.git`, the private source repo). `release:publish`
      preflights both the auth and the permission before it builds anything.
- [ ] **`git` push access to `origin`** — `release:bump` pushes the commit and the tag.
- [ ] **`ssh tinkerdev-box`** key, for licence-box support ops and backup maintenance
      (`infra/keygen/RUNBOOK.md`).
- [ ] **Cloudflare R2** credentials and **healthchecks.io** access for the backup pipeline.
      The working copies live on the box at `~/.config/devtools-backup/backup.env` (600);
      the durable copies are in the password manager (`docs/KEYS.md` A6). A rebuilt laptop
      does not need them to release — only to administer the backups.
- [ ] **App Store Connect** account access (for the store channel and for revoking/reissuing
      the API key).
- [ ] **Lemon Squeezy** and **Resend** dashboard access (purchase pipeline support).

## 5. Smoke-test the rebuilt machine

Run these in order. Each is progressively more expensive, and each one that passes rules
out a whole class of missing material.

1. **`pnpm install && pnpm lint && pnpm tsc --noEmit && pnpm vitest run`**
   Toolchain only. No secrets involved.
2. **`pnpm release:publish --dry-run`**
   Runs every read-only preflight — signing env present, Apple env present, rustup both
   targets, `gh` auth **and** write permission on the public releases repo, release-not-
   already-published — then **short-circuits before the build with zero side effects**
   (`scripts/build-and-publish.mjs:13-29`). This is the single best test that §2 and §4 are
   complete.
3. **`scripts/build.sh appstore`**
   Needs no `.env` secrets — proves the keychain identities and the Xcode toolchain work.
4. **`scripts/build.sh direct`**
   The full signed + notarised DMG path (via `release:build-only`; it builds but does not
   publish). Proves `.env`, the minisign key and the notary credentials.
5. Optionally **`scripts/build.sh appstore-pkg`** — proves the Apple Distribution +
   Installer identities and `embedded.provisionprofile`.

Each channel builds into its own absolute `CARGO_TARGET_DIR`
(`src-tauri/target/{direct,appstore,appstore-pkg}`), so the three artifacts coexist
(`scripts/build.sh:64-76`). A **set** `CARGO_TARGET_DIR` must be absolute — the drivers
throw on a relative one, because Tauri runs cargo with `CWD=src-tauri/`.

## 6. What is *not* on this machine

- **No CI.** Everything above is manual by design today; see backlog `999.2` and the CI
  custody decision in `docs/KEYS.md` § 7 — that decision must be made before 999.2 starts,
  because a CI runner would need the strandable minisign key.
- **No copy of the licence box.** The box is rebuilt from `infra/keygen/RUNBOOK.md`
  § "Restore the license box from backup" (line 656), not from here.

---

**See also:** `docs/KEYS.md` (anchors, expiries, rotation), `docs/RELEASE.md` (the release
pipeline itself), `docs/CHANNELS.md` (what differs between the two build channels),
`infra/keygen/RUNBOOK.md` (the licence box).
