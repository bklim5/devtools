#!/usr/bin/env bash
# Bootstrap the local Keygen CE instance (Phase 19, D-40):
#   admin token -> product "TinkerDev" -> policy "perpetual-node-locked"
#   (authenticationStrategy=LICENSE — Pitfall 1) -> license -> account pubkey.
#
# Idempotent: product/policy are looked up by name first and created only if
# absent, so `bootstrap.sh mint_license` mints additional licenses (e.g. for
# the Plan 04 walkthrough) without re-creating anything.
#
# Credentials come from the gitignored .env at runtime — nothing sensitive is
# hardcoded here (T-19-02). All TLS goes through the extracted Caddy root CA
# (T-19-03), never -k.
#
# Usage:
#   ./bootstrap.sh                # full bootstrap; prints license key + pubkey
#   ./bootstrap.sh mint_license   # mint one more license on the existing policy
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# shellcheck source=/dev/null
set -a; source "$SCRIPT_DIR/.env"; set +a

CACERT="$SCRIPT_DIR/caddy-root.crt"
BASE="https://$KEYGEN_HOST/v1/accounts/$KEYGEN_ACCOUNT_ID"
PRODUCT_NAME="TinkerDev"
POLICY_NAME="perpetual-node-locked"
PUBKEY_FIXTURE="$REPO_ROOT/src-tauri/fixtures/ce-ed25519-pubkey.b64"

[[ -f "$CACERT" ]] || { echo "FATAL: $CACERT missing — extract it per README.md" >&2; exit 1; }

ADMIN_TOKEN=""

# api METHOD PATH [JSON_BODY] — admin-token-authed call; prints body; fails on >=400.
api() {
  local method="$1" path="$2" body="${3:-}"
  local args=(-s --cacert "$CACERT" -X "$method" -w $'\n%{http_code}' \
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

get_admin_token() {
  local resp status
  resp="$(curl -s --cacert "$CACERT" -X POST -w $'\n%{http_code}' \
    -u "$KEYGEN_ADMIN_EMAIL:$KEYGEN_ADMIN_PASSWORD" \
    -H "Accept: application/vnd.api+json" \
    "https://$KEYGEN_HOST/v1/tokens")"
  status="${resp##*$'\n'}"
  resp="${resp%$'\n'*}"
  (( status < 400 )) || { echo "FATAL: admin token request -> HTTP $status" >&2; exit 1; }
  ADMIN_TOKEN="$(jq -er '.data.attributes.token' <<<"$resp")"
}

ensure_product() { # -> product id
  local id
  id="$(api GET "/products" | jq -r --arg n "$PRODUCT_NAME" \
    '.data[] | select(.attributes.name == $n) | .id' | head -n1)"
  if [[ -z "$id" ]]; then
    id="$(api POST "/products" "{\"data\":{\"type\":\"products\",\"attributes\":{\"name\":\"$PRODUCT_NAME\"}}}" \
      | jq -er '.data.id')"
    echo "created product:  $id" >&2
  else
    echo "existing product: $id" >&2
  fi
  printf '%s' "$id"
}

ensure_policy() { # PRODUCT_ID -> policy id
  local product_id="$1" id
  id="$(api GET "/policies" | jq -r --arg n "$POLICY_NAME" \
    '.data[] | select(.attributes.name == $n) | .id' | head -n1)"
  if [[ -z "$id" ]]; then
    # authenticationStrategy MUST be LICENSE (defaults to TOKEN — Pitfall 1:
    # without it every `Authorization: License <key>` call 403s).
    local payload
    payload="$(jq -n --arg name "$POLICY_NAME" --arg pid "$product_id" '{
      data: { type: "policies",
        attributes: { name: $name, floating: false, maxMachines: 1,
                      authenticationStrategy: "LICENSE",
                      expirationStrategy: "RESTRICT_ACCESS" },
        relationships: { product: { data: { type: "products", id: $pid } } } } }')"
    id="$(api POST "/policies" "$payload" | jq -er '.data.id')"
    echo "created policy:  $id" >&2
  else
    echo "existing policy: $id" >&2
  fi
  printf '%s' "$id"
}

mint_license() { # POLICY_ID -> prints "id<TAB>key"
  local policy_id="$1" resp
  resp="$(api POST "/licenses" "{\"data\":{\"type\":\"licenses\",\"relationships\":{\"policy\":{\"data\":{\"type\":\"policies\",\"id\":\"$policy_id\"}}}}}")"
  jq -er '[.data.id, .data.attributes.key] | @tsv' <<<"$resp"
}

write_pubkey_fixture() {
  # NOTE: `GET /v1/accounts/{id}` does NOT route on a single-label host —
  # the accounts#show route sits behind `constraints domain:/subdomain:` and
  # Rails derives a nil request.domain from "localhost" (empirically 404s;
  # all the /v1/accounts/{id}/... subresource routes the app needs are mounted
  # OUTSIDE that constraint and work fine). Extract via rails runner instead.
  #
  # Encoding fact (recorded in 19-SPIKE-OUTCOME.md): Account#ed25519_public_key
  # is stored as a 64-char HEX string; the API serializer base64-encodes that
  # hex string verbatim. The fixture normalizes to base64 of the RAW 32 bytes,
  # which is what ed25519-dalek's VerifyingKey::from_bytes wants.
  local b64 bytes
  b64="$(docker compose -f "$SCRIPT_DIR/compose.yaml" run --rm -T setup \
    bundle exec rails runner \
    'print Base64.strict_encode64([Account.first.ed25519_public_key].pack("H*"))' \
    2>/dev/null | tail -n1)"
  mkdir -p "$(dirname "$PUBKEY_FIXTURE")"
  printf '%s' "$b64" > "$PUBKEY_FIXTURE"   # one line, NO trailing newline
  bytes="$(base64 -d < "$PUBKEY_FIXTURE" | wc -c | tr -d ' ')"  # stdin: macOS base64 takes no path arg
  [[ "$bytes" == "32" ]] || { echo "FATAL: pubkey decodes to $bytes bytes, want 32" >&2; exit 1; }
  echo "ed25519 pubkey (base64, 32 raw bytes): $b64" >&2
  echo "fixture written: $PUBKEY_FIXTURE" >&2
}

main() {
  get_admin_token
  local product_id policy_id license
  product_id="$(ensure_product)"
  policy_id="$(ensure_policy "$product_id")"

  case "${1:-bootstrap}" in
    mint_license)
      license="$(mint_license "$policy_id")"
      echo "LICENSE_ID=$(cut -f1 <<<"$license")"
      echo "LICENSE_KEY=$(cut -f2 <<<"$license")"
      ;;
    bootstrap)
      license="$(mint_license "$policy_id")"
      echo "LICENSE_ID=$(cut -f1 <<<"$license")"
      echo "LICENSE_KEY=$(cut -f2 <<<"$license")"
      write_pubkey_fixture
      ;;
    *)
      echo "usage: $0 [mint_license]" >&2; exit 2 ;;
  esac
}

main "$@"
