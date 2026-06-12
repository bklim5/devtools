# Local Keygen CE instance (Phase 19, D-40)

Self-hosted Keygen Community Edition in Docker on the dev Mac. Backs license
activation development + the D-42 SPIKE. Production hosting is a Phase 20/21
decision — `KEYGEN_HOST` and the account Ed25519 public key are per-environment
config so the prod swap is a constants change.

## Files

| File | What |
|---|---|
| `compose.yaml` | postgres 17.5 + redis + web + worker + caddy + `setup` one-shot (NO compose `profiles` — see below) |
| `Caddyfile` | TLS termination: `tls internal` (self-signed local CA) when `CADDY_ACME_EMAIL` unset, reverse-proxy to `web:3000` |
| `.env.example` | Committed template — variable names verbatim from keygen-api's `.env.sample`, secrets as generation-command comments only |
| `.env` | Real secrets, generated locally, **gitignored** (D-41) |
| `caddy-root.crt` | Extracted Caddy local root CA, **gitignored**; feeds curl `--cacert` here and the dev-only Rust trust path in Plan 03 |
| `bootstrap.sh` | Idempotent: admin token → product → policy (`authenticationStrategy: LICENSE`) → license; prints the account Ed25519 pubkey. `bootstrap.sh mint_license` mints additional licenses |
| `spike.sh` | D-42 SPIKE: full lifecycle (validate → activate → token-denial probe → checkout → seat-limit probe → deactivate/re-activate) with verbatim transcripts |

## Bring-up

```bash
cd scripts/keygen-ce
cp .env.example .env        # then replace every "$(...)" with that command's output
cd ../..

docker compose -f scripts/keygen-ce/compose.yaml up -d postgres redis
# wait for: docker compose -f scripts/keygen-ce/compose.yaml exec postgres pg_isready -U keygen
docker compose -f scripts/keygen-ce/compose.yaml run --rm setup
docker compose -f scripts/keygen-ce/compose.yaml up -d web worker caddy

# extract the local CA (gitignored):
docker cp $(docker compose -f scripts/keygen-ce/compose.yaml ps -q caddy):/data/caddy/pki/authorities/local/root.crt scripts/keygen-ce/caddy-root.crt

# health check (expect 204):
curl --cacert scripts/keygen-ce/caddy-root.crt https://localhost/v1/health -i
```

Then `./scripts/keygen-ce/bootstrap.sh` to create product/policy/license.

## Teardown

```bash
docker compose -f scripts/keygen-ce/compose.yaml down   # volumes preserved
# full reset (destroys the account + all licenses):
docker compose -f scripts/keygen-ce/compose.yaml down -v
```

## Decisions actually taken

- **Host strategy: `KEYGEN_HOST=localhost` works — no `/etc/hosts` entry needed.**
  One fix was required: Keygen derives `Keygen::DOMAIN` from the last two
  dot-separated labels of `KEYGEN_HOST`; a single-label host (`localhost`)
  yields `nil` and web/worker crash at boot (`Regexp.escape(nil)` TypeError in
  `resolve_account_service.rb`). Setting **`KEYGEN_DOMAIN=localhost`**
  explicitly fixes it (in `.env` + `.env.example`). The planned
  `keygen.local.test` + `/etc/hosts` fallback was NOT needed.
- **No compose `profiles:` anywhere** (research Pitfall 8): the installed
  Compose is 2.0.0-beta.3 (2021), whose profile handling is unreliable. The
  `setup` one-shot is a plain service — never list it in `up`; run it only via
  `docker compose run --rm setup`. Verified working on this toolchain
  (Docker 20.10.7 / Compose 2.0.0-beta.3).
- **TLS: extracted Caddy root CA**, never `curl -k` — all scripts use
  `--cacert scripts/keygen-ce/caddy-root.crt`. The same file feeds Plan 03's
  dev-only Rust `add_root_certificate` path.
- **Ports: caddy publishes 80/443 only** (CE-only ports). postgres/redis/web
  stay on the compose network — no host 5432/6379/3000. The e2e gate owns
  1420 (vite) and 4445 (WebDriver); no conflict.
