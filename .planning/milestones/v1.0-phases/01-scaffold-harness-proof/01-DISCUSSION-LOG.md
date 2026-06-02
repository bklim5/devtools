# Phase 1: Scaffold + Harness Proof - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-30
**Phase:** 1-Scaffold + Harness Proof
**Areas discussed:** Webview automation spike, Walking-skeleton feature shape, Gate enforcement mechanism

---

## Gray-area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Webview automation spike | Which macOS WKWebView WebDriver plugin to try first + fallback bar | ✓ |
| Walking-skeleton feature shape | What the throwaway harness-proof feature is | ✓ |
| Frontend tooling baseline | Package manager, Tailwind v3 vs v4, lint/format | (deferred to Claude's discretion) |
| Gate enforcement mechanism | Pre-commit hook running tsc+vitest | ✓ |

---

## Webview automation spike

| Option | Description | Selected |
|--------|-------------|----------|
| Choochmeque/tauri-webdriver first, time-boxed, fallback ready | Cross-platform plugin (WebdriverIO), widest future leverage | ✓ |
| danielraffel/tauri-wd first, time-boxed, fallback ready | Purpose-built macOS W3C driver | |
| Skip the plugin; go straight to screenshot + chrome-devtools-mcp | Avoid the 0.1.x dependency entirely | |

**User's choice:** Choochmeque/tauri-webdriver first, time-boxed, fallback ready.
**Notes:** One plugin that also covers Windows/Linux when they return. Time-box to a single plan; fall back to screencapture + chrome-devtools-mcp if it can't reliably drive the app. Decision recorded in `docs/phase-0-notes.md`.

---

## Walking-skeleton feature shape

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal paste→transform→copy demo (throwaway) | Byte inspector exercising paste-instant + visible copy + status bar | ✓ |
| Bare hello-world counter | Render + interaction only | |
| Read-only decoder smoke screen | Exercises lib but risks bleeding into Phase 3 hero | |

**User's choice:** Minimal paste→transform→copy demo (throwaway).
**Notes:** Exercises the exact UX-constraint surface the per-task UI gate checks (paste-instant, visible focusable copy, status bar). Explicitly deleted before Phase 2; must not reuse the real Protobuf/Base64 tools.

---

## Gate enforcement mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| lefthook running tsc + vitest on commit | Fast single-binary hook blocks broken commits | ✓ |
| husky + lint-staged | Heavier JS-ecosystem standard | |
| No hook — rely on agent workflow + /codex:review discipline | No mechanical safety | |

**User's choice:** lefthook running tsc + vitest on commit.
**Notes:** Unit gate enforced mechanically. UI gate and /codex:review stay manual (a hook can't run them; codex:review is disable-model-invocation).

## Claude's Discretion

- Frontend tooling baseline (not discussed): pnpm, Tailwind v4 (CSS-first, maps to design CSS vars), eslint + prettier. Verify at plan time.
- Keep project in current `devtools-handoff/` directory (no rename).
- `src/lib/platform/` ships as a real seam with Tauri impl + thin stubs; full store in Phase 2.

## Deferred Ideas

- Windows + Linux build/verify/signing (V2-02)
- Real prefs persistence (Phase 2)
- Registry-driven sidebar + ⌘K palette (Phase 2)
- CI build matrix (deferred with Windows/Linux)
