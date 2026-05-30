---
phase: 2
slug: shell
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-30
validated: 2026-05-30
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Reconstructed retroactively by `/gsd-validate-phase 2` — the phase was executed
> and human-approved before this contract was filled in.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.7 |
| **Config file** | `vite.config.ts` (`test` block; `environment: node`, per-file `// @vitest-environment jsdom` opt-in for RTL) |
| **Quick run command** | `pnpm exec vitest run <file>` (per-task) |
| **Full suite command** | `pnpm test` (`vitest run`) + `pnpm exec tsc --noEmit` |
| **Estimated runtime** | ~1.2 seconds (96 tests, 13 files) |

---

## Sampling Rate

- **After every task commit:** Run the task's `pnpm exec vitest run <file>` + `pnpm exec tsc --noEmit`
- **After every plan wave:** Run `pnpm test` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | SHL-04 | — | N/A (deps + `store:default` capability scope, not broader) | infra/grep | `grep` deps + capability + plugin registration | ✅ | ✅ green |
| 02-01-02 | 01 | 1 | SHL-05 | T-02 (store tampering) | corrupt/non-JSON stored value degrades to `undefined` (no throw) | unit | `pnpm exec vitest run src/lib/platform/store.test.ts src/lib/platform/platform.test.ts` | ✅ `store.test.ts` (4), `platform.test.ts` (4) | ✅ green |
| 02-01-03 | 01 | 1 | SHL-04 | — | N/A (shell CSS tokens + enable three tools) | build/grep | `grep` tokens + `pnpm exec tsc --noEmit` | ✅ | ✅ green |
| 02-02-01 | 02 | 1 | SHL-02 | — | N/A (in-house ranker, no cmdk/fuse.js — D-06) | unit | `pnpm exec vitest run src/shell/fuzzy.test.ts` | ✅ `fuzzy.test.ts` (11) | ✅ green |
| 02-03-01 | 03 | 2 | SHL-03, SHL-05 | T-02-10 (tampered recents); corrupt prefs blob; unknown-field injection | tampered recents array drops non-string ids; corrupt blob → `DEFAULT_PREFERENCES`; unknown/wrong-typed fields rejected | unit | `pnpm exec vitest run src/shell/usePreferences.test.ts src/shell/useRecentTools.test.ts` | ✅ `usePreferences.test.ts` (7), `useRecentTools.test.ts` (7) | ✅ green |
| 02-03-02 | 03 | 2 | SHL-06 | T-02-07 (unknown/disabled startup id) | invalid/disabled/unknown last-used or deep-link id → hero fallback; never returns an unvalidated id | unit | `pnpm exec vitest run src/shell/resolveStartupTool.test.ts` | ✅ `resolveStartupTool.test.ts` (8), `parseHashTarget.test.ts` (5) | ✅ green |
| 02-03-03 | 03 | 2 | SHL-06, SHL-04 | — | first-run → hero; persisted last-used restored before first paint (Pitfall 3); writes hit installed store not localStorage fallback | integration | `pnpm exec vitest run src/router.test.tsx` | ✅ `router.test.tsx` (8), `prefsStore.test.ts` (2) | ✅ green |
| 02-04-01 | 04 | 3 | SHL-01, SHL-04 | — | sidebar derives only from `ENABLED_TOOLS`; holds no list of its own | unit (RTL) | `pnpm exec vitest run src/components/Sidebar.test.tsx` | ✅ `Sidebar.test.tsx` (6) | ✅ green |
| 02-04-02 | 04 | 3 | SHL-02, SHL-03 | T-02-10 (tampered recents id) | palette skips a tampered recents id that is not a real tool; no-match shows a quiet row, not an error | unit (RTL) | `pnpm exec vitest run src/components/CommandPalette.test.tsx` | ✅ `CommandPalette.test.tsx` (11) | ✅ green |
| 02-04-03 | 04 | 3 | SHL-04, SHL-06 | T-02-07 (tampered/unknown id) | last-used + recents recorded atomically on every route; unknown/tampered id not persisted; not recorded on index/unknown route | unit (RTL) | `pnpm exec vitest run src/shell/useTrackActiveTool.test.tsx` + `pnpm test` | ✅ `useTrackActiveTool.test.tsx` (4) | ✅ green |
| 02-04-04 | 04 | 3 | SHL-01/02/03/04/06 | — | full shell on real WKWebView; WCAG-AA; fresh `tauri build` launches | manual | — (human-verify checkpoint, blocking) | N/A | ✅ approved 2026-05-30 |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Full suite:** `pnpm test` → 13 files, 96 tests passed (incl. the 19 immovable decoder tests). `pnpm exec tsc --noEmit` clean.

---

## Wave 0 Requirements

Existing infrastructure (vitest, configured in `vite.config.ts` since Phase 1) covers all phase requirements. Phase 2 added its own per-feature tests via TDD — no separate Wave 0 stub pass was required. All MISSING references resolved.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sidebar active styling (left accent bar, accent-soft tint, icon→accent) | SHL-01 | Visual/CSS render; unit tests assert `aria-current` + structure, not pixels | On `pnpm tauri dev`, click a sidebar item; confirm the active item shows the left accent bar + tint and the icon turns accent. |
| WCAG-AA contrast + visible focus indicators | cross-cutting | Requires real rendered surfaces + `gsd-ui-review`/axe audit | Run a `gsd-ui-review` WCAG-AA audit: AA text contrast on `--color-tx`/`--color-tx-2` over their surfaces; visible focus on sidebar links + palette input; no opacity-only disabled state. |
| First-run boot + last-used restore across an app restart | SHL-06, SHL-05 | Packaged `@tauri-apps/plugin-store` path is invisible to unit tests (they use an in-memory store) — async-init race only reproduces on the real WKWebView | On `pnpm tauri dev`: confirm opens directly to hero on first run; switch to base64, quit, relaunch → reopens to base64. See `[[tauri-store-async-init-race]]`. |
| Deep-link open + silent fallback | SHL-06 (D-13/D-14) | End-to-end hash routing in the real webview | Load `#/tools/base64` → opens base64; load `#/tools/does-not-exist` → silently falls back to hero (no 404/blank). |
| Fresh `tauri build` bundle launches | cross-cutting | Build + native launch cannot be unit-tested | Run `pnpm tauri build`; launch the bundle; confirm it opens. |

All manual-only behaviors were exercised and **approved at the Phase-2 human-verify checkpoint** (Task 02-04-04, closed in commit `49491630`). Two production-only startup bugs surfaced there were fixed in commit `d4e44f5b`.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are inherently manual (visual/packaged-runtime, human-approved)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none — existing infra sufficient)
- [x] No watch-mode flags (`vitest run`, not `vitest`)
- [x] Feedback latency < 2s (~1.2s full suite)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-30

---

## Validation Audit 2026-05-30

| Metric | Count |
|--------|-------|
| Requirements audited | 6 (SHL-01..06) |
| Automated gaps found | 0 |
| Resolved (tests added) | 0 (full coverage already present) |
| Escalated to manual-only | 0 (5 inherently-manual behaviors documented, all human-approved) |

Phase 2 is **Nyquist-compliant**: every declared requirement has automated verification backed by a green test, and all behaviors that cannot be unit-tested were verified on the real WKWebView at the blocking human-verify checkpoint.
