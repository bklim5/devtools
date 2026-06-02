---
phase: 06-distribution
plan: 01
subsystem: repo-hygiene
tags: [gitignore, secrets, versioning, distribution]
dependency_graph:
  requires: []
  provides:
    - "secret-safe .gitignore (.env/.envrc/*.key/*.p8 un-committable)"
    - "app version 0.2.0 in lockstep across package.json + tauri.conf.json"
  affects:
    - ".gitignore"
    - "package.json"
    - "src-tauri/tauri.conf.json"
tech_stack:
  added: []
  patterns:
    - "Manual lockstep version bump across both manifests (D-16)"
    - "Defense-in-depth secret-ignore patterns committed before any secret exists (D-05)"
key_files:
  created:
    - ".planning/phases/06-distribution/06-01-SUMMARY.md"
  modified:
    - ".gitignore"
    - "package.json"
    - "src-tauri/tauri.conf.json"
decisions:
  - "Left src-tauri/Cargo.toml version at 0.1.0 — Tauri derives the bundle version from tauri.conf.json; the Cargo crate version is internal, so touching it would be an unrelated diff (per plan Task 2 guidance)."
metrics:
  duration: "~1 min"
  tasks: 2
  files_changed: 3
  completed: "2026-06-01"
# DST-01/DST-02 are NOT completed by this plan — see Deviations. They are
# delivered by later Phase-6 plans (signing/notarisation/DMG/updater).
requirements_progressed: [DST-01, DST-02]
requirements_completed: []
---

# Phase 6 Plan 01: Repo-Hygiene Foundation Summary

Hardened `.gitignore` so minisign/Apple secret material is un-committable before any secret exists, and bumped the app version to `0.2.0` in lockstep across both manifests — the safe foundation every later Phase-6 distribution plan builds on.

## What Was Built

### Task 1 — Harden `.gitignore` against secret material (D-05, Pitfall 6)
Appended a clearly-commented secrets section to `.gitignore` (no existing rule removed or reordered) ignoring `.env`, `.env.*`, `.envrc`, `*.key`, `*.p8`. This pre-empts the minisign updater private key + password and the Apple notary credentials that later Phase-6 plans (D-05/D-15) introduce. The minisign PUBLIC key lives in `tauri.conf.json` as a string field (not a `*.key`/`*.pub` file), so it is unaffected. `git check-ignore .env secret.key apple.p8 .envrc .env.production` confirms all are ignored. Mitigates threat **T-06-01** (info disclosure of secrets via accidental commit).

- **Commit:** `c0e3e0f2`

### Task 2 — Lockstep version bump to `0.2.0` (D-16)
Changed only the `version` field from `"0.1.0"` to `"0.2.0"` in both `package.json` and `src-tauri/tauri.conf.json`. `0.2.0` (minor bump) marks the first distribution-capable build — the first version that ships the updater, which compares the app version against `latest.json`, so the two manifests must never diverge. `identifier` (`com.boonkhailim.devtools-app`) and `productName` were untouched; `src-tauri/Cargo.toml` was left at `0.1.0` (internal crate version, Tauri uses `tauri.conf.json`). Mitigates threat **T-06-02** (version-field divergence).

- **Commit:** `ee26056a`

## Verification

- `git check-ignore .env secret.key apple.p8 .envrc .env.production` → all listed as ignored.
- Both manifests at `0.2.0`; no `0.1.0` remains in either.
- `identifier`/`productName` unchanged.
- lefthook pre-commit gate (tsc `--noEmit` + `vitest run`) green on both commits: **276/276 vitest** (decoder 19 untouched), tsc clean — no code changed, so the test bar is unmoved.

Note: the harness's `grep -qx '*.key'` style acceptance commands assume BRE where `*` is a literal at line start; this machine aliases `grep` to `ugrep`, which parses `*.key` as a regex with an empty subexpression and errors. The substantive check (`git check-ignore`) confirms the ignore behavior, and `grep -qxF` (fixed-string) confirms the literal lines are present — same guarantee, ugrep-safe.

## Deviations from Plan

The two task actions ran exactly as written. One metadata correction was made:

**1. [Rule 1 - Bug] Did NOT mark DST-01/DST-02 Complete (plan frontmatter over-attribution)**
- **Found during:** state/requirements update step.
- **Issue:** The plan frontmatter lists `requirements: [DST-01, DST-02]`, but DST-01 ("macOS build is code-signed and notarised, packaged as a DMG") and DST-02 ("auto-updater is wired and verifies updates") are NOT satisfied by this plan — it only hardened `.gitignore` and bumped the version. Those requirements are delivered by later Phase-6 plans (06-02..06-05, signing/notarisation/DMG/updater). Marking them Complete here would be a false claim that misleads the phase sign-off.
- **Fix:** Reverted DST-01/DST-02 to unchecked (`[ ]`) in REQUIREMENTS.md and set their Traceability status to `In Progress` (Phase 6 is executing). They will be marked Complete by the plan that actually delivers each.
- **Files modified:** `.planning/REQUIREMENTS.md`
- **Commit:** folded into the final docs commit.

Note: the grep acceptance commands were run with the `-F` fixed-string flag to work around this machine's `ugrep` alias (which parses `*.key` as a regex with an empty subexpression); this is a verification-tooling adjustment, not a change to the work product.

## Known Stubs

None — config-only changes; no code paths or UI data sources affected.

## Self-Check: PASSED

All modified files exist on disk (`.gitignore`, `package.json`, `src-tauri/tauri.conf.json`) and the SUMMARY was written. Both task commits are in git history (`c0e3e0f2`, `ee26056a`).
