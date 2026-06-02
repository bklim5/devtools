---
phase: 10
slug: bump-and-tag-driver
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-02
validated: 2026-06-02
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
| P1·T1 Cargo.lock housekeeping commit | 01 | 1 | REL-03 | T-10-01/02 | Isolated lock commit; explicit `git add` (no `-A`) | integration | commit `8a0b2975` changed only `Cargo.lock` (1 line) — diff-verified | ✅ repo | ✅ green |
| P1·T2 clean-tree gate | 01 | 1 | REL-03 | — | Tagged tree passes the same gate as every commit | unit/type/lint | `pnpm test && pnpm exec tsc --noEmit && pnpm lint` | ✅ existing | ✅ green |
| P2·T1 parseBumpArgs + isAffirmative | 02 | 2 | REL-10/REL-11 | T-10-03 | Allowlist CLI grammar (D-01/D-02); confirm default NO | unit (TDD) | `pnpm test -- bumpPlan` | ✅ created | ✅ green |
| P2·T2 buildBumpPlan single-source | 02 | 2 | REL-01 | T-10-04 | One computed version threaded to 3 manifests + tag + msg | unit (TDD) | `pnpm test -- bumpPlan` | ✅ created | ✅ green |
| P2·T3 allowlist + dry-run/recovery text | 02 | 2 | REL-10/REL-11 | T-10-05/06 | pnpm-lock no-op tolerated; pure return-strings | unit (TDD) | `pnpm test -- bumpPlan` | ✅ created | ✅ green |
| P2·T4 gate + purity audit | 02 | 2 | REL-01/10/11 | — | Core provably side-effect-free (47 cases) | unit/type/lint + grep | `pnpm test && pnpm exec tsc --noEmit && pnpm lint` | ✅ after T1 | ✅ green |
| P3·T1 driver implementation | 03 | 3 | REL-01/03/04/10/11 | T-10-04/07/08/09/10 | execFileSync argv; no reset; no secret echo | grep-acceptance + lint | `pnpm lint` + acceptance greps | ✅ created | ✅ green |
| P3·T2 dry-run + preflight aborts | 03 | 3 | REL-10/REL-11 | T-10-07 | Zero side effects; fail-fast before write | integration (manual-only — see below) | `pnpm release:bump patch --dry-run` then diff `git status --porcelain` | ✅ created | ☑️ manual-verified |
| P3·T3 real bump + push | 03 | 3 | REL-04 | T-10-07/09 | y/N confirm before irreversible push | MANUAL-ONLY | n/a (live push to private origin) | ✅ done | ☑️ manual-verified (v0.2.2) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> **Nyquist continuity:** Wave 2 (Plan 02 T1) creates `bumpPlan.test.ts`, which becomes
> the automated harness every subsequent core/driver task samples against. The only
> task without an automated verify is the final manual-only live push (P3·T3) — it is
> preceded by two automated tasks (P3·T1 grep+lint, P3·T2 dry-run integration), so no
> 3 consecutive tasks lack automated verification.

---

## Wave 0 Requirements

- [x] **Plan 02 Task 1 created `src/lib/release/bumpPlan.test.ts`** — the unit harness for the pure decision core (parseBumpArgs, buildBumpPlan single-source threading, assertOnlyExpectedPaths incl. the pnpm-lock no-op case, dry-run/recovery text builders, isAffirmative). 47 cases, green. All later automated verifies depend on it.
- [x] No fixture-manifest temp-repo harness needed — buildBumpPlan's `manifests[].apply` are pure string→string transforms, unit-tested against inline string fixtures (mirrors version.test.ts).
- [x] **Plan 03 Task 1 created `scripts/bump-and-tag.mjs`** — the integration target for the dry-run / preflight-abort checks in Plan 03 Task 2.
- [x] vitest/tsc/eslint already present — no framework install needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real `git push` of commit + annotated tag to private `origin` | REL-04 | Irreversible network action against the live private remote; cannot be safely automated | Maintainer runs `pnpm release:bump patch` on a real bump (Plan 03 Task 3 checkpoint), confirms one computed version across all 3 manifests + the annotated `vX.Y.Z` tag + clean tree, exercises the declined-confirm recovery path, then answers `y` and verifies the commit + tag appear on `bklim5/devtools`; confirms no secret echoed. ✅ **Done 2026-06-02 — `v0.2.2` pushed to origin (`b210ed19`).** |
| Driver `--dry-run` zero side effects + preflight aborts | REL-10/REL-11 (driver layer) | Decided manual-only during validation audit (2026-06-02): the pure decision logic is fully unit-covered in `bumpPlan.ts`; persisting a driver integration test (temp-repo harness mocking git/pnpm/cargo) was judged not worth the harness cost. The driver's I/O orchestration is re-checked by hand. | Run `pnpm release:bump patch --dry-run` and confirm exit 0, full plan printed, and `git status --porcelain` byte-identical before/after (no tag created). Then on a deliberately dirty / non-master / existing-tag tree, confirm each preflight aborts non-zero with a clear reason **before** any write. ☑️ **Manual-verified 2026-06-02** during execution + verification. |

---

## Validation Audit 2026-06-02

| Metric | Count |
|--------|-------|
| Requirements audited | 5 (REL-01/03/04/10/11) |
| Automated-covered (green) | 3 (REL-01/10/11 via `bumpPlan.test.ts`, 47 cases) + the existing full-gate (REL-03 tree) |
| Manual-only (by decision) | 2 (REL-04 live push; driver-layer dry-run/preflight) |
| Gaps found | 1 (driver `bump-and-tag.mjs` has no committed integration test) |
| Resolved | 0 |
| Escalated | 0 |
| Disposition | Gap accepted as **manual-only** by maintainer decision — pure core is fully unit-covered; a driver temp-repo integration harness was judged not worth the cost. `nyquist_compliant: true` retained (no 3 consecutive tasks lack automated verify; the only un-automated tasks are the two manual-only items, each preceded by automated tasks). |

**Run by:** orchestrator audit (State A) + maintainer decision. Full suite green at audit time: vitest 463/463, tsc + eslint clean, decoder's 19 untouched.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or a Wave 0 dependency (only the live push is manual-only, by design)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (bumpPlan.test.ts in Plan 02 T1; bump-and-tag.mjs in Plan 03 T1)
- [x] No watch-mode flags (all `pnpm test` = `vitest run`)
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (planner) · validated 2026-06-02 (State-A audit — execution coverage confirmed, 1 gap accepted manual-only)
