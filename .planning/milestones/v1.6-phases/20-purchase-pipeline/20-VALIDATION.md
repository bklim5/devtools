---
phase: 20
slug: purchase-pipeline
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-13
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from 20-RESEARCH.md → "Validation Architecture". MoR = **Lemon Squeezy** (D-61 resolved 2026-06-13; `order_created` event, LS HMAC signature).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Unit framework** | vitest (repo suite; the new webhook backend joins it — D-56) + `tsc --noEmit` + eslint, enforced by lefthook per commit |
| **E2E framework** | webdriverio + Mocha against the real WKWebView |
| **Rust** | `cargo test` (config.rs const tests guard a malformed prod pubkey) |
| **Quick run command** | `pnpm test && pnpm exec tsc --noEmit && pnpm lint` (+ `cargo test` when `config.rs` touched) |
| **Full suite command** | `pnpm test && bash scripts/e2e-spike.sh` |
| **Estimated runtime** | unit ~10–30s; e2e-spike ~60–120s (tauri dev boot + :4445 poll) |

---

## Sampling Rate

- **After every task commit:** `pnpm test` + `pnpm exec tsc --noEmit` + `pnpm lint` (+ `cargo test` for `config.rs`). The decoder's 19 tests stay green (untouched).
- **After every plan wave:** full vitest suite + `bash scripts/e2e-spike.sh`.
- **Before `/gsd-verify-work`:** full suite green.
- **Phase gate:** full suite green → `pnpm tauri build` → human D-63 live-purchase walkthrough + `gsd-ui-review` WCAG-AA audit on the Buy affordance.
- **Max feedback latency:** ~30s (unit) per commit; ~2min (e2e) per wave.

---

## Per-Task Verification Map

> Task IDs (`20-NN-MM`) are assigned by the planner; rows below map each phase requirement to its automated proof. The planner/nyquist-auditor binds each row to a concrete task.

| Req | Behavior | Test Type | Automated Command / File | File Exists |
|-----|----------|-----------|--------------------------|-------------|
| PAY-02 | LS signature verify rejects unsigned/invalid; accepts valid (over raw body) | unit | `pnpm test` → `server/webhook/verify.test.ts` | ❌ W0 |
| PAY-02 | Idempotency: existing `metadata[orderId]` ⇒ no second license create | unit | `pnpm test` → `server/webhook/keygen.test.ts` (mocked CE search) | ❌ W0 |
| PAY-02 | License-create payload shape (policy rel + `metadata.orderId` + entitlements `pro.theming`/`pro.ordering`) | unit | `pnpm test` → `server/webhook/keygen.test.ts` | ❌ W0 |
| PAY-02 | Keygen-create failure ⇒ 5xx (MoR auto-retry, D-59) | unit | `pnpm test` → `server/webhook/fulfill.test.ts` | ❌ W0 |
| PAY-02 | `order_created` → orderId + customer email extraction (LS payload mapping) | unit | `pnpm test` → `server/webhook/mor.test.ts` | ❌ W0 |
| PAY-03 | Email composed with key + activation steps + download link (Resend client mocked) | unit | `pnpm test` → `server/webhook/email.test.ts` | ❌ W0 |
| PAY-01 | Buy button invokes opener seam with https `tinkerdev.io/buy`; no in-page navigation | unit | `pnpm test` → `src/components/UpsellPanel.test.tsx` (replace D-21 stub assertion) | ✅ update |
| PAY-01 | Opener seam: browser/stub arms are no-ops (never navigate jsdom) | unit | `pnpm test` → `src/lib/platform/*.test.ts` (extend) | ✅ update |
| PAY-01 | Real-WKWebView: clicking Buy invokes the native opener (https), panel does not navigate | e2e | `bash scripts/e2e-spike.sh` → `test/e2e/license-buy.e2e.ts` (assert seam/IPC call + no route change; actual browser-open is manual) | ❌ W0 |
| D-52 | Release binary embeds prod CE host/account/pubkey; NOT localhost | build check | grep packaged binary: `license.tinkerdev.io` present, `localhost` Keygen host absent (extend dist-grep gate) | ❌ W0 |
| PAY-01/02/03 | **Full live pipeline** (Buy→LS test mode→`order_created`→CE create→Resend→activate via Phase-19) then ONE live purchase, refunded (D-63) | manual / human ship-gate | walkthrough against live `license.tinkerdev.io` | ❌ W0 runbook |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/webhook/` (or `infra/webhook/`) test stubs: `verify.test.ts`, `keygen.test.ts`, `fulfill.test.ts`, `mor.test.ts`, `email.test.ts` — cover PAY-02/PAY-03 (mock CE HTTP + Resend; **no live calls** in unit tests).
- [ ] Wire the new backend package into the repo's vitest + tsc + eslint config (D-56) — confirm `tsconfig`/eslint globs reach `server/`.
- [ ] `test/e2e/license-buy.e2e.ts` — Buy-wiring real-WKWebView proof (assert opener seam invoked, no navigation).
- [ ] Update `src/components/UpsellPanel.test.tsx` — current test asserts the D-21 stub no-op; rewrite to assert `opener.openUrl` called with the https URL.
- [ ] Extend the D-32/D-52 dist-grep build check for the prod-constant assertion.
- [ ] Documented D-63 live-purchase runbook (manual ship-gate; native browser-open + real money are not automatable).

*Existing infra (vitest + wdio + lefthook + dist-grep) is already present; the gaps are new test files, not new frameworks.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Native browser actually opens the LS checkout from Buy | PAY-01 | OS-level browser launch is non-observable inside WKWebView/WebDriver (HARNESS native-input note) | Launch built app → Unlock Pro → Buy → confirm default browser opens `tinkerdev.io/buy` → LS checkout |
| Full live purchase → key email → activation | PAY-01/02/03 | Real money + real email + live CE; cannot be unit/e2e automated (D-63) | LS test-mode pass, then one live USD-9 purchase; confirm key email arrives, activates via Phase-19 flow; refund afterward |
| Privileged tokens absent from bundle/repo | criterion 4 | Requires inspecting the packaged artifact + repo history | grep packaged `.app` + repo for CE admin token / `SECRET_KEY_BASE` / Resend key / LS webhook secret — must be absent |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-13 (plans verified Nyquist-compliant by gsd-plan-checker)
