# Phase 18 — Deferred Items

Out-of-scope discoveries logged during execution (not fixed in-plan).

## 1. Stale-hook whole-blob prefs writes can clobber out-of-band pref changes (codex P3, Plan 03 Task 3)

- **Found:** 18-03 Task 3 codex review of the DEV "Toggle free tier (dev)" command.
- **Issue:** `usePreferences` instances each hold a `prefsRef` snapshot and persist the WHOLE blob on any setter. A pref changed out-of-band (the dev toggle's `entitlementsOverride`, or any future non-hook writer) is silently reverted by the next setter call from a hook instance that loaded before the change (e.g. `useTrackActiveTool` writing `lastUsedId` on navigation).
- **Why deferred:** pre-existing last-writer-wins architecture of the prefs seam (multiple hook instances already coexist since v1.0); a fix needs hook-level external-write sync or store-level field merge — an architectural change beyond 18-03's scope. The LIVE entitlements snapshot is unaffected in-session (the entitlements store, not prefs hooks, is the sync channel); impact is limited to the persisted DEV-only override surviving restart after an intervening prefs write.
- **Suggested home:** Phase 21 (license lifecycle) — it reworks how the resolved set is sourced anyway; or a small `savePreferences` field-merge if the dev toggle proves flaky in the Plan 04 e2e.
