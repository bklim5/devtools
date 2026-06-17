---
phase: 23-appearance-pane
verified: 2026-06-17T14:15:00Z
status: passed
score: 6/6 must-haves verified
overrides_applied: 1
overrides:
  - must_have: "The Appearance pane lets the user choose a theme — light, dark, or system — and the choice applies live (no restart) across the whole app"
    reason: "The 'system' (OS prefers-color-scheme) option was removed at the user's explicit request during the phase (commit 9085c0ee). Shipped scope is light/dark only. ROADMAP/REQUIREMENTS text still reads 'light/dark/system' but the omission is an intentional, user-approved scope reduction — light + dark choice applies live whole-app, which is the substance of SC #1."
    accepted_by: "user (in-phase decision)"
    accepted_at: "2026-06-17T00:00:00Z"
---

# Phase 23: Appearance Pane Verification Report

**Phase Goal:** Appearance Pane — theme + accent, persisted via the prefs seam and applied live (absorbs backlog 999.3); SET-07. (ROADMAP detail: "A user can change theme and accent from inside Settings and see it apply immediately and survive a restart.")
**Verified:** 2026-06-17T14:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (merged ROADMAP success criteria + PLAN must_haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Appearance pane lets user choose theme (light/dark) and it applies live whole-app, no restart | PASSED (override) | `ThemeCardGroup` radiogroup in `AppearanceSettings.tsx`; `useAppearance()` (App.tsx:54) applies `applyAppearance(eff.theme, eff.accent)` to documentElement on every theme/accent/ents change. "system" removed per user decision (commit 9085c0ee) — see override. |
| 2 | User can choose an accent; applies live; accent reserved for selection | ✓ VERIFIED | `AccentSwatchGrid` (7 swatches from `ACCENT_SCALE`); `applyAppearance` sets `--color-accent` via `accentForTheme`. REVIEW confirms `#N` field numbers stay neutral (`text-tx`), accent only on selected chip/drop-line uses `bg-tx-2`. |
| 3 | Both selections persist through the prefs seam and restore on next launch | ✓ VERIFIED | Pro Save calls `setTheme`/`setAccent` (AppearanceSettings.tsx:46-47) → shared prefs singleton (`updatePreferences`) → durable disk write (`tauri.ts` autoSave:false + explicit `save()`). Cross-writer clobber fixed: `useRecentTools` unified onto the singleton; regression test `usePreferences.test.ts:184`. |
| 4 | Pane keyboard-navigable + WCAG-AA (visible focus, AA both themes, no opacity-only state) | ✓ VERIFIED | Radiogroups w/ roving tabindex + clamped arrow-nav; selection by ring + Check glyph (not color-alone); `appearanceContrast.test.ts` mechanizes ≥4.5:1 for all 7 accent pairs in BOTH themes + light token ramp (5 `toBeGreaterThanOrEqual`, 11 `4.5` literals). Free Save = full-color Lock affordance, not opacity-only. Human gsd-ui-review AA audit passed both themes. |
| 5 | Flash-free launch (no wrong-theme flash on relaunch) | ✓ VERIFIED | `index.html` synchronous pre-paint `<script>` reads `td-theme-hint` localStorage; gated apply waits for `prefsLoaded && entsResolved` (no Pro-launch dark flash, commit 145612d4). |
| 6 | Pro gating: free Save → openProUpsell, persists NOTHING; theming behind ENT_THEMING | ✓ VERIFIED | `AppearanceSettings.onSave` returns BEFORE any setter when `!entitled` → `openProUpsell(saveRef.current)`; `useAppearance` applies `gatePreferences(prefs, ents)` (free → dark + #5b9bf8), paint-hint written from gated value. Tests in AppearanceSettings.test.tsx + useAppearance.test.ts. |

**Score:** 6/6 truths verified (1 via approved override)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/shell/appearance.ts` | ACCENT_SCALE (7 pairs), LIGHT_TOKENS, accentForTheme, THEME_NAMES | ✓ VERIFIED | 7 dark+light pairs; THEME_NAMES=["light","dark"]; DEFAULT_ACCENT="#5b9bf8". Imported by theme.ts, AppearanceSettings, AccentSwatchGrid. |
| `src/shell/theme.ts` | resolveEffectiveTheme + applyAppearance | ✓ VERIFIED | Pure; no @tauri-apps; dark = absence of data-theme. |
| `src/shell/appearanceContrast.test.ts` | Executable WCAG-AA assertions | ✓ VERIFIED | Green; asserts ≥4.5 literally. |
| `src/shell/useAppearance.ts` | Gated App-root apply + paint-hint | ✓ VERIFIED | Called in App.tsx:54; gates on prefsLoaded && entsResolved; WR-01 deps narrowed. |
| `index.html` | Pre-paint theme script (td-theme-hint) | ✓ VERIFIED | Plain (non-module) `<script>` in head; injection-safe (REVIEW). |
| `src/components/AppearanceSettings.tsx` | Pane + gate-on-Save | ✓ VERIFIED | WR-02 fix: pending seeded from gated prefs (line 35-37). |
| `src/components/ThemeCardGroup.tsx` / `AccentSwatchGrid.tsx` / `AppearancePreviewStrip.tsx` | Radiogroups + contained preview | ✓ VERIFIED | 0 `document.documentElement` writes in pane/strip (contained preview, D-23-3). |
| `src/index.css` light block | [data-theme="light"] token re-declaration | ✓ VERIFIED | accent #1763d6, borders rgba(0,0,0,0.08), body color tokenized, light gradient override. |
| `src/components/settingsPanes.tsx` | Appearance entry appended | ✓ VERIFIED | License + Appearance only; SettingsModal byte-unchanged. |
| `test/e2e/appearance.e2e.ts` | Real-WKWebView proof | ✓ VERIFIED | Exists (11KB); part of 23/23 e2e suite (SUMMARY 03). |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| App.tsx | documentElement data-theme + --color-accent | useAppearance() → applyAppearance(gatePreferences(...)) | WIRED |
| AppearanceSettings | openProUpsell | free-tier Save route (!entitled branch) | WIRED |
| AppearanceSettings | setTheme/setAccent | Pro Save → shared prefs singleton | WIRED |
| index.html pre-paint | localStorage td-theme-hint | sync read before module script | WIRED (literal matches THEME_HINT_KEY) |
| index.css light selector | whole app | CSS custom-property cascade | WIRED |
| useRecentTools | shared prefs singleton | getSharedPreferences/updatePreferences | WIRED (clobber fixed) |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| index.html:13-23 | Dead "system" hint handling (`hint === "system"`) | ℹ️ Info | Benign dead code: `eff.theme` is only ever light/dark now, so a "system" hint can never be written. No functional impact; harmless leftover from the pre-removal script. Optional cleanup. |

No blocker or warning anti-patterns. The 2 REVIEW warnings (WR-01 deps, WR-02 gated seed) were both addressed (commits 82af1744, 31486715; confirmed in code). REVIEW info items IN-01..05 are accepted-as-is (untrusted-hand-edit-only AA exposure, optional hardening).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SET-07 | 23-01, 23-02, 23-03, 23-04 | Appearance pane: choose theme + accent, persisted via prefs seam, applied live (absorbs backlog 999.3) | ✓ SATISFIED | Pane built, live apply wired, durable persistence, AA both themes. "system" sub-option dropped per user (scope reduction, not a gap). |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase 23 unit suites | vitest run (9 files) | 123/123 passed | ✓ PASS |
| Decoder bar | vitest run src/lib/protobuf | 19/19 passed | ✓ PASS |
| Typecheck | tsc --noEmit | exit 0 | ✓ PASS |
| Fresh build present | ls bundle/macos | TinkerDev.app mtime 2026-06-17 14:11 (newest) | ✓ PASS |

### Human Verification

Already completed during the phase: human-approved walkthrough on a fresh `tauri build` (3 rounds, sign-off 2026-06-17) + passing gsd-ui-review WCAG-AA audit in both themes (SUMMARY 03). This goal-backward check is confirmatory and does not re-open the gate. No outstanding human items.

### Gaps Summary

No gaps. All 6 observable truths verified; the single ROADMAP "system" mention is an explicit, user-approved scope reduction recorded as an override. Decoder + its 19 tests byte-for-byte untouched. SET-07 satisfied.

---

_Verified: 2026-06-17T14:15:00Z_
_Verifier: Claude (gsd-verifier)_
