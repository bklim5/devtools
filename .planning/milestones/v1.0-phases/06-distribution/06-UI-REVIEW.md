# Phase 06 — UI Review

**Audited:** 2026-06-01
**Baseline:** Abstract 6-pillar standards + project design system (`design/DevTools Mockup.html`, `src/index.css` @theme tokens). No UI-SPEC.md for this phase.
**Scope:** New auto-updater UX only — `UpdateBanner` + first-run `UpdateOptIn` prompt + the "up to date / failed" status toast. Pre-existing tool UI not re-graded.
**Screenshots:** Not captured. Tauri dev server responds on :1420, but Playwright browser binaries are not installed in this environment, so no Chromium preview was produced. Per project verify-gate, the binding UI evidence is the real-WKWebView e2e (`test/e2e/update.e2e.ts` → 8/8 on webkit per 06-04-SUMMARY), not a Chromium screenshot. This is a code + token audit.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Specific, human copy; CTAs name the action ("Yes, check at launch", "Install"); no generic "OK/Submit". |
| 2. Visuals | 4/4 | Clear hierarchy (version headline → notes → actions); icon-only ✕ has an aria-label; reuses design-system tokens. |
| 3. Color | 4/4 | Only @theme tokens; accent restricted to the primary action + focus ring; all pairings clear AA. |
| 4. Typography | 4/4 | Two sizes (13/12px), one weight beyond normal (medium); consistent with the shell scale. |
| 5. Spacing | 4/4 | All spacing on the Tailwind scale; arbitrary radii match the design mockup's px values. |
| 6. Experience Design | 3/4 | All states covered + non-opacity disabled signal; opt-in `role="dialog"` lacks focus management. |

**Overall: 23/24**

**WCAG-AA gate: PASS — no blockers found.** Every interactive control is a keyboard-reachable `<button>` with a visible `focus-visible:ring-accent`, no hover-only actions exist, the disabled state is signalled by `aria-disabled` + a label change (not opacity), and all text/control color pairings clear AA against their backgrounds.

---

## Top 3 Priority Fixes

1. **Opt-in prompt has no focus management** (minor, not a blocker) — `UpdateOptIn` (`src/App.tsx:190-225`) uses `role="dialog"` but does not move focus into the prompt on appear, has no `aria-modal`, and has no Escape-to-dismiss. As a non-blocking bottom-right prompt this is defensible, but a keyboard-only user must Tab from wherever focus currently sits to reach it. *Fix:* either move focus to the first button on mount (`autoFocus` on `#update-optin-yes`) OR downgrade `role="dialog"` to a plain `role="region"` / `aria-label` group so AT does not announce a modal dialog that does not trap or manage focus. Pick one — the current pairing (dialog role, no focus behavior) is the only semantic inconsistency in the phase.

2. **Dismiss button stays in the tab order while installing** (polish) — During an in-flight install the Install button is `aria-disabled` with `onClick` removed, but the dismiss/Later buttons remain active. That is intentional and correct (user can still dismiss). However the Install button, being `aria-disabled` rather than truly `disabled`, is still focusable and reads as a button to AT while doing nothing on activation. *Fix:* add `tabIndex={installing ? -1 : 0}` (or render it `disabled` and keep the non-opacity visual cue) so keyboard users do not land on a no-op control mid-install.

3. **No screenshot/visual regression artifact for this surface** (process) — The banner only renders via the dev-only `window.__injectUpdate` hook or a live update detection, so neither the dev server nor a future reviewer can see it without that hook. *Fix:* keep the e2e as the binding gate (it already drives `__injectUpdate`), and optionally have the WKWebView e2e save a screenshot of the injected banner to `.planning/ui-reviews/` so the visual is captured at the gate rather than reconstructed from code.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

Strong throughout. Grep for generic labels (`Submit|OK|Cancel|Save|went wrong`) returned nothing in either surface.

- Banner headline `v{info.version} available` (`UpdateBanner.tsx:53-55`) is concrete and version-bearing.
- CTAs name their action: `Install` / `Later` (`UpdateBanner.tsx:71,78`), and the opt-in uses `Yes, check at launch` / `No thanks` (`App.tsx:211,219`) — both far better than generic Yes/No because they restate the consequence.
- Opt-in body copy (`App.tsx:201-204`) explains the network implication and the manual escape hatch ("You can always check manually from the tray menu") — exactly right for the offline-by-design posture (D-09).
- Status toasts are plain and human: `You're up to date`, `Update check failed`, `Update failed to install` (`App.tsx:60,62,126`).

### Pillar 2: Visuals (4/4)

- Clear visual hierarchy: medium-weight version line → muted (`text-tx-2`) notes → action row. Focal point is unambiguous.
- The only icon-only control (the ✕) carries `aria-label="Dismiss update notification"` and an `aria-hidden` icon (`UpdateBanner.tsx:96,99`) — no unlabeled icon button.
- Both surfaces reuse the established panel chrome (`border-bd bg-panel shadow-lg rounded-[10px]`), so they read as part of the app, not bolt-ons.
- Stacking is correct: the overlay container is `pointer-events-none` with each card flipping to `pointer-events-auto` (`App.tsx:154` + each card), so the fixed overlay never eats clicks on the content beneath it.

### Pillar 3: Color (4/4)

- No hardcoded hex/rgb in either component — every color is a @theme utility (`text-tx`, `text-tx-2`, `bg-panel`, `bg-accent-soft`, `border-accent-line`, `ring-accent`).
- Accent is restricted to the single primary action (Install / "Yes") and the focus ring — it is not sprayed across the surface. This honors the project's "accent = selected/primary only" convention.
- Contrast (dark theme), all clearing AA:
  - `text-tx` #e7e9ee on `bg-panel` #181b21 ≈ 13:1.
  - `text-tx-2` #989da7 on `bg-panel` ≈ 6.5:1.
  - `text-accent` #5b9bf8 on `bg-accent-soft` (15% accent over panel) — this is the exact pairing the `index.css:27-30` comment was tuned for (~4.9:1 after brightening accent from #3b82f6 to #5b9bf8 in 03-UI-REVIEW). Passes.
  - `focus-visible:ring-accent` #5b9bf8 against the dark panel is a high-contrast, non-color-only focus indicator (2px ring).

### Pillar 4: Typography (4/4)

- Sizes used: `text-[13px]` (headlines/CTAs context) and `text-[12px]` (body/notes/buttons). The status toast and header pill add `text-[11.5px]`/`text-[11px]`, but those are shell chrome, not the new updater body. Within standards (≤4 sizes).
- Weights: only `font-medium` beyond default `normal` (4 occurrences). Within standards (≤2 weights).
- These px-literal sizes match the design mockup's typographic scale (13/12/11.5px appear throughout `design/DevTools Mockup.html`), so they are system-consistent, not ad hoc.

### Pillar 5: Spacing (4/4)

- All padding/gap/margin values sit on the Tailwind scale: `px-4 py-3 gap-3`, `px-3 py-1 gap-2`, `mt-2`, `gap-1`, `p-1`. No off-scale spacing.
- Arbitrary values are limited to border radii (`rounded-[10px]/[8px]/[7px]/[6px]`). These mirror the design mockup's px radii (9–11px panels, 6–8px controls), so they are deliberate system values, not drift. Acceptable.
- Layout-agnostic per D-13/UX-05: `w-full max-w-md` + flex, no fixed pixel widths on the cards. Confirmed.

### Pillar 6: Experience Design (3/4)

Strong state coverage — the deduction is solely the opt-in focus-management inconsistency.

- **Installing state:** non-opacity signal via `aria-disabled` + label change (`Install` → `Installing… 37%`) with `onClick` removed mid-flight (`UpdateBanner.tsx:39-43,62-63`). Exactly what D-13 requires.
- **Error state:** install failure is caught in `handleInstall` and surfaced as a `Update failed to install` toast while the banner stays for retry/dismiss (`App.tsx:121-127`) — no crash, matching the verify-before-apply threat model (T-06-12/13).
- **Empty/quiet states:** silent launch check stays quiet on `current`/`error`; manual check gives explicit feedback (`App.tsx:55-64`). Correct asymmetry.
- **Dismissibility:** ✕ and Later both call `onDismiss`; ✕ has an explicit Enter/Space handler for deterministic keyboard dismiss on WKWebView (`UpdateBanner.tsx:90-95`). Re-appears on each detection (controlled, parent-owned visibility, D-11c).
- **Transient toast** auto-clears after 3s (`App.tsx:96-100`) — no lingering status.
- **Gap (the −1):** `UpdateOptIn` declares `role="dialog"` (`App.tsx:194`) but does not move focus in, set `aria-modal`, or handle Escape. The role implies a managed dialog; the implementation is a passive region. Reconcile the role with the behavior (see Fix #1). Not a WCAG-AA blocker — the controls are still keyboard-reachable via Tab — but it is a semantic mismatch worth one point.

---

## Registry Safety

`components.json` not present (no shadcn). No UI-SPEC.md / third-party registries declared for this phase. Registry audit skipped — not applicable.

The one new native-touching surface, `platform.events.onMenuCheckUpdates`, was verified by the implementation summary to keep `@tauri-apps/api/event` `listen` behind the seam in `tauri.ts` only; the audited shell files (`App.tsx`, `update.ts`, `UpdateBanner.tsx`) import no native package. This is a project-constraint check, not a registry flag.

---

## Files Audited

- `src/components/UpdateBanner.tsx` — primary new surface
- `src/components/UpdateBanner.test.tsx` — a11y/keyboard/state assertions
- `src/App.tsx` — `UpdateOptIn` prompt, banner mount, status toast, overlay container
- `src/shell/update.ts` — orchestration (no UI, reviewed for state contract feeding the banner)
- `src/index.css` — @theme tokens (contrast verification)
- `design/DevTools Mockup.html` — canonical visual system (token/scale comparison)
- `.planning/phases/06-distribution/06-04-SUMMARY.md`, `06-CONTEXT.md` — decisions D-09/D-11c/D-13, e2e result
