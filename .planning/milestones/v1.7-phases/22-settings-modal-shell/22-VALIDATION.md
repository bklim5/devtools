---
phase: 22
slug: settings-modal-shell
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-15
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (unit/jsdom) · WebdriverIO (real-WKWebView e2e) · cargo test (Rust) |
| **Config file** | `vitest.config.ts` · `wdio.conf.ts` (driven by `scripts/e2e-spike.sh`) · `src-tauri/Cargo.toml` |
| **Quick run command** | `pnpm exec vitest run` (or a targeted `pnpm exec vitest run <file>`) |
| **Full suite command** | `pnpm exec vitest run && pnpm exec tsc --noEmit && pnpm exec eslint . && bash scripts/e2e-spike.sh` |
| **Estimated runtime** | vitest ~4s · tsc/eslint ~5s · e2e-spike ~30s (after a dev build) |

---

## Sampling Rate

- **After every task commit:** `pnpm exec vitest run` (targeted to the touched files) + `pnpm exec tsc --noEmit`
- **After every plan wave:** full unit gate (`vitest` + `tsc` + `eslint`); real-WKWebView `scripts/e2e-spike.sh` once the modal/entry-point code lands
- **Before sign-off:** full suite green (vitest + tsc + eslint + e2e-spike 18/18+) on the real WKWebView; `decoder.ts` + its 19 tests byte-for-byte unchanged (`git diff` empty)
- **Max feedback latency:** ~10s for the unit gate; ~1–2 min including the real-WKWebView e2e

---

## Per-Task Verification Map

> The planner fills one row per task. Every task needs an `<automated>` verify or a Wave-0 dependency, except the native-only behaviors listed under Manual-Only.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (planner to fill) | | | SET-0x | T-22-0x / — | | unit/e2e | `pnpm exec vitest run …` | ✅/❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure (vitest + jsdom + the e2e-spike WKWebView harness + cargo) covers all phase requirements. No new framework install.
- New unit specs expected (planner): `settingsStore`/`useSettings` (store + invoker capture, cloning `upsellStore.test.ts`), `SettingsModal` (focus trap/return, aria-modal/labelledby, Esc/backdrop close, pane-nav keyboard) cloning `UpsellPanel.test.tsx` patterns, Sidebar Settings-row + ⌘K Settings-command tests, and the `#/settings/license` deep-link → `openSettings('license')` test.
- e2e: migrate `test/e2e/license-settings.e2e.ts` to the modal (re-scope `h2` probes inside the dialog/pane — do NOT edit `LicenseSettings`, SET-06) + cover open-from-sidebar / open-from-⌘K / deep-link / Esc-close + focus-return on the real WKWebView.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| App menu `TinkerDev ▸ Settings…` (⌘,) opens Settings | SET-01 | WebDriver cannot drive native macOS menu chrome (Buy-CTA / drag-drop precedent) | On the built app: press ⌘, and click TinkerDev ▸ Settings… → modal opens on the License pane |
| Tray `Settings…` item opens Settings | SET-02 | WebDriver cannot drive the native tray menu | On the built app: click the tray icon → Settings… → modal opens |
| App menu still has working Copy/Paste/Undo/Select-All/Quit after `set_menu()` rebuild | SET-01 (regression) | Native menu actions can't be WebDriver-asserted | On the built app: verify Edit-menu items + ⌘Q still function (the set_menu replacement risk from RESEARCH.md) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (native menu/tray excepted → Manual-Only above)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < ~120s (incl. real-WKWebView e2e)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
