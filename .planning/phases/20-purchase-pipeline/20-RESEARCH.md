# Phase 20: Purchase Pipeline - Research

**Researched:** 2026-06-13
**Domain:** Production licensing/purchase pipeline — MoR checkout → signed webhook → Keygen CE license mint → email delivery; Tauri opener wiring; VPS bring-up
**Confidence:** HIGH on backend/Keygen/opener/Resend/Polar webhook mechanics (verified against Phase-19 live SPIKE + current docs/registry); **MEDIUM-LOW on the D-61 MoR choice** (Lemon Squeezy Singapore bank-payout eligibility could NOT be confirmed — see User Constraints + the D-61 ruling below).

<user_constraints>
## User Constraints (from CONTEXT.md)

These are LOCKED. Research fills in the HOW; it does not re-decide these. Copy into PLAN verbatim.

### Locked Decisions (D-46 .. D-72)

**Production Keygen CE hosting**
- **D-46:** Full prod now — Phase 20 ends with a real production CE live at `license.tinkerdev.io` and the purchase pipeline working end-to-end.
- **D-47:** CE on a **Hetzner CX23** (Cost-Optimized shared, **x86 Intel/AMD**, 2 vCPU / 4 GB / 40 GB SSD, ~€4.79/mo), **EU region**.
- **D-48:** Add **2 GB swap** before CE bring-up (scripted: `fallocate`/`mkswap`/`swapon` + `/etc/fstab` + `vm.swappiness=10`).
- **D-49:** DB backups = **provider snapshots NOW**; offsite pg_dump deferred.
- **D-50:** Whole stack committed in `infra/` (e.g. `infra/keygen/`): compose (CE + Postgres + Redis + webhook + Caddy), TLS config, env **templates** (real secrets gitignored), bring-up/setup/deploy scripts.

**Production CE identity & per-env config**
- **D-51:** Production CE is a **fresh instance with its OWN account + NEW Ed25519 keypair**, distinct from the Phase-19 local-dev CE. New account ID + public key become the production embedded constants.
- **D-52:** **Build-time env switch in `src-tauri/src/license/config.rs`**: dev → `localhost` + local CE pubkey/account; release → `license.tinkerdev.io` + prod pubkey/account. Shipped binary embeds **only** prod values. Honors D-40/D-41.
- **D-53:** Scripted, idempotent CE setup committed in `infra/` (against the CE admin API): creates **policy** (perpetual, node-locked, `maxMachines=1`), product, and **entitlement codes**. Re-runnable on a box rebuild.
- **D-54:** Licenses embed the EXACT Phase-18 gate vocabulary — `pro.theming` + `pro.ordering` (the only two; `pro.ordering` covers reorder+pin+reset). Source: `src/lib/entitlements/entitlements.ts:12-16`. Granular per-entitlement, NOT a coarse `pro` flag.

**Webhook backend**
- **D-55:** Backend = one more container on the same VPS, behind the same Caddy/TLS, in the same compose stack. Reaches CE over **localhost** so the privileged Keygen admin token never crosses the public internet.
- **D-56:** Runtime = **TypeScript/Node** — signature-verify / idempotency / license-create logic unit-tested in the repo's vitest+tsc+eslint suite.
- **D-57:** Code lives in this repo (`server/webhook/` vs `infra/webhook/` — Claude's discretion); secrets in gitignored env.
- **D-58:** **Idempotency via Keygen, not local state** — stamp each created license with the MoR **order ID** in Keygen metadata; on each webhook, search Keygen for that order ID before creating.
- **D-59:** Failure policy = **return 5xx on Keygen-create failure** so the MoR auto-retries (idempotency prevents doubles). After retry exhaustion, an **alert email** fires and the order is fulfilled manually.
- **D-60:** **Webhook signature verification is mandatory** — verify before any Keygen call; reject unsigned/invalid.

**MoR checkout**
- **D-61:** **Lemon Squeezy is the default**, BUT researcher MUST verify LS seller payout support + onboarding for **Singapore** before any plan commits to LS. If LS unavailable for SG, fall back to **Polar** (preferred over Paddle). → **See the D-61 RULING below — this research recommends Polar.**
- **D-62:** One-time price = **USD 9** (lifetime).
- **D-63:** Verification = full e2e in MoR **test mode** (Buy → checkout → webhook → Keygen create → key email → activate via Phase 19), then **one real live purchase**, refunded afterward.

**License key email**
- **D-64:** **Resend** sends the key email. Triggered by the backend after license creation (not the MoR's built-in delivery).
- **D-65:** Sender = `licenses@tinkerdev.io`; `alerts@tinkerdev.io` forwards to the user's inbox via domain email routing. Sending DNS (SPF/DKIM/DMARC on `tinkerdev.io`) set up this phase.
- **D-66:** Email = **plain text**: key, 3-line activation steps, download link for latest release, reply-for-help line.

**In-app Buy wiring + post-purchase UX**
- **D-67:** Open checkout via official **`tauri-plugin-opener`**, scoped to **https URLs only** in capabilities, wrapped behind **`src/lib/platform/`**. Replaces the D-21 `BUY_LICENSE_URL` stub no-op.
- **D-68:** Buy opens an own-domain redirect — **`https://tinkerdev.io/buy`** — controlled by the user (Cloudflare rule or Caddy), forwarding to the live checkout. Compiled URL constant points at `tinkerdev.io/buy`, NOT the raw MoR link.
- **D-69:** Upsell panel copy stays as-is (no pricing, no email-step line).
- **D-70:** Post-checkout the buyer sees the MoR's **success page** configured with "check email" copy.
- **D-71:** **Manual return, no app handoff** — no deep-link / custom URL scheme / polling. Preserves "one user-initiated network call".

**Observability**
- **D-72:** Structured logs (docker/journald) + failure-alert emails + free external uptime monitoring (e.g. UptimeRobot) against CE + webhook **health endpoints** (part of this phase's backend surface).

### Claude's Discretion
- Exact backend directory (`server/webhook/` vs `infra/webhook/`), module layout, HTTP framework.
- Caddy vs alternative reverse proxy / TLS mechanics; exact compose service topology.
- VPS provisioning specifics (image, firewall, SSH hardening) beyond locked CX23/EU/swap/snapshot.
- Exact email copy wording (within D-66) and success-page copy (within D-70).
- The build-time switch mechanism in `config.rs` (`cfg!(debug_assertions)` vs a `DEVTOOLS_ENV` build var) within D-52's "ship prod only" rule.
- Redirect implementation for `tinkerdev.io/buy` (Cloudflare rule vs Caddy).
- Health-endpoint shapes; UptimeRobot vs equivalent free pinger.
- SSH deploy-script mechanics (rsync layout, restart strategy).

### Deferred Ideas (OUT OF SCOPE — do not plan)
- Offsite nightly pg_dump of the license DB (separate follow-up).
- Self-serve license-key resend endpoint (lost-key recovery — backlog/Phase 21).
- Flipping the free-tier default live + reading entitlements out of `machine.lic` (Phase 21).
- Multi-device tier (raise `maxMachines`) — future milestone.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PAY-01 | Buy a lifetime license through an MoR checkout (one-time); an in-app "Buy license" affordance opens the purchase page in the default browser. | tauri-plugin-opener 2.5.4 + `openUrl` behind `src/lib/platform/` (D-67); https-only capability scope; `tinkerdev.io/buy` redirect (D-68). MoR = **Polar** (D-61 ruling) one-time-product checkout. |
| PAY-02 | A purchase-completed webhook triggers a small backend that creates the Keygen license (perpetual, node-locked, `maxMachines=1`, entitlements embedded); privileged Keygen tokens **only** server-side. | Polar `order.paid` webhook (Standard Webhooks sig verify) → Node backend on the VPS → CE admin-token license create over localhost (D-55). Policy carries `pro.theming`/`pro.ordering` entitlements (inherited into every license + checked-out machine file, proven in Phase-19 SPIKE). Admin token never leaves the box. |
| PAY-03 | Buyer receives the license key by email automatically after purchase, and it activates via the Phase-19 flow. | Resend Node SDK `emails.send` (plain text, D-66) from `licenses@tinkerdev.io`; minted key is a normal CE license key → activates unchanged through the Phase-19 `activate_license` flow (SPIKE-proven lifecycle). |
</phase_requirements>

## Summary

Phase 20 is **mostly infra + a small Node service**, not app code. The app-side change is tiny and surgical: replace one no-op (`BUY_LICENSE_URL`'s `void` handler in `UpsellPanel.tsx`) with a `platform.opener.openUrl("https://tinkerdev.io/buy")` call behind a new opener capability seam, plus the D-52 build-time prod/dev constant switch in `config.rs`. Everything else stands up server-side: a production Keygen CE on a Hetzner CX23 behind Caddy auto-TLS at `license.tinkerdev.io`, a TypeScript webhook backend co-located on the box (reaching CE over localhost so the admin token never leaves), and Resend for the key email.

The Phase-19 local SPIKE already proved the *exact* CE API surface this phase reuses with production constants: license create, policy with `authenticationStrategy:"LICENSE"` + `maxMachines:1`, entitlements attached to the policy and surfaced in checked-out machine files, and the unencrypted Ed25519 machine file. The only genuinely new CE-side work is creating the two **entitlement codes** (`pro.theming`, `pro.ordering`) and attaching them to the policy — a CE-supported API path — plus stamping each license with the **order ID in metadata** for D-58 idempotency (license `metadata` + `?metadata[orderId]=` filter are both first-class Keygen API features).

**The one blocking item that did NOT resolve cleanly is D-61.** Lemon Squeezy's supported-countries page is Cloudflare-hardened and 403s every automated fetch (the same wall prior research hit), so I could **not** confirm Singapore is on LS's 79-country *bank-payout* list. Separately, LS was **acquired by Stripe** and is mid-migration into "Stripe Managed Payments" — a real roadmap risk for a brand-new store. **Polar, by contrast, officially and explicitly lists Singapore (🇸🇬) as a supported seller-payout country** (Stripe Connect Express). Given D-61's own fallback rule and "do NOT let a plan silently commit money to LS without this resolved," this research recommends **Polar** as the MoR — confirmed-good for SG, no acquisition-migration risk, `order.paid` is the documented canonical fulfillment event, and there is an official `@polar-sh/sdk` with `validateEvent` for Standard-Webhooks signature verification.

**Primary recommendation:** Build the pipeline against **Polar** (`order.paid` → `@polar-sh/sdk validateEvent` → CE license create with order-ID metadata → Resend). Keep the MoR behind the `tinkerdev.io/buy` redirect (D-68) and the `tinkerdev.io/checkout` event vocabulary abstracted in ONE backend module so a future swap back to LS is a single-file change. If the user can manually confirm (via the logged-in LS dashboard) that LS supports a Singapore bank payout, LS remains viable — but Polar is the safe default to plan against.

## Architecture Patterns

### Recommended Production Topology (D-50, D-55)

```
                          Hetzner CX23 (EU, x86, 4GB + 2GB swap)
                          ┌──────────────────────────────────────────────┐
 Buyer browser ──HTTPS──► │  Caddy (auto-TLS, :80/:443)                    │
   tinkerdev.io/buy       │    ├─ license.tinkerdev.io      → keygen-web   │
   (redirect, D-68)       │    └─ license.tinkerdev.io/webhooks/* → webhook│  (or a separate hooks subdomain)
        │                 │                                                │
        ▼                 │   keygen-web (keygen/api "web")  ┐             │
   Polar checkout         │   keygen-worker ("worker")       ├─ Postgres   │
        │ order.paid      │   webhook (Node/TS) ─localhost──►┘   Redis     │
        ▼                 │     ↑ admin token (env, gitignored)            │
   webhook backend ───────┘     │ POST /v1/accounts/{id}/licenses          │
        │  (verify sig)         │  (metadata.orderId, policy w/ entitlements)
        ├─ search Keygen ?metadata[orderId]=  (D-58 idempotency)
        ├─ create license (perpetual, node-locked, max=1)
        └─ Resend: email key to buyer (D-64/66)   ← licenses@tinkerdev.io
```

### Recommended Repo Layout

```
infra/
├── keygen/
│   ├── compose.yaml          # CE web+worker + postgres + redis + webhook + caddy (extends Phase-19 shape)
│   ├── Caddyfile             # license.tinkerdev.io reverse_proxy; auto-TLS (NOT `tls internal`)
│   ├── .env.example          # templates only; real .env gitignored (D-41/D-50)
│   ├── setup.sh              # idempotent: account/keypair (D-51) + product + policy + entitlements (D-53)
│   ├── swap.sh               # D-48: 2GB swap + swappiness=10 + /etc/fstab
│   └── deploy.sh             # SSH/rsync deploy (Claude's discretion)
server/webhook/               # OR infra/webhook/ (D-57 discretion)
├── src/
│   ├── index.ts              # HTTP server (health + webhook route)
│   ├── verify.ts             # signature verification (pure, unit-tested)
│   ├── keygen.ts             # CE admin client: searchByOrderId, createLicense (pure-ish, unit-tested)
│   ├── fulfill.ts            # orchestrator: verify→search→create→email; 5xx-on-failure (D-59)
│   ├── email.ts              # Resend wrapper (D-64/66)
│   └── mor.ts                # ONE module abstracting the MoR event shape (swap point LS↔Polar)
├── *.test.ts                 # vitest, joins the repo's existing suite (D-56)
```

### Pattern 1: Build-time prod/dev constant switch in `config.rs` (D-52)

`config.rs` today hardcodes the **local-dev** CE constants (`localhost`, the Phase-19 account ID + pubkey). The shipped binary must embed **only** the production CE's account ID + Ed25519 pubkey + `license.tinkerdev.io`, while `tauri dev` keeps the localhost values. Two viable mechanisms (Claude's discretion within D-52):

- **`cfg!(debug_assertions)` / `#[cfg(debug_assertions)]`** — release builds are `debug_assertions=false`. This is the **same idiom already used in `keygen_client.rs:304`** for the dev-only CA path, so it is the consistent, verified choice. Release embeds prod consts; dev embeds local consts. No env var, no runtime config (honors D-52's "no runtime configuration" note).

```rust
// config.rs (illustrative — mirror existing module style)
#[cfg(debug_assertions)]
pub const KEYGEN_HOST: &str = "localhost";
#[cfg(not(debug_assertions))]
pub const KEYGEN_HOST: &str = "license.tinkerdev.io";

#[cfg(debug_assertions)]
pub const KEYGEN_ACCOUNT_ID: &str = "23c88309-2584-4771-81df-1d351672ff91"; // local CE
#[cfg(not(debug_assertions))]
pub const KEYGEN_ACCOUNT_ID: &str = "<PROD-ACCOUNT-UUID>"; // from infra/keygen setup.sh (D-51)

#[cfg(debug_assertions)]
pub const KEYGEN_ED25519_PUBKEY_B64: &str = "ZBd2u102TCpivzVAisQZi7h5YUqhmtT6DA1Ej0YPes4=";
#[cfg(not(debug_assertions))]
pub const KEYGEN_ED25519_PUBKEY_B64: &str = "<PROD-PUBKEY-B64-RAW-32-BYTES>";
```
**Caveat (verify in plan):** `APP_SALT` must **NOT** change between dev and prod, and must NEVER change after first release (config.rs:36-40 — a new salt orphans every activation). Keep ONE salt across both arms. Only host/account/pubkey are env-split.
**Pubkey encoding gotcha (Phase-19 SPIKE):** CE's API exposes `meta.keys.ed25519` as base64-**of-hex**; the committed constant must be base64 of the **raw 32 bytes** (what `ed25519_dalek::VerifyingKey::from_bytes` wants). The prod `setup.sh` must extract+normalize the same way `scripts/keygen-ce/bootstrap.sh:write_pubkey_fixture` does (`rails runner` → `Base64.strict_encode64([hex].pack("H*"))`), then drop the result into the `#[cfg(not(debug_assertions))]` const. `config.rs`'s existing unit tests (decode→32 bytes, valid VerifyingKey) will catch a malformed prod const at build time.

### Pattern 2: Opener seam wrapper (D-67) — mirror the existing platform seam

The platform seam (`src/lib/platform/index.ts` + `tauri.ts` + `browser.ts` + `stub.ts`) is the established Tauri-vs-browser split. Add an `opener` capability the same way `clipboard`/`license` are exposed:

```ts
// index.ts — add to the Platform interface
opener: {
  /** Open an external URL in the default browser. https-only (capability-scoped).
   *  No-op in the browser/test fallback (never navigates jsdom). */
  openUrl(url: string): Promise<void>;
};
// ...and add `get opener() { return active.opener; }` to the `platform` proxy.
```
```ts
// tauri.ts — the ONLY file importing @tauri-apps/*
import { openUrl } from "@tauri-apps/plugin-opener";
// in tauriPlatform:
opener: { openUrl: (url) => openUrl(url) },
```
```ts
// browser.ts + stub.ts — deterministic, NEVER navigate under jsdom/preview:
opener: { openUrl: async () => { /* no-op (test/preview) */ } },
```
Then in `UpsellPanel.tsx`, replace the D-21 stub (line ~316 `void BUY_LICENSE_URL;`) with `void platform.opener.openUrl(BUY_LICENSE_URL);` and change the constant (line 51) to `"https://tinkerdev.io/buy"`. The error path should be calm (the panel already has calm-tone patterns); a failed open is best-effort.

### Pattern 3: Webhook fulfillment orchestrator (D-58/D-59/D-60)

```
POST /webhooks/polar  (raw body required for signature verify)
  1. verify signature over the RAW body            → invalid ⇒ 401 (reject, D-60)
  2. parse; ignore non-"order.paid" events         → 200 (ack, no-op)
  3. extract orderId + customerEmail               → from data.id, data.customer.email
  4. GET /v1/.../licenses?metadata[orderId]=<id>   → already exists? ⇒ 200 (idempotent skip, D-58)
  5. POST /v1/.../licenses  { policy, metadata.orderId }   → on failure ⇒ 5xx (MoR retries, D-59)
  6. Resend: email key to customerEmail            → on failure ⇒ 5xx (retry) + alert (D-59/D-72)
  7. 200
```
**Critical:** signature verification needs the **raw, unparsed** request body. If using a framework, disable JSON body-parsing on the webhook route or capture the raw buffer first. (Hono `c.req.text()`, or Express `express.raw()`.)

### Anti-Patterns to Avoid
- **Verifying the signature against a re-serialized JSON body.** HMAC/Standard-Webhooks sign the exact bytes received; `JSON.parse`→`JSON.stringify` changes them and the check fails. Always verify over the raw body.
- **Local idempotency state (a DB row / file).** D-58 says Keygen IS the source of truth; do not add a second datastore. Search-before-create on `metadata[orderId]`.
- **2xx on Keygen failure.** That swallows the error and the MoR won't retry. D-59 = 5xx so the MoR's retry machinery covers transient CE downtime.
- **Embedding the admin token client-side or in the repo.** Criterion 4 is testable: the token lives ONLY in the gitignored webhook `.env` on the box. The app/repo grep-clean of any privileged token is a verification step.
- **`tls internal` in the production Caddyfile.** That's the Phase-19 *local* posture. Production must use real ACME (Let's Encrypt) for `license.tinkerdev.io` so the Tauri app trusts the cert with its **default** root store — the `DEVTOOLS_KEYGEN_CA` custom-CA path is `#[cfg(debug_assertions)]`-only and is compiled OUT of release (keygen_client.rs:304). A self-signed prod cert would make every release-build activation fail.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Webhook signature verification | Custom HMAC/timestamp parsing | **Polar:** `validateEvent` from `@polar-sh/sdk/webhooks` (or the `standardwebhooks` lib). **LS (if chosen):** `crypto.createHmac('sha256', secret)` + `crypto.timingSafeEqual` over raw body | Standard Webhooks adds timestamp-replay + key-rotation handling; rolling your own invites timing-attack and replay bugs |
| Idempotency / dedupe | A local DB/file of seen order IDs | Keygen license **metadata** + `?metadata[orderId]=` filter (D-58) | Keygen is already the source of truth; a second store is one more thing to back up and to drift |
| Sending email + deliverability | Raw SMTP / nodemailer + your own SPF/DKIM signing | **Resend** `emails.send` + Resend-managed DKIM | DKIM signing, bounce handling, and IP reputation are the hard parts; Resend does them |
| TLS certs + renewal | certbot cron + nginx config | **Caddy** automatic HTTPS (ACME, auto-renew, persisted in a named volume) | One-line `reverse_proxy`; renewal is automatic; the Phase-19 Caddyfile already proves the shape |
| Opening the browser | `Command::new("open")` / shelling out | **`tauri-plugin-opener`** `openUrl` (D-67) | Cross-platform, capability-scoped to https, no shell-injection surface |
| Keygen license/policy/entitlement creation | Raw multi-call orchestration without lookup | Reuse the **Phase-19 `bootstrap.sh` pattern** (lookup-by-name then create; idempotent) extended with entitlement create+attach | The SPIKE already debugged the JSON:API content-types, the `authenticationStrategy:"LICENSE"` pitfall, and the pubkey-encoding gotcha |

**Key insight:** ~90% of this phase's CE API surface was already exercised live in the Phase-19 SPIKE (`scripts/keygen-ce/spike.sh` + `bootstrap.sh`). The production work is *re-pointing* those proven calls at a public host with real TLS and a fresh account/keypair, plus the two genuinely-new bits: **entitlement codes** and **license metadata**.

## Common Pitfalls

### Pitfall 1: Lemon Squeezy Singapore payout cannot be machine-verified (D-61 BLOCKER)
**What goes wrong:** A plan commits the store/checkout to LS, the user completes the live D-63 purchase, and the funds can't be paid out to a Singapore bank (LS bank payouts cover 79 countries; SG membership UNCONFIRMED).
**Why it happens:** `docs.lemonsqueezy.com/help/getting-started/supported-countries` and the whole `lemonsqueezy.com` domain are Cloudflare-hardened and **403 every automated fetch** — the exact wall prior research hit. Search snippets confirm "79 bank-payout countries / 200+ PayPal" but never enumerate SG.
**How to avoid:** **Plan against Polar** (SG confirmed). If the user insists on LS, the user must personally confirm SG bank-payout eligibility from the logged-in LS dashboard (Settings → Payouts) BEFORE the store is created — and accept PayPal-only as the fallback if bank isn't offered.
**Warning signs:** Any plan task that says "create the Lemon Squeezy store" with no preceding human SG-confirmation gate.

### Pitfall 2: Lemon Squeezy is mid-acquisition into Stripe Managed Payments
**What goes wrong:** Building a brand-new LS store now risks an account migration / product sunset mid-flight.
**Why it happens:** Stripe acquired Lemon Squeezy (announced 2024; "2026 Update: Lemon Squeezy + Stripe Managed Payments" blog) and is folding LS into Stripe's own MoR product, still in public preview. New-store signup/activation docs still exist, so onboarding isn't closed — but the roadmap is in flux.
**How to avoid:** Polar has no such overhang. If LS is chosen anyway, isolate all LS specifics behind the single `mor.ts` module so a forced migration is contained.
**Warning signs:** N/A — this is a standing strategic risk, surfaced for the user to weigh.

### Pitfall 3: Production Caddy must use real ACME, not `tls internal`
**What goes wrong:** Reusing the Phase-19 `Caddyfile` (`tls internal`) in production yields a self-signed cert; every **release-build** activation fails because the custom-CA trust path is compiled out of release.
**Why it happens:** `keygen_client.rs:304` gates `DEVTOOLS_KEYGEN_CA` behind `#[cfg(debug_assertions)]`; release builds use only the OS default roots.
**How to avoid:** Production `Caddyfile` = `license.tinkerdev.io { reverse_proxy keygen-web:3000 }` (no `tls` block ⇒ automatic Let's Encrypt). Ensure ports 80 + 443 are open (HTTP-01 challenge) and DNS A-record points at the VPS before first boot.
**Warning signs:** App activation works in `tauri dev` against prod but fails in a packaged build.

### Pitfall 4: Single-label vs two-label host (`KEYGEN_DOMAIN`)
**What goes wrong:** CE web/worker crash at boot, or `accounts#show` routes 404.
**Why it happens (Phase-19 SPIKE finding):** `localhost` is single-label → CE derives a nil domain and crashes unless `KEYGEN_DOMAIN=localhost` is set explicitly. `license.tinkerdev.io` is a **two-label** host, so the route-constraint 404 the SPIKE saw on `GET /v1/accounts/{id}` will NOT recur in production — but still set `KEYGEN_HOST` / `KEYGEN_DOMAIN` correctly for the public host.
**How to avoid:** In the prod `.env`: `KEYGEN_HOST=license.tinkerdev.io`, `KEYGEN_DOMAIN=license.tinkerdev.io`, `KEYGEN_EDITION=CE`, `KEYGEN_MODE=singleplayer`, plus the fresh `KEYGEN_ACCOUNT_ID` (D-51).
**Warning signs:** web container restart-looping; `nil DOMAIN` in logs.

### Pitfall 5: Raw body lost before signature verification
**What goes wrong:** Signature check always fails because the body was JSON-parsed/re-serialized.
**How to avoid:** Capture the raw request body for the webhook route (Hono `await c.req.text()`; Express `express.raw({type:'*/*'})`). Verify, THEN parse.
**Warning signs:** Every webhook 401s even with a correct secret.

### Pitfall 6: OOM during CE migration on the 4 GB box
**What goes wrong:** The CE setup/migration container or a Ruby spike OOM-kills Postgres.
**How to avoid:** Run `infra/keygen/swap.sh` (D-48: 2 GB swap, `vm.swappiness=10`) **before** `docker compose run --rm setup`. This is a hard ordering dependency in the bring-up plan.

### Pitfall 7: `noeviction` Redis policy
**What goes wrong:** Sidekiq jobs (machine-file checkout, etc.) silently drop under memory pressure.
**Why:** Keygen docs recommend Redis `maxmemory-policy noeviction` for background jobs.
**How to avoid:** Set it in the redis service config in the prod compose.

### Pitfall 8: `docker compose` profiles unreliable on the box's Compose version
**What goes wrong (Phase-19 finding):** The `setup` one-shot leaks into `up`.
**How to avoid:** Mirror the Phase-19 compose — NO profile keys; run setup explicitly via `docker compose run --rm setup`, never list it in `up`.

## Code Examples

### Polar webhook verify + order.paid handling (recommended MoR)
```ts
// Source: polar.sh/docs/integrate/webhooks (Standard Webhooks); @polar-sh/sdk/webhooks
// [CITED: polar.sh/docs/integrate/webhooks/events] [VERIFIED: npm @polar-sh/sdk@0.48.1]
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";

// rawBody: string (the exact bytes received); headers: Record<string,string>
// Standard Webhooks headers: webhook-id, webhook-timestamp, webhook-signature
try {
  const event = validateEvent(rawBody, headers, process.env.POLAR_WEBHOOK_SECRET!);
  if (event.type === "order.paid") {
    const orderId = event.data.id;               // → Keygen metadata.orderId (D-58)
    const email   = event.data.customer.email;   // → Resend recipient (D-64)
    // event.data.product.id / event.data.amount available for sanity checks
    // ... fulfill ...
  }
  return new Response("ok", { status: 200 });
} catch (e) {
  if (e instanceof WebhookVerificationError) return new Response("invalid", { status: 401 });
  throw e; // unexpected → let it 5xx so Polar retries (D-59)
}
```
Note: `order.paid` is documented as "the most reliable event for fulfillment." (Polar's older `order.created` fires before payment settles — use `order.paid`.)

### Lemon Squeezy webhook verify (only if the user confirms SG payout)
```ts
// Source: docs.lemonsqueezy.com/help/webhooks/signing-requests
// [CITED: docs.lemonsqueezy.com/help/webhooks/signing-requests]
import crypto from "node:crypto";
const hmac = crypto.createHmac("sha256", process.env.LS_WEBHOOK_SECRET!);
const digest = Buffer.from(hmac.update(rawBody).digest("hex"), "utf8");
const sig = Buffer.from(req.get("X-Signature") || "", "utf8");
if (!crypto.timingSafeEqual(digest, sig)) throw new Error("Invalid signature.");
// payload: meta.event_name === "order_created"; meta.custom_data (checkout custom data);
// data.id (order id); data.attributes.user_email (buyer email); data.attributes.first_order_item
```

### Keygen CE: create entitlements + attach to policy (D-53/D-54 — NEW in Phase 20)
```bash
# [CITED: keygen.sh/docs/api/entitlements/] — admin-token auth, JSON:API content-type.
# Extend the Phase-19 bootstrap.sh idempotent lookup-then-create pattern.

# 1) Create each entitlement (code is the stable identifier embedded in licenses)
POST /v1/accounts/{acct}/entitlements
{ "data": { "type": "entitlements",
    "attributes": { "name": "Pro Theming", "code": "pro.theming" } } }
# repeat for { "name": "Pro Ordering", "code": "pro.ordering" }

# 2) Attach BOTH to the perpetual-node-locked policy (inherited by every license)
POST /v1/accounts/{acct}/policies/{policy}/relationships/entitlements
{ "data": [ { "type": "entitlements", "id": "<theming-id>" },
            { "type": "entitlements", "id": "<ordering-id>" } ] }
```
Policy-attached entitlements automatically propagate to all licenses on that policy and appear in checked-out machine files when the activation flow uses `include=license.entitlements` — which the Phase-19 checkout already does (`spike.sh:134`). So Phase 21's "read entitlements out of machine.lic" gets the right data with no extra Phase-20 work beyond attaching them here.

### Keygen CE: idempotent license create with order-ID metadata (D-58)
```bash
# [CITED: keygen.sh/docs/api/licenses/] + [CITED: keygen.sh/docs/api/metadata/]
# Search first (idempotency), create only if absent:
GET  /v1/accounts/{acct}/licenses?metadata[orderId]={ORDER_ID}      # → empty data[] ⇒ create
POST /v1/accounts/{acct}/licenses
{ "data": { "type": "licenses",
    "attributes": { "metadata": { "orderId": "{ORDER_ID}" } },
    "relationships": { "policy": { "data": { "type": "policies", "id": "{POLICY_ID}" } } } } }
# Response data.attributes.key = the license key emailed to the buyer (D-64).
```

### Resend: plain-text key email (D-64/D-66)
```ts
// Source: resend.com/docs/send-with-nodejs  [VERIFIED: npm resend@6.12.4]
import { Resend } from "resend";
const resend = new Resend(process.env.RESEND_API_KEY!);
await resend.emails.send({
  from: "TinkerDev Licenses <licenses@tinkerdev.io>", // D-65 sender; domain DNS-verified
  to: [buyerEmail],
  subject: "Your TinkerDev license key",
  text: [                                              // D-66: plain text only
    "Thanks for buying TinkerDev!",
    "",
    `Your license key: ${licenseKey}`,
    "",
    "To activate:",
    "  1. Open TinkerDev",
    "  2. Open Unlock Pro (sidebar footer)",
    "  3. Paste your key and click Activate",
    "",
    "Download the latest version: https://github.com/bklim5/devtools-releases/releases/latest",
    "",
    "Questions? Just reply to this email.",
  ].join("\n"),
});
```

### tauri-plugin-opener: https-only capability (D-67)
```jsonc
// src-tauri/capabilities/default.json — add the permission (mirrors existing entries)
// [CITED: v2.tauri.app/plugin/opener + /reference/javascript/opener]
"opener:allow-open-url"
```
```jsonc
// Scope restriction to https — the opener scope is a REGEX (default allows mailto/tel/https?).
// Override the default to https-only. Verify exact scope-config placement in the plan
// (plugin scope config, e.g. in the capability's `scope` or the permission's allow list).
{ "open": "^https://.+" }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tauri-plugin-shell` `open()` for URLs | `tauri-plugin-opener` `openUrl` | Tauri 2 (opener split out of shell) | Use opener; shell-open is deprecated for this. Opener is the D-67 choice. |
| Lemon Squeezy as independent MoR | LS folding into **Stripe Managed Payments** (post-acquisition) | 2024 acq.; 2026 migration in preview | LS roadmap uncertain for new stores — strengthens the Polar recommendation. |
| Keygen cloud Dev tier | Self-hosted **CE** (free, commercial-OK) | locked in Phase 19 (D-40) | Production CE on the CX23; same image (`keygen/api:latest`) the SPIKE used. |
| Polar `order.created` for fulfillment | Polar **`order.paid`** ("most reliable for fulfillment") | current Polar docs | Bind the webhook to `order.paid`, not `order.created`. |

**Deprecated/outdated:**
- `tauri-plugin-shell` for opening URLs → `tauri-plugin-opener`.
- Phase-19 `Caddyfile` `tls internal` → production must use real ACME.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | **Lemon Squeezy does NOT (verifiably) support a Singapore bank payout** — could not confirm; recommending Polar instead. | Pitfall 1 / D-61 ruling | If LS *does* support SG and the user prefers LS, we built against Polar unnecessarily (low cost — `mor.ts` isolates the swap). If a plan commits to LS without confirming, real money may be unpayable. **Needs user confirmation.** |
| A2 | Keygen **CE** supports license `metadata` and the `?metadata[orderId]=` filter (D-58 hinges on this). Docs describe metadata as a core API feature; CE is "best-effort" and the self-hosting page lists only *Enterprise*-gated features (request/event logs, environments, permissions, import/export) — metadata/entitlements are NOT in that exclusion list, and the Phase-19 SPIKE already saw entitlements work on CE. | Don't Hand-Roll / D-58 | If CE silently ignores metadata, D-58 idempotency breaks. **Verify on the live prod CE during bring-up: create a license with metadata, then GET with the metadata filter.** Cheap to test; do it in the setup-validation step. |
| A3 | The opener scope override syntax `{ "open": "^https://.+" }` restricts `openUrl` to https. Default regex is `^((mailto:\w+)|(tel:\w+)|(https?://\w+)).+`. | Code Examples / D-67 | If the scope-config placement differs in plugin 2.5.4, https-only scoping may not apply. **Verify exact placement (capability `scope` vs permission `allow`) against the installed plugin version when wiring.** |
| A4 | `cfg!(debug_assertions)` cleanly separates dev vs release constants and `tauri build` always sets `debug_assertions=false`. (Matches the existing `keygen_client.rs:304` idiom.) | Pattern 1 / D-52 | If a custom release profile enabled debug-assertions, the binary would ship localhost constants. **Verify `[profile.release]` doesn't override `debug-assertions`, and grep the packaged binary for `license.tinkerdev.io` (present) and `localhost` Keygen host (absent) as a build check.** |
| A5 | Polar `order.paid` payload exposes `data.id`, `data.customer.email`, `data.product.id`, `data.amount`, `data.metadata`. | Code Examples | If field paths differ slightly, fulfillment extraction breaks. **Verify against a real test-mode `order.paid` payload during D-63 e2e (log the raw event once).** |
| A6 | Resend free tier (3k emails/mo per D-64) is current and sufficient. Could not confirm the exact free-tier cap from docs (rate limit 5 req/s confirmed; monthly cap not shown on the fetched page). | Environment Availability | If the free cap is lower, volume is still trivially under it at $9 one-time sales. Low risk. |

## Open Questions

1. **D-61 final MoR choice — Polar vs Lemon Squeezy.**
   - What we know: Polar officially lists Singapore (🇸🇬) for seller payouts; LS bank payouts cover 79 unconfirmed countries; LS is mid-Stripe-migration. Polar = `order.paid`, Standard Webhooks, official `@polar-sh/sdk`. Polar fee snapshot: ~5%+, sub-5% needs a paid tier (re-verify current pricing at store creation); 14-day account review + KYC.
   - What's unclear: Whether LS supports an SG **bank** payout (page 403s to automation).
   - Recommendation: **Plan against Polar.** Gate any LS path behind a human "I confirmed SG bank payout in the LS dashboard" check. Keep `mor.ts` as the single swap point.

2. **`tinkerdev.io/buy` redirect target before the store exists.**
   - The redirect (D-68, Cloudflare rule or Caddy) must point at the *live* Polar checkout URL, which only exists after the Polar product/checkout is created. Sequence the redirect-config task AFTER store creation; until then `tinkerdev.io/buy` can 404/placeholder (the app constant can ship pointing at it — D-68's whole point is the indirection).

3. **Health-endpoint shapes (D-72).**
   - CE exposes a health route (`/v1/health` style); the webhook backend needs its own `/health`. Confirm CE's exact health path during bring-up; wire UptimeRobot at both.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Hetzner CX23 VPS (EU, x86) | D-47 CE host | ✗ (must provision) | — | None — blocking; provision as first infra task |
| `tinkerdev.io` domain + DNS control | license subdomain, email DNS, /buy redirect | ✓ (user-owned, D-133 specifics) | — | None |
| Docker + Compose (on VPS) | CE + webhook + Caddy stack | ✗ (install on VPS) | install latest | None |
| `keygen/api:latest` image | CE | ✓ (multi-arch, used in Phase 19) | api 1.8 / rev 055c872 (SPIKE) | None |
| Postgres ≥13 / Redis ≥6.2 | CE | via compose | postgres:17.5, redis (Phase-19 shape) | None |
| Polar account (seller, SG) | MoR checkout | ✗ (user signup + KYC) | — | LS only if SG bank payout confirmed |
| Resend account + verified `tinkerdev.io` | D-64 email | ✗ (signup + DNS) | resend@6.12.4 | None for auto-delivery |
| `tauri-plugin-opener` | D-67 Buy wiring | ✗ (add dep) | 2.5.4 (crate + npm, verified) | None |
| `@polar-sh/sdk` | webhook verify | ✗ (add dev/server dep) | 0.48.1 (verified) | `standardwebhooks@1.0.0` |
| UptimeRobot (or free pinger) | D-72 uptime | ✗ (signup, free) | — | any free HTTP pinger |
| Cloudflare Email Routing (alerts alias) | D-65 alerts forward | depends on DNS host | — | any forwarding rule on the DNS provider |

**Missing dependencies with no fallback (blocking — sequence early):** Hetzner VPS, Docker on VPS, Polar seller account (KYC has a ~14-day review — **start this first**, it's the long pole), Resend domain verification (DNS propagation), the opener plugin.

**Missing dependencies with fallback:** MoR (Polar default ↔ LS if SG-confirmed); webhook-verify lib (`@polar-sh/sdk` ↔ `standardwebhooks`); uptime pinger (any free one).

## Validation Architecture

> nyquist_validation is enabled (config.json has no `workflow.nyquist_validation:false`). Two test surfaces: the existing **vitest** unit suite (the webhook backend joins it, D-56) and the **real-WKWebView wdio e2e** gate (the Buy-wiring UI proof). Plus a live D-63 purchase as the human ship-proof.

### Test Framework
| Property | Value |
|----------|-------|
| Unit framework | vitest (repo suite; webhook backend joins it — D-56) + `tsc --noEmit` + eslint, enforced by lefthook per commit |
| Quick run command | `pnpm test` (vitest run) ; `pnpm exec tsc --noEmit` ; `pnpm lint` |
| E2E framework | webdriverio + Mocha against the real WKWebView (`bash scripts/e2e-spike.sh`) |
| E2E run command | `bash scripts/e2e-spike.sh` (starts `tauri dev --features webdriver`, polls :4445, runs `pnpm e2e`) |
| Rust | `cargo test` (config.rs const tests already guard a malformed prod pubkey) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PAY-02 | Signature verify rejects unsigned/invalid; accepts valid | unit | `pnpm test` → `server/webhook/verify.test.ts` | ❌ Wave 0 |
| PAY-02 | Idempotency: existing-orderId ⇒ no second create | unit | `pnpm test` → `server/webhook/keygen.test.ts` (mocked CE search) | ❌ Wave 0 |
| PAY-02 | License-create payload shape (policy rel + metadata.orderId) | unit | `pnpm test` → `server/webhook/keygen.test.ts` | ❌ Wave 0 |
| PAY-02 | Keygen-create failure ⇒ 5xx (MoR retry, D-59) | unit | `pnpm test` → `server/webhook/fulfill.test.ts` | ❌ Wave 0 |
| PAY-02 | order.paid → orderId + email extraction (MoR payload mapping) | unit | `pnpm test` → `server/webhook/mor.test.ts` | ❌ Wave 0 |
| PAY-03 | Email composed with key + activation steps (Resend client mocked) | unit | `pnpm test` → `server/webhook/email.test.ts` | ❌ Wave 0 |
| PAY-01 | Buy button invokes opener.openUrl with the https `tinkerdev.io/buy` URL; no in-page navigation | unit | `pnpm test` → `src/components/UpsellPanel.test.tsx` (extend; assert opener seam called, replaces the current stub assertion) | ✅ exists (update) |
| PAY-01 | Opener seam: browser/stub arms are no-ops (never navigate jsdom) | unit | `pnpm test` → `src/lib/platform/platform.test.ts` (extend) | ✅ exists (update) |
| PAY-01 | Real-WKWebView: clicking Buy invokes the native opener (https), panel does not navigate | e2e | `bash scripts/e2e-spike.sh` → `test/e2e/license-buy.e2e.ts` (NEW; native open is non-observable in webview — assert the IPC/seam call + no route change; the actual browser-open is a MANUAL walkthrough item per HARNESS native-input note) | ❌ Wave 0 |
| D-52 | Release binary embeds prod CE host/account/pubkey; NOT localhost | build check | grep packaged binary: `license.tinkerdev.io` present, `localhost` Keygen host absent (extend the existing dist-grep gate) | ❌ Wave 0 |
| PAY-01/02/03 | **Full live pipeline** (Buy→Polar test mode→order.paid→CE create→Resend→activate via Phase-19) then ONE live purchase, refunded (D-63) | manual / human ship-gate | walkthrough against live `license.tinkerdev.io` (mint not required — real purchase mints it) | ❌ Wave 0 (runbook) |

### Sampling Rate
- **Per task commit:** `pnpm test` + `pnpm exec tsc --noEmit` + `pnpm lint` (+ `cargo test` for config.rs). The decoder's 19 tests stay green (untouched).
- **Per wave merge:** full vitest suite + `bash scripts/e2e-spike.sh`.
- **Phase gate:** full suite green → `pnpm tauri build` → human D-63 live-purchase walkthrough + `gsd-ui-review` WCAG-AA audit on the Buy affordance.

### Wave 0 Gaps
- [ ] `server/webhook/` (or `infra/webhook/`) test files: `verify.test.ts`, `keygen.test.ts`, `fulfill.test.ts`, `mor.test.ts`, `email.test.ts` — cover PAY-02/PAY-03 (mock CE HTTP + Resend; no live calls in unit tests).
- [ ] Ensure the new backend package is included in the repo's vitest + tsc + eslint config (D-56) — confirm `tsconfig`/eslint globs reach `server/`.
- [ ] `test/e2e/license-buy.e2e.ts` — Buy-wiring real-WKWebView proof (assert opener seam invoked, no navigation).
- [ ] Update `src/components/UpsellPanel.test.tsx` — current test asserts the D-21 stub no-op; rewrite to assert `opener.openUrl` is called with the https URL.
- [ ] Extend the D-32/D-52 dist-grep build check for the prod-constant assertion.
- [ ] A documented D-63 live-purchase runbook (manual ship-gate; native browser-open + real money are not automatable).

*(Existing infra: vitest + wdio + lefthook + dist-grep gate all already present; the gaps are new test files, not new frameworks.)*

## Security Domain

> security_enforcement is enabled (absent = enabled). This phase introduces the first internet-facing surface in the project, so security is load-bearing.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | CE admin token (Bearer) for license create — server-side only, gitignored env (D-55). Webhook authenticated by signature, not a shared bearer. |
| V3 Session Management | no | Stateless webhook; no sessions. |
| V4 Access Control | yes | Admin token reaches CE over **localhost only** (D-55) — never exposed publicly via Caddy. App holds NO privileged token (criterion 4). |
| V5 Input Validation | yes | Verify signature BEFORE parsing (D-60); validate event type + required fields (orderId, email) before any CE/email call. |
| V6 Cryptography | yes | **Never hand-roll** — `@polar-sh/sdk validateEvent` / `standardwebhooks` (Polar) or `crypto.timingSafeEqual` over raw body (LS). Ed25519 license signing is CE-internal (untouched). |
| V9 Communications | yes | Caddy automatic HTTPS (real ACME) for `license.tinkerdev.io`; TLS for all CE↔app traffic; webhook endpoint HTTPS-only. |
| V14 Configuration | yes | Secrets (admin token, `SECRET_KEY_BASE`, ENCRYPTION_* keys, Resend key, Polar webhook secret) in gitignored env (D-41/D-50); firewall: expose only 80/443; SSH-harden the box (Claude's discretion). |

### Known Threat Patterns for {Node webhook backend + public Keygen CE}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Forged/replayed webhook ⇒ free license minted | Spoofing | Mandatory signature verify over raw body (D-60); Standard Webhooks timestamp window (Polar) bounds replay |
| Privileged Keygen token leaking to client/repo | Information Disclosure | Token in gitignored server `.env`; localhost-only CE reach (D-55); grep-clean the bundle+repo (criterion 4, a verification step) |
| Double-charge / double-mint on retry | Tampering/Repudiation | D-58 idempotency: search `metadata[orderId]` before create |
| CE/webhook down ⇒ buyer pays, no key | Denial of Service / availability | D-59 5xx→MoR retry + alert email; D-72 uptime monitoring on health endpoints; provider snapshots (D-49) for DB-loss recovery |
| Self-signed/expired prod TLS ⇒ activation fails closed | Tampering/availability | Real ACME via Caddy (Pitfall 3); auto-renew; persist Caddy data volume |
| Timing attack on signature compare | Information Disclosure | `crypto.timingSafeEqual` (LS) / library constant-time compare (Polar) |
| SSRF / open redirect via `tinkerdev.io/buy` | Tampering | Redirect target is a fixed, user-controlled Polar URL (D-68); opener capability scoped to `^https://` (D-67) so the app can't be coerced to open arbitrary schemes |

## Project Constraints (from CLAUDE.md)

Research must not contradict these; the planner verifies compliance.
- **HashRouter only** — no `BrowserRouter`. (No new routes this phase — Buy wiring is in-panel; the post-purchase page is the MoR's, not in-app, D-70/D-71.)
- **Six tools only** — N/A (no tools added).
- **No network at runtime** EXCEPT the licensing surface — the Buy `openUrl` is a user-initiated action that hands off to the OS browser (no in-app fetch); preserves "one user-initiated network call" (D-71). The opener is NOT an in-app network call.
- **Tools import `src/lib/platform/`, never `@tauri-apps/*` directly** — the opener MUST go behind the platform seam (D-67); only `tauri.ts` imports `@tauri-apps/plugin-opener`.
- **Do NOT refactor `decoder.ts` or its 19 tests** — untouched; 19 tests are the immovable bar.
- **Self-host fonts / no CDN at runtime** — unaffected (email download link points at the GitHub releases repo, opened in the browser, not fetched by the app).
- **Committed constants safe under a public repo** — only the prod **public** key + account ID + `tinkerdev.io/buy` URL are committed; admin token, CE `SECRET_KEY_BASE`/ENCRYPTION_* keys, Resend key, Polar webhook secret stay gitignored/server-side (D-41/D-50).
- **Build+verify harness (binding):** per task `/simplify` → `/codex:review` → unit green (vitest+tsc) → real-WKWebView UI verify; per phase boundary `pnpm tauri build` + human walkthrough + `gsd-ui-review`. The webhook backend joins the same vitest/tsc/eslint lefthook gate (D-56).
- **TDD note (memory):** lefthook rejects failing tsc/vitest, so no standalone RED-only test commit — land tests GREEN with their impl.

## Sources

### Primary (HIGH confidence)
- Phase-19 live SPIKE: `.planning/phases/19-license-activation-offline-verification/19-SPIKE-OUTCOME.md`, `scripts/keygen-ce/{spike.sh,bootstrap.sh,compose.yaml,Caddyfile}` — exact CE API shapes, policy/auth pitfalls, pubkey encoding, machine-file checkout (entitlements include).
- Codebase: `src/lib/platform/{index,tauri,browser,stub}.ts`, `src-tauri/src/license/{config.rs,keygen_client.rs}`, `src/lib/entitlements/entitlements.ts`, `src/components/UpsellPanel.tsx`, `docs/HARNESS.md`, `package.json`, `src-tauri/Cargo.toml`, `src-tauri/capabilities/default.json`.
- [VERIFIED registry] npm: `resend@6.12.4`, `@polar-sh/sdk@0.48.1`, `standardwebhooks@1.0.0`, `@lemonsqueezy/lemonsqueezy.js@4.0.0`; crate+npm `tauri-plugin-opener@2.5.4`.
- [CITED] keygen.sh/docs: self-hosting (CE env vars, setup, Postgres≥13/Redis≥6.2), api/licenses (metadata + `?metadata[orderId]=` filter), api/entitlements (create + policy attach + machine-file inheritance).
- [CITED] v2.tauri.app/plugin/opener + /reference/javascript/opener — install, `openUrl`, `opener:allow-open-url`, scope regex.
- [CITED] resend.com/docs/send-with-nodejs — `emails.send` plain text.

### Secondary (MEDIUM confidence)
- [CITED] polar.sh/docs/merchant-of-record/supported-countries — **Singapore (🇸🇬) confirmed for seller payouts** (fetched directly, 200 OK).
- [CITED] polar.sh/docs/integrate/webhooks/events + hooksbase Polar guide — Standard Webhooks (`webhook-id/timestamp/signature`), `validateEvent`, `order.paid` is "most reliable for fulfillment", payload `data.id`/`data.customer.email`/`data.product.id`/`data.amount`/`data.metadata`.
- [CITED] docs.lemonsqueezy.com/help/webhooks/signing-requests (via search snippet + community examples) — `X-Signature`, HMAC-SHA256 over raw body, `timingSafeEqual`, `meta.custom_data`/`data.attributes.user_email`.
- [CITED] Caddy production-HTTPS guides — automatic ACME, persist data volume, directory-mount Caddyfile.

### Tertiary (LOW confidence — flagged for validation)
- **Lemon Squeezy Singapore BANK-payout eligibility: UNVERIFIED.** `docs.lemonsqueezy.com/.../supported-countries` and `lemonsqueezy.com/blog/*` 403 every automated fetch (Cloudflare). Only "79 bank-payout / 200+ PayPal" totals confirmed via search snippets — SG never enumerated. → A1, drives the D-61 ruling toward Polar.
- LS Stripe-acquisition / Managed-Payments migration status (search snippets: fungies.io, f3fundit, designrevision) — directional, not load-bearing beyond "roadmap risk".
- Resend monthly free-tier cap (3k/mo per D-64) not reconfirmed from the fetched page (rate limit 5 req/s confirmed). → A6, low risk.

## Metadata

**Confidence breakdown:**
- Standard stack / backend mechanics: HIGH — versions registry-verified; webhook/Keygen/Resend/opener APIs cited from official docs and cross-checked against the Phase-19 live SPIKE.
- CE production bring-up: HIGH — direct extension of a proven local SPIKE; the only deltas (real ACME, two-label host, fresh keypair, entitlement codes, metadata) are each documented.
- **MoR choice (D-61): MEDIUM-LOW** — Polar SG support is confirmed and recommended; LS SG bank-payout could not be machine-verified (Cloudflare 403). Needs user confirmation if LS is still desired.
- Pitfalls / security: HIGH — drawn from project memory, the SPIKE, and the release/debug-assertions + custom-CA code paths.

**Research date:** 2026-06-13
**Valid until:** ~2026-07-13 (30 days) for Keygen/Resend/Tauri/Caddy mechanics; **~7 days** for the MoR landscape (LS↔Stripe migration is actively moving) — re-verify Polar fees + LS status at store-creation time.
