---
phase: 23-appearance-pane
plan: 01
subsystem: shell/appearance
tags: [theming, wcag-aa, entitlements, prefs, tdd]
requires:
  - "src/shell/preferences.ts ThemeName + DEFAULT_PREFERENCES"
  - "src/shell/prefsStore.ts mergePreferences/coerceTheme"
  - "src/lib/entitlements/entitlements.ts gatePreferences"
provides:
  - "ThemeName widened to light|dark|system (3-value union)"
  - "coerceTheme untrusted-input-disciplined (VALID_THEMES set)"
  - "DEFAULT_PREFERENCES.accent = #5b9bf8 (Pitfall 1 fixed)"
  - "src/shell/appearance.ts: ACCENT_SCALE, LIGHT_TOKENS, accentForTheme, THEME_NAMES, DEFAULT_ACCENT"
  - "src/shell/theme.ts: resolveEffectiveTheme + applyAppearance pure helpers"
  - "executable WCAG-AA contrast assertions (appearanceContrast.test.ts)"
affects:
  - "Plan 02 (index.css light-token block reads LIGHT_TOKENS values)"
  - "Plan 03 (App-root apply effect calls applyAppearance with gated prefs)"
  - "Plan 03/04 (AppearanceSettings consumes ACCENT_SCALE for the swatch grid)"
tech-stack:
  added: []
  patterns:
    - "two-value-per-swatch accent scale (single hex can't pass AA in both themes)"
    - "executable WCAG relative-luminance contrast test as the AA bar (not eyeballed)"
    - "persisted accent = dark hex; accentForTheme reverse-maps to the light variant"
    - "dark theme = ABSENCE of data-theme attribute (the @theme defaults)"
key-files:
  created:
    - "src/shell/appearance.ts"
    - "src/shell/appearanceContrast.test.ts"
    - "src/shell/theme.ts"
    - "src/shell/theme.test.ts"
  modified:
    - "src/shell/preferences.ts"
    - "src/shell/prefsStore.ts"
    - "src/shell/prefsStore.test.ts"
    - "src/lib/entitlements/entitlements.test.ts"
decisions:
  - "Persist the DARK hex as accent (RESEARCH A1) so DEFAULT_PREFERENCES.accent stays a real color and gatePreferences' default is unchanged; accentForTheme reverse-maps to the light variant."
  - "accentForTheme returns an unknown hex UNCHANGED (fail-soft, never throws — T-23-02)."
  - "dark = absence of data-theme (delete the attribute), not data-theme=dark — matches index.css @theme defaults."
  - "All 7 accent dark+light hexes + the light surface/text/status tokens taken verbatim from 23-RESEARCH (math-verified); all cleared >= 4.5:1 on first run, no hand-tuning needed."
metrics:
  duration_seconds: 223
  tasks: 3
  files_created: 4
  files_modified: 4
  completed: "2026-06-16"
---

# Phase 23 Plan 01: Appearance Theming Foundation Summary

Landed the unit-testable theming foundation for the Appearance pane: widened `ThemeName` to `light | dark | system` with an untrusted-input-disciplined `coerceTheme`, fixed the load-bearing default-accent mismatch (`#3b82f6` → `#5b9bf8`), authored the single source-of-truth dual-theme accent scale + light-token tables (`appearance.ts`), the pure DOM-apply helpers `resolveEffectiveTheme`/`applyAppearance` (`theme.ts`), and — critically — mechanized the WCAG-AA bar as executable relative-luminance contrast assertions so "AA in both themes" is enforced by vitest, not eyeballed.

## What Was Built

- **Task 1 (`8d4521eb`)** — `ThemeName` widened to the 3-value union; `coerceTheme` rewritten to accept only `{light,dark,system}` via a `ReadonlySet` (anything else → `dark`, T-23-01); `DEFAULT_PREFERENCES.accent` changed to `#5b9bf8` (the applied dark default-blue; the dead AA-failing `#3b82f6` removed — Pitfall 1). `prefsStore.test.ts` gained a `coerceTheme widening` block (tested through `mergePreferences` since `coerceTheme` is module-private) + an accent-default block.
- **Task 2 (`13bf411d`)** — `src/shell/appearance.ts`: `ACCENT_SCALE` (7 dark+light pairs), `LIGHT_TOKENS`, `accentForTheme()` (reverse-map persisted dark hex → light variant, fail-soft), `THEME_NAMES`, `DEFAULT_ACCENT`. `src/shell/appearanceContrast.test.ts`: a pure WCAG contrast function (`lum`/`contrastRatio`/`softFill`, 3- and 6-digit hex parsing, alpha-composite soft-fill) with 14 accent assertions (7×2 both themes), the `tx`/`tx-2`/`tx-3` text ramp on white, `warn`/`ok` status tokens, a symmetry/sanity check, and the `accentForTheme` reverse-map cases — all literally asserting `>= 4.5`.
- **Task 3 (`a6e801ae`)** — `src/shell/theme.ts`: `resolveEffectiveTheme` (reads `matchMedia` for `system`) + `applyAppearance` (stamps/deletes `data-theme`, sets `--color-accent` via `accentForTheme`), with NO native platform import. `theme.test.ts` (jsdom + `matchMedia` stub, `afterEach` DOM cleanup) proves dark = ABSENCE of `data-theme`. `entitlements.test.ts` gained two assertions pinning `gatePreferences` free→`dark`+`#5b9bf8` / Pro→passthrough now that accent is applied live (D-23-2).

## Deviations from Plan

None — plan executed exactly as written. Every accent and light-token hex from 23-RESEARCH cleared the AA contrast assertions on the first run; no hand-tuning was required.

The Task-3 acceptance criterion `grep -c '@tauri-apps' src/shell/theme.ts === 0` initially matched a comment that mentioned the literal token (`// NO @tauri-apps import …`); the comment was reworded to "no native platform import" so the grep returns 0 while the rule is still documented. This is a comment-only wording change, not a behavior deviation.

## Verification

- `pnpm vitest run src/shell/prefsStore.test.ts src/shell/theme.test.ts src/shell/appearanceContrast.test.ts src/lib/entitlements/entitlements.test.ts` — 91/91 green.
- Full pre-commit gate on each task: vitest (final 1030/1030) + `tsc --noEmit` clean + eslint clean (2 pre-existing SidebarResetMenu warnings, out of scope).
- Decoder (`src/lib/protobuf/`) + its 19 tests byte-for-byte untouched.
- Zero new runtime/dev dependencies.

## Harness Note

Per project DoD, `/simplify` and `/codex:review --wait --scope working-tree` are slash commands not auto-invoked by the executor — recommend running `/codex:review --scope working-tree` at the phase checkpoint. This plan is pure-unit (no UI); the real-WKWebView e2e gate is exercised in Plans 03/04.

## Self-Check: PASSED

- FOUND: src/shell/appearance.ts
- FOUND: src/shell/appearanceContrast.test.ts
- FOUND: src/shell/theme.ts
- FOUND: src/shell/theme.test.ts
- FOUND commit: 8d4521eb (Task 1)
- FOUND commit: 13bf411d (Task 2)
- FOUND commit: a6e801ae (Task 3)
