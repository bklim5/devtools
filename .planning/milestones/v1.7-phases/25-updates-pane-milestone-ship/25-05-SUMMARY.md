---
phase: 25-updates-pane-milestone-ship
plan: 05
subsystem: updates-milestone-signoff
tags: [updates, milestone-signoff, wcag-audit, ship-gate]
requirements: [SET-10]
key-files:
  created:
    - .planning/phases/25-updates-pane-milestone-ship/25-UI-REVIEW.md
  modified:
    - src/shell/useUpdater.ts
    - src/shell/usePreferences.ts
    - src/shell/prefsStore.ts
    - src/components/UpdatesSettings.tsx
    - test/e2e/settings.e2e.ts
metrics:
  vitest: "1200/1200"
  e2e_spec_files: "24/24"
  ui_review: "PASS 23/24 (no blocking)"
---

# Plan 25-05 — v1.7 milestone-close sign-off (D-25-11)

The phase's final gate. All automated gates green, a five-pane WCAG-AA audit recorded,
a fresh non-stale `tauri build`, decoder proven byte-for-byte untouched across the
phase's committed history, and a human sign-off on the real build — **including a
checkpoint scope change (D-25-5 revised): the Updates pane now offers Install.**

## Gate results

| Gate | Result |
|---|---|
| `/simplify` (4 angles) | Clean — no edits (findings defensible / pre-existing / out of diff) |
| `/code-review xhigh` (9 angles) | 1 confirmed finding fixed (stale updater status → contradictory toast) |
| `/codex:adversarial-review` | 1 HIGH fixed (updater stamp could clobber real prefs after a failed read) |
| vitest | **1200/1200** (+ new install + no-clobber + clean-baseline regressions) |
| tsc + eslint | clean (2 pre-existing SidebarResetMenu warnings, out of scope) |
| Decoder untouched | `git diff --exit-code 9ee48366..HEAD -- decoder.ts decoder.test.ts` → **exit 0** |
| Decoder 19 tests | green |
| Real-WKWebView e2e | **24/24 spec files** via `scripts/e2e-spike.sh` (fixed a latent async-read bug in the new Updates spec) |
| `gsd-ui-review` WCAG-AA | **PASS 23/24**, no blocking findings → `25-UI-REVIEW.md` |
| Fresh `tauri build` | TinkerDev.app + DMG (0.4.0), mtime-verified newer than the last source commit |

## Checkpoint scope change — D-25-5 revised (Install in the pane)

At the human walkthrough the user asked why install wasn't offered from the Updates
pane. D-25-5's original "one install affordance" rationale was weakened by this phase's
own `useUpdater` singleton (D-25-3): install state is already ONE shared source, so a
pane button is a second entry point to the SAME `install()` — exactly like Check.
Implemented:
- `UpdatesSettings.tsx` — an Install button shown only when an update is detected,
  wired to the shared `install()`; `aria-disabled` + label/progress while installing
  (never opacity-only); the bottom-right `UpdateBanner` stays as the ambient affordance.
- `useUpdater.ts` — `installPendingUpdate` gained an in-flight de-dupe guard (mirrors
  `runUpdateCheck`): two on-screen install affordances can't double-trigger the download.
- Unit + real-WKWebView e2e cover the button (render-only-on-detection, shared wiring,
  keyboard-focusable on WKWebView) and the install de-dupe.

## Code-review / adversarial fixes folded in

- **clear stale updater status at the start of each check** (`75182261`) — a re-check
  that detects an update no longer leaves a contradictory "You're up to date" toast.
- **gate the updater stamp on a successful prefs load** (`5351f47e`) — `loadPreferencesResult`
  surfaces load-ok vs fail-soft default; the `lastUpdateCheck` stamp is skipped on a
  degraded read so a transient read failure can never persist defaults over the real blob.
- **await the async aria-checked flip in the Updates-pane e2e** (`e4715462`) — the
  toggle spec read aria-checked synchronously after click; now waits for the flip.

## Human sign-off

User approved on the fresh build (2026-06-21):
- Five-pane Settings surface (General, Hotkeys, Appearance, License, Updates) renders
  and works from every entry point; lands on General for generic openers.
- Updates pane: version line, "Last checked" Never→relative, Check result, keyboard-
  operable auto-check toggle, persistence across a real quit/relaunch (no prefs clobber).
- Update-available path validated against the LIVE endpoint via a throwaway 0.3.9 build:
  Check → "Version 0.4.0 available" → pane **Install** button → real download → minisign-
  verify → relaunch into the genuine published 0.4.0. (The published 0.4.0 predates the
  pane, which correctly disappears post-install — proving the real artifact was fetched;
  the pane ships with 0.4.1+.)

→ **SET-10 Validated; v1.7 Settings milestone signed off.**

## Commits (Plan 05 gate cycle)

| Commit | Description |
|---|---|
| `75182261` | fix(25): clear stale updater status at the start of each check |
| `5351f47e` | fix(25): gate the updater stamp on a successful prefs load (no clobber) |
| `e4715462` | fix(25): await the async aria-checked flip in the Updates-pane e2e |
| `6ace1cff` | docs(25): five-pane Settings WCAG-AA audit (PASS 23/24) |
| `6c72adb4` | feat(25): add Install button to the Updates pane (D-25-5 revised) |

## Deviations

- **D-25-5 revised** (above) — Install added to the pane per the user's checkpoint
  decision; the original plan said the pane shows status only. Recorded as an intended
  scope change, not a defect.
- The `0.3.9` test bundle was a throwaway to exercise the live update-available path;
  `tauri.conf.json` stayed at `0.4.0` in the committed source.

## Self-Check: PASSED

- decoder.ts + its 19 tests byte-for-byte untouched across `9ee48366..HEAD`.
- Full suite 1200/1200; tsc + eslint clean; real-WKWebView e2e 24/24.
- Five-pane WCAG-AA audit PASS, no blocking findings.
- Fresh, mtime-verified non-stale 0.4.0 build.
- Human approved.
