#!/usr/bin/env bash
# Idempotent admin seat-release helper (D-81). Frees a license's seat so a buyer
# who lost their old device can reactivate — the repeatable side of the D-80
# "reply to your license email and we'll free the seat" support fallback.
#
# Resolve a license by its KEY or by the Lemon Squeezy ORDER ID, list its
# machines, and DELETE each one (deleting a machine frees the seat under the
# node-locked maxMachines=1 policy). Idempotent: a license with zero machines
# succeeds with an "already free" message; it never errors on a no-op.
#
# Run ON THE BOX over SSH (the privileged admin token stays server-side, D-55):
#   ssh tinkerdev-box 'bash -s' -- --key DC1093-... < infra/keygen/release-seat.sh
# or copy it to the box and run it there. NEVER pass the token from the client.
#
# TLS: production uses REAL ACME (Pitfall 3) — curl uses the OS trust store,
# NEVER -k and NEVER a custom CA.
#
# Credentials come from the gitignored infra/keygen/.env (KEYGEN_HOST, plus
# EITHER KEYGEN_ADMIN_TOKEN, OR KEYGEN_ADMIN_EMAIL + KEYGEN_ADMIN_PASSWORD to
# mint one — same as setup.sh). The token is read from the server-side env;
# it is NEVER hardcoded and NEVER accepted as a command-line argument (D-55).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat >&2 <<'USAGE'
Usage: release-seat.sh (--key <license-key> | --order-id <ls-order-id>) [-h|--help]

Frees the seat for a license by deleting all of its activated machines.

  --key       <license-key>    Resolve the license by its key (validate-key).
  --order-id  <ls-order-id>    Resolve the license by its stamped metadata.orderId.
  -h, --help                   Show this help.

The admin token is read from the server-side env (KEYGEN_ADMIN_TOKEN, or minted
from KEYGEN_ADMIN_EMAIL + KEYGEN_ADMIN_PASSWORD). Run this ON THE BOX over SSH;
never pass a token on the command line (D-55).
USAGE
}

KEY=""
ORDER_ID=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --key)      KEY="${2:-}"; shift 2 ;;
    --order-id) ORDER_ID="${2:-}"; shift 2 ;;
    -h|--help)  usage; exit 0 ;;
    *) echo "FATAL: unknown argument: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ -n "$KEY" && -n "$ORDER_ID" ]]; then
  echo "FATAL: pass exactly one of --key or --order-id, not both" >&2
  usage; exit 1
fi
if [[ -z "$KEY" && -z "$ORDER_ID" ]]; then
  echo "FATAL: one of --key or --order-id is required" >&2
  usage; exit 1
fi

# shellcheck source=/dev/null
set -a; source "$SCRIPT_DIR/.env"; set +a

: "${KEYGEN_HOST:?KEYGEN_HOST must be set in infra/keygen/.env}"

# Keygen CE runs in SINGLEPLAYER mode: the API is mounted at /v1/... with NO
# /accounts/{id} segment (mirrors setup.sh / keygen_client.rs).
BASE="https://$KEYGEN_HOST/v1"

ADMIN_TOKEN=""

# Resolve the privileged admin token from the server-side env (D-55): prefer an
# explicit KEYGEN_ADMIN_TOKEN; otherwise mint one from the admin credentials
# (the same POST /v1/tokens path setup.sh uses). NEVER hardcoded, never from argv.
resolve_admin_token() {
  if [[ -n "${KEYGEN_ADMIN_TOKEN:-}" ]]; then
    ADMIN_TOKEN="$KEYGEN_ADMIN_TOKEN"
    return
  fi
  : "${KEYGEN_ADMIN_EMAIL:?set KEYGEN_ADMIN_TOKEN or KEYGEN_ADMIN_EMAIL+PASSWORD in .env}"
  : "${KEYGEN_ADMIN_PASSWORD:?set KEYGEN_ADMIN_TOKEN or KEYGEN_ADMIN_EMAIL+PASSWORD in .env}"
  local resp status
  resp="$(curl -s -X POST -w $'\n%{http_code}' \
    -u "$KEYGEN_ADMIN_EMAIL:$KEYGEN_ADMIN_PASSWORD" \
    -H "Accept: application/vnd.api+json" \
    "$BASE/tokens")"
  status="${resp##*$'\n'}"
  resp="${resp%$'\n'*}"
  (( status < 400 )) || { echo "FATAL: admin token request -> HTTP $status" >&2; exit 1; }
  ADMIN_TOKEN="$(jq -er '.data.attributes.token' <<<"$resp")"
}

# api METHOD PATH [JSON_BODY] — admin-token-authed call over real ACME TLS
# (OS trust store, no -k). Prints body; fails on >=400.
api() {
  local method="$1" path="$2" body="${3:-}"
  local args=(-s -X "$method" -w $'\n%{http_code}' \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/vnd.api+json" -H "Accept: application/vnd.api+json")
  [[ -n "$body" ]] && args+=(-d "$body")
  local resp status
  resp="$(curl "${args[@]}" "$BASE$path")"
  status="${resp##*$'\n'}"
  resp="${resp%$'\n'*}"
  if (( status >= 400 )); then
    echo "FATAL: $method $path -> HTTP $status" >&2
    echo "$resp" >&2
    exit 1
  fi
  printf '%s' "$resp"
}

# Resolve a license id by its key via validate-key (UNAUTHENTICATED endpoint —
# the key in the body is the credential; mirrors keygen_client::validate_key).
resolve_license_by_key() { # KEY -> license id (or empty)
  local key="$1" body resp status id
  body="$(jq -n --arg k "$key" '{ meta: { key: $k } }')"
  resp="$(curl -s -X POST -w $'\n%{http_code}' \
    -H "Content-Type: application/vnd.api+json" -H "Accept: application/vnd.api+json" \
    -d "$body" "$BASE/licenses/actions/validate-key")"
  status="${resp##*$'\n'}"
  resp="${resp%$'\n'*}"
  (( status < 400 )) || { echo "FATAL: validate-key -> HTTP $status" >&2; echo "$resp" >&2; exit 1; }
  id="$(jq -r '.data.id // empty' <<<"$resp")"
  printf '%s' "$id"
}

# Resolve a license id by metadata.orderId, mirroring the webhook's
# searchByOrderId filter: never blind-trust data[0], match the exact orderId.
resolve_license_by_order_id() { # ORDER_ID -> license id (or empty)
  local order_id="$1" enc resp id
  # URL-encode the bracket so the filter is sent literally (as setup.sh does).
  enc="$(jq -rn --arg o "$order_id" '$o|@uri')"
  resp="$(api GET "/licenses?metadata%5BorderId%5D=$enc")"
  id="$(jq -r --arg o "$order_id" \
    '.data[]? | select(.attributes.metadata.orderId == $o) | .id' <<<"$resp" | head -n1)"
  printf '%s' "$id"
}

main() {
  resolve_admin_token

  local license_id
  if [[ -n "$KEY" ]]; then
    license_id="$(resolve_license_by_key "$KEY")"
  else
    license_id="$(resolve_license_by_order_id "$ORDER_ID")"
  fi

  if [[ -z "$license_id" ]]; then
    echo "FATAL: could not resolve a license (check the key / order id)" >&2
    exit 1
  fi
  echo "resolved license: $license_id" >&2

  # List the license's machines, then delete each one (frees the seat).
  local machines count
  machines="$(api GET "/licenses/$license_id/machines")"
  count="$(jq -r '.data | length' <<<"$machines")"
  echo "machines before: $count" >&2

  if [[ "$count" == "0" ]]; then
    echo "seat already free for license $license_id (no machines) — nothing to do" >&2
    echo "machines after: 0" >&2
    exit 0
  fi

  local mid
  while read -r mid; do
    [[ -z "$mid" ]] && continue
    api DELETE "/machines/$mid" >/dev/null
    echo "deleted machine: $mid" >&2
  done < <(jq -r '.data[].id' <<<"$machines")

  # Confirm the seat is now free.
  local after after_count
  after="$(api GET "/licenses/$license_id/machines")"
  after_count="$(jq -r '.data | length' <<<"$after")"
  echo "machines after: $after_count" >&2

  if [[ "$after_count" != "0" ]]; then
    echo "FATAL: $after_count machine(s) remain after release for $license_id" >&2
    exit 1
  fi
  echo "seat released for license $license_id" >&2
}

main "$@"
