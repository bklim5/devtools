---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: More Tools
status: roadmapped
last_updated: "2026-06-03T00:00:00.000Z"
last_activity: 2026-06-03
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Current Position

Phase: 12 (Protobuf decimal input) — not started
Plan: —
Status: Roadmapped — ready to plan Phase 12
Last activity: 2026-06-03 — Milestone v1.3 "More Tools" roadmapped. Four phases (12–15), numbering continued from v1.2's Phase 11 (did NOT reset to 1). All 25 v1.3 requirements mapped 1:1 to a phase (25/25 coverage, no orphans, no duplicates).

**Milestone v1.3 "More Tools" roadmapped 2026-06-03.** Goal: add three new high-frequency tools (Cron, URL, Regex) + a Protobuf decimal-byte-array input mode — each clearing the product wedge with zero new runtime deps. Eight tools → eleven. The research (SUMMARY.md, HIGH confidence) established that the four features are FULLY INDEPENDENT (no inter-feature dependencies) and that every feature ships zero new runtime AND zero new devDependencies over native Web/JS APIs. Phase order is therefore purely RISK-DRIVEN — smallest/safest first, the two deep features last so verification budget concentrates on them:

- **Phase 12 — Protobuf decimal input (PRO-08/09):** smallest change; de-risks the hardest constraint ("don't touch `decoder.ts`") first and forces the auto-detection precedence decision early. A new pre-decode `decimalToBytes` in `src/lib/bytes.ts` (NOT a decoder change); widen `detectEncoding` union to add `"decimal"`; one line in `useDecode.ts`; one new segment in the encoding toggle. Auto-detect rule: comma anywhere ⇒ decimal list, all tokens 0–255, with manual override. STANDARD PATTERN — skip `/gsd-research-phase`.
- **Phase 13 — URL tool (URL-01..05):** lowest-novelty pure logic; a thin view over native `URL`/`URLSearchParams`/`encodeURI(Component)`. Establishes the bespoke "parsed-components readout + key→value table" layout and the extracted shared `Toggle` (promoted out of `FormatterView`) that Phases 14/15 reuse. Error-as-value on every `new URL`/`decodeURIComponent`. STANDARD PATTERN — skip `/gsd-research-phase`.
- **Phase 14 — Regex tester (RGX-01..07):** highest UI novelty (match-highlight overlay, capture-group breakdown, replace preview) PLUS the structural ReDoS risk. **Locked decision: matching runs in a Web Worker + timeout watchdog (NOT debounce)** so a catastrophic-backtracking pattern cannot freeze the single-threaded window. `matchAll` over `.exec()` loops; React-node highlighting (escaped text, never `dangerouslySetInnerHTML`). FLAGGED for `/gsd-research-phase` at plan time (Web-Worker-vs-debounce model, highlight-overlay technique, Vite worker bundling without a new dep).
- **Phase 15 — Cron tool (CRON-01..11):** highest logic novelty (hand-rolled next-run) + most unit-test surface. **Locked decisions: 24-hour time descriptions; next 5 runs in LOCAL time with an IANA timezone label** (mirrors the Unix Time tool); **full `L`/`nL`/`L-n` support**. Four correctness traps the iterator must handle: DOM/DOW OR-union semantics, 0/7=Sunday + 1-based months, DST-correct wall-clock field iteration (component read-back, NOT millisecond deltas), and a hard iteration cap so impossible expressions (Feb-30) terminate gracefully. **CRON-10 (`L`/`nL`) is planned as an explicitly ISOLATED final plan** with dedicated leap-year/month-length fixtures so the rest of cron ships even if it proves hard. FLAGGED for `/gsd-research-phase` at plan time (DST wall-clock read-back, the bounded field-jump algorithm, `L`/`nL` fixture design).

**Coverage:** 25/25 requirements mapped, no orphans, no duplicates. Phase 12: 2 (PRO-08/09) · Phase 13: 5 (URL-01..05) · Phase 14: 7 (RGX-01..07) · Phase 15: 11 (CRON-01..11). Traceability table filled in `.planning/REQUIREMENTS.md`.

**Architecture notes (from research, HIGH confidence):** all four slot into the existing registry-driven three-layer pattern — pure logic in new `src/lib/{cron,url,regex}/` (TDD); thin React tools in `src/tools/<tool>/`; each tool is one additive `index.ts` + one `TOOLS` array append (Protobuf needs NO registry change — same tool). `FormatterView` is NOT reusable here (hard-shaped to the formatting domain) — build bespoke layouts on the generic primitives (`ResizableSplit`/`StatusBar`/`CopyButton`/`useCopyFeedback`/platform seam) and extract `Toggle`/`toggleClasses` out of `FormatterView` into a shared component (recommended in Phase 13, reused by 14/15). Verify `lucide-react` glyph names (`Regex`/`Link`/`Clock`) against the installed version at build (MEDIUM confidence gap).

These ARE UI tools, so the full per-task DoD applies including the real-WKWebView gate (unlike v1.2's release scripts). Every phase boundary ends with a human sign-off on a `tauri build` + a passing `gsd-ui-review` WCAG-AA audit.

Next: `/gsd-plan-phase 12` (or any of 12–15 — they're independent and parallelizable; recommended risk order is 12 → 13 → 14 → 15).

## Active Plan

**None yet — milestone roadmapped, no phase planned.** Next: `/gsd-plan-phase 12` to plan the first (smallest, de-risking) phase. Phases 12–15 are independent and may be planned/executed in any order or in parallel.

## Recent Activity

- **2026-06-03 — Milestone v1.3 "More Tools" ROADMAPPED (Phases 12–15).** Adopted the HIGH-confidence risk-ordered phase shape from the research SUMMARY essentially unchanged, one phase per feature: Phase 12 Protobuf decimal input (de-risk untouched-decoder first) → Phase 13 URL (thin native-API view, extracts shared `Toggle`) → Phase 14 Regex (highest UI novelty + ReDoS → Web Worker + timeout) → Phase 15 Cron (hand-rolled DST-correct next-run; the `L`/`nL` slice isolated as its own final plan). All 25 requirements (PRO-08/09, URL-01..05, RGX-01..07, CRON-01..11) mapped 1:1 (25/25, no orphans/dupes) in `.planning/REQUIREMENTS.md` Traceability; ROADMAP.md appended (v1.0/v1.1/v1.2 history + the full 999.x backlog preserved; backlog 999.1 annotated PROMOTED with the delivered tools ✓-marked and the remaining wishlist still parked). Numbering continued from v1.2's Phase 11 — did NOT reset to 1. Phases 14 + 15 flagged for `/gsd-research-phase` at plan time; Phases 12 + 13 are standard patterns. Next: `/gsd-plan-phase 12`.
- **2026-06-03 — Milestone v1.2 "Release Tooling" SHIPPED & ARCHIVED.** Audit passed: 12/12 REL requirements, 3/3 phases verified, integration clean, proven live (v0.2.2 + DST-02 updater round-trip on real hardware). Archived to `.planning/milestones/v1.2-*`; tag `v1.2` (local-only). CI track parked to backlog 999.2.

## Blocker

- **None.** Milestone v1.3 roadmapped and ready to plan.

## Next Step (pick up here next session)

**Run `/gsd-plan-phase 12`** to plan Phase 12 (Protobuf decimal input) — the smallest, de-risking phase (PRO-08/09: `decimalToBytes` in `src/lib/bytes.ts`, third auto-detected input mode, decoder byte-untouched). Phases 12–15 are independent; any can be planned first, but 12 first proves the untouched-decoder promise and answers the auto-detection-precedence design question before anything else. Phases 14 (Regex) and 15 (Cron) should each run `/gsd-research-phase` before planning.

## Harness reminder (per-task DoD, in order)

simplify → /codex:review → unit (vitest + tsc + eslint green) → real-WKWebView UI verification. **For v1.3 the real-WKWebView UI gate APPLIES to every phase** — these are all UI tools (unlike v1.2's release scripts where it was N/A). Phase boundary: human sign-off on a fresh `tauri build` + a passing `gsd-ui-review` WCAG-AA audit. Binding wedge inherited by every phase: offline/no-network, paste-instant (<2s), keyboard-driven, registry-driven single control plane, HashRouter only, WCAG-AA, layout-agnostic; **zero new runtime dependencies**; **`src/lib/protobuf/decoder.ts` + its 19 tests stay byte-for-byte untouched**. Never skip gates; parallelize plans but not past the gates.

---

## v1.2 — Release Tooling (SHIPPED & ARCHIVED, 2026-06-03)

v1.2 complete — Phases 9–11 (8 plans), archived to `.planning/milestones/v1.2-*`, tag `v1.2` (local-only). `pnpm release:bump` + `pnpm release:publish` over a unit-tested pure release core (`src/lib/release/`); universal-binary dual-key signature-verified cross-repo publish. All 12 REL requirements; proven live (v0.2.2 + DST-02 updater round-trip). Zero new runtime deps; decoder + its 19 tests untouched. CI track parked (999.2).

## v1.1 — Formatters (SHIPPED & ARCHIVED, 2026-06-02)

v1.1 complete — Phases 7 + 8 (4 plans), archived to `.planning/milestones/v1.1-*`, tagged `v1.1`. JSON + XML formatters behind a shared `FormatterView` (FMT-01..08, zero new runtime deps) + the opt-in `StatusBar` size readout (UIX-01). Decoder + its 19 tests untouched. **Carry-forward (non-blocking):** FormatterView narrow-width vertical stacking (UX-05, polish).

## v1.0 — Distribution (SHIPPED, signed off 2026-06-01)

v1.0 complete — all 6 phases (28/28 plans): foundation/harness (1), shell (2), Protobuf hero + Base64/Hex/Bytes + UX constraints (3), the four catalogue tools (4), native polish (5), distributable self-updating signed-DMG macOS app + verified auto-updater (6). Full archive: `.planning/milestones/v1.0-*` + `.planning/MILESTONES.md`.

**Carry-forwards (NOT v1.3 blockers):** Gatekeeper-clean notarisation deferred post-Apple-enrolment (D-02, credentials-only flip); NAT-01 configurable global summon hotkey parked (G-05-1); 3 minor a11y polish follow-ups from the updater UI review; backlog 999.2 (CI track), 999.3 (theme settings), 999.4 (DevTools CLI), plus the remaining 999.1 tool wishlist (SQL formatter, Date, JSON↔YAML, Number Base, comparers, etc.).
