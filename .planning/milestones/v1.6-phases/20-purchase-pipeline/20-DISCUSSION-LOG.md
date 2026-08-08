# Phase 20: Purchase Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-13
**Phase:** 20-purchase-pipeline
**Areas discussed:** Production Keygen hosting, Webhook backend shape, MoR checkout setup, License key email, In-app Buy wiring, VPS provider + region, Prod CE identity & setup, Post-purchase UX

---

## Production Keygen hosting

| Question | Options | Choice |
|----------|---------|--------|
| CE instance location | Cheap VPS / PaaS (Fly/Railway) / Keygen Cloud paid | **Cheap VPS** |
| Prod bring-up scope | Full prod now / Test infra now, prod at ship gate | **Full prod now** |
| Domain | Have one / Buy this phase / Provider defaults | **Have one — tinkerdev.io** |
| Infra in repo | infra/ in repo / Separate private repo / Manual docs only | **infra/ in repo** |

---

## Webhook backend shape

| Question | Options | Choice |
|----------|---------|--------|
| Where it runs | Same VPS as CE / Serverless | **Same VPS as CE** (CE over localhost) |
| Runtime | TypeScript/Node / Rust / You decide | **TypeScript/Node** |
| Code home | This repo / Separate private repo | **This repo** |
| Failure policy | 5xx→LS retries+alert / Accept+retry queue / Alert-only | **5xx → LS retries + alert** |
| Idempotency | Query Keygen by order ID / SQLite / Reuse CE Postgres | **Query Keygen by order ID** |
| Deploy | SSH deploy script / Git pull / Manual | **SSH deploy script** |
| Observability | Logs+alerts / Add uptime monitoring / You decide | **Add uptime monitoring** (logs+alerts+UptimeRobot) |
| Alert destination | bkbklim@gmail.com / Alias on tinkerdev.io | **alerts@tinkerdev.io** |

---

## MoR checkout setup

| Question | Options | Choice |
|----------|---------|--------|
| Payout country | Malaysia / Singapore | **Singapore** |
| LS verification | Researcher verifies / I'll verify / Commit then pivot | **Researcher verifies first** (Polar fallback) |
| Price | $29 / $19 / $39 / Placeholder | **USD 9** (free-text) |
| E2E proof | Test mode + 1 live purchase / Test mode only | **Test mode + 1 live purchase** (refunded) |

---

## License key email

| Question | Options | Choice |
|----------|---------|--------|
| Provider | Resend / Postmark / SES / You decide | **Resend** |
| Sender | licenses@ / noreply@ / hello@ | **licenses@tinkerdev.io** |
| Content | Plain text key+steps / Branded HTML / You decide | **Plain text: key + steps** |
| Lost-key recovery | Defer / Self-serve resend this phase | **Defer** |

---

## In-app Buy wiring

| Question | Options | Choice |
|----------|---------|--------|
| Open mechanism | Official opener plugin / Custom Rust command / You decide | **Official tauri-plugin-opener** (https-scoped, platform seam) |
| Buy URL | Own redirect tinkerdev.io/buy / Direct LS link | **Own redirect: tinkerdev.io/buy** |
| Panel copy | Add email-step line / Keep as-is / Discretion | **Keep as-is** |

---

## VPS provider + region

| Question | Options | Choice |
|----------|---------|--------|
| Provider/region | Hetzner EU / Hetzner SG / DO SG / You decide | **Hetzner CX23, x86, EU** (~€4.79/mo) |
| Memory safety net | (follow-up) | **Add 2 GB swap** |
| Backups | Snapshots+offsite / Snapshots only / Offsite only | **Snapshots now; offsite pg_dump deferred** |

**Notes:** User asked whether the cheapest box (CX23, 2vCPU/4GB) is sufficient — confirmed yes for this near-zero-sustained-traffic workload; 2 GB swap added as the spike-safety margin instead of upsizing to CX33.

---

## Prod CE identity & setup

| Question | Options | Choice |
|----------|---------|--------|
| Constants switch | Build-time env switch / Hardcode prod+override / You decide | **Build-time env switch in config.rs** |
| CE configuration | Scripted + committed / Manual runbook / You decide | **Scripted + committed (idempotent)** |
| Embedded entitlements | Match Phase 18 vocab / Single 'pro' flag / You decide | **Match Phase 18 vocab** (`pro.theming`, `pro.ordering`) |

---

## Post-purchase UX

| Question | Options | Choice |
|----------|---------|--------|
| Success page | LS success 'check email' / Redirect to tinkerdev.io/thanks / Show key on page | **LS success page, 'check email' copy** |
| Return path | Manual return / Deep-link back / You decide | **Manual return** |

---

## Claude's Discretion

- Backend directory/framework, docker-compose topology, reverse-proxy/TLS mechanics.
- VPS provisioning specifics beyond CX23/EU/swap/snapshots.
- Email + success-page copy wording (within plain-text, calm-tone constraints).
- `config.rs` build-switch mechanism; `tinkerdev.io/buy` redirect implementation; health-endpoint shapes; SSH deploy mechanics.

## Deferred Ideas

- Offsite nightly pg_dump (second DB recovery path).
- Self-serve lost-key resend endpoint.
- Phase 21 owns: free-tier default flip + reading entitlements from machine.lic.
- Multi-device tier (raise maxMachines).
