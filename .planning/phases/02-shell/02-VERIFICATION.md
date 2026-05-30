---
phase: 02-shell
verified: 2026-05-30T22:15:00Z
status: passed
score: 20/20 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  note: initial verification
---

# Phase 2: Shell Verification Report

**Phase Goal:** A registry-driven application shell where the sidebar, ⌘K palette, and router all derive from a single tool registry, preferences persist across restarts, and the app opens straight to the last-used or summoned tool with no "pick a tool" friction.
**Verified:** 2026-05-30T22:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

Truths are merged from the ROADMAP Success Criteria (the contract) and the four PLAN `must_haves.truths` blocks.

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | Sidebar (compact icon+name) renders entirely from the tool registry (SC-1, SHL-01) | ✓ VERIFIED | `src/components/Sidebar.tsx` maps `ENABLED_TOOLS` → one `NavLink` per tool (`to={/tools/${tool.id}}`), renders `tool.icon` + `tool.name`, holds no list of its own. Active styling via `isActive` render-prop (left accent bar scaleY 0→1, `bg-accent-soft`, icon→accent). |
| 2 | Adding a tool (file + one registry entry) appears in sidebar, palette, AND route with no other wiring — single control plane (SC-1, SHL-04) | ✓ VERIFIED | Sidebar maps `ENABLED_TOOLS`; CommandPalette ranks/lists over `ENABLED_TOOLS`; `router.tsx` derives routes via `...ENABLED_TOOLS.map(...)`. All three consume the one registry array. `registry.ts` is the only list. |
| 3 | ⌘K opens a palette that fuzzy-matches over name+keywords+description and switches on Enter — no-mouse switching (SC-2, SHL-02) | ✓ VERIFIED | `CommandPalette.tsx` global keydown `(metaKey\|\|ctrlKey)&&key==='k'` with `preventDefault`; `rankTools(query, ENABLED_TOOLS)`; ↑/↓ move `highlight`; Enter `navigate(/tools/${id})` + close; Esc closes. `fuzzy.ts` scores name(1000)>keywords(100)>description(10). |
| 4 | Palette surfaces recently-used tools (SC-2, SHL-03) | ✓ VERIFIED | `buildGroups` empty-query path builds RECENT (≤5, via `useRecentTools`/`loadPreferences`, mapped through `getToolById` to drop tampered ids) then ALL TOOLS. `RECENT_TOOLS_CAP = 5`. |
| 5 | Preferences (theme, last-used, recents) persist across restart via the platform store seam (SC-3, SHL-05 PARTIAL) | ✓ VERIFIED | `usePreferences`/`useRecentTools` → `prefsStore.load/savePreferences` → `platform.store` (real `@tauri-apps/plugin-store` in `tauri.ts`, localStorage fallback in `browser.ts`). Single blob `shell.preferences`. Window-geometry intentionally deferred to Phase 5 (D-11) — not a gap. |
| 6 | App opens directly to last-used / summoned tool, never a pick-a-tool step (SC-4, SHL-06) | ✓ VERIFIED | `router.tsx` index + catch-all both render `<StartupRedirect/>`, which resolves via `resolveStartupTool(target, lastUsedId)`: explicit `#/tools/<id>` > last-used > hero `protobuf-decoder`. Holds first paint until `prefsLoaded` so last-used restores (Pitfall 3). |
| 7 | Invalid/disabled/unknown last-used or deep-link id silently falls back to hero (SC-4, D-13/14) | ✓ VERIFIED | `resolveStartupTool` validates both `target` and `lastUsedId` through `getToolById` (searches ENABLED_TOOLS only) before returning; otherwise returns `HERO_TOOL_ID`. `parseHashTarget` returns unvalidated id; validation is centralized. |
| 8 | Switching tools updates recents + last-used on EVERY path (sidebar, palette, deep-link) | ✓ VERIFIED | `useTrackActiveTool` mounted in `App.tsx`; `useMatch("/tools/:id")` + `recordSwitch(id)` (atomic recents+lastUsed write) on every route change, gated on `loaded`. This is the post-checkpoint fix (commit d4e44f5) — central single writer. |
| 9 | Store split-brain fixed: reads and writes hit the same backing in packaged app | ✓ VERIFIED | `initPlatform()` memoised (single `initPromise`); `prefsStore.load/savePreferences` each `await initPlatform()` so they always read/write the real Tauri store, never the localStorage fallback before install (commit d4e44f5). |
| 10 | The decoder's 19 immovable tests remain green | ✓ VERIFIED | `vitest run src/lib/protobuf/decoder.test.ts` → Test Files 1 passed, Tests 19 passed, exit 0. |
| 11 | In-house zero-dependency fuzzy ranker only (no cmdk/fuse.js) | ✓ VERIFIED | `fuzzy.ts` imports only the `ToolDefinition` type; `grep -E "cmdk\|fuse" package.json` → none. |

**Score:** 11/11 ROADMAP+PLAN truths verified (20/20 counting per-plan must_have truths individually; no failures).

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/tools/_placeholder/ToolPlaceholder.tsx` | Shared placeholder (`makePlaceholder`) | ✓ VERIFIED | Exports `makePlaceholder(name)`; renders h1 + "Coming in Phase 3"; layout-agnostic; not null/stub. |
| `src/lib/platform/tauri.ts` | Real plugin-store impl behind seam | ✓ VERIFIED | Imports `@tauri-apps/plugin-store` `load`, `load("prefs.json"...)`, autoSave; only file with @tauri-apps import. |
| `src/lib/platform/browser.ts` | localStorage fallback | ✓ VERIFIED | localStorage + JSON.stringify/parse, corrupt→undefined; no @tauri-apps. |
| `src-tauri/capabilities/default.json` | `store:default` grant | ✓ VERIFIED | Contains `store:default` (and no broader store-* grant). |
| `src/index.css` | Shell CSS tokens | ✓ VERIFIED | `--color-accent-soft`/`--color-card`/`--color-tx-3` etc. present in @theme. |
| `src/shell/fuzzy.ts` | In-house ranker, `rankTools` | ✓ VERIFIED | 101 lines, type-only import, name>keywords>description weighting. |
| `src/shell/resolveStartupTool.ts` | Startup seam, `resolveStartupTool`+`HERO_TOOL_ID` | ✓ VERIFIED | Pure fn, validates via getToolById, hero=protobuf-decoder. |
| `src/shell/usePreferences.ts` | Prefs hook over store | ✓ VERIFIED | `platform.store` via prefsStore; no @tauri-apps; `prefsLoaded` gate. |
| `src/shell/useRecentTools.ts` | Recents (cap 5, dedupe, MRU) | ✓ VERIFIED | `recordSwitch`/`push`, `pushRecent`→normalizeRecents+cap. |
| `src/shell/preferences.ts` | Schema + defaults | ✓ VERIFIED | `DEFAULT_PREFERENCES` theme="dark" (string literal), recentToolIds:[]. |
| `src/components/Sidebar.tsx` | Registry-driven sidebar | ✓ VERIFIED | NavLink per ENABLED_TOOL; no arrow/⌘1-6 handlers (D-03). |
| `src/components/CommandPalette.tsx` | ⌘K fuzzy palette | ✓ VERIFIED | 229 lines; rankTools+recents+kbd nav; "Search tools…"/"No tools match". |
| `src/App.tsx` | Shell chrome | ✓ VERIFIED | `<Sidebar/>`+`<Outlet/>`+`<CommandPalette/>`; mounts useTrackActiveTool; ⌘K hint pill. |
| `src/shell/useTrackActiveTool.ts` | Central last-used recorder (post-checkpoint) | ✓ VERIFIED | Records on every route via useMatch; the fix for sidebar-switch-not-persisting. |
| `src/shell/StartupRedirect.tsx` | Index-route redirect element | ✓ VERIFIED | Holds until prefsLoaded, then Navigate to resolved tool. |

All 15 artifacts pass Levels 1–4 (exist, substantive, wired, data flows). Note: the router uses a `StartupRedirect` component element rather than wiring `resolveStartupTool` inline as the original 02-03 plan sketched — this is a refinement (keeps router pure of hooks; honors react-refresh), not a deviation from the contract; the seam is still the single resolution point.

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| Sidebar.tsx | ENABLED_TOOLS | map → NavLink | ✓ WIRED |
| CommandPalette.tsx | rankTools + useRecentTools + useNavigate | fuzzy filter, recents, Enter→navigate | ✓ WIRED |
| App.tsx | Sidebar + CommandPalette + Outlet + useTrackActiveTool | shell chrome layout | ✓ WIRED |
| router.tsx | resolveStartupTool (via StartupRedirect) | index+catch-all Navigate target | ✓ WIRED |
| usePreferences/useRecentTools | platform.store (via prefsStore) | get/set, never @tauri-apps direct | ✓ WIRED |
| resolveStartupTool / useTrackActiveTool | getToolById | validate target+last-used before nav/record | ✓ WIRED |
| tauri.ts | @tauri-apps/plugin-store load() | createTauriStore delegating get/set | ✓ WIRED |
| src-tauri/src/lib.rs | tauri_plugin_store | `.plugin(tauri_plugin_store::Builder::new().build())` | ✓ WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full unit suite green | `pnpm exec vitest run` | 13 files, 96 tests passed | ✓ PASS |
| Decoder 19 immovable | `pnpm exec vitest run src/lib/protobuf/decoder.test.ts` | Tests 19 passed, exit 0 | ✓ PASS |
| Typecheck clean | `pnpm exec tsc --noEmit` | exit 0, no output | ✓ PASS |
| HashRouter only | `grep -rn BrowserRouter src/` | only a comment, no import | ✓ PASS |
| @tauri-apps confined | `grep -rn "from '@tauri-apps" src/ (non-test)` | only `tauri.ts` (clipboard+store) | ✓ PASS |
| No cmdk/fuse.js | `grep -E "cmdk\|fuse" package.json` | none | ✓ PASS |
| Store plugin + capability | grep lib.rs / default.json | `tauri_plugin_store::Builder` + `store:default` present | ✓ PASS |
| Post-checkpoint fix commits | `git cat-file -t d4e44f5 / 4949163` | both exist | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
| ----------- | -------------- | ----------- | ------ | -------- |
| SHL-01 | 02-04 | Sidebar (compact icon+name) generated from registry | ✓ SATISFIED | Sidebar.tsx maps ENABLED_TOOLS |
| SHL-02 | 02-02, 02-04 | ⌘K palette fuzzy name+keywords+description, Enter switches no-mouse | ✓ SATISFIED | CommandPalette + fuzzy.ts |
| SHL-03 | 02-03, 02-04 | Palette remembers/surfaces recents | ✓ SATISFIED | useRecentTools + RECENT group |
| SHL-04 | 02-01, 02-03, 02-04 | Registry single source of truth (file+entry → sidebar+palette+route) | ✓ SATISFIED | All three derive from ENABLED_TOOLS |
| SHL-05 | 02-01, 02-03 | Persist theme, last-used, ~~window geometry~~, ~~Protobuf tree style~~ | ✓ SATISFIED (PARTIAL by design) | theme/accent/last-used/recents persist via Store seam; window-geometry → Phase 5 (D-11); tree-style → Phase 3. Planned deferral, NOT a gap. |
| SHL-06 | 02-03, 02-04 | App opens to last-used/summoned tool, no pick-a-tool | ✓ SATISFIED | StartupRedirect + resolveStartupTool + useTrackActiveTool |

All 6 declared requirement IDs are accounted for. REQUIREMENTS.md maps exactly SHL-01..06 to Phase 2 — no orphaned requirements. SHL-05's PARTIAL status is consistent across ROADMAP (line 45/49), REQUIREMENTS.md (line 31/123), and the plan summaries; the deferred window-geometry clause is explicitly scheduled in Phase 5 (ROADMAP line 95).

### Deferred Items

| # | Item | Addressed In | Evidence |
| - | ---- | ------------ | -------- |
| 1 | Window-geometry persistence (SHL-05 remaining clause) | Phase 5 | ROADMAP line 95: "window-geometry persistence (SHL-05's deferred clause, D-11) lands here alongside the native window work." |
| 2 | Protobuf tree-style pref key (SHL-05 remaining clause) | Phase 3 | preferences.ts extensibility comment + SC-3 note "Protobuf tree-style value is written by Phase 3". |

Deferred items do not affect status — they are explicitly scheduled future work, not unmet Phase 2 commitments.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `src/lib/tools/registry.ts` | ~11–17 | Stale header comment claims "tools registered enabled:false … ENABLED_TOOLS is currently EMPTY … render null" | ℹ️ Info | Pure documentation drift — the actual code and the three tool index.ts files set `enabled: true` with `makePlaceholder` components; `ENABLED_TOOLS` is non-empty (verified by passing Sidebar/router/palette tests). No functional impact; recommend updating the comment in a future touch. |

No TODO/FIXME/placeholder-logic or stub returns found in shell/components/router source. The "Coming in Phase 3" placeholder is intentional per D-01 and is the expected Phase-2 tool body.

### Human Verification Required

None outstanding. The phase's blocking human-verify checkpoint (Task 4 of 02-04) was completed and **approved by the user** after real-WKWebView testing (7-step protocol: opens-to-tool, sidebar active styling, ⌘K fuzzy+recents+keyboard switch, last-used restore across restart, deep-link validation/fallback, WCAG-AA audit, fresh `tauri build`). The two production-only startup bugs surfaced at that checkpoint were fixed in commit d4e44f5 and the checkpoint closed in commit 4949163.

### Gaps Summary

No gaps. All ROADMAP Success Criteria and all six SHL requirement IDs are satisfied (SHL-05 satisfied to its Phase-2 scope, with window-geometry/tree-style correctly deferred). All 15 artifacts exist, are substantive, are wired into the registry-driven control plane, and carry real data through the persistence seam. The full unit suite (96 tests, incl. the 19 immovable decoder tests) and `tsc --noEmit` are green. Project constraints hold: HashRouter only, `@tauri-apps/*` confined to `platform/tauri.ts`, registry as single control plane, in-house fuzzy ranker only. The single finding is a stale doc-comment in `registry.ts` (Info severity, no functional impact). The phase-boundary human sign-off was obtained on the real WKWebView.

---

_Verified: 2026-05-30T22:15:00Z_
_Verifier: Claude (gsd-verifier)_
