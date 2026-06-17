#!/usr/bin/env bash
# Idempotent admin license-suspend helper (refund / chargeback revocation).
#
# Suspending a license revokes Pro: the buyer's app drops to the free tier on its
# next successful online refresh (≤ ~37 days worst-case offline = 30-day cert TTL
# + 7-day grace; immediate when the user hits Refresh). This is the REVOCATION
# action — distinct from release-seat.sh, which only frees a *seat* for a device
# transfer and keeps Pro intact.
#
# Resolve a license by its KEY or by the Lemon Squeezy ORDER ID, then suspend it
# (or reinstate it with --reinstate). Idempotent: a license already in the target
# state is a no-op success.
#
# Run ON THE BOX over SSH (the privileged admin token stays server-side, D-55):
#   ssh tinkerdev-box 'bash /home/claude/devtools/infra/keygen/suspend-license.sh --order-id 12345'
#   ssh tinkerdev-box 'bash /home/claude/devtools/infra/keygen/suspend-license.sh --reinstate --key AAAA-...-V3'
# NEVER pass the admin token from the client.
#
# TLS: production uses REAL ACME (Pitfall 3) — curl uses the OS trust store,
# NEVER -k and NEVER a custom CA.
#
# Credentials come from the gitignored infra/keygen/.env (KEYGEN_HOST, plus
# EITHER KEYGEN_ADMIN_TOKEN, OR KEYGEN_ADMIN_EMAIL + KEYGEN_ADMIN_PASSWORD to
# mint one — same as setup.sh / release-seat.sh). The token is read from the
# server-side env; it is NEVER hardcoded and NEVER accepted as a CLI argument.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat >&2 <<'USAGE'
Usage: suspend-license.sh (--key K | --order-id ID | --order-number N) [--reinstate]
       suspend-license.sh --email <buyer-email>          # list a buyer's licenses (no change)
       suspend-license.sh [-h|--help]

Suspends a license (revokes Pro) — or reinstates it with --reinstate.

  --key          <license-key>  Resolve the license by its key (validate-key).
  --order-id     <ls-order-id>  Resolve by metadata.orderId (LS order *id*, data.id).
  --order-number <ls-order-#>   Resolve by metadata.orderNumber (the LS dashboard "#").
  --email        <buyer-email>  LIST all of a buyer's licenses (id, order#, date,
                                status) so you can pick the right one — no mutation.
  --reinstate                   Reinstate (un-suspend) instead of suspend.
  -h, --help                    Show this help.

The admin token is read from the server-side env (KEYGEN_ADMIN_TOKEN, or minted
from KEYGEN_ADMIN_EMAIL + KEYGEN_ADMIN_PASSWORD). Run this ON THE BOX over SSH;
never pass a token on the command line (D-55).
USAGE
}

KEY=""
ORDER_ID=""
ORDER_NUMBER=""
EMAIL=""
REINSTATE=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --key)          KEY="${2:-}"; shift 2 ;;
    --order-id)     ORDER_ID="${2:-}"; shift 2 ;;
    --order-number) ORDER_NUMBER="${2:-}"; shift 2 ;;
    --email)        EMAIL="${2:-}"; shift 2 ;;
    --reinstate)    REINSTATE=1; shift ;;
    -h|--help)      usage; exit 0 ;;
    *) echo "FATAL: unknown argument: $1" >&2; usage; exit 1 ;;
  esac
done

# Exactly one selector. --email is a read-only lookup; the other three act.
selectors=0
[[ -n "$KEY" ]] && ((selectors++)) || true
[[ -n "$ORDER_ID" ]] && ((selectors++)) || true
[[ -n "$ORDER_NUMBER" ]] && ((selectors++)) || true
[[ -n "$EMAIL" ]] && ((selectors++)) || true
if (( selectors != 1 )); then
  echo "FATAL: pass exactly one of --key / --order-id / --order-number / --email" >&2
  usage; exit 1
fi

# shellcheck source=/dev/null
set -a; source "$SCRIPT_DIR/.env"; set +a

: "${KEYGEN_HOST:?KEYGEN_HOST must be set in infra/keygen/.env}"

# Keygen CE runs in SINGLEPLAYER mode: the API is mounted at /v1/... with NO
# /accounts/{id} segment (mirrors setup.sh / release-seat.sh / keygen_client.rs).
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

# Resolve a license id by metadata.orderNumber (the LS dashboard "#"). Same
# never-blind-trust-data[0] discipline. Only future licenses carry orderNumber.
resolve_license_by_order_number() { # ORDER_NUMBER -> license id (or empty)
  local order_number="$1" enc resp id
  enc="$(jq -rn --arg o "$order_number" '$o|@uri')"
  resp="$(api GET "/licenses?metadata%5BorderNumber%5D=$enc")"
  id="$(jq -r --arg o "$order_number" \
    '.data[]? | select(.attributes.metadata.orderNumber == $o) | .id' <<<"$resp" | head -n1)"
  printf '%s' "$id"
}

# --email lookup: list every license whose metadata.email matches, so an operator
# with a repeat buyer can pick the exact order to act on. Read-only (no mutation).
list_licenses_by_email() { # EMAIL -> prints a table, exits
  local email_arg="$1" enc resp
  enc="$(jq -rn --arg e "$email_arg" '$e|@uri')"
  resp="$(api GET "/licenses?metadata%5Bemail%5D=$enc")"
  echo "licenses for $email_arg (suspend one with --order-number / --order-id / --key):" >&2
  jq -r --arg e "$email_arg" \
    '.data[]? | select(.attributes.metadata.email == $e)
     | "  license=\(.id)  order#=\(.attributes.metadata.orderNumber // "—")  orderId=\(.attributes.metadata.orderId // "—")  created=\(.attributes.created[0:10])  status=\(.attributes.status)"' \
    <<<"$resp" >&2
}

main() {
  resolve_admin_token

  # --email is a read-only disambiguation lookup, not an action.
  if [[ -n "$EMAIL" ]]; then
    list_licenses_by_email "$EMAIL"
    exit 0
  fi

  local license_id
  if [[ -n "$KEY" ]]; then
    license_id="$(resolve_license_by_key "$KEY")"
  elif [[ -n "$ORDER_ID" ]]; then
    license_id="$(resolve_license_by_order_id "$ORDER_ID")"
  else
    license_id="$(resolve_license_by_order_number "$ORDER_NUMBER")"
  fi

  if [[ -z "$license_id" ]]; then
    echo "FATAL: could not resolve a license (check the key / order id / order number)" >&2
    exit 1
  fi

  # Show who/what this is, redacted (buyer email + masked key tail only — T-21-18).
  local lic email key_tail suspended
  lic="$(api GET "/licenses/$license_id")"
  email="$(jq -r '.data.attributes.metadata.email // "—"' <<<"$lic")"
  key_tail="$(jq -r '.data.attributes.key // "" | if length > 6 then "…" + .[-6:] else "…" end' <<<"$lic")"
  suspended="$(jq -r '.data.attributes.suspended // false' <<<"$lic")"
  echo "resolved license: $license_id (email: $email, key: $key_tail)" >&2
  echo "suspended before: $suspended" >&2

  local want_suspended action past
  if (( REINSTATE )); then
    want_suspended="false"; action="reinstate"; past="reinstated"
  else
    want_suspended="true"; action="suspend"; past="suspended"
  fi

  if [[ "$suspended" == "$want_suspended" ]]; then
    echo "already $past (suspended=$suspended) for license $license_id — nothing to do" >&2
    exit 0
  fi

  api POST "/licenses/$license_id/actions/$action" >/dev/null

  # Confirm the new state.
  local after after_suspended
  after="$(api GET "/licenses/$license_id")"
  after_suspended="$(jq -r '.data.attributes.suspended // false' <<<"$after")"
  echo "suspended after: $after_suspended" >&2

  if [[ "$after_suspended" != "$want_suspended" ]]; then
    echo "FATAL: license $license_id did not reach suspended=$want_suspended after $action" >&2
    exit 1
  fi
  echo "license $license_id $past" >&2
}

main "$@"
