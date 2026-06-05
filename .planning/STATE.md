---
gsd_state_version: 1.0
milestone: none
milestone_name: (between milestones)
status: milestone_complete
last_updated: "2026-06-05T11:00:00.000Z"
last_activity: 2026-06-05
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Current Position

Milestone: none — **v1.4 "Reorderable Tools" SHIPPED & ARCHIVED 2026-06-05** (sole phase 16, 2/2 plans; tag `v1.4` local-only).
Status: between milestones — no active phase.
Last activity: 2026-06-05 -- v1.4 milestone completed (archived ROADMAP + REQUIREMENTS, PROJECT.md evolved, retrospective written, tagged `v1.4` local).

**Next:** Start the next milestone — `/clear` then `/gsd-new-milestone` (questioning → research → requirements → roadmap). Or promote a backlog item with `/gsd-review-backlog`. Carry-forward future features split out of v1.4: **pinning** (lock the hero to top / pin favourites) and a **dedicated settings surface**.

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-05 after v1.4)

**Core value:** Paste an unknown blob → usable, explorable interpretation in <2s, entirely offline, no mouse.
**Current focus:** Planning next milestone (no active milestone).

## Accumulated Context

**Inherited binding wedge (every phase):** offline/no-network · paste-instant (<2s) · keyboard-driven · registry-driven single control plane · HashRouter only · WCAG-AA · layout-agnostic · **zero new runtime dependencies** · **`src/lib/protobuf/decoder.ts` + its 19 tests stay byte-for-byte untouched**. UI features add the **real-WKWebView UI gate**.

**Open carry-forwards (non-blocking):** pinning + settings surface (split out of v1.4); CI track (999.2); remaining tool wishlist (999.1); theme settings (999.3); DevTools CLI (999.4); Protobuf schema-file (999.5); FormatterView narrow-width stacking (UX-05); notarisation pending Apple enrolment (D-02); NAT-01 global summon hotkey (G-05-1); Cron advisory follow-ups (`15-REVIEW-FIX.md`); 3 minor updater a11y follow-ups.

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

**Carry-forwards (NOT v1.4 blockers):** Gatekeeper-clean notarisation deferred post-Apple-enrolment (D-02, credentials-only flip); NAT-01 configurable global summon hotkey parked (G-05-1); 3 minor a11y polish follow-ups from the updater UI review; Cron advisory follow-ups (MD-01 next-run perf, LO-02/LO-03 copy/locale — `15-REVIEW-FIX.md`); backlog 999.1 (remaining tool wishlist), 999.2 (CI track), 999.3 (theme settings), 999.4 (DevTools CLI), 999.5 (Protobuf schema-file).
