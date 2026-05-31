---
phase: 5
slug: native-polish
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-31
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (unit/jsdom) + WebdriverIO (real-WKWebView e2e via `scripts/e2e-spike.sh`) |
| **Config file** | `vitest.config.ts`, `wdio.conf.ts` (globs `test/e2e/*.e2e.ts`) |
| **Quick run command** | `pnpm vitest run` |
| **Full suite command** | `pnpm vitest run && pnpm tsc --noEmit && pnpm eslint . && bash scripts/e2e-spike.sh` |
| **Estimated runtime** | ~30–90 seconds (unit fast; e2e builds + drives WKWebView) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run` (decoder's 19 tests must stay green)
- **After every plan wave:** Run the full suite command
- **Before `/gsd-verify-work`:** Full suite green + packaged `tauri build`
- **Max feedback latency:** ~90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01/T1 | 01 | 1 | NAT-02 / SHL-05 | T-05-01..03 | Plugins pinned (si 2.4.2 / gs 2.3.2 / ws 2.4.1) in Cargo.toml | unit | `grep Cargo.toml && cargo check` | ❌ W0 | ⬜ pending |
| 05-01/T2 | 01 | 1 | NAT-02 / SHL-05 | T-05-01..03 | single-instance registered FIRST in lib.rs; least-privilege caps; webdriver excluded from release | unit | `grep lib.rs/caps/conf && cargo check && cargo tree --release \| grep -c webdriver = 0` | ❌ W0 | ⬜ pending |
| 05-02/T1 | 02 | 1 | NAT-01 | T-05-04 | JS global-shortcut plugin pinned 2.3.2 | unit | `node -e ...plugin-global-shortcut==2.3.2` | ❌ W0 | ⬜ pending |
| 05-02/T2 | 02 | 1 | NAT-01 | T-05-04..05 | `Platform.window` + `nativeShortcut` added; browser/stub no-op | unit | `grep index.ts/browser.ts` | ❌ W0 | ⬜ pending |
| 05-02/T3 | 02 | 1 | NAT-01 | T-05-04..06 | real impl ONLY in tauri.ts; no `@tauri-apps/*` outside seam (grep audit) | unit | `grep tauri.ts + seam audit` | ❌ W0 | ⬜ pending |
| 05-02/T4 (Wave-0 seam test) | 02 | 1 | NAT-01 | T-05-04..06 | seam interface shape + graceful browser/stub no-op asserted | tdd | `pnpm vitest run platform.test.ts && tsc` | ❌ W0 | ⬜ pending |
| 05-03/T1 (summon) | 03 | 2 | NAT-01 | T-05-07..08 | `SUMMON_CHORD` + `registerSummon()` over seam; unminimize→show→setFocus; graceful failure | tdd | `grep summon.ts && pnpm vitest run summon.test.ts && tsc` | ❌ W0 | ⬜ pending |
| 05-03/T2 (wire + e2e) | 03 | 2 | NAT-01 | T-05-07..09 | `registerSummon()` chained after `initPlatform()` in main.tsx; HashRouter deep-link | e2e | `grep main.tsx && bash scripts/e2e-spike.sh && vitest && tsc && eslint` | ❌ W0 | ⬜ pending |
| 05-04/T1 (full gate) | 04 | 3 | NAT-01, NAT-02 | T-05-01..10 | full suite + seam/release/offline/capability audits + fresh `tauri build` + WCAG-AA | gate | `vitest && tsc && eslint && cargo tree --release \| grep -c webdriver = 0 && UI-REVIEW exists` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. (05-04/T2 is the human-verify checkpoint — no automated verify; 05-04/T3 is doc bookkeeping.)*

---

## Wave 0 Requirements

- [ ] Unit tests for the new platform-seam surface (`window` summon/geometry, `nativeShortcut` register/unregister) over the browser/stub backends — assert graceful no-op + interface shape.
- [ ] Grep guards: no `@tauri-apps/*` import outside `src/lib/platform/tauri.ts`; single-instance plugin is the FIRST `.plugin()` in `lib.rs`.
- [ ] Real-WKWebView e2e spec(s) for any in-webview-observable behavior (e.g. hash-route deep-link on summon, if reachable from the renderer).

*Existing vitest + WebdriverIO infrastructure covers the renderer-side surface; native OS-level behaviors fall to Manual-Only below.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Global shortcut summons + focuses the app from another application | NAT-01 | Fires at the OS level outside the WKWebView — WebDriver cannot send a system-global hotkey or assert OS focus | From a different app, press the registered chord → DevTools comes to front and focuses |
| Tray/menu presence + actions (show/hide, quit) | NAT-02 | Tray lives in the macOS menu bar, outside the webview DOM | Click the tray icon → menu appears; Show focuses window; Quit exits |
| Single-instance: second launch focuses existing window | NAT-02 | Process-launch behavior, not observable from the renderer | Launch the packaged `.app` twice → second launch focuses the first window, no second window |
| Window geometry persists across relaunch | NAT-02 / SHL-05 (D-11) | Window move/resize + restore is OS/window-manager state | Move + resize window, quit, relaunch → window restores to last position/size |

---

## Validation Sign-Off

- [ ] All renderer-side tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] Manual-only OS behaviors batched into the Phase 5 human sign-off (expected to join the deferred Phase 4 UAT)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-31 (Nyquist-compliant; Wave 0 = 05-02/T4 seam test; OS-level behaviors batched into the Phase 5 human sign-off)
