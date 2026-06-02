---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: milestone
status: Phase 7 complete — ready to plan Phase 8
last_updated: "2026-06-02T13:16:37.750Z"
progress:
  total_phases: 6
  completed_phases: 1
  total_plans: 3
  completed_plans: 3
  percent: 100
---

# Project State

## Current Position

Phase: 08 (next — not yet started)
Plan: Phase 7 COMPLETE (3/3 plans, human signed off 2026-06-02). Phase 8 not yet planned.
Next: **Phase 8 — StatusBar size-readout cleanup (UIX-01).** `/clear` then `/gsd-discuss-phase 8` (or `/gsd-plan-phase 8`). Now that the Formatters are live and consuming `StatusBar`, make `byteCount` opt-in: keep the size readout on Base64/Hex/Bytes + Protobuf + both Formatters, drop it from Hash / UUID·ULID / Unix Time / JWT (status text only). Carry-forward (non-blocking polish from Phase 7): FormatterView narrow-width vertical stacking (UX-05) — confirmed NOT a WCAG-AA blocker by the UI audit.

**Milestone v1.1 "Formatters" — roadmap created 2026-06-02.** Two phases:

- **Phase 7 — Formatters (FMT-01..08):** shared two-pane paste-instant `FormatterView` + a JSON formatter (validate line:col / prettify 2·4·tab / minify / sort-keys) + an XML formatter (validate well-formedness / prettify preserving comments·CDATA·attrs·PIs / minify). Both zero-runtime-dependency over native `JSON`/`DOMParser`; pure logic in `src/lib/format/`; registered by appending to the `TOOLS` array (single control plane). Visible focusable copy (no hover-only). **UI hint: yes.**
- **Phase 8 — StatusBar size-readout cleanup (UIX-01):** make `StatusBar` `byteCount` optional/opt-in; keep the size readout on Base64/Hex/Bytes + Protobuf + the new Formatters, drop it from Hash / UUID·ULID / Unix Time / JWT (status text only). **Depends on Phase 7** (Formatters land + consume `StatusBar` first, so the keep/drop split is verified against the complete set of callers). **UI hint: yes.**

**Standing constraints carried into v1.1 (binding):** offline/no-network at runtime; paste-instant (<2s); keyboard-driven; registry-driven single control plane; HashRouter only; WCAG-AA across the board; layout-agnostic tool components; **zero new runtime dependencies** (native APIs only); **the hero decoder `src/lib/protobuf/decoder.ts` + its 19 tests stay byte-for-byte untouched**. Per-task DoD order: `/simplify` → `/codex:review` → `vitest` + `tsc` + `eslint` green → real-WKWebView UI verification. Each phase boundary ends with a human sign-off on a fresh `tauri build` + a passing `gsd-ui-review` WCAG-AA audit.

**Design spec (authoritative for scope):** `docs/superpowers/specs/2026-06-02-json-xml-formatters-design.md` (status: approved, pre-implementation). SQL formatter stays parked in backlog 999.1; the DevTools CLI idea stays in backlog 999.4.

## Active Plan

**None active — Phase 7 (Formatters) COMPLETE, Phase 8 not yet planned.**

Phase 7 shipped both formatter tools behind the shared `FormatterView` (FMT-01..08), executed across 3 sequential waves (07-01 shared-foundation → 07-02 json-formatter → 07-03 xml-formatter), verified (5/5 must-haves), and signed off. All standing gates passed: code review (3 warnings fixed), real-WKWebView e2e (10/10 specs), WCAG-AA UI review (PASS, 18/24, no blockers), and human sign-off on the `tauri build`. Next milestone work is **Phase 8 (StatusBar cleanup, UIX-01)** — depends on Phase 7, now unblocked.

## Recent Activity

- **2026-06-02 — Phase 7 (Formatters) COMPLETE & signed off.** `/gsd-execute-phase 7` ran all 3 plans (waves 1→2→3), then the full phase-boundary gate chain: code review surfaced 3 warnings (WR-01 XML lost the `<?xml?>` declaration + doc-level comments/PIs; WR-02 timing chip measured a state setter not the format pass; WR-03 first-match `indexOf` mislocated the V8 error offset) — all fixed TDD (`8e9d7955`/`c786b2f1`/`b859b2d1`). Phase verification PASSED 5/5 must-haves (FMT-01..08). UI review PASSED WCAG-AA (18/24, no blockers); its 3 advisory findings fixed too (`73e98d10`/`86f1a2ee`/`d38c63da`). Real-WKWebView e2e: **10/10 specs green** on webkit 605.1.15 (incl. both formatters + screenshots). The live gate then caught a real regression unit tests missed — real WebKit concatenates `<parsererror>` text with no newlines, so the line-based boilerplate stripper failed; fixed to substring-strip (`c2bf60c0`), unit test now uses the real captured shape. Post-sign-off UI feedback applied + re-verified live: full-height input/output panes + visible "INDENT" label (`c40a164f`). Final: 370 vitest green, `tsc`/`eslint` clean, zero new deps, decoder + its 19 tests untouched. Artifacts: `07-VERIFICATION.md`, `07-REVIEW.md`, `07-UI-REVIEW.md`, `07-HUMAN-UAT.md` (resolved). **All FMT-01..08 ✓.** Next: **Phase 8** (StatusBar cleanup, UIX-01).
- **2026-06-02 — 07-03 xml-formatter EXECUTED & committed (2 TDD tasks, 4 commits).** Shipped the XML formatter end-to-end: pure zero-dep `formatXml` over native `DOMParser`/`XMLSerializer` (well-formedness validation, `<parsererror>` surfaced with line — jsdom `L:C:` + WebKit `on line N` shapes; prettify 2/4/tab preserving comments/CDATA/attributes/PIs, self-close kept, mixed-content emitted inline; minify strips inter-element whitespace keeping significant text; empty→ok-empty; XXE-safe — no external entity/DTD resolution); thin `XmlFormatterTool` reusing the shared `FormatterView` WITHOUT `onSortKeys` (no sort-keys toggle, D-06), clear-on-error (D-08), FMT-08 focusable copy via the platform seam; registry-only append of `xmlFormatterTool` to `TOOLS` after `jsonFormatterTool` (D-12, JSON intact). Full repo green: 352 vitest across 44 files (incl. 19 decoder tests untouched), `tsc`/`eslint` clean, **zero new deps**. Commits `47467b9c`+`a27986c5` (formatXml) / `07dac3a4`+`6486e101` (tool+registry+e2e). SUMMARY: `07-03-SUMMARY.md`. Reqs FMT-05/06/07/08 ✓ → **all FMT-01..08 complete; Phase 7 tool set done.** **Deferred to phase boundary:** real-WKWebView e2e for BOTH formatters (`scripts/e2e-spike.sh`) + `/simplify` + `/codex:review` + `gsd-ui-review`; finish FormatterView narrow-width vertical stacking. Next: close Phase 7.
- **2026-06-02 — 07-02 json-formatter EXECUTED & committed (3 TDD tasks, 6 commits).** Shipped the JSON formatter end-to-end: pure zero-dep `formatJson` (validate with engine-portable line:col — V8 position/snippet + JSC line:column — prettify 2/4/tab, minify-wins, recursive sort-keys with array order preserved, empty→ok-empty); the shared JSON/XML-agnostic `FormatterView` (resizable input | read-only copy-bearing output + shared toolbar with conditional sort-keys + StatusBar byte delta, no raw-HTML injection, FMT-08 focusable copy via the platform seam); thin `JsonFormatterTool` (paste-instant, clear-on-error, D-07/D-08); registry-only append (D-12); and `test/e2e/json-formatter.e2e.ts`. Full repo green: 335 vitest (incl. 19 decoder tests untouched), `tsc`/`eslint` clean, **zero new deps**. Commits `392808d1`+`ba4fc4cb` / `74dfe9cf`+`de492031` / `a3b52ed7`+`1401b35e`. SUMMARY: `07-02-SUMMARY.md`. Reqs FMT-01/02/03/04/08 ✓. **Deferred to phase boundary:** run the real-WKWebView e2e (`scripts/e2e-spike.sh`) + `/simplify` + `/codex:review` + `gsd-ui-review`; finish FormatterView narrow-width vertical stacking. Next: 07-03 xml-formatter.
- **2026-06-02 — 07-01 shared-foundation EXECUTED & committed (3 tasks, 5 commits).** Promoted `ResizableSplit` → `src/components/` (git mv; rewired the one real importer `ProtobufDecoder.tsx` to `@/components/ResizableSplit` — Rule-3 deviation, the plan's "no importers" note was wrong, caught by the pre-commit gate). Added additive `StatusBar.outputBytes` input→output byte-delta (`1,240 → 890 bytes`, D-04; `byteCount` stays required, Phase-8 owns optionalizing it). Defined pure `src/lib/format/types.ts` (`FormatResult`/`FormatOptions`/`IndentMode`, D-09). Full repo green: 311 vitest (incl. 19 decoder tests untouched), `tsc`/`eslint` clean, zero new deps. Commits `281b77bc`/`90ec2fe2`+`d8ecdc64`/`4726fc39`+`05c9c620`. SUMMARY: `07-01-SUMMARY.md`. Reqs FMT-01/04/07 ✓. Next: 07-02 json-formatter.
- **2026-06-02 — Phase 7 (Formatters) planned (3 plans, verified).** `/gsd-plan-phase 7` (research skipped — approved design spec sufficient; UI-SPEC skipped — CONTEXT.md D-01..06 lock the UI) produced 07-01 shared-foundation / 07-02 json-formatter / 07-03 xml-formatter in 3 sequential waves. gsd-planner → PLANNING COMPLETE; gsd-plan-checker → VERIFICATION PASSED first pass. STRIDE threat model in each plan (XXE/billion-laughs dispositioned for the DOMParser path). Next: `/gsd-execute-phase 7`.
- **2026-06-02 — Phase 7 (Formatters) context gathered.** `/gsd-discuss-phase 7` captured 4 gray-area decisions the approved design spec left open: side-by-side **resizable** `FormatterView` (reuse/promote protobuf `ResizableSplit`); **read-only** output pane (no syntax highlighting); status bar shows **input→output byte delta** (small additive `StatusBar` touch, coordinate with Phase 8); **shared top toolbar** (JSON shows sort-keys, XML doesn't). Written to `.planning/phases/07-formatters/07-CONTEXT.md` + `07-DISCUSSION-LOG.md`. Next: `/gsd-plan-phase 7`.
- **2026-06-02 — v1.1 "Formatters" milestone roadmap created.** Phases 7 (Formatters, FMT-01..08) + 8 (StatusBar size-readout cleanup, UIX-01) written to `.planning/ROADMAP.md`; all 9 v1.1 requirements mapped (9/9 coverage) in `.planning/REQUIREMENTS.md` Traceability; STATE.md reset for v1.1. Numbering continues from v1.0 (which ended at Phase 6) — did NOT reset to 1.

## Blocker

- **None.** Phase 7 complete and signed off (all phase-boundary gates passed). Phase 8 is unblocked (its only dependency was Phase 7 landing + consuming `StatusBar`).

## Next Step (pick up here next session)

**Phase 8 — StatusBar size-readout cleanup (UIX-01).** Phase 7 is complete and signed off (all gates passed). `/clear` then `/gsd-discuss-phase 8` (or `/gsd-plan-phase 8`). Make `StatusBar.byteCount` opt-in now that the Formatters are live callers: keep the size readout on Base64/Hex/Bytes + the Protobuf decoder + both Formatters (where the minify delta is meaningful), drop it from Hash / UUID·ULID / Unix Time / JWT (status text only). Non-blocking carry-forward: FormatterView narrow-width vertical stacking (UX-05) — UI audit confirmed it's NOT a WCAG-AA blocker, so it's polish, not a Phase 8 prerequisite.

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
