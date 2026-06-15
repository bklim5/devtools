# Phase 21 — Deferred / Deviation Log

## 21-04 Task 4 reconciliation — planning gap (recorded as a deviation)

**Type:** [Rule 2 - missing critical functionality] + planning gap

**Found during:** Task 4 (real-WKWebView e2e gate, first run: 14 passing / 4 failing).

**Root cause:** The D-85 flip made `resolve.ts`'s Tauri arm derive entitlements from
`license_status`. With the e2e-spike preflight wiping prefs.json + machine.dev.lic,
an unlicensed in-Tauri install now resolves FREE at baseline. The D-31 dev override
was downgrade-only (`"free" | null`) and the dev "Toggle free tier" command only
flipped `null ⇄ "free"` — post-flip both resolve FREE, so there was NO way for the
Pro-gated e2e specs to reach Pro. The plan assumed the 4 specs
(entitlements / license / license-buy + the 4 sidebar tests) would pass unmodified;
it never accounted for the lost Pro path after the flip.

**Fix (user-approved Option A — DEV-only "full" override):**
1. `resolve.ts`: added a DEV-only branch — `entitlementsOverride === "full"` →
   FULL_SET only under `import.meta.env.DEV`. Prod stays strictly downgrade-only
   (branch tree-shaken + coercer nulls "full"). Test-pinned in resolve.test.ts.
2. `preferences.ts` / `prefsStore.ts`: widened the type to `"free" | "full" | null`;
   the coercer honors "full" only under `isTestOrDev()` (prod nulls it).
3. `CommandPalette.tsx`: the dev "Toggle free tier" command now flips the EFFECTIVE
   tier (reads the live snapshot) — writes "full" from FREE, "free" from Pro —
   restoring the pre-flip Pro⇄Free dev toggle regardless of baseline.
4. `scripts/check-dev-strip.sh`: extended to also prove the DEV-only
   `entitlementsOverride:"full"` write is absent from dist/assets (T-21-15). Passing.
5. `test/e2e/helpers.ts`: shared `ensureProTier()` / `ensureFreeTier()` (idempotent,
   racy-propagation retry) + shared `unlockProFooterPresent()`.
6. The 4 specs reconciled WITHOUT weakening coverage: sidebar's reorder/pin/roving/
   Tab-pin run under explicitly-established Pro; entitlements seeds under Pro then
   proves the locked UX under free then restores; license/license-buy establish the
   free tier explicitly for the activation/Buy flows. Locked-UX coverage stays in
   entitlements.e2e.ts.

**Commits:**
- 6d5b3d9f feat(21-04): add DEV-only "full" entitlements override (Pro-reach for e2e)
- c8249564 feat(21-04): dev toggle flips effective tier (Pro<->Free) + strip "full" from prod
- fcb846fc test(21-04): reconcile e2e specs to establish Pro tier explicitly (post-D-85)

**Unit gate:** green — vitest 925/925, tsc (root + server/webhook) 0, eslint 0 errors
(2 pre-existing react-refresh warnings in SidebarResetMenu.tsx, out of scope).
`pnpm build` + `check-dev-strip.sh` pass. decoder.ts + its 19 tests byte-for-byte
untouched.

**STILL OPEN (orchestrator action):** the real-WKWebView e2e gate
(`scripts/e2e-spike.sh`) must be RE-RUN — this executor is headless and cannot drive
the GUI. The 21-04 human-verify checkpoint (walkthrough + `gsd-ui-review` WCAG-AA +
`pnpm tauri build`) remains open. Do NOT write 21-04-SUMMARY.md or finalize ROADMAP
until the gate closes.

## 21-04 Task 4 reconciliation (iteration 3) — license-buy openUrl non-observable on hardened WKWebView

**Type:** [Rule 3 - blocking e2e-harness limitation] + honest-coverage restructure (fallback b)

**Found during:** Task 4 e2e re-run 3 (16 passing / 2 failing). The 2 failures were
e2e-harness observation fragility, NOT product defects.

**license-buy.e2e.ts — the openUrl(url) call is genuinely non-observable here.**
The iteration-1/2 recorder wrapped `window.__TAURI_INTERNALS__.invoke` to record the
`plugin:opener|open_url` command. It reported `installed=true` but observed ZERO
commands (not even mount-time `license_status`). Root cause (verified against the
injected Tauri runtime scripts): every layer of the IPC transport on this WKWebView
is installed with `Object.defineProperty` and NO writable/configurable flags (both
default `false`):
- `invoke` — non-writable, non-configurable (tauri-2.11.2 scripts/core.js:81)
- `ipc` — non-writable, non-configurable, value additionally `Object.freeze`d (scripts/ipc.js:142)
- `postMessage` — non-writable, non-configurable (scripts/ipc-protocol.js:88)

So `internals.invoke = wrapper` is a SILENT no-op, and `Object.defineProperty`
cannot redefine the locked-down property either. `@tauri-apps/api/core`'s `invoke`
reads `window.__TAURI_INTERNALS__.invoke` at call time, but the property can never be
replaced from a `browser.execute` context. tauri-plugin-webdriver also exposes no
pre-load init-script hook to land a wrapper before core.js defines (and locks) the
property. **Approach (a) — observe the real IPC path — is impossible on this runtime.**

**Resolution (fallback b — honest observable contract, NOT a vacuous pass):**
- `license-buy.e2e.ts` now asserts the OBSERVABLE in-app contract on the real
  WKWebView: the free-tier upsell renders a Tab-reachable "Buy license" CTA, and
  clicking it does NOT navigate the in-app route (hash unchanged) and does NOT
  crash/unmount the modal (calm best-effort, never throws — T-20-01/D-67). A dead or
  disconnected onClick that navigated or threw would still FAIL this spec.
- The positive "openUrl called EXACTLY ONCE with https://tinkerdev.io/buy" contract
  is pinned AUTHORITATIVELY by the unit suite (`UpsellPanel.test.tsx` — "renders the
  'Buy license' CTA ... that opens the checkout via the opener seam (PAY-01/D-67)"
  + the best-effort no-throw + the `BUY_LICENSE_URL` constant tests). Wiring:
  `UpsellPanel.tsx` → `platform.opener.openUrl(BUY_LICENSE_URL)` → `tauri.ts:131-133`
  → `@tauri-apps/plugin-opener` `openUrl`.

**MANUAL-WALKTHROUGH ITEM (the human-verify gate MUST cover this):**
> Confirm the Buy CTA opens **https://tinkerdev.io/buy** in the OS default browser:
> in the free tier, open the upsell (footer "Unlock Pro" or ⌘K), click "Buy license",
> and verify the OS default browser navigates to https://tinkerdev.io/buy (the app
> itself stays put — no in-app navigation, no crash).

**license.e2e.ts — fragile cleanup assertion removed.**
The iteration-2 final `waitUntil(footerLabel() === null)` ran as the test's last
statement and asserted the tier flip succeeded in cleanup on the corrupt-machine.lic
path; `ensureProTier()` does not reliably hide the footer from the just-cleared
problem state on this WKWebView, failing the whole test even though the SUBJECT
(inline form reveal, D-37 value retention, D-43/D-44 corrupt-cert footer/panel
attention) passed. Cleanup now re-establishes Pro BEST-EFFORT (no assertion) and
relies on the next spec's own deterministic setup (the suite is setup-per-spec).

**Files changed (atomic):** test/e2e/license-buy.e2e.ts, test/e2e/license.e2e.ts.
**Unit gate:** green — vitest 925/925, tsc (root + server/webhook) 0, eslint 0 errors
(the 2 pre-existing react-refresh warnings in SidebarResetMenu.tsx remain out of
scope), check-dev-strip.sh pass. decoder.ts + its 19 tests byte-for-byte untouched.

**STILL OPEN (orchestrator action):** re-run `scripts/e2e-spike.sh` (headless executor
cannot drive the GUI) — expect all 18 specs green. SUMMARY/ROADMAP NOT finalized.

### Note for the e2e re-run (spec ordering)
WDIO runs specs alphabetically against ONE shared `tauri dev` app + ONE prefs.json
(preflight wipes it once, up front). Tier-touching specs now leave Pro
(`entitlementsOverride:"full"`) persisted at cleanup. `license-settings.e2e.ts` runs
between them but asserts on `license_status` (notActivated / problem), which the
entitlement override does NOT affect — so a persisted "full" override does not break
its "Free at baseline" assertion. If a future spec asserts a FREE *entitlement*
baseline without calling `ensureFreeTier()` first, it must establish its own tier.

## 21-04 hardening — tier-establishment flake RESOLVED (deterministic DEV seam)

**Type:** [Rule 1 - bug fix: e2e flake] pre-Wave-5 harness hardening.

**The flake (now fixed):** `ensureProTier()` / `ensureFreeTier()` (test/e2e/helpers.ts)
were intermittently flaky (~1-in-9 real-WKWebView runs; "could not establish the free
tier via the dev toggle (the 'Unlock Pro' footer never appeared)"). Root cause: both
helpers drove the entire ⌘K palette dev-toggle dance (`runDevToggle()` — open palette →
type "toggle free" → ArrowUp → Enter → close → wait for the footer to flip), ~6
timing-sensitive WKWebView steps. The dev toggle is BIDIRECTIONAL on the EFFECTIVE
tier, so a lagging entitlements snapshot could read the OLD tier and flip the WRONG
way, oscillating; and `runDevToggle()` sat OUTSIDE the retry try/catch, so a transient
mid-dance failure aborted with no retry. Wave 5's 8-case ship-gate matrix leans on
tier transitions, so this had to be deterministic.

**Fix (deterministic DEV-only tier-set seam):**
1. `src/lib/entitlements/store.ts`: added `setDevTier("pro"|"free"|"default")` — a
   DEV-only (`isTestOrDev()`-gated) single state SET (NOT a toggle) that writes the
   matching `entitlementsOverride` ("full"/"free"/null) via the existing
   `savePreferences` + `refreshEntitlements` path and awaits the resolved set. No
   oscillation possible — callers never read-then-flip.
2. `src/main.tsx`: registered `window.__devSetTier` ONLY under `import.meta.env.DEV`
   (tree-shaken from every release bundle) → `setDevTier`.
3. `test/e2e/helpers.ts`: `ensureProTier`/`ensureFreeTier` rewritten on the seam —
   SET the exact target, waitUntil the footer probe reflects it, bounded retry that
   RE-SETS the SAME target idempotently (never flips). Helper doc comments updated.
4. `scripts/check-dev-strip.sh`: extended to assert `__devSetTier` is ABSENT from the
   release dist (alongside the existing "Toggle free tier" + `entitlementsOverride:"full"`
   checks). Passing.

**Regression coverage retained:** `entitlements.e2e.ts` STILL exercises the genuine ⌘K
palette `runDevToggle()` path (the D-31/D-32 searchable-dev-command proof — runDevToggle
+ its assertions are NOT deleted). Other specs (license / license-settings / sidebar)
use the deterministic seam as a mere precondition.

**Production behavior unchanged:** D-85 flip + D-31 downgrade-only-in-prod invariants
intact; the seam is DEV-only and stripped from release (check-dev-strip.sh proves
`__devSetTier` + the "full" override write absent from dist/assets). No new webview
runtime deps.

**Unit gate:** green — vitest 939/939 (+14, incl. 5 new setDevTier tests), tsc
(root + server/webhook) 0, eslint 0 errors (the 2 pre-existing SidebarResetMenu.tsx
react-refresh warnings remain out of scope). `pnpm build` + `check-dev-strip.sh` pass.
decoder.ts + its 19 tests byte-for-byte untouched.

**STILL OPEN (orchestrator action):** re-run `scripts/e2e-spike.sh` REPEATEDLY (this
executor is headless and cannot drive the GUI) to confirm the flake is gone across
multiple real-WKWebView runs. SUMMARY/ROADMAP/STATE NOT finalized — the 21-04
human-verify gate remains open.
