# Phase 21 — UI Review (Re-Audit)

**Audited:** 2026-06-18
**Baseline:** `21-UI-SPEC.md` (approved 2026-06-14), WCAG-AA emphasis
**Screenshots:** not captured — Tauri dev webview is live on `:1420`, but the audited UI (`#/settings/license`) sits behind a HashRouter + Settings modal; a flat CLI Chromium screenshot of the root URL cannot reach it. Per project harness, the real-WKWebView e2e suite (`ship-gate.e2e.ts`, `license-settings.e2e.ts`) is the binding visual gate, not Chromium previews. Code-only audit.

> **Re-audit note.** This supersedes the prior 21-UI-REVIEW. Since that review, **Phase 22.1/22.2 walkthroughs deliberately re-skinned the License pane** (semantic amber/green banners, inline activation, $9 pitch, light-theme support). Several findings below are *drift from the frozen 21-UI-SPEC contract* that was nonetheless **user-approved at a later walkthrough**. They are scored against the 21 contract (the auditor's job) but flagged as "approved-later-revision" so the orchestrator can reconcile rather than regress. WCAG-AA — the binding bar — is met.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Verbatim-calm, device-neutral, non-accusatory; no generic labels; D-79/D-82/D-83 copy honored |
| 2. Visuals | 4/4 | Clear hierarchy, all icon glyphs `aria-hidden` with real text labels, confirm-first reveal correct |
| 3. Color | 2/4 | Contract said CALM neutral (no alarm color, no banners) on grace/refreshNeeded/problem — impl ships amber/green semantic banners + light theme (approved-later, AA-documented, but off-contract) |
| 4. Typography | 3/4 | Contract = 3 sizes / 2 weights; impl uses 9 sizes (hero pitch 24/28/20/14/13/11/10px) — expanded by 22.1, but only 2 weights and all token-sized |
| 5. Spacing | 4/4 | All spacing on the 4px scale via shared class constants; zero arbitrary px spacing values |
| 6. Experience Design | 4/4 | All 5 states, aria-live status transitions, confirm-first destructive, no opacity-only disabled, no spinners-as-chrome, focus-return contract |

**Overall: 21/24**

---

## Top 3 Priority Fixes

1. **Color contract drift on calm states (P-COLOR).** 21-UI-SPEC §Color is explicit: OfflineGrace / RefreshNeeded / problem are "CALM neutral `tx-2`, never alarm-colored … No red borders, no banners (D-77/D-83/D-84; ENT-04)." The implementation (`LicenseSettings.tsx:313-360`) renders refreshNeeded/problem in an **amber warn banner** (`bg-warn-soft border-warn-line text-warn` + `AlertTriangle`) and licensed/offlineGrace in a **green ok banner** (`LicenseSettings.tsx:368-414`). *Impact:* a lapsed paying customer sees a warning-toned surface the contract said must stay calm-neutral — the exact "no alarm styling" guarantee (ENT-04). *Fix:* Either (a) re-affirm the 22.1 walkthrough revision by **amending 21-UI-SPEC §Color** to permit the AA-documented amber/green semantic banners (recommended — the revision was user-approved and the tokens are contrast-verified), or (b) revert refreshNeeded/problem to the neutral `CARD_CLASS` + `tx-2` body the contract specifies. Do not leave spec and code in silent conflict.

2. **Typography palette expanded beyond the 3-size contract (P-TYPE).** 21-UI-SPEC §Typography declares exactly three sizes (16 heading / 12 body / 12 mono) and forbids a fourth. The pane now uses **9 distinct sizes** — 20px pane title (`:298`), 24px pitch hero (`UpsellPanel:130`), 28px price (`:511`), plus 14/13/11/10px. *Impact:* the contract's "do not add a fourth size" rule is broken; visually fine but undocumented. *Fix:* reconcile by recording the 22.1 pitch type ramp (10/11/13/14/20/24/28) as an approved extension in 21-UI-SPEC §Typography, or pull the pitch back toward the 3-size scale. Weight discipline is intact (only semibold + one `font-medium`), so this is a sizes-only reconciliation.

3. **Dark-only contract vs shipped light theme (P-COLOR-2).** 21-UI-SPEC §Design System states "Theme: Dark only." `index.css:91` ships a full `:root[data-theme="light"]` palette (D-23-8, a later phase). The License pane inherits it via tokens (no hardcoded hex — good). *Impact:* none functionally; the surface is token-clean and the light variants re-declare warn/ok/accent for AA. But the contract says dark-only. *Fix:* update 21-UI-SPEC §Design System to note the theme system landed in a later phase; no code change needed.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)
Strong, fully on-contract.
- State copy matches the contract intent: refreshNeeded body `LicenseSettings.tsx:233` ("Connect to the internet and refresh to restore Pro. Your themes and tool order are saved and will come right back.") and problem body `:235` are the verbatim D-83/D-44 calm lines.
- D-79 offline-deactivate guidance is calm guidance, not an error: `DEACTIVATE_OFFLINE_COPY` (`:85`, "Connect to the internet to free this seat.") renders in the `tx-2` aria-live region, not `text-bad` (`:480-487`). Correct.
- Device-neutral throughout ("device", never "Mac") — `:514`, confirm copy `:476-479`. Honors the 2026-06-12 lock.
- D-84 one-time drop notice copy present and calm (`:247-253`, "Your Pro features turned off … reactivate any time to bring them back.") with a single "Got it" dismiss.
- No generic labels. The only `Cancel`/`OK`-family hit is the confirm-dialog **Cancel** (`:496`), a legitimate paired-cancel on the destructive confirm — not a generic CTA. The contract's "Keep Pro here" label is the one copy deviation (now "Cancel"); minor, and the confirm heading carries the meaning.
- Error copy keyed on typed codes, never raw error strings (`UpsellPanel.tsx:81-101`, `REFRESH_ERROR_COPY :86`).

### Pillar 2: Visuals (4/4)
- Clear focal hierarchy: pane title (`h3`, 20px) → status banner heading (`h4`, 16px) → body/fields. Heading order is deliberate and documented (`:290-296`) to avoid axe heading-order skips under the Settings dialog `h2`.
- Every icon is decorative + `aria-hidden`: `Lock`, `AlertTriangle`, `RefreshCw` (`:246, :316, :354, :408, :470`) — all paired with real text. No icon-only buttons without a text label (Refresh button has visible "Refresh" text `:358`).
- Confirm-first destructive reveal is structurally correct: trigger → in-place confirm card (`:467-509`), no browser `confirm()`, no separate modal.
- Pro/Unverified pills give state a second non-color signal (text label), not color alone (`:331, :383`).

### Pillar 3: Color (2/4)
The single materially-low pillar — pure contract conflict, not a defect.
- **Off-contract:** the contract reserves semantic color tightly and bans banners/alarm tones on calm states. Impl ships `bg-warn-soft`/`border-warn-line`/`text-warn` banners for refreshNeeded+problem (`:314`) and `bg-ok-soft`/`border-ok-line`/`text-ok` for licensed/offlineGrace (`:368`), plus a `bg-bad/10 border-bad/75 text-bad` destructive confirm (`:469`, `DESTRUCTIVE_BTN_CLASS :77`).
- **Mitigations that keep WCAG-AA intact:** all banner colors are tokens (no hardcoded hex anywhere in either file — grep confirms only hex *in comments*), and the tokens are contrast-documented in `index.css:59-77` (warn ~10:1, ok AA on its soft fill). Accent stays discipline-correct: it appears only on the primary CTA fill (`PRIMARY_BTN_CLASS`) and focus rings — never on a status glyph (the OK signal is the `bg-ok` dot, the destructive ring is `ring-bad`, not accent). So the *accent-only* rule (D-24) is honored; the *no-alarm-color* rule is what drifted.
- **Light theme** (`index.css:91`) exists vs the dark-only contract; token-clean, AA-redeclared. See Fix 3.

### Pillar 4: Typography (3/4)
- Distinct sizes in use across both files: **10, 11, 12, 13, 14, 16, 20, 24, 28px** (9 vs the contract's 3).
- Weights: only `font-semibold` + a single `font-medium` on the destructive button — within the 2-weight contract.
- All sizes are explicit `text-[Npx]` tokens (no rogue Tailwind scale), mono reserved for the masked key + email values (`VALUE_CLASS :81`) and the claims footer — mono discipline correct.
- The expansion is entirely the 22.1 hero-pitch redesign (medallion title 24px, $9 price 28px) + the 20px pane title. Visually coherent; the only issue is it outruns the frozen contract's size count. See Fix 2.

### Pillar 5: Spacing (4/4)
- `grep` for arbitrary spacing utilities (`p-[`, `gap-[`, `m-[` …) returns **zero** in both files — every gap/pad is a scale token (`gap-2/3/4/6/12`, `p-5/6/8`, `py-1/1.5/3`, `px-2/2.5/3/4`).
- Card padding `p-6` (24px), route padding `p-8` (32px), 48px (`gap-12`) major break between blocks (`:274`) — exactly the contract's lg/xl/2xl rhythm.
- Footer affordance keeps `min-h-6` (24px touch target, WCAG 2.5.8) — `Sidebar.tsx:664, :680`.

### Pillar 6: Experience Design (4/4)
- All 5 resolve_status states render with distinct, correct treatments (free→inline pitch, licensed/offlineGrace→Pro-active, refreshNeeded/problem→attention+inline form).
- **No spinners as state chrome:** in-flight is a calm `aria-live="polite"` "Refreshing…"/"Deactivating…" text line (`:342, :486`); the RefreshCw icon's `animate-spin` is a secondary affordance on a labeled button with `aria-busy` (`:351, :356`), not the sole signal. Honors D-34.
- **aria-live coverage = 10** regions: status-label transitions are announced politely (`:323-326, :376-379`) so a silent refresh-drop ("Licensed"→"Pro is no longer active", D-82) reaches SR users — the prior review's P6 flag is resolved.
- **Confirm-first destructive** with focus contract: focus → confirm on reveal, → trigger on cancel via the `confirming`-keyed effect (`:153-168`); mirrors the UpsellModal capture/return.
- **No opacity-only disabled** (the ENT-04 bar): disabled buttons swap tokens (`disabled:border-bd disabled:bg-input-bg disabled:text-tx-2`), `readOnly`-not-`disabled` on the active input to preserve keyboard focus (`UpsellPanel.tsx:341`).
- **Keyboard reachability:** route reachable from the footer affordance (`Sidebar.tsx:660-667`, native `<button>` + ring) and the ⌘K "License" command (`CommandPalette.tsx:237`); every control is a native `<button>`/`<input>` with `focus-visible:ring-2` via the shared class constants.
- D-86 dormant-restore, D-88 state-dependent routing, D-89 em-dash fallback for null email/key (`:424, :428`) all present.

---

## Reconciliation Guidance (for the orchestrator)

The three deductions are **all the same root cause**: 21-UI-SPEC was frozen 2026-06-14, then Phase 22.1/22.2 walkthroughs (user-approved) re-skinned this exact pane. The audit must score against the frozen contract, hence Color 2/4 and Type 3/4. The correct resolution is almost certainly to **amend 21-UI-SPEC** (Color: permit AA-documented semantic banners; Typography: record the pitch ramp; Design System: note the light theme), not to revert working, AA-clean, user-approved UI. WCAG-AA — the binding ship bar — is fully met: visible focus rings on every control, token-documented contrast (warn ~10:1, ok/accent AA), keyboard reach via footer + palette, aria-live status transitions, no opacity-only disabled.

---

## Files Audited
- `src/components/LicenseSettings.tsx` (the #/settings/license route — 5 states, Refresh, confirm-first Deactivate, drop notice, inline activation)
- `src/components/UpsellPanel.tsx` (shared `ActivationSurface` / `InlineActivation` / `UpsellModal` — pitch, key form, problem/licensed states)
- `src/components/Sidebar.tsx` (footer license-attention affordance, D-88 routing — partial: footer rows)
- `src/components/CommandPalette.tsx` (⌘K "License" command routing — partial)
- `src/index.css` (`@theme` tokens — accent/ok/bad/warn/tx/panel + light-theme block)
- Phase 21 SUMMARYs 01–05, PLANs 01/03/04, 21-UI-SPEC.md, 21-CONTEXT.md (context)
