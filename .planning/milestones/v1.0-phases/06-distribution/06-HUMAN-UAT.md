# Phase 6 (Distribution) — Human UAT Sign-off

**Requirements under test:** DST-01 (signed DMG + updater artifacts — "release-ready, pending cert")
· DST-02 (auto-updater verifies before applying — real round-trip).

**Status:** PASS (human-verified on the packaged build + a real updater round-trip, 2026-06-01)
**Created:** 2026-06-01
**Signed off:** 2026-06-01
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

- [x] **A1.** ✅ PASS — Signed with the password-protected key via the inline form
      `TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/devtools.key)"` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
- [x] **A2.** ✅ PASS — `pnpm tauri build` exited 0.
- [x] **A3.** ✅ PASS — THREE artifacts produced: `devtools-app_0.2.0_aarch64.dmg`,
      `devtools-app.app.tar.gz`, `devtools-app.app.tar.gz.sig`.
- [x] **A4.** ✅ PASS — DMG installs; app launches (ad-hoc Gatekeeper friction expected per D-02).

## B. UPDATER UX — DST-02 (on the packaged app)

- [x] **B5.** ✅ PASS — First-launch opt-in prompt appeared; the choice persisted across relaunch.
- [x] **B6.** ✅ PASS — Tray "Check for Updates…" ran a manual check; quiet "up to date" with no newer release.
- [x] **B7.** ✅ PASS — The in-app banner is keyboard-reachable and dismissible; re-appears on a subsequent detection.

## C. REAL ROUND-TRIP — DST-02 verify-before-apply (the load-bearing proof)

- [x] **C8.** ✅ PASS — Published build 0.2.0 to the PUBLIC releases repo `bklim5/devtools-releases`
      (GitHub Release v0.2.0 with DMG + `.app.tar.gz` + `latest.json`).
- [x] **C9.** ✅ PASS — Bumped to 0.2.1 in lockstep (`package.json` + `tauri.conf.json`, commit `c2d189bb`),
      rebuilt, published v0.2.1 + `latest.json`.
- [x] **C10.** ✅ PASS — From the installed 0.2.0 app, "Check for Updates…" detected 0.2.1,
      **VERIFIED the minisign signature**, installed, and **RELAUNCHED into 0.2.1**.
      The load-bearing DST-02 verify-before-apply proof. User confirmed "round-trip works".

## D. AUDIT — WCAG-AA

- [x] **D11.** ✅ PASS — `gsd-ui-review` ran: **23/24, WCAG-AA gate PASS, zero blockers**
      (`06-UI-REVIEW.md`, commit `4c036215`). Three MINOR non-blocking a11y polish follow-ups
      recorded (see Result § Follow-ups) — they do NOT block sign-off.

## DEFERRED (NOT a blocker — D-02)

- [~] **Gatekeeper-clean install on a clean machine** — DEFERRED (not FAILED). Needs Apple Developer ID
      cert + notarisation. Re-verified post-enrolment (RELEASE.md § "Post-enrolment notarisation flip").
      Ad-hoc Gatekeeper friction on first install is EXPECTED + acceptable this milestone (D-02).

---

## Result

All A–D items PASS; Gatekeeper-clean DEFERRED (not failed). **Done on full pass:**
1. ✅ **DST-01** (release-ready, pending cert) + **DST-02** marked Complete in `REQUIREMENTS.md` + Traceability.
2. ✅ **Phase 6 `[x]`** in `ROADMAP.md`.
3. ✅ `STATE.md` updated (Phase 6 complete; Gatekeeper-clean carry-forward noted).

**Overall:** ☑ PASS  ☐ FAIL  — (human-confirmed 2026-06-01: "round-trip works")

### Architecture decided this session (split-repo)

Source repo `bklim5/devtools` stays **PRIVATE**; a dedicated **PUBLIC** repo `bklim5/devtools-releases`
holds release artifacts + `latest.json`. The Tauri updater downloads unauthenticated, so artifacts must
be public — but the source need not be. The updater endpoint in `tauri.conf.json` points at
`https://github.com/bklim5/devtools-releases/releases/latest/download/latest.json` (commit `b7c97a36`).
`RELEASE.md` documents this split-repo flow + the inline-key signing form. `latest.json` is gitignored
(commit `0bbf1d78`). The minisign key was rotated from passwordless → **password-protected** (commit
`a9cc8955`, pubkey re-committed into `tauri.conf.json`).

### Follow-ups (3 MINOR, non-blocking — recorded from `06-UI-REVIEW.md`)

1. `UpdateOptIn` uses `role="dialog"` without focus management / `aria-modal` / Escape-to-close.
2. The install button is `aria-disabled` (not `disabled`), so it stays focusable while installing.
3. Capture a banner screenshot at the WKWebView e2e gate (visual-regression nicety).

**Carry-forward (always, regardless of pass):** DST-01's Gatekeeper-clean clause stays DEFERRED to
post-Apple-Developer-Program enrolment (D-02).
