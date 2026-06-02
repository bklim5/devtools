---
phase: 02-shell
plan: 04
subsystem: shell
tags: [sidebar, command-palette, app-shell, registry-driven, keyboard-nav, recents, lucide, D-02, D-03, D-05, D-07]

# Dependency graph
requires:
  - phase: 02-shell
    plan: 01
    provides: "ENABLED_TOOLS populated (lucide icons + makePlaceholder), shell @theme tokens (sidebar/card/bd/tx/accent-soft)"
  - phase: 02-shell
    plan: 02
    provides: "rankTools(query, tools) in-house fuzzy ranker (the palette filter)"
  - phase: 02-shell
    plan: 03
    provides: "useRecentTools (recents data), usePreferences, resolveStartupTool + router StartupRedirect (opens-to-last)"
provides:
  - "Sidebar.tsx — registry-driven compact sidebar (NavLink per ENABLED_TOOL, mockup .navitem.on active styling, accent reserved to active, pointer+Tab only per D-03)"
  - "CommandPalette.tsx — ⌘K fuzzy palette: empty→RECENT+ALL TOOLS, typed→rankTools, miss→quiet 'No tools match', ↑/↓+Enter switch with no mouse, never auto-opens (D-07)"
  - "App.tsx — full shell chrome: Sidebar + main/Outlet + single mounted CommandPalette + ⌘K hint pill; all layout chrome lives in the shell (UX-05)"
  - "useRecentTools.recordSwitch(id) — atomic recents-push + lastUsedId in ONE blob write (fixes a two-writer race over the shared prefs blob)"
  - "--color-palette / --color-scrim @theme tokens (palette panel + scrim, token-driven, no raw hex)"
affects: [phase-3 real tool UIs (render inside the Outlet; the shell + palette switch path are now done)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Registry-as-single-control-plane proven end-to-end: Sidebar, CommandPalette, and router all derive from ENABLED_TOOLS — one registry entry surfaces in all three with no other wiring (SHL-04)"
    - "Palette is the SOLE keyboard tool-switch path (D-03): the sidebar carries no arrow/j-k/number handlers; the ⌘K overlay owns its own open state via a global keydown listener"
    - "Single-writer rule for the shared prefs blob: recordSwitch() persists recents+lastUsedId atomically rather than racing push() and setLastUsedId() (two independent blob writers)"
    - "Derived-not-effect highlight: the palette clamps its highlight index at render time (activeIndex = min(highlight, len-1)) and resets on open inside the event handler — no setState-in-effect cascade"
    - "Token-driven styling only: palette panel/scrim added as @theme tokens so components reference utilities (bg-palette/bg-scrim), never raw hex"

key-files:
  created:
    - "src/components/Sidebar.tsx — registry-driven compact sidebar (SHL-01/04)"
    - "src/components/Sidebar.test.tsx — 6 RTL tests (item count, names, hrefs, active aria-current, icon, registry-only)"
    - "src/components/CommandPalette.tsx — ⌘K fuzzy + recents + keyboard nav (SHL-02/03)"
    - "src/components/CommandPalette.test.tsx — 12 RTL tests (open/close, no-auto-open, recents+all, fuzzy filter, no-match quiet row, ↑/↓+Enter switch, click, footer, tampered-recent skip)"
  modified:
    - "src/App.tsx — bare Outlet shell → full chrome (Sidebar + main/Outlet + CommandPalette + ⌘K hint pill)"
    - "src/index.css — add --color-palette + --color-scrim @theme tokens"
    - "src/shell/useRecentTools.ts — add atomic recordSwitch(id) (push + lastUsedId in one write)"
    - "src/shell/useRecentTools.test.ts — +1 recordSwitch atomicity test"

key-decisions:
  - "Header ⌘K pill dispatches a synthetic ⌘K KeyboardEvent rather than lifting palette open-state into App — the palette stays the single owner of its open state (one source of truth, matches D-07's global trigger)"
  - "recordSwitch(id) added to useRecentTools (not a new hook) — the palette's switch path needs recents + lastUsedId persisted atomically; calling push()+setLastUsedId() separately raced two independent writers over the one shared blob and dropped recents"
  - "Active sidebar item marked by NavLink's isActive → aria-current=page + the mockup's .navitem.on visuals (accent bar + accent-soft + icon/name recolour); accent reserved to active only"
  - "Palette result model built as labelled groups (RECENT/ALL TOOLS or one ranked group) flattened to a single highlight track, so ↑/↓ walk a flat list across section boundaries"

patterns-established:
  - "Shell chrome owns all layout; tool components render layout-agnostic inside <Outlet/> (UX-05)"
  - "Untrusted recents rendering: getToolById filters every recent id (ENABLED_TOOLS only) before a row renders or navigates — tampered ids can't synthesize a route (T-02-10/T-02-12)"

requirements-completed: [SHL-01, SHL-02, SHL-03, SHL-04, SHL-06]  # marked Complete after Task-4 human-verify phase sign-off (approved 2026-05-30); SHL-05 stays PARTIAL (window geometry → Phase 5, D-11)

# Metrics
duration: 5min
completed: 2026-05-30
---

# Phase 2 Plan 04: Shell Chrome (Sidebar + ⌘K Palette + App) Summary

**The visible registry-driven shell: a compact sidebar (one NavLink per ENABLED_TOOL with mockup-accurate accent-reserved active styling), a ⌘K fuzzy command palette (recents-first empty state, no-mouse ↑/↓+Enter switch, quiet no-match, never auto-opens), and an `App.tsx` that wraps the routed `<Outlet/>` with both — proving the single control plane end-to-end. Build/code tasks complete and fully gated; the Phase-2 real-webview human-verify checkpoint was approved by the user (2026-05-30) after two production-only startup bugs were found and fixed (commit `d4e44f5`).**

## Performance

- **Duration:** ~5 min (build/code tasks) + post-checkpoint fix
- **Started:** 2026-05-30T20:00:23Z
- **Tasks:** 4/4 complete (3 auto + Task 4 human-verify APPROVED 2026-05-30)
- **Files created:** 4 / modified: 4 (+1 created, `useTrackActiveTool.ts`, in the post-checkpoint fix)

## Accomplishments
- **Sidebar (SHL-01/04):** a pure projection of `ENABLED_TOOLS` — one `NavLink` per tool (`/tools/<id>`), icon + name (compact density, D-02), the active route's item carrying `aria-current=page` plus the mockup's `.navitem.on` visuals (left accent bar scaleY 0→1, accent-soft tint, icon→accent, name→tx). Accent is reserved to the active item. Pointer + Tab focus only (D-03 — no arrow/j-k nav, no ⌘1..⌘6); visible `focus-visible` ring (UX-04).
- **CommandPalette (SHL-02/03):** ⌘K/Ctrl+K toggles (never auto-opens, D-07), Esc closes. Empty query → `RECENT` (≤5, most-recent-first) then `ALL TOOLS` in registry order (D-05); a non-empty query → `rankTools` flat list; a miss → a quiet `No tools match` row (neutral `--tx-3`, never an error, D-07). ↑/↓ move a highlighted index (wraps), Enter navigates to `/tools/<id>` and records the switch and closes — fully no-mouse. Hover mirrors the highlight; rows are also click-to-switch; footer carries the `↑↓ navigate · ↵ open · esc close` kbd hints.
- **App shell:** flex row of `<Sidebar/>` (268px) + `<main>` (flex-1, `bg-pane`) holding the routed `<Outlet/>`, with `<CommandPalette/>` mounted once overlaying everything and a 44px header strip carrying a `⌘K` "Search tools" hint pill (click dispatches a synthetic ⌘K). Titlebar traffic-lights (Phase 5) and per-tool status metrics (Phase 3) are deliberately not rendered — only the frame the shell owns. Tools stay layout-agnostic (UX-05).
- **Single control plane proven:** sidebar, palette, and router all derive from `ENABLED_TOOLS` — the registry is the only tool list anywhere in the shell.
- **Decoder's 19 tests remain green**; full suite **90/90**, tsc clean, eslint 0 errors, production `vite build` succeeds.

## Task Commits

Each build/code task committed atomically (TDD for Tasks 1-2; lefthook pre-commit gate blocks a red suite, so RED was verified locally then test+impl landed together in the GREEN commit — the established 02-01..03 pattern):

1. **Task 1: Registry-driven compact Sidebar** — `3881a13` (feat)
2. **Task 2: ⌘K CommandPalette + recordSwitch fix** — `4dba1da` (feat)
3. **Task 3: Assemble shell chrome in App.tsx** — `3f15524` (feat)
4. **Task 4: Phase-2 real-webview human-verify** — ✓ APPROVED 2026-05-30 (user signed off on the real WKWebView after the post-checkpoint fix); two production-only startup bugs found, fixed, and committed in `d4e44f5`

**Post-checkpoint fix:** `d4e44f5` — "fix(02): persist last-used on every navigation + end the packaged store split-brain"

**Plan metadata:** _(this commit)_ (docs: close the human-verify checkpoint + post-checkpoint fix note)

## Post-checkpoint Fix (Task 4)

During the real-WKWebView sign-off the user found two **production-only** startup bugs that did not surface under `vitest`/dev:

1. **Opened to Unix Time, not the Protobuf hero.** The last-used tool was only stamped on the palette switch path, so sidebar navigation never recorded it — on relaunch the stored `lastUsedId` was stale. **Fix:** added `src/shell/useTrackActiveTool.ts`, a central hook mounted in the shell that records last-used on **every** route change (sidebar clicks, palette switches, deep links alike), making last-used a property of navigation rather than of one switch path.
2. **Tool switch didn't survive restart (packaged store split-brain).** In the packaged app two store backends were live at once — an early `localStorage` read racing the real `prefs.json` plugin-store — so writes and reads hit different stores. **Fix:** memoized `initPlatform()` and had `prefsStore` **await** the one memoized init, so there is a single resolved store backend; the palette also reloads recents on open so the empty-query group is fresh.

Tests after the fix: **vitest 96/96** (decoder 19 green), `tsc --noEmit` clean, `eslint` 0 errors, `vite build` clean. Committed in `d4e44f5`. The user then rebuilt the app and verified on the real WKWebView → **approved**.

## Files Created/Modified
See frontmatter `key-files`. Highlights:
- `src/components/Sidebar.tsx` / `.test.tsx` — the compact registry-driven sidebar + 6 tests.
- `src/components/CommandPalette.tsx` / `.test.tsx` — the ⌘K overlay + 12 tests.
- `src/App.tsx` — bare Outlet → full shell chrome.
- `src/shell/useRecentTools.ts` — `recordSwitch(id)` atomic switch-record (the race fix).
- `src/index.css` — `--color-palette` / `--color-scrim` tokens.

## Decisions Made
- **Header pill dispatches a synthetic ⌘K** — keeps the palette the single owner of its open state (no lifted state, no prop drilling); the click affordance and the keyboard trigger share one code path.
- **`recordSwitch` on `useRecentTools`** — the switch path must persist recents AND `lastUsedId` atomically; see the deviation below.
- **Labelled groups flattened to one highlight track** — `↑/↓` traverse `RECENT`→`ALL TOOLS` seamlessly; section labels are render-only.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two-writer race over the shared prefs blob on tool switch → added atomic `recordSwitch`**
- **Found during:** Task 2 (the "↑/↓+Enter records the switch" test)
- **Issue:** The plan's palette action calls recents `push(id)` AND `usePreferences().setLastUsedId(id)`. But `useRecentTools` and `usePreferences` each hold a **separate** in-memory copy of the single `shell.preferences` blob; firing both in one handler races two independent `store.set` writers — last-write-wins clobbered `recentToolIds` (the test saw `lastUsedId` persisted but recents empty).
- **Fix:** Added `recordSwitch(id)` to `useRecentTools`, which pushes the recent AND stamps `lastUsedId` in ONE merged blob write (preserving theme/accent). The palette now calls only `recordSwitch` — a single writer for the shared blob. `push` is retained (shared `commit` helper).
- **Files modified:** src/shell/useRecentTools.ts, src/components/CommandPalette.tsx (+1 atomicity test in useRecentTools.test.ts)
- **Verification:** the palette switch test now sees both `lastUsedId` and `recentToolIds[0]` = the chosen id; the new recents test proves accent is preserved across `recordSwitch`.
- **Committed in:** 4dba1da (Task 2)

**2. [Rule 1 - Quality] Eliminated two `react-hooks/set-state-in-effect` lint errors in the palette**
- **Found during:** Task 2 (eslint gate)
- **Issue:** Resetting query/highlight in an `open→` effect and clamping the highlight in a `flatTools.length→` effect both tripped `react-hooks/set-state-in-effect` (cascading-render lint).
- **Fix:** Reset query/highlight inside the ⌘K keydown handler (an event, not an effect); derive the clamped `activeIndex = min(highlight, len-1)` at render time instead of storing it via an effect. The open-focus effect (a DOM external-system sync) stays.
- **Files modified:** src/components/CommandPalette.tsx
- **Verification:** `pnpm exec eslint` 0 errors; all 12 palette tests still green.
- **Committed in:** 4dba1da (Task 2)

**3. [Rule 1 - Quality] Rephrased a CommandPalette doc comment so the `@tauri-apps` grep gate is clean**
- **Found during:** Task 3 (verification grep `grep -rl "@tauri-apps" src/components src/App.tsx`)
- **Issue:** A comment ("never imports @tauri-apps") contained the literal package name, so the grep matched the file even though there is no actual import.
- **Fix:** Reworded the comment to "never imports any Tauri package directly". No import existed or was added.
- **Files modified:** src/components/CommandPalette.tsx
- **Verification:** the grep now returns nothing; the import constraint holds by construction (only `platform/tauri.ts` imports Tauri).
- **Committed in:** 3f15524 (Task 3)

---

**Total deviations:** 3 auto-fixed (1 real bug, 2 quality/lint). No architectural changes (Rule 4 did not fire). No scope creep — no port-unchanged file (`registry.ts`/`types.ts`/`decoder.ts`/`bytes.ts`) touched; the `Store` interface was not widened (`recordSwitch` writes through the same `savePreferences`/`get`/`set` seam).

## Verification
- `pnpm exec vitest run src/components/Sidebar.test.tsx src/components/CommandPalette.test.tsx` → 18 passed.
- Full suite: `pnpm test` → **90/90 passed** (was 72; +18 here). Decoder's **19 immovable tests green**.
- `pnpm exec tsc --noEmit` → clean. `pnpm exec eslint` on all touched files → 0 errors.
- `grep -rl "@tauri-apps" src/components src/App.tsx` → nothing. No raw hex literals in Sidebar/CommandPalette/App (token-driven only).
- Acceptance greps pass: Sidebar references `ENABLED_TOOLS` + `NavLink to=/tools/${...}` and has no `ArrowUp|ArrowDown|metaKey|ctrlKey` (D-03); palette references `rankTools`/`useRecentTools`/`useNavigate`, uses `(e.metaKey || e.ctrlKey) && e.key.toLowerCase()==="k"` with `preventDefault`, and the literal copy `Search tools…` / `No tools match` / `RECENT` / `ALL TOOLS`; App renders `<Sidebar`/`<CommandPalette`/`<Outlet`.
- Production `pnpm exec vite build` → built clean (shell bundles; tsc gate green).

## Harness Note
Per-task DoD gates that map to interactive slash-commands (`/simplify`, `/codex:review`) are not invocable from a non-interactive subagent. The code was kept simplify-clean by hand (single-responsibility components, derived state over effects, shared `commit` helper in the recents hook, narrow exports). The automated gates — `vitest` (90/90, decoder 19 green), `tsc --noEmit` clean, `eslint` 0 errors, and the lefthook pre-commit gate on every commit — all passed. **Real-webview UI verification is Task 4's human-verify checkpoint** (the binding phase-boundary gate): it runs against the actual macOS WKWebView (`tauri dev`), the WebDriver UI gate (`scripts/e2e-spike.sh`), a `gsd-ui-review` WCAG-AA audit, and a fresh `tauri build`. That sign-off is pending and is NOT self-approved.

## Known Stubs
None introduced here. The three tools still render the `makePlaceholder` "Coming in Phase 3" component (the intentional, plan-documented D-01 stub owned by 02-01) — that is the content the shell's Outlet displays until Phase 3 swaps each tool's `component`.

## Requirements Status
- **SHL-01** (compact registry-driven sidebar) — ✓ **Complete** (Task-4 sign-off approved 2026-05-30).
- **SHL-02** (⌘K palette: fuzzy, Enter switches no-mouse) — ✓ **Complete** (sign-off approved).
- **SHL-03** (palette surfaces recents) — ✓ **Complete** (sign-off approved; the post-checkpoint fix also reloads recents on palette open).
- **SHL-04** (registry single control plane) — ✓ **Complete** (already met in 02-01; re-proven end-to-end here — sidebar+palette+router all derive from `ENABLED_TOOLS`).
- **SHL-06** (opens to last-used/summoned, no picker) — ✓ **Complete** (data layer 02-03; the shell now renders it and, post-fix, records last-used on every navigation so relaunch opens to the actual last tool).
- **SHL-05** — remains **PARTIAL** (window-geometry persistence → Phase 5, D-11). The real on-disk Store + theme/last-used/recents persistence are delivered; window geometry is intentionally NOT in scope here.

> SHL-01/02/03/04/06 are marked Complete in REQUIREMENTS.md as of the approved Task-4 human-verify sign-off (2026-05-30). SHL-05 stays PARTIAL.

## User Setup Required
None.

## Self-Check: PASSED

Files verified on disk: `src/components/Sidebar.tsx`, `src/components/Sidebar.test.tsx`, `src/components/CommandPalette.tsx`, `src/components/CommandPalette.test.tsx`, `src/App.tsx`, `src/shell/useRecentTools.ts`, `src/shell/useTrackActiveTool.ts` (post-checkpoint fix) — all FOUND.
Commits verified in git history: `3881a13`, `4dba1da`, `3f15524`, `d4e44f5` (post-checkpoint fix) — all FOUND.

---
*Phase: 02-shell*
*Completed: 2026-05-30 — all 4 tasks done; Task-4 human-verify checkpoint APPROVED by the user.*
