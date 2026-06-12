---
phase: 19
slug: license-activation-offline-verification
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-12
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 19-RESEARCH.md § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (webview)** | Vitest (existing, 816 green) + tsc + eslint via lefthook |
| **Framework (Rust)** | `cargo test` (NEW this phase — first substantive Rust module) |
| **Config file** | vitest config existing; cargo needs none — Wave 0 adds `src-tauri/src/license/` test modules + fixtures |
| **Quick run command** | `pnpm vitest run` · `cargo test --manifest-path src-tauri/Cargo.toml` |
| **Full suite command** | lefthook gate (tsc+vitest+eslint) + `cargo test` + real-WKWebView e2e (`scripts/e2e-spike.sh`) |
| **Estimated runtime** | lefthook ~40s · cargo test ~seconds (pure logic) · e2e ~10 min (phase gate only) |

---

## Sampling Rate

- **After every task commit:** lefthook (tsc+vitest+eslint) automatic; Rust tasks add `cargo test --manifest-path src-tauri/Cargo.toml` to their DoD explicitly
- **After every plan wave:** full vitest + cargo test + tsc
- **Before `/gsd-verify-work`:** full suite + real-WKWebView e2e green
- **Max feedback latency:** ~60s (per-commit gate)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 19-01-T1 | 01 | 1 | D-40 CE bring-up | T-19-xx | CE up w/ TLS; secrets gitignored (grep acceptance) | scripted (curl health) | curl health check vs CE TLS | ❌ W0 | ⬜ pending |
| 19-01-T2 | 01 | 1 | D-42 SPIKE, LIC-02 probe | T-19-xx | Lifecycle proven; token-denial + MACHINE_LIMIT_EXCEEDED payload recorded in 19-SPIKE-OUTCOME.md; real fixtures minted | scripted runbook + greps | fixture + SPIKE-OUTCOME greps | ❌ W0 | ⬜ pending |
| 19-02-T1 | 02 | 2 | LIC-01 | T-19-xx | Fingerprint = HMAC-SHA256(IOPlatformUUID, salt) in Rust only; cargo test joins lefthook pre-push | cargo unit | `cargo test --manifest-path src-tauri/Cargo.toml license::` | ❌ W0 | ⬜ pending |
| 19-02-T2 | 02 | 2 | LIC-03, LIC-06 | T-19-xx | Valid lic + matching fp → licensed zero-network; 9 fail-closed cases (corrupt/tampered/foreign/wrong-alg) → typed errors → free tier | cargo unit (fixture certs incl. real CE cross-validation) | `cargo test ... verify` | ❌ W0 | ⬜ pending |
| 19-02-T3 | 02 | 2 | LIC-04 | T-19-xx | Key only via Keychain trait; atomic lic store; no payload carries key material | cargo unit (keychain trait mock) + grep | `cargo test` + tsc | ❌ W0 | ⬜ pending |
| 19-03-T1 | 03 | 3 | LIC-01, LIC-02 | T-19-xx | HTTP client exact endpoints; D-38 offline/unreachable split; dev-only CA trust `#[cfg(debug_assertions)]` | cargo unit | `cargo test` + `cargo build` | ❌ W0 | ⬜ pending |
| 19-03-T2 | 03 | 3 | LIC-01, D-45 | T-19-xx | Activation state machine; `license_status` pure-local (no `.await` on client calls) | cargo unit | `cargo test` | ❌ W0 | ⬜ pending |
| 19-03-T3 | 03 | 3 | LIC-04 | T-19-xx | 4 Tauri commands via platform seam; browser stubs so vitest never touches Tauri | vitest + tsc | `tsc --noEmit` + `pnpm vitest run src/lib/platform/` | ❌ W0 | ⬜ pending |
| 19-04-T1 | 04 | 4 | LIC-01/02 (UX) | — | D-33/34/35 inline form + aria-live + live unlock; D-36/37/38 error copy | vitest (platform stub) | tsc + vitest (UpsellPanel + licenseUi) | ❌ W0 | ⬜ pending |
| 19-04-T2 | 04 | 4 | LIC-06 (UX), LIC-03 | — | D-43 footer hint + D-44 panel problem-state; e2e seeds bad machine.lic | vitest + real-WKWebView e2e | tsc + vitest + `scripts/e2e-spike.sh` | ❌ W0 | ⬜ pending |
| 19-04-T3 | 04 | 4 | phase gate | — | build + walkthrough vs live CE + offline-launch proof + Keychain check | checkpoint:human-verify | check-dev-strip + bundle ls (manual rest) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky.*

---

## Wave 0 Requirements

- [ ] `src-tauri/src/license/verify.rs` + inline `#[cfg(test)]` fixture-driven tests — LIC-03/LIC-06
- [ ] `src-tauri/src/license/fingerprint.rs` HMAC unit tests — LIC-01
- [ ] dev-deps: `ed25519-dalek` `rand_core` feature + `rand` for fixture keygen
- [ ] `src/lib/platform/` license command stubs (browser/stub arms) so vitest never touches Tauri — LIC-01/02/06 UI tests
- [ ] e2e spec `test/e2e/license.e2e.ts` for offline-reachable UI states (panel form, error rendering, footer attention state)
- [ ] `scripts/keygen-ce/` bring-up + bootstrap scripts (compose.yaml, .env.example, bootstrap.sh) — SPIKE infrastructure

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live activation against CE (validate→activate→checkout) | LIC-01/02, D-42 | Needs Docker daemon + network + live instance — not CI-able | SPIKE runbook; outcome in 19-SPIKE-OUTCOME.md |
| Real Keychain read/write on built app | LIC-04 | Signing identity + user keychain prompts | Phase-boundary human walkthrough on `pnpm tauri build` output |
| Docker CE bring-up | D-40 | Daemon state + host env | SPIKE runbook step 1 (daemon currently DOWN — first task starts it) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (TDD lands tests green with impl per lefthook constraint)
- [x] No watch-mode flags
- [x] Feedback latency < 60s (exception: 19-04-T2 full e2e ~10 min — mandated by binding harness; tsc+vitest run first)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-12 (plan-checker dimension-8 sweep: PASS, zero sampling gaps)
