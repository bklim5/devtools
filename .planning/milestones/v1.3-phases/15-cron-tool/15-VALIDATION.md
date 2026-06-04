---
phase: 15
slug: cron-tool
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-03
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `vitest` + `@testing-library/react` (jsdom); `tsc --noEmit` |
| **Config file** | existing project vitest config (used by all prior phases) |
| **Quick run command** | `pnpm vitest run src/lib/cron src/tools/cron` |
| **Full suite command** | `pnpm vitest run && pnpm tsc --noEmit` |
| **Estimated runtime** | ~quick: a few seconds · full: includes the immovable 19 decoder tests + ~580 others |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run src/lib/cron src/tools/cron` + `tsc --noEmit`
- **After every plan wave:** Run full `pnpm vitest run` (all tests incl. the 19 decoder tests)
- **Before `/gsd-verify-work`:** Full suite must be green + real-WKWebView `scripts/e2e-spike.sh` exit 0
- **Max feedback latency:** < 10 seconds (quick run)

---

## Per-Task Verification Map

| Task ID | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| parse+describe | 1 | CRON-01/02/03/04 | — | error-as-value parser; no `eval`/`Function` on input | unit | `pnpm vitest run src/lib/cron` | ❌ W0 | ⬜ pending |
| next-5-runs | 1 | CRON-05 | — | bounded iteration | unit | `pnpm vitest run src/lib/cron` | ❌ W0 | ⬜ pending |
| DOM/DOW union | 1 | CRON-06 | — | N/A | unit | `pnpm vitest run src/lib/cron` | ❌ W0 | ⬜ pending |
| DST fixtures | 1 | CRON-07 | — | N/A (fixed `now` + zone) | unit | `pnpm vitest run src/lib/cron` | ❌ W0 | ⬜ pending |
| impossible→never | 1 | CRON-08 | DoS-by-impossible-expr | hard cap → `{kind:"never"}`, returns within cap | unit | `pnpm vitest run src/lib/cron` | ❌ W0 | ⬜ pending |
| @reboot | 1 | CRON-09 | — | no clock computation | unit | `pnpm vitest run src/lib/cron` | ❌ W0 | ⬜ pending |
| invalid→error | 1 | CRON-11 | input validation | error-as-value, no throw | unit | `pnpm vitest run src/lib/cron` | ❌ W0 | ⬜ pending |
| L/nL/L-n | (final) | CRON-10 | — | leap-year/month-length aware | unit (isolated final plan) | `pnpm vitest run src/lib/cron` | ❌ W0 | ⬜ pending |
| tool view | (last) | CRON-01..11 | XSS (escaped React only) | paste-instant, copyable, error/empty states, a11y | component + e2e | `CronTool.test.tsx` + `test/e2e/cron.e2e.ts` via `scripts/e2e-spike.sh` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/cron/cron.test.ts` — parse/describe/next-run/DOM-DOW/DST/impossible/error (CRON-01..09, 11)
- [ ] `src/lib/cron/cron.test.ts` (or dedicated block) — L/nL/L-n leap-year/month-length fixtures (CRON-10, isolated final plan)
- [ ] `src/tools/cron/CronTool.test.tsx` — component: paste-instant, copyable runs, error state, empty state
- [ ] `test/e2e/cron.e2e.ts` — real-WKWebView spec (add to `scripts/e2e-spike.sh` spec list; mirror `url.e2e.ts`/`regex.e2e.ts`)
- [ ] No framework install needed (vitest already present)

> **TDD note (MEMORY + STATE):** lefthook rejects failing commits — do **not** plan standalone RED-only test commits; land each test file GREEN with its implementation (the Phase-14 Rule-4 pattern).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Paste-instant feel + visual parity with `design/` | CRON-01..11 | Requires the real WKWebView render | Run `scripts/e2e-spike.sh`, screenshot vs `design/DevTools Mockup.html`; confirm 5-run compute is sub-millisecond |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
