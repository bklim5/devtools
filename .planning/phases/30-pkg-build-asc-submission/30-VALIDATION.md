---
phase: 30
slug: pkg-build-asc-submission
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-25
---

# Phase 30 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
>
> **Note (this phase's reality):** Phase 30 is a build-pipeline + ship-artifact phase, not
> a feature-code phase. Most verification is **shell-assert based** (signing/structure checks
> run *inside* the build scripts as FATAL tail-calls) plus a **mandatory human ship-gate
> walkthrough** that automation cannot drive (StoreKit purchase, Sandbox, refund→Pro-drop,
> Transporter upload). The decoder's 19 vitest tests + `tsc --noEmit` remain the immovable
> regression bar (MAS-SHIP-05: decoder byte-for-byte untouched).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing) + shell asserts (`scripts/verify-appstore-bundle.sh`, new pkg-verify gate) |
| **Config file** | `vitest.config.ts` (existing); build scripts self-gate |
| **Quick run command** | `pnpm test` (vitest) + `pnpm tsc --noEmit` |
| **Full suite command** | `pnpm test && pnpm tsc --noEmit && bash scripts/verify-appstore-bundle.sh <app>` |
| **Estimated runtime** | ~30–60s (vitest+tsc); pkg build+verify minutes |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test && pnpm tsc --noEmit` (guards the decoder bar + types)
- **After every plan wave:** Run the full suite (+ the relevant shell verify gate)
- **Before `/gsd-verify-work`:** Full suite green; `.pkg` static-verify gate green
- **Max feedback latency:** ~60 seconds (unit) / build-time (pkg gates)

---

## Per-Task Verification Map

> Populated during planning/execution. Each task's automated verify (shell assert, grep,
> vitest, or `git diff` cleanliness for the decoder) is recorded here.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 30-XX-XX | XX | X | MAS-SHIP-0X | — | {to be filled by planner} | shell/unit | `{command}` | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Confirm existing vitest + `verify-appstore-bundle.sh` infrastructure covers the regression bar (no new framework needed).

*Existing infrastructure (vitest, tsc, verify-appstore-bundle.sh) covers all automatable phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Signed `.pkg` accepted by ITMS | MAS-SHIP-02 | Transporter upload is human-only (D-01); no API key (D-02) | Human uploads `.pkg` via Transporter.app; observe successful delivery / ITMS bounce reasons |
| Pro IAP purchase round-trip | MAS-SHIP-04 | StoreKit/Sandbox cannot be driven by WebDriver | Human ship-gate: launch dev-signed `.app`, real Sandbox purchase, restore on fresh container, refund→Pro-drop |
| Support + privacy URLs resolve | MAS-SHIP-03/04 | Live web deploy in separate repo | Human confirms `https://tinkerdev.io/support` + `/privacy` resolve before Submit |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or are recorded as Manual-Only with justification
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s (unit tier)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
