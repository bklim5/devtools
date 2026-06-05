---
status: partial
phase: 17-pinned-sidebar-section
source: [17-VERIFICATION.md]
started: 2026-06-05T22:49:48Z
updated: 2026-06-05T22:49:48Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Native pointer DRAG reorder within each group (pinned and unpinned)
expected: A dragged row reorders inside its own group via native OS pointer drag and NEVER crosses the pinned↔unpinned divider; the neutral insertion line tracks the drop slot.
result: [pending]

### 2. Pin-icon reveal on pointer HOVER for unpinned rows
expected: Hovering an unpinned row reveals its outline pin icon; pinned rows show a persistent filled pin; clicking the icon toggles membership without navigating.
result: [pending]

### 3. tauri build walkthrough + gsd-ui-review WCAG-AA audit
expected: Fresh `pnpm tauri build` produces a launchable .app/.dmg under src-tauri/target/release/bundle/macos/ (ignore the absent-updater-key non-zero exit); human launches, walks the pin/unpin/reorder flow, and a gsd-ui-review WCAG-AA audit passes.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
