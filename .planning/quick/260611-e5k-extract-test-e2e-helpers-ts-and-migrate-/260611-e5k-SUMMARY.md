---
phase: quick-260611-e5k
plan: 01
subsystem: testing
tags: [e2e, wdio, refactor, harness, webkit]
requires: []
provides:
  - "test/e2e/helpers.ts — shared e2e helper module (assert, dispatchKey, dispatchAltP, navigateToTool, SCREENSHOT_DIR, saveScreenshot, readOrder, readPinnedOrder, focusRow)"
  - "All 15 WDIO specs import from ./helpers; zero local duplicates of the extracted functions"
affects: [test/e2e]
tech-stack:
  added: []
  patterns:
    - "WebKit lessons (Alt-drop, Option-compose, stale chained handles) live as doc comments in helpers.ts; specs carry one-line pointers"
    - "saveScreenshot(tag, fileName, label) parameterizes the log label so every existing console.log line stays byte-identical"
key-files:
  created:
    - test/e2e/helpers.ts
  modified:
    - test/e2e/base64.e2e.ts
    - test/e2e/cron.e2e.ts
    - test/e2e/entitlements.e2e.ts
    - test/e2e/hash.e2e.ts
    - test/e2e/json-formatter.e2e.ts
    - test/e2e/jwt.e2e.ts
    - test/e2e/protobuf-decoder.e2e.ts
    - test/e2e/regex.e2e.ts
    - test/e2e/sidebar.e2e.ts
    - test/e2e/summon.e2e.ts
    - test/e2e/unix-time.e2e.ts
    - test/e2e/update.e2e.ts
    - test/e2e/url.e2e.ts
    - test/e2e/uuid-ulid.e2e.ts
    - test/e2e/xml-formatter.e2e.ts
decisions:
  - "saveScreenshot takes a `label` param (default \"real-WKWebView\") instead of the full message — keeps every existing console.log line byte-identical with the smallest call sites"
  - "Extensionless `./helpers` import kept (codex P2 disproven empirically — WDIO v9's tsx loader resolves it; full suite loaded + ran 15/15)"
metrics:
  duration: "~15 min (excl. e2e gate wait)"
  completed: "2026-06-11"
  tasks: 3
  files: 16
---

# Quick 260611-e5k: Extract test/e2e/helpers.ts and Migrate All 15 Specs Summary

Peer-review fixes batch 3/4: ~150+ duplicated WDIO-spec lines collapsed into one shared `test/e2e/helpers.ts` (assert, the WebKit Alt-chord dispatch helpers, HashRouter navigation, screenshot save, sidebar DOM readers), all 15 specs migrated, full real-WKWebView suite green 15/15 — which also discharges batch 2's deferred CopyButton e2e verification.

## What was done

**Task 1 (`e68a5c68`):** Created `test/e2e/helpers.ts` exporting `assert`, `dispatchKey`, `dispatchAltP`, `navigateToTool`, `SCREENSHOT_DIR`, `saveScreenshot`, `readOrder`, `readPinnedOrder`, `focusRow` — all lifted verbatim from the specs. The three hard-won WebKit lessons now live as doc comments on the helpers themselves:
1. **Alt-drop** (dispatchKey): macOS WebKit's embedded WebDriver 605.1.15 drops the Alt modifier on `browser.keys()`/W3C Actions → bubbling KeyboardEvent on `document.activeElement` (RESEARCH.md:499).
2. **Option-compose** (dispatchAltP): Option+P composes to "π" — dispatch `key:"π", code:"KeyP", altKey:true`; fails `e.key`-only checks, passes the `e.code === "KeyP"` fix (D-17).
3. **Stale chained handles** (DOM-reader group): read DOM state in a single `browser.execute` round-trip (the url.e2e lesson).

Migrated `sidebar.e2e.ts` + `entitlements.e2e.ts` (the heavy duplications). `navigateToTool` passes the hash as a serialized trailing arg (browser.execute closure gotcha).

**Task 2 (`409d6785`):** Migrated the remaining 13 specs — `assert` import in 12 (regex.e2e.ts has no local assert; none imported, keeping eslint no-unused-vars clean), `saveScreenshot` + `navigateToTool` in all 13. Exact target ids preserved: summon navigates protobuf-decoder then base64; update navigates protobuf-decoder. Restating lesson comments replaced with pointers; spec-specific rationale (base64 native-toBase64, regex ReDoS/JSC, hash secure-context) kept in place.

**Task 3 (gate):** codex review on both commits + full `bash scripts/e2e-spike.sh` on the real WKWebView — exit 0.

## Verification results

- **e2e gate: 15/15 spec files passed (100%), 20 tests passing, exit 0** on the real WKWebView (webkit 605.1.15). Preflight clean (no orphans, ports free); WebDriver up in 4s (warm build); all 16 screenshots regenerated.
- Unit gate green on every commit via lefthook: `tsc --noEmit` + `vitest run` (816/816) + `pnpm lint`.
- `grep -l 'from "./helpers"' test/e2e/*.e2e.ts` = 15; `grep -l "function assert"` = 0; no inline `window.location.hash` navigation writes remain (sidebar's mid-test hash READS untouched).
- wdio glob `./test/e2e/*.e2e.ts` does not match `helpers.ts` (confirmed: 15 spec files in the run, helpers loaded as a module).

## Batch-2 deferred verification — DISCHARGED

This run is the real-WKWebView UI verification deferred from quick 260611-dww (shared CopyButton in regex/url/cron):
- **regex** queried `button[aria-label="Copy group year"]` — passed.
- **url** queried `Copy host` / `Copy port` / `Copy query value q` rows — passed.
- **cron** ran its full flow on the migrated tool — passed.
The kept-byte-identical `Copy …` aria-labels render correctly through the ONE shared CopyButton on the real webview.

## Line-count delta

- Specs before: 2,649 lines (15 files). After: 2,313 lines + 155-line helpers.ts = 2,468 total.
- Net **-181 lines**; **-336 duplicated spec lines** collapsed into the one shared module (Task 1: +201/-224; Task 2: +47/-205).

## Helper variants deliberately kept local (and why)

- **sidebar.e2e.ts:** `readUnpinnedOrder`, `readRowHrefs`, `activeRowHref`, `readLiveRegion` — single-use, not duplication.
- **entitlements.e2e.ts:** `unlockProFooterPresent`, `upsellModalOpen`, `runDevToggle`, `resetArrangement` — spec-specific orchestration (resetArrangement exists only here).
- **protobuf-decoder.e2e.ts:** `demoPause` (E2E_DEMO slow-motion) — single-use.
- **cron.e2e.ts / url.e2e.ts:** their inline single-round-trip DOM readers (`runRowCount`, `rowTextByCopyLabel`, …) — per-tool selectors, not shared shapes.
- **Shift+F10 context-menu blocks** (sidebar + entitlements): the call sites differ subtly (assertion messages, follow-up waits, "Reset order" vs "Unpin all" targets) — per plan, behavior differences were NOT parameterized away.

## Deviations from Plan

None — plan executed as written. One review finding investigated and rejected:

**[codex P2 — rejected as false positive] Extensionless `./helpers` import**
- **Found during:** Task 3 codex review of commit `e68a5c68` (codex repro'd with bare `node`, which lacks a TS resolver).
- **Why rejected:** WDIO v9 loads TS specs through its tsx loader (tsx 4.22.3 present), which resolves extensionless `.ts` imports. Proven empirically: the full suite loaded all 15 specs and ran 20 tests green on the real WKWebView.
- **Action:** import kept extensionless (matches the rest of the codebase's import style). The second review (commit `409d6785`) returned "no actionable regressions".

## Known Stubs

None — pure test refactor, no runtime code touched.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or trust-boundary changes. WebDriver surface unchanged (127.0.0.1:4445, debug-only; T-01-11 posture untouched). T-e5k-01 (tampering via shared assert) accepted per plan: test-only module, never bundled, byte-equivalence + full e2e run guard.

## Self-Check: PASSED

- test/e2e/helpers.ts: FOUND
- All 15 migrated specs: FOUND (15/15 import ./helpers)
- Commit e68a5c68: FOUND
- Commit 409d6785: FOUND
- e2e exit 0, 15/15 specs: FOUND (log /tmp/e2e-run-e5k.log)
