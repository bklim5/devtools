---
phase: 33-html-prettifier-tool
plan: 04
subsystem: tools
tags: [html, e2e, offline, csp, wasm, status-bar, wcag, human-gate]

# Dependency graph
requires:
  - phase: 33-html-prettifier-tool
    provides: "mounted HtmlFormatterTool (Plan 03); useAsyncFormat size guard (Plan 01); minifyHtml/formatHtml engines + goldens (Plan 02)"
provides:
  - "Real-WKWebView e2e (test/e2e/html-formatter.e2e.ts): async prettify/minify, both D-11 line:col paths, concise-error assertion, recovery, no-remote, focusable copy — GREEN on webkit"
  - "Durable SC5 offline proof (33-04-OFFLINE-PROOF.md) — human-signed, both channels, freshness-linked"
  - "Packaged-app fixes: CSP wasm-unsafe-eval (esbuild Minify works in the real build); StatusBar no-overlap; concise HTML error messages"
affects: [33-html-prettifier-tool, 34-js-ts-prettifier-tool]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Packaged-only CSP class: dev CSP is permissive so e2e/unit miss WASM/eval CSP blocks — verify via strings on the built binary + human run of the .app"
    - "Concise formatter errors: strip engine boilerplate (Prettier 'It may happen…'/spec URL) so the status bar shows the essential clause without hover-only truncation"

key-files:
  created:
    - test/e2e/html-formatter.e2e.ts
    - .planning/phases/33-html-prettifier-tool/33-04-OFFLINE-PROOF.md
    - .planning/phases/33-html-prettifier-tool/33-HARNESS-REMEDIATION.md
  modified:
    - src-tauri/tauri.conf.json
    - src/components/StatusBar.tsx
    - src/components/StatusBar.test.tsx
    - src/tools/html-formatter/HtmlFormatterTool.tsx
    - src/tools/html-formatter/HtmlFormatterTool.test.tsx
    - src/lib/format/minify.ts
    - src/lib/format/minify.test.ts
    - src/shell/useAsyncFormat.ts
    - src/shell/useAsyncFormat.test.tsx
---

# 33-04 — Offline proof + human gate (BLOCKING, discharged)

Discharged the carried P32 obligations (D-10/SC5 offline paste e2e, D-11 interactive
role=alert line:col) and closed the phase with the binding real-WKWebView + human gate.

## What shipped
- **Real-WKWebView e2e** (`test/e2e/html-formatter.e2e.ts`) — GREEN on webkit 605.1.15:
  async prettify (embedded `<script>` reformatted), minify, BOTH D-11 line:col error
  paths (esbuild embedded-code + Prettier html-structure), concise-error assertion,
  recovery, best-effort no-remote, focusable Copy.
- **Durable offline proof** (`33-04-OFFLINE-PROOF.md`) — human-signed 2026-07-02;
  both channels built fresh + freshness-linked; complements (a)–(d) documented.

## Boundary harness (orchestrator-run) + human-gate fixes
Full record in `33-HARNESS-REMEDIATION.md`. Net source changes landed AFTER the
initial plan work, all verified + rebuilt:
- **Whitespace DoS guard (Codex R1/R2):** bounded byte scan before `trim()`; tool reads
  `isEmpty` from the hook (no tool-seam re-trim). Over-cap all-whitespace → oversize.
- **Minify attribute integrity (Codex R3/R4):** quoted attribute-value whitespace
  preserved; ReDoS-safe quote-aware tag scan (`>` inside quoted attrs); D-07 error
  offset from captured start-tag length. SC2 golden unchanged.
- **CSP wasm-unsafe-eval (human gate):** packaged CSP `script-src 'self'` blocked
  esbuild-wasm — Minify of embedded code failed with a WebAssembly CSP error in the
  real build (invisible to the permissive-dev e2e). Added the minimal grant; confirmed
  embedded in both channel binaries via `strings`.
- **StatusBar no-overlap (human gate):** long errors squeezed the byte count until it
  wrapped + overflowed the 38px row. Left cluster `shrink-0`; error cluster
  `min-w-0 flex-1` truncates. Shared fix (all formatters).
- **Concise errors (human UX):** strip Prettier's "It may happen…"/spec-URL boilerplate
  so the essential clause shows in full without hover-only truncation.

## Non-bugs confirmed with the human (against the real engine)
- Prettify adds `;` to `<script>test</script>` → `test;` — Prettier's default `semi:true`
  on the JS body. Correct.
- `<div><p>hi</p></div>` stays inline — Prettier breaks HTML on **print width**, not
  block-vs-inline; it fits under 80. Breaks when content exceeds the width.

## Verification
- Unit: full suite GREEN, tsc clean, lint 0 errors.
- Real-WKWebView e2e GREEN (incl. concise-error assertion).
- Both channels rebuilt fresh (`70e26914`); appstore bundle-verified (PRT-02 lazy
  sentinel, D-04, freshness). CSP fix confirmed in both binaries.
- Human sign-off: **APPROVED** 2026-07-02.

## Deviations
- Edited the P32-"frozen" `minify.ts` (Codex R3/R4) — **user-approved** in-phase; SC2
  golden unchanged. CSP change to `tauri.conf.json` — packaged-app fix, both channels.
- WCAG-AA: covered by human sign-off; no standalone `gsd-ui-review` artifact captured
  (run `/gsd-ui-review 33` if a formal audit file is wanted).
