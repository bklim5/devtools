#!/usr/bin/env bash
# D-42 SPIKE against the live local Keygen CE instance (Phase 19, plan 01).
#
# Proves the full license lifecycle with license-key auth and records the two
# payloads Plan 03 maps on:
#   a. validate-key (fresh fingerprint)  -> NO_MACHINE/NO_MACHINES (expected, NOT failure)
#   b. activate machine FP_A             -> 201
#   c. validate-key FP_A                 -> VALID
#   d. token-denial probe                -> expect 403 (the D-42 question; record verbatim)
#   e. machine-file checkout             -> src-tauri/fixtures/ce-machine.lic
#   f. seat-limit probe FP_B             -> expect 422 MACHINE_LIMIT_EXCEEDED (record verbatim)
#   g. validate-key FP_B                 -> FINGERPRINT_SCOPE_MISMATCH
#   h. deactivate (204) + re-activate FP_A (201) — proves LIC-07's primitive with key auth
#
# Idempotent: deletes any machines already active on the license before starting
# (fingerprints are synthetic and fresh each run). Full raw JSON goes to stdout
# AND to spike-transcript.log (gitignored). The license key is passed in, never
# hardcoded (T-19-02); TLS always via the extracted Caddy CA (T-19-03).
#
# Usage: LICENSE_KEY=<key> ./spike.sh    (or ./spike.sh <key>)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# shellcheck source=/dev/null
set -a; source "$SCRIPT_DIR/.env"; set +a

CACERT="$SCRIPT_DIR/caddy-root.crt"
BASE="https://$KEYGEN_HOST/v1/accounts/$KEYGEN_ACCOUNT_ID"
LICENSE_KEY="${1:-${LICENSE_KEY:-}}"
TRANSCRIPT="$SCRIPT_DIR/spike-transcript.log"
LIC_FIXTURE="$REPO_ROOT/src-tauri/fixtures/ce-machine.lic"

[[ -n "$LICENSE_KEY" ]] || { echo "usage: LICENSE_KEY=<key> $0" >&2; exit 2; }
[[ -f "$CACERT" ]] || { echo "FATAL: $CACERT missing — extract it per README.md" >&2; exit 1; }

FP_A="$(openssl rand -hex 32)"
FP_B="$(openssl rand -hex 32)"

: > "$TRANSCRIPT"
log() { printf '%s\n' "$*" | tee -a "$TRANSCRIPT"; }

STATUS=""; BODY=""
# req METHOD URL [JSON_BODY] [AUTH_HEADER] -> sets STATUS/BODY (no exit on >=400 — probes record failures)
req() {
  local method="$1" url="$2" body="${3:-}" auth="${4:-}"
  local args=(-s --cacert "$CACERT" -X "$method" -w $'\n%{http_code}' \
    -H "Content-Type: application/vnd.api+json" -H "Accept: application/vnd.api+json")
  [[ -n "$auth" ]] && args+=(-H "$auth")
  [[ -n "$body" ]] && args+=(-d "$body")
  local resp
  resp="$(curl "${args[@]}" "$url")"
  STATUS="${resp##*$'\n'}"
  BODY="${resp%$'\n'*}"
}

record() { # record STEP_LABEL — logs status + full raw JSON responses. The ADMIN token is never
           # involved here (T-19-02); validate-key responses DO echo the license key back, which is
           # why the transcript is gitignored and the outcome doc redacts it.
  log ""
  log "=== $1"
  log "HTTP $STATUS"
  log "$(jq . <<<"$BODY" 2>/dev/null || printf '%s' "$BODY")"
}

fail() { log "SPIKE FAILED: $*"; exit 1; }

expect_status() { [[ "$STATUS" == "$1" ]] || fail "$2 (got HTTP $STATUS, want $1)"; }

validate_key() { # FP -> sets STATUS/BODY (unauthenticated — the key in the body is the credential)
  req POST "$BASE/licenses/actions/validate-key" \
    "$(jq -n --arg k "$LICENSE_KEY" --arg fp "$1" '{meta:{key:$k, scope:{fingerprint:$fp}}}')"
}

activate_machine() { # FP LICENSE_ID NAME -> sets STATUS/BODY
  req POST "$BASE/machines" \
    "$(jq -n --arg fp "$1" --arg lid "$2" --arg name "$3" '{
      data: { type: "machines",
        attributes: { fingerprint: $fp, platform: "macOS", name: $name },
        relationships: { license: { data: { type: "licenses", id: $lid } } } } }')" \
    "Authorization: License $LICENSE_KEY"
}

log "D-42 SPIKE transcript — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
log "FP_A=$FP_A"
log "FP_B=$FP_B"

# --- Resolve license id + cleanup (idempotency): delete machines from prior runs
validate_key "$FP_A"
LICENSE_ID="$(jq -r '.data.id // empty' <<<"$BODY")"
[[ -n "$LICENSE_ID" ]] || { record "pre-flight validate-key (license lookup)"; fail "license not found for the supplied key"; }
log "LICENSE_ID=$LICENSE_ID"

req GET "$BASE/machines" "" "Authorization: License $LICENSE_KEY"
if [[ "$STATUS" == "200" ]]; then
  for mid in $(jq -r '.data[].id' <<<"$BODY"); do
    req DELETE "$BASE/machines/$mid" "" "Authorization: License $LICENSE_KEY"
    log "cleanup: deleted machine $mid (HTTP $STATUS)"
  done
else
  log "cleanup: machine list returned HTTP $STATUS — continuing"
fi

# --- a. validate-key pre-activation: NO_MACHINE(S) expected, valid=false (Pitfall 3)
validate_key "$FP_A"
record "a. validate-key FP_A (pre-activation)"
CODE="$(jq -r '.meta.code' <<<"$BODY")"
VALID="$(jq -r '.meta.valid' <<<"$BODY")"
[[ "$CODE" == "NO_MACHINE" || "$CODE" == "NO_MACHINES" ]] || fail "a: want NO_MACHINE/NO_MACHINES, got $CODE"
[[ "$VALID" == "false" ]] || fail "a: want meta.valid=false pre-activation, got $VALID"

# --- b. activate machine FP_A -> 201
activate_machine "$FP_A" "$LICENSE_ID" "Spike Mac"
record "b. POST /machines FP_A (activate)"
[[ "$STATUS" == "201" ]] || fail "b: want 201, got $STATUS — a 403 here means the policy was created WITHOUT authenticationStrategy=LICENSE (Pitfall 1: recreate it via bootstrap.sh)"
MACHINE_ID="$(jq -er '.data.id' <<<"$BODY")"
log "MACHINE_ID=$MACHINE_ID"

# --- c. validate-key FP_A -> VALID
validate_key "$FP_A"
record "c. validate-key FP_A (post-activation)"
[[ "$(jq -r '.meta.code' <<<"$BODY")" == "VALID" ]] || fail "c: want VALID, got $(jq -r '.meta.code' <<<"$BODY")"

# --- d. TOKEN-DENIAL PROBE (the D-42 question): license principal generating a license token
req POST "$BASE/licenses/$LICENSE_ID/tokens" \
  '{"data":{"type":"tokens"}}' \
  "Authorization: License $LICENSE_KEY"
record "d. token-denial probe: POST /licenses/{id}/tokens with License auth"
TOKEN_PROBE_STATUS="$STATUS"
[[ "$STATUS" == "403" ]] || log "NOTE: expected 403 (source-verified dual-layer denial) — got $STATUS; the empirical record above is authoritative"

# --- e. machine-file checkout (unencrypted — do NOT pass encrypt=1)
req POST "$BASE/machines/$MACHINE_ID/actions/check-out?include=license,license.entitlements&ttl=2629746" \
  "" "Authorization: License $LICENSE_KEY"
expect_status 200 "e: machine-file checkout"
log ""
log "=== e. machine-file checkout (HTTP $STATUS) — certificate elided here, saved to fixture"
log "checkout meta: $(jq -c '.data.attributes | {issued, expiry, ttl}' <<<"$BODY")"
jq -ej '.data.attributes.certificate' <<<"$BODY" > "$LIC_FIXTURE"   # -j: byte-verbatim, no added newline
grep -q -- "-----BEGIN MACHINE FILE-----" "$LIC_FIXTURE" || fail "e: fixture missing BEGIN marker"
log "fixture written: $LIC_FIXTURE"

# --- f. SEAT-LIMIT PROBE (LIC-02/A1): second fingerprint on the same license
activate_machine "$FP_B" "$LICENSE_ID" "Second Mac"
record "f. seat-limit probe: POST /machines FP_B (same license)"
SEAT_STATUS="$STATUS"
SEAT_CODE="$(jq -r '.errors[0].code // empty' <<<"$BODY")"
[[ "$SEAT_STATUS" == "422" ]] || fail "f: want 422, got $SEAT_STATUS"
# Expected code: MACHINE_LIMIT_EXCEEDED — whatever came back verbatim is the record Plan 03 maps on.
log "seat-limit error code (verbatim): $SEAT_CODE"

# --- g. validate-key FP_B -> FINGERPRINT_SCOPE_MISMATCH (seat taken elsewhere)
validate_key "$FP_B"
record "g. validate-key FP_B (foreign fingerprint)"
[[ "$(jq -r '.meta.code' <<<"$BODY")" == "FINGERPRINT_SCOPE_MISMATCH" ]] \
  || fail "g: want FINGERPRINT_SCOPE_MISMATCH, got $(jq -r '.meta.code' <<<"$BODY")"

# --- h. deactivate (LIC-07 primitive) + re-activate so the instance ends with one active machine
req DELETE "$BASE/machines/$MACHINE_ID" "" "Authorization: License $LICENSE_KEY"
log ""
log "=== h1. DELETE /machines/$MACHINE_ID -> HTTP $STATUS"
expect_status 204 "h: deactivate"
activate_machine "$FP_A" "$LICENSE_ID" "Spike Mac"
record "h2. re-activate FP_A"
expect_status 201 "h: re-activate"

log ""
log "SPIKE PASSED — token probe HTTP $TOKEN_PROBE_STATUS, seat-limit HTTP $SEAT_STATUS code=$SEAT_CODE"
