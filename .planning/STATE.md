---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: milestone
status: Phase complete — ready for verification
last_updated: "2026-06-02T11:55:00.000Z"
progress:
  total_phases: 6
  completed_phases: 1
  total_plans: 3
  completed_plans: 3
  percent: 100
---

# Project State

## Current Position

Phase: 07 (formatters) — ALL 3 PLANS EXECUTED, ready for phase verification/sign-off
Plan: 3 of 3 complete
Next: **Close Phase 7** — all of 07-01/07-02/07-03 are executed + committed. Before sign-off: run the deferred real-WKWebView e2e for BOTH formatters (`scripts/e2e-spike.sh` → `test/e2e/{json,xml}-formatter.e2e.ts`, capturing the WKWebView screenshots) + `/simplify` + `/codex:review` + `gsd-ui-review` WCAG-AA + human sign-off on a fresh `tauri build`, and finish FormatterView's narrow-width vertical stacking (carried from 07-02). Then Phase 8 (StatusBar cleanup, depends on Phase 7).

**Milestone v1.1 "Formatters" — roadmap created 2026-06-02.** Two phases:

- **Phase 7 — Formatters (FMT-01..08):** shared two-pane paste-instant `FormatterView` + a JSON formatter (validate line:col / prettify 2·4·tab / minify / sort-keys) + an XML formatter (validate well-formedness / prettify preserving comments·CDATA·attrs·PIs / minify). Both zero-runtime-dependency over native `JSON`/`DOMParser`; pure logic in `src/lib/format/`; registered by appending to the `TOOLS` array (single control plane). Visible focusable copy (no hover-only). **UI hint: yes.**
- **Phase 8 — StatusBar size-readout cleanup (UIX-01):** make `StatusBar` `byteCount` optional/opt-in; keep the size readout on Base64/Hex/Bytes + Protobuf + the new Formatters, drop it from Hash / UUID·ULID / Unix Time / JWT (status text only). **Depends on Phase 7** (Formatters land + consume `StatusBar` first, so the keep/drop split is verified against the complete set of callers). **UI hint: yes.**

**Standing constraints carried into v1.1 (binding):** offline/no-network at runtime; paste-instant (<2s); keyboard-driven; registry-driven single control plane; HashRouter only; WCAG-AA across the board; layout-agnostic tool components; **zero new runtime dependencies** (native APIs only); **the hero decoder `src/lib/protobuf/decoder.ts` + its 19 tests stay byte-for-byte untouched**. Per-task DoD order: `/simplify` → `/codex:review` → `vitest` + `tsc` + `eslint` green → real-WKWebView UI verification. Each phase boundary ends with a human sign-off on a fresh `tauri build` + a passing `gsd-ui-review` WCAG-AA audit.

**Design spec (authoritative for scope):** `docs/superpowers/specs/2026-06-02-json-xml-formatters-design.md` (status: approved, pre-implementation). SQL formatter stays parked in backlog 999.1; the DevTools CLI idea stays in backlog 999.4.

## Active Plan

**Phase 7 (Formatters) — planned, ready to execute.** 3 plans across 3 sequential waves:

- **07-01 shared-foundation** (wave 1, autonomous): promote `ResizableSplit` → `src/components/` (D-02, decoder import rewired, 19 tests stay green); additive `StatusBar` `outputBytes?` byte-delta prop (D-04/05, existing `byteCount` stays required); shared `FormatResult`/`FormatOptions`/`IndentMode` type (D-09). Reqs FMT-01/04/07.
- **07-02 json-formatter** (wave 2, depends on 01): pure `formatJson` (line:col errors, indent 2/4/tab, minify-wins, recursive sort-keys, arrays preserved); shared presentational `FormatterView`; `JsonFormatterTool`; registry append (D-12); e2e. Reqs FMT-01/02/03/04/08.
- **07-03 xml-formatter** (wave 3, depends on 01,02): pure `formatXml` (DOMParser well-formedness, prettify preserving comments/CDATA/attrs/PIs, minify); `XmlFormatterTool` (no sort-keys); registry append; e2e. Reqs FMT-05/06/07/08.

Verified: gsd-plan-checker → VERIFICATION PASSED (first pass, 0 issues). All FMT-01..08 covered; D-01..12 carried into concrete task actions; no-new-deps + decoder-untouched enforced as acceptance criteria; shared-surface files (`registry.ts`, `StatusBar.tsx`) serialized across waves (no parallel collision). Next action is `/gsd-execute-phase 7`.

## Recent Activity

- **2026-06-02 — 07-03 xml-formatter EXECUTED & committed (2 TDD tasks, 4 commits).** Shipped the XML formatter end-to-end: pure zero-dep `formatXml` over native `DOMParser`/`XMLSerializer` (well-formedness validation, `<parsererror>` surfaced with line — jsdom `L:C:` + WebKit `on line N` shapes; prettify 2/4/tab preserving comments/CDATA/attributes/PIs, self-close kept, mixed-content emitted inline; minify strips inter-element whitespace keeping significant text; empty→ok-empty; XXE-safe — no external entity/DTD resolution); thin `XmlFormatterTool` reusing the shared `FormatterView` WITHOUT `onSortKeys` (no sort-keys toggle, D-06), clear-on-error (D-08), FMT-08 focusable copy via the platform seam; registry-only append of `xmlFormatterTool` to `TOOLS` after `jsonFormatterTool` (D-12, JSON intact). Full repo green: 352 vitest across 44 files (incl. 19 decoder tests untouched), `tsc`/`eslint` clean, **zero new deps**. Commits `47467b9c`+`a27986c5` (formatXml) / `07dac3a4`+`6486e101` (tool+registry+e2e). SUMMARY: `07-03-SUMMARY.md`. Reqs FMT-05/06/07/08 ✓ → **all FMT-01..08 complete; Phase 7 tool set done.** **Deferred to phase boundary:** real-WKWebView e2e for BOTH formatters (`scripts/e2e-spike.sh`) + `/simplify` + `/codex:review` + `gsd-ui-review`; finish FormatterView narrow-width vertical stacking. Next: close Phase 7.
- **2026-06-02 — 07-02 json-formatter EXECUTED & committed (3 TDD tasks, 6 commits).** Shipped the JSON formatter end-to-end: pure zero-dep `formatJson` (validate with engine-portable line:col — V8 position/snippet + JSC line:column — prettify 2/4/tab, minify-wins, recursive sort-keys with array order preserved, empty→ok-empty); the shared JSON/XML-agnostic `FormatterView` (resizable input | read-only copy-bearing output + shared toolbar with conditional sort-keys + StatusBar byte delta, no raw-HTML injection, FMT-08 focusable copy via the platform seam); thin `JsonFormatterTool` (paste-instant, clear-on-error, D-07/D-08); registry-only append (D-12); and `test/e2e/json-formatter.e2e.ts`. Full repo green: 335 vitest (incl. 19 decoder tests untouched), `tsc`/`eslint` clean, **zero new deps**. Commits `392808d1`+`ba4fc4cb` / `74dfe9cf`+`de492031` / `a3b52ed7`+`1401b35e`. SUMMARY: `07-02-SUMMARY.md`. Reqs FMT-01/02/03/04/08 ✓. **Deferred to phase boundary:** run the real-WKWebView e2e (`scripts/e2e-spike.sh`) + `/simplify` + `/codex:review` + `gsd-ui-review`; finish FormatterView narrow-width vertical stacking. Next: 07-03 xml-formatter.
- **2026-06-02 — 07-01 shared-foundation EXECUTED & committed (3 tasks, 5 commits).** Promoted `ResizableSplit` → `src/components/` (git mv; rewired the one real importer `ProtobufDecoder.tsx` to `@/components/ResizableSplit` — Rule-3 deviation, the plan's "no importers" note was wrong, caught by the pre-commit gate). Added additive `StatusBar.outputBytes` input→output byte-delta (`1,240 → 890 bytes`, D-04; `byteCount` stays required, Phase-8 owns optionalizing it). Defined pure `src/lib/format/types.ts` (`FormatResult`/`FormatOptions`/`IndentMode`, D-09). Full repo green: 311 vitest (incl. 19 decoder tests untouched), `tsc`/`eslint` clean, zero new deps. Commits `281b77bc`/`90ec2fe2`+`d8ecdc64`/`4726fc39`+`05c9c620`. SUMMARY: `07-01-SUMMARY.md`. Reqs FMT-01/04/07 ✓. Next: 07-02 json-formatter.
- **2026-06-02 — Phase 7 (Formatters) planned (3 plans, verified).** `/gsd-plan-phase 7` (research skipped — approved design spec sufficient; UI-SPEC skipped — CONTEXT.md D-01..06 lock the UI) produced 07-01 shared-foundation / 07-02 json-formatter / 07-03 xml-formatter in 3 sequential waves. gsd-planner → PLANNING COMPLETE; gsd-plan-checker → VERIFICATION PASSED first pass. STRIDE threat model in each plan (XXE/billion-laughs dispositioned for the DOMParser path). Next: `/gsd-execute-phase 7`.
- **2026-06-02 — Phase 7 (Formatters) context gathered.** `/gsd-discuss-phase 7` captured 4 gray-area decisions the approved design spec left open: side-by-side **resizable** `FormatterView` (reuse/promote protobuf `ResizableSplit`); **read-only** output pane (no syntax highlighting); status bar shows **input→output byte delta** (small additive `StatusBar` touch, coordinate with Phase 8); **shared top toolbar** (JSON shows sort-keys, XML doesn't). Written to `.planning/phases/07-formatters/07-CONTEXT.md` + `07-DISCUSSION-LOG.md`. Next: `/gsd-plan-phase 7`.
- **2026-06-02 — v1.1 "Formatters" milestone roadmap created.** Phases 7 (Formatters, FMT-01..08) + 8 (StatusBar size-readout cleanup, UIX-01) written to `.planning/ROADMAP.md`; all 9 v1.1 requirements mapped (9/9 coverage) in `.planning/REQUIREMENTS.md` Traceability; STATE.md reset for v1.1. Numbering continues from v1.0 (which ended at Phase 6) — did NOT reset to 1.

## Blocker

- **None.** Phase 7 fully executed — 07-01 + 07-02 + 07-03 all committed (FMT-01..08 complete). Real-WKWebView e2e + `/simplify` + `/codex:review` + `gsd-ui-review` + `tauri build` sign-off are deferred to the phase boundary (not blockers).

## Next Step (pick up here next session)

**Close Phase 7 (Formatters).** All 3 plans (07-01/02/03) executed + committed — JSON + XML formatters both ship over the shared `FormatterView`, registered registry-only; FMT-01..08 complete. Phase-boundary gates (deferred, in order): run the real-WKWebView e2e for BOTH formatters via `scripts/e2e-spike.sh` (captures `test/e2e/__screenshots__/{json,xml}-formatter-wkwebview.png` — proves the JSC line:col / parsererror paths) → `/simplify` → `/codex:review` → `gsd-ui-review` WCAG-AA → human sign-off on a fresh `tauri build`; finish FormatterView's responsive narrow-width vertical stacking. Then Phase 8 (StatusBar cleanup, depends on Phase 7).

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
