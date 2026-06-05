---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: Reorderable Tools
status: executing
last_updated: "2026-06-05T09:30:00.000Z"
last_activity: 2026-06-05 -- Phase 16 Plan 02 complete + human-approved (reorderable sidebar UI); phase 16 complete pending orchestrator phase-complete
progress:
  total_phases: 1
  completed_phases: 0
  total_plans: 2
  completed_plans: 2
  percent: 100
---

# Project State

## Current Position

Phase: 16 (reorderable-sidebar-tool-list) — COMPLETE (pending orchestrator phase-complete)
Plan: 2 of 2 (both complete)
Status: Phase 16 complete + human-approved; awaiting orchestrator phase-complete / milestone wrap
Last activity: 2026-06-05 -- Phase 16 Plan 02 complete + human-approved (reorderable sidebar UI)

**Next:** Orchestrator phase-complete for Phase 16, then close out milestone v1.4 "Reorderable Tools" (archive + tag — milestone tags local-only). All 7 REORD requirements delivered.

**Plan 01 delivered:** `toolOrder: string[]` (default `[]`) persisted through the existing prefs blob (mirrors `recentToolIds`); `coerceToolOrder` untrusted-merge; `setToolOrder` setter; pure `reconcileToolOrder` (D-11 render overlay, always a registry permutation) + `moveToolInOrder` (clamped relocate). 40/40 suite tests + tsc + eslint green; decoder 19/19 untouched; zero new deps. Commits `90857271`, `72955ab3`.

**Plan 02 delivered (human-approved):** reorderable `Sidebar.tsx` — reconciled `toolOrder` overlay over `ENABLED_TOOLS` (registry/⌘K/router untouched), handle-initiated native HTML5 drag with a neutral (`tx-2`, non-accent) insertion line + end-of-list drop zone, Alt+↑/↓ keyboard reorder (one slot/press, moved item keeps focus, plain arrows unbound), `aria-live="polite"` "Moved {tool} to position N of M" announcements, and a keyboard-reachable Reset-order affordance (right-click + Shift+F10 + focus-on-open + Escape-restore) that sets `toolOrder=[]`. Real-WKWebView e2e (`test/e2e/sidebar.e2e.ts`) green (Alt+ArrowDown reorders + persists across reload, announces, click navigates) + sign-off screenshot. tsc/eslint clean, full vitest 668/668 (decoder 19/19 untouched), e2e 14/14, zero new deps. gsd-ui-review WCAG-AA 22/24 (all 3 findings fixed, `16-UI-REVIEW.md`). `tauri build` bundle refreshed. Commits `026575b4`, `a3dc2927`, `f91a777a`, `4c64b900`, `8c23ac9a`, `b7896524`. Two notable deviations: drop-indicator `bd-2`→`tx-2` for WCAG 1.4.11 contrast; WebKit-driver Alt-modifier gap handled via a bubbling `KeyboardEvent` in the e2e.

## Accumulated Context

**Phase 16 integration contract (from `999.6-CONTEXT.md`):**

- Ordering is a **render-time presentation overlay** over `ENABLED_TOOLS` — the registry array stays the single control plane; ⌘K palette + router remain order-agnostic.
- Persist via the existing `usePreferences` / `platform.store` seam — same mechanism as `recentToolIds`, one additive `toolOrder: string[]` field, write-on-change.
- Reconcile on load: registry IDs in `toolOrder` render in saved order; registry IDs absent from `toolOrder` append at the bottom in registry order; `toolOrder` IDs no longer in the registry are ignored.
- Drag is **handle-initiated** (grip on hover + focus) so a plain click still navigates; drop indicator is a **neutral/subtle insertion line** (accent = selected-only).
- Keyboard reorder is **Alt+↑/↓ only** (one slot per press) — NO roving arrow nav (plain arrows stay unbound, preserving the Phase-2 pointer+Tab-focus model); moved item keeps focus; each move announced via `aria-live="polite"` ("Moved {tool} to position N of M").
- "Reset order" action restores the default registry order (clears/repopulates `toolOrder`); placement at Claude's discretion (context-menu suggested).

**Inherited binding wedge (every phase):** offline/no-network · paste-instant (<2s) · keyboard-driven · registry-driven single control plane · HashRouter only · WCAG-AA · layout-agnostic · **zero new runtime dependencies** · **`src/lib/protobuf/decoder.ts` + its 19 tests stay byte-for-byte untouched**. This is a UI feature, so the **real-WKWebView UI gate applies**.

## Harness reminder (per-task DoD, in order)

simplify → /codex:review → unit (vitest + tsc + eslint green) → real-WKWebView UI verification. Phase boundary: human sign-off on a fresh `tauri build` + a passing `gsd-ui-review` WCAG-AA audit. Never skip gates; parallelize plans but not past the gates.

---

## v1.3 — More Tools (SHIPPED & ARCHIVED, 2026-06-04)

v1.3 complete — Phases 12–15 (11 plans), archived to `.planning/milestones/v1.3-*`, tag `v1.3` (local-only). Three new tools (URL/Regex/Cron) + Protobuf decimal input; eight tools → eleven. All 25 requirements validated on the real WKWebView; full suite 650/650; zero new runtime/dev deps; decoder + its 19 tests byte-for-byte untouched.

## v1.2 — Release Tooling (SHIPPED & ARCHIVED, 2026-06-03)

v1.2 complete — Phases 9–11 (8 plans), archived to `.planning/milestones/v1.2-*`, tag `v1.2` (local-only). `pnpm release:bump` + `pnpm release:publish` over a unit-tested pure release core (`src/lib/release/`); universal-binary dual-key signature-verified cross-repo publish. All 12 REL requirements; proven live (v0.2.2 + DST-02 updater round-trip). Zero new runtime deps; decoder + its 19 tests untouched. CI track parked (999.2).

## v1.1 — Formatters (SHIPPED & ARCHIVED, 2026-06-02)

v1.1 complete — Phases 7 + 8 (4 plans), archived to `.planning/milestones/v1.1-*`, tagged `v1.1`. JSON + XML formatters behind a shared `FormatterView` (FMT-01..08, zero new runtime deps) + the opt-in `StatusBar` size readout (UIX-01). Decoder + its 19 tests untouched. **Carry-forward (non-blocking):** FormatterView narrow-width vertical stacking (UX-05, polish).

## v1.0 — Distribution (SHIPPED, signed off 2026-06-01)

v1.0 complete — all 6 phases (28/28 plans): foundation/harness (1), shell (2), Protobuf hero + Base64/Hex/Bytes + UX constraints (3), the four catalogue tools (4), native polish (5), distributable self-updating signed-DMG macOS app + verified auto-updater (6). Full archive: `.planning/milestones/v1.0-*` + `.planning/MILESTONES.md`.

**Carry-forwards (NOT v1.4 blockers):** Gatekeeper-clean notarisation deferred post-Apple-enrolment (D-02, credentials-only flip); NAT-01 configurable global summon hotkey parked (G-05-1); 3 minor a11y polish follow-ups from the updater UI review; Cron advisory follow-ups (MD-01 next-run perf, LO-02/LO-03 copy/locale — `15-REVIEW-FIX.md`); backlog 999.1 (remaining tool wishlist), 999.2 (CI track), 999.3 (theme settings), 999.4 (DevTools CLI), 999.5 (Protobuf schema-file).
