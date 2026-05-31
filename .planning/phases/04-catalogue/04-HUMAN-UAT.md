---
status: complete
phase: 04-catalogue
source: [04-VERIFICATION via 04-06 boundary gate]
started: 2026-05-31T14:30:00Z
updated: 2026-06-01T00:10:00Z
---

## Current Test

[SIGNED OFF 2026-06-01. Round 1: 3/5 passed, 2 items had issues (Hash, UUID). All 5 issues
(G-04-1..G-04-5) closed in source by plan 04-07; the user human-verified the Phase-4
amendments at the batched Phase-5 sign-off. Deferred Phase-4 sign-off is now CLOSED.]

<!--
DEFERRED HUMAN SIGN-OFF. The 04-06 phase-boundary gate's automated layers are all
GREEN (full unit suite now 276/276 incl. decoder 19 untouched, tsc clean, eslint 0,
real-WKWebView e2e specs passing on webkit incl. the hash SHA-256 and
uuid-ulid crypto secure-context checks, and a passing WCAG-AA audit recorded in
04-UI-REVIEW.md).

Round-1 packaged human UAT found 5 UX defects (G-04-1..G-04-5). Plan 04-07
(commits 6d651626, 713d8c5b, 1d2b9bfa) closed all 5 in source — confirmed by 276/276
vitest, clean code review (04-REVIEW.md), and 7/7 real-WKWebView e2e on webkit.

REMAINING DEBT (NOT self-approved): the packaged-build human sign-off (plan 04-06
Task 2, checkpoint:human-verify) is still DEFERRED at the user's explicit request —
the user is AFK and will manually verify Phase 4 (and Phase 5) later. IMPORTANT: the
04-07 fixes are NOT yet in the on-disk packaged .app/.dmg — a FRESH `tauri build` is
required before the human re-verify so the 5 corrected behaviors are exercised.

Packaged app to (re)build + verify:
  src-tauri/target/release/bundle/macos/devtools-app.app
  src-tauri/target/release/bundle/dmg/devtools-app_0.1.0_aarch64.dmg
-->

## Tests

### 1. Unix Time
expected: |
  At #/tools/unix-time, paste `1469922850259` → local + UTC datetimes + ISO
  `2016-07-30T23:54:10.259Z` appear instantly (no decode button). The s/ms toggle
  reinterprets the magnitude. Typing an ISO into the reverse field derives the
  timestamp back into the forward field. The live "now" updates on a 1s tick and
  copies via a visible focusable copy.
result: passed

### 2. JWT
expected: |
  At #/tools/jwt, paste a real JWT → header + payload pretty-printed, the signature
  shown raw, and `alg` surfaced; an expired token shows an "expired" flag. Pasting a
  2-segment (malformed) string shows a clear field-scoped error with no crash.
result: passed

### 3. Hash
expected: |
  At #/tools/hash, type `abc` → MD5 `900150983cd24fb0d6963f7d28e17f72` and SHA-256
  `ba7816bf…` appear (proves Web Crypto works in the packaged webview). Switching the
  input encoding to hex `616263` yields the same digests. The UPPER casing toggle
  uppercases the displayed + copied digest. Each digest copies in ≤1 keystroke via a
  visible focusable copy.
result: issue
notes: |
  Digests correct. Two issues: (1) the hex/base64 input-encoding option is unwanted —
  input should always be treated as text (drop the encoding selector). (2) The UI
  reflows/flickers/"jumps" on every keystroke as digest rows resize — reserve fixed
  space for all digest rows so the layout is stable while typing.
  RESOLVED IN SOURCE by 04-07 (G-04-1, G-04-2): encoding selector + parse path removed
  (input is now always UTF-8 text); five digest rows render from mount in fixed-height
  containers (no reflow). Pending human re-verify on a fresh packaged build.

### 4. UUID/ULID
expected: |
  At #/tools/uuid-ulid, an id appears on open; pressing Generate changes it. The
  v4 / v7 / ULID kind toggle switches the generated format. Setting a batch count > 1
  yields multiple copyable entries plus a Copy-all. Pasting a UUID and a ULID renders
  correct breakdowns (UUID version/variant; ULID/v7 embedded timestamp). Pasting
  garbage shows a clear error.
result: issue
notes: |
  Generation + breakdowns work. Three issues: (1) batch-count input UX — can't
  backspace below the minimum of 1 to type 2-9, forcing select-then-replace. (2) No
  upper bound — user can request unbounded counts and crash the app; cap at 100. (3)
  Generate button lacks `cursor: pointer`.
  RESOLVED IN SOURCE by 04-07 (G-04-3, G-04-4, G-04-5): count is now an editable string
  (clearable, clamped 1..100 on read/blur); batch hard-capped at 100 in both clampCount
  and generateBatch; cursor-pointer added on Generate/Copy-all/toggles and the shared
  CopyButton. Pending human re-verify on a fresh packaged build.

### 5. Cross-cutting
expected: |
  Across all tools: every output has a visible (non-hover) focusable copy; each tool
  shows a status bar; ⌘K switches tools with no mouse; relaunching the app opens to
  the last-used tool; and the visuals match the Phase-3 look (cards/chips/status bar,
  accent reserved for selected/active only).
result: passed

## Summary

total: 5
passed: 3
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

### G-04-1: Hash — remove input-encoding selector (text-only)
source_test: 3 (Hash)
severity: medium
detail: |
  The Hash tool currently offers a hex/base64 input-encoding option. Product decision:
  input is ALWAYS treated as text — remove the encoding selector and the hex/base64
  decode path entirely. Simplifies the tool to its common case.
status: resolved
resolution: |
  04-07 commit 6d651626 — encoding selector, EncodingToggle, parseInput, and the
  error path removed; input parsed via utf8ToBytes (never throws). Verified by 276/276
  vitest + clean code review. Human re-verify on a fresh packaged build still pending.

### G-04-2: Hash — stable layout (no flicker/reflow while typing)
source_test: 3 (Hash)
severity: medium
detail: |
  On every keystroke the digest rows resize and the whole tool UI reflows/flickers/
  "jumps". Reserve fixed vertical space for all digest rows (MD5 + SHA-256, etc.) so
  the layout stays put as the input changes.
status: resolved
resolution: |
  04-07 commit 6d651626 — five digest rows render from mount in fixed-height
  (min-h-[2.5rem]) containers; typing swaps text only, no reflow. Verified by 276/276
  vitest + clean code review. Human re-verify on a fresh packaged build still pending.

### G-04-3: UUID — batch-count input UX
source_test: 4 (UUID/ULID)
severity: medium
detail: |
  The batch count field won't let the user backspace below the minimum of 1, so typing
  2-9 requires selecting and replacing the existing "1". Allow clearing/editing the
  field normally (e.g. allow transient empty, clamp on blur/submit).
status: resolved
resolution: |
  04-07 commit 713d8c5b — count is now a raw string (countText), clearable/retypable,
  clamped 1..100 on read and normalized on blur. Verified by 276/276 vitest + clean
  code review. Human re-verify on a fresh packaged build still pending.

### G-04-4: UUID — cap batch count at 100
source_test: 4 (UUID/ULID)
severity: high
detail: |
  Batch count has no upper bound; a large count can generate unbounded entries and
  crash the app. Cap the maximum at 100 for now (clamp input + guard generation).
status: resolved
resolution: |
  04-07 commit 713d8c5b — batch hard-capped at 100 via max={100}, clampCount, and
  generateBatch (MAX_COUNT=100); no 1000 path remains. Verified by 276/276 vitest +
  clean code review. Human re-verify on a fresh packaged build still pending.

### G-04-5: UUID — Generate button cursor
source_test: 4 (UUID/ULID)
severity: low
detail: |
  The Generate button does not show `cursor: pointer` on hover. Add it (and audit
  other interactive buttons for the same).
status: resolved
resolution: |
  04-07 commits 713d8c5b + 1d2b9bfa — cursor-pointer added to Generate, Copy-all,
  kind/casing toggles, and the shared CopyButton (covers every tool's copy buttons).
  Verified by clean code review. Human re-verify on a fresh packaged build still pending.
