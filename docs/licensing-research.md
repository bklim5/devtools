# Licensing Research — v1.6 (consolidated, 2026-06-09)

Deep research (multi-agent, adversarially verified) + four external review rounds, all corrections integrated. This is the durable source for v1.6 planning. Pricing/tier facts are 2026 snapshots — re-verify before committing money.

## Decision summary (locked)

| Decision | Choice |
|---|---|
| License platform | **Keygen** (cloud Dev tier for build; paid Std or self-hosted CE before launch) |
| License model | **Perpetual + node-locked**, `maxMachines = 1`, future multi-device tier = raise `maxMachines` |
| Device policy | **1 active machine + self-serve transfer** (deactivate old → activate new) |
| Activation | **One-time online** (the only mandatory network call) — server-side seat counting is the ONLY way to stop key reuse |
| Offline verification | **Unencrypted Ed25519-signed `machine.lic`**, verified in **Rust** with an embedded public key + fingerprint check, fully offline at launch |
| Revocation | **~30-day TTL** on the machine file + opportunistic re-checkout → refund/chargeback revocation propagates ≤30 days; offline grace in between |
| Credential storage | **License key in macOS Keychain** (Rust-owned, `keyring` crate), used only for TTL refresh + deactivation. `machine.lic` verification needs no credential |
| Fingerprint | `HMAC-SHA256(IOPlatformUUID, app-specific salt)` — never the raw ID |
| Payments | **Split stack**: MoR checkout (Lemon Squeezy default, near-tie with Polar/Paddle) → `order_created` webhook → small backend → Keygen license creation. **Privileged Keygen tokens only server-side, never in the app** |
| Feature gating | Central entitlement gate: `requiredEntitlements?: string[]` on `ToolDefinition` + app-level entitlement map (theming, reorder/pin). React receives only the resolved set via Rust command |
| Free tier locks | Theming + tool ordering/pinning (D-18 pivot 2026-06-10 — all 11 tools incl. the Protobuf hero stay free; original hero-lock recommendation superseded by 18-CONTEXT.md D-18) |
| Protection level | **Webview gating = UX-gating, not DRM** (accepted). Registry lazified now so a future free-build can code-split the decoder out (decoder.ts untouched) |
| Portability | OS-portable seams (fingerprint + credential store behind Rust commands); **macOS-only impl this milestone** |

## Architecture

```
PURCHASE (web)                ACTIVATION (once, online)            RUNTIME (offline)
──────────────                ─────────────────────────            ─────────────────
MoR checkout (tax/VAT)   →    paste key into app             →     Rust: verify Ed25519 sig
  ↓ order_created webhook       1. validate license                + fingerprint match,
backend (serverless)            2. activate machine (fp)           offline, every launch
  → Keygen API: create          3. checkout signed machine.lic       ↓
    license (perpetual,         4. cache (Rust-owned app data)     resolve entitlements
    node-locked, max=1,         5. key → Keychain                    ↓
    entitlements embedded)                                         React: central gate
  ↓ key emailed to buyer                                           (tools + theming + order)
                              TTL lapse (~30d): opportunistic
                              re-checkout using Keychain key
```

Rust command surface (React never touches key material or the raw file):
`license_status() -> Entitlements` · `activate_license(key)` · `refresh_license()` · `deactivate_machine()`

## Why these choices

- **Offline signed keys prove authenticity, not uniqueness.** Ed25519 verification with an embedded public key needs no network ([Keygen cryptography docs](https://keygen.sh/docs/api/cryptography/)) — but a pure-offline key works on 1,000 machines. Seat limits require server-side activation counting → one-time online activation is the minimal network surface.
- **Ed25519 over RSA** — Keygen's recommended default; smaller sigs, stronger ([docs](https://keygen.sh/docs/api/cryptography/)). Cryptolens is the RSA-based fallback platform ([offline verification](https://help.cryptolens.io/examples/offline-verification)); Lemon Squeezy's license API is online-only — used here only as MoR.
- **Unencrypted (not encrypted) machine file** — Keygen encrypted machine files decrypt with license key + fingerprint, which would force retaining the key for verification. Unencrypted signed file verifies with the public key alone; the Keychain key exists only for refresh/deactivate.
- **License key (not derived token) stored** — Keygen sanctions license-key auth client-side for activate/deactivate ([authentication docs](https://keygen.sh/docs/api/authentication/)). NOTE: Keygen's authz matrix shows the `license` principal holds `license.tokens.generate`, so a client-side key→token exchange may work — **confirm in the spike**; if yes, optionally store a token and discard the key. (One review round claimed token generation needs privileged auth; the authz matrix contradicts this — medium confidence, spike-verify.)
- **TTL = eventual consistency, not instant revocation** — embedded data in signed files is immutable; Keygen's TTL/re-checkout model is the documented revocation path ([offline licenses](https://keygen.sh/docs/choosing-a-licensing-model/offline-licenses/)). 30 days chosen to bound refund/chargeback exposure.
- **Imperfect fingerprints are fine because of the transfer policy** — IOPlatformUUID (macOS), MachineGuid (Windows, clone/reinstall-fragile), /etc/machine-id (Linux, clone-fragile): every source has edge cases (logic-board swap, Migration Assistant, VMs). "1 active + self-serve transfer" turns those into self-service events, not lockouts.
- **Rust-side everything** — keeps the public key, verify logic, and credentials out of the inspectable webview bundle, and sidesteps the JS prefs-store async-init race (entitlements arrive via command invocation, not the JS store).

## Platform comparison (licensing)

| | Offline signed artifact | Seat-limited activation | Lifetime/perpetual | Notes |
|---|---|---|---|---|
| **Keygen** ✅ | Ed25519-signed machine files, first-class air-gap support | Node-locked + maxMachines | Yes | Free self-host CE (commercial OK); cloud Dev tier free but capped (~100 ALU / 10 releases — **not production-safe**); [tauri-plugin-keygen](https://github.com/bagindo/tauri-plugin-keygen) exists but is community/no-releases — **spike direct Rust integration first** |
| Cryptolens | RSA-signed responses, `HasValidSignature(key, days)` | `IsOnRightMachine()` SHA256 | Yes | Viable fallback; heavier crypto |
| Lemon Squeezy | ❌ online-only license API | Server-side instances | Yes | Use as MoR only |

## MoR comparison (payments)

All three: true MoR (global VAT/tax remitted), one-time payments supported, signed purchase webhooks, headline **5% + $0.50**. Near-tie — pick on payout-country fit + onboarding. **Verify seller payout support for your country first.**

| | Webhook | Payouts | Gotchas |
|---|---|---|---|
| **Lemon Squeezy** (default) | `order_created` | $50 min, twice-monthly, PayPal to 200+ countries | +1.5% intl card, 1% intl payout, ~13-day hold; Stripe-owned (stability +, roadmap ?) |
| Polar | `order.paid` | Stripe Connect Express (200+ countries), pay-on-request | 14-day account review, heavy KYC, newest, 2025 price hike (sub-5% needs paid tier) |
| Paddle | `transaction.completed` | $100 min, monthly | Post-FTC stricter vetting, ~2–3% FX margin, <$10 products need custom pricing |

## Entitlements design

- `requiredEntitlements?: string[]` added to `ToolDefinition` (supplements/replaces the reserved `premium?: boolean` at `src/lib/tools/types.ts:52`).
- App-level entitlement map for non-tool gates: theming, tool ordering/pinning.
- One vocabulary of entitlement strings covers both; embedded as data in the Keygen license; resolved once in Rust; consumed via a single gate (e.g. `useEntitlements()`).
- Registry entries converted to lazy `component` loaders (the `LazyComponent` union member at `types.ts:42` — currently unused; `src/tools/protobuf-decoder/index.ts` eager-imports today). This makes a future free-build decoder exclusion a real code-split seam without touching `decoder.ts`.

## Piracy realism

Signing buys tamper-evidence, not unbreakability — any offline desktop binary can be patched. Online activation stops casual key-sharing (the actual revenue leak). Stop hardening at: Rust-side Ed25519 verify + node-locked activation + fingerprint check. Webview gates are patchable by a determined user — accepted; the future free-build code-split is the distribution-level answer if ever needed.

## Ship-gate test matrix

1. Valid activation on first Mac
2. Second Mac rejected (seat limit)
3. Offline launch succeeds after activation
4. Corrupted `machine.lic` fails closed (→ free tier)
5. Copied `machine.lic` fails on a different fingerprint
6. TTL-expired behavior (grace, then re-checkout prompt/flow)
7. Deactivation/transfer path end-to-end
8. Refund/revocation propagates on TTL refresh

## Open items (resolve in spike / planning)

- Confirm client-side license-key → license-token exchange against the live Keygen API (authz matrix says yes; one reviewer said no).
- Verify Lemon Squeezy seller bank-payout support for the seller's country (their country list 403'd during research).
- Keygen production tier choice: paid Std cloud vs self-hosted CE (free Dev tier caps at ~100 active licensed users / 10 releases).
- Exact offline-grace behavior when TTL lapses while offline (calm degrade vs grace window length).
- Linux (deferred): Secret Service/libsecret can be absent or locked — needs fallback UX, not assumed-available.

## Key sources

Keygen: [offline licenses](https://keygen.sh/docs/choosing-a-licensing-model/offline-licenses/) · [cryptography](https://keygen.sh/docs/api/cryptography/) · [authentication](https://keygen.sh/docs/api/authentication/) · [pricing](https://keygen.sh/pricing/) · [Rust machine-file example](https://github.com/keygen-sh/example-rust-cryptographic-machine-files) · [tauri-plugin-keygen](https://github.com/bagindo/tauri-plugin-keygen)
Cryptolens: [offline verification](https://help.cryptolens.io/examples/offline-verification) · [node-locked](https://help.cryptolens.io/licensing-models/node-locked)
MoR: [LS fees](https://docs.lemonsqueezy.com/help/getting-started/fees) · [LS webhooks](https://docs.lemonsqueezy.com/help/webhooks/event-types) · [Polar fees](https://polar.sh/docs/merchant-of-record/fees) · [Paddle pricing](https://www.paddle.com/pricing) · [Paddle transaction.completed](https://developer.paddle.com/webhooks/transactions/transaction-completed/) · [FTC/Paddle settlement](https://www.ftc.gov/news-events/news/press-releases/2025/06/paddle-will-pay-5-million-settle-ftc-allegations-unfair-payment-processing-practices-facilitation)
