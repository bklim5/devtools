---
gsd_state_version: 1.0
milestone: v1.5
milestone_name: Pinned Tools
status: completed
last_updated: "2026-06-08T08:13:00.000Z"
last_activity: 2026-06-08 -- Completed quick task 260608-avk: release notes via CHANGELOG.md
progress:
  total_phases: 1
  completed_phases: 1
  total_plans: 2
  completed_plans: 2
  percent: 100
---

# Project State

## Current Position

Milestone: **v1.5 "Pinned Tools" — SHIPPED & ARCHIVED 2026-06-07** (single phase). **No active milestone.**
Phase: —
Plan: —
Status: Between milestones — v1.5 archived (tag `v1.5` local-only); awaiting next milestone selection.
Last activity: 2026-06-08 -- Completed quick task 260608-avk: release notes via CHANGELOG.md

**Next:** `/gsd-new-milestone` to start the next cycle, or `/gsd-review-backlog` to promote a parked item (999.1 tool wishlist · 999.2 CI · 999.3 theme settings · 999.4 DevTools CLI · 999.5 Protobuf schema-file). v1.5 detail archived to `.planning/milestones/v1.5-*` (+ `v1.5-phases/`); summary in `.planning/MILESTONES.md`; retrospective in `.planning/RETROSPECTIVE.md`.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260608-avk | Release notes via CHANGELOG.md (pure `extractChangelogSection` + wired both release drivers + multi-line updater banner) | 2026-06-08 | dcbf344f | [260608-avk-plumb-release-notes-through-changelog-md](./quick/260608-avk-plumb-release-notes-through-changelog-md/) |

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-07 after v1.5) · roadmap: .planning/ROADMAP.md

**Core value:** Paste an unknown blob → usable, explorable interpretation in <2s, entirely offline, no mouse.
**Current focus:** Between milestones — v1.5 "Pinned Tools" shipped & archived; planning the next cycle.

## v1.5 — Pinned Tools (SHIPPED & ARCHIVED, 2026-06-07)

v1.5 complete — Phase 17 (2 plans), archived to `.planning/milestones/v1.5-*` (+ `v1.5-phases/`), tag `v1.5` (local-only). A distinct "Pinned" sidebar section over a persisted `pinnedToolIds` overlay (registry stays the single control plane; ⌘K palette + router pin-agnostic): left-of-grip pin toggle + **Alt+P**, two-group `partitionTools` (always a full registry partition; drop unknown / de-dupe), independent per-group drag + Alt+↑/↓ reorder (no cross-boundary), "Unpin all" in the Shift+F10 menu, persisted + reconciled on load. All 9 PIN requirements validated on the real WKWebView; full suite **694/694**; decoder + its 19 tests byte-for-byte untouched; zero new runtime/dev deps; gsd-ui-review WCAG-AA 23/24. Post-walkthrough fixes (**D-17**, see Accumulated Context): Alt+P keys off physical `KeyP` (macOS Option+P → "π"); Tab-reachable rows + pin fallback + ↑/↓ focus nav; 24×24 targets.

## Accumulated Context

**Inherited binding wedge (every phase):** offline/no-network · paste-instant (<2s) · keyboard-driven · registry-driven single control plane · HashRouter only · WCAG-AA (keyboard path + `aria-live` mandatory, not optional) · layout-agnostic · **zero new runtime AND dev dependencies** · **`src/lib/protobuf/decoder.ts` + its 19 tests stay byte-for-byte untouched**. UI features add the **real-WKWebView UI gate**.

**v1.5 design (confirmed, do not re-litigate):** pinning is a render-time presentation overlay (`pinnedToolIds`) persisted through the existing `usePreferences`/`platform.store` seam beside `toolOrder`/`recentToolIds`; registry stays the single control plane (⌘K palette + router pin-agnostic). Reuses v1.4's `reconcileToolOrder`/`moveToolInOrder`, grip-handle drag + Alt+↑/↓ reorder, and the `aria-live` pattern. **Defaults:** no tool pinned by default (empty pinned section → no divider; hero NOT auto-pinned); pinning appends to the bottom of the pinned section; membership changes via pin/unpin only (no drag-across-boundary). Settings surface + auto-pin-hero stay deferred.

**Phase 17 context decisions (`17-CONTEXT.md`, 2026-06-05):** **D-13** pin/unpin shortcut = **Alt+P** (focused row; same family as Alt+↑/↓; plain single-key rejected per the sidebar's no-single-key model); announced "Pinned/Unpinned {tool}" via the existing `aria-live`. **D-14** pin icon sits **left of the grip handle**; **pinned rows show a persistent always-visible filled pin** (state + unpin target — no hover-only); unpinned rows show an outline pin on hover/`focus-visible` only; neutral tokens, NavLink right-padding widened for two controls. **D-15** Pinned group separated by a **bare neutral divider, no visible "PINNED" label** (compact density preserved); SR group named via `aria-label`; divider/group shown only when ≥1 pinned. **D-16** **"Unpin all" joins the existing right-click "Reset order" context menu** (reuses Shift+F10 entry; calls `setPinnedToolIds([])`), shown only when ≥1 pinned.

**D-17 (extends D-13, post-sign-off walkthrough 2026-06-07 — supersedes the planned D-05 "no roving nav"):** sidebar keyboard model reworked from live macOS feedback. **(a) Alt+P macOS fix (the real bug):** Option+P composes to the character "π", so the old `e.key === "p"` check was dead on the real WKWebView (the prior e2e gave a false positive by synthesizing `key:'p'`); now matches the PHYSICAL key `e.code === "KeyP"` (commit `cf7c566d`; e2e regression spec dispatches `key:'π'/code:'KeyP'`). **(b) Arrow nav:** plain **↑/↓** + Home/End move focus tool-to-tool across the pinned↔unpinned divider as one continuous list (clamp at ends, no wrap), via a pure `resolveRovingTarget` helper in `toolOrder.ts` (+9 unit tests). **(c) Tab model (FINAL):** every `NavLink` row is a Tab stop AND the pin button is Tab-reachable (`tabIndex={0}`; Enter/Space pins) as a keyboard fallback; the grip is pointer-only (`tabIndex={-1}`, `aria-hidden`). Alt+↑/↓ still reorder within-group (PIN-06 intact); Alt+P / Shift+F10 fire from the row. **(d)** pin+grip widened to 24×24 for WCAG 2.5.8 (`a3b0c087`). NOTE: an interim single-Tab-stop roving model (`b5ef70d3`/`6639da59`) was reverted to this Tab-friendly model (`1c6bfb8c`) per user request ("tab should also go to the pin / next tool"). Commits: `a3b0c087`, `b5ef70d3`, `6639da59`, `cf7c566d`, `1c6bfb8c`. Full suite **694/694**; real-WKWebView e2e green (macOS Option+P regression covered).

**Open carry-forwards (non-blocking):** settings surface (deferred); auto-pin/lock-hero (deferred); CI track (999.2); remaining tool wishlist (999.1); theme settings (999.3); DevTools CLI (999.4); Protobuf schema-file (999.5); FormatterView narrow-width stacking (UX-05); notarisation pending Apple enrolment (D-02); NAT-01 global summon hotkey (G-05-1); Cron advisory follow-ups (`15-REVIEW-FIX.md`); 3 minor updater a11y follow-ups.

## Harness reminder (per-task DoD, in order)

simplify → /codex:review → unit (vitest + tsc + eslint green) → real-WKWebView UI verification. Phase boundary: human sign-off on a fresh `tauri build` + a passing `gsd-ui-review` WCAG-AA audit. Never skip gates; parallelize plans but not past the gates. **Native-OS input (drag/drop, OS key chords, file drops) is manual-walkthrough coverage — the WebDriver can't synthesize it; make it an explicit human-verify item.** See [[tauri-native-dragdrop-blocks-html5-dnd]].

---

## v1.4 — Reorderable Tools (SHIPPED & ARCHIVED, 2026-06-05)

v1.4 complete — Phase 16 (2 plans), archived to `.planning/milestones/v1.4-*`, tag `v1.4` (local-only). The app's first personalization feature: a user-reorderable sidebar — `toolOrder` overlay over the registry (registry stays the single control plane), handle-initiated native HTML5 drag + neutral insertion line, Alt+↑/↓ keyboard reorder with `aria-live`, persisted + reconciled (new-tool-append / unknown-drop / de-dupe) + keyboard-reachable reset-to-default. All 7 REORD requirements validated on the real WKWebView; full suite 668/668; zero new runtime/dev deps; decoder + its 19 tests byte-for-byte untouched. Post-ship fix `1c2c7664`: Tauri `dragDropEnabled:false` so in-page HTML5 drag works.

## v1.3 — More Tools (SHIPPED & ARCHIVED, 2026-06-04)

v1.3 complete — Phases 12–15 (11 plans), archived to `.planning/milestones/v1.3-*`, tag `v1.3` (local-only). Three new tools (URL/Regex/Cron) + Protobuf decimal input; eight tools → eleven. All 25 requirements validated on the real WKWebView; full suite 650/650; zero new runtime/dev deps; decoder + its 19 tests byte-for-byte untouched.

## v1.2 — Release Tooling (SHIPPED & ARCHIVED, 2026-06-03)

v1.2 complete — Phases 9–11 (8 plans), archived to `.planning/milestones/v1.2-*`, tag `v1.2` (local-only). `pnpm release:bump` + `pnpm release:publish` over a unit-tested pure release core (`src/lib/release/`); universal-binary dual-key signature-verified cross-repo publish. All 12 REL requirements; proven live (v0.2.2 + DST-02 updater round-trip). Zero new runtime deps; decoder + its 19 tests untouched. CI track parked (999.2).

## v1.1 — Formatters (SHIPPED & ARCHIVED, 2026-06-02)

v1.1 complete — Phases 7 + 8 (4 plans), archived to `.planning/milestones/v1.1-*`, tagged `v1.1`. JSON + XML formatters behind a shared `FormatterView` (FMT-01..08, zero new runtime deps) + the opt-in `StatusBar` size readout (UIX-01). Decoder + its 19 tests untouched. **Carry-forward (non-blocking):** FormatterView narrow-width vertical stacking (UX-05, polish).

## v1.0 — Distribution (SHIPPED, signed off 2026-06-01)

v1.0 complete — all 6 phases (28/28 plans): foundation/harness (1), shell (2), Protobuf hero + Base64/Hex/Bytes + UX constraints (3), the four catalogue tools (4), native polish (5), distributable self-updating signed-DMG macOS app + verified auto-updater (6). Full archive: `.planning/milestones/v1.0-*` + `.planning/MILESTONES.md`.

**Carry-forwards (NOT v1.5 blockers):** Gatekeeper-clean notarisation deferred post-Apple-enrolment (D-02, credentials-only flip); NAT-01 configurable global summon hotkey parked (G-05-1); 3 minor a11y polish follow-ups from the updater UI review; Cron advisory follow-ups (MD-01 next-run perf, LO-02/LO-03 copy/locale — `15-REVIEW-FIX.md`); backlog 999.1 (remaining tool wishlist), 999.2 (CI track), 999.3 (theme settings), 999.4 (DevTools CLI), 999.5 (Protobuf schema-file).
