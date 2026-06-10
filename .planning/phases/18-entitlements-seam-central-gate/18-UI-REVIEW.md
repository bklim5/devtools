# Phase 18 — UI Review

**Audited:** 2026-06-10
**Baseline:** 18-UI-SPEC.md (approved design contract, including the D-19 user copy override recorded in 18-04-SUMMARY.md)
**Screenshots:** not captured by auditor (no dev server on :3000/:1420/:5173/:8080) — however real-WKWebView e2e screenshots from Plan 04 (`test/e2e/__screenshots__/entitlements-locked-upsell.png`, `entitlements-restored.png`) were inspected as visual evidence, so this is a code + real-runtime-screenshot audit, not code-only.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Every contract string verbatim; tripwire string exactly once inside the DEV branch; no pricing anywhere |
| 2. Visuals | 4/4 | Panel hierarchy, neutral lock badges, and dormancy all confirmed on real-WKWebView screenshots |
| 3. Color | 4/4 | Accent appears only on the 3 reserved uses; lock elements strictly `text-tx-2`; zero new hardcoded colors |
| 4. Typography | 4/4 | New surfaces use exactly the declared 12/13/16px ramp at 400/600; `font-medium` correctly omitted from the CTA |
| 5. Spacing | 4/4 | p-6 / gap-4 / gap-2 / max-w-[420px] / p-8 route inset / 24px footer target — all per contract; house radii reused |
| 6. Experience Design | 3/4 | Updater overlay (z-50) stacks ABOVE the aria-modal UpsellModal scrim (z-50) — non-inert clickable content over an open modal |

**Overall: 23/24**

---

## Top 3 Priority Fixes

1. **UpsellModal can be overpainted by the updater overlay** — `App.tsx:154` mounts the update overlay (`fixed bottom-4 right-4 z-50`, `pointer-events-auto` banner) after `<main>`, while `UpsellModal` renders inside the Sidebar's `<aside>` at the same `z-50` (`UpsellPanel.tsx:147`); later DOM order wins, so the UpdateOptIn/UpdateBanner floats un-dimmed and clickable above an `aria-modal="true"` dialog (visible in `entitlements-locked-upsell.png`). The Tab trap keeps keyboard users inside, but pointer users can interact with banner buttons behind a modal that claims the background is inert — a WCAG modal-integrity gap. **Fix:** raise the UpsellModal scrim container to `z-[60]` (one-class change in `UpsellPanel.tsx:147`), or portal the modal to `document.body` after the updater overlay. Dormant in production this phase (free tier is dev-only), so low shipping risk — but fix before Phase 21 makes the modal live.
2. **Heading emoji enters the dialog's accessible name** — `UpsellPanel.tsx:39`: the `<h2>` that `aria-labelledby` targets contains `❤️`, so screen readers announce "Thank you for using TinkerDev red heart" for both the heading and the dialog name. **Fix:** keep the user-approved visible copy verbatim but wrap the emoji: `Thank you for using TinkerDev <span aria-hidden="true">❤️</span>` — zero visual change, cleaner SR output.
3. **Lock badge placement deviates from the spec's literal wording** — UI-SPEC says the badge goes "inside the truncating span"; `Sidebar.tsx:617-628` places it as a flex sibling AFTER the `min-w-0 truncate` span. The implementation is the better behavior (a long tool name truncates while the badge stays visible instead of being clipped), but the contract text now disagrees with shipped code. **Fix:** amend the UI-SPEC Lock badge line to "inline immediately after the truncating name span" — doc-only change, no code edit.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

All Copywriting Contract rows verified against source, including the D-19 walkthrough override:

- Heading: `Thank you for using TinkerDev ❤️` — `UpsellPanel.tsx:39`, verbatim.
- Body: both approved paragraphs verbatim — `UpsellPanel.tsx:43-52` ("Most of TinkerDev is free…" / "If TinkerDev has earned a spot in your toolkit…"). No pricing string, no "$", per D-20.
- "Unlocks: {feature}" line absent and the `feature` prop removed (D-19 override honored) — `UpsellPanel.tsx:23-28` takes only `icon`/`headingId`.
- Primary CTA `Buy license` — `UpsellPanel.tsx:64`; secondary `I have a license key` — `UpsellPanel.tsx:71`.
- Footer row `Unlock Pro` — `Sidebar.tsx:766`.
- SR suffix ` — locked` in sr-only spans — `Sidebar.tsx:626`, `CommandPalette.tsx:301`.
- DEV tripwire `Toggle free tier (dev)` appears exactly once, inside the `import.meta.env.DEV` ternary — `CommandPalette.tsx:58-76`; `scripts/check-dev-strip.sh` proves dist absence (18-04-SUMMARY).
- Empty state `No tools match` (pre-existing, D-07) intact — `CommandPalette.tsx:252`. No generic Submit/OK/Cancel labels introduced.

### Pillar 2: Visuals (4/4)

- Real-WKWebView screenshot `entitlements-locked-upsell.png` confirms: centered modal card with clear focal hierarchy (icon + 16px semibold heading → 12px neutral body → CTA row with one accented and one neutral button); free-tier sidebar in registry-default order with the quiet "Unlock Pro" footer; `entitlements-restored.png` confirms the FULL-tier restore (pinned group + divider back, no footer row, no badges).
- Icon-only controls carry accessible names: pin button `aria-label`/`aria-pressed`/`title` (`Sidebar.tsx:652-654`), grip is deliberately `aria-hidden` pointer-chrome with the row carrying the SR control (pre-existing D-17 model). Lock glyphs are `aria-hidden` paired with sr-only name suffixes (D-25) — correct pattern, no tooltip needed.
- Locked affordances keep their existing neutral treatment with no dimming — no `opacity` class on locked rows (ENT-04); the only opacity uses are the pre-existing drag ghost (`opacity-50` while dragging) and the pre-existing hover-reveal pin/grip (codex P3 declined per spec, correctly).
- Minor (tracked as Fix 3): badge sits after, not literally "inside", the truncating span — an improvement over the spec's wording.

### Pillar 3: Color (4/4)

- Accent inventory across the four phase files matches the reserved-for list exactly:
  1. Selection: active sidebar row `bg-accent-soft` + accent bar + icon (`Sidebar.tsx:592-612`, pre-existing); active palette row (`CommandPalette.tsx:281-288`, pre-existing).
  2. Focus rings: `focus-visible:ring-accent` on every new interactive element — CTA buttons (`UpsellPanel.tsx:62,69`), footer row (`Sidebar.tsx:763`).
  3. Primary CTA only: `border-accent-line bg-accent-soft text-accent` (`UpsellPanel.tsx:62`) — never a solid accent fill; no `bg-accent` on any button.
- Accent FORBIDDEN list honored: lock badges are `text-tx-2` (`Sidebar.tsx:623`, `CommandPalette.tsx:299`); footer row is `text-tx-2 hover:text-tx` (`Sidebar.tsx:763`); locked affordances add no color change.
- Hardcoded `rgba(...)` hits (`Sidebar.tsx:593,795,807`) are pre-existing Phase 16/17 hover tints on untouched lines — not introduced this phase. New surfaces use only `@theme` tokens (`bg-panel`, `border-bd`, `bg-scrim`, `bg-input-bg`, `text-tx`/`tx-2`).
- Contrast: body text `text-tx-2` (#989da7 ≈ 7:1 on #181b21) and `text-tx` — both above the 4.5:1 floor; no `tx-3` below 11px on new surfaces.

### Pillar 4: Typography (4/4)

- New Phase 18 surfaces use exactly the declared ramp: heading `text-[16px] font-semibold leading-[1.2]` (`UpsellPanel.tsx:37`), body/buttons `text-[12px] leading-[1.5]` at default 400 (`UpsellPanel.tsx:42,62,69`), footer/label `text-[13px]` 400 (`Sidebar.tsx:763`). The 11px meta slot is unused (helper text not needed) — permitted.
- Weight discipline: only 400 and 600 on new components. Notably, the UpdateBanner primary family carries `font-medium` (500, `UpdateBanner.tsx:65`) and the UpsellPanel CTA correctly DROPS it per the spec's explicit "do not add 500 to new components" rule — emphasis comes from the accent-soft fill.
- Other sizes in the audited files (10.5/11/12.5/13.5/14px, `font-medium` at `CommandPalette.tsx:290`) are all pre-existing app-scale metrics on untouched surfaces.
- `font-sans` throughout; the only mono usage is the pre-existing palette hint bar.

### Pillar 5: Spacing (4/4)

- UpsellPanel: `p-6` (24px lg internal padding), `gap-4` (16px element rhythm), `gap-2` (8px between paragraphs and between CTA buttons), `max-w-[420px]` — all per the Component Contract (`UpsellPanel.tsx:32,42,54`).
- Route placement: `flex flex-1 items-center justify-center p-8` (`ToolRoute.tsx:28`) — 32px inset from `<main>` edges, layout-agnostic flex centering, no fixed sizes.
- Footer row: `min-h-6` = 24px minimum target (WCAG 2.5.8 / D-17 exception honored), `gap-2`, 12px Lock glyph (`h-3 w-3`) (`Sidebar.tsx:760-767`).
- House radii reused, none invented: `rounded-[7px]` card + buttons, `rounded-[6px]` footer row.
- CTA padding `px-3 py-1` matches the named UpdateBanner family byte-for-byte (`UpdateBanner.tsx:65,76`) — the family is the contract's authority, and 12px is on the 4px grid.
- Arbitrary bracket values found (`px-[10px]`, `px-[18px]`, `p-[14px]`, `pt-[14vh]`, etc.) are all inherited pre-existing palette/sidebar metrics locked by the spec's exceptions clause; none added this phase.

### Pillar 6: Experience Design (3/4)

Strong, with one stacking defect:

- **Defect (−1): modal vs updater overlay stacking.** `entitlements-locked-upsell.png` shows the UpdateOptIn prompt fully bright and clickable above the modal scrim. Cause: both layers are `z-50`; the updater container (`App.tsx:154`) comes later in the DOM than the Sidebar-mounted modal (`UpsellPanel.tsx:147`), so it paints on top with `pointer-events-auto` buttons. `aria-modal="true"` promises an inert background; the Tab trap holds for keyboard, but pointer interaction with the banner remains possible and the banner escapes the scrim dimming. See Priority Fix 1. (The CommandPalette shares the z-50 tier but does not claim `aria-modal`, so the UpsellModal is where the contract breaks.)
- Modal semantics otherwise exceed contract: `role="dialog"` + `aria-modal` + `aria-labelledby` (`UpsellPanel.tsx:154-156`), Esc dismiss, scrim-click dismiss (target===currentTarget), focus moved in on mount, focus returned to a still-connected invoker on unmount, and a full Tab focus trap with both-end wrap + outside-recapture (`UpsellPanel.tsx:110-132`) — the trap was added beyond plan spec to satisfy aria-modal (18-01 deviation 1).
- Focus continuity hardened on the menu path: `resetOrder`'s locked branch closes the menu with `restoreFocus: true` before the modal mounts (`Sidebar.tsx:485-489`) so Esc returns focus to the invoking row.
- Locked-state coverage is structural: every affordance (pin click `Sidebar.tsx:209`, Alt chords `:347` with the `e.code === "KeyP"` physical-key discipline preserved, drag start `:235`, reset `:485`) branches to the upsell BEFORE any setter — zero prefs-write paths while locked (T-18-12), proven by store-set spies and the e2e restore screenshot.
- Live reactivity: all surfaces consume `useEntitlements()` over one `useSyncExternalStore` store; the dev toggle flips sidebar, palette, footer, and routes together without reload (proven in tests + e2e).
- Loading state: `<Suspense fallback={null}>` per the contract's no-spinner rule (`ToolRoute.tsx:37`); 15/15 real-WKWebView e2e specs confirmed no perceptible blank.
- Empty/error states: n/a per contract (no data lists, no failure surfaces); palette "No tools match" intact.
- Known intentional stubs (not penalized — contract-declared): "Buy license" no-op reading `BUY_LICENSE_URL` (Phase 20) and inert "I have a license key" (Phase 19). Minor note: both render with `cursor-pointer` and full interactive styling while doing nothing — acceptable since layout is contractually final and the surface is dormant in production, but expect user confusion if the free tier ever ships before Phases 19/20 wire them.

---

## Registry Safety

shadcn not initialized (`components.json` absent) and the UI-SPEC declares zero registries — registry audit skipped per protocol. Confirmed independently: no shipped tool carries `requiredEntitlements` (grep of `src/lib/tools/registry.ts` + all 11 `src/tools/*/index.ts` — D-18 dormancy holds), and the only new icon usage is `Lock` from the already-pinned lucide-react.

---

## Files Audited

- `src/components/UpsellPanel.tsx` (UpsellPanel card, UpsellModal, BUY_LICENSE_URL)
- `src/components/ToolRoute.tsx` (element-level gate, lazy cache, Suspense)
- `src/components/Sidebar.tsx` (D-26 gated partition, D-28 locked affordances, D-29 footer row, D-23/24/25 badge)
- `src/components/CommandPalette.tsx` (PaletteRow union, lock badge, DEV toggle command)
- `src/components/UpdateBanner.tsx` (button-family reference + stacking interaction)
- `src/App.tsx` (updater overlay mount — stacking finding)
- `src/index.css` (@theme tokens, contrast verification)
- `src/lib/tools/registry.ts` + `src/tools/*/index.ts` (dormancy grep)
- `test/e2e/__screenshots__/entitlements-locked-upsell.png`, `entitlements-restored.png` (real-WKWebView visual evidence)
