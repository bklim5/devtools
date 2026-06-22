---
phase: 26
slug: storekit-bridge-spike
status: planned
nyquist_compliant: true
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

- **After every task commit:** Run `pnpm vitest run && pnpm tsc --noEmit` (+ `cargo test --features appstore` for Rust-core tasks)
- **After every plan wave:** Run the full suite command
- **Before `/gsd-verify-work`:** Full suite green; decoder's 19 tests remain the immovable bar
- **Max feedback latency:** ~90 seconds for the agent-verifiable layer

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 26-01-1 | 01 | 1 | MAS-IAP-04 | T-26-03 | appstore feature gates optional tauri-plugin-iap; direct build excludes it | unit/build | `cd src-tauri && cargo tree \| grep -c iap` (=0) | ✅ | ⬜ pending |
| 26-01-2 | 01 | 1 | MAS-IAP-04, MAS-IAP-01 | T-26-01, T-26-02 | `.verified`→grant intersected pro.*; `.unverified`/cancelled/pending→[]; PurchaseState 0/1/2 map; serde JSON pinned | unit (Rust) | `cd src-tauri && cargo test --features appstore` | ✅ | ⬜ pending |
| 26-01-3 | 01 | 1 | MAS-IAP-01 | T-26-03 | iap_* commands `{code}`-reject; cfg matrix; direct build no iap arm | build | `cd src-tauri && cargo build && cargo build --features appstore` | ✅ | ⬜ pending |
| 26-02-1 | 02 | 1 | MAS-IAP-01, MAS-IAP-04 | T-26-05 | iap capability on Platform + getter + contract types | typecheck | `pnpm tsc --noEmit` | ✅ | ⬜ pending |
| 26-02-2 | 02 | 1 | MAS-IAP-04 | T-26-05, T-26-07 | real tauri.ts arm invoke iap_* + listen storekit://updated; no plugin-JS import | unit/grep | `grep -c '@choochmeque' src/lib/platform/tauri.ts` (=0) | ✅ | ⬜ pending |
| 26-02-3 | 02 | 1 | Success criterion 3 | T-26-06 | no-op browser/stub arm + setPlatformForTest inject; native-free | unit | `pnpm vitest run src/lib/platform/iap.test.ts` | ❌ W0 | ⬜ pending |
| 26-03-1 | 03 | 2 | MAS-IAP-01 | T-26-08, T-26-09 | D-11 visible spike button calls platform.iap; no @tauri-apps import; calm degrade | typecheck/grep | `pnpm tsc --noEmit` + `grep -c '@tauri-apps' src/components/LicenseSettings.tsx` (=0) | ✅ | ⬜ pending |
| 26-03-2 | 03 | 2 | Seam wiring smoke | T-26-09 | button renders + dispatches seam (no-op arm), no white-screen | e2e | `bash scripts/e2e-spike.sh` | ❌ W0 | ⬜ pending |
| 26-04-1 | 04 | 1 | MAS-IAP-01 | T-26-11, T-26-12 | in-order ASC checklist, exact values, Phase-30 deferred | doc-grep | `grep -c 'com.tinkerdev.app.pro' docs/appstore/PHASE-26-ASC-CHECKLIST.md` | ✅ | ⬜ pending |
| 26-04-2 | 04 | 1 | MAS-IAP-01 | T-26-11 | HUMAN: agreement Active, App ID, product Ready-to-Submit, Sandbox tester | manual | — | — | ⬜ pending |
| 26-05-1 | 05 | 2 | MAS-IAP-04 | T-26-15, T-26-17 | minimal harness: app-sandbox + network.client ONLY; iap:default; appstore-cfg plugin; base 10.15 untouched | build/grep | `cd src-tauri && cargo build --features appstore` | ✅ | ⬜ pending |
| 26-05-2 | 05 | 2 | MAS-IAP-04, MAS-IAP-01 | T-26-13, T-26-14, T-26-16 | iap_* call StoreKit; verified-only grant; intersect_pro; finish(); universal signed .app | build/cargo | `cd src-tauri && cargo test --features appstore` + `lipo -archs` | ✅ | ⬜ pending |
| 26-05-3 | 05 | 2 | MAS-IAP-01, MAS-IAP-04 | — | HUMAN-DECISION: go/no-go (criteria 1+2 now) recorded | manual | — | — | ⬜ pending |
| 26-06-1 | 06 | 3 | MAS-IAP-01, MAS-IAP-04 | T-26-18 | walkthrough checklist: sheet, products, success/cancel, Restore, log-stream | doc-grep | `grep -c 'log stream' docs/appstore/PHASE-26-SANDBOX-WALKTHROUGH.md` | ✅ | ⬜ pending |
| 26-06-2 | 06 | 3 | MAS-IAP-01, MAS-IAP-04 | T-26-18, T-26-19, T-26-20 | HUMAN-GATE: live sandbox purchase round-trip + Restore + serverless verify | manual | — | — | ⬜ pending |
| 26-06-3 | 06 | 3 | MAS-IAP-04 | — | fold criteria 3+4 into go/no-go; finalize decision | doc-grep | `grep -ci 'go/no-go' docs/appstore/PHASE-26-BRIDGE-VIABILITY.md` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Rust unit-test module for the verify/grant decision core (states injected as data / error-as-value) — **Plan 01 Task 2** (`src-tauri/src/iap/mod.rs` `#[cfg(test)]`)
- [ ] TS unit tests for the `platform.iap` no-op browser/stub arm + `setPlatformForTest` injection — **Plan 02 Task 3** (`src/lib/platform/iap.test.ts`)
- [ ] e2e spec for the temporary D-11 button (no-op arm) — **Plan 03 Task 2** (`test/e2e/iap-spike.e2e.ts`, extends the `license-*.e2e.ts` pattern)

*Existing vitest/cargo/e2e infrastructure covers the framework; only new test files are needed. No 3-consecutive-task gap without an automated verify (every code task has cargo/vitest/tsc/grep; the doc + human tasks are the gated manual layer).*

---

## Manual-Only Verifications

| Behavior | Requirement | Task | Why Manual | Test Instructions |
|----------|-------------|------|------------|-------------------|
| Native StoreKit sheet presents; `.success`/`.userCancelled` round-trip in the sandboxed signed `.app` | Success criterion 1, MAS-IAP-01 | 26-06-2 | Out-of-process system UI — WebDriver-impossible (D-06) | Human Sandbox-tester walkthrough per PHASE-26-SANDBOX-WALKTHROUGH.md |
| Serverless JWS verify (no network beyond Apple StoreKit) | MAS-IAP-04, Success criterion 2 | 26-06-2 | Requires observing live network on the signed `.app` | `log stream --predicate 'sender == "sandboxd"'` during a live purchase |
| Real Sandbox-tester purchase round-trip; Restore re-grants | Success criterion 4 | 26-06-2 | `.storekit` cannot substitute on macOS; sandbox sign-in is system UI | Human walkthrough per ASC-SETUP.md §6 |
| Live `.pending` (Ask-to-Buy) | MAS-IAP-01 | 26-06-2 | Hard to force without Family-Sharing config | Best-effort live; handler proven by the Rust unit core (26-01-2) + code inspection |
| ASC prerequisites (agreement, App ID, product, Sandbox tester) | MAS-IAP-01 | 26-04-2 | Apple web console — no CLI/API | Human executes PHASE-26-ASC-CHECKLIST.md |
| Bridge go/no-go decision | MAS-IAP-01, MAS-IAP-04 | 26-05-3, 26-06-3 | Human judgment on plugin viability | Recorded in PHASE-26-BRIDGE-VIABILITY.md |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (code tasks: cargo/vitest/tsc/grep; doc tasks: grep; manual tasks: explicit human gate)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (3 new test files mapped to Plans 01/02/03)
- [x] No watch-mode flags
- [x] Feedback latency < 90s (the agent-verifiable layer)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (planner, 2026-06-22)
