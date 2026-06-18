---
phase: 24
slug: hotkeys-general-panes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-18
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (unit) + real-WKWebView e2e (verify-gate) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `pnpm vitest run` |
| **Full suite command** | `pnpm vitest run && pnpm tsc --noEmit` |
| **Estimated runtime** | ~20 seconds (unit + typecheck) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run`
- **After every plan wave:** Run `pnpm vitest run && pnpm tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite green + real-WKWebView e2e on the verify-gate
- **Max feedback latency:** 20 seconds (unit); native items verified at the phase-boundary build walkthrough

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _planner fills during planning_ | | | SET-08 / SET-09 | | | unit / manual | `pnpm vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- _Planner fills_: chord-helper unit specs (`keyEventToAccelerator` / `matchesChord` round-trip + Option-glyph case), prefs-coercion specs (invalid chord → shipped default), default-tool resolution specs.

*The decoder's 19 tests are the immovable bar — untouched. New features add their own (TDD).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Native summon re-register failure (taken chord) → inline reject, prior binding kept, nothing persisted | SET-08 | OS register-result only available on real WKWebView; stub/browser arms no-op | On the built `.app`, rebind summon to a taken chord (e.g. Cmd+Space) → expect calm inline message, old chord still summons, restart shows old chord |
| Rebound summon survives restart | SET-08 | Persistence race only visible on real prefs.json | Rebind summon → quit → relaunch → new chord summons |
| Launch-at-login enable/disable | SET-09 | Autostart plugin writes a real LaunchAgent; no test seam | Toggle launch-at-login on → confirm login-item registered; toggle off → removed |
| start-in-tray + login-hidden (no window flash) | SET-09 | Window-visibility timing only observable on real app | Enable start-in-tray → quit → relaunch → app stays hidden to tray, no flash; summon/tray-click reveals |
| default-tool selection takes effect on open | SET-09 | Startup-tool resolution exercised at app launch | Set default tool ≠ "Last used" → relaunch → app opens that tool |

*Native items are verified at the phase-boundary `pnpm tauri build` human walkthrough + `gsd-ui-review` WCAG-AA audit.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (or are listed Manual-Only with reason)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
