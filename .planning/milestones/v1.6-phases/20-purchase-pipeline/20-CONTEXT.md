# Phase 20: Purchase Pipeline - Context

**Gathered:** 2026-06-13
**Status:** Ready for planning

<domain>
## Phase Boundary

A buyer pays once through a merchant-of-record checkout and **automatically** receives a working license key by email — no manual fulfillment, no privileged credentials anywhere near the app. Covers **PAY-01, PAY-02, PAY-03**. This phase stands up the **production** licensing infrastructure (real Keygen CE on a VPS at `license.tinkerdev.io`), a webhook backend that mints licenses, MoR checkout, and key-delivery email; it wires the in-app "Buy license" stub (D-21) to open the real checkout.

**In scope:** production CE bring-up; webhook backend (signature verify → Keygen license create → email); Lemon Squeezy store/checkout; Resend key email; opener-plugin Buy wiring; build-time prod/dev config switch in `config.rs`; committed `infra/`; full e2e in LS test mode + one live purchase.

**Out of scope (Phase 21):** TTL refresh/grace (LIC-05), self-serve transfer (LIC-07), revocation propagation (LIC-08), status UI (LIC-09), **flipping the free-tier default live** (Phase 21 owns the in-Tauri default flip), and the full 8-case ship-gate matrix on a fresh build. **Deferred (not this phase):** offsite pg_dump backups; self-serve lost-key resend endpoint.

**Untouched:** `decoder.ts` + its 19 tests; the Phase 19 Rust license core's verification logic (this phase only swaps per-env constants, per D-40).

</domain>

<decisions>
## Implementation Decisions

### Production Keygen CE hosting
- **D-46:** **Production scope is "full prod now"** — Phase 20 ends with a real production CE live at `license.tinkerdev.io` and the real purchase pipeline working end-to-end. This satisfies PAY criteria literally (buyer receives a *working* key); Phase 21's ship gate then runs against real infra.
- **D-47:** CE lives on a **Hetzner CX23** (Cost-Optimized shared, **x86 Intel/AMD**, 2 vCPU / 4 GB / 40 GB SSD, ~€4.79/mo), **EU region**. Verified adequate: CE stack (Ruby Puma+Sidekiq) + Postgres + Redis + Node webhook + Caddy idles ~1–1.8 GB; one-time-activation traffic is near-zero sustained CPU. "Limited availability" = provisioning stock, not uptime.
- **D-48:** **Add 2 GB swap before CE bring-up** — Ruby + the CE migration/setup container can spike memory; swap prevents OOM-killing Postgres on the 4 GB box. Scripted in `infra/` (`fallocate`/`mkswap`/`swapon` + `/etc/fstab` + `vm.swappiness=10`).
- **D-49:** **Database backups = provider snapshots NOW** (one toggle). Offsite nightly pg_dump is a **deferred separate follow-up** (see Deferred) — not blocking this phase. Losing the license DB breaks TTL refresh/transfer/revocation for all buyers, so snapshots are the phase-20 floor.
- **D-50:** The **whole stack is committed in `infra/`** (e.g. `infra/keygen/`): docker-compose (CE + Postgres + Redis + webhook + Caddy), TLS config, env **templates** (real secrets gitignored), and bring-up/setup/deploy scripts. Same reproducible pattern as Phase 19's local CE bring-up.

### Production CE identity & per-env config
- **D-51:** Production CE is a **fresh instance with its OWN account + a NEW Ed25519 keypair**, distinct from the Phase 19 local-dev CE. The new account ID + public key become the production embedded constants.
- **D-52:** **Build-time env switch in `src-tauri/src/license/config.rs`:** dev build → `localhost` + local CE pubkey/account; **release build → `license.tinkerdev.io` + prod pubkey/account**. The shipped binary embeds **only** prod values; local dev keeps working unchanged. Honors D-40 (per-env config = constants change at ship gate) and D-41 (only the **public** key + app-salt are committed; private keys / admin tokens stay server-side, gitignored, never in repo or bundle).
- **D-53:** **Scripted, idempotent CE setup committed in `infra/`** (against the CE admin API): creates the **policy** (perpetual, node-locked, `maxMachines=1`), the product, and the **entitlement codes embedded in each license**. Re-runnable on a box rebuild.
- **D-54:** **Licenses embed the EXACT Phase 18 gate vocabulary** — `pro.theming` and `pro.ordering` (the only two entitlements; `pro.ordering` covers reorder + pin + reset per D-26/D-28). Source of truth: `src/lib/entitlements/entitlements.ts:12-16` (`ENT_THEMING`/`ENT_ORDERING`/`ALL_ENTITLEMENTS`). Granular per-entitlement, **not** a coarse single `pro` flag — the license must unlock exactly what the central gate checks. (Phase 20 mints licenses carrying these; Phase 21 owns reading them out of `machine.lic` and flipping the default.)

### Webhook backend
- **D-55:** Backend runs as **one more container on the same VPS**, behind the same Caddy/TLS, in the same docker-compose stack. It reaches the CE over **localhost** so the **privileged Keygen admin token never crosses the public internet** (PAY-02: privileged tokens server-side only). The token is verifiably absent from the app bundle and repo.
- **D-56:** **Runtime = TypeScript/Node** — matches the repo's tooling (vitest, tsc, eslint); the signature-verify / idempotency / license-create logic is unit-tested in the same suite.
- **D-57:** **Code lives in this repo** (e.g. `server/webhook/` or `infra/webhook/` — Claude's discretion), consistent with infra-in-repo; secrets in gitignored env files.
- **D-58:** **Idempotency via Keygen, not local state** — stamp each created license with the Lemon Squeezy **order ID** in Keygen metadata; on each webhook, **search Keygen for that order ID before creating**. Keygen is the single source of truth; zero extra backend storage.
- **D-59:** **Failure policy = return 5xx on Keygen-create failure** so Lemon Squeezy **auto-retries** the webhook (D-58 idempotency prevents double licenses). After LS retry exhaustion, an **alert email** fires and the order is fulfilled manually. No queue/persistent-state infra this phase.
- **D-60:** **Webhook signature verification is mandatory** — verify the Lemon Squeezy `order_created` HMAC signature before any Keygen call; reject unsigned/invalid payloads.

### MoR checkout
- **D-61:** **Lemon Squeezy is the default**, but **the researcher MUST verify LS seller payout support + onboarding for Singapore** (the seller's payout country) **before any plan commits to LS** — this is an unresolved research open item (their country list 403'd previously). **If LS is unavailable for SG, fall back to Polar** (preferred over Paddle: Paddle requires custom pricing for sub-$10 products, and the price is $9).
  - **RESOLVED 2026-06-13 → Lemon Squeezy.** The user personally checked https://docs.lemonsqueezy.com/help/getting-started/supported-countries and confirmed **Singapore seller payout IS supported**. This overrides 20-RESEARCH.md's fallback-to-Polar recommendation (which was driven solely by the researcher's automated fetch hitting a Cloudflare 403, not by an actual LS limitation). **Plans target Lemon Squeezy:** `order_created` webhook + LS HMAC signature verification (D-60), LS test mode → live purchase (D-63), `tinkerdev.io/buy` redirect to the LS checkout (D-68). Polar is no longer the target — but per the research, keep MoR-specific logic behind a thin swap module so a future switch stays cheap.
- **D-62:** **One-time price = USD 9** (lifetime license). Drives the Paddle-is-a-poor-fallback note above.
- **D-63:** **Verification = full e2e in LS test mode** (Buy → checkout → `order_created` webhook → Keygen license create → key email → activate via Phase 19 flow), **then one real live purchase** as the final proof, **refunded afterward**. Strongest match for criterion 3.

### License key email
- **D-64:** **Resend** sends the key email (free tier 3k/mo, simple Node API, quick domain verification). Triggered by the backend after successful license creation (not LS's built-in delivery) so the backend owns the full PAY-02→PAY-03 chain.
- **D-65:** **Sender = `licenses@tinkerdev.io`.** Separately, **`alerts@tinkerdev.io`** (D-59 failure alerts + uptime alerts) **forwards to the user's inbox** via the domain's email routing (e.g. Cloudflare Email Routing). DNS for sending (SPF/DKIM/DMARC on `tinkerdev.io`) is set up this phase.
- **D-66:** **Email content = plain text** (best deliverability, matches the app's calm tone): the key, 3-line activation steps ("open DevTools → Unlock Pro → paste your key"), a download link for the latest release, and a reply-for-help line.

### In-app Buy wiring + post-purchase UX
- **D-67:** **Open the checkout via the official `tauri-plugin-opener`**, scoped to **https URLs only** in capabilities, wrapped behind **`src/lib/platform/`** (components never import `@tauri-apps/*` directly). This replaces the D-21 `BUY_LICENSE_URL` stub no-op in `UpsellPanel.tsx`.
- **D-68:** **Buy button opens an own-domain redirect — `https://tinkerdev.io/buy`** — a redirect the user controls (Cloudflare rule or Caddy on the VPS) that forwards to the live LS checkout. Store/product/MoR changes never require an app release. The compiled URL constant points at `tinkerdev.io/buy`, not the raw LS link.
- **D-69:** **Upsell panel copy stays as-is** (D-20 minimal, no pricing, no email-step line) — the post-purchase page handles expectations.
- **D-70:** **Post-checkout the buyer sees the Lemon Squeezy success page** configured with "check email" copy (≈ "Thanks! Your license key is on its way to your email — open DevTools → Unlock Pro to activate."). No self-hosted thank-you page.
- **D-71:** **Manual return, no app handoff** — browser checkout is fully separate; the buyer reads the email, returns to the app, opens Unlock Pro, and pastes the key (the Phase 19 activation flow). No deep-link / custom URL scheme / polling. Preserves "one user-initiated network call" as the app's only licensing network surface.

### Observability
- **D-72:** **Structured logs** (docker/journald) on the box **+ failure-alert emails** (D-59) **+ free external uptime monitoring** (e.g. UptimeRobot) against CE + webhook **health endpoints** — so a down VPS is noticed before a buyer hits it. Health endpoints are part of this phase's backend surface.

### Claude's Discretion
- Exact backend directory (`server/webhook/` vs `infra/webhook/`), module layout, and HTTP framework.
- Caddy vs alternative reverse proxy / TLS-issuance mechanics; exact docker-compose service topology.
- VPS provisioning specifics (image, firewall rules, SSH hardening) beyond the locked CX23/EU/swap/snapshot decisions.
- Exact email copy wording (within D-66's plain-text + calm-tone constraints) and the success-page copy (within D-70).
- The build-time switch mechanism in `config.rs` (`cfg!(debug_assertions)` vs a `DEVTOOLS_ENV` build var) within D-52's "shipped binary embeds only prod" rule.
- Redirect implementation for `tinkerdev.io/buy` (Cloudflare rule vs Caddy).
- Health-endpoint shapes; UptimeRobot vs equivalent free pinger.
- SSH deploy-script mechanics (rsync layout, restart strategy).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture (locked — do not re-litigate)
- `docs/licensing-research.md` — full locked architecture; §"Architecture" (purchase→webhook→Keygen flow), §"MoR comparison (payments)" (LS/Polar/Paddle fees, webhooks, payout gotchas — verify SG payout per D-61), §"Open items" (LS payout check; production CE tier), §"Decision summary" (split payment stack, privileged tokens server-side only).
- `.planning/phases/19-license-activation-offline-verification/19-CONTEXT.md` — D-40 (per-env `KEYGEN_HOST`/pubkey; prod hosting decided here), D-41 (which constants are committable), the live CE bring-up + SPIKE outcome (raw key in Keychain; `license.tokens.generate` DENIED).
- `.planning/phases/18-entitlements-seam-central-gate/18-CONTEXT.md` — D-18 (free-tier pivot: Pro = customization only), D-21 (Buy CTA stub this phase replaces), D-22 (key-entry slot), entitlement vocabulary intent.
- `.planning/REQUIREMENTS.md` — PAY-01/02/03 text.
- `.planning/ROADMAP.md` — Phase 20 detail + 4 success criteria.

### Code seams this phase touches
- `src/components/UpsellPanel.tsx` — `BUY_LICENSE_URL` stub at :51 + the no-op Buy handler near :316 (D-67/D-68 wire these); `UpsellPanel.test.tsx` asserts the current stub behavior (tests update with the wiring).
- `src/lib/platform/` — opener access goes through here (D-67); mirror the existing clipboard/license seam pattern.
- `src-tauri/src/license/config.rs` — `KEYGEN_HOST` (:15), `KEYGEN_ACCOUNT_ID` (:19), `KEYGEN_ED25519_PUBKEY_B64` (:28) — the per-env constants D-52 switches.
- `src/lib/entitlements/entitlements.ts:12-16` — `ENT_THEMING="pro.theming"`, `ENT_ORDERING="pro.ordering"`, `ALL_ENTITLEMENTS` — the exact strings D-54 embeds in licenses.
- `src-tauri/src/license/keygen_client.rs` — existing CE HTTP client + `DEVTOOLS_KEYGEN_CA` env path (:305); reference for the production endpoint/TLS posture.

### Verification
- `docs/HARNESS.md` — e2e gate runbook (ports, preflight, WebKit quirks) for the in-app Buy-wiring UI verification.

### External (verify against live before committing money/infra)
- Lemon Squeezy: https://docs.lemonsqueezy.com/help/webhooks/event-types (`order_created`), https://docs.lemonsqueezy.com/help/getting-started/fees, payout/country support (D-61 — researcher must confirm SG).
- Polar (fallback): https://polar.sh/docs/merchant-of-record/fees and `order.paid` webhook.
- Keygen self-hosting: https://keygen.sh/docs/self-hosting/ (Docker, Postgres 13+, Redis 6.2+); license-create API + metadata for D-58.
- Resend: https://resend.com/docs (Node API, domain verification, SPF/DKIM).
- `tauri-plugin-opener`: https://v2.tauri.app/plugin/opener/ (capabilities scoping for D-67).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Phase 19 local CE bring-up** (Docker compose + secrets-via-`openssl rand` + setup container) — the production stack is the same shape with prod secrets + a public Caddy/TLS front and the new account/keypair.
- **`src-tauri/src/license/keygen_client.rs`** — working CE HTTP client (license validate, machine activate, machine-file checkout) + `DEVTOOLS_KEYGEN_CA` custom-CA path; the production endpoint reuses this with prod constants.
- **`UpsellPanel` Buy CTA (D-21 stub)** — the slot/handler are already laid out; this phase makes the handler call the platform opener seam.
- **`src/lib/platform/` seam** — established Tauri-vs-browser pattern (clipboard, license commands) to copy for the opener wrapper.
- **Repo release/script tooling** (pnpm-driven `release:*`) — the model for an `infra:deploy` SSH script; origin remote is release-tags-only, so deploy is script-over-SSH, not CI.

### Established Patterns
- Rust core stays thin; per-env constants are compile-time consts (D-41/D-52); `cargo test` covers the license module.
- lefthook unit gate (tsc + vitest + eslint) per commit; **the new Node webhook joins the same vitest/tsc/eslint gate** (D-56).
- Real-WKWebView e2e gate for UI surfaces — the Buy-wiring change needs an e2e proof (opener invoked with the right https URL; no in-page navigation).
- Committed-constants-safe-under-public-repo discipline (D-41) — only the prod **public** key + account ID + the `tinkerdev.io/buy` URL are committed; admin tokens, CE `SECRET_KEY_BASE`, Resend API key, LS webhook secret stay in gitignored env / server-side.

### Integration Points
- `config.rs` constants → production endpoint (D-52 build switch).
- `UpsellPanel` Buy handler → `src/lib/platform/` opener → `tinkerdev.io/buy` redirect → LS checkout.
- LS `order_created` webhook → backend (signature verify) → CE license create (entitlements `pro.theming`/`pro.ordering`, order-ID metadata) → Resend key email.
- The minted license activates through the **unchanged Phase 19 in-app flow** (criterion 3) — no app-side activation changes this phase beyond the Buy wiring.

</code_context>

<specifics>
## Specific Ideas

- Domain is **`tinkerdev.io`** (user-owned): CE at `license.tinkerdev.io`, checkout redirect at `tinkerdev.io/buy`, email sender `licenses@tinkerdev.io`, alerts alias `alerts@tinkerdev.io`.
- Cheapest viable box is an explicit goal — **Hetzner CX23 €4.79/mo confirmed sufficient**; 2 GB swap is the agreed safety margin rather than upsizing to CX33.
- "No manual fulfillment" is the phase goal — the only manual path is the **failure fallback** (D-59), never the happy path.
- "Privileged Keygen tokens verifiably absent from the app bundle, repo, and every client-reachable surface" (criterion 4) is a hard, testable requirement — the webhook (localhost→CE) is the only token holder.

</specifics>

<deferred>
## Deferred Ideas

- **Offsite nightly pg_dump** of the license DB (second recovery path beyond provider snapshots) — separate follow-up after Phase 20 (D-49).
- **Self-serve license-key resend endpoint** (lost-key recovery) — backlog or Phase 21; manual lookup via reply/contact for now (D-64 area).
- **Flipping the free-tier default live + reading entitlements out of `machine.lic`** — Phase 21 (this phase only *mints* licenses carrying `pro.theming`/`pro.ordering`).
- **Multi-device tier** (raise `maxMachines`) — future milestone; licenses are `maxMachines=1` now.

</deferred>

---

*Phase: 20-purchase-pipeline*
*Context gathered: 2026-06-13*
