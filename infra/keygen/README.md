# Production Keygen CE + purchase webhook (Phase 20, D-46/D-50)

The committed, reproducible production licensing stack: Keygen Community Edition
+ Postgres + Redis + the Plan-02 purchase webhook + Caddy (real ACME) on a
single Hetzner CX23 at `license.tinkerdev.io`. This is the same shape as the
Phase-19 LOCAL stack (`scripts/keygen-ce/`) with production deltas: real
Let's Encrypt TLS, the two-label public host, a fresh account/keypair (D-51),
the webhook container, entitlement codes, and license metadata.

**These scripts are committed but EXECUTED BY A HUMAN during bring-up** — Claude
cannot provision the VPS, set DNS, create the LS store, or run the live
purchase. The ordered human checklist is **[RUNBOOK.md](./RUNBOOK.md)**; read it
before touching the box.

## Files

| File | What |
|---|---|
| `compose.yaml` | CE web+worker + postgres 17.5 + redis (`noeviction`, Pitfall 7) + the `webhook` service + caddy. NO compose `profiles:` (Pitfall 8). Only caddy publishes host ports (80/443). |
| `Caddyfile` | REAL ACME for `license.tinkerdev.io` (Pitfall 3 — NO `tls internal`). Routes `/webhooks/*` + `/health` → webhook:8787, everything else → web:3000. |
| `webhook.Dockerfile` | Small Node 22 image for `server/webhook/` (runs TS via `--experimental-strip-types`; `resend` the only runtime dep). No secrets baked in — env at runtime. |
| `.env.example` | CE container env TEMPLATE (D-41) — `SECRET_KEY_BASE` + `ENCRYPTION_*` via `openssl rand`, account id, real-ACME host/email. Placeholders only; the real `.env` is gitignored. |
| `swap.sh` | D-48: 2 GB swap + `vm.swappiness=10` + `/etc/fstab`. **Run FIRST, before CE bring-up** (Pitfall 6). Idempotent. |
| `setup.sh` | D-51/D-53/D-54: idempotent product + policy (perpetual/node-locked/max=1) + `pro.theming`+`pro.ordering` entitlements attached to the policy + a metadata-filter validation (A2); prints the prod account id + base64-raw-32-byte pubkey + policy id for `config.rs` (Task 3) and `server/webhook/.env`. |
| `deploy.sh` | Script-over-SSH: rsync `infra/keygen/` + `server/webhook/` to the box (EXCLUDING `.env`), build the webhook image, `docker compose up -d`. |
| `RUNBOOK.md` | The ordered human bring-up checklist (accounts → VPS → DNS → swap-first CE → LS store → secrets → constants → D-63 live purchase). |

## Two separate env files (both gitignored, on the box ONLY)

| File | For | Key vars |
|---|---|---|
| `infra/keygen/.env` | the CE containers (web/worker/setup/caddy) | `SECRET_KEY_BASE`, `ENCRYPTION_*`, `KEYGEN_HOST=license.tinkerdev.io`, `KEYGEN_ACCOUNT_ID`, `CADDY_ACME_EMAIL` |
| `server/webhook/.env` | the webhook container | `KEYGEN_BASE_URL=http://web:3000` (internal CE origin, D-55 — NOT the public host), `KEYGEN_ACCOUNT_ID`, `KEYGEN_ADMIN_TOKEN`, `KEYGEN_POLICY_ID`, `LS_WEBHOOK_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `PORT` |

The webhook reaches CE over the compose network at `http://web:3000` so the
privileged admin token never crosses the public internet (D-55). Caddy is the
only public surface; the webhook publishes no host ports.

## Bring-up (summary — full steps in RUNBOOK.md)

```bash
# ON THE BOX, in order (Pitfall 6 — swap FIRST):
sudo infra/keygen/swap.sh
cd infra/keygen && cp .env.example .env   # fill openssl-rand secrets
cp ../../server/webhook/.env.example ../../server/webhook/.env   # fill secrets; KEYGEN_BASE_URL=http://web:3000
docker compose -f compose.yaml run --rm setup   # creates account/keypair (Pitfall 8)
./setup.sh                                       # product+policy+entitlements+metadata-check; prints constants
docker compose -f compose.yaml up -d postgres redis web worker webhook caddy
curl https://license.tinkerdev.io/health         # real TLS, NO -k (Pitfall 3 proof)
```

## Notes

- **Real ACME only** — never `tls internal` in prod (Pitfall 3): release-build
  activations trust only the OS root store. Ports 80+443 open + the A-record
  live before the first Caddy boot (HTTP-01).
- **Redis `noeviction`** (Pitfall 7) keeps Sidekiq jobs from being dropped.
- **No compose `profiles:`** (Pitfall 8) — run `setup` via
  `docker compose run --rm setup`, never list it in `up`.
- **Snapshots** — enable Hetzner provider snapshots NOW (D-49); offsite pg_dump
  is the documented deferred follow-up.
- Secrets stay in the two gitignored `.env` files ON THE BOX only (D-41/D-55);
  only `.env.example` templates are committed.
