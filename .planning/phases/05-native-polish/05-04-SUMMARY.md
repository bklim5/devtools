---
phase: 05-native-polish
plan: 04
subsystem: phase-boundary
tags: [tauri, wcag-aa, tauri-build, e2e, phase-gate, human-sign-off]
status: complete

# Dependency graph
requires:
  - phase: 05-native-polish (05-01)
    provides: Rust native foundation (single-instance FIRST, tray, global-shortcut + window-state plugins, least-privilege caps, window visible:false)
  - phase: 05-native-polish (05-02)
    provides: platform.window + platform.nativeShortcut seam (real impl only in tauri.ts; browser no-ops)
  - phase: 05-native-polish (05-03)
    provides: summon.ts (SUMMON_CHORD + registerSummon over the seam) wired into startup; summon.e2e.ts
provides:
  - "05-UI-REVIEW.md — WCAG-AA audit record for the Phase-5 packaged build (24/24 PASS)"
  - "fresh tauri build verified (.app + .dmg, exit 0, launch-smoke-tested, 0 webdriver strings in the release binary)"
  - "full automated phase gate green (277/277 vitest, tsc, eslint, 7/7 real-WKWebView e2e) + seam/release/offline/capability audits clean"
affects: [phase-6 distribution (after human sign-off closes phase 5)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Phase-boundary gate for an OS-level phase leans on the human packaged-build sign-off: the WebDriver gate cannot fire an OS-global hotkey, click a menu-bar tray, launch a second process, or assert window-manager geometry (VALIDATION Manual-Only)."

key-files:
  created:
    - .planning/phases/05-native-polish/05-UI-REVIEW.md
  modified: []

key-decisions:
  - "No new UI surface in Phase 5, so the WCAG-AA audit re-confirms the six existing tools on the freshly-built bundle rather than scoring new components; tokens unchanged (--tx-3 #868b95, --accent #5b9bf8)."

requirements: [NAT-01, NAT-02]

# Metrics
duration: "~3.5 min (autonomous gate; cargo release build dominates wall time)"
completed: 2026-06-01 (human sign-off received; Task 3 bookkeeping done)
tasks: "3 of 3 — Task 2 human checkpoint APPROVED 2026-06-01 (NAT-02/SHL-05 verified; NAT-01 hotkey PARKED via G-05-1; Phase-4 amendments verified); Task 3 doc bookkeeping complete"
---

# Phase 5 Plan 04: Phase Boundary + Human Sign-Off Summary

**Status: PAUSED at the Task-2 human-verify checkpoint.** All autonomous work (the full phase gate, the fresh `tauri build`, the e2e suite, the seam/release/offline/capability audits, and the WCAG-AA audit recorded in `05-UI-REVIEW.md`) is COMPLETE and green. The OS-level core behaviors (global summon, tray, single-instance, window-geometry restore) are Manual-Only per 05-VALIDATION and await the human packaged-build sign-off — batched with the deferred Phase-4 UAT. Task 3 (mark Phase 5 complete + sign off Phase 4 across ROADMAP/REQUIREMENTS/STATE/UAT) runs ONLY after the user types "approved".

## What Was Built (Task 1 — autonomous gate, COMPLETE)

Commit `aaa51afd` (docs):

- **Full unit gate green:** `pnpm vitest run` → **277/277** (decoder's 19 untouched; platform-seam + summon suites included); `npx tsc --noEmit` exit 0; `pnpm eslint .` 0 errors.
- **Seam discipline audit (FND-04 / T-05-04):** real `from "@tauri-apps"` import statements appear ONLY in `src/lib/platform/tauri.ts` (clipboard, store, `api/window`, `plugin-global-shortcut`); `index.ts` reaches `@tauri-apps` solely via the dynamic `import("./tauri")`; `summon.ts` has **0** `@tauri-apps` imports. No tool/shell file imports `@tauri-apps`.
- **Release-exclusion audit (T-01-10/11):** `cargo tree --release --manifest-path src-tauri/Cargo.toml | grep -c webdriver` = **0**; the `#[cfg(all(debug_assertions, feature = "webdriver"))]` double-gate in `lib.rs` is unchanged. The shipped release binary has **0** webdriver strings.
- **Offline audit (T-05-03):** `tauri.conf.json` `security.csp` unchanged (`connect-src 'self' ipc: http://ipc.localhost` — no external origin); the three new plugins make no network calls.
- **Capability least-privilege audit (T-05-01):** `capabilities/default.json` grants exactly the four new perms (`global-shortcut:allow-register/unregister/is-registered`, `window-state:default`) atop the prior core/clipboard/store grants — no wildcards.
- **Real-WKWebView e2e:** `bash scripts/e2e-spike.sh` → **7 passing on webkit** (exit 0): base64, hash, jwt, protobuf-decoder, summon (non-blank launch + HashRouter deep-link), unix-time, uuid-ulid. The OS-global hotkey is NOT covered here (Manual-Only) — that is Task 2.
- **Fresh `tauri build`:** `pnpm tauri build` → runnable `devtools-app.app` + `devtools-app_0.1.0_aarch64.dmg` (exit 0). The packaged app was launch-smoke-tested (process runs without a startup crash with the new single-instance/global-shortcut/window-state plugins + tray; window opens `visible: false` and is summoned by chord/tray as designed), then quit cleanly.
- **gsd-ui-review WCAG-AA audit:** recorded in `.planning/phases/05-native-polish/05-UI-REVIEW.md` — **24/24 PASS**. Phase 5 adds NO new in-webview UI surface (no `.tsx`/`.css` change), so the audit re-confirms the six existing tools clear AA on the Phase-3/4 AA-corrected tokens (`--tx-3 #868b95`, `--accent #5b9bf8`) in the freshly-built bundle; no fixes required.

Packaged artifacts to verify at sign-off:
- `src-tauri/target/release/bundle/macos/devtools-app.app`
- `src-tauri/target/release/bundle/dmg/devtools-app_0.1.0_aarch64.dmg`

## Task Commits

1. **Task 1: Full-suite + fresh tauri build + e2e + WCAG-AA audit + seam/release/offline/capability audits** — `aaa51afd` (docs)

## Checkpoint Reached (Task 2 — human-verify, PAUSED)

This is the only `autonomous: false` plan in the phase; it carries the phase-boundary human sign-off. Per 05-VALIDATION §Manual-Only, Phase 5's CORE behaviors are OS-level and CANNOT be automated by the WebDriver gate:
- **Global summon (NAT-01):** from another app, `Cmd+Shift+D` brings DevTools to front + focuses it (also when minimized / behind other apps — macOS focus-regression check A1).
- **Tray (NAT-02):** menu-bar tray icon → "Show DevTools" restores+focuses, "Quit" exits.
- **Single-instance (NAT-02):** a second launch of the `.app` focuses the existing window, no second window.
- **Window geometry (SHL-05 / D-11):** move/resize, quit, relaunch → restores position+size, opens to last-used tool, no blank-window flash.
- **Offline + tools intact:** all six tools function; ⌘K switches; no network.
- **DEFERRED Phase-4 checks (batched):** the 5 pending per-tool checks in `04-HUMAN-UAT.md`.
- **Adopted-defaults confirmation:** D-01 chord `CommandOrControl+Shift+D`; D-02 regular dock app + tray; D-03 minimize/unminimize summon order; D-04 JS-seam handler.

Resume signal: the user types **"approved"** to close Phase 5 AND sign off the deferred Phase 4, or describes issues / default changes (→ `/gsd-plan-phase 5 --gaps` and/or `/gsd-plan-phase 4 --gaps`).

## Deviations from Plan

None so far — Task 1 executed exactly as written; all gates and audits passed on the first run with no source fixes required.

## Known Stubs

None — this plan is verification + a doc artifact only; no code surface, no placeholder data.

## Self-Check: PASSED

- `.planning/phases/05-native-polish/05-UI-REVIEW.md` — FOUND
- Commit `aaa51afd` — FOUND in git log
- Packaged `devtools-app.app` — FOUND; `devtools-app_0.1.0_aarch64.dmg` — FOUND
- `cargo tree --release | grep -c webdriver` = 0 — CONFIRMED
- Tasks 2 (human checkpoint) + 3 (post-approval bookkeeping) — INTENTIONALLY NOT done (awaiting "approved")

---
*Phase: 05-native-polish*
*Status: PAUSED at the human-verify checkpoint — Phase 5 NOT yet closed; Phase 4 sign-off still deferred until the user verifies.*
