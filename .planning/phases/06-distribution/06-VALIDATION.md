---
phase: 6
slug: distribution
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-01
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `06-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (jsdom) + `tsc --noEmit` (TS ~5.8) for unit/type; WebdriverIO 9.x for real-WKWebView e2e |
| **Config file** | vitest (repo/vite config); `wdio.conf.ts` (globs `test/e2e/*.e2e.ts`) |
| **Quick run command** | `pnpm test` (`vitest run`) + `pnpm exec tsc --noEmit` |
| **Full suite command** | `pnpm test && pnpm exec tsc --noEmit && pnpm lint && bash scripts/e2e-spike.sh` |
| **Estimated runtime** | ~30–90 seconds (unit/type fast; e2e spike longer) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test` + `pnpm exec tsc --noEmit` (the lefthook gate; blocks red)
- **After every plan wave:** Run full suite (`pnpm test && tsc --noEmit && pnpm lint && bash scripts/e2e-spike.sh`)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~90 seconds (unit/type < 30s)

---

## Per-Task Verification Map

> Plan/task IDs are indicative (resolved by the planner). Requirement→test mapping is fixed by research.

| Area | Requirement | Secure Behavior | Test Type | Automated Command | File | Status |
|------|-------------|-----------------|-----------|-------------------|------|--------|
| Updater seam no-op (jsdom) | DST-02 | `browser.ts` updater resolves null / never throws | unit | `pnpm test` | `src/lib/platform/platform.test.ts` (extend) — W0 | ⬜ pending |
| Seam delegation | DST-02 | `platform.updater` getter delegates to injected stub | unit | `pnpm test` | `platform.test.ts` (extend) — W0 | ⬜ pending |
| Opt-in pref coercion | DST-02 | `autoUpdateCheck` coerced true/false; junk→null | unit | `pnpm test` | `src/shell/prefsStore.test.ts` (extend) — W0 | ⬜ pending |
| Update orchestration | DST-02 | check→banner→install state machine over stub seam | unit | `pnpm test` | `src/shell/update.test.ts` (NEW) — W0 | ⬜ pending |
| First-run opt-in branches | DST-02 | null→prompt; true→auto-check; false→no network call | unit | `pnpm test` | `update.test.ts` / `usePreferences.test.ts` — W0 | ⬜ pending |
| Update banner a11y | DST-02 / D-13 | renders; keyboard-dismissible; visible focus + AA; no opacity-only | unit (RTL) + e2e | `pnpm test` + `bash scripts/e2e-spike.sh` | `src/components/UpdateBanner.test.tsx` (NEW) + `test/e2e/update.e2e.ts` (NEW) — W0 | ⬜ pending |
| App launches with new plugins | DST-02 | non-blank launch with updater+process plugins registered | e2e | `bash scripts/e2e-spike.sh` | existing `test/e2e/*.e2e.ts` launch assertions | ⬜ pending |
| Decoder regression guard | All | 19 decoder tests stay green; tools offline in jsdom | unit | `pnpm test` | decoder suite — **MUST stay untouched** | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/platform/platform.test.ts` — extend with updater no-op + delegation tests (DST-02)
- [ ] `src/shell/testStore.ts` — add exported `noopUpdater` stub (prevents `tsc` breakage across all Platform stubs)
- [ ] `src/shell/prefsStore.test.ts` — extend for `autoUpdateCheck` coercion (DST-02)
- [ ] `src/shell/update.test.ts` — NEW; check→prompt→install state machine + opt-in branches
- [ ] `src/components/UpdateBanner.test.tsx` — NEW; render/dismiss/a11y (D-13)
- [ ] `test/e2e/update.e2e.ts` — NEW; banner visible + keyboard-dismissible on real WKWebView
- [ ] No new framework install needed — vitest/tsc/wdio all present

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| DMG builds; `.app.tar.gz` + `.sig` produced | DST-01 | Needs a real `pnpm tauri build`; not jsdom-driveable | `pnpm tauri build` exits 0; verify DMG + `*.app.tar.gz` + `*.sig` in `src-tauri/target/release/bundle/` (RELEASE.md step) |
| Real updater round-trip (build N → publish → build N+1 → update verifies & relaunches) | DST-01 / DST-02 | Needs two signed builds + a published GitHub Release; minisign verify + bundle swap are plugin internals | Per RELEASE.md runbook; human sign-off at phase gate |
| Gatekeeper-clean install on clean machine | DST-01 | Requires Apple Developer ID cert + notarisation | **DEFERRED to post-enrolment (D-02)** — not a Phase 6 blocker |

*Note: minisign cryptographic verify and the bundle swap are plugin internals — NOT unit-testable in jsdom; exercised only by the manual round-trip at the phase gate. The updater no-op fallback keeps tool runtime offline in jsdom.*

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (the 6 scaffolds above)
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter (after planner wires Wave 0)

**Approval:** pending
