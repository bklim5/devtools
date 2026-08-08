---
phase: 18-entitlements-seam-central-gate
plan: 03
subsystem: licensing
tags: [entitlements, sidebar, command-palette, lock-badge, upsell, dev-toggle, wcag-aa]

# Dependency graph
requires:
  - phase: 18-entitlements-seam-central-gate
    plan: 01
    provides: ENT_ORDERING/ENT_THEMING vocabulary, isToolLocked, useEntitlements, entitlements store (refresh + test seams), UpsellModal, entitlementsOverride coercer
  - phase: 18-entitlements-seam-central-gate
    plan: 02
    provides: ToolRoute element-level gate (locked tools still navigate — the route shows the upsell)
provides:
  - "Sidebar: D-26 gated partition inputs (locked = registry-default render, stored prefs untouched), D-28 locked affordances → shared UpsellModal, D-29 free-tier footer 'Unlock Pro' row, D-23/24/25 dormant lock badge + SR suffix"
  - "CommandPalette: PaletteRow tool|command discriminated union, lock badge + SR suffix on locked tool rows, D-32 DEV-only 'Toggle free tier (dev)' command (downgrade-only override + refreshEntitlements)"
  - "Fixture-proven dormant tool-lock mechanism on BOTH registry surfaces (Sidebar.locked / CommandPalette.locked tests under FULL_SET with an unknown entitlement)"
affects: [18-04 (phase gate + e2e re-proof incl. dist-grep tripwire), 21 (free-tier flip makes all lock surfaces live)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Every gate reads ONE resolved set (useEntitlements + ents.has/isToolLocked) — zero per-feature tier checks (ENT-01 discipline)"
    - "Lock branches return BEFORE any setter — prefs preservation is structural, not behavioral (T-18-12)"
    - "DEV-only palette commands live in a module-level DEV_COMMANDS const under import.meta.env.DEV — string + branch tree-shaken from production"
    - "Locked Alt-chord matching keeps the physical-key e.code discipline (macOS Option-compose, Pitfall 9)"

key-files:
  created:
    - src/components/Sidebar.locked.test.tsx
    - src/components/CommandPalette.locked.test.tsx
  modified:
    - src/components/Sidebar.tsx
    - src/components/Sidebar.test.tsx
    - src/components/CommandPalette.tsx
    - src/components/CommandPalette.test.tsx

key-decisions:
  - "resetOrder's locked branch closes the menu WITH restoreFocus so the modal captures the invoking row and Esc returns focus there (plan showed a bare close — focus-continuity improvement)"
  - "DEV_COMMANDS hoisted to a module-level const (stateless run closure) instead of building per-render inside the component"
  - "Codex P3 'always-show locked pin/grip controls' declined — UI-SPEC mandates locked affordances keep their EXISTING neutral treatment (hover/focus reveal); discoverability is the D-29 footer row's job"
  - "Accessible-name assertions match /— locked$/ whitespace-tolerantly — accname computation joins inline nodes without re-inserting the sr-only span's leading space"

patterns-established:
  - "Locked-fixture test recipe: vi.mock the registry with one free + one unknown-entitlement tool, inject FULL_SET — proves the mechanism stays locked even at full tier (D-18 dormancy proof)"

requirements-completed: [ENT-01, ENT-02, ENT-04]

# Metrics
duration: ~28min
completed: 2026-06-10
---

# Phase 18 Plan 03: Sidebar & Palette Lock Surfaces Summary

**Lock UX wired onto both registry-driven surfaces through Plan 01's central gate: the sidebar gates ordering/pinning on `ents.has(ENT_ORDERING)` (locked = registry-default render + every affordance opening the shared UpsellModal, stored prefs structurally untouched), grows a free-tier-only footer "Unlock Pro" row and a dormant fixture-proven lock badge; the ⌘K palette mirrors the badge via the same `isToolLocked` predicate and gains the DEV-only "Toggle free tier (dev)" command that flips ALL surfaces live via `refreshEntitlements()` — zero per-feature tier checks anywhere.**

## Performance

- **Duration:** ~28 min
- **Started:** 2026-06-10T14:42:58Z
- **Completed:** 2026-06-10T15:10:00Z
- **Tasks:** 3
- **Files modified:** 6 (+1 phase deferred-items doc)

## Accomplishments

- **D-26 gated arrangement:** `partitionTools` inputs swap to `[]`/`[]` while `pro.ordering` is missing — pinned group, divider, and "Unpin all" hide automatically; render is registry-default; the stored `toolOrder`/`pinnedToolIds` are never written (proven by store-set spies) and flipping back to FULL restores the arrangement instantly on the mounted component.
- **D-28 locked affordances:** pin click, Alt+P (physical `KeyP`, composed "π" path preserved), Alt+↑/↓, drag start, and the Shift+F10 "Reset order" item all branch FIRST on lock and open the ONE shared UpsellModal ("Tool ordering & pinning is a Pro feature") — affordances stay visible with their existing neutral treatment, no opacity state, and no write path exists from any locked branch (T-18-12 structural).
- **D-29 footer row:** a quiet neutral `Unlock Pro` button renders after the nav in free tier only (missing ordering OR theming), Tab-reachable with the house focus ring, opening the same modal — the standing Phase 19/21 entry point.
- **D-23/24/25 dormant badge on BOTH surfaces:** locked tool rows show an inline aria-hidden `text-tx-2` Lock glyph after the name + an sr-only "— locked" accessible-name suffix; NavLink/palette selection still navigates (the route shows the upsell — Plan 02's gate). Production registry has zero diff — the mechanism is proven by fixtures requiring an unknown entitlement under FULL_SET (D-18 dormancy).
- **D-31/D-32 dev toggle:** palette rows are now a `tool | command` discriminated union; `DEV_COMMANDS` exists only under `import.meta.env.DEV` (string included — Plan 04's dist-grep tripwire), appends after ALL TOOLS on the empty query only, writes the downgrade-only `entitlementsOverride` ("free" ⇄ null) through `savePreferences`, then awaits `refreshEntitlements()` — the snapshot observably flips FULL→FREE in tests and all `useEntitlements` consumers update live.
- Suite grew 771 → **792** (+21: 8 sidebar free-tier + 2 footer + 4 sidebar-locked fixture + 5 dev-toggle + 2 palette-locked fixture); `tsc` + `eslint` clean; full real-WKWebView e2e **14/14** green (shipped in-Tauri FULL behavior unchanged); `decoder.ts`/`toolOrder.ts`/`registry.ts` zero diff; zero new dependencies.

## Task Commits

Each task committed atomically (tests landed GREEN with their impl per the lefthook RED-commit constraint):

1. **Task 1: D-26 gated ordering/pinning + D-28 locked affordances → upsell** - `a86b5ce5` (feat)
2. **Task 2: Footer "Unlock Pro" row (D-29) + dormant lock badge / SR suffix (D-23/24/25)** - `d8c7453c` (feat)
3. **Task 3: Palette lock badge + DEV-only free-tier toggle (D-31/D-32)** - `0d4dcedb` (feat)

## Files Created/Modified

- `src/components/Sidebar.tsx` - useEntitlements/ENT_ORDERING gate on partition inputs + 5 affordance lock branches + UpsellModal + footer row + isToolLocked badge in renderRow
- `src/components/Sidebar.test.tsx` - FULL_SET shim for projection tests (Pitfall 5 audit) + free-tier describe (8 cases) + footer-row cases (chosen single home)
- `src/components/Sidebar.locked.test.tsx` - 2-tool fixture registry under FULL_SET: badge, SR suffix, no-dimming, still-navigates (dormancy proof)
- `src/components/CommandPalette.tsx` - PaletteRow union, selectRow (commands close-then-run, never navigate), lock badge + SR suffix, DEV_COMMANDS
- `src/components/CommandPalette.test.tsx` - FULL_SET shim + 5 dev-toggle cases (end-of-list, filtered out under query, override write + live snapshot flip, free⇄null, ArrowUp wrap mixed-list indexing)
- `src/components/CommandPalette.locked.test.tsx` - fixture badge + still-navigates proof mirroring the sidebar recipe

## Decisions Made

- `resetOrder`'s locked branch closes the context menu with `restoreFocus: true` (plan showed a bare `closeResetMenu()`): focus lands back on the invoking row before the modal mounts, so the modal's focus-capture/return contract holds for the menu path too.
- `DEV_COMMANDS` is a module-level constant (the run closure is stateless) rather than rebuilt per render inside the component — same tree-shaking property, less work per keystroke.
- Footer-row tests live in `Sidebar.test.tsx` (the single chosen home, noted in `Sidebar.locked.test.tsx`) because they are registry-independent tier behaviors.
- Accessible-name lock-suffix assertions use `/— locked$/`-style regexes: accname computation joins inline text nodes without re-inserting the sr-only span's leading space ("Locked Fixture— locked"), and the SUFFIX is the D-25 contract, not the join space.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] resetOrder locked branch restores focus before opening the modal**
- **Found during:** Task 1
- **Issue:** the plan's bare `closeResetMenu()` would unmount the focused menu item, so the modal's mount-time invoker capture would land on `<body>` and Esc could not return focus (WCAG keyboard-continuity gap on one of the four affordance paths)
- **Fix:** `closeResetMenu({ restoreFocus: true })` — focus returns to the invoking row synchronously, the modal captures it, Esc restores it
- **Files modified:** src/components/Sidebar.tsx
- **Commit:** a86b5ce5

### Reviewed-and-declined (codex findings)

**2. [P3, declined] "Locked pin/grip controls should be always-visible"** — conflicts with the binding UI-SPEC, which mandates locked affordances "keep their existing neutral treatment" (hover/focus reveal) with NO visual change; at-rest discoverability is the D-29 footer row's explicit job. No change made.

**3. [P2, resolved by plan structure] "Palette lacks the lock treatment"** — raised at the Task 2 review boundary; Task 3 of this same plan delivered it. No deviation.

**4. [P3, deferred] Stale-hook whole-blob prefs writes can clobber the persisted dev override** — a later setter from a `usePreferences` instance mounted before the toggle (e.g. `useTrackActiveTool` writing `lastUsedId`) persists the OLD `entitlementsOverride`. This is the prefs seam's pre-existing last-writer-wins trait (multiple hook instances predate this plan), not introduced by this task; the LIVE snapshot is unaffected in-session. Logged to `deferred-items.md` (suggested home: Phase 21 or a `savePreferences` field-merge if the Plan 04 e2e shows flakiness).

---

**Total:** 1 auto-fixed (focus continuity), 1 deferred out-of-scope, 2 declined with spec rationale. No scope creep, no architectural changes.

## Harness Gates (per-task DoD)

- simplify: plan-verbatim implementations; one cleanup (dead types-import removed from the mock factory, DEV_COMMANDS hoisted)
- `codex review --uncommitted` per task: findings dispositioned above (0 actionable bugs in the shipped diff)
- Unit: **792/792** (`vitest`), `tsc --noEmit` clean, `pnpm lint` clean
- Real-WKWebView: full e2e suite **14/14 specs** via `scripts/e2e-spike.sh` (in-Tauri FULL default — shipped behavior verified unchanged). The scripted free-tier/dev-toggle e2e proof lands in Plan 04 per the plan; the interactive ⌘K-toggle walkthrough rides the Plan 04 phase-gate human-verify.

## Known Stubs

None introduced. The lock badge + locked affordance branches are **dormant by design** (D-18 — no shipped tool carries `requiredEntitlements`; in-Tauri resolves FULL until Phase 21), fully wired and fixture-proven, not stubs. Plan 01's two intentional UpsellPanel stubs (BUY_LICENSE_URL CTA, license-key button) are unchanged and tracked in 18-01-SUMMARY.

## Threat Flags

None — no new network endpoints, auth paths, file access, or schema changes. All four plan threats mitigated: T-18-09 (command + string exist only under `import.meta.env.DEV`; dist-grep proof in Plan 04), T-18-10 (run writes only "free"/null through the D-31 coercer path), T-18-11 (rows/announcements still render registry names via getToolById — untouched), T-18-12 (every lock branch returns before any setter; store-set spies prove zero writes).

## Issues Encountered

- One leaked vite dev-server after the e2e run (known harness gotcha) — reaped; ports clean.

## User Setup Required

None.

## Next Phase Readiness

- Plan 04 (phase gate) inherits: the exact tripwire string `Toggle free tier (dev)` in one `import.meta.env.DEV` branch for the dist-grep check, a live end-to-end seam (toggle → override → refresh → sidebar/palette/routes flip together), and a 792-test + 14/14-e2e green baseline.
- The interactive walkthrough items for the phase human-verify: ⌘K toggle → (a) pinned section hides + order reverts, (b) footer "Unlock Pro" appears/opens modal, (c) real Option+P ("π") opens the modal, (d) toggle back restores instantly.

---
*Phase: 18-entitlements-seam-central-gate*
*Completed: 2026-06-10*

## Self-Check: PASSED

All created/modified files exist on disk; all 3 task commits (a86b5ce5, d8c7453c, 0d4dcedb) present in git log; full suite 792/792 + 14/14 e2e green at completion.
