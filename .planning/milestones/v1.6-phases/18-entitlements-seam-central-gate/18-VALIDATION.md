---
phase: 18
slug: entitlements-seam-central-gate
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-10
updated: 2026-06-10
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 18-RESEARCH.md §Validation Architecture + the four approved plans' `<automated>` verify commands.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.7 (node env default; jsdom per-file via `// @vitest-environment jsdom`) + wdio real-WKWebView e2e |
| **Config file** | `vite.config.ts` (test block), `wdio.conf.ts` |
| **Quick run command** | `pnpm vitest run <file>` (single-file run ~100ms, verified) |
| **Full suite command** | `pnpm vitest run && pnpm tsc --noEmit` (lefthook pre-commit enforces both); e2e: `scripts/e2e-spike.sh` |
| **Estimated runtime** | unit+tsc ~30s; full e2e suite minutes (phase-gate only, not per-task) |

---

## Sampling Rate

- **After every task commit:** Run the task's `<automated>` command (touched-area `pnpm vitest run <files>`); lefthook pre-commit additionally runs full `pnpm vitest run` + `pnpm tsc --noEmit` — non-negotiable
- **After every plan wave:** Full `pnpm vitest run && pnpm tsc --noEmit && pnpm lint`; real-WKWebView spot e2e for UI tasks (Plans 02/03 verification sections)
- **Before `/gsd-verify-work` / phase gate:** Full unit suite + ALL existing e2e specs green (criterion 4: lazified app behaves identically) + new `entitlements.e2e.ts` + `pnpm build && ./scripts/check-dev-strip.sh` + `pnpm tauri build` + gsd-ui-review WCAG-AA audit + human walkthrough
- **Max feedback latency:** < 60s for the unit loop (e2e and builds excluded from the per-task loop by design)
- **No watch-mode flags anywhere** — all commands are `vitest run` / one-shot scripts

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 1 | ENT-01, ENT-02 | T-18-01 | `coerceEntitlementsOverride` accepts exactly `"free"`; junk → `null` (untrusted prefs.json) | unit (node) | `pnpm vitest run src/lib/entitlements/entitlements.test.ts src/shell/prefsStore.test.ts && pnpm tsc --noEmit` | ❌ W0 | ⬜ pending |
| 18-01-02 | 01 | 1 | ENT-03 | T-18-02, T-18-03, T-18-04 | Override is structurally downgrade-only; `setEntitlementsForTest` guarded by MODE/DEV; single resolution flip point | unit (jsdom) | `pnpm vitest run src/lib/entitlements/resolve.test.ts && pnpm vitest run && pnpm tsc --noEmit` | ❌ W0 | ⬜ pending |
| 18-01-03 | 01 | 1 | ENT-04 | T-18-05 (accept) | Stub `BUY_LICENSE_URL` no-op; no pricing strings; dialog a11y contract | unit (jsdom) | `pnpm vitest run src/components/UpsellPanel.test.tsx && pnpm tsc --noEmit` | ❌ W0 | ⬜ pending |
| 18-02-01 | 02 | 2 | ENT-05 | — | N/A (mechanical registry conversion; decoder byte-identical asserted) | type + grep | `pnpm tsc --noEmit && grep -L "component: () => import(" src/tools/*/index.ts \| wc -l \| grep -q "^ *0$" && git diff --stat src/lib/protobuf/decoder.ts src/lib/protobuf/decoder.test.ts \| wc -l \| grep -q "^ *0$" && echo OK` | ✅ (tsc/grep) | ⬜ pending |
| 18-02-02 | 02 | 2 | ENT-01, ENT-05 | T-18-06, T-18-07, T-18-08 | Locked branch returns BEFORE lazy loader invoked (0 calls asserted); deep links to locked tools render upsell, never the tool | unit (jsdom) | `pnpm vitest run src/components/ToolRoute.test.tsx && pnpm vitest run && pnpm tsc --noEmit` | ❌ W0 | ⬜ pending |
| 18-02-03 | 02 | 2 | ENT-05 | T-18-06 | Decoder isolated to the protobuf chunk (free-build exclusion seam) | build | `pnpm build && ls dist/assets/*.js \| wc -l \| awk '{exit ($1 < 12) ? 1 : 0}' && echo CHUNKS-OK` | ✅ (build) | ⬜ pending |
| 18-03-01 | 03 | 2 | ENT-02 | T-18-12 | Lock branches return before any setter — no prefs write path while locked | unit (jsdom) | `pnpm vitest run src/components/Sidebar.test.tsx && pnpm tsc --noEmit` | ❌ W0 (extend existing) | ⬜ pending |
| 18-03-02 | 03 | 2 | ENT-04 | T-18-11 | Rows render registry names via fixture/getToolById, never stored strings | unit (jsdom) | `pnpm vitest run src/components/Sidebar.test.tsx src/components/Sidebar.locked.test.tsx && pnpm tsc --noEmit` | ❌ W0 | ⬜ pending |
| 18-03-03 | 03 | 2 | ENT-04 | T-18-09, T-18-10 | Toggle command exists only under `import.meta.env.DEV`; writes only `"free"`/`null` via the coercer path | unit (jsdom) | `pnpm vitest run src/components/CommandPalette.test.tsx src/components/CommandPalette.locked.test.tsx && pnpm vitest run && pnpm tsc --noEmit` | ❌ W0 | ⬜ pending |
| 18-04-01 | 04 | 3 | D-18 doc reconciliation | T-18-14 | No source-of-truth doc still claims the decoder is locked (mis-scopes Phase 21) | grep | `! grep -rn "locks the Protobuf" .planning/REQUIREMENTS.md .planning/ROADMAP.md .planning/PROJECT.md && grep -q "D-18" .planning/REQUIREMENTS.md && grep -q "D-18" docs/licensing-research.md && echo DOCS-OK` | ✅ (grep) | ⬜ pending |
| 18-04-02 | 04 | 3 | ENT-04, ENT-05 | T-18-13, T-18-15 | Dev toggle absent from dist/assets (dist-grep); e2e toggles back to full as final step (no leftover override) | build + e2e (real WKWebView) | `pnpm build && ./scripts/check-dev-strip.sh && scripts/e2e-spike.sh` | ❌ W0 (`test/e2e/entitlements.e2e.ts`, `scripts/check-dev-strip.sh`) | ⬜ pending |
| 18-04-03 | 04 | 3 | ENT-03 (criteria 3/4) | T-18-14 | Packaged default certified as PRE-licensing everything-unlocked baseline | checkpoint (manual + build) | `pnpm tauri build; ls src-tauri/target/release/bundle/macos/*.app` | ✅ (build) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

**Lefthook constraint (binding — project memory "TDD RED commits blocked by lefthook"):** the pre-commit hook runs full `tsc --noEmit` + `vitest run`, so standalone RED-only test-scaffold commits are impossible. There is therefore **no separate Wave 0 commit**: every ❌ W0 file below lands GREEN inside the same commit as its implementing task (tasks are marked `tdd="true"` with explicit `<behavior>` blocks — tests are written first, committed together with the impl). `wave_0_complete` flips meaning to "all W0 files exist and are green", which coincides with their owning tasks completing.

- [ ] `src/lib/entitlements/entitlements.test.ts` — vocabulary, `isEntitled`, `isToolLocked`, `gatePreferences` (ENT-01/02) — lands with 18-01-01
- [ ] `src/lib/entitlements/resolve.test.ts` — env split, downgrade-only override, store subscribe/refresh, test-seam guards (ENT-03) — lands with 18-01-02
- [ ] `src/components/UpsellPanel.test.tsx` — content, CTA constant, dialog a11y (ENT-04) — lands with 18-01-03
- [ ] `src/components/ToolRoute.test.tsx` — locked = no loader call; reactive flip; lazy cache (ENT-01/05) — lands with 18-02-02
- [ ] `src/components/Sidebar.locked.test.tsx` + `src/components/CommandPalette.locked.test.tsx` — fixture-registry dormant-mechanism proofs (ENT-04) — land with 18-03-02 / 18-03-03
- [ ] Extensions to existing `Sidebar.test.tsx`, `CommandPalette.test.tsx`, `prefsStore.test.ts` (incl. the Pitfall-5 `setEntitlementsForTest(FULL_SET)` setup shims) — land with their owning tasks
- [ ] `test/e2e/entitlements.e2e.ts` + `scripts/check-dev-strip.sh` — real-WKWebView locked-UX proof + D-32 dist-grep (ENT-04) — land with 18-04-02 (write + RUN via `scripts/e2e-spike.sh`, per memory)
- Framework install: **none needed** — existing vitest/wdio infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Packaged app is everything-unlocked and visually unchanged (no lock badges, no footer row, no dev command) | ENT-03 / phase criteria 3+4 | Packaged-bundle behavior differs from dev/e2e by design (Pitfall 6); the Tauri store override read path is packaged-only (Pitfall 4) | Plan 04 Task 3 walkthrough steps 1–6 on the fresh `.app` under `src-tauri/target/release/bundle/macos/` |
| No perceptible blank on lazy tool loads; paste-to-interpretation < 2s | ENT-05 | Perceived instantness on the real WKWebView is not machine-assertable (Suspense `fallback={null}`, Pitfall 8b) | Walkthrough steps 4–5: open protobuf decoder, paste blob; rapid tool switching |
| WCAG-AA audit of the new lock/upsell surfaces | ENT-04 | gsd-ui-review audit + human judgment | Run gsd-ui-review in dev mode (surfaces are dormant in the packaged app) at the phase gate |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (12/12 tasks carry an `<automated>` command; W0 files land green with their tasks)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every task has one; lefthook adds full-suite per commit)
- [x] Wave 0 covers all MISSING references (folded into task commits per the lefthook constraint — no standalone RED commits)
- [x] No watch-mode flags (all `vitest run` / one-shot scripts)
- [x] Feedback latency < 60s for the per-task unit loop (builds/e2e reserved for wave + phase gates)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-10 (populated during plan-checker revision; plans unchanged)
