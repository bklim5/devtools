---
phase: 21
plan: 04
type: execute
wave: 4
depends_on: [21-02, 21-03]
files_modified:
  - src/lib/entitlements/resolve.ts
  - src/components/LicenseSettings.tsx
  - src/router.tsx
  - src/components/Sidebar.tsx
  - src/components/CommandPalette.tsx
  - src/shell/preferences.ts
  - src/shell/prefsStore.ts
  - test/e2e/license-settings.e2e.ts
autonomous: false
requirements: [LIC-09, LIC-05, LIC-07, LIC-08]
user_setup: []
must_haves:
  truths:
    - "An unlicensed in-Tauri install actually locks theming + ordering/pinning (D-85 flip live) — all 11 tools stay free"
    - "A keyboard-reachable, WCAG-AA license status route at #/settings/license shows the current state (free/licensed/offline-grace/refresh-needed/problem), masked key + licensee email, and working Refresh + Deactivate actions"
    - "Deactivate is confirm-first inline; offline deactivate is blocked and never clears local state (D-78/D-79)"
    - "Locked customizations are preserved dormant (default render, stored prefs untouched, instant restore on activate) — D-86"
    - "A one-time dismissable notice appears on next open when entitlements drop (D-84) — no mid-use toast"
    - "OfflineGrace is silent outside this route; only problem/refreshNeeded surface in the footer (D-77/D-84)"
  artifacts:
    - path: "src/lib/entitlements/resolve.ts"
      provides: "the live D-85 flip — Tauri arm derives entitlements from license_status, not FULL_SET"
      contains: "license"
    - path: "src/components/LicenseSettings.tsx"
      provides: "the status route UI — state copy, fields, Refresh, confirm-first Deactivate, drop notice"
      min_lines: 120
    - path: "src/router.tsx"
      provides: "the #/settings/license app-chrome route (NOT a tool, not in ENABLED_TOOLS)"
      contains: "settings/license"
  key_links:
    - from: "src/lib/entitlements/resolve.ts"
      to: "platform.license.status()"
      via: "Tauri arm maps payload entitlements -> EntitlementSet"
      pattern: "license"
    - from: "src/components/LicenseSettings.tsx"
      to: "platform.license.refresh / deactivate + refreshEntitlements"
      via: "button handlers, live flip no restart"
      pattern: "deactivate|refresh"
    - from: "src/router.tsx"
      to: "LicenseSettings"
      via: "non-tool child route under App"
      pattern: "settings/license"
    - from: "src/components/Sidebar.tsx + CommandPalette.tsx"
      to: "the status route vs the Unlock Pro panel"
      via: "state-dependent routing (D-88)"
      pattern: "settings/license"
---

<objective>
Ship the LIC-09 license status route AND flip the free-tier default live (D-85) — the milestone-defining integration. This is the heaviest plan; it is NOT autonomous (ends at a human-verify checkpoint via the real-WKWebView gate).

Delivers, per the approved 21-UI-SPEC:
- **D-85 THE flip:** swap `resolve.ts`'s Tauri arm from hardcoded `FULL_SET` to entitlements derived from the Rust `license_status` command. Unlicensed in-Tauri installs now actually lock theming + ordering/pinning (all 11 tools stay free). The D-31 override stays downgrade-only.
- **D-87 settings route:** a dedicated `#/settings/license` app-chrome route (NOT a tool, NOT in ENABLED_TOOLS) hosting the status UI: current state (free/licensed/offline-grace/refresh-needed/problem), masked key + licensee email, working Refresh + Deactivate. Keyboard-reachable, WCAG-AA.
- **D-78/D-79/D-80 deactivate:** confirm-first inline; offline-blocked never-clear-local; seat-taken guidance copy.
- **D-83/D-84 calm drop:** one "Pro is no longer active" state regardless of cause; a one-time dismissable drop notice.
- **D-86 dormant customizations:** locked → default render, stored prefs untouched, instant restore on activate (the gatePreferences seam already does the render-time view — this plan proves it round-trips under the live flip).
- **D-88 routing:** footer attention + command palette route to the status route (licensed/grace/refreshNeeded) or the Unlock Pro panel (free).

Purpose: criterion 4 + criterion 5's free-tier flip; the user-facing payoff of the whole milestone.
Output: the flip, the route + component, footer/palette routing, the drop-notice prefs flag, and the real-WKWebView e2e.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/21-license-lifecycle-ship-gate/21-CONTEXT.md
@.planning/phases/21-license-lifecycle-ship-gate/21-UI-SPEC.md
@.planning/phases/21-license-lifecycle-ship-gate/21-02-SUMMARY.md
@.planning/phases/21-license-lifecycle-ship-gate/21-03-SUMMARY.md

<interfaces>
<!-- The full 5-state payload (Plans 01-03) with maskedKey + email on the Pro-active arms. -->

src/lib/platform/index.ts LicenseStatusPayload (after Plans 02+03):
  | { state: "notActivated"; hasStoredKey: boolean }
  | { state: "licensed"; expiry: string | null; entitlements: string[]; maskedKey: string | null; email: string | null }
  | { state: "offlineGrace"; expiry: string | null; entitlements: string[]; maskedKey: string | null; email: string | null }
  | { state: "refreshNeeded"; hasStoredKey: boolean }
  | { state: "problem"; problem: LicenseProblem; hasStoredKey: boolean }

resolve.ts (D-85 flip point, line 19-23):
  CURRENT: const base = isTauriEnv() ? FULL_SET : FREE_SET;  // <-- swap the Tauri arm
  entitlements.ts: ENT_THEMING="pro.theming", ENT_ORDERING="pro.ordering", FREE_SET=∅, FULL_SET={both}.
  The payload.entitlements (string[]) maps DIRECTLY to an EntitlementSet (new Set(entitlements) intersected with known).

useLicenseUi() -> LicenseStatusPayload (the snapshot store); refreshLicenseUi() re-queries (pure-local).
refreshEntitlements() -> re-resolves the entitlement set (the proven D-32 live-flip path).
clearEntitlementsOverride() -> drops the D-31 override (UpsellPanel already calls it on activate).

UpsellPanel.tsx exports: UpsellPanel, UpsellModal, CARD_CLASS-style classes are module-private — REUSE by copying the
  class strings verbatim per UI-SPEC (CARD_CLASS, HEADING_CLASS, BODY_CLASS, PRIMARY_BTN_CLASS, SECONDARY_BTN_CLASS).

router.tsx: createHashRouter, children under <App/>; ENABLED_TOOLS.map for tool routes. ADD a sibling
  non-tool route { path: "settings/license", element: <LicenseSettings /> } — NOT derived from ENABLED_TOOLS.

Sidebar.tsx footer button (line ~605): openOrderingUpsell opens UpsellModal. D-88: for licensed/grace/refreshNeeded,
  route to #/settings/license instead; for free, keep the panel. useNavigate from react-router-dom.

CommandPalette.tsx: PaletteRow discriminated union { kind:"tool" } | { kind:"command", run }. Add a command row
  "License" / "License status" that navigates to #/settings/license (or opens the panel when free, per D-88).

preferences.ts: Preferences interface + DEFAULT_PREFERENCES + the merge in usePreferences. ADD a one-shot
  drop-notice flag (e.g. `licenseDropNoticeAck: boolean`) for D-84.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Flip resolve.ts Tauri arm to license_status (D-85) + drop-notice prefs flag</name>
  <read_first>
    - src/lib/entitlements/resolve.ts (the flip point line 19-23; isTauriEnv; the D-31 downgrade-only override)
    - src/lib/entitlements/entitlements.ts (ENT_THEMING/ENT_ORDERING/FREE_SET/FULL_SET/ALL_ENTITLEMENTS)
    - src/lib/platform/index.ts (platform.license.status() + the 5-state union)
    - src/lib/entitlements/resolve.test.ts (extend — the env-split + override tests)
    - src/shell/preferences.ts (Preferences + DEFAULT_PREFERENCES + the known-fields merge)
    - .planning/phases/21-license-lifecycle-ship-gate/21-CONTEXT.md (D-85 single flip point, D-86 non-destructive, D-31 downgrade-only)
  </read_first>
  <behavior>
    - Test: in the Tauri arm, a `licensed`/`offlineGrace` status with entitlements ["pro.theming","pro.ordering"] -> resolveEntitlements returns a set with BOTH (Pro active).
    - Test: a `notActivated`/`refreshNeeded`/`problem` status -> FREE_SET (locked).
    - Test: a `licensed` status carrying ONLY ["pro.theming"] -> set has theming, not ordering (entitlements drive the set, not a blanket FULL_SET).
    - Test: the D-31 override="free" still forces FREE even when status is licensed (downgrade-only, unchanged).
    - Test: the non-Tauri arm still returns FREE_SET deterministically (jsdom never touches licensing).
    - Test: an unknown entitlement string in the payload is ignored (intersect with ALL_ENTITLEMENTS) so a future code can't accidentally unlock.
  </behavior>
  <action>
    1. Flip resolve.ts: replace `const base = isTauriEnv() ? FULL_SET : FREE_SET;` with a Tauri arm that:
       - `if (!isTauriEnv()) base = FREE_SET;` (unchanged — deterministic free outside Tauri).
       - else: `const status = await platform.license.status();` then derive `base` from `status`:
         `licensed` or `offlineGrace` -> `new Set(status.entitlements.filter(e => ALL_ENTITLEMENTS.includes(e)))` (Pro active, only known entitlements);
         every other state (`notActivated`/`refreshNeeded`/`problem`) -> `FREE_SET`.
       Keep the existing `loadPreferences()` await + the downgrade-only override at the END (override "free" -> FREE_SET, never adds). Preserve the store-race-safe ordering. Update the doc comment: "Phase 21 flip is LIVE — the Tauri arm reads license_status (was hardcoded FULL_SET)."
    2. Add the D-84 one-shot drop-notice flag to preferences.ts: `licenseDropNoticeAck: boolean` (default `true` — meaning "nothing to acknowledge"; set to `false`/pending when a drop is detected, back to `true` on dismiss). Add to DEFAULT_PREFERENCES and the known-fields merge. (Exact mechanism is Claude's discretion within calm-tone — a one-shot prefs flag surfaced inline on the route per UI-SPEC.) Cover the prefs round-trip in the existing prefsStore/usePreferences test.
    3. resolve.test.ts: add all the behavior cases above using a test platform whose license.status() returns each state (setPlatformForTest with a stub, or mock platform.license.status).
  </action>
  <verify>
    <automated>pnpm exec vitest run src/lib/entitlements/resolve.test.ts src/shell/prefsStore.test.ts 2>&1 | grep -qE "passed|✓" && pnpm exec tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - resolve.ts no longer references `FULL_SET` in the Tauri arm: `grep -n "FULL_SET" src/lib/entitlements/resolve.ts` shows it removed/unused from the live resolution (import may remain only if tests use it; the Tauri base must come from license.status)
    - `grep "platform.license.status\|license.status()" src/lib/entitlements/resolve.ts` matches
    - `grep "ALL_ENTITLEMENTS" src/lib/entitlements/resolve.ts` matches (known-entitlement intersection)
    - `grep "licenseDropNoticeAck" src/shell/preferences.ts` matches and is in DEFAULT_PREFERENCES
    - `vitest run src/lib/entitlements/resolve.test.ts` exits 0 with the licensed/notActivated/override cases present
    - `tsc --noEmit` exits 0
  </acceptance_criteria>
</task>

<task type="auto" tdd="true">
  <name>Task 2: LicenseSettings route component + #/settings/license registration</name>
  <read_first>
    - src/components/UpsellPanel.tsx (CARD_CLASS/HEADING_CLASS/BODY_CLASS/PRIMARY_BTN_CLASS/SECONDARY_BTN_CLASS strings — copy verbatim; the inline aria-live status-line pattern; the UpsellModal focus-capture/return for the confirm reveal; the keyForm reveal-in-place pattern; ERROR_COPY map)
    - .planning/phases/21-license-lifecycle-ship-gate/21-UI-SPEC.md (the FULL state-copy table, fields, actions, destructive-action confirm copy, seat-taken copy, drop notice copy — ALL verbatim)
    - src/lib/platform/index.ts (the 5-state payload + maskedKey/email + LicenseErrorCode)
    - src/shell/useLicenseUi.ts + src/lib/license/licenseUi.ts (useLicenseUi hook + refreshLicenseUi)
    - src/lib/entitlements/store.ts (refreshEntitlements, clearEntitlementsOverride)
    - src/router.tsx (the children array; ENABLED_TOOLS.map; the App Outlet)
    - src/components/CopyButton.tsx (for the masked-key/email copy affordance — no hover-only copy)
  </read_first>
  <behavior>
    - Test: rendered with a `licensed` snapshot -> shows "Licensed" + the OK dot + "Licensed to {email} · key {masked}" line; Refresh + "Deactivate this device" buttons present and Tab-reachable.
    - Test: `notActivated` -> "Free" heading + the activation route/path copy (routes to / reveals the Unlock Pro panel — D-88).
    - Test: `offlineGrace` -> "Licensed (offline)" + the calm neutral body (no alarm color, no countdown).
    - Test: `refreshNeeded` -> "Pro is no longer active" + "Reactivate"/Refresh; ONE calm state (also the path a `suspended` drop lands on — D-83).
    - Test: `problem` -> "License needs attention" reusing the D-44 copy.
    - Test: Deactivate click reveals an inline confirm ("This frees your seat…") with Confirm "Deactivate" + Cancel "Keep Pro here"; focus moves to the confirm control on reveal.
    - Test: Refresh click calls platform.license.refresh + refreshLicenseUi + refreshEntitlements; in-flight shows "Refreshing…" via aria-live.
    - Test: a refresh that drops entitlements silently transitions to refreshNeeded (no error dialog — D-82).
    - Test: email absent -> "—" (em dash), never empty (D-89).
  </behavior>
  <action>
    Create `src/components/LicenseSettings.tsx` per the UI-SPEC contract (copy the UpsellPanel class constants verbatim — CARD_CLASS, HEADING/BODY, PRIMARY/SECONDARY button classes; do NOT introduce new sizes/tokens):
    - Reads `useLicenseUi()`; on mount calls `refreshLicenseUi()` (pure-local re-query — D-76 status-open trigger) AND `platform.license.refresh_if_needed`-via-the-silent-command if you expose it to JS (optional; the status-open background refresh) — at minimum the local re-query so the route always shows fresh state.
    - Single-column, scrollable, max-w content: a status block (state label + OK dot when licensed/offlineGrace via `text-ok` — the ONLY accent-adjacent semantic, dot only; never accent for state glyphs) above a 48px-separated management block (Refresh, Deactivate, Reactivate when applicable).
    - State copy table: render the EXACT copy from the UI-SPEC state table per `ui.state`. Status glyphs neutral (`text-tx-2` Lock or none), OK dot `text-ok` for licensed/offlineGrace only. offlineGrace/refreshNeeded/problem are CALM neutral (`text-tx-2`/`text-tx-3`) — NO `text-bad`, no red, no banner (D-77/D-83/ENT-04).
    - Fields: Licensee (email, font-mono, "—" if null), License key (masked, font-mono, never the raw key), Renews (human date from expiry; omit row for notActivated). Offer a CopyButton for the masked key/email (no hover-only copy).
    - Refresh button (PRIMARY_BTN_CLASS): calls platform.license.refresh(); aria-live "Refreshing…"; on success refreshLicenseUi() + refreshEntitlements() (live flip, no restart); a drop transitions silently to refreshNeeded.
    - Reactivate (refreshNeeded/problem): routes to / reveals the activation form (reuse the D-33 key field — simplest: navigate to the Unlock Pro panel, or embed the same key-input; per D-88 the panel owns the activation form, so a "Reactivate" that opens the panel is acceptable). Same action regardless of cause (D-83).
    - Deactivate (D-78): "Deactivate this device" SECONDARY (neutral, NOT red). Click reveals an INLINE confirm in place (no separate modal): confirm copy + "Deactivate" + "Keep Pro here". Focus moves to the confirm control on reveal, returns on cancel (mirror UpsellModal's focus contract). On confirm: call platform.license.deactivate(); aria-live "Deactivating…"; on success refreshLicenseUi()+refreshEntitlements() (drops to free). D-79 offline: if deactivate rejects `offline`, render the calm guidance "Connect to the internet to free this seat." in the SAME aria-live region as `text-tx-2` (calm, NOT text-bad) — and the local state is NEVER cleared (the Rust deactivate already does server-delete-first, so a blocked offline call clears nothing; just surface the message).
    - Seat-taken (D-80): not on this route (it's on activation), but ensure the ERROR_COPY.seatLimit extension copy from the UI-SPEC is reflected if a reactivation here hits seatLimit — two calm lines: the self-serve path + the "reply to your license email" fallback.
    - D-84 drop notice: when entitlements just dropped (detect via `licenseDropNoticeAck` pending), show a calm dismissable inline notice ("Your Pro features turned off. Your themes and tool order are saved — reactivate any time to bring them back.") with a "Got it" SECONDARY button that sets `licenseDropNoticeAck` true. Inline only — never a toast/dialog.
    - WCAG-AA: every control a native button/input Tab stop with `focus-visible:ring-2 focus-visible:ring-accent`; aria-live="polite" for all in-flight/result lines; no spinners.
    Register the route in router.tsx as a NON-tool child under <App/>: `{ path: "settings/license", element: <LicenseSettings /> }` — sibling to the ENABLED_TOOLS.map block, NOT inside it. Add a doc comment: app chrome, outside the six/eleven-tools registry constraint (D-87), HashRouter-friendly (reached at #/settings/license).
    Vitest: a LicenseSettings.test.tsx driving each state via setLicenseUiForTest + a stub platform, asserting copy + control presence + the confirm reveal + the deactivate/refresh handler calls (mock platform.license).
  </action>
  <verify>
    <automated>pnpm exec vitest run src/components/LicenseSettings.test.tsx 2>&1 | grep -qE "passed|✓" && pnpm exec tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `src/components/LicenseSettings.tsx` exists, >= 120 lines, renders all five states
    - `grep "settings/license" src/router.tsx` matches; the route is a sibling of the ENABLED_TOOLS.map (NOT inside it) — verify by reading: it is not produced by `.map`
    - `grep -c "Deactivate this device\|Keep Pro here\|Refreshing…\|Pro is no longer active" src/components/LicenseSettings.tsx` returns >= 3 (verbatim UI-SPEC copy)
    - `grep "platform.license.deactivate\|platform.license.refresh" src/components/LicenseSettings.tsx` matches
    - `grep "focus-visible:ring-accent" src/components/LicenseSettings.tsx` matches (WCAG focus ring)
    - the raw key is never rendered: the component reads `ui.maskedKey`/`ui.email`, never a raw key field (none exists on the payload)
    - `vitest run src/components/LicenseSettings.test.tsx` exits 0; `tsc --noEmit` exits 0
  </acceptance_criteria>
</task>

<task type="auto" tdd="true">
  <name>Task 3: State-dependent routing — footer + command palette (D-88) + dormant-restore proof</name>
  <read_first>
    - src/components/Sidebar.tsx (the footer license-attention button line ~605; openOrderingUpsell line ~96; useLicenseUi line 71; useNavigate import; the licenseAttention = state==="problem" line — extend for refreshNeeded)
    - src/components/CommandPalette.tsx (the PaletteRow union; the DEV command pattern line ~61; useNavigate line 124; how commands close-then-run)
    - src/lib/entitlements/entitlements.ts (gatePreferences — the D-86 render-time view that preserves stored prefs)
    - src/shell/usePreferences.ts (how gatePreferences is applied at the render layer)
    - .planning/phases/21-license-lifecycle-ship-gate/21-UI-SPEC.md (D-88 routing rules; footer label "License needs attention" for problem/refreshNeeded)
  </read_first>
  <behavior>
    - Test (footer): for `licensed`/`offlineGrace`/`refreshNeeded` the footer affordance navigates to #/settings/license; for free/notActivated it opens the Unlock Pro panel (D-88). The label is "License needs attention" for problem/refreshNeeded, "Unlock Pro" for free.
    - Test (palette): a "License" command row navigates to #/settings/license when licensed/grace/refreshNeeded, opens the panel when free; it is findable by typed query (same subsequence rule as the DEV toggle).
    - Test (dormant-restore, D-86): with entitlements FREE the gated prefs view renders default theme + empty order/pins while the STORED toolOrder/pinnedToolIds/theme are untouched; flipping entitlements to FULL restores the exact stored setup instantly (gatePreferences round-trip — likely already covered, extend if needed to assert the stored values are never mutated).
  </behavior>
  <action>
    1. Sidebar footer (D-88): extend `licenseAttention` to `state === "problem" || state === "refreshNeeded"`. Change the footer button handler: if the license state is licensed/offlineGrace/refreshNeeded/problem (i.e. there IS a license to manage), `navigate("/settings/license")`; only the pure free/notActivated case opens the Unlock Pro panel (openOrderingUpsell). Label: "License needs attention" when problem/refreshNeeded, else "Unlock Pro". Keep neutral tokens + min-h-6 + focus ring (no new alarm styling). offlineGrace must NOT add a footer nag (D-77) — offlineGrace shows no attention label, but the row may still route to the status route via the existing entry only if the user opens it; do NOT make offlineGrace surface a new footer row (keep it silent — the row appears for free/problem/refreshNeeded only, matching the pre-existing condition `!ents.has(ENT_ORDERING) || ... || licenseAttention`).
    2. CommandPalette (D-88): add a "License" command row (kind:"command") that, on run, closes the palette then either `navigate("/settings/license")` (licensed/grace/refreshNeeded/problem) or opens the upsell panel (free) — read useLicenseUi for the branch. It is NOT a DEV-only command (it ships in production, unlike the dev free-tier toggle), so place it as a real production command in the union; ensure it's findable by typed query and ranked after tools (same convention). Confirm `scripts/check-dev-strip.sh` still passes (this is a SHIPPED command, not a dev-only string — it must NOT be stripped; verify it's outside the `import.meta.env.DEV` guard).
    3. D-86 dormant-restore: verify (and extend tests for) the gatePreferences round-trip under the live flip — locked renders default, stored prefs untouched, unlock restores. No new code likely needed (the seam exists from Phase 18); add an explicit test asserting stored toolOrder/pinnedToolIds/theme are byte-unchanged across a lock→unlock cycle so the live flip can't regress D-86.
  </action>
  <verify>
    <automated>pnpm exec vitest run src/components/Sidebar.test.tsx src/components/CommandPalette.test.tsx 2>&1 | grep -qE "passed|✓" && pnpm exec tsc --noEmit && bash scripts/check-dev-strip.sh 2>&1 | tail -1</automated>
  </verify>
  <acceptance_criteria>
    - `grep "settings/license" src/components/Sidebar.tsx` matches (footer routes to the status route)
    - `grep "refreshNeeded" src/components/Sidebar.tsx` matches (licenseAttention extended)
    - `grep -c "settings/license" src/components/CommandPalette.tsx` returns >= 1 (License command navigates)
    - the License palette command is NOT inside the `import.meta.env.DEV` guard (verify by reading — it ships in production)
    - `bash scripts/check-dev-strip.sh` passes (the dev free-tier toggle string still stripped; the License command is a legit production string)
    - a test asserts stored prefs unchanged across lock→unlock (D-86 non-destructive)
    - `vitest run` (Sidebar + palette) exits 0; `tsc --noEmit` exits 0
  </acceptance_criteria>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: Real-WKWebView e2e + phase-boundary build + human walkthrough</name>
  <read_first>
    - docs/HARNESS.md (the e2e gate runbook — ports, preflight, WebKit quirks, the license e2e pollution reset)
    - test/e2e/license.e2e.ts + test/e2e/entitlements.e2e.ts (existing specs to extend/not-break; the prefs/Keychain reset preflight)
    - test/e2e/helpers.ts (assert/dispatchKey/navigateToTool/saveScreenshot)
    - .planning/phases/21-license-lifecycle-ship-gate/21-UI-SPEC.md (the interaction contract the auditor checks)
  </read_first>
  <action>Before the human gate, the agent automates everything: author test/e2e/license-settings.e2e.ts, run bash scripts/e2e-spike.sh (applying the deterministic prefs/override + dev-Keychain reset in the preflight to clear the known dev-toggle flake), confirm the full real-WKWebView suite green, then auto-run pnpm tauri build (hdiutil detach mounted DMGs + retry on the flake; confirm success via the .app/.dmg under src-tauri/target/release/bundle/macos/, not the exit code) and report the built-app path. The agent only pauses for the human walkthrough + gsd-ui-review AFTER all automated steps pass.</action>
  <what-built>
    The live D-85 free-tier flip + the #/settings/license status route + footer/palette routing + confirm-first deactivate + the drop notice, all wired to the real Rust 5-state payload. Plus a new `test/e2e/license-settings.e2e.ts` spec that, on the real WKWebView: navigates to #/settings/license, asserts the state copy + masked key + email fields render, drives the Refresh button (aria-live "Refreshing…"), reveals the Deactivate confirm and cancels it (focus returns), and (with a dev-injected free-tier flip) asserts theming/ordering lock with the stored prefs preserved (D-86). Reuses the license-e2e prefs/Keychain reset preflight to avoid pollution. The agent auto-runs `pnpm tauri build` at this checkpoint (its final non-zero exit may be only the absent updater-signing key — confirm via the .app/.dmg under src-tauri/target/release/bundle/macos/, NOT the exit code) and hands off the built-app path.
  </what-built>
  <how-to-verify>
    1. Agent runs `bash scripts/e2e-spike.sh` (the real-WKWebView gate) — full suite green, including the new license-settings spec and the UNMODIFIED entitlements/license specs (note the known shared dev-toggle e2e flake from deferred-items.md — apply the deterministic prefs/override reset in the preflight as part of this plan so it no longer cascades).
    2. Agent auto-runs `pnpm tauri build` (DMG flake: `hdiutil detach` any mounted volumes + retry) and reports the built `.app`/`.dmg` path.
    3. Human launches the built app and walks: open the License status route from the footer + from ⌘K "License"; confirm the state shows correctly; click Refresh (calm "Refreshing…", no spinner); reveal Deactivate, read the confirm copy, cancel (focus returns, Pro stays); toggle the dev free-tier flip and confirm theming + ordering/pinning LOCK with the lock badge (not hidden, no opacity-only) and that the user's saved theme/order/pins come right back on unlock (D-86); confirm OfflineGrace shows no footer nag (D-77) and refreshNeeded/problem do.
    4. A `gsd-ui-review` WCAG-AA audit passes for the new route (keyboard reachability from footer + palette, focus rings, aria-live, calm neutral tokens — no alarm color on grace/refreshNeeded/revoked states).
    5. MANUAL-WALKTHROUGH (Buy CTA opener — non-observable in e2e, see deferred-items.md "license-buy openUrl non-observable on hardened WKWebView"): in the free tier, open the upsell (footer "Unlock Pro" or ⌘K), click "Buy license", and confirm the OS DEFAULT BROWSER opens **https://tinkerdev.io/buy** while the app itself stays put (no in-app navigation, no crash). The positive openUrl-called-once-with-URL contract is unit-pinned (UpsellPanel.test.tsx); the real native browser-open is this manual item because every Tauri IPC layer on this WKWebView is non-writable/non-configurable and cannot be observed from WebDriver.
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues (e2e failures, build path, walkthrough or WCAG findings).</resume-signal>
  <acceptance_criteria>
    - `test/e2e/license-settings.e2e.ts` exists and the full real-WKWebView suite passes via `scripts/e2e-spike.sh`
    - the prior dev-toggle e2e flake is resolved by a deterministic preflight reset (entitlements/license specs green)
    - a fresh `pnpm tauri build` produced a `.app`/`.dmg` under `src-tauri/target/release/bundle/macos/`
    - human walkthrough certified the flip + route + deactivate-confirm + D-86 restore + D-77 silent grace
    - gsd-ui-review WCAG-AA passes for #/settings/license
    - decoder.ts + its 19 tests byte-for-byte untouched
  </acceptance_criteria>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| license_status payload → entitlement gate | The Rust payload now DRIVES the live entitlement set (D-85) — the flip point; a wrong mapping over- or under-grants. |
| webview → deactivate command | The deactivate action triggers a server seat-delete; offline must block without clearing local state. |
| masked key/email → DOM | Verified cert data rendered in the route; must never include the raw key. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-21-12 | Elevation (over-grant) | resolve.ts D-85 flip | mitigate | The Tauri arm intersects payload entitlements with ALL_ENTITLEMENTS (known set) so an unexpected/forged code can never unlock more than the two defined entitlements; non-licensed states map to FREE_SET; the D-31 override stays downgrade-only. Test-pinned (Task 1). |
| T-21-13 | Repudiation/Data-loss | offline deactivate (D-79) | mitigate | The Rust deactivate does server-delete-FIRST; an offline call rejects `offline` BEFORE any local clear, so the seat is never orphaned (local cert/Keychain stay intact). The UI surfaces calm guidance, clears nothing. Test + walkthrough. |
| T-21-14 | Information disclosure | masked key/email in DOM | mitigate | Only `maskedKey` (Rust-computed last-4) + the user's own email reach the DOM; the raw key has no payload field. CopyButton copies the masked form. LIC-04 holds. |
| T-21-15 | Tampering | dev free-tier toggle in a shipped build | mitigate | The dev free-tier toggle stays behind `import.meta.env.DEV` (check-dev-strip.sh tripwire); the NEW production "License" palette command is intentionally shipped and carries no privileged action (it only navigates). Grep-gated. |
</threat_model>

<verification>
- vitest (resolve, LicenseSettings, Sidebar, palette, prefsStore) + `tsc --noEmit` green; full suite green.
- `bash scripts/check-dev-strip.sh` passes (dev toggle stripped; License command shipped legitimately).
- Real-WKWebView e2e green incl. the new license-settings spec + the un-flaked entitlements/license specs.
- Fresh `pnpm tauri build` + human walkthrough + gsd-ui-review WCAG-AA.
- decoder.ts + 19 tests untouched.
</verification>

<success_criteria>
- The free-tier flip is LIVE: an unlicensed in-Tauri install locks theming + ordering/pinning, all 11 tools free.
- The #/settings/license route shows all five states, masked key + email, working Refresh + confirm-first Deactivate; keyboard-reachable, WCAG-AA, calm.
- Dormant customizations restore instantly on activate (D-86); the drop notice is one-time + dismissable (D-84); OfflineGrace is silent outside the route (D-77).
- Footer + palette route per D-88.
</success_criteria>

<output>
After completion, create `.planning/phases/21-license-lifecycle-ship-gate/21-04-SUMMARY.md`.
</output>
