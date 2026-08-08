---
phase: 23-appearance-pane
plan: 02
subsystem: shell/appearance (CSS cascade)
tags: [theming, wcag-aa, css-tokens, light-theme]
requires:
  - "src/index.css @theme dark token block (names mirrored under the light selector)"
  - "src/shell/appearance.ts LIGHT_TOKENS + ACCENT_SCALE (Plan 01 — identical values)"
provides:
  - "[data-theme=\"light\"] re-declaration of every --color-* token (AA-verified light values)"
  - "light body radial-gradient override + tokenized body color (var(--color-tx))"
  - "borders flipped to rgba(0,0,0,...) under light so hairlines survive on white"
  - "accent/warn/ok -soft re-declared at 12% + -line at 70% under light (Pitfall 6, RESEARCH A4)"
  - "theme-aware hover/focus tints (hover:bg-input-bg) in Sidebar/SettingsModal/SidebarResetMenu"
affects:
  - "Plan 03 (App-root applyAppearance stamps data-theme=light → this block flips the whole app)"
  - "Plan 04 (appearance.e2e light-theme screenshot exercises this cascade on the real WKWebView)"
tech-stack:
  added: []
  patterns:
    - "light theme = a [data-theme=\"light\"] custom-property re-declaration block; utilities resolve var(--color-*) at use-site so the cascade flips all 11 tools + proto tree + Settings/License + sidebar + palette with ZERO utility-class edits"
    - "accent/warn/ok -soft/-line re-declared explicitly under the light selector (not relying on @theme color-mix tracking the redeclared var); soft drops 15%→12% for near-white AA headroom"
    - "hardcoded white-alpha hover tints replaced with a token (input-bg) that has contrast in BOTH themes"
key-files:
  created: []
  modified:
    - "src/index.css"
    - "src/components/Sidebar.tsx"
    - "src/components/SettingsModal.tsx"
    - "src/components/SidebarResetMenu.tsx"
decisions:
  - "Light token values copied verbatim from Plan 01's LIGHT_TOKENS + ACCENT_SCALE light blue (#1763d6) — the same values appearanceContrast.test.ts enforces as the AA bar; no re-derivation."
  - "accent-soft/line (and warn/ok) re-declared under the light selector rather than relying on the @theme color-mix to re-resolve — soft mix lowered to 12% (line 70%) for AA headroom on near-white surfaces (RESEARCH A4 / Pitfall 6)."
  - "Used hover:bg-input-bg (the recommended simplest fix) for the white-alpha hover/focus tints — input-bg is dark #0d0f13 / light #f0f1f4 so the tint stays visible against the row's parent surface in both themes."
metrics:
  duration_seconds: 210
  tasks: 2
  files_created: 0
  files_modified: 4
  completed: "2026-06-16"
---

# Phase 23 Plan 02: Light Token Block + Theme-Aware Hover Tints Summary

Authored the FULL light token set (D-23-8) as a `[data-theme="light"]` re-declaration block in `src/index.css` so the CSS custom-property cascade flips the entire app — all 11 tools, the protobuf field tree, License/Settings panes, sidebar, and the command palette — with ZERO utility-class edits, plus fixed the three known hardcoded-dark survivors (Pitfall 5): the body radial-gradient/color and the white-alpha hover/focus tints that vanish on a white surface.

## What Was Built

- **Task 1 (`c14c8e5c`)** — `src/index.css`: a `:root[data-theme="light"]` block re-declaring every surface/text token (bg-app/win/titlebar/sidebar/pane/panel/card/palette/input-bg), the text ramp (tx/tx-2/tx-3), scrim, and the accent/warn/ok BASES to their light variants, each with its `-soft` (12%) and `-line` (70%) re-declared explicitly (Pitfall 6 — not relying on @theme color-mix tracking the redeclared var; 12% soft gives AA headroom on near-white per RESEARCH A4). Borders flip from `rgba(255,255,255,…)` to `rgba(0,0,0,0.08)`/`0.14` so hairlines stay visible on white. The base `body` rule's `color` was tokenized to `var(--color-tx)` (byte-identical render in dark — dark `--color-tx` is `#e7e9ee`) and a `:root[data-theme="light"] body` override swaps the dark radial-gradient for a light one (no dark gradient bleeds behind a light app). The `@theme` block values, `@import` lines, and `.no-scrollbar` rules are byte-unchanged. Values copied verbatim from Plan 01's `LIGHT_TOKENS` + `ACCENT_SCALE` light blue (`#1763d6`) — the AA bar Plan 01's `appearanceContrast.test.ts` enforces.
- **Task 2 (`24d7c713`)** — replaced the three hardcoded white-alpha hover/focus tints (invisible on the light theme's near-white surfaces — a WCAG/UX break) with the token-driven `hover:bg-input-bg`: `Sidebar.tsx` inactive nav row, `SettingsModal.tsx` inactive pane-nav button, and BOTH `SidebarResetMenu.tsx` menu items (hover + focus). `input-bg` (dark `#0d0f13` / light `#f0f1f4`) keeps the hover/focus feedback visible in both themes. No other className on those rows changed.

## Deviations from Plan

None — plan executed exactly as written. Both tasks used the plan's RECOMMENDED simplest fixes (verbatim light values for Task 1, `hover:bg-input-bg` for Task 2). The 2 pre-existing `SidebarResetMenu.tsx` eslint warnings (unused disable directive + fast-refresh export) are out of scope and untouched.

## Verification

- `pnpm exec tsc --noEmit` clean; `pnpm lint` 0 errors (2 pre-existing out-of-scope warnings).
- Full pre-commit gate on each task: vitest **1030/1030** + tsc + eslint.
- `grep -c 'data-theme="light"' src/index.css` = 4 (>= 2 required: token block selector + body override + 2 comment refs).
- `--color-accent: #1763d6`, `rgba(0, 0, 0, 0.08)`, `color: var(--color-tx)` all present.
- Zero `rgba(255,255,255,…)` literals remain in the three audited components.
- `@theme` / `@import` / `.no-scrollbar` byte-unchanged; decoder + its 19 tests byte-for-byte untouched (last touched Phase 01).
- Zero new runtime/dev deps.

## Harness Note

This plan is CSS/className-only (no new vitest). Per project DoD, `/simplify` and `/codex:review --wait --scope working-tree` are slash commands not auto-invoked by the executor — recommend `/codex:review --scope working-tree` at the phase checkpoint. Real-WKWebView light-theme verification is exercised by Plan 04's `appearance.e2e` + the phase-boundary `gsd-ui-review` WCAG-AA audit (run in BOTH themes); this plan's light values are pre-verified by Plan 01's contrast test.

## Self-Check: PASSED

- FOUND: src/index.css (light block + body override)
- FOUND commit: c14c8e5c (Task 1)
- FOUND commit: 24d7c713 (Task 2)
- VERIFIED: 0 rgba(255,255,255 literals in the 3 components
