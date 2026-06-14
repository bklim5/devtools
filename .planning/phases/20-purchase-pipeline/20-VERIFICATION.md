---
phase: 20-purchase-pipeline
verified: 2026-06-14T00:00:00Z
status: human_needed
score: 4/4 truths verified (code/infra); 1 human ship-gate PENDING on external LS approval
overrides_applied: 0
verdict: verified-pending-live-gate
human_verification:
  - test: "Live USD-9 Lemon Squeezy purchase (D-63 final ship-gate), refunded after"
    expected: "One real USD-9 purchase fires order_created → webhook mints a node-locked license (pro.theming+pro.ordering, metadata.orderId) → Resend emails the plain-text key → key activates via the unchanged Phase-19 flow on a prod-built app; refund afterward"
    why_human: "Real money + live MoR; cannot be automated. BLOCKED on Lemon Squeezy store approval, itself blocked on a credible product landing page (in progress). External dependency, not a code gap. Test-mode equivalent (order 8689915) already proven live end-to-end."
---

# Phase 20: Purchase Pipeline Verification Report

**Phase Goal:** A buyer can pay once through a merchant-of-record checkout and automatically receive a working license key by email — no manual fulfillment, no privileged credentials anywhere near the app.
**Verified:** 2026-06-14
**Status:** human_needed (verdict: **verified-pending-live-gate**)
**Re-verification:** No — initial verification

## Verdict

**All CODE and INFRA deliverables for PAY-01 / PAY-02 / PAY-03 are satisfied and independently verified against the codebase and live infra.** The production purchase pipeline is live and proven end-to-end **in Lemon Squeezy test mode** (real order 8689915 minted a node-locked license, emailed the key, and activated against prod CE on a prod-built app). The **single unmet item** is the phase's final human ship-gate — one **live USD-9 purchase** (D-63) — which is **blocked on an external Lemon Squeezy store-approval dependency**, not on any code or infrastructure gap. This is therefore **not failed** and **not fully closed**: it is verified-pending-live-gate.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth (SC) | Status | Evidence |
| --- | --- | --- | --- |
| 1 (PAY-01) | In-app "Buy license" opens the MoR page in the default browser; checkout completes | ✓ VERIFIED (code) / ? live-gate | `UpsellPanel.tsx:52` `BUY_LICENSE_URL="https://tinkerdev.io/buy"`, `:319` `platform.opener.openUrl(BUY_LICENSE_URL)`; opener confined to `tauri.ts:25` only (grep clean elsewhere); `opener:allow-open-url` https-scoped in `capabilities/default.json`; LS test-mode checkout completed live (order 8689915). Native browser-open + live purchase = human-only. |
| 2 (PAY-02) | `order_created` → backend creates perpetual/node-locked/maxMachines=1 license, entitlements embedded, no manual steps | ✓ VERIFIED | `verify.ts` HMAC-SHA256 over raw body + length-guarded `timingSafeEqual` (D-60); `keygen.ts:58` search `metadata[orderId]` before create (D-58 idempotent), policy-rel create stamping `metadata.orderId`; `fulfill.ts` 5xx-on-failure + alert (D-59/D-72); `infra/keygen/setup.sh` attaches `pro.theming`+`pro.ordering` to the policy. Proven live: synthetic signed order minted ACTIVE license w/ entitlements; idempotent replay + bad-sig 401 confirmed. |
| 3 (PAY-03) | Buyer receives key by email automatically; activates via Phase-19 flow | ✓ VERIFIED | `email.ts` Resend plain-text key + activation steps + reply-to (D-64/D-66); `fulfill.ts` emails after create then marks emailed. Proven live: key email received for order 8689915 and **activated against prod CE on a prod-built app** via the unchanged Phase-19 flow. |
| 4 (criterion 4) | Privileged Keygen tokens only server-side — absent from bundle, repo, every client-reachable surface | ✓ VERIFIED | Whole-repo `git grep` for `SECRET_KEY_BASE=`/`whsec_`/`re_…`/`Bearer …` (excl. `.env.example`) returns nothing; no `.env` tracked; secrets live only on the box (gitignored `infra/keygen/.env` + `server/webhook/.env`); webhook reaches CE on-box (D-55). config.rs embeds only the public pubkey + account id. |

**Score:** 4/4 success criteria verified at the code/infra layer. SC1 and SC3's live-purchase leg awaits the human ship-gate.

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `src/components/UpsellPanel.tsx` | Buy CTA via opener seam → `https://tinkerdev.io/buy` | ✓ VERIFIED | `:52` + `:319`, wired through `platform.opener.openUrl` |
| `src/lib/platform/tauri.ts` | sole `@tauri-apps/plugin-opener` importer | ✓ VERIFIED | `:25`; grep confirms no other importer |
| `src-tauri/capabilities/default.json` | https-only `opener:allow-open-url` | ✓ VERIFIED | permission present, https-scoped |
| `src-tauri/src/license/config.rs` | real prod account id + 32B pubkey + `license.tinkerdev.io`; APP_SALT unchanged | ✓ VERIFIED | account `0d607683…`, pubkey `huJdyRsB…`, host set; no PLACEHOLDER; APP_SALT byte-identical; `cargo test --release license::config` = 4/4 |
| `server/webhook/src/{verify,mor,keygen,email,fulfill,index,config}.ts` | full webhook backend | ✓ VERIFIED | all 7 present + substantive; key links confirmed |
| `infra/keygen/{compose,Caddyfile,setup.sh,swap.sh,deploy.sh,RUNBOOK.md,.env.example}` | reproducible prod stack, real ACME, entitlements, templates-only | ✓ VERIFIED | all present; `tls internal` count = 0 (real ACME); entitlements attached in setup.sh; secrets template-only |

### Key Link Verification

| From | To | Via | Status |
| --- | --- | --- | --- |
| `UpsellPanel.tsx` | platform opener seam | `platform.opener.openUrl(BUY_LICENSE_URL)` | ✓ WIRED |
| `tauri.ts` | `@tauri-apps/plugin-opener` | `openUrl` import (sole) | ✓ WIRED |
| `fulfill.ts` | `verify.ts` | sig verify before side effects (401, no calls) | ✓ WIRED |
| `keygen.ts` | CE `/licenses?metadata[orderId]=` | search-before-create idempotency (D-58) | ✓ WIRED |
| `fulfill.ts` | `email.ts` | Resend send after create | ✓ WIRED |
| `setup.sh` | CE policy | attach `pro.theming`+`pro.ordering` | ✓ WIRED |
| `config.rs` release consts | prod CE identity | real account id + pubkey + `license.tinkerdev.io` | ✓ WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Prod tripwire (real constants, 32B pubkey, host) | `cargo test --release license::config` | 4 passed; 0 failed | ✓ PASS |
| Whole-repo secret-clean (criterion 4) | `git grep SECRET_KEY_BASE=/whsec_/re_…/Bearer …` (excl `.env.example`) | no hits | ✓ PASS |
| No `.env` tracked | `git ls-files \| grep .env` | only `.env.example` | ✓ PASS |
| Opener import isolation | `grep @tauri-apps/plugin-opener src/ (excl tauri.ts)` | empty | ✓ PASS |
| Caddy real ACME (no self-signed) | `grep -c "tls internal" Caddyfile` | 0 | ✓ PASS |
| Full unit/type/lint suite (session ground truth) | `pnpm test` / `tsc --noEmit` / eslint | 889 passing; tsc clean; 0 errors | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| PAY-01 | 20-01, 20-03 | Buy CTA opens external MoR checkout via opener seam, no in-page nav | ✓ SATISFIED (code) / live-gate pending | opener seam wired, https-scoped; LS test checkout completed live |
| PAY-02 | 20-02, 20-03 | Signed `order_created` → idempotent Keygen license create | ✓ SATISFIED | verify/idempotency/policy-rel create proven live (order 8689915) |
| PAY-03 | 20-02, 20-03 | Key emailed to buyer | ✓ SATISFIED | Resend email received + activated live |

### Anti-Patterns Found

None blocking. The Plan-01 `PROD_*_PLACEHOLDER` sentinels (an intentional cross-plan tripwire) are now **replaced with real values** by Plan 03 — no residual placeholder remains (grep confirms). 2 pre-existing eslint warnings are unrelated to this phase.

### Human Verification Required

#### 1. Live USD-9 purchase (D-63 ship-gate)

**Test:** From the prod-built app: Buy → browser → `tinkerdev.io/buy` → live LS checkout → complete ONE real USD-9 purchase → confirm `order_created` fires → CE mints node-locked license (pro.theming+pro.ordering, metadata.orderId) → Resend emails the key → paste in Unlock Pro → activates via Phase-19 flow → **refund afterward**. Plus gsd-ui-review WCAG-AA on the Buy affordance.
**Expected:** Full chain succeeds end-to-end with real money; refund clean.
**Why human:** Real money + live MoR, non-automatable. **Currently BLOCKED on Lemon Squeezy store approval**, itself blocked on a credible product landing page (in progress this session). External dependency — not a code/infra gap. The functionally-identical test-mode path is already proven live.

### Gaps Summary

**No code or infrastructure gaps.** Every PAY-01/02/03 deliverable exists, is substantive, is wired, and was independently re-verified against the codebase + live infra this session: opener seam + https scope, real prod constants (`cargo test --release` 4/4), the full webhook backend (verify→idempotent-create→email→5xx-on-failure), the committed real-ACME `infra/keygen/` stack with entitlement attachment, and a whole-repo + no-`.env` secret-clean (criterion 4). The pipeline is proven end-to-end in LS test mode (license minted, key emailed, activated on a prod build).

The phase's only outstanding item is its **final human ship-gate — one live USD-9 purchase** — held by an **external Lemon Squeezy store-approval dependency**. Per the goal-backward standard this is `human_needed` (a human ship-gate item exists), with the explicit verdict **verified-pending-live-gate**: not failed, not yet fully closed. Phase closure should follow the live purchase once LS activates the store.

---

_Verified: 2026-06-14_
_Verifier: Claude (gsd-verifier)_
