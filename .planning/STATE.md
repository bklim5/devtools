---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Formatters
status: planning
last_updated: "2026-06-02T00:00:00.000Z"
progress:
  total_phases: 2
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Current Position

Phase: 07
Plan: Not started — context gathered
Next: **Plan Phase 7 (Formatters)** — run `/gsd-plan-phase 7`. Phase context is captured in `.planning/phases/07-formatters/07-CONTEXT.md` (4 gray-area decisions layered on the approved design spec). v1.1 "Formatters" roadmap is created (Phases 7–8, continuing the v1.0 sequence — numbering did NOT reset). Phase 7 is **discussed / ready to plan**.

**Milestone v1.1 "Formatters" — roadmap created 2026-06-02.** Two phases:

- **Phase 7 — Formatters (FMT-01..08):** shared two-pane paste-instant `FormatterView` + a JSON formatter (validate line:col / prettify 2·4·tab / minify / sort-keys) + an XML formatter (validate well-formedness / prettify preserving comments·CDATA·attrs·PIs / minify). Both zero-runtime-dependency over native `JSON`/`DOMParser`; pure logic in `src/lib/format/`; registered by appending to the `TOOLS` array (single control plane). Visible focusable copy (no hover-only). **UI hint: yes.**
- **Phase 8 — StatusBar size-readout cleanup (UIX-01):** make `StatusBar` `byteCount` optional/opt-in; keep the size readout on Base64/Hex/Bytes + Protobuf + the new Formatters, drop it from Hash / UUID·ULID / Unix Time / JWT (status text only). **Depends on Phase 7** (Formatters land + consume `StatusBar` first, so the keep/drop split is verified against the complete set of callers). **UI hint: yes.**

**Standing constraints carried into v1.1 (binding):** offline/no-network at runtime; paste-instant (<2s); keyboard-driven; registry-driven single control plane; HashRouter only; WCAG-AA across the board; layout-agnostic tool components; **zero new runtime dependencies** (native APIs only); **the hero decoder `src/lib/protobuf/decoder.ts` + its 19 tests stay byte-for-byte untouched**. Per-task DoD order: `/simplify` → `/codex:review` → `vitest` + `tsc` + `eslint` green → real-WKWebView UI verification. Each phase boundary ends with a human sign-off on a fresh `tauri build` + a passing `gsd-ui-review` WCAG-AA audit.

**Design spec (authoritative for scope):** `docs/superpowers/specs/2026-06-02-json-xml-formatters-design.md` (status: approved, pre-implementation). SQL formatter stays parked in backlog 999.1; the DevTools CLI idea stays in backlog 999.4.

## Active Plan

**None yet — Phase 7 not planned.** Next action is `/gsd-plan-phase 7`.

## Recent Activity

- **2026-06-02 — Phase 7 (Formatters) context gathered.** `/gsd-discuss-phase 7` captured 4 gray-area decisions the approved design spec left open: side-by-side **resizable** `FormatterView` (reuse/promote protobuf `ResizableSplit`); **read-only** output pane (no syntax highlighting); status bar shows **input→output byte delta** (small additive `StatusBar` touch, coordinate with Phase 8); **shared top toolbar** (JSON shows sort-keys, XML doesn't). Written to `.planning/phases/07-formatters/07-CONTEXT.md` + `07-DISCUSSION-LOG.md`. Next: `/gsd-plan-phase 7`.
- **2026-06-02 — v1.1 "Formatters" milestone roadmap created.** Phases 7 (Formatters, FMT-01..08) + 8 (StatusBar size-readout cleanup, UIX-01) written to `.planning/ROADMAP.md`; all 9 v1.1 requirements mapped (9/9 coverage) in `.planning/REQUIREMENTS.md` Traceability; STATE.md reset for v1.1. Numbering continues from v1.0 (which ended at Phase 6) — did NOT reset to 1.

## Blocker

- **None.** Roadmap created; Phase 7 ready to plan.

## Next Step (pick up here next session)

**Plan Phase 7 (Formatters)** — `/gsd-plan-phase 7`. Then execute through the standing harness gates, then Phase 8 (StatusBar cleanup, depends on Phase 7).

## Harness reminder (per-task DoD, in order)

simplify → /codex:review → unit (vitest + tsc + eslint) → real-webview UI. Phase boundary: human sign-off on `tauri build` + gsd-ui-review WCAG-AA. Never skip gates; parallelize plans but not past the gates. The standing verify-gate rule: each tool gets `test/e2e/<tool>.e2e.ts` run via `scripts/e2e-spike.sh` against the real WKWebView (Chromium screenshots are preview only).

---

## v1.0 — Distribution (SHIPPED, signed off 2026-06-01)

v1.0 is complete — all 6 phases signed off (28/28 plans): foundation/harness (1), shell (2), Protobuf hero + Base64/Hex/Bytes + UX constraints (3), the four catalogue tools (4), native polish — tray + single-instance + window-geometry (5), and a distributable self-updating macOS app — signed (ad-hoc) DMG + signature-verified auto-updater, real 0.2.0 → 0.2.1 round-trip (6). Full archive: `.planning/milestones/v1.0-ROADMAP.md`, `.planning/milestones/v1.0-REQUIREMENTS.md`, `.planning/milestones/v1.0-phases/`, and `.planning/MILESTONES.md`.

**Carry-forwards from v1.0 (NOT v1.1 blockers):**
- **Gatekeeper-clean notarisation DEFERRED** post-Apple-Developer enrolment (D-02) — DST-01 is "release-ready, pending cert"; a credentials-only `APPLE_*` env flip per `docs/RELEASE.md`.
- **NAT-01 configurable global summon hotkey PARKED** (G-05-1) — `platform.nativeShortcut` seam + `shell/summon.ts` kept intact for a future Settings phase; summon ships via tray + single-instance.
- 3 minor non-blocking a11y polish follow-ups from the updater UI review (UpdateOptIn focus-mgmt/aria-modal/Escape; install button aria-disabled vs disabled; banner screenshot at the e2e gate).
- Backlog: Protobuf decimal-byte-array (`Uint8Array`) input mode (user feedback at Phase-3 sign-off); plus backlog 999.1 SQL formatter and 999.4 DevTools CLI.
