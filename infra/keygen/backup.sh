#!/usr/bin/env bash
# Nightly encrypted OFFSITE backup of the Keygen CE production database
# (quick/260807-ohd — closes the Phase-20 D-49 deferred follow-up).
#
# WHY: the account's Ed25519 signing keypair and every license/machine record
# live ONLY in the postgres volume on one Hetzner CX23. Losing it ends
# activation/refresh/deactivation for every buyer and their cached certs decay
# to Free within <=37 days. Provider snapshots are the floor, not a backup: they
# die with the provider account. This pipeline puts an encrypted copy with a
# DIFFERENT vendor (Cloudflare R2), proves it restores, and shouts when it does
# not.
#
# WHAT IT DOES (one run):
#   pg_dump (read-only, live DB never mutated) -> sanity-gate the plaintext ->
#   gzip -> gpg --symmetric AES-256 -> local decrypt round-trip -> rclone copyto
#   R2 -> verify the remote size -> retention backstop -> healthcheck ping ->
#   chained restore-test.sh (downloads what it just uploaded and PROVES it
#   restores into a throwaway postgres).
#
# HOW TO RUN (on the box, as the `claude` user):
#   ~/devtools/infra/keygen/backup.sh                 # full cycle + restore proof
#   ~/devtools/infra/keygen/backup.sh --no-restore-test
#   ~/devtools/infra/keygen/backup.sh --list          # what is actually in R2?
#   ~/devtools/infra/keygen/backup.sh --install-cron  # idempotent managed crontab block
#
# SECRETS: read from ${XDG_CONFIG_HOME:-$HOME/.config}/devtools-backup/backup.env
# (chmod 600) — deliberately OUTSIDE infra/keygen/ because deploy.sh rsyncs that
# directory with --delete and would wipe anything new in it. NEVER accepted on
# the command line, never committed, never printed. See backup.env.example.
#
# MONITORING IS NOT OPTIONAL: this script REFUSES to run without both
# healthchecks.io ping URLs. An on-box log cannot report "cron stopped firing",
# "the box is dead" or "the disk is full" — only an external dead-man check with
# a grace period can. Log-only is a failed setup, not a reduced-scope one.
set -Eeuo pipefail

# Cron gives a near-empty environment; pin PATH so docker/rclone/gpg resolve.
PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export PATH

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

CRON_BEGIN="# >>> devtools keygen-ce offsite backup (managed by infra/keygen/backup.sh) >>>"
CRON_END="# <<< devtools keygen-ce offsite backup <<<"

usage() {
  cat >&2 <<'USAGE'
Usage: backup.sh [--no-restore-test] [--install-cron] [--list] [-h|--help]

Dumps the live Keygen CE postgres, encrypts it, uploads it to Cloudflare R2,
pings its healthchecks.io dead-man check, and then PROVES the artifact restores
by chaining restore-test.sh against the object it just uploaded.

  (no args)           Run one backup cycle, then the chained restore validation.
  --no-restore-test   Backup cycle only (ad-hoc manual runs; cron never uses this).
  --install-cron      Idempotently (re)write the managed crontab block and exit.
  --list              List what is actually in R2 under the prefix (newest last).
  -h, --help          Show this help.

Secrets are read from ~/.config/devtools-backup/backup.env (mode 600) and are
never accepted as arguments. Both HEALTHCHECK_* URLs are REQUIRED — the script
refuses to run without them.
USAGE
}

fatal() {
  FAIL_REASON="$*"
  echo "FATAL: $*" >&2
  exit 1
}

now() { date -u +%Y-%m-%dT%H:%M:%SZ; }

MODE="backup"
RUN_RESTORE_TEST=1
FAIL_REASON=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-restore-test) RUN_RESTORE_TEST=0; shift ;;
    --install-cron)    MODE="install-cron"; shift ;;
    --list)            MODE="list"; shift ;;
    -h|--help)         usage; exit 0 ;;
    *) echo "FATAL: unknown argument: $1" >&2; usage; exit 1 ;;
  esac
done

# ---------------------------------------------------------------------------
# Config + secrets. Fail CLOSED: a missing or world-readable secret file is a
# hard stop, never a degraded run.
# ---------------------------------------------------------------------------
BACKUP_ENV="${BACKUP_ENV:-${XDG_CONFIG_HOME:-$HOME/.config}/devtools-backup/backup.env}"

require_mode_600() { # FILE LABEL
  local file="$1" label="$2" mode
  [[ -f "$file" ]] || fatal "$label not found: $file (copy infra/keygen/backup.env.example and fill it in ON THE BOX)"
  mode="$(stat -c %a "$file")"
  [[ "$mode" == "600" ]] || fatal "$label must be mode 600, found $mode: $file"
}

require_mode_600 "$BACKUP_ENV" "backup.env"

set -a
# shellcheck source=/dev/null
source "$BACKUP_ENV"
set +a

: "${RCLONE_CONFIG_R2_ACCESS_KEY_ID:?set it in $BACKUP_ENV (R2 API token, Object Read & Write, one bucket)}"
: "${RCLONE_CONFIG_R2_SECRET_ACCESS_KEY:?set it in $BACKUP_ENV (shown once at token creation)}"
: "${RCLONE_CONFIG_R2_ENDPOINT:?set it in $BACKUP_ENV (https://<account-id>.r2.cloudflarestorage.com)}"
: "${BACKUP_BUCKET:?set it in $BACKUP_ENV (the R2 bucket name)}"
: "${BACKUP_GPG_PASSPHRASE_FILE:?set it in $BACKUP_ENV (path to the mode-600 passphrase file)}"
: "${HEALTHCHECK_PING_URL:?set it in $BACKUP_ENV — REQUIRED. A backup nobody is alerted about is not a backup}"
: "${HEALTHCHECK_RESTORE_PING_URL:?set it in $BACKUP_ENV — REQUIRED. restore-test.sh owns this second dead-man check}"

BACKUP_PREFIX="${BACKUP_PREFIX:-keygen-ce}"
BACKUP_RETENTION_BACKSTOP_DAYS="${BACKUP_RETENTION_BACKSTOP_DAYS:-40}"
BACKUP_MIN_BYTES="${BACKUP_MIN_BYTES:-100000}"
COMPOSE_FILE="${COMPOSE_FILE:-$SCRIPT_DIR/compose.yaml}"
RESTORE_TEST_TIMEOUT="${RESTORE_TEST_TIMEOUT:-900}"

require_mode_600 "$BACKUP_GPG_PASSPHRASE_FILE" "gpg passphrase file"
[[ -f "$COMPOSE_FILE" ]] || fatal "compose file not found: $COMPOSE_FILE"

# The rclone remote is defined ENTIRELY by environment variables, so no
# rclone.conf (and therefore no second copy of the credentials) ever exists on
# disk. Defaults are assign-if-unset so backup.env can override them.
: "${RCLONE_CONFIG_R2_TYPE:=s3}"
: "${RCLONE_CONFIG_R2_PROVIDER:=Cloudflare}"
: "${RCLONE_CONFIG_R2_REGION:=auto}"
: "${RCLONE_CONFIG_R2_NO_CHECK_BUCKET:=true}"
: "${RCLONE_CONFIG_R2_ACL:=private}"
export RCLONE_CONFIG_R2_TYPE RCLONE_CONFIG_R2_PROVIDER RCLONE_CONFIG_R2_REGION
export RCLONE_CONFIG_R2_NO_CHECK_BUCKET RCLONE_CONFIG_R2_ACL

STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/devtools-backup"
mkdir -p "$STATE_DIR"
LOG_FILE="$STATE_DIR/backup.log"
CRON_LOG="$STATE_DIR/cron.log"
LOCK_FILE="$STATE_DIR/backup.lock"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Keep a log bounded WITHOUT replacing the inode: cron holds an append-mode fd
# on cron.log for the whole run, so a mv-based rotation would silently send the
# rest of this run's output to an unlinked file.
truncate_log() { # FILE
  local file="$1" tmp
  [[ -f "$file" ]] || return 0
  tmp="$(mktemp "${file}.XXXXXX")"
  if tail -n 2000 "$file" > "$tmp"; then
    cat "$tmp" > "$file"
  fi
  rm -f "$tmp"
}

# Ping the BACKUP dead-man check. The URL is a bearer capability, so curl's
# stderr is discarded rather than risking it in a log. A failed ping is recorded
# as ping=err and never changes the run's real exit status.
PING_NOTE="ok"
ping_hc() { # SUFFIX [BODY]
  local suffix="${1:-}" body="${2:-}" url
  url="${HEALTHCHECK_PING_URL}${suffix}"
  if [[ -n "$body" ]]; then
    curl -fsS -m 10 -o /dev/null --data-raw "$body" "$url" 2>/dev/null || return 1
  else
    curl -fsS -m 10 -o /dev/null "$url" 2>/dev/null || return 1
  fi
}

# All R2 access goes through here. RCLONE_CONFIG=/dev/null guarantees the remote
# is built ONLY from the RCLONE_CONFIG_R2_* env vars (a stray rclone.conf can
# never shadow them) and silences rclone's missing-config NOTICE. The outer
# timeout matters under cron: an unbounded rclone hang would hold the flock, so
# every later run would exit "locked" and the dead-man check would be the only
# thing that ever noticed.
rclone_r2() {
  RCLONE_CONFIG=/dev/null timeout "${RCLONE_TIMEOUT:-600}" \
    rclone --contimeout 30s --timeout 5m --retries 3 "$@"
}

# ---------------------------------------------------------------------------
# Modes that are not the backup cycle
# ---------------------------------------------------------------------------
list_objects() {
  rclone_r2 lsl "r2:${BACKUP_BUCKET}/${BACKUP_PREFIX}" | sort -k2
}

install_cron() {
  local tmp cron_line
  tmp="$(mktemp "${TMPDIR:-/tmp}/devtools-crontab.XXXXXX")"
  # Strip any previous managed block (by markers), keep everything else.
  { crontab -l 2>/dev/null || true; } | awk -v b="$CRON_BEGIN" -v e="$CRON_END" '
    index($0, b) == 1 { skip = 1; next }
    index($0, e) == 1 { skip = 0; next }
    skip != 1 { print }
  ' > "$tmp"
  # Output is APPENDED to cron.log, never sent to /dev/null: when a dead-man
  # check goes red, that log is the only thing that explains why.
  cron_line="17 3 * * * $SCRIPT_DIR/backup.sh >> $CRON_LOG 2>&1"
  printf '%s\n%s\n%s\n' "$CRON_BEGIN" "$cron_line" "$CRON_END" >> "$tmp"
  crontab "$tmp"
  rm -f "$tmp"
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

  local line
  line="$(printf 'ts=%s status=%s bytes=%s sha256=%s object=%s restore=%s ping=%s exit=%s reason=%s' \
    "$(now)" "$status" "$BYTES" "${SHA:--}" "${OBJECT:--}" "$RESTORE_RESULT" "$PING_NOTE" "$rc" \
    "\"${FAIL_REASON:-}\"")"
  printf '%s\n' "$line" >> "$LOG_FILE"

  if [[ "$status" == "fail" ]]; then
    # The backup itself failed -> the backup check must go red. A restore-only
    # failure is deliberately NOT reported here: restore-test.sh owns its own
    # check, and "backup ok + restore fail" is a distinct, actionable state.
    ping_hc /fail "$(tail -n 10 "$LOG_FILE" 2>/dev/null)" || PING_NOTE="err"
  fi

  printf '%s\n' "$line" >&2
  truncate_log "$LOG_FILE"
  truncate_log "$CRON_LOG"
  exit "$rc"
}

run_backup() {
  # Non-blocking lock: an overlapping manual+cron run exits cleanly instead of
  # racing for the work dir, the container, or the cron slot.
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

  ping_hc /start || PING_NOTE="err"

  # umask 077 + a private mktemp dir + the EXIT trap: the PLAINTEXT dump (which
  # contains the Ed25519 private key) never lands on a predictable path, is
  # never group/world readable, and never survives the run.
  umask 077
  WORK="$(mktemp -d "${TMPDIR:-/tmp}/devtools-backup.XXXXXX")"

  local ts
  ts="$(date -u +%Y%m%dT%H%M%SZ)"
  OBJECT="${BACKUP_PREFIX}/keygen-${ts}.sql.gz.gpg"

  # READ-ONLY against the live database: pg_dump only. No psql writes, no
  # restarts, no compose up/down. --no-owner --no-acl makes the artifact
  # restorable into ANY fresh postgres (the throwaway test box, or a rebuilt
  # production box).
  docker compose -f "$COMPOSE_FILE" exec -T postgres \
    sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-acl' \
    > "$WORK/dump.sql" || fatal "pg_dump failed against the live stack"

  # Sanity-gate the PLAINTEXT before it becomes an opaque blob. A silently
  # empty dump uploaded nightly is the classic backup failure.
  local dump_bytes
  dump_bytes="$(stat -c %s "$WORK/dump.sql")"
  (( dump_bytes >= BACKUP_MIN_BYTES )) \
    || fatal "dump is only ${dump_bytes} bytes (< ${BACKUP_MIN_BYTES}) — refusing to upload"
  grep -qF 'CREATE TABLE public.accounts' "$WORK/dump.sql" \
    || fatal "dump has no 'CREATE TABLE public.accounts' — schema missing, refusing to upload"
  grep -qF 'COPY public.accounts' "$WORK/dump.sql" \
    || fatal "dump has no 'COPY public.accounts' data section — refusing to upload"

  gzip -9 -c "$WORK/dump.sql" > "$WORK/dump.sql.gz"

  # Symmetric AES-256 with a modern, batch-safe S2K profile. The passphrase is
  # read from a mode-600 file — never argv (world-visible in /proc), never env.
  gpg --batch --yes --no-tty --pinentry-mode loopback \
      --passphrase-file "$BACKUP_GPG_PASSPHRASE_FILE" \
      --symmetric --cipher-algo AES256 \
      --s2k-mode 3 --s2k-digest-algo SHA512 --s2k-count 65011712 \
      -o "$WORK/backup.gpg" "$WORK/dump.sql.gz" \
    || fatal "gpg symmetric encryption failed"

  # Round-trip locally BEFORE the artifact becomes the only offsite copy: prove
  # it decrypts with the passphrase this box actually holds and that the gzip
  # stream inside is intact.
  gpg --batch --yes --no-tty --pinentry-mode loopback \
      --passphrase-file "$BACKUP_GPG_PASSPHRASE_FILE" \
      --decrypt "$WORK/backup.gpg" 2>/dev/null | gunzip -t \
    || fatal "local decrypt/gunzip round-trip failed — refusing to upload an unreadable artifact"

  BYTES="$(stat -c %s "$WORK/backup.gpg")"
  SHA="$(sha256sum "$WORK/backup.gpg" | cut -d' ' -f1)"

  rclone_r2 copyto "$WORK/backup.gpg" "r2:${BACKUP_BUCKET}/${OBJECT}" \
    || fatal "rclone upload failed for $OBJECT"

  # Upload-without-verify is not done: confirm the object exists remotely and
  # that its size matches byte for byte.
  local remote_bytes
  remote_bytes="$(rclone_r2 lsjson "r2:${BACKUP_BUCKET}/${OBJECT}" 2>/dev/null | jq -r '.[0].Size // empty')"
  [[ -n "$remote_bytes" ]] || fatal "uploaded object $OBJECT is not listable in R2"
  [[ "$remote_bytes" == "$BYTES" ]] \
    || fatal "remote size $remote_bytes != local size $BYTES for $OBJECT"

  # Retention BACKSTOP only. The R2 lifecycle rule (30 days) is primary; this is
  # deliberately wider so the two never race.
  rclone_r2 delete --min-age "${BACKUP_RETENTION_BACKSTOP_DAYS}d" \
    "r2:${BACKUP_BUCKET}/${BACKUP_PREFIX}" \
    || fatal "retention backstop prune failed"

  # The backup genuinely succeeded here. Ping it green NOW so a downstream
  # restore failure cannot mis-report the backup as broken.
  UPLOAD_OK=1
  ping_hc || PING_NOTE="err"
  echo "uploaded r2:${BACKUP_BUCKET}/${OBJECT} (${BYTES} bytes, sha256 ${SHA})" >&2

  if (( RUN_RESTORE_TEST == 1 )); then
    # Chained proof — the primary corruption detector. restore-test.sh pings its
    # OWN dead-man check; it never calls back into backup.sh (no recursion).
    # timeout so a wedged docker step cannot hold the lock or the cron slot.
    if timeout "$RESTORE_TEST_TIMEOUT" "$SCRIPT_DIR/restore-test.sh" --object "$OBJECT"; then
      RESTORE_RESULT="pass"
    else
      RESTORE_RESULT="fail"
      FAIL_REASON="chained restore validation FAILED for $OBJECT"
      echo "FATAL: $FAIL_REASON" >&2
      exit 1
    fi
  fi
}

case "$MODE" in
  list)         list_objects ;;
  install-cron) install_cron ;;
  backup)       run_backup ;;
  *)            fatal "unhandled mode: $MODE" ;;
esac
