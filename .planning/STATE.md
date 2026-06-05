---
gsd_state_version: 1.0
milestone: v1.5
milestone_name: Pinned Tools
status: executing
last_updated: "2026-06-05T23:31:00.000Z"
last_activity: 2026-06-05 -- Phase 17 Plan 02 complete (pinned sidebar UI + e2e)
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 2
  completed_plans: 2
  percent: 100
---

# Project State

## Current Position

Milestone: **v1.5 "Pinned Tools"** — started 2026-06-05; both plans implemented.
Phase: 17 (pinned-sidebar-section) — IMPLEMENTED, pending human sign-off
Plan: 2 of 2 (both complete)
Status: Phase 17 implementation complete (17-01 + 17-02); awaiting phase-gate `tauri build` walkthrough + `gsd-ui-review`
Last activity: 2026-06-05 -- Phase 17 Plan 02 complete (pinned sidebar UI + e2e)

**17-01 done (`8bac1768`, `c7b94741`):** `pinnedToolIds: string[]` prefs field (default `[]`) + `coercePinnedToolIds` untrusted-merge (no cap, wired into `mergePreferences`) + `setPinnedToolIds`/`togglePinned` (append-on-pin / remove) + pure `partitionTools(pinnedToolIds, toolOrder, registryIds) → { pinned, unpinned }` (reuses `reconcileToolOrder` for the remainder; 10-case immovable-bar matrix). PIN-07/PIN-08 ✅. Summary: `.planning/phases/17-pinned-sidebar-section/17-01-SUMMARY.md`.

**17-02 done (`aee22ada`, `cb24e74f`):** two-group `Sidebar.tsx` via `partitionTools` — SR-named "Pinned tools" group + bare neutral divider above the "Tools" group (gated on the post-reconcile `pinned.length > 0`, Pitfall 5); left-of-grip pin toggle (persistent filled on pinned, outline hover+`focus-visible` on unpinned, `aria-pressed`) that toggles membership without navigating; **Alt+P** on the focused handle pins/unpins (`aria-live` "Pinned/Unpinned {name}" via the registry name); per-group drag + Alt+↑/↓ scoped by `draggingGroup` (pinned→`setPinnedToolIds`, unpinned→`setToolOrder`) with no cross-boundary; "Unpin all" as a second item in the Shift+F10 reset menu → `setPinnedToolIds([])`. Shared `renderRow` + one `handleRefs`/`focusAfterMoveRef` map across both groups (focus survives cross-group toggle). Registry/⌘K/router untouched. Full suite 685/685; decoder 19/19 untouched; zero new deps; **real-WKWebView e2e green via `scripts/e2e-spike.sh` (14/14 spec files; `sidebar.e2e` 2/2)**. PIN-01..06 + PIN-09 ✅. Summary: `.planning/phases/17-pinned-sidebar-section/17-02-SUMMARY.md`.

**Next:** Phase-17 human sign-off — run `pnpm tauri build` (ignore the final non-zero exit = absent updater-signing key; confirm the `.app`/`.dmg` under `src-tauri/target/release/bundle/macos/`), hand off the built app for the **manual-walkthrough** items (native pointer DRAG reorder within each group — never across the divider — + pin-icon reveal on pointer HOVER for unpinned rows), then a passing `gsd-ui-review` WCAG-AA audit. After sign-off: `/gsd-transition` to close Phase 17 / complete milestone v1.5.

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-05 after v1.4) · roadmap: .planning/milestones/v1.5-ROADMAP.md

**Core value:** Paste an unknown blob → usable, explorable interpretation in <2s, entirely offline, no mouse.
**Current focus:** Phase 17 — pinned-sidebar-section

## Phases (v1.5)

- [~] **Phase 17: Pinned Sidebar Section** (2/2 plans implemented — pending human sign-off) — PIN-01..09
  - [x] 17-01: Persistence + pure pinning backbone — `pinnedToolIds: string[]` prefs field (`coercePinnedToolIds` untrusted-merge, `setPinnedToolIds` write-on-change, `togglePinned`), pure reconcile + pinned/unpinned partition (always a registry partition; drop unknown, de-dupe), reusing `reconcileToolOrder`/`moveToolInOrder` per group. PIN-07/08.
  - [x] 17-02: Pinned Sidebar UI — pinned group + neutral divider (shown only when ≥1 pinned) above the unpinned list; left-of-grip pin toggle (filled-persistent / outline hover+focus-visible) + Alt+P (`aria-live`-announced); independent per-group drag + Alt+↑/↓ reorder (no cross-boundary, `draggingGroup` scope); "Unpin all" as a second item in the Shift+F10 reset menu. Real-WKWebView e2e green (sidebar.e2e 2/2). PIN-01..06, PIN-09. (`aee22ada`, `cb24e74f`)

## Accumulated Context

**Inherited binding wedge (every phase):** offline/no-network · paste-instant (<2s) · keyboard-driven · registry-driven single control plane · HashRouter only · WCAG-AA (keyboard path + `aria-live` mandatory, not optional) · layout-agnostic · **zero new runtime AND dev dependencies** · **`src/lib/protobuf/decoder.ts` + its 19 tests stay byte-for-byte untouched**. UI features add the **real-WKWebView UI gate**.

**v1.5 design (confirmed, do not re-litigate):** pinning is a render-time presentation overlay (`pinnedToolIds`) persisted through the existing `usePreferences`/`platform.store` seam beside `toolOrder`/`recentToolIds`; registry stays the single control plane (⌘K palette + router pin-agnostic). Reuses v1.4's `reconcileToolOrder`/`moveToolInOrder`, grip-handle drag + Alt+↑/↓ reorder, and the `aria-live` pattern. **Defaults:** no tool pinned by default (empty pinned section → no divider; hero NOT auto-pinned); pinning appends to the bottom of the pinned section; membership changes via pin/unpin only (no drag-across-boundary). Settings surface + auto-pin-hero stay deferred.

**Phase 17 context decisions (`17-CONTEXT.md`, 2026-06-05):** **D-13** pin/unpin shortcut = **Alt+P** (focused row; same family as Alt+↑/↓; plain single-key rejected per the sidebar's no-single-key model); announced "Pinned/Unpinned {tool}" via the existing `aria-live`. **D-14** pin icon sits **left of the grip handle**; **pinned rows show a persistent always-visible filled pin** (state + unpin target — no hover-only); unpinned rows show an outline pin on hover/`focus-visible` only; neutral tokens, NavLink right-padding widened for two controls. **D-15** Pinned group separated by a **bare neutral divider, no visible "PINNED" label** (compact density preserved); SR group named via `aria-label`; divider/group shown only when ≥1 pinned. **D-16** **"Unpin all" joins the existing right-click "Reset order" context menu** (reuses Shift+F10 entry; calls `setPinnedToolIds([])`), shown only when ≥1 pinned.

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
