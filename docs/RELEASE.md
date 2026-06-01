# DevTools — Release Runbook (macOS)

A concrete, copy-pasteable runbook for cutting a signed DevTools release with a working
auto-updater round-trip. This is the **manual** process (D-16); CI automation is deferred to a
later phase.

> **What you produce per release:** a DMG (first-install only) **and** a `.app.tar.gz` +
> `.app.tar.gz.sig` (the updater payload), published on a GitHub Release together with a
> `latest.json` manifest. The updater consumes the **`.app.tar.gz`**, never the DMG.

> **Two independent signatures — do not conflate them:**
> - **minisign** signs the *update payload* (`.app.tar.gz`). Mandatory, on by default, cannot be
>   disabled. This is the DST-02 "verify before apply" backstop.
> - **Apple Developer-ID + notarisation** signs the *app identity* for Gatekeeper (DST-01). This is
>   **DEFERRED to post-enrolment (D-02)** — the current builds are ad-hoc (`signingIdentity: "-"`).
>   Ad-hoc Gatekeeper friction on first install is **expected and acceptable** this milestone.

---

## 0. PRE-RELEASE (one-time, before the FIRST release)

The updater endpoint and every `latest.json` `url` must point at the real public GitHub repo.

1. **Confirm the public GitHub repo exists.** The git remote is already:
   ```bash
   git remote -v
   # origin  git@github.com:bklim5/devtools.git
   ```
   Ensure `github.com/bklim5/devtools` is **public** (private repos do not serve
   `releases/latest/download/...` to unauthenticated updater clients).

2. **Confirm the updater endpoint matches the repo.** `src-tauri/tauri.conf.json` currently has:
   ```jsonc
   "plugins": {
     "updater": {
       "pubkey": "...",
       "endpoints": [
         "https://github.com/bklim5/devtools/releases/latest/download/latest.json"
       ]
     }
   }
   ```
   This is pinned to the **real** repo `bklim5/devtools` (NOT the historical `boonkhailim/devtools`
   placeholder). If you ever move the repo, update **both** this `endpoints` URL **and** every
   `url` in `latest.json` (step 5) to the new `owner/repo`.

3. **Confirm the committed pubkey matches your private key.** The `plugins.updater.pubkey` in
   `tauri.conf.json` is the public half of the minisign keypair at `~/.tauri/devtools.key`. If the
   keypair is ever regenerated, re-paste the new `~/.tauri/devtools.key.pub` contents into
   `pubkey` and commit — otherwise every update will fail signature verification (Pitfall 2).

---

## 1. Bump the version (lockstep — D-16)

Bump the **same** version in BOTH files (they must stay in sync; both are currently `0.2.0`):

- `src-tauri/tauri.conf.json` → `"version": "X.Y.Z"`
- `package.json` → `"version": "X.Y.Z"`

```bash
# Sanity-check they match before building:
grep '"version"' package.json
grep '"version"' src-tauri/tauri.conf.json
```

The updater compares `latest.json.version` against the running app's `tauri.conf.json` version, so
this bump is what makes an older install detect the new release.

---

## 2. Export the signing env (gitignored — NEVER committed, D-05)

The minisign keypair is **password-protected**. Signed builds require BOTH the private key AND its
password:

```bash
# Option A — pass the key CONTENTS inline (recommended; version-agnostic):
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/devtools.key)"

# Option B — pass the key by path (only on bundler versions that honor it;
# if you see "A public key has been found, but no private key", use Option A):
export TAURI_SIGNING_PRIVATE_KEY_PATH="$HOME/.tauri/devtools.key"

# REQUIRED in both cases — the password you chose at key generation:
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="<the password for ~/.tauri/devtools.key>"
```

- The private key lives at `~/.tauri/devtools.key` — **OUTSIDE the repo**. Never copy it in, never
  commit it. The `.gitignore` already blocks `.env`, `.env.*`, `.envrc`, `*.key`, `*.p8` (Plan 01),
  but the safest practice is to keep the key in `~/.tauri/` and only export from there.
- Only the **public** key (`devtools.key.pub`) belongs in the repo, and it is already committed into
  `tauri.conf.json`'s `plugins.updater.pubkey`.
- If `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` is wrong or unset, `tauri build` fails to produce the
  `.sig` (password-protected key cannot be decrypted) — that is the gate working, not a bug.

> **Post-enrolment (Apple Developer-ID + notarisation) — see § "Post-enrolment notarisation flip"
> below.** For this milestone, do NOT set the `APPLE_*` vars; ad-hoc signing is the path.

---

## 3. Build the signed bundle + updater artifacts

```bash
pnpm tauri build
```

With `bundle.createUpdaterArtifacts: true` (already set in `tauri.conf.json`), this produces THREE
outputs under `src-tauri/target/release/bundle/`:

| Artifact | Path (under `src-tauri/target/release/bundle/`) | Purpose |
|----------|--------------------------------------------------|---------|
| DMG | `dmg/*.dmg` | **First-install only** (uploaded to the Release for new users) |
| Updater payload | `macos/*.app.tar.gz` | What the updater downloads + applies |
| Payload signature | `macos/*.app.tar.gz.sig` | minisign signature; its contents go into `latest.json` |

```bash
ls -1 src-tauri/target/release/bundle/dmg/*.dmg
ls -1 src-tauri/target/release/bundle/macos/*.app.tar.gz
ls -1 src-tauri/target/release/bundle/macos/*.app.tar.gz.sig
```

### DMG flake mitigation (Pitfall 5 — repo-specific)

`bundle_dmg.sh`'s `hdiutil`/AppleScript step **fails when other DMGs are already mounted**. If the
build fails at the DMG step:

```bash
hdiutil info                 # list mounted images; note each /dev/diskN node
hdiutil detach /dev/diskN    # unmount each stray DMG (repeat per stray volume)
pnpm tauri build             # retry clean
```

(See also MEMORY: `tauri-dmg-bundle-flake`.)

---

## 4. Create the GitHub Release

1. Tag the release `vX.Y.Z` (matching the version from step 1).
2. Create a GitHub Release on `bklim5/devtools` for that tag.
3. Upload the **DMG** and the **`.app.tar.gz`** as release assets.

```bash
# Example with the gh CLI:
gh release create vX.Y.Z \
  src-tauri/target/release/bundle/dmg/*.dmg \
  src-tauri/target/release/bundle/macos/*.app.tar.gz \
  --title "vX.Y.Z" --notes "What changed in this release."
```

---

## 5. Build `latest.json` (D-07/D-08)

Create a `latest.json` describing this release. **Schema** (static manifest listing each platform):

```json
{
  "version": "X.Y.Z",
  "notes": "What changed in this release.",
  "pub_date": "2026-06-01T12:00:00Z",
  "platforms": {
    "darwin-aarch64": {
      "signature": "<contents of the FRESH *.app.tar.gz.sig for THIS build>",
      "url": "https://github.com/bklim5/devtools/releases/download/vX.Y.Z/<name>.app.tar.gz"
    }
  }
}
```

- **`signature`** — paste the **contents** of the freshly-built `*.app.tar.gz.sig`:
  ```bash
  cat src-tauri/target/release/bundle/macos/*.app.tar.gz.sig
  ```
  **NEVER reuse a stale `.sig` from a previous build** — the signature is per-payload; a mismatch
  makes the updater (correctly) refuse to install (Pitfall 2 / `InvalidSignature`). Always copy the
  `.sig` produced by THIS build's `pnpm tauri build`.
- **`url`** — the `releases/download/vX.Y.Z/...` URL of the uploaded `.app.tar.gz` asset (point at
  the **`.app.tar.gz`**, NOT the DMG — Pitfall 1).
- **Platform key** — this build host is **Apple Silicon (arm64)**, so the key is **`darwin-aarch64`**.
  (An Intel build host would emit `darwin-x86_64`.) The plugin reads `platforms.<key>` and picks the
  matching arch itself — do **not** put `{{target}}`/`{{arch}}` templating in the endpoint URL with a
  static `latest.json`; that produces a 404 (Pitfall 4).
- Set `version` (must equal step 1), `pub_date` (ISO-8601 UTC), and `notes`.

---

## 6. Upload `latest.json` to the same Release

Upload `latest.json` as an asset of the same `vX.Y.Z` Release so the stable redirect resolves:

```bash
gh release upload vX.Y.Z latest.json

# Confirm the endpoint the app polls actually resolves to THIS manifest:
curl -L https://github.com/bklim5/devtools/releases/latest/download/latest.json
```

`releases/latest/download/latest.json` is a stable GitHub redirect to the newest release's
`latest.json` — exactly the endpoint pinned in `tauri.conf.json`.

---

## 7. Verify the round-trip (the load-bearing proof — DST-02)

1. Install and run an **OLD** version (a build with a lower version than this release).
2. Trigger **"Check for Updates…"** (tray menu) — or relaunch if you opted in to auto-checks.
3. Confirm: the banner shows "vX.Y.Z available" → **Install** → the updater downloads,
   **verifies the minisign signature**, and **relaunches into the new version**.
4. A signature **mismatch MUST refuse to install** — that refusal is DST-02 working, not a failure.

> **CSP round-trip note (A2):** the updater's download runs **Rust-side** and may bypass the webview
> CSP entirely. The two GitHub hosts (`https://github.com`, `https://objects.githubusercontent.com`)
> were added to `connect-src` **defensively** so that, whether or not the fetch traverses the
> webview CSP, the round-trip is covered. Step 7 IS the authoritative confirmation that the real
> download verifies and applies — if it works, the CSP scope is correct.

---

## Callout: Per-arch caveat (Pitfall 7 / A4)

A **local Apple-Silicon build serves only `darwin-aarch64`.** Intel (`darwin-x86_64`) users are **not
served** an update until an `x86_64` (or a universal `tauri build --target universal-apple-darwin`)
build is also published and added to `latest.json`'s `platforms`. Universal-binary updater
platform-key matching is a known rough edge. For this local-build milestone (D-14) we ship the build
host's arch and document the gap here; both-arch / universal coverage is **deferred to the CI phase**.

---

## Callout: Post-enrolment notarisation flip (D-02/D-03)

DST-01's Gatekeeper-clean / Developer-ID notarisation clause is **DEFERRED** to after Apple Developer
Program enrolment and is **NOT a blocker** for the current milestone. When the cert exists, the flip
is **credentials + one config line** — no structural change (the hardened runtime + entitlements are
already committed):

1. Export the App Store Connect API key notary env (`.p8`, gitignored — D-03/D-05):
   ```bash
   export APPLE_API_KEY="<key-id>"
   export APPLE_API_ISSUER="<issuer-id>"
   export APPLE_API_KEY_PATH="$HOME/.appstoreconnect/AuthKey_<key-id>.p8"
   export APPLE_SIGNING_IDENTITY="Developer ID Application: <Name> (<TeamID>)"
   ```
2. Add `"providerShortName": "<TeamID>"` to `bundle.macOS` in `tauri.conf.json`.
   (Optionally also flip `signingIdentity` from `"-"` to the Developer-ID string, or let
   `APPLE_SIGNING_IDENTITY` override it.)
3. Rebuild: `pnpm tauri build`. **Tauri notarises automatically when the `APPLE_*` env is present.**
4. **THEN re-verify Gatekeeper-clean install** on a clean machine (no right-click→Open needed).

Until then, an ad-hoc build shows expected Gatekeeper friction on first install — right-click → Open
to bypass. This is the accepted state for the milestone (D-02).

---

## Callout: Secrets reminder (D-05)

The minisign **private key + password** and the Apple notary creds (`.p8`, key-id, issuer-id) are
**local, gitignored env only** — never committed. The `.gitignore` already ignores `.env`,
`.env.*`, `.envrc`, `*.key`, `*.p8` (Plan 01). Only the **public** minisign key is in the repo
(in `tauri.conf.json`'s `pubkey`). A leaked private key alone is insufficient to forge an update
**only because** the key is password-protected — keep the password out of the repo and out of shell
history where practical.

---

*Runbook owner: manual release (D-16). CI release-automation (sign + notarise + publish + update
`latest.json` from GitHub Actions secrets) is a deferred future phase.*
