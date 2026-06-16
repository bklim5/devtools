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

## Code-review advisories (run 2026-06-16, redesign 22.1-03) — non-blocking

No CONFIRMED correctness bugs. One real issue FIXED in-loop (heading-order: pane title was an
`<h1>` inside the dialog's `<h2>` → demoted to `<h3>`, commit `19f93cb4`). Remaining cosmetic
advisory, recorded not fixed:

- **Refresh button on the amber attention card uses the neutral PRIMARY_BTN_CLASS disabled tokens**
  (`bg-input-bg`/`text-tx-2`) — during the brief in-flight `disabled` state the button renders neutral
  on the amber card. Not an AA failure (the disabled button carries its OWN `bg-input-bg`, not
  amber-on-amber) and only transient while refreshing — purely aesthetic. Revisit if a warn-toned
  button variant is ever added.

## Post-review fixes status (2026-06-16, commit `316eaf33`) — what closed, what remains

The 22.1-UI-REVIEW (22/24) + Codex working-tree review yielded four prioritized fixes,
ALL applied (see `22.1-99-SUMMARY.md`). Their effect on the items above:

- **Inline 'Done' no-op → CLOSED** (the success-card Done now renders only when `onDismiss`
  is passed; inline variants render without it). The deferred note above is resolved.
- **Heading-order → CLOSED** (status headings demoted h2→h4, variant-specific so the
  standalone ToolRoute panel stays h2; e2e probe migrated to first-h4 + consolidated).
- **Masked key blanking on a fresh inline activation → CLOSED** (submit() success now uses
  `refreshLicenseUiDetailed()`).
- **Locked pin/drag focus-return → CLOSED** (explicit invoker threaded into openSettings).

### STILL DEFERRED after the post-review batch (non-blocking, record-or-fix)

- **Redundant mount status re-query** — unchanged (still cheap to gate the surface's mount
  refresh to `variant === "panel"`); not user-visible.
- **Stale stacking comments** in `SettingsModal.tsx` / `App.tsx` — comment-only drift, refresh
  when next touched (outside this phase's diff).
- **Refresh disabled tokens on the amber/green banners** — transient cosmetic, revisit if a
  warn-toned button variant is added.
- **Form-only focus-on-mount** (UI-REVIEW fix #2) — INTENDED per D-22.1-7; SR users land below
  the status card. Deferred (not in the prioritized batch); confirm via a VoiceOver pass if
  revisited.
- **Live-app axe re-measure of the three color-mix tinted surfaces** (warn-soft / ok-soft /
  bad/10) — the UI-REVIEW documented contrast math on opaque surfaces but did not independently
  re-measure the translucent fills composited over the gradient body. Recommended as a
  phase-boundary check on the running app (heading-order itself is now e2e-clean).

## Decision record (for PROJECT.md evolution at phase close)

- **D-20 REVERSED (user-approved 2026-06-16 walkthrough):** the in-app upsell now SHOWS pricing
  ("$9 · once · lifetime license") plus a feature list + footer claims. The prior "no pricing in-app"
  stance is retired. Price = **$9** (must stay in sync with the Lemon Squeezy product + tinkerdev.io).
- **New copy claims (all user-confirmed true):** "One-time payment · Free updates forever · 14-day refund".
  "Lost your key?" → "Check your purchase email" (NO account portal exists; do not link to one).
- **New design token:** amber `warn` triad (`--color-warn`/`-soft`/`-line`) added to `src/index.css`
  for the "License needs attention" state (dark-theme only until theming ships).
- **Website:** `$9` lifetime price added to the TinkerDev Pro card in `../tinkerdev-io`
  (`components/site/pro.tsx`, commit `a0a92b8`, separate repo — not part of this phase's git history).
