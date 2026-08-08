# KEYS.md — trust anchors, loss consequences, rotation

> Written 2026-08-08 (quick/260808-kfs) to close architecture-review finding **F1 /
> KG-2**. Every claim below was verified against the live tree and the live login
> keychain on that date; where a fact came from a file, the `path:line` is cited so a
> future reader can re-check it in seconds.

## 1. Purpose, and the one rule

This file is an **inventory and a set of procedures**. It names every trust anchor the
product depends on, says where its secret half lives, what breaks if it is lost, and how
(or whether) it can be rotated.

**THE ONE RULE: no secret VALUE ever appears in this repository.** Not here, not in a
runbook, not in a commit message. Values live in exactly two kinds of place:

- the **password manager** (the durable copy), and
- a **gitignored `.env`** / the **login keychain** / a **600-mode file on the box** (the
  working copy).

Public halves that are *already* compiled into shipped binaries are referenced **by
`path:line`** rather than pasted — a pointer is enough, and pasting them trains the wrong
habit.

This rule is enforced mechanically: `scripts/check-doc-secrets.sh` scans the staged diff
of `docs/` and `CHANGELOG.md` for PEM headers, nontrivial `*KEY|SECRET|TOKEN|PASSWORD*=`
assignments, long base64/hex runs, and provider-specific prefixes. A hit is a hard fail.
There is no path allowlist.

### 1a. Known history exposure — A1 passphrase (open)

The rule above states the *intent*, not the current state of git history. It is not
retroactive, and this repository is **not** clean:

- **What:** the A1 minisign passphrase (`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`) was written
  out as a literal value in `docs/architecture-review-2026-07-06.md:28` — the review quoted
  the gitignored `.env` line verbatim while documenting the risk.
- **Introduced by:** commit `5b90a60a` ("docs: add 2026-07-06 architecture review"),
  2026-07-06.
- **Redacted in the working tree by:** commit `1a92f2fd` (quick/260808-kfs remediation,
  2026-08-08). The value is replaced with `<redacted — see password manager>`; the finding
  text around it is unchanged.
- **Still exposed:** **git history retains the value at `5b90a60a`** and in every commit
  between it and the redaction. A working-tree redaction does not remove it. Anyone with a
  clone — or with read access to the origin remote — can still recover it.
- **Blast radius:** the passphrase alone is not sufficient; it protects `~/.tauri/devtools.key`,
  which has never been committed. An attacker needs *both*. But treat the passphrase as
  compromised-in-principle from 2026-07-06 onward.
- **Open decision (owner):** either (a) change the passphrase on the existing minisign key
  (`minisign -C` re-encrypts the *same* keypair under a new passphrase — this does **not**
  strand the fleet, because the public key is unchanged; see §4 for why regenerating the
  *keypair* would), and/or (b) rewrite history (`git filter-repo`) plus a force-push, which
  invalidates every existing clone. Neither has been done. Until one is, this row stays open.

Do not delete this note when the decision lands — record the outcome and its date here
instead. A trust-anchor document that quietly forgets a past exposure is the same failure
mode as the one it is meant to prevent.

## 2. Anchor inventory

| # | Anchor | Secret half lives | Public / pinned half | Backup status |
|---|--------|-------------------|----------------------|---------------|
| A1 | **Updater minisign keypair** | `~/.tauri/devtools.key`; passphrase in the gitignored root `.env` as `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (`.env.example:11`) | `src-tauri/tauri.conf.json:52` → `plugins.updater.pubkey`, **compiled into every shipped direct build** | Key + passphrase in the password manager (owner, done) |
| A2 | **Keygen CE account Ed25519 keypair** | prod Postgres on `tinkerdev-box` (Keygen generates and holds it) | `src-tauri/src/license/config.rs:58` → `KEYGEN_ED25519_PUBKEY_B64` (release arm), **compiled into every shipped direct build** | Nightly encrypted `pg_dump` → Cloudflare R2 + an automated restore-validation run (`infra/keygen/RUNBOOK.md` Step 10, line 245) |
| A3 | **Keygen encryption roots** — `SECRET_KEY_BASE`, `ENCRYPTION_PRIMARY_KEY`, `ENCRYPTION_DETERMINISTIC_KEY`, `ENCRYPTION_KEY_DERIVATION_SALT` | `infra/keygen/.env` on the box (600) | — | Password manager; **NOT in the dump** (see §6) |
| A4 | **Keygen admin credentials / API token** | `infra/keygen/.env` (`KEYGEN_ADMIN_EMAIL`, `KEYGEN_ADMIN_PASSWORD`) and `server/webhook/.env` (`KEYGEN_ADMIN_TOKEN`) | — | Password manager |
| A5 | **Lemon Squeezy webhook secret + Resend API key** | `server/webhook/.env` (`LS_WEBHOOK_SECRET`, `RESEND_API_KEY`) | — | Password manager |
| A6 | **Backup GPG passphrase + R2 credentials** | `~/.config/devtools-backup/gpg.pass` and `~/.config/devtools-backup/backup.env` on the box, both 600 (`infra/keygen/RUNBOOK.md:304-320`) | — | Password manager (mandatory — see §3) |
| A7 | **Apple App Store Connect API key** | `~/.appstoreconnect/AuthKey_5SC6V2WGQ5.p8`; the key id / issuer id / path are named in `.env` as `APPLE_API_KEY`, `APPLE_API_ISSUER`, `APPLE_API_KEY_PATH` (`.env.example:13-16`) | — | `.p8` in the password manager |
| A8 | **Code-signing identities** (4, see §5) | macOS **login keychain** | Team ID `FK4HQK83WX` appears in `src-tauri/tauri.conf.json:44` and `src-tauri/entitlements.appstore.plist` | Exported as `.p12` into the password manager |
| A9 | **MAS provisioning profile** | `src-tauri/embedded.provisionprofile` — gitignored (`.gitignore:80`), present in the working tree | Embedded into the signed store `.app` by `scripts/build-appstore-pkg.sh` | **GAP: in no backup.** See §6 |

The compiled-in halves (A1, A2) are the two anchors that make this document necessary:
they are **fuses inside every binary already in users' hands**, and no server-side change
can move them.

## 3. Loss consequences, per anchor

**A1 — minisign private key lost or leaked.**
Every installed direct-channel app carries the matching public key (`tauri.conf.json:52`).
The updater refuses any artifact it cannot verify against *that* key. So:

- *Lost*: you can never ship another **update** to any existing install. The app keeps
  working; the update path is dead. Every user must manually download a new DMG, forever.
- *Leaked*: anyone can sign an artifact your users' updaters will accept, and you cannot
  revoke it without the same fleet-stranding migration described in §4.

**A2 — Keygen CE Postgres lost.**
Activation, TTL refresh, deactivation and seat release die for every buyer. Already-issued
`machine.lic` certs keep verifying **offline** until their cache lapses; the shipped
constants are `TTL_DAYS = 30`, `RENEW_AHEAD_DAYS = 7`, `GRACE_DAYS = 7`
(`src-tauri/src/license/config.rs:93,98,103`), so a Pro install degrades to Free within at
most **TTL + grace = 37 days** of its last successful refresh. That is the real repair
window, and it starts silently.

Restoring the DB with *regenerated* A3 values yields undecryptable columns — a restore that
looks successful and is not. That is why A3 is a separate row.

**A6 — GPG passphrase lost.**
Every offsite backup becomes permanently unopenable: a perfect encrypted archive of a
database nobody can read. `infra/keygen/RUNBOOK.md:333-336` says this in the same words.
It exists in exactly two places: `gpg.pass` on the box, and the password manager.

**A4 / A5 — admin token, LS webhook secret, Resend key.**
Rotatable in place, no fleet impact. While rotated: A4 loss stops the webhook creating
licences (a purchase completes but no key is issued — recoverable by hand); A5 loss stops
purchase emails.

**A7 / A8 / A9 — Apple materials.**
No effect on installed apps; **releases are blocked** until re-issued. A8 is the sharp
one: a Developer ID Application cert lapse blocks the direct DMG (signing + notarisation),
and an Apple Distribution / Installer lapse blocks the App Store `.pkg`. Re-issue is
self-service in the developer portal, but the private key must exist — losing the `.p12`
means generating a *new* identity, which means every future build is signed by a different
identity (fine for the store, and fine for Developer ID, but it invalidates nothing already
notarised).

## 4. Rotation procedures

### A1 — minisign: THERE IS NO ROTATION WITHOUT STRANDING THE FLEET

Say it plainly, because the old `docs/RELEASE.md` said the opposite: **regenerating the
minisign keypair and committing the new public key strands every install that has not
already adopted a build carrying that new key. Permanently.** Those users' updaters will
reject every future release and there is no server-side fix, because the key they trust is
compiled into the binary on their disk.

The **only** safe migration is a **transitional release**:

1. Publish version *N* **signed with the OLD key**, whose `src-tauri/tauri.conf.json`
   `plugins.updater.pubkey` already carries the **NEW** public key.
   (Old key signs it → existing installs accept it. New key is now trusted by everyone who
   takes it.)
2. **Wait for adoption.** Weeks, not hours. There is no telemetry in this app, so adoption
   is inferred from GitHub release asset download counts, not measured.
3. Only then start signing with the new key.

Anyone who skips version *N* entirely is stranded and must reinstall by hand. This is a
**planned multi-week operation, not a recovery path** — if the private key is already gone,
step 1 is impossible and the DMG-reinstall path is all that remains.

Same shape applies to moving the update **endpoint** (also compiled in, `tauri.conf.json:53-55`) —
see `RELEASE.md` § "Moving the update host".

### A2 — Keygen CE Ed25519: rotation requires shipping a binary, and waiting

The verifying key is compiled in (`config.rs:58`). Rotating it **server-side alone
invalidates every cached `machine.lic` in the field**, converting the whole paying base to
Free at their next verification. A rotation must ship a new binary carrying the new public
key and then wait out the same adoption window as A1 — with the added subtlety that a user
who does not update within TTL+grace (37 days) drops to Free regardless.

Practically: treat A2 as **not rotatable**. Protect it with backups (A3 + Step 10) instead.

### A3 — Keygen encryption roots

Do **not** rotate casually: they decrypt data at rest. If you must, it is a
re-encrypt-the-database operation, not a value swap. After ANY change to `infra/keygen/.env`:
re-run the fingerprint command in `infra/keygen/RUNBOOK.md:689-695` and update the table
there (§6). Never copy the resulting hashes into this file.

### A4 — Keygen admin token

Issue a new token in Keygen, update `KEYGEN_ADMIN_TOKEN` in `server/webhook/.env` on the
box, restart the webhook service, then re-verify by driving one licence lookup. Update the
`server/webhook/.env` fingerprint row in the RUNBOOK.

### A5 — Lemon Squeezy webhook secret / Resend key

Rotate at the provider, update `server/webhook/.env`, restart the webhook, then verify with
a real test purchase (LS secret) or a test send (Resend). Update the RUNBOOK fingerprint
row. A stale `LS_WEBHOOK_SECRET` fails **closed** — deliveries are rejected, not silently
accepted — so the failure is loud.

### A6 — backup GPG passphrase / R2 credentials

Changing the GPG passphrase does **not** re-encrypt existing archives: keep the old
passphrase in the password manager for as long as any archive encrypted with it is inside
the retention window (`infra/keygen/RUNBOOK.md` § Retention, line 337). R2 credentials
rotate in place in `~/.config/devtools-backup/backup.env` (600); the next scheduled run —
and its dead-man ping — is the verification.

### A7 / A8 — Apple certificates and the ASC key: renewal, not rotation

Apple certificates cannot be "rotated"; they are **re-issued and re-installed**:

1. Generate a CSR from the login keychain, create the new certificate in the developer
   portal, download and install it.
2. Export the new identity as `.p12` into the password manager immediately (this is the
   step people skip).
3. Leave the old certificate in the keychain until its last-signed artifact is retired —
   removing it early breaks nothing already notarised, but does break a rebuild of an old
   tag.

In flight: a build signed with an expired identity fails at `codesign`/notarisation, i.e.
**before** publishing — `build-and-publish.mjs` notarises and `spctl`-asserts before it
creates the GitHub release, so a lapsed cert cannot produce a half-published release.

The ASC API key (A7) is revoked-and-reissued in App Store Connect; update `APPLE_API_KEY`,
`APPLE_API_ISSUER`, `APPLE_API_KEY_PATH` in the gitignored `.env` (names only — see
`.env.example:13-16`) and drop the new `.p8` at `~/.appstoreconnect/`.

### A9 — MAS provisioning profile

Regenerate in the developer portal whenever the Apple Distribution certificate or the App
ID entitlements change, then replace `src-tauri/embedded.provisionprofile`.
`scripts/build-appstore-pkg.sh:64` reads it from that exact path.

## 5. Expiry calendar

Read on **2026-08-08** with `security find-identity -v` and
`security find-certificate -c "<CN>" -p | openssl x509 -noout -enddate`:

| Identity (login keychain) | Expires |
|---|---|
| `Developer ID Application: Boon Khai Lim (FK4HQK83WX)` | **2027-02-01** |
| `Apple Distribution: Boon Khai Lim (FK4HQK83WX)` | **2027-06-22** |
| `3rd Party Mac Developer Installer: Boon Khai Lim (FK4HQK83WX)` | **2027-06-22** |
| `Apple Development: Boon Khai Lim (9HGDC8C599)` | **2027-06-22** |

| Other dated material | Expires |
|---|---|
| `src-tauri/embedded.provisionprofile` (MAS distribution profile) | **2027-06-22** (read with `security cms -D -i src-tauri/embedded.provisionprofile \| plutil -extract ExpirationDate raw -`) |
| App Store Connect API key (`AuthKey_5SC6V2WGQ5.p8`) | no expiry; valid until revoked in App Store Connect |
| Minisign keypair (A1) / Keygen Ed25519 (A2) | no expiry — they fail by loss, not by date |

**Check this table every January.** The Developer ID certificate is the near-term one: it
lapses 2027-02-01 and its lapse blocks the direct channel entirely. Three of the four
identities and the provisioning profile fall due together on 2027-06-22 — plan that as one
renewal session, not four.

Re-read the dates rather than trusting this table if more than a few months have passed;
the commands above are the source.

## 6. Backup and restore-test status

- **Done (owner, manual):** minisign private key + passphrase, the Apple `.p8`, three
  signing identities exported as `.p12`, and a one-off CE `pg_dump` — all in the password
  manager.
- **Done (automated):** nightly encrypted `pg_dump` → Cloudflare R2, with a chained restore
  validation into a throwaway `--network none` Postgres that asserts the restored Ed25519
  account row matches the compiled release constants, plus two mandatory dead-man pings.
  See `infra/keygen/RUNBOOK.md` Step 10 (line 245) and § "The automated restore validation"
  (line 455).
- **Authoritative fingerprint record:** `infra/keygen/RUNBOOK.md` § "0. FIRST: the
  recovery-critical secrets that are NOT in the dump" (line 664) holds the sha256 + key-name
  table for `infra/keygen/.env` (17 keys) and `server/webhook/.env` (9 keys).
  **Do not duplicate those hashes here** — a stale second copy is worse than none, and the
  `long-hex` rule in `scripts/check-doc-secrets.sh` will reject an attempt to paste them.
- **Known gap — A9.** `src-tauri/embedded.provisionprofile` exists only in the working tree.
  It is gitignored, it is in no backup, and it is required to build the App Store `.pkg`.
  It *is* regenerable from the developer portal, so this is an inconvenience rather than a
  catastrophe — but it should be in the password manager alongside the `.p12` files.

## 7. Custody model for future CI (backlog 999.2)

CI cannot cut a direct-channel release without the minisign private key **and** its
passphrase as repository secrets, plus the Apple signing identity and the ASC key. Given
§3 — a leaked A1 is unrecoverable, and a compromised one cannot be revoked without a
multi-week transitional release — the custody decision must be made **before** 999.2
starts, not during it:

- **Self-hosted runner on trusted hardware** — secrets never leave the machine that already
  holds them; the cost is that CI is only as available as that machine (which is the status
  quo, minus the manual typing).
- **Hosted runner with repository secrets** — better availability; accepts that the
  strandable key now lives in a third party's secret store and in every job's environment.

Record whichever is chosen here, with its date and reasoning, when 999.2 is planned.

---

**See also:** `docs/RELEASE.md` (the direct-channel release pipeline — it points *here* for
anything key-related and never restates rotation advice), `docs/CHANNELS.md` (which anchor
each build channel actually uses), `docs/RELEASE-MACHINE.md` (what a rebuilt release laptop
needs), `infra/keygen/RUNBOOK.md` (the box, the backups, the fingerprint table).
