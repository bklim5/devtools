---
phase: 10
slug: bump-and-tag-driver
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-02
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (unit) + tsc --noEmit (types) + eslint (lint) |
| **Config file** | vitest.config.* / tsconfig.json / eslint config (existing) |
| **Quick run command** | `pnpm test -- --run` |
| **Full suite command** | `pnpm test -- --run && pnpm exec tsc --noEmit && pnpm lint` |
| **Estimated runtime** | ~seconds (no `tauri build` in this phase) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test -- --run`
- **After every plan wave:** Run `pnpm test -- --run && pnpm exec tsc --noEmit && pnpm lint`
- **Before `/gsd-verify-work`:** Full suite must be green (the same gate the script's own preflight enforces — D-07)
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

> Populated by the planner. The bump driver is a Node ESM script exercised via the
> dry-run path (zero side effects) and unit/integration assertions against a temp git
> repo or fixture manifests; the destructive push path is verified by dry-run plan
> output + preflight unit coverage, not by a live push.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | REL-01/03/04/10/11 | TBD | TBD | unit/integration | `pnpm test -- --run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for the bump-driver pure helpers (computed version → 3 manifest edits, "only expected paths changed" assertion, dry-run produces zero writes)
- [ ] Fixture manifests or temp-repo harness for exercising file I/O without touching the real repo
- [ ] vitest/tsc/eslint already present — no framework install needed

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real `git push` of commit + annotated tag to private `origin` | REL-04 | Irreversible network action against the live private remote; cannot be safely automated in CI | Maintainer runs `pnpm release:bump patch` on a real bump, confirms at the y/N prompt, verifies the `vX.Y.Z` tag + commit appear on `bklim5/devtools` |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
