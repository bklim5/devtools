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

### Note for the e2e re-run (spec ordering)
WDIO runs specs alphabetically against ONE shared `tauri dev` app + ONE prefs.json
(preflight wipes it once, up front). Tier-touching specs now leave Pro
(`entitlementsOverride:"full"`) persisted at cleanup. `license-settings.e2e.ts` runs
between them but asserts on `license_status` (notActivated / problem), which the
entitlement override does NOT affect — so a persisted "full" override does not break
its "Free at baseline" assertion. If a future spec asserts a FREE *entitlement*
baseline without calling `ensureFreeTier()` first, it must establish its own tier.
