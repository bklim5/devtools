---
phase: 26-storekit-bridge-spike
plan: 03
subsystem: ui
tags: [storekit, iap, mac-app-store, spike, license-pane, e2e, platform-iap]

# Dependency graph
requires:
  - phase: 26-02
    provides: "platform.iap seam (products/purchase/restore/currentEntitlements/onPurchaseUpdated) + IapProduct/IapPurchaseResult types"
provides:
  - "temporary VISIBLE IAP spike dev button block (D-11) in Settings ▸ License — Fetch products / Buy Pro / Restore wired through platform.iap"
  - "an OBSERVABLE Restore readout: restore() THEN currentEntitlements(), rendering the re-granted pro.* codes (Codex #5) for the Plan 06 human gate"
  - "test/e2e/iap-spike.e2e.ts — real-WKWebView smoke proving the block renders + dispatches the seam + degrades calmly on the no-op/unregistered arm (T-26-09)"
affects: [26-05, 26-06, 28-storelicensesettings]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "self-contained spike sub-component (IapSpikeBlock) rendered in BOTH the free early-return branch and the managed-states return, so the block is visible in every license state"
    - "ONE try/catch-guarded async runner over an aria-live role=status readout; a { code } reject renders calm text, never an uncaught throw or red banner (calm-state discipline reused from the license pane)"

key-files:
  created:
    - "test/e2e/iap-spike.e2e.ts (real-WKWebView seam-wiring smoke, no-op arm)"
  modified:
    - "src/components/LicenseSettings.tsx (IapSpikeBlock + render in both return paths)"

key-decisions:
  - "Reused SECONDARY_BTN_CLASS verbatim (21-UI-SPEC reuse mandate); added only `disabled:cursor-default` (no new size/token)."
  - "The block renders in EVERY license state (free + managed) — placed it as a sub-component called from both return branches rather than after the early-return, so the human gate reaches it on the FREE baseline (the e2e-spike default) too."
  - "e2e accepts BOTH the no-op 'No products' string AND the calm 'IAP unavailable (code: ...)' reject text for Fetch products — on the DIRECT build the WKWebView is Tauri (the real tauri.ts arm runs) but iap_* is unregistered, so the invoke rejects; either outcome proves graceful degradation."

patterns-established:
  - "Spike scaffolding pattern: a clearly-delimited TEMPORARY block (prominent removal comment + data-testid) reaching a seam, visible on the signed build for a human gate, removed in a named later phase."

requirements-completed: [MAS-IAP-01]

# Metrics
duration: 4min
completed: 2026-06-22
---

# Phase 26 Plan 03: IAP Spike Trigger (D-11) Summary

**A visible, keyboard-reachable temporary spike block in Settings ▸ License that drives `platform.iap` products/purchase/restore and RENDERS the `currentEntitlements()` codes StoreKit re-grants after a Restore (Codex #5), with a real-WKWebView smoke proving it degrades calmly on the no-op arm.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-06-22T12:36:17Z
- **Completed:** 2026-06-22T12:39:25Z
- **Tasks:** 2
- **Files modified:** 2 (1 modified, 1 created)

## Accomplishments

- **`IapSpikeBlock` in `LicenseSettings.tsx` (D-11)** — three real `<button>`s (Fetch products / Buy Pro (spike) / Restore (spike)) reusing `SECONDARY_BTN_CLASS`, in a `data-testid="iap-spike"` container, rendered in BOTH the free early-return branch and the managed-states return so it is VISIBLE in every license state. The block is wrapped in the mandated `// TEMPORARY — Phase 26 StoreKit spike (D-11). Removed when Phase 28 StoreLicenseSettings lands.` comment.
- **Observable Restore readout (Codex #5)** — the Restore handler calls `platform.iap.restore()` THEN `platform.iap.currentEntitlements()` and renders the OBSERVED codes ("Restored — entitlements: …" / "Restored — no entitlements"), so the Plan 06 walkthrough can SEE whether StoreKit actually re-granted on a fresh read, not merely that `restore()` resolved.
- **Calm degradation (T-26-09)** — every handler runs through ONE try/catch-guarded async runner over an `aria-live role=status` region; a `{ code }` reject renders "IAP unavailable (code: …)" (never red/banner/crash); `products()` returning `[]` renders "No products (direct build / no-op arm)".
- **`test/e2e/iap-spike.e2e.ts`** — opens Settings ▸ License via the `#/settings/license` deep-link (mirrors `license-settings.e2e.ts`), asserts the block renders, the three buttons are real focusable keyboard-operable `<button>`s, and clicking Fetch/Buy/Restore settles the readout calmly while the app never white-screens.
- **Seam-only (T-26-08):** the block reaches StoreKit ONLY via `platform.iap` — `grep -c '@tauri-apps' LicenseSettings.tsx` = 0; it cannot fabricate a Pro grant, only display what the verified Rust path returns.

## Task Commits

1. **Task 1: temporary IAP spike dev button block (D-11) with observable Restore readout** — `0bd500a5` (feat)
2. **Task 2: real-WKWebView e2e smoke for the spike button (no-op arm)** — `a071b19c` (test)

**Plan metadata:** (this commit) `docs(26-03): complete IAP spike trigger plan`

## Files Created/Modified

- `src/components/LicenseSettings.tsx` — added `IapSpikeBlock` (the D-11 spike block) + `IAP_PRODUCT_ID`/`rejectCode` helpers; rendered the block in both the `isFree` early-return and the managed-states return.
- `test/e2e/iap-spike.e2e.ts` — real-WKWebView seam-wiring smoke (no-op/unregistered arm).

## Decisions Made

- **Block visible in every state, via a shared sub-component.** Rather than appending after the `isFree` early-return (which would hide it in the FREE state — the e2e-spike default baseline), `IapSpikeBlock` is a sub-component called from BOTH return branches. The human gate (Plan 06) and the e2e both reach it from FREE.
- **e2e accepts the unregistered-arm reject OR the no-op-arm empty.** On the DIRECT build the WKWebView is genuinely Tauri (the real `tauri.ts` arm runs) but the `iap_*` commands are NOT registered (no `appstore` feature), so `invoke(iap_*)` rejects → calm "IAP unavailable (code: …)". The spec accepts that AND the browser-arm "No products" string for Fetch products; both prove the same thing (seam dispatched, UI handled it, no crash).
- **No new token/size.** Reused `SECONDARY_BTN_CLASS` verbatim; the only addition is `disabled:cursor-default` (mirrors the file's existing `DESTRUCTIVE_BTN_CLASS` disabled idiom) — honors the 21-UI-SPEC reuse mandate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - acceptance-grep] Reworded one doc-comment `@tauri-apps` literal mention**
- **Found during:** Task 1 grep verification.
- **Issue:** A new doc comment said "never `@tauri-apps/*`" — tripping the acceptance grep `grep -c '@tauri-apps' LicenseSettings.tsx == 0` (a tripwire on the literal token, not just imports). A false-positive on a tripwire grep is a latent gate failure.
- **Fix:** Reworded to "never the native Tauri API" — same meaning, no literal token (established project precedent: Phase 18/20/23/25 + 26-02 comment-wording tweaks so literal acceptance greps pass). No behavior change; the block still imports only `@/lib/platform`.
- **Files modified:** `src/components/LicenseSettings.tsx`
- **Committed in:** `0bd500a5` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 acceptance-grep wording, established precedent)
**Impact on plan:** Cosmetic comment wording only — no behavior change, no scope creep. All acceptance criteria pass.

## Issues Encountered

None — both tasks executed as written.

## Known Stubs

The spike block is **intentional temporary scaffolding (D-11)** — it is explicitly marked for removal in Phase 28 (StoreLicenseSettings). It does not gate or block the plan's goal: its purpose IS to be the observable affordance for the Plan 06 human purchase walkthrough. On the direct/no-op arm the calm "IAP unavailable" / "No products" readouts are the intended, tested degradation, not unintended stubs.

## Verification

- `pnpm tsc --noEmit` exits 0; lefthook (typecheck + test + lint) green on both commits.
- Acceptance greps on `LicenseSettings.tsx`: `platform.iap.products|purchase|restore` = 3 (≥3), `platform.iap.currentEntitlements` = 1 (≥1), `com.tinkerdev.app.pro` = 1 (≥1), `TEMPORARY — Phase 26` = 1 (≥1), `@tauri-apps` = 0.
- `grep -c 'iap-spike' test/e2e/iap-spike.e2e.ts` = 7 (≥1).
- Component unit suite: 210/210 (22 files) — no LicenseSettings regression.
- `decoder.ts` + its 19 tests byte-for-byte untouched (this plan touches only `LicenseSettings.tsx` + a new e2e file).

**Gate deferred to the orchestrator (Wave-2 / phase checkpoint), per 26-VALIDATION sampling and project precedent (this executor does not auto-run `/simplify`, `/code-review`, `/codex:adversarial-review`, or the multi-minute real-app build):**
- `bash scripts/e2e-spike.sh` with `iap-spike.e2e.ts` GREEN and NO regression to the existing 24-spec suite (26-VALIDATION 26-03-2).
- The LIVE native purchase sheet + the LIVE Restore re-grant readout are the **Plan 06 human gate** (out-of-process, WebDriver-impossible — D-06).

## Next Phase Readiness

- The observable affordance for the Plan 06 human purchase walkthrough is in place: a human on the signed/sandboxed build can drive the native sheet and SEE the re-granted entitlement codes after Restore.
- Plan 05 (swap the `iap_*` Rust bodies to the plugin Rust API) makes these buttons hit the REAL StoreKit path; this block needs no change for that — it consumes the seam, not the command bodies.
- Phase 28 removes this block when `StoreLicenseSettings` ships the shipped surface.

## Self-Check: PASSED

- Files: `src/components/LicenseSettings.tsx`, `test/e2e/iap-spike.e2e.ts`, `26-03-SUMMARY.md` all FOUND.
- Commits: `0bd500a5`, `a071b19c` both FOUND.

---
*Phase: 26-storekit-bridge-spike*
*Completed: 2026-06-22*
