---
phase: 1
slug: scaffold-harness-proof
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-30
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (installed Wave 0) |
| **Config file** | `vitest.config.ts` / `vite.config.ts` (Wave 0 — must declare `@/` alias + `environment: node` for decoder tests) |
| **Quick run command** | `pnpm vitest run` |
| **Full suite command** | `pnpm vitest run && pnpm tsc --noEmit` |
| **Estimated runtime** | ~5-15 seconds (19 decoder cases + skeleton tests) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run` (also enforced by the lefthook pre-commit, HRN-03/D-07)
- **After every plan wave:** Run `pnpm vitest run && pnpm tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite green + the per-task UI gate (review→unit→ui) clean
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

> Filled by the planner/executor. The immovable bar: the 19 ported decoder cases (FND-03) must stay green from the moment `src/lib/` lands. The throwaway skeleton (HRN-01) adds its own TDD cases proving paste-transform + copy behavior.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 0 | FND-03 | — | decoder behavior unchanged | unit | `pnpm vitest run src/lib/protobuf` | ❌ W0 | ⬜ pending |
| TBD | TBD | — | HRN-01 | — | paste transforms, copy works | unit | `pnpm vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] vitest installed + `vite.config.ts`/`vitest.config.ts` with `@/` alias and `environment: node` for `src/lib`
- [ ] `src/lib/` ported unchanged; `pnpm vitest run src/lib/protobuf/decoder.test.ts` → 19/19 green (FND-03)
- [ ] `lefthook` installed + `lefthook.yml` pre-commit running `tsc --noEmit` + `vitest run` (HRN-03)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dark window renders matching `--win`/`--bg-app` | FND-01 | Real-webview visual | `tauri dev`, screenshot, compare to design colors |
| Real-webview UI gate (paste/copy/status bar) | HRN-01 | Needs running app | Drive `tauri dev` via tauri-plugin-webdriver (or screenshot+chrome-devtools-mcp fallback) |
| macOS automation path proven OR fallback documented | HRN-02 | Spike outcome | Recorded in `docs/phase-0-notes.md` |
| `tauri build` produces runnable bundle | HRN-04 | Build artifact | Run `tauri build`; launch the bundle |
| `/codex:review` gate | HRN-01 | `disable-model-invocation`; manual | `/codex:review --wait --scope working-tree` per task |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (vitest, ported lib, lefthook)
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
