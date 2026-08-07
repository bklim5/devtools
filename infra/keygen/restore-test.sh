#!/usr/bin/env bash
# PROVE the offsite Keygen CE backup actually restores (quick/260807-ohd).
#
# WHY: a backup that has never been restored is not a backup. This script is the
# proof, and it runs AUTOMATICALLY after every successful upload (chained from
# backup.sh) as well as on demand as the monthly human drill. That is what keeps
# the detection latency for a corrupt/undecryptable artifact at ~1 day instead of
# ~1 month.
#
# WHAT IT PROVES: the newest (or a named) R2 object downloads, decrypts with the
# passphrase this box holds, restores into a THROWAWAY postgres:17.5 container,
# and reproduces the exact identity every already-shipped app has compiled in:
#   account id      0d607683-026f-468b-9cf0-f5bfaf61a7a1  (KEYGEN_ACCOUNT_ID)
#   ed25519 pubkey  huJdyRsBtd7KrPqWv5Z/8GVeLmiqfWTfQnEb090+jO4=  (KEYGEN_ED25519_PUBKEY_B64)
# ...plus a matching Ed25519 PRIVATE-key md5 and matching row counts vs live.
# If a restore does not reproduce those, it is worthless — this is THE assertion.
#
# HOW TO RUN (on the box, as the `claude` user):
#   ~/devtools/infra/keygen/restore-test.sh                       # newest object
#   ~/devtools/infra/keygen/restore-test.sh --object keygen-ce/keygen-<ts>.sql.gz.gpg
#   ~/devtools/infra/keygen/restore-test.sh --keep                # leave the container up
#
# HARD SAFETY RAIL: the dump is taken with `pg_dump --clean`, so it begins with
# DROP statements. It must NEVER be piped at the live database. This script
# therefore accepts NO target-database argument at all — it builds its own
# throwaway container (fixed `keygen-restore-test-$$` name, random password, no
# published ports, no network, no volume) and refuses any other target. Its only
# contact with production is READ-ONLY SELECTs used for the comparison.
#
# It NEVER invokes backup.sh (backup.sh chains this script; the reverse would
# recurse).
#
# SECRETS: same mode-600 ~/.config/devtools-backup/backup.env as backup.sh (the
# env loader is duplicated on purpose so each script stays independently
# runnable). HEALTHCHECK_RESTORE_PING_URL is REQUIRED — this script owns the
# second dead-man check, and an unmonitored proof proves nothing.
set -Eeuo pipefail

# Cron gives a near-empty environment; pin PATH so docker/rclone/gpg resolve.
PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export PATH

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# The identity every shipped app has compiled in (src-tauri/src/license/config.rs).
EXPECT_ACCOUNT_ID="0d607683-026f-468b-9cf0-f5bfaf61a7a1"
EXPECT_ED25519_PUBKEY="huJdyRsBtd7KrPqWv5Z/8GVeLmiqfWTfQnEb090+jO4="

RESTORE_IMAGE="postgres:17.5"
LIVE_PG_CONTAINER="keygen-postgres-1"

usage() {
  cat >&2 <<'USAGE'
Usage: restore-test.sh [--object <remote-name>] [--keep] [--no-ping] [-h|--help]

Downloads a backup object from R2, decrypts it, restores it into a THROWAWAY
postgres container, and asserts the restored account id / ed25519 public key /
ed25519 private-key md5 / row counts match both the compiled release constants
and the LIVE database. Pings its own healthchecks.io dead-man check.

  --object <name>   Remote object under the bucket (default: newest under the prefix).
  --keep            Do not tear down the throwaway container (inspection only).
  --no-ping         Skip the dead-man pings (local experimentation ONLY; cron and
                    the chained run from backup.sh never pass this).
  -h, --help        Show this help.

It NEVER accepts a target database — it always builds its own throwaway one.
USAGE
}

fatal() {
  FAIL_REASON="$*"
  echo "FATAL: $*" >&2
  exit 1
}

now() { date -u +%Y-%m-%dT%H:%M:%SZ; }

OBJECT=""
KEEP=0
PING_ENABLED=1
FAIL_REASON=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --object)  OBJECT="${2:-}"; shift 2 ;;
    --keep)    KEEP=1; shift ;;
    --no-ping) PING_ENABLED=0; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "FATAL: unknown argument: $1" >&2; usage; exit 1 ;;
  esac
done

# ---------------------------------------------------------------------------
# Config + secrets. Fail CLOSED, exactly like backup.sh.
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

: "${RCLONE_CONFIG_R2_ACCESS_KEY_ID:?set it in $BACKUP_ENV}"
: "${RCLONE_CONFIG_R2_SECRET_ACCESS_KEY:?set it in $BACKUP_ENV}"
: "${RCLONE_CONFIG_R2_ENDPOINT:?set it in $BACKUP_ENV}"
: "${BACKUP_BUCKET:?set it in $BACKUP_ENV}"
: "${BACKUP_GPG_PASSPHRASE_FILE:?set it in $BACKUP_ENV}"
: "${HEALTHCHECK_RESTORE_PING_URL:?set it in $BACKUP_ENV — REQUIRED. This script owns the keygen-ce-restore-test dead-man check}"

BACKUP_PREFIX="${BACKUP_PREFIX:-keygen-ce}"
COMPOSE_FILE="${COMPOSE_FILE:-$SCRIPT_DIR/compose.yaml}"
PG_READY_TIMEOUT="${PG_READY_TIMEOUT:-60}"

require_mode_600 "$BACKUP_GPG_PASSPHRASE_FILE" "gpg passphrase file"
[[ -f "$COMPOSE_FILE" ]] || fatal "compose file not found: $COMPOSE_FILE"

: "${RCLONE_CONFIG_R2_TYPE:=s3}"
: "${RCLONE_CONFIG_R2_PROVIDER:=Cloudflare}"
: "${RCLONE_CONFIG_R2_REGION:=auto}"
: "${RCLONE_CONFIG_R2_NO_CHECK_BUCKET:=true}"
: "${RCLONE_CONFIG_R2_ACL:=private}"
export RCLONE_CONFIG_R2_TYPE RCLONE_CONFIG_R2_PROVIDER RCLONE_CONFIG_R2_REGION
export RCLONE_CONFIG_R2_NO_CHECK_BUCKET RCLONE_CONFIG_R2_ACL

STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/devtools-backup"
mkdir -p "$STATE_DIR"
LOG_FILE="$STATE_DIR/restore-test.log"

CNAME="keygen-restore-test-$$"
WORK=""
PASSED=0
PING_NOTE="ok"
FAILED_CHECKS=""
COUNTS_RESTORED=""

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
truncate_log() { # FILE — bounded WITHOUT replacing the inode (see backup.sh).
  local file="$1" tmp
  [[ -f "$file" ]] || return 0
  tmp="$(mktemp "${file}.XXXXXX")"
  if tail -n 2000 "$file" > "$tmp"; then
    cat "$tmp" > "$file"
  fi
  rm -f "$tmp"
}

# Ping the RESTORE-TEST dead-man check (a different check from backup.sh's, on
# purpose: "the backup did not run" and "the backup no longer restores" are
# different alarms). The URL is a bearer capability, so curl's stderr is
# discarded rather than risking it in a log.
ping_hc() { # SUFFIX [BODY]
  local suffix="${1:-}" body="${2:-}" url
  (( PING_ENABLED == 1 )) || return 0
  url="${HEALTHCHECK_RESTORE_PING_URL}${suffix}"
  if [[ -n "$body" ]]; then
    curl -fsS -m 10 -o /dev/null --data-raw "$body" "$url" 2>/dev/null || return 1
  else
    curl -fsS -m 10 -o /dev/null "$url" 2>/dev/null || return 1
  fi
}

# All R2 access goes through here. RCLONE_CONFIG=/dev/null guarantees the remote
# is built ONLY from the RCLONE_CONFIG_R2_* env vars (a stray rclone.conf can
# never shadow them) and silences rclone's missing-config NOTICE. The outer
# timeout keeps a hung transfer from eating the whole chained-run budget.
rclone_r2() {
  RCLONE_CONFIG=/dev/null timeout "${RCLONE_TIMEOUT:-600}" \
    rclone --contimeout 30s --timeout 5m --retries 3 "$@"
}

on_exit() {
  local rc=$?
  set +e
  trap - EXIT

  if (( KEEP == 1 )); then
    echo "--keep: leaving container $CNAME and work dir $WORK in place." >&2
    echo "        WARNING: $WORK holds the PLAINTEXT dump (Ed25519 private key)." >&2
    echo "        It is mode 700, but remove it by hand when you are done." >&2
  else
    docker rm -f "$CNAME" >/dev/null 2>&1
    [[ -n "$WORK" && -d "$WORK" ]] && rm -rf "$WORK"
  fi

  local status="fail" account="MATCH"
  (( PASSED == 1 )) && status="pass"
  [[ "$FAILED_CHECKS" != *"account id"* ]] || account="MISMATCH"

  local line
  line="$(printf 'ts=%s status=%s object=%s account=%s counts=%s failed=%s exit=%s reason=%s' \
    "$(now)" "$status" "${OBJECT:--}" "$account" \
    "\"${COUNTS_RESTORED:--}\"" "\"${FAILED_CHECKS:-none}\"" "$rc" "\"${FAIL_REASON:-}\"")"
  printf '%s\n' "$line" >> "$LOG_FILE"

  if [[ "$status" == "pass" ]]; then
    ping_hc || PING_NOTE="err"
  else
    ping_hc /fail "$(tail -n 10 "$LOG_FILE" 2>/dev/null)" || PING_NOTE="err"
  fi

  printf '%s ping=%s\n' "$line" "$PING_NOTE" >&2
  truncate_log "$LOG_FILE"
  exit "$rc"
}

# Read-only SELECT against the LIVE database. The SQL is passed as $0 to an
# inner sh so the container's own POSTGRES_USER/POSTGRES_DB env expand there and
# no credential is ever interpolated on this side.
live_sql() { # SQL
  docker compose -f "$COMPOSE_FILE" exec -T postgres \
    sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "$0"' "$1"
}

# Query the THROWAWAY restored database. Never touches live.
restored_sql() { # SQL
  docker exec -i "$CNAME" psql -v ON_ERROR_STOP=1 -U postgres -d keygen -tAc "$1"
}

check() { # LABEL RESTORED LIVE EXPECTED SHOW
  local label="$1" got="$2" live="$3" expected="${4:-}" show="${5:-}"
  local state="MATCH"
  if [[ -z "$got" ]]; then
    state="EMPTY"
  elif [[ "$got" != "$live" ]]; then
    state="MISMATCH (restored != live)"
  elif [[ -n "$expected" && "$got" != "$expected" ]]; then
    state="MISMATCH (!= compiled release constant)"
  fi
  if [[ -n "$show" ]]; then
    printf '  %-24s %s (%s)\n' "$label:" "$state" "$show"
  else
    printf '  %-24s %s\n' "$label:" "$state"
  fi
  [[ "$state" == "MATCH" ]] || FAILED_CHECKS="${FAILED_CHECKS}${label}; "
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  trap on_exit EXIT
  trap 'FAIL_REASON="unexpected failure at line $LINENO"' ERR
  trap 'exit 130' INT
  trap 'exit 143' TERM

  ping_hc /start || PING_NOTE="err"

  # Refuse anything that is not our own throwaway container. Structurally
  # excludes the live compose postgres, belt-and-braces on top of the fact that
  # this script accepts no target-database argument at all.
  [[ "$CNAME" != "$LIVE_PG_CONTAINER" ]] \
    || fatal "refusing to touch the LIVE postgres container ($LIVE_PG_CONTAINER)"
  [[ "$CNAME" == keygen-restore-test-* ]] \
    || fatal "refusing: throwaway container name must match keygen-restore-test-* (got $CNAME)"
  if docker ps -a --format '{{.Names}}' | grep -qxF -- "$CNAME"; then
    fatal "refusing: a container named $CNAME already exists"
  fi

  umask 077
  WORK="$(mktemp -d "${TMPDIR:-/tmp}/devtools-restore-test.XXXXXX")"

  if [[ -z "$OBJECT" ]]; then
    local newest
    newest="$(rclone_r2 lsjson "r2:${BACKUP_BUCKET}/${BACKUP_PREFIX}" 2>/dev/null \
      | jq -r '.[] | select(.IsDir == false) | .Path' | sort | tail -n1)"
    [[ -n "$newest" ]] || fatal "no objects under r2:${BACKUP_BUCKET}/${BACKUP_PREFIX}"
    OBJECT="${BACKUP_PREFIX}/${newest}"
  fi
  echo "restore test target: r2:${BACKUP_BUCKET}/${OBJECT}" >&2

  rclone_r2 copyto "r2:${BACKUP_BUCKET}/${OBJECT}" "$WORK/backup.gpg" \
    || fatal "rclone download failed for $OBJECT"

  gpg --batch --yes --no-tty --pinentry-mode loopback \
      --passphrase-file "$BACKUP_GPG_PASSPHRASE_FILE" \
      --decrypt "$WORK/backup.gpg" > "$WORK/dump.sql.gz" 2>/dev/null \
    || fatal "gpg decrypt failed for $OBJECT — the artifact is NOT recoverable with this passphrase"
  gunzip -c "$WORK/dump.sql.gz" > "$WORK/dump.sql" \
    || fatal "gunzip failed for $OBJECT — the artifact is corrupt"

  # Throwaway target: no published ports, no network, no volume, random
  # password, auto-removed. --rm plus the EXIT trap means it cannot outlive us.
  docker run -d --rm --name "$CNAME" --network none \
    -e POSTGRES_PASSWORD="$(openssl rand -hex 16)" \
    "$RESTORE_IMAGE" >/dev/null \
    || fatal "could not start the throwaway $RESTORE_IMAGE container"

  local waited=0
  until docker exec "$CNAME" pg_isready -U postgres -q 2>/dev/null; do
    waited=$((waited + 1))
    (( waited < PG_READY_TIMEOUT )) \
      || fatal "throwaway postgres never became ready within ${PG_READY_TIMEOUT}s"
    sleep 1
  done

  docker exec -i "$CNAME" psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
    -c 'create database keygen' >/dev/null \
    || fatal "could not create the throwaway keygen database"

  # --if-exists makes the dump's leading DROPs benign; ON_ERROR_STOP still
  # aborts on a genuine error.
  if ! docker exec -i "$CNAME" psql -v ON_ERROR_STOP=1 -U postgres -d keygen \
        < "$WORK/dump.sql" > "$WORK/restore.log" 2>&1; then
    tail -n 20 "$WORK/restore.log" >&2
    fatal "psql restore of $OBJECT failed"
  fi

  # --- Assertions: restored vs LIVE vs the compiled release constants ---------
  local counts_sql
  counts_sql="select 'accounts='||(select count(*) from accounts)"
  counts_sql="$counts_sql||' licenses='||(select count(*) from licenses)"
  counts_sql="$counts_sql||' machines='||(select count(*) from machines)"
  counts_sql="$counts_sql||' policies='||(select count(*) from policies)"
  counts_sql="$counts_sql||' products='||(select count(*) from products)"
  counts_sql="$counts_sql||' users='||(select count(*) from users)"

  local r_id l_id r_pub l_pub r_priv l_priv r_pk l_pk r_sk l_sk l_counts
  r_id="$(restored_sql 'select id from accounts order by id')"
  l_id="$(live_sql 'select id from accounts order by id')"
  r_pub="$(restored_sql "select encode(decode(ed25519_public_key,'hex'),'base64') from accounts order by id")"
  l_pub="$(live_sql "select encode(decode(ed25519_public_key,'hex'),'base64') from accounts order by id")"
  # Private material is compared ONLY as an md5 — never printed, never logged.
  r_priv="$(restored_sql "select md5(coalesce(ed25519_private_key::text,'')) from accounts order by id")"
  l_priv="$(live_sql "select md5(coalesce(ed25519_private_key::text,'')) from accounts order by id")"
  r_pk="$(restored_sql "select md5(coalesce(private_key::text,'')) from accounts order by id")"
  l_pk="$(live_sql "select md5(coalesce(private_key::text,'')) from accounts order by id")"
  r_sk="$(restored_sql "select md5(coalesce(secret_key::text,'')) from accounts order by id")"
  l_sk="$(live_sql "select md5(coalesce(secret_key::text,'')) from accounts order by id")"
  COUNTS_RESTORED="$(restored_sql "$counts_sql")"
  l_counts="$(live_sql "$counts_sql")"

  echo "" >&2
  {
    echo "restored object:         r2:${BACKUP_BUCKET}/${OBJECT}"
    check "account id"           "$r_id"    "$l_id"    "$EXPECT_ACCOUNT_ID"     "$r_id"
    check "ed25519 pubkey"       "$r_pub"   "$l_pub"   "$EXPECT_ED25519_PUBKEY" "$r_pub"
    check "ed25519 privkey md5"  "$r_priv"  "$l_priv"  ""                       ""
    check "private_key md5"      "$r_pk"    "$l_pk"    ""                       ""
    check "secret_key md5"       "$r_sk"    "$l_sk"    ""                       ""
    check "row counts"           "$COUNTS_RESTORED" "$l_counts" ""              "$COUNTS_RESTORED"
  } >&2

  if [[ -n "$FAILED_CHECKS" ]]; then
    fatal "restore test FAILED: $FAILED_CHECKS"
  fi

  PASSED=1
  echo "restore test PASSED" >&2
}

main "$@"
