---
phase: 10
slug: bump-and-tag-driver
status: planned
nyquist_compliant: true
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
| **Quick run command** | `pnpm test` |
| **Full suite command** | `pnpm test && pnpm exec tsc --noEmit && pnpm lint` |
| **Estimated runtime** | ~seconds (no `tauri build` in this phase) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test`
- **After every plan wave:** Run `pnpm test && pnpm exec tsc --noEmit && pnpm lint`
- **Before `/gsd-verify-work`:** Full suite must be green (the same gate the script's own preflight enforces — D-07)
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

> The testable decision logic lives in the PURE core `src/lib/release/bumpPlan.ts`
> (Plan 02), unit-covered by vitest — giving REL-01/REL-10/REL-11 automated
> verification. The thin driver `scripts/bump-and-tag.mjs` (Plan 03) is exercised
> via grep-acceptance + a real `--dry-run` (zero side effects) + scripted preflight
> aborts. The single irreversible live push (REL-04) is the one manual-only gate.
> No 3 consecutive tasks lack an automated verify.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| P1·T1 Cargo.lock housekeeping commit | 01 | 1 | REL-03 | T-10-01/02 | Isolated lock commit; explicit `git add` (no `-A`) | integration | `test -z "$(git status --porcelain)" && git show HEAD:src-tauri/Cargo.lock \| grep -A1 devtools-app \| grep -q 0.2.1` | ✅ repo | ⬜ pending |
| P1·T2 clean-tree gate | 01 | 1 | REL-03 | — | Tagged tree passes the same gate as every commit | unit/type/lint | `pnpm test && pnpm exec tsc --noEmit && pnpm lint` | ✅ existing | ⬜ pending |
| P2·T1 parseBumpArgs + isAffirmative | 02 | 2 | REL-10/REL-11 | T-10-03 | Allowlist CLI grammar (D-01/D-02); confirm default NO | unit (TDD) | `pnpm test -- bumpPlan` | ❌ W0 (Plan 02 T1) | ⬜ pending |
| P2·T2 buildBumpPlan single-source | 02 | 2 | REL-01 | T-10-04 | One computed version threaded to 3 manifests + tag + msg | unit (TDD) | `pnpm test -- bumpPlan` | ❌ W0 (Plan 02 T1) | ⬜ pending |
| P2·T3 allowlist + dry-run/recovery text | 02 | 2 | REL-10/REL-11 | T-10-05/06 | pnpm-lock no-op tolerated; pure return-strings | unit (TDD) | `pnpm test -- bumpPlan` | ❌ W0 (Plan 02 T1) | ⬜ pending |
| P2·T4 gate + purity audit | 02 | 2 | REL-01/10/11 | — | Core provably side-effect-free | unit/type/lint + grep | `pnpm test && pnpm exec tsc --noEmit && pnpm lint` | ✅ after T1 | ⬜ pending |
| P3·T1 driver implementation | 03 | 3 | REL-01/03/04/10/11 | T-10-04/07/08/09/10 | execFileSync argv; no reset; no secret echo | grep-acceptance + lint | `pnpm lint` + acceptance greps | ❌ W0 (Plan 03 T1) | ⬜ pending |
| P3·T2 dry-run + preflight aborts | 03 | 3 | REL-10/REL-11 | T-10-07 | Zero side effects; fail-fast before write | integration | `pnpm release:bump patch --dry-run` then diff `git status --porcelain` | ❌ W0 (Plan 03 T1) | ⬜ pending |
| P3·T3 real bump + push | 03 | 3 | REL-04 | T-10-07/09 | y/N confirm before irreversible push | MANUAL-ONLY | n/a (live push to private origin) | ❌ manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> **Nyquist continuity:** Wave 2 (Plan 02 T1) creates `bumpPlan.test.ts`, which becomes
> the automated harness every subsequent core/driver task samples against. The only
> task without an automated verify is the final manual-only live push (P3·T3) — it is
> preceded by two automated tasks (P3·T1 grep+lint, P3·T2 dry-run integration), so no
> 3 consecutive tasks lack automated verification.

---

## Wave 0 Requirements

- [ ] **Plan 02 Task 1 creates `src/lib/release/bumpPlan.test.ts`** — the unit harness for the pure decision core (parseBumpArgs, buildBumpPlan single-source threading, assertOnlyExpectedPaths incl. the pnpm-lock no-op case, dry-run/recovery text builders, isAffirmative). This is the load-bearing Wave 0 artifact; all later automated verifies depend on it.
- [ ] No fixture-manifest temp-repo harness needed — buildBumpPlan's `manifests[].apply` are pure string→string transforms, unit-tested against inline string fixtures (mirrors version.test.ts).
- [ ] **Plan 03 Task 1 creates `scripts/bump-and-tag.mjs`** — the integration target for the dry-run / preflight-abort checks in Plan 03 Task 2.
- [ ] vitest/tsc/eslint already present — no framework install needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real `git push` of commit + annotated tag to private `origin` | REL-04 | Irreversible network action against the live private remote; cannot be safely automated | Maintainer runs `pnpm release:bump patch` on a real bump (Plan 03 Task 3 checkpoint), confirms one computed version across all 3 manifests + the annotated `vX.Y.Z` tag + clean tree, exercises the declined-confirm recovery path, then answers `y` and verifies the commit + tag appear on `bklim5/devtools`; confirms no secret echoed |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or a Wave 0 dependency (only the live push is manual-only, by design)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (bumpPlan.test.ts in Plan 02 T1; bump-and-tag.mjs in Plan 03 T1)
- [x] No watch-mode flags (all `pnpm test` = `vitest run`)
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (planner)
