# Production bring-up RUNBOOK (Phase 20, D-46)

The ordered, copy-pasteable human checklist for standing up the production
purchase pipeline. Claude committed the stack (`infra/keygen/`, `server/webhook/`);
**you** run this — VPS provisioning, SSH, DNS, the LS/Resend dashboards, and the
live purchase are manual steps Claude cannot do.

**Hard ordering (do not reorder):**
- **`swap.sh` runs BEFORE any CE bring-up** (Pitfall 6 — OOM during migration).
- **The A-record `license.tinkerdev.io` is live BEFORE the first Caddy boot**
  (Pitfall 3 — Let's Encrypt HTTP-01 needs it; no `-k`, no `tls internal`).
- **`setup.sh` runs AFTER `web` + `caddy` are up and the cert is real** — it calls
  the CE admin API over the PUBLIC https host (no `-k`), so the data tier alone is
  NOT enough. (Order: `run --rm setup` → up `web worker caddy` → verify TLS → `./setup.sh`.)
- **The `webhook` container starts LAST (Step 7)** — only after its `.env` has the
  admin token + LS secret + Resend key, else it crash-loops on the required-env check.
- **The `tinkerdev.io/buy` redirect is configured AFTER the LS store exists**
  (the live checkout URL only exists once the product is created).

**What the prod constants (Task 3) actually need:** box + Docker + the A-record live
+ ports 80/443 + the CE stack (`web`+`caddy`) on real TLS + `setup.sh`. They do **NOT**
need Lemon Squeezy or Resend — those gate the live-purchase ship-gate (Task 4), not the
constants. So you can capture the constants now and finish the dashboards in parallel.

**Secret discipline (criterion 4, D-41/D-55):** every secret below lives ONLY in
a gitignored `.env` ON THE BOX. Nothing privileged is ever committed or shipped
in the app. The two env files:
- `infra/keygen/.env` — CE containers: `SECRET_KEY_BASE`, `ENCRYPTION_*`,
  `KEYGEN_ACCOUNT_ID`, `CADDY_ACME_EMAIL`, postgres password.
- `server/webhook/.env` — webhook: `KEYGEN_BASE_URL=https://license.tinkerdev.io`
  (keygen forces HTTPS + the canonical Host, so an internal `http://web:3000`
  401/403/301s; the public URL resolves to the box's OWN public IP so it stays
  on-host over TLS — token still never crosses the internet, D-55),
  `KEYGEN_ACCOUNT_ID`, `KEYGEN_ADMIN_TOKEN`, `KEYGEN_POLICY_ID`,
  `LS_WEBHOOK_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `PORT`.
- `~/.config/devtools-backup/{backup.env,gpg.pass}` (mode 600) — the offsite
  backup credentials and GPG passphrase (Step 10). Deliberately **outside** the
  repo and outside `deploy.sh`'s rsync path.

---

## Step 1 — Start the slow accounts FIRST (long-poles)

These have human-review / DNS-propagation latency, so kick them off before the
VPS so they finish in parallel.

1. **Lemon Squeezy seller account** (D-61 — Singapore payout already confirmed by
   the user). Create the account and begin seller onboarding / KYC. *KYC review
   can take days* — start now. Do NOT create the store/product yet (Step 5).
2. **Resend account** (D-64). Create it, then go to **Domains → Add Domain →
   `tinkerdev.io`** and begin verification — it prints DKIM/SPF DNS records you
   add in Step 3. DNS propagation is the long pole.

---

## Step 2 — Provision the VPS (D-47/D-49)

1. **Hetzner Cloud Console → Add Server:** **CX23** (Cost-Optimized, **x86**
   Intel/AMD, 2 vCPU / 4 GB / 40 GB), **EU region**.
2. **Enable provider snapshots NOW** (D-49 — losing the license DB breaks every
   buyer's refresh/transfer/revocation). This is the phase-20 backup floor.
   The offsite pg_dump that used to be a deferred follow-up is now **live** —
   see **Step 10** (nightly encrypted backup to Cloudflare R2) and
   **"Restore the license box from backup"**. Snapshots remain the fast path for
   a merely-broken box; the R2 dump is what survives losing the Hetzner account
   itself.
3. **Firewall: open ONLY ports 22, 80, 443.** (80+443 are required for Caddy's
   ACME HTTP-01 + TLS; 22 for SSH.)
4. Add your **SSH key**; disable password auth.
5. **Install Docker + Compose** on the box (`apt install docker.io docker-compose-plugin`
   or Docker's official convenience script).

---

## Step 3 — DNS (Cloudflare for `tinkerdev.io`)

1. **A record `license.tinkerdev.io` → VPS public IP.** This MUST resolve BEFORE
   the first Caddy boot (Step 4.7) — Let's Encrypt HTTP-01 fails otherwise
   (Pitfall 3). If using Cloudflare proxy (orange cloud), set it to **DNS-only
   (grey cloud)** for `license.` so Caddy terminates TLS directly.
2. **Resend records** (from Step 1.2): add the **DKIM, SPF, and DMARC** records
   for `tinkerdev.io` (D-65). Wait for Resend to show the domain **Verified**.
3. **`alerts@tinkerdev.io` → your inbox** via Cloudflare Email Routing (D-72 /
   D-59 failure alerts forward to you). This is also the `CADDY_ACME_EMAIL`.

---

## Step 4 — CE bring-up ON THE BOX (in order — Pitfall 6 + 8)

Get the repo onto the box (`git clone` or `infra/keygen/deploy.sh` rsync from
your machine). Then, from the repo root on the box:

1. **Swap FIRST** (before anything CE — Pitfall 6):
   ```bash
   sudo infra/keygen/swap.sh
   ```
2. **CE env:** generate the real secrets (NEVER commit):
   ```bash
   cd infra/keygen
   cp .env.example .env
   # Replace every "$(...)" with that command's output:
   #   SECRET_KEY_BASE      = openssl rand -hex 64
   #   ENCRYPTION_*         = openssl rand -base64 32  (three distinct keys)
   #   POSTGRES_PASSWORD    = openssl rand -hex 16
   #   KEYGEN_ADMIN_PASSWORD= openssl rand -hex 16
   #   KEYGEN_ACCOUNT_ID    = uuidgen | tr 'A-Z' 'a-z'   (the fresh prod account, D-51)
   # Leave KEYGEN_HOST/KEYGEN_DOMAIN = license.tinkerdev.io and
   # CADDY_ACME_EMAIL = alerts@tinkerdev.io.
   ```
3. **Webhook env** (separate file — secrets stay on box, D-55):
   ```bash
   cp ../../server/webhook/.env.example ../../server/webhook/.env
   # Set KEYGEN_BASE_URL=https://license.tinkerdev.io  (keygen forces https+canonical Host;
   #   resolves to the box's own public IP so it stays on-host over TLS — D-55)
   # Set KEYGEN_ACCOUNT_ID = the SAME uuid you put in infra/keygen/.env.
   # Leave KEYGEN_ADMIN_TOKEN / KEYGEN_POLICY_ID / LS_WEBHOOK_SECRET / RESEND_API_KEY
   # blank for now — filled in Steps 4.5, 5, 7.
   ```
4. **Bring up the data tier + create the account ONCE** (Pitfall 8 — `setup` is
   one-shot, never in `up`):
   ```bash
   docker compose -f compose.yaml up -d postgres redis
   docker compose -f compose.yaml run --rm setup     # rails keygen:setup — creates the account + Ed25519 keypair + admin user
   ```
5. **Bring up the API + TLS front, THEN verify real TLS — NO `-k`** (`setup.sh` in
   the next step calls the CE API over the PUBLIC https host, so `web` + `caddy`
   must be up and the cert must be real FIRST). Do **not** start the `webhook`
   container yet — its `.env` is completed in Steps 5/7:
   ```bash
   docker compose -f compose.yaml up -d web worker caddy
   curl https://license.tinkerdev.io/v1/health        # expect 204, over REAL TLS (no -k)
   ```
   If this needs `-k`, the cert is NOT trusted — fix the A-record / ports 80+443
   and let Caddy re-issue before proceeding (Pitfall 3 — release builds need a
   publicly trusted cert).
6. **Provision product/policy/entitlements + validate metadata** (D-51/D-53/D-54)
   — now that the API + TLS are live:
   ```bash
   ./setup.sh
   ```
   It prints, at the end:
   ```
   PROD_ACCOUNT_ID=...
   PROD_ED25519_PUBKEY_B64=...   # base64 of the RAW 32 bytes
   PROD_POLICY_ID=...
   ```
   **Record all three** and confirm the `metadata-validation: PASSED` line (A2 —
   the `?metadata[orderId]=` filter works, so D-58 idempotency is sound). Then
   **mint a long-lived admin token** for the webhook and put it + `PROD_POLICY_ID`
   into `server/webhook/.env` (`KEYGEN_ADMIN_TOKEN`, `KEYGEN_POLICY_ID`):
   ```bash
   curl -s -u "$KEYGEN_ADMIN_EMAIL:$KEYGEN_ADMIN_PASSWORD" \
     -H "Accept: application/vnd.api+json" \
     -X POST https://license.tinkerdev.io/v1/tokens | jq -r '.data.attributes.token'
   ```
   (`$KEYGEN_ADMIN_EMAIL` / `$KEYGEN_ADMIN_PASSWORD` are the values you set in
   `infra/keygen/.env`. The `webhook` container is started later, in Step 7, once
   its `.env` is complete — so it never crash-loops on a missing secret.)

   **→ At this point you can resume Claude (Task 3): paste `PROD_ACCOUNT_ID` +
   `PROD_ED25519_PUBKEY_B64`.** Steps 5–8 below (LS, Resend, redirect, webhook,
   UptimeRobot) gate the live-purchase ship-gate (Task 4), not the constants, and
   can run in parallel.

---

## Step 5 — Lemon Squeezy store (D-62/D-70/D-60)

1. Create the **store** + a **USD-9 one-time product** (D-62, lifetime license).
2. Configure the **success page "check email" copy** (D-70), e.g.: *"Thanks!
   Your license key is on its way to your email — open DevTools → Unlock Pro to
   activate."*
3. **Settings → Webhooks →** add an **`order_created`** webhook pointing at:
   **`https://license.tinkerdev.io/webhooks/lemonsqueezy`**
4. Copy the webhook **signing secret** into `server/webhook/.env` as
   `LS_WEBHOOK_SECRET` (D-60).

---

## Step 6 — `/buy` redirect (AFTER the store exists — D-68, Open Question 2)

The app ships the compiled constant `https://tinkerdev.io/buy` (Plan 01); only
now does the live LS checkout URL exist. Point `tinkerdev.io/buy` at the LS
checkout via a **Cloudflare redirect rule** (or Caddy on the VPS). Until this is
set, `/buy` may placeholder — set it now that the product is live.

---

## Step 7 — Finish the webhook `.env` + redeploy (D-55/D-64)

Confirm `server/webhook/.env` on the box now has ALL of:

| Var | Value / source |
|---|---|
| `KEYGEN_BASE_URL` | `https://license.tinkerdev.io` (keygen forces https+canonical Host; stays on-host via the box's own public IP, D-55) |
| `KEYGEN_ACCOUNT_ID` | `PROD_ACCOUNT_ID` (Step 4.5) |
| `KEYGEN_ADMIN_TOKEN` | admin token minted in Step 4.5 (server-side ONLY) |
| `KEYGEN_POLICY_ID` | `PROD_POLICY_ID` (Step 4.5) |
| `LS_WEBHOOK_SECRET` | LS signing secret (Step 5.4) |
| `RESEND_API_KEY` | Resend Dashboard → API Keys |
| `EMAIL_FROM` | `TinkerDev Licenses <licenses@tinkerdev.io>` (D-65) |
| `EMAIL_REPLY_TO` | The reply-to address on the license email — the address buyers reply to for the D-80 lost-device fallback ("Freeing a seat" below). Present in the live file but previously missing from this table; listed here so a rebuild does not silently drop it. Take the exact value from the password-manager copy of `server/webhook/.env`. |
| `PORT` | `8787` |

(The live file has **9** keys — the 8 above plus `EMAIL_REPLY_TO`. The
authoritative fingerprint + key list is in the recovery table under
"Restore the license box from backup".)

Then redeploy the webhook so it picks up the env:
```bash
docker compose -f infra/keygen/compose.yaml up -d webhook
# or from your machine: DEPLOY_HOST=root@<ip> infra/keygen/deploy.sh webhook
```

---

## Step 8 — UptimeRobot (D-72)

Add HTTP monitors (free tier) on both health endpoints so a down box is noticed
before a buyer hits it:
- `https://license.tinkerdev.io/v1/health` (CE)
- `https://license.tinkerdev.io/health` (webhook)

Point uptime/failure alerts at `alerts@tinkerdev.io` (forwards to your inbox).

---

## Step 9 — Ship-gate pointer (D-63, Task 4)

Bring-up is done. The end-to-end proof is **Task 4** (the human-verify ship-gate),
run AFTER Claude captures the prod constants (Task 3) and builds the app:

1. **LS test mode:** Buy (built app → browser → `tinkerdev.io/buy` → LS test
   checkout) → `order_created` webhook fires → CE mints a perpetual/node-locked/
   max=1 license carrying `pro.theming`+`pro.ordering` + `metadata.orderId` →
   Resend emails the plain-text key → paste it in Unlock Pro → it activates via
   the unchanged Phase-19 flow.
2. **One live USD-9 purchase** (**D-63**) — the same chain end-to-end with real
   money, **refunded afterward** (the strongest criterion-3 proof).
3. `gsd-ui-review` WCAG-AA audit on the Buy affordance + the grep-clean
   (criterion 4: no privileged secret in the repo or the `.app`).

---

## Step 10 — Offsite encrypted backups (Cloudflare R2)

Provider snapshots (Step 2.2) die with the Hetzner account. This is the copy
that does not: an encrypted dump at a **different vendor**, proven restorable
after every single run.

### What runs, and when

```
17 3 * * *   ~/devtools/infra/keygen/backup.sh   >> ~/.local/state/devtools-backup/cron.log 2>&1
```

Installed (idempotently) by `backup.sh --install-cron` in the crontab of user
`claude`. One run does:

`pg_dump` (read-only, live DB never mutated) → **sanity-gate the plaintext**
(min size + `CREATE TABLE public.accounts` + `COPY public.accounts` present) →
`gzip -9` → `gpg --symmetric` **AES-256** (S2K mode 3 / SHA512 / 65011712) →
**local decrypt + `gunzip -t` round-trip** → `rclone copyto` to R2 → **verify the
remote size matches** → 40-day retention backstop → ping the backup dead-man
check → **chained `restore-test.sh` against the object it just uploaded**.

Artifact lands at:

```
r2:tinkerdev-backups/keygen-ce/keygen-<UTC-timestamp>.sql.gz.gpg
```

Typical run: **~6 seconds**, ~42 KB encrypted (the DB is 13 MB, but it is mostly
empty index/page overhead — six rows of real data compress hard). Do not read
the *encrypted* size as the health signal; the meaningful gates are the
plaintext sanity gate and the restore test's row-count comparison against live.

### Where the secrets live (and why NOT in `infra/keygen/`)

| Path | Mode | Holds |
|---|---|---|
| `~/.config/devtools-backup/backup.env` | 600 | R2 key id/secret/endpoint, bucket, prefix, both ping URLs, retention days |
| `~/.config/devtools-backup/gpg.pass` | 600 | the symmetric passphrase, and nothing else |

**These are deliberately OUTSIDE `infra/keygen/`.** `deploy.sh` rsyncs that
directory with `--delete` and excludes only `.env` and `*.crt`, so anything new
placed there is wiped by the next deploy. If you ever refactor `deploy.sh`, do
not "helpfully" move these back in. The committed template is
`infra/keygen/backup.env.example` (placeholders only); `.gitignore` catches a
stray copy landing in the repo.

Both scripts **fail closed**: a missing env file, or one that is not mode 600,
is a hard stop — never a degraded run.

> **The GPG passphrase must also be in the password manager.** It exists in
> exactly one other place: `gpg.pass` on the box. If the box dies and that is the
> only copy, every offsite backup is permanently unrecoverable — you will have a
> perfect encrypted archive of a database nobody can open.

### Retention

- **Primary: the R2 lifecycle rule — delete 30 days after creation.** It keeps
  working when the box is dead, which is the case that matters.
- **Backstop: `rclone delete --min-age 40d`** at the end of each run, inside the
  script. Deliberately *wider* than 30 days so the two never race and the script
  can never eat a backup the lifecycle rule still considers current.

### Monitoring is load-bearing, not optional

Two **healthchecks.io** dead-man checks:

| Check | Period | Grace | Pinged by | Means, when red |
|---|---|---|---|---|
| `keygen-ce-backup` | 1 day | 6 h | `backup.sh` | no fresh offsite copy was made |
| `keygen-ce-restore-test` | 1 day | 8 h | `restore-test.sh` | a copy was made but no longer restores |

They are **separate on purpose**: "the backup did not run" and "the backup no
longer restores" are different alarms with different first commands, and at 3am
you want to know which one you have.

`backup.sh` and `restore-test.sh` **refuse to start without both ping URLs**
(`:?` guards). There is no log-only degradation path, because an on-box log
structurally cannot report the failures that matter most — *cron stopped
firing*, *the box is dead*, *the disk is full*. Only an external check with a
grace period can. Each script pings `/start`, then the bare URL on success, or
`/fail` (with the last log lines as the body) from an `ERR`/`EXIT` trap.

**Important consequence of failing closed:** if `backup.env` itself goes missing
or its mode changes, the script exits *before* it can send a `/fail` ping. That
failure is caught by the **grace period**, not by an immediate alert — which is
precisely why the dead-man check, not the log, is the alerting mechanism.

**Rotating a ping URL:** create the replacement check on healthchecks.io, then
edit the one line in `~/.config/devtools-backup/backup.env` (`cat >` the whole
file again, or `nano` it — never `echo`/`export` a value, which lands in shell
history), keep it mode 600, and run `~/devtools/infra/keygen/backup.sh` once by
hand to confirm the new check goes green. Delete the old check afterwards.

### The automated restore validation (the primary corruption detector)

`restore-test.sh` runs **chained after every successful upload**, not just as a
monthly drill. It downloads the object that was just uploaded, decrypts it with
the passphrase this box actually holds, restores it into a **throwaway
`postgres:17.5` container** (random password, no ports, `--network none`, no
volume, auto-removed), and asserts the restored data against **both** the
compiled release constants **and** the live database:

- account id == `0d607683-026f-468b-9cf0-f5bfaf61a7a1`
- ed25519 public key == `huJdyRsBtd7KrPqWv5Z/8GVeLmiqfWTfQnEb090+jO4=`
  (these two are `KEYGEN_ACCOUNT_ID` / `KEYGEN_ED25519_PUBKEY_B64` compiled into
  every shipped app — if a restore does not reproduce them it is worthless)
- ed25519 **private**-key md5, `private_key` md5, `secret_key` md5 vs live
  (compared as md5 only; private material is never printed or logged)
- row counts vs live for accounts/licenses/machines/policies/products/users

So a silently-corrupt or undecryptable artifact surfaces within **one day**
instead of at the next manual drill. The manual drill remains as
defense-in-depth only:

```bash
ssh tinkerdev-box '~/devtools/infra/keygen/restore-test.sh'
```

Expected output (verbatim from the 2026-08-07 run):

```
restore test target: r2:tinkerdev-backups/keygen-ce/keygen-20260807T215301Z.sql.gz.gpg

restored object:         r2:tinkerdev-backups/keygen-ce/keygen-20260807T215301Z.sql.gz.gpg
  account id:              MATCH (0d607683-026f-468b-9cf0-f5bfaf61a7a1)
  ed25519 pubkey:          MATCH (huJdyRsBtd7KrPqWv5Z/8GVeLmiqfWTfQnEb090+jO4=)
  ed25519 privkey md5:     MATCH
  private_key md5:         MATCH
  secret_key md5:          MATCH
  row counts:              MATCH (accounts=1 licenses=3 machines=2 policies=1 products=1 users=1)
restore test PASSED
```

`restore-test.sh` accepts **no target-database argument at all** — the dump is
taken with `pg_dump --clean`, so it opens with `DROP` statements and must never
be piped at the live database. It builds its own container and refuses any name
matching the live compose postgres. Its only contact with production is
read-only `SELECT`s for the comparison.

### Diagnostics

```bash
ssh tinkerdev-box '~/devtools/infra/keygen/backup.sh --list'            # what is actually in R2?
ssh tinkerdev-box 'tail -n 5  ~/.local/state/devtools-backup/backup.log'
ssh tinkerdev-box 'tail -n 5  ~/.local/state/devtools-backup/restore-test.log'
ssh tinkerdev-box 'tail -n 20 ~/.local/state/devtools-backup/cron.log'
```

`--list` reuses the credentials already on the box, so you never re-export
anything by hand. Cron output is **appended to `cron.log`, never sent to
`/dev/null`**: when a check goes red, that log is the only thing that explains
why. All three logs are truncated in place to their last 2000 lines each run
(in place, so cron's append-mode fd is not orphaned).

### A check went red — what now

| Symptom | First command | Likely cause |
|---|---|---|
| `keygen-ce-backup` red, **no** email body | `ssh tinkerdev-box 'tail -20 ~/.local/state/devtools-backup/cron.log'` | The script could not even start (missing/chmod-ed `backup.env`, box down, disk full) so it never reached a `/fail` ping. The grace period is what caught it. |
| `keygen-ce-backup` red **with** a `/fail` body | read the `reason="..."` in the body | `pg_dump` failed, the plaintext sanity gate rejected the dump, gpg failed, or the R2 upload/verify failed. The reason string names which. |
| `keygen-ce-restore-test` red, backup green | `ssh tinkerdev-box 'tail -3 ~/.local/state/devtools-backup/restore-test.log'` | The upload worked but the artifact does not restore — **treat as urgent**: the offsite copy is not usable. |
| `reason=... MISSING OBJECT ...` | `backup.sh --list` | The object is gone (over-eager lifecycle rule, wrong `BACKUP_PREFIX`, typo in `--object`). This is explicitly *not* a decryption problem. |
| `reason=gpg decrypt failed` | check `gpg.pass` against the password manager | The passphrase on the box no longer matches the artifact. |
| `status=skip reason=locked` | `ps aux \| grep backup.sh` | A previous run is still holding the `flock` (or wedged). Expected if you ran it by hand at 03:17. |
| `ping=err` in a log line | `curl -sS -o /dev/null -w '%{http_code}' https://hc-ping.com/` | The run itself was fine; only the ping failed (network blip). A ping failure never changes the run's real exit status. |
| Both checks red at once | is the box up at all? | Box/network/disk-level failure — exactly the case the dead-man design exists for. |

**Deliberate failure tests send real alert emails.** The 2026-08-07 bring-up ran
the failure paths on purpose (bad bucket; missing object), so two alert emails
from that date are **expected, not an incident**. Both checks were returned to
green by a final good run.

### Known gotcha: R2 does not implement object versioning

`rclone` 1.60 follows a successful `PUT` with a read-back
`HEAD <key>?versionId=<id>`. R2 has no versioning, so that returns **501 Not
Implemented** and rclone reports the transfer as failed *even though the bytes
landed*. Both scripts therefore set `RCLONE_CONFIG_R2_NO_HEAD=true`. Do not
remove it: without it every run logs ERRORs and only "succeeds" on the retry,
where rclone finds the object already present and skips it — a green run resting
on an accident. Integrity is not weakened, because the `PUT` carries
`Content-Md5` (R2 validates the body server-side), `backup.sh` independently
verifies the remote object size, and `restore-test.sh` then downloads and
restores it end to end.

---

## Restore the license box from backup

For when the box or its volume is **gone**, or the data is corrupt. If the box is
merely broken, prefer the **Hetzner provider snapshot** (Step 2.2) — it is far
faster and restores everything including Caddy's certs. Use the R2 dump when the
snapshot is gone too, when the Hetzner account itself is lost, or when the
corruption predates the snapshot.

### 0. FIRST: the recovery-critical secrets that are NOT in the dump

This is the most likely way a "successful" restore still fails. Keygen encrypts
columns at rest with `SECRET_KEY_BASE` + the `ENCRYPTION_*` keys. Restore the
database with *regenerated* values and you get undecryptable garbage that looks
like a working restore.

Retrieve both files from the **password manager**, then `sha256sum` your copy and
compare against this table:

| file | sha256 (verified 2026-08-07) | keys |
|---|---|---|
| `infra/keygen/.env` | `240eb52d5498f04df5cd3e7445d0ade58cde9156b509c9eb9fa94090ec9827d6` | 17: `CADDY_ACME_EMAIL CADDY_HOSTS ENCRYPTION_DETERMINISTIC_KEY ENCRYPTION_KEY_DERIVATION_SALT ENCRYPTION_PRIMARY_KEY KEYGEN_ACCOUNT_ID KEYGEN_ADMIN_EMAIL KEYGEN_ADMIN_PASSWORD KEYGEN_DOMAIN KEYGEN_EDITION KEYGEN_HOST KEYGEN_MODE POSTGRES_DB POSTGRES_PASSWORD POSTGRES_USER REDIS_URL SECRET_KEY_BASE` |
| `server/webhook/.env` | `05d9de7010cdfb6df525ad3b5f62b0371cae006ac4d63b466da0d5db0bd16c05` | 9: `EMAIL_FROM EMAIL_REPLY_TO KEYGEN_ACCOUNT_ID KEYGEN_ADMIN_TOKEN KEYGEN_BASE_URL KEYGEN_POLICY_ID LS_WEBHOOK_SECRET PORT RESEND_API_KEY` |

A sha256 **mismatch is not automatically fatal** — a value may have been rotated
legitimately, or line endings may differ. But:

- the **key list must match** (a missing key is a silent misconfiguration), and
- `SECRET_KEY_BASE` and all three `ENCRYPTION_*` values **must be the originals**,
  or every encrypted column in the restored DB is unreadable.

Re-run these on the box and update the table whenever those files change (values
are never printed, never committed):

```bash
ssh tinkerdev-box '
for f in ~/devtools/infra/keygen/.env ~/devtools/server/webhook/.env; do
  sha256sum "$f"
  sed -n "s/^\([A-Z0-9_]*\)=.*/\1/p" "$f" | sort | tr "\n" " "; echo
done'
```

You also need the **GPG passphrase** (`~/.config/devtools-backup/gpg.pass`) and
the **R2 credentials** from the password manager — without the passphrase the
backup cannot be opened at all.

### 1. Fresh box

`swap.sh` **first** (Pitfall 6), then Docker, then get the repo on the box
(`git clone` or rsync). Restore `infra/keygen/.env` and `server/webhook/.env`
from the password manager and verify them against the table above.

### 2. Bring up postgres ONLY, and restore into it

```bash
cd ~/devtools/infra/keygen
docker compose -f compose.yaml up -d postgres

# fetch + decrypt the chosen object (needs the R2 creds + gpg.pass restored first)
export RCLONE_CONFIG_R2_TYPE=s3 RCLONE_CONFIG_R2_PROVIDER=Cloudflare \
       RCLONE_CONFIG_R2_REGION=auto RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true \
       RCLONE_CONFIG_R2_NO_HEAD=true
set -a; . ~/.config/devtools-backup/backup.env; set +a
umask 077; W=$(mktemp -d)
rclone copyto "r2:$BACKUP_BUCKET/keygen-ce/keygen-<ts>.sql.gz.gpg" "$W/b.gpg"
gpg --batch --no-tty --pinentry-mode loopback \
    --passphrase-file "$BACKUP_GPG_PASSPHRASE_FILE" --decrypt "$W/b.gpg" \
  | gunzip > "$W/dump.sql"

docker compose -f compose.yaml exec -T postgres \
  psql -v ON_ERROR_STOP=1 -U keygen -d keygen < "$W/dump.sql"
rm -rf "$W"     # the plaintext holds the Ed25519 private key — do not leave it around
```

> **Do NOT run `docker compose run --rm setup` or `./setup.sh`.** They mint a
> **new** account and a **new** Ed25519 keypair, which instantly bricks every
> already-shipped app — their `KEYGEN_ACCOUNT_ID` / `KEYGEN_ED25519_PUBKEY_B64`
> are compiled in and cannot be changed on an installed copy. The restore path
> exists precisely to avoid that.

### 3. DNS + the rest of the stack

Point the `license.tinkerdev.io` A-record at the new IP, open ports 22/80/443,
then:

```bash
docker compose -f compose.yaml up -d web worker caddy webhook
```

Let Caddy re-issue via ACME (the A-record must resolve first — Pitfall 3).

### 4. Smoke test — prove the shipped apps still work

```bash
curl https://license.tinkerdev.io/v1/health          # 204, over REAL TLS, no -k

docker compose -f compose.yaml exec -T postgres psql -U keygen -d keygen -tAc \
  "select id, encode(decode(ed25519_public_key,'hex'),'base64') from accounts"
# MUST print:
# 0d607683-026f-468b-9cf0-f5bfaf61a7a1|huJdyRsBtd7KrPqWv5Z/8GVeLmiqfWTfQnEb090+jO4=
# == KEYGEN_ACCOUNT_ID / KEYGEN_ED25519_PUBKEY_B64 in src-tauri/src/license/config.rs
```

Then two live round-trips:

1. From an installed Pro app, force a **refresh/validate** against the restored
   box and confirm it succeeds (this is the only proof that matters to buyers).
2. `./release-seat.sh --key <a real key>` as a sanity check that admin auth works
   against the restored account (idempotent — safe on an already-free license).

### 5. The recovery is not finished until the new box is backed up

```bash
mkdir -p ~/.config/devtools-backup && chmod 700 ~/.config/devtools-backup
# restore backup.env and gpg.pass from the password manager (cat > file, Ctrl-D),
# then: chmod 600 ~/.config/devtools-backup/*

~/devtools/infra/keygen/backup.sh --install-cron
~/devtools/infra/keygen/backup.sh                  # one full cycle by hand
```

Confirm **both** healthchecks.io checks go green. A restored box whose own
backups are unmonitored has simply moved the original problem forward in time.

---

## Freeing a seat (lost-device transfer fallback, D-80/D-81)

**When to use it.** A buyer lost access to their old Mac (dead/wiped/sold) and
can't self-serve deactivate from it, so the seat stays consumed and "activate
here" returns the calm seat-limit message ("This key is active on another
device …"). They **reply to their license email** asking for help (the D-80
fallback). This is the one repeatable command that frees the seat for them. It
is the manual-but-repeatable path until the deferred admin dashboard lands.

**Run it ON THE BOX over SSH** — the privileged admin token stays server-side
(D-55), never on the buyer's machine and never on the command line. The script
reads the token from `infra/keygen/.env` (`KEYGEN_ADMIN_TOKEN`, or it mints one
from `KEYGEN_ADMIN_EMAIL` + `KEYGEN_ADMIN_PASSWORD`, same as `setup.sh`).

By license key (from their email):

```
ssh tinkerdev-box 'bash -s' -- --key DC1093-5AC5A7-54F009-A493F6-56FFC9-V3 \
  < infra/keygen/release-seat.sh
```

Or by Lemon Squeezy order id (from the LS dashboard / the `metadata.orderId`
stamped at create time):

```
ssh tinkerdev-box 'bash -s' -- --order-id 123456 < infra/keygen/release-seat.sh
```

(Or copy `release-seat.sh` onto the box and run `./release-seat.sh --key …`
directly — same effect; the script always runs against the CE admin API over
localhost/own-host TLS, never the open internet.)

**Expected output** (to stderr — copy-pasteable proof for the support reply):

```
resolved license: <license-id>
machines before: 1
deleted machine: <machine-id>
machines after: 0
seat released for license <license-id>
```

**Idempotent.** Re-running on an already-free license is a no-op success:

```
resolved license: <license-id>
machines before: 0
seat already free for license <license-id> (no machines) — nothing to do
machines after: 0
```

Then tell the buyer to open DevTools → Unlock Pro → paste their key → activate.
The seat binds to the new Mac. (`release-seat.sh` only DELETES machines; it never
touches the license itself, so the key, entitlements, and `metadata.email`/
`orderId` are all preserved.)

---

## Resume signal

When bring-up (Steps 1–8) is done, return to the executor with:

> **`infra up`** + the printed `PROD_ACCOUNT_ID` and `PROD_ED25519_PUBKEY_B64`
> from `setup.sh` (Step 4.5).

Those two values feed **Task 3** (`config.rs` release constants), which then
unblocks the **Task 4** ship-gate. If anything failed, describe what.
