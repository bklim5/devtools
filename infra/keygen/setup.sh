#!/usr/bin/env bash
# Idempotent PRODUCTION Keygen CE setup (D-51/D-53/D-54). Extends the proven
# Phase-19 scripts/keygen-ce/bootstrap.sh lookup-then-create pattern with the
# two production-only additions: entitlement codes (pro.theming + pro.ordering)
# attached to the policy, and a metadata-filter live-validation (A2).
#
# Run ON THE BOX, ONCE, AFTER `docker compose run --rm setup` has created the
# account/keypair (rails keygen:setup). Re-runnable on a box rebuild (D-53):
# product, policy, and entitlements are looked up before create; the throwaway
# validation license is always deleted.
#
# TLS: production uses REAL ACME (Pitfall 3) — curl uses the OS trust store,
# NEVER -k and NEVER a custom CA (that path is compiled out of release builds).
#
# Credentials come from the gitignored infra/keygen/.env (KEYGEN_HOST,
# KEYGEN_ACCOUNT_ID, KEYGEN_ADMIN_EMAIL, KEYGEN_ADMIN_PASSWORD).
#
# On success it PRINTS, for the config.rs paste (Task 3) and server/webhook/.env:
#   PROD_ACCOUNT_ID, PROD_ED25519_PUBKEY_B64 (base64 of raw 32 bytes), PROD_POLICY_ID.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
set -a; source "$SCRIPT_DIR/.env"; set +a

# Keygen CE runs in SINGLEPLAYER mode (the only CE mode): the API is mounted at
# /v1/... with NO /accounts/{id} segment (the single account is implicit). The
# multiplayer-style /v1/accounts/{id}/... routes 404 on a real two-label host
# (they only resolved on the Phase-19 localhost CE via a nil-domain routing
# quirk). Verified live: GET /v1/products → 200, /v1/accounts/{id}/products → 404.
BASE="https://$KEYGEN_HOST/v1"
PRODUCT_NAME="TinkerDev"
POLICY_NAME="perpetual-node-locked"

# The EXACT Phase-18 gate vocabulary (src/lib/entitlements/entitlements.ts:12-16).
ENT_THEMING_CODE="pro.theming"
ENT_THEMING_NAME="Pro Theming"
ENT_ORDERING_CODE="pro.ordering"
ENT_ORDERING_NAME="Pro Ordering"

ADMIN_TOKEN=""

# api METHOD PATH [JSON_BODY] — admin-token-authed call over real ACME TLS
# (OS trust store, no -k / no --cacert). Prints body; fails on >=400.
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

get_admin_token() {
  local resp status
  resp="$(curl -s -X POST -w $'\n%{http_code}' \
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
    # authenticationStrategy MUST be LICENSE (defaults to TOKEN — Pitfall 1).
    # perpetual / node-locked / maxMachines=1 (D-53).
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

ensure_entitlement() { # CODE NAME -> entitlement id  (idempotent: lookup by code)
  local code="$1" name="$2" id
  id="$(api GET "/entitlements" | jq -r --arg c "$code" \
    '.data[] | select(.attributes.code == $c) | .id' | head -n1)"
  if [[ -z "$id" ]]; then
    local payload
    payload="$(jq -n --arg name "$name" --arg code "$code" '{
      data: { type: "entitlements", attributes: { name: $name, code: $code } } }')"
    id="$(api POST "/entitlements" "$payload" | jq -er '.data.id')"
    echo "created entitlement $code: $id" >&2
  else
    echo "existing entitlement $code: $id" >&2
  fi
  printf '%s' "$id"
}

attach_entitlements() { # POLICY_ID THEMING_ID ORDERING_ID
  # Attach BOTH entitlements to the policy (inherited by every license, D-54).
  # Idempotent: re-attaching an already-attached entitlement is a conflict the
  # CE tolerates / no-ops; we attach individually and ignore a 4xx "already".
  local policy_id="$1" theming_id="$2" ordering_id="$3"
  local body
  body="$(jq -n --arg t "$theming_id" --arg o "$ordering_id" '{
    data: [ { type: "entitlements", id: $t },
            { type: "entitlements", id: $o } ] }')"
  # Use a tolerant call: a 409/422 "already attached" on a re-run is fine.
  local resp status
  resp="$(curl -s -X POST -w $'\n%{http_code}' \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/vnd.api+json" -H "Accept: application/vnd.api+json" \
    -d "$body" "$BASE/policies/$policy_id/entitlements")"
  status="${resp##*$'\n'}"
  resp="${resp%$'\n'*}"
  if (( status >= 400 )) && (( status != 409 )) && (( status != 422 )); then
    echo "FATAL: attach entitlements -> HTTP $status" >&2
    echo "$resp" >&2
    exit 1
  fi
  echo "attached pro.theming + pro.ordering to policy $policy_id (HTTP $status)" >&2
}

print_pubkey() {
  # Encoding fact (19-SPIKE-OUTCOME.md): Account#ed25519_public_key is a 64-char
  # HEX string; ed25519-dalek's VerifyingKey::from_bytes wants the RAW 32 bytes.
  # Normalize to base64-of-raw-32-bytes (the SPIKE gotcha), exactly as the
  # Phase-19 bootstrap.sh:write_pubkey_fixture does. This is the value that goes
  # into config.rs's release arm (Task 3).
  local b64 bytes
  b64="$(docker compose -f "$SCRIPT_DIR/compose.yaml" run --rm -T setup \
    bundle exec rails runner \
    'print Base64.strict_encode64([Account.first.ed25519_public_key].pack("H*"))' \
    2>/dev/null | tail -n1)"
  bytes="$(printf '%s' "$b64" | base64 -d | wc -c | tr -d ' ')"
  [[ "$bytes" == "32" ]] || { echo "FATAL: pubkey decodes to $bytes bytes, want 32" >&2; exit 1; }
  printf '%s' "$b64"
}

validate_metadata_filter() { # POLICY_ID  (A2 — fail loudly if CE ignores metadata)
  # Idempotency (D-58) depends on the ?metadata[orderId]= filter actually
  # working. Create a throwaway license stamped with a sentinel orderId, fetch
  # it back via the filter, assert exactly one result, then delete it.
  local policy_id="$1" sentinel="__setupcheck__" lic_id found
  local create_body
  create_body="$(jq -n --arg pid "$policy_id" --arg oid "$sentinel" '{
    data: { type: "licenses",
      attributes: { metadata: { orderId: $oid } },
      relationships: { policy: { data: { type: "policies", id: $pid } } } } }')"
  lic_id="$(api POST "/licenses" "$create_body" | jq -er '.data.id')"
  echo "metadata-validation: created throwaway license $lic_id" >&2

  # URL-encode the bracket so curl sends ?metadata[orderId]=... literally.
  found="$(api GET "/licenses?metadata%5BorderId%5D=$sentinel" \
    | jq -r '.data | length')"

  # Always clean up the throwaway license, success or failure.
  api DELETE "/licenses/$lic_id" >/dev/null || true
  echo "metadata-validation: deleted throwaway license $lic_id" >&2

  if [[ "$found" != "1" ]]; then
    echo "FATAL: metadata filter returned $found results, want 1 — CE is NOT" >&2
    echo "       honoring ?metadata[orderId]=; D-58 idempotency would break." >&2
    exit 1
  fi
  echo "metadata-validation: PASSED (?metadata[orderId]= returns the stamped license)" >&2
}

main() {
  get_admin_token
  local product_id policy_id theming_id ordering_id pubkey
  product_id="$(ensure_product)"
  policy_id="$(ensure_policy "$product_id")"
  theming_id="$(ensure_entitlement "$ENT_THEMING_CODE" "$ENT_THEMING_NAME")"
  ordering_id="$(ensure_entitlement "$ENT_ORDERING_CODE" "$ENT_ORDERING_NAME")"
  attach_entitlements "$policy_id" "$theming_id" "$ordering_id"
  validate_metadata_filter "$policy_id"
  pubkey="$(print_pubkey)"

  # --- The values for config.rs (Task 3) + server/webhook/.env ---
  echo ""
  echo "================  PRODUCTION CE CONSTANTS  ================"
  echo "PROD_ACCOUNT_ID=$KEYGEN_ACCOUNT_ID"
  echo "PROD_ED25519_PUBKEY_B64=$pubkey"
  echo "PROD_POLICY_ID=$policy_id"
  echo "=========================================================="
  echo ""
  echo "Next:"
  echo "  - Paste PROD_ACCOUNT_ID + PROD_ED25519_PUBKEY_B64 into config.rs release arm (Task 3)."
  echo "  - Set KEYGEN_ACCOUNT_ID + KEYGEN_POLICY_ID in server/webhook/.env (with the admin token)."
}

main "$@"
