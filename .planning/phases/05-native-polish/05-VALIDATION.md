---
phase: 5
slug: native-polish
status: draft
nyquist_compliant: false
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
| 5-XX | TBD | TBD | NAT-01 | T-05-xx | Platform-seam window/shortcut API present; no `@tauri-apps/*` import in tools (grep) | unit | `pnpm vitest run` + grep guard | ❌ W0 | ⬜ pending |
| 5-XX | TBD | TBD | NAT-02 | T-05-xx | Single-instance registered FIRST in lib.rs; browser/stub backends no-op gracefully | unit | `pnpm vitest run` + grep guard | ❌ W0 | ⬜ pending |

*Planner fills exact task IDs/waves. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

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

**Approval:** pending
