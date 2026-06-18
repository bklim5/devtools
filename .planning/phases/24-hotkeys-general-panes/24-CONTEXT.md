# Phase 24: Hotkeys & General Panes (native-touching) - Context

**Gathered:** 2026-06-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Two new panes appended to the existing Settings modal:

- **Hotkeys** — view + rebind (a) the **global summon** chord (Rust global-shortcut re-register with conflict handling — promotes parked NAT-01/G-05-1) and (b) the **⌘K command-palette** chord (in-webview key handler keyed off the configured chord). Both persist via the prefs seam and survive restart.
- **General** — app-behavior toggles: **launch-at-login**, **start-in-tray**, **default tool on open**, **show-license-status-in-sidebar**. Each persists and takes effect.

Launch-at-login pulls in an **autostart plugin** — the single **scoped new-dep exception** of v1.7 (the only webview/native dep added in the milestone), to be recorded in this phase's planning.

Both panes are fully keyboard-reachable, WCAG-AA, mounted as append-only entries in `SETTINGS_PANES` (zero `SettingsModal` shell change). HashRouter only; `decoder.ts` + its 19 tests stay byte-for-byte untouched.

**Out of scope (own phases / deferred):** Updates pane (Phase 25); any settings beyond the four candidate toggles; arbitrary multi-hotkey schemes; deep-link summon (the validated `deepLink` path exists but v1 summon does not call it).
</domain>

<decisions>
## Implementation Decisions

### Rebind capture UX (Hotkeys pane)
- **D-24-1 (capture mechanism):** **Live key-capture field.** Clicking the field enters a "recording" state; the user presses the desired chord and it is captured and shown as the resolved accelerator. **Escape cancels** the capture (no change). Capture reads from **physical `e.code` + modifier flags**, NOT `e.key` — on macOS Option+letter composes to a glyph (e.g. Option+P → "π"), so `e.key` is unreliable for chord capture (see project memory `macos-option-key-composes-letters`). The displayed/persisted form is a Tauri accelerator string (`CommandOrControl+Shift+D` style), with `CommandOrControl` mapping to Cmd on macOS.
- **D-24-2 (conflict / rejection):** **Reject inline, keep the prior binding.** If a chord is invalid or the OS rejects the global re-register (already taken — Pitfall 2 / threat T-05-07), surface a **calm inline message** ("That shortcut is already in use — try another"), keep the **previous working binding active**, and **persist nothing**. No toast, no modal dialog. Matches roadmap success criterion 1.
- **D-24-3 (validation strictness):** **Require a non-shift modifier + block OS-reserved chords.** Reject bare keys / shift-only combos (a chord must include Cmd/Ctrl/Alt). Block a known **OS-reserved list** (at minimum: Cmd+Space / Spotlight, Cmd+Q, Cmd+Tab, screenshot Cmd+Shift+3/4 — extend per RESEARCH). Anything passing client validation is **attempted**; the **OS register-result is the final gate** (failure → D-24-2 reject-inline). The exact reserved-chord list is planner/researcher discretion within this intent.
- **D-24-4 (reset affordance):** **Per-hotkey "reset to default."** Each binding has a small, keyboard-reachable Reset control restoring the shipped default — **summon = `CommandOrControl+Shift+D`** (current `SUMMON_CHORD`), **palette = `CommandOrControl+K`** (current hardcoded ⌘K). Rescues a user who set an awkward chord and forgot the original.

### Summon-chord re-registration (native)
- **D-24-5:** Rebinding the summon chord goes **only through `platform.nativeShortcut`** (`unregister` old → `register` new), never `@tauri-apps/*` directly (seam discipline, FND-04 / T-05-04). The current single-constant `SUMMON_CHORD` in `src/shell/summon.ts` becomes **prefs-driven**: read the persisted chord at startup registration, and on rebind unregister the prior accelerator before registering the new one. Registration failure stays **non-fatal** (caught + logged, never crashes startup — existing contract) and feeds the D-24-2 inline rejection when the failure is user-initiated.

### Palette-chord rebinding (in-webview)
- **D-24-6:** The ⌘K handler in `src/components/CommandPalette.tsx` (currently hardcoded `(e.metaKey||e.ctrlKey) && e.key.toLowerCase()==="k"`) is **keyed off the configured chord** from prefs. In-webview match should likewise compare against the captured chord shape consistently with D-24-1 (physical key + modifier flags) so the configured palette chord and its capture agree. Pure-webview — no native register.

### General toggles (final set — all four ship)
- **D-24-7 (launch-at-login):** Ships. Implemented via the **autostart plugin** routed through the `platform/` seam (no direct `@tauri-apps/*` import in tools/components). This is the **explicit, scoped zero-new-dep exception** — to be named + recorded in PLAN.md (threat-modeled as the one milestone dep).
- **D-24-8 (start-in-tray):** Ships. Launches the app **hidden to the menu-bar tray** instead of opening a window.
- **D-24-9 (launch-at-login + start-in-tray combined):** **Silent background launch.** When both are on, login launches the app hidden to the tray (no window steals focus); the **summon chord or a tray click reveals** the window. The "always-ready, out-of-the-way" flow. Planner must handle the login-launch hidden-window path cleanly (no flash of a window that then hides).
- **D-24-10 (default tool on open):** A **dropdown whose first option is "Last used"** (current SHL-06 behavior, **stays the default**) followed by the individual tools. Backward-compatible: `lastUsedId` / `resolveStartupTool` is only consulted when the setting is "Last used"; otherwise the app opens the fixed picked tool. **No "blank/palette-first" state** (deferred — extra states beyond the candidate scope).
- **D-24-11 (show-license-status-in-sidebar):** Ships. A pure-webview toggle controlling visibility of the license/upgrade affordance in the sidebar. Lowest risk of the four.

### Persistence
- **D-24-12:** All Phase-24 settings persist through the **existing prefs seam** (`Preferences` / `prefsStore` coercers / `usePreferences` single-writer — see project memory `prefs-blob-single-writer`). Add new typed fields (summon chord, palette chord, launch-at-login, start-in-tray, default-tool selection, show-license-in-sidebar) with **field-by-field coercion over defaults** (untrusted-prefs discipline: unknown → safe default; chords coerce to the shipped default on invalid). Defaults preserve today's behavior exactly (summon `Cmd+Shift+D`, palette `Cmd+K`, default-tool "Last used", toggles off unless a sensible default says otherwise — planner decides per-toggle default).

### Claude's / planner's Discretion
- Exact OS-reserved chord blocklist (within D-24-3 intent).
- The autostart plugin choice + its scoped-dep exception write-up in PLAN.md (D-24-7).
- Per-toggle default values (on/off) and the exact accelerator-string ↔ capture normalization helper.
- Internal component structure of the capture field, the toggle rows, and the default-tool dropdown (layout-agnostic, responsive Tailwind).
- Pane glyphs/icons for the two new `SETTINGS_PANES` entries.
- Whether the summon + palette capture share one reusable HotkeyCaptureField component (recommended, not mandated).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements / roadmap
- `.planning/REQUIREMENTS.md` — **SET-08** (Hotkeys pane) + **SET-09** (General pane) + the v1.7 "Architecture (locked)" preamble (the scoped autostart-dep exception is named there).
- `.planning/ROADMAP.md` §"Phase 24: Hotkeys & General Panes" — goal + 5 success criteria + the autostart scoped-exception callout.

### Summon hotkey (native re-register — the core of SET-08a)
- `src/shell/summon.ts` — `SUMMON_CHORD` constant (becomes prefs-driven), `registerSummon()`, the macOS-safe summon order, the non-fatal register-failure contract.
- `src/lib/platform/index.ts` — the `nativeShortcut` seam (`register`/`unregister`/`isRegistered`) + `window` (show/setFocus/unminimize/minimize/isVisible).
- `src/lib/platform/tauri.ts` — the real `plugin-global-shortcut` impl behind the seam (reference only — tools never import it).
- `src/lib/platform/browser.ts` / `stub.ts` — the no-op fallback arms (so unit tests + `vite preview` never touch the OS).

### Palette chord (in-webview — SET-08b)
- `src/components/CommandPalette.tsx` §line ~187 — the hardcoded ⌘K keydown handler to make chord-configurable.

### General toggles + startup behavior (SET-09)
- `src/shell/resolveStartupTool.ts` + `src/shell/useTrackActiveTool.ts` — the existing opens-to-last logic the "default tool" dropdown layers over (D-24-10).
- `src/lib/tools/registry.ts` — `ENABLED_TOOLS` (the tool list the default-tool dropdown enumerates; validate selections against it).
- `src/components/Sidebar.tsx` — hosts the license-status affordance toggled by D-24-11.

### Persistence seam (all settings)
- `src/shell/preferences.ts` — `Preferences`, `DEFAULT_PREFERENCES`, `ThemeName` (add the new fields here).
- `src/shell/prefsStore.ts` — coercers + `mergePreferences` (add field-by-field coercion for the new fields; invalid chord → shipped default).
- `src/shell/usePreferences.ts` — the single-writer setters + async-load contract (route every write here; see memory `prefs-blob-single-writer` + `tauri-store-async-init-race`).

### Settings modal host (append-only)
- `src/components/settingsPanes.tsx` — the `SETTINGS_PANES` registry (append Hotkeys + General entries; nav + content derive 1:1, no shell change — D-23-10 pattern).
- `src/components/SettingsModal.tsx` — modal shell (no change expected).
- `src/components/SegmentedControl.tsx` — shared control (candidate for the default-tool / toggle UI; reuse if it fits).

### Prior context (patterns + locked decisions)
- `.planning/phases/22-settings-modal-shell/22-CONTEXT.md` (+ `22-UI-SPEC.md`) — the modal shell + pane-registry pattern + the native menu/tray `platform/` event seam (`onOpenSettings`).
- `.planning/phases/23-appearance-pane/23-CONTEXT.md` — the most recent pane-append precedent (D-23-10/11 registry + prefs-seam reuse, WCAG-AA-in-both-themes bar).
- `docs/harness-and-decisions.md` — locked harness + decisions (authoritative on conflicts).
- `design/DevTools Mockup.html` — canonical visual system (the mockup's "Keyboard" nav label is illustrative; the real pane is "Hotkeys").

### Project memory (gotchas that bite this phase)
- `macos-option-key-composes-letters` — capture on physical `e.code`, not `e.key` (D-24-1); e2e must dispatch the composed key shape.
- `prefs-blob-single-writer` + `tauri-store-async-init-race` — route every prefs write through the `usePreferences` singleton; verify persistence on the real WKWebView.
- `tauri-native-dragdrop-blocks-html5-dnd` — unrelated to this phase but a reminder the platform seam has live native side-effects to verify in-WKWebView.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`platform.nativeShortcut`** (`register`/`unregister`/`isRegistered`) — the rebind primitive already exists end-to-end (real impl + no-op fallbacks + unit-tested). Summon rebind is "unregister old → register new" through this seam; no new native surface.
- **`SUMMON_CHORD` + `registerSummon()`** (`summon.ts`) — single-constant chord + non-fatal register-failure contract already built; this phase makes the constant prefs-driven and adds the unregister-prior step.
- **prefs seam** (`preferences.ts`/`prefsStore.ts`/`usePreferences.ts`) — single-writer, field-by-field coerced, async-load-safe. New fields are additive edits; coercers enforce the untrusted-input discipline (invalid chord → default).
- **`SETTINGS_PANES`** (`settingsPanes.tsx`) — append-only registry; Hotkeys + General are two entries, zero `SettingsModal` change (D-23-10 precedent).
- **`resolveStartupTool` / `useTrackActiveTool`** — the opens-to-last machinery the default-tool dropdown layers over (consult `lastUsedId` only when "Last used" selected).
- **`platform.window`** (show/setFocus/unminimize/minimize/isVisible) — the surface for start-in-tray reveal + the silent-background reveal-on-summon flow.

### Established Patterns
- **Registry is the single control plane** — Settings nav/content derive from `SETTINGS_PANES`; nothing imports `@tauri-apps/*` directly (all OS access via `platform/`).
- **Untrusted-prefs coercion** — every stored field merged over defaults; new chord/toggle fields must follow (unknown/invalid → safe default).
- **Non-fatal native failures** — a taken/denied global shortcut must never crash startup; it degrades + logs (existing `registerSummon` contract), and for user-initiated rebinds surfaces as the inline rejection.

### Integration Points
- `src/shell/summon.ts` — read persisted summon chord at registration; add the rebind (unregister→register) entry point.
- `src/components/CommandPalette.tsx` (~L187) — swap the hardcoded ⌘K test for the configured chord.
- `src/components/settingsPanes.tsx` — append the two pane entries.
- `src/shell/preferences.ts` / `prefsStore.ts` / `usePreferences.ts` — add + coerce + expose the new fields.
- Rust `src-tauri/src/lib.rs` — autostart plugin registration (launch-at-login) + any tray/start-hidden wiring, surfaced to the webview through the `platform/` seam.
</code_context>

<specifics>
## Specific Ideas

- Hotkeys pane should show **both bindings** (summon + palette) each as: label · current chord · live-capture affordance · per-hotkey Reset.
- Capture displays the resolved Tauri accelerator (`Cmd+Shift+D` form), captured from physical `e.code` + modifier flags so Option-composed glyphs don't corrupt the chord.
- Default-tool dropdown: first item literally **"Last used"** (keeps today's behavior as the default), then each enabled tool.
- The mockup's nav label is "Keyboard"; the shipped pane is **"Hotkeys"** (roadmap naming).
</specifics>

<deferred>
## Deferred Ideas

- **Curated-dropdown / typed-string chord entry** — considered and rejected in favor of live key-capture (D-24-1).
- **"Warn but allow override" on a taken chord** — rejected; a silently dead summon hotkey is worse than reject-inline (D-24-2).
- **"Blank / palette-first / always-ask" startup state** — beyond the candidate scope; default-tool stays a "Last used | specific tool" dropdown (D-24-10).
- **Deep-link summon** (summon to a specific tool) — the validated `deepLink` path exists in `summon.ts` but v1 summon does not call it; out of scope here.
- **Multi-hotkey / per-tool global shortcuts** — only the two named bindings (summon + palette) are in scope.

### Reviewed Todos (not folded)
- 2 pending todos exist project-wide; the phase-24 matcher returned **no matches** — none relevant to this phase's scope.

</deferred>

---

*Phase: 24-hotkeys-general-panes*
*Context gathered: 2026-06-18*
