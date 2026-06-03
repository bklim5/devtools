---
phase: 14
slug: regex-tester
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-03
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest `4.1.7` (unit) + `@testing-library/react` 16.3.2 (component, jsdom per-file) + WebdriverIO `@wdio` 9.27 real-WKWebView e2e |
| **Config file** | `vite.config.ts` (`test` block; node env, jsdom opt-in via `// @vitest-environment jsdom`) |
| **Quick run command** | `pnpm vitest run src/lib/regex` |
| **Full suite command** | `pnpm vitest run && pnpm tsc --noEmit` then `scripts/e2e-spike.sh` (real WKWebView) |
| **Estimated runtime** | ~5 seconds (quick) / ~60 seconds (full + e2e) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run src/lib/regex` (+ `src/tools/regex` once the view exists)
- **After every plan wave:** Run `pnpm vitest run && pnpm tsc --noEmit && pnpm eslint`
- **Before `/gsd-verify-work`:** Full suite green + `scripts/e2e-spike.sh` exit 0 (incl. catastrophic-pattern spec)
- **Max feedback latency:** ~5 seconds (quick core run)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 0 | RGX-01..07 | — | N/A (test stubs) | unit/component/e2e | `pnpm vitest run src/lib/regex` | ❌ W0 | ⬜ pending |
| 14-02-01 | 02 | 1 | RGX-01 | — | matches enumerated, indices correct | unit | `pnpm vitest run src/lib/regex` | ❌ W0 | ⬜ pending |
| 14-02-02 | 02 | 1 | RGX-02 | — | numbered + named groups present | unit | `pnpm vitest run src/lib/regex` | ❌ W0 | ⬜ pending |
| 14-02-03 | 02 | 1 | RGX-03 | — | flags g/i/m/s/u alter results | unit | `pnpm vitest run src/lib/regex` | ❌ W0 | ⬜ pending |
| 14-02-04 | 02 | 1 | RGX-04 | — | replace `$1`/`$<name>`/`$&` expand | unit | `pnpm vitest run src/lib/regex` | ❌ W0 | ⬜ pending |
| 14-02-05 | 02 | 1 | RGX-06, RGX-07 | T-14-01 | catastrophic pattern → timeout via watchdog; invalid → error no throw | unit | `pnpm vitest run src/lib/regex` | ❌ W0 | ⬜ pending |
| 14-03-01 | 03 | 2 | RGX-05 | — | inserting library pattern sets state | component | `pnpm vitest run src/tools/regex` | ❌ W0 | ⬜ pending |
| 14-03-02 | 03 | 2 | RGX-07 | T-14-02 | escaped rendering, no `dangerouslySetInnerHTML` | component + grep | `pnpm vitest run src/tools/regex` + absence-grep | ❌ W0 | ⬜ pending |
| 14-03-03 | 03 | 2 | RGX-06 | T-14-01 | catastrophic → "timed out" + responsive UI on real WKWebView | e2e | `scripts/e2e-spike.sh` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs/waves are indicative — the planner finalizes the wave/plan breakdown.*

---

## Wave 0 Requirements

- [ ] `src/lib/regex/regex.test.ts` — RGX-01/02/03/04/07 pure-core cases incl. a known catastrophic pattern run *through the watchdog harness* and the zero-length pattern `/^/gm`
- [ ] `src/tools/regex/RegexTool.test.tsx` — RGX-05 insert; RGX-07 escaped rendering + `dangerouslySetInnerHTML` absence-grep
- [ ] `test/e2e/regex.e2e.ts` — RGX-06 catastrophic-pattern "timed out" + responsive UI on the real WKWebView (proves the worker chunk loaded in the packaged app)
- [ ] Framework install: none (vitest/wdio already present)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live highlight overlay visually aligns with text | RGX-01 | Pixel alignment of span overlay vs textarea not asserted in unit tests | In `tauri dev`, paste sample text + pattern, confirm highlights sit exactly over matched substrings |
| WCAG-AA contrast of highlight/error colors | RGX-01, RGX-07 | Visual contrast audit | `gsd-ui-review` WCAG-AA audit at phase gate |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
