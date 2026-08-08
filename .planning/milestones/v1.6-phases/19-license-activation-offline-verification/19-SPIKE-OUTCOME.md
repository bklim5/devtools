# 19 SPIKE Outcome (D-42) — Key→Token Exchange + CE Lifecycle, Proven Live

**Run:** 2026-06-12, against a local self-hosted Keygen CE instance (Docker, dev Mac).
**Driver:** `scripts/keygen-ce/spike.sh` (re-run verified: exits 0, idempotent — cleans up prior machines, fresh synthetic fingerprints each run). Full raw transcript: `scripts/keygen-ce/spike-transcript.log` (gitignored — validate-key responses echo the license key).

## Verdict

**Key→token exchange: DENIED (empirically confirmed).** `POST /licenses/{id}/tokens` with `Authorization: License <key>` returns **HTTP 403** — the license principal cannot generate a license token, exactly as the source-level pre-verification predicted (dual-layer denial: `LICENSE_PERMISSIONS` lacks `license.tokens.generate` + `Licenses::TokenPolicy#create?` role-match `deny!`).

**Consequence: the Keychain stores the raw license key.** Plans 02/03 proceed on that assumption, now empirical fact. The research-doc open item ("client-side key→token exchange vs raw key in Keychain") is CLOSED.

Full lifecycle proven live in one scripted run: validate → activate → validate(VALID) → token-denial probe → machine-file checkout → seat-limit rejection → fingerprint-mismatch detection → deactivate → re-activate.

## Token-denial response

`POST /v1/accounts/{acct}/licenses/{license-id}/tokens`, header `Authorization: License <key>` →

**HTTP 403**
```json
{
  "meta": {
    "id": "019ebc66-6304-7251-86de-79f500a2a714"
  },
  "errors": [
    {
      "title": "Access denied",
      "detail": "You do not have permission to complete the request (license lacks permission to perform action)"
    }
  ]
}
```

Note for Plan 03's error mapping: this 403 body has **no `code` field** — denial is identified by HTTP status + title only.

## Seat-limit response

`POST /v1/accounts/{acct}/machines` with a second fingerprint (FP_B) on the same `maxMachines=1` license →

**HTTP 422**
```json
{
  "errors": [
    {
      "title": "Unprocessable resource",
      "detail": "machine count has exceeded maximum allowed for license (1)",
      "code": "MACHINE_LIMIT_EXCEEDED",
      "source": {
        "pointer": "/data"
      },
      "links": {
        "about": "https://keygen.sh/docs/api/machines/#machines-object"
      }
    }
  ],
  "meta": {
    "id": "019ebc66-63bd-70e7-abce-b2843c6cf2b5"
  }
}
```

**The exact `code` string Plan 03 maps on: `MACHINE_LIMIT_EXCEEDED`** (research assumption A1 confirmed verbatim).

## Validate-key codes observed

`POST /licenses/actions/validate-key` (UNAUTHENTICATED — the key in the body is the credential), body `{"meta":{"key":"<key>","scope":{"fingerprint":"<hex>"}}}`:

| Scenario | HTTP | `meta.valid` | `meta.code` | `meta.detail` |
|---|---|---|---|---|
| Fresh fingerprint, never activated | 200 | `false` | `NO_MACHINE` | "fingerprint is not activated (has no associated machine)" |
| Same fingerprint, after activation | 200 | `true` | `VALID` | "is valid" |
| Different fingerprint while seat is taken | 200 | `false` | `FINGERPRINT_SCOPE_MISMATCH` | "fingerprint is not activated (does not match any associated machines)" |

Pitfall 3 confirmed live: pre-activation `valid:false` + `NO_MACHINE` is the EXPECTED state — branch on `meta.code`, never on `meta.valid`. (CE returned `NO_MACHINE` singular; treat `NO_MACHINES` as equivalent.) The validate-key response also carries `data.id` (the license id) — the activation flow needs no extra lookup call.

## Account Ed25519 public key

- **Base64 (raw 32 bytes):** `ZBd2u102TCpivzVAisQZi7h5YUqhmtT6DA1Ej0YPes4=`
- **Hex:** `641776bb5d364c2a62bf35408ac4198bb879614aa19ad4fa0c0d448f460f7ace`
- **Byte-count check:** `base64 -d < src-tauri/fixtures/ce-ed25519-pubkey.b64 | wc -c` → **32** ✓
- **Fixture:** `src-tauri/fixtures/ce-ed25519-pubkey.b64` (one line, no trailing newline)

**Encoding finding (matters for Plan 02/03):** CE stores `Account#ed25519_public_key` as a 64-char **hex string**; the account serializer base64-encodes that hex string verbatim, so the API's `meta.keys.ed25519` is base64-of-hex, NOT base64-of-raw-bytes (the research claim was wrong about the inner representation). The committed fixture is normalized to **base64 of the raw 32 bytes** — what `ed25519_dalek::VerifyingKey::from_bytes` wants.

**Extraction route finding:** `GET /v1/accounts/{id}` does **not route** on a single-label host — accounts#show sits behind `constraints domain:/subdomain:` in routes.rb, and Rails derives a nil `request.domain` from `localhost` (404, ErrorsController). All `/v1/accounts/{id}/...` subresource routes the app needs are mounted outside that constraint and work. `bootstrap.sh` therefore extracts the pubkey via `rails runner` through the compose `setup` service. A production CE deployment on a two-label host (Phase 20) won't hit this.

## Checkout record

`POST /machines/{machine-id}/actions/check-out?include=license,license.entitlements&ttl=2629746`, `Authorization: License <key>`, NO `encrypt` param →

- **HTTP 200**; `data.attributes`: `issued: 2026-06-12T15:14:47.247Z`, `expiry: 2026-07-12T15:14:47.247Z`, `ttl: 2629746` (~30.44 days — matches the locked TTL model)
- Certificate saved byte-verbatim → **`src-tauri/fixtures/ce-machine.lic`** (`-----BEGIN MACHINE FILE-----` … `-----END MACHINE FILE-----`, 131 lines); envelope `alg` is the unencrypted-ed25519 form for Plan 02's cross-validation test against the fixture pubkey above
- Safe to commit: the embedded fingerprint is synthetic (`openssl rand -hex 32`), no real machine identity; the file is signed (integrity-protected), not secret (T-19-05)

## Deactivate / re-activate (LIC-07 primitive)

- `DELETE /machines/{machine-id}` with `Authorization: License <key>` → **HTTP 204** — deactivation works with key auth alone
- Re-activate same fingerprint → **HTTP 201** — the instance ends the spike with exactly one active machine

## CE instance facts

| Fact | Value |
|---|---|
| Image | `keygen/api:latest`, image id `sha256:d820b65dccb7…` (multi-arch, native arm64), `api_revision=055c872`, api_version 1.8 |
| KEYGEN_ACCOUNT_ID | `23c88309-2584-4771-81df-1d351672ff91` |
| Host strategy | `KEYGEN_HOST=localhost` + **`KEYGEN_DOMAIN=localhost`** (single-label host derives a nil `Keygen::DOMAIN` and crashes web/worker at boot — explicit override required; the planned `keygen.local.test` + `/etc/hosts` fallback was NOT needed) |
| TLS | Caddy `tls internal`; extracted root CA at `scripts/keygen-ce/caddy-root.crt` (gitignored); every call `--cacert`, never `-k` |
| Policy | `perpetual-node-locked`: `floating:false`, `maxMachines:1`, **`authenticationStrategy:"LICENSE"`**, `expirationStrategy:"RESTRICT_ACCESS"` |
| Toolchain | Docker 20.10.7 / Compose 2.0.0-beta.3 — compose `profiles` avoided entirely (Pitfall 8); `docker compose run --rm setup` works on this beta |

## Plan 04 walkthrough note

The spike license's single seat is bound to a **synthetic** fingerprint (FP_A = `openssl rand -hex 32`, not this Mac's real HMAC fingerprint). The Plan 04 walkthrough MUST mint a **fresh license** via `./scripts/keygen-ce/bootstrap.sh mint_license` — activating the spike license from the real app would be rejected with `MACHINE_LIMIT_EXCEEDED`.
