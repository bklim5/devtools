---
phase: quick/260807-ohd
plan: 01
subsystem: infra/licensing
tags: [backup, disaster-recovery, keygen-ce, cloudflare-r2, monitoring]
status: complete
requires: []
provides:
  - infra/keygen/backup.sh
  - infra/keygen/restore-test.sh
  - infra/keygen/backup.env.example
affects: [infra/keygen, .gitignore]
tech-stack:
  added: [rclone 1.60.1 (on the prod box only), Cloudflare R2, healthchecks.io]
  patterns: [fail-closed secret loading, dead-man switch, restore-and-compare proof]
key-files:
  created:
    - infra/keygen/backup.sh
    - infra/keygen/restore-test.sh
    - infra/keygen/backup.env.example
  modified:
    - .gitignore
    - infra/keygen/RUNBOOK.md
decisions:
  - "RCLONE_CONFIG_R2_NO_HEAD=true is mandatory: R2 has no object versioning, so rclone's post-PUT `HEAD ?versionId=` read-back 501s"
  - "Retention: R2 lifecycle rule at 30d is primary; the script's 40d prune is a deliberately wider backstop so the two never race"
  - "The backup check is pinged green at upload-verify time, BEFORE the chained restore test, so a restore failure cannot mis-report the backup as broken"
  - "The throwaway restore container must be torn down with `docker rm -f -v` — postgres:17.5 declares a VOLUME, so plain `rm -f` leaks ~46 MB/run"
metrics:
  duration: "~35 min (Task 3)"
  completed: 2026-08-07
---

# Quick 260807-ohd: Nightly offsite encrypted pg_dump of Keygen CE — Summary

Nightly encrypted offsite backup of the Keygen CE production database to
Cloudflare R2, with an automated restore-and-compare proof and two mandatory
external dead-man checks. Closes the Phase-20 D-49 deferred follow-up.

## Task 1 — scripts, env template, .gitignore, secret-free box prep — COMPLETE

**Commit:** `056255ef` — `feat(quick-260807-ohd): nightly encrypted offsite backup + automated restore proof`
(4 files, +811; lefthook clean: typecheck + eslint + 1434 vitest tests green)

### What landed in the repo

| File | Mode | What it does |
|---|---|---|
| `infra/keygen/backup.sh` | 755 | pg_dump (read-only) -> plaintext sanity gate -> gzip -> gpg `--symmetric` AES-256 -> local decrypt + `gunzip -t` round-trip -> `rclone copyto` R2 -> remote-size verify -> 40d retention backstop -> healthcheck ping -> chained `restore-test.sh`. Modes: default, `--no-restore-test`, `--list`, `--install-cron`, `-h`. |
| `infra/keygen/restore-test.sh` | 755 | Download -> decrypt -> restore into a THROWAWAY `postgres:17.5` -> assert account id / ed25519 pubkey / ed25519 privkey md5 / row counts vs BOTH the compiled release constants and the live DB -> own dead-man ping -> teardown. |
| `infra/keygen/backup.env.example` | 644 | Committed template. Real values live at `~/.config/devtools-backup/backup.env` on the box (mode 600), outside `deploy.sh`'s `rsync --delete` path. |
| `.gitignore` | — | Defense-in-depth block: `infra/keygen/backup.env`, `gpg.pass`, `*.gpg`, `*.sql`, `*.sql.gz`. |

### Safety rails implemented

- **Fail closed on secrets:** both scripts refuse to run if `backup.env` or the
  gpg passphrase file is missing or not mode `600`.
- **Monitoring is load-bearing:** `HEALTHCHECK_PING_URL` and
  `HEALTHCHECK_RESTORE_PING_URL` are `:?`-hard-required. There is no log-only
  degradation path.
- **Live DB never mutated:** `pg_dump` + read-only `SELECT`s only. No restarts,
  no `docker compose up/down`, no `deploy.sh`.
- **Restore can never hit live:** `restore-test.sh` accepts no target-database
  argument at all; it builds its own `keygen-restore-test-$$` container (random
  password, `--network none`, no ports, no volume, `--rm` + EXIT trap) and
  explicitly refuses any name matching the live compose postgres.
- **Plaintext hygiene:** `umask 077` + `mktemp -d` + `trap ... EXIT INT TERM`;
  private material only ever compared as md5, never printed.
- **No unbounded hangs under cron:** `flock -n`, `timeout 900` on the chained
  restore, a bounded `pg_isready` wait, and a `timeout`-wrapped `rclone_r2`
  helper (`RCLONE_CONFIG=/dev/null`, so credentials come only from env and no
  `rclone.conf` ever exists on disk).
- **Cron output is retained**, appended to `~/.local/state/devtools-backup/cron.log`,
  never `/dev/null`. All three logs are truncated to 2000 lines in place
  (inode-preserving, so cron's append-mode fd is not orphaned).

### Box prep done (secret-free, `ssh tinkerdev-box`)

| Step | Evidence |
|---|---|
| `rclone` installed | `rclone v1.60.1-DEV`, `provider = Cloudflare` present in `rclone help backend s3` |
| `~/.config/devtools-backup` | mode `700` |
| `~/.local/state/devtools-backup` | mode `700` |
| `postgres:17.5` pre-pulled | `sha256:aadf2c06…` (already the live image — confirmed, not assumed) |
| Scripts synced (plain rsync, no `deploy.sh`) | box md5 == local md5 for both scripts |
| Fail-closed proof | `backup.sh`, `backup.sh --list`, `backup.sh --install-cron`, `restore-test.sh` all exit `1` with `FATAL: backup.env not found: …`; `--help` still exits `0`; crontab still empty; no state files or `/tmp` residue created |
| Live stack untouched | all 6 containers `Up 7 weeks`; `https://license.tinkerdev.io/v1/health` = `204` |

### Recovery-secret fingerprints captured (values never read)

Stashed for Task 3 in
`.planning/quick/260807-ohd-…/task1-recovery-secret-fingerprints.md`
(NOT yet in the RUNBOOK — Task 3 re-computes and records them).

| file | sha256 | keys |
|---|---|---|
| `infra/keygen/.env` | `240eb52d5498f04d…ec9827d6` | 17 keys incl. `SECRET_KEY_BASE`, 3x `ENCRYPTION_*`, `POSTGRES_PASSWORD` |
| `server/webhook/.env` | `05d9de7010cdfb6d…0bd16c05` | 9 keys incl. `KEYGEN_ADMIN_TOKEN`, `LS_WEBHOOK_SECRET`, `RESEND_API_KEY` |

### Deviations from plan (Task 1)

**1. [Rule 2 — missing critical functionality] Bounded, config-isolated rclone wrapper**
- **Found during:** box prep, testing the R2 remote shape.
- **Issue:** the plan called raw `rclone` commands. An `rclone` hang under cron
  would hold the `flock` forever, so every later run would exit `status=skip
  reason=locked` and only the dead-man grace period would ever notice. rclone
  also printed a `NOTICE: Config file … not found` line on every run, and a
  stray `rclone.conf` could shadow the env-var remote.
- **Fix:** added `rclone_r2()` in both scripts —
  `RCLONE_CONFIG=/dev/null timeout ${RCLONE_TIMEOUT:-600} rclone --contimeout 30s --timeout 5m --retries 3`.
  Verified on the box that `RCLONE_CONFIG=/dev/null` silences the notice and
  still resolves the env-var remote.
- **Files:** `infra/keygen/backup.sh`, `infra/keygen/restore-test.sh`
- **Commit:** `056255ef`

**2. [Rule 1 — bug] Inode-preserving log truncation**
- **Issue:** a `mv`-based rotation of `cron.log` would orphan cron's
  append-mode fd, silently discarding the rest of that run's output — the exact
  diagnostic a red check needs.
- **Fix:** `truncate_log()` writes back in place (`cat "$tmp" > "$file"`).
- **Commit:** `056255ef`

**3. [Rule 2] `--network none` on the throwaway restore container**
- Not in the plan; costs nothing and removes the container's network reachability
  entirely. Verified the image starts and `docker exec`/`pg_isready` still work.

**4. [Rule 1] shellcheck directive placement**
- `# shellcheck source=/dev/null` does not attach to `set -a; source …; set +a`
  on one line (SC1090 still fired). Split onto separate lines. Both scripts are
  now `shellcheck -S style` clean with zero findings.
  (Note: pre-existing `infra/keygen/release-seat.sh` has the same latent SC1091 —
  logged as out of scope, not fixed.)

### Harness gate note

`vitest` / `tsc --noEmit` ran green via lefthook (1434 tests). The
real-WKWebView + native-window capture gates are **N/A** — this change touches no
TypeScript, Rust, or UI (`git diff --quiet HEAD -- src/ src-tauri/` passes). The
equivalent bar is `shellcheck -S style` clean + the on-box fail-closed proof;
the full real-box cycle + restore proof + live ping proof land in Task 3.
`/simplify` was applied inline; `/code-review xhigh` and
`/codex:adversarial-review` are the orchestrator's to run over `056255ef`.

## Task 2 — CHECKPOINT (human-action) — COMPLETE

Done by the owner: R2 bucket `tinkerdev-backups` + a bucket-scoped Object
Read & Write token + the 30-day lifecycle rule; both healthchecks.io checks
(`keygen-ce-backup`, `keygen-ce-restore-test`) with a verified email channel;
both recovery-critical `.env` files confirmed retrievable from the password
manager; `backup.env` + `gpg.pass` pasted onto the box.

Verified agent-side without reading a single value: both files mode `600`,
`backup.env` has exactly 9 keys including both `HEALTHCHECK_*` lines, and the
non-secret settings are `BACKUP_BUCKET=tinkerdev-backups`,
`BACKUP_PREFIX=keygen-ce`, `BACKUP_RETENTION_BACKSTOP_DAYS=40`.

## Task 3 — real-box full cycle + RUNBOOK — COMPLETE

**Commits:**

| Commit | What |
|---|---|
| `b9e54f8b` | `fix` — R2 `no_head` + honest restore-failure diagnostics |
| `c82f5f9e` | `docs` — RUNBOOK Step 10 + "Restore the license box from backup", `EMAIL_REPLY_TO` reconciliation, todo moved to `completed/` |
| `8bbcdd32` | `fix` — `docker rm -f -v`, stopping a 46 MB/run volume leak |

All three lefthook-clean (typecheck + eslint + 1434 vitest tests green).

### The cycle, proven on the live box

| Step | Evidence |
|---|---|
| Full cycle (cron path, chained restore) | exit `0` in **~6 s**; `status=ok bytes=42565 restore=pass ping=ok` |
| Object offsite | `r2:tinkerdev-backups/keygen-ce/keygen-<ts>.sql.gz.gpg`, 42,565 bytes, sha256 recorded per run |
| Restore proof | `account id: MATCH (0d607683-026f-468b-9cf0-f5bfaf61a7a1)`, `ed25519 pubkey: MATCH (huJdyRsBtd7KrPqWv5Z/8GVeLmiqfWTfQnEb090+jO4=)`, `ed25519 privkey md5 / private_key md5 / secret_key md5: MATCH`, `row counts: MATCH (accounts=1 licenses=3 machines=2 policies=1 products=1 users=1)` → `restore test PASSED` |
| Standalone drill | `restore-test.sh` with no args picks the newest object and PASSES in ~4.5 s |
| Teardown | `docker ps -a \| grep -c keygen-restore-test` = `0`; `docker volume ls -qf dangling=true` = `0` |
| Both dead-man checks | success ping `http=200 body=OK` on both; `ping=ok` in every log line |
| Cron | exactly **1** schedule entry, idempotent across two `--install-cron` runs (3-line managed block), appends to `cron.log`, **zero** `>/dev/null`; `cron` daemon `active` |
| Retention backstop | `rclone delete --dry-run --min-age 40d` → **0** would-delete lines today |
| Live stack untouched | `keygen-postgres-1` `started=2026-06-14T07:58:42Z` unchanged, all 6 containers `Up 7 weeks`, `/v1/health` = `204`, live row counts unchanged (1 account / 3 licenses) |
| Hygiene | no plaintext residue in `/tmp`, secret dir holds only `backup.env` + `gpg.pass` (both `600`), `/` back to its pre-task 7.6G used / 29G free |
| App-code drift | `git diff --quiet HEAD -- src/ src-tauri/` passes |

**Encrypted artifact size is ~42 KB, not the "single-digit MB" the plan
predicted.** The DB is 13 MB but that is nearly all empty index/page overhead;
six rows of real data gzip hard. The meaningful health signals are the plaintext
sanity gate (≥100 KB, `CREATE TABLE public.accounts`, `COPY public.accounts`)
and the restore test's row-count comparison against live — not the ciphertext
size. Noted in the RUNBOOK so nobody reads 42 KB as "the dump is empty".

### Failure paths proven (then returned to green)

| Injected failure | Result |
|---|---|
| `BACKUP_ENV=/nonexistent` | exit `1`, `FATAL: backup.env not found: …` — fails closed |
| Valid secrets, non-existent bucket | exit `1`, `status=fail … restore=skipped ping=ok` (the `ping=ok` **is** the proof the `/fail` POST returned 200), no object uploaded. R2 answered **403 Forbidden**, not 404 — independent evidence the token really is scoped to the one bucket (T-Q-04) |
| `restore-test.sh --object …/nonexistent…` | exit `1`, `status=fail … ping=ok` on the *restore* check, container still torn down |
| Good path re-run | both checks back to **green**, `ping=ok` |

**A missing `backup.env` cannot send a `/fail` ping** — the script exits before
it loads the URLs. That failure is caught by the 6 h grace period instead, which
is exactly why the dead-man check (not the log) is the alerting mechanism. Now
the first row of the RUNBOOK triage table.

### Deviations from plan (Task 3)

**1. [Rule 1 — bug] R2 has no object versioning; rclone's post-PUT read-back 501s**
- **Found during:** the very first real cycle.
- **Issue:** rclone 1.60 follows a successful `PUT` with
  `HEAD <key>?versionId=<id>`. R2 does not implement versioning → **501
  NotImplemented**, so rclone reported the transfer as failed *although the bytes
  landed*. The run only went green on attempt 2, where rclone found the object
  already present and skipped it — **a passing backup resting on an accident**,
  plus an `ERROR` in the cron log every night training the operator to ignore it.
- **Ruled out first:** the `x-amz-acl` header (5/5 failures with and without it).
  Confirmed by a filtered header dump (credentials stripped on the box) showing
  the 501 on the `?versionId=` HEAD, after a 100 %-transferred PUT.
- **Fix:** `RCLONE_CONFIG_R2_NO_HEAD=true` in both scripts. Integrity unchanged —
  the PUT carries `Content-Md5` (R2 validates server-side), `backup.sh` still
  verifies the remote size via an independent `lsjson`, and `restore-test.sh`
  restores the object end to end. Proven: 3/3 uploads clean, download sha256 ==
  local sha256.
- **Commit:** `b9e54f8b`

**2. [Rule 1 — bug] A missing object was reported as a decryption failure**
- **Found during:** the deliberate restore-failure path.
- **Issue:** `rclone copyto` **exits 0 when the source does not exist**
  ("nothing to copy"), so the `|| fatal "rclone download failed"` guard never
  fired. The failure resurfaced two steps later as *"gpg decrypt failed … the
  artifact is NOT recoverable with this passphrase"* — a wrong and alarming
  diagnosis for a pruned object or a typo'd `--object`, and the message an
  operator meets at 3am. Separately, the fail log line reported `account=MATCH`
  after an early failure, claiming a comparison that never ran.
- **Fix:** assert the downloaded file is non-empty and name the real cause
  (`MISSING OBJECT, not a decryption problem`); log `account=-` until the
  restored-vs-live assertions actually execute.
- **Commit:** `b9e54f8b`

**3. [Rule 1 — bug] The nightly restore test leaked a 46 MB volume per run**
- **Found during:** chasing a 7.6G → 7.8G disk drift across the proof runs.
- **Issue:** `postgres:17.5` declares `VOLUME /var/lib/postgresql/data`, so the
  throwaway container gets an **anonymous volume**. `--rm` would have reaped it,
  but the EXIT trap's explicit `docker rm -f` wins the race and, without `-v`,
  orphaned it every run. Measured: **4 dangling volumes × 46 MB**, timestamps
  matching the 4 restore runs exactly ⇒ ~1.4 GB/month of unbounded growth on the
  production box's 38 GB disk. This is threat **T-Q-06**, which the plan recorded
  as "mitigated: no accumulation". It was not.
- **Fix:** `docker rm -f -v`. Reclaimed the 4 leaked volumes (named live volumes
  untouched, stack still `Up`, `/v1/health` 204), then 3 further container
  lifecycles left dangling volumes at **0**, `docker system df` reclaimable at
  **0 B**, and `/` back to its pre-task 7.6G.
- **Commit:** `8bbcdd32`

**4. [process] A test copy of `backup.env` briefly survived in `/tmp`**
- The bad-bucket failure test (prescribed by the plan) writes a throwaway copy of
  the real secrets to a `mktemp` path; my cleanup line did not run. Caught on the
  next residue check and `shred -u`'d within the same session. `/tmp` is now
  clean. Recorded because it was a real, if short-lived, secret-at-rest exposure
  on the box — not something to leave unstated in a security-relevant summary.

### Recovery-secret fingerprints (re-computed at commit time, values never read)

Unchanged from Task 1, and now in RUNBOOK "Restore the license box from backup"
step 0:

| file | sha256 (verified 2026-08-07) | keys |
|---|---|---|
| `infra/keygen/.env` | `240eb52d…ec9827d6` | 17 |
| `server/webhook/.env` | `05d9de70…0bd16c05` | 9 |

The `server/webhook/.env` list includes **`EMAIL_REPLY_TO`**, which RUNBOOK
Step 7's table omitted; reconciled in `c82f5f9e` (described, not valued — I never
read it).

### RUNBOOK sections added

- **Step 10 — Offsite encrypted backups (Cloudflare R2)**: schedule + pipeline,
  artifact path, secret layout and *why* it sits outside `infra/keygen/`
  (`deploy.sh --delete`), the passphrase-escrow warning, retention model,
  the two-dead-man-check monitoring model + why an on-box log cannot detect
  cron-not-firing/box-dead/disk-dead, ping-URL rotation, the chained restore
  validation with verbatim PASSED output, diagnostics, an 8-row
  "check went red — what now" triage table, and the R2-no-versioning gotcha.
- **Restore the license box from backup**: fingerprint table first (the most
  likely silent failure), snapshot-vs-R2 guidance, fresh-box order, restore into
  postgres-only, the loud **do NOT run `setup.sh`** rail (it mints a new Ed25519
  keypair and bricks every shipped app), DNS + stack bring-up, the constants
  smoke test + refresh round-trip, and a final step requiring the new box's own
  backups to be monitored before recovery counts as finished.
- **Step 2.2** deferral closed — now points at Step 10.

### Secret-discipline check on the commits

`git diff --cached | grep -Ei 'hc-ping|r2.cloudflarestorage|SECRET|PASS'` returns
only key **names**, prose, and variable names. Zero ping-URL UUIDs, zero
occurrences of the R2 endpoint. The only long tokens in the diff are the two
intended sha256 fingerprints and the Ed25519 **public** key (already a compiled
constant in `src-tauri/src/license/config.rs`).

### Harness gate note

`shellcheck -S style` clean (zero findings) on both scripts after every edit;
`bash -n` clean; lefthook green on all three commits. The real-WKWebView and
native-window capture gates remain **N/A** — no TypeScript, Rust, or UI is
touched (`git diff --quiet HEAD -- src/ src-tauri/` passes). The equivalent bar
here is the real-box full cycle + restore proof + live ping proof above.
`/simplify` applied inline; `/code-review xhigh` and `/codex:adversarial-review`
over `b9e54f8b..8bbcdd32` are the orchestrator's to run.

### Open item for the human

Only one, and it is a 30-second dashboard glance: confirm **both checks show
green/"up"** on healthchecks.io, and that the two alert emails dated 2026-08-07
(from the deliberate failure tests) are recognised as **expected, not an
incident**. Agent-side proof of delivery is the `200`/`OK` on every ping and
`ping=ok` on the `/fail` posts.

Note: `~/.local/state/devtools-backup/cron.log` does not exist yet — it is
created by the first cron-driven run at **03:17 UTC**. The RUNBOOK's
`tail … cron.log` command will report "no such file" until then; that is normal,
not a fault.

## Self-Check: PASSED

- Commits `b9e54f8b`, `c82f5f9e`, `8bbcdd32` all present in `git log`.
- `infra/keygen/RUNBOOK.md`, `backup.sh`, `restore-test.sh` present; todo present
  in `.planning/todos/completed/` and absent from `pending/`.
- RUNBOOK contains "Step 10 — Offsite encrypted backups", "Restore the license
  box from backup", `EMAIL_REPLY_TO`, and both sha256 fingerprints.
- `RCLONE_CONFIG_R2_NO_HEAD` present in both scripts; `docker rm -f -v` present
  in `restore-test.sh`.
- `git diff --quiet HEAD -- src/ src-tauri/` passes (zero app-code drift).
- Box scripts byte-identical to HEAD (`md5` parity checked both directions).
- Working tree carries only the two untracked `.planning/` docs the orchestrator
  owns.

---

## Remediation pass (post-review, 2026-08-07 22:4x UTC)

Two review passes (`/simplify` + `/code-review xhigh`) over `056255ef..8bbcdd32`
produced 15 correctness findings and ~12 simplification items. All were applied.

**Commits** (all lefthook-clean: typecheck + eslint + 1434 vitest tests green):

| Commit | What |
|---|---|
| `39134954` | `fix` — extract `backup-lib.sh`; one shared exit logger; manifest-based restore proof; `--fetch`; all 15 correctness findings |
| `fbd90ff4` | `docs` — RUNBOOK: manifest, `--fetch` DR path, "Implementation notes" (the single home for every rationale), deploy-root truth, fresh-box prerequisites, new triage rows; `backup.env.example` de-absolutised |
| `2acf6132` | `fix` — `deploy.sh` excludes `backup.env`/`gpg.pass` + records the real `REMOTE_DIR` |

### Per-finding outcome

| # | Finding | Outcome |
|---|---|---|
| S1 (R1/R2) | Extract shared `backup-lib.sh`; delete the false "independently runnable" rationale; ONE exit logger composing the line after the pings | **DONE.** `infra/keygen/backup-lib.sh` (new): PATH pin, `umask 077`, `fatal`/`now`/`usage_error`, fail-closed env loading, `rclone_r2`, `gpg_encrypt_stdin`/`gpg_decrypt`, `truncate_log`, `hc_ping`, `emit_exit_log`, `sanitize_pg_log`, the sweeps, and the two SQL strings both sides must agree on |
| S2 (F1/F13) | Manifest at dump time; restore-test compares RESTORED vs MANIFEST, no live-DB access | **DONE**, with one deliberate deviation: the manifest is **gzipped + GPG-encrypted** (`<object>.manifest.json.gz.gpg`), not plaintext JSON — it fingerprints private material, and an unencrypted object at the R2 trust boundary would have been a new information-disclosure surface (T-Q-01/03). Encrypting it keeps the threat model unchanged and `--fetch` reads it with the same one-liner. **Row counts come from the dump itself** (parsed out of the `COPY` blocks — genuinely the same read that produced the artifact, so zero drift); **identity + private-key md5s come from one live SELECT in the same run** (those columns are immutable — the keypair is minted once and never rotates); plus plaintext and ciphertext sha256 + size. `restore-test.sh` has **zero** live access |
| S3 (F3/A3) | `backup.sh --fetch <object> <dest>`; RUNBOOK DR uses it | **DONE.** Reuses `rclone_r2` + the copyto-missing-source guard + `gpg_decrypt | gunzip` under `pipefail`; `<dest>` is created 0600. RUNBOOK DR is now one line under a `set -euo pipefail` preamble |
| F2 | Validate retention (integer, >= 35) before any rclone; prune refuses if the fresh object is not listed | **DONE.** Floor is 35 with the reason inline (must stay wider than the 30-day lifecycle rule). Both proven on the box |
| F4 | `timeout` around the pg_dump `docker compose exec` | **DONE** (`PG_DUMP_TIMEOUT`, documented in the example's override block) |
| F5→F6 | `--kill-after` on every `timeout`; verify teardown on the KILL path | **DONE** (`-k 30`). What is proven: the signal goes to the CHILD, so the script's own EXIT trap still logs and pings. What is NOT possible: a SIGKILLed run cannot run its own trap — **measured**, it leaks a container and a plaintext work dir. Closed by a labelled + age-gated sweep in the next run (Rule 2 addition) |
| F6 | `install_cron`: distinguish "no crontab" from a real failure; preserve unmanaged lines | **DONE**, round-tripped on the real crontab |
| F7 | Never tail raw psql output; state files 0600 | **DONE.** `sanitize_pg_log` keeps only `ERROR/FATAL/PANIC` lines, drops `CONTEXT/DETAIL/STATEMENT/HINT` (a failing `COPY public.accounts` quotes the Ed25519 private key), clips to 200 chars / 10 lines. `umask 077` in the lib + a `chmod 600` re-assert on the state files (cron creates `cron.log` under umask 022; it also fixed the pre-existing 0664 `backup.lock`) |
| F8 | Collision guard must never delete a container it did not create | **DONE**, via a `CONTAINER_OWNED` flag rather than the suggested `KEEP=1` — same protection, and the run still logs and pings (a `KEEP=1` path would have printed a misleading "leaving the work dir" banner). Proven with a colliding container: same ID, still running afterwards |
| F9 / R3 | Validate flag values; reject meaningless combinations; exit 2 | **DONE** for both scripts (`--object`/`--fetch` value checks, mutually-exclusive mode flags, `--no-restore-test` rejected on non-backup modes) |
| F10 | A failed `/fail` ping must show as `ping=err` in BOTH logs | **DONE** by the shared exit logger (ping first, compose after). Proven: a run against a bogus bucket with a bogus ping URL persists `status=fail … ping=err` |
| F11 | Newest-object discovery must not swallow rclone's exit status | **DONE** — `lsjson` is captured on its own, then `jq`. A credentials/bucket failure now says so instead of "no backups exist". Also filtered to `*.sql.gz.gpg` so a manifest can never be selected as "newest" |
| F12 | The flock fd must not leak into children | **DONE** — `9>&-` on every child (pg_dump exec, live SELECT, rclone, both gpg calls, both curl pings, the chained restore-test). Mechanism proven on the box: an orphaned child WITHOUT `9>&-` keeps the lock held after the parent exits; WITH it the lock is free |
| F13 | (folded into S2) | **DONE** |
| F14 | RUNBOOK fresh-box: install the bins | **DONE** — `rclone gnupg jq curl cron`, plus "copy all three scripts, `backup-lib.sh` included" |
| F15 | No absolute `/home/claude` in the example; default the passphrase path inside the scripts | **DONE** — default is `${XDG_CONFIG_HOME:-$HOME/.config}/devtools-backup/gpg.pass`; the example shows it commented out. No script assumes a user name |
| S1 | Drop statically-true guards; derive the live container where needed | **DONE** — the two tautological `CNAME` comparisons are gone (the loud rail stays as a comment + the collision guard). `backup.sh` uses `docker compose exec postgres`, so no container name is hardcoded anywhere; `restore-test.sh` no longer references the live stack at all |
| S2 | Document or inline the undocumented knobs | **DONE** — every knob is in the example's override block, including `BACKUP_ENV`'s bootstrap caveat |
| S3 | Drop the `ACL=private` no-op | **DONE** |
| S4 | Drop the unreachable mode arm | **DONE** |
| S5a | Collapse `check()`'s redundant 5th param | **DONE** — it is a `show` boolean instead of a duplicate of `$2` |
| E1/E2 | Pipe `gzip\|gpg` and `gpg\|gunzip` | **DONE** — no `dump.sql.gz` staging file on either side |
| A1 | Scope the six `RCLONE_CONFIG_R2_*` to `rclone_r2` as a command prefix | **DONE** — `backup.env` is sourced WITHOUT `set -a`, so the credentials are shell-local and no gpg/docker/psql/curl child inherits them |
| A2 | Rationales live once in the RUNBOOK; scripts carry pointers | **DONE** — new "Implementation notes" section; the long NO_HEAD / volume-leak / truncation comments in the scripts are now one-liners |
| A4 / A4a | Reconcile the deploy root; `deploy.sh` excludes the backup secrets | **DONE** — RUNBOOK "Where things actually live on the box" states the live truth (`/home/claude/devtools`) and that `deploy.sh`'s `/opt/devtools` default is not what production uses; `deploy.sh` carries both the note and the two excludes |
| S5 | Trim comment density where A2 removed the bulk | **DONE**, load-bearing warnings kept verbatim |

Nothing was found factually wrong; every finding was applied.

### Deviations / additions beyond the review list

**1. [Rule 1 — bug] `RCLONE_TIMEOUT` is a name collision with rclone itself**
`rclone` maps every `RCLONE_*` environment variable onto a flag, so the Task-1
knob `RCLONE_TIMEOUT=600` is read by rclone as `--timeout 600` and aborts with
`missing unit in duration "600"`. Latent while nobody set it — and I was about to
document it as a supported override. Renamed to **`BACKUP_RCLONE_TIMEOUT`**;
caught by an actual failing invocation on the box, not by reading.

**2. [Rule 2] A SIGKILLed run leaks a container AND a plaintext work dir**
F6 asked for proof that teardown survives the KILL path. It does not — nothing
can run a trap after SIGKILL. Measured on the box: `kill -9` mid-drill left
`keygen-restore-test-<pid>` running and `/tmp/devtools-restore-test.XXXXXX`
holding the decrypted dump (the Ed25519 private key) on disk indefinitely. Added
two age-gated sweeps (label-scoped containers, uid+name-scoped work dirs,
`STALE_SWEEP_AGE`, default 1 h — far beyond the 900 s restore cap, so a run in
flight is never touched). Proven: stale dirs swept, an unrelated dir and an
in-flight dir both preserved.

**3. [Rule 3] The compose-file check blocked the DR path**
`backup.sh` required `compose.yaml` at load time for every mode, so `--fetch` and
`--list` failed on a box where the stack is not up yet — exactly the disaster
scenario `--fetch` exists for. Moved into the backup cycle.

### Verification (all on the live box)

| Check | Evidence |
|---|---|
| Static | `shellcheck -S style` **and** `shellcheck -x -S style` clean (zero findings) on all three scripts; `bash -n` clean |
| Full real cycle | exit 0 in **~6.8 s**; `status=ok bytes=42565 … restore=pass ping=ok`; artifact + manifest both uploaded and size-verified |
| Manifest proof | restore drill prints MATCH on artifact sha256/bytes, plaintext sha256/bytes, account id, ed25519 pubkey, 3 private-key md5s and row counts → `restore test PASSED` |
| **No live access in the drill** | Differential `docker events --filter container=keygen-postgres-1`: the full cycle produces **6** exec events (pg_dump + the identity SELECT); the standalone drill produces **0**. Static: `grep -c 'docker compose\|COMPOSE_FILE\|live_sql' restore-test.sh` = **0** |
| `--fetch` round-trip | manifest → readable JSON on stdout; artifact → `dump.sql`, mode **600**, sha256 **identical** to the manifest's `plaintext_sha256` |
| Retention validation | `=7` → `FATAL … must be >= 35`; `=abc` → `FATAL … whole number`; both fire **before** rclone (proved by contrast: with `=40` the same `--list` reaches rclone and is killed by its own timeout, rc=124) |
| Prune guard | with uploads suppressed, `FATAL: the object just uploaded (…) is not in the listing for prefix keygen-ce — refusing to prune`; R2 object count unchanged |
| Arg validation | `--object` w/o value, `--fetch` w/o dest, `--list --install-cron`, `--no-restore-test --list` → usage + **exit 2** |
| Collision guard | pre-existing `keygen-restore-test-collide`: run refuses, container **same ID, still running** afterwards |
| KILL path + sweep | `kill -9` leaves a container; next run logs `sweeping stale throwaway container … (killed run)`, then PASSES; 0 leftovers, 0 dangling volumes |
| flock fd | orphaned child **without** `9>&-` → "lock STILL HELD"; **with** `9>&-` → "lock FREE"; all 10 child call sites carry it |
| `ping=err` | bogus bucket + bogus ping URL → persisted line `status=fail … exit=1 ping=err` |
| Missing object / missing manifest | both fatal with the correct diagnosis ("MISSING OBJECT, not a decryption problem" / "predates the manifest format"), container torn down, `/fail` ping delivered (`ping=ok`) |
| Cron | unmanaged comment + job **preserved** across two `--install-cron` runs; exactly **1** managed schedule line; appends to `cron.log`; **0** `>/dev/null`; a simulated `crontab -l` permission failure → FATAL and the real crontab **untouched**; "no crontab for claude" → proceeds and installs |
| Retention dry-run | `rclone delete --dry-run --min-age 40d` → **0** would-delete lines |
| Both healthchecks | final good run `ping=ok` on both; explicit re-ping `http=200 body=OK` on each (URLs never printed) |
| Live stack untouched | `keygen-postgres-1 started=2026-06-14T07:58:42Z` (unchanged), all 6 containers `Up 7 weeks`, `/v1/health` **204**, licenses still **3** |
| Hygiene | 0 restore containers, 0 dangling volumes, 0 `/tmp` residue, `/` still 7.6G used, all state files **600** (incl. `backup.lock`, previously 0664) |
| Parity | box copies of all four files byte-identical to `HEAD` (md5) |
| Secret discipline | staged diff grepped for `hc-ping|SECRET|PASS|r2.cloudflarestorage` → only key **names**, prose and variable names. Test env files used fake credentials only (never a copy of the real `backup.env`) and were `shred -u`'d; no real secret ever left `~/.config/devtools-backup/` |
| App code | `git diff --quiet HEAD -- src/ src-tauri/` passes |

**Note for the human:** the deliberate failure tests sent several
healthchecks.io alert emails dated 2026-08-07 — expected, not an incident. Both
checks were returned to green by the final full-cycle run
(`keygen-20260807T225447Z`, `restore=pass`). Cron remains installed at
`17 3 * * *` UTC, unchanged.

---

## Remediation pass 2 — final Codex adversarial findings (2026-08-07 23:0x–23:2x UTC)

Three scoped findings from the final `/codex:adversarial-review`. Deeper
redesigns (signed external digest stores, atomic deploy machinery) were
deliberately NOT built — they are routed to todos.

**Commits** (both lefthook-clean: typecheck + eslint + 1434 vitest tests green):

| Commit | What |
|---|---|
| `05bc08a1` | `fix` — freshness/monotonicity check + manifest schema 2, `BACKUP_PIPELINE_VERSION` pin, retention-window health |
| `f69e138c` | `docs` — RUNBOOK: Freshness, Retention-window health, Recurring maintenance (quarterly lifecycle-rule eyeball), 5 triage rows, 3 Implementation notes |

### 1. FRESHNESS / AUTHENTICITY — DONE

**The gap:** the manifest is self-attested. It proves the artifact is internally
consistent; it says nothing about whether the dump is of the *current*
production database. A stale checkout, a wrong `COMPOSE_FILE`, or a second
postgres project on the box all produce a perfectly valid manifest of an OLDER
database, and *every* downstream check (sha256, row counts, the restore drill)
still passes.

**(a) Manifest schema 1 → 2**, gaining:

| Field | Value on the live box |
|---|---|
| `dump_started_at` / `dump_finished_at` / `dump_seconds` | `2026-08-07T23:11:21Z` / `…21Z` / `0` |
| `compose_project` | `keygen` |
| `container_id` | `991a6b4d6b4f32d28e3e04e1f78d909db75749854be91d0d83576cbb661b5e2e` |
| `licenses_count` | `3` — parsed out of the dump's own `COPY public.licenses` block |
| `licenses_max_created_at` | `2026-06-17 20:26:07.210067` — same block, `created_at` column located from the `COPY` header |

`docker compose ps -q postgres` returning nothing is **fatal**: an artifact whose
source database cannot be identified is not published. The compose *project*
label degrades to `unknown` (informational only).

**Cross-checked against live** (read-only `select count(*), max(created_at) from
licenses`): `3~2026-06-17 20:26:07.210067` — byte-identical to what the awk
parser read out of the dump. Independent confirmation the parser is right, not
merely self-consistent.

**(b) Monotonic-regression gate.** Each run downloads the newest manifest under
the prefix and refuses to publish a dump whose `licenses_count` or
`licenses_max_created_at` went **down**. Licenses are never deleted here, so a
decrease is the signature of a stale/wrong-database dump.

One deliberate scope decision: the check runs **before the upload**, not merely
"before the success ping". A regressed artifact that reached R2 would become the
newest object, and *tomorrow's* run would compare itself against the bad manifest
and pass — the gate would silently disarm itself after one bad night. Both proofs
below show `artifact=none`: nothing is uploaded on a regression.

Compatibility: manifests already in the bucket are schema 1. The count comparison
falls back to parsing their `row_counts` string (so it works immediately, proven
below); the `created_at` half logs a notice and is skipped until schema-2
manifests exist. A first run under a prefix logs
`notice: no previous manifest … first run` and proceeds.

**Proof (all on the live box):**

| Path | Evidence |
|---|---|
| schema-1 fallback (real prefix) | `notice: previous manifest keygen-20260807T225447Z… predates licenses_max_created_at — skipping that comparison` + `freshness ok: licenses 3 -> 3` — the count still compared, via `row_counts` |
| schema-2, both halves | `freshness ok: licenses 3 -> 3, newest created_at 2026-06-17 20:26:07.210067 -> 2026-06-17 20:26:07.210067` |
| first run | empty test prefix → `notice: no previous manifest under keygen-ce-vtest — first run` , exit 0 |
| **count regression** | hand-crafted previous manifest claiming 99 licenses → `FATAL: FRESHNESS REGRESSION: this dump has 3 licenses, the previous manifest (keygen-29990101T000000Z…) had 99 …`, `status=fail … artifact=none`, exit 1, and `--list` confirms the run's object was **never uploaded** |
| **created_at regression** | previous manifest claiming `2099-01-01 00:00:00.000000` (count left at 3, so only this branch can fire) → `FATAL: FRESHNESS REGRESSION: newest licenses.created_at in this dump is '2026-06-17 …' … had '2099-01-01 …'`, `artifact=none`, exit 1 |

### 2. SCRIPT-CONSISTENCY PIN — DONE

`BACKUP_PIPELINE_VERSION="2026-08-08.1"` is defined **once** in `backup-lib.sh`.
`backup.sh` and `restore-test.sh` each carry their own `EXPECT_PIPELINE_VERSION`
and call `require_pipeline_version` as their **first action** — before argument
parsing, before config, before docker or R2. Mismatch prints the version pair and
`PARTIAL DEPLOY — re-rsync infra/keygen/ (… together, as a set).` and exits 1.

Bump discipline is a one-line comment on the constant and a paragraph in RUNBOOK
"Implementation notes": any change spanning the three files bumps all three
constants in the same commit; over-bumping is safe (mismatch is fatal),
under-bumping is the thing to avoid.

**Proof (box copies edited, then restored; md5 parity re-verified):**

| Path | Evidence |
|---|---|
| `backup.sh` ahead of the lib | `FATAL: pipeline version mismatch — backup.sh expects '2026-08-09.9', backup-lib.sh is '2026-08-08.1'` + PARTIAL DEPLOY line, exit 1 |
| fires before config | same FATAL with `BACKUP_ENV=/nonexistent` (which normally fails closed first) |
| fires before arg parsing | same FATAL with `--nonsense-flag` (which normally exits 2 with usage) |
| `restore-test.sh` behind the lib | `FATAL: pipeline version mismatch — restore-test.sh expects '2026-08-07.0' …`, exit 1 |
| lib with no constant at all (old lib, new scripts) | `… backup-lib.sh is '<none>'` — the `:-<none>` guard, not an `unbound variable` crash |
| restored | box md5s back to local md5s for all three files |

### 3. RETENTION-WINDOW HEALTH — DONE

After the prune, before the green ping, **one** `lsjson` of the prefix feeds three
assertions:

| # | Assertion | Fires on |
|---|---|---|
| a | every artifact has its manifest and vice versa; orphans logged, **>2 fatal** | a half-completed upload, a prune eating one side |
| b | artifact count **>= min(days since oldest object, 25)** | mass deletion; tolerates a warming-up prefix, caps below the 30-day lifecycle rule |
| c | oldest artifact age **<= backstop + 3** (43d) | a prune that stopped running |

Failure semantics, as specified: the **RUN fails** — `/fail` ping, red check,
`reason="retention: …"` — while the artifact that run produced is still uploaded
and usable. The log line says which, via a new field: `artifact=uploaded-usable`
vs `artifact=none`.

**Proof:**

| Path | Evidence |
|---|---|
| real prefix, warm-up tolerance | `retention ok: 13 artifacts / 9 manifests (4 pre-manifest legacy), oldest 0d, floor 0, cap 43d` — passes |
| **(a) live** | 3 manifest-less artifacts injected into the test prefix → orphans listed by name, then `FATAL: retention: 3 orphaned objects … (>2)`, `status=fail … artifact=uploaded-usable`, exit 1 |
| (a) threshold, both sides | 2 orphans → logged, `rc=0`; 3 orphans → fatal |
| **(b) live, with the REAL ping URL** | test prefix seeded with a 10-day-old pair → `FATAL: retention: only 3 artifacts under keygen-ce-vtest but the oldest is 10 days old — expected at least 10`, and the log line ends `… artifact=uploaded-usable restore=skipped reason="retention: …" exit=1 ping=ok` — **`ping=ok` is the proof the `/fail` POST was delivered** |
| (b) warm-up control | 1 artifact, oldest 0d → floor 0 → passes |
| **(c)** | 26 pairs spread over 60 days (so a and b both pass) → `FATAL: retention: the oldest artifact … is 60 days old, older than BACKUP_RETENTION_BACKSTOP_DAYS+3 (43) — the prune is not running.` Control at 30d with the same shape → `rc=0` |

**How (c) was proven, and why it could not be a live run.** If the prune works,
`rclone delete --min-age 40d` removes anything old enough to trip a 43-day
ceiling *before* the check ever sees it — assertion (c) is by construction
unreachable while the machinery it monitors is healthy. So it was exercised by
extracting `check_retention_health` **verbatim from the shipped `backup.sh`**
(`sed -n '/^check_retention_health() {$/,/^}$/p'` → `eval`) with only `rclone_r2`
stubbed to a synthetic listing. Same 67 lines of code, no reimplementation. That
harness also re-proved (a) and (b) and their controls, and was run against the
**real** `keygen-ce` listing as a dry check before any live run.

**The R2 lifecycle rule cannot be checked from the box at all** — `rclone` cannot
read a bucket's lifecycle configuration, so no assertion can confirm the primary
retention control still exists. Documented as an explicit **quarterly eyeball**
in a new RUNBOOK "Recurring maintenance" table (together with a quarterly check
that both healthchecks.io checks still exist and still have an email channel).

### Deviations / findings beyond the three items

**1. [Rule 1 — bug] The pairing rule exempted each prefix's oldest artifact**
First cut judged "pre-manifest legacy" by ModTime: an artifact older than the
oldest manifest was exempt. But a run uploads its artifact and its manifest ~0.3 s
apart, so the *oldest pair's own artifact* is always older than the oldest
manifest and was silently exempted from the pairing check. On the production
prefix it happened to pass only because the jq date parse truncates fractional
seconds and the two landed in the same second — luck, not design. Caught by a
test-prefix run reporting `1 pre-manifest legacy` for a prefix containing exactly
one freshly written pair. **Fix:** judge on the `keygen-<ts>` **name stamp** both
halves of a pair share — exact, clock-independent, and a same-run pair compares
equal rather than less-than. Re-verified: real prefix still reports the 4 genuine
pre-format artifacts as legacy and **0** orphans.

**2. [Rule 1 — bug] jq `index()` rebinds `.`**
`select(($mb | index(.p | rtrimstr(…))) == null)` fails with
`Cannot index array with string "p"` — inside `index(...)` the input is `$mb`,
not the object being filtered. Caught by a read-only dry run against the real
listing *before* any live execution, not by reading. Fixed by binding the element
(`. as $x`) first.

**3. [process] `--fetch`'s download logic was duplicated**
The freshness check needs the same "rclone copyto exits 0 on a missing source"
guard, so `fetch_object`'s inline body was extracted to `download_object` and
both call sites share it (mirrors `restore-test.sh`'s `download`). No behaviour
change.

**4. [process] SIGPIPE from a `| head -8` capture killed a run mid-drill**
My own verification command, not the pipeline. Checked immediately for the known
consequence (an orphaned throwaway container / plaintext work dir): **none** —
0 containers, 0 work dirs, 0 dangling volumes. Repeated the final cycle cleanly
(exit 0, both pings green). Recorded because an abrupt-death path is exactly what
the age-gated sweeps exist for and the check should be stated, not assumed.

### Test isolation (PROD SAFETY)

Every failure-path test ran against a **separate `keygen-ce-vtest/` prefix**,
which was purged afterwards. `keygen-ce/` history was never edited or deleted —
its object count only ever grew.

The test config files contained **no secrets**: they `source` the real
`backup.env` and then override `BACKUP_PREFIX` (and, for the noisy runs, the two
ping URLs, so the production dead-man checks were not flapped by failure tests).
Both lived in the mode-700 secret dir at mode 600 and were `shred -u`'d.
Exactly **one** deliberate failure was pointed at the real ping URL, to prove
`/fail` delivery; both checks were then returned to green.

### Verification summary (all on the live box)

| Check | Evidence |
|---|---|
| Static | `shellcheck -S style` **and** `shellcheck -x -S style` clean (zero findings) on all three scripts; `bash -n` clean |
| Full real cycle | exit **0** in ~9.4 s; `freshness ok …` + `retention ok: 13 artifacts / 9 manifests (4 pre-manifest legacy), oldest 0d, floor 0, cap 43d`; `status=ok … artifact=uploaded-usable restore=pass ping=ok` |
| Manifest schema 2 | fetched and read back: all 7 new fields present and correct; row counts and identity unchanged |
| Parser vs live | dump-parsed `licenses=3 / 2026-06-17 20:26:07.210067` == live `select count(*), max(created_at)` |
| Restore drill | unchanged and still `restore test PASSED` — all 10 checks MATCH |
| Freshness regressions | count and `created_at` branches both fatal, `artifact=none`, nothing uploaded (confirmed by `--list`) |
| Version mismatch | 5 variants fatal (script ahead, script behind, no env, bad arg, unversioned lib); box files restored to md5 parity |
| Retention (a) | live: 3 orphans → fatal; harness: 2 → logged/ok, 3 → fatal |
| Retention (b) | live: 3 artifacts vs a 10-day window → fatal + **`/fail` delivered (`ping=ok`)**; warm-up control passes |
| Retention (c) | harness: 60d oldest → fatal; 30d control → ok (unreachable live by construction — see above) |
| Both healthchecks | final full cycle `ping=ok` on **both**; both left **GREEN** |
| Live stack untouched | `keygen-postgres-1 started=2026-06-14T07:58:42Z` (unchanged), all 6 containers `Up 7 weeks`, `/v1/health` **204**, licenses still **3** |
| Hygiene | test prefix purged; test env files `shred -u`'d; secret dir holds only `backup.env` + `gpg.pass` (both 600); 0 restore containers, 0 dangling volumes, 0 `/tmp` residue; `/` still 7.6G used; state files 600; shellcheck docker image removed |
| Cron | unchanged — exactly **1** managed schedule line, `17 3 * * *` UTC |
| Parity | box copies of all three scripts byte-identical to `HEAD` (md5) |
| Secret discipline | staged diff grepped for `hc-ping\|SECRET\|PASS\|r2.cloudflarestorage` → only key **names**, prose and variable names |
| App code | `git diff --quiet HEAD -- src/ src-tauri/` passes |

**Note for the human:** one further healthchecks.io alert email dated 2026-08-07
(reason `retention: only 3 artifacts under keygen-ce-vtest …`) is the deliberate
`/fail` delivery proof — **expected, not an incident**. Both checks were returned
to green by the final full cycle (`keygen-20260807T231919Z`, `restore=pass`).
