---
phase: 21-license-lifecycle-ship-gate
plan: 04
subsystem: licensing
tags: [entitlements, tauri, react, hashrouter, wcag, e2e, license, react-router]

requires:
  - phase: 21-license-lifecycle-ship-gate (Plan 01)
    provides: expiry-aware resolve_status (OfflineGrace + RefreshNeeded states)
  - phase: 21-license-lifecycle-ship-gate (Plan 02)
    provides: 5-state license union in TS + silent background refresh scheduler
  - phase: 21-license-lifecycle-ship-gate (Plan 03)
    provides: maskedKey + email on Licensed/OfflineGrace payloads; revocation propagation; offline-deactivate no-clear gate
provides:
  - "D-85 flip LIVE: resolve.ts Tauri arm derives entitlements from license_status (was hardcoded FULL_SET)"
  - "#/settings/license status route (LicenseSettings.tsx) with all 5 states, masked key + email, Refresh, confirm-first inline Deactivate, one-time drop notice"
  - "State-dependent footer + ⌘K palette routing (D-88) — status route vs shared Unlock Pro upsell"
  - "DEV-only 'full' entitlements override (downgrade-only in prod) so e2e can reach Pro post-flip"
  - "Shell-level shared Unlock Pro modal (upsellStore + useUpsell + App.tsx mount) with synchronous invoker capture for reliable focus return"
affects: [21-05-ship-gate-matrix, future-settings-window, release]

tech-stack:
  added: []
  patterns:
    - "App-chrome non-tool route under <App/> (NOT in ENABLED_TOOLS) — #/settings/license"
    - "Entitlements derived from server license_status, intersected with ALL_ENTITLEMENTS (known set) so unknown strings can't over-grant"
    - "Shared shell-mounted modal opened via store with click-time invoker capture for decoupled focus return"
    - "DEV-only override branches gated behind import.meta.env.DEV + prod coercer + check-dev-strip tripwire"

key-files:
  created:
    - src/components/LicenseSettings.tsx
    - src/shell/upsellStore.ts
    - src/shell/useUpsell.ts
    - test/e2e/license-settings.e2e.ts
  modified:
    - src/lib/entitlements/resolve.ts
    - src/lib/entitlements/store.ts
    - src/router.tsx
    - src/App.tsx
    - src/components/Sidebar.tsx
    - src/components/CommandPalette.tsx
    - src/components/UpsellPanel.tsx
    - src/shell/preferences.ts
    - src/shell/prefsStore.ts
    - test/e2e/helpers.ts
    - test/e2e/entitlements.e2e.ts
    - test/e2e/license.e2e.ts
    - test/e2e/license-buy.e2e.ts
    - scripts/check-dev-strip.sh

key-decisions:
  - "D-85 flip is live: Tauri arm reads license_status; non-Pro states → FREE_SET; payload entitlements intersected with ALL_ENTITLEMENTS"
  - "DEV-only 'full' override (user-approved Option A) restores the Pro-reach path lost after the flip; prod stays strictly downgrade-only"
  - "Reactivate/Activate/⌘K-License open the SHARED Unlock Pro modal (shell-level store), not navigate('/') which silently bounced to a tool"
  - "Codex review #2: startup license-status path stays Keychain-free — route-only license_status_detail command preserves the Phase-19 'licensed launch never touches Keychain' invariant"
  - "DEV __devSetTier seam was tried then reverted — it regressed the real-WKWebView gate; helpers hardened on the proven ⌘K toggle path instead"

patterns-established:
  - "App-chrome route: status/settings pages live under <App/> outside the tool registry, HashRouter-reachable"
  - "Calm-tone entitlement-drop UX: one-shot prefs flag (licenseDropNoticeAck) surfaced inline, never a toast"
  - "Focus return for shell-mounted modals: capture invoker synchronously at open time, not from document.activeElement at unmount"

requirements-completed: [LIC-09, LIC-05, LIC-07, LIC-08]

duration: ~multi-session (Wave 4)
completed: 2026-06-15
---

# Phase 21 Plan 04: Status Route + Free-Tier Flip Summary

**The live D-85 free-tier flip (resolve.ts Tauri arm now reads license_status) plus the keyboard-reachable, WCAG-AA #/settings/license status route with masked key + email, confirm-first Deactivate, drop notice, and state-dependent footer/palette routing — implementation complete; the real-WKWebView human-verify gate is still OPEN.**

> STATUS: Implementation + automated gates COMPLETE. The Wave-4 human-verify checkpoint (Task 4) — live walkthrough on the built app + `gsd-ui-review` WCAG-AA sign-off + the manual Buy-CTA browser-open check — remains OPEN. This SUMMARY does NOT claim human sign-off.

## Performance

- **Duration:** Multi-session (Wave 4, the heaviest plan in the phase)
- **Completed (implementation):** 2026-06-15
- **Tasks:** 3 of 4 (Tasks 1–3 auto, committed; Task 4 = open human-verify checkpoint)
- **Files modified/created:** ~18

## Accomplishments

- **D-85 flip is LIVE.** `resolve.ts`'s Tauri arm now derives the entitlement set from the Rust `license_status` command: `licensed`/`offlineGrace` → `new Set(entitlements)` intersected with `ALL_ENTITLEMENTS`; every other state (`notActivated`/`refreshNeeded`/`problem`) → `FREE_SET`. An unlicensed in-Tauri install now actually locks theming + ordering/pinning; all 11 tools stay free. The D-31 override stays downgrade-only in prod.
- **`#/settings/license` status route** (`LicenseSettings.tsx`): all 5 states with verbatim UI-SPEC copy, masked key + licensee email (em-dash fallback, D-89), Refresh (aria-busy + aria-live), confirm-first **inline** Deactivate (D-78/D-79 offline never-clear), a one-time dismissable entitlements-drop notice (D-84), Reactivate/Activate, and D-86 dormant-restore.
- **State-dependent routing (D-88):** footer attention + ⌘K "License" command route to the status route (licensed/grace/refreshNeeded/problem) or open the shared Unlock Pro upsell (free).
- **Shared shell-level Unlock Pro modal** (`upsellStore` + `useUpsell` + once-mounted in `App.tsx`) so Reactivate/Activate/⌘K-License reliably open it with correct focus return — replacing the `navigate("/")` that silently bounced to a tool.
- **All automated gates green:** vitest 940, tsc (root + server/webhook), eslint, `check-dev-strip.sh`, decoder + 19 tests untouched. WCAG-AA code audit 24/24 (0 BLOCK; 3 FLAGs resolved). Real-WKWebView e2e reported stable at 18/18 across runs by the deviation log. A fresh `pnpm tauri build` was produced.

## Task Commits

Tasks committed atomically (TDD: test → feat; plus codex-review and walkthrough fixes):

1. **Task 1: Flip resolve.ts to license_status (D-85) + drop-notice flag** — `81c6eddc` (feat)
2. **Task 2: LicenseSettings route + #/settings/license registration** — `4441a92f` (feat)
3. **Task 3: State-dependent footer + palette routing (D-88) + D-86 restore proof** — `e411c5c6` (feat)
4. **Task 4 prep: license-settings e2e spec + deterministic prefs preflight** — `4b126674` (test)
5. **Tasks 1–3 landed marker** — `fe54d7d7` (docs)

**Task 4 reconciliation (e2e gate, DEV-only Pro-reach — see Deviations):**
- `6d5b3d9f` feat: DEV-only "full" entitlements override (Pro-reach for e2e)
- `c8249564` feat: dev toggle flips effective tier (Pro↔Free) + strip "full" from prod
- `fcb846fc` test: reconcile e2e specs to establish Pro tier explicitly (post-D-85)
- `fc47f4af` docs: log the Task 4 reconciliation deviation
- `861eaffc` test: re-establish Pro after reload + reconcile license cleanup (D-86)
- `0c755c70` / `16de5e00` / `cafe2dc9` test/docs: opener recorder diagnostics → reconcile to observable contracts + record openUrl non-observability

**Walkthrough fixes (shared upsell + focus/aria):**
- `c6a96755` fix: free-tier ⌘K License opens the shared Unlock Pro upsell (no silent navigate)
- `4bf08f3c` fix: Reactivate/Activate open the shared upsell, not navigate("/")
- `d1cb4b86` fix: capture upsell invoker at open time for reliable focus return
- `565ec878` fix: announce license status change + aria-busy on Refresh
- `f521553a` / `aee32188` test: e2e-prove the upsell-modal fixes + mark UI-REVIEW flags resolved

**DEV seam regression — tried then reverted:**
- `2d580b49` / `ca029417` feat/test: deterministic `__devSetTier` seam (later regressed the gate)
- `3ad0e716` revert: remove the unreliable `__devSetTier` DEV seam
- `dee06adc` test: harden ensureProTier/ensureFreeTier on the proven ⌘K toggle

**Codex review fixes:**
- `d263067f` fix: await initPlatform before reading license status in resolveEntitlements (no Pro→FREE boot flash)
- `931b7bca` fix: keep the startup license-status path Keychain-free (D-89 regression)
- `daf6a5fb` fix: return upsell focus to a persistent invoker for transient openers
- `7c7f944b` fix: drive needs_refresh test off a controlled clock (no wall-clock flake)

**Adjacent:** `106dd3f8` docs: seed native Settings/Preferences window (backlog 999.9)

## Files Created/Modified

- `src/lib/entitlements/resolve.ts` — D-85 flip: Tauri arm derives entitlements from `license_status`, intersected with `ALL_ENTITLEMENTS`; awaits `initPlatform` (no boot flash); DEV-only "full" override branch (prod tree-shaken)
- `src/lib/entitlements/store.ts` — effective-tier dev toggle; `__devSetTier` seam later removed
- `src/components/LicenseSettings.tsx` — the status route UI (5 states, masked key/email, Refresh, confirm-first Deactivate, drop notice, Reactivate)
- `src/router.tsx` — `#/settings/license` registered as a non-tool child under `<App/>`
- `src/App.tsx` — mounts the shared Unlock Pro modal once
- `src/shell/upsellStore.ts` / `src/shell/useUpsell.ts` — shared upsell open-state + synchronous invoker capture
- `src/components/Sidebar.tsx` — footer routes to status route vs upsell (D-88); `licenseAttention` extended to refreshNeeded
- `src/components/CommandPalette.tsx` — production "License" command (state-dependent route/upsell)
- `src/components/UpsellPanel.tsx` — invoker-capture focus return; class constants reused by LicenseSettings
- `src/shell/preferences.ts` / `src/shell/prefsStore.ts` — `licenseDropNoticeAck` one-shot flag; override type widened to `"free" | "full" | null` (prod coercer nulls "full")
- `scripts/check-dev-strip.sh` — proves the DEV-only "full" override is absent from prod dist
- `test/e2e/license-settings.e2e.ts` (new) + reconciled `entitlements`/`license`/`license-buy` specs + shared `ensureProTier`/`ensureFreeTier` helpers

## Decisions Made

- **D-85 single flip point honored** — only `resolve.ts`'s Tauri arm changed; non-Pro states fail closed to free; payload entitlements intersected with the known set so a forged/unknown code can't over-grant (T-21-12).
- **Option A DEV-only "full" override** (user-approved) restores the Pro-reach path that the flip removed for e2e; prod stays strictly downgrade-only, enforced by the coercer + `check-dev-strip.sh`.
- **Shared shell-mounted upsell** replaces per-call navigation; invoker captured synchronously at click time so focus return survives the decoupled mount gap (UI-REVIEW E1 resolved).
- **Startup stays Keychain-free** — the route uses a separate `license_status_detail` command; the boot path never reads the Keychain, preserving the Phase-19 invariant (cargo-pinned).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Lost Pro-reach path after the D-85 flip (DEV-only "full" override)**
- **Found during:** Task 4 (real-WKWebView e2e gate — first run 14 pass / 4 fail)
- **Issue:** The flip made an unlicensed in-Tauri install resolve FREE at baseline; the old override was downgrade-only (`"free" | null`) so the Pro-gated specs (entitlements/license/license-buy/sidebar) had no way to reach Pro.
- **Fix:** Added a DEV-only `entitlementsOverride === "full"` → FULL_SET branch (gated by `import.meta.env.DEV`, prod coercer nulls it, tree-shaken); the dev ⌘K toggle flips the EFFECTIVE tier; specs reconciled to establish Pro explicitly without weakening locked-UX coverage; `check-dev-strip.sh` extended.
- **Files modified:** `resolve.ts`, `preferences.ts`, `prefsStore.ts`, `CommandPalette.tsx`, `check-dev-strip.sh`, `test/e2e/helpers.ts` + 4 specs
- **Verification:** vitest green, `check-dev-strip.sh` proves "full" absent from prod dist
- **Committed in:** `6d5b3d9f`, `c8249564`, `fcb846fc`

**2. [Rule 1 - Bug] license-buy openUrl non-observable on hardened WKWebView**
- **Found during:** Task 4 e2e re-run (16 pass / 2 fail — harness observation fragility, not a product defect)
- **Issue:** Every IPC transport layer (`invoke`/`ipc`/`postMessage`) is installed non-writable/non-configurable (and frozen), so the e2e cannot observe the `openUrl` IPC call.
- **Fix:** `license-buy.e2e.ts` now asserts the OBSERVABLE in-app contract (Buy CTA Tab-reachable, click does not navigate the in-app hash, does not crash the modal). The positive "openUrl called once with https://tinkerdev.io/buy" contract is pinned authoritatively by the unit suite (`UpsellPanel.test.tsx`). The real native browser-open is a **MANUAL-WALKTHROUGH item** at the human-verify gate.
- **Files modified:** `test/e2e/license-buy.e2e.ts`, `test/e2e/license.e2e.ts`
- **Committed in:** `cafe2dc9`, `16de5e00`

**3. [Rule 1 - Bug: regression] `__devSetTier` DEV seam regressed the gate — reverted**
- **Found during:** pre-Wave-5 harness hardening
- **Issue:** The deterministic `window.__devSetTier` seam was genuinely UNDEFINED at `browser.execute` time on the running `tauri dev` page (the main.tsx top-level assignment was not observable from the realm WebDriver sees), regressing the gate deterministically (14/4 on all 3 runs).
- **Fix:** Removed the seam entirely (no dead code); hardened `ensureProTier`/`ensureFreeTier` on the PROVEN ⌘K `runDevToggle()` path (re-read effective tier per attempt, toggle only on mismatch, transient failures retry, bounded waitUntil). The `"full"` override resolution + downgrade-only `clearEntitlementsOverride` stay (they serve the live dev toggle + activation).
- **Files modified:** `main.tsx`, `store.ts`, `resolve.test.ts`, `check-dev-strip.sh`, `test/e2e/helpers.ts`
- **Verification:** vitest 934 → 940, `check-dev-strip.sh` green; entitlements.e2e.ts still exercises the genuine ⌘K toggle (D-31/D-32 coverage retained)
- **Committed in:** `3ad0e716`, `dee06adc`

**4. [Rule 2 - Missing critical] Walkthrough routing + a11y fixes (shared upsell, focus, aria)**
- **Found during:** Task 4 walkthrough prep + UI-REVIEW
- **Issue:** ⌘K "License"/Reactivate/Activate used `navigate("/")`, which silently bounced to a tool instead of opening the activation modal; status-label change on a silent refresh-drop was not announced; Refresh busy state was color-only.
- **Fix:** Shell-level shared Unlock Pro modal (`upsellStore`/`useUpsell`/`App.tsx`) with synchronous invoker capture for focus return; wrapped the status heading in `aria-live="polite"`; added `aria-busy` to Refresh.
- **Files modified:** `LicenseSettings.tsx`, `UpsellPanel.tsx`, `Sidebar.tsx`, `CommandPalette.tsx`, `App.tsx`, `upsellStore.ts`, `useUpsell.ts`
- **Verification:** UI-REVIEW E1/P6/P3b marked RESOLVED; jsdom + e2e focus-return proofs
- **Committed in:** `c6a96755`, `4bf08f3c`, `d1cb4b86`, `565ec878`, `f521553a`, `aee32188`

**5. [Rule 1 - Bug] Codex-review fixes (boot flash, Keychain-at-startup, transient focus, clock flake)**
- **Found during:** `/codex:review` on the working tree
- **Issue:** #1 platform-init race could flash Pro→FREE at boot; #2 `resolve_status` read the Keychain at startup (violated the Phase-19 invariant); #3 focus return failed for transient invokers; #4 needs_refresh test used the wall clock.
- **Fix:** #1 `resolveEntitlements` awaits `initPlatform`; #2 split a route-only `license_status_detail` command so the boot path is Keychain-free (cargo-pinned); #3 `openUpsell(invoker)` returns focus to a persistent invoker; #4 needs_refresh test driven off a controlled clock.
- **Committed in:** `d263067f`, `931b7bca`, `daf6a5fb`, `7c7f944b`

---

**Total deviations:** 5 auto-fixed (1 blocking, 1 missing-critical, 3 bug incl. 1 regression-revert)
**Impact on plan:** All necessary for correctness, security, and a passing gate after the live flip. The DEV-only "full" override is the only added surface and is prod-stripped + tripwire-gated. No scope creep; the six/eleven-tools and decoder constraints are intact.

## Issues Encountered

- **Real-WKWebView IPC is fully locked down** — the hardened WebView makes the `openUrl` IPC call unobservable from WebDriver, forcing the observable-contract restructure (unit suite holds the positive assertion; manual walkthrough holds the native browser-open). Recorded to MEMORY-adjacent deferred log.
- **DEV seam non-observability** — a top-level `window.__devSetTier` assignment was not visible to `browser.execute`; reverted in favor of the proven ⌘K path.

## Open Human-Verify Items (Task 4 — gate NOT closed)

The Wave-4 `checkpoint:human-verify` is OPEN. Required before phase sign-off:
1. **Walkthrough on the built app:** open the License route from the footer + ⌘K "License"; correct state copy; Refresh shows calm "Refreshing…" (no spinner); reveal Deactivate, read confirm copy, cancel (focus returns, Pro stays); toggle the dev free-tier flip → theming + ordering/pinning LOCK (lock badge, not hidden) and the saved theme/order/pins come back on unlock (D-86); OfflineGrace shows no footer nag (D-77), refreshNeeded/problem do; no boot flash, no startup Keychain prompt.
2. **MANUAL Buy-CTA check (non-observable in e2e):** in free tier, open the upsell, click "Buy license" → OS default browser opens `https://tinkerdev.io/buy` while the app stays put.
3. **`gsd-ui-review` WCAG-AA** live confirmation for `#/settings/license` (code audit already 24/24).

This executor is headless and cannot drive the GUI; the orchestrator owns re-running `scripts/e2e-spike.sh` and the human walkthrough.

## Next Phase Readiness

- The free-tier flip + status route are ready for the Plan 21-05 ship-gate matrix (which exercises the same states on the real build).
- Blocker carried forward: the live prod-CE ship-gate cases depend on Phase 20 PAY-03 (a real minted key).
- Native Settings/Preferences window seeded to backlog (999.9) — not in scope here.

## Self-Check: PASSED

Verified against repo state:
- `src/components/LicenseSettings.tsx` — FOUND
- `src/shell/upsellStore.ts`, `src/shell/useUpsell.ts` — FOUND
- `test/e2e/license-settings.e2e.ts` — FOUND
- Commits `81c6eddc`, `4441a92f`, `e411c5c6`, `6d5b3d9f`, `d263067f`, `7c7f944b`, `dee06adc` — FOUND in `git log`

Caveat (honest): this SUMMARY reflects COMPLETED implementation with automated gates green. The Task 4 human-verify checkpoint (walkthrough + manual Buy-CTA + live gsd-ui-review) is OPEN. No human sign-off is claimed.

---
*Phase: 21-license-lifecycle-ship-gate*
*Implementation completed: 2026-06-15 — human-verify gate OPEN*
