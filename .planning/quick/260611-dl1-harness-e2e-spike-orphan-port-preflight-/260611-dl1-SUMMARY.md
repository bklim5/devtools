---
phase: quick-260611-dl1
plan: 01
subsystem: harness
tags: [e2e, lefthook, hygiene, preflight]
requires: []
provides:
  - "e2e-spike.sh preflight: orphan devtools-app + :4445/:1420 port clearing before every launch (PREFLIGHT_ONLY=1 dry-run)"
  - "lefthook pre-commit unit gate now runs tsc + vitest + eslint"
  - "docs/archive/ with three relocated stale docs; deduped .gitignore"
affects: [e2e-harness, commit-gate, docs]
tech-stack:
  added: []
  patterns: ["preflight kill+log (never silently abort) with bounded waits and fail-loud exits"]
key-files:
  created:
    - docs/archive/phase-0-notes.md (git mv)
    - docs/archive/phase-1-ui-review.md (git mv)
    - docs/archive/superpowers-specs/2026-06-02-json-xml-formatters-design.md (git mv)
  modified:
    - scripts/e2e-spike.sh
    - lefthook.yml
    - .gitignore
    - README.md
    - docs/harness-and-decisions.md
    - docs/handoff-instructions.md
decisions:
  - "Port kills filter on -sTCP:LISTEN so a mere client connection to :4445/:1420 is never killed (tightens T-q260611-01 mitigation beyond the plan's bare lsof -ti)"
  - "Orphan that survives SIGKILL → exit 1, never launch (codex review P2: unconditional break after escalation could still launch over a stale single-instance app)"
metrics:
  duration: "8 minutes"
  completed: "2026-06-11"
  tasks: 3
  files: 9
---

# Quick 260611-dl1: Harness e2e-spike Orphan/Port Preflight + Hygiene Summary

e2e-spike.sh preflight kills orphan devtools-app + clears :4445/:1420 before launch (a green e2e run now provably ran current code); eslint joins the lefthook unit gate; .gitignore deduped, stale logs purged, three stale docs archived.

## Tasks

| # | Task | Commit |
|---|------|--------|
| 1 | Orphan/port preflight in scripts/e2e-spike.sh | 02a76acf |
| 2 | eslint in lefthook pre-commit unit gate | fbaa2333 |
| 3 | Hygiene: .gitignore dedupe, stale logs, doc archive | 4aff0de8 |

## What was built

**Task 1 — preflight() in scripts/e2e-spike.sh** (runs before the `pnpm tauri:dev:e2e` launch):
1. `orphan_pids()` helper — `pgrep -f devtools-app` (dev binary only; production app is TinkerDev) excluding `$$`.
2. TERM all orphans → bounded re-poll → KILL escalation at ~5s → **exit 1 if one survives KILL** (single-instance plugin means launching over it can never work).
3. Kill anything LISTENING on `$PORT` (4445) and `VITE_PORT` (1420) via `lsof -ti tcp:<port> -sTCP:LISTEN`; bounded ~10s poll with KILL escalation halfway; fail loud naming port + holder PID if still held.
4. `PREFLIGHT_ONLY=1` dry-run exits 0 after preflight without launching tauri (documented in the header Env block).
Existing trap/cleanup, nc -z poll, and WDIO invocation untouched.

**Task 2 — lefthook.yml**: `lint: run: pnpm lint` added to the parallel pre-commit block (~3s); D-08 gate header now reads "broken types, lint errors, or failing tests". `pnpm lefthook validate` → "All good". Both subsequent commits exercised the three-command hook live — all green.

**Task 3 — hygiene**: duplicate `test/e2e/__screenshots__/`+`__logs__` block removed from .gitignore (each path now once); 9 stale gitignored files deleted from test/e2e/__logs__/; `git mv` (renames at 100% similarity, history preserved) of phase-0-notes.md, phase-1-ui-review.md, and the superpowers spec into docs/archive/; empty docs/superpowers/ removed; all 4 live references rewritten (README.md:34, harness-and-decisions.md:113, handoff-instructions.md:107 + tree diagram :143); .planning/ untouched.

## Verification

- `bash -n` clean; `PREFLIGHT_ONLY=1 bash scripts/e2e-spike.sh` exits 0 with `[spike] preflight:` lines, no tauri launch.
- Live port test: `nc -l 4445` → preflight logged "killing pid N holding :4445…", port confirmed free after.
- Unit gate proven live on every commit: tsc + vitest (816/816) + eslint all green via the new three-command hook.
- Task 3 automated check green: .gitignore counts = 1, archive files exist, old paths gone, zero live references to old paths, __logs__ empty.
- Full e2e run + UI gate: N/A per plan (no UI surface; deferred to a later batch).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fail loud when an orphan survives SIGKILL**
- **Found during:** Task 1 (codex review P2 finding)
- **Issue:** After KILL escalation the re-poll loop `break`-ed unconditionally, so preflight could proceed against an unkillable stale app — the exact condition it exists to prevent.
- **Fix:** Re-poll continues after escalation; `exit 1` with the surviving PID if `orphan_pids` still matches at ~10s. Orphan matching consolidated into one `orphan_pids()` helper so loop condition and kill targets agree.
- **Files modified:** scripts/e2e-spike.sh
- **Commit:** 02a76acf

**2. [Rule 2 - Missing safety] LISTEN-only port kills**
- **Found during:** Task 1
- **Issue:** Plan specified bare `lsof -ti tcp:$port`, which also matches client connections — could kill an unrelated process merely connected to the port (threat T-q260611-01, mitigate disposition).
- **Fix:** Added `-sTCP:LISTEN` so only listeners are killed.
- **Files modified:** scripts/e2e-spike.sh
- **Commit:** 02a76acf

## Harness gates (per-task DoD)

- simplify: preflight reviewed for reuse/altitude — kill loops kept separate (differing TERM-vs-escalation semantics), orphan matching factored into `orphan_pids()`.
- codex:review via `codex review` CLI (0.135.0): Task 1 `--uncommitted` (1 P2 finding, fixed above, re-verified); Tasks 2+3 `--base HEAD~2` → "no actionable regression".
- Unit: tsc + vitest + eslint green on all three commits (hook-enforced).
- Real-webview UI gate: N/A (no UI surface touched).

## Known Stubs

None.

## Threat Flags

None — no new network/auth/file surface beyond the plan's threat model; port-kill mitigation tightened (LISTEN-only).

## Self-Check: PASSED
