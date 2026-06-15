# Phase 21 — UI Review (License Lifecycle & Ship Gate)

**Audited:** 2026-06-15
**Baseline:** `21-UI-SPEC.md` (approved 2026-06-14) + `design/DevTools Mockup.html` token system
**Standard:** WCAG-AA (binding per CLAUDE.md — phase-boundary UI gate)
**Screenshots:** NOT captured — Playwright headless-shell binary is absent
(`chrome-headless-shell` not installed), and per project memory the only
binding visual gate is the real WKWebView (`scripts/e2e-spike.sh`), not a
Chromium preview. This is a **code + computed-contrast audit**. Dev server was
live on `:1420` but a Chromium screenshot would not be authoritative; the
WKWebView walkthrough remains required before sign-off.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Verbatim spec copy across all 5 states + confirm/offline/drop lines; "device" not "Mac" |
| 2. Visuals | 4/4 | Calm hierarchy; OK-dot-only semantic glyph; lock badge visible (no opacity-only) |
| 3. Color | 4/4 | Zero alarm color on grace/refreshNeeded/problem; accent = primary+ring only; all token pairs ≥ AA |
| 4. Typography | 4/4 | 2 sizes / 1 weight, reused verbatim from UpsellPanel; no fourth size |
| 5. Spacing | 4/4 | 4px-multiple scale; max-w measure (not fixed width); ≥24px targets |
| 6. Experience Design | 4/4 | Focus move+return on confirm, focus trap on modal, aria-live on every in-flight line |

**Overall: 24/24**

**WCAG-AA verdict: PASS** (code-level). One BLOCK-gated caveat: the real-WKWebView
walkthrough + focus-return-on-modal-unmount must be confirmed live before phase
sign-off — see Experience Design note E1.

---

## Top 3 Priority Fixes

There are **no BLOCK findings**. The three items below were FLAG/polish, none
gated sign-off on their own. **All three are RESOLVED in plan 21-04** (see notes):

1. **Verify focus return on `UpsellModal` unmount via the new store path (E1)** — when
   Reactivate/Activate on the status route calls `openUpsell()`, the modal captures
   `document.activeElement` as the invoker; on close it returns focus there. This is
   correct in code but is a different open-path than Phase 19 (store-driven, mounted
   once in `App.tsx`). Confirm on the real WKWebView that focus lands back on the
   Reactivate button (not `<body>`) after Esc/scrim-close.
   **RESOLVED (21-04):** hardened the seam — `openUpsell()` now captures the invoker
   SYNCHRONOUSLY at click time (`upsellStore.getUpsellInvoker()`), so focus return no
   longer depends on `document.activeElement` surviving the decoupled mount gap;
   `UpsellModal` prefers that captured invoker (falls back to `document.activeElement`).
   Covered by a jsdom UpsellModal seam test (focus restores even after focus churns to
   `<body>`) + a real-WKWebView e2e (problem-state Reactivate → Esc → focus back on
   the Reactivate button) in `test/e2e/license-settings.e2e.ts`. e2e runs in the
   orchestrator's `scripts/e2e-spike.sh` pass.

2. **`refreshNeeded`/`problem` route lacks an aria-live announcement on the silent
   refresh-drop transition (P6)** — D-82 correctly suppresses an error dialog when a
   refresh drops entitlements, and the status block re-renders, but the status-label
   change (`Licensed` → `Pro is no longer active`) is not in an `aria-live` region, so
   a screen-reader user who pressed Refresh hears only "Refreshing…" then silence.
   **RESOLVED (21-04):** the status heading row is wrapped in an `aria-live="polite"`
   region (NOT role=alert/assertive — D-77/D-83 calm tone), so the new resting label
   is announced politely. Unit test in `LicenseSettings.test.tsx` asserts the label is
   inside a polite live region (and no alert/assertive region exists) and that the
   post-drop label lands in it.

3. **`Refresh` disabled state relies on color-only affordance (P3b)** — while in
   flight the button is `disabled` and recolors to `text-tx-2` on `bg-input-bg`
   (7.05:1, AA-clean) but the label stays "Refresh"; the only signal that it is busy
   is the separate aria-live "Refreshing…" line.
   **RESOLVED (21-04):** added `aria-busy={refreshing}` to the Refresh button so the
   busy state is conveyed on the control itself, in parity with the live line. Unit
   test asserts `aria-busy` flips true while refreshing.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

PASS across the board. Every state string in `LicenseSettings.tsx`
`statusLabel`/`statusBody` (lines 192–222) matches the 21-UI-SPEC state table
verbatim:
- `notActivated` → "Free" + "Most of TinkerDev is free…" (L204/L220) — PASS
- `licensed` → "Licensed" + "Pro is active on this device." (L211) — PASS
- `offlineGrace` → "Licensed (offline)" + calm refresh line (L213) — PASS, no countdown alarm
- `refreshNeeded` → "Pro is no longer active" + saved-state reassurance (L215) — PASS, single calm state
- `problem` → "License needs attention" + "Your tools keep working…" (L217) — PASS

Action copy matches contract: "Refresh" (L319), "Reactivate" (L334),
"Deactivate this device" (L401), confirm "Deactivate"/"Keep Pro here" (L374/L382),
offline guidance "Connect to the internet to free this seat." (L65), drop notice
"Your Pro features turned off" + "Got it" (L233/L247). `UpsellPanel` `ERROR_COPY`
(L60–71) uses "device" never "Mac" — the 2026-06-12 walkthrough decision holds.
"Renews around {date}" derives a human date (L78–87). Em-dash fallback for absent
email/key (L284/L291, D-89). No generic "Submit/OK" labels anywhere in scope.

### Pillar 2: Visuals (4/4)

PASS. Clear single focal point per state: a heading row (glyph + 16px semibold
label) over a 12px body, fields, then a separated management block. The only
semantic glyph is the OK dot (`bg-ok`, L262) shown **only** for `licensed`/
`offlineGrace` (`isProActive`, L184/L259) — D-24 honored, accent never used for
status. All other states show a neutral `Lock` glyph (`text-tx-2`, L265).
Locked tools stay visible with the lock badge + sr-only " — locked" suffix and
no opacity dimming (`Sidebar.tsx` L476–487, `CommandPalette.tsx` L340–350) —
ENT-04 satisfied. The drop notice (L229–251) is an inline dismissable card, not a
toast/dialog. Icons are decorative (`aria-hidden`) with the accessible name
carried by adjacent text, so no orphan icon-only controls. `CopyButton`
(L286/L294) is a visible, focusable, labeled affordance — no hover-only copy.

### Pillar 3: Color (4/4)

PASS — the strongest pillar for this phase's binding constraint. **No alarm color
on grace/refreshNeeded/problem**: grep for `text-bad|text-red|bg-red|border-red`
in `LicenseSettings.tsx` returns **only comment lines**, zero className usage —
D-77/D-83/ENT-04 structurally satisfied. The D-79 offline-deactivate guidance
renders in the calm `text-tx-2` region (L389), not `text-bad`, exactly as the
contract requires ("guidance, not an error").

Accent reserved correctly: `PRIMARY_BTN_CLASS` fill/border + every
`focus-visible:ring-accent` (L56–58); the active nav bar in the sidebar. No
hardcoded hex/rgb in scope beyond the established `rgba(255,…)` hover tint
(comment-only `#868b95`/`#0d0f13` references).

Computed contrast (sRGB, token values from `src/index.css`):

| Pair | Surface | Ratio | AA |
|------|---------|-------|----|
| tx `#e7e9ee` | panel `#181b21` | 14.20:1 | ✅ |
| tx-2 `#989da7` (body, labels) | panel | 6.34:1 | ✅ |
| tx-3 `#868b95` (renews, sub-line) | panel | 5.04:1 | ✅ |
| accent `#5b9bf8` (primary btn, ring) | panel | 6.15:1 | ✅ (text + 1.4.11) |
| ok `#34d399` (dot) | panel | 8.97:1 | ✅ (1.4.11) |
| tx-2 placeholder/input text | input-bg `#0d0f13` | 7.05:1 | ✅ |
| tx-2 footer affordance | sidebar `#101216` | 6.89:1 | ✅ |
| disabled Refresh (tx-2 on input-bg) | input-bg | 7.05:1 | ✅ |

Every interactive and informational pair clears AA (4.5:1 text / 3:1 non-text).

### Pillar 4: Typography (4/4)

PASS. Grep of scope shows exactly **two explicit sizes** (`text-[12px]` ×17,
`text-[16px]` ×2) and **one explicit weight** (`font-semibold` ×2, regular is the
default body) — matching the 3-role/2-weight contract once the inherited 11px
`pane-label` variant (not used here) is counted as a label, not a new role. Classes
are copied **verbatim** from `UpsellPanel` (`HEADING_CLASS`/`BODY_CLASS`/
`LABEL_CLASS`/`VALUE_CLASS`, L53–61) per the reuse mandate — zero drift. Mono is
applied to data values (`VALUE_CLASS` masked key + email, L61; renews L300) so the
last-N key chars stay unambiguous. No fourth size, no third weight.

### Pillar 5: Spacing (4/4)

PASS. All spacing is on the 4px scale: route `p-8` (32px / xl), section
`gap-12` (48px / 2xl management break, matches the spec's "48px vertical break"
at L307), card `gap-4`/`p-6` (16/24px), button rows `gap-2` (8px), field stacks
`gap-3`/`gap-0.5`. Button padding is the inherited `px-3 py-1` — no new button
size introduced. **Layout-agnostic confirmed**: the only pixel widths are
`max-w-[420px]` (a responsive measure cap that collapses below 420px) — no fixed
`w-[NNNpx]` in either component. Mobile viewport (375px) therefore reflows within
the cap. Footer affordance keeps `min-h-6` (24px, WCAG 2.5.8); pin/grip controls
are `h-6 w-6` (24×24). Icon-to-label gaps are `gap-2` (8px).

### Pillar 6: Experience Design (4/4)

PASS with one live-verify caveat (E1, above).

State coverage is complete: all five `resolve_status` states render distinct
copy; in-flight feedback is a calm `aria-live="polite"` line ("Refreshing…"
L355, "Deactivating…" L391) — **no spinner chrome**, per D-34. The refresh-drop
path silently transitions to `refreshNeeded` with no error dialog (D-82,
L111–124).

Keyboard + focus (WCAG-AA):
- Every control is a native `<button>`/`<input>` Tab stop with
  `focus-visible:ring-2 focus-visible:ring-accent` — verified in all four
  button classes and the input (L56–58, L217). PASS (2.1.1, 2.4.7).
- **Confirm-first Deactivate moves focus to the confirm control on reveal and
  returns to the trigger on cancel** via `focusAfter` ref + an effect keyed on
  `confirming` (L138–155) — mirrors the UpsellModal capture/return contract.
  This is the correct pattern (the target only exists in the DOM after the
  reveal commits). PASS.
- `UpsellModal` (the Reactivate/Activate target) has a real focus trap (Tab/
  Shift+Tab wrap, pull-back if focus escapes, L384–406), `role="dialog"`
  `aria-modal="true"` `aria-labelledby` (L432–434), Esc + scrim dismiss, and
  focus return to the captured invoker on unmount (L412–416). PASS.
- The route `<h1 class="sr-only">License</h1>` (L226) gives the page an
  accessible name; card headings are real `<h2>`; fields use a semantic
  `dl/dt/dd` (L280–303). PASS (1.3.1, 2.4.6).
- D-84 drop notice waits for `prefsLoaded` before showing (L182) so the default
  never flashes; dismiss is a single labeled button. PASS.

**E1 (RESOLVED, 21-04):** the modal-open path is store-driven and mounted once
in `App.tsx`. Rather than rely on the modal's mount-time `document.activeElement`
read (fragile across the decoupled mount gap), `openUpsell()` now captures the
invoker SYNCHRONOUSLY at click time (`upsellStore.getUpsellInvoker()`) and the
modal restores focus to it on close (falling back to `document.activeElement`).
Proven by a jsdom seam test + a real-WKWebView e2e (Reactivate → Esc → focus
returns to the Reactivate button). **P6 (RESOLVED, 21-04):** the status heading
row is now wrapped in an `aria-live="polite"` region so the silent refresh-drop
label change is announced politely (no alert/assertive — calm tone). **P3b
(RESOLVED, 21-04):** `aria-busy={refreshing}` added to the Refresh button.

Registry audit: not applicable — `components.json` absent, no shadcn, no
third-party blocks (21-UI-SPEC Registry Safety = N/A).

---

## Files Audited

- `src/components/LicenseSettings.tsx` (status route, 5 states, Refresh/Deactivate/Reactivate, drop notice)
- `src/components/UpsellPanel.tsx` (UpsellPanel + UpsellModal focus trap, activation form)
- `src/components/Sidebar.tsx` (footer license affordance, D-88 routing, lock badge)
- `src/components/CommandPalette.tsx` ("License" command, D-88 state routing)
- `src/components/CopyButton.tsx` (masked-key/email copy affordance — reused)
- `src/shell/upsellStore.ts`, `src/shell/useUpsell.ts` (shared open-state)
- `src/App.tsx`, `src/router.tsx` (modal mount-once + `#/settings/license` route registration)
- `src/index.css` (`@theme` token values for contrast computation)
- `design/DevTools Mockup.html` token system (baseline)
