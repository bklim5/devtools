# DevTools Handoff Bundle

Everything Claude Code needs to take the DevTools project from "plan + verified core" to a shipped v1.

## What's in here

| Path | Purpose |
|---|---|
| `CLAUDE.md` | **The agent-facing entry point.** Claude Code reads this first. |
| `README.md` | This file — orientation for you, the human. |
| `docs/design-and-plan.md` | The full spec: decisions, milestones, constraints, open questions. |
| `design/` | Canonical UI design from Claude Design (HTML + JSX). Reference only. |
| `scaffold/` | Verified starter code. `scaffold/src/lib/` is production-ready. |

## How to hand off

1. Extract this bundle to a working directory (or commit to a fresh repo).
2. Open Claude Code in that directory:
   - From the terminal: `cd path/to/devtools-handoff && claude`
   - From your IDE: open the directory in the Claude Code extension
3. Claude Code will read `CLAUDE.md` automatically and propose a Phase 0 plan.
4. **Be ready to answer four blocking questions** (listed at the bottom of `CLAUDE.md`) before Phase 0 starts:
   - Linux as a v1 target?
   - Accessibility floor for v1?
   - Self-hosted fonts confirmation?
   - Default tree style: `rows` or `cards`?

## What "Phase 0 complete" looks like

After the first productive session you should have:
- A real Tauri 2 + Vite + React + TS project initialized at this directory's root.
- `src/lib/` populated from `scaffold/src/lib/`, with **19 vitest cases passing** on first run.
- A blank dark window rendering on both macOS and Windows.
- A signed-test distribution spike done on both OSes, with findings written to `docs/archive/phase-0-notes.md`.

If any of those is missing or red, treat it as the next session's first priority.

## After Phase 0

Work the milestones in `docs/design-and-plan.md` §11 in order:
1. Shell (sidebar, ⌘K palette tool-switcher, clipboard, persistence)
2. Hero + #2 (Protobuf decoder + Bytes/Base64/Hex, fully polished)
3. Catalogue (Unix Time, JWT, Hash, UUID/ULID)
4. Native polish (global shortcut, tray, single-instance)
5. Distribution (code signing, notarisation, auto-updater)

## What's in scope for v1, briefly

Six tools, Protobuf as the hero. Six. Not seven. The plan's deferred list is **deferred, not promised** — resist scope drift.

See `docs/design-and-plan.md` §1 for the five workflow success criteria (paste-to-interpretation <2s, no-mouse switching, one-keystroke copy, opens to last/summoned tool, no network). These are how you'll know v1 is done.
