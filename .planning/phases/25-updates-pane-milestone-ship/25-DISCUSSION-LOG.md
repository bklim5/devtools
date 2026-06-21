# Phase 25: Updates Pane & Milestone Ship - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-21
**Phase:** 25-updates-pane-milestone-ship
**Areas discussed:** Gating, Milestone sign-off scope, App-version source, Check coordination & result, Last-checked persistence, Auto-check toggle

---

## Gating

| Option | Description | Selected |
|--------|-------------|----------|
| Available to everyone (ungated) | Updates is core infra, not a customization; all users see version + check regardless of license | ✓ |
| Pro-gated like Appearance | Route through the central entitlement gate | |

**User's choice:** Available to everyone (ungated) → D-25-1
**Notes:** Deliberately diverges from Appearance (Pro-gated theming). An update mechanism applies to all users.

---

## Milestone sign-off scope

| Option | Description | Selected |
|--------|-------------|----------|
| Sign-off as the phase's final gate | Full-surface WCAG-AA audit + fresh-build human sign-off + decoder-untouched check as the normal verification/checkpoint; no separate milestone-audit workflow | ✓ |
| Add an explicit milestone-audit step | A dedicated /gsd-audit-milestone pass as a distinct deliverable | |

**User's choice:** Sign-off as the phase's final gate → D-25-11
**Notes:** Roadmap criterion 4 handled as the standard phase verification gate.

---

## App-version source

| Option | Description | Selected |
|--------|-------------|----------|
| platform.app.getVersion() seam | Add getVersion() to the platform/ seam; real = Tauri app getVersion() (tauri.conf.json), browser/stub fallback | ✓ |
| Build-time Vite define | Inject package.json version at build (__APP_VERSION__); no seam change but risks drift | |

**User's choice:** platform.app.getVersion() seam → D-25-2
**Notes:** No webview version getter exists today. Keeps seam discipline (mirrors update.ts).

---

## Check coordination & result

| Option | Description | Selected |
|--------|-------------|----------|
| Shared App state, result in pane + banner | Pane Check reuses App.tsx runCheck; one source of truth; inline pane status + existing UpdateBanner for install | ✓ |
| Pane-local self-contained check | Pane has its own check + Install; duplicates UX, risks divergent state | |

**User's choice:** Shared App state, result in pane + banner → D-25-3, D-25-4, D-25-5
**Notes:** Pane is a second entry point to the same action as the tray; Install defers to the banner (one install affordance).

---

## Last-checked persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Persist timestamp, relative + absolute | New lastUpdateCheck pref (coerced, single-writer); survives restart; relative primary + absolute available; "Never" before first check | ✓ |
| Session-only | In-memory only; "Never checked" each launch | |

**User's choice:** Persist timestamp, relative + absolute → D-25-6, D-25-7
**Notes:** Stamped on every completed check (manual/tray/silent) so the value is entry-point-agnostic.

---

## Auto-check toggle in pane

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — add the toggle | Surface autoUpdateCheck as a discoverable "Automatically check on launch" toggle; null renders off | ✓ |
| No — version + last-checked + Check only | Keep minimal; autoUpdateCheck stays controlled by the first-run prompt | |

**User's choice:** Yes — add the toggle → D-25-8
**Notes:** Reuses the existing autoUpdateCheck pref + setAutoUpdateCheck setter; no new field. Flipping it also satisfies needsOptInPrompt (one-time prompt won't re-appear).

---

## Claude's Discretion

- Pane glyph + placement order among the five panes.
- lastUpdateCheck storage type (epoch ms vs ISO) + relative-time formatter.
- Where the absolute timestamp appears (tooltip vs secondary line).
- Browser/stub fallback value for app.getVersion().
- Internal UpdatesSettings structure + the exact mechanism for sharing runCheck/updateInfo between App.tsx and the pane.
- Exact pane copy strings.

## Deferred Ideas

- Update channels / beta opt-in.
- Rich release-notes / changelog viewer.
- Duplicate Install button in the pane.
- Separate milestone-audit deliverable.
- Build-time version inject as the primary version source.
