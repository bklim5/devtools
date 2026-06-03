---
phase: 14-regex-tester
plan: 02
subsystem: regex-core
tags: [regex, web-worker, pure-logic, error-as-value, tdd]
requires:
  - "src/lib/url.ts (error-as-value discriminated-union precedent — mirrored, not imported)"
provides:
  - "src/lib/regex/regex.ts — pure regex core: buildRegex/enumerate/applyReplace/runRegex + COMMON_PATTERNS + RegexRequest/RegexMatch/RegexResult types"
  - "src/lib/regex/worker.ts — thin Web Worker transport posting { id, ...RegexResult }"
affects:
  - "Plan 14-03 (RegexTool view) imports runRegex types + COMMON_PATTERNS and spawns worker.ts via new Worker(new URL('./worker.ts', import.meta.url), {type:'module'})"
tech-stack:
  added: []
  patterns:
    - "Error-as-value discriminated union (mirrors src/lib/url.ts) — view renders without try/catch"
    - "g-forced enumeration via String.prototype.matchAll (no exec loop, no zero-length hang)"
    - "Native replace expansion ($1/$<name>/$&); user's TRUE flags drive all-vs-first"
    - "Off-thread compile+match in a Vite same-origin module-chunk Worker (no blob, CSP-clean)"
key-files:
  created:
    - "src/lib/regex/regex.ts"
    - "src/lib/regex/worker.ts"
    - "src/lib/regex/regex.test.ts (drafted in the absorbed 14-01 RED wave; committed GREEN here)"
  modified: []
decisions:
  - "regex.test.ts (originally Plan 14-01's standalone RED file) was committed GREEN in the same commit as regex.ts, per the user's Rule-4 merge decision (RED-only commits cannot pass the binding lefthook tsc+vitest pre-commit hook)"
  - "worker.ts committed atomically on its own — not unit-testable in node/jsdom (no real Worker); its logic is covered by regex.test.ts, its transport by Plan-03's real-WKWebView e2e"
metrics:
  duration: "~2 min"
  completed: "2026-06-03"
  tasks: 2
  files: 3
  commits: 2
---

# Phase 14 Plan 02: Pure Regex Core + Web Worker Transport Summary

Pure, total, error-as-value regex core (`buildRegex`/`enumerate`/`applyReplace`/`runRegex` + frozen Email/URL/IPv4 `COMMON_PATTERNS`) over native `RegExp`/`matchAll`/`replace`, plus a dumb off-thread Worker transport that imports it and posts `{ id, ...result }` — zero new runtime deps.

## What Was Built

- **`src/lib/regex/regex.ts`** — the entire testable surface, mirroring `src/lib/url.ts`'s house style:
  - `RegexRequest` / `RegexMatch` / `RegexResult` types (verbatim from the 14-01 interface block).
  - `buildRegex(source, flags)` — force-adds `g` for enumeration (matchAll throws without it, RESEARCH Pitfall 3); invalid source → `{ error }` carrying the native message verbatim (RGX-07), never throws.
  - `enumerate(text, re)` — `[...text.matchAll(re)]` mapped to `{ index, length, full, groups (m.slice(1)), named (m.groups ?? {}) }`. matchAll advances zero-length matches internally (no exec loop, `/^/gm` does not hang — Pitfall 4).
  - `applyReplace(text, re, repl)` — native `text.replace` ($1/$<name>/$&/$$); never hand-rolled.
  - `runRegex(req)` — empty pattern OR empty text → `{ empty: true }` (D-13); else g-forced enumerate, then (only when `req.replace !== undefined` — empty string is a valid replacement) compile a SECOND regex with the user's TRUE flags and attach `replaced` (g => all, no g => first, D-07). Total — never throws.
  - `COMMON_PATTERNS` — frozen `as const`, exactly Email/URL/IPv4 in order, simple/linear (D-09/D-12) so the library never trips the Plan-03 watchdog.
  - No RegExp cached across calls (fresh compile each run — a shared `lastIndex` would corrupt subsequent matchAll runs).
- **`src/lib/regex/worker.ts`** — the codebase's only Worker, a thin transport: `self.onmessage` → `runRegex(e.data)` → `postMessage({ id, ...result })`. Compiling + matching inside the worker keeps a catastrophic COMPILE and match off-thread (T-14-01, D-14). No object-URL/blob fallback (CSP `script-src 'self'` clean, T-14-03); consumed as a Vite same-origin module chunk in Plan 03.

## Task Commits

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Pure core + COMMON_PATTERNS (GREEN) | `cd604c07` | src/lib/regex/regex.ts, src/lib/regex/regex.test.ts |
| 2 | Worker transport | `0b64d34d` | src/lib/regex/worker.ts |

Both commits passed the binding lefthook pre-commit hook (tsc --noEmit + full vitest 573/573 + eslint). NO `--no-verify` used.

## Verification

- `pnpm vitest run src/lib/regex` → **23/23 GREEN** (RGX-01/02/03/04/07 + zero-length `/^/gm` + empty state + 3-entry COMMON_PATTERNS).
- Full suite at each commit: **573/573 vitest**, typecheck clean (hook-enforced).
- `pnpm tsc --noEmit` → no errors in regex.ts / worker.ts.
- `pnpm eslint src/lib/regex` → clean (exit 0).
- `git diff --quiet src/lib/protobuf/decoder.ts` → **decoder + its 19 tests byte-for-byte untouched** (immovable bar held).
- `git diff --quiet src-tauri/tauri.conf.json` → **CSP untouched**.
- worker.ts absence invariants: no `createObjectURL`, no `Blob` token in source.

## Deviations from Plan

**1. [Merge decision — pre-approved Rule 4] regex.test.ts (originally Plan 14-01) committed here, GREEN**
- **Context:** The user merged the standalone 14-01 TDD "RED" wave into 02/03 before execution started. The binding lefthook pre-commit hook runs tsc + vitest over the tree and rejects any commit where they fail, so a RED-only test commit cannot land.
- **Action:** The already-drafted `src/lib/regex/regex.test.ts` was treated as the authoritative spec and committed GREEN in the SAME commit as `regex.ts` (commit `cd604c07`). No refinement to the spec was needed — the drafted interface matched the implemented one exactly; all 23 cases passed against the first implementation.
- **Files:** src/lib/regex/regex.test.ts (committed, not modified after drafting).

**2. [Rule 1 — clarity fix] Reworded a worker.ts comment so the absence-grep is unambiguous**
- **Found during:** Task 2 acceptance check.
- **Issue:** The explanatory comment originally contained the literal token `createObjectURL`, which tripped the plan's `grep -q "createObjectURL" → absent` acceptance criterion (it matched the comment, not real code). This mirrors a known repo gotcha (the URL e2e `dangerouslySetInnerHTML` absence-grep flake).
- **Fix:** Reworded the comment to "object-URL / blob fallback worker" so no `createObjectURL`/`Blob` literal appears anywhere in the file. Behavior unchanged.
- **Files:** src/lib/regex/worker.ts. **Commit:** folded into `0b64d34d` (reworded before the Task-2 commit).

The component test (`RegexTool.test.tsx`) and e2e (`regex.e2e.ts`) from the original 14-01 plan were NOT written here — they belong to Plan 14-03, per the merge decision.

## Authentication Gates

None.

## Notes for Plan 14-03

- Import types + COMMON_PATTERNS from `src/lib/regex/regex.ts`; spawn the worker via `new Worker(new URL("./worker.ts", import.meta.url), { type: "module" })`.
- The view's watchdog (terminate-on-timeout) and the `timedOut` UI state are 14-03's responsibility — `runRegex` is synchronous/total and never returns `timedOut`.
- The 14-01-drafted `RegexTool.test.tsx` + `regex.e2e.ts` (not yet on disk) define the view's consumer contract: `#regex-pattern`, `#regex-text`, the "Insert a common pattern" chip group, escaped rendering (no `dangerouslySetInnerHTML`), and the `(a+)+$` timeout e2e.

## Self-Check: PASSED

- FOUND: src/lib/regex/regex.ts
- FOUND: src/lib/regex/worker.ts
- FOUND: src/lib/regex/regex.test.ts
- FOUND commit: cd604c07
- FOUND commit: 0b64d34d
