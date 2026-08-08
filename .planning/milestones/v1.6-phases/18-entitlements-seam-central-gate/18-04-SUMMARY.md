---
phase: 18-entitlements-seam-central-gate
plan: 04
subsystem: licensing
tags: [entitlements, e2e, wkwebview, dist-grep, docs-reconciliation, upsell-copy, phase-gate]

# Dependency graph
requires:
  - phase: 18-entitlements-seam-central-gate
    plan: 02
    provides: lazified registry + ToolRoute element gate (the identical-behavior claim this plan re-proves on the real runtime)
  - phase: 18-entitlements-seam-central-gate
    plan: 03
    provides: sidebar/palette lock surfaces + the DEV-only "Toggle free tier (dev)" command (the e2e driver and the dist-grep tripwire string)
provides:
  - "test/e2e/entitlements.e2e.ts — real-WKWebView proof of the full locked UX loop: dev toggle → D-26 registry-default render (no pinned group) → D-29 footer row → D-28 locked Alt+P (π/KeyP) opens the upsell dialog → Escape → toggle back restores the preserved arrangement (T-18-15 cleanup in finally)"
  - "scripts/check-dev-strip.sh — repeatable D-32 dist-grep production check (fails if 'Toggle free tier' reaches dist/assets); reused at the Phase 21 flip gate"
  - "Docs reconciled to D-18: REQUIREMENTS.md, ROADMAP.md, PROJECT.md, docs/licensing-research.md no longer claim the decoder is locked in free tier"
  - "Final user-approved upsell copy: static 'Thank you for using TinkerDev ❤️' heading + trimmed two-paragraph body, no pricing (D-20), no Unlocks meta line (D-19 overridden)"
  - "Palette DEV commands searchable by typed query (subsequence rule, always after tool matches) — the real user path, e2e-driven"
  - "Phase 18 human sign-off: fresh tauri build, packaged app everything-unlocked and visually unchanged (criteria 3+4)"
affects: [19 (UpsellPanel CTA wiring), 21 (free-tier flip + check-dev-strip at the ship gate)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Phase-flip gate checks live as repeatable scripts (check-dev-strip.sh), not one-off shell history"
    - "e2e specs drive the REAL user path (typed palette query + keyboard), never a workaround path that can mask a product bug"
    - "Upsell lock context comes from the affordance the user invoked, not from panel copy (D-19 override)"

key-files:
  created:
    - test/e2e/entitlements.e2e.ts
    - scripts/check-dev-strip.sh
    - src/components/CommandPalette.prod.test.tsx
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/PROJECT.md
    - docs/licensing-research.md
    - src/components/UpsellPanel.tsx
    - src/components/CommandPalette.tsx
    - src/components/Sidebar.tsx
    - src/components/ToolRoute.tsx
    - .planning/phases/18-entitlements-seam-central-gate/18-UI-SPEC.md

key-decisions:
  - "Final upsell copy (user-approved verbatim at the walkthrough): static 'Thank you for using TinkerDev ❤️' heading + trimmed two-paragraph supportive body; no pricing (D-20 held)"
  - "D-19 OVERRIDDEN by user at walkthrough: the 'Unlocks: {feature}' meta line dropped — lock context comes from the affordance the user clicked; render-unused feature prop removed from UpsellPanel/UpsellModal and callers"
  - "Palette dev-command searchability fixed (walkthrough gap): typed queries now match DEV command names via the same subsequence rule, always AFTER tool matches (D-32 ordering); the prior e2e passed only via an ArrowUp-wrap workaround — a false positive the rewritten e2e (typed query + keyboard) can no longer give"
  - "check-dev-strip.sh hardened beyond plan spec: fails on missing dist/assets or grep error, not just on a tripwire hit"

patterns-established:
  - "PROD-simulation unit test recipe: re-import the module graph with import.meta.env.DEV stubbed false to prove DEV-only code is absent (CommandPalette.prod.test.tsx)"

requirements-completed: [ENT-03, ENT-04, ENT-05]

# Metrics
duration: ~80min active (across a human-verify checkpoint, 16:00-22:40 wall)
completed: 2026-06-10
---

# Phase 18 Plan 04: Phase Gate & Re-Proof Summary

**Phase 18 closed on the real runtime and the real bundle: a new entitlements e2e proves the full locked-UX loop (dev toggle → D-26 default order/no pinned group → D-29 footer → D-28 upsell dialog → restore) on the actual WKWebView with all 15 spec files green, `check-dev-strip.sh` proves "Toggle free tier" never reaches dist/assets (D-32), every source-of-truth doc now states the D-18 pivot (all 11 tools free; Pro = theming + ordering/pinning, mechanism dormant), and the human walkthrough approved a fresh `tauri build` as everything-unlocked and visually unchanged — after three walkthrough-feedback commits landed the final TinkerDev thank-you upsell copy and made the palette dev command searchable.**

## Performance

- **Duration:** ~80 min active (wall 16:00–22:40, spanning the human-verify checkpoint)
- **Started:** 2026-06-10T15:15:00Z (approx, after 18-03 close)
- **Completed:** 2026-06-10T21:40:00Z (final feedback commit; approval received after)
- **Tasks:** 3/3 (2 auto + 1 human-verify checkpoint, approved)
- **Files modified:** 14 unique (3 created)

## Accomplishments

- **D-18 doc reconciliation (Task 1):** REQUIREMENTS.md milestone goal + ENT-04, ROADMAP.md v1.6 intro + Phase 18 criterion 1 + Phase 21 criterion 5, PROJECT.md goal/requirement/footer lines, and the licensing-research "Free tier locks" decision row all reworded to the pivot — no doc still claims the decoder (or any tool) locks in free tier; Phase 21's flip inherits correct scope.
- **Real-WKWebView entitlements e2e (Task 2):** seeds a custom order + pinned tool through the UI, runs the DEV palette toggle, asserts registry-default render with no pinned group/divider, the "Unlock Pro" footer, locked Alt+P (composed `key:"π"` / `code:"KeyP"`) opening the upsell `role="dialog"`, Escape dismissal, and toggle-back restoring the untouched arrangement (D-26 prefs preservation = T-18-15 mitigation, cleanup in `finally`).
- **Full-suite re-proof (criterion 4):** e2e **15/15 spec files** green (14 pre-existing unchanged + entitlements) — the lazified app is behavior-identical; `decoder.ts` + its 19 tests zero diff.
- **D-32 dist-grep check:** `scripts/check-dev-strip.sh` exits non-zero if "Toggle free tier" appears in any production chunk; proven 0 against a fresh `pnpm build`; the script is the reusable Phase 21 flip-gate artifact (T-18-13 mitigation).
- **Phase-boundary build + sign-off (Task 3):** agent-run `pnpm tauri build`, human walkthrough confirmed the packaged app is everything-unlocked with the lock UI correctly dormant (no badges, no footer row, dev command absent from ⌘K) and shipped behavior unchanged (T-18-14: the pre-licensing baseline explicitly certified). User typed "approved".
- **Walkthrough feedback landed before approval (3 commits):** final supportive upsell copy, palette dev-command searchability (closing an e2e false-positive gap), and the D-19 Unlocks-line override with feature-prop cleanup. Suite grew 792 → **795** unit tests; tsc + lint clean throughout.

## Task Commits

1. **Task 1: D-18 documentation reconciliation** - `f64e0f54` (docs)
2. **Task 2: entitlements e2e + full e2e re-proof + dist-grep check** - `7e27cad7` (test)
3. **Task 3: phase-boundary build + human walkthrough** - no source commit (checkpoint); walkthrough-feedback commits below landed before approval:
   - `577180ef` (feat) — soften upsell copy v1 (TinkerDev thank-you panel, no pricing)
   - `6d17468b` (fix) — palette dev command searchable by typed query (walkthrough gap)
   - `c1a35263` (feat) — final trimmed copy, drop Unlocks line (D-19 override), feature-prop cleanup

**Plan metadata:** docs commit (this SUMMARY + STATE + ROADMAP + REQUIREMENTS)

## Files Created/Modified

- `test/e2e/entitlements.e2e.ts` - real-WKWebView locked-UX loop proof (407 lines, sidebar.e2e.ts conventions: single-round-trip execute, composed-key dispatch, screenshots)
- `scripts/check-dev-strip.sh` - D-32 dist-grep check, executable, hardened error handling
- `src/components/CommandPalette.prod.test.tsx` - PROD-simulation proof: DEV command absent with `import.meta.env.DEV` stubbed false under a fresh module graph
- `src/components/CommandPalette.tsx` - buildGroups query path appends name-matching DEV commands after all tool matches
- `src/components/UpsellPanel.tsx` - final static heading + two-paragraph copy; `feature` prop removed (D-19 override)
- `src/components/Sidebar.tsx`, `src/components/ToolRoute.tsx` - feature-prop call-site cleanup
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/PROJECT.md`, `docs/licensing-research.md` - D-18 reconciliation
- `.planning/phases/18-entitlements-seam-central-gate/18-UI-SPEC.md` - copywriting contract reconciled to the approved copy + D-19 override recorded

## Decisions Made

- **Final upsell copy (user decision at walkthrough):** static "Thank you for using TinkerDev ❤️" heading + a trimmed two-paragraph supportive body, verbatim from the user; no pricing on the panel (D-20 held).
- **D-19 overridden (user decision):** the "Unlocks: {feature}" meta line removed — the user judged the lock context self-evident from the affordance invoked; the now-render-unused `feature` prop was deleted from UpsellPanel/UpsellModal and all callers (heading/`aria-labelledby` wiring intact).
- **Palette searchability fix doubles as harness honesty:** the original e2e drove the toggle via ArrowUp-wrap on an empty query because a typed query filtered commands out — a workaround that masked the product gap. The fix makes typed queries match DEV command names (same subsequence rule, always ranked after tools per D-32), and `runDevToggle` now drives the real typed-query path so the false positive cannot recur.

## Deviations from Plan

All three deviations arose from the Task 3 walkthrough (checkpoint feedback), were fixed inline before approval, and passed the full per-task harness (simplify → codex review → unit/tsc/lint → real-WKWebView e2e):

**1. [Checkpoint feedback - copy] Upsell copy softened to a supportive thank-you panel**
- **Found during:** Task 3 walkthrough
- **Issue:** planned upsell copy read too sales-forward for the user's intent
- **Fix:** static TinkerDev thank-you heading + supportive body (v1), then final trimmed two-paragraph copy approved verbatim
- **Files modified:** UpsellPanel.tsx + tests, e2e modal detection, 18-UI-SPEC.md
- **Commits:** `577180ef`, `c1a35263`

**2. [Rule 1 - Bug] Palette DEV command unreachable by typed query**
- **Found during:** Task 3 walkthrough (user typed "toggle" and got "No tools match")
- **Issue:** buildGroups appended DEV commands on the empty query only; any typed query filtered them out — and the original e2e had codified the workaround (ArrowUp wrap), giving a false positive on the real user path
- **Fix:** query path appends DEV commands whose name matches the tool subsequence rule, after all tool matches; PROD-simulation test proves tree-shaking intact; e2e rewritten to the real typed-query path
- **Files modified:** CommandPalette.tsx/.test.tsx, CommandPalette.prod.test.tsx (new), entitlements.e2e.ts
- **Commit:** `6d17468b`

**3. [User decision - D-19 override] "Unlocks: {feature}" meta line dropped**
- **Found during:** Task 3 walkthrough (final copy review)
- **Issue:** user judged the meta line redundant — lock context comes from the clicked affordance
- **Fix:** line removed; render-unused `feature` prop deleted from UpsellPanel/UpsellModal + callers; D-19 override recorded in 18-UI-SPEC.md
- **Files modified:** UpsellPanel.tsx, Sidebar.tsx, ToolRoute.tsx + tests, e2e
- **Commit:** `c1a35263`

---

**Total deviations:** 3 (1 bug auto-fixed, 2 user copy/design decisions at the checkpoint)
**Impact on plan:** no scope creep — all changes confined to the upsell surface + palette search already in phase scope; the bug fix closed a real e2e blind spot.

## Harness Gates

- simplify + `codex review` per commit: findings addressed (feature-prop cleanup itself came out of the final pass)
- Unit: **795/795** (`vitest`), `tsc --noEmit` clean, `pnpm lint` clean
- Real-WKWebView: **15/15 e2e spec files** green via `scripts/e2e-spike.sh`
- `pnpm build && ./scripts/check-dev-strip.sh` → OK (dev toggle absent from dist/assets)
- Phase boundary: fresh `pnpm tauri build` (.app under `src-tauri/target/release/bundle/macos/`), human walkthrough steps confirmed, locked UX + final copy validated in dev, gsd-ui-review WCAG-AA audit passing — **user approved**

## Known Stubs

Plan 01's two intentional UpsellPanel stubs are unchanged and remain tracked in 18-01-SUMMARY: the "Buy a license" CTA (BUY_LICENSE_URL placeholder → Phase 20) and the "Enter license key" button (no-op → Phase 19). Both are the declared wiring points for those phases, not omissions.

## Threat Flags

None — no new network endpoints, auth paths, file access, or schema changes. Plan threats closed: T-18-13 (check-dev-strip.sh in repo, run green at this gate), T-18-14 (docs reconciled + walkthrough explicitly certified the unlocked default as the PRE-licensing baseline), T-18-15 (e2e restores the full tier in `finally` and asserts restoration).

## Issues Encountered

- The walkthrough surfaced that the prior e2e's empty-query ArrowUp-wrap workaround had masked the palette-search gap — resolved by fixing the product path and rewriting the e2e to drive it (see Deviation 2).

## User Setup Required

None.

## Next Phase Readiness

- **Phase 18 COMPLETE** — all 4 plans executed, criteria 1–4 demonstrated, human sign-off recorded.
- Phase 19 (License Activation) inherits: `resolveEntitlements()` as THE single flip point, the UpsellPanel "Enter license key" stub to wire, and the entitlements e2e as a regression net.
- Phase 21 inherits: `scripts/check-dev-strip.sh` for the flip gate, and docs that now correctly scope the flip (theming + ordering/pinning only — all tools stay free).
- Open carry-forward (18-03, non-blocking): stale-hook whole-blob prefs writes can clobber the persisted dev override (`deferred-items.md`) — the Plan 04 e2e showed no flakiness, so it stays deferred to Phase 21.

---
*Phase: 18-entitlements-seam-central-gate*
*Completed: 2026-06-10*

## Self-Check: PASSED

All artifact files exist on disk (entitlements.e2e.ts, check-dev-strip.sh executable, CommandPalette.prod.test.tsx); all 5 plan commits (f64e0f54, 7e27cad7, 577180ef, 6d17468b, c1a35263) present in git log; unit suite re-run at finalization: 795/795 green.
