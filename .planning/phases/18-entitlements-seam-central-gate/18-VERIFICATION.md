---
phase: 18-entitlements-seam-central-gate
verified: 2026-06-10T23:00:00Z
status: passed
score: 15/15 must-haves verified
overrides_applied: 1
overrides:
  - must_have: "UpsellPanel renders the feature heading, the 'Buy license' CTA (stub URL constant), and the inert 'I have a license key' affordance, WCAG-AA (D-19..D-22)"
    reason: "D-19 overridden by user at the phase walkthrough: the per-feature heading/'Unlocks:' line was dropped in favor of a static 'Thank you for using TinkerDev ❤️' heading + trimmed two-paragraph body; the render-unused feature prop was removed from UpsellPanel/UpsellModal and all callers. CTA stub, license-key affordance, and WCAG-AA modal semantics all intact. Recorded in 18-04-SUMMARY.md and 18-UI-SPEC.md."
    accepted_by: "user (walkthrough)"
    accepted_at: "2026-06-10T21:40:00Z"
human_verification_completed:
  - test: "Packaged-app walkthrough (pnpm tauri build): everything unlocked, no lock UI, dev command absent from ⌘K, arrangement persists across restart, decoder paste-instant, gsd-ui-review WCAG-AA audit"
    result: "Approved by user 2026-06-10 (18-04 Task 3 checkpoint); locked UX + final upsell copy validated in dev"
---

# Phase 18: Entitlements Seam & Central Gate Verification Report

**Phase Goal:** Feature gating exists as one central, testable seam — tools and app-level features resolve entitlements through a single gate, locked features stay visible-but-locked, and the registry is lazified — while the in-Tauri default keeps everything unlocked until licensing lands (flipped at Phase 21).
**Verified:** 2026-06-10T23:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | (SC1) Fixture-locked tool stays visible in sidebar + ⌘K palette with neutral lock badge; opening it shows a WCAG-AA upsell panel in place of the tool UI | ✓ VERIFIED | `Sidebar.tsx:547` `isToolLocked(tool, ents)` + sr-only "— locked" (:626); `CommandPalette.tsx:272,301` same predicate + suffix; `ToolRoute.tsx:26-31` locked branch renders UpsellPanel; `Sidebar.locked.test.tsx` / `CommandPalette.locked.test.tsx` fixture proofs exist; modal has aria-modal + labelledby + focus trap (UpsellPanel.tsx:88-164) |
| 2  | (SC2) Theming + ordering/pinning gate through ONE app-level entitlement map; flipping the set locks/unlocks with no scattered checks | ✓ VERIFIED | `entitlements.ts` ENT_THEMING/ENT_ORDERING vocabulary + `gatePreferences`; `Sidebar.tsx:68-69` single `ents.has(ENT_ORDERING)` read feeding 11 `orderingUnlocked` uses; dev toggle → `savePreferences` + `refreshEntitlements()` flips all `useEntitlements` consumers (CommandPalette.tsx:58-72) |
| 3  | (SC3) React consumes only a resolved entitlement set; in-Tauri default = everything unlocked (shipped behavior unchanged); browser/jsdom = deterministic FREE | ✓ VERIFIED | `resolve.ts:19-23` single flip point with Phase-21 comment; `store.ts` snapshot + setsEqual short-circuit; `useEntitlements.ts` useSyncExternalStore; `main.tsx:40` startup kick-off; resolve.test.ts 8 tests green; packaged-app walkthrough approved unlocked |
| 4  | (SC4) All 11 registry entries lazy, app behaves identically, decoder.ts + 19 tests byte-for-byte untouched | ✓ VERIFIED | `grep -L 'component: () => import('` over src/tools/*/index.ts → 0 missing; decoder last touched commit `90583b79` (Phase 1); decoder.test.ts 19 tests green in this verification run; e2e 15/15 spec files (summary + human approval); dist: 22 chunks, decoder string in exactly `ProtobufDecoder-gqwHkcqS.js` |
| 5  | Browser→FREE / Tauri→FULL environment split resolution | ✓ VERIFIED | resolve.ts:20 `isTauriEnv() ? FULL_SET : FREE_SET`; resolve.test.ts green |
| 6  | entitlementsOverride is downgrade-only (D-31); no stored value can upgrade | ✓ VERIFIED | `prefsStore.ts:124` coercer accepts only "free"; resolve.ts:22 only branch is `=== "free" → FREE_SET` |
| 7  | gatePreferences yields defaults/empty arrays under FREE without mutating input (D-26/D-27) | ✓ VERIFIED | entitlements.ts:36-44 pure spread view; entitlements.test.ts green |
| 8  | UpsellPanel renders heading + "Buy license" CTA stub + inert "I have a license key", WCAG-AA | ✓ PASSED (override) | D-19 user override: static "Thank you for using TinkerDev ❤️" heading, feature prop removed; BUY_LICENSE_URL stub + both buttons present (UpsellPanel.tsx:21,64,71); accepted by user 2026-06-10 |
| 9  | Locked tool's route renders upsell WITHOUT invoking the lazy loader (no chunk fetch) | ✓ VERIFIED | ToolRoute.tsx:26 lock check before `lazyToolComponent`; ToolRoute.test.tsx 0-calls loader spy, 5 tests green |
| 10 | Entitlement flip swaps upsell↔tool on a mounted route (element-level gate) | ✓ VERIFIED | router.tsx:41 `element: <ToolRoute tool={tool} />` (route-level lazy deliberately absent); reactive-flip test green |
| 11 | Under FREE: sidebar renders registry-default order, pinned section hidden, stored prefs untouched, unlock restores instantly (D-26) | ✓ VERIFIED | Sidebar.tsx:69 gated partition inputs; store-set-spy tests in Sidebar.test.tsx; e2e asserts toggle-back restoration |
| 12 | Under FREE: every reorder/pin affordance (pin click, Alt+↑/↓, Alt+P via e.code KeyP, drag, reset) opens the shared UpsellModal instead of writing prefs (D-28) | ✓ VERIFIED | 11 `orderingUnlocked` occurrences guard write sites; UpsellModal rendered at Sidebar.tsx:819; e2e dispatches composed `key:"π"`/`code:"KeyP"` |
| 13 | Quiet keyboard-reachable "Unlock Pro" footer row in free tier only, opens the modal (D-29) | ✓ VERIFIED | Sidebar.tsx:759-766 conditional on `!ents.has(ENT_ORDERING) \|\| !ents.has(ENT_THEMING)`, focus-visible ring |
| 14 | DEV-only "Toggle free tier (dev)" palette command flips all surfaces live; verifiably absent from production bundle (D-31/D-32) | ✓ VERIFIED | CommandPalette.tsx:58 `import.meta.env.DEV` const; CommandPalette.prod.test.tsx tree-shake proof green; `./scripts/check-dev-strip.sh` re-run during verification → exit 0 against existing dist; command searchable by typed query (walkthrough fix `6d17468b`) |
| 15 | e2e on real WKWebView proves the locked-UX loop; docs reconciled to D-18; human sign-off on packaged build | ✓ VERIFIED | test/e2e/entitlements.e2e.ts exists (15 spec files total); `grep "locks the Protobuf"` clean across REQUIREMENTS/ROADMAP/PROJECT, D-18 present in REQUIREMENTS + licensing-research; .app present under src-tauri/target/release/bundle/macos/; user approved 2026-06-10 |

**Score:** 15/15 truths verified (1 via user-accepted override)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/entitlements/entitlements.ts` | Vocabulary + isEntitled/isToolLocked/gatePreferences | ✓ VERIFIED | All exports present; consumed by Sidebar, CommandPalette, ToolRoute |
| `src/lib/entitlements/resolve.ts` | Single env-split resolution point | ✓ VERIFIED | Phase-21 flip comment present; consumed by store.ts |
| `src/lib/entitlements/store.ts` | Snapshot store + guarded test seams | ✓ VERIFIED | MODE/DEV guard at :53-56; setsEqual short-circuit; wired to main.tsx + useEntitlements + CommandPalette |
| `src/shell/useEntitlements.ts` | React hook | ✓ VERIFIED | useSyncExternalStore; consumed by Sidebar, CommandPalette, ToolRoute |
| `src/components/UpsellPanel.tsx` | Shared panel + modal + BUY_LICENSE_URL | ✓ VERIFIED | Final D-19-overridden layout; focus trap; 2 plan-intentional stubs (CTA→Phase 20, key button→Phase 19) |
| `src/components/ToolRoute.tsx` | Element-level gate + module-cached lazy | ✓ VERIFIED | lazyCache Map; lock check before loader |
| `src/router.tsx` | Routes derive from ENABLED_TOOLS via ToolRoute | ✓ VERIFIED | renderTool/`as ComponentType` gone |
| `src/tools/*/index.ts` (11) | Lazy loaders | ✓ VERIFIED | 0 files missing the lazy form; 0 eager component imports remain |
| `src/components/Sidebar.tsx` | Gated partition + lock branches + footer + badge | ✓ VERIFIED | All four anchors present (see truths 11-13) |
| `src/components/CommandPalette.tsx` | Row union + badge + DEV toggle | ✓ VERIFIED | Discriminated union, exact tripwire string under DEV |
| `test/e2e/entitlements.e2e.ts` | Real-WKWebView locked-UX proof | ✓ VERIFIED | Contains Toggle free tier / Unlock Pro / role=dialog / code:"KeyP" dispatch |
| `scripts/check-dev-strip.sh` | D-32 dist-grep check | ✓ VERIFIED | Executable (-rwxr-xr-x); ran green during this verification |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| resolve.ts | prefsStore.ts | `await loadPreferences()` | ✓ WIRED | resolve.ts:21 (gsd-tools pattern miss was a regex-escaping false negative — verified manually) |
| useEntitlements.ts | store.ts | useSyncExternalStore | ✓ WIRED | tool-verified |
| main.tsx | store.ts | startup refreshEntitlements() | ✓ WIRED | main.tsx:40 |
| router.tsx | ToolRoute.tsx | element per ENABLED_TOOLS entry | ✓ WIRED | router.tsx:41 |
| ToolRoute.tsx | entitlements.ts / UpsellPanel.tsx | isToolLocked → locked branch | ✓ WIRED | (feature prop dropped per D-19 override; icon/headingId wiring intact) |
| Sidebar.tsx | entitlements.ts / UpsellPanel.tsx | ENT_ORDERING gate; UpsellModal | ✓ WIRED | tool-verified |
| CommandPalette.tsx | store.ts | DEV toggle → savePreferences + refreshEntitlements | ✓ WIRED | CommandPalette.tsx:69-72 |
| entitlements.e2e.ts | DEV toggle | typed palette query path | ✓ WIRED | real-path query (false-positive workaround removed, `6d17468b`) |
| check-dev-strip.sh | dist/assets | grep -R post-build | ✓ WIRED | ran green |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Entitlements module + gate + decoder tests | `pnpm vitest run src/lib/entitlements/ ToolRoute UpsellPanel CommandPalette.prod decoder.test` | 6 files, 57/57 passed (incl. the 19 decoder tests) | ✓ PASS |
| Typecheck | `pnpm tsc --noEmit` | exit 0 | ✓ PASS |
| D-32 dev-strip | `./scripts/check-dev-strip.sh` | "OK: dev toggle absent from dist/assets", exit 0 | ✓ PASS |
| Phase commits exist | gsd-tools verify commits (13 hashes) | all_valid: true | ✓ PASS |
| Dormancy: no shipped tool carries requiredEntitlements | grep registry + src/tools | 0 matches | ✓ PASS |
| Decoder isolation | grep decoder-unique literal across dist/assets | exactly one chunk (ProtobufDecoder-gqwHkcqS.js) of 22 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|-------------|--------|----------|
| ENT-01 | 18-01, 18-02, 18-03 | requiredEntitlements on ToolDefinition; gating derives from registry | ✓ SATISFIED | types.ts:50; isToolLocked consumed by all three surfaces; premium? deleted |
| ENT-02 | 18-01, 18-03 | App-level entitlement map gates theming + ordering/pinning | ✓ SATISFIED | ENT_THEMING/ENT_ORDERING + gatePreferences; Sidebar ordering gate live |
| ENT-03 | 18-01, 18-04 | One central gate; React receives only the resolved set | ✓ SATISFIED | resolve.ts single flip point; useEntitlements sole consumption path |
| ENT-04 | 18-01, 18-03, 18-04 | Free tier locks theming+ordering; tool-gating dormant; locked = visible, WCAG-AA | ✓ SATISFIED | Lock badges neutral tx-2, no opacity state; fixture dormancy proofs; e2e + human walkthrough |
| ENT-05 | 18-02, 18-04 | Lazy registry loaders; free-build decoder exclusion seam; decoder untouched | ✓ SATISFIED | 11/11 lazy; decoder isolated to one chunk; decoder last touched Phase 1 |

No orphaned requirements: REQUIREMENTS.md maps exactly ENT-01..ENT-05 to Phase 18, all claimed by plans and marked Complete.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/components/UpsellPanel.tsx | 21, 57-61, 66-72 | BUY_LICENSE_URL stub + no-op CTA; inert license-key button | ℹ️ Info | Plan-intentional (D-21/D-22) — declared wiring points for Phases 20 and 19; tracked in 18-01-SUMMARY |
| src/components/Sidebar.tsx | 495-499 | `unpinAll` not gated on `orderingUnlocked` (REVIEW WR-01, unfixed) | ⚠️ Warning (advisory) | Currently unreachable while locked (menu item hidden because pinned forced to []); render-condition guard, not write-site guard. Defense-in-depth gap, not a goal blocker — D-26 preservation holds today. Suggest fixing before Phase 21 flip |
| scripts/check-dev-strip.sh | 14 | Vacuous pass if dist/assets exists but has zero .js files (REVIEW WR-02, partially hardened — dir check exists, .js-count check does not) | ⚠️ Warning (advisory) | Reused at Phase 21 flip gate; recommend the find-based .js existence guard before then |

No TODO/FIXME/placeholder patterns in any phase-created source file.

### Human Verification Required

None outstanding. The phase-boundary human walkthrough (packaged `pnpm tauri build` — everything unlocked, no lock UI, dev command absent, arrangement persistence, decoder paste-instant, gsd-ui-review WCAG-AA audit) was completed and **approved by the user 2026-06-10**; locked UX + final upsell copy validated in dev at the same checkpoint.

### Gaps Summary

No gaps. All four ROADMAP success criteria and all plan must-haves verified against the actual codebase:

- The central seam is real and singular: one vocabulary, one resolver (with the Phase-21 flip comment), one store, one hook — all three surfaces consume only `isToolLocked`/`ents.has`, with zero scattered tier checks found.
- The lock UX is fully wired but dormant exactly as specified (D-18): no shipped tool carries `requiredEntitlements`, mechanism proven by fixture tests under FULL_SET.
- The lazy registry + decoder isolation make the free-build exclusion seam real (22 chunks, decoder string in exactly one), with decoder.ts untouched since Phase 1 and its 19 tests green in this verification run.
- One plan must-have (UpsellPanel feature heading) deviates from the original D-19 spec via a recorded user override at the walkthrough — counted as passed.
- Two advisory review warnings (WR-01 unpinAll guard, WR-02 dist-grep vacuous-pass hole) remain open; neither blocks this phase's goal, both worth addressing before the Phase 21 flip.

---

_Verified: 2026-06-10T23:00:00Z_
_Verifier: Claude (gsd-verifier)_
