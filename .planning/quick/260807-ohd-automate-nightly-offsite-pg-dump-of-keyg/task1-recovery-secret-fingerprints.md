# Task 1 scratch — recovery-secret fingerprints (for Task 3's RUNBOOK Section B)

Computed ON THE BOX (`ssh tinkerdev-box`) on **2026-08-07 (UTC)**.
**No secret VALUE was read, printed, or stored** — only `sha256sum` of each file
and the sorted list of KEY NAMES (`sed -n 's/^\([A-Z0-9_]*\)=.*/\1/p' | sort`).

Task 3 must RE-COMPUTE these immediately before committing (so the recorded value
is current at commit time) and then paste the table into RUNBOOK Section B step 0.

## `/home/claude/devtools/infra/keygen/.env`

- **sha256:** `240eb52d5498f04df5cd3e7445d0ade58cde9156b509c9eb9fa94090ec9827d6`
- **size/mode:** 810 bytes, `-rw-------`, mtime 2026-06-14
- **key count:** 17
- **keys (sorted):**
  `CADDY_ACME_EMAIL CADDY_HOSTS ENCRYPTION_DETERMINISTIC_KEY ENCRYPTION_KEY_DERIVATION_SALT ENCRYPTION_PRIMARY_KEY KEYGEN_ACCOUNT_ID KEYGEN_ADMIN_EMAIL KEYGEN_ADMIN_PASSWORD KEYGEN_DOMAIN KEYGEN_EDITION KEYGEN_HOST KEYGEN_MODE POSTGRES_DB POSTGRES_PASSWORD POSTGRES_USER REDIS_URL SECRET_KEY_BASE`

The three `ENCRYPTION_*` keys plus `SECRET_KEY_BASE` are the ones that make a
restored DB decryptable. Losing them = a "successful" restore of undecryptable
garbage (threat T-Q-12).

## `/home/claude/devtools/server/webhook/.env`

- **sha256:** `05d9de7010cdfb6df525ad3b5f62b0371cae006ac4d63b466da0d5db0bd16c05`
- **size/mode:** 456 bytes, `-rw-------`, mtime 2026-06-17
- **key count:** 9
- **keys (sorted):**
  `EMAIL_FROM EMAIL_REPLY_TO KEYGEN_ACCOUNT_ID KEYGEN_ADMIN_TOKEN KEYGEN_BASE_URL KEYGEN_POLICY_ID LS_WEBHOOK_SECRET PORT RESEND_API_KEY`

Note: the live file has `EMAIL_REPLY_TO`, which the RUNBOOK Step 7 table does not
list — worth reconciling when Task 3 edits the RUNBOOK.

## Re-compute commands (Task 3, step 8)

```bash
ssh tinkerdev-box '
for f in /home/claude/devtools/infra/keygen/.env /home/claude/devtools/server/webhook/.env; do
  sha256sum "$f"
  sed -n "s/^\([A-Z0-9_]*\)=.*/\1/p" "$f" | sort | tr "\n" " "; echo
done'
```
