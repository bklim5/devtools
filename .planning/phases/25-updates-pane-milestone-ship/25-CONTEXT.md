# Phase 25: Updates Pane & Milestone Ship - Context

**Gathered:** 2026-06-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Two deliverables:

1. **Updates pane** — a new pane appended to the existing Settings modal that:
   - shows the **current app version** and the **last-checked time**,
   - offers a **Check-for-updates action** that reuses the existing updater seam (`platform.updater` via `src/shell/update.ts`) — mirroring the tray's `menu://check-updates` action,
   - **surfaces the result in the pane** (up-to-date / update available / error),
   - is **available to every user (ungated)** — Updates is core infra, NOT a Pro customization (unlike Appearance).
   - is keyboard-reachable, WCAG-AA in both themes, consistent with the other panes.

2. **v1.7 milestone-close sign-off** — the full Settings surface (all five panes: General, Hotkeys, Appearance, License, Updates; every entry point) passes a `gsd-ui-review` WCAG-AA audit and a **human sign-off on a fresh `tauri build`**, with `decoder.ts` + its 19 tests **byte-for-byte untouched**. This sign-off is the phase's normal final verification/checkpoint gate (no separate milestone-audit workflow).

Mounted as an **append-only** entry in `SETTINGS_PANES` (zero `SettingsModal` shell change). HashRouter only. `decoder.ts` + its 19 tests stay byte-for-byte untouched.

**Out of scope (deferred):** any update-channel/beta selection; release-notes rendering beyond what `UpdateInfo.notes` already carries; a separate milestone-audit deliverable; changes to the install/verify flow itself (the existing `installUpdate` + minisign verify is reused as-is).
</domain>

<decisions>
## Implementation Decisions

### Gating
- **D-25-1 (ungated):** The Updates pane is **available to everyone** — no entitlement gate. Version display, last-checked, the auto-check toggle, and the Check action all work for free and Pro users alike. (Contrast: Appearance is Pro-gated via `gatePreferences`; Updates is deliberately NOT.)

### App-version source
- **D-25-2:** Add an **`app.getVersion()` method to the `platform/` seam** (`src/lib/platform/`). Real impl (`tauri.ts`) reads Tauri's app `getVersion()` — single source of truth = `tauri.conf.json` (`0.4.0`), always correct in the packaged app. Browser/jsdom + stub arms return a safe build-time/fallback value so unit tests and `vite preview` never touch native. The pane reads the version through this seam, **never** importing `@tauri-apps/*` directly (seam discipline, mirrors `update.ts`). No webview version getter exists today — this is a new, tiny seam surface.

### Check coordination & result surfacing
- **D-25-3 (shared state, single source of truth):** The pane's **Check-for-updates** runs the **same check path** App.tsx already uses for the tray action (`runCheck` → `checkForUpdate()` from `src/shell/update.ts`). Lift/share that flow so the pane and the tray/banner agree — no second, divergent check state machine. The pane is a **second entry point to the same action**, exactly mirroring the tray (roadmap criterion 2).
- **D-25-4 (result IN the pane):** The check result surfaces **inline in the pane** as a clear status: **up-to-date** ("You're on the latest version"), **update available** (the detected version), or **error** ("Update check failed"). A "checking…" in-flight state is shown without an opacity-only signal (WCAG-AA discipline). This satisfies roadmap criterion 2 ("the result … surfaces in the pane").
- **D-25-5 (Install defers to the banner):** When a check finds an update, the pane shows "vX available" status; the **actual Install/verify/relaunch is handled by the existing `UpdateBanner`** (App.tsx mounts it on detection — `setUpdateInfo`). The pane does **not** duplicate the Install UI. This keeps one install affordance (the verify-before-apply flow in `installUpdate`) and avoids divergent install state.

### Last-checked persistence
- **D-25-6:** Add a **`lastUpdateCheck` timestamp field** to `Preferences` (epoch ms or ISO; planner's choice), written through the **single-writer prefs seam** (`usePreferences`) and **coerced field-by-field over defaults** (untrusted-prefs discipline: unknown/invalid → "never"). It is **stamped on every completed check** (manual pane check, tray check, and the silent launch check — wherever `runCheck` resolves), so the displayed value is accurate regardless of entry point. Survives restart.
- **D-25-7 (display format):** Show **relative time** ("2 hours ago", "just now") as the primary readout, with the **absolute timestamp** available (title/tooltip or a secondary line — planner discretion). Before the first-ever check, show **"Never"** (the `lastUpdateCheck` default).

### Auto-check toggle in the pane
- **D-25-8:** The pane surfaces the existing **`autoUpdateCheck`** pref as a discoverable, keyboard-reachable **"Automatically check for updates on launch"** toggle (today it is only settable via the one-time first-run `UpdateOptIn` prompt). Bound to the existing `setAutoUpdateCheck` setter. The tri-state pref (`null` = never asked) renders as **off** in the toggle; flipping it writes `true`/`false` (which also satisfies `needsOptInPrompt` so the one-time prompt won't re-appear). No new pref field — reuses `autoUpdateCheck`.

### Pane registry + persistence
- **D-25-9:** Append **one** entry to `SETTINGS_PANES` (`src/components/settingsPanes.tsx`): `{ id: "updates", label: "Updates", icon: <download/refresh glyph>, render: () => <UpdatesSettings/> }`. **No `SettingsModal` shell change** — nav + content derive 1:1 from the array (D-23-10 / Phase 24 precedent). Pane order/placement among the five is planner discretion (consistent with the existing General-first landing-pane rule).
- **D-25-10:** All new persisted state (`lastUpdateCheck`) and the reused `autoUpdateCheck` go through `preferences.ts` (field + default) / `prefsStore.ts` (coercer + merge) / `usePreferences.ts` (setter) — the established single-writer, async-load-safe, coerced pattern. Defaults preserve today's behavior (no auto-check until opted in; last-checked = "Never").

### Milestone-close sign-off (deliverable 2)
- **D-25-11:** The phase's **final gate** is: (a) a `gsd-ui-review` WCAG-AA audit over the **full five-pane Settings surface** and every entry point, (b) a **human sign-off on a fresh `tauri build`** (.app/.dmg under `src-tauri/target/release/bundle/macos/`), built as the LAST step after all source changes land, and (c) verification that **`decoder.ts` + its 19 tests are byte-for-byte untouched**. Treated as the phase's standard verification checkpoint — no separate milestone-audit workflow deliverable.

### Claude's / planner's Discretion
- The exact pane glyph (download/refresh-style lucide icon) and its placement order among the five panes.
- `lastUpdateCheck` storage type (epoch ms vs ISO) and the exact relative-time formatter (reuse an existing helper if present; otherwise a tiny local one).
- Where the absolute timestamp appears (tooltip vs secondary line).
- The browser/stub fallback return value for `app.getVersion()` (a constant or a build-time inject).
- Internal component structure of `UpdatesSettings` (layout-agnostic, responsive Tailwind), and how `runCheck`/`updateInfo`/status are shared between App.tsx and the pane (lift to a hook/context vs prop/store — keep one source of truth).
- Exact pane copy strings.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements / roadmap
- `.planning/REQUIREMENTS.md` — **SET-10** (the Updates pane requirement) + the v1.7 "Architecture (locked)" preamble.
- `.planning/ROADMAP.md` §"Phase 25: Updates Pane & Milestone Ship" — goal + 4 success criteria (criterion 4 is the milestone-close sign-off).

### Updater seam (the core reuse target)
- `src/shell/update.ts` — `checkForUpdate()` (error-as-value), `installUpdate()` (verify-before-apply, propagates), `shouldAutoCheck()` / `needsOptInPrompt()` (the tri-state `autoUpdateCheck` predicates). The pane's Check reuses `checkForUpdate`.
- `src/App.tsx` — owns the current check→banner state machine: `runCheck(manual)`, `updateInfo`/`status`/`progress` state, the `onMenuCheckUpdates` tray listener (~L102), the `UpdateOptIn` first-run prompt, and the `UpdateBanner` mount on detection (~L240). The pane shares this flow (D-25-3/D-25-5).
- `src/components/UpdateBanner.tsx` — the existing controlled, WCAG-AA Install/Later banner the pane defers Install to (D-25-5).
- `src/lib/platform/index.ts` — the seam: `updater.check`/`downloadAndInstall`, `events.onMenuCheckUpdates`, `UpdateInfo` type. **Add `app.getVersion()` here** (D-25-2).
- `src/lib/platform/tauri.ts` — real updater + (new) app-version impl behind the seam (reference; tools never import it).
- `src/lib/platform/browser.ts` / `stub.ts` — no-op fallback arms (check→null, no network); add the `getVersion` fallback here.

### Version source (display)
- `src-tauri/tauri.conf.json` §`version` (`0.4.0`) — the packaged app version Tauri's `getVersion()` returns (single source of truth).
- `package.json` §`version` (`0.4.0`) — kept in lockstep; only relevant if a build-time inject is ever used for the fallback arm.

### Persistence seam (lastUpdateCheck + autoUpdateCheck)
- `src/shell/preferences.ts` — `Preferences`, `DEFAULT_PREFERENCES`, the existing `autoUpdateCheck: boolean | null` field (~L44/L95); add `lastUpdateCheck` here.
- `src/shell/prefsStore.ts` — `coerceAutoUpdateCheck` (~L43) + `mergePreferences`; add a `lastUpdateCheck` coercer.
- `src/shell/usePreferences.ts` — single-writer setters incl. `setAutoUpdateCheck` (~L214); add a `lastUpdateCheck` setter. Route every write here (memory `prefs-blob-single-writer` + `tauri-store-async-init-race`).

### Settings modal host (append-only)
- `src/components/settingsPanes.tsx` — the `SETTINGS_PANES` registry (append the Updates entry; nav + content derive 1:1, no shell change — D-23-10).
- `src/components/SettingsModal.tsx` — modal shell (no change expected).
- `src/components/AppearanceSettings.tsx` / `GeneralSettings.tsx` / `HotkeysSettings.tsx` — sibling pane components to mirror for layout/structure/copy conventions.

### Prior context (patterns + locked decisions)
- `.planning/phases/24-hotkeys-general-panes/24-CONTEXT.md` — most recent pane-append + prefs-seam-extension precedent (toggle rows, coercion discipline, append-only registry).
- `.planning/phases/23-appearance-pane/23-CONTEXT.md` — pane-append + WCAG-AA-in-both-themes bar; D-23-10/11 registry + prefs reuse.
- `.planning/phases/22-settings-modal-shell/22-CONTEXT.md` (+ `22-UI-SPEC.md`) — the modal shell + pane-registry pattern + the `platform/` menu/tray event seam (`onMenuCheckUpdates` lives in this family).
- `docs/harness-and-decisions.md` — locked harness + decisions (authoritative on conflicts); the DST-02 updater decisions (D-09..D-13).
- `design/DevTools Mockup.html` — canonical visual system (the mockup's nav labels are illustrative; the shipped pane is "Updates").

### Project memory (gotchas that bite this phase)
- `prefs-blob-single-writer` — route every `lastUpdateCheck`/`autoUpdateCheck` write through the `usePreferences` singleton; a second writer clobbers.
- `tauri-store-async-init-race` — reads before `initPlatform()` resolves hit localStorage not prefs.json; verify last-checked + toggle persistence on the **real WKWebView**, not just unit tests.
- `verify-gate-builds-real-app` + `auto-build-at-phase-boundary` — the milestone sign-off (D-25-11) requires the real-WKWebView e2e gate and the agent-run `pnpm tauri build` at the checkpoint.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/shell/update.ts`** — the entire check/install flow already exists end-to-end through the seam (error-as-value check, verify-before-apply install, tri-state opt-in predicates). The pane reuses `checkForUpdate` verbatim; nothing new in the updater logic.
- **App.tsx `runCheck` + updater overlay** — the manual-check path (tray) the pane mirrors; `updateInfo`/`status`/`progress` + `UpdateBanner` mount already handle the "update available → install" half (D-25-3/D-25-5).
- **`UpdateBanner`** — controlled, WCAG-AA, layout-agnostic Install/Later UI; reused as the install affordance so the pane needn't build one.
- **prefs seam** (`preferences.ts`/`prefsStore.ts`/`usePreferences.ts`) — `autoUpdateCheck` field + coercer + `setAutoUpdateCheck` setter already exist (reused for D-25-8); `lastUpdateCheck` is an additive field following the same coerced single-writer pattern.
- **`SETTINGS_PANES`** (`settingsPanes.tsx`) — append-only registry; Updates is one entry, zero `SettingsModal` change.
- **Sibling pane components** (`GeneralSettings`/`AppearanceSettings`/`HotkeysSettings`) — established pane layout/copy/toggle conventions to mirror.

### Established Patterns
- **Registry is the single control plane** — Settings nav/content derive from `SETTINGS_PANES`; nothing imports `@tauri-apps/*` directly (all OS + app metadata via `platform/`). The new `app.getVersion()` keeps that discipline.
- **Error-as-value at the seam boundary** — a failed check is a typed result, never a throw; the pane renders the `error` kind, never try/catches a crash.
- **Untrusted-prefs coercion** — every stored field merged over defaults; `lastUpdateCheck` must coerce unknown/invalid → "never".
- **No-flash async load** — `usePreferences` returns defaults until the store resolves; the pane must tolerate the pre-load default (last-checked "Never", toggle off) without flicker.
- **One install affordance** — install lives only in the banner (verify-before-apply); the pane links to it rather than duplicating it.

### Integration Points
- `src/lib/platform/index.ts` (+ `tauri.ts`/`browser.ts`/`stub.ts`) — add `app.getVersion()` to the seam + its three arms.
- `src/App.tsx` — share `runCheck`/`updateInfo`/`status` with the pane (lift to a hook/context or store; one source of truth) and stamp `lastUpdateCheck` when a check resolves.
- `src/components/settingsPanes.tsx` — append the Updates pane entry.
- `src/components/UpdatesSettings.tsx` (NEW) — the pane component.
- `src/shell/preferences.ts` / `prefsStore.ts` / `usePreferences.ts` — add + coerce + expose `lastUpdateCheck`.
</code_context>

<specifics>
## Specific Ideas

- The Updates pane is a **second entry point to the exact same action** as the tray "Check for Updates…" — same `runCheck`, same banner on detection. Don't fork the updater state.
- Pane readout direction: a version line ("TinkerDev vX.Y.Z" or "Version X.Y.Z"), a "Last checked: 2 hours ago" line (absolute on hover), a "Check for updates" button with inline up-to-date/available/error/checking status, and an "Automatically check for updates on launch" toggle.
- Install stays in the existing `UpdateBanner` — the pane reports "update available" and the banner does the verify-then-relaunch.
- "Never" is the correct pre-first-check last-checked readout (tri-state-friendly, matches the `autoUpdateCheck` null semantics).
</specifics>

<deferred>
## Deferred Ideas

- **Update channels / beta opt-in** — single stable channel only; no channel selector.
- **Rich release-notes rendering** — beyond the plain `UpdateInfo.notes` the banner already shows; no markdown/changelog viewer in the pane.
- **A duplicate Install button in the pane** — rejected (D-25-5); one install affordance (the banner) avoids divergent verify/relaunch state.
- **A separate milestone-audit deliverable** — the milestone-close sign-off is the phase's standard final gate (D-25-11), not an extra workflow artifact.
- **Build-time version inject as the primary source** — rejected for the real app in favor of the seam getter (D-25-2); a build-time constant is only a candidate for the browser/stub fallback arm.

### Reviewed Todos (not folded)
- 2 pending todos exist project-wide; the phase-25 matcher returned **no matches** — none relevant to this phase's scope.

</deferred>

---

*Phase: 25-updates-pane-milestone-ship*
*Context gathered: 2026-06-21*
