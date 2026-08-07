---
created: 2026-07-06T21:46:09.575Z
title: Automate nightly offsite pg_dump of keygen CE database
area: infra
files:
  - infra/keygen/RUNBOOK.md
  - infra/keygen/compose.yaml
---

## Problem

The Keygen CE Ed25519 signing keypair AND every license/machine record live only in the prod Postgres on the single Hetzner CX23 box. RUNBOOK.md Step 2.2 set provider snapshots as the phase-20 backup floor and explicitly deferred offsite `pg_dump` as "a documented deferred follow-up" — which never landed. Losing the DB ends activation/refresh/deactivation for every buyer; cached certs decay to Free within ≤37 days (`src-tauri/src/license/config.rs:79-103`). Owner took a one-off manual dump on 2026-07-06 (in password manager); automation is the remaining gap.

## Solution

On the box: nightly cron — `docker compose -f infra/keygen/compose.yaml exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip | gpg -c --batch --passphrase-file ... | rclone copy` to object storage (Hetzner Storage Box or Cloudflare R2), ~30-day retention. Test one restore into a throwaway postgres:17.5 container (confirm the account row with the Ed25519 keypair survives). Document the restore procedure in `infra/keygen/RUNBOOK.md` ("restore the license box from backup": snapshot restore + DNS repoint + smoke `/v1/health` + one refresh round-trip). Mostly owner-run on the box (SSH + secrets); repo side is the RUNBOOK section + cron script committed under `infra/keygen/`.
