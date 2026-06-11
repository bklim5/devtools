---
phase: quick-260611-dww
plan: 01
subsystem: tools-ui / harness-docs
tags: [copybutton, dedup, regex, url, cron, harness, runbook]
requires: []
provides:
  - "Single shared CopyButton across all copy affordances (regex/url/cron migrated)"
  - "docs/HARNESS.md — operational runbook for the e2e gate"
affects: [src/tools/regex, src/tools/url, src/tools/cron, docs]
tech-stack:
  added: []
  patterns: ["shared CopyButton prepends 'Copy ' — call sites pass the bare noun"]
key-files:
  created:
    - docs/HARNESS.md
  modified:
    - src/tools/regex/RegexTool.tsx
    - src/tools/url/UrlTool.tsx
    - src/tools/cron/CronTool.tsx
  deleted:
    - src/tools/_placeholder/ToolPlaceholder.tsx
decisions:
  - "Regex/cron adopt the shared CopyButton appearance (icon + 11.5px) — cosmetic per review; NO size prop added"
  - "shrink-0 passed via className at call sites, not forked into the component"
metrics:
  duration: "~8 min"
  completed: "2026-06-11"
  tasks: 3
  files: 5
---

# Quick 260611-dww: Shared CopyButton in regex/url/cron + HARNESS.md Summary

Peer-review batch 2/4: de-duplicated three local CopyButton definitions into the existing shared `src/components/CopyButton.tsx` with byte-identical rendered aria-labels, deleted the never-imported `src/tools/_placeholder/`, and wrote `docs/HARNESS.md` as the e2e-gate operational runbook.

## What was done

### Task 1 — CopyButton migration + _placeholder deletion (`acba7c24`)
- Deleted the local `function CopyButton` in RegexTool/UrlTool/CronTool; all three now `import { CopyButton } from "@/components/CopyButton"`.
- Every call-site `label` stripped of its leading `Copy ` (the shared component prepends it), so rendered aria-labels are byte-identical — proven by the unchanged unit suites (UrlTool/CronTool/RegexTool tests query by these labels, 25/25 green).
- `className="shrink-0"` added at every migrated call site (all three locals had it in their base classes).
- Removed now-unused imports per file: `platform` + `useCopyFeedback` (all three), `Check`/`Copy` lucide icons (UrlTool).
- `git rm -r src/tools/_placeholder` — zero references existed outside the file itself (re-grep-confirmed).
- Net **-96 lines** (26 insertions / 122 deletions).

### Task 2 — docs/HARNESS.md (`3ff4ee97`, fixes `94d8cf99`)
71-line runbook covering: entry point + teardown semantics, ports (:4445 WebDriver 127.0.0.1-only / :1420 vite fixed by devUrl), env vars (`MAX_WAIT`, `E2E_DEMO`, `PREFLIGHT_ONLY`), log location, preflight rationale (orphan devtools-app + port-holder kill ladder, why a green run is trustworthy), single-shared-session model + screenshots-as-evidence, the three WebKit/Tauri quirks (Option-key composition, stale chained handles, `dragDropEnabled: false`), and the DMG bundle flake + updater-signing-key exit-code caveat.

### Task 3 — Harness pass
1. **Simplify:** reviewed the diffs — the change is itself a pure de-duplication; no dangling comments or further cleanups applied.
2. **Codex review** (read-only, over both commits): **no findings** on the critical aria-label invariant or leftover dead code; two P3 doc-accuracy findings, both fixed in `94d8cf99` (teardown only group-kills when `setsid` exists; `E2E_DEMO` currently only consumed by `protobuf-decoder.e2e.ts`).
3. **Full unit gate:** vitest **816/816** (65 files), `tsc --noEmit` clean, `eslint .` clean. Decoder + its 19 tests byte-for-byte untouched (last commit on `decoder.ts` remains `90583b79`, phase 01-01).

## Verification

- `grep -rn "function CopyButton" src/tools/` → empty (shared component is the only definition).
- `src/tools/_placeholder/` gone; no references anywhere.
- docs/HARNESS.md hits all required topics (13 keyword matches across ports/env/quirks/flake).
- Full suite + tsc + eslint green on every commit (lefthook ran all three per commit).

## Deviations from Plan

None - plan executed exactly as written. (The two codex P3 doc fixes are the plan's own "address findings" step.)

## e2e coverage — explicitly deferred to batch 3

Per plan: real-WKWebView e2e verification is intentionally DEFERRED to batch 3 (helpers extraction), which runs the full e2e suite immediately after this batch against this exact code. The migration's only UI delta is the cosmetic copy-button upgrade in regex/cron (icon + 11.5px instead of text-only 11px); aria-labels are proven unchanged by the unit suite, so `url.e2e.ts` / `regex.e2e.ts` queries remain valid.

## Known Stubs

None.

## Commits

| Hash | Type | What |
|---|---|---|
| acba7c24 | refactor | shared CopyButton migration + _placeholder deletion |
| 3ff4ee97 | docs | docs/HARNESS.md e2e-gate runbook |
| 94d8cf99 | docs | codex P3 fixes (setsid nuance, E2E_DEMO scope) |

## Self-Check: PASSED

- docs/HARNESS.md, src/components/CopyButton.tsx, SUMMARY.md present; src/tools/_placeholder gone.
- Commits acba7c24, 3ff4ee97, 94d8cf99 all present in history.
