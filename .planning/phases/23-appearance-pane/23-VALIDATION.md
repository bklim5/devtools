---
phase: 23
slug: appearance-pane
status: draft
nyquist_compliant: false
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
| TBD | — | — | SET-07 | — | N/A | unit | `pnpm vitest run` | ❌ W0 | ⬜ pending |

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

**Approval:** pending
