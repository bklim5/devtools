# Phase 19 — UI Review

**Audited:** 2026-06-12
**Baseline:** Abstract 6-pillar standards + `design/DevTools Mockup.html` canonical visual system + WCAG-AA
**Screenshots:** Not newly captured (no dev server on :3000/:1420/:5173/:8080) — audit used the real-WKWebView e2e screenshots from the gate run (`test/e2e/__screenshots__/license-error-retention.png`, `license-problem-state.png`) read visually, plus full code review.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | All locked copy (D-36/37/38, 19-CONTEXT table) implemented verbatim; calm, specific, zero generic labels |
| 2. Visuals | 4/4 | Panel matches the mockup card language; clear heading hierarchy; focus ring visible on the real WKWebView |
| 3. Color | 3/4 | Tokens only, accent correctly confined — but the stored-key placeholder has no color class (browser-default placeholder, unverified AA) |
| 4. Typography | 4/4 | 16px semibold heading / 12px body / mono key input — inside the app's established ramp, no new sizes/weights |
| 5. Spacing | 4/4 | Standard Tailwind scale; arbitrary values match established system constants; `min-h-[18px]` status slot prevents layout shift |
| 6. Experience Design | 3/4 | Excellent state machine, but the update-consent prompt floats above the modal scrim, and the disabled input drops keyboard focus mid-activation |

**Overall: 22/24**

---

## Top 3 Priority Fixes

1. **Update-consent prompt renders above the upsell modal scrim (visible in BOTH e2e screenshots)** — While `UpsellModal` declares `aria-modal="true"` and traps Tab, the consent prompt (`src/App.tsx:154`, `fixed bottom-4 right-4 z-50`, itself `role="dialog"` with two buttons) shares `z-50` with the scrim (`UpsellPanel.tsx:380`) and wins on DOM order. Result: a bright, mouse-clickable dialog sits outside the focus trap of an "inert" background — an aria-modal contract violation and two dialogs competing for attention. — Fix: while any modal is open, either suppress/queue the consent prompt or drop its container below the scrim (`z-40`); alternatively raise the UpsellModal wrapper to `z-[60]`.

2. **`disabled={pending}` on the key input drops keyboard focus during activation** — `UpsellPanel.tsx:184`: the user submits with Enter while focused in the input; disabling the focused element moves focus to `<body>`. Inside the trap the next Tab recovers, but screen-reader/keyboard users lose their position exactly at the moment the aria-live line announces "Activating…", and on error they must re-acquire the field they're supposed to correct (D-37's whole point). — Fix: change the input to `readOnly={pending}` (keep the submit button `disabled`), or re-focus `inputRef` in the `catch` branch of `submit()`.

3. **Stored-key affordance is placeholder-only and the placeholder is unstyled** — `UpsellPanel.tsx:185-189`: "Your saved key will be used — paste a new key to replace it" lives solely in `placeholder` (disappears on typing; placeholders are not labels per WCAG 3.3.2 guidance), and no `placeholder:text-*` class is set anywhere (`grep '::placeholder\|placeholder:' src/` hits only CommandPalette), so it renders in the WebKit default gray on `bg-input-bg #0d0f13` — contrast unverified. — Fix: add `placeholder:text-tx-3` to the input class, and surface the saved-key hint as a persistent helper line (the existing status `<p>` slot or under the label) when `hasStoredKey && !value`.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

Every string in the locked copy table landed verbatim (`UpsellPanel.tsx:54-65`):
- `seatLimit` names the resolution path ("Deactivate it on the other Mac first, then activate here") — D-36 met.
- `offline` vs `serviceUnreachable` are distinct messages — D-38 met; the error-retention screenshot shows the serviceUnreachable line rendered live.
- Problem state: "Your license file couldn't be verified" + reassurance body "Your tools keep working — activate again below to restore your license" (screenshot confirms) — calm, never alarmist, no sales pitch (D-44).
- CTAs are specific: "Activate", "I have a license key", "Done", "Buy license" — zero generic "Submit/OK" patterns in the phase surface.
- Footer: "License needs attention" (Sidebar.tsx:612) — hint-toned per D-43.
- Unknown error codes collapse to the calm "Activation didn't complete — try again." fallback (`toErrorCode`, UpsellPanel.tsx:69-74) — raw server prose can never reach the UI.

Minor (no deduction): `noStoredKey`/`activationFailed`/`licenseProblem` share one fallback line — per the locked copy table, intentional.

### Pillar 2: Visuals (4/4)

- Panel card (`CARD_CLASS`, UpsellPanel.tsx:76-77) matches the mockup panel system: `border-bd bg-panel rounded-[7px]`, max-w-420px, centered over `bg-scrim` — both screenshots read as a native part of the app.
- Clear hierarchy: 16px semibold heading + lock icon (aria-hidden, text carries meaning) → 12px tx-2 body → form → status line.
- Focus-visible ring (`focus-visible:ring-2 ring-accent`) is *visible in the problem-state screenshot* on the auto-focused input — the D-44 pre-focus works on the real WKWebView.
- Error line uses the calm `text-bad` coral tint, not alarm-red; footer attention state stays neutral tokens + Lock icon (no red), exactly as D-43 specifies ("a hint, not an interruption").
- No icon-only controls introduced; all buttons have text labels.

### Pillar 3: Color (3/4)

- `grep '#hex|rgb('` across `UpsellPanel.tsx`, `licenseUi.ts`, `useLicenseUi.ts`, Sidebar footer: **0 hardcoded colors** — tokens only.
- Accent discipline: accent appears on exactly the primary CTA fill (`bg-accent-soft text-accent border-accent-line`) and focus rings — matching the app's declared accent contract.
- Contrast (computed against tokens in `src/index.css`): `text-bad #f0876b` on panel `#181b21` ≈ **6.9:1** (AA pass at 12px); `text-tx-2 #989da7` on panel ≈ **6.3:1** (pass); accent was already system-corrected to `#5b9bf8` for AA on accent-soft (index.css:27-30).
- **Deduction:** the stored-key placeholder (UpsellPanel.tsx:185-189) has no placeholder color utility and no global `::placeholder` rule exists — WebKit default placeholder gray on `#0d0f13` is unverified and likely below 4.5:1. See Priority Fix 3.

### Pillar 4: Typography (4/4)

Phase surface distribution: `text-[16px] font-semibold` (heading, ×1), `text-[12px]` (body/label/buttons/status, ×7), `text-[13px]` (sidebar footer row), `font-mono text-[12px]` on the key input. Two weights total (semibold + normal). All values sit inside the mockup's ramp (11–19px) and reuse the app's existing pixel-literal convention; mono for the key input is the right register (keys are machine strings). No new sizes or weights introduced.

### Pillar 5: Spacing (4/4)

- Standard scale throughout: `gap-2`, `gap-4`, `p-6`, `px-3 py-1` (buttons), `px-2.5 py-1.5` (input) — consistent with the pre-existing Phase-18 panel classes (form controls reuse `PRIMARY_BTN_CLASS`/`SECONDARY_BTN_CLASS` rather than inventing new ones).
- Arbitrary values are limited to system constants already established app-wide (`rounded-[7px]`, `max-w-[420px]`) plus one purposeful addition: `min-h-[18px]` on the aria-live line (UpsellPanel.tsx:199) reserves the status row so the panel never jumps when "Activating…"/errors appear — a deliberate anti-layout-shift move, verified stable across both screenshots.

### Pillar 6: Experience Design (3/4)

State coverage is the strongest part of the phase: sales / form-reveal-in-place (D-33) / activating with disabled submit + polite live region (D-34) / dismissible licensed (D-35, entitlements refreshed live before the view swap) / inline error with value retention (D-37, screenshot-proven: "TEST-KEY-E2E" retained under the error) / distinct problem state with auto-focus + stored-key reactivation via `activate(null)` (D-44). One aria-live region carries both status and error — no double-announcement. Esc/scrim/focus-return owned by UpsellModal; trim-only validation with empty no-op (D-39); pending re-entry guarded (`if (pending) return`). Panel-mount re-query keeps D-44 fresh without relaunch; footer condition is independent of entitlements (Sidebar.tsx:605), so the attention surface survives the Phase-21 free-tier flip.

**Deductions:**
1. **Modal vs update-consent prompt stacking conflict** (Priority Fix 1) — both screenshots capture an interactive `role="dialog"` floating bright above the `aria-modal` scrim, clickable by mouse but excluded from the Tab trap. Pre-existing component, but the conflict is newly observable on this phase's primary surface.
2. **Focus loss when the input disables during pending** (Priority Fix 2) — keyboard/SR users lose position at the exact moment they may need to correct the field.

Minor (no further deduction): the licensed-view "Done" button is a documented no-op in route placement (`onDismiss` undefined) — acceptable since the live entitlement flip re-renders the route, but a button that visibly does nothing is worth a glance in Phase 21's status UI work.

---

## Registry audit

Not applicable — no `components.json` (shadcn not initialized); zero third-party UI registries in use.

---

## Files Audited

- `src/components/UpsellPanel.tsx` (full — panel state machine, form, modal wrapper)
- `src/components/Sidebar.tsx` (lines 45, 71, 590-635 — D-43 footer attention state)
- `src/lib/license/licenseUi.ts` (snapshot store)
- `src/shell/useLicenseUi.ts` (hook)
- `src/main.tsx` (startup `refreshLicenseUi` wiring, D-45 comment)
- `src/App.tsx` (lines 154, 194-224 — update-consent prompt stacking)
- `src/index.css` (token values for contrast computation)
- `design/DevTools Mockup.html` (canonical visual system)
- `test/e2e/__screenshots__/license-error-retention.png` (real WKWebView)
- `test/e2e/__screenshots__/license-problem-state.png` (real WKWebView)
- Plans/summaries: 19-01/02/03-SUMMARY.md, 19-01..04-PLAN.md, 19-CONTEXT.md
