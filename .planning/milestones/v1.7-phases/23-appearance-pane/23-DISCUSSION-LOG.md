# Phase 23: Appearance Pane - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-16
**Phase:** 23-appearance-pane
**Areas discussed:** Free-tier gating, Accent customization model, Interaction model (apply/save), Light theme depth & system mode, Pane layout

---

## Free-tier gating

| Option | Description | Selected |
|--------|-------------|----------|
| Pro-gated, locked controls + upsell | Visible-but-locked controls; interacting routes to Unlock-Pro modal | ✓ |
| Fully free (not gated) | Appearance free for everyone; ENT_THEMING dormant | |
| Split: theme free, accent Pro | Only accent locked | |

**User's choice:** Pro-gated (refined later into preview+Save, see Interaction model).

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse central gate + isPro/ENT_THEMING | Wire through resolveEntitlements / gatePreferences | ✓ |
| Force-gate Appearance now | Lock regardless of global flip | |

**User's choice:** Reuse central gate + ENT_THEMING.
**Notes:** `gatePreferences()` already strips theme/accent when ENT_THEMING absent (D-26/D-27) — the gating model is already built.

---

## Accent customization model

| Option | Description | Selected |
|--------|-------------|----------|
| Curated swatch grid | Fixed AA-verified swatches | ✓ |
| Free color picker | Arbitrary hex; AA risk | |
| Swatches + custom option | Both | |

**User's choice:** Curated swatch grid (confirmed against attached mockup).

| Option | Description | Selected |
|--------|-------------|----------|
| 7 swatches, keep blue default | blue/violet/green/amber/rose/teal/slate; default stays #5b9bf8 | ✓ |
| 7 swatches, violet default | Same 7, violet default | |
| You decide the set | Claude finalizes | |

**User's choice:** 7 swatches, keep current blue (#5b9bf8) default.

---

## Interaction model (apply / save)

| Option | Description | Selected |
|--------|-------------|----------|
| Preview strip + Save (gate on Save) | Selection drives contained preview strip only; Save commits/persists; free Save → Unlock-Pro modal | ✓ |
| Preview = whole app + Save | Live whole-app preview; needs revert-on-exit | |
| Instant apply, upsell on click | No Save; matches 22.2 exactly; no preview | |

**User's choice:** Preview strip + Save (gate on Save).
**Notes:** User proposed Save-then-upsell; Claude recommended scoping the live preview to a contained strip (not whole app) so no revert logic is needed and `gatePreferences` keeps the free app on defaults regardless. Try-before-buy sell.

---

## Light theme depth & system mode

| Option | Description | Selected |
|--------|-------------|----------|
| Dark (fresh-install default) | Preserve dark-first brand | ✓ |
| System (fresh-install default) | Follow OS out of box | |

**User's choice:** Dark default for fresh installs (existing installs keep persisted value).

| Option | Description | Selected |
|--------|-------------|----------|
| Follow OS live + flash-free launch | matchMedia listener + pre-paint apply | ✓ |
| Follow OS at launch only | No mid-session reaction | |

**User's choice:** Follow OS live + flash-free launch.
**Notes:** Light palette does not exist (all 25 tokens dark-only) — full AA-verified light palette flagged as the phase's heavy lift; in scope (SC#1 requires light).

---

## Pane layout

| Option | Description | Selected |
|--------|-------------|----------|
| Cards (per mockup) | 3 radio cards w/ mini-preview thumbnails | ✓ |
| SegmentedControl (reuse) | 3-segment control, no thumbnails | |

**User's choice:** Theme picker = radio cards (per approved mockup).
**Notes:** Mockup's "Notifications"/"Keyboard" nav entries are illustrative — excluded as scope creep. Pane appended to SETTINGS_PANES (no shell change).

## Claude's Discretion

- Exact light-palette hex values + derivation approach.
- The 7 AA-tuned accent hexes (default fixed at #5b9bf8).
- Internal structure of theme-card / swatch / preview-strip components.
- `data-theme` attribute vs class naming.

## Deferred Ideas

- Free/arbitrary color picker (AA risk) — future, with contrast guarding.
- "Notifications" pane (mockup) — not in roadmap.
- Per-tool theme overrides / high-contrast / custom themes — out of scope.
- Whole-app live preview for free users — rejected (revert/e2e complexity).
