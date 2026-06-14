---
phase: 21
plan: 05
type: execute
wave: 4
depends_on: [21-04]
files_modified:
  - test/e2e/ship-gate.e2e.ts
  - test/e2e/helpers.ts
  - .planning/phases/21-license-lifecycle-ship-gate/21-SHIP-GATE-MATRIX.md
autonomous: false
requirements: [LIC-05, LIC-07, LIC-08, LIC-09]
user_setup: []
must_haves:
  truths:
    - "All 8 ship-gate cases pass end-to-end on a fresh tauri build against real prod infra (license.tinkerdev.io)"
    - "Case 1: valid first-device activation unlocks Pro; Case 2: a second device is rejected with the calm seat-limit + self-serve path"
    - "Case 3: offline launch after activation still resolves licensed; Case 4: corrupted machine.lic fails closed to free; Case 5: copied machine.lic fails on a foreign fingerprint"
    - "Case 6: TTL-expired behaves grace→refresh; Case 7: deactivate/transfer end-to-end frees the seat and reactivates on a new device; Case 8: revocation propagates on refresh to free"
  artifacts:
    - path: "test/e2e/ship-gate.e2e.ts"
      provides: "the 8-case matrix driven on the real WKWebView where automatable"
      min_lines: 80
    - path: ".planning/phases/21-license-lifecycle-ship-gate/21-SHIP-GATE-MATRIX.md"
      provides: "the matrix result record — each case, method (auto/manual), evidence (screenshot/log), pass/fail"
      contains: "Case 8"
  key_links:
    - from: "test/e2e/ship-gate.e2e.ts"
      to: "prod CE (license.tinkerdev.io) via a release/prod-pointed build"
      via: "real activation/refresh/deactivate round-trips"
      pattern: "tinkerdev.io"
    - from: "21-SHIP-GATE-MATRIX.md"
      to: "each of the 8 cases"
      via: "documented evidence"
      pattern: "Case"
---

<objective>
Run and record the full 8-case ship-gate matrix (D-90, ROADMAP criterion 5) on a fresh `tauri build` against real production infra (`license.tinkerdev.io`, D-46), via the real-WKWebView e2e harness. This is the milestone close.

**DEPENDENCY / BLOCKER (do NOT start the matrix RUN until cleared):** Phase 20 must be COMPLETE (PAY-03 live purchase done) AND D-89 (licensee email in the minted license) must have landed in the Phase 20 webhook (delivered by Plan 21-03 Task 1, but the live purchase that mints an email-bearing license requires the live LS pipeline). The matrix's case 1 (valid activation) and case 7 (transfer) need a REAL prod-CE license key minted through the live pipeline. The spec scaffolding + the cases that don't need a live purchase (corrupted/copied/offline/expiry via fixtures) can be authored independently; the live-key cases (1, 2, 7, 8) run once Phase 20 closes.

Purpose: the binding ship gate beyond the standard harness — proves the whole license lifecycle on the real build before release.
Output: a `test/e2e/ship-gate.e2e.ts` driving the automatable cases on the real WKWebView, a `21-SHIP-GATE-MATRIX.md` recording every case with method + evidence + pass/fail, on a fresh prod-pointed `tauri build`, with a human sign-off.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/21-license-lifecycle-ship-gate/21-CONTEXT.md
@.planning/phases/21-license-lifecycle-ship-gate/21-04-SUMMARY.md
@docs/HARNESS.md

<interfaces>
<!-- The 8 cases (REQUIREMENTS.md ship-gate matrix + ROADMAP criterion 5 + D-90):
  1. Valid activation on first device         (LIC-01)  — live key, real prod CE
  2. Second device rejected                   (LIC-02)  — same key, second fingerprint -> calm seatLimit + D-80 path
  3. Offline launch succeeds after activation  (LIC-03)  — networking off, machine.lic verifies locally
  4. Corrupted machine.lic fails closed         (LIC-06) — fixture/corrupt the file -> free, calm, reactivate offered
  5. Copied machine.lic fails on foreign FP     (LIC-06) — another device's cert -> ForeignMachine -> free
  6. TTL-expired grace→refresh                  (LIC-05) — expired cert -> OfflineGrace -> (online) refresh -> licensed
  7. Deactivate/transfer end-to-end             (LIC-07) — deactivate frees seat -> reactivate on a new fingerprint
  8. Revocation propagates on refresh           (LIC-08) — revoke in CE -> next refresh -> free, calm

Automatable on the real WKWebView: 3,4,5,6 (fixture-driven; dev/prod storage isolation lets e2e use the dev arm
  for fixture cases). Cases 1,2,7,8 need a real prod-CE key + admin actions (revoke, seat-release) — these are
  semi-manual (the infra/keygen/release-seat.sh helper from Plan 03 frees the seat for case 7's transfer; the CE
  admin revokes for case 8). Record method honestly per case.

dev/prod storage isolation (quick 260614-nox): debug build uses machine.dev.lic + the dev Keychain service; a
  PROD-pointed build (release arm) uses machine.lic + the prod service — so a release build is what hits
  license.tinkerdev.io. The matrix RUN that exercises prod cases needs the release/prod-pointed build.

HARNESS.md: scripts/e2e-spike.sh runs tauri:dev:e2e (the DEBUG/dev arm). Prod-case verification against
  license.tinkerdev.io is on the RELEASE build — a manual/semi-manual walkthrough, not the dev e2e harness.
  Be explicit about which cases are dev-harness-automated vs release-build-manual.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Author the ship-gate e2e spec for the fixture-driven cases (3,4,5,6)</name>
  <read_first>
    - test/e2e/license.e2e.ts (the existing license spec; how it seeds machine.dev.lic + resets the dev Keychain item; the prefs/override reset preflight)
    - test/e2e/helpers.ts (assert/dispatchKey/navigateToTool/saveScreenshot; add a helper to seed/corrupt a machine.dev.lic fixture if not present)
    - src-tauri/fixtures/ce-machine.lic (the real-CE fixture; its synthetic fingerprint)
    - docs/HARNESS.md (the gate runbook + the license-e2e pollution reset; absolute DEVTOOLS_KEYGEN_CA)
    - .planning/phases/21-license-lifecycle-ship-gate/21-CONTEXT.md (D-90 cases)
    - MEMORY: license-walkthrough-state-pollutes-e2e + verify-gate-builds-real-app
  </read_first>
  <action>
    Create `test/e2e/ship-gate.e2e.ts` covering the fixture-driven cases on the real WKWebView (dev arm — machine.dev.lic), each with a screenshot:
    - Case 3 (offline launch): seed a valid machine.dev.lic (the CE fixture matched to the dev machine fingerprint per the existing license-e2e seeding) and assert the app resolves Licensed at #/settings/license with no network (the local-verify path; the dev build's resolve_status is pure-local). Screenshot the Licensed state.
    - Case 4 (corrupted): seed a corrupted machine.dev.lic (truncate/garble), assert #/settings/license shows the "problem" state ("License needs attention") and entitlements are free (theming/ordering locked), calm — reactivate offered. Screenshot.
    - Case 5 (copied/foreign): seed the CE fixture with a fingerprint that does NOT match this machine (the fixture's synthetic FP differs from the live dev FP unless seeded to match), assert ForeignMachine -> problem -> free. Screenshot.
    - Case 6 (TTL grace→refresh): seed a machine.dev.lic whose expiry is in the past but within GRACE_DAYS, assert #/settings/license shows "Licensed (offline)" / offlineGrace with Pro still active (D-73/D-77, no footer nag); then (if the dev CE is reachable) drive Refresh and assert it returns to Licensed, OR document the refresh leg as the next sub-step. Seed an expiry past grace and assert RefreshNeeded ("Pro is no longer active") -> free. Screenshots for grace + refreshNeeded.
    Reuse/extend the license-e2e preflight reset (prefs override + dev Keychain item) so the spec is deterministic and does not pollute other specs. Use the absolute DEVTOOLS_KEYGEN_CA. Be careful with the expiry fixtures — building a signed fixture with a chosen expiry needs the dev CE pubkey/signing (the ce-machine.lic is a fixed CE-issued cert); if re-signing an arbitrary-expiry fixture isn't feasible with committed material, drive case 6's grace/refreshNeeded via a dev-only clock-injection or a pre-built expired fixture committed for this purpose — document the chosen mechanism.
  </action>
  <verify>
    <automated>bash scripts/e2e-spike.sh 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `test/e2e/ship-gate.e2e.ts` exists, covers cases 3/4/5/6, each with a saveScreenshot
    - the real-WKWebView gate (`scripts/e2e-spike.sh`) passes with the new spec and does not regress the existing specs
    - screenshots for the Licensed / problem / offlineGrace / refreshNeeded states land in test/e2e/__screenshots__/
    - the spec resets prefs/Keychain in its preflight (no pollution)
  </acceptance_criteria>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Run + record the full 8-case matrix on a fresh prod build (cases 1,2,7,8 semi-manual)</name>
  <read_first>
    - .planning/phases/21-license-lifecycle-ship-gate/21-CONTEXT.md (D-90, D-46 prod CE, D-80/D-81 seat-release)
    - infra/keygen/release-seat.sh + infra/keygen/RUNBOOK.md (Plan 03 — the seat-release helper for case 7's transfer + the CE admin revoke for case 8)
    - .planning/phases/20-purchase-pipeline/20-CONTEXT.md (the live purchase pipeline that mints a real key — the case-1 prerequisite)
    - docs/HARNESS.md (DMG flake; confirm build via the .app/.dmg, not the exit code)
    - MEMORY: prod-ce-live-phase20 (license.tinkerdev.io live; CE singleplayer /v1) + auto-build-at-phase-boundary
  </read_first>
  <action>Before the human gate, the agent automates everything it can: confirm cases 3/4/5/6 green via scripts/e2e-spike.sh (Task 1, with screenshots), run check-dev-strip.sh --prod to prove the release binary is dev-string-clean, auto-run the PROD-pointed pnpm tauri build (hdiutil detach + retry on the DMG flake; confirm via the bundle path not the exit code) and report the .app/.dmg path, and scaffold 21-SHIP-GATE-MATRIX.md with all 8 rows pre-filled for the auto cases. The agent then pauses for the human to run the live prod-CE cases (1/2/7/8) — or records them blocked-on-Phase-20 — and to sign off the matrix + gsd-ui-review.</action>
  <what-built>
    The complete licensing lifecycle on a fresh, PROD-pointed `tauri build` (release arm → license.tinkerdev.io). The agent auto-runs `pnpm tauri build` (release; DMG flake → `hdiutil detach` + retry; confirm via the bundle path, not the exit code) and the fixture-driven cases 3/4/5/6 via the dev e2e harness (Task 1). The remaining live cases (1 valid activation, 2 second-device rejection, 7 deactivate/transfer, 8 revocation) are exercised against the live prod CE with a REAL key minted through the Phase-20 pipeline, using the infra/keygen/release-seat.sh helper (case 7) and the CE admin revoke (case 8). Every case is recorded in 21-SHIP-GATE-MATRIX.md with: case #, requirement, method (dev-harness-auto / release-manual), evidence (screenshot path or log/command output), and pass/fail.
  </what-built>
  <how-to-verify>
    **BLOCKER CHECK FIRST:** confirm Phase 20 is complete (PAY-03 live purchase done) and a real prod-CE license key (with the D-89 email embedded) is available. If not, STOP — record the matrix as "blocked on Phase 20" and resume when cleared. The fixture cases (3/4/5/6) can be signed off independently; cases 1/2/7/8 wait.
    1. Agent confirms cases 3/4/5/6 green via `scripts/e2e-spike.sh` (Task 1) — screenshots attached.
    2. Agent auto-runs the PROD-pointed `pnpm tauri build` and reports the `.app`/`.dmg` path under `src-tauri/target/release/bundle/macos/`.
    3. Human (with the agent's recorded steps) runs the live cases on the built release app against license.tinkerdev.io:
       - Case 1: paste the real key → activates → Pro unlocks (theming + ordering). Screenshot Licensed + the masked key + email.
       - Case 2: on a second device (or a second fingerprint), paste the same key → calm seat-limit rejection naming the self-serve path + the reply-to-email fallback (D-80).
       - Case 7: on device 1, Deactivate (confirm-first) → seat freed; reactivate the same key on device 2 → succeeds. (If only one physical device, use the release-seat.sh helper to free + a fingerprint reset to simulate the new device — document the method.)
       - Case 8: revoke/suspend the license in the prod CE admin → on the app, drive Refresh → entitlements drop to free, calm "Pro is no longer active", no crash.
    4. Agent fills 21-SHIP-GATE-MATRIX.md with all 8 rows + evidence; the human verifies each row's evidence and the calm tone throughout.
    5. Final phase-boundary sign-off: a passing gsd-ui-review WCAG-AA audit (carried from Plan 04) + the matrix all-green.
  </how-to-verify>
  <resume-signal>Type "approved" (all 8 green) or describe failures / "blocked on Phase 20".</resume-signal>
  <acceptance_criteria>
    - `.planning/phases/21-license-lifecycle-ship-gate/21-SHIP-GATE-MATRIX.md` exists with 8 rows (Case 1..8), each with requirement, method, evidence path, pass/fail
    - cases 3/4/5/6 carry real-WKWebView screenshot evidence
    - cases 1/2/7/8 carry live prod-CE evidence (screenshots + the seat-release/revoke command output) OR are clearly marked "blocked on Phase 20" with the resume condition
    - a fresh PROD-pointed `pnpm tauri build` produced a release `.app`/`.dmg`
    - human sign-off recorded; gsd-ui-review WCAG-AA passing
    - decoder.ts + its 19 tests byte-for-byte untouched
  </acceptance_criteria>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| release build → prod CE (license.tinkerdev.io) | The matrix exercises real activation/refresh/deactivate/revoke against live infra. |
| CE admin revoke/seat-release → app | Privileged admin actions whose effect must propagate calmly to the client. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-21-16 | Tampering | copied/corrupted machine.lic (cases 4,5) | mitigate | The matrix is itself the verification that fail-closed holds on the real build — cases 4 (corrupt) + 5 (foreign FP) MUST land on free/problem, never licensed; a failure here blocks the ship. |
| T-21-17 | Spoofing | second-device activation (case 2) | mitigate | Case 2 proves the server-side seat limit (maxMachines=1) rejects a second fingerprint with the calm seatLimit path — the seat binding is server-authoritative, not client-bypassable. |
| T-21-18 | Information disclosure | prod-CE evidence in the matrix doc | mitigate | The matrix records masked keys + the buyer's own email only; do NOT paste a raw license key or the admin token into 21-SHIP-GATE-MATRIX.md (redact to the masked form). |
| T-21-19 | Elevation | dev arm leaking into the prod build | mitigate | The PROD-pointed release build embeds the prod CE constants (config.rs release arm + the Plan-20 tripwire); `check-dev-strip.sh --prod` confirms no localhost/dev string in the release binary before the matrix run. |
</threat_model>

<verification>
- Cases 3/4/5/6 green via `scripts/e2e-spike.sh` with screenshots.
- Cases 1/2/7/8 evidenced against live prod CE (or marked blocked-on-Phase-20).
- Fresh PROD-pointed `tauri build`; `check-dev-strip.sh` prod-clean.
- 21-SHIP-GATE-MATRIX.md complete; human sign-off; gsd-ui-review WCAG-AA.
- No raw key/admin token in any committed doc.
- decoder.ts + 19 tests untouched.
</verification>

<success_criteria>
- All 8 ship-gate cases pass on a fresh prod build against real infra (or the live-only cases are explicitly gated on Phase 20 with a clear resume condition, the fixture cases signed off).
- The matrix is recorded with honest method + evidence per case; no secrets committed.
- The milestone is ship-ready: lifecycle correct across its whole lifetime, free-tier flip live, fail-closed proven on the real build.
</success_criteria>

<output>
After completion, create `.planning/phases/21-license-lifecycle-ship-gate/21-05-SUMMARY.md`.
</output>
