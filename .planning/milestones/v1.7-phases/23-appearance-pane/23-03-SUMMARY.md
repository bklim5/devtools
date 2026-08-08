---
phase: 23-appearance-pane
plan: 03
subsystem: shell/appearance-live-apply
tags: [theming, appearance-pane, live-apply, no-flash, persistence, entitlements, wcag-aa]
requires:
  - "src/shell/appearance.ts ACCENT_SCALE + accentForTheme + LIGHT_TOKENS (Plan 01)"
  - "src/shell/theme.ts applyAppearance/resolveEffectiveTheme (Plan 01)"
  - "src/shell/preferences.ts ThemeName + DEFAULT_PREFERENCES (Plan 01)"
  - "src/lib/entitlements gatePreferences + entitlements store (Phase 18/21)"
  - "src/components/AppearanceSettings.tsx + SETTINGS_PANES (Plan 04)"
  - "index.css [data-theme=light] token block (Plan 02)"
provides:
  - "useAppearance() — the ONE App-root effect that applies the GATED effective theme+accent on every prefs/ents change; gated on prefsLoaded && entsResolved (no Pro-launch dark flash)"
  - "index.html synchronous pre-paint script — reads the td-theme-hint localStorage value and stamps data-theme before first paint (no wrong-theme flash, D-23-5)"
  - "Single shared prefs singleton — usePreferences AND useRecentTools now read/write ONE in-memory blob via one writer (updatePreferences merges against live state); eliminates the cross-writer clobber"
  - "Durable prefs writes — tauri store set() flushes to disk explicitly (autoSave:false + save()), so writes survive an immediate quit"
  - "test/e2e/appearance.e2e.ts — real-WKWebView proof of Pro Save live whole-app apply + contained preview + persistence"
affects:
  - "Phase boundary: human-approved on a fresh tauri build (3 walkthrough rounds)"
tech-stack:
  added: []
  patterns:
    - "App-root single-apply effect gated on prefsLoaded && entsResolved — the index.html pre-paint script owns the launch frame; React holds the gated apply until BOTH prefs and the license are known, so a Pro relaunch never flashes the free-default dark (D-23-5)"
    - "GATED paint-hint: useAppearance writes the gated theme name to localStorage so a lapsed/free relaunch never flashes a stored Pro light theme"
    - "ONE prefs writer: the module singleton in usePreferences.ts (getSharedPreferences/updatePreferences/subscribePreferences/ensurePreferencesLoaded); useRecentTools is a thin consumer — no second snapshot, no last-writer-wins clobber"
    - "durable store writes: autoSave:false + explicit save() per set (the autoSave debounce dropped pending writes on quit)"
    - "entitlements 'resolved' flag (flips in a finally, even on resolve error) so appearance apply can wait for the real license without ever hanging"
key-files:
  created:
    - src/shell/useAppearance.ts
    - src/shell/useAppearance.test.ts
  modified:
    - src/App.tsx
    - index.html
    - src/shell/usePreferences.ts
    - src/shell/useRecentTools.ts
    - src/shell/usePreferences.test.ts
    - src/shell/preferences.ts
    - src/shell/prefsStore.ts
    - src/shell/theme.ts
    - src/components/ThemeCardGroup.tsx
    - src/components/AppearanceSettings.tsx
    - src/components/UpsellPanel.tsx
    - src/components/settingsPanes.tsx
    - src/lib/platform/tauri.ts
    - src/lib/entitlements/store.ts
    - src/shell/useEntitlements.ts
metrics:
  vitest: "1051/1051"
  e2e: "23/23 spec files (real WKWebView)"
  decoder: "19/19 untouched"
---

# 23-03 — App-root live apply, flash-free launch, durable persistence

Made theme + accent **live app-wide** (D-23-9) and **flash-free on launch** (D-23-5),
proved it on the real WKWebView, then absorbed three rounds of human-walkthrough
feedback before sign-off.

## Commits

| Hash | Description |
|------|-------------|
| `344e2503` | useAppearance hook — gated apply + (initial) matchMedia flip + paint-hint |
| `fc7da8b6` | call useAppearance in App.tsx + no-flash pre-paint script in index.html |
| `9a360602` | appearance e2e + share usePreferences across instances for live apply |
| `82af1744` | WR-01: narrow useAppearance effect deps to theme/accent (review fix) |
| `31486715` | WR-02: seed AppearanceSettings pending from gated prefs (review fix) |
| `9085c0ee` | remove the "system" theme — keep only dark + light (user feedback) |
| `1adf7675` | theme card thumbnail → mini-window skeleton (user feedback) |
| `e27c71fa` | widen the Unlock-Pro modal 420 → 520px (user feedback) |
| `07ff4403` | make prefs writes durable (autoSave:false + explicit save) |
| `145612d4` | remove the Pro-launch dark flash via an entitlements-resolved gate |
| `44eb57c9` | unify recents+prefs onto one shared singleton/writer (clobber fix) |
| `7ddc27cf` | redesign theme-card thumbnail → app-window + radio-check indicator |
| `78b6cf19` | order Appearance before License in the Settings nav |

## Checkpoint feedback addressed (3 rounds)

1. **Removed "system"** — `ThemeName` is now `light | dark`; the OS matchMedia
   live-flip effect is gone; cards, copy, coercion, tests, e2e updated.
2. **Theme cards** — mini app-window thumbnail (sidebar column + content accent
   bar + content rows) + radio-check selection indicator, per the user's design.
3. **Unlock-Pro modal** widened to 520px.
4. **Persistence flakiness (the real bug)** — root cause was TWO independent
   writers of the one prefs blob: `useRecentTools` held a stale mount-era
   snapshot and clobbered theme/pins on every tool switch. Fixed by unifying both
   hooks onto ONE shared singleton/writer; a TDD regression test reproduces the
   exact "change theme + pin, then switch tool" sequence and asserts nothing
   reverts. (The earlier autoSave→explicit-save durability fix is kept; it was
   real but not the cause.)
5. **Pro-launch dark flash** — apply now waits for `entsResolved` so a Pro
   relaunch opens straight to the saved theme.
6. **Nav order** — Appearance first, License second.

## Deviations

- The plan's matchMedia/system live-flip task was REMOVED mid-phase at the user's
  request (system theme dropped). Net scope reduction, not a gap.
- The cross-writer prefs clobber + the launch flash were not in the original plan;
  both surfaced in the walkthrough and were fixed as in-phase deviations.

## Self-Check: PASSED

- vitest 1051/1051; `tsc --noEmit` clean; eslint clean (2 pre-existing
  SidebarResetMenu warnings, out of scope).
- Real-WKWebView e2e 23/23 spec files (incl. `appearance.e2e.ts`).
- decoder + its 19 tests byte-for-byte untouched; zero new deps.
- Fresh `tauri build` (TinkerDev.app + DMG), human-approved 2026-06-17.
