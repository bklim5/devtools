---
phase: 06-distribution
plan: 05
subsystem: infra
tags: [tauri, updater, minisign, code-signing, dmg, release, github-releases, wcag]

# Dependency graph
requires:
  - phase: 06-distribution (06-01..06-04)
    provides: ".gitignore secret hardening + 0.2.0 version bump (06-01); updater platform seam + autoUpdateCheck pref (06-02); Tauri updater/process plugins + tray Check-for-Updates + tauri.conf updater/signing block + minisign keygen (06-03); updater UX orchestration + WCAG-AA banner + first-run opt-in (06-04)"
provides:
  - "docs/RELEASE.md — repeatable manual release runbook (split-repo flow, inline-key signing, latest.json schema, hdiutil unmount workaround, per-arch caveat, post-enrolment notarisation flip)"
  - "A signed (ad-hoc) DMG + updater artifacts (.app.tar.gz + .sig) built with the password-protected minisign key — DST-01 release-ready"
  - "A proven, signature-verified updater round-trip (0.2.0 → 0.2.1) — DST-02 verify-before-apply"
  - "Split-repo distribution architecture: private source (bklim5/devtools) + public release host (bklim5/devtools-releases)"
  - "Phase 6 signed off; v1.0 milestone effectively complete (Gatekeeper-clean the sole deferred clause)"
affects: [future Settings phase, post-enrolment notarisation, CI/cross-arch release phase]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Split-repo releases: source repo stays private; a dedicated PUBLIC repo hosts artifacts + latest.json (the Tauri updater downloads unauthenticated, so artifacts must be public, but source need not be)"
    - "Inline-key signing: TAURI_SIGNING_PRIVATE_KEY=\"$(cat ~/.tauri/devtools.key)\" + TAURI_SIGNING_PRIVATE_KEY_PASSWORD — never the key path, never committed"
    - "latest.json is gitignored (generated per-release, published to the releases repo, not the source tree)"

key-files:
  created:
    - "docs/RELEASE.md"
    - ".planning/phases/06-distribution/06-HUMAN-UAT.md"
    - ".planning/phases/06-distribution/06-UI-REVIEW.md"
  modified:
    - "src-tauri/tauri.conf.json (updater endpoint → bklim5/devtools-releases; version 0.2.1; password-protected pubkey)"
    - "package.json (version 0.2.1)"
    - ".gitignore (latest.json)"
    - ".planning/REQUIREMENTS.md (DST-01/DST-02 Complete)"

key-decisions:
  - "Split-repo: private source (bklim5/devtools) + public release host (bklim5/devtools-releases) — artifacts must be downloadable unauthenticated by the updater, source need not be public"
  - "Rotated the minisign key passwordless → password-protected before distribution (closing the 06-03 follow-up); pubkey re-committed into tauri.conf.json"
  - "Inline TAURI_SIGNING_PRIVATE_KEY (cat the key file) is the primary documented signing form (more robust than the path env across Tauri versions)"
  - "Left the round-trip bump at 0.2.1 (intended — it is the live published version)"
  - "Gatekeeper-clean DEFERRED post-Apple-Developer-Program enrolment (D-02) — a credentials-only flip, NOT a phase blocker"

patterns-established:
  - "Manual release runbook (D-16): confirm repo → lockstep bump → signed build → publish DMG+.app.tar.gz → build latest.json from the FRESH .sig → publish latest.json → verify round-trip"
  - "Updater verify-before-apply proven by a real two-build round-trip, not just config"

requirements-completed: [DST-01, DST-02]

# Metrics
duration: ~3h (spanning the human build + publish + two-build round-trip + UI audit)
completed: 2026-06-01
---

# Phase 6 Plan 5: Distribution Close-out Summary

**RELEASE.md runbook + a real signature-verified updater round-trip (0.2.0 → 0.2.1) over a split-repo distribution (private source / public release host), closing DST-01 ("release-ready, pending cert") and DST-02 (verify-before-apply) — Phase 6 signed off.**

## Performance

- **Duration:** ~3h (human build + GitHub publish + two-build round-trip + gsd-ui-review)
- **Completed:** 2026-06-01
- **Tasks:** 3 (Task 1 RELEASE.md, Task 2 full automated gate, Task 3 human-verify sign-off)
- **Files modified:** ~7 (RELEASE.md, 06-HUMAN-UAT.md, 06-UI-REVIEW.md, tauri.conf.json, package.json, .gitignore, REQUIREMENTS.md)

## Accomplishments

- **DST-01 "release-ready, pending cert":** `pnpm tauri build` with the password-protected key produced THREE artifacts — `devtools-app_0.2.0_aarch64.dmg`, `devtools-app.app.tar.gz`, `devtools-app.app.tar.gz.sig`; the DMG installs and the app launches (ad-hoc Gatekeeper friction expected per D-02).
- **DST-02 verify-before-apply PROVEN (load-bearing):** from the installed 0.2.0 app, "Check for Updates…" detected the published 0.2.1, **VERIFIED the minisign signature**, installed, and **RELAUNCHED into 0.2.1**. User confirmed "round-trip works".
- **Split-repo distribution decided + wired:** source `bklim5/devtools` stays PRIVATE; a dedicated PUBLIC repo `bklim5/devtools-releases` hosts the DMG + `.app.tar.gz` + `latest.json`. Updater endpoint repointed to `https://github.com/bklim5/devtools-releases/releases/latest/download/latest.json`.
- **Minisign key rotated passwordless → password-protected** (closing the 06-03 follow-up); pubkey re-committed into `tauri.conf.json`.
- **docs/RELEASE.md** is a complete, copy-pasteable runbook (split-repo flow, inline-key signing, latest.json schema + fresh-`.sig` warning, hdiutil unmount workaround, per-arch caveat, post-enrolment notarisation flip).
- **gsd-ui-review:** 23/24, WCAG-AA gate PASS, zero blockers (`06-UI-REVIEW.md`).

## Task Commits

This plan's work landed across several commits (parts done at the human-action checkpoints with the signing secrets, then finalized here):

1. **Key rotation (passwordless → password)** - `a9cc8955` (chore)
2. **Task 1: RELEASE.md runbook** - `2ac2e001` (docs)
3. **06-HUMAN-UAT.md checklist created** - `e42eb9ed` (docs)
4. **Inline-key signing as primary form** - `d44af7c9` (docs)
5. **Split-repo releases (endpoint repoint)** - `b7c97a36` (feat)
6. **Gitignore generated latest.json** - `0bbf1d78` (chore)
7. **Lockstep bump 0.2.0 → 0.2.1 for the round-trip** - `c2d189bb` (chore)
8. **gsd-ui-review (23/24, WCAG-AA PASS)** - `4c036215` (docs)
9. **Task 3: UAT PASS + DST-01/DST-02 Complete** - `c4600643` (docs)

**Plan metadata:** final docs commit (this SUMMARY + STATE/ROADMAP).

_Task 2 (full automated gate) was verification-only — no source change; re-confirmed green at every lefthook gate (303/303 vitest, decoder 19 intact; tsc clean; eslint 0; real-WKWebView e2e 8/8; seam audit clean)._

## Files Created/Modified

- `docs/RELEASE.md` - The manual release runbook (D-16): pre-release repo-confirm, lockstep bump, signed build, GitHub publish, latest.json construction, round-trip verify + per-arch / notarisation-flip / secrets / CSP callouts.
- `.planning/phases/06-distribution/06-HUMAN-UAT.md` - A–D sign-off checklist; all items PASS, Gatekeeper-clean DEFERRED, split-repo + 3 follow-ups recorded.
- `.planning/phases/06-distribution/06-UI-REVIEW.md` - WCAG-AA audit (23/24 PASS, zero blockers, 3 minor follow-ups).
- `src-tauri/tauri.conf.json` - Updater endpoint → `bklim5/devtools-releases`; version 0.2.1; password-protected minisign pubkey.
- `package.json` - Version 0.2.1 (lockstep).
- `.gitignore` - Ignore generated `latest.json`.
- `.planning/REQUIREMENTS.md` - DST-01 + DST-02 marked Complete (list + Traceability).

## Decisions Made

- **Split-repo distribution** (vs making the source public): the updater fetches unauthenticated, so only the artifacts + manifest must be public. A dedicated `bklim5/devtools-releases` repo keeps source private while satisfying the updater — this was decided this session and removed the original plan's "confirm-real-repo" ambiguity (the endpoint had been pointing at the source repo).
- **Password-protect the minisign key before distribution:** the 06-03 follow-up explicitly tracked the passwordless key as ship-blocking; rotated + re-committed the pubkey.
- **Inline-key signing as the primary documented form:** `TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/devtools.key)"` proved more robust than the `_PATH` env across the build.
- **Leave the version at 0.2.1:** it is the live published build that completed the round-trip — correct and intended.

## Deviations from Plan

The plan's Task 1 pinned the endpoint to `boonkhailim/devtools` (a placeholder) and assumed a single-repo release; 06-03 had already corrected it to the real `bklim5/devtools`. This session went one step further:

**1. [Rule 4-adjacent — architectural, user-directed] Split-repo release architecture**
- **Found during:** Task 3 (round-trip setup)
- **Issue:** Keeping the source repo public solely to host updater artifacts was undesirable; but the Tauri updater downloads unauthenticated, so artifacts cannot live behind a private repo.
- **Fix:** Created a dedicated PUBLIC `bklim5/devtools-releases` repo for artifacts + `latest.json`; repointed the updater endpoint; gitignored the generated `latest.json`; rewrote RELEASE.md for the split-repo flow. (User-directed during the checkpoint — an architectural choice, not an auto-fix.)
- **Files modified:** src-tauri/tauri.conf.json, .gitignore, docs/RELEASE.md
- **Verification:** The real round-trip resolved `releases/latest/download/latest.json` from the public repo and applied the verified update.
- **Committed in:** `b7c97a36`, `0bbf1d78`, `d44af7c9`

**2. [Rule 2 — missing critical, closing a tracked follow-up] Password-protect the minisign key**
- **Found during:** pre-distribution hardening
- **Issue:** 06-03 shipped a passwordless key with a tracked "regenerate with a password before public distribution" follow-up.
- **Fix:** Rotated the key to password-protected; re-committed the pubkey into tauri.conf.json; signed builds now require `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
- **Committed in:** `a9cc8955`

---

**Total deviations:** 2 (1 architectural/user-directed split-repo, 1 missing-critical key rotation)
**Impact on plan:** Both strengthen the release posture (private source, password-protected signing) without scope creep. The split-repo change is the more robust resolution of the plan's repo-confirm step.

## Issues Encountered

- None blocking. Ad-hoc Gatekeeper friction on first install is expected (D-02) and was correctly treated as not-a-failure.

## Known Stubs

None.

## Follow-ups (non-blocking)

Three MINOR a11y polish items from `06-UI-REVIEW.md` (do NOT block sign-off):

1. `UpdateOptIn` uses `role="dialog"` without focus management / `aria-modal` / Escape-to-close.
2. The install button is `aria-disabled` (not `disabled`), so it stays focusable while installing.
3. Capture a banner screenshot at the WKWebView e2e gate (visual-regression nicety).

Carry-forward (deferred, D-02): **Gatekeeper-clean install** on a clean machine — needs Apple Developer ID cert + notarisation; re-verify post-enrolment (RELEASE.md § "Post-enrolment notarisation flip").

## User Setup Required

The release process is manual and operator-run (documented in `docs/RELEASE.md`): the signing secrets live local + gitignored (`~/.tauri/devtools.key` + password); publishing targets the public `bklim5/devtools-releases` repo. No new always-on external service config.

## Next Phase Readiness

- **v1.0 milestone effectively complete.** All six phases done; the only open clause is the deferred Gatekeeper-clean (post-Apple-enrolment notarisation, D-02) and the parked NAT-01 configurable hotkey (future Settings phase, G-05-1).
- Releases are now repeatable via RELEASE.md; the updater is proven end-to-end.
- Carry-forward to a future CI/cross-arch phase: a local Apple-Silicon build serves only `darwin-aarch64`; Intel users need an `x86_64`/universal build.

## Self-Check: PASSED

All claimed files exist (docs/RELEASE.md, 06-HUMAN-UAT.md, 06-UI-REVIEW.md, 06-05-SUMMARY.md) and all referenced commits resolve in git (a9cc8955, 2ac2e001, e42eb9ed, d44af7c9, b7c97a36, 0bbf1d78, c2d189bb, 4c036215, c4600643).

---
*Phase: 06-distribution*
*Completed: 2026-06-01*
