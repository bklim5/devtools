---
created: 2026-06-11T08:28:35.209Z
title: Gate command palette as Pro feature
area: ui
files:
  - src/components/CommandPalette.tsx
  - src/lib/entitlements/entitlements.ts
  - src/shell/useEntitlements.ts
---

## Problem

The ⌘K command palette should be a paid (Pro) feature, but the Phase 18 entitlement vocabulary only covers `pro.theming` + `pro.ordering` — the palette is currently free-tier on every surface. User decision captured 2026-06-11 during Phase 18 close-out ("we should also be putting command palette behind the payment gating").

## Solution

Route through the Phase 18 central gate — zero per-feature checks outside it:

- Add a `pro.palette` (or similar) entitlement to the vocabulary in `src/lib/entitlements/entitlements.ts`; include it in `FULL_SET`, exclude from `FREE_SET`.
- Gate the palette surface via `useEntitlements()`: decide the locked UX — likely palette still opens but shows the shared UpsellPanel/UpsellModal (locked features stay visible-but-locked per v1.6 architecture; never hidden, no opacity-only state), or ⌘K opens the upsell modal directly.
- Mind WCAG-AA (focus trap exists in UpsellModal) and the e2e suite — many specs drive navigation through the palette under the FREE tier (browser/dev default), so locking it will break them unless they switch to sidebar navigation or seed a FULL override.
- Also consider the D-32 dev "Toggle free tier (dev)" command — it lives INSIDE the palette; if the palette is locked in free tier, the dev toggle-back path needs an alternate route (or the locked palette must still expose dev commands in DEV builds).
- Timing: ships dormant like the rest of the seam until Phase 21 flips the free-tier default; cleanest to fold into Phase 21 planning (or a small phase beside it) rather than retrofitting Phase 18.
