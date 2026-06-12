---
phase: 19-license-activation-offline-verification
plan: 01
subsystem: licensing-infra
tags: [keygen-ce, docker, spike, d-42, ed25519, fixtures]
requires: []
provides:
  - "Running local Keygen CE instance (Docker) answering https://localhost/v1/health over its self-signed CA"
  - "scripts/keygen-ce/ — compose.yaml, Caddyfile, .env.example, bootstrap.sh (idempotent, mint_license), spike.sh"
  - "19-SPIKE-OUTCOME.md — D-42 verdict + verbatim error payloads for Plan 03 mapping"
  - "src-tauri/fixtures/ce-machine.lic — real CE-issued machine file for Plan 02 cross-validation"
  - "src-tauri/fixtures/ce-ed25519-pubkey.b64 — account pubkey, base64 of raw 32 bytes, for Plan 02 config const"
affects: [19-02, 19-03, 19-04, phase-20, phase-21]
tech-stack:
  added: ["keygen/api:latest (Docker, local-only infra)", "postgres:17.5 (Docker)", "redis (Docker)", "caddy (Docker, tls internal)"]
  patterns: ["compose without profiles (Compose 2.0.0-beta.3)", "TLS via extracted Caddy root CA, never -k", "secrets sourced from gitignored .env at runtime"]
key-files:
  created:
    - scripts/keygen-ce/compose.yaml
    - scripts/keygen-ce/Caddyfile
    - scripts/keygen-ce/.env.example
    - scripts/keygen-ce/README.md
    - scripts/keygen-ce/bootstrap.sh
    - scripts/keygen-ce/spike.sh
    - .planning/phases/19-license-activation-offline-verification/19-SPIKE-OUTCOME.md
    - src-tauri/fixtures/ce-machine.lic
    - src-tauri/fixtures/ce-ed25519-pubkey.b64
  modified:
    - .gitignore
decisions:
  - "D-42 CLOSED: key->token exchange DENIED live (403, no code field in body) — Keychain stores the RAW license key"
  - "Seat-limit error code confirmed verbatim: MACHINE_LIMIT_EXCEEDED (A1) — Plan 03 maps on this exact string"
  - "Host strategy: KEYGEN_HOST=localhost works WITH explicit KEYGEN_DOMAIN=localhost (single-label host derives nil Keygen::DOMAIN -> boot crash); /etc/hosts fallback NOT needed"
  - "Account pubkey extracted via rails runner, not GET /v1/accounts/{id} (route behind domain/subdomain constraints never matches on single-label hosts)"
  - "CE pubkey encoding: API/DB value is base64-of-HEX; fixture normalized to base64 of raw 32 bytes for ed25519-dalek"
metrics:
  duration: "~25 min"
  completed: "2026-06-12"
  tasks: 2
  files: 10
---

# Phase 19 Plan 01: Keygen CE Bring-Up + D-42 SPIKE Summary

**One-liner:** Local Keygen CE proven live end-to-end — token-generation denied (403) so the Keychain stores the raw key; seat-limit code `MACHINE_LIMIT_EXCEEDED` recorded verbatim; real machine.lic + Ed25519 pubkey fixtures committed for Plan 02.

## What was built

- **Task 1 (`34c84039`):** Reproducible CE bring-up under `scripts/keygen-ce/` — compose.yaml (postgres 17.5 / redis / web / worker / caddy + a run-only `setup` one-shot, zero compose `profiles` for the 2.0.0-beta.3 toolchain), Caddyfile (`tls internal`), `.env.example` template (generation commands as comments only), README with the decisions actually taken. Real `.env` + extracted `caddy-root.crt` gitignored (D-41/T-19-01). Instance answers `https://localhost/v1/health` → 204 over the extracted CA.
- **Task 2 (`82e9323f`):** `bootstrap.sh` (admin token → product "TinkerDev" → policy `perpetual-node-locked` with `authenticationStrategy:"LICENSE"` → license; idempotent by-name lookup; `mint_license` subcommand for the Plan 04 walkthrough) and `spike.sh` (full D-42 lifecycle, idempotent re-run verified exit 0). Outcome recorded in `19-SPIKE-OUTCOME.md`; fixtures committed.

## SPIKE results (D-42 — the phase gate)

| Probe | Result |
|---|---|
| validate-key, fresh fingerprint | 200, `valid:false`, `code:NO_MACHINE` (expected pre-activation state) |
| activate machine (License auth) | 201 |
| validate-key, activated fingerprint | 200, `code:VALID` |
| **token-denial probe** | **403** — "license lacks permission to perform action", NO `code` field |
| machine-file checkout (ttl=2629746) | 200, issued/expiry span ~30.44 days; certificate → fixture |
| seat-limit probe (2nd fingerprint) | **422, `code:MACHINE_LIMIT_EXCEEDED`** (verbatim, A1 confirmed) |
| validate-key, foreign fingerprint | 200, `code:FINGERPRINT_SCOPE_MISMATCH` |
| deactivate / re-activate (key auth) | 204 / 201 — LIC-07 primitive works with the key alone |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `.env.*` gitignore pattern would swallow the committed `.env.example`**
- **Found during:** Task 1
- **Issue:** the repo's pre-existing global `.env.*` ignore matches `scripts/keygen-ce/.env.example`, which the plan requires committing
- **Fix:** added `!scripts/keygen-ce/.env.example` negation alongside the planned ignore entries
- **Files modified:** `.gitignore` · **Commit:** `34c84039`

**2. [Rule 3 - Blocking] web/worker crash at boot with `KEYGEN_HOST=localhost`**
- **Found during:** Task 1 bring-up
- **Issue:** Keygen derives `Keygen::DOMAIN` from the last two dot-separated host labels; a single-label host yields nil → `Regexp.escape(nil)` TypeError in `resolve_account_service.rb`
- **Fix:** explicit `KEYGEN_DOMAIN=localhost` in `.env` + `.env.example` (documented in README + SPIKE outcome); the plan's `keygen.local.test` + `/etc/hosts` fallback (and its sudo checkpoint) was avoided
- **Files modified:** `scripts/keygen-ce/.env.example` · **Commit:** `34c84039`

**3. [Rule 3 - Blocking] `GET /v1/accounts/{id}` 404s on single-label hosts — pubkey unobtainable via the planned HTTP call**
- **Found during:** Task 2 bootstrap
- **Issue:** accounts#show sits behind `constraints domain:/subdomain:` in routes.rb; Rails derives nil `request.domain` from `localhost` so the route never matches (all needed `/v1/accounts/{id}/...` subresource routes work). Additionally, CE stores the pubkey as a hex string — the serializer's `meta.keys.ed25519` is base64-of-hex, not base64-of-raw-32 as researched
- **Fix:** `bootstrap.sh` extracts via `rails runner 'Base64.strict_encode64([Account.first.ed25519_public_key].pack("H*"))'` through the compose `setup` service, normalizing to base64 of the raw 32 bytes; both findings recorded in 19-SPIKE-OUTCOME.md for Plan 02/03
- **Files modified:** `scripts/keygen-ce/bootstrap.sh` · **Commit:** `82e9323f`

### Minor deviations

- **`scripts/keygen-ce/Caddyfile`** added as a sibling file (plan offered `configs:` inline or sibling; sibling chosen — safer on Compose 2.0.0-beta.3).
- **macOS `base64` takes no file-path argument** — scripts/verification use stdin redirection (`base64 -d < file`); the plan's literal verify command was run in its stdin-equivalent form (result: 32 bytes ✓).
- **`scripts/keygen-ce/spike-transcript.log` gitignored** — validate-key responses echo the license key, so the raw transcript stays local; the outcome doc carries the curated verbatim payloads (key redacted).
- **Requirements LIC-01/02/04 NOT checked off** — plan frontmatter lists them, but plan 01 is SPIKE/infra only (no activation code exists yet) and plans 02/03/04 carry the same IDs; checkmarks reverted, to be marked by the implementing plans (logged in `deferred-items.md`).

## Verification

- Health: `https://localhost/v1/health` → 204 with `--cacert scripts/keygen-ce/caddy-root.crt`; all 5 services running
- `spike.sh` green on first run AND idempotent re-run (exit 0)
- `ce-machine.lic`: starts/ends with the PEM-style markers, byte-verbatim (no jq-added newline)
- `base64 -d < src-tauri/fixtures/ce-ed25519-pubkey.b64 | wc -c` → 32
- `git status` clean of `.env` / `caddy-root.crt` / transcript
- lefthook (tsc + vitest + eslint) green on both commits; no webview/Rust app code touched, so no real-WKWebView gate applies. `/simplify`/`/codex:review` slash gates are orchestrator-level commands unavailable in this executor context — simplification applied inline; flag for orchestrator if a separate review pass is wanted on the two shell scripts.

## Known Stubs

None — no app code in this plan; all artifacts are live-proven infra, records, and real-server fixtures.

## For downstream plans

- **Plan 02:** consume `src-tauri/fixtures/ce-machine.lic` + `ce-ed25519-pubkey.b64` (base64 → raw 32 bytes → `VerifyingKey::from_bytes`) for the cross-validation test — no CE needed.
- **Plan 03:** map seat-limit on the exact string `MACHINE_LIMIT_EXCEEDED`; token-denial 403 carries NO `code` field; validate-key state machine codes in the outcome doc table. Dev TLS trust path reads `scripts/keygen-ce/caddy-root.crt`.
- **Plan 04:** mint a FRESH license via `./scripts/keygen-ce/bootstrap.sh mint_license` — the spike license's only seat is bound to a synthetic fingerprint.

## Self-Check: PASSED

All 10 created files exist on disk; both task commits (34c84039, 82e9323f) present in git log.
