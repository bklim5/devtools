---
phase: 25-updates-pane-milestone-ship
verified: 2026-06-21T21:35:00Z
status: passed
score: 3/3 roadmap success criteria verified (+ revised D-25-5 Install; all 5 plan must_have sets verified)
overrides_applied: 0
notes:
  - "Plan 04 truth 'Install is NOT duplicated in the pane' was intentionally superseded by D-25-5 (revised) at the human checkpoint — the pane now offers Install as a second entry point to the shared install(). Recorded as an intended scope change in 25-05-SUMMARY, not a defect."
  - "Bundle freshness: TinkerDev.app binary mtime 2026-06-21 22:21 is NEWER than the last WEBVIEW source commit 6c72adb4 (Install button, 21:59). A later test-only commit 1874dad9 (22:30, src/router.test.tsx) lands after the build but does not ship in the bundle — not a stale-app problem."
---

# Phase 25: Updates Pane + Milestone Ship — Verification Report

**Phase Goal:** A user can see version + update status and check for updates from inside Settings, and the whole Settings milestone passes its sign-off on a real build.
**Verified:** 2026-06-21T21:35:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The Updates pane shows the current app version and the last-checked time | ✓ VERIFIED | `UpdatesSettings.tsx:68-77` reads `platform.app.getVersion()` on mount (seam, never `@tauri-apps/*`); `:108` renders `TinkerDev v{version}`. `:82-88` renders `preferences.lastUpdateCheck` → "Never" when null else `relativeTime()` with absolute on `title=`. Seam impl: `tauri.ts:170 getVersion: () => getVersion()` (from `@tauri-apps/api/app`). |
| 2 | Check-for-updates action reuses the updater seam (mirrors the tray) and surfaces result in the pane | ✓ VERIFIED | Pane button `:119 onClick={() => void runCheck(true)}` calls `useUpdater().runCheck`. Tray `menu://check-updates` event also routes through the SAME action: `App.tsx:109 onMenuCheckUpdates(() => void runCheck(true))`. Both are second entry points to the one `runUpdateCheck` singleton (`useUpdater.ts:93`, in-flight de-dupe). Result surfaces in pane via `role="status" aria-live="polite"` region `:138` fed by `resultLine(checking, updateInfo, status)` (up-to-date / "Version X available" / failed). |
| 3 | The pane is keyboard-reachable and WCAG-AA, consistent with other panes | ✓ VERIFIED | `25-UI-REVIEW.md` five-pane WCAG-AA audit: **PASS 23/24, no blocking findings**. Pane reached via registry-driven keyboard pane-nav (`settingsPanes.tsx:57-64` append-only, modal derives 1:1). Visible focus rings (`focus-visible:ring-accent` on Check `:123` + Install `:155`), `role=switch` toggle (SettingToggle), polite live region, no opacity-only/hover-only signals. e2e `settings.e2e.ts:484` exercises the pane on the real WKWebView. |

**Score:** 3/3 roadmap success criteria verified.

### Scope Change (D-25-5 revised) — Install button in the pane

| Item | Status | Evidence |
|------|--------|----------|
| Pane offers Install as a 2nd entry point to the shared `install()` | ✓ VERIFIED | `UpdatesSettings.tsx:147-162` renders an Install button only when `updateInfo` is present, `onClick={() => void install()}` → `useUpdater().install` → `installPendingUpdate` (`useUpdater.ts:136`) — the SAME action the bottom-right UpdateBanner uses. `installInFlight` de-dupe guard (`:48,137`) prevents banner+pane double-trigger. `aria-disabled` + label/progress while installing (never opacity-only). Documented intentional change in `25-05-SUMMARY.md`; supersedes Plan 04 truth "Install is NOT duplicated". |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/UpdatesSettings.tsx` | version/last-checked/Check+result/toggle/Install | ✓ VERIFIED | 174 lines, substantive, wired, imported by `settingsPanes.tsx:29,63`. |
| `src/components/settingsPanes.tsx` | append-only `id: "updates"` entry | ✓ VERIFIED | `:57-64` ungated, imports neither entitlements nor gating. |
| `src/shell/useUpdater.ts` | shared singleton + in-flight de-dupe + load-safe stamp | ✓ VERIFIED | 244 lines; consumed by `App.tsx:77` (tray + silent launch) and the pane. |
| `src/shell/usePreferences.ts` | `setLastUpdateCheck` + `whenPreferencesLoaded` + `getPreferencesLoadOk` | ✓ VERIFIED | All present (`:119,259,81`). Single-writer `updatePreferences`. |
| `src/shell/prefsStore.ts` | `coerceLastUpdateCheck` + merge | ✓ VERIFIED | `:50,192`. |
| `src/shell/preferences.ts` | `lastUpdateCheck` field + default null | ✓ VERIFIED | `:52,101`. |
| `src/lib/platform/index.ts` + `tauri.ts` | `app.getVersion()` seam | ✓ VERIFIED | interface `index.ts:164`; real arm `tauri.ts:170`; browser fallback present. |
| `25-UI-REVIEW.md` | five-pane WCAG-AA audit | ✓ VERIFIED | PASS 23/24, no blocking. |
| `25-05-SUMMARY.md` | milestone sign-off record | ✓ VERIFIED | Human approved 2026-06-21, incl. real update-available + Install round-trip. |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| UpdatesSettings | `platform.app.getVersion()` | mount read, never `@tauri-apps` | ✓ WIRED |
| UpdatesSettings Check | `useUpdater().runCheck(true)` | shared check | ✓ WIRED |
| App.tsx tray listener | `runCheck(true)` | `menu://check-updates` → same singleton (mirrors tray) | ✓ WIRED |
| UpdatesSettings Install | `useUpdater().install` → `installPendingUpdate` | shared install (D-25-5) | ✓ WIRED |
| UpdatesSettings toggle | `setAutoUpdateCheck` | reuses existing pref | ✓ WIRED |
| useUpdater stamp | `updatePreferences({ lastUpdateCheck })` | AFTER `whenPreferencesLoaded()` + `getPreferencesLoadOk()` gate (load-safe) | ✓ WIRED |
| App.tsx | NO direct `checkForUpdate`/`installUpdate` import | all routes via `useUpdater` | ✓ WIRED |
| decoder.ts + 19 tests | D-25-11 byte-for-byte gate | `git diff --exit-code 9ee48366..HEAD` | ✓ exit 0 (untouched) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Decoder 19 tests green | `vitest run src/lib/protobuf` | 19 passed | ✓ PASS |
| Updates pane + useUpdater units | `vitest run UpdatesSettings.test useUpdater.test` | 19 passed | ✓ PASS |
| TypeScript clean | `tsc --noEmit` | exit 0 | ✓ PASS |
| Decoder untouched (committed history) | `git diff --exit-code 9ee48366..HEAD -- decoder.ts decoder.test.ts` | exit 0 | ✓ PASS |
| Fresh build exists (non-stale) | `ls .../bundle/macos/TinkerDev.app` + mtime | TinkerDev.app + DMG 0.4.0, binary mtime 22:21 > last webview commit 21:59 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SET-10 | 25-01..05 | Updates pane shows version + last-checked + Check reusing the updater seam (mirrors tray) | ✓ SATISFIED | All 3 SCs + scope-revision verified above; human signed off. **Note:** REQUIREMENTS.md line 67 checkbox + line 122 status table still read "Pending" — update to Validated/checked to close traceability. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| UpdatesSettings.tsx | 33 | `function resultLine(... ): string \| null` returns null | ℹ️ Info | Intentional idle state (no result line), not a stub. |
| UpdatesSettings.tsx | 68 | `useState<string \| null>(null)` initial null | ℹ️ Info | Version placeholder dash until `getVersion()` resolves; populated by mount effect — not a stub. |

No blocker or warning anti-patterns. No TODO/FIXME/placeholder copy in the phase files.

### Gaps Summary

None. All three ROADMAP success criteria are met in the actual codebase, the revised D-25-5 Install scope change is implemented and wired to the shared seam, the full five-pane surface passed a WCAG-AA audit with no blocking findings, decoder.ts + its 19 tests are byte-for-byte untouched across the phase's committed history (9ee48366..HEAD, exit 0), and a fresh non-stale 0.4.0 build was human-approved including a real update-available + Install round-trip.

Two non-blocking housekeeping notes (do not affect goal achievement):
1. **REQUIREMENTS.md traceability stale** — SET-10 still shows "Pending" (line 67 checkbox unchecked; line 122 table "Pending") despite the summary recording it Validated. Flip to Validated to close the loop.
2. **Build-vs-commit ordering** — a test-only commit (`1874dad9`, `src/router.test.tsx`, 22:30) landed after the 22:21 build. Test files do not ship in the bundle, so the handed-off `.app` is not stale; noted for completeness only.

---

_Verified: 2026-06-21T21:35:00Z_
_Verifier: Claude (gsd-verifier)_
