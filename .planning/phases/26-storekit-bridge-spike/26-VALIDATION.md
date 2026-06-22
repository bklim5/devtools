---
phase: 26
slug: storekit-bridge-spike
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-22
updated: 2026-06-22
---

# Phase 26 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 26-RESEARCH.md §"Validation Architecture". The agent-driven inner loop is
> the **Rust verify/grant decision core unit tests** (OQ-1 reshape) — NOT a `.storekit` file.
> Revision 1 (Codex adversarial findings): added the Plan-02 plugin-API preflight (26-02-0),
> the conditional in-phase swift-rs fallback (Plan 07), and hardened the D-04 serverless proof
> to TWO independent checks (static audit + process-scoped capture) plus a relaunch/replay check.

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
| 26-02-0 | 02 | 1 | MAS-IAP-01, MAS-IAP-04 | T-26-21 | PREFLIGHT (Codex #2/OQ-2): prove Rust-callable plugin API exists (cited names + compile check) vs JS-companion-only; the seam/grep criterion branches on the proven MODE | doc/build | `bash -c 'test -f docs/appstore/PHASE-26-PLUGIN-API-PREFLIGHT.md && grep -ci "MODE A\|MODE B" docs/appstore/PHASE-26-PLUGIN-API-PREFLIGHT.md'` | ✅ | ⬜ pending |
| 26-02-1 | 02 | 1 | MAS-IAP-01, MAS-IAP-04 | T-26-05 | iap capability on Platform + getter + contract types | typecheck | `pnpm tsc --noEmit` | ✅ | ⬜ pending |
| 26-02-2 | 02 | 1 | MAS-IAP-04 | T-26-05, T-26-07, T-26-21 | real tauri.ts arm per proven MODE (invoke iap_* [A] or @choochmeque-in-tauri.ts-only [B]) + listen storekit://updated; no plugin-JS leak outside tauri.ts | unit/grep | `grep -c '@choochmeque' src/lib/platform/index.ts src/lib/platform/browser.ts src/lib/platform/stub.ts` (=0) | ✅ | ⬜ pending |
| 26-02-3 | 02 | 1 | Success criterion 3 | T-26-06 | no-op browser/stub arm + setPlatformForTest inject; native-free | unit | `pnpm vitest run src/lib/platform/iap.test.ts` | ❌ W0 | ⬜ pending |
| 26-03-1 | 03 | 2 | MAS-IAP-01 | T-26-08, T-26-09 | D-11 visible spike button calls platform.iap; Restore re-reads currentEntitlements() + renders codes (Codex #5); no @tauri-apps; calm degrade | typecheck/grep | `pnpm tsc --noEmit` + `grep -c 'currentEntitlements' src/components/LicenseSettings.tsx` (≥1) | ✅ | ⬜ pending |
| 26-03-2 | 03 | 2 | Seam wiring smoke | T-26-09 | button renders + dispatches seam (products/purchase/restore) (no-op arm), no white-screen | e2e | `bash scripts/e2e-spike.sh` | ❌ W0 | ⬜ pending |
| 26-04-1 | 04 | 1 | MAS-IAP-01 | T-26-11, T-26-12 | in-order ASC checklist, exact values, Phase-30 deferred | doc-grep | `grep -c 'com.tinkerdev.app.pro' docs/appstore/PHASE-26-ASC-CHECKLIST.md` | ✅ | ⬜ pending |
| 26-04-2 | 04 | 1 | MAS-IAP-01 | T-26-11 | HUMAN: agreement Active, App ID, product Ready-to-Submit, Sandbox tester | manual | — | — | ⬜ pending |
| 26-05-1 | 05 | 2 | MAS-IAP-04 | T-26-15, T-26-17 | minimal harness: app-sandbox + network.client ONLY; iap:default; appstore-cfg plugin; base 10.15 untouched | build/grep | `cd src-tauri && cargo build --features appstore` | ✅ | ⬜ pending |
| 26-05-2 | 05 | 2 | MAS-IAP-04, MAS-IAP-01 | T-26-13, T-26-14, T-26-16 | iap_* call StoreKit (per proven MODE); verified-only grant; intersect_pro; finish() CITED source (Codex #4); static no-non-Apple-network audit zero hits (Codex #3 check 1); universal signed .app | build/cargo/grep | `cd src-tauri && cargo test --features appstore` + `grep -rEc "fetch\|reqwest\|URLSession\|https://\|tinkerdev\|keygen" src/iap/` (=0) + `lipo -archs` | ✅ | ⬜ pending |
| 26-05-3 | 05 | 2 | MAS-IAP-01, MAS-IAP-04 | — | HUMAN-DECISION: go/no-go (criteria 1+2 now). NO-GO routes into in-phase Plan 07, not a dangling note (Codex #1) | manual | — | — | ⬜ pending |
| 26-06-1 | 06 | 3 | MAS-IAP-01, MAS-IAP-04 | T-26-18, T-26-22 | walkthrough checklist: sheet, products, success/cancel, relaunch/replay (Codex #4), Restore re-grant readout, BOTH serverless checks (static + process-scoped per-PID, Codex #3) | doc-grep | `bash -c 'grep -ci "relaunch" docs/appstore/PHASE-26-SANDBOX-WALKTHROUGH.md && grep -ci "nettop\|lsof\|process-scoped" docs/appstore/PHASE-26-SANDBOX-WALKTHROUGH.md'` | ✅ | ⬜ pending |
| 26-06-2 | 06 | 3 | MAS-IAP-01, MAS-IAP-04 | T-26-18, T-26-19, T-26-20, T-26-22 | HUMAN-GATE: live sandbox purchase round-trip + relaunch-no-replay + Restore re-grant + serverless verify (process-scoped capture, not sandboxd-only) | manual | — | — | ⬜ pending |
| 26-06-3 | 06 | 3 | MAS-IAP-04 | — | fold criteria 3+4 into go/no-go; ROUTE disposition: GO completes / NO-GO triggers Plan 07 / both-paths verify fail escalates (Codex #1) | doc-grep | `bash -c 'grep -ci "go/no-go" docs/appstore/PHASE-26-BRIDGE-VIABILITY.md && grep -ci "plan 07\|swift-rs\|complete" docs/appstore/PHASE-26-BRIDGE-VIABILITY.md'` | ✅ | ⬜ pending |
| 26-07-1 | 07 (conditional) | 4 | MAS-IAP-04, MAS-IAP-01 | T-26-23, T-26-24, T-26-25, T-26-27 | CONDITIONAL (only if nogo-swiftrs): swift-rs bridge fills SAME iap_* contract; IapBridge.swift verified-only + finish() cited; routes through unchanged Plan-01 grant core; static network audit zero hits | build/cargo/grep | `bash -c '(cd src-tauri && cargo test --features appstore) ; grep -c VerificationResult src-tauri/swift/IapBridge/Sources/IapBridge/IapBridge.swift ; grep -rEc "fetch\|reqwest\|URLSession\|https://\|tinkerdev\|keygen" src-tauri/src/iap/'` (=0) | ⬜ cond | ⬜ pending |
| 26-07-2 | 07 (conditional) | 4 | MAS-IAP-04 | T-26-23, T-26-27 | CONDITIONAL: universal arm64+x86_64 sandboxed signed swift-rs .app; criteria 1/2 + static audit recorded; base 10.15 untouched | build | `cd src-tauri && cargo build --features appstore` + `lipo -archs` | ⬜ cond | ⬜ pending |
| 26-07-3 | 07 (conditional) | 4 | MAS-IAP-01, MAS-IAP-04 | T-26-25, T-26-26 | CONDITIONAL HUMAN-GATE: re-run Plan-06 walkthrough on the swift-rs .app — same four criteria (sheet, relaunch-no-replay, Restore re-grant, both serverless checks) | manual | — | ⬜ cond | ⬜ pending |
| 26-07-4 | 07 (conditional) | 4 | MAS-IAP-04 | — | CONDITIONAL: finalize swift-rs disposition — GO-swiftrs completes Phase 26, or terminal milestone blocker if criterion 4 fails on both paths (Codex #1) | doc-grep | `bash -c 'grep -ci "swift-rs\|complete\|blocker" docs/appstore/PHASE-26-BRIDGE-VIABILITY.md'` | ⬜ cond | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · ⬜ cond = conditional (runs only on nogo-swiftrs)*

---

## Wave 0 Requirements

- [ ] Rust unit-test module for the verify/grant decision core (states injected as data / error-as-value) — **Plan 01 Task 2** (`src-tauri/src/iap/mod.rs` `#[cfg(test)]`)
- [ ] TS unit tests for the `platform.iap` no-op browser/stub arm + `setPlatformForTest` injection — **Plan 02 Task 3** (`src/lib/platform/iap.test.ts`)
- [ ] e2e spec for the temporary D-11 button (no-op arm) — **Plan 03 Task 2** (`test/e2e/iap-spike.e2e.ts`, extends the `license-*.e2e.ts` pattern)

*Existing vitest/cargo/e2e infrastructure covers the framework; only new test files are needed. The Plan-02 preflight (26-02-0) is doc/compile-check verified before the seam-arm tasks; no 3-consecutive-task gap without an automated verify (every code task has cargo/vitest/tsc/grep; the doc + human tasks are the gated manual layer). Plan 07 is conditional — if it runs, its swift-rs results pass through the UNCHANGED Plan-01 Rust unit core (no new Wave 0 test file needed; the same `cargo test --features appstore` gate applies).*

---

## Manual-Only Verifications

| Behavior | Requirement | Task | Why Manual | Test Instructions |
|----------|-------------|------|------------|-------------------|
| Native StoreKit sheet presents; `.success`/`.userCancelled` round-trip in the sandboxed signed `.app` | Success criterion 1, MAS-IAP-01 | 26-06-2 (26-07-3 if swift-rs) | Out-of-process system UI — WebDriver-impossible (D-06) | Human Sandbox-tester walkthrough per PHASE-26-SANDBOX-WALKTHROUGH.md |
| Relaunch/transaction-replay clean (finish() actually finished) | MAS-IAP-04, Pitfall 4 | 26-06-2 (26-07-3 if swift-rs) | Requires quitting + relaunching the signed `.app` after a live purchase (Codex #4) | Purchase → quit → relaunch → confirm no duplicate transaction / no unexpected re-grant |
| Serverless JWS verify — process-scoped live capture (no non-Apple outbound) | MAS-IAP-04, Success criterion 2 | 26-06-2 (26-07-3 if swift-rs) | network.client allows outbound (not denied) so sandboxd-only is insufficient; needs a per-PID capture (Codex #3, check 2 of 2) | `nettop`/`lsof` on the app PID (or per-PID packet capture) during a purchase; static audit (check 1) is the Plan-05/07 grep |
| Real Sandbox-tester purchase round-trip; Restore re-grants on a fresh read | Success criterion 4, MAS-IAP-03-spike | 26-06-2 (26-07-3 if swift-rs) | `.storekit` cannot substitute on macOS; the D-11 Restore readout shows currentEntitlements() (Codex #5) | Human walkthrough per ASC-SETUP.md §6; confirm the pane shows re-granted pro.* codes |
| Live `.pending` (Ask-to-Buy) | MAS-IAP-01 | 26-06-2 | Hard to force without Family-Sharing config | Best-effort live; handler proven by the Rust unit core (26-01-2) + code inspection |
| ASC prerequisites (agreement, App ID, product, Sandbox tester) | MAS-IAP-01 | 26-04-2 | Apple web console — no CLI/API | Human executes PHASE-26-ASC-CHECKLIST.md |
| Bridge go/no-go decision (routes to GO / Plan 07 swift-rs / blocker) | MAS-IAP-01, MAS-IAP-04 | 26-05-3, 26-06-3, 26-07-4 | Human judgment on plugin viability | Recorded in PHASE-26-BRIDGE-VIABILITY.md; NO-GO triggers in-phase Plan 07 (Codex #1) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (code tasks: cargo/vitest/tsc/grep; doc tasks: grep; manual tasks: explicit human gate; preflight 26-02-0: doc+compile-check; Plan 07 conditional tasks: cargo/grep + a re-run human gate)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (3 new test files mapped to Plans 01/02/03; Plan 07 reuses the Plan-01 Rust core unchanged)
- [x] No watch-mode flags
- [x] Feedback latency < 90s (the agent-verifiable layer)
- [x] D-04 serverless proof hardened to TWO independent checks (static source audit + process-scoped per-PID capture) — Codex #3
- [x] finish() is a CITED-source blocking criterion + a relaunch/replay human check — Codex #4
- [x] NO-GO routes into an in-phase plan (Plan 07), not a dangling note — Codex #1
- [x] Plugin integration mode PROVEN by preflight before any Rust-callable assumption — Codex #2
- [x] Restore re-reads + renders currentEntitlements() so the re-grant is observable — Codex #5
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (planner, 2026-06-22; revision 1 — Codex adversarial findings 1-5 folded in)
</content>
</invoke>
