---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Executing Phase 02
last_updated: "2026-05-30T19:57:23.676Z"
progress:
  total_phases: 6
  completed_phases: 1
  total_plans: 8
  completed_plans: 7
  percent: 88
---

# Project State

## Current Position

Phase: 02 (shell) — EXECUTING
Plan: 4 of 4 (02-01 ✓ done; 02-02 ✓ done; 02-03 ✓ done; 02-04 next)
**Phase 2: Shell** — EXECUTING (4 plans across 3 waves). Phase 1 is COMPLETE and human-signed-off.

wave: 1 ✓ COMPLETE (02-01 ✓ foundation; 02-02 ✓ fuzzy ranker). wave: 2 ✓ COMPLETE (02-03 ✓ prefs/recents/startup-resolution). Next: wave 3 (02-04 Sidebar + ⌘K palette + App shell, ending with the phase human-verify checkpoint).

## Active Plan

`02-01`, `02-02`, `02-03` ✓ COMPLETE (waves 1-2 done). Next up: `02-04-PLAN.md` (Phase 2, wave 3 — Sidebar + ⌘K palette + App.tsx shell chrome, consuming the shell `@theme` tokens, `rankTools`, `usePreferences` (theme/accent), and `useRecentTools` (palette recents group)). This is the last plan; it ends with the phase human-verify checkpoint.

## Recent Activity

- Plan 01-01 ✓ scaffold, lib ported (19 tests), fonts, dark window
- Plan 01-02 ✓ HashRouter, env-safe platform seam, throwaway skeleton (32 tests); codex-reviewed + /simplify applied; render bug fixed; real-webview UI verified via chrome-devtools-mcp screenshot (paste→hex, focusable copy, status bar all good)
- Plan 01-03 ✓ lefthook unit gate (proven to block), first tauri build smoke (DMG + .app, adhoc-signed, launch confirmed)
- Plan 01-04 ✓ COMPLETE — Task-3 human-verify checkpoint **reviewed & approved by the user (2026-05-30)**; Phase 1 fully signed off:
  - **D-01 automation path PROVEN**: `bash scripts/e2e-spike.sh` drives the real macOS WKWebView (find→sendKeys→screenshot, 1 passing, exit 0). Screenshot at `test/e2e/__screenshots__/skeleton-wkwebview.png`. This is the per-task UI-gate driver for Phases 2-6 (HRN-02 recorded in docs/phase-0-notes.md).
  - **Gating BUG fixed (T-01-10)**: webdriver was in plain `[dependencies]` (shipped in release). Now an optional dep + double gate `#[cfg(all(debug_assertions, feature = "webdriver"))]`. Verified absent from release: `cargo tree --release | grep webdriver`=0, no webdriver strings in binary, :4445 unbound when release .app runs. (`[target.'cfg(debug_assertions)'.dependencies]` does NOT work — Cargo rejects it.)
  - **Gate has teeth**: hover-only-copy regression → spike FAILS (`copy button is not visible — hover-only copy is forbidden`); reverted → 1 passing.
  - **WCAG-AA audit run** → docs/phase-1-ui-review.md (1 fix: muted text white/40→/60).
  - **Authoritative final build** green (32/32 vitest, tsc clean, tauri build exit 0).
  - SUMMARY written: `.planning/phases/01-scaffold-harness-proof/01-04-SUMMARY.md`.
- **Phase 1 CLOSED** ✓ — checkpoint approved; throwaway walking-skeleton + its registry entry deleted (D-05, commit `ded661d`); ROADMAP marks Phase 1 `[x]`, all FND-01..05 + HRN-01..04 requirements Complete.
- **Phase 2 PLANNED** ✓ — `/gsd-plan-phase 2`: 4 plans in 3 waves; gsd-plan-checker PASSED on first pass (all 11 dimensions); SHL-01..06 covered (SHL-05 PARTIAL — window geometry → Phase 5 per D-11). Commit `ff7de4a`.
- **Plan 02-01 ✓ COMPLETE** (commits `5d7812d`, `e5c18e8`, `ae7fb78`) — foundation unblock:
  - `platform.store` is now REAL: `@tauri-apps/plugin-store` writes `prefs.json` on disk in Tauri; `localStorage` (JSON, `devtools:` ns) in browser; in-memory stub fallback. `get`/`set` interface unchanged; corrupt/non-JSON values degrade to `undefined` (T-02-02). Only `tauri.ts` imports `@tauri-apps/*` (grep-verified).
  - `store:default` capability granted; `tauri_plugin_store` registered unconditionally in `lib.rs` (cargo check green).
  - **3 tools ENABLED** as a shared `makePlaceholder("name")` (Clock/Binary/Boxes lucide icons) — `ENABLED_TOOLS` is now populated; router redirects to the first tool. Port-unchanged files (`registry.ts`/`types.ts`/`decoder.ts`/`bytes.ts`) untouched.
  - Shell `@theme` tokens added (card/bd/bd-2/tx/tx-2/tx-3/input-bg + accent-soft/line via `color-mix`, D-10).
  - Gate: 31/31 vitest (decoder 19 green), tsc clean, eslint 0 errors. SUMMARY: `.planning/phases/02-shell/02-01-SUMMARY.md`. Requirements SHL-04 + SHL-05 marked (SHL-05 still PARTIAL — window geometry → Phase 5).
  - Deviations (3 auto-fixed): `defaults:{}` required by plugin-store@2.4.3 (Rule 3); `router.test.tsx` stale empty-registry assertion updated (Rule 1); store.test.ts jsdom env + brittle redirect assertion (Rule 1). No scope creep.
  - lefthook (correctly) blocks committing a red suite → TDD RED was verified via local `vitest run`, then test+impl landed together in the GREEN commit.
- **Plan 02-02 ✓ COMPLETE** (commit `46f96f9`) — wave 1 done. In-house zero-dependency fuzzy ranker (D-06):
  - `src/shell/fuzzy.ts` exports `rankTools(query, tools)` (subsequence ranker, best-first) + `subsequenceScore(needle, haystack)` (null=no match). Field weighting name>keywords>description; contiguous-run + word-boundary + earlier-position bonuses. Empty/whitespace query passes through (D-05); no-match → `[]` (D-07); case-insensitive; stable tie-break by registry order.
  - Imports ONLY the `ToolDefinition` *type* (grep-verified) — no React, no @tauri-apps, no platform; query scanned char-by-char, never a RegExp (T-02-05). No runtime dep added (no cmdk/fuse.js).
  - `searchTools()` in `registry.ts` left untouched — the palette swaps to `rankTools` in **02-04** (registry.ts is a no-edit file this plan).
  - Gate: **42/42 vitest** (decoder 19 green; +11 new fuzzy tests, ≥6 required), tsc clean, eslint 0 errors. SUMMARY: `.planning/phases/02-shell/02-02-SUMMARY.md`. No deviations (plan ran exactly as written).
  - SHL-02 left **Pending** — the ranker is only the matching engine; the ⌘K palette open/Enter-navigate UI (02-04) completes SHL-02. Marking it complete now would be a false claim (no palette exists yet).
- **Plan 02-03 ✓ COMPLETE** (commits `bd58111`, `bf39a8a`, `263dcc6`) — wave 2 done. Prefs/recents persistence + startup-resolution + router wiring:
  - `src/shell/preferences.ts` (typed `Preferences` schema + `DEFAULT_PREFERENCES`: `theme:"dark"` NAMED value per D-10, `accent:"#3b82f6"`, `lastUsedId:null`, `recentToolIds:[]`; extensible for Phase 3 `protobufTreeStyle`) + `prefsStore.ts` (untrusted-merge load/save over `platform.store` — single `shell.preferences` blob key; `mergePreferences`/`normalizeRecents` accept only known fields/types, drop non-string recents → defaults; threat T-02-08).
  - `usePreferences` (theme/accent/lastUsedId round-trip, write-on-change per Pitfall 5, `prefsLoaded` flag) + `useRecentTools` (`push(id)` most-recent-first, de-duped, capped at 5) — both over the seam, **no @tauri-apps** (grep-verified).
  - `resolveStartupTool(target, lastUsedId)` + `HERO_TOOL_ID="protobuf-decoder"` — single seam, explicit (D-14) > valid last-used (D-13) > hero (D-12); both inputs validated via `getToolById` (ENABLED_TOOLS only) before navigation, so disabled/unknown ids silently fall to hero (T-02-07/V5). `StartupRedirect` (index/catch-all element) + `parseHashTarget` (#/tools/<id> extractor) wire it into `router.tsx`, **replacing the hardcoded `firstTool` redirect**; HashRouter + `ENABLED_TOOLS.map` routes preserved (SHL-04). `main.tsx` warms the store after `initPlatform()`.
  - **Pitfall 3 solved + proven:** `prefsLoaded` defers the redirect until the real last-used is known; a router test seeds `lastUsedId:"base64"` → index redirects to `/tools/base64` while first-run → `/tools/protobuf-decoder` (first-launch ≠ relaunch). A `dirtyRef` guard in both hooks stops the async mount-load from clobbering an early setter/push.
  - Gate: **72/72 vitest** (decoder 19 green; +17 new), tsc clean, eslint 0 errors/0 warnings. SUMMARY: `.planning/phases/02-shell/02-03-SUMMARY.md`. Requirements **SHL-03** (recents DATA layer; palette UI in 02-04) + **SHL-06** (opens-to-last/hero, no picker) marked complete. SHL-05 stays PARTIAL (window geometry → Phase 5, D-11).
  - Deviations (3 auto-fixed): `prefsLoaded` added (Rule 2 — needed to tell first-run-null from still-loading, Pitfall 3); `dirtyRef` guard (Rule 1 — load clobbered early writes, surfaced as test failures); `parseHashTarget` split into its own module (Rule 1/quality — react-refresh only-export-components). No scope creep; no port-unchanged file touched; `Store` not widened.

## Blocker

- None. Phase 1 closed; Phase 2 planned and ready to execute.

## Next Step (pick up here next session)

Waves 1-2 complete (02-01 foundation + 02-02 fuzzy ranker + 02-03 prefs/recents/startup-resolution). **Run the LAST plan, wave 3 `02-04`** (Sidebar + ⌘K palette + App.tsx shell chrome), then the phase human-verify checkpoint + `tauri build` + `gsd-ui-review` WCAG-AA sign-off to close Phase 2.

Reminders:

- The 3 tools are `enabled: true` rendering `makePlaceholder` — `ENABLED_TOOLS` is populated. Do NOT touch `decoder.ts`/`bytes.ts`/`types.ts` (and `registry.ts` stays port-unchanged — its "ENABLED_TOOLS is empty" comment is stale but must not be edited).
- 02-04 consumes: shell `@theme` tokens (02-01), `rankTools` from `src/shell/fuzzy.ts` (02-02), `usePreferences` for theme/accent application via CSS variables (02-03), and `useRecentTools` for the palette's empty-query recents group per D-05 (02-03). The router already redirects to last-used/hero via `StartupRedirect`/`resolveStartupTool`.
- `CommandPalette` filters with `rankTools(query, tools)` (caller layers recents/registry order for the empty-query case per D-05). SHL-02 completes in 02-04; SHL-03's palette UI also completes there (its data layer is done).
- Do NOT widen the `Store` seam; prefs go through `usePreferences`/`useRecentTools`, never `platform.store` directly.

## Harness reminder (per-task DoD, in order)

simplify → /codex:review → unit (vitest + tsc) → real-webview UI. Phase boundary: human sign-off on `tauri build` + gsd-ui-review WCAG-AA. Never skip gates; parallelize plans but not past the gates.

## Notes

- Repo relocated to top-level root (`.../playground/devtools`); devtools-handoff wrapper dissolved (handoff content consolidated into docs/).
- Recovered .git + .planning from a Time Machine local snapshot after an `rm -rf` incident during the restructure (shell lacks `shopt`/dotglob). No history lost.
- Gate currently green: tsc clean, eslint 0 errors, 31/31 vitest (decoder 19). lefthook pre-commit active (tsc + vitest).
- Deps added in 02-01: `lucide-react@1.17.0`, `@tauri-apps/plugin-store@2.4.3` (JS) + `tauri-plugin-store@2.4.3` (Rust). One out-of-scope eslint warning (pre-existing, `test/e2e/skeleton.e2e.ts:56`) logged in `.planning/phases/02-shell/deferred-items.md`.
