# Phase 18: Entitlements Seam & Central Gate - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-10
**Phase:** 18-entitlements-seam-central-gate
**Areas discussed:** Upsell panel content, Lock badge presentation, Locked-feature semantics, Dev/test toggle

---

## Upsell panel content

| Option | Description | Selected |
|--------|-------------|----------|
| Stub Buy CTA now, wire later | Button from day 1 behind a URL constant; Phase 20 swaps real MoR link | ✓ |
| Omit until Phase 20 | Messaging only; Phase 20 adds the button | |

| Option | Description | Selected |
|--------|-------------|----------|
| Reserve "Enter license key" slot now | Stubbed secondary affordance; Phase 19 wires activation | ✓ |
| Buy CTA only | Phase 19 re-lays-out the panel later | |

| Option | Description | Selected |
|--------|-------------|----------|
| Short pitch, no price | Name + lock state + 1–2 lines on what a license unlocks; pricing on MoR page | ✓ |
| Minimal lock notice | Just "requires a license" + CTA | |
| Full pitch with pricing | Feature list + price kept in sync forever | |

| Option | Description | Selected |
|--------|-------------|----------|
| One shared panel | Single component, feature name/icon param; one WCAG-AA surface | ✓ |
| Per-feature variants | Tailored messaging per locked feature | |

---

## Lock badge presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Lock glyph at row end | Small lucide Lock in status-badge slot family; icon/name untouched | ✓ |
| Lock replaces tool icon | Strongest but hides identity | |
| Lock overlays tool icon | Corner badge; fiddly at sidebar sizes | |

| Option | Description | Selected |
|--------|-------------|----------|
| Same lock glyph in ⌘K | Selecting still navigates (route shows upsell) | ✓ |
| Lock + "Pro" text label | More explicit, noisier | |

| Option | Description | Selected |
|--------|-------------|----------|
| Neutral tx-2 | Accent stays selection-only | ✓ |
| Accent-tinted | Breaks accent discipline | |
| Warning amber | Wrong connotation | |

| Option | Description | Selected |
|--------|-------------|----------|
| "locked" in accessible name | Icon aria-hidden; no live-region noise | ✓ |
| You decide | Claude picks during planning | |

---

## Locked-feature semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Revert to defaults, prefs kept | Default order, pinned hidden; toolOrder/pinnedToolIds untouched on disk | ✓ |
| Keep arrangement, read-only | Custom order renders; editing disabled | |

**MID-AREA PIVOT (user-initiated):** "i am considering releasing all the tools for free, the licensing will be mainly for other configuration/customization (eg: themeing and reordering). What do you think?"

Claude's analysis: hero = marketing wedge (locking it kills the free pitch); but customization alone is a thin Pro tier (theming has no UI yet). Recommended middle path: all tools free + Pro = customization + declared future power features.

| Option | Description | Selected |
|--------|-------------|----------|
| Tools free; Pro = custom + future | All 11 tools free; Pro = theming + ordering/pinning + home for future power features (schema-aware Protobuf, CLI); tool-gating seam built but dormant | ✓ |
| Tools free; Pro = customization only | No future-features commitment; weakest tier | |
| Keep original: hero locked | ENT-04 as written | |

| Option | Description | Selected |
|--------|-------------|----------|
| Gate theming at prefs-apply seam | Locked → defaults forced, stored values kept | ✓ |
| Map entry only, no enforcement | Vacuous for ENT-02 | |

| Option | Description | Selected |
|--------|-------------|----------|
| Affordances visible with lock → upsell | Invoking opens shared panel; primary Pro discovery | ✓ |
| Hide them entirely | Pro invisible to free users | |

| Option | Description | Selected |
|--------|-------------|----------|
| "Unlock Pro" sidebar footer entry | Quiet keyboard-reachable row, free tier only | ✓ (+ user: also in next-milestone settings UI → deferred) |
| Locked affordances only | No standing entry | |
| ⌘K palette command only | Invisible without palette | |

Locked-startup question (asked pre-pivot, resolved as dormant-mechanism default): open locked tool → upsell panel in place of tool UI; startup resolution unchanged.

---

## Dev/test toggle

User follow-ups: (1) "can any user override it?" → yes, but downgrade-only = harmless/reversible, no unlock path; (2) "how do we make sure it's not bundled into the final app?" → `import.meta.env.DEV` guard, tree-shaken, dist-grep build check; trade-off: packaged walkthrough proves unchanged default instead of locked UX.

| Option | Description | Selected |
|--------|-------------|----------|
| DEV-only command + downgrade-only key | Key honored everywhere (can only lock); palette command DEV-only, verified absent from dist | ✓ |
| Command in all builds | Demo free tier on packaged app; ships dev chrome | |
| Build-time env var | Can't flip at runtime | |

| Option | Description | Selected |
|--------|-------------|----------|
| Two-state: free / full | Matches what Phase 21 ships | ✓ |
| Per-entitlement override | More coercion code | |

---

## Claude's Discretion

- Entitlement string vocabulary; `premium?` field disposition; dormant-path test strategy (fixture tool vs dev set); gate API shape; lazy-loading conversion mechanics + chunk-loading UX; upsell copy.

## Deferred Ideas

- Pro/license entry in the future settings UI (next milestone, pairs with 999.3 theme settings).
- Future Pro power features: schema-aware Protobuf (999.5), DevTools CLI (999.4).
