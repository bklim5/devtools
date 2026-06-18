---
status: partial
phase: 21-license-lifecycle-ship-gate
source: [21-VERIFICATION.md, 21-04-SUMMARY.md, 21-05-SUMMARY.md, 21-SHIP-GATE-MATRIX.md]
started: 2026-06-15
updated: 2026-06-15
---

## Current Test

[awaiting human testing — user doing a round of testing when back]

## Context

Phase 21 code deliverables are complete and all AUTOMATED gates are green
(vitest 940/940, cargo `license::` 82/82, tsc root+server, eslint, real-WKWebView
e2e 19/19 stable, WCAG-AA code audit 24/24, check-dev-strip incl. prod binary,
decoder + 19 tests byte-for-byte untouched). Verifier verdict: **human_needed**
(5/5 success criteria code-verified). These items need the human + (for the live
ship-gate cases) a real prod-CE key. Built app to test:
`src-tauri/target/release/bundle/macos/TinkerDev.app`.

A corrupt `machine.lic` is currently SEEDED at
`~/Library/Application Support/com.tinkerdev.app/machine.lic` (puts the release app
in the "problem" state for tests 1–2). Delete it to return to the clean free state.

## Tests

### 1. License status route + state-dependent routing (21-04)
expected: From the footer and ⌘K → "License": a manageable-license state (e.g. the
seeded problem state) routes to `#/settings/license`; the route shows the state copy,
masked key + email (em-dash when null), Refresh ("Refreshing…", calm), and confirm-first
Deactivate (cancel returns focus, Pro unchanged). Free/notActivated routes to the Unlock
Pro modal instead.
result: [pending]

### 2. Reactivate / Activate / ⌘K open the Unlock Pro modal (21-04 walkthrough fixes)
expected: In the problem state, "Reactivate" opens the Unlock Pro modal (NOT a bounce to a
tool). In the free state, ⌘K → "License" and "Activate a license" both open the same modal.
After dismissing the modal (Esc) from the ⌘K command and from the Sidebar reset menu's
locked "Reset order", keyboard focus returns to a sensible control.
result: [pending]

### 3. Free-tier flip + dormant restore (D-85 / D-86)
expected: On an unlicensed install, theming + tool ordering/pinning are LOCKED (lock badge,
not hidden/opacity-only); all 11 tools stay free. Toggling Pro (real activation, or the dev
toggle) restores the exact saved theme/order/pins instantly.
result: [pending]

### 4. No Pro→FREE boot flash + no startup Keychain prompt (Codex fixes #1/#2)
expected: On a LICENSED launch, Pro shows immediately with no free-tier flash, and NO macOS
Keychain auth prompt at startup. A Keychain prompt appears ONLY when opening
`#/settings/license` (the masked key read) — that is expected/acceptable.
result: [pending]

### 5. Buy CTA → OS browser (21-04, WebDriver-non-observable manual item)
expected: Clicking "Buy" in the Unlock Pro modal opens `https://tinkerdev.io/buy` in the OS
default browser, and the app does NOT navigate its in-app route.
result: [pending]

### 6. gsd-ui-review WCAG-AA live pass for #/settings/license (21-04)
expected: The code audit scored 24/24 (0 BLOCK, 3 FLAGs resolved); confirm on the live app —
keyboard reachability from footer + palette, focus rings, aria-live on status/refresh, calm
neutral tokens (no alarm color on grace/refreshNeeded/problem).
result: [pending]

### 7. Ship-gate live cases 1/2/7/8 (21-05) — BLOCKED on a real prod-CE key
expected (run on a fresh PROD-pointed build vs license.tinkerdev.io, needs a real key from
the live Phase-20 purchase PAY-03 + CE admin):
 - Case 1: paste real key → activates → Pro unlocks; screenshot Licensed + masked key + email.
 - Case 2: same key on a second fingerprint → calm seat-limit rejection naming the self-serve
   path (D-80).
 - Case 7: Deactivate (confirm-first) frees the seat → reactivate on a new device/fingerprint
   (use `infra/keygen/release-seat.sh`, D-81, if single-device).
 - Case 8: revoke/suspend in the prod CE admin → the app's checkout returns 403
   LICENSE_SUSPENDED so refresh can't renew; entitlements drop to free ("Pro is no longer
   active") only when the cached cert LAPSES (≤~37d eventual consistency, D-82) — NOT on a
   manual Refresh, by design (a paying user is never pre-emptively removed). Verified live
   2026-06-17: checkout → 403 LICENSE_SUSPENDED; expiry→lapse UI is the Case-6 cargo path.
result: [pending — blocked on Phase-20 PAY-03 live purchase / a real prod-CE key]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 1

## Gaps

(none recorded yet — fill from the walkthrough)
