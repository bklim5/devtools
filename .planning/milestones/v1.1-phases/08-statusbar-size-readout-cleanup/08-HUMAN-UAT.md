---
status: partial
phase: 08-statusbar-size-readout-cleanup
source: [08-VERIFICATION.md]
started: "2026-06-02T15:02:23Z"
updated: "2026-06-02T15:02:23Z"
---

## Current Test

[awaiting human testing]

## Tests

### 1. Real-WKWebView UI check — drop tools show NO size text
expected: On the real WebKit webview (`scripts/e2e-spike.sh` against `tauri dev`), the Hash/Checksum, UUID·ULID, Unix Time, and JWT status bars render their ParseState label + error/timing only — no `N bytes` / size readout.
result: [pending]

### 2. Real-WKWebView UI check — keep tools STILL show the size readout
expected: On the real WebKit webview, Base64/Hex/Bytes, the Protobuf decoder, and both Formatters (JSON, XML) still render the size readout (single `N bytes` count, or the `input → output` delta for the formatters).
result: [pending]

### 3. gsd-ui-review WCAG-AA audit passes
expected: A fresh `gsd-ui-review` audit returns a passing WCAG-AA verdict with no blockers (no net-new visuals — this phase only removes/conditionalizes existing rendered text).
result: [pending]

### 4. Human sign-off on a fresh `tauri build`
expected: A fresh `tauri build` succeeds and the human signs off on the packaged app behavior for the keep/drop split.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
