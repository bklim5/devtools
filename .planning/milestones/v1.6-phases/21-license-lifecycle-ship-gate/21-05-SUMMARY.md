---
phase: 21-license-lifecycle-ship-gate
plan: 05
subsystem: testing
tags: [e2e, ship-gate, wkwebview, cargo, license, tauri, fail-closed]

requires:
  - phase: 21-license-lifecycle-ship-gate (Plan 04)
    provides: live D-85 flip + #/settings/license status route (the UI the matrix exercises)
  - phase: 21-license-lifecycle-ship-gate (Plans 01-03)
    provides: expiry-aware resolve_status, 5-state union, revocation/transfer/email/masked-key
  - phase: 20-purchase-pipeline
    provides: live LS → webhook → Keygen purchase pipeline (PAY-03) — REQUIRED for the live ship-gate cases
provides:
  - "test/e2e/ship-gate.e2e.ts — fail-closed fixture cases (4 corrupt, 5 foreign-FP) GREEN on the real WKWebView with screenshots"
  - "21-SHIP-GATE-MATRIX.md — all 8 D-90 rows with honest method + evidence + status"
  - "Prod-pointed tauri build proven dev-string-clean (check-dev-strip CHECK_PROD_BINARY); license.tinkerdev.io embedded"
affects: [release, phase-sign-off]

tech-stack:
  added: []
  patterns:
    - "Ship-gate matrix: per-case method legend (dev-harness-auto / cargo-clock-injection / release-manual) with honest evidence"
    - "Fixture cases run on the DEV arm (machine.dev.lic + dev Keychain) so they never touch a shipped buyer's release machine.lic"
    - "Lifecycle proofs that can't be re-signed headlessly (case 3 local-verify, case 6 grace→refresh) are pinned by pure-Rust clock-injection tests, not fabricated fixtures"

key-files:
  created:
    - test/e2e/ship-gate.e2e.ts
    - .planning/phases/21-license-lifecycle-ship-gate/21-SHIP-GATE-MATRIX.md
    - test/e2e/__screenshots__/ship-gate-case4-corrupt.png
    - test/e2e/__screenshots__/ship-gate-case5-foreign.png
  modified:
    - test/e2e/helpers.ts

key-decisions:
  - "Cases 3 + 6 require a signed cert that cannot be produced from committed material headlessly (matched-FP cert needs live CE checkout; arbitrary-expiry cert needs the server-side Ed25519 signing key) — authoritative proof is the pure-Rust clock-injection suite + the live-build walkthrough"
  - "Fixture cases (3/4/5/6) run on the dev arm; live prod cases (1/2/7/8) need the PROD-pointed release build + a real prod-CE key — gated on Phase 20 PAY-03"
  - "Matrix records masked keys + buyer email only — never a raw key or CE admin token (T-21-18)"

patterns-established:
  - "Ship-gate honesty: every case states its method and whether it is auto-proven, live-UI-pending, or blocked — no vacuous passes"

requirements-completed: []  # LIC-05/07/08/09 are completed/closed by Plan 04 + the live cases; this plan's live-only requirement evidence (LIC-01/02 first-device + seat-limit) is BLOCKED on Phase 20

duration: ~single-session (Wave 5)
completed: 2026-06-15
---

# Phase 21 Plan 05: Ship-Gate Matrix Summary

**The 8-case D-90 ship-gate matrix authored and recorded: fail-closed fixture cases 4 (corrupt→problem→free) and 5 (foreign-FP→ForeignMachine→free) GREEN on the real WKWebView (full suite 19/19) with screenshots; cases 3 + 6 proven by the pure-Rust clock-injection suite (license:: 82/82); a prod-pointed build is dev-string-clean — but the live prod-CE cases (1/2/7/8) are BLOCKED on a real key from Phase 20, and the final human sign-off + live walkthrough remain OPEN.**

> STATUS: PARTIAL by design. Fixture/clock-driven cases (3/4/5/6) PASS; live prod-CE cases (1/2/7/8) are BLOCKED on a real prod-CE key minted via the live Phase-20 purchase (PAY-03) + CE admin. The Wave-5 human-verify sign-off (live cases + `gsd-ui-review`) is OPEN. This SUMMARY does NOT claim human sign-off or a fully-green matrix.

## Performance

- **Duration:** Single session (Wave 5, the milestone close)
- **Completed (automatable scope):** 2026-06-15
- **Tasks:** 1 of 2 (Task 1 auto, committed; Task 2 = open human-verify checkpoint, partially blocked on Phase 20)
- **Files modified/created:** 3 (+ 2 screenshots)

## Accomplishments

- **`test/e2e/ship-gate.e2e.ts`** drives the fail-closed fixture cases on the real WKWebView (dev arm):
  - **Case 4 (corrupted `machine.lic`)** → problem state "License needs attention", entitlements free (locked customization opens upsell) — GREEN, screenshot `ship-gate-case4-corrupt.png`.
  - **Case 5 (copied/foreign fingerprint)** → ForeignMachine → problem → free — GREEN, screenshot `ship-gate-case5-foreign.png`. This is also the pure-local verify code path that case 3 exercises.
  - Full real-WKWebView suite **19/19**, exit 0 (2026-06-15).
- **Cases 3 + 6 pinned by the pure-Rust suite** (`cargo test license::` **82/82**): `resolve_status` network-free (D-45 `NoNetwork` panics on any call) for the case-3 local verify; `classify_within_grace_is_grace` / `classify_past_grace_is_lapsed` / `classify_boundaries_*` / `needs_refresh_*` (injected `now`) for the case-6 grace→lapsed→refresh lifecycle.
- **`21-SHIP-GATE-MATRIX.md`** records all 8 rows with method + evidence + status, plus the explicit case-3/case-6 mechanism note (why arbitrary fixtures can't be re-signed headlessly) and the secrets policy.
- **Prod-pointed `pnpm tauri build`** produced `TinkerDev.app` + `TinkerDev_0.3.1_aarch64.dmg`; `check-dev-strip.sh` (CHECK_PROD_BINARY) confirms the dev toggle ABSENT, the DEV-only "full" override ABSENT, and `license.tinkerdev.io` embedded (advisory `localhost` WARN flagged for pre-release check).

## Task Commits

1. **Task 1: ship-gate e2e (cases 4/5 fixture-driven) + matrix scaffold** — `f36ec0a2` (test)
2. **Task 1 fix: assert problem-state free entitlements via locked Alt+P, not the Unlock Pro footer** — `577d81ee` (fix)
3. **Task 2 prep: record ship-gate auto cases 3/4/5/6 green + prod-build dev-strip** — `9dd5a27d` (docs)

_Task 2 (run + record the full 8-case matrix on a fresh prod build) is the OPEN human-verify checkpoint; the live cases are blocked on Phase 20._

## Files Created/Modified

- `test/e2e/ship-gate.e2e.ts` — fixture-driven cases 4 + 5 on the real WKWebView, each with a screenshot; reuses the license-e2e prefs/Keychain preflight reset for determinism
- `.planning/phases/21-license-lifecycle-ship-gate/21-SHIP-GATE-MATRIX.md` — the 8-row D-90 matrix with method/evidence/status, the case-3/6 mechanism note, prod-build verification, and the secrets policy
- `test/e2e/__screenshots__/ship-gate-case4-corrupt.png`, `ship-gate-case5-foreign.png` — fail-closed evidence
- `test/e2e/helpers.ts` — shared seeding/reset helpers reused by the spec

## Decisions Made

- **Cases 3 + 6 are proven by clock-injection, not fabricated fixtures.** A matched-fingerprint cert (case 3 → Licensed) needs a live CE checkout bound to this machine's real FP; the committed `ce-machine.lic` carries the synthetic Plan-01 FP, so on any live machine it resolves to ForeignMachine (= case 5). An arbitrary-expiry cert (case 6) needs the server-side Ed25519 signing key (never committed). So the authoritative proof is the pure-Rust suite, with the genuine Licensed/offline-grace UI deferred to the live-build walkthrough.
- **Fixture vs live split honored.** Fixture cases run on the dev arm (`machine.dev.lic` + dev Keychain) and never touch a shipped buyer's release cert; live cases require the PROD-pointed release build that hits `license.tinkerdev.io`.
- **No secrets in the matrix** (T-21-18): masked keys + buyer email only; seat-release/revoke output redacted to the masked form.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Problem-state free-entitlement assertion routed through the wrong affordance**
- **Found during:** Task 1 (ship-gate e2e authoring)
- **Issue:** Asserting free entitlements via the "Unlock Pro" footer was unreliable from the just-cleared problem state on this WKWebView.
- **Fix:** Assert problem-state free entitlements via the locked Alt+P (theming) affordance opening the upsell instead of probing the footer label.
- **Files modified:** `test/e2e/ship-gate.e2e.ts`
- **Verification:** real-WKWebView suite 19/19 GREEN
- **Committed in:** `577d81ee`

**2. [Plan-acknowledged] Case 3 + Case 6 driven by clock-injection rather than re-signed fixtures**
- **Found during:** Task 1
- **Issue:** The plan flagged that building signed arbitrary-expiry / matched-FP fixtures may not be feasible with committed material; it was confirmed infeasible headlessly (server-side signing key; synthetic fixture FP).
- **Fix:** Per the plan's Task-1 guidance, the authoritative proof is the pure-Rust `cargo test license::` clock-injection suite (82/82) + the live-build walkthrough for the genuine Licensed/offline UI; the e2e drives the fixture-reachable fail-closed branch (case 5, the same pure-local path).
- **Files modified:** `21-SHIP-GATE-MATRIX.md` (mechanism documented)
- **Committed in:** `f36ec0a2`, `9dd5a27d`

---

**Total deviations:** 1 auto-fixed bug + 1 plan-acknowledged method substitution (documented honestly in the matrix).
**Impact on plan:** Fail-closed cases are proven on the real build; lifecycle cases are proven authoritatively in Rust. No scope creep; decoder + 19 tests untouched.

## Issues Encountered

- **Headless signing limit** — neither a matched-fingerprint nor an arbitrary-expiry signed cert can be produced from committed material, so two cases shifted to clock-injection + live-walkthrough proof. Documented in the matrix's "Case-3 and case-6 mechanism" section.
- **Prod-binary `localhost` WARN** — `check-dev-strip.sh` CHECK_PROD_BINARY confirms prod constants but flags a `localhost` string (almost certainly a dependency string; the Keygen host is confirmed prod). Flagged for a pre-release check.

## Open / Blocked Items (Task 2 — gate NOT closed)

The Wave-5 `checkpoint:human-verify` is OPEN, and four cases are BLOCKED:

- **Cases 1, 2, 7, 8 — BLOCKED on a real prod-CE key** minted via the live Phase-20 purchase (PAY-03, with the D-89 buyer email embedded) + CE admin actions:
  - Case 1: valid first-device activation → Pro unlocks
  - Case 2: second device rejected → calm seat-limit + self-serve path (D-80)
  - Case 7: deactivate/transfer (uses `infra/keygen/release-seat.sh`, D-81) → reactivate on a new device
  - Case 8: CE-admin revoke/suspend → Refresh → entitlements drop to free, calm
- **Cases 3 + 6 live UI** (genuine Licensed + offline-grace + refresh-restores on a real activated cert) pending the same live walkthrough.
- **Final phase-boundary sign-off:** the matrix all-green + a passing `gsd-ui-review` WCAG-AA audit (the code audit is already 24/24, carried from Plan 04).

**Resume condition:** when Phase 20 PAY-03 closes and a real prod-CE key is available, run the four live cases on a fresh PROD-pointed `tauri build` against `license.tinkerdev.io`, fill the evidence cells, and complete the Wave-5 sign-off.

This executor is headless and cannot drive the GUI or mint a live key; the orchestrator owns the live run + human sign-off.

## Next Phase Readiness

- Fail-closed behavior is proven on the real build; the full lifecycle is proven in Rust — the milestone is ship-ready except for the live prod-CE confirmation gated on Phase 20.
- No additional implementation is needed in this plan; the remaining work is the gated live walkthrough.

## Self-Check: PASSED

Verified against repo state:
- `test/e2e/ship-gate.e2e.ts` — FOUND
- `.planning/phases/21-license-lifecycle-ship-gate/21-SHIP-GATE-MATRIX.md` — FOUND (8 rows, cases 4/5 PASS, 1/2/7/8 BLOCKED)
- Commits `f36ec0a2`, `577d81ee`, `9dd5a27d` — FOUND in `git log`

Caveat (honest): cases 4 + 5 PASS on the real WKWebView; cases 3 + 6 are clock-injection-proven with live UI pending; cases 1/2/7/8 are BLOCKED on a Phase-20 key. The matrix is PARTIAL and the human sign-off + live `gsd-ui-review` are OPEN. No full-green matrix or human sign-off is claimed.

---
*Phase: 21-license-lifecycle-ship-gate*
*Automatable scope completed: 2026-06-15 — live cases blocked on Phase 20; human-verify gate OPEN*
