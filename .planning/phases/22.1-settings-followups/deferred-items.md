# Phase 22.1 — Deferred Items

## Out-of-scope pre-existing issues (NOT introduced by 22.1-02)

- `vite.config.ts(7,1): error TS2578: Unused '@ts-expect-error' directive` — surfaced by
  `tsc --noEmit -p tsconfig.node.json`. Pre-existing; vite.config.ts is byte-unchanged by
  this plan (`git diff --quiet -- vite.config.ts` clean). The webview gate (`tsc --noEmit`
  over `src`) is clean. Logged per the executor scope-boundary; do not fix here.

## Code-review advisories (run 2026-06-15, high effort) — non-blocking cleanup

No CONFIRMED correctness bugs. The following advisory items were recorded rather than
applied (low value vs. the e2e re-run cost; surfaced at the phase boundary):

- **Redundant mount status re-query** — `ActivationSurface` fires `refreshLicenseUi()` on
  mount (`UpsellPanel.tsx:162`) while `LicenseSettings` already fires
  `refreshLicenseUiDetailed()` on its own mount (`LicenseSettings.tsx:110`). For the inline
  variants both reads are pure-local (D-45) and return identical mask-less payloads in
  notActivated/problem/refreshNeeded, so no clobber and no network — purely a redundant
  query. Cheap future fix: gate the mount-refresh effect to `variant === "panel"` (the inline
  surface can rely on the pane's own query). Correctness clobber angle REFUTED (InlineActivation
  never co-mounts with a masked licensed/offlineGrace payload).
- **Stale stacking comments** in `SettingsModal.tsx` (upsell-heading keyboard-yield guard) and
  `App.tsx` (UpsellModal mount comment) still describe the now-removed License-pane→UpsellModal
  stacking path. Files are OUTSIDE this phase's diff; the yield guard is still defensively valid
  for any co-mounted upsell-heading dialog. Comment-only drift — refresh when next touched.
- **Inline success card 'Done' is a no-op** — `InlineActivation` is rendered without `onDismiss`,
  so the `activated` success card's Done button calls `onDismiss?.()` → nothing. Not user-visible:
  a successful inline activation flips entitlements → `LicenseSettings` re-renders to the licensed
  view and unmounts `InlineActivation` before the success card is stably reachable. Dead-path only.
- **Form-only focus-on-mount** (`UpsellPanel.tsx:172`) yanks focus into the key input when Settings
  opens directly on the License pane in problem/refreshNeeded — INTENDED per D-22.1-7. A11y nuance
  (SR users land below the status card) → covered by the human walkthrough item below.
