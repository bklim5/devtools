---
phase: 23-appearance-pane
plan: 04
subsystem: components/appearance-pane
tags: [theming, appearance-pane, entitlements, wcag-aa, radiogroup, gate-on-save]
requires:
  - "src/shell/appearance.ts ACCENT_SCALE + accentForTheme (Plan 01)"
  - "src/shell/preferences.ts ThemeName + DEFAULT_PREFERENCES.accent"
  - "src/shell/theme.ts resolveEffectiveTheme (Plan 01)"
  - "src/shell/usePreferences.ts setTheme/setAccent"
  - "src/shell/useEntitlements.ts + entitlements.ts ENT_THEMING"
  - "src/shell/proUpsell.ts openProUpsell"
  - "src/components/settingsPanes.tsx SETTINGS_PANES registry"
provides:
  - "ThemeCardGroup — 3 accessible theme radio cards (Dark/Light/System), arrow-nav, aria-checked"
  - "AccentSwatchGrid — 7 accent swatches from ACCENT_SCALE; selection by ring + Check glyph (not color-alone)"
  - "AppearancePreviewStrip — contained localized preview via scoped --color-accent + per-theme surface; never touches the DOM root"
  - "AppearanceSettings — pending state, theme cards + swatch grid + preview, gate-on-Save (Pro persists / free → openProUpsell, no persist)"
  - "SETTINGS_PANES Appearance entry (License + Appearance; SettingsModal shell unchanged)"
affects:
  - "Plan 03 (App-root apply effect + appearance.e2e drives THIS pane on the real WKWebView; phase-boundary walkthrough)"
tech-stack:
  added: []
  patterns:
    - "card radiogroup (role=radiogroup + role=radio + roving tabindex + clamped arrow-nav), NOT a SegmentedControl, for the theme picker (D-23-6)"
    - "selection-not-by-color-alone: selected accent swatch shows a ring + Check glyph (WCAG 1.4.1)"
    - "contained preview: scoped inline --color-accent (+ -soft/-line) on the strip subtree + explicit per-theme surface hexes, so the preview recolors WITHOUT stamping data-theme on :root (no global mutation, no revert path)"
    - "gate-on-Save: pending local state only; Pro Save persists via the seam, free Save routes to openProUpsell and persists NOTHING (try-before-buy, D-23-2)"
    - "visible non-opacity locked Save affordance (Lock glyph + 'Unlock Pro to save'), keyboard-reachable"
key-files:
  created:
    - "src/components/ThemeCardGroup.tsx"
    - "src/components/ThemeCardGroup.test.tsx"
    - "src/components/AccentSwatchGrid.tsx"
    - "src/components/AccentSwatchGrid.test.tsx"
    - "src/components/AppearancePreviewStrip.tsx"
    - "src/components/AppearanceSettings.tsx"
    - "src/components/AppearanceSettings.test.tsx"
  modified:
    - "src/components/settingsPanes.tsx"
decisions:
  - "Theme picker is a card radiogroup (3 cards with mini app-preview thumbnails), explicitly NOT a SegmentedControl (D-23-6). SegmentedControl is reused ONLY as the preview strip's inert sample toggle."
  - "Accent swatch selection is marked by a ring + a centered Check glyph (white, for contrast on the saturated swatch), never color-alone (WCAG 1.4.1, D-23-7). Swatch count is driven by ACCENT_SCALE.length."
  - "Both radiogroups use roving tabindex (selected = the single Tab stop) + clamped arrow-key selection (Left/Up prev, Right/Down next, no wrap) mirroring the Sidebar's roving convention."
  - "The preview strip recolors via inline --color-accent/-soft/-line scoped to its own subtree + an explicit per-theme surface lookup (PREVIEW_SURFACE), so it reflects the pending theme+accent WITHOUT stamping data-theme on :root — keeping the contained-preview invariant (D-23-3); no revert logic exists because nothing global changes pre-Save."
  - "Save gates on ents.has(ENT_THEMING): Pro → setTheme(pending)+setAccent(pending) (App root applies live, Plan 03); free → openProUpsell(saveRef.current), persists nothing (D-23-2). The free Save button is a full-color accent-soft surface with a Lock glyph + 'Unlock Pro to save' — visible, not opacity-only, keyboard-reachable."
  - "Pane wrapper matches LicenseSettings (flex flex-col gap-6 overflow-auto p-8) so the SettingsModal hosts it with no double-pad; header is h3 (one level under the dialog h2 — preserves the Phase-22.1 heading-order fix)."
  - "Appended ONE entry to SETTINGS_PANES (icon = lucide Contrast); SettingsModal.tsx byte-unchanged (registry is the single control plane)."
metrics:
  duration_seconds: 414
  tasks: 3
  files_created: 7
  files_modified: 1
  completed: "2026-06-16"
---

# Phase 23 Plan 04: Appearance Pane Summary

Built the Settings ▸ Appearance pane: three accessible theme radio cards
(Dark/Light/System), a 7-swatch accent radiogroup (selection marked by ring + Check
glyph, never color-alone), a CONTAINED preview strip that reflects the pending
theme+accent without ever stamping the DOM root, and a Save button that gates on the
`pro.theming` entitlement — Pro persists via the prefs seam (the App root applies live
in Plan 03), free routes to the focused Unlock-Pro path and persists NOTHING. One
entry appended to SETTINGS_PANES; the SettingsModal shell is byte-unchanged.

## What Was Built

- **Task 1 (`78889ce9`)** — `ThemeCardGroup` (3 `role="radio"` cards in a
  `role="radiogroup"`, each with a tiny stylized app-preview thumbnail — two-pane box
  + accent dot; light card hardcodes the light surfaces it previews; roving tabindex +
  clamped Left/Up/Right/Down arrow-nav; selected = `aria-checked` + `border-accent-line
  bg-accent-soft` + `focus-visible:ring-accent`; deliberately NOT a SegmentedControl,
  D-23-6) and `AccentSwatchGrid` (7 round `role="radio"` swatches driven by
  `ACCENT_SCALE.length`, each `style={{backgroundColor: pair.dark}}` + `aria-label`,
  selected = ring + a centered white `<Check>` glyph so selection is not color-alone,
  arrow-nav clamped; `onChange(pair.dark)`). Both layout-agnostic (flex-wrap, no fixed
  px). 11 RTL tests (structure, aria-checked, onChange, arrow-nav clamp both ends,
  Check-on-selected, per-swatch names).
- **Task 2 (`f298a6af`)** — `AppearancePreviewStrip` (a CONTAINED bordered box showing
  a Decoder-style nav item, an Activate-style accent button, a `uint` chip mimicking
  FieldNode `chip-on` — accent on the SELECTED chip, neutral `#1` — and an inert sample
  `SegmentedControl`; recolors to the pending look via inline `--color-accent`/`-soft`/
  `-line` scoped to its own subtree + an explicit `PREVIEW_SURFACE[resolved]` per-theme
  surface lookup; NEVER writes the DOM root) and `AppearanceSettings` (pending
  theme/accent seeded from `preferences`; `h3` header + "Personalize how TinkerDev looks
  on this device."; Theme / Accent color / Preview sections; Save row gating on
  `ents.has(ENT_THEMING)` — Pro `setTheme`+`setAccent`, free `openProUpsell(saveRef.current)`
  no-persist; free button = full-color accent-soft + `<Lock>` + "Unlock Pro to save",
  not opacity-only). 5 RTL tests (Pro→setters/no-upsell, free→upsell-with-el/no-persist,
  selection-does-not-persist, visible-lock/keyboard-reachable, DOM-root-untouched,
  h3 + radiogroups + contained preview present).
- **Task 3 (`a4f88c8d`)** — appended `{ id: "appearance", label: "Appearance", icon:
  Contrast, render: () => <AppearanceSettings /> }` to `SETTINGS_PANES` after License;
  imported `Contrast` from lucide + `AppearanceSettings`. No Notifications/Keyboard
  entries; `SettingsModal.tsx` byte-unchanged (nav + content derive from the registry).

## Deviations from Plan

None of substance — plan executed as written. Two minor comment-wording adjustments to
satisfy the literal acceptance greps (the SAME precedent Plan 01 set):

1. The Task-1 criterion `grep SegmentedControl src/components/ThemeCardGroup.tsx`
   expects nothing; the header comment originally read "NOT a SegmentedControl" (a
   literal match). Reworded to "Deliberately a card radiogroup, never a segmented
   toggle." — the rule is still documented; grep now returns 0.
2. The Task-2 criterion `grep -c 'document.documentElement' === 0`; the
   AppearanceSettings + AppearancePreviewStrip header comments documented the
   never-touch-the-root invariant using that literal token. Reworded to "the DOM root
   element" so the grep returns 0 while the invariant stays documented. No behavior
   change — neither component ever wrote to the root.

## Verification

- `pnpm vitest run` of the 3 new test files green; **full suite 1046/1046** (was 1030;
  +16 from this plan); `tsc --noEmit` clean; `pnpm lint` 0 errors (the same 2
  pre-existing `SidebarResetMenu` warnings, out of scope).
- Acceptance greps all pass: `role="radiogroup"` in both Task-1 components; 3 theme
  radios / 7 swatches (ACCENT_SCALE-driven); `Check` import + Check-on-selected test;
  no fixed-width px; `SegmentedControl` not imported by ThemeCardGroup; `openProUpsell`
  only in the `!entitled` branch; `document.documentElement` count 0 in pane + strip;
  "Unlock Pro to save" + `Lock`; `"appearance"` + `AppearanceSettings` + `Contrast` in
  the registry; no `Notifications`/`Keyboard`; `SettingsModal.tsx` byte-unchanged.
- Decoder (`src/lib/protobuf/`) + its 19 tests byte-for-byte untouched; zero new
  runtime/dev dependencies.

## Harness Note

Per project DoD, `/simplify` and `/codex:review --wait --scope working-tree` are slash
commands not auto-invoked by the executor — recommend `/codex:review --scope
working-tree` at the phase checkpoint. The live whole-app apply + persistence and the
real-WKWebView light/dark + Pro/free Save verification are exercised by **Plan 03's
`appearance.e2e.ts`** (which drives THIS pane) and the phase-boundary `gsd-ui-review`
WCAG-AA audit (BOTH themes) + human walkthrough on a fresh `tauri build` — those gates
live in Plan 03 / the phase boundary, not here.

## Self-Check: PASSED

- FOUND: src/components/ThemeCardGroup.tsx
- FOUND: src/components/ThemeCardGroup.test.tsx
- FOUND: src/components/AccentSwatchGrid.tsx
- FOUND: src/components/AccentSwatchGrid.test.tsx
- FOUND: src/components/AppearancePreviewStrip.tsx
- FOUND: src/components/AppearanceSettings.tsx
- FOUND: src/components/AppearanceSettings.test.tsx
- FOUND commit: 78889ce9 (Task 1)
- FOUND commit: f298a6af (Task 2)
- FOUND commit: a4f88c8d (Task 3)
