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
  `LS_WEBHOOK_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `PORT`.

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
   buyer's refresh/transfer/revocation). This is the phase-20 backup floor;
   offsite pg_dump is a documented deferred follow-up.
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
| `PORT` | `8787` |

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
