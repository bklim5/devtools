# DevTools — Project Guide

A fast, offline, keyboard-driven **desktop app** (Tauri 2 + Vite + React + TS, macOS first) for the messy bytes developers see at work. **Schema-less Protobuf decoding is the hero.** A tight, wedge-gated tool set (11 tools today → 13 in v1.9), not a catalogue.

This file is the slim entry point. The full detail lives in the docs below — read the relevant one before working a phase.

## Source-of-truth docs

| For | Read |
|---|---|
| Full product spec (decisions, milestones, UX constraints, risks) | `docs/design-and-plan.md` |
| Build+verify harness & locked decisions (authoritative where it differs from the spec) | `docs/harness-and-decisions.md` |
| Original detailed agent brief (reference; superseded by the above) | `docs/handoff-instructions.md` |
| Canonical visual system (CSS vars, typography, layout) | `design/DevTools Mockup.html` |
| Verified code to port unchanged | `scaffold/src/lib/` (decoder + 19 tests, bytes, tool types/registry) |
| Living project context | `.planning/PROJECT.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md` |

## Build + verify harness (binding — never skip)

**Per task, Definition of Done in this order:**
1. **`/simplify`** — apply reuse/simplification/efficiency/altitude cleanups to the just-written changes (quality only, no bug-hunting), so the steps below cover the simplified code.
2. **`/code-review xhigh`** — recall-mode multi-angle bug hunt over the diff (9 finder angles → verify → sweep). Address every confirmed finding.
3. **`/codex:adversarial-review`** (`--wait --scope working-tree`) — an independent adversarial second opinion that challenges the implementation approach + design choices (not just line bugs). Address findings.
4. **Unit tests green** — `vitest` + `tsc --noEmit` clean. The decoder's **19 tests are the immovable bar**; new features add their own (TDD).
5. **Real-webview UI verification** — two layers, agent-run (do NOT defer the agent-runnable part to the human):
   - **Webview content** — against the actual WKWebView (`scripts/e2e-spike.sh` / `tauri dev`), screenshot + a11y/DOM checks vs `design/`.
   - **Native window chrome** — titlebar theme/legibility, traffic-light inset, window decorations, window dragging live OUTSIDE the webview DOM, so WebDriver/WKWebView-DOM/Chromium can't see them. Launch the built `.app` and capture the REAL window with `scripts/ui-capture.sh "<pgrep-pattern>" <out.png>` (it fronts the window via Accessibility, then `screencapture`s its exact rect — Accessibility + Screen-Recording are granted to the terminal), then Read the PNG. **Capture BOTH build channels** when a change can affect either: the **direct** app (`tauri dev` / `pnpm tauri:build:direct`) AND the **appstore** app (`pnpm tauri:build:appstore`, dev-signed) — their UIs differ (Keygen vs StoreKit upsell; updater/launch-at-login present vs hidden). For theme-sensitive chrome, capture in BOTH light and dark.
   - **Exercise the actual feature flow, not just the chrome** — the native capture must drive the feature under test through its real behaviour, not only re-check the appbar/sidebar. If the task adds/changes a tool, *use that tool* (input → output) and capture it; if it changes a settings pane, open and operate it. Drive interactions via Accessibility (`osascript … System Events`: click, set value, set window size) or the WKWebView WebDriver path, then capture + Read. Probe responsive edges too — e.g. shrink the window to the `minWidth/minHeight` floor and confirm nothing clips or becomes unreachable.
   - What still can't be automated (a true human gate): live StoreKit purchases/refunds and any check needing real drag/gesture input.

**Per phase boundary:** the agent auto-runs `pnpm tauri build` at the human-verify checkpoint (its final non-zero exit is only the absent updater-signing key — confirm via the `.app`/`.dmg` under `src-tauri/target/release/bundle/macos/`, not the exit code), then hands off the built-app path so the human only launches/tests/approves; sign-off requires that walkthrough + a passing `gsd-ui-review` WCAG-AA audit. **Rebuild as the LAST step, after every source change has landed** — in a multi-plan phase an earlier checkpoint plan can build before later plans land webview changes; verify the bundle binary mtime is newer than the last source commit before any walkthrough (never hand off a stale `.app`).

**Plans may run in parallel, but no plan advances past these gates — no skipping ahead.** macOS only for now (Windows/Linux deferred).

## Critical constraints (full list in PROJECT.md → Constraints)

- **HashRouter only** — `BrowserRouter` forbidden (static files 404 on reload).
- **Wedge-gated tool set (not a fixed count)** — a disciplined, GROWING set (11 tools today → 13 in v1.9); every addition must independently clear the product wedge (offline, paste-instant <2s, keyboard-driven, registry-driven, WCAG-AA). Deferred-list tools stay deferred until they clear it — no grab-bag.
- **Do not refactor `decoder.ts` or its 19 tests** without explicit approval.
- **No network at runtime** — self-host IBM Plex Sans + JetBrains Mono; no CDN. Runtime deps stay near-zero by default. Two deliberate, scoped, reviewed exceptions to the zero-new-dep wedge: **Prettier standalone** (v1.9 prettify engine) + **esbuild** (v1.9 minify engine) — both vendored/self-hosted offline (no CDN) and lazy-loaded, so "no network at runtime" still holds. NOT a precedent for grab-bag deps; any further dep must independently clear the wedge.
- Tools import **`src/lib/platform/`**, never `@tauri-apps/*` directly.
- Registry is the single control plane (sidebar, palette, router derive from it).
- Protobuf: **cards default + rows/cards toggle**; `#N` numbers **neutral** (accent = selected only); LEN chips computed from the decoder's `LenInterpretation`; **no hover-only copy**.
- Tool components are layout-agnostic (responsive Tailwind, no fixed widths) — layout chrome lives in the shell.

<!-- GSD:project-start source:PROJECT.md -->
## Project

**DevTools**

DevTools is a fast, offline, keyboard-driven **desktop application** (macOS first; cross-platform-capable via Tauri 2) of engineering utilities for the messy bytes developers actually see at work. **Schema-less Protobuf decoding is the hero feature**, supported by a tight, wedge-gated set of high-frequency transforms (11 tools today, growing to 13 in v1.9 — each addition earns its place through the product wedge). It is a sharp wedge, not a catalogue — it wins on speed and confidence, not breadth.

**Core Value:** **Paste an unknown blob → get a usable, explorable interpretation in under 2 seconds, entirely offline, without touching the mouse.** If everything else fails, the Protobuf decoder doing this flawlessly is the product.

### Constraints

- **Tech stack**: Tauri 2 + Vite + React + TypeScript + Tailwind; `react-router` **HashRouter only** (`BrowserRouter` forbidden — static files 404 on reload). Tool logic is pure frontend TS; Rust core is thin (clipboard, hotkey, tray, single-instance, auto-update).
- **No network at runtime** — self-host fonts (IBM Plex Sans + JetBrains Mono, SIL OFL, vendored), no CDN, no accounts, no setup. Runtime deps near-zero by default, with two deliberate, scoped, reviewed exceptions — **Prettier standalone** (prettify) + **esbuild** (minify), both vendored/self-hosted offline + lazy-loaded ("no network at runtime" preserved). NOT a precedent for grab-bag deps.
- **Wedge-gated tool set** — a disciplined, growing set (11 tools today → 13 in v1.9); each addition must clear the product wedge before shipping. Deferred-list tools stay deferred until they do — no grab-bag additions.
- **Do not refactor `decoder.ts` or its 19 tests** without explicit approval — the test bar is the hero feature's spec.
- **Performance**: paste-to-interpretation < 2s; the app should feel instant (OS webview, small binary).
- **Verification (binding harness)**: every task's Definition of Done = **`/codex:review` → unit tests green (`vitest` + `tsc`) → real-webview UI verification**, in that order. Every phase ends with a **human sign-off** on a `tauri build` + `gsd-ui-review` audit. **Parallelize plans, but never let a plan advance past these gates — no skipping ahead.**
- **Platform (current)**: macOS only for build/verify; Windows + Linux deferred.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->
## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
