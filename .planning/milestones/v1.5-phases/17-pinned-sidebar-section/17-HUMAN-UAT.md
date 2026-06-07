---
status: resolved
phase: 17-pinned-sidebar-section
source: [17-VERIFICATION.md]
started: 2026-06-05T22:49:48Z
updated: 2026-06-07T14:50:00Z
---

## Current Test

[all items passed — human approved 2026-06-07]

## Tests

### 1. Native pointer DRAG reorder within each group (pinned and unpinned)
expected: A dragged row reorders inside its own group via native OS pointer drag and NEVER crosses the pinned↔unpinned divider; the neutral insertion line tracks the drop slot.
result: passed — confirmed on the real app during the walkthrough.

### 2. Pin-icon reveal on pointer HOVER for unpinned rows
expected: Hovering an unpinned row reveals its outline pin icon; pinned rows show a persistent filled pin; clicking the icon toggles membership without navigating.
result: passed — confirmed on the real app during the walkthrough.

### 3. tauri build walkthrough + gsd-ui-review WCAG-AA audit
expected: Fresh `pnpm tauri build` produces a launchable .app/.dmg under src-tauri/target/release/bundle/macos/ (ignore the absent-updater-key non-zero exit); human launches, walks the pin/unpin/reorder flow, and a gsd-ui-review WCAG-AA audit passes.
result: passed — fresh `.app`/`.dmg` v0.3.0 built; `gsd-ui-review` 23/24, WCAG-AA PASS (0 failures); human approved after the Alt+P + Tab-fallback gap-closure fixes.

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

None — all items passed. Two follow-up fixes were made during the walkthrough (Alt+P macOS physical-key fix; Tab/arrow keyboard model) and a third polish (24×24 target sizes); all landed and re-verified before approval. See STATE.md D-17.
