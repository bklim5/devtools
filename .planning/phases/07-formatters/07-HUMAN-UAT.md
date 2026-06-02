---
status: partial
phase: 07-formatters
source: [07-VERIFICATION.md]
started: "2026-06-02T11:11:57Z"
updated: "2026-06-02T11:11:57Z"
---

## Current Test

[awaiting human testing]

## Tests

### 1. Real-WKWebView e2e for both formatters
expected: `scripts/e2e-spike.sh` runs `test/e2e/json-formatter.e2e.ts` and `test/e2e/xml-formatter.e2e.ts` against the real WKWebView and passes — proving the JSC line:col error shape (JSON) and the WebKit `parsererror` shape (XML), both of which differ from Node/jsdom. Screenshots captured (`json-formatter-wkwebview.png`, `xml-formatter-wkwebview.png`). Chromium preview screenshots do NOT satisfy this gate.
result: [pending]

### 2. gsd-ui-review WCAG-AA audit
expected: `/gsd-ui-review 7` passes a WCAG-AA audit of both formatter tools (two-pane FormatterView, toolbar, read-only copy-bearing output, StatusBar byte delta) with no AA violations.
result: [pending]

### 3. Fresh `tauri build` sign-off
expected: a fresh `tauri build` succeeds; both `json-formatter` and `xml-formatter` appear in the sidebar + ⌘K palette + router; paste-to-format is instant (<2s); validate/prettify/minify (+ JSON sort-keys) all behave per the design spec in the packaged app.
result: [pending]

### 4. FormatterView narrow-width vertical stacking (UX-05)
expected: at narrow widths the FormatterView input/output panes stack vertically (responsive, layout-agnostic, no fixed widths) rather than staying side-by-side and overflowing. Flagged as a deferred CSS refinement in the 07-02 / 07-03 summaries.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
