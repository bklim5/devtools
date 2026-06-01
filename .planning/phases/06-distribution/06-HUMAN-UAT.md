# Phase 6 (Distribution) — Human UAT Sign-off

**Requirements under test:** DST-01 (signed DMG + updater artifacts — "release-ready, pending cert")
· DST-02 (auto-updater verifies before applying — real round-trip).

**Status:** PENDING (awaiting human verification on the packaged build + a real updater round-trip)
**Created:** 2026-06-01
**Runbook:** follow `docs/RELEASE.md` for the build + publish + round-trip steps.

> **Automated pre-gate already GREEN before this checklist** (Plan 06-05 Task 2):
> 303/303 vitest (decoder 19 intact) · `tsc --noEmit` clean · eslint 0 ·
> real-WKWebView e2e (8 specs incl. `update.e2e.ts`) · seam audit clean
> (no `@tauri-apps` import outside `src/lib/platform/tauri.ts` + the `index.ts` dynamic import).

> **DEFERRED, NOT A BLOCKER (D-02):** Gatekeeper-clean install on a clean machine (needs an Apple
> Developer ID cert + notarisation). Ad-hoc Gatekeeper friction on first install is EXPECTED and
> acceptable this milestone — right-click → Open to bypass. Re-verified post-enrolment.

---

## A. BUILD — DST-01 "release-ready, pending cert"

The minisign key is **password-protected**: export BOTH the key and its password (RELEASE.md § 2).

- [ ] **A1.** Exported `TAURI_SIGNING_PRIVATE_KEY` (or `TAURI_SIGNING_PRIVATE_KEY_PATH=~/.tauri/devtools.key`)
      **and** `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (the chosen password).
- [ ] **A2.** `pnpm tauri build` exits 0. (If the DMG step flakes: `hdiutil info` →
      `hdiutil detach <node>` for stray DMGs → retry — RELEASE.md § 3 / Pitfall 5.)
- [ ] **A3.** THREE artifacts exist under `src-tauri/target/release/bundle/`:
      a `*.dmg`, a `*.app.tar.gz`, and a `*.app.tar.gz.sig`.
- [ ] **A4.** Installed the DMG; the app launches. (Ad-hoc Gatekeeper friction EXPECTED — right-click →
      Open to bypass — D-02.)

## B. UPDATER UX — DST-02 (on the packaged app)

- [ ] **B5.** First launch: the one-time opt-in prompt appears ("Enable automatic update checks?");
      choosing it persists (relaunch → not re-asked).
- [ ] **B6.** Tray **"Check for Updates…"** runs a manual check regardless of the toggle; with no
      newer release it shows a quiet "up to date".
- [ ] **B7.** The in-app banner is keyboard-reachable: Tab to Install/dismiss; dismiss with the
      keyboard; it re-appears on a subsequent detection.

## C. REAL ROUND-TRIP — DST-02 verify-before-apply (the load-bearing proof)

- [ ] **C8.** Published the current build (build N) as a GitHub Release + `latest.json` per RELEASE.md.
- [ ] **C9.** Bumped to N+1 (lockstep `tauri.conf.json` + `package.json`), built + published again.
- [ ] **C10.** Ran build N, triggered "Check for Updates…", confirmed:
      prompt → Install → **signature verified** → **relaunches into N+1**.
      (A signature mismatch MUST refuse to install — that refusal is DST-02 working.)

## D. AUDIT — WCAG-AA

- [ ] **D11.** Ran `gsd-ui-review` (WCAG-AA) on the packaged build, focused on the UpdateBanner +
      opt-in prompt; recorded results in `06-UI-REVIEW.md`. Any AA blocker fixed.

## DEFERRED (NOT a blocker — D-02)

- [ ] **Gatekeeper-clean install on a clean machine** — needs Apple Developer ID cert + notarisation.
      Re-verified post-enrolment (RELEASE.md § "Post-enrolment notarisation flip"). Recorded as
      DEFERRED, not FAILED.

---

## Result

Record PASS/FAIL per item above. **On full pass:**
1. Mark **DST-01** (release-ready, pending cert) + **DST-02** Complete in `REQUIREMENTS.md` +
   the Traceability table.
2. Mark **Phase 6 `[x]`** in `ROADMAP.md`.
3. Update `STATE.md` (Phase 6 complete; Gatekeeper-clean carry-forward noted).

**Overall:** ☐ PASS  ☐ FAIL  — (human to mark)

**Carry-forward (always, regardless of pass):** DST-01's Gatekeeper-clean clause stays DEFERRED to
post-Apple-Developer-Program enrolment (D-02).
