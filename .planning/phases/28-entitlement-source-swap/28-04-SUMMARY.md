---
phase: 28-entitlement-source-swap
plan: 04
subsystem: ui
tags: [ui, upsell, storekit, routing, buy, restore, tree-shaking]

# Dependency graph
requires:
  - phase: 28-entitlement-source-swap
    plan: 01
    provides: baseFromStoreKit arm in resolveEntitlements (refreshEntitlements re-runs it; the gate authority the Buy/Restore handlers refresh, never grant)
  - phase: 28-entitlement-source-swap
    plan: 02
    provides: refreshEntitlements re-read path + the store boot listener (the redundant live-flip path the Buy/Restore foreground refresh complements)
  - phase: 26-storekit-bridge-spike
    provides: platform.iap seam (products/purchase/restore/currentEntitlements); product id com.tinkerdev.app.pro
provides:
  - StoreUpsell — the StoreKit Buy + Restore upsell modal (pitch + Buy + always-available Restore; calm aria-live readout; copied UpsellModal a11y wrapper; zero Keygen activation form / key field)
  - storeOpenProUpsell — the store-build upsell router that sends EVERY not-Pro trigger to the StoreKit surface (no refreshNeeded/problem recovery split)
  - "Both are SEPARATE modules with NO Keygen-subtree imports, so Plan 05's static IS_APPSTORE switch tree-shakes them clean"
affects: [Plan-05-App-modal-mount, Plan-05-upsell-router-wiring, Plan-05-verify-script]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "StoreUpsell COPIES the UpsellModal a11y dialog wrapper (scrim + focus-trap + Esc + return-focus + aria-modal/aria-labelledby) rather than reusing the component, because UpsellModal's body hardcodes <UpsellPanel> (the Keygen ActivationSurface) — reusing it would re-pull the Keygen subtree and break the tree-shake (T-28-14)"
    - "Class constants COPIED verbatim (PITCH_CARD/GLOW/MEDALLION/TITLE/BODY + PRIMARY/SECONDARY button) as LOCAL constants — never imported from UpsellPanel/LicenseSettings"
    - "Buy success + Restore both call refreshEntitlements() DIRECTLY (belt-and-suspenders foreground unlock); the gate stays baseFromStoreKit-only — the UI never writes the entitlement set (T-28-15)"
    - "storeOpenProUpsell routes UNCONDITIONALLY to openUpsell (no license-state branch); the Keygen refreshNeeded/problem recovery path is absent from the store build (D-02/D-14/T-28-16)"

key-files:
  created:
    - src/components/StoreUpsell.tsx
    - src/components/StoreUpsell.test.tsx
    - src/shell/storeProUpsell.ts
    - src/shell/storeProUpsell.test.ts
  modified: []

key-decisions:
  - "UpsellModal wrapper COPIED, not reused: UpsellModal renders <UpsellPanel> in its body (the Keygen ActivationSurface), so the dialog scrim/focus-trap/Esc/return-focus/aria-modal/aria-labelledby markup was copied into StoreUpsell and the store pitch + Buy + Restore body rendered in its place (T-28-14)"
  - "Buy SUCCESS calls refreshEntitlements() directly THEN onClose() (Pro now unlocked behind the modal) — not sole reliance on the Plan-02 boot listener (a foreground purchase may emit no background event / race boot / hit a failed registration); the boot listener is KEPT for refunds/Ask-to-Buy/revokes (D-09/T-28-24)"
  - "No client-side grant: the modal only calls platform.iap.purchase/restore + refreshEntitlements; it never writes the entitlement set, so the unlock authority stays the StoreKit-fed baseFromStoreKit gate (fall-closed intact; T-28-15)"
  - "storeOpenProUpsell is UNCONDITIONAL (no getLicenseUiSnapshot branch) — the store build has no paying-customer recovery states (every not-Pro user is genuinely free), so the pitch is always correct (T-28-16)"
  - "Restore: a Restore that re-grants Pro (currentEntitlements non-empty) calls onClose() (live flip unlocks behind the modal); an empty Restore shows the calm 'No purchases found' line"
  - "Price block REPLACES the in-app price ('Lifetime Pro' + 'One-time purchase · price shown on the App Store') — NO price number in-app, D-12"

patterns-established:
  - "Named export StoreUpsell({ icon, onClose }) (Plan 05 mounts it in App.tsx behind IS_APPSTORE ? <StoreUpsell> : <UpsellModal>)"
  - "Named export storeOpenProUpsell(invokerEl?: HTMLElement | null) — same signature as openProUpsell so Plan 05 switches via IS_APPSTORE ? storeOpenProUpsell : openProUpsell"

requirements-completed: [MAS-IAP-07]

# Metrics
duration: ~5min
completed: 2026-06-23
---

# Phase 28 Plan 04: Store Upsell Modal + Store Upsell Router Summary

**The store-build upsell surfaces landed as SEPARATE tree-shakeable modules: `StoreUpsell` (the StoreKit Buy + always-available Restore modal that replaces the Keygen `UpsellModal` activation form — copied a11y dialog wrapper, store pitch, calm aria-live readout, zero key field) and `storeOpenProUpsell` (the store router that sends EVERY not-Pro trigger to the StoreKit surface unconditionally — no Keygen refreshNeeded/problem recovery split). Buy success AND Restore both call `refreshEntitlements()` directly (belt-and-suspenders foreground unlock) while granting NOTHING client-side — the gate stays `baseFromStoreKit`-only.**

## Performance

- **Duration:** ~5 min
- **Tasks:** 2 (both TDD)
- **Files:** 4 created, 0 modified

## Accomplishments

- **Task 1 — `StoreUpsell` (8 tests).** A dialog wrapper COPIED from `UpsellModal` (scrim + focus-trap + Esc→onClose + return-focus-to-`getUpsellInvoker()` + `aria-modal` + `aria-labelledby` the pitch heading id) around a store pitch + Buy + Restore body. The pitch chrome (`PITCH_CARD_CLASS` glow card + `MEDALLION_CLASS` medallion + `PITCH_TITLE_CLASS` heading "Thank you for using TinkerDev ❤️" + the 4-feature accent-soft list) is copied verbatim; the Command-Palette feature sub uses "Jump to any tool from the Command Palette — no mouse." (never "⌘K"). The price block REPLACES the in-app price with "Lifetime Pro" + "One-time purchase · price shown on the App Store" (NO number, D-12); the CTA row is `PRIMARY_BTN_CLASS` "Buy Pro — Lifetime" + `SECONDARY_BTN_CLASS` "Restore Purchases"; the claims footer is "One-time payment · Lifetime · Managed by the App Store". Buy maps `IapPurchaseResult.state`: `success` → `await refreshEntitlements()` directly + `onClose()` (Pro unlocked behind the modal); `userCancelled` → "Purchase cancelled."; `pending` → the calm pending-approval line; any reject → the calm "The App Store isn't available…" line (no refresh, never a thrown error / red banner). Restore → `restore()` then `refreshEntitlements()` then a `currentEntitlements()` read → `onClose()` when non-empty, else "No purchases found for this Apple ID." ONE `aria-live="polite" role="status"` readout region. Class constants COPIED as locals (no import from `UpsellPanel`/`LicenseSettings`/`@tauri-apps` — tree-shake).
- **Task 2 — `storeOpenProUpsell` (3 tests).** The store-build sibling of `proUpsell.ts`: `storeOpenProUpsell(invokerEl?)` routes UNCONDITIONALLY to `openUpsell(invokerEl)` — no license-state branch (the store build has no Keygen recovery surface). Forwards the invoker verbatim (return-focus contract). Imports ONLY `openUpsell` — never `getLicenseUiSnapshot`/`openSettings` (the recovery path). Signature matches `openProUpsell` so Plan 05 selects between them with `IS_APPSTORE ? storeOpenProUpsell : openProUpsell`.

## Task Commits

1. **Task 1: StoreUpsell — pitch + Buy + Restore modal (TDD)** — `5eca3ede` (feat)
2. **Task 2: storeProUpsell — every not-Pro trigger → StoreKit upsell (TDD)** — `40fb52bf` (feat)

_TDD: tests + implementation landed together per commit (lefthook rejects failing-test commits — memory `tdd-red-commits-blocked-by-lefthook`)._

## Output-Mandated Records (from PLAN `<output>`)

1. **Plan-05 wiring:** the modal mount in `App.tsx` switches `IS_APPSTORE ? <StoreUpsell icon=… onClose=…> : <UpsellModal icon=… onClose=…>`; the three `openProUpsell` consumers (`CommandPalette.tsx`, `AppearanceSettings.tsx`, `Sidebar.tsx`) switch to `storeOpenProUpsell` via the static gate (`IS_APPSTORE ? storeOpenProUpsell : openProUpsell`).
2. **Exact export signatures:** `export function StoreUpsell({ icon, onClose }: StoreUpsellProps)` where `StoreUpsellProps = { icon: ComponentType<{ className?: string }>; onClose: () => void }`; `export function storeOpenProUpsell(invokerEl?: HTMLElement | null): void` (one optional arg, identical to `openProUpsell`).
3. **UpsellModal wrapper reused or copied?** COPIED. `UpsellModal`'s body hardcodes `<UpsellPanel>` (the Keygen `ActivationSurface`), so reusing the component directly would re-pull the Keygen subtree (T-28-14). The dialog wrapper markup/effect (scrim + focus-trap + Esc + return-focus + `aria-modal` + `aria-labelledby`) was copied into `StoreUpsell` and the store body rendered in its place.
4. **Belt-and-suspenders:** Buy SUCCESS calls `refreshEntitlements()` DIRECTLY (then `onClose()`), so the Plan-02 boot listener is a REDUNDANCY (refunds / Ask-to-Buy / revokes), NOT the sole foreground unlock path (T-28-24).

## Deviations from Plan

### Acceptance-grep / tripwire rewords (Rule 1, Phase-18/26/27/28-02/28-03 precedent — no behavior change)

The plan's acceptance criteria + Task-2 Test 3 are tripwire greps on Keygen LITERALS. The descriptive doc-comments in both new files mentioned those literals while explaining what is OMITTED — so the tripwires matched prose, not live code. Reworded the doc-comments (no code/behavior change):

- **StoreUpsell.tsx** — `"⌘K"` in a comment → "the command-key glyph"; `"$9"` (`Keygen $9 block`) → "the Keygen in-app price block". The Keygen-literal tripwire `grep -Ec 'license\.tinkerdev\.io|BUY_LICENSE_URL|\$9|⌘K|I have a license key|Activate'` now returns 0; the real heading/button labels + price copy are unchanged.
- **storeProUpsell.ts** — the doc-comment naming `getLicenseUiSnapshot`/`openSettings`/`refreshNeeded`/`problem` (while explaining the absent recovery branch) → "Keygen license-snapshot / settings-route recovery path" + "lapsed/attention". The tripwire `grep -Ec 'getLicenseUiSnapshot|openSettings|refreshNeeded|problem'` now returns 0; the real import (`openUpsell` only) is unchanged.

### Task-2 Test 3 shape change (Rule 3 — blocking; tsc/env)

The plan's Test 3 reads the module source via `node:fs`/`node:url` to grep for the Keygen recovery imports. `node:fs`/`node:url` have no type declarations in this project's tsconfig (`tsc --noEmit` errored TS2307) and a filesystem read is the wrong layer for a unit test. Replaced with a BEHAVIORAL assertion of the same property: mock `./settingsStore` (`openSettings`) + `@/lib/license/licenseUi` (`getLicenseUiSnapshot`) and assert that driving `storeOpenProUpsell` (with and without an invoker) calls `openUpsell` twice and NEVER touches `openSettings` or the license snapshot. The source-level import-purity assertion is still covered by the acceptance grep (`grep -Ec 'getLicenseUiSnapshot|openSettings…' = 0`). Stronger at the unit layer: it proves the recovery surface is never invoked for any not-Pro trigger, not merely that a string is absent.

## Verification

- `pnpm vitest run src/components/StoreUpsell.test.tsx src/shell/storeProUpsell.test.ts` — **11/11 green** (8 StoreUpsell + 3 storeProUpsell). Full lefthook on both commits: **vitest 1254/1254** (+11, was 1243), tsc clean, eslint 1 pre-existing fixable warning (out of scope).
- All Task-1 acceptance greps pass: `Thank you for using TinkerDev`=1, `Buy Pro — Lifetime`=1, `Restore Purchases`=1, `One-time payment · Lifetime · Managed by the App Store`=1, `refreshEntitlements`=7 (≥2 — Buy success AND Restore), client-grant tripwire=0, Keygen-literals=0, forbidden-imports=0.
- All Task-2 acceptance greps pass: `openUpsell`=3 (≥1), Keygen-recovery tripwire=0; signature is one optional `HTMLElement | null` arg (matches `openProUpsell`).
- decoder.ts + its 19 tests byte-for-byte untouched (`git diff --stat src/lib/protobuf/` empty across both commits).
- `/simplify` + `/code-review xhigh` + `/codex:adversarial-review` + real-WKWebView e2e + `gsd-ui-review` were NOT auto-run by the executor — run at the Phase-28 boundary per the binding harness.

## Flag for Plan 05

- **Wiring:** mount the modal in `App.tsx` behind `IS_APPSTORE ? <StoreUpsell> : <UpsellModal>` (both take `{ icon, onClose }`); switch the three `openProUpsell` consumers (`CommandPalette`/`AppearanceSettings`/`Sidebar`) to `storeOpenProUpsell` behind the static gate. The store components must REPLACE (not coexist with) `UpsellModal`/`openProUpsell` in the appstore branch so the Keygen activation + recovery subtree is statically unreachable.
- **Bundle-purity grep:** Plan 05's `verify-appstore-bundle.sh` forbidden-string grep (`license.tinkerdev.io`, `BUY_LICENSE_URL`, `$9`, key-field markers, `I have a license key`, `Activate`) depends on this tree-shake. `StoreUpsell` imports NEITHER `UpsellPanel`/`LicenseSettings` NOR `@tauri-apps/*`; `storeProUpsell` imports ONLY `openUpsell` (grep-asserted at the source level here); the SIGNED-bundle grep is the final structural gate.
- **Human sandbox gate (WebDriver-impossible):** the live upsell-trigger → Buy → Pro-flip + Restore round-trip is the human sandbox walkthrough — WebDriver cannot drive StoreKit. This plan unit-tested the pure handler wiring (purchase/restore called with the right args; refreshEntitlements called on success + restore; onClose on success; calm readout on every arm; unconditional store routing).

## Known Stubs

None. The Buy/Restore handlers are fully wired to the `platform.iap` seam; in jsdom/browser the seam's no-op arm resolves/rejects deterministically (caught as the calm readout line) — correct, non-Tauri environments have no StoreKit.

## Self-Check: PASSED

- FOUND: src/components/StoreUpsell.tsx
- FOUND: src/components/StoreUpsell.test.tsx
- FOUND: src/shell/storeProUpsell.ts
- FOUND: src/shell/storeProUpsell.test.ts
- FOUND commit: 5eca3ede
- FOUND commit: 40fb52bf

---
*Phase: 28-entitlement-source-swap*
*Completed: 2026-06-23*
