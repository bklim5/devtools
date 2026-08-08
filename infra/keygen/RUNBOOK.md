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
`gzip -9 | gpg --symmetric` **AES-256** (S2K mode 3 / SHA512 / 65011712) →
**local decrypt + `gunzip -t` round-trip** → **freshness check against the
previous manifest** → build the **manifest** → `rclone copyto` both to R2 →
**verify the remote size of each** → 40-day retention backstop → **retention-window
health check** → ping the backup dead-man check → **chained `restore-test.sh`
against the object it just uploaded**.

Each run lands TWO objects:

```
r2:tinkerdev-backups/keygen-ce/keygen-<UTC-timestamp>.sql.gz.gpg
r2:tinkerdev-backups/keygen-ce/keygen-<UTC-timestamp>.manifest.json.gz.gpg
```

The **manifest** (schema 2) records what that artifact should restore to — row
counts and the licenses count + newest `licenses.created_at` (all read out of the
dump itself), the account id / ed25519 public key / private-key md5s (read live in
the same run; those columns never change), the sha256 + size of both the plaintext
and the ciphertext, and the **provenance** of the dump: when it started/finished,
how long it took, and the compose project + container id it was actually read
from. It is gzipped and encrypted exactly like the artifact, because it
fingerprints private material. Read one with:

```bash
ssh tinkerdev-box '~/devtools/infra/keygen/backup.sh --fetch \
  keygen-ce/keygen-<ts>.manifest.json.gz.gpg /dev/stdout'
```

Typical run: **~6 seconds**, ~42 KB encrypted (the DB is 13 MB, but it is mostly
empty index/page overhead — six rows of real data compress hard). Do not read
the *encrypted* size as the health signal; the meaningful gates are the
plaintext sanity gate and the restore test's row-count comparison against live.

### Where things actually live on the box

| Path | What |
|---|---|
| `/home/claude/devtools` | the deploy root **on the live box** (user `claude`). `deploy.sh`'s built-in `REMOTE_DIR` default is `/opt/devtools` and is NOT what production uses — pass `REMOTE_DIR=/home/claude/devtools` (or use the plain `rsync` in "Updating the backup scripts" below). |
| `~/devtools/infra/keygen/` | `backup.sh`, `restore-test.sh`, `backup-lib.sh` (shared, sourced by both), `compose.yaml`, the live `.env` |
| `~/.config/devtools-backup/` | the backup secrets, mode 700 |
| `~/.local/state/devtools-backup/` | `backup.log`, `restore-test.log`, `cron.log`, `backup.lock` (all 0600) |

### Where the secrets live (and why NOT in `infra/keygen/`)

| Path | Mode | Holds |
|---|---|---|
| `~/.config/devtools-backup/backup.env` | 600 | R2 key id/secret/endpoint, bucket, prefix, both ping URLs, retention days |
| `~/.config/devtools-backup/gpg.pass` | 600 | the symmetric passphrase, and nothing else |

**These are deliberately OUTSIDE `infra/keygen/`.** `deploy.sh` rsyncs that
directory with `--delete`, so anything new placed there is wiped by the next
deploy. If you ever refactor `deploy.sh`, do not "helpfully" move these back in.
(`deploy.sh` also `--exclude`s `backup.env` and `gpg.pass` as belt-and-braces,
so a stray copy is never *shipped* either — but the exclusion is not the
protection; the location is.) The committed template is
`infra/keygen/backup.env.example` (placeholders only); `.gitignore` catches a
stray copy landing in the repo.

**Updating the backup scripts on the box** without touching the running stack
(`deploy.sh` rebuilds and restarts containers — do not use it for a script edit):

```bash
rsync -az infra/keygen/backup.sh infra/keygen/restore-test.sh \
          infra/keygen/backup-lib.sh infra/keygen/backup.env.example \
  tinkerdev-box:/home/claude/devtools/infra/keygen/
```

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
- `BACKUP_RETENTION_BACKSTOP_DAYS` is validated **before any rclone call**: it
  must be a whole number **>= 35**, or `backup.sh` refuses to start. The value is
  a `--min-age` argument to a DELETE; an empty or typo'd one must never reach it,
  and anything below 35 would start racing the 30-day lifecycle rule.
- The prune also refuses to run unless the object *just uploaded* appears in the
  very listing it is about to act on — that is what proves the prefix is the live
  one and not a typo under which every object looks old enough to delete.

### Freshness — is the dump of the CURRENT database?

The manifest is **self-attested**: it proves the artifact is internally
consistent, not that it describes production *as of tonight*. A stale checkout, a
wrong `COMPOSE_FILE`, or a second postgres project on the box all produce a
perfectly valid manifest of an **older** database, and every downstream check
(sha256, row counts, restore drill) would still pass.

So each run compares itself to the **previous run's manifest** before it uploads
anything, on the two quantities that only ever go up here (licenses are never
deleted):

- `licenses_count` — the number of rows in the dump's `COPY public.licenses` block
- `licenses_max_created_at` — the newest `created_at` in that same block

Either one going **down** is fatal, with `reason="FRESHNESS REGRESSION: ..."`,
and **nothing is uploaded**. That ordering is deliberate: a regressed artifact
must not become the newest object, or tomorrow's run would compare itself against
the bad manifest and pass.

On the very first run under a prefix there is no previous manifest — the run logs
`notice: no previous manifest ... first run` and proceeds. Manifests written
before schema 2 have no `licenses_max_created_at`; that half of the comparison
logs a notice and is skipped (the count still compares, via the older
`row_counts` string).

Legitimate reasons for a regression: someone deliberately deleted licenses, or the
database was restored from an older backup. Both are events you want to be told
about at 3am. Re-point the prefix or take a fresh baseline once you have decided
the current state is correct.

### Retention-window health (checked every run, before the green ping)

The prune and the lifecycle rule are both DELETE machinery pointed at the only
place the backups live. After the prune, `backup.sh` lists the prefix **once** and
asserts:

| Assertion | Catches |
|---|---|
| every artifact has its manifest and vice versa (orphans logged; **>2 orphans is fatal**) | a half-completed upload, or a prune eating one side of a pair |
| artifact count **>= min(days since the oldest object, 25)** | mass deletion. The floor tracks the window's own age so a freshly warmed-up prefix passes, and caps at 25 (< the 30-day lifecycle rule) so the steady state never trips it |
| oldest artifact age **<= `BACKUP_RETENTION_BACKSTOP_DAYS` + 3** | a prune that stopped running (the window growing without bound) |

Artifacts whose **name stamp sorts before the earliest manifest** are exempt from
the pairing rule: they predate the manifest format (see below), and the exemption
ages itself out with them. Anything from the manifest era onwards must be paired.
The comparison is on the `keygen-<ts>` stamp both halves of a pair share, *not* on
`ModTime` — a pair is uploaded a second or two apart, so a ModTime test would
accidentally exempt each prefix's oldest artifact.

A failed assertion **fails the run** — `/fail` ping, red check,
`reason="retention: ..."`. The artifact that run produced is nonetheless
**uploaded and usable**; the log line says so explicitly with
`artifact=uploaded-usable` (vs `artifact=none` when the failure was earlier).

> **The R2 lifecycle rule cannot be checked from the box.** `rclone` has no way to
> read a bucket's lifecycle configuration, so nothing above can tell you the
> primary retention control is still in place — a deleted or widened rule is
> invisible here until objects start disappearing (or stop). **Eyeball it
> quarterly** in the Cloudflare dashboard: R2 → `tinkerdev-backups` → Settings →
> Object lifecycle rules → "delete 30 days after creation" still present and
> enabled. It is in the maintenance table below.

### Recurring maintenance (nothing else will remind you)

| Every | Do | Why |
|---|---|---|
| Quarterly | Cloudflare → R2 → `tinkerdev-backups` → Settings → **Object lifecycle rules**: confirm "delete 30 days after creation" is present and enabled | The primary retention control. It is not queryable via `rclone`, so no script can assert it. A deleted rule means unbounded storage growth; a widened/narrowed one can race the 40-day backstop |
| Quarterly | healthchecks.io: both checks still exist, still have an email channel, still `period 1 day` | A deleted or muted check turns the whole dead-man design into a no-op silently |
| On any R2 token rotation | re-run `backup.sh` by hand once and confirm green | The token is the single credential the whole pipeline depends on |
| On any `infra/keygen/` script change | rsync **all three** scripts together and bump `BACKUP_PIPELINE_VERSION` | See "Implementation notes" — a partial rsync is now fatal rather than silent |

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
monthly drill. It downloads the object that was just uploaded **and its
manifest**, decrypts both with the passphrase this box actually holds, restores
the dump into a **throwaway `postgres:17.5` container** (random password, no
ports, `--network none`, no volume, auto-removed), and asserts:

- ciphertext + plaintext **sha256 and size** == the manifest (byte-for-byte proof
  that what came back out of R2 is exactly what was dumped)
- account id == the manifest **and** == `0d607683-026f-468b-9cf0-f5bfaf61a7a1`
- ed25519 public key == the manifest **and** ==
  `huJdyRsBtd7KrPqWv5Z/8GVeLmiqfWTfQnEb090+jO4=`
  (those two are `KEYGEN_ACCOUNT_ID` / `KEYGEN_ED25519_PUBKEY_B64` compiled into
  every shipped app — if a restore does not reproduce them it is worthless)
- ed25519 **private**-key md5, `private_key` md5, `secret_key` md5 == the manifest
  (compared as md5 only; private material is never printed or logged)
- row counts == the manifest, for accounts/licenses/machines/policies/products/users

**It does not read the live database at all.** Every comparison is against the
manifest (written at dump time) or against the compiled release constants — both
time-invariant. That kills two failure modes the earlier restored-vs-live design
had: a license created between the nightly dump and the drill showed up as a
false `row counts MISMATCH`, and the drill could not run at all while the live
stack was down — which is exactly when you want to run a restore drill.

So a silently-corrupt or undecryptable artifact surfaces within **one day**
instead of at the next manual drill. The manual drill remains as
defense-in-depth only:

```bash
ssh tinkerdev-box '~/devtools/infra/keygen/restore-test.sh'
```

Expected output (verbatim from the 2026-08-07 run):

```
restore test target: r2:tinkerdev-backups/keygen-ce/keygen-20260807T225327Z.sql.gz.gpg

restored object:         r2:tinkerdev-backups/keygen-ce/keygen-20260807T225327Z.sql.gz.gpg
  artifact sha256:         MATCH
  artifact bytes:          MATCH
  plaintext sha256:        MATCH
  plaintext bytes:         MATCH
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
be piped at a live database. It builds its own throwaway container, and it only
ever removes a container **this run started**: if one with the same name already
exists it refuses and exits, without deleting anything.

### Diagnostics

```bash
ssh tinkerdev-box '~/devtools/infra/keygen/backup.sh --list'            # what is actually in R2?
ssh tinkerdev-box 'tail -n 5  ~/.local/state/devtools-backup/backup.log'
ssh tinkerdev-box 'tail -n 5  ~/.local/state/devtools-backup/restore-test.log'
ssh tinkerdev-box 'tail -n 20 ~/.local/state/devtools-backup/cron.log'

# pull one object back down, decrypted (dump or manifest); /dev/stdout works
ssh tinkerdev-box '~/devtools/infra/keygen/backup.sh --fetch \
  keygen-ce/keygen-<ts>.manifest.json.gz.gpg /dev/stdout'
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
| `failed="artifact sha256; ..."` or `plaintext sha256` | `backup.sh --list`, then re-run `backup.sh` | What came back from R2 is not what was uploaded: truncated/corrupted object, or the object was replaced. |
| `failed="row counts; ..."` | `--fetch` the manifest and compare | The dump restored, but not completely — a psql restore error, or a truncated artifact. Counts come from the dump itself, so this can NOT be caused by writes to live after the dump. |
| `failed="account id"` / `ed25519 pubkey` | stop and read: the restored DB is not this account | Either the artifact is from a different account, or someone re-ran `setup.sh` and minted a new keypair. Every shipped app is compiled against the old one. |
| `reason=... MISSING OBJECT ...` | `backup.sh --list` | The object (or its manifest) is gone (over-eager lifecycle rule, wrong `BACKUP_PREFIX`, typo in `--object`). This is explicitly *not* a decryption problem. |
| `reason=gpg decrypt failed` | check `gpg.pass` against the password manager | The passphrase on the box no longer matches the artifact. |
| `BACKUP_RETENTION_BACKSTOP_DAYS must be ...` | fix the one line in `backup.env` | Refused before any R2 call — nothing was uploaded, nothing was deleted. |
| `reason="FRESHNESS REGRESSION: ..."` | `backup.sh --fetch <the named previous manifest> /dev/stdout`, then `docker compose -f ~/devtools/infra/keygen/compose.yaml ps` | The dump has FEWER licenses (or an older newest `created_at`) than the previous run. Stale checkout, wrong `COMPOSE_FILE`, a second postgres project on the box, or the DB was restored from an older backup. **Nothing was uploaded** — the last good artifact is still the newest object. |
| `reason="retention: ... orphaned objects ..."` | `backup.sh --list` | Artifacts and manifests are written as a pair, so >2 unpaired objects means a broken upload path or a prune eating one side. The run's own artifact **is** uploaded and usable (`artifact=uploaded-usable`). |
| `reason="retention: only N artifacts ..."` | `backup.sh --list`, then Cloudflare → R2 → bucket → Settings → lifecycle rules | Objects were deleted en masse: the lifecycle rule was widened, someone deleted by hand, or `BACKUP_PREFIX` changed. |
| `reason="retention: the oldest artifact ... older than ..."` | `backup.sh --list` | The prune is not running (or `--min-age` was widened), so the window is growing without bound. Storage cost, not data loss. |
| `pipeline version mismatch — ... PARTIAL DEPLOY` | re-rsync **all three** scripts (see "Updating the backup scripts on the box") | `backup.sh`, `restore-test.sh` and `backup-lib.sh` are at different versions. Fatal before any work: nothing ran, nothing was uploaded, nothing was deleted. |
| `status=skip reason=locked` | `ps aux \| grep backup.sh` | A previous run is still holding the `flock` (or wedged). Expected if you ran it by hand at 03:17. |
| `ping=err` in a log line | `curl -sS -o /dev/null -w '%{http_code}' https://hc-ping.com/` | The run itself was fine; only the ping failed (network blip). A ping failure never changes the run's real exit status. |
| Both checks red at once | is the box up at all? | Box/network/disk-level failure — exactly the case the dead-man design exists for. |

**Deliberate failure tests send real alert emails.** The 2026-08-07 bring-up and
its follow-up hardening pass both ran the failure paths on purpose (bad bucket,
missing object, refused prune, unreadable crontab), so several alert emails from
that date are **expected, not an incident**. Both checks were returned to green
by a final good run each time.

**Objects written before 2026-08-07 22:47 UTC have no manifest** (the format
predates it). `restore-test.sh` will refuse them with an explicit
"predates the manifest format — take a fresh backup" message. The nightly always
drills the object it just wrote, so this only ever affects a hand-picked
`--object`, and the R2 lifecycle rule removes the last of them within 30 days.

### Implementation notes (why the scripts look like this)

The scripts carry one-line pointers back here instead of repeating these. Do not
"clean up" any of them without reading the reason first.

**`backup-lib.sh` is sourced by both scripts.** They already hard-depend on each
other and on `compose.yaml`, so "independently runnable" was never true. Sharing
the loader, the pings, the rclone wrapper and — most importantly — the **single
exit logger** is what keeps the two log lines from drifting apart again. The exit
logger pings FIRST and composes the line AFTER, so a failed `/fail` ping is
visible as `ping=err` in both logs rather than being recorded as `ping=ok`.

**`BACKUP_PIPELINE_VERSION` pins the three scripts to each other.** They are
deployed by `rsync`, and a partial/interrupted rsync leaves them at different
versions silently sourcing one another — exactly the failure a backup pipeline
must not have. The string is defined **once** in `backup-lib.sh`; `backup.sh` and
`restore-test.sh` each carry their own `EXPECT_PIPELINE_VERSION` and assert it as
their first action, before argument parsing, config, docker or R2. **Bump
discipline:** any change that spans the three files bumps all three constants in
the same commit; a same-file-only change does not need a bump (a mismatch is
fatal, so over-bumping is safe and under-bumping is what you must avoid).

**The manifest is self-attested, so freshness is checked separately.** See
"Freshness" above: `licenses_count` and `licenses_max_created_at` are read out of
the dump itself and compared to the previous run's manifest, and the comparison
runs *before* the upload so a regressed artifact never becomes the baseline the
next run trusts. The manifest also records the compose project + container id the
dump actually came from, so an artifact can be traced rather than merely trusted.

**The retention window is checked as a whole, once per run**, after the prune and
before the green ping — pairing, a mass-deletion floor and a runaway-prune
ceiling. It runs before the ping so a failure is a red check; the artifact is
still uploaded, which is why the log line carries `artifact=uploaded-usable`.
The one thing it cannot see is the R2 lifecycle rule itself (not exposed via
`rclone`) — hence the quarterly eyeball in the maintenance table.

**R2 does not implement object versioning.** `rclone` 1.60 follows a successful
`PUT` with a read-back `HEAD <key>?versionId=<id>`; R2 returns **501 Not
Implemented**, so rclone reports the transfer as failed *even though the bytes
landed*. Hence `RCLONE_CONFIG_R2_NO_HEAD=true`. Without it every run logs ERRORs
and only "succeeds" on the retry, where rclone finds the object already present
and skips it — a green run resting on an accident. Integrity is not weakened: the
`PUT` carries `Content-Md5` (R2 validates server-side), `backup.sh` verifies the
remote size independently, and `restore-test.sh` checks the downloaded object's
sha256 against the manifest before restoring it.

**The R2 credentials are never in the process environment.** `backup.env` is
sourced *without* `set -a`, and the six `RCLONE_CONFIG_R2_*` values are passed to
rclone as a per-command assignment prefix. `gpg`, `docker`, `psql` and `curl`
children therefore cannot inherit the secret.

**`rclone copyto` exits 0 when the SOURCE does not exist** ("nothing to copy"),
so every download asserts the file is non-empty and names the real cause. Without
that, a pruned or typo'd object resurfaced two steps later as "NOT recoverable
with this passphrase" — a wrong and alarming diagnosis at 3am.

**`docker rm -f -v`, not `docker rm -f`.** `postgres:17.5` declares
`VOLUME /var/lib/postgresql/data`, so each throwaway run creates an anonymous
volume (~46 MB). `--rm` would reap it, but the explicit teardown wins the race
and without `-v` orphaned it every night (~1.4 GB/month on a 38 GB disk).

**Only ever remove a container this run started.** Teardown is gated on a flag
set immediately after `docker run` succeeds, so the "a container with that name
already exists" guard exits without deleting someone else's container. A run
SIGKILLed by `timeout -k` cannot tear itself down at all, so the next run sweeps
any container carrying the `devtools-restore-test` label that is older than an
hour.

**Every `timeout` uses `-k 30`** (TERM, then KILL 30 s later). The signal goes to
the CHILD, never to the script, so the script's own EXIT trap still runs, still
logs and still pings even when a wedged child had to be killed.

**The flock fd is not inherited.** `backup.sh` holds the lock on fd 9; every
child invocation closes it with `9>&-`. Otherwise a wedged `rclone`/`docker`
could survive the script and hold the lock, and every later run would exit
`status=skip reason=locked` with only the dead-man grace period noticing.

**Logs are truncated in place**, never `mv`-rotated: cron holds an append-mode fd
on `cron.log` for the whole run, and replacing the inode would send the rest of
that run's output — the diagnostic a red check needs — to an unlinked file. All
state files are 0600 (the scripts set `umask 077` and re-assert the mode on
`cron.log`, which cron itself creates under umask 022).

**psql output is never tailed raw.** A failing restore quotes the offending ROW,
which for `public.accounts` is the Ed25519 private key. Only sanitized
`ERROR/FATAL` lines, with the COPY context stripped and clipped, reach stderr.

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

Install what the backup/restore scripts need — a fresh Ubuntu box has none of
`rclone`, `gpg` or `jq`, and the restore below stops dead without them:

```bash
sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y rclone gnupg jq curl cron
# docker + docker-compose-plugin come from the normal Docker install (Step 4);
# flock/timeout/openssl/gzip are in the base image.
```

Then put `backup.sh`, `restore-test.sh` and `backup-lib.sh` in place (all three —
the first two source the third) and restore `~/.config/devtools-backup/`
(`backup.env` + `gpg.pass`, mode 600) from the password manager.

### 2. Bring up postgres ONLY, and restore into it

```bash
set -euo pipefail
cd ~/devtools/infra/keygen
docker compose -f compose.yaml up -d postgres

# Which object? (needs the R2 creds restored first)
./backup.sh --list

# Download + decrypt + gunzip it. ONE command, from the same script that wrote
# the object, so this cannot drift from the real format:
umask 077; W=$(mktemp -d)
./backup.sh --fetch keygen-ce/keygen-<ts>.sql.gz.gpg "$W/dump.sql"

docker compose -f compose.yaml exec -T postgres \
  psql -v ON_ERROR_STOP=1 -U keygen -d keygen < "$W/dump.sql"
rm -rf "$W"     # the plaintext holds the Ed25519 private key — do not leave it around
```

If you want to know what that object *should* restore to before you restore it,
read its manifest (same command, `/dev/stdout`):

```bash
./backup.sh --fetch keygen-ce/keygen-<ts>.manifest.json.gz.gpg /dev/stdout
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
# MUST print — account id | ed25519 public key:
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
