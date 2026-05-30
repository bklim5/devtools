# DevTools

## What This Is

DevTools is a fast, offline, keyboard-driven **desktop application** (macOS first; cross-platform-capable via Tauri 2) of engineering utilities for the messy bytes developers actually see at work. **Schema-less Protobuf decoding is the hero feature**, supported by a tight set of six high-frequency transforms. It is a sharp wedge, not a catalogue — it wins on speed and confidence, not breadth.

## Core Value

**Paste an unknown blob → get a usable, explorable interpretation in under 2 seconds, entirely offline, without touching the mouse.** If everything else fails, the Protobuf decoder doing this flawlessly is the product.

## Requirements

### Validated

(None yet — ship to validate)

### Active

<!-- All hypotheses until shipped and validated. Grouped; REQ-IDs assigned in REQUIREMENTS.md. -->

**Foundation & harness**
- [ ] Tauri 2 + Vite + React + TS app builds and renders a dark window on macOS from one repo
- [ ] Verified `src/lib/` (decoder, bytes, tool types) ported unchanged; **19 decoder vitest cases pass**
- [ ] **Walking-skeleton phase that proves the full build+verify harness end-to-end before any product feature** (codex review → unit tests → real-webview UI verification, plus phase-boundary sign-off)
- [ ] `src/lib/platform/` capability seam (clipboard/store/shortcuts) so tools never import `@tauri-apps/*` directly

**Shell**
- [ ] Sidebar (compact mode) generated from the tool registry
- [ ] ⌘K command palette (tool-switcher; fuzzy match over name+keywords+description; recent-tool memory)
- [ ] Registry as the single control plane (sidebar, palette, router all derive from it)
- [ ] Preferences persistence (theme, last-used tool, window geometry, tree-style toggle)
- [ ] Opens to last-used or summoned tool (no "pick a tool" friction)

**Six tools (hero first)**
- [ ] Protobuf Decoder (hero): schema-less wire-format tree, all viable LEN interpretations surfaced from `LenInterpretation`, resizable panes, packed-repeated UI, status bar, **cards default with rows/cards toggle**
- [ ] Base64 / Hex / Bytes with feature-detect polyfill (`Uint8Array.toBase64`/`fromBase64`/`toHex`/`fromHex`)
- [ ] Unix Time Converter
- [ ] JWT Debugger
- [ ] Hash Generator (Web Crypto SHA family + small MD5 lib)
- [ ] UUID / ULID Generator + Decoder

**Workflow constraints (binding — apply to every tool)**
- [ ] Paste-transforms-instantly (no decode button for the common case)
- [ ] Copy-result-instantly via visible, focusable affordance (≤1 keystroke; no hover-only copy)
- [ ] Status bar: parse state · byte count · current encoding · errors · timing
- [ ] WCAG AA accessibility across the board (visible focus, AA contrast, no opacity-only disabled state)

**Native polish & distribution (macOS)**
- [ ] Global shortcut to summon, tray/menu, single-instance
- [ ] Code signing + notarisation (macOS), DMG, auto-updater

### Out of Scope

- **All deferred tools** (JSON/YAML/XML beautifiers, conversions, URL tools, regex tester, diff, etc.) — commodities that would dilute the product wedge. Deferred, not promised.
- **Cloud sync / accounts / payments** — offline by design; a `premium` registry seam is reserved with **zero v1 UX**.
- **Mobile (iOS/Android) UI** — architecture stays open (layout-agnostic tools, responsive Tailwind) but no v1 mobile UI.
- **Windows + Linux verification/packaging (for now)** — deferred to focus on macOS; Tauri keeps them reachable later.
- **Plugin marketplace / third-party tool loading**, **SSR/server runtime** — not the product.
- **Schema-aware Protobuf (`.proto` imports)** — future paid candidate; v1 is schema-less only.

## Context

- **Current state: Phase 2 (shell) complete** (2026-05-30, verified 20/20 must-haves, user-approved on the real WKWebView). Registry-driven shell shipped — compact Sidebar, ⌘K fuzzy CommandPalette (in-house ranker), App layout, and persistence (theme/accent/last-used/recents) via the real Tauri Store seam, opening straight to the last-used/hero tool. SHL-01/02/03/04/06 validated; **SHL-05 PARTIAL** (window-geometry persistence deferred to Phase 5, D-11). Next: Phase 3 — Hero (Protobuf) + Encoding + UX constraints.
- **Post-design, pre-implementation handoff.** Full spec in `docs/design-and-plan.md`; harness + locked decisions in `docs/harness-and-decisions.md`; original agent brief preserved in `docs/handoff-instructions.md`.
- **Verified assets exist:** `scaffold/src/lib/` (decoder.ts ~295 lines zero-deps + 19 tests, bytes.ts, tool types/registry) — port unchanged. `design/DevTools Mockup.html` is the canonical visual system (CSS vars, IBM Plex Sans + JetBrains Mono). React components in `scaffold/` are structure-reference only — rebuild the visual layer against `design/`.
- **macOS WKWebView automation gap:** official `tauri-driver` supports only Linux/Windows. Community W3C WebDriver plugins for macOS exist (early 2026, 0.1.x). Phase 0 spikes one; fallback is `screencapture` + `chrome-devtools-mcp` against the identical static bundle.
- **Codex CLI + `/codex:review` are installed** and used as the first per-task gate.

## Constraints

- **Tech stack**: Tauri 2 + Vite + React + TypeScript + Tailwind; `react-router` **HashRouter only** (`BrowserRouter` forbidden — static files 404 on reload). Tool logic is pure frontend TS; Rust core is thin (clipboard, hotkey, tray, single-instance, auto-update).
- **No network at runtime** — self-host fonts (IBM Plex Sans + JetBrains Mono, SIL OFL, vendored), no CDN, no accounts, no setup.
- **Six tools only** — no additions from the deferred list, no matter how easy.
- **Do not refactor `decoder.ts` or its 19 tests** without explicit approval — the test bar is the hero feature's spec.
- **Performance**: paste-to-interpretation < 2s; the app should feel instant (OS webview, small binary).
- **Verification (binding harness)**: every task's Definition of Done = **`/codex:review` → unit tests green (`vitest` + `tsc`) → real-webview UI verification**, in that order. Every phase ends with a **human sign-off** on a `tauri build` + `gsd-ui-review` audit. **Parallelize plans, but never let a plan advance past these gates — no skipping ahead.**
- **Platform (current)**: macOS only for build/verify; Windows + Linux deferred.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Verify against the **built Tauri app**, not a Chrome proxy | Desktop is the product's core positioning | — Pending |
| Per-task gate order **review → unit → ui**; human sign-off per phase | User's explicit verification discipline for a desktop app | — Pending |
| Dedicated **walking-skeleton phase** proves the harness before any feature | De-risk the whole pipeline first; macOS webview automation is unproven | — Pending |
| Protobuf tree **`cards` default + rows/cards toggle** (overrides handoff `tree: rows`) | User preference; build switchable format from the start | — Pending |
| WCAG **AA across the board** | Fits keyboard-driven positioning; audited each phase | — Pending |
| **macOS only** for now (Windows/Linux deferred) | No Windows machine; focus the v1 path | — Pending |
| Add `src/lib/platform/` capability seam | Single mock point for tests + cheap mobile/web door | — Pending |
| Self-host IBM Plex Sans + JetBrains Mono (SIL OFL) | "No network" constraint; licenses allow desktop redistribution | — Pending |
| Hand-rolled decoder over `protobufjs` | The product *is* the schema-less heuristics + ambiguity UI | ✓ Good (19 tests pass) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-30 after Phase 2 (shell) completion*
