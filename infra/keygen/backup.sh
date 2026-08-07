#!/usr/bin/env bash
# Nightly encrypted OFFSITE backup of the Keygen CE production database
# (quick/260807-ohd — closes the Phase-20 D-49 deferred follow-up).
#
# WHY: the account's Ed25519 signing keypair and every license/machine record
# live ONLY in the postgres volume on one Hetzner CX23. Losing it ends
# activation/refresh/deactivation for every buyer. Provider snapshots die with
# the provider account; this puts an encrypted copy at a DIFFERENT vendor,
# proves it restores, and shouts when it does not.
#
# ONE RUN: pg_dump (read-only) -> sanity-gate the plaintext -> gzip | gpg
# --symmetric AES-256 -> local decrypt round-trip -> upload artifact + its
# MANIFEST to R2 -> verify both -> retention backstop -> healthcheck ping ->
# chained restore-test.sh (restores what was just uploaded and compares it to
# the manifest).
#
# HOW TO RUN (on the box):
#   ./backup.sh                       # full cycle + restore proof
#   ./backup.sh --no-restore-test     # backup cycle only (ad-hoc)
#   ./backup.sh --list                # what is actually in R2?
#   ./backup.sh --install-cron        # idempotent managed crontab block
#   ./backup.sh --fetch <object> <dest>   # download+decrypt+gunzip one object
#
# SECRETS: ${XDG_CONFIG_HOME:-$HOME/.config}/devtools-backup/backup.env (mode
# 600), deliberately OUTSIDE infra/keygen/ (deploy.sh rsyncs that dir with
# --delete). Never argv, never committed, never printed. See backup.env.example.
#
# MONITORING IS NOT OPTIONAL: this script REFUSES to run without both
# healthchecks.io ping URLs. Rationale, and every other "why does it do that",
# lives in infra/keygen/RUNBOOK.md -> "Step 10".
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./backup-lib.sh disable=SC1091
source "$SCRIPT_DIR/backup-lib.sh"

CRON_BEGIN="# >>> devtools keygen-ce offsite backup (managed by infra/keygen/backup.sh) >>>"
CRON_END="# <<< devtools keygen-ce offsite backup <<<"

usage() {
  cat >&2 <<'USAGE'
Usage: backup.sh [--no-restore-test]
       backup.sh --list | --install-cron | --fetch <object> <dest> | -h

Dumps the live Keygen CE postgres, encrypts it, uploads it (plus a manifest) to
Cloudflare R2, pings its healthchecks.io dead-man check, and then PROVES the
artifact restores by chaining restore-test.sh against what it just uploaded.

  (no args)           Run one backup cycle, then the chained restore validation.
  --no-restore-test   Backup cycle only (ad-hoc manual runs; cron never uses this).
  --install-cron      Idempotently (re)write the managed crontab block and exit.
  --list              List what is actually in R2 under the prefix (newest last).
  --fetch <object> <dest>
                      Download ONE object, decrypt it and gunzip it to <dest>
                      (use /dev/stdout to read a manifest). This is the
                      disaster-recovery download path — see RUNBOOK Step 10.
  -h, --help          Show this help.

The mode flags are mutually exclusive. Secrets are read from
~/.config/devtools-backup/backup.env (mode 600) and are never accepted as
arguments. Both HEALTHCHECK_* URLs are REQUIRED. Argument errors exit 2.
USAGE
}

# ---------------------------------------------------------------------------
# Arguments — validated BEFORE anything else, so a malformed invocation exits 2
# with usage instead of tripping `set -e` somewhere unlogged.
# ---------------------------------------------------------------------------
MODE="backup"
RUN_RESTORE_TEST=1
FETCH_OBJECT=""
FETCH_DEST=""

set_mode() { # NEW_MODE FLAG
  [[ "$MODE" == "backup" ]] || usage_error "$2 cannot be combined with --$MODE"
  MODE="$1"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-restore-test) RUN_RESTORE_TEST=0; shift ;;
    --install-cron)    set_mode install-cron "--install-cron"; shift ;;
    --list)            set_mode list "--list"; shift ;;
    --fetch)
      set_mode fetch "--fetch"
      [[ $# -ge 3 && -n "${2:-}" && -n "${3:-}" && "${2#-}" == "$2" && "${3#-}" == "$3" ]] \
        || usage_error "--fetch needs <object> and <dest>"
      FETCH_OBJECT="$2"; FETCH_DEST="$3"; shift 3 ;;
    -h|--help)         usage; exit 0 ;;
    *)                 usage_error "unknown argument: $1" ;;
  esac
done

if (( RUN_RESTORE_TEST == 0 )) && [[ "$MODE" != "backup" ]]; then
  usage_error "--no-restore-test only applies to a backup run, not --$MODE"
fi

# ---------------------------------------------------------------------------
# Config + secrets (fail closed; see backup-lib.sh)
# ---------------------------------------------------------------------------
load_backup_env

: "${HEALTHCHECK_PING_URL:?set it in $BACKUP_ENV — REQUIRED. A backup nobody is alerted about is not a backup}"
: "${HEALTHCHECK_RESTORE_PING_URL:?set it in $BACKUP_ENV — REQUIRED. restore-test.sh owns this second dead-man check}"

BACKUP_MIN_BYTES="${BACKUP_MIN_BYTES:-100000}"
BACKUP_RETENTION_BACKSTOP_DAYS="${BACKUP_RETENTION_BACKSTOP_DAYS:-40}"
COMPOSE_FILE="${COMPOSE_FILE:-$SCRIPT_DIR/compose.yaml}"
PG_DUMP_TIMEOUT="${PG_DUMP_TIMEOUT:-600}"
RESTORE_TEST_TIMEOUT="${RESTORE_TEST_TIMEOUT:-900}"

require_uint "$BACKUP_MIN_BYTES" BACKUP_MIN_BYTES 1
# Validated BEFORE any rclone call, because this number is a DELETE argument.
# The floor is 35, not 1: R2's lifecycle rule (the primary control) deletes at
# 30 days, so the script-side backstop must stay strictly wider or the two race
# and this script becomes capable of eating a backup R2 still considers current.
# A typo'd or empty value must never reach `rclone delete --min-age`.
require_uint "$BACKUP_RETENTION_BACKSTOP_DAYS" BACKUP_RETENTION_BACKSTOP_DAYS 35

LOG_FILE="$STATE_DIR/backup.log"
CRON_LOG="$STATE_DIR/cron.log"
LOCK_FILE="$STATE_DIR/backup.lock"

# ---------------------------------------------------------------------------
# Modes that are not the backup cycle
# ---------------------------------------------------------------------------
list_objects() {
  rclone_r2 lsl "r2:${BACKUP_BUCKET}/${BACKUP_PREFIX}" | sort -k2
}

# The disaster-recovery download path, as ONE command that cannot drift from the
# script that wrote the object (RUNBOOK Step 10 / "Restore the license box"
# both call this instead of re-spelling the rclone+gpg+gunzip pipeline).
fetch_object() { # OBJECT DEST
  local obj="$1" dest="$2" work
  work="$(mktemp -d "${TMPDIR:-/tmp}/devtools-fetch.XXXXXX")"
  # shellcheck disable=SC2064  # expand $work now, not at trap time
  trap "rm -rf '$work'" EXIT INT TERM

  rclone_r2 copyto "r2:${BACKUP_BUCKET}/${obj}" "$work/artifact.gpg" \
    || fatal "rclone download failed for $obj"
  # `rclone copyto` exits 0 when the SOURCE does not exist ("nothing to copy"),
  # so a missing object must be caught here or it resurfaces as a bogus
  # "decryption failed" two steps later.
  [[ -s "$work/artifact.gpg" ]] \
    || fatal "object not found (or empty) in R2: r2:${BACKUP_BUCKET}/${obj} — this is a MISSING OBJECT, not a decryption problem. Check 'backup.sh --list'."

  # umask 077 (backup-lib) means <dest> is created 0600 — it is PLAINTEXT and
  # holds the Ed25519 private key.
  gpg_decrypt "$work/artifact.gpg" | gunzip > "$dest" \
    || fatal "decrypt/gunzip failed for $obj — wrong passphrase, or the artifact is corrupt"
  echo "fetched r2:${BACKUP_BUCKET}/${obj} -> $dest" >&2
}

install_cron() {
  local tmp err existing rc=0
  tmp="$(mktemp "${TMPDIR:-/tmp}/devtools-crontab.XXXXXX")"
  err="$(mktemp "${TMPDIR:-/tmp}/devtools-crontab-err.XXXXXX")"

  # "no crontab for <user>" means START a crontab. ANY other failure (permission
  # denied, /var/spool unreadable, cron not installed) must NOT be treated as an
  # empty crontab — that would silently replace whatever is really there.
  existing="$(crontab -l 2>"$err")" || rc=$?
  if (( rc != 0 )); then
    if grep -qi 'no crontab for' "$err"; then
      existing=""
    else
      local detail
      detail="$(head -n 1 "$err")"
      rm -f "$tmp" "$err"
      fatal "crontab -l failed (exit $rc): ${detail:-no error output} — refusing to replace a crontab I could not read"
    fi
  fi

  # Strip any previous managed block by its markers; keep every OTHER line
  # exactly as it was (unmanaged entries must survive a reinstall).
  if [[ -n "$existing" ]]; then
    printf '%s\n' "$existing" | awk -v b="$CRON_BEGIN" -v e="$CRON_END" '
      index($0, b) == 1 { skip = 1; next }
      index($0, e) == 1 { skip = 0; next }
      skip != 1 { print }
    ' > "$tmp"
  else
    : > "$tmp"
  fi

  # Output is APPENDED to cron.log, never sent to /dev/null: when a dead-man
  # check goes red, that log is the only thing that explains why.
  local cron_line="17 3 * * * $SCRIPT_DIR/backup.sh >> $CRON_LOG 2>&1"
  printf '%s\n%s\n%s\n' "$CRON_BEGIN" "$cron_line" "$CRON_END" >> "$tmp"
  crontab "$tmp" || { rm -f "$tmp" "$err"; fatal "crontab install failed"; }
  rm -f "$tmp" "$err"
  echo "installed managed cron entry:" >&2
  echo "  $cron_line" >&2
}

# ---------------------------------------------------------------------------
# Backup cycle
# ---------------------------------------------------------------------------
WORK=""
UPLOAD_OK=0
RESTORE_RESULT="skipped"
OBJECT=""
BYTES=0
SHA=""

on_exit() {
  local rc=$?
  set +e
  trap - EXIT
  [[ -n "$WORK" && -d "$WORK" ]] && rm -rf "$WORK"

  local status="fail"
  (( UPLOAD_OK == 1 )) && status="ok"

  # ping_on=fail: the success ping already happened mid-run, the moment the
  # upload verified, so a downstream restore failure cannot mis-report the
  # backup itself as broken. restore-test.sh owns the other check.
  emit_exit_log "$rc" "$status" "$LOG_FILE" "$HEALTHCHECK_PING_URL" fail \
    "$(printf 'bytes=%s sha256=%s object=%s restore=%s reason="%s"' \
       "$BYTES" "${SHA:--}" "${OBJECT:--}" "$RESTORE_RESULT" "${FAIL_REASON:-}")"
  truncate_log "$CRON_LOG"
  exit "$rc"
}

# Read-only SELECT against the LIVE database. The SQL is passed as $0 to an
# inner sh so the container's own POSTGRES_USER/POSTGRES_DB expand there and no
# credential is interpolated on this side.
live_sql() { # SQL
  # shellcheck disable=SC2016  # $POSTGRES_* must expand INSIDE the container
  docker compose -f "$COMPOSE_FILE" exec -T postgres \
    sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tA -F"|" -c "$0"' "$1" 9>&-
}

# Row counts read out of the DUMP ITSELF — the same read that produced the
# artifact, so a license created between the dump and the drill can never show
# up as a false MISMATCH (that coupling is exactly why restore-test.sh no longer
# talks to the live database at all).
dump_row_counts() { # DUMP_FILE -> "accounts=1 licenses=3 ..."
  awk '
    BEGIN { n = split("accounts licenses machines policies products users", t, " ")
            for (i = 1; i <= n; i++) want[t[i]] = 1 }
    cur == "" && /^COPY public\.[a-z_]+ / {
      tbl = $2; sub(/^public\./, "", tbl)
      if (tbl in want) { cur = tbl; c[cur] = 0 }
      next
    }
    cur != "" { if ($0 == "\\.") cur = ""; else c[cur]++ }
    END {
      out = ""
      for (i = 1; i <= n; i++)
        out = out (i == 1 ? "" : " ") t[i] "=" (t[i] in c ? c[t[i]] : "MISSING")
      print out
    }
  ' "$1"
}

run_backup() {
  # Only the backup cycle talks to the live stack. --list / --fetch /
  # --install-cron must keep working on a box where the stack is not up yet —
  # `--fetch` in particular is the disaster-recovery download path.
  [[ -f "$COMPOSE_FILE" ]] || fatal "compose file not found: $COMPOSE_FILE"

  # Non-blocking lock: an overlapping manual+cron run exits cleanly instead of
  # racing for the work dir, the container or the cron slot. Children get `9>&-`
  # (backup-lib) so a wedged child can never inherit and hold this lock.
  exec 9>"$LOCK_FILE"
  if ! flock -n 9; then
    printf 'ts=%s status=skip reason=locked\n' "$(now)" | tee -a "$LOG_FILE" >&2
    truncate_log "$LOG_FILE"
    exit 0
  fi

  trap on_exit EXIT
  trap 'FAIL_REASON="unexpected failure at line $LINENO"' ERR
  trap 'exit 130' INT
  trap 'exit 143' TERM

  hc_ping "$HEALTHCHECK_PING_URL" /start || true

  sweep_stale_workdirs
  # A private mktemp dir + umask 077 + the EXIT trap: the PLAINTEXT dump (which
  # contains the Ed25519 private key) never lands on a predictable path, is
  # never group/world readable, and never survives the run.
  WORK="$(mktemp -d "${TMPDIR:-/tmp}/devtools-backup.XXXXXX")"

  local ts manifest_object
  ts="$(date -u +%Y%m%dT%H%M%SZ)"
  OBJECT="${BACKUP_PREFIX}/keygen-${ts}.sql.gz.gpg"
  manifest_object="${OBJECT%.sql.gz.gpg}.manifest.json.gz.gpg"

  # READ-ONLY against live: pg_dump only, no writes, no restarts, no compose
  # up/down. --no-owner --no-acl makes the artifact restorable into ANY fresh
  # postgres. The timeout bounds a wedged docker/pg_dump under cron (-k: TERM,
  # then KILL 30s later; only the CHILD is signalled, so this script's own EXIT
  # trap still logs and pings).
  # shellcheck disable=SC2016  # $POSTGRES_* must expand INSIDE the container
  timeout -k 30 "$PG_DUMP_TIMEOUT" \
    docker compose -f "$COMPOSE_FILE" exec -T postgres \
      sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-acl' \
      > "$WORK/dump.sql" 9>&- \
    || fatal "pg_dump failed or timed out (${PG_DUMP_TIMEOUT}s) against the live stack"

  # Sanity-gate the PLAINTEXT before it becomes an opaque blob. A silently empty
  # dump uploaded nightly is the classic backup failure.
  local dump_bytes
  dump_bytes="$(stat -c %s "$WORK/dump.sql")"
  (( dump_bytes >= BACKUP_MIN_BYTES )) \
    || fatal "dump is only ${dump_bytes} bytes (< ${BACKUP_MIN_BYTES}) — refusing to upload"
  grep -qF 'CREATE TABLE public.accounts' "$WORK/dump.sql" \
    || fatal "dump has no 'CREATE TABLE public.accounts' — schema missing, refusing to upload"
  grep -qF 'COPY public.accounts' "$WORK/dump.sql" \
    || fatal "dump has no 'COPY public.accounts' data section — refusing to upload"

  local plain_sha plain_bytes counts identity account_id pubkey priv_md5 pk_md5 sk_md5
  plain_bytes="$dump_bytes"
  plain_sha="$(sha256sum "$WORK/dump.sql" | cut -d' ' -f1)"
  counts="$(dump_row_counts "$WORK/dump.sql")"
  [[ "$counts" != *MISSING* ]] || fatal "dump is missing a COPY block for one of the core tables: $counts"

  # The account identity, read live in the same run. These columns are IMMUTABLE
  # (the Ed25519 keypair is minted once by setup.sh and never rotates), so
  # reading them a second apart from the dump cannot drift — unlike row counts,
  # which is why those come from the dump above.
  identity="$(live_sql "$ACCOUNT_IDENTITY_SQL")" || fatal "live identity SELECT failed"
  IFS='|' read -r account_id pubkey priv_md5 pk_md5 sk_md5 <<<"$identity"
  [[ -n "$account_id" && -n "$pubkey" ]] || fatal "live identity SELECT returned no account"

  gzip -9 -c "$WORK/dump.sql" | gpg_encrypt_stdin "$WORK/backup.gpg" \
    || fatal "gzip|gpg symmetric encryption failed"

  # Round-trip locally BEFORE the artifact becomes the only offsite copy: prove
  # it decrypts with the passphrase this box actually holds and that the gzip
  # stream inside is intact.
  gpg_decrypt "$WORK/backup.gpg" | gunzip -t \
    || fatal "local decrypt/gunzip round-trip failed — refusing to upload an unreadable artifact"

  BYTES="$(stat -c %s "$WORK/backup.gpg")"
  SHA="$(sha256sum "$WORK/backup.gpg" | cut -d' ' -f1)"

  # The MANIFEST: what this artifact is, captured at dump time. restore-test.sh
  # compares the RESTORED database against this — never against live — so the
  # drill needs no live-DB access and cannot false-alarm on writes that happened
  # after the dump. Encrypted like the artifact (it fingerprints private
  # material), and gzipped so `--fetch` reads it with the same one-liner.
  jq -n \
    --arg schema 1 --arg created_at "$(now)" --arg object "$OBJECT" \
    --arg artifact_sha256 "$SHA" --arg artifact_bytes "$BYTES" \
    --arg plaintext_sha256 "$plain_sha" --arg plaintext_bytes "$plain_bytes" \
    --arg account_id "$account_id" --arg ed25519_public_key_b64 "$pubkey" \
    --arg ed25519_private_key_md5 "$priv_md5" --arg private_key_md5 "$pk_md5" \
    --arg secret_key_md5 "$sk_md5" --arg row_counts "$counts" \
    '$ARGS.named' > "$WORK/manifest.json" \
    || fatal "could not build the manifest"
  gzip -9 -c "$WORK/manifest.json" | gpg_encrypt_stdin "$WORK/manifest.gpg" \
    || fatal "manifest encryption failed"

  upload_and_verify "$WORK/backup.gpg" "$OBJECT"
  upload_and_verify "$WORK/manifest.gpg" "$manifest_object"

  prune_old_objects "$OBJECT"

  # The backup genuinely succeeded here. Ping it green NOW so a downstream
  # restore failure cannot mis-report the backup as broken.
  UPLOAD_OK=1
  hc_ping "$HEALTHCHECK_PING_URL" || true
  echo "uploaded r2:${BACKUP_BUCKET}/${OBJECT} (${BYTES} bytes, sha256 ${SHA})" >&2
  echo "         + manifest ${manifest_object} (${counts})" >&2

  if (( RUN_RESTORE_TEST == 1 )); then
    # Chained proof — the primary corruption detector. restore-test.sh pings its
    # OWN dead-man check and never calls back into this script.
    if timeout -k 30 "$RESTORE_TEST_TIMEOUT" "$SCRIPT_DIR/restore-test.sh" --object "$OBJECT" 9>&-; then
      RESTORE_RESULT="pass"
    else
      RESTORE_RESULT="fail"
      FAIL_REASON="chained restore validation FAILED for $OBJECT"
      echo "FATAL: $FAIL_REASON" >&2
      exit 1
    fi
  fi
}

# Upload-without-verify is not done: confirm the object is listable remotely and
# that its size matches byte for byte.
upload_and_verify() { # LOCAL_FILE OBJECT
  local file="$1" obj="$2" local_bytes remote_bytes
  local_bytes="$(stat -c %s "$file")"
  rclone_r2 copyto "$file" "r2:${BACKUP_BUCKET}/${obj}" \
    || fatal "rclone upload failed for $obj"
  remote_bytes="$(rclone_r2 lsjson "r2:${BACKUP_BUCKET}/${obj}" | jq -r '.[0].Size // empty')" \
    || fatal "could not list the uploaded object $obj in R2"
  [[ -n "$remote_bytes" ]] || fatal "uploaded object $obj is not listable in R2"
  [[ "$remote_bytes" == "$local_bytes" ]] \
    || fatal "remote size $remote_bytes != local size $local_bytes for $obj"
}

# Retention BACKSTOP only (R2's 30-day lifecycle rule is primary and keeps
# working when this box is dead). Refuses to delete anything unless the object
# just uploaded is visible in the very listing the prune will act on — that is
# what proves the prefix is the live one and not a typo where every object is
# old enough to delete.
prune_old_objects() { # JUST_UPLOADED_OBJECT
  local fresh listing
  fresh="${1##*/}"
  listing="$(rclone_r2 lsf "r2:${BACKUP_BUCKET}/${BACKUP_PREFIX}")" \
    || fatal "could not list r2:${BACKUP_BUCKET}/${BACKUP_PREFIX} — refusing to prune"
  grep -qxF -- "$fresh" <<<"$listing" \
    || fatal "the object just uploaded ($fresh) is not in the listing for prefix ${BACKUP_PREFIX} — refusing to prune"
  rclone_r2 delete --min-age "${BACKUP_RETENTION_BACKSTOP_DAYS}d" \
    "r2:${BACKUP_BUCKET}/${BACKUP_PREFIX}" \
    || fatal "retention backstop prune failed"
}

case "$MODE" in
  list)         list_objects ;;
  install-cron) install_cron ;;
  fetch)        fetch_object "$FETCH_OBJECT" "$FETCH_DEST" ;;
  backup)       run_backup ;;
esac
