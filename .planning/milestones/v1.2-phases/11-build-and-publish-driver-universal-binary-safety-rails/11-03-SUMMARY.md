---
phase: 11-build-and-publish-driver-universal-binary-safety-rails
plan: 03
subsystem: release
tags: [tauri-updater, universal-binary, minisign, dst-02, gh-release]

requires:
  - phase: 11-02
    provides: "build-and-publish.mjs driver wired to pnpm release:publish"
  - phase: 09
    provides: "buildLatestJson dual-key (darwin-aarch64 + darwin-x86_64) manifest"
provides:
  - "Live-proven universal publish: v0.2.2 on bklim5/devtools-releases (DMG + .app.tar.gz + latest.json)"
  - "Live-proven DST-02 updater round-trip (detect → minisign verify → relaunch) on Apple Silicon"
affects: [release-tooling, milestone-v1.2-signoff]

tech-stack:
  added: []
  patterns:
    - "Live human-gated acceptance: irreversible publish + on-hardware updater round-trip as the milestone's load-bearing proof"

key-files:
  created:
    - .planning/phases/11-build-and-publish-driver-universal-binary-safety-rails/11-03-SUMMARY.md
    - src/lib/update/downloadProgress.ts
    - src/lib/update/downloadProgress.test.ts
  modified:
    - scripts/build-and-publish.mjs
    - src/lib/platform/tauri.ts

key-decisions:
  - "arm64 verified live; x86_64 covered-by-construction — one universal artifact, byte-identical signature served under both latest.json keys (confirmed via curl)"
  - "APPLE_* posture: ad-hoc signing (notarisation deferred, REL-09 default honored)"

patterns-established:
  - "Updater download progress is a pure reduceDownloadProgress() fold (bytes/total), keeping the @tauri-apps seam a thin forwarder"

requirements-completed: [REL-05, REL-06, REL-07, REL-09, REL-12]

duration: 35min
completed: 2026-06-03
---

# Phase 11 / Plan 03: Live Build-and-Publish Acceptance Summary

**v0.2.2 was built as a universal binary, published to `bklim5/devtools-releases`, and an older install auto-updated to it through the mandatory minisign verify — DST-02 proven live on real hardware.**

## Performance

- **Duration:** ~35 min (incl. two real-bug fixes found during the live run)
- **Completed:** 2026-06-03
- **Tasks:** 4/4 (Tasks 1–3 human-gated checkpoints, Task 4 evidence record)

## Accomplishments

### Task 1 — Signing env (human-only)
The maintainer exported `TAURI_SIGNING_PRIVATE_KEY_PATH` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` into the publish shell (key at `~/.tauri/devtools.key`, gitignored). Secret never entered the repo, a log, or a CLI arg (T-11-13 mitigated).

### Task 2 — Real publish + served-version match (REL-05, REL-07, REL-12)
`pnpm release:publish` (non-dry) ran the full pipeline and published **v0.2.2** to the public `bklim5/devtools-releases` (never `origin`, T-11-16 mitigated). Independently verified by the orchestrator (read-only):

- **Served manifest** (`releases/latest/download/latest.json`): `version: 0.2.2` — matches the cut version (**REL-12**).
- **Dual-key universal** (**REL-05**): both `darwin-aarch64` and `darwin-x86_64` present with the **same** `url` and **byte-identical** `signature`; **no** `darwin-universal` key.
- **Assets on the public repo** (**REL-07**): `devtools-app.app.tar.gz` + `devtools-app_0.2.2_universal.dmg` + `latest.json`, tag `v0.2.2`.
- `lipo -archs` on the built Mach-O reported `x86_64 arm64` (fat binary confirmed by the driver during the run).

### Task 3 — DST-02 live updater round-trip
On **Apple Silicon**, an older install **detected** v0.2.2, **passed the minisign verify** against the pinned `tauri.conf.json` pubkey (no `InvalidSignature`), and **relaunched into 0.2.2**. The load-bearing verify-before-apply boundary (T-11-14) held live. **Intel: covered-by-construction** — the single universal artifact serves a byte-identical signature under both keys (Phase 9 guarantee, confirmed in the served manifest above), so the `darwin-x86_64` path is the same payload + same signature the arm64 path verified.

### Task 4 — Evidence + APPLE_* posture (REL-09)
APPLE_* unset → **ad-hoc signing** (notarisation deferred), the REL-09 default. This file records the evidence the phase-boundary sign-off rests on.

## Deviations — two real bugs found and fixed during the live run

1. **`main().catch()` crash** (`scripts/build-and-publish.mjs`, fix `899a7036`): the Plan 02 driver made `main()` synchronous but the call site still did `main().catch()`, so it threw `Cannot read properties of undefined (reading 'catch')` **after a fully successful publish**, exiting 1 (false failure). Fixed by wrapping the sync call in `try/catch`, restoring the intended loud-fail boundary for `publish()`'s throwing helpers. Gate green (vitest 497, tsc, eslint).

2. **8000% download progress** (`src/lib/platform/tauri.ts`, fix `d8c413d5`): the updater seam forwarded the plugin's per-chunk `chunkLength` (bytes) straight to the UI, which rendered it as a percent. Extracted a pure, TDD'd `reduceDownloadProgress()` (accumulate bytes / `contentLength`, clamped 0–100, `undefined` when total unknown) with the 8000% case as an explicit regression test, and wired the seam to it. Gate green (vitest 503, tsc, eslint). Cosmetic/non-load-bearing for DST-02 (the verify + install is the load-bearing part).

## Requirements

- **REL-05** universal binary — live-proven (fat Mach-O, dual-key manifest).
- **REL-06** publish-step safety rails — exercised live (preflights passed, ordered pipeline, assets-first/manifest-last).
- **REL-07** cross-repo publish — **now live-proven** (assets on `bklim5/devtools-releases`); flips Pending → Complete.
- **REL-09** APPLE_* honored, ad-hoc default — confirmed (ad-hoc used).
- **REL-12** served-version match — live-proven (`curl` → 0.2.2).

## Notes for sign-off

The milestone's worst-case failure (a broken/unverifiable release auto-installing onto every user) is disproven live: the round-trip required and passed the minisign verify before applying. Recommend the phase-boundary human sign-off note that the live round-trip exercised arm64 directly and x86_64 by-construction.
