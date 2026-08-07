#!/usr/bin/env bash
# PROVE the offsite Keygen CE backup actually restores (quick/260807-ohd).
#
# WHY: a backup that has never been restored is not a backup. This runs
# AUTOMATICALLY after every successful upload (chained from backup.sh) as well
# as on demand, which keeps the detection latency for a corrupt/undecryptable
# artifact at ~1 day instead of ~1 month.
#
# WHAT IT PROVES: the newest (or a named) R2 object downloads, decrypts with the
# passphrase this box holds, restores into a THROWAWAY postgres:17.5 container,
# and reproduces the identity every already-shipped app has compiled in:
#   account id      0d607683-026f-468b-9cf0-f5bfaf61a7a1  (KEYGEN_ACCOUNT_ID)
#   ed25519 pubkey  huJdyRsBtd7KrPqWv5Z/8GVeLmiqfWTfQnEb090+jO4=  (KEYGEN_ED25519_PUBKEY_B64)
# ...plus every value in the artifact's MANIFEST (row counts, private-key md5s,
# plaintext + ciphertext sha256) — see RUNBOOK Step 10.
#
# IT NEVER TOUCHES THE LIVE DATABASE. Comparisons are against the manifest that
# backup.sh wrote at dump time and against the compiled release constants, both
# time-invariant. A license created after the dump can therefore never raise a
# false alarm, and the drill still works when the live stack is down — which is
# precisely the situation you run a restore drill in.
#
# HOW TO RUN (on the box):
#   ./restore-test.sh                        # newest object
#   ./restore-test.sh --object keygen-ce/keygen-<ts>.sql.gz.gpg
#   ./restore-test.sh --keep                 # leave the container up
#
# HARD SAFETY RAIL: the dump is taken with `pg_dump --clean`, so it opens with
# DROP statements and must NEVER be piped at a live database. This script
# accepts NO target-database argument at all — it builds its own throwaway
# container and only ever removes a container it started itself.
#
# It NEVER invokes backup.sh (backup.sh chains this; the reverse would recurse).
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./backup-lib.sh disable=SC1091
source "$SCRIPT_DIR/backup-lib.sh"

# Asserted BEFORE argument parsing, config, R2 or docker: a half-rsynced
# infra/keygen/ must fail loudly, not run a mixed set of scripts. Bump in lockstep
# with BACKUP_PIPELINE_VERSION in backup-lib.sh.
EXPECT_PIPELINE_VERSION="2026-08-08.1"
require_pipeline_version "$EXPECT_PIPELINE_VERSION" "restore-test.sh"

# The identity every shipped app has compiled in (src-tauri/src/license/config.rs).
EXPECT_ACCOUNT_ID="0d607683-026f-468b-9cf0-f5bfaf61a7a1"
EXPECT_ED25519_PUBKEY="huJdyRsBtd7KrPqWv5Z/8GVeLmiqfWTfQnEb090+jO4="

RESTORE_IMAGE="postgres:17.5"
RESTORE_LABEL="devtools-restore-test=1"

usage() {
  cat >&2 <<'USAGE'
Usage: restore-test.sh [--object <remote-name>] [--keep] [--no-ping] [-h|--help]

Downloads a backup object + its manifest from R2, decrypts them, restores the
dump into a THROWAWAY postgres container, and asserts the restored account id /
ed25519 public key / private-key md5s / row counts match the manifest AND the
compiled release constants. Pings its own healthchecks.io dead-man check.

  --object <name>   Remote object under the bucket (default: newest under the prefix).
  --keep            Do not tear down the throwaway container (inspection only).
  --no-ping         Skip the dead-man pings (local experimentation ONLY; cron and
                    the chained run from backup.sh never pass it).
  -h, --help        Show this help.

It never accepts a target database and never reads the live database.
Argument errors exit 2.
USAGE
}

# ---------------------------------------------------------------------------
# Arguments — validated BEFORE anything else, so `--object` with no value exits
# 2 with usage instead of tripping `set -e` unlogged.
# ---------------------------------------------------------------------------
OBJECT=""
KEEP=0
PING_ENABLED=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --object)
      [[ $# -ge 2 && -n "${2:-}" && "${2#-}" == "$2" ]] \
        || usage_error "--object needs a remote object name"
      OBJECT="$2"; shift 2 ;;
    --keep)    KEEP=1; shift ;;
    --no-ping) PING_ENABLED=0; shift ;;
    -h|--help) usage; exit 0 ;;
    *)         usage_error "unknown argument: $1" ;;
  esac
done

# ---------------------------------------------------------------------------
# Config + secrets (fail closed; see backup-lib.sh)
# ---------------------------------------------------------------------------
load_backup_env
: "${HEALTHCHECK_RESTORE_PING_URL:?set it in $BACKUP_ENV — REQUIRED. This script owns the keygen-ce-restore-test dead-man check}"

PG_READY_TIMEOUT="${PG_READY_TIMEOUT:-60}"
STALE_SWEEP_AGE="${STALE_SWEEP_AGE:-3600}"
LOG_FILE="$STATE_DIR/restore-test.log"

PING_URL="$HEALTHCHECK_RESTORE_PING_URL"
if (( PING_ENABLED == 0 )); then
  PING_URL=""
  # shellcheck disable=SC2034  # PING_NOTE is defined in backup-lib.sh
  PING_NOTE="off"
fi

CNAME="keygen-restore-test-$$"
WORK=""
PASSED=0
CONTAINER_OWNED=0
FAILED_CHECKS=""
COUNTS_RESTORED=""
# 0 until the restored-vs-manifest comparison has actually run. Without this an
# early failure (missing object, failed decrypt) would still log account=MATCH,
# claiming a comparison that never happened.
ASSERTIONS_RAN=0

on_exit() {
  local rc=$?
  set +e
  trap - EXIT

  if (( KEEP == 1 )); then
    echo "--keep: leaving container $CNAME and work dir $WORK in place." >&2
    echo "        WARNING: $WORK holds the PLAINTEXT dump (Ed25519 private key)." >&2
    echo "        It is mode 700, but remove it by hand when you are done." >&2
  else
    # ONLY ever remove a container this run actually started (RUNBOOK: the
    # collision guard must not delete a container someone else is using).
    # -v is load-bearing: postgres:17.5 declares a VOLUME, so without it every
    # run orphans ~46 MB.
    (( CONTAINER_OWNED == 1 )) && docker rm -f -v "$CNAME" >/dev/null 2>&1
    [[ -n "$WORK" && -d "$WORK" ]] && rm -rf "$WORK"
  fi

  local status="fail" account="-"
  (( PASSED == 1 )) && status="pass"
  if (( ASSERTIONS_RAN == 1 )); then
    account="MATCH"
    [[ "$FAILED_CHECKS" != *"account id"* ]] || account="MISMATCH"
  fi

  emit_exit_log "$rc" "$status" "$LOG_FILE" "$PING_URL" both \
    "$(printf 'object=%s account=%s counts="%s" failed="%s" reason="%s"' \
       "${OBJECT:--}" "$account" "${COUNTS_RESTORED:--}" "${FAILED_CHECKS:-none}" "${FAIL_REASON:-}")"
  exit "$rc"
}

# Query the THROWAWAY restored database. Never touches live.
restored_sql() { # SQL
  docker exec -i "$CNAME" psql -v ON_ERROR_STOP=1 -U postgres -d keygen -tA -F'|' -c "$1"
}

check() { # LABEL GOT WANT [ABSOLUTE] [SHOW]
  local label="$1" got="$2" want="$3" absolute="${4:-}" show="${5:-}"
  local state="MATCH"
  if [[ -z "$got" ]]; then
    state="EMPTY"
  elif [[ "$got" != "$want" ]]; then
    state="MISMATCH (restored != manifest)"
  elif [[ -n "$absolute" && "$got" != "$absolute" ]]; then
    state="MISMATCH (!= compiled release constant)"
  fi
  if [[ -n "$show" ]]; then
    printf '  %-24s %s (%s)\n' "$label:" "$state" "$got"
  else
    printf '  %-24s %s\n' "$label:" "$state"
  fi
  [[ "$state" == "MATCH" ]] || FAILED_CHECKS="${FAILED_CHECKS}${label}; "
}

# A container SIGKILLed mid-run (the -k path of `timeout`) cannot run its own
# teardown, so sweep anything of ours left behind by a previous run. Only our
# label, only older than an hour: it can never touch the live stack or a
# concurrent drill.
sweep_stale_containers() {
  local id created age now_s
  now_s="$(date +%s)"
  while read -r id; do
    [[ -n "$id" ]] || continue
    created="$(docker inspect -f '{{.Created}}' "$id" 2>/dev/null)" || continue
    age=$(( now_s - $(date -d "$created" +%s 2>/dev/null || echo "$now_s") ))
    (( age > STALE_SWEEP_AGE )) || continue
    echo "sweeping stale throwaway container $id (age ${age}s, killed run)" >&2
    docker rm -f -v "$id" >/dev/null 2>&1 || true
  done < <(docker ps -a --filter "label=$RESTORE_LABEL" --format '{{.ID}}' 2>/dev/null)
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  trap on_exit EXIT
  trap 'FAIL_REASON="unexpected failure at line $LINENO"' ERR
  trap 'exit 130' INT
  trap 'exit 143' TERM

  hc_ping "$PING_URL" /start || true

  sweep_stale_containers
  sweep_stale_workdirs
  # Refuse to reuse an existing container. CONTAINER_OWNED is still 0 here, so
  # this path can never delete something we did not create.
  if docker ps -a --format '{{.Names}}' | grep -qxF -- "$CNAME"; then
    fatal "refusing: a container named $CNAME already exists (not started by this run)"
  fi

  WORK="$(mktemp -d "${TMPDIR:-/tmp}/devtools-restore-test.XXXXXX")"

  if [[ -z "$OBJECT" ]]; then
    local listing
    # Capture rclone's exit status on its OWN: inside a pipeline feeding a
    # command substitution, a `no such bucket`/auth failure would otherwise be
    # swallowed and mis-diagnosed as "no objects under prefix".
    listing="$(rclone_r2 lsjson "r2:${BACKUP_BUCKET}/${BACKUP_PREFIX}")" \
      || fatal "could not list r2:${BACKUP_BUCKET}/${BACKUP_PREFIX} (bucket, credentials or network) — this is NOT 'no backups exist'"
    local newest
    newest="$(jq -r '.[] | select(.IsDir == false) | .Path | select(endswith(".sql.gz.gpg"))' <<<"$listing" | sort | tail -n1)"
    [[ -n "$newest" ]] || fatal "no backup objects under r2:${BACKUP_BUCKET}/${BACKUP_PREFIX}"
    OBJECT="${BACKUP_PREFIX}/${newest}"
  fi
  [[ "$OBJECT" == *.sql.gz.gpg ]] \
    || fatal "not a backup artifact name (expected <...>.sql.gz.gpg): $OBJECT"
  local manifest_object="${OBJECT%.sql.gz.gpg}.manifest.json.gz.gpg"
  echo "restore test target: r2:${BACKUP_BUCKET}/${OBJECT}" >&2

  download "$OBJECT" "$WORK/backup.gpg" \
    "Check 'backup.sh --list'."
  download "$manifest_object" "$WORK/manifest.gpg" \
    "Every artifact written by backup.sh has one; an object without a manifest predates the manifest format and cannot be proven — take a fresh backup."

  local m_artifact_sha m_artifact_bytes m_plain_sha m_plain_bytes
  local m_account m_pubkey m_priv m_pk m_sk m_counts manifest_json fields
  manifest_json="$(gpg_decrypt "$WORK/manifest.gpg" | gunzip)" \
    || fatal "could not decrypt the manifest for $OBJECT"
  # Joined on '|' rather than @tsv: bash collapses runs of IFS whitespace, so a
  # tab-separated line with an empty field would silently shift every value
  # after it into the wrong variable.
  fields="$(jq -er '
      [.artifact_sha256, .artifact_bytes, .plaintext_sha256, .plaintext_bytes,
       .account_id, .ed25519_public_key_b64, .ed25519_private_key_md5,
       .private_key_md5, .secret_key_md5] | map(tostring) | join("|")' <<<"$manifest_json")" \
    || fatal "the manifest for $OBJECT is not readable JSON"
  IFS='|' read -r m_artifact_sha m_artifact_bytes m_plain_sha m_plain_bytes \
                  m_account m_pubkey m_priv m_pk m_sk <<<"$fields"
  m_counts="$(jq -er '.row_counts' <<<"$manifest_json")" \
    || fatal "the manifest for $OBJECT has no row_counts"
  [[ -n "$m_account" && "$m_account" != "null" ]] || fatal "the manifest for $OBJECT has no account_id"

  local artifact_sha artifact_bytes plain_sha plain_bytes
  artifact_sha="$(sha256sum "$WORK/backup.gpg" | cut -d' ' -f1)"
  artifact_bytes="$(stat -c %s "$WORK/backup.gpg")"

  gpg_decrypt "$WORK/backup.gpg" | gunzip > "$WORK/dump.sql" \
    || fatal "gpg decrypt/gunzip failed for $OBJECT — the artifact is NOT recoverable with this passphrase"
  plain_sha="$(sha256sum "$WORK/dump.sql" | cut -d' ' -f1)"
  plain_bytes="$(stat -c %s "$WORK/dump.sql")"

  # Throwaway target: no published ports, no network, no volume mount, random
  # password, labelled so a killed run can be swept later.
  docker run -d --rm --name "$CNAME" --network none --label "$RESTORE_LABEL" \
    -e POSTGRES_PASSWORD="$(openssl rand -hex 16)" \
    "$RESTORE_IMAGE" >/dev/null \
    || fatal "could not start the throwaway $RESTORE_IMAGE container"
  CONTAINER_OWNED=1

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
  # aborts on a genuine error. psql's output can quote the offending ROW, i.e.
  # the Ed25519 private key, so it is only ever surfaced through sanitize_pg_log.
  if ! docker exec -i "$CNAME" psql -v ON_ERROR_STOP=1 -U postgres -d keygen \
        < "$WORK/dump.sql" > "$WORK/restore.log" 2>&1; then
    sanitize_pg_log "$WORK/restore.log" >&2
    fatal "psql restore of $OBJECT failed"
  fi

  # --- Assertions: restored vs the MANIFEST vs the compiled release constants -
  local identity r_id r_pub r_priv r_pk r_sk
  identity="$(restored_sql "$ACCOUNT_IDENTITY_SQL")"
  IFS='|' read -r r_id r_pub r_priv r_pk r_sk <<<"$identity"
  COUNTS_RESTORED="$(restored_sql "$ROW_COUNTS_SQL")"

  ASSERTIONS_RAN=1

  echo "" >&2
  {
    echo "restored object:         r2:${BACKUP_BUCKET}/${OBJECT}"
    check "artifact sha256"      "$artifact_sha"    "$m_artifact_sha"
    check "artifact bytes"       "$artifact_bytes"  "$m_artifact_bytes"
    check "plaintext sha256"     "$plain_sha"       "$m_plain_sha"
    check "plaintext bytes"      "$plain_bytes"     "$m_plain_bytes"
    check "account id"           "$r_id"    "$m_account" "$EXPECT_ACCOUNT_ID"     1
    check "ed25519 pubkey"       "$r_pub"   "$m_pubkey"  "$EXPECT_ED25519_PUBKEY" 1
    check "ed25519 privkey md5"  "$r_priv"  "$m_priv"
    check "private_key md5"      "$r_pk"    "$m_pk"
    check "secret_key md5"       "$r_sk"    "$m_sk"
    check "row counts"           "$COUNTS_RESTORED" "$m_counts" "" 1
  } >&2

  [[ -z "$FAILED_CHECKS" ]] || fatal "restore test FAILED: $FAILED_CHECKS"

  PASSED=1
  echo "restore test PASSED" >&2
}

# Download one object, distinguishing "missing" from "undecryptable": `rclone
# copyto` exits 0 when the SOURCE does not exist ("nothing to copy"), so without
# the emptiness assertion a pruned or typo'd object resurfaces two steps later
# as an alarming (and wrong) "NOT recoverable with this passphrase".
download() { # OBJECT DEST HINT
  rclone_r2 copyto "r2:${BACKUP_BUCKET}/$1" "$2" || fatal "rclone download failed for $1"
  [[ -s "$2" ]] \
    || fatal "object not found (or empty) in R2: r2:${BACKUP_BUCKET}/$1 — this is a MISSING OBJECT, not a decryption problem. $3"
}

main
