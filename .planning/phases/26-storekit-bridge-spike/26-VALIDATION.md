---
phase: 26
slug: storekit-bridge-spike
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-22
---

# Phase 26 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 26-RESEARCH.md §"Validation Architecture". The agent-driven inner loop is
> the **Rust verify/grant decision core unit tests** (OQ-1 reshape) — NOT a `.storekit` file.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (TS unit) + `tsc --noEmit` + `cargo test` (Rust core, `--features appstore`) + real-WKWebView e2e (`scripts/e2e-spike.sh`, WebdriverIO via `webdriver` cargo feature) |
| **Config file** | existing — `vitest.config.*`, `package.json` scripts, `src-tauri/Cargo.toml` |
| **Quick run command** | `pnpm vitest run && pnpm tsc --noEmit` |
| **Full suite command** | `pnpm vitest run && pnpm tsc --noEmit && cargo test --manifest-path src-tauri/Cargo.toml --features appstore && bash scripts/e2e-spike.sh` |
| **Estimated runtime** | ~30–90s unit/typecheck; e2e build is longer (real WKWebView) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run && pnpm tsc --noEmit` (+ `cargo test` for Rust-core tasks)
- **After every plan wave:** Run the full suite command
- **Before `/gsd-verify-work`:** Full suite green; decoder's 19 tests remain the immovable bar
- **Max feedback latency:** ~90 seconds for the agent-verifiable layer

---

## Per-Task Verification Map

> Filled by the planner — every task maps to a row. Skeleton rows below reflect the
> research test map; the planner replaces `{NN}` task IDs with real ones.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 26-01-{NN} | 01 | 1 | MAS-IAP-04 | — | `.verified`→grant `pro.*`; `.unverified`→free; `finish()` called | unit (Rust) | `cargo test --features appstore` | ❌ W0 | ⬜ pending |
| 26-01-{NN} | 01 | 1 | MAS-IAP-01 | — | `PurchaseState` 0/1/2 → success/userCancelled/pending; `.pending` calm | unit | `pnpm vitest run` | ❌ W0 | ⬜ pending |
| 26-0X-{NN} | 0X | — | Success criterion 3 | — | `platform.iap` no-op arm keeps vitest/jsdom native-free; `setPlatformForTest` injects iap stub | unit | `pnpm vitest run` | ❌ W0 | ⬜ pending |
| 26-0X-{NN} | 0X | — | Seam wiring smoke | — | D-11 button renders + dispatches seam (browser no-op arm, direct build) | e2e | `bash scripts/e2e-spike.sh` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Rust unit-test module for the verify/grant decision core (states injected as data / error-as-value)
- [ ] TS unit tests for the `platform.iap` no-op browser/stub arm + `setPlatformForTest` injection (mirror existing license-stub tests)
- [ ] e2e spec for the temporary D-11 button (no-op arm) — extends the existing `license-*.e2e.ts` pattern

*Existing vitest/cargo/e2e infrastructure covers the framework; only new test files are needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Native StoreKit sheet presents; `.success`/`.userCancelled` round-trip in the sandboxed signed `.app` | Success criterion 1, MAS-IAP-01 | Out-of-process system UI — WebDriver-impossible (D-06) | Human Sandbox-tester walkthrough on the signed `appstore`-feature `.app` |
| Serverless JWS verify (no network beyond Apple StoreKit) | MAS-IAP-04, Success criterion 2 | Requires observing live network on the signed `.app` | `log stream --predicate 'sender == "sandboxd"'` during a live purchase |
| Real Sandbox-tester purchase round-trip; Restore re-grants | Success criterion 4 | `.storekit` cannot substitute on macOS; sandbox sign-in is system UI | Human walkthrough per `docs/appstore/ASC-SETUP.md` |
| Live `.pending` (Ask-to-Buy) | MAS-IAP-01 | Hard to force without Family-Sharing config | Best-effort live; handler proven by the Rust unit core + code inspection |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
