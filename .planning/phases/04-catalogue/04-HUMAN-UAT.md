---
status: partial
phase: 04-catalogue
source: [04-VERIFICATION via 04-06 boundary gate]
started: 2026-05-31T14:30:00Z
updated: 2026-05-31T14:30:00Z
---

## Current Test

[testing paused — 5 items outstanding; human AFK, sign-off deferred to manual verification of Phase 4 + Phase 5]

<!--
DEFERRED HUMAN SIGN-OFF. The 04-06 phase-boundary gate's automated layers are all
GREEN (full unit suite 269/269 incl. decoder 19 untouched, tsc clean, eslint 0,
four real-WKWebView e2e specs passing on webkit incl. the hash SHA-256 and
uuid-ulid crypto secure-context checks, a fresh `tauri build` producing a runnable
.app + .dmg, and a passing WCAG-AA audit recorded in 04-UI-REVIEW.md).

The packaged-build human sign-off (plan 04-06 Task 2, checkpoint:human-verify) is
DEFERRED at the user's explicit request — the user is AFK and will manually verify
Phase 4 (and Phase 5) later. The phase is closed for FORWARD PROGRESS only;
the sign-off is tracked here as explicit verification debt and is NOT approved.

Packaged app to verify:
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
result: [pending]

### 2. JWT
expected: |
  At #/tools/jwt, paste a real JWT → header + payload pretty-printed, the signature
  shown raw, and `alg` surfaced; an expired token shows an "expired" flag. Pasting a
  2-segment (malformed) string shows a clear field-scoped error with no crash.
result: [pending]

### 3. Hash
expected: |
  At #/tools/hash, type `abc` → MD5 `900150983cd24fb0d6963f7d28e17f72` and SHA-256
  `ba7816bf…` appear (proves Web Crypto works in the packaged webview). Switching the
  input encoding to hex `616263` yields the same digests. The UPPER casing toggle
  uppercases the displayed + copied digest. Each digest copies in ≤1 keystroke via a
  visible focusable copy.
result: [pending]

### 4. UUID/ULID
expected: |
  At #/tools/uuid-ulid, an id appears on open; pressing Generate changes it. The
  v4 / v7 / ULID kind toggle switches the generated format. Setting a batch count > 1
  yields multiple copyable entries plus a Copy-all. Pasting a UUID and a ULID renders
  correct breakdowns (UUID version/variant; ULID/v7 embedded timestamp). Pasting
  garbage shows a clear error.
result: [pending]

### 5. Cross-cutting
expected: |
  Across all tools: every output has a visible (non-hover) focusable copy; each tool
  shows a status bar; ⌘K switches tools with no mouse; relaunching the app opens to
  the last-used tool; and the visuals match the Phase-3 look (cards/chips/status bar,
  accent reserved for selected/active only).
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps

<!-- None yet — no test has been executed; sign-off deferred to manual verification. -->
