---
phase: 24
slug: hotkeys-general-panes
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-18
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (unit, jsdom) + real-WKWebView e2e (verify-gate via scripts/e2e-spike.sh) |
| **Config file** | `vite.config.ts` (vitest) · `wdio.conf.ts` (e2e) |
| **Quick run command** | `pnpm vitest run` |
| **Full suite command** | `pnpm vitest run && pnpm exec tsc --noEmit && pnpm lint` |
| **Estimated runtime** | ~20 seconds (unit + typecheck) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run`
- **After every plan wave:** Run `pnpm vitest run && pnpm exec tsc --noEmit` + real-WKWebView e2e via `scripts/e2e-spike.sh`
- **Before `/gsd-verify-work`:** Full suite green + real-WKWebView e2e on the verify-gate
- **Max feedback latency:** 20 seconds (unit); native items verified at the phase-boundary build walkthrough

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-T1 chord helpers | 01 | 1 | SET-08 | T-24-04 | e.code-only capture, non-shift modifier required | unit | `pnpm vitest run src/shell/hotkeyAccelerator.test.ts` | ❌ W0 (creates) | ⬜ pending |
| 01-T2 prefs fields + coercers + default-tool | 01 | 1 | SET-08 / SET-09 | T-24-01, T-24-02 | invalid chord → default; unknown tool-id → null (getToolById) | unit | `pnpm vitest run src/shell/prefsStore.test.ts src/shell/usePreferences.test.ts src/shell/resolveStartupTool.test.ts` | ⚠️ extend | ⬜ pending |
| 01-T3 autostart capability + Rust | 01 | 1 | SET-09 | T-24-03, T-24-05 | seam-only import; scoped 3 perms; None launch args | unit + cargo | `pnpm exec tsc --noEmit && pnpm vitest run src/router.test.tsx && cargo build --manifest-path src-tauri/Cargo.toml` | ⚠️ extend | ⬜ pending |
| 02-T1 prefs-driven summon + rebind | 02 | 2 | SET-08 | T-05-07, T-05-04 | unregister-old→register-new→restore-on-reject→re-throw | unit | `pnpm vitest run src/shell/summon.test.ts` | ⚠️ extend | ⬜ pending |
| 02-T2 startup reveal (start-in-tray gate) | 02 | 2 | SET-09 | T-24-06 | reveal gated on !startInTray; prefsLoaded gate; no hide() | unit | `pnpm vitest run src/shell/startupReveal.test.ts && pnpm exec tsc --noEmit` | ❌ W0 (creates) | ⬜ pending |
| 02-T3 configurable palette matcher | 02 | 2 | SET-08 | T-24-04 | matchesChord(e.code); Pro-gating preserved | unit | `pnpm exec tsc --noEmit && pnpm vitest run src/components` | ⚠️ existing | ⬜ pending |
| 03-T1 HotkeyCaptureField | 03 | 3 | SET-08 | T-24-04, T-24-07 | record/cancel/reject-reserved/reset; no-mouse-only | unit | `pnpm vitest run src/components/HotkeyCaptureField.test.tsx` | ❌ W0 (creates) | ⬜ pending |
| 03-T2 HotkeysSettings pane + append | 03 | 3 | SET-08 | T-05-07, T-24-07 | calm inline reject, persist-nothing-on-reject | unit | `pnpm exec tsc --noEmit && pnpm vitest run src/components` | ❌ (creates) | ⬜ pending |
| 03-T3 hotkeys.e2e (palette-on-chord) | 03 | 3 | SET-08 | — | configured-chord opens palette; rebind reflected | e2e | `scripts/e2e-spike.sh` (wave merge) | ❌ W0 (creates) | ⬜ pending |
| 03-T4 native summon walkthrough | 03 | 3 | SET-08 | T-05-07 | OS register-failure reject + restart persistence | manual | human walkthrough on built `.app` | n/a | ⬜ pending |
| 04-T1 SettingToggle | 04 | 4 | SET-09 | T-24-08 | role=switch + aria-checked; no opacity-only state | unit | `pnpm vitest run src/components/SettingToggle.test.tsx` | ❌ (creates) | ⬜ pending |
| 04-T2 GeneralSettings + sidebar gate + append | 04 | 4 | SET-09 | T-24-03, T-24-02, T-24-09 | seam-only autostart; single-writer; getToolById | unit | `pnpm exec tsc --noEmit && pnpm vitest run src/components/Sidebar.test.tsx src/components` | ❌/⚠️ | ⬜ pending |
| 04-T3 hotkeys.e2e General extend | 04 | 4 | SET-09 | — | show-license-in-sidebar toggle effect; Settings-row invariant | e2e | `scripts/e2e-spike.sh` (wave merge) | ⚠️ extend | ⬜ pending |
| 04-T4 native General walkthrough + ship | 04 | 4 | SET-09 | T-24-03, T-24-06 | launch-at-login plist; start-in-tray no-flash; default-tool-on-open | manual | human walkthrough on built `.app` + gsd-ui-review | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Created in Wave 1 / early-wave tasks BEFORE the dependent behavior (each is a `creates` task above, so the test scaffold lands with — not after — its implementation; TDD RED+GREEN landed together per memory `tdd-red-commits-blocked-by-lefthook`):

- [ ] **`src/shell/hotkeyAccelerator.ts` + `hotkeyAccelerator.test.ts`** (Plan 01 Task 1) — `keyEventToAccelerator` / `matchesChord` / `isValidAccelerator` / `isReservedChord` pure helpers, including the round-trip property AND the Option-glyph case (key="π", code="KeyP" → "Alt+P"). Covers SET-08 capture/persist/match agreement.
- [ ] **Extend `prefsStore.test.ts`, `usePreferences.test.ts`, `resolveStartupTool.test.ts`** (Plan 01 Task 2) — invalid chord → shipped default; unknown defaultToolId → null; default-tool precedence (Last used | specific). Covers SET-08/SET-09 untrusted-prefs coercion.
- [ ] **Extend `summon.test.ts`** (Plan 02 Task 1) — rebind unregister→register→restore-on-reject→re-throw ordering against a stubbed nativeShortcut.
- [ ] **`src/shell/startupReveal.test.ts`** (Plan 02 Task 2) — reveal show() called iff !startInTray.
- [ ] **`src/components/HotkeyCaptureField.test.tsx`** (Plan 03 Task 1) — record/cancel/reject-reserved/commit, Option-glyph commit.
- [ ] **`src/components/SettingToggle.test.tsx`** (Plan 04 Task 1) — role=switch, aria-checked, keyboard toggle, no opacity-only.
- [ ] **`test/e2e/hotkeys.e2e.ts`** (Plan 03 Task 3, extended Plan 04 Task 3) — palette-on-configured-chord + rebind-reflected + show-license-in-sidebar toggle on the real WKWebView.

No test-framework install needed (vitest + wdio already present). The ONE new dep is `tauri-plugin-autostart@2.5.1` (a runtime capability, NOT a test dep).

*The decoder's 19 tests are the immovable bar — untouched. New features add their own (TDD).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Native summon re-register failure (taken chord) → inline reject, prior binding kept, nothing persisted | SET-08 | OS register-result only available on real WKWebView; stub/browser arms no-op | On the built `.app`, rebind summon to a taken chord (e.g. Cmd+Space) → expect calm inline message, old chord still summons, restart shows old chord (Plan 03 Task 4) |
| Rebound summon survives restart | SET-08 | Persistence race only visible on real prefs.json | Rebind summon → quit → relaunch → new chord summons (Plan 03 Task 4) |
| Launch-at-login enable/disable | SET-09 | Autostart plugin writes a real LaunchAgent; no test seam | Toggle launch-at-login on → confirm login-item / `~/Library/LaunchAgents` entry; toggle off → removed (Plan 04 Task 4) |
| start-in-tray + login-hidden (no window flash) | SET-09 | Window-visibility timing only observable on real app | Enable start-in-tray → quit → relaunch → app stays hidden to tray, no flash; summon/tray-click reveals (Plan 04 Task 4) |
| default-tool selection takes effect on open | SET-09 | Startup-tool resolution exercised at app launch | Set default tool ≠ "Last used" → relaunch → app opens that tool (Plan 04 Task 4) |
| Both panes WCAG-AA in both themes | SET-08 / SET-09 | Contrast/keyboard audit over the real render | `gsd-ui-review` WCAG-AA audit + human keyboard-only pass (Plan 04 Task 4) |

*Native items are verified at the phase-boundary `pnpm tauri build` human walkthrough + `gsd-ui-review` WCAG-AA audit (Plan 04 Task 4 is the joint phase-boundary sign-off).*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (or are listed Manual-Only with reason)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (each plan's first 2-3 tasks are unit-automated; only the trailing checkpoint per pane plan is manual)
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 20s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
