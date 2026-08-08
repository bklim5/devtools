---
phase: 20-purchase-pipeline
plan: 03
subsystem: production-licensing-infra
tags: [keygen-ce, hetzner, caddy, acme, lemon-squeezy, resend, webhook, D-46, D-51, D-52, D-55, D-63]

# Dependency graph
requires:
  - phase: 20-purchase-pipeline (plan 01)
    provides: "cfg-split licensing constants (release arm placeholders to fill with real prod identity); Buy CTA opener seam"
  - phase: 20-purchase-pipeline (plan 02)
    provides: "server/webhook/ backend (LS verify -> Keygen create -> Resend email) — now containerized on the box"
  - phase: 19-license-activation
    provides: "the unchanged offline-activation flow that the emailed key must satisfy (the live proof target)"
provides:
  - "PRODUCTION Keygen CE live at https://license.tinkerdev.io (Hetzner CX23, Caddy real Let's Encrypt TLS) — fresh account + Ed25519 keypair (D-51)"
  - "Perpetual / node-locked / maxMachines=1 policy with pro.theming + pro.ordering entitlements inherited onto licenses (verified live)"
  - "Webhook backend running as a container on the same box, reaching CE over the box's own public https origin (D-55 admin token stays on-host)"
  - "config.rs release constants hold the REAL prod account id + base64-raw-32B pubkey + host; cargo test --release tripwire green"
  - "infra/keygen/ reproducible stack (compose + Caddyfile + swap + setup.sh + deploy + RUNBOOK) committed (templates only, secrets gitignored)"
  - "Lemon Squeezy MoR store wired (order_created webhook, ≤40-char signing secret) + Resend transactional email (reply-to -> M365 alias)"
affects: [21-lifecycle-ship-gate]

# Tech tracking
tech-stack:
  added:
    - "Hetzner CX23 (EU) production VPS — Docker Compose stack (postgres/redis/web/worker/caddy/webhook)"
    - "Caddy real ACME (Let's Encrypt) on license.tinkerdev.io — NOT tls internal (release builds compile out the custom-CA path)"
    - "Lemon Squeezy (Merchant of Record, D-61) — SG payout confirmed; order_created webhook only"
    - "Resend transactional email on email.tinkerdev.io (DKIM/SPF); reply-to licenses@tinkerdev.io (M365 alias)"
  patterns:
    - "CE singleplayer mounts the whole API at /v1/... with NO /accounts/{id} segment — all three clients (keygen_client.rs, webhook keygen.ts, setup.sh) use /v1 (the Phase-19 localhost CE hid this via a nil-domain quirk)"
    - "Webhook reaches CE via the box's OWN public https origin (loopback to its public IP) so traffic stays on-host over TLS — keygen forces canonical Host + https, so an internal http://web:3000 gets 403/301 (D-55 intent preserved)"
    - "Secrets live ONLY on the box (gitignored infra/keygen/.env + server/webhook/.env); only non-secret values (account id, pubkey) committed in config.rs / shared"

key-files:
  created:
    - "infra/keygen/compose.yaml — prod stack: CE web+worker + postgres + redis + webhook + Caddy (real ACME)"
    - "infra/keygen/Caddyfile — license.tinkerdev.io reverse_proxy (webhook /webhooks/*, else web:3000), real ACME"
    - "infra/keygen/setup.sh — idempotent account/keypair + product + policy + entitlement attach + metadata-filter validation (uses /v1)"
    - "infra/keygen/swap.sh — 2 GB swap + vm.swappiness=10 (D-48)"
    - "infra/keygen/.env.example — committed secret TEMPLATE (placeholders only)"
    - "infra/keygen/RUNBOOK.md — human bring-up checklist (provision -> DNS -> bring-up -> LS -> Resend -> secrets -> prod constants -> D-63 live purchase + refund -> grep-clean)"
  modified:
    - "src-tauri/src/license/config.rs — release arm holds REAL prod account id 0d607683… + pubkey huJdyRsB… + KEYGEN_HOST=license.tinkerdev.io"
    - "src-tauri/src/license/keygen_client.rs — base_url drops /accounts/{id}, now https://{host}/v1 (CE singleplayer fix)"
    - "server/webhook/src/keygen.ts — base drops /accounts/{accountId}, now {baseUrl}/v1 (CE singleplayer fix)"
    - "server/webhook/src/config.ts — KEYGEN_BASE_URL (public https, stays on-box); emailReplyTo (EMAIL_REPLY_TO)"
    - "server/webhook/src/email.ts + email.test.ts — Resend reply-to uses replyTo (camelCase; snake_case silently dropped by SDK 6.x); no download line (App Store-bound)"
    - "server/webhook/src/fulfill.ts + index.ts — searchByOrderId wrapped in try/catch -> 500-for-retry (was unhandled -> process crash -> Caddy 502)"

key-decisions:
  - "D-46 full-prod-now honored: a real, reproducible production CE is live (not a staging stub); bring-up driven over SSH on the user's behalf"
  - "CE singleplayer /v1 routing (no account segment) — discovered live; would have broken EVERY production activation + fulfillment had it shipped on the account-scoped path"
  - "Webhook->CE over the box's public https origin (D-55 preserved): admin token never crosses the public internet (loopback), keygen's forced canonical-Host/https requirement satisfied"
  - "LS chosen as MoR (D-61); we do NOT use LS native license API — Keygen CE remains the single source of truth so the offline Ed25519 activation (Phase-19, unchanged) keeps working and the app embeds OUR pubkey, not LS's"
  - "Reply-to to a root-domain M365 alias (licenses@tinkerdev.io), separate from the Resend send-only subdomain (email.tinkerdev.io) which has no inbox"

# Verification
verification:
  automated:
    - "vitest: 889 tests pass (webhook verify/keygen/fulfill/mor/email + UpsellPanel + opener seam)"
    - "tsc --noEmit clean; eslint 0 errors (2 pre-existing unrelated warnings)"
    - "cargo test --release license::config — 4/4 (prod tripwire: real constants embedded, pubkey decodes to 32B + constructs a valid key, salt 64 hex)"
    - "config.rs embeds license.tinkerdev.io; git secret-scan clean (no Resend/LS/admin token / SECRET_KEY_BASE value); no .env tracked"
  live_proven_test_mode:
    - "Real LS TEST-MODE purchase (order 8689915) -> webhook fulfilled -> license minted (ACTIVE, maxMachines=1, entitlements pro.ordering + pro.theming, emailed=true) -> key email received -> in-app activation PASSES against prod CE on a prod-built app (PAY-01/02/03 functionally complete)"
    - "Backend chain proven live: synthetic signed order_created -> mint w/ entitlements + orderId -> Resend email -> mark emailed -> idempotent replay -> bad-sig 401; /v1/licenses/actions/validate-key -> VALID"
  pending_human_gate:
    - "ONE live USD-9 purchase (real money, refunded after) — BLOCKED on Lemon Squeezy store approval/activation, which is itself blocked on a credible product landing page (in progress). This is the only unmet sign-off item; everything testable without LS approval is green."
---

# Plan 20-03 — Production Licensing Infrastructure

## What shipped

The production purchase pipeline is **live and proven end-to-end in test mode**. A buyer pays
once via the Lemon Squeezy (MoR) checkout, the `order_created` webhook mints a node-locked
license in the production Keygen CE (entitlements inherited from the policy), Resend emails the
raw key, and the key activates via the unchanged Phase-19 offline-verification flow against the
app's embedded production pubkey.

Bring-up was driven over SSH on the user's behalf (Hetzner CX23, Caddy real ACME). The
reproducible `infra/keygen/` stack + RUNBOOK are committed (templates only); all secrets live
only on the box.

## Hard-won fixes (cost real debugging)

1. **CE singleplayer `/v1` routing** — Keygen CE in singleplayer mounts the whole API at
   `/v1/...` with **no `/accounts/{id}` segment**; account-scoped routes 404 on a real two-label
   host. The Phase-19 *localhost* CE exposed account-scoped routes via a nil-domain quirk, so the
   19 tests passed but prod would have failed every activation. Fixed across `keygen_client.rs`,
   webhook `keygen.ts`, and `setup.sh`.
2. **Webhook → CE Host routing** — keygen forces HTTPS + the canonical Host, so an internal
   `http://web:3000` gets 403 (wrong Host) / 301 (http→https). Use the box's own public https
   origin (loopback to its public IP) — stays on-host over TLS, admin token never leaves the box
   (D-55 preserved). The `searchByOrderId` failure was also unhandled → process crash → Caddy 502;
   now wrapped → 500-for-retry.
3. **Resend reply-to** — SDK 6.x expects `replyTo` (camelCase); `reply_to` is silently dropped.

## Remaining gate

The only unmet sign-off item is the **live USD-9 purchase** (D-63), blocked on **Lemon Squeezy
store approval** — which requires a credible product site. That landing page is the next task;
once LS activates the store, the live purchase + refund closes PAY-01/02/03 and Phase 20.
