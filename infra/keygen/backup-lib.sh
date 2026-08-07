#!/usr/bin/env bash
# Shared machinery for backup.sh + restore-test.sh (quick/260807-ohd).
#
# Sourced, never executed. Both scripts already hard-depend on siblings in this
# directory (compose.yaml, and backup.sh chains restore-test.sh), so a sourced
# sibling costs nothing and removes the copy-paste divergence that let the two
# exit loggers drift apart.
#
# WHY each piece looks the way it does is documented ONCE, in
# infra/keygen/RUNBOOK.md -> "Step 10 -> Implementation notes". The comments here
# are one-line pointers on purpose; do not re-expand them.
#
# shellcheck shell=bash

[[ -n "${BACKUP_LIB_SOURCED:-}" ]] && return 0
BACKUP_LIB_SOURCED=1

# BUMP DISCIPLINE: change this string in the SAME commit as any cross-file change
# to backup.sh / restore-test.sh / backup-lib.sh, and update EXPECT_PIPELINE_VERSION
# in BOTH scripts. A partial rsync then fails loudly instead of running a mixed set.
BACKUP_PIPELINE_VERSION="2026-08-08.1"

# Cron gives a near-empty environment; pin PATH so docker/rclone/gpg resolve.
PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export PATH

# Everything these scripts create (work dirs, state dir, logs, manifests) holds
# or describes the Ed25519 signing key. 0600/0700, always, from the first line.
umask 077

# shellcheck disable=SC2034  # both are read by the scripts that source this file
FAIL_REASON=""
PING_NOTE="ok"

fatal() {
  # shellcheck disable=SC2034  # read by both scripts' exit loggers
  FAIL_REASON="$*"
  echo "FATAL: $*" >&2
  exit 1
}

# Usage/argument errors exit 2 and never reach the run log (nothing ran).
usage_error() { # MESSAGE
  echo "FATAL: $*" >&2
  usage
  exit 2
}

now() { date -u +%Y-%m-%dT%H:%M:%SZ; }

# A partial `rsync` can leave backup.sh, restore-test.sh and backup-lib.sh at
# different versions, silently sourcing each other. Each script asserts its own
# expected value at startup, BEFORE any work (RUNBOOK: "Implementation notes").
require_pipeline_version() { # EXPECTED CALLER
  [[ "${BACKUP_PIPELINE_VERSION:-<none>}" == "$1" ]] && return 0
  echo "FATAL: pipeline version mismatch — $2 expects '$1', backup-lib.sh is '${BACKUP_PIPELINE_VERSION:-<none>}'" >&2
  echo "       PARTIAL DEPLOY — re-rsync infra/keygen/ (backup.sh, restore-test.sh and backup-lib.sh together, as a set)." >&2
  exit 1
}

require_mode_600() { # FILE LABEL
  local file="$1" label="$2" mode
  [[ -f "$file" ]] || fatal "$label not found: $file (copy infra/keygen/backup.env.example and fill it in ON THE BOX)"
  mode="$(stat -c %a "$file")"
  [[ "$mode" == "600" ]] || fatal "$label must be mode 600, found $mode: $file"
}

# ---------------------------------------------------------------------------
# Config + secrets. Fail CLOSED: a missing or world-readable secret file is a
# hard stop, never a degraded run.
# ---------------------------------------------------------------------------
load_backup_env() {
  BACKUP_ENV="${BACKUP_ENV:-${XDG_CONFIG_HOME:-$HOME/.config}/devtools-backup/backup.env}"
  require_mode_600 "$BACKUP_ENV" "backup.env"

  # Sourced WITHOUT `set -a`: the R2 credentials must stay shell-local. They are
  # handed to rclone as a per-command assignment prefix (see rclone_r2), so the
  # gpg / docker / psql / curl children never inherit the secret in their env.
  # shellcheck source=/dev/null
  source "$BACKUP_ENV"

  : "${RCLONE_CONFIG_R2_ACCESS_KEY_ID:?set it in $BACKUP_ENV (R2 API token, Object Read & Write, one bucket)}"
  : "${RCLONE_CONFIG_R2_SECRET_ACCESS_KEY:?set it in $BACKUP_ENV (shown once at token creation)}"
  : "${RCLONE_CONFIG_R2_ENDPOINT:?set it in $BACKUP_ENV (https://<account-id>.r2.cloudflarestorage.com)}"
  : "${BACKUP_BUCKET:?set it in $BACKUP_ENV (the R2 bucket name)}"

  BACKUP_PREFIX="${BACKUP_PREFIX:-keygen-ce}"
  BACKUP_GPG_PASSPHRASE_FILE="${BACKUP_GPG_PASSPHRASE_FILE:-${XDG_CONFIG_HOME:-$HOME/.config}/devtools-backup/gpg.pass}"
  require_mode_600 "$BACKUP_GPG_PASSPHRASE_FILE" "gpg passphrase file"

  STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/devtools-backup"
  mkdir -p "$STATE_DIR"
  # cron creates cron.log under ITS umask (022), so re-assert 0600 every run
  # (also fixes state files created before this script set umask 077).
  local f
  for f in "$STATE_DIR"/*.log "$STATE_DIR"/backup.lock; do
    [[ -f "$f" ]] && chmod 600 "$f"
  done
  return 0
}

require_uint() { # VALUE NAME MIN
  local value="$1" name="$2" min="$3"
  [[ "$value" =~ ^[0-9]+$ ]] || fatal "$name must be a whole number of days, got: '$value'"
  (( value >= min )) || fatal "$name must be >= $min, got $value"
}

# ---------------------------------------------------------------------------
# R2 access. RUNBOOK "Implementation notes": RCLONE_CONFIG=/dev/null pins the
# remote to these env vars, no_head works around R2 having no object versioning,
# and the outer timeout stops a hung transfer from holding the flock all night.
# The assignments are a COMMAND PREFIX so the credentials never enter this
# shell's exported environment. `9>&-` closes the flock fd so a wedged rclone
# cannot inherit and hold the lock (RUNBOOK: "the flock fd is not inherited").
# The outer knob is BACKUP_RCLONE_TIMEOUT, NOT RCLONE_TIMEOUT: rclone maps every
# RCLONE_* environment variable onto a flag, so RCLONE_TIMEOUT=600 would be read
# as `--timeout 600` and rclone would abort with "missing unit in duration".
# ---------------------------------------------------------------------------
rclone_r2() {
  RCLONE_CONFIG=/dev/null \
  RCLONE_CONFIG_R2_TYPE=s3 \
  RCLONE_CONFIG_R2_PROVIDER=Cloudflare \
  RCLONE_CONFIG_R2_REGION=auto \
  RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true \
  RCLONE_CONFIG_R2_NO_HEAD=true \
  RCLONE_CONFIG_R2_ACCESS_KEY_ID="$RCLONE_CONFIG_R2_ACCESS_KEY_ID" \
  RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$RCLONE_CONFIG_R2_SECRET_ACCESS_KEY" \
  RCLONE_CONFIG_R2_ENDPOINT="$RCLONE_CONFIG_R2_ENDPOINT" \
    timeout -k 30 "${BACKUP_RCLONE_TIMEOUT:-600}" \
    rclone --contimeout 30s --timeout 5m --retries 3 "$@" 9>&-
}

# Decrypt an artifact produced by backup.sh to stdout, un-gzipped.
gpg_decrypt() { # FILE  (stdout = plaintext)
  gpg --batch --yes --no-tty --pinentry-mode loopback \
      --passphrase-file "$BACKUP_GPG_PASSPHRASE_FILE" \
      --decrypt "$1" 2>/dev/null 9>&-
}

# Encrypt stdin to FILE with a modern, batch-safe symmetric profile. The
# passphrase comes from a mode-600 file — never argv (world-visible in /proc),
# never the environment.
gpg_encrypt_stdin() { # OUTFILE
  gpg --batch --yes --no-tty --pinentry-mode loopback \
      --passphrase-file "$BACKUP_GPG_PASSPHRASE_FILE" \
      --symmetric --cipher-algo AES256 \
      --s2k-mode 3 --s2k-digest-algo SHA512 --s2k-count 65011712 \
      -o "$1" 9>&-
}

# ---------------------------------------------------------------------------
# The two queries that MUST be byte-identical on both sides of the proof:
# backup.sh runs them against live to build the manifest, restore-test.sh runs
# them against the restored throwaway. Any divergence would surface as a false
# MISMATCH at 3am, so they live here and nowhere else.
#
# Identity: one row, pipe-separated —
#   account_id | ed25519_public_key_b64 | ed25519_private_key_md5 | private_key_md5 | secret_key_md5
# Private material is only ever handled as an md5; the values are never selected
# into a variable, printed, or logged.
# ---------------------------------------------------------------------------
# shellcheck disable=SC2034  # consumed by the scripts that source this file
ACCOUNT_IDENTITY_SQL="select coalesce(string_agg(id::text, ',' order by id), ''), \
coalesce(string_agg(encode(decode(ed25519_public_key,'hex'),'base64'), ',' order by id), ''), \
coalesce(string_agg(md5(coalesce(ed25519_private_key::text,'')), ',' order by id), ''), \
coalesce(string_agg(md5(coalesce(private_key::text,'')), ',' order by id), ''), \
coalesce(string_agg(md5(coalesce(secret_key::text,'')), ',' order by id), '') from accounts"

# shellcheck disable=SC2034  # consumed by restore-test.sh
ROW_COUNTS_SQL="select 'accounts='||(select count(*) from accounts)\
||' licenses='||(select count(*) from licenses)\
||' machines='||(select count(*) from machines)\
||' policies='||(select count(*) from policies)\
||' products='||(select count(*) from products)\
||' users='||(select count(*) from users)"

# ---------------------------------------------------------------------------
# Logging + the dead-man pings
# ---------------------------------------------------------------------------

# Keep a log bounded WITHOUT replacing the inode (RUNBOOK: cron holds an
# append-mode fd on cron.log for the whole run).
truncate_log() { # FILE
  local file="$1" tmp
  [[ -f "$file" ]] || return 0
  tmp="$(mktemp "${file}.XXXXXX")"
  if tail -n 2000 "$file" > "$tmp"; then
    cat "$tmp" > "$file"
  fi
  rm -f "$tmp"
}

# A ping URL is a bearer capability, so curl's stderr is discarded rather than
# risking the URL in a log. A failed ping records ping=err and never changes the
# run's real exit status.
hc_ping() { # URL [SUFFIX] [BODY]
  local url="${1:-}" suffix="${2:-}" body="${3:-}" rc=0
  [[ -n "$url" ]] || return 0
  if [[ -n "$body" ]]; then
    curl -fsS -m 10 -o /dev/null --data-raw "$body" "${url}${suffix}" 2>/dev/null 9>&- || rc=1
  else
    curl -fsS -m 10 -o /dev/null "${url}${suffix}" 2>/dev/null 9>&- || rc=1
  fi
  (( rc == 0 )) || PING_NOTE="err"
  return "$rc"
}

# THE shared exit logger for both scripts. Pings FIRST and composes the log line
# AFTER, so `ping=` always reports this run's real ping outcome — a failed /fail
# ping is visible as ping=err in the log and on stderr, in BOTH scripts.
# PING_ON: fail (backup.sh — it pings success mid-run, at upload-verify time)
#          both (restore-test.sh — success is only known at the very end)
#          none
emit_exit_log() { # RC STATUS LOG_FILE PING_URL PING_ON FIELDS
  local rc="$1" status="$2" log="$3" url="$4" ping_on="$5" fields="$6"
  local body line

  if [[ "$status" == "fail" && ( "$ping_on" == "fail" || "$ping_on" == "both" ) ]]; then
    body="$( printf 'ts=%s status=%s %s exit=%s\n' "$(now)" "$status" "$fields" "$rc"
             tail -n 10 "$log" 2>/dev/null )"
    hc_ping "$url" /fail "$body" || true
  elif [[ "$status" != "fail" && "$ping_on" == "both" ]]; then
    hc_ping "$url" || true
  fi

  line="$(printf 'ts=%s status=%s %s exit=%s ping=%s' "$(now)" "$status" "$fields" "$rc" "$PING_NOTE")"
  printf '%s\n' "$line" >> "$log"
  printf '%s\n' "$line" >&2
  truncate_log "$log"
}

# The PLAINTEXT dump holds the Ed25519 private key and must never survive a run.
# A run that is SIGKILLed (the -k step of `timeout`, an OOM kill, `kill -9`)
# cannot run its own EXIT trap, so sweep any work dir an EARLIER run left behind.
# Age-gated far beyond the 900 s restore cap and restricted to this uid, so it
# can never touch a run in flight or anyone else's files.
sweep_stale_workdirs() {
  local base="${TMPDIR:-/tmp}" mins=$(( ${STALE_SWEEP_AGE:-3600} / 60 ))
  (( mins >= 1 )) || mins=1
  find "$base" -maxdepth 1 -type d -user "$(id -u)" -mmin "+$mins" \
    \( -name 'devtools-backup.*' -o -name 'devtools-restore-test.*' -o -name 'devtools-fetch.*' \) \
    -exec rm -rf {} + 2>/dev/null || true
}

# psql/pg_restore output can quote the row that failed — i.e. account rows, i.e.
# the Ed25519 private key. NEVER tail it raw. Print only the error lines, with
# the COPY row context stripped and each line clipped.
sanitize_pg_log() { # FILE
  local file="$1"
  [[ -f "$file" ]] || return 0
  grep -aE '^(psql:[^ ]*:[0-9]+: )?(ERROR|FATAL|PANIC):' "$file" 2>/dev/null \
    | grep -avE '^(CONTEXT|DETAIL|STATEMENT|HINT):' \
    | sed -e 's/[[:space:]]*CONTEXT:.*$//' -e 's/\(.\{200\}\).*/\1 .../' \
    | head -n 10
}
