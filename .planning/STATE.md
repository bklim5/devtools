---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Release Tooling
status: Roadmap created
last_updated: "2026-06-02T18:00:00.000Z"
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Current Position

Phase: 9 (Pure release core + housekeeping) — context gathered, not yet planned
Plan: —
Status: Context captured (09-CONTEXT.md); ready to plan Phase 9
Last activity: 2026-06-02 — Phase 9 context gathered (4 decisions: surgical manifest edits, pure options-object buildLatestJson, minimal hand-rolled semver, idempotent latest.json verify + dogfooded Cargo reconcile)

**Milestone v1.2 "Release Tooling" roadmapped 2026-06-02.** Three phases (9–11), numbering continued from v1.1's Phase 8 (did NOT reset to 1). All 12 v1.2 requirements (REL-01..12) mapped 1:1 to a phase (12/12 coverage, no orphans, no duplicates). Goal: replace the manual `docs/RELEASE.md` dance with two composable local helper scripts over a unit-tested pure core. The recommended three-phase shape (HIGH-confidence convergence across all 4 researchers) was adopted unchanged:

- **Phase 9 — Pure release core + housekeeping:** new `src/lib/release/` (`version.ts` semver bump + per-manifest content edits incl. the `[package]`-scoped Cargo edit; `manifest.ts` `buildLatestJson` + dual-key `platformKey`), auto-covered by the existing `tsc`+`vitest` gate. One-time housekeeping: reconcile `Cargo.toml` 0.1.0 → current (REL-02), untrack the stale `latest.json` (REL-08). NO I/O, NO scripts yet. Standard pattern — no per-phase research needed.
- **Phase 10 — `bump-and-tag` driver:** thin `scripts/bump-and-tag.mjs` importing Phase 9; lockstep 3-file write + lockfile regen (REL-01/REL-03), git tag + push to private origin (REL-04), `--dry-run` (REL-10) + preflights (REL-11); wire `pnpm release:bump`. Standard pattern — no per-phase research needed.
- **Phase 11 — `build-and-publish` driver + universal binary + safety rails:** `scripts/build-and-publish.mjs`; universal `tauri build` (REL-05), fresh-`.sig` dual-key `latest.json` (REL-06), cross-repo `gh` publish (REL-07), `APPLE_*` passthrough (REL-09), post-publish `curl` verify (REL-12), plus the build/publish-half of `--dry-run`/preflights. **This phase needs the real updater round-trip as its human-gate acceptance criterion** (the universal dual-key behavior must be proven live, not just unit-asserted — the load-bearing DST-02 proof). FLAGGED for deeper validation during planning.

**Cross-phase note:** REL-10 (`--dry-run`) and REL-11 (preflights) span Phases 10+11; each is mapped once to Phase 10 (first delivery), with the build/publish-half described in Phase 11. The *pure* logic behind REL-01/REL-06 is authored in Phase 9 but mapped to its delivery phase (10/11).

App semver (`0.2.x`) stays decoupled from GSD milestone tags (`v1.x`); the pipeline keys off the **app** version. CI is PARKED — the remaining CI track stays in ROADMAP.md backlog 999.2 (cross-repo PAT + minisign secrets in Actions, CI checks on push/PR, tag-triggered CI release).

Next: `/gsd-plan-phase 9`.

**Standing constraints carried into v1.2 (binding):** offline/no-network at runtime; paste-instant (<2s); keyboard-driven; registry-driven single control plane; HashRouter only; WCAG-AA across the board; layout-agnostic tool components; **zero new runtime dependencies** (devDependencies are acceptable for release tooling — but the converged research finding is that even devDeps are unnecessary; Node builtins + `tsx` + Tauri CLI + `gh` + `rustup` cover everything); **the hero decoder `src/lib/protobuf/decoder.ts` + its 19 tests stay byte-for-byte untouched**. Per-task DoD order: `/simplify` → `/codex:review` → `vitest` + `tsc` + `eslint` green → real-WKWebView UI verification **where UI is touched**. **Phases 9–11 touch NO app UI** — the per-task real-WKWebView UI gate is N/A except Phase 11's real updater round-trip, which IS the milestone's human sign-off. Each phase boundary ends with a human sign-off.

## Active Plan

**None yet — v1.2 roadmap just created (Phases 9–11). Ready to plan Phase 9.**

Phase 9 (Pure release core + housekeeping) is the first phase and depends on nothing but existing repo state. It delivers the unit-testable pure core (`src/lib/release/version.ts` + `manifest.ts` + their `.test.ts`) plus two one-time housekeeping fixes (Cargo 0.1.0 → current reconcile; untrack stale `latest.json`). Standard pattern — research can be skipped at planning time. Phase 10 depends on Phase 9; Phase 11 depends on Phase 9 (manifest) + Phase 10 (the tag).

## Recent Activity

- **2026-06-02 — v1.2 "Release Tooling" milestone roadmap created (Phases 9–11).** Adopted the HIGH-confidence three-phase research shape unchanged: Phase 9 pure release core + housekeeping (`src/lib/release/` version+manifest, Cargo reconcile, untrack `latest.json`); Phase 10 `bump-and-tag` driver (lockstep bump + lockfiles + tag/push + dry-run + preflights); Phase 11 `build-and-publish` driver (universal binary + fresh-sig dual-key `latest.json` + cross-repo `gh` publish + `APPLE_*` + curl-verify, with the real updater round-trip as the human gate). All 12 requirements (REL-01..12) mapped 1:1 (12/12, no orphans/dupes) in `.planning/REQUIREMENTS.md` Traceability; ROADMAP.md appended (v1.0/v1.1 history + 999.x backlog preserved; backlog 999.2 annotated to show its local-scripts half is now v1.2 and only the CI track remains parked); STATE.md updated. Numbering continued from v1.1's Phase 8 — did NOT reset to 1. Next: `/gsd-plan-phase 9`.
- **2026-06-02 — Phase 8 (StatusBar size-readout cleanup) COMPLETE & signed off.** Last phase of milestone v1.1 — milestone v1.1 "Formatters" fully delivered (Phases 7 + 8), archived to `.planning/milestones/v1.1-*`, tagged `v1.1`. Final: 378 vitest / 44 files green, `tsc`/`eslint` clean, zero new deps, decoder + its 19 tests byte-for-byte untouched. UIX-01 ✓.
- **2026-06-02 — Phase 7 (Formatters) COMPLETE & signed off.** JSON + XML formatters behind the shared `FormatterView` (FMT-01..08); real-WKWebView e2e 10/10, WCAG-AA PASS, human-signed-off on `tauri build`.

## Blocker

- **None.** Phase 9 is the first v1.2 phase and depends only on existing repo state. (Note the latent state Phase 9 reconciles: `Cargo.toml` = `0.1.0` vs `package.json`/`tauri.conf.json` = `0.2.1`; `/latest.json` gitignored — verify actual `git ls-files` state at execution, don't assume it's still tracked.)

## Next Step (pick up here next session)

**`/gsd-plan-phase 9`** to plan the pure release core + housekeeping phase. Research can be skipped (standard pure string/JSON transform pattern, fully unit-testable, flagged "skip `/gsd-research-phase`" by the synthesizer). Phase 11 is the one flagged for deeper validation at planning time — the universal-binary updater platform-key behavior must be proven by a real round-trip on real hardware, not just unit-asserted.

## Harness reminder (per-task DoD, in order)

simplify → /codex:review → unit (vitest + tsc + eslint) → real-webview UI **(N/A for phases 9–11 — no app UI touched)**. Phase boundary: human sign-off. For v1.2 the load-bearing human gate is **Phase 11's real updater round-trip** (older install → detect → minisign verify against the committed pubkey → relaunch into new version), not a `gsd-ui-review` (no UI changed). Never skip gates; parallelize plans but not past the gates.

---

## v1.1 — Formatters (SHIPPED & ARCHIVED, 2026-06-02)

v1.1 is complete — Phases 7 + 8 both signed off (4 plans), archived to `.planning/milestones/v1.1-ROADMAP.md` + `v1.1-REQUIREMENTS.md`, tagged `v1.1`. JSON + XML formatters behind a shared `FormatterView` (FMT-01..08, zero new runtime deps) + the opt-in `StatusBar` size readout (UIX-01). 378 vitest / 44 files green; decoder + its 19 tests untouched. **Carry-forward (non-blocking):** FormatterView narrow-width vertical stacking (UX-05, polish — not a WCAG-AA blocker).

## v1.0 — Distribution (SHIPPED, signed off 2026-06-01)

v1.0 is complete — all 6 phases signed off (28/28 plans): foundation/harness (1), shell (2), Protobuf hero + Base64/Hex/Bytes + UX constraints (3), the four catalogue tools (4), native polish — tray + single-instance + window-geometry (5), and a distributable self-updating macOS app — signed (ad-hoc) DMG + signature-verified auto-updater, real 0.2.0 → 0.2.1 round-trip (6). Full archive: `.planning/milestones/v1.0-ROADMAP.md`, `.planning/milestones/v1.0-REQUIREMENTS.md`, `.planning/milestones/v1.0-phases/`, and `.planning/MILESTONES.md`.

**Carry-forwards from v1.0 (NOT v1.2 blockers):**

- **Gatekeeper-clean notarisation DEFERRED** post-Apple-Developer enrolment (D-02) — a credentials-only `APPLE_*` env flip per `docs/RELEASE.md`. v1.2 makes the scripts notarisation-ready (honor `APPLE_*` if present) but does NOT activate notarisation.
- **NAT-01 configurable global summon hotkey PARKED** (G-05-1) — seam kept intact for a future Settings phase.
- 3 minor non-blocking a11y polish follow-ups from the updater UI review.
- Backlog: Protobuf decimal-byte-array (`Uint8Array`) input mode; 999.1 SQL formatter; 999.3 theme settings; 999.4 DevTools CLI; 999.2 CI track (remaining after v1.2 delivers the local-scripts half).
