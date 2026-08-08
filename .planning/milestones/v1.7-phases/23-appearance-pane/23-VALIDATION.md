---
phase: 23
slug: appearance-pane
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-16
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + tsc --noEmit (unit/type), real-WKWebView e2e via `scripts/e2e-spike.sh` (UI) |
| **Config file** | `vitest.config.ts`, `tsconfig.json`, `test/e2e/` |
| **Quick run command** | `pnpm vitest run && pnpm exec tsc --noEmit` |
| **Full suite command** | `pnpm vitest run && pnpm exec tsc --noEmit` then `scripts/e2e-spike.sh` on the real WKWebView |
| **Estimated runtime** | ~30s unit/type · e2e adds tauri-dev build/launch |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run && pnpm exec tsc --noEmit`
- **After every plan wave:** Full unit/type suite green; the decoder's 19 tests are the immovable bar
- **Before `/gsd-verify-work`:** Full unit/type suite green + real-WKWebView e2e for theme/accent persist + restore (packaged-only verifiable — unit tests cannot see prefs.json persistence)
- **Max feedback latency:** ~30s (unit/type)

---

## Per-Task Verification Map

> Planner fills this row-by-row as plans are authored. Every task maps to a unit/type assertion or an explicit Manual-Only/e2e entry. AA-in-both-themes is mechanized as executable contrast assertions (see RESEARCH.md ## Validation Architecture).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-T1 | 01 | 1 | SET-07 | T-23-01 | coerceTheme accepts light/dark/system, unknown → dark; default accent #5b9bf8 | unit | `pnpm vitest run src/shell/prefsStore.test.ts` | ❌ W0 | ⬜ pending |
| 01-T2 | 01 | 1 | SET-07 | T-23-02 | 7 accents + light ramp clear WCAG-AA in BOTH themes (executable contrast math) | unit | `pnpm vitest run src/shell/appearanceContrast.test.ts` | ❌ W0 | ⬜ pending |
| 01-T3 | 01 | 1 | SET-07 | T-23-03 | resolveEffectiveTheme/applyAppearance pure helpers; gatePreferences forces free defaults | unit | `pnpm vitest run src/shell/theme.test.ts src/lib/entitlements/entitlements.test.ts` | ❌ W0 | ⬜ pending |
| 02-T1 | 02 | 1 | SET-07 | T-23-04 | light [data-theme] token block + light body gradient (AA-verified values from 01-T2) | type/lint | `pnpm exec tsc --noEmit && pnpm lint` | ❌ W0 | ⬜ pending |
| 02-T2 | 02 | 1 | SET-07 | T-23-05 | no rgba(255,255,255,…) hover tint survives (visible hover in both themes) | type/lint | `pnpm exec tsc --noEmit && pnpm lint` | ❌ W0 | ⬜ pending |
| 04-T1 | 04 | 2 | SET-07 | — | theme cards + accent swatches are accessible radiogroups (arrow nav, aria-checked, Check glyph) | unit (RTL) | `pnpm vitest run src/components/ThemeCardGroup.test.tsx src/components/AccentSwatchGrid.test.tsx` | ❌ W0 | ⬜ pending |
| 04-T2 | 04 | 2 | SET-07 | T-23-03, T-23-08 | Pro Save→setters; free Save→openProUpsell no-persist; preview never touches documentElement | unit (RTL) | `pnpm vitest run src/components/AppearanceSettings.test.tsx` | ❌ W0 | ⬜ pending |
| 04-T3 | 04 | 2 | SET-07 | — | Appearance entry appended to SETTINGS_PANES; SettingsModal unchanged | type/lint | `pnpm exec tsc --noEmit && pnpm lint` | ❌ W0 | ⬜ pending |
| 03-T1 | 03 | 3 | SET-07 | T-23-03, T-23-06 | App-root gated apply + paint-hint from gated value + system live-flip | unit (RTL) | `pnpm vitest run src/shell/useAppearance.test.ts` | ❌ W0 | ⬜ pending |
| 03-T2 | 03 | 3 | SET-07 | T-23-07 | useAppearance wired in App.tsx; synchronous pre-paint script in index.html | type/lint | `pnpm exec tsc --noEmit && pnpm lint` | ❌ W0 | ⬜ pending |
| 03-T3 | 03 | 3 | SET-07 | T-23-03 | Pro Save live whole-app apply + contained preview pre-Save + persistence | e2e (real WKWebView) | `bash scripts/e2e-spike.sh` (full suite — runner takes no spec-filter arg; appearance.e2e.ts runs within it) | ❌ W0 | ⬜ pending |
| 03-T4 | 03 | 3 | SET-07 | — | no-flash launch + live OS-appearance flip + AA-in-both-themes audit + #N neutral | Manual-Only (human-verify) | walkthrough on `pnpm tauri build` + gsd-ui-review | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Contrast-assertion test helper (WCAG-AA ratio math) — asserts the 7 accent hexes clear AA for focus ring / nav active-bar / selected-label-on-accent-soft in BOTH themes, and the light token ramp clears AA.
- [ ] `coerceTheme` widening tests (light/dark/system accepted; unknown → dark).
- [ ] `gatePreferences` free-user default-forcing tests (theme/accent → defaults when `ENT_THEMING` absent).

*Existing vitest + tsc infrastructure covers the rest; no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Theme/accent persist + restore on relaunch | SET-07 | prefs.json persistence is packaged-only; invisible to unit tests (project memory: tauri-store-async-init-race) | Change theme+accent (Pro), Save, quit, relaunch — selections restored, no wrong-theme flash on launch |
| Live OS light↔dark flip while theme = system | SET-07 | Requires real WKWebView + OS appearance toggle | Set theme = system, toggle macOS appearance — app re-themes live without restart |
| Save → Unlock-Pro modal for free user (no persist) | SET-07 | Real entitlement seam + modal focus behavior | Free build: preview a selection, press Save → UpsellModal opens, nothing persisted, app stays on gated defaults |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** plans authored 2026-06-16 — Per-Task Map filled, Wave-0 unit/contrast/e2e scaffolds enumerated; nyquist_compliant.
