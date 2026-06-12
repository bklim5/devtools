---
phase: 19
slug: license-activation-offline-verification
status: draft
nyquist_compliant: false
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
| TBD by planner | 01 | 1 | D-42 SPIKE | T-19-xx | CE lifecycle proven; token-denial recorded in 19-SPIKE-OUTCOME.md | scripted runbook (manual) | — (not CI) | ❌ W0 | ⬜ pending |
| TBD by planner | 02 | — | LIC-01 | T-19-xx | Fingerprint = HMAC-SHA256(IOPlatformUUID, salt) in Rust only | cargo unit | `cargo test --manifest-path src-tauri/Cargo.toml license::` | ❌ W0 | ⬜ pending |
| TBD by planner | 02 | — | LIC-03 | T-19-xx | Valid lic + matching fingerprint → licensed, zero network | cargo unit (fixture certs) | `cargo test ... verify` | ❌ W0 | ⬜ pending |
| TBD by planner | 02 | — | LIC-04 | T-19-xx | Key only in Keychain; no command payload carries key material | cargo unit (keychain trait mock) + grep assertion | `cargo test` + grep | ❌ W0 | ⬜ pending |
| TBD by planner | 02 | — | LIC-06 | T-19-xx | Corrupt/tampered/foreign/wrong-alg → typed fail-closed errors → free tier | cargo unit (7 fixture cases) | `cargo test` | ❌ W0 | ⬜ pending |
| TBD by planner | 03 | — | LIC-01 (UX) | — | D-33/34/35 inline form, aria-live status, live unlock | vitest (platform stub) + e2e | `pnpm vitest run src/` | ❌ W0 | ⬜ pending |
| TBD by planner | 03 | — | LIC-02 (UX) | — | Seat-limit → D-36 calm message naming resolution path | vitest (stubbed error code); live vs CE in walkthrough | `pnpm vitest run` | ❌ W0 | ⬜ pending |
| TBD by planner | 03 | — | LIC-06 (UX) | — | D-43 footer hint + D-44 panel problem-state per error code | vitest + e2e (seed bad machine.lic) | `pnpm vitest run` + e2e spec | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. Task IDs filled by planner.*

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
